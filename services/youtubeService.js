const { google } = require('googleapis'); // Keep this if used in youtubeConfig
const youtubeConfig = require('../config/youtube'); // Assume this still provides the client
const moment = require('moment');

class YouTubeService {
  constructor() {
    // This will now use the client provided by youtubeConfig.
    // This client needs to be configured with an API key or fixed OAuth tokens
    // if you want any background functionality without a User model.
    this.youtube = youtubeConfig.getYouTubeClient(); 
  }

  // All methods below revert to not accepting a 'tokens' parameter
  // and instead use 'this.youtube'.

  async getChannelInfo() { // Removed tokens parameter
    const response = await this.youtube.channels.list({
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

  async getVideos(maxResults = 50) { // Removed tokens parameter
    const channelInfo = await this.getChannelInfo(); // No tokens passed here
    const response = await this.youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: channelInfo.uploadsPlaylistId,
      maxResults
    });

    const videoIds = response.data.items.map(item => item.contentDetails.videoId);

    const videosResponse = await this.youtube.videos.list({
      part: ['statistics', 'status', 'snippet'],
      id: videoIds
    });

    return videosResponse.data.items.map(video => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnail: video.snippet.thumbnails.medium.url,
      publishedAt: video.snippet.publishedAt,
      publishedAtFormatted: moment(video.snippet.publishedAt).format('MMM DD,YYYY HH:mm'),
      viewCount: parseInt(video.statistics.viewCount || 0),
      likeCount: parseInt(video.statistics.likeCount || 0),
      commentCount: parseInt(video.statistics.commentCount || 0),
      commentStatus: video.status.commentStatus
    }));
  }

  async getVideoComments(videoId, maxResults = 100) { // Removed tokens parameter
    const response = await this.youtube.commentThreads.list({
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
          publishedAtFormatted: moment(reply.snippet.publishedAt).format('MMM DD,YYYY HH:mm'),
          likeCount: reply.snippet.likeCount
        })) : [];

        return {
          id: item.id,
          text: comment.textDisplay,
          author: comment.authorDisplayName,
          authorProfileImageUrl: comment.authorProfileImageUrl,
          publishedAt: comment.publishedAt,
          publishedAtFormatted: moment(comment.publishedAt).format('MMM DD,YYYY HH:mm'),
          likeCount: comment.likeCount,
          replyCount: item.snippet.totalReplyCount || 0,
          replies
        };
      }),
      nextPageToken: response.data.nextPageToken
    };
  }

  async getRecentComments(hours = 24) { // Removed tokens parameter
    // Now relies on 'this.youtube' which is from youtubeConfig.getYouTubeClient()
    const videos = await this.getVideos(10); // No tokens passed here
    const cutoffTime = moment().subtract(hours, 'hours');
    const recentComments = [];

    for (const video of videos) {
      if (video.commentStatus === 'disabled' || video.commentCount === 0) {
        console.log(`⚠️ Skipping video ${video.id} - comments disabled or no comments`);
        continue;
      }

      try {
        const { comments } = await this.getVideoComments(video.id, 50); // No tokens passed here
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

  async replyToComment(commentId, text) { // Removed tokens parameter
    try {
        const response = await this.youtube.comments.insert({
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
        throw error;
    }
  }
}

module.exports = new YouTubeService();