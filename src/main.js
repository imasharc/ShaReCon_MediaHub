import { initUploadModal } from './components/UploadModal.js';
import { initDetailModal, openPostDetail, closeDetailModal } from './components/PostDetail.js';
import { initFeed } from './components/Feed.js';
import { gun } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    initUploadModal();
    initDetailModal();
    initFeed();
    
    // --- 1. CONNECTION STATUS ---
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (gun._.opt.peers && Object.keys(gun._.opt.peers).length > 0) {
             statusEl.innerText = "🟢 Online";
             statusEl.style.color = "green";
        }
        gun.on('hi', () => { statusEl.innerText = "🟢 Online"; statusEl.style.color = "green"; });
        gun.on('bye', () => { statusEl.innerText = "🔴 Offline"; statusEl.style.color = "red"; });
    }

    // --- 2. ROUTER LOGIC ---
    // Handle "Back" button or manual URL change
    window.addEventListener('hashchange', handleRoute);
    
    // Handle initial load (if user pastes a link)
    handleRoute();
});

async function handleRoute() {
    const hash = window.location.hash;
    
    if (hash.startsWith('#post/')) {
        const id = hash.replace('#post/', '');
        
        // We need to fetch the data for this ID since we might have landed here directly
        // and don't have the 'data' object passed from a click.
        gun.get(id).once((data) => {
            if (data) {
                openPostDetail(data, id);
            } else {
                console.error('Post not found');
            }
        });
    } else {
        // If hash is empty, close modal (show feed)
        closeDetailModal();
    }
}