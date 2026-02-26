import { AuthManager } from './auth.js';
import { store } from './store.js';
import { openModal, closeModal, openJournalModal, closeJournalModal, getJournalModalHTML, getJournalTableRowsHTML, getConfirmModalHTML, showToast } from '../ui/ui-controller.js';

/* JournalManager: Handles the logic for the user's personal logbook, managing both public anchors and drafts. */
export class JournalManager {
    constructor(mapManager, nostrService) {
        this.map = mapManager;
        this.nostr = nostrService;
        this.entries = [];
        this.isSyncing = false;
        this.filters = {
            date: '',
            name: '',
            category: 'all',
            status: 'all'
        };
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

        /* 1. Initial render with current data and filters. */
        this.renderJournal();

        /* 2. Background synchronization. */
        await this.syncJournal();

        /* 3. Re-render only if modal is still open. */
        this.renderJournal();
    }

    /**
     * Filters entries and renders the journal modal.
     */
    renderJournal() {
        // Prepare rows logic below...

        const filtered = this.entries.filter(ev => {
            // 1. Date Filter (matches YYYY-MM-DD)
            const entryDate = new Date(ev.created_at * 1000).toISOString().split('T')[0];
            const matchesDate = !this.filters.date || entryDate === this.filters.date;

            // 2. Name Filter (Lugar)
            const title = (ev.tags.find(t => t[0] === 'title')?.[1] || ev.content || '').toLowerCase();
            const matchesName = !this.filters.name || title.includes(this.filters.name.toLowerCase());

            // 3. Category Filter
            const entryCat = ev.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor')?.[1] || 'all';
            const matchesCategory = this.filters.category === 'all' || entryCat === this.filters.category;

            // 4. Status Filter
            const entryStatus = String(ev.kind);
            const matchesStatus = this.filters.status === 'all' || entryStatus === this.filters.status;

            return matchesDate && matchesName && matchesCategory && matchesStatus;
        });

        const entriesBody = document.getElementById('journal-entries-body');

        if (entriesBody) {
            // Partial Update: Only the rows
            entriesBody.innerHTML = getJournalTableRowsHTML(filtered);
        } else {
            // Full Update: First time or if closed
            const html = getJournalModalHTML(filtered);
            openJournalModal(html);
            this.setupJournalEvents();
        }

        // Update Date Label (always do this as it's outside entriesBody)
        const dateLabel = document.getElementById('journal-filter-date-label');
        if (dateLabel) {
            dateLabel.innerText = this.filters.date ? this.filters.date : 'Todas';
            dateLabel.classList.toggle('text-indigo-600', !!this.filters.date);
        }

        // Only restore filter values if they are out of sync (avoids cursor jumps)
        const nameInput = document.getElementById('journal-filter-name');
        if (nameInput && nameInput.value !== this.filters.name) {
            nameInput.value = this.filters.name;
        }

        const catSelect = document.getElementById('journal-filter-category');
        if (catSelect && catSelect.value !== this.filters.category) {
            catSelect.value = this.filters.category;
        }

        const statusSelect = document.getElementById('journal-filter-status');
        if (statusSelect && statusSelect.value !== this.filters.status) {
            statusSelect.value = this.filters.status;
        }
    }

    /* Sets up the event listeners for the journal modal UI. */
    setupJournalEvents() {
        const closeBtn = document.getElementById('btn-close-journal');
        if (closeBtn) closeBtn.onclick = () => closeJournalModal();

        // Custom Calendar Trigger
        const dateTrigger = document.getElementById('journal-filter-date-trigger');
        if (dateTrigger) {
            dateTrigger.onclick = () => {
                // Collect unique dates where entries exist for indicators
                const entryDates = [...new Set(this.entries.map(ev =>
                    new Date(ev.created_at * 1000).toISOString().split('T')[0]
                ))];

                showCustomCalendar(dateTrigger, this.filters.date, entryDates, (newDate) => {
                    this.filters.date = newDate;
                    this.renderJournal();
                });
            };
        }

        // Name Filter
        const nameInput = document.getElementById('journal-filter-name');
        if (nameInput) {
            nameInput.oninput = (e) => {
                this.filters.name = e.target.value;
                this.renderJournal();
            };
        }

        // Category Filter
        const catSelect = document.getElementById('journal-filter-category');
        if (catSelect) {
            catSelect.onchange = (e) => {
                this.filters.category = e.target.value;
                this.renderJournal();
            };
        }

        // Status Filter
        const statusSelect = document.getElementById('journal-filter-status');
        if (statusSelect) {
            statusSelect.onchange = (e) => {
                this.filters.status = e.target.value;
                this.renderJournal();
            };
        }

        // Clear Filters
        const clearBtn = document.getElementById('journal-clear-filters');
        if (clearBtn) {
            clearBtn.onclick = () => {
                this.filters = {
                    date: '',
                    name: '',
                    category: 'all',
                    status: 'all'
                };
                this.renderJournal();
            };
        }
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

        openJournalModal(getConfirmModalHTML(
            isLocal ? "¿Quieres borrar este borrador local? Se perderá permanentemente." : "¿Quieres eliminar esta ancla? Esto enviará una solicitud Kind 5 a los relays.",
            performDelete
        ));
    }
}