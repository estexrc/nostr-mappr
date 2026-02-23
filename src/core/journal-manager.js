import { AuthManager } from './auth.js';
import { store } from './store.js';
import { openModal, closeModal, getJournalModalHTML, getConfirmModalHTML, showToast } from '../ui/ui-controller.js';

/* JournalManager: Handles the logic for the user's personal logbook, managing both public anchors and drafts. */
export class JournalManager {
    constructor(mapManager, nostrService) {
        this.map = mapManager;
        this.nostr = nostrService;
        this.entries = [];
        this.isSyncing = false;
    }

    /* Synchronizes logbook entries from the network and renders them on the map. */
    async syncJournal() {
        if (!AuthManager.isLoggedIn() || this.isSyncing) return;

        this.isSyncing = true;

        try {
            // 1. Fetch from Nostr (Public Anchors Kind 1)
            const publicAnchors = await this.nostr.fetchEvents({
                kinds: [1],
                authors: [AuthManager.userPubkey],
                "#t": ["spatial_anchor"]
            });

            // 2. Fetch Remote Drafts (Kind 30024 & Kind 30078)
            const remoteDrafts = await this.nostr.fetchEvents({
                kinds: [30024, 30078],
                authors: [AuthManager.userPubkey],
                "#t": ["spatial_anchor"]
            });

            // 3. Fetch from Local Storage
            const localDrafts = JSON.parse(localStorage.getItem('local_draft_storage') || '[]')
                .filter(d => d.pubkey === AuthManager.userPubkey);

            // 4. Merge and Sort
            const allEntries = [...publicAnchors, ...remoteDrafts, ...localDrafts];

            /* Check for actual changes: only process if the count differs. */
            if (allEntries.length === this.entries.length) {
                this.isSyncing = false;
                return;
            }

            this.entries = allEntries.sort((a, b) => b.created_at - a.created_at);

            // Sync with VM Store instead of direct rendering
            const { pins } = store.state;
            this.entries.forEach(event => {
                const profile = AuthManager.profileCache[event.pubkey] || null;
                const isDraft = event.kind === 30024 || event.kind === 30078 || event.kind === 'local';
                const pin = store.processEventToPin(event, profile, isDraft);
                pin.event = event;
                pins.set(pin.id, pin);
            });
            store.setState({ pins });

            // 5. Proactive Sync: If we can sign, try to push local drafts to relay (Kind 30078)
            if (AuthManager.canSign() && localDrafts.length > 0) {
                this.uploadLocalDraftsToRelay(localDrafts);
            }

        } catch (err) {
            console.error("Journal sync error", err);
        } finally {
            this.isSyncing = false;
        }
    }

    /* LEGACY - Removing in favor of VM sync */
    renderEntry(event) {
        // No longer needed
    }

    /**
     * Uploads local drafts to a relay as Kind 30078 "Borradores de Paso".
     */
    async uploadLocalDraftsToRelay(localDrafts) {
        for (const draft of localDrafts) {
            try {
                // Use a unique d-tag for each draft to avoid overwriting all with one
                const dTag = `draft_${draft.id.replace('local_', '')}`;
                const success = await this.nostr.publishAppData(dTag, draft);

                if (success) {
                    console.log(`☁️ Draft ${draft.id} synced to relay.`);
                }
            } catch (err) {
                console.error("Draft sync to relay failed", err);
            }
        }
    }

    /* Opens the journal modal with current data and updates content in background. */
    async openJournal() {
        if (!AuthManager.isLoggedIn()) {
            showToast("🔑 Debes conectar tu identidad de Nostr.", "error");
            return;
        }

        /* 1. Initial render with local data. */
        openModal(getJournalModalHTML(this.entries));

        /* 2. Background synchronization. */
        await this.syncJournal();

        /* 3. Re-render only if modal is still open and data has updated. */
        const modalContent = document.getElementById('modal-content');
        if (modalContent) {
            modalContent.innerHTML = getJournalModalHTML(this.entries);
            this.setupJournalEvents();
        }
    }

    /* Sets up the event listeners for the journal modal UI. */
    setupJournalEvents() {
        const closeBtn = document.getElementById('btn-close-journal');
        if (closeBtn) closeBtn.onclick = () => closeModal();
    }

    /* Deletes an entry (Kind 5 or local) and removes its visual representation from the map. */
    async deleteEntry(eventId) {
        const isLocal = String(eventId).startsWith('local_');

        const performDelete = async () => {
            let success = false;

            if (isLocal) {
                try {
                    const drafts = JSON.parse(localStorage.getItem('local_draft_storage') || '[]');
                    const filtered = drafts.filter(d => d.id !== eventId);
                    localStorage.setItem('local_draft_storage', JSON.stringify(filtered));
                    success = true;
                } catch (e) {
                    console.error(e);
                }
            } else {
                if (!AuthManager.canSign()) {
                    showToast("⚠️ Modo solo lectura. No puedes borrar anclas de la red.", "info");
                    return;
                }
                success = await this.nostr.deleteEvent(eventId);
            }

            if (success) {
                const marker = this.map.markers.get(eventId);
                if (marker) {
                    this.map.draftLayer.removeLayer(marker);
                    this.map.publicLayer.removeLayer(marker);
                    this.map.markers.delete(eventId);
                }

                this.entries = this.entries.filter(entry => entry.id !== eventId);
                showToast("🗑️ Eliminado con éxito", "success");

                this.openJournal();
            } else {
                showToast("❌ No se pudo procesar la eliminación", "error");
            }
        };

        openModal(getConfirmModalHTML(
            isLocal ? "¿Quieres borrar este borrador local? Se perderá permanentemente." : "¿Quieres eliminar esta ancla? Esto enviará una solicitud Kind 5 a los relays.",
            performDelete
        ));
    }
}