const { google } = require('googleapis'); // Import google from googleapis
const youtubeConfig = require('../config/youtube'); // Make sure this is still correct for client ID/secret, etc.
const moment = require('moment');

// Function to create an authenticated OAuth2 client from tokens
// This is key to ensuring API calls are made on behalf of the correct user.
function getAuthenticatedClient(tokens) {
    if (!tokens) {
        throw new Error('No tokens provided to authenticate YouTube client.');
    }
    const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID, // Ensure these are set in your .env / Render env vars
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI // Ensure this is also correctly set for the server context
    );
    oauth2Client.setCredentials(tokens);
    return oauth2Client;
}


class YouTubeService {
  // The constructor no longer initializes a global 'this.youtube' client directly.
  // Instead, methods will receive or create an authenticated client.
  constructor() {
    // We can still keep the youtubeConfig in case it has other shared utilities,
    // but the main YouTube client will be created per-request/per-job with specific tokens.
  }

  // Helper to get a YouTube client for a specific authenticated context
  _getYouTubeClient(tokens) {
      const oauth2Client = getAuthenticatedClient(tokens);
      return google.youtube({
          version: 'v3',
          auth: oauth2Client
      });
  }

  async getChannelInfo(tokens) { // <-- Added tokens parameter
    const youtube = this._getYouTubeClient(tokens); // <-- Use tokens to get client
    const response = await youtube.channels.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      mine: true
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('No channel found for authenticated user');
    }

    const channel = response.data.items[0];
    return {
      id: channel.id,
      title: channel.snippet.title,
      description: channel.snippet.description,
      thumbnail: channel.snippet.thumbnails.default.url,
      subscriberCount: parseInt(channel.statistics.subscriberCount),
      videoCount: parseInt(channel.statistics.videoCount),
      viewCount: parseInt(channel.statistics.viewCount),
      uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads
    };
  }

  async getVideos(tokens, maxResults = 50) { // <-- Added tokens parameter
    const youtube = this._getYouTubeClient(tokens); // <-- Use tokens to get client
    const channelInfo = await this.getChannelInfo(tokens); // Pass tokens down
    const response = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: channelInfo.uploadsPlaylistId,
      maxResults
    });

    const videoIds = response.data.items.map(item => item.contentDetails.videoId);

    // Get detailed video info including statistics + status
    const videosResponse = await youtube.videos.list({ // <-- Use tokens to get client
      part: ['statistics', 'status', 'snippet'],
      id: videoIds
    });

    return videosResponse.data.items.map(video => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnail: video.snippet.thumbnails.medium.url,
      publishedAt: video.snippet.publishedAt,
      publishedAtFormatted: moment(video.snippet.publishedAt).format('MMM DD,YYYY HH:mm'), // Fixed formatting
      viewCount: parseInt(video.statistics.viewCount || 0),
      likeCount: parseInt(video.statistics.likeCount || 0),
      commentCount: parseInt(video.statistics.commentCount || 0),
      commentStatus: video.status.commentStatus
    }));
  }

  async getVideoComments(videoId, tokens, maxResults = 100) { // <-- Added tokens parameter
    const youtube = this._getYouTubeClient(tokens); // <-- Use tokens to get client
    const response = await youtube.commentThreads.list({
      part: ['snippet', 'replies'],
      videoId,
      maxResults,
      order: 'time'
    });

    return {
      comments: response.data.items.map(item => {
        const comment = item.snippet.topLevelComment.snippet;
        const replies = item.replies ? item.replies.comments.map(reply => ({
          id: reply.id,
          text: reply.snippet.textDisplay,
          author: reply.snippet.authorDisplayName,
          authorProfileImageUrl: reply.snippet.authorProfileImageUrl,
          publishedAt: reply.snippet.publishedAt,
          publishedAtFormatted: moment(reply.snippet.publishedAt).format('MMM DD,YYYY HH:mm'), // Fixed formatting
          likeCount: reply.snippet.likeCount
        })) : [];

        return {
          id: item.id,
          text: comment.textDisplay,
          author: comment.authorDisplayName,
          authorProfileImageUrl: comment.authorProfileImageUrl,
          publishedAt: comment.publishedAt,
          publishedAtFormatted: moment(comment.publishedAt).format('MMM DD,YYYY HH:mm'), // Fixed formatting
          likeCount: comment.likeCount,
          replyCount: item.snippet.totalReplyCount || 0,
          replies
        };
      }),
      nextPageToken: response.data.nextPageToken
    };
  }

  async getRecentComments(hours = 24, tokens) { // <-- Added tokens parameter
    const videos = await this.getVideos(tokens, 10); // Pass tokens down
    const cutoffTime = moment().subtract(hours, 'hours');
    const recentComments = [];

    for (const video of videos) {
      if (video.commentStatus === 'disabled' || video.commentCount === 0) {
        console.log(`⚠️ Skipping video ${video.id} - comments disabled or no comments`);
        continue;
      }

      try {
        const { comments } = await this.getVideoComments(video.id, tokens, 50); // Pass tokens down
        const newComments = comments.filter(comment =>
          moment(comment.publishedAt).isAfter(cutoffTime)
        );

        recentComments.push(...newComments.map(comment => ({
          ...comment,
          videoId: video.id,
          videoTitle: video.title
        })));
      } catch (err) {
        console.error(`❌ Failed to fetch comments for ${video.id}:`, err.message);
      }
    }

    return recentComments.sort((a, b) =>
      moment(b.publishedAt).valueOf() - moment(a.publishedAt).valueOf()
    );
  }

  async replyToComment(commentId, text, tokens) { // <-- Added tokens parameter
    const youtube = this._getYouTubeClient(tokens); // <-- Use tokens to get client
    try {
        const response = await youtube.comments.insert({
          part: ['snippet'],
          requestBody: {
            snippet: {
              parentId: commentId,
              textOriginal: text
            }
          }
        });

        console.log(`✅ YouTube API replied to comment ${commentId}. Response:`, response.data);
        return {
          id: response.data.id,
          text: response.data.snippet.textOriginal,
          publishedAt: response.data.snippet.publishedAt
        };
    } catch (error) {
        console.error(`❌ Error sending reply to comment ${commentId}:`, error.message);
        if (error.response && error.response.data) {
            console.error('YouTube API error details for reply:', error.response.data);
        }
        throw error; // Re-throw so calling service can handle
    }
  }
}

module.exports = new YouTubeService();