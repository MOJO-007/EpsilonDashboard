const express = require('express');
const youtubeService = require('../services/youtubeService');
const sentimentService = require('../services/sentimentService');
const router = express.Router();

// Get channel information
router.get('/channel', async (req, res) => {
  try {
    const channelInfo = await youtubeService.getChannelInfo();
    res.json(channelInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all videos
router.get('/videos', async (req, res) => {
  try {
    const maxResults = parseInt(req.query.maxResults) || 50;
    const videos = await youtubeService.getVideos(maxResults);
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get comments for a specific video
router.get('/videos/:videoId/comments', async (req, res) => {
  try {
    const { videoId } = req.params;
    const maxResults = parseInt(req.query.maxResults) || 100;
    const comments = await youtubeService.getVideoComments(videoId, maxResults);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze sentiment of a comment
router.post('/comments/:commentId/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const sentiment = await sentimentService.analyzeSentiment(text);
    res.json(sentiment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reply to a comment
router.post('/comments/:commentId/reply', async (req, res) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    const reply = await youtubeService.replyToComment(commentId, text);
    res.json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent comments across all videos
router.get('/comments/recent', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const comments = await youtubeService.getRecentComments(hours);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk analyze comments for a video
router.post('/videos/:videoId/analyze-comments', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { comments } = await youtubeService.getVideoComments(videoId, 50);
    
    const analyzedComments = [];
    for (const comment of comments) {
      const sentiment = await sentimentService.analyzeSentiment(comment.text);
      analyzedComments.push({
        ...comment,
        sentiment
      });
    }

    res.json(analyzedComments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;