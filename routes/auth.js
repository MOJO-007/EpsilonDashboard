const express = require('express');
const youtubeConfig = require('../config/youtube');
const router = express.Router();

// Store tokens in memory (in production, use a proper database)
let userTokens = null;

router.get('/youtube', (req, res) => {
  const authUrl = youtubeConfig.getAuthUrl();
  res.redirect(authUrl);
});

router.get('/youtube/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code not provided' });
    }

    const tokens = await youtubeConfig.setCredentials(code);
    userTokens = tokens;

    console.log('✅ YouTube authentication successful');
    res.redirect('/?auth=success');
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('/?auth=error');
  }
});

router.get('/status', (req, res) => {
  res.json({
    authenticated: !!userTokens,
    hasRefreshToken: !!(userTokens && userTokens.refresh_token)
  });
});

router.post('/logout', (req, res) => {
  userTokens = null;
  res.json({ success: true });
});

// Middleware to check authentication
router.use('/protected', (req, res, next) => {
  if (!userTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  youtubeConfig.setTokens(userTokens);
  next();
});

module.exports = router;