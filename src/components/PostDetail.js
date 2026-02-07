import { gun } from '../db.js';

let cropper = null;
let currentCropBlob = null; // Stores the Base64 string of the crop

export function initDetailModal() {
    const modal = document.getElementById('post-view-modal');
    // Initial close button listener (failsafe)
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
    // FIXED: This selector now works because we updated index.html
    const contentContainer = modal.querySelector('.modal-content');

    if (!contentContainer) {
        console.error("Critical: .modal-content not found in HTML");
        return;
    }

    // 1. Inject the ShaReCon UI
    contentContainer.innerHTML = `
        <div style="position: relative; background: #000; display:flex; justify-content:center;">
            <div id="close-view-btn" class="close-btn" style="position: absolute; top: 10px; right: 10px; z-index:100; color:white; background:rgba(0,0,0,0.5); width:30px; height:30px; border-radius:50%; text-align:center; line-height:30px; cursor:pointer;">&times;</div>
            <img id="detail-img" src="" style="max-height: 50vh; width: auto; max-width: 100%;">
        </div>

        <div class="action-bar" style="padding: 10px; display: flex; justify-content: flex-end; border-bottom: 1px solid #eee;">
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

            <div id="comments-list" style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
                </div>
        </div>
    `;

    // 2. Populate Main Post Data
    document.getElementById('detail-img').src = `https://gateway.pinata.cloud/ipfs/${post.cid}`;
    document.getElementById('detail-username').innerText = post.username || "Anon";
    document.getElementById('detail-caption').innerText = post.text || "";
    document.getElementById('detail-time').innerText = new Date(post.timestamp).toLocaleString();

    // 2. Populate Main Post Data
    const img = document.getElementById('detail-img');
    
    // OPTIMIZATION 1: Request permission immediately, not when cropping starts
    img.crossOrigin = "anonymous"; 
    
    // Set src AFTER setting crossOrigin
    img.src = `https://gateway.pinata.cloud/ipfs/${post.cid}`;

    // 3. Re-attach Event Listeners
    document.getElementById('close-view-btn').onclick = closeModal;
    setupCropInteractions(document.getElementById('detail-img'));
    
    // 4. Handle "Ref & Connect" Click
    document.getElementById('submit-comment').onclick = () => {
        const text = document.getElementById('comment-text').value;
        const user = document.getElementById('comment-username').value || 'Anon';
        
        if (!text && !currentCropBlob) return; // Don't submit empty

        const reference = {
            type: 'reference',
            rootCid: post.cid, // LINK TO PARENT
            text: text,
            username: user,
            crop: currentCropBlob, // THE BASE64 STICKER
            timestamp: Date.now()
        };

        // Save to Gun
        gun.get('sharecon_comments').set(reference);

        // Reset Form
        document.getElementById('comment-text').value = '';
        document.getElementById('crop-preview-container').style.display = 'none';
        currentCropBlob = null;
    };

    // 5. Load Existing References (Live Sync)
    const listContainer = document.getElementById('comments-list');
    listContainer.innerHTML = ''; // Clear old

    gun.get('sharecon_comments').map().on((comment, id) => {
        if (!comment || comment.rootCid !== post.cid) return; // Only show comments for THIS post
        
        // Check if already displayed
        if (document.getElementById(id)) return;

        const el = document.createElement('div');
        el.id = id;
        el.style.cssText = "background:white; padding:10px; border-radius:8px; border:1px solid #eee; font-size:0.9rem;";
        
        let cropHtml = '';
        if (comment.crop) {
            cropHtml = `<img src="${comment.crop}" style="height:50px; border:1px solid #ccc; border-radius:4px; display:block; margin-bottom:5px;">`;
        }

        el.innerHTML = `
            <div style="font-weight:bold; font-size:0.8rem; color:#555;">${comment.username}</div>
            ${cropHtml}
            <div>${comment.text}</div>
        `;
        listContainer.prepend(el);
    });

    modal.style.display = 'flex';
}

function setupCropInteractions(imgElement) {
    const cropBtn = document.getElementById('crop-btn');
    const confirmBtn = document.getElementById('confirm-crop-btn');
    const removeCropBtn = document.getElementById('remove-crop');
    
    // A. Start Cropping
    cropBtn.onclick = () => {
        if (cropper) return;
        
        // 1. Immediate UI Feedback: Loading
        cropBtn.disabled = true;
        cropBtn.innerText = "⏳ ...";
        
        // 2. Initialize Cropper
        cropper = new Cropper(imgElement, {
            viewMode: 1,
            dragMode: 'crop', // Allows drawing the box
            autoCrop: false, // OPTIMIZATION 2: Disable the slow "Auto-Select Whole Image" logic
            checkOrientation: false, // OPTIMIZATION 3: Disable EXIF rotation check (expensive on mobile)
            checkCrossOrigin: false, // OPTIMIZATION 4: We handled CORS manually above, so skip the check
            responsive: true,
            background: true,
            
            // 3. WAIT for the library to be fully ready
            ready() {
                // This should now fire almost instantly
                cropBtn.style.display = 'none';
                cropBtn.innerText = "✂️ Reference Area"; // Reset text for later
                cropBtn.disabled = false;

                confirmBtn.style.display = 'flex';
                confirmBtn.innerText = "✅ Click to Confirm"; 
                confirmBtn.disabled = false; 
            },
        });
    };

    // B. Confirm Crop
    confirmBtn.onclick = () => {
        if (!cropper) return;

        // Safety check: sometimes the canvas is empty if the user just clicked without moving
        const canvas = cropper.getCroppedCanvas();
        
        if (!canvas) {
            alert("Please select an area on the image first!");
            return;
        }
        
        // Convert to Sticker
        currentCropBlob = canvas.toDataURL('image/jpeg', 0.8);
        
        // Show Preview
        const previewImg = document.getElementById('crop-preview');
        previewImg.src = currentCropBlob;
        document.getElementById('crop-preview-container').style.display = 'block';

        // Cleanup
        destroyCropper();

        // UI Feedback Loop
        confirmBtn.innerText = "🔒 Confirmed!";
        confirmBtn.disabled = true;
        
        setTimeout(() => {
             confirmBtn.style.display = 'none';
             cropBtn.style.display = 'flex';
        }, 1000);

        document.getElementById('comment-text').focus();
    };
    
    // C. Remove Crop
    removeCropBtn.onclick = () => {
        document.getElementById('crop-preview-container').style.display = 'none';
        currentCropBlob = null;
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