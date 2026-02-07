export function openPostDetail(post) {
    // 1. Get all the HTML elements inside the modal
    const modal = document.getElementById('post-view-modal');
    const img = document.getElementById('detail-img');
    const username = document.getElementById('detail-username');
    const caption = document.getElementById('detail-caption');
    const time = document.getElementById('detail-time');
    const cidDisplay = document.getElementById('detail-cid');
    
    // 2. Populate the Image & Text
    img.src = `https://gateway.pinata.cloud/ipfs/${post.cid}`;
    username.innerText = post.username || "Anonymous";
    caption.innerText = post.text || "";
    
    // 3. Populate the CID (The missing part!)
    cidDisplay.innerText = post.cid;

    // 4. Populate & Format the Date
    if (post.timestamp) {
        // Formats to local time (e.g., "10/25/2023, 4:30 PM")
        time.innerText = new Date(post.timestamp).toLocaleString();
    } else {
        time.innerText = "Unknown Date";
    }
    
    // 5. Show the Modal
    modal.style.display = 'flex';
}

export function initDetailModal() {
    const modal = document.getElementById('post-view-modal');
    const closeBtn = document.getElementById('close-view-btn');
    
    // Close when clicking the X button
    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = 'none';
    }

    // Optional: Close when clicking outside the white box (the dark background)
    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}