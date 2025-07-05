const ApiCounter = require('../models/ApiCounter');
const { default: fetch } = require('node-fetch');
const cron = require('node-cron');
const youtubeService = require('./youtubeService');
const CommentRecord = require('../models/CommentRecord');

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
      // This log indicates that the API is about to be called.
      // If you see this for comments that should be skipped, the 'existing' check failed.
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
        console.error('Gemini API Error:', errorData);
        throw new Error(`Reply generation failed: ${response.status}`);
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Thank you for your comment! 😊';
    } catch (error) {
      console.error('❌ Error generating reply:', error.message);
      return 'Thank you for your comment! 😊';
    }
  }

  async processComment(comment) {
    try {
      // DEBUG: Log the comment ID being checked
      console.log(`🔍 Processing comment ID: ${comment.id} (Type: ${typeof comment.id})`);

      const existing = await CommentRecord.findOne({ commentId: comment.id });

      // DEBUG: Log whether an existing record was found
      if (existing) {
        console.log(`ℹ️ Already processed: ${comment.id}. Found existing record with ID: ${existing._id}`);
        console.log(`   Stored commentId: ${existing.commentId} (Type: ${typeof existing.commentId})`);
        return null;  // Do not count already processed comment
      }

      console.log(`✨ No existing record found for ${comment.id}. Proceeding with sentiment analysis.`);
      const sentiment = await this.analyzeSentiment(comment.text);

      const record = await CommentRecord.create({
        commentId: comment.id,
        sentiment: sentiment, // Ensure sentiment object is saved correctly
        // You might want to save more details from the YouTube comment here
        // e.g., text: comment.text, author: comment.author, publishedAt: comment.publishedAt, videoId: comment.videoId
      });
      // DEBUG: Confirm the new record was created
      console.log(`💾 New CommentRecord created for ID: ${record.commentId} (DB ID: ${record._id})`);


      const result = {
        comment,
        sentiment,
        shouldReply: this.shouldAutoReply(sentiment),
        reply: null
      };

      if (result.shouldReply && process.env.AUTO_REPLY_ENABLED === 'true') {
        const replyText = await this.generateReply(comment, sentiment);
        // Assuming youtubeService.replyToComment exists and works
        const reply = await youtubeService.replyToComment(comment.id, replyText);

        record.replied = true;
        record.repliedAt = new Date();
        await record.save();

        result.reply = reply;
        console.log(`✅ Auto-replied to ${comment.id}: ${replyText}`);
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

    if (sentiment.sentiment === 'positive' && sentiment.confidence > 0.8) return true;
    if (sentiment.sentiment === 'negative' && sentiment.toxicity < 0.8) return true;
    if (sentiment.sentiment === 'neutral' && sentiment.confidence < threshold) return true;

    return false;
  }

  async monitorComments() {
    try {
      console.log('🔍 Checking for new comments...');
      // Fetch comments from the last 1 hour. If you want to test with older comments that might already be in DB,
      // temporarily increase this value (e.g., 24 for 24 hours, 168 for 7 days).
      const recentComments = await youtubeService.getRecentComments(1); 

      if (recentComments.length === 0) {
        console.log('ℹ️ No new comments found');
        return;
      }

      console.log(`📌 Found ${recentComments.length} recent comments from YouTube.`);

      const results = [];
      for (const comment of recentComments) {
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
    // Ensure cron.schedule is correctly imported and working in your environment
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