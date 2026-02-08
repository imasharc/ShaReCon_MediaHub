import { gun } from '../db.js';

// --- GLOBAL VARIABLES (Module Scope) ---
let uploadCropper = null;
let currentFileName = 'image.jpg'; // Defined globally to fix ReferenceError

export function initUploadModal() {
    const modal = document.getElementById('upload-modal');
    const openBtn = document.getElementById('open-upload-btn');
    const closeBtn = document.getElementById('close-modal-btn');
    const confirmBtn = document.getElementById('confirm-upload-btn');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const previewContainer = document.getElementById('preview-container');
    const imgPreview = document.getElementById('img-preview');
    const removeBtn = document.getElementById('remove-file-btn');
    const statusMsg = document.getElementById('upload-status-msg');

    // --- 1. OPEN / CLOSE LOGIC ---
    openBtn.onclick = () => {
        modal.style.display = 'flex';
        resetForm();
    };

    const closeModal = () => {
        modal.style.display = 'none';
        resetForm();
    };

    closeBtn.onclick = closeModal;
    window.onclick = (e) => { if (e.target === modal) closeModal(); };

    // --- 2. FILE HANDLING ---
    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;

        // Capture filename globally
        currentFileName = file.name || `image_${Date.now()}.jpg`;

        const reader = new FileReader();
        reader.onload = (e) => {
            dropZone.style.display = 'none';
            previewContainer.style.display = 'block';
            
            imgPreview.src = e.target.result;
            imgPreview.style.maxHeight = '60vh'; 
            imgPreview.style.display = 'block';

            if (uploadCropper) uploadCropper.destroy();
            
            uploadCropper = new Cropper(imgPreview, {
                viewMode: 1,
                dragMode: 'crop',
                autoCrop: false,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });

            confirmBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    };

    fileInput.onchange = (e) => handleFile(e.target.files[0]);
    dropZone.onclick = () => fileInput.click();
    removeBtn.onclick = () => resetForm();

    // --- 3. UPLOAD LOGIC ---
    confirmBtn.onclick = async () => {
        if (!uploadCropper) return;

        const username = document.getElementById('username-input').value || 'Anonymous';
        const caption = document.getElementById('caption-input').value || '';
        
        confirmBtn.disabled = true;
        confirmBtn.innerText = "⏳ Compressing & Uploading...";
        statusMsg.innerText = "Processing image...";
        statusMsg.style.color = "black";

        uploadCropper.getCroppedCanvas({
            maxWidth: 1024,
            maxHeight: 1024
        }).toBlob(async (blob) => {
            
            if (!blob) {
                statusMsg.innerText = "Error generating image.";
                confirmBtn.disabled = false;
                return;
            }

            try {
                const formData = new FormData();
                // Usage of global variable
                formData.append('file', blob, currentFileName);

                const PINATA_JWT = import.meta.env.VITE_PINATA_JWT; 
                
                statusMsg.innerText = "Uploading to IPFS...";

                const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${PINATA_JWT}` },
                    body: formData
                });

                if (!response.ok) throw new Error(`Upload Failed (${response.status})`);

                const result = await response.json();

                if (result.IpfsHash) {
                    statusMsg.innerText = "Syncing to ShaReCon...";
                    
                    const postData = {
                        cid: result.IpfsHash,
                        username: username,
                        text: caption,
                        timestamp: Date.now(),
                        type: 'image',
                        filename: currentFileName
                    };

                    gun.get('sharecon_app_v2_posts').set(postData);

                    setTimeout(() => closeModal(), 500);
                } else {
                    throw new Error("Pinata upload failed");
                }

            } catch (error) {
                console.error("Upload error:", error);
                statusMsg.innerText = "Error: " + error.message;
                statusMsg.style.color = "red";
                confirmBtn.disabled = false;
                confirmBtn.innerText = "Post";
            }
        }, 'image/jpeg', 0.85);
    };

    function resetForm() {
        if (uploadCropper) {
            uploadCropper.destroy();
            uploadCropper = null;
        }
        fileInput.value = '';
        currentFileName = 'image.jpg';
        dropZone.style.display = 'flex';
        previewContainer.style.display = 'none';
        imgPreview.src = '';
        imgPreview.style.maxHeight = '150px';
        confirmBtn.disabled = true;
        confirmBtn.innerText = "Post";
        statusMsg.innerText = "";
        document.getElementById('caption-input').value = '';
    }
}