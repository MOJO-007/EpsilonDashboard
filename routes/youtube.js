// routes/youtube.js
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
    console.error('❌ Error in /youtube/channel:', error); // Added specific log
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
    console.error('❌ Error in /youtube/videos:', error); // Added specific log
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
    console.error(`❌ Error in /youtube/videos/${req.params.videoId}/comments:`, error); // Added specific log
    res.status(500).json({ error: error.message });
  }
});

// Analyze sentiment of a SINGLE comment (This route is fine as is, it's for individual analysis)
router.post('/comments/:commentId/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    // This route is designed for analyzing a single, new comment text.
    // It's not the one causing bulk re-analysis.
    const sentiment = await sentimentService.analyzeSentiment(text);
    res.json(sentiment);
  } catch (error) {
    console.error(`❌ Error in /youtube/comments/${req.params.commentId}/analyze:`, error); // Added specific log
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
    console.error(`❌ Error in /youtube/comments/${req.params.commentId}/reply:`, error); // Added specific log
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
    console.error('❌ Error in /youtube/comments/recent:', error); // Added specific log
    res.status(500).json({ error: error.message });
  }
});

// Bulk analyze comments for a video
// THIS IS THE ROUTE THAT NEEDS TO BE FIXED TO PREVENT REDUNDANT API CALLS
router.post('/videos/:videoId/analyze-comments', async (req, res) => {
  try {
    const { videoId } = req.params;
    console.log(`📌 Received request to bulk analyze comments for video ID: ${videoId}`);

    // Fetch comments for the specific video.
    // Note: youtubeService.getVideoComments returns an object like { comments: [...] }
    // or just the array directly. Adjust based on its actual return type.
    const videoCommentsResponse = await youtubeService.getVideoComments(videoId, 50);
    const comments = videoCommentsResponse.comments || videoCommentsResponse; // Adapt to actual return

    if (!comments || comments.length === 0) {
      console.log(`ℹ️ No comments found for video ${videoId} to analyze.`);
      return res.status(200).json({ success: true, message: `No comments found for video ${videoId} to analyze.`, processedComments: 0 });
    }

    console.log(`Found ${comments.length} comments for video ${videoId}. Processing...`);
    const processedResults = [];
    for (const comment of comments) {
      // Use sentimentService.processComment, which contains the logic to:
      // 1. Check if the comment is already in the CommentRecord database.
      // 2. If not, analyze its sentiment using Gemini.
      // 3. Save the result to the database.
      const result = await sentimentService.processComment(comment);
      if (result) { // Only push if processing actually occurred (i.e., not null/already processed)
        processedResults.push(result);
      }
    }

    console.log(`✅ Bulk analysis process completed for video ${videoId}. Processed ${processedResults.length} new/updated comments.`);
    res.json({
      success: true,
      message: `Bulk analysis initiated for video ${videoId}. ${processedResults.length} new comments processed.`,
      processedComments: processedResults.length,
      details: processedResults.map(r => ({ commentId: r.comment.id, sentiment: r.sentiment.sentiment }))
    });

  } catch (error) {
    console.error(`❌ Error in POST /youtube/videos/${req.params.videoId}/analyze-comments:`, error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;