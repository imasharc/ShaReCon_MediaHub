import { gun } from '../db.js';

// --- STATE MANAGEMENT ---
let refCropper = null;     
let replyCropper = null;   
let referenceBlob = null;  
let replyUploadBlob = null; 
let replyPreviewUrl = null; 

// --- MODAL UTILS ---
export function closeDetailModal() {
    const modal = document.getElementById('post-view-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
    resetForms();
    
    if (window.location.hash) {
        history.pushState("", document.title, window.location.pathname + window.location.search);
    }
}

function resetForms() {
    if(refCropper) refCropper.destroy();
    if(replyCropper) replyCropper.destroy();
    refCropper = null;
    replyCropper = null;
    referenceBlob = null;
    replyUploadBlob = null;
    replyPreviewUrl = null;
}

export function initDetailModal() {
    const modal = document.getElementById('post-view-modal');
    // Safety check: If modal doesn't exist yet, don't crash
    if (modal) {
        modal.onclick = (e) => {
            // Close if clicking outside the content area (and not currently cropping)
            if (e.target === modal && !replyCropper && !refCropper) closeDetailModal();
        };
    }
}

// ---------------------------------------------------------
//  MAIN FOCUS ENGINE
// ---------------------------------------------------------
export function openPostDetail(data, id) {
    const modal = document.getElementById('post-view-modal');
    
    if (!modal) {
        console.error("Modal #post-view-modal not found.");
        return;
    }

    const contentContainer = modal.querySelector('.modal-content'); 
    if (!contentContainer) {
        console.error("Error: .modal-content class missing in index.html");
        return;
    }

    if (window.location.hash !== `#post/${id}`) window.location.hash = `#post/${id}`;

    // 1. SCAFFOLD UI
    contentContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; height: 100%; background:white; position:relative;">
            
            <div style="position: sticky; top:0; background:rgba(255,255,255,0.98); border-bottom:1px solid #eee; padding:12px 15px; display:flex; align-items:center; justify-content: space-between; z-index:100;">
                <div style="display:flex; align-items:center; gap:15px;">
                    <div id="close-view-btn" style="cursor:pointer; font-size:1.4rem; line-height:1; padding:5px;">✕</div>
                    <h3 style="margin:0; font-size:1.1rem; font-weight:700;">Thread</h3>
                </div>
                <button id="share-thread-btn" style="background:none; border:1px solid #ddd; padding:6px 12px; border-radius:18px; cursor:pointer; font-size:0.85rem; font-weight:600; display:flex; align-items:center; gap:6px;">🔗 Share</button>
            </div>

            <div id="scroll-container" style="flex-grow:1; overflow-y:auto; padding-bottom:180px; -webkit-overflow-scrolling: touch;">
                <div id="thread-ancestors"></div>
                <div id="thread-main"></div>
                <div id="thread-replies"></div>
            </div>

            <div class="comments-section" style="position:absolute; bottom:0; width:100%; background:#fff; border-top:1px solid #eee; padding:10px 15px; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 200; max-height: 60vh; overflow-y: auto;">
                <div id="upload-toast" style="position:absolute; top:-40px; left:50%; transform:translateX(-50%); background:#000; color:white; padding:5px 15px; border-radius:20px; font-size:0.8rem; display:none; opacity:0; transition: opacity 0.3s;">✅ Posted</div>

                <div id="reply-cropper-ui" style="display:none; flex-direction:column; gap:10px; margin-bottom:10px;">
                    <div style="height: 200px; background:#333; display:flex; justify-content:center;">
                         <img id="reply-cropper-target" style="max-width:100%; max-height:100%;">
                    </div>
                    <div style="display:flex; gap:10px; justify-content:center;">
                        <button id="reply-crop-cancel" style="padding: 8px 16px; border-radius: 20px; border: 1px solid #ddd; background:white;">Cancel</button>
                        <button id="reply-crop-confirm" style="padding: 8px 16px; border-radius: 20px; border: none; background:black; color:white; font-weight:bold;">Confirm Crop</button>
                    </div>
                </div>

                <div id="attachment-preview" style="display:none; margin-bottom:10px; position:relative; width:fit-content;">
                    <img id="preview-img" src="" style="height:60px; border-radius:6px; border:1px solid #ddd; object-fit: cover;">
                    <button id="remove-attachment-btn" style="position:absolute; top:-8px; right:-8px; background:red; color:white; border:2px solid white; border-radius:50%; width:22px; height:22px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center;">&times;</button>
                </div>

                <div id="composer-inputs" style="display:flex; gap:10px; align-items:flex-end;">
                    <textarea id="comment-text" placeholder="Post your reply..." rows="1" style="flex-grow:1; border:1px solid #ddd; border-radius:20px; padding:10px 15px; resize:none; outline:none; font-family:inherit; background:#f8f9fa;"></textarea>
                    <button id="submit-comment" style="background:#000; color:#fff; border:none; padding:10px 18px; border-radius:20px; font-weight:bold; cursor:pointer;">Reply</button>
                </div>

                <div id="composer-tools" style="display:flex; gap:20px; margin-top:15px; align-items:center; height: 30px;">
                     <label for="reply-file-input" style="cursor:pointer; font-size:1.3rem; display:flex; align-items:center; gap:5px; color:#555;">🖼️ <span style="font-size:0.8rem; font-weight:600;">Upload</span></label>
                     <input type="file" id="reply-file-input" accept="image/*" style="display:none;">

                     <div id="ref-tools_container" style="display:flex; align-items:center;">
                         <button id="start-ref-crop-btn" style="background:none; border:none; cursor:pointer; font-size:1.3rem; padding:0; color:#555; display:flex; align-items:center; gap:5px;">✂️ <span style="font-size:0.8rem; font-weight:600;">Ref</span></button>
                         <div id="ref-crop-actions" style="display:none; gap:10px; align-items:center; margin-left:10px;">
                            <button id="exit-ref-crop-btn" style="background:#eee; border:none; padding:6px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer;">Cancel</button>
                            <button id="confirm-ref-crop-btn" style="background:#e6fffa; border:1px solid #00aa00; color:#008800; padding:6px 12px; border-radius:15px; font-size:0.8rem; font-weight:bold; cursor:pointer;">✅ Confirm</button>
                         </div>
                     </div>
                </div>
            </div>
        </div>
    `;

    // 2. ATTACH LISTENERS
    document.getElementById('close-view-btn').onclick = () => window.location.hash = '';
    
    const shareBtn = document.getElementById('share-thread-btn');
    shareBtn.onclick = () => {
        navigator.clipboard.writeText(window.location.href);
        shareBtn.innerHTML = "✅ Copied!";
        setTimeout(() => shareBtn.innerHTML = "🔗 Share", 2000);
    };

    resetForms();
    renderMainItem(data, id);
    setupInputLogic(data, id); 
    loadAncestors(data);
    loadDirectReplies(id);
    
    modal.style.display = 'flex';
}

function renderMainItem(data, id) {
    const container = document.getElementById('thread-main');
    const isRoot = !data.parentId && !data.crop;
    const avatarLetter = (data.username || 'A')[0].toUpperCase();

    let mediaHtml = '';
    const cid = isRoot ? data.cid : (data.crop || data.mediaCid);
    
    if (cid) {
        // FIX: DO NOT use crossorigin="anonymous" here. 
        // We load it normally first to avoid CORS errors on display.
        const src = cid.startsWith('http') || cid.startsWith('data:') || cid.startsWith('blob:') 
            ? cid 
            : `https://gateway.pinata.cloud/ipfs/${cid}`;
            
        mediaHtml = `<div style="background:#f0f0f0; display:flex; justify-content:center; min-height:100px;">
            <img id="detail-img" src="${src}" 
            style="width:100%; max-height:50vh; object-fit:contain; display:block;"
            onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\'padding:20px; color:red; font-size:0.8rem;\'>⚠️ Image Unavailable</div>'">
        </div>`;
    }

    container.innerHTML = `
        <div class="main-focus-item">
            <div style="display:flex; align-items:center; margin-bottom:10px;">
                <div class="user-avatar" style="width:48px; height:48px; font-size:1.2rem;">${avatarLetter}</div>
                <div>
                    <div style="font-weight:bold; font-size:1rem; color:#000;">${data.username || 'Anonymous'}</div>
                    <div style="color:#666; font-size:0.85rem;">${new Date(data.timestamp).toLocaleString()}</div>
                </div>
            </div>
            <div style="font-size:1.25rem; line-height:1.4; color:#111; margin-bottom:15px; word-break: break-word;">${data.text || ''}</div>
            ${mediaHtml}
        </div>
    `;
    
    const imgEl = document.getElementById('detail-img');
    const refTools = document.getElementById('ref-tools_container');
    
    if (imgEl && cid) {
        // Wait for load, then attach crop logic
        imgEl.onload = () => setupRefCropInteractions(imgEl);
    } else {
        if(refTools) refTools.style.display = 'none';
    }
}

function loadDirectReplies(parentId) {
    const container = document.getElementById('thread-replies');
    container.innerHTML = ''; 

    gun.get(parentId).get('replies').map().on((reply, replyId) => {
        if (!reply || (!reply.text && !reply.crop && !reply.mediaCid)) return;
        if (document.getElementById(`reply-${replyId}`)) return;
        renderSingleReply(reply, replyId, container);
    });
}

function renderSingleReply(data, id, container) {
    const avatarLetter = (data.username || 'A')[0].toUpperCase();
    const el = document.createElement('div');
    el.id = `reply-${id}`;
    el.className = 'reply-item';
    
    let mediaHtml = '';
    const hash = data.crop || data.mediaCid;
    if (hash) {
         const src = hash.startsWith('blob:') ? hash : `https://gateway.pinata.cloud/ipfs/${hash}`;
         mediaHtml = `<img src="${src}" class="thread-sticker" style="max-height:150px; margin-top:8px;" onerror="this.style.display='none'">`;
    }

    el.innerHTML = `
        <div style="display:flex; gap:12px;">
            <div class="user-avatar" style="width:36px; height:36px; font-size:0.9rem;">${avatarLetter}</div>
            <div style="flex:1; min-width:0;">
                <div style="display:flex; justify-content:space-between;">
                    <span style="font-weight:bold; color:#000;">${data.username || 'Anon'}</span>
                    <span style="color:#888; font-size:0.8rem;">${new Date(data.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style="margin-top:2px; font-size:0.95rem; color:#333; word-break: break-word;">${data.text || ''}</div>
                ${mediaHtml}
            </div>
        </div>
    `;
    el.onclick = () => { if(!id.startsWith('temp')) window.location.hash = `#post/${id}`; };

    if(id.startsWith('temp')) {
        el.style.opacity = '0.5'; 
        el.style.pointerEvents = 'none';
    }
    container.prepend(el);
}

// ---------------------------------------------------------
//  INPUT LOGIC
// ---------------------------------------------------------
function setupInputLogic(parentData, parentId) {
    const submitBtn = document.getElementById('submit-comment');
    const fileInput = document.getElementById('reply-file-input');
    
    const replyCropperUI = document.getElementById('reply-cropper-ui');
    const replyCropperImg = document.getElementById('reply-cropper-target');
    const replyCropConfirm = document.getElementById('reply-crop-confirm');
    const replyCropCancel = document.getElementById('reply-crop-cancel');

    const previewContainer = document.getElementById('attachment-preview');
    const previewImg = document.getElementById('preview-img');
    const removeAttachmentBtn = document.getElementById('remove-attachment-btn');
    const composerInputs = document.getElementById('composer-inputs');
    const composerTools = document.getElementById('composer-tools');
    const toast = document.getElementById('upload-toast');

    // 1. FILE SELECT
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        resetForms();
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            composerInputs.style.display = 'none';
            composerTools.style.display = 'none';
            previewContainer.style.display = 'none';
            replyCropperUI.style.display = 'flex';
            
            replyCropperImg.src = evt.target.result;
            
            if(replyCropper) replyCropper.destroy();
            replyCropper = new Cropper(replyCropperImg, {
                viewMode: 1, dragMode: 'crop', autoCrop: false, restore: false, guides: true, center: true, highlight: false, cropBoxMovable: true, cropBoxResizable: true, toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);
        fileInput.value = ''; 
    };

    // 2. CROP ACTIONS
    replyCropConfirm.onclick = () => {
        if(!replyCropper) return;
        replyCropper.getCroppedCanvas({ maxWidth: 1024, maxHeight: 1024 }).toBlob((blob) => {
            replyUploadBlob = blob;
            replyPreviewUrl = URL.createObjectURL(blob);
            previewImg.src = replyPreviewUrl;
            previewContainer.style.display = 'block';
            replyCropper.destroy(); replyCropper = null;
            replyCropperUI.style.display = 'none';
            composerInputs.style.display = 'flex';
            composerTools.style.display = 'flex';
        }, 'image/jpeg', 0.85);
    };

    replyCropCancel.onclick = () => {
        if(replyCropper) replyCropper.destroy(); replyCropper = null;
        replyCropperUI.style.display = 'none';
        composerInputs.style.display = 'flex';
        composerTools.style.display = 'flex';
    };

    removeAttachmentBtn.onclick = () => {
        previewContainer.style.display = 'none';
        previewImg.src = '';
        referenceBlob = null;
        replyUploadBlob = null;
        replyPreviewUrl = null;
    };

    // 3. SUBMIT
    submitBtn.onclick = async () => {
        const text = document.getElementById('comment-text').value;
        if (!text && !referenceBlob && !replyUploadBlob) return;

        // A. OPTIMISTIC UPDATE
        const tempId = `temp-${Date.now()}`;
        const optimisticData = {
            username: 'Anon',
            text: text,
            timestamp: Date.now(),
            crop: referenceBlob ? replyPreviewUrl : null,
            mediaCid: replyUploadBlob ? replyPreviewUrl : null
        };
        renderSingleReply(optimisticData, tempId, document.getElementById('thread-replies'));

        // B. RESET UI
        document.getElementById('comment-text').value = '';
        previewContainer.style.display = 'none';
        const blobToUpload = referenceBlob || replyUploadBlob;
        const isRef = !!referenceBlob;
        const isUpload = !!replyUploadBlob;
        resetForms(); 

        // C. UPLOAD
        let finalIpfsUrl = null;
        try {
            if (blobToUpload) {
                 const filename = isRef ? 'ref_crop.jpg' : 'reply_image.jpg';
                 finalIpfsUrl = await uploadToPinata(blobToUpload, filename);
                 if(!finalIpfsUrl) throw new Error("Upload failed");
            }

            // D. SAVE TO GUN
            const replyNode = {
                type: 'comment',
                text: text,
                username: 'Anon',
                timestamp: Date.now(),
                parentId: parentId,
                rootCid: parentData.rootCid || parentData.cid || parentId,
                crop: isRef ? finalIpfsUrl : null,
                mediaCid: isUpload ? finalIpfsUrl : null
            };

            const ref = gun.get('sharecon_comments').set(replyNode);
            gun.get(parentId).get('replies').set(ref);

            // E. CLEANUP
            const tempEl = document.getElementById(`reply-${tempId}`);
            if(tempEl) tempEl.remove(); 
            toast.style.display = 'block';
            setTimeout(() => toast.style.opacity = '1', 10); 
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.style.display = 'none', 300);
            }, 3000);

        } catch (e) {
            console.error(e);
            const tempEl = document.getElementById(`reply-${tempId}`);
            if(tempEl) {
                tempEl.style.opacity = '1';
                tempEl.style.border = '1px solid red';
                tempEl.innerHTML += `<div style="color:red; font-size:0.8rem;">❌ Upload Failed</div>`;
            }
        }
    };
}

// ---------------------------------------------------------
//  REF CROPPER (FIXED CORS LOGIC)
// ---------------------------------------------------------
function setupRefCropInteractions(imgElement) {
    const startBtn = document.getElementById('start-ref-crop-btn');
    const actionsDiv = document.getElementById('ref-crop-actions');
    const confirmBtn = document.getElementById('confirm-ref-crop-btn');
    const exitBtn = document.getElementById('exit-ref-crop-btn');
    const previewContainer = document.getElementById('attachment-preview');
    const previewImg = document.getElementById('preview-img');

    startBtn.onclick = () => {
        if (refCropper) return;
        resetForms(); 
        startBtn.innerHTML = "⏳";
        
        // FIX: FORCE RELOAD IMAGE WITH CORS
        // We modify the src to add a cache-buster, which forces browser to re-request
        // this specific image instance with the correct headers for canvas usage.
        const originalSrc = imgElement.src.split('?')[0]; // strip old params
        imgElement.crossOrigin = "anonymous";
        imgElement.src = originalSrc + "?t=" + Date.now();
        
        // Wait for the reload
        imgElement.onload = () => {
            startBtn.innerHTML = "✂️ <span style='font-size:0.8rem; font-weight:600;'>Ref</span>";
            startBtn.style.display = 'none';
            actionsDiv.style.display = 'flex';
            
            refCropper = new Cropper(imgElement, {
                viewMode: 1, dragMode: 'crop', autoCrop: false, background: false, checkOrientation: false, checkCrossOrigin: false,
            });
        };
    };

    exitBtn.onclick = () => {
        if(refCropper) refCropper.destroy(); refCropper = null;
        actionsDiv.style.display = 'none';
        startBtn.style.display = 'flex';
    };

    confirmBtn.onclick = () => {
        if (!refCropper) return;
        refCropper.getCroppedCanvas().toBlob((blob) => {
            referenceBlob = blob;
            replyPreviewUrl = URL.createObjectURL(blob);
            previewImg.src = replyPreviewUrl;
            previewContainer.style.display = 'block';
            exitBtn.click(); 
            document.getElementById('comment-text').focus();
        }, 'image/jpeg', 0.8);
    };
}

// ---------------------------------------------------------
//  HELPERS
// ---------------------------------------------------------

// FIXED: Clean function (No Minification errors)
function loadAncestors(data) {
    const container = document.getElementById('thread-ancestors');
    container.innerHTML = ''; 

    const fetchParent = (parentId) => {
        if (!parentId) return;
        gun.get(parentId).once((parentData) => {
            if (!parentData) return;
            const avatarLetter = (parentData.username || 'A')[0].toUpperCase();
            
            const el = document.createElement('div');
            el.className = 'ancestor-item';
            el.innerHTML = `
                <div class="thread-connector"></div>
                <div style="display:flex; gap:12px;">
                    <div class="user-avatar" style="width:36px; height:36px; font-size:0.9rem;">${avatarLetter}</div>
                    <div style="flex:1;">
                         <div style="font-weight:bold; color:#333;">${parentData.username || 'Anon'} <span style="color:#888; font-weight:400;">· ${new Date(parentData.timestamp).toLocaleDateString()}</span></div>
                         <div style="color:#444;">${parentData.text}</div>
                         ${parentData.crop || parentData.cid ? '<div style="font-size:0.8rem; color:#1da1f2; margin-top:4px;">🖼️ Image Attachment</div>' : ''}
                    </div>
                </div>
            `;
            el.onclick = () => window.location.hash = `#post/${parentId}`;
            container.prepend(el);
            
            // Recursive call up the chain
            if (parentData.parentId) fetchParent(parentData.parentId);
        });
    };
    if (data.parentId) fetchParent(data.parentId);
}

async function uploadToPinata(blob, fileName) {
    try {
        const formData = new FormData();
        formData.append('file', blob, fileName);
        const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
        const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', { method: 'POST', headers: { 'Authorization': `Bearer ${PINATA_JWT}` }, body: formData });
        const data = await res.json();
        return data.IpfsHash;
    } catch (e) { return null; }
}