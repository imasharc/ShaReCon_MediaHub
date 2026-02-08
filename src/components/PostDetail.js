import { gun } from '../db.js';

let cropper = null;
let currentCropUrl = null; // Changed name: This now holds the IPFS URL

export function initDetailModal() {
    const modal = document.getElementById('post-view-modal');
    const closeBtn = document.getElementById('close-view-btn');
    if (closeBtn) closeBtn.onclick = () => closeModal();
}

function closeModal() {
    const modal = document.getElementById('post-view-modal');
    modal.style.display = 'none';
    destroyCropper();
}

export function openPostDetail(post) {
    const modal = document.getElementById('post-view-modal');
    const contentContainer = modal.querySelector('.modal-content'); 

    if (!contentContainer) {
        console.error("Critical: .modal-content not found in HTML");
        return;
    }

    // 1. INJECT HTML
    contentContainer.innerHTML = `
        <div style="position: relative; background: #000; display:flex; justify-content:center;">
            <div id="close-view-btn" class="close-btn" style="position: absolute; top: 10px; right: 10px; z-index:100; color:white; background:rgba(0,0,0,0.5); width:30px; height:30px; border-radius:50%; text-align:center; line-height:30px; cursor:pointer;">&times;</div>
            <img id="detail-img" src="" style="max-height: 50vh; width: auto; max-width: 100%;">
        </div>

        <div class="action-bar" style="padding: 10px; display: flex; justify-content: flex-end; border-bottom: 1px solid #eee;">
            <button id="exit-crop-btn" class="btn-icon" style="display:none; background:#fff; border:1px solid #ccc; color:#666; padding:5px 10px; border-radius:20px; cursor:pointer;">
                ❌ Exit
            </button>
            <button id="crop-btn" class="btn-icon" style="background:white; border:1px solid #ddd; padding:5px 10px; border-radius:20px; cursor:pointer;">
                ✂️ Reference Area
            </button>
            <button id="confirm-crop-btn" class="btn-icon" style="display:none; background:#e6fffa; border:1px solid green; color:green; padding:5px 10px; border-radius:20px; cursor:pointer;">
                ✅ Click to Confirm
            </button>
        </div>

        <div class="detail-info" style="padding: 15px;">
            <h3 id="detail-username" style="margin:0;"></h3>
            <p id="detail-caption" style="color:#555; margin-top:5px;"></p>
            <div class="meta-row" style="font-size:0.75rem; color:#999; margin-top:10px;">
                <span id="detail-time"></span>
                <br>
                <strong>CID:</strong> 
                <a id="detail-cid-link" href="#" target="_blank" style="color: blue; text-decoration: underline;">...</a>
            </div>
        </div>

        <div class="comments-section" style="background:#f4f4f9; padding:15px; flex-grow:1;">
            <div class="comment-box" style="background:white; padding:10px; border-radius:10px; border:1px solid #ddd;">
                <div id="crop-preview-container" style="display:none; margin-bottom:10px; position:relative; width:fit-content;">
                    <img id="crop-preview" src="" style="height:60px; border:2px solid #000; border-radius:5px;">
                    <button id="remove-crop" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; border-radius:50%; width:18px; height:18px; cursor:pointer;">&times;</button>
                </div>
                <input type="text" id="comment-username" placeholder="Name" style="border:none; border-bottom:1px solid #eee; width:100%; margin-bottom:5px; outline:none;">
                <textarea id="comment-text" placeholder="Add a reference note..." rows="1" style="width:100%; border:none; resize:none; outline:none;"></textarea>
                <div style="text-align:right; margin-top:5px;">
                    <button id="submit-comment" style="background:black; color:white; border:none; padding:5px 15px; border-radius:15px; font-size:0.8rem; cursor:pointer;">Ref & Connect</button>
                </div>
            </div>
            <div id="comments-list" style="margin-top:20px; display:flex; flex-direction:column; gap:10px;"></div>
        </div>
    `;

    // 2. DATA BINDING
    const img = document.getElementById('detail-img');
    const cidLink = document.getElementById('detail-cid-link');
    
    img.crossOrigin = "anonymous"; 
    img.src = `https://gateway.pinata.cloud/ipfs/${post.cid}`;

    document.getElementById('detail-username').innerText = post.username || "Anon";
    document.getElementById('detail-caption').innerText = post.text || "";
    document.getElementById('detail-time').innerText = new Date(post.timestamp).toLocaleString();
    
    // Set the clickable link
    cidLink.innerText = post.cid.substring(0, 15) + "...";
    cidLink.href = `https://gateway.pinata.cloud/ipfs/${post.cid}`;

    // 3. LISTENERS
    document.getElementById('close-view-btn').onclick = closeModal;
    setupCropInteractions(img);

    // 4. SUBMIT LOGIC (Uses IPFS URL now)
    document.getElementById('submit-comment').onclick = () => {
        const text = document.getElementById('comment-text').value;
        const user = document.getElementById('comment-username').value || 'Anon';
        
        if (!text && !currentCropUrl) return;

        const reference = {
            type: 'reference',
            rootCid: post.cid,
            text: text,
            username: user,
            crop: currentCropUrl, // SAVING THE IPFS URL
            timestamp: Date.now()
        };

        gun.get('sharecon_comments').set(reference);

        // Reset
        document.getElementById('comment-text').value = '';
        document.getElementById('crop-preview-container').style.display = 'none';
        currentCropUrl = null;
    };

    // 5. LOAD COMMENTS
    const listContainer = document.getElementById('comments-list');
    listContainer.innerHTML = ''; 

    gun.get('sharecon_comments').map().on((comment, id) => {
        if (!comment || comment.rootCid !== post.cid) return;
        if (document.getElementById(id)) return;

        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = "background:white; padding:10px; border-radius:8px; border:1px solid #eee; font-size:0.9rem;";
        
        let cropHtml = '';
        if (comment.crop) {
            // Check if it's a URL or old Base64 (legacy support)
            cropHtml = `<img src="${comment.crop}" style="height:50px; border:1px solid #ccc; border-radius:4px; display:block; margin-bottom:5px;">`;
        }

        el.innerHTML = `
            <div style="font-weight:bold; font-size:0.8rem; color:#555;">${comment.username}</div>
            ${cropHtml}
            <div>${comment.text}</div>
            <div style="font-size:0.6rem; color:#aaa; margin-top:5px;">${new Date(comment.timestamp).toLocaleTimeString()}</div>
        `;
        listContainer.prepend(el);
    });

    modal.style.display = 'flex';
}

function setupCropInteractions(imgElement) {
    const cropBtn = document.getElementById('crop-btn');
    const confirmBtn = document.getElementById('confirm-crop-btn');
    const exitBtn = document.getElementById('exit-crop-btn');
    const removeCropBtn = document.getElementById('remove-crop');
    
    cropBtn.onclick = () => {
        if (cropper) return;
        
        cropBtn.disabled = true;
        cropBtn.innerText = "⏳ ...";
        
        cropper = new Cropper(imgElement, {
            viewMode: 1,
            dragMode: 'crop', 
            autoCrop: false, 
            checkOrientation: false, 
            checkCrossOrigin: false, 
            responsive: true,
            background: true, 
            
            ready() {
                cropBtn.style.display = 'none';
                cropBtn.innerText = "✂️ Reference Area"; 
                cropBtn.disabled = false;

                confirmBtn.style.display = 'flex';
                confirmBtn.innerText = "✅ Click to Confirm"; 
                confirmBtn.disabled = false;

                exitBtn.style.display = 'flex';
            },
        });
    };

    // --- EXIT CROPPING (CANCEL) ---
    exitBtn.onclick = () => {
        destroyCropper();
        exitBtn.style.display = 'none';
        confirmBtn.style.display = 'none';
        cropBtn.style.display = 'flex'; // Bring back original button
    };

    // --- UPLOAD LOGIC HERE ---
    confirmBtn.onclick = () => {
        if (!cropper) return;
        
        const canvas = cropper.getCroppedCanvas();
        if (!canvas) return;

        // UI: Show loading state
        confirmBtn.innerText = "⏳ Uploading to IPFS...";
        confirmBtn.disabled = true;

        // 1. Show Instant Preview (Base64) while uploading
        const previewImg = document.getElementById('crop-preview');
        previewImg.src = canvas.toDataURL(); // Instant feedback
        document.getElementById('crop-preview-container').style.display = 'block';

        // 2. Convert to Blob & Upload
        canvas.toBlob(async (blob) => {
            if (!blob) {
                alert("Crop failed");
                return;
            }

            try {
                const formData = new FormData();
                formData.append('file', blob, `crop_${Date.now()}.jpg`);
                
                const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
                
                const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
                    body: formData
                });
                
                const data = await res.json();
                
                if (data.IpfsHash) {
                    // SUCCESS: Save the IPFS URL
                    currentCropUrl = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
                    
                    confirmBtn.innerText = "🔒 Confirmed!";
                    
                    setTimeout(() => {
                         confirmBtn.style.display = 'none';
                         cropBtn.style.display = 'flex';
                    }, 1000);

                    // Focus comment box
                    document.getElementById('comment-text').focus();
                } else {
                    throw new Error("Upload failed");
                }

            } catch (err) {
                console.error(err);
                confirmBtn.innerText = "❌ Error";
                confirmBtn.disabled = false;
            }
            
            destroyCropper();

        }, 'image/jpeg', 0.8);
    };
    
    removeCropBtn.onclick = () => {
        document.getElementById('crop-preview-container').style.display = 'none';
        currentCropUrl = null;
        confirmBtn.style.display = 'none';
        cropBtn.style.display = 'flex';
    };
}

function destroyCropper() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}