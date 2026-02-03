// main.js - El Director de Orquesta
import { MapManager } from './ui-map.js';
import { NostrService } from './nostr-service.js';
import { GeoLogic } from './geo-utils.js';
import { AuthManager } from './auth.js';
import { initUI } from './ui-controller.js';
import { initFilters } from './filter-controller.js';
import { initAnchor } from './anchor-controller.js';
import { initSearch } from './search-controller.js';

// --- CONFIGURACIÓN ---
const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']; 
const ROSARIO_COORDS = [-32.9468, -60.6393];


// --- SESIÓN DE USUARIO ---
const sessionActive = AuthManager.isLoggedIn(); 
if (sessionActive) console.log("🔐 Sesión recuperada:", AuthManager.userPubkey);

// --- INICIALIZACIÓN ---
const map = new MapManager('map', ROSARIO_COORDS); 
window.map = map;

initSearch(map);
initFilters(map);

const nostr = new NostrService(RELAYS);

initAnchor(map, nostr);

// Cargar puntos existentes
const eventosProcesados = new Set();

function iniciarSuscripcion() {
    nostr.subscribeToAnchors(async (event) => {
        
        if (eventosProcesados.has(event.id)) return;
        eventosProcesados.add(event.id);

        const name = AuthManager.getDisplayName(event.pubkey);

        const hash = GeoLogic.getHashFromEvent(event);
        if (hash) {
            const { lat, lon } = GeoLogic.decode(hash);
            const tagCat = event.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor');
            const categoriaEvento = tagCat ? tagCat[1] : 'todos';
            const popupHTML = map.createPopupHTML(event, null, categoriaEvento);
            map.addMarker(event.id, lat, lon, popupHTML, categoriaEvento);
        }
    });
}

// Llamada inicial
iniciarSuscripcion();

// centrar mapa por GPS al inicio
map.getCurrentLocation()
    .then(pos => map.setView(pos.lat, pos.lon))
    .catch(err => console.warn("Usando ubicación por defecto:", err));


initUI(nostr);


window.followUser = async (pubkey, name) => {
    // 1. Verificamos si el usuario está logueado
    if (!AuthManager.userPubkey) {
        alert("¡Hola! Necesitas iniciar sesión para seguir a otros usuarios.");
        return;
    }

    if (pubkey === AuthManager.userPubkey) {
        alert("¡Ese eres tú! No puedes seguirte a ti mismo (aún).");
        return;
    }

    console.log(`✅ Siguiendo a ${name} (${pubkey})`);
    alert(`Próximamente: Siguiendo a ${name} en la red Nostr`);
};

window.zapUser = (pubkey, name, titulo) => {
    if (!AuthManager.userPubkey) {
        alert("Debes estar conectado para enviar Zaps.");
        return;
    }

    console.log(`⚡ Zap iniciado para ${name} por: ${titulo}`);
    alert(`⚡ Próximamente: Enviando sats a ${name} por recomendar "${titulo}"`);
};

document.getElementById('btn-locate-me').onclick = async (e) => {
    e.stopPropagation();
    const btn = document.getElementById('btn-locate-me');
    const icon = btn.querySelector('i');
    
    // Cambiamos el icono por uno de carga
    icon.className = "fas fa-spinner fa-spin"; 
    
    try {
        const pos = await map.getCurrentLocation();
        map.setView(pos.lat, pos.lon, 16);
    } catch (err) {
        alert("📍 Error al obtener ubicación");
    } finally {
        // Restauramos el icono original
        icon.className = "fas fa-crosshairs";
    }
};

map.map.on('popupopen', (e) => {
    // Obtenemos el contenedor del popup recién abierto
    const container = e.popup._contentNode.querySelector('.popup-container');
    if (container) {
        const pubkeyPunto = container.getAttribute('data-pubkey');
        const miPubkey = window.userPubkey || AuthManager.userPubkey; // Doble verificación

        if (miPubkey && miPubkey === pubkeyPunto) {
            container.classList.add('is-owner');
        }
    }
});

window.borrarPunto = async (eventId) => {
    // 1. Confirmación de seguridad
    if (!confirm("¿Deseas eliminar permanentemente este anclaje de la red Nostr?")) return;

    console.log(`🗑️ Intentando borrar evento: ${eventId}`);

    try {
        // 2. Llamamos al servicio de Nostr para firmar el borrado (Kind 5)
        const exito = await nostr.deleteEvent(eventId); 

        if (exito) {
            // 3. Si tuvo éxito, lo eliminamos visualmente del mapa
            const marcador = map.markers.get(eventId);
            if (marcador) {
                map.map.removeLayer(marcador);
                map.markers.delete(eventId);
            }
            
            // 4. Lo quitamos de nuestra lista de control interna
            if (typeof eventosProcesados !== 'undefined') {
                eventosProcesados.delete(eventId);
            }
            
            alert("✅ Solicitud de borrado enviada con éxito.");
        } else {
            alert("❌ Hubo un problema al procesar el borrado.");
        }
    } catch (err) {
        console.error("Error en el proceso de borrado:", err);
        alert("Ocurrió un error inesperado al intentar borrar.");
    }
};

window.addEventListener('trigger-pop', (e) => {
    const { lat, lng } = e.detail;

    // Centramos el mapa en el usuario para que vea su marcador
    window.map.setView(lat, lng, 18);

    if (window.tempPoPMarker) window.map.map.removeLayer(window.tempPoPMarker);

    // El marcador ahora es FIJO (draggable: false) para asegurar presencia
    window.tempPoPMarker = L.marker([lat, lng], {
        draggable: false, 
        icon: L.divIcon({
            className: 'pop-temp-marker',
            html: '<i class="fas fa-thumbtack" style="color: #8e44ad; font-size: 30px;"></i>',
            iconAnchor: [15, 30]
        })
    }).addTo(window.map.map);

    window.tempPoPMarker.bindPopup(`
    <div class="pop-decision-container">
        <strong>📍 Ubicación Confirmada</strong>
        <p>Estás aquí. ¿Cómo quieres registrar este punto?</p>
        <div class="pop-btn-grid">
            <button onclick="window.abrirModalResena(${lat}, ${lng})" class="btn-pop-resena">
                📝 Reseña
            </button>
            <button onclick="window.abrirModalBorrador(${lat}, ${lng})" class="btn-pop-draft">
                💾 Borrador
            </button>
        </div>
    </div>
`, { closeButton: false, offset: [0, -10] }).openPopup();
});

window.abrirModalResena = (lat, lng) => {
    alert(`Abriendo formulario de reseña para: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
};

window.abrirModalBorrador = (lat, lng) => {
    // Aquí llamaremos al modal de "Anclaje Provisorio" que diseñaremos a continuación
    alert("Guardando como borrador rápido...");
};