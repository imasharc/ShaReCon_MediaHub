import { appDB } from '../db.js';
import { uploadToIPFS } from '../services/pinata.js';

export function initUploadModal() {
    // DOM Elements
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
    
    let selectedFile = null;

    // --- 1. OPEN / CLOSE ---
    openBtn.onclick = () => { 
        modal.style.display = 'flex'; 
        // Optional: Reset form on open? 
        // removeBtn.click(); 
    };
    closeBtn.onclick = () => { modal.style.display = 'none'; };

    // --- 2. FILE SELECTION ---
    const handleFileSelect = (file) => {
        selectedFile = file;
        
        // PREVIEW LOGIC
        imgPreview.src = URL.createObjectURL(file);
        dropZone.style.display = 'none';
        previewContainer.style.display = 'block';
        
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = "1";
    };

    // Input Change
    fileInput.onchange = (e) => {
        if(e.target.files.length) handleFileSelect(e.target.files[0]);
    };

    // Drop Zone Support
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = '#000'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = '#ccc'; };
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        if(e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    };

    // --- 3. REMOVE FILE ---
    removeBtn.onclick = () => {
        selectedFile = null;
        fileInput.value = '';
        previewContainer.style.display = 'none';
        dropZone.style.display = 'flex';
        imgPreview.src = '';
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = "0.5";
    };

    // --- 4. UPLOAD ACTION ---
    confirmBtn.onclick = async () => {
        if (!selectedFile) return;
        statusMsg.innerText = "Uploading...";
        statusMsg.style.color = "blue";
        confirmBtn.disabled = true;
        
        try {
            // A. Service Call
            const cid = await uploadToIPFS(selectedFile);
            
            // B. Database Call
            appDB.set({
                cid,
                username: document.getElementById('username-input').value || "Anon",
                text: document.getElementById('caption-input').value,
                timestamp: Date.now(),
                type: selectedFile.type
            });

            statusMsg.innerText = "Success!";
            statusMsg.style.color = "green";
            setTimeout(() => {
                modal.style.display = 'none';
                removeBtn.click(); // Reset form for next time
                statusMsg.innerText = "";
            }, 1000);

        } catch (err) {
            statusMsg.innerText = "Error: " + err.message;
            statusMsg.style.color = "red";
            confirmBtn.disabled = false;
            console.error(err);
        }
    };
}