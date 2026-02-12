/* --- 1. IMPORTS --- */
import { MapManager } from './ui-map.js';
import { NostrService } from './nostr-service.js';
import { GeoUtils } from './geo-utils.js';
import { AuthManager } from './auth.js';
import { JournalManager } from './journal-manager.js';

/* Module Controllers */
import { DraftController } from './draft-controller.js';
import { UserActions } from './user-actions.js';
import { initUI, openModal, closeModal } from './ui-controller.js';
import { initFilters } from './filter-controller.js';
import { initSearch } from './search-controller.js';

/* --- 2. CONFIGURATION AND INITIAL STATE --- */
const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']; 
const ROSARIO_COORDS = [-32.9468, -60.6393];
const processedEvents = new Set(); /* Renamed from eventosProcesados */

/* --- 3. CORE SERVICES INSTANTIATION --- */
const map = new MapManager('map', ROSARIO_COORDS); 
window.map = map; /* Global reference for Leaflet */

const nostr = new NostrService(RELAYS);
const journal = new JournalManager(map, nostr);

/* --- 4. NETWORK ORCHESTRATION (NOSTR) --- */
function startSubscription() {
    nostr.subscribeToAnchors(async (event) => {
        if (processedEvents.has(event.id)) return;
        processedEvents.add(event.id);

        const geoData = GeoUtils.getHashFromEvent(event);
        if (!geoData) return;

        const profile = await nostr.getUserProfile(event.pubkey);
        
        let lat, lng;
        if (geoData.isRaw) {
            lat = geoData.lat;
            lng = geoData.lon;
        } else {
            const decoded = GeoUtils.decode(geoData);
            lat = decoded.lat;
            lng = decoded.lon;
        }

        const category = event.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor')?.[1] || 'all';
        const popupHTML = map.createPopupHTML(event, profile, category, false);
        
        map.addMarker(event.id, lat, lng, popupHTML, category, 'public');
    });
}

/* --- 5. INITIALIZATION BOOTSTRAP --- */
document.addEventListener('DOMContentLoaded', async () => {
    initUI();
    initFilters(map);
    initSearch(map);
    
    /* Login check and journal sync */
    if (await AuthManager.isLoggedIn()) {
        await journal.syncJournal(); /* Updated to new name in JournalManager */
    }
    
    startSubscription(); /* Updated to new name */
});

/* --- 6. GLOBAL INTERFACE BRIDGES (Exposed to window for onclick) --- */

/* Function to center map and open a specific anchor popup */
window.centerMapAndOpenPopup = (eventId, lat, lng) => {
    closeModal(); 
    map.map.flyTo([lat, lng], 18, { animate: true, duration: 1.5 });

    const onMoveEnd = () => {
        setTimeout(() => {
            const marker = map.markers.get(eventId);
            if (marker) {
                marker.openPopup();
            }
            map.map.off('moveend', onMoveEnd);
        }, 100);
    };

    map.map.on('moveend', onMoveEnd);
};

/* Bridge for Review Modal */
window.openReviewModal = (lat, lng) => {
    DraftController.openReviewModal(lat, lng, map, nostr, journal);
};

/* Bridge for Draft Modal */
window.openDraftModal = (lat, lng) => {
    DraftController.openDraftModal(lat, lng, map, nostr, journal);
};

/* Bridge for Journal Modal */
window.fetchAndShowJournal = () => {
    journal.openJournal();
};

/* Bridge for Deleting entries */
window.deleteEntry = (eventId) => {
    journal.deleteEntry(eventId);
};

/* Bridge for Completing/Publishing anchors from drafts */
window.completeAnchor = (eventId) => {
    const entry = journal.entries.find(e => e.id === eventId); /* Updated from drafts to entries */
    if (entry) {
        const coords = entry.tags.find(t => t[0] === 'g')?.[1];
        if (coords) {
            const [lat, lng] = coords.split(',').map(Number);
            DraftController.openPublishModal(eventId, lat, lng, map, nostr, journal);
        }
    }
};

/* Bridge for Follow logic */
window.followUser = (pubkey, name) => {
    UserActions.followUser(pubkey, name);
};

/* Bridge for Zap logic */
window.zapUser = (pubkey, name, title) => {
    UserActions.zapUser(pubkey, name, title);
};

/* Bridge for Deleting public anchors (Kind 5) */
window.deleteAnchor = (eventId) => {
    UserActions.deleteAnchor(eventId, map, nostr, processedEvents);
};

/* --- 7. DIRECT MAP EVENTS --- */

/* Double click to add markers */
map.map.on('dblclick', (e) => {
    if (!AuthManager.isLoggedIn()) {
        window.showToast("🔑 Log in to add new points", "error");
        return;
    }
    const { lat, lng } = e.latlng;
    map.map.setView([lat, lng], map.map.getZoom());
    
    L.popup()
        .setLatLng([lat, lng])
        .setContent(`
            <div class="pop-decision-container">
                <strong>📍 Location Confirmed</strong>
                <p>How do you want to register this spot?</p>
                <div class="pop-btn-grid">
                    <button onclick="window.openReviewModal(${lat}, ${lng})" class="btn-pop-resena">📝 Review</button>
                    <button onclick="window.openDraftModal(${lat}, ${lng})" class="btn-pop-draft">💾 Draft</button>
                </div>
            </div>
        `, { closeButton: false, offset: [0, -10] }).openPopup();
        window.showToast("📍 Spot detected. Define your entry.", "success");
});

/* Rapid Geolocation Button */
document.getElementById('btn-locate-me').onclick = async (e) => {
    e.stopPropagation();
    const icon = e.currentTarget.querySelector('i');
    icon.className = "fas fa-spinner fa-spin"; 
    try {
        const pos = await map.getCurrentLocation();
        map.setView(pos.lat, pos.lon, 16);
        window.showToast("📍 Location updated", "success");
    } catch (err) {
        window.showToast("📍 Error getting location", "error");
    } finally {
        icon.className = "fas fa-crosshairs";
    }
};

/* Popup authorship verification */
map.map.on('popupopen', (e) => {
    const container = e.popup._contentNode.querySelector('.popup-container');
    if (container) {
        const entryPubkey = container.getAttribute('data-pubkey');
        
        /* ✅ CORRECCIÓN: Buscamos el botón por la clase 'owner-only' que definimos en ui-map.js */
        const deleteBtn = container.querySelector('.btn-delete.owner-only');
        
        /* Si el pubkey del evento coincide con el del usuario logueado, mostramos el botón */
        if (deleteBtn && AuthManager.isLoggedIn() && AuthManager.userPubkey === entryPubkey) {
            deleteBtn.style.display = 'flex';
        }
    }
});