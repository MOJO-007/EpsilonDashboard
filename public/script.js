class YouTubeDashboard {
    constructor() {
        this.isAuthenticated = false;
        this.isTwitterAuthenticated = false;
        this.isLinkedInAuthenticated = false;
        this.currentTab = 'youtube-videos';
        this.videos = [];
        this.comments = [];
        this.twitterPosts = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuthStatus();
        await this.checkLinkedInAuthStatus();
        this.handleAuthCallback();
    }

    setupEventListeners() {
        document.getElementById('youtube-auth-btn').addEventListener('click', () => {
            if (this.isAuthenticated) {
                this.logoutYouTube();
            } else {
                this.authenticateYouTube();
            }
        });

        document.getElementById('twitter-auth-btn').addEventListener('click', () => {
            if (this.isTwitterAuthenticated) {
                this.logoutTwitter();
            } else {
                this.authenticateTwitter();
            }
        });

        document.getElementById('linkedin-auth-btn').addEventListener('click', () => {
            if (this.isLinkedInAuthenticated) {
                this.logoutLinkedIn();
            } else {
                this.authenticateLinkedIn();
            }
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        document.getElementById('auto-reply-toggle').addEventListener('change', (e) => {
            this.toggleAutoReply(e.target.checked);
        });

        document.getElementById('manual-monitor').addEventListener('click', () => {
            this.triggerManualMonitor();
        });

        document.getElementById('refresh-videos').addEventListener('click', () => {
            this.loadVideos();
        });

        document.getElementById('refresh-comments').addEventListener('click', () => {
            this.loadComments();
        });

        document.getElementById('refresh-twitter-posts').addEventListener('click', () => {
            // this.loadTwitterPosts();
        });

        document.getElementById('refresh-linkedin-posts').addEventListener('click', () => {
            this.loadLinkedInPosts();
        });

        document.getElementById('time-filter').addEventListener('change', () => {
            this.loadComments();
        });

        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('comment-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();
            this.updateYouTubeAuthStatus(data.authenticated);
        } catch (error) {
            console.error('Error checking YouTube auth status:', error);
            this.updateYouTubeAuthStatus(false);
        }
    }

    async checkLinkedInAuthStatus() {
        this.updateLinkedInAuthStatus(false);
    }

    handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');

        if (authStatus === 'success') {
            this.showNotification('Successfully connected to YouTube!', 'success');
            this.updateYouTubeAuthStatus(true);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authStatus === 'error') {
            this.showNotification('Failed to connect to YouTube. Please try again.', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    updateYouTubeAuthStatus(authenticated) {
        this.isAuthenticated = authenticated;
        const authStatusDiv = document.getElementById('youtube-auth-status');
        const authBtn = document.getElementById('youtube-auth-btn');

        if (authenticated) {
            authStatusDiv.textContent = '✅ Connected';
            authStatusDiv.className = 'auth-status authenticated';
            authBtn.textContent = 'Disconnect';
        } else {
            authStatusDiv.textContent = '❌ Not Connected';
            authStatusDiv.className = 'auth-status unauthenticated';
            authBtn.textContent = 'Connect YouTube';
        }
        this.updateDashboardVisibility();
    }

    updateTwitterAuthStatus(authenticated, screenName = null) {
        this.isTwitterAuthenticated = authenticated;
        const authStatusDiv = document.getElementById('twitter-auth-status');
        const authBtn = document.getElementById('twitter-auth-btn');

        if (authenticated) {
            authStatusDiv.textContent = `✅ Connected (${screenName || 'Twitter'})`;
            authStatusDiv.className = 'auth-status authenticated';
            authBtn.textContent = 'Disconnect';
        } else {
            authStatusDiv.textContent = '❌ Not Connected';
            authStatusDiv.className = 'auth-status unauthenticated';
            authBtn.textContent = 'Connect Twitter';
        }
        this.updateDashboardVisibility();
    }

    updateLinkedInAuthStatus(authenticated) {
        this.isLinkedInAuthenticated = authenticated;
        const authStatusDiv = document.getElementById('linkedin-auth-status');
        const authBtn = document.getElementById('linkedin-auth-btn');

        if (authenticated) {
            authStatusDiv.textContent = '✅ Connected';
            authStatusDiv.className = 'auth-status authenticated';
            authBtn.textContent = 'Disconnect';
        } else {
            authStatusDiv.textContent = '❌ Not Connected';
            authStatusDiv.className = 'auth-status unauthenticated';
            authBtn.textContent = 'Connect LinkedIn';
        }
        this.updateDashboardVisibility();
    }

    updateDashboardVisibility() {
        const authRequiredSection = document.getElementById('auth-required');
        const dashboardSection = document.getElementById('dashboard');

        if (this.isAuthenticated || this.isTwitterAuthenticated || this.isLinkedInAuthenticated) {
            authRequiredSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            this.loadDashboard();
        } else {
            authRequiredSection.style.display = 'block';
            dashboardSection.style.display = 'none';
        }
    }

    authenticateYouTube() {
        window.location.href = '/auth/youtube';
    }

    async logoutYouTube() {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            this.updateYouTubeAuthStatus(false);
            this.showNotification('Disconnected from YouTube', 'info');
        } catch (error) {
            console.error('Error logging out from YouTube:', error);
        }
    }

    authenticateTwitter() {
        alert('Twitter integration not yet implemented on the backend.');
    }

    async logoutTwitter() {
        alert('Twitter logout not implemented yet on the backend.');
        this.updateTwitterAuthStatus(false);
    }

    authenticateLinkedIn() {
        alert('LinkedIn integration is coming soon! No authentication flow implemented yet.');
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    async logoutLinkedIn() {
        alert('LinkedIn logout not implemented yet.');
        this.updateLinkedInAuthStatus(false);
    }

    async loadDashboard() {
        try {
            const response = await fetch('/api/dashboard/overview');
            const data = await response.json();

            // Update stats (YouTube specific)
            document.getElementById('subscriber-count').textContent = this.formatNumber(data.channel.subscriberCount);
            document.getElementById('video-count').textContent = this.formatNumber(data.channel.videoCount);
            document.getElementById('total-views').textContent = this.formatNumber(data.analytics.totalViews);
            document.getElementById('recent-comments').textContent = this.formatNumber(data.analytics.recentCommentsCount);

            // Load initial tab content based on default tab
            this.loadVideos(); // Default YouTube tab
            this.loadAutoReplyStatus(); // YouTube specific
        } catch (error) {
            console.error('Error loading YouTube dashboard overview:', error);
            this.showNotification('Error loading YouTube dashboard data', 'error');
            // Hide YouTube specific stats if error
            document.getElementById('subscriber-count').textContent = '-';
            document.getElementById('video-count').textContent = '-';
            document.getElementById('total-views').textContent = '-';
            document.getElementById('recent-comments').textContent = '-';
        }
    }
    async loadAutoReplyStatus() {
        try {
            const response = await fetch('/api/dashboard/auto-reply/status');
            const data = await response.json();
            
            document.getElementById('auto-reply-toggle').checked = data.enabled;
            document.getElementById('auto-reply-status').textContent = 
                data.enabled ? 'Auto-reply is enabled' : 'Auto-reply is disabled';
        } catch (error) {
            console.error('Error loading auto-reply status:', error);
        }
    }
    

    async loadVideos() { // YouTube Videos
        const videosList = document.getElementById('videos-list');
        videosList.innerHTML = '<div class="loading">Loading videos...</div>';

        try {
            const response = await fetch('/api/youtube/videos?maxResults=20');
            const videos = await response.json();
            this.videos = videos;

            if (videos.length === 0) {
                videosList.innerHTML = '<div class="text-center">No videos found</div>';
                return;
            }

            videosList.innerHTML = videos.map(video => `
                <div class="video-item" onclick="dashboard.showVideoComments('${video.id}')">
                    <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
                    <div class="video-info">
                        <div class="video-title">${this.truncateText(video.title, 80)}</div>
                        <div class="video-meta">
                            <span>📅 ${video.publishedAtFormatted}</span>
                        </div>
                        <div class="video-stats">
                            <span>👀 ${this.formatNumber(video.viewCount)} views</span>
                            <span>👍 ${this.formatNumber(video.likeCount)} likes</span>
                            <span>💬 ${this.formatNumber(video.commentCount)} comments</span>
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading YouTube videos:', error);
            videosList.innerHTML = '<div class="text-center">Error loading videos</div>';
        }
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    async loadComments() { // YouTube Comments
        const commentsList = document.getElementById('comments-list');
        const timeFilter = document.getElementById('time-filter').value;
        
        commentsList.innerHTML = '<div class="loading">Loading comments...</div>';

        try {
            // This fetches already analyzed comments from your dashboard API
            const response = await fetch(`/api/dashboard/analytics/sentiment?hours=${timeFilter}`);
            const sentimentData = await response.json();

            let commentsToDisplay = [];
            if (sentimentData && sentimentData.positive && sentimentData.negative && sentimentData.neutral) {
                commentsToDisplay.push(...sentimentData.positive);
                commentsToDisplay.push(...sentimentData.negative);
                commentsToDisplay.push(...sentimentData.neutral);
            }
            
            commentsToDisplay.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
            
            this.comments = commentsToDisplay;

            if (commentsToDisplay.length === 0) {
                commentsList.innerHTML = '<div class="text-center">No recent analyzed comments found for this period.</div>';
                return;
            }

            commentsList.innerHTML = commentsToDisplay.map(comment => `
                <div class="comment-item ${comment.sentiment?.sentiment || 'neutral'}" onclick="dashboard.showCommentDetails('${comment.commentId}')">
                    <img src="${comment.authorProfileImageUrl || 'https://via.placeholder.com/40'}" alt="${comment.author || 'Unknown'}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-author">${comment.author || 'Unknown'}</div>
                        <div class="comment-text">${this.truncateText(comment.comment || comment.text, 150)}</div>
                        <div class="comment-meta">
                            <span>📹 ${this.truncateText(comment.videoTitle || 'N/A', 40)}</span>
                            <span>📅 ${this.formatDate(comment.publishedAt)}</span>
                            <span>👍 ${comment.likeCount || 0}</span>
                            ${comment.sentiment ? `<span class="sentiment-${comment.sentiment.sentiment}">
                                ${this.getSentimentEmoji(comment.sentiment.sentiment)} ${comment.sentiment.sentiment}
                            </span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading YouTube comments for display:', error);
            commentsList.innerHTML = '<div class="text-center">Error loading analyzed comments</div>';
        }
    }

    showCommentDetails(commentId) {
        const comment = this.comments.find(c => c.commentId === commentId);
        if (!comment) return;

        const modal = document.getElementById('comment-modal');
        const details = document.getElementById('comment-details');

        details.innerHTML = `
            <div class="comment-detail">
                <div class="comment-header">
                    <img src="${comment.authorProfileImageUrl || 'https://via.placeholder.com/40'}" alt="${comment.author || 'Unknown'}" class="comment-avatar">
                    <div>
                        <div class="comment-author">${comment.author || 'Unknown'}</div>
                        <div class="comment-video">📹 ${comment.videoTitle || 'N/A'}</div>
                    </div>
                </div>
                <div class="comment-text">${comment.comment || comment.text}</div>
                <div class="comment-meta">
                    <span>📅 ${this.formatDate(comment.publishedAt)}</span>
                    <span>👍 ${comment.likeCount || 0}</span>
                    ${comment.replyCount > 0 ? `<span>💬 ${comment.replyCount} replies</span>` : ''}
                </div>
                ${comment.sentiment ? `
                    <div class="sentiment-analysis">
                        <h4>Sentiment Analysis</h4>
                        <div class="sentiment-details">
                            <div class="sentiment-main">
                                <span class="sentiment-${comment.sentiment.sentiment}">
                                    ${this.getSentimentEmoji(comment.sentiment.sentiment)} ${comment.sentiment.sentiment}
                                </span>
                                <span class="confidence">Confidence: ${Math.round(comment.sentiment.confidence * 100)}%</span>
                            </div>
                            <div class="sentiment-summary">${comment.sentiment.summary || 'No summary available.'}</div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        modal.classList.add('active');
    }

    formatDate(dateStr) {
    const date = new Date(dateStr);
    if (isNaN(date)) return 'Invalid Date';
    const options = {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
    const lookup = {};
    parts.forEach(p => lookup[p.type] = p.value);
    return `${lookup.month} ${lookup.day} ${lookup.year} ${lookup.hour}:${lookup.minute}`;
}
getSentimentEmoji(sentiment) {
        switch (sentiment) {
            case 'positive': return '😊';
            case 'negative': return '😞';
            default: return '😐';
        }
    }
    async triggerManualMonitor() {
  const button = document.getElementById('manual-monitor');
  const originalText = button.textContent;

  button.textContent = 'Checking...';
  button.disabled = true;

  try {
    const response = await fetch('/api/dashboard/monitor/trigger', { method: 'POST' });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    // Safely call showNotification if it exists
    if (typeof showNotification === 'function') {
      showNotification(`Processed ${data.processedComments} comments`, 'success');
    } else if (this && typeof this.showNotification === 'function') {
      this.showNotification(`Processed ${data.processedComments} comments`, 'success');
    } else {
      console.log(`Processed ${data.processedComments} comments`);
    }

  } catch (error) {
    console.error('Error triggering manual monitor:', error);
    if (typeof showNotification === 'function') {
      showNotification('Error checking comments', 'error');
    } else if (this && typeof this.showNotification === 'function') {
      this.showNotification('Error checking comments', 'error');
    } else {
      alert('Error checking comments');
    }
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
}

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1001',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load content for the active tab
        switch (tabName) {
            // YouTube Tabs
            case 'youtube-videos':
                this.loadVideos(); // Always load to refresh
                break;
            case 'youtube-comments':
                this.loadComments(); // Always load to refresh
                break;
            case 'youtube-analytics':
                this.loadAnalytics(); // Always load to refresh
                break;
            
            // Twitter Tabs
            case 'twitter-posts':
                this.loadTwitterPosts();
                break;
            case 'twitter-analytics':
                this.loadTwitterAnalytics();
                break;

            // LinkedIn Tabs
            case 'linkedin-posts':
                this.loadLinkedInPosts();
                break;
            // Add more cases for LinkedIn analytics if needed
        }
    }
    async loadAnalytics() { // YouTube Analytics
        try {
            const response = await fetch('/api/dashboard/analytics/sentiment?hours=168');
            const data = await response.json();

            const total = data.positive.length + data.negative.length + data.neutral.length;
            
            if (total === 0) {
                document.getElementById('positive-count').textContent = '0';
                document.getElementById('neutral-count').textContent = '0';
                document.getElementById('negative-count').textContent = '0';
                return;
            }

            const positivePercent = (data.positive.length / total) * 100;
            const neutralPercent = (data.neutral.length / total) * 100;
            const negativePercent = (data.negative.length / total) * 100;

            document.getElementById('positive-bar').style.width = `${positivePercent}%`;
            document.getElementById('neutral-bar').style.width = `${neutralPercent}%`;
            document.getElementById('negative-bar').style.width = `${negativePercent}%`;

            document.getElementById('positive-count').textContent = data.positive.length;
            document.getElementById('neutral-count').textContent = data.neutral.length;
            document.getElementById('negative-count').textContent = data.negative.length;
        } catch (error) {
            console.error('Error loading YouTube analytics:', error);
        }
    }


    // keep other helper methods (truncateText, getSentimentEmoji, showNotification, etc.)
}

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new YouTubeDashboard();
    window.dashboard = dashboard;
    dashboard.init();
});
