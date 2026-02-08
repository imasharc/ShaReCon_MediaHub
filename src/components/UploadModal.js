import { gun } from '../db.js';

let uploadCropper = null;

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

    // --- 2. FILE HANDLING (The "Instant" Cropper) ---
    const handleFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            // A. Clean up UI
            dropZone.style.display = 'none';
            previewContainer.style.display = 'block';
            
            // B. Prepare Image for Cropping (Remove size limits)
            imgPreview.src = e.target.result;
            imgPreview.style.maxHeight = '60vh'; // Give it room!
            imgPreview.style.display = 'block';

            // C. Initialize Cropper Immediately
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

    // Listeners for Input
    fileInput.onchange = (e) => handleFile(e.target.files[0]);
    dropZone.onclick = () => fileInput.click();

    // Remove File
    removeBtn.onclick = () => {
        resetForm();
    };

    // --- 3. UPLOAD LOGIC (Sending the Crop) ---
    confirmBtn.onclick = async () => {
        if (!uploadCropper) return;

        const username = document.getElementById('username-input').value || 'Anonymous';
        const caption = document.getElementById('caption-input').value || '';
        
        // UI Feedback
        confirmBtn.disabled = true;
        confirmBtn.innerText = "⏳ Compressing & Uploading...";
        statusMsg.innerText = "Processing image...";

        // A. Get the CROPPED result as a Blob (File)
        uploadCropper.getCroppedCanvas({
            maxWidth: 1024, // Optional: Resize if it's massive
            maxHeight: 1024
        }).toBlob(async (blob) => {
            
            if (!blob) {
                statusMsg.innerText = "Error generating image.";
                confirmBtn.disabled = false;
                return;
            }

            // B. Upload Blob to Pinata
            try {
                const formData = new FormData();
                
                formData.append('file', blob, currentFileName);

                const PINATA_JWT = import.meta.env.VITE_PINATA_JWT; 
                
                statusMsg.innerText = "Uploading to IPFS...";

                const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${PINATA_JWT}`
                    },
                    body: formData
                });

                const result = await response.json();

                if (result.IpfsHash) {
                    // C. Save Metadata to GunJS
                    statusMsg.innerText = "Syncing to ShaReCon...";
                    
                    const postData = {
                        cid: result.IpfsHash,
                        username: username,
                        text: caption,
                        timestamp: Date.now(),
                        type: 'image'
                    };

                    gun.get('sharecon_app_v2_posts').set(postData);

                    // D. Success!
                    setTimeout(() => {
                        closeModal();
                    }, 500);
                } else {
                    throw new Error("Pinata upload failed");
                }

            } catch (error) {
                console.error("Upload error:", error);
                statusMsg.innerText = "Upload Failed: " + error.message;
                statusMsg.style.color = "red";
                confirmBtn.disabled = false;
                confirmBtn.innerText = "Post";
            }
        }, 'image/jpeg', 0.85); // Quality 0.85
    };

    function resetForm() {
        if (uploadCropper) {
            uploadCropper.destroy();
            uploadCropper = null;
        }
        fileInput.value = '';
        dropZone.style.display = 'flex';
        previewContainer.style.display = 'none';
        imgPreview.src = '';
        imgPreview.style.maxHeight = '150px'; // Reset for next time
        confirmBtn.disabled = true;
        confirmBtn.innerText = "Post";
        statusMsg.innerText = "";
        document.getElementById('caption-input').value = '';
    }
}