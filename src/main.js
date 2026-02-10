
// --- 1. IMPORTACIONES (Suministros) ---
import { MapManager } from './ui-map.js';
import { NostrService } from './nostr-service.js';
import { GeoLogic } from './geo-utils.js';
import { AuthManager } from './auth.js';
import { JournalManager } from './journal-manager.js';

// Controladores de Módulos
import { DraftController } from './draft-controller.js';
import { UserActions } from './user-actions.js';
import { initUI, openModal, closeModal } from './ui-controller.js';
import { initFilters } from './filter-controller.js';
import { initAnchor } from './anchor-controller.js';
import { initSearch } from './search-controller.js';

// --- 2. CONFIGURACIÓN Y ESTADO INICIAL ---
const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']; 
const ROSARIO_COORDS = [-32.9468, -60.6393];
const eventosProcesados = new Set(); // Cache para evitar duplicados en el mapa

// --- 3. INSTANCIACIÓN DE SERVICIOS NÚCLEO ---
const map = new MapManager('map', ROSARIO_COORDS); 
window.map = map; // Referencia global necesaria para Leaflet

const nostr = new NostrService(RELAYS);
const journal = new JournalManager(map, nostr);

// --- 4. ORQUESTACIÓN DE RED (NOSTR) ---
function iniciarSuscripcion() {
    nostr.subscribeToAnchors(async (event) => {
        if (eventosProcesados.has(event.id)) return;
        eventosProcesados.add(event.id);

        const hash = GeoLogic.getHashFromEvent(event);
        if (hash) {
            const { lat, lon } = GeoLogic.decode(hash);
            const profile = AuthManager.profileCache[event.pubkey] || null;
            
            // Identificación de categoría
            const tagCat = event.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor');
            const categoriaEvento = tagCat ? tagCat[1] : 'todos';

            const popupHTML = map.createPopupHTML(event, profile, categoriaEvento);
            map.addMarker(event.id, lat, lon, popupHTML, categoriaEvento);
        }
    });
}

// --- 5. INICIALIZACIÓN DE CONTROLADORES DE INTERFAZ ---
initSearch(map);
initFilters(map);
initAnchor(map, nostr);
initUI(nostr);

// Sincronización de datos iniciales
iniciarSuscripcion();
journal.syncDrafts();

// Posicionamiento inicial por GPS
map.getCurrentLocation()
    .then(pos => map.setView(pos.lat, pos.lon))
    .catch(err => console.warn("Usando ubicación por defecto:", err));

// --- 6. PUENTES GLOBALIZADOS (Window API) ---
// Estos puentes permiten que el HTML y ui-controller invoquen lógica modular

// Gestión del Diario
window.fetchAndShowJournal = () => journal.openJournal();
window.deleteDraft = (id) => journal.deleteDraft(id);
window.syncDrafts = () => journal.syncDrafts();
window.centerMapAndHighlight = (lat, lng) => {
    closeModal(); 
    window.map.setView(lat, lng, 16); 
    if (window.tempHighlightMarker) {
        window.map.map.removeLayer(window.tempHighlightMarker);
        window.tempHighlightMarker = null;
    }
};

// Acciones Sociales
window.followUser = (pubkey, name) => UserActions.followUser(pubkey, name);
window.zapUser = (pubkey, name, titulo) => UserActions.zapUser(pubkey, name, titulo);
window.borrarPunto = (eventId) => UserActions.borrarPunto(eventId, map, nostr);

// Flujos de Anclaje y Publicación
window.openDraftModal = (lat, lng) => DraftController.openDraftModal(lat, lng, map, nostr, journal);
window.openReviewModal = (lat, lng) => DraftController.openReviewModal(lat, lng, map, nostr, journal);
window.completeAnchor = (eventId) => {
    const marker = map.markers.get(eventId);
    if (!marker) return;
    const { lat, lng } = marker.getLatLng();
    DraftController.openPublishModal(eventId, lat, lng, map, nostr, journal);
};
// --- 7. EVENTOS DE MAPA Y UX ---

// Lógica de "Point of Presence" (PoP)
window.addEventListener('trigger-pop', (e) => {
    const { lat, lng } = e.detail;
    window.map.setView(lat, lng, 18);
    if (window.tempPoPMarker) window.map.map.removeLayer(window.tempPoPMarker);

    window.tempPoPMarker = L.marker([lat, lng], {
        icon: window.map._createIcon('temp') 
    }).addTo(window.map.map);

    window.tempPoPMarker.bindPopup(`
        <div class="pop-decision-container">
            <strong>📍 Ubicación Confirmada</strong>
            <p>¿Cómo quieres registrar este punto?</p>
            <div class="pop-btn-grid">
                <button onclick="window.openReviewModal(${lat}, ${lng})" class="btn-pop-resena">📝 Review</button>
                <button onclick="window.openDraftModal(${lat}, ${lng})" class="btn-pop-draft">💾 Draft</button>
            </div>
        </div>
    `, { closeButton: false, offset: [0, -10] }).openPopup();
});

// Botón de geolocalización rápida
document.getElementById('btn-locate-me').onclick = async (e) => {
    e.stopPropagation();
    const icon = e.currentTarget.querySelector('i');
    icon.className = "fas fa-spinner fa-spin"; 
    try {
        const pos = await map.getCurrentLocation();
        map.setView(pos.lat, pos.lon, 16);
    } catch (err) {
        alert("📍 Error al obtener ubicación");
    } finally {
        icon.className = "fas fa-crosshairs";
    }
};

// Verificación de autoría en Popups
map.map.on('popupopen', (e) => {
    const container = e.popup._contentNode.querySelector('.popup-container');
    if (container) {
        const pubkeyPunto = container.getAttribute('data-pubkey');
        if (AuthManager.userPubkey === pubkeyPunto) {
            container.classList.add('is-owner');
        }
    }
});