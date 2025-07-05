class YouTubeDashboard {
    constructor() {
        this.isAuthenticated = false;
        this.currentTab = 'videos';
        this.videos = [];
        this.comments = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkAuthStatus();
        this.handleAuthCallback();
    }

    setupEventListeners() {
        // Auth button
        document.getElementById('auth-btn').addEventListener('click', () => {
            if (this.isAuthenticated) {
                this.logout();
            } else {
                this.authenticateYouTube();
            }
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Auto-reply toggle
        document.getElementById('auto-reply-toggle').addEventListener('change', (e) => {
            this.toggleAutoReply(e.target.checked);
        });

        // Manual monitor button
        document.getElementById('manual-monitor').addEventListener('click', () => {
            this.triggerManualMonitor();
        });

        // Refresh buttons
        document.getElementById('refresh-videos').addEventListener('click', () => {
            this.loadVideos();
        });

        document.getElementById('refresh-comments').addEventListener('click', () => {
            this.loadComments();
        });

        // Time filter
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

    async checkAuthStatus() {
        try {
            const response = await fetch('/auth/status');
            const data = await response.json();
            this.updateAuthStatus(data.authenticated);
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.updateAuthStatus(false);
        }
    }

    handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth');
        
        if (authStatus === 'success') {
            this.showNotification('Successfully connected to YouTube!', 'success');
            this.updateAuthStatus(true);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (authStatus === 'error') {
            this.showNotification('Failed to connect to YouTube. Please try again.', 'error');
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    updateAuthStatus(authenticated) {
        this.isAuthenticated = authenticated;
        const authStatus = document.getElementById('auth-status');
        const authBtn = document.getElementById('auth-btn');
        const authRequired = document.getElementById('auth-required');
        const dashboard = document.getElementById('dashboard');

        if (authenticated) {
            authStatus.textContent = '✅ Connected';
            authStatus.className = 'auth-status authenticated';
            authBtn.textContent = 'Disconnect';
            authRequired.style.display = 'none';
            dashboard.style.display = 'block';
            this.loadDashboard();
        } else {
            authStatus.textContent = '❌ Not Connected';
            authStatus.className = 'auth-status unauthenticated';
            authBtn.textContent = 'Connect YouTube';
            authRequired.style.display = 'block';
            dashboard.style.display = 'none';
        }
    }

    authenticateYouTube() {
        window.location.href = '/auth/youtube';
    }

    async logout() {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            this.updateAuthStatus(false);
            this.showNotification('Disconnected from YouTube', 'info');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    async loadDashboard() {
        try {
            const response = await fetch('/api/dashboard/overview');
            const data = await response.json();

            // Update stats
            document.getElementById('subscriber-count').textContent = this.formatNumber(data.channel.subscriberCount);
            document.getElementById('video-count').textContent = this.formatNumber(data.channel.videoCount);
            document.getElementById('total-views').textContent = this.formatNumber(data.analytics.totalViews);
            document.getElementById('recent-comments').textContent = this.formatNumber(data.analytics.recentCommentsCount);

            // Load initial tab content
            this.loadVideos();
            this.loadAutoReplyStatus();
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showNotification('Error loading dashboard data', 'error');
        }
    }

    async loadVideos() {
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
            console.error('Error loading videos:', error);
            videosList.innerHTML = '<div class="text-center">Error loading videos</div>';
        }
    }

    async loadComments() {
        const commentsList = document.getElementById('comments-list');
        const timeFilter = document.getElementById('time-filter').value;
        
        commentsList.innerHTML = '<div class="loading">Loading comments...</div>';

        try {
            const response = await fetch(`/api/youtube/comments/recent?hours=${timeFilter}`);
            const comments = await response.json();
            this.comments = comments;

            if (comments.length === 0) {
                commentsList.innerHTML = '<div class="text-center">No recent comments found</div>';
                return;
            }

            // Analyze sentiment for first 20 comments
            const analyzedComments = await this.analyzeCommentsInBatches(comments.slice(0, 20));

            commentsList.innerHTML = analyzedComments.map(comment => `
                <div class="comment-item ${comment.sentiment?.sentiment || 'neutral'}" onclick="dashboard.showCommentDetails('${comment.id}')">
                    <img src="${comment.authorProfileImageUrl}" alt="${comment.author}" class="comment-avatar">
                    <div class="comment-content">
                        <div class="comment-author">${comment.author}</div>
                        <div class="comment-text">${this.truncateText(comment.text, 150)}</div>
                        <div class="comment-meta">
                            <span>📹 ${this.truncateText(comment.videoTitle, 40)}</span>
                            <span>📅 ${comment.publishedAtFormatted}</span>
                            <span>👍 ${comment.likeCount}</span>
                            ${comment.sentiment ? `<span class="sentiment-${comment.sentiment.sentiment}">
                                ${this.getSentimentEmoji(comment.sentiment.sentiment)} ${comment.sentiment.sentiment}
                            </span>` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error loading comments:', error);
            commentsList.innerHTML = '<div class="text-center">Error loading comments</div>';
        }
    }

    async analyzeCommentsInBatches(comments, batchSize = 5) {
        const analyzedComments = [];
        
        for (let i = 0; i < comments.length; i += batchSize) {
            const batch = comments.slice(i, i + batchSize);
            const batchPromises = batch.map(async (comment) => {
                try {
                    const response = await fetch(`/api/youtube/comments/${comment.id}/analyze`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: comment.text })
                    });
                    const sentiment = await response.json();
                    return { ...comment, sentiment };
                } catch (error) {
                    console.error('Error analyzing comment:', error);
                    return comment;
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            analyzedComments.push(...batchResults);
            
            // Small delay between batches to avoid rate limits
            if (i + batchSize < comments.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return analyzedComments;
    }

    async loadAnalytics() {
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
            console.error('Error loading analytics:', error);
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
            case 'videos':
                if (this.videos.length === 0) this.loadVideos();
                break;
            case 'comments':
                if (this.comments.length === 0) this.loadComments();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
        }
    }

    async showVideoComments(videoId) {
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

    showCommentDetails(commentId) {
        const comment = this.comments.find(c => c.id === commentId);
        if (!comment) return;

        const modal = document.getElementById('comment-modal');
        const details = document.getElementById('comment-details');
        
        details.innerHTML = `
            <div class="comment-detail">
                <div class="comment-header">
                    <img src="${comment.authorProfileImageUrl}" alt="${comment.author}" class="comment-avatar">
                    <div>
                        <div class="comment-author">${comment.author}</div>
                        <div class="comment-video">📹 ${comment.videoTitle}</div>
                    </div>
                </div>
                <div class="comment-text">${comment.text}</div>
                <div class="comment-meta">
                    <span>📅 ${comment.publishedAtFormatted}</span>
                    <span>👍 ${comment.likeCount}</span>
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
                            <div class="sentiment-summary">${comment.sentiment.summary}</div>
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
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add styles
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

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 5000);
    }
}

// Initialize dashboard
const dashboard = new YouTubeDashboard();

// Global functions for onclick handlers
function authenticateYouTube() {
    dashboard.authenticateYouTube();
}