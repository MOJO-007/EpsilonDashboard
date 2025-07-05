const express = require('express');
const youtubeService = require('../services/youtubeService');
const sentimentService = require('../services/sentimentService');
const router = express.Router();

// Get dashboard overview data
router.get('/overview', async (req, res) => {
  try {
    const [channelInfo, videos, recentComments] = await Promise.all([
      youtubeService.getChannelInfo(),
      youtubeService.getVideos(10),
      youtubeService.getRecentComments(24)
    ]);

    // Calculate analytics
    const totalViews = videos.reduce((sum, video) => sum + video.viewCount, 0);
    const totalLikes = videos.reduce((sum, video) => sum + video.likeCount, 0);
    const totalComments = videos.reduce((sum, video) => sum + video.commentCount, 0);

    // Analyze recent comments sentiment
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
    for (const comment of recentComments.slice(0, 20)) {
      const sentiment = await sentimentService.analyzeSentiment(comment.text);
      sentimentCounts[sentiment.sentiment]++;
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

    // Process comments in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < Math.min(comments.length, 100); i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      
      for (const comment of batch) {
        const sentiment = await sentimentService.analyzeSentiment(comment.text);
        sentimentData[sentiment.sentiment].push({
          comment: comment.text,
          confidence: sentiment.confidence,
          publishedAt: comment.publishedAt,
          videoTitle: comment.videoTitle
        });
      }
    }

    res.json(sentimentData);
  } catch (error) {
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

// Manual comment monitoring trigger
router.post('/monitor/trigger', async (req, res) => {
  try {
    const results = await sentimentService.monitorComments();
    res.json({
      success: true,
      processedComments: results ? results.length : 0,
      results: results || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;