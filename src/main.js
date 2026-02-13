import { initUploadModal } from './components/UploadModal.js';
import { initDetailModal, openPostDetail, closeDetailModal } from './components/PostDetail.js';
import { initFeed } from './components/Feed.js';
import { gun } from './db.js';

document.addEventListener('DOMContentLoaded', () => {
    initUploadModal();
    initDetailModal();
    initFeed();
    initViewSwitcher();
    
    // --- 1. CONNECTION STATUS ---
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
        if (gun._.opt.peers && Object.keys(gun._.opt.peers).length > 0) {
             statusEl.innerText = "🟢";
             statusEl.style.color = "green";
        }
        gun.on('hi', () => { statusEl.innerText = "🟢"; statusEl.style.color = "green"; });
        gun.on('bye', () => { statusEl.innerText = "🔴"; statusEl.style.color = "red"; });
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

// --- VIEW SWITCHER LOGIC ---
function initViewSwitcher() {
    const gridBtn = document.getElementById('view-grid');
    const listBtn = document.getElementById('view-list');
    const gridContainer = document.getElementById('media-grid');

    if (!gridBtn || !listBtn || !gridContainer) return;

    gridBtn.addEventListener('click', () => {
        gridContainer.classList.remove('list-view-mode');
        gridBtn.classList.add('active');
        listBtn.classList.remove('active');
        localStorage.setItem('viewMode', 'grid');
    });

    listBtn.addEventListener('click', () => {
        gridContainer.classList.add('list-view-mode');
        listBtn.classList.add('active');
        gridBtn.classList.remove('active');
        localStorage.setItem('viewMode', 'list');
    });

    // Restore state
    if (localStorage.getItem('viewMode') === 'list') {
        listBtn.click();
    }
}