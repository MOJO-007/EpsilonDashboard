const { default: fetch } = require('node-fetch');
const cron = require('node-cron');
const youtubeService = require('./youtubeService');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

class SentimentService {
  constructor() {
    this.isMonitoring = false;
    this.processedComments = new Set();
  }

  async analyzeSentiment(text) {
    try {
      const prompt = `Analyze the sentiment of this comment and provide a JSON response with the following structure:
      {
        "sentiment": "positive|negative|neutral",
        "confidence": 0.0-1.0,
        "emotions": ["emotion1", "emotion2"],
        "toxicity": 0.0-1.0,
        "summary": "brief analysis"
      }
      
      Comment: "${text}"
      
      Please respond only with valid JSON.`;

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
        throw new Error(`Sentiment analysis failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanedText = generatedText.replace(/```json\n?|\n?```/g, '').trim();

      return JSON.parse(cleanedText);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
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
          prompt = `Generate a warm, appreciative reply to this positive comment. Keep it genuine and engaging: "${comment.text}"`;
          break;
        case 'negative':
          if (sentiment.toxicity > 0.7) {
            prompt = `Generate a professional, de-escalating response to this negative comment. Be empathetic but firm: "${comment.text}"`;
          } else {
            prompt = `Generate a helpful, understanding reply to address this concern: "${comment.text}"`;
          }
          break;
        default:
          prompt = `Generate a friendly, engaging reply to this neutral comment: "${comment.text}"`;
      }

      prompt += '\n\nKeep the reply under 200 characters, friendly, and professional. Do not use quotes in the response.';

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
        throw new Error(`Reply generation failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Thank you for your comment! 😊';
    } catch (error) {
      console.error('Error generating reply:', error);
      return 'Thank you for your comment! 😊';
    }
  }

  async processComment(comment) {
    try {
      if (this.processedComments.has(comment.id)) {
        return null;
      }

      const sentiment = await this.analyzeSentiment(comment.text);
      this.processedComments.add(comment.id);

      const result = {
        comment,
        sentiment,
        shouldReply: this.shouldAutoReply(sentiment),
        reply: null
      };

      if (result.shouldReply && process.env.AUTO_REPLY_ENABLED === 'true') {
        const replyText = await this.generateReply(comment, sentiment);
        try {
          const reply = await youtubeService.replyToComment(comment.id, replyText);
          result.reply = reply;
          console.log(`✅ Auto-replied to comment ${comment.id}: ${replyText}`);
        } catch (replyError) {
          console.error('Failed to send auto-reply:', replyError);
        }
      }

      return result;
    } catch (error) {
      console.error('Error processing comment:', error);
      return null;
    }
  }

  shouldAutoReply(sentiment) {
    const threshold = parseFloat(process.env.SENTIMENT_THRESHOLD || 0.3);

    if (sentiment.sentiment === 'positive' && sentiment.confidence > 0.8) {
      return true;
    }

    if (sentiment.sentiment === 'negative' && sentiment.toxicity < 0.8) {
      return true;
    }

    if (sentiment.sentiment === 'neutral' && sentiment.confidence < threshold) {
      return true;
    }

    return false;
  }

  async monitorComments() {
    try {
      console.log('🔍 Checking for new comments...');
      const recentComments = await youtubeService.getRecentComments(1);

      if (recentComments.length === 0) {
        console.log('No new comments found');
        return;
      }

      console.log(`Found ${recentComments.length} recent comments`);

      const results = [];
      for (const comment of recentComments) {
        const result = await this.processComment(comment);
        if (result) {
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      console.error('Error monitoring comments:', error);
    }
  }

  startMonitoring() {
    if (this.isMonitoring) {
      console.log('Monitoring already started');
      return;
    }

    const interval = process.env.CHECK_INTERVAL_MINUTES || 30;
    cron.schedule(`*/${interval} * * * *`, () => {
      this.monitorComments();
    });

    this.isMonitoring = true;
    console.log(`🤖 Started monitoring comments every ${interval} minutes`);
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('Stopped monitoring comments');
  }

  clearProcessedComments() {
    this.processedComments.clear();
    console.log('Cleared processed comments cache');
  }
}

module.exports = new SentimentService();
