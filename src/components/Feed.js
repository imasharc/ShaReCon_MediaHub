import { appDB } from '../db.js';
import { openPostDetail } from './PostDetail.js';

export function initFeed() {
    const grid = document.getElementById('media-grid');

    appDB.map().on((post, id) => {
        // Basic validation + prevent duplicates
        if (!post || !post.cid || document.getElementById(id)) return;

        // 1. Format the Date
        let dateString = "Unknown Date";
        if (post.timestamp) {
            // Makes a nice short date like "Oct 25, 2023"
            dateString = new Date(post.timestamp).toLocaleDateString(undefined, {
                year: 'numeric', 
                month: 'short', 
                day: 'numeric'
            });
        }

        // 2. Create Outer HTML Element (The Card)
        const div = document.createElement('div');
        div.id = id;
        // Use the class defined in style.css instead of inline styles
        div.className = "grid-item"; 

        // 3. Fill the inner HTML structure
        div.innerHTML = `
            <div class="grid-image-container">
                <img src="https://gateway.pinata.cloud/ipfs/${post.cid}" loading="lazy" alt="user upload" />
            </div>
            <div class="grid-meta">
                <p class="grid-caption">${post.text || "<em>No caption</em>"}</p>
                <span class="grid-date">${dateString}</span>
            </div>
        `;

        // Click Event -> Opens the Detail Module
        div.onclick = () => {
            window.location.hash = `#post/${id}`;
        };

        // Prepend to show newest first
        grid.prepend(div);
    });
}