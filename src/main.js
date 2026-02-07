// src/main.js
import { initUploadModal } from './components/UploadModal.js';
import { initDetailModal } from './components/PostDetail.js';
import { initFeed } from './components/Feed.js';
import { gun } from './db.js'; // Import the shared gun instance

// Wait for DOM to be ready before looking for the element
document.addEventListener('DOMContentLoaded', () => {
    initUploadModal();
    initDetailModal();
    initFeed();
    
    const statusEl = document.getElementById('connection-status');
    
    if (statusEl) {
        // If we are already connected (rare race condition), update immediately
        if (gun._.opt.peers && Object.keys(gun._.opt.peers).length > 0) {
             statusEl.innerText = "🟢 Online";
             statusEl.style.color = "green";
        }

        gun.on('hi', () => {
            statusEl.innerText = "🟢 Online";
            statusEl.style.color = "green";
        });
        
        gun.on('bye', () => {
            statusEl.innerText = "🔴 Offline";
            statusEl.style.color = "red";
        });
    }
});