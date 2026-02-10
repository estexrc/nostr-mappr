import { openModal, closeModal, getDraftModalHTML, getPublishModalHTML } from './ui-controller.js';
import { AuthManager } from './auth.js';

export const DraftController = {
    /**
     * Abre el modal para un nuevo borrador (Pin Naranja)
     */
    openDraftModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        openModal(getDraftModalHTML(lat, lng));

        const closeBtn = document.getElementById('btn-close-draft');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        DraftController.initPhotoLogic();
        DraftController.initSaveLogic(lat, lng, nostrService, journalManager);
    },

    /**
     * Abre el modal para una Reseña directa (Pin Violeta - PoP)
     */
    openReviewModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        openModal(getPublishModalHTML(lat, lng));

        const closeBtn = document.getElementById('btn-close-publish');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        DraftController.initPublishPhotoLogic();
        DraftController.initPublishLogic(null, lat, lng, nostrService, journalManager);
    },

    /**
     * Abre el modal para publicar un borrador existente (Cohete 🚀)
     */
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

        // Llamadas directas al objeto para evitar el TypeError
        DraftController.initPublishPhotoLogic();
        DraftController.initPublishLogic(eventId, lat, lng, nostrService, journalManager);
    },

    /**
     * Lógica para capturar fotos en el modal de PUBLICACIÓN
     */
    initPublishPhotoLogic() {
        const fileInput = document.getElementById('pub-photo');
        const uploadZone = document.getElementById('pub-upload-zone');
        const previewContainer = document.getElementById('pub-preview-container');

        if (!uploadZone || !fileInput) return;

        uploadZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const imgThumb = document.createElement('img');
                    imgThumb.src = event.target.result;
                    imgThumb.className = "preview-thumb-publish";
                    imgThumb.style.cssText = "width: 60px; height: 60px; object-fit: cover; border-radius: 8px; margin: 5px;";
                    if (previewContainer) previewContainer.appendChild(imgThumb);
                };
                reader.readAsDataURL(file);
            });
        };
    },

    /**
     * Lógica para enviar el evento definitivo Kind 1
     */
    initPublishLogic(eventId, lat, lng, nostrService, journalManager) {
        const btn = document.getElementById('btn-do-publish');
        if (!btn) return;

        btn.onclick = async () => {
            const title = document.getElementById('pub-title').value.trim();
            const desc = document.getElementById('pub-description').value.trim();
            const cat = document.getElementById('pub-category').value;

            if (!title) return alert("El título es obligatorio.");

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PUBLICANDO...';
            btn.disabled = true;

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

            try {
                const success = await nostrService.publishEvent(publicEvent);
                if (success) {
                    if (eventId) await journalManager.deleteDraft(eventId);
                    alert("🚀 ¡Publicado con éxito!");
                    closeModal();
                }
            } catch (err) {
                console.error("Error publishing:", err);
                btn.disabled = false;
                btn.innerHTML = 'PUBLICAR EN NOSTR';
            }
        };
    },

    initPhotoLogic() {
        const fileInput = document.getElementById('draft-photo');
        const uploadZone = document.getElementById('upload-zone');
        if (uploadZone && fileInput) uploadZone.onclick = () => fileInput.click();
    },

    initSaveLogic(lat, lng, nostrService, journalManager) {
        const btnSave = document.getElementById('btn-save-draft');
        if (btnSave) {
            btnSave.onclick = async () => {
                // ... lógica de guardado 30024 existente ...
            };
        }
    }
};