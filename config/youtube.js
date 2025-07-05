const { google } = require('googleapis');

class YouTubeConfig {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,      // ✅ Use Google OAuth client ID
      process.env.GOOGLE_CLIENT_SECRET,  // ✅ Use Google OAuth client secret
      process.env.YOUTUBE_REDIRECT_URI    // ✅ Use Google redirect URI
    );

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client
    });

    this.scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ];
  }

  getAuthUrl() {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent'
    });

    console.log('Generated Auth URL:', authUrl);  // ✅ Helpful for debugging
    return authUrl;
  }

  async setCredentials(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  setTokens(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  getYouTubeClient() {
    return this.youtube;
  }

  getOAuth2Client() {
    return this.oauth2Client;
  }
}

module.exports = new YouTubeConfig();
