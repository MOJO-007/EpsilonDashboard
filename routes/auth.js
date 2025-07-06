// routes/auth.js
const express = require('express');
const youtubeConfig = require('../config/youtube'); // Make sure youtubeConfig is correctly imported
const router = express.Router();

// No longer need a global userTokens variable
// let userTokens = null; // REMOVE OR COMMENT OUT THIS LINE

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
    
    // Store tokens in the session
    req.session.youtubeTokens = tokens; // <--- Store tokens in session
    req.session.isAuthenticated = true; // <--- Mark session as authenticated

    console.log('✅ YouTube authentication successful');
    res.redirect('/?auth=success'); // Redirect to frontend dashboard
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('/?auth=error'); // Redirect to frontend with error
  }
});

router.get('/status', (req, res) => {
  // Check if youtubeTokens exist in the session
  const authenticated = !!req.session.youtubeTokens;
  const hasRefreshToken = !!(req.session.youtubeTokens && req.session.youtubeTokens.refresh_token);

  res.json({
    authenticated: authenticated,
    hasRefreshToken: hasRefreshToken
  });
});

router.post('/logout', (req, res) => {
  // Destroy the session to log out
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ success: false, message: 'Could not log out.' });
    }
    // Clear the session cookie from the client
    res.clearCookie('connect.sid'); // This is the default session cookie name for express-session
    res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// Middleware to check authentication
router.use('/protected', (req, res, next) => {
  // Check if youtubeTokens exist in the session
  if (!req.session.youtubeTokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Set credentials for youtubeConfig for subsequent API calls
  youtubeConfig.setTokens(req.session.youtubeTokens);
  next();
});

module.exports = router;