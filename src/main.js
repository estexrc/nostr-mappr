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
    const icon = btn.querySelector('i');
    const originalClass = "fas fa-map-pin";

    icon.className = "fas fa-spinner fa-spin";

    try {
        const pos = await app.map.getCurrentLocation();
        const lat = Number(pos.lat);
        const lng = Number(pos.lon);

        app.map.map.setView([lat, lng], 18);
        const tempMarker = app.map.addMarker('temp-pop', lat, lng, '', 'none', 'temp');

        const isReadOnly = !AuthManager.canSign();

        tempMarker.bindPopup(`
            <div class="pop-decision-container p-2 flex flex-col gap-3 min-w-[180px]">
                <div class="text-center">
                    <strong class="text-slate-900 font-black block">📍 Ubicación Confirmada</strong>
                    <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">¿Cómo quieres registrarla?</p>
                </div>
                <div class="grid grid-cols-1 gap-2">
                    <button onclick="window.openReviewModal(${lat}, ${lng})" 
                            class="py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 ring-2 ring-white">
                        ${isReadOnly ? '📝 BORRADOR LOCAL' : '📝 RESEÑA DIRECTA'}
                    </button>
                    ${!isReadOnly ? `
                        <button onclick="window.openDraftModal(${lat}, ${lng})" 
                                class="py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-black text-[10px] uppercase tracking-widest">
                            💾 GUARDAR BORRADOR
                        </button>
                    ` : ''}
                </div>
                ${isReadOnly ? '<p class="text-[9px] text-amber-600 font-bold text-center">👁️ Estás en modo solo lectura</p>' : ''}
            </div>
        `, { closeButton: true, offset: [0, -10], closeOnClick: true }).openPopup();

    } catch (err) {
        console.error("PoP Error:", err);
    } finally {
        icon.className = originalClass;
    }
};

document.getElementById('btn-locate-me').onclick = async (e) => {
    e.stopPropagation();
    const icon = e.currentTarget.querySelector('i');
    app.map.clearSearchSelection();
    icon.className = "fas fa-spinner fa-spin";

    try {
        const pos = await app.map.getCurrentLocation();
        app.map.setView(pos.lat, pos.lon, 16);
        app.map.addMarker('temp-pop', pos.lat, pos.lon, '', 'none', 'temp').bindPopup('📍 You are here').openPopup();
    } catch (err) {
        console.error("Locate error:", err);
    } finally {
        icon.className = "fas fa-crosshairs";
    }
};