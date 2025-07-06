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
    console.log(`🔍 Attempting to claim and process comment ID: ${comment.id}`);

    // STEP 1: Try to claim the comment by inserting a placeholder record
    const insertResult = await CommentRecord.updateOne(
      { commentId: comment.id },
      {
        $setOnInsert: {
          commentId: comment.id,
          text: comment.text,
          author: comment.author,
          publishedAt: comment.publishedAt,
          videoId: comment.videoId,
          sentiment: {},   // will fill after analysis
          replied: false
        }
      },
      { upsert: true }
    );

    if (insertResult.upsertedCount === 0) {
      console.log(`🚫 Skipping already-claimed comment: ${comment.id}`);
      return null;
    }

    console.log(`✨ Successfully claimed comment: ${comment.id}. Proceeding with sentiment analysis.`);

    // STEP 2: Analyze sentiment
    const sentiment = await this.analyzeSentiment(comment.text);

    // Decide whether to reply
    const shouldReply = this.shouldAutoReply(sentiment);
    let replyText = null;
    let replyResponse = null;

    console.log(`⚙️ AUTO_REPLY_ENABLED: ${process.env.AUTO_REPLY_ENABLED}`);
    console.log(`❓ Should auto-reply: ${shouldReply}`);

    if (shouldReply && process.env.AUTO_REPLY_ENABLED === 'true') {
      try {
        replyText = await this.generateReply(comment, sentiment);
        console.log(`➡️ Replying to comment ${comment.id} with: "${replyText}"`);

        replyResponse = await youtubeService.replyToComment(comment.id, replyText);
        console.log(`✅ Replied to comment ${comment.id}:`, replyResponse);

        // Update record with reply
        await CommentRecord.updateOne(
          { commentId: comment.id },
          {
            $set: {
              sentiment,
              replied: true,
              repliedAt: new Date(),
              replyText
            }
          }
        );

        console.log(`💾 Updated CommentRecord as replied: ${comment.id}`);
      } catch (replyError) {
        console.error(`❌ Error replying to ${comment.id}:`, replyError.message);

        await CommentRecord.updateOne(
          { commentId: comment.id },
          {
            $set: {
              sentiment,
              replied: false,
              errorMessage: replyError.message
            }
          }
        );

        console.log(`💾 Updated CommentRecord with reply failure: ${comment.id}`);
      }
    } else {
      // Just update sentiment, no reply
      await CommentRecord.updateOne(
        { commentId: comment.id },
        { $set: { sentiment } }
      );

      console.log(`💾 Updated CommentRecord with sentiment only: ${comment.id}`);
    }

    return {
      comment,
      sentiment,
      shouldReply,
      reply: replyResponse
    };

  } catch (error) {
    console.error(`❌ Fatal error processing comment ${comment.id}:`, error.message);
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

    const recentComments = await youtubeService.getRecentComments(1); 

    if (!recentComments || recentComments.length === 0) {
      console.log('ℹ️ No new comments found or error fetching comments.');
      return [];
    }

    console.log(`📌 Found ${recentComments.length} recent comments from YouTube.`);

    // Pre-fetch existing records
    const commentIds = recentComments.map(c => c.id);
    const existingRecords = await CommentRecord.find({ commentId: { $in: commentIds } });
    const existingIds = new Set(existingRecords.map(r => r.commentId));

    console.log(`⚠️ Skipping ${existingIds.size} comments already processed.`);

    const results = [];
    for (const comment of recentComments) {
      if (existingIds.has(comment.id)) {
        console.log(`🚫 Skipping already processed comment: ${comment.id}`);
        continue;
      }

      const result = await this.processComment(comment); 
      if (result) results.push(result);
    }

    console.log(`📊 Monitoring cycle complete. Processed ${results.length} new comments.`);
    return results;

  } catch (error) {
    console.error('❌ Error monitoring comments:', error.message);
    return [];
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