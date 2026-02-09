import { AuthManager } from './auth.js';
import { openModal, closeModal, getJournalModalHTML } from './ui-controller.js';

export class JournalManager {
    constructor(mapManager, nostrService) {
        this.map = mapManager;
        this.nostr = nostrService;
        this.drafts = [];
    }

    /* Sincroniza borradores desde la red y los pinta en el mapa */
    async syncDrafts() {
        if (!AuthManager.isLoggedIn()) return;

        const filters = {
            kinds: [30024],
            authors: [AuthManager.userPubkey],
            "#t": ["spatial_anchor"]
        };

        try {
            console.log("🔄 Sincronizando borradores...");
            this.drafts = await this.nostr.fetchEvents(filters);
            
            // Limpiamos la capa de borradores antes de repintar
            this.map.clearDrafts();
            
            this.drafts.forEach(ev => this.renderDraft(ev));
            console.log(`✅ ${this.drafts.length} borradores cargados.`);
        } catch (err) {
            console.error("Error en syncDrafts:", err);
        }
    }

    /* Dibuja un borrador usando la lógica unificada de MapManager (Visual Consistency) */
    renderDraft(event) {
        const coordsTag = event.tags.find(t => t[0] === 'g')?.[1];
        if (!coordsTag) return;

        const [lat, lng] = coordsTag.split(',');
        const categoria = event.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor')?.[1] || 'todos';

        const profile = AuthManager.profileCache[event.pubkey] || null;

        // Usamos el generador de popups de ui-map con isDraft = true
        const popupHTML = this.map.createPopupHTML(event, profile, categoria, true);

        // addMarker ahora se encarga de que sea NARANJA
        this.map.addMarker(event.id, parseFloat(lat), parseFloat(lng), popupHTML, categoria, 'draft');
    }

    /* Abre el modal del diario con los datos ya cargados */
    async openJournal() {
        if (!AuthManager.isLoggedIn()) {
            alert("Debes conectar tu identidad Nostr.");
            return;
        }

        // Mostramos lo que ya tenemos y refrescamos en segundo plano
        openModal(getJournalModalHTML(this.drafts));
        
        const closeBtn = document.getElementById('btn-close-journal');
        if (closeBtn) closeBtn.onclick = () => closeModal();

        await this.syncDrafts(); // Actualiza por si hay cambios nuevos
    }

    async deleteDraft(eventId) {
        if (!confirm("¿Eliminar este borrador permanentemente?")) return;

        const success = await this.nostr.deleteEvent(eventId);
        if (success) {
            // Eliminación visual inmediata
            const marker = this.map.markers.get(eventId);
            if (marker) this.map.draftLayer.removeLayer(marker);
            this.map.markers.delete(eventId);
            
            this.drafts = this.drafts.filter(d => d.id !== eventId);
            this.openJournal(); // Refresca la tabla si está abierta
        }
    }
}