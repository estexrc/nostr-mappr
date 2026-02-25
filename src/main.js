/* --- 1. IMPORTS --- */
import { AppController } from './core/app-controller.js';
import { store } from './core/store.js';

/* Module Controllers */
import { DraftController } from './features/drafts/draft-controller.js';
import { UserActions } from './features/user/user-actions.js';
import { AuthManager } from './core/auth.js';

/* --- 2. BOOTSTRAP --- */
const app = new AppController();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

window.clearTemporalPin = () => {
    DraftController.clearTemporalPin();
    app.map.map.closePopup();
};

window.openReviewModal = (lat, lng) => {
    DraftController.openReviewModal(lat, lng, app.map, app.nostr, app.journal);
};

window.openDraftModal = (lat, lng) => {
    DraftController.openDraftModal(lat, lng, app.map, app.nostr, app.journal);
};

/* --- 3. GLOBAL INTERFACE BRIDGES (Legacy Compatibility) --- */

window.centerMapAndOpenPopup = (eventId, lat, lng) => {
    import('./ui/ui-controller.js').then(ui => ui.closeModal());
    app.map.map.flyTo([lat, lng], 18, { animate: true, duration: 1.5 });

    const onMoveEnd = () => {
        setTimeout(() => {
            const marker = app.map.markers.get(eventId);
            if (marker) marker.openPopup();
            app.map.map.off('moveend', onMoveEnd);
        }, 100);
    };

    app.map.map.on('moveend', onMoveEnd);
};

window.openReviewModal = (lat, lng) => {
    DraftController.openReviewModal(lat, lng, app.map, app.nostr, app.journal);
};

window.openDraftModal = (lat, lng) => {
    DraftController.openDraftModal(lat, lng, app.map, app.nostr, app.journal);
};

window.fetchAndShowJournal = () => {
    app.journal.openJournal();
};

window.deleteEntry = (eventId) => {
    app.journal.deleteEntry(eventId);
};

window.completeAnchor = (eventId) => {
    const entry = app.journal.entries.find(e => e.id === eventId);
    if (entry) {
        const coords = entry.tags.find(t => t[0] === 'g')?.[1];
        if (coords) {
            const [lat, lng] = coords.split(',').map(Number);
            DraftController.openPublishModal(eventId, lat, lng, app.map, app.nostr, app.journal);
        }
    }
};

window.followUser = (pubkey, name) => {
    UserActions.followUser(pubkey, name);
};

window.zapUser = (pubkey, name, title) => {
    UserActions.zapUser(pubkey, name, title);
};

window.deleteAnchor = (eventId) => {
    UserActions.deleteAnchor(eventId, app.map, app.nostr, store.state.processedEvents);
};

window.showFullDescription = (eventId) => {
    if (eventId === 'profile') {
        const profile = AuthManager.profileCache[AuthManager.userPubkey];
        if (!profile) return;
        import('./ui/ui-controller.js').then(ui => {
            ui.openModal(ui.getDescriptionModalHTML("Sobre mí", profile.about));
        });
        return;
    }

    const marker = app.map.markers.get(eventId);
    if (!marker) return;

    // Fetch from store
    const event = Array.from(app.journal.entries).find(e => e.id === eventId) ||
        { content: "Contenido no disponible en caché", tags: [] };

    const parts = event.content.split('\n\n');
    const fullTitle = (event.tags.find(t => t[0] === 'title')?.[1] || parts[0] || "Punto de Interés");
    const fullDesc = parts.slice(1).join('\n\n') || parts[0];

    import('./ui/ui-controller.js').then(ui => {
        ui.openModal(ui.getDescriptionModalHTML(fullTitle, fullDesc));
    });
};

/* --- 4. DIRECT DOM EVENTS (Buttons) --- */

document.getElementById('btn-quick-pop').onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!AuthManager.isLoggedIn()) {
        import('./ui/ui-controller.js').then(ui => ui.showToast("Inicia sesión para agregar puntos", "error"));
        return;
    }

    const btn = e.currentTarget;
    const icon = btn.querySelector('.material-symbols-rounded');
    const originalIcon = icon.textContent;
    icon.textContent = "progress_activity";
    icon.classList.add('animate-spin');

    try {
        // Zero Latency: Use last known location from VM
        const pos = store.state.currentLocation || await app.map.getCurrentLocation();
        const lat = Number(pos.lat || pos.latitude);
        const lng = Number(pos.lon || pos.longitude);

        app.map.map.setView([lat, lng], 18);
        const isReadOnly = !AuthManager.canSign();

        // Create instant decision popup
        const decisionPopupHTML = `
            <div class="pop-decision-container p-4 flex flex-col gap-4 min-w-[200px] animate-fade-slide">
                <div class="text-center">
                    <div class="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                        <span class="material-symbols-rounded text-brand text-[22px]" style="font-variation-settings:'FILL' 1">location_on</span>
                    </div>
                    <h3 class="text-[14px] font-heading text-slate-900 leading-tight">Ubicación Confirmada</h3>
                    <p class="font-label text-slate-400 mt-1">Selecciona el tipo de registro</p>
                </div>
                <div class="flex flex-col gap-2.5">
                    <button onclick="window.openReviewModal(${lat}, ${lng})" 
                            class="w-full py-2.5 bg-brand text-white rounded-xl font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-indigo-500/20 btn-hover-effect flex items-center justify-center gap-2">
                        <span class="material-symbols-rounded text-[18px]">edit_note</span>
                        <span>${isReadOnly ? 'BORRADOR LOCAL' : 'RESEÑA DIRECTA'}</span>
                    </button>
                    ${!isReadOnly ? `
                        <button onclick="window.openDraftModal(${lat}, ${lng})" 
                                class="w-full py-2.5 glass text-slate-700 rounded-xl font-bold text-[11px] uppercase tracking-wider btn-hover-effect flex items-center justify-center gap-2">
                            <span class="material-symbols-rounded text-[18px]">save_as</span>
                            <span>GUARDAR BORRADOR</span>
                        </button>
                    ` : ''}
                </div>
                ${isReadOnly ? '<p class="text-[10px] text-amber-600 font-bold text-center bg-amber-50 py-1.5 rounded-lg border border-amber-100/50">👁️ Modo Solo Lectura</p>' : ''}
                <button onclick="window.clearTemporalPin()" class="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 mt-1 text-center w-full">Cancelar</button>
            </div>
        `;

        // Update VM to trigger instant marker
        store.setState({
            temporalPin: { id: 'temp-pop', lat, lon: lng, type: 'pop', popupHTML: decisionPopupHTML }
        });

    } catch (err) {
        console.error("PoP Error:", err);
    } finally {
        icon.textContent = originalIcon;
        icon.classList.remove('animate-spin');
    }
};

document.getElementById('btn-locate-me').onclick = async (e) => {
    e.stopPropagation();
    const icon = e.currentTarget.querySelector('.material-symbols-rounded');
    app.map.clearSearchSelection();
    const originalIcon = icon.textContent;
    icon.textContent = "progress_activity";
    icon.classList.add('animate-spin');

    try {
        // Zero Latency: Use last known location from VM
        const pos = store.state.currentLocation || await app.map.getCurrentLocation();
        const lat = Number(pos.lat || pos.latitude);
        const lng = Number(pos.lon || pos.longitude);

        app.map.setView(lat, lng, 16);

        // Show instant "You are here" (Optional, can be removed if user wants absolute zero pins)
        store.setState({
            temporalPin: {
                id: 'temp-pop',
                lat,
                lon: lng,
                type: 'pop',
                popupHTML: `
                    <div class="popup-minimal text-center">
                        <div class="font-bold text-slate-800 flex items-center gap-1 justify-center">
                            <span class="text-[12px]">📍</span>
                            <span class="text-[12px]">Estás aquí</span>
                        </div>
                    </div>
                `
            }
        });

    } catch (err) {
        console.error("Locate error:", err);
    } finally {
        icon.textContent = originalIcon;
        icon.classList.remove('animate-spin');
    }
};