const ApiCounter = require('../models/ApiCounter');
const { default: fetch } = require('node-fetch');
const cron = require('node-cron');
const youtubeService = require('./youtubeService'); // Now expects tokens for API calls
const CommentRecord = require('../models/CommentRecord');
const User = require('../models/User'); // Assuming you have a User model where tokens are stored

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

      // DEBUG: Log the parsed sentiment result
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

  // Modified to accept `tokens` parameter
  async processComment(comment, tokens) {
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

      // DEBUG: Log the overall auto-reply enabled status
      console.log(`⚙️ AUTO_REPLY_ENABLED environment variable: ${process.env.AUTO_REPLY_ENABLED}`);
      console.log(`❓ shouldAutoReply based on sentiment: ${result.shouldReply}`);


      // IMPORTANT: Check if AUTO_REPLY_ENABLED is truly 'true' (string)
      if (result.shouldReply && process.env.AUTO_REPLY_ENABLED === 'true') {
        try {
          const replyText = await this.generateReply(comment, sentiment);
          
          // Pass the tokens to youtubeService.replyToComment
          console.log(`➡️ Attempting to reply to YouTube comment ${comment.id} using provided tokens...`);
          const replyResponse = await youtubeService.replyToComment(comment.id, replyText, tokens); 
          console.log(`✅ YouTube API reply attempt complete for ${comment.id}. Response:`, replyResponse);

          // Create/Update record *after* successful reply (or try-catch for failure)
          const record = await CommentRecord.create({
            commentId: comment.id,
            sentiment: sentiment,
            text: comment.text, // Save comment text
            author: comment.author, // Save author
            publishedAt: comment.publishedAt, // Save publish date
            videoId: comment.videoId, // Save video ID
            replied: true,
            repliedAt: new Date(),
            replyText: replyText // Save the reply text
          });
          console.log(`💾 New CommentRecord created and marked as replied for ID: ${record.commentId} (DB ID: ${record._id})`);

          result.reply = replyResponse; // Store the response from YouTube API
          console.log(`🎉 Successfully auto-replied to ${comment.id}`);

        } catch (replyError) {
          console.error(`❌ Error auto-replying to comment ${comment.id}:`, replyError.message);
          // If reply fails, still save the comment record without marking it as replied
          await CommentRecord.create({
            commentId: comment.id,
            sentiment: sentiment,
            text: comment.text,
            author: comment.author,
            publishedAt: comment.publishedAt,
            videoId: comment.videoId,
            replied: false, // Mark as not replied due to error
            errorMessage: replyError.message // Store the error message
          });
          console.log(`💾 CommentRecord created but not replied due to error for ID: ${comment.id}`);
        }
      } else {
        // If not replying, create the record without reply details
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
      if (error.code === 11000) { // MongoDB duplicate key error
        console.warn(`⚠️ Duplicate comment skipped (likely a race condition or previous failed save): ${comment.id}`);
      } else {
        console.error(`❌ Error processing comment ${comment?.id || 'unknown'}:`, error.message);
      }
      return null;
    }
  }


  shouldAutoReply(sentiment) {
    const threshold = parseFloat(process.env.SENTIMENT_THRESHOLD || 0.3);

    // --- You can modify this logic based on your desired reply strategy ---
    // For testing, you might simplify it, e.g., `return true;` to always reply.
    // Ensure SENTIMENT_THRESHOLD is set in your environment if you rely on it.

    if (sentiment.sentiment === 'positive' && sentiment.confidence > 0.6) return true;
    if (sentiment.sentiment === 'negative' && sentiment.toxicity < 0.7) return true; // Reply to less toxic negative comments
    // Example: If you want to reply to neutral comments too:
    // if (sentiment.sentiment === 'neutral' && sentiment.confidence > 0.7) return true;

    return false; // Default to not replying if no specific condition is met
  }

  async monitorComments() {
    try {
      console.log('🔍 Checking for new comments...');
      
      // --- IMPORTANT: FETCH USER TOKENS FROM YOUR DATABASE HERE ---
      // This is a placeholder. You need to implement how your application
      // retrieves the YouTube OAuth tokens for the channel you want to manage.
      //
      // Example: If you have a 'User' model and store tokens there:
      const userWithTokens = await User.findOne({ 'youtubeTokens.access_token': { $exists: true } }); // Find a user who has YouTube tokens
      
      if (!userWithTokens || !userWithTokens.youtubeTokens) {
          console.log('🚫 No authenticated user found with YouTube tokens in the database to monitor comments.');
          // Consider what to do if no user is found. Maybe log a warning and stop.
          return;
      }
      const userYoutubeTokens = userWithTokens.youtubeTokens;
      console.log('✅ Fetched YouTube tokens from DB for monitoring.');
      // --- END IMPORTANT ---


      const recentComments = await youtubeService.getRecentComments(1, userYoutubeTokens); // Pass tokens to getRecentComments

      if (!recentComments || recentComments.length === 0) {
        console.log('ℹ️ No new comments found or error fetching comments.');
        return;
      }

      console.log(`📌 Found ${recentComments.length} recent comments from YouTube.`);

      const results = [];
      for (const comment of recentComments) {
        // Pass tokens down to processComment
        const result = await this.processComment(comment, userYoutubeTokens); 
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
    // Note: cron.schedule returns a job object that you can stop.
    // For a simple stop, you might need to store the job instance.
    // For now, this just sets the flag, but the cron job might continue running
    // until the process is restarted or the job is explicitly stopped.
    this.isMonitoring = false;
    console.log('🛑 Stopped monitoring');
  }
}

module.exports = new SentimentService();