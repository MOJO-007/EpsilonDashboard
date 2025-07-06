const express = require('express');
const youtubeService = require('../services/youtubeService');
const sentimentService = require('../services/sentimentService');
const CommentRecord = require('../models/CommentRecord');
const ApiCounter = require('../models/ApiCounter');
const router = express.Router();

// Get dashboard overview data
router.get('/overview', async (req, res) => {
  try {
    const [channelInfo, videos, recentComments] = await Promise.all([
      youtubeService.getChannelInfo(),
      youtubeService.getVideos(10),
      youtubeService.getRecentComments(24)
    ]);

    const totalViews = videos.reduce((sum, video) => sum + video.viewCount, 0);
    const totalLikes = videos.reduce((sum, video) => sum + video.likeCount, 0);
    const totalComments = videos.reduce((sum, video) => sum + video.commentCount, 0);

    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };

    for (const comment of recentComments.slice(0, 20)) {
      const record = await CommentRecord.findOne({ commentId: comment.id });
      if (record) {
        sentimentCounts[record.sentiment.sentiment]++;
      } else {
        sentimentCounts.neutral++; // Default if no sentiment stored
      }
    }

    res.json({
      channel: channelInfo,
      analytics: {
        totalViews,
        totalLikes,
        totalComments,
        recentCommentsCount: recentComments.length,
        sentimentBreakdown: sentimentCounts
      },
      recentVideos: videos.slice(0, 5),
      recentComments: recentComments.slice(0, 10)
    });
  } catch (error) {
    console.error('❌ Error in /overview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get sentiment analytics for a specific time period
router.get('/analytics/sentiment', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 168; // Default 7 days
    const comments = await youtubeService.getRecentComments(hours);

    const sentimentData = {
      positive: [],
      negative: [],
      neutral: [],
      timeline: []
    };

    for (const comment of comments.slice(0, 100)) {
      const record = await CommentRecord.findOne({ commentId: comment.id });
      if (!record) continue;

      // Build full comment object with sentiment
      const enrichedComment = {
        commentId: comment.id,
        author: comment.author || 'Unknown',
        authorProfileImageUrl: comment.authorProfileImageUrl || '',
        comment: comment.text,
        confidence: record.sentiment.confidence,
        publishedAt: comment.publishedAt,
        videoTitle: comment.videoTitle,
        likeCount: comment.likeCount || 0,
        sentiment: {
          sentiment: record.sentiment.sentiment,
          confidence: record.sentiment.confidence
        }
      };

      sentimentData[record.sentiment.sentiment].push(enrichedComment);

      sentimentData.timeline.push({
        sentiment: record.sentiment.sentiment,
        publishedAt: comment.publishedAt
      });
    }

    res.json(sentimentData);
  } catch (error) {
    console.error('❌ Error in /analytics/sentiment:', error);
    res.status(500).json({ error: error.message });
  }
});


// Control auto-reply settings
router.post('/auto-reply/toggle', (req, res) => {
  try {
    const { enabled } = req.body;

    if (enabled) {
      sentimentService.startMonitoring();
    } else {
      sentimentService.stopMonitoring();
    }

    res.json({
      success: true,
      autoReplyEnabled: enabled,
      message: `Auto-reply ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('❌ Error in /auto-reply/toggle:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get auto-reply status
router.get('/auto-reply/status', (req, res) => {
  res.json({
    enabled: process.env.AUTO_REPLY_ENABLED === 'true',
    isMonitoring: sentimentService.isMonitoring,
    checkInterval: process.env.CHECK_INTERVAL_MINUTES || 30,
    sentimentThreshold: process.env.SENTIMENT_THRESHOLD || 0.3
  });
});

// Manual trigger for comment monitoring
router.post('/monitor/trigger', async (req, res) => {
  try {
    const results = await sentimentService.monitorComments();
    res.json({
      success: true,
      processedComments: results ? results.length : 0,
      results: results || []
    });
  } catch (error) {
    console.error('❌ Error in /monitor/trigger:', error);
    res.status(500).json({ error: error.message });
  }
});

// Gemini API usage counter
router.get('/analytics/gemini-usage', async (req, res) => {
  try {
    const counter = await ApiCounter.findById('geminiSentimentApi');
    res.json({ totalApiCalls: counter ? counter.count : 0 });
  } catch (error) {
    console.error('❌ Error in /analytics/gemini-usage:', error);
    res.status(500).json({ error: 'Failed to fetch API call count' });
  }
});

module.exports = router;