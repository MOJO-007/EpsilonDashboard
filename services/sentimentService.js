const ApiCounter = require('../models/ApiCounter');
const { default: fetch } = require('node-fetch');
const cron = require('node-cron');
const youtubeService = require('./youtubeService');
const CommentRecord = require('../models/CommentRecord');

// Removed: const User = require('../models/User'); // No longer required

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

class SentimentService {
  constructor() {
    this.isMonitoring = false;
  }

  async incrementApiCallCount() {
    try {
      await ApiCounter.findByIdAndUpdate(
        'geminiSentimentApi',
        { $inc: { count: 1 } },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error('❌ Failed to increment API call counter:', err.message);
    }
  }

  async analyzeSentiment(text) {
    try {
      console.log(`⚡ Gemini API CALLED for text: "${text.slice(0, 50)}..."`);
      
      const prompt = `Analyze the sentiment of this comment and provide a JSON response:
      {
        "sentiment": "positive|negative|neutral",
        "confidence": 0.0-1.0,
        "emotions": ["emotion1", "emotion2"],
        "toxicity": 0.0-1.0,
        "summary": "brief analysis"
      }
      
      Comment: "${text}"
      
      Only respond with valid JSON.`;

      const payload = {
        contents: [{
          parts: [{ text: prompt }]
        }]
      };

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error:', errorData);
        throw new Error(`Sentiment analysis failed: ${response.status}`);
      }

      const result = await response.json();
      await this.incrementApiCallCount();

      const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanedText = generatedText.replace(/```json\n?|\n?```/g, '').trim();

      console.log('Parsed Sentiment Result:', JSON.stringify(JSON.parse(cleanedText), null, 2));

      return JSON.parse(cleanedText);
    } catch (error) {
      console.error('❌ Error analyzing sentiment:', error.message);
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        emotions: [],
        toxicity: 0.0,
        summary: 'Analysis failed'
      };
    }
  }

  async generateReply(comment, sentiment) {
    try {
      let prompt = '';

      switch (sentiment.sentiment) {
        case 'positive':
          prompt = `Generate a warm, appreciative reply to: "${comment.text}"`;
          break;
        case 'negative':
          prompt = sentiment.toxicity > 0.7
            ? `Generate a professional, de-escalating reply to: "${comment.text}"`
            : `Generate a helpful, understanding reply to: "${comment.text}"`;
          break;
        default:
          prompt = `Generate a friendly, engaging reply to: "${comment.text}"`;
      }

      prompt += '\n\nLimit to 200 characters, friendly, professional, no quotes.';

      const payload = {
        contents: [{
          parts: [{ text: prompt }]
        }]
      };

      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API Error (Reply Generation):', errorData);
        throw new Error(`Reply generation failed: ${response.status}`);
      }

      const result = await response.json();
      const replyText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Thank you for your comment! 😊';
      console.log(`💬 Generated reply text for "${comment.text.slice(0, 30)}...": "${replyText}"`);
      return replyText;

    } catch (error) {
      console.error('❌ Error generating reply:', error.message);
      return 'Thank you for your comment! 😊';
    }
  }

  // Original signature, no `tokens` parameter
  async processComment(comment) {
    try {
      console.log(`🔍 Processing comment ID: ${comment.id} (Type: ${typeof comment.id})`);

      const existing = await CommentRecord.findOne({ commentId: comment.id });

      if (existing) {
        console.log(`ℹ️ Already processed: ${comment.id}. Found existing record with ID: ${existing._id}`);
        console.log(`   Stored commentId: ${existing.commentId} (Type: ${typeof existing.commentId})`);
        return null;
      }

      console.log(`✨ No existing record found for ${comment.id}. Proceeding with sentiment analysis.`);
      const sentiment = await this.analyzeSentiment(comment.text);

      const result = {
        comment,
        sentiment,
        shouldReply: this.shouldAutoReply(sentiment),
        reply: null
      };

      console.log(`⚙️ AUTO_REPLY_ENABLED environment variable: ${process.env.AUTO_REPLY_ENABLED}`);
      console.log(`❓ shouldAutoReply based on sentiment: ${result.shouldReply}`);

      if (result.shouldReply && process.env.AUTO_REPLY_ENABLED === 'true') {
        try {
          const replyText = await this.generateReply(comment, sentiment);
          
          console.log(`➡️ Attempting to reply to YouTube comment ${comment.id}...`);
          // WARNING: This call will likely fail without tokens.
          // youtubeService.replyToComment now expects tokens, but we aren't providing them here.
          const replyResponse = await youtubeService.replyToComment(comment.id, replyText); 
          console.log(`✅ YouTube API reply attempt complete for ${comment.id}. Response:`, replyResponse);

          const record = await CommentRecord.create({
            commentId: comment.id,
            sentiment: sentiment,
            text: comment.text,
            author: comment.author,
            publishedAt: comment.publishedAt,
            videoId: comment.videoId,
            replied: true,
            repliedAt: new Date(),
            replyText: replyText
          });
          console.log(`💾 New CommentRecord created and marked as replied for ID: ${record.commentId} (DB ID: ${record._id})`);

          result.reply = replyResponse;
          console.log(`🎉 Successfully auto-replied to ${comment.id}`);

        } catch (replyError) {
          console.error(`❌ Error auto-replying to comment ${comment.id}:`, replyError.message);
          await CommentRecord.create({
            commentId: comment.id,
            sentiment: sentiment,
            text: comment.text,
            author: comment.author,
            publishedAt: comment.publishedAt,
            videoId: comment.videoId,
            replied: false,
            errorMessage: replyError.message
          });
          console.log(`💾 CommentRecord created but not replied due to error for ID: ${comment.id}`);
        }
      } else {
        const record = await CommentRecord.create({
          commentId: comment.id,
          sentiment: sentiment,
          text: comment.text,
          author: comment.author,
          publishedAt: comment.publishedAt,
          videoId: comment.videoId,
          replied: false,
        });
        console.log(`💾 CommentRecord created (no reply) for ID: ${record.commentId} (DB ID: ${record._id})`);
        console.log(`🚫 Skipped auto-reply for comment ${comment.id}. Should reply: ${result.shouldReply}, Auto-reply enabled: ${process.env.AUTO_REPLY_ENABLED}`);
      }

      return result;
    } catch (error) {
      if (error.code === 11000) {
        console.warn(`⚠️ Duplicate comment skipped (likely a race condition or previous failed save): ${comment.id}`);
      } else {
        console.error(`❌ Error processing comment ${comment?.id || 'unknown'}:`, error.message);
      }
      return null;
    }
  }

  shouldAutoReply(sentiment) {
    const threshold = parseFloat(process.env.SENTIMENT_THRESHOLD || 0.3);

    if (sentiment.sentiment === 'positive' && sentiment.confidence > 0.6) return true;
    if (sentiment.sentiment === 'negative' && sentiment.toxicity < 0.7) return true;
    if (sentiment.sentiment === 'neutral') return true; 
    
    return false;
  }

  async monitorComments() {
    try {
      console.log('🔍 Checking for new comments...');
      
      // Removed: Token fetching logic from User model
      // const userWithTokens = await User.findOne(...);
      // const userYoutubeTokens = userWithTokens.youtubeTokens;
      // console.log('✅ Fetched YouTube tokens from DB for monitoring.');

      // WARNING: youtubeService.getRecentComments will now rely on global/initial auth,
      // which might not be authenticated for write operations needed for replies.
      const recentComments = await youtubeService.getRecentComments(1); 

      if (!recentComments || recentComments.length === 0) {
        console.log('ℹ️ No new comments found or error fetching comments.');
        return;
      }

      console.log(`📌 Found ${recentComments.length} recent comments from YouTube.`);

      const results = [];
      for (const comment of recentComments) {
        // No tokens to pass to processComment
        const result = await this.processComment(comment); 
        if (result) results.push(result);
      }
      console.log(`📊 Monitoring cycle complete. Processed ${results.length} new/updated comments.`);
      return results;
    } catch (error) {
      console.error('❌ Error monitoring comments:', error.message);
    }
  }

  startMonitoring() {
    if (this.isMonitoring) {
      console.log('ℹ️ Monitoring already active');
      return;
    }

    const interval = process.env.CHECK_INTERVAL_MINUTES || 30;
    cron.schedule(`*/${interval} * * * *`, () => {
      console.log(`⏰ Scheduled monitoring run triggered at ${new Date().toISOString()}`);
      this.monitorComments();
    });

    this.isMonitoring = true;
    console.log(`🤖 Started monitoring every ${interval} min`);
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('🛑 Stopped monitoring');
  }
}

module.exports = new SentimentService();