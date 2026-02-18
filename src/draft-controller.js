import { openModal, closeModal, getDraftModalHTML, getPublishModalHTML } from './ui-controller.js';
import { AuthManager } from './auth.js';
import { ImageService } from './image-service.js';

export const DraftController = {
    /* Array to store files locally before upload */
    selectedFiles: [],

    /* Opens the modal for a new draft (Orange Pin) */
    openDraftModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        openModal(getDraftModalHTML(lat, lng));

        const closeBtn = document.getElementById('btn-close-draft');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        DraftController.initPhotoLogic();
        DraftController.initDraftLogic(lat, lng, nostrService, journalManager); /* Renamed from initSaveLogic */
    },

    /* Opens the modal for a direct Review (Violet Pin - PoP) */
    openReviewModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        openModal(getPublishModalHTML(lat, lng));

        const closeBtn = document.getElementById('btn-close-publish');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        DraftController.initPublishPhotoLogic();
        DraftController.initPublishLogic(null, lat, lng, nostrService, journalManager);
    },

    /* Opens the modal to publish an existing draft (Rocket 🚀) */
    openPublishModal(eventId, lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        
        const draftMarker = mapManager.markers.get(eventId);
        openModal(getPublishModalHTML(lat, lng));
        
        if (draftMarker) {
            const titleInput = document.getElementById('pub-title');
            const catSelect = document.getElementById('pub-category');
            if (titleInput) titleInput.value = draftMarker.titulo || "";
            if (catSelect) catSelect.value = draftMarker.categoria || "gastronomia";
        }

        const closeBtn = document.getElementById('btn-close-publish');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        DraftController.initPublishPhotoLogic();
        DraftController.initPublishLogic(eventId, lat, lng, nostrService, journalManager);
    },

   /* Minimalist logic for file selection with dedicated IDs to avoid conflicts */
        initPhotoLogic() {
            const zone = document.getElementById('draft-upload-zone');
            const input = document.getElementById('draft-photo');
            const previewContainer = document.getElementById('draft-preview-container');
            
            if (!zone || !input) return;

            /* Clean previous selections when opening */
            DraftController.selectedFiles = [];
            zone.onclick = () => input.click();

            input.onchange = () => {
                const files = Array.from(input.files);
                files.forEach(file => {
                    DraftController.selectedFiles.push(file);
                    const thumb = document.createElement('div');
                    thumb.style = 'position:relative; width:60px; height:60px; margin:5px; display:inline-block;';
                    
                    thumb.innerHTML = `
                        <img src="${URL.createObjectURL(file)}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                        <span class="remove-btn" style="position:absolute; top:-4px; right:-4px; background:#000000; color:white; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:bold; border:1.5px solid white;">✕</span>
                    `;

                    thumb.querySelector('.remove-btn').onclick = (e) => {
                        e.stopPropagation();
                        DraftController.selectedFiles = DraftController.selectedFiles.filter(f => f !== file);
                        thumb.remove();
                    };
                    if (previewContainer) previewContainer.appendChild(thumb);
                });
                input.value = ''; 
            };
        },

    initPublishPhotoLogic() {
            const zone = document.getElementById('pub-upload-zone');
            const input = document.getElementById('pub-photo');
            /* Make sure you have a container for the thumbnails in your UI */
            const previewContainer = document.getElementById('pub-preview-container'); 
            
            if (!zone || !input) return;

            zone.onclick = () => input.click();

            input.onchange = () => {
                const files = Array.from(input.files); //
                files.forEach(file => {
                    DraftController.selectedFiles.push(file); // Reference the object property
                    
                    const thumb = document.createElement('div');
                    thumb.className = 'thumb-container';
                    thumb.style = 'position:relative; width:60px; height:60px; margin:5px; display:inline-block;';
                    
                   thumb.innerHTML = `
                                        <img src="${URL.createObjectURL(file)}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">
                                        <span class="remove-btn" style="position:absolute; top:-4px; right:-4px; background:#000000; color:white; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; font-weight:bold; border:1.5px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">✕</span>
                                    `;

                    thumb.querySelector('.remove-btn').onclick = (e) => {
                        e.stopPropagation();
                        /* Filter from the object property */
                        DraftController.selectedFiles = DraftController.selectedFiles.filter(f => f !== file);
                        thumb.remove();
                    };

                    if (previewContainer) previewContainer.appendChild(thumb);
                });
                /* Clear the input so the same file can be selected again if deleted */
                input.value = ''; 
            };
        },

    /* Logic to send the final Kind 1 event to Nostr */
    initPublishLogic(eventId, lat, lng, nostrService, journalManager) {
        const btn = document.getElementById('btn-do-publish');
        if (!btn) return;

        btn.onclick = async () => {
            const fileInput = document.getElementById('pub-photo');
            const title = document.getElementById('pub-title').value.trim();
            const desc = document.getElementById('pub-description').value.trim();
            const cat = document.getElementById('pub-category').value;

            if (!title) return showToast("Title is required", "error");

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> UPLOADING...';
            btn.disabled = true;

            try {
                    const imageUrls = [];
                    /* Upload all selected files sequentially */
                    for (const file of DraftController.selectedFiles) { // Correct reference
                            const url = await ImageService.upload(file);
                            imageUrls.push(url);
                        }

                    const publicEvent = {
                        kind: 1,
                        content: `${title}\n\n${desc}`,
                        tags: [
                            ["t", "spatial_anchor"],
                            ["t", cat],
                            ["g", `${lat},${lng}`],
                            ["title", title],
                            ["p", AuthManager.userPubkey]
                        ],
                        created_at: Math.floor(Date.now() / 1000)
                    };

    /* Append each image URL as an individual tag */
    imageUrls.forEach(url => publicEvent.tags.push(["image", url]));

                const success = await nostrService.publishEvent(publicEvent);
                /* ... rest of your existing success logic (delete draft, toast, etc.) */
            } catch (err) {
                console.error("Publish failed:", err);
                btn.disabled = false;
                btn.innerHTML = 'PUBLISH TO NOSTR';
            }
        };
    },

    /* Logic to save a Draft (Kind 30024) to the Journal */
    initDraftLogic(lat, lng, nostrService, journalManager) { /* Renamed from initSaveLogic */
        const btnSave = document.getElementById('btn-save-draft');
        if (!btnSave) return;

       btnSave.onclick = async () => {
            const fileInput = document.getElementById('draft-photo');
            const titleInput = document.getElementById('draft-title');
            const title = titleInput ? titleInput.value.trim() : "";
            
            if (!title) return showToast("⚠️ Title required", "error");

            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SAVING...';
            btnSave.disabled = true;

            try {
                let imageUrl = "";
                if (fileInput && fileInput.files[0]) {
                    imageUrl = await ImageService.upload(fileInput.files[0]);
                }

                const draftEvent = {
                    kind: 30024,
                    /* Draft content now includes the permanent URL */
                    content: imageUrl ? `Draft: ${title}\n\n${imageUrl}` : `Draft: ${title}`,
                    tags: [
                        ["d", `draft_${Date.now()}`],
                        ["title", title],
                        ["t", "spatial_anchor"],
                        ["g", `${lat},${lng}`]
                    ],
                    created_at: Math.floor(Date.now() / 1000)
                };
                /* ... rest of your existing success logic */
            } catch (err) {
                btnSave.disabled = false;
                btnSave.innerHTML = 'SAVE TO JOURNAL';
            }
        };
    }
};