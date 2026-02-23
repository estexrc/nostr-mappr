import { openModal, closeModal, getDraftModalHTML, getPublishModalHTML, showToast } from '../../ui/ui-controller.js';
import { AuthManager } from '../../core/auth.js';
import { ImageService } from '../../utils/image-service.js';

export const DraftController = {
    /* Array to store files locally before upload */
    selectedFiles: [],
    /* Array to store existing image URLs from drafts */
    existingImages: [],

    /* Opens the modal for a new draft (Orange Pin) */
    openDraftModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        openModal(getDraftModalHTML(lat, lng));

        DraftController.initPhotoLogic();
        DraftController.initDraftLogic(lat, lng, nostrService, journalManager);
    },

    /* Opens the modal for a direct Review (Violet Pin - PoP) */
    openReviewModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        openModal(getPublishModalHTML(lat, lng));

        DraftController.initPublishPhotoLogic();
        DraftController.initPublishLogic(null, lat, lng, nostrService, journalManager);
    },

    /* Opens the modal to publish an existing draft (Rocket 🚀) */
    openPublishModal(eventId, lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();

        const entry = journalManager.entries.find(e => e.id === eventId);
        openModal(getPublishModalHTML(lat, lng));

        DraftController.existingImages = [];

        if (entry) {
            const titleInput = document.getElementById('pub-title');
            const descArea = document.getElementById('pub-description');
            const catSelect = document.getElementById('pub-category');
            const previewContainer = document.getElementById('pub-preview-container');

            const title = entry.tags.find(t => t[0] === 'title')?.[1] || entry.content.split('\n\n')[0] || "";

            // Reconstruct description: if there was a title tag, the content is likely just the description.
            // If not, it's the part after the first double newline.
            let description = entry.content;
            if (!entry.tags.find(t => t[0] === 'title')) {
                const parts = entry.content.split('\n\n');
                description = parts.slice(1).join('\n\n') || parts[0];
            }

            // Clean description from image URLs for the textarea
            const cleanDescription = description.replace(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\.bmp)(?:\?[^\s]*)?/gi, '').trim();

            const category = entry.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor')?.[1] || "all";

            if (titleInput) titleInput.value = title;
            if (descArea) descArea.value = cleanDescription;
            if (catSelect) catSelect.value = category;

            // Handle images
            const imageUrls = [
                ...new Set([
                    ...entry.tags.filter(t => t[0] === 'image' || t[0] === 'imeta').map(t => t[1]),
                    ...(entry.content.match(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\.bmp)(?:\?[^\s]*)?/gi) || [])
                ])
            ];

            DraftController.existingImages = imageUrls;

            if (previewContainer && imageUrls.length > 0) {
                imageUrls.forEach(url => {
                    const div = document.createElement('div');
                    div.className = "relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm group";
                    div.innerHTML = `
                        <img src="${url}" class="w-full h-full object-cover">
                        <button class="absolute top-1 right-1 bg-slate-900/50 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" 
                                onclick="this.parentElement.remove(); window.removeExistingImage('${url}')">✕</button>
                    `;
                    previewContainer.appendChild(div);
                });
            }
        }

        // Bridge to allow removing existing images from the global scope (since we use onclick)
        window.removeExistingImage = (url) => {
            DraftController.existingImages = DraftController.existingImages.filter(u => u !== url);
        };

        DraftController.initPublishPhotoLogic();
        DraftController.initPublishLogic(eventId, lat, lng, nostrService, journalManager);
    },

    /* Minimalist logic for file selection with dedicated IDs to avoid conflicts */
    initPhotoLogic() {
        const zone = document.getElementById('draft-upload-zone');
        const input = document.getElementById('draft-photo');
        const previewContainer = document.getElementById('draft-preview-container');

        if (!zone || !input) return;

        DraftController.selectedFiles = [];
        zone.onclick = () => input.click();

        input.onchange = () => {
            const files = Array.from(input.files);
            files.forEach(file => {
                DraftController.selectedFiles.push(file);
                const thumb = document.createElement('div');
                thumb.className = 'relative w-16 h-16 group';

                thumb.innerHTML = `
                    <img src="${URL.createObjectURL(file)}" class="w-full h-full object-cover rounded-xl border border-slate-100 shadow-sm">
                    <span class="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-[10px] font-black border-2 border-white shadow-md hover:scale-110 transition-transform">✕</span>
                `;

                thumb.querySelector('span').onclick = (e) => {
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
        const previewContainer = document.getElementById('pub-preview-container');

        if (!zone || !input) return;

        DraftController.selectedFiles = [];
        zone.onclick = () => input.click();

        input.onchange = () => {
            const files = Array.from(input.files);
            files.forEach(file => {
                DraftController.selectedFiles.push(file);

                const thumb = document.createElement('div');
                thumb.className = 'relative w-full aspect-square group';

                thumb.innerHTML = `
                    <img src="${URL.createObjectURL(file)}" class="w-full h-full object-cover rounded-xl border border-slate-100 shadow-sm">
                    <span class="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-[10px] font-black border-2 border-white shadow-md hover:scale-110 transition-transform">✕</span>
                `;

                thumb.querySelector('span').onclick = (e) => {
                    e.stopPropagation();
                    DraftController.selectedFiles = DraftController.selectedFiles.filter(f => f !== file);
                    thumb.remove();
                };

                if (previewContainer) previewContainer.appendChild(thumb);
            });
            input.value = '';
        };
    },

    /* Helper to save drafts locally in localStorage */
    saveLocalDraft(title, desc, cat, lat, lng, imageUrls) {
        try {
            const drafts = JSON.parse(localStorage.getItem('local_drafts') || '[]');
            const newDraft = {
                id: `local_${Date.now()}`,
                kind: 'local',
                content: `${title}\n\n${desc}`,
                tags: [
                    ["t", "spatial_anchor"],
                    ["t", cat],
                    ["g", `${lat},${lng}`],
                    ["title", title]
                ],
                pubkey: AuthManager.userPubkey,
                created_at: Math.floor(Date.now() / 1000)
            };
            imageUrls.forEach(url => newDraft.tags.push(["image", url]));

            drafts.push(newDraft);
            localStorage.setItem('local_draft_storage', JSON.stringify(drafts)); // Changed key to avoid conflict if any
            return true;
        } catch (err) {
            console.error("Local draft error:", err);
            return false;
        }
    },

    /* Logic to send the final Kind 1 event to Nostr */
    initPublishLogic(eventId, lat, lng, nostrService, journalManager) {
        const btn = document.getElementById('btn-do-publish');
        if (!btn) return;

        btn.onclick = async () => {
            const title = document.getElementById('pub-title').value.trim();
            const desc = document.getElementById('pub-description').value.trim();
            const cat = document.getElementById('pub-category').value || 'all';

            if (!title) return showToast("El título es obligatorio", "error");

            const isReadOnly = !AuthManager.canSign();
            btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${isReadOnly ? 'GUARDANDO LOCALMENTE...' : 'PUBLICANDO...'}`;
            btn.disabled = true;

            try {
                const imageUrls = [];
                for (const file of DraftController.selectedFiles) {
                    const url = await ImageService.upload(file);
                    imageUrls.push(url);
                }

                if (isReadOnly) {
                    const saved = DraftController.saveLocalDraft(title, desc, cat, lat, lng, imageUrls);
                    if (saved) {
                        showToast("¡Borrador local guardado!", "success");
                        DraftController.selectedFiles = [];
                        closeModal();
                        if (journalManager) journalManager.syncJournal();
                    }
                    return;
                }

                const publicEvent = {
                    kind: 1,
                    content: `${title}\n\n${desc}`,
                    tags: [
                        ["t", "spatial_anchor"],
                        ["t", cat],
                        ["g", `${lat},${lng}`],
                        ["title", title]
                    ],
                    created_at: Math.floor(Date.now() / 1000)
                };

                imageUrls.forEach(url => publicEvent.tags.push(["image", url]));

                const success = await nostrService.publishEvent(publicEvent);
                if (success) {
                    showToast("¡Ancla publicada con éxito!", "success");
                    DraftController.selectedFiles = [];
                    DraftController.existingImages = [];
                    if (eventId && journalManager) {
                        await journalManager.deleteEntry(eventId);
                    }
                    closeModal();
                    if (journalManager) journalManager.syncJournal();
                } else {
                    throw new Error("Relays failed");
                }
            } catch (err) {
                console.error("Publish failed:", err);
                btn.disabled = false;
                btn.innerHTML = isReadOnly ? 'GUARDAR COMO LOCAL' : 'PUBLICAR EN NOSTR';
                showToast("Error al procesar", "error");
            }
        };
    },

    /* Logic to save a Draft (Kind 30024) to the Journal */
    initDraftLogic(lat, lng, nostrService, journalManager) {
        const btnSave = document.getElementById('btn-save-draft');
        if (!btnSave) return;

        btnSave.onclick = async () => {
            const title = document.getElementById('draft-title').value.trim();
            const cat = document.getElementById('draft-category').value || 'all';

            if (!title) return showToast("⚠️ Título obligatorio", "error");

            const isReadOnly = !AuthManager.canSign();
            btnSave.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> ${isReadOnly ? 'GUARDANDO LOCAL...' : 'GUARDANDO...'}`;
            btnSave.disabled = true;

            try {
                const imageUrls = [];
                for (const file of DraftController.selectedFiles) {
                    const url = await ImageService.upload(file);
                    imageUrls.push(url);
                }

                if (isReadOnly) {
                    const saved = DraftController.saveLocalDraft(title, "", cat, lat, lng, imageUrls);
                    if (saved) {
                        showToast("Borrador local guardado", "success");
                        DraftController.selectedFiles = [];
                        closeModal();
                        if (journalManager) journalManager.syncJournal();
                    }
                    return;
                }

                const draftEvent = {
                    kind: 30024,
                    content: `Draft: ${title}`,
                    tags: [
                        ["d", `draft_${Date.now()}`],
                        ["title", title],
                        ["t", "spatial_anchor"],
                        ["t", cat],
                        ["g", `${lat},${lng}`]
                    ],
                    created_at: Math.floor(Date.now() / 1000)
                };

                imageUrls.forEach(url => draftEvent.tags.push(["image", url]));

                const success = await nostrService.publishEvent(draftEvent);
                if (success) {
                    showToast("Borrador guardado", "success");
                    DraftController.selectedFiles = [];
                    closeModal();
                    if (journalManager) journalManager.syncJournal();
                }
            } catch (err) {
                console.error("Draft fail:", err);
                btnSave.disabled = false;
                btnSave.innerHTML = 'GUARDAR EN DIARIO';
                showToast("Error al guardar", "error");
            }
        };
    }
};