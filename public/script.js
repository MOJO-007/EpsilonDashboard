class YouTubeDashboard { // Renamed to SocialDashboard conceptually, but keeping class name for minimal change
    constructor() {
        this.isAuthenticated = false; // For YouTube auth status
        this.isTwitterAuthenticated = false; // New: For Twitter auth status
        this.isLinkedInAuthenticated = false; // New: For LinkedIn auth status (placeholder)
        this.currentTab = 'youtube-videos'; // Default tab
        this.videos = [];
        this.comments = [];
        this.twitterPosts = []; // New: Placeholder for Twitter posts
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuthStatus(); // Checks YouTube auth
        await this.checkTwitterAuthStatus(); // New: Checks Twitter auth
        await this.checkLinkedInAuthStatus(); // New: Checks LinkedIn auth (placeholder)
        this.handleAuthCallback(); // Handles YouTube callback
        this.handleTwitterAuthCallback(); // New: Handles Twitter callback
    }

    setupEventListeners() {
        // YouTube Auth button
        document.getElementById('youtube-auth-btn').addEventListener('click', () => {
            if (this.isAuthenticated) {
                this.logoutYouTube();
            } else {
                this.authenticateYouTube();
            }
        });

        // New: Twitter Auth button
        document.getElementById('twitter-auth-btn').addEventListener('click', () => {
            if (this.isTwitterAuthenticated) {
                this.logoutTwitter();
            } else {
                this.authenticateTwitter();
            }
        });

        // New: LinkedIn Auth button (placeholder)
        document.getElementById('linkedin-auth-btn').addEventListener('click', () => {
            if (this.isLinkedInAuthenticated) {
                this.logoutLinkedIn();
            } else {
                this.authenticateLinkedIn(); // This will just show an alert
            }
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Auto-reply toggle (YouTube specific for now)
        document.getElementById('auto-reply-toggle').addEventListener('change', (e) => {
            this.toggleAutoReply(e.target.checked);
        });

        // Manual monitor button (YouTube specific for now)
        document.getElementById('manual-monitor').addEventListener('click', () => {
            this.triggerManualMonitor();
        });

        // Refresh buttons (YouTube)
        document.getElementById('refresh-videos').addEventListener('click', () => {
            this.loadVideos();
        });
        document.getElementById('refresh-comments').addEventListener('click', () => {
            this.loadComments();
        });

        // New: Refresh buttons (Twitter)
        document.getElementById('refresh-twitter-posts').addEventListener('click', () => {
            this.loadTwitterPosts(); // Placeholder
        });

        // New: Refresh buttons (LinkedIn - placeholder)
        document.getElementById('refresh-linkedin-posts').addEventListener('click', () => {
            this.loadLinkedInPosts(); // Placeholder
        });

        // Time filter (YouTube comments)
        document.getElementById('time-filter').addEventListener('change', () => {
            this.loadComments();
        });

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on backdrop click
        document.getElementById('comment-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });
    }

    // --- Authentication Status Checks ---

    async checkAuthStatus() { // For YouTube
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();
            this.updateYouTubeAuthStatus(data.authenticated);
        } catch (error) {
            console.error('Error checking YouTube auth status:', error);
            this.updateYouTubeAuthStatus(false);
        }
    }

    async checkTwitterAuthStatus() { // New: For Twitter
        try {
            // This endpoint needs to be implemented in your backend (routes/twitter.js)
            const response = await fetch('/auth/twitter/status');
            const data = await response.json();
            this.updateTwitterAuthStatus(data.authenticated, data.screenName);
        } catch (error) {
            console.error('Error checking Twitter auth status:', error);
            this.updateTwitterAuthStatus(false);
        }
    }

    async checkLinkedInAuthStatus() { // New: For LinkedIn (placeholder)
        // No actual backend call for now
        this.updateLinkedInAuthStatus(false);
    }

    // --- Auth Callbacks ---

    handleAuthCallback() { // For YouTube
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

    handleTwitterAuthCallback() { // New: For Twitter
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth'); // Check for 'twitter_success' or 'error'
        const screenName = urlParams.get('screenName'); // If backend provides it

        if (authStatus === 'twitter_success') {
            this.showNotification(`Successfully connected to Twitter as @${screenName || 'user'}!`, 'success');
            this.updateTwitterAuthStatus(true, screenName);
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authStatus === 'twitter_error') { // Or just 'error'
            this.showNotification('Failed to connect to Twitter. Please try again.', 'error');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // --- Update Auth Status UI ---

    updateYouTubeAuthStatus(authenticated) {
        this.isAuthenticated = authenticated;
        const authStatusDiv = document.getElementById('youtube-auth-status');
        const authBtn = document.getElementById('youtube-auth-btn');
        const authRequiredSection = document.getElementById('auth-required'); // General auth required section
        const dashboardSection = document.getElementById('dashboard'); // General dashboard section

        if (authenticated) {
            authStatusDiv.textContent = '✅ Connected';
            authStatusDiv.className = 'auth-status authenticated';
            authBtn.textContent = 'Disconnect';
        } else {
            authStatusDiv.textContent = '❌ Not Connected';
            authStatusDiv.className = 'auth-status unauthenticated';
            authBtn.textContent = 'Connect YouTube';
        }
        // Decide overall dashboard visibility based on any authentication
        this.updateDashboardVisibility();
    }

    updateTwitterAuthStatus(authenticated, screenName = null) { // New: For Twitter
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

    updateLinkedInAuthStatus(authenticated) { // New: For LinkedIn (placeholder)
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

        // Show dashboard if at least one platform is authenticated
        if (this.isAuthenticated || this.isTwitterAuthenticated || this.isLinkedInAuthenticated) {
            authRequiredSection.style.display = 'none';
            dashboardSection.style.display = 'block';
            this.loadDashboard(); // Load overview data if any platform is connected
        } else {
            authRequiredSection.style.display = 'block';
            dashboardSection.style.display = 'none';
        }
    }

    // --- Authentication Actions ---

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

    authenticateTwitter() { // New: For Twitter
        window.location.href = '/auth/twitter'; // This endpoint needs to be implemented in your backend
    }

    async logoutTwitter() { // New: For Twitter
        try {
            // This endpoint needs to be implemented in your backend (routes/twitter.js)
            await fetch('/auth/twitter/logout', { method: 'POST' });
            this.updateTwitterAuthStatus(false);
            this.showNotification('Disconnected from Twitter', 'info');
        } catch (error) {
            console.error('Error logging out from Twitter:', error);
        }
    }

    authenticateLinkedIn() { // New: For LinkedIn (placeholder)
        alert('LinkedIn integration is coming soon! No authentication flow implemented yet.');
        // window.location.href = '/auth/linkedin'; // Would be similar if implemented
    }

    async logoutLinkedIn() { // New: For LinkedIn (placeholder)
        alert('LinkedIn logout not implemented yet.');
        this.updateLinkedInAuthStatus(false);
    }

    // --- Dashboard Data Loading ---

    async loadDashboard() { // Loads YouTube overview stats
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
            
            commentsToDisplay.sort((a, b) => moment(b.publishedAt).valueOf() - moment(a.publishedAt).valueOf());
            
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
                            <span>📅 ${moment(comment.publishedAt).format('MMM DD,YYYY HH:mm')}</span>
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

    // --- New: Twitter Data Loading (Placeholder) ---
    async loadTwitterPosts() {
        const postsList = document.getElementById('twitter-posts-list');
        postsList.innerHTML = '<div class="loading">Loading Twitter posts...</div>';
        // In a real implementation, you'd fetch from your backend:
        // try {
        //     const response = await fetch('/api/twitter/tweets');
        //     const tweets = await response.json();
        //     this.twitterPosts = tweets; // Store for details
        //     // Render tweets here
        // } catch (error) {
        //     console.error('Error loading Twitter posts:', error);
        //     postsList.innerHTML = '<div class="text-center">Error loading Twitter posts</div>';
        // }
        setTimeout(() => { // Simulate loading
            if (this.isTwitterAuthenticated) {
                postsList.innerHTML = '<div class="text-center mt-4 text-gray-500">No recent Twitter posts found.</div>';
            } else {
                postsList.innerHTML = '<div class="text-center mt-4 text-gray-500">Connect your Twitter account to see posts here.</div>';
            }
        }, 1000);
    }

    async loadTwitterAnalytics() {
        // In a real implementation, you'd fetch from your backend:
        // try {
        //     const response = await fetch('/api/twitter/analytics/sentiment');
        //     const data = await response.json();
        //     // Update sentiment chart for Twitter
        // } catch (error) {
        //     console.error('Error loading Twitter analytics:', error);
        // }
        document.getElementById('twitter-positive-count').textContent = '0';
        document.getElementById('twitter-neutral-count').textContent = '0';
        document.getElementById('twitter-negative-count').textContent = '0';
        document.getElementById('twitter-positive-bar').style.width = '0%';
        document.getElementById('twitter-neutral-bar').style.width = '0%';
        document.getElementById('twitter-negative-bar').style.width = '0%';
        if (!this.isTwitterAuthenticated) {
             this.showNotification('Connect Twitter to view analytics.', 'info');
        }
    }

    // --- New: LinkedIn Data Loading (Placeholder) ---
    async loadLinkedInPosts() {
        const postsList = document.getElementById('linkedin-posts-list');
        postsList.innerHTML = '<div class="loading">Loading LinkedIn posts...</div>';
        setTimeout(() => { // Simulate loading
            postsList.innerHTML = '<div class="text-center mt-4 text-gray-500">LinkedIn integration coming soon!</div>';
        }, 1000);
    }

    // --- Auto-Reply & Monitoring (YouTube specific) ---

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

    async toggleAutoReply(enabled) {
        try {
            const response = await fetch('/api/dashboard/auto-reply/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            
            const data = await response.json();
            document.getElementById('auto-reply-status').textContent = data.message;
            this.showNotification(data.message, 'success');
        } catch (error) {
            console.error('Error toggling auto-reply:', error);
            this.showNotification('Error updating auto-reply settings', 'error');
        }
    }

    async triggerManualMonitor() {
        const button = document.getElementById('manual-monitor');
        const originalText = button.textContent;
        
        button.textContent = 'Checking...';
        button.disabled = true;

        try {
            const response = await fetch('/api/dashboard/monitor/trigger', {
                method: 'POST'
            });
            
            const data = await response.json();
            this.showNotification(`Processed ${data.processedComments} comments`, 'success');
        } catch (error) {
            console.error('Error triggering manual monitor:', error);
            this.showNotification('Error checking comments', 'error');
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    // --- Tab Switching Logic ---

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

    // --- Modal & Utility Functions ---

    async showVideoComments(videoId) { // YouTube Video Comments Modal
        const video = this.videos.find(v => v.id === videoId);
        if (!video) return;

        const modal = document.getElementById('comment-modal');
        const details = document.getElementById('comment-details');
        
        details.innerHTML = '<div class="loading">Loading comments...</div>';
        modal.classList.add('active');

        try {
            const response = await fetch(`/api/youtube/videos/${videoId}/comments?maxResults=50`);
            const data = await response.json();

            details.innerHTML = `
                <div class="video-header">
                    <h4>${video.title}</h4>
                    <p>📊 ${data.comments.length} comments loaded</p>
                </div>
                <div class="comments-container">
                    ${data.comments.map(comment => `
                        <div class="comment-item">
                            <img src="${comment.authorProfileImageUrl}" alt="${comment.author}" class="comment-avatar">
                            <div class="comment-content">
                                <div class="comment-author">${comment.author}</div>
                                <div class="comment-text">${comment.text}</div>
                                <div class="comment-meta">
                                    <span>📅 ${comment.publishedAtFormatted}</span>
                                    <span>👍 ${comment.likeCount}</span>
                                    ${comment.replyCount > 0 ? `<span>💬 ${comment.replyCount} replies</span>` : ''}
                                </div>
                                ${comment.replies.length > 0 ? `
                                    <div class="comment-replies">
                                        ${comment.replies.map(reply => `
                                            <div class="reply-item">
                                                <img src="${reply.authorProfileImageUrl}" alt="${reply.author}" class="reply-avatar">
                                                <div class="reply-content">
                                                    <div class="reply-author">${reply.author}</div>
                                                    <div class="reply-text">${reply.text}</div>
                                                    <div class="reply-meta">
                                                        <span>📅 ${reply.publishedAtFormatted}</span>
                                                        <span>👍 ${reply.likeCount}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Error loading video comments:', error);
            details.innerHTML = '<div class="text-center">Error loading comments</div>';
        }
    }

    showCommentDetails(commentId) { // YouTube Comment Details Modal
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
                    <span>📅 ${moment(comment.publishedAt).format('MMM DD,YYYY HH:mm')}</span>
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

    closeModal() {
        document.getElementById('comment-modal').classList.remove('active');
    }

    getSentimentEmoji(sentiment) {
        switch (sentiment) {
            case 'positive': return '😊';
            case 'negative': return '😞';
            default: return '😐';
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
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
}

// Initialize dashboard AFTER the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing dashboard...");
    const dashboard = new YouTubeDashboard(); // Keeping original class name
    window.dashboard = dashboard;
    dashboard.init();
});

// Global functions for onclick handlers (ensure these match HTML onclicks)
function authenticateYouTube() {
    window.dashboard.authenticateYouTube();
}
// New: Global function for Twitter auth
function authenticateTwitter() {
    window.dashboard.authenticateTwitter();
}
// New: Global function for LinkedIn auth (placeholder)
function authenticateLinkedIn() {
    window.dashboard.authenticateLinkedIn();
}
