import { openModal, closeModal, getDraftModalHTML, getPublishModalHTML } from './ui-controller.js';
import { AuthManager } from './auth.js';

export const DraftController = {
    /**
     * Abrir modal para un nuevo borrador (Pin Naranja)
     */
    openDraftModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        
        openModal(getDraftModalHTML(lat, lng));

        // Vinculamos el botón de cerrar del modal de borrador
        const closeBtn = document.getElementById('btn-close-draft');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        this.initPhotoLogic();
        this.initSaveLogic(lat, lng, nostrService, journalManager);
    },

    /**
     * Abrir modal para una Reseña directa (Pin Violeta - PoP)
     */
    openReviewModal(lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup(); // Limpiar fondo
        
        openModal(getPublishModalHTML(lat, lng)); // Usamos el modal con DESCRIPCIÓN

        // Vinculamos el botón de cerrar del modal de publicación
        const closeBtn = document.getElementById('btn-close-publish');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        this.initPublishLogic(null, lat, lng, nostrService, journalManager);
    },

    /**
     * Abrir modal para publicar un borrador existente (Cohete 🚀)
     */
    openPublishModal(eventId, lat, lng, mapManager, nostrService, journalManager) {
        if (mapManager && mapManager.map) mapManager.map.closePopup();
        
        const draftMarker = mapManager.markers.get(eventId);
        openModal(getPublishModalHTML(lat, lng));
        
        // Cargamos datos previos del marcador naranja
        document.getElementById('pub-title').value = draftMarker.titulo || "";
        document.getElementById('pub-category').value = draftMarker.categoria || "gastronomia";

        const closeBtn = document.getElementById('btn-close-publish');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        this.initPublishLogic(eventId, lat, lng, nostrService, journalManager);
    },

    /**
     * Lógica compartida para enviar un Kind 1 (Público)
     */
    initPublishLogic(eventId, lat, lng, nostrService, journalManager) {
        const btn = document.getElementById('btn-do-publish');
        if (!btn) return;

        btn.onclick = async () => {
            const title = document.getElementById('pub-title').value.trim();
            const desc = document.getElementById('pub-description').value.trim();
            const cat = document.getElementById('pub-category').value;

            if (!title) return alert("Title is required.");

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PUBLISHING...';
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
                    // Si venía de un borrador, lo borramos de los relays
                    if (eventId) await journalManager.deleteDraft(eventId);
                    alert("🚀 Published successfully!");
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
        // ... (resto de lógica de FileReader igual)
    },

    initSaveLogic(lat, lng, nostrService, journalManager) {
        const btnSave = document.getElementById('btn-save-draft');
        if (!btnSave) return;
        btnSave.onclick = async () => {
            // ... (lógica de guardado Kind 30024 igual)
        };
    }
};