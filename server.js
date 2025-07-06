// server.js
require('./config/db');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const session = require('express-session'); // <--- ADD THIS LINE: Import express-session

const authRoutes = require('./routes/auth');
const youtubeRoutes = require('./routes/youtube');
const dashboardRoutes = require('./routes/dashboard');
const twitterRoutes = require('./routes/twitter'); // <--- ADD THIS LINE: Import Twitter routes
const sentimentService = require('./services/sentimentService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://www.googleapis.com", "https://api.twitter.com"] // <--- ADDED Twitter API domain here
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.RENDER_EXTERNAL_URL : 'http://localhost:3000', // <--- Use RENDER_EXTERNAL_URL in production
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------------------------------------------------
// IMPORTANT: express-session middleware MUST COME BEFORE ANY ROUTES
// that access req.session (like authRoutes and twitterRoutes).
// ----------------------------------------------------------------------
app.use(session({
    secret: process.env.SESSION_SECRET, // <--- IMPORTANT: Set this in your Render Environment Variables
    resave: false, // Don't save session if unmodified
    saveUninitialized: true, // Save new sessions
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
      httpOnly: true, // Prevent client-side JS from accessing cookie
      maxAge: 24 * 60 * 60 * 1000 // Session lasts 24 hours
    }
}));
// ----------------------------------------------------------------------


// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes (MUST come AFTER session middleware if they use req.session)
app.use('/auth', authRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/', twitterRoutes); // <--- ADDED Twitter routes here

// Serve dashboard (your main entry point)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 YouTube Dashboard running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize sentiment monitoring
  if (process.env.AUTO_REPLY_ENABLED === 'true') {
    sentimentService.startMonitoring();
    console.log('🤖 Automated sentiment monitoring started');
  }
});

module.exports = app;