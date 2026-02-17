import { appDB } from '../db.js';

// --- Helper function for X-style timestamps ---
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - timestamp) / 1000);

    if (diffInSeconds < 60) return `${Math.max(0, diffInSeconds)}s`; // Seconds
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`; // Minutes
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`; // Hours
    
    // If older than a day, show "Feb 16"
    return new Date(timestamp).toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
    });
}

export function initFeed() {
    const grid = document.getElementById('media-grid');

    appDB.map().on((post, id) => {
        if (!post || !post.cid || document.getElementById(id)) return;

        // 1. Format the Date cleanly
        let dateString = "Unknown Date";
        if (post.timestamp) {
            dateString = formatRelativeTime(post.timestamp);
        }

        const username = post.username || 'Anonymous';
        const avatarLetter = username.charAt(0).toUpperCase();
        const caption = post.text ? `<div class="post-caption">${post.text}</div>` : '';
        
        // 2. CREATE the article element
        const article = document.createElement('article');
        article.id = id;
        article.className = "post-item"; 

        // 3. Flattened HTML: NO .content-column wrapper
        article.innerHTML = `
            <div class="avatar-column">
                <div class="user-avatar-feed">${avatarLetter}</div>
            </div>
            
            <div class="post-header">
                <span class="user-name">${username}</span>
                <span class="post-time">· ${dateString}</span>
            </div>
            
            ${caption}
            
            <div class="post-image-container">
                <img src="https://gateway.pinata.cloud/ipfs/${post.cid}" alt="Uploaded media" loading="lazy">
            </div>
        `;

        article.onclick = () => {
            window.location.hash = `#post/${id}`;
        };

        grid.prepend(article);
    });
}