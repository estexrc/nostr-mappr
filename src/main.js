// main.js - El Director de Orquesta
import { MapManager } from './ui-map.js';
import { NostrService } from './nostr-service.js';
import { GeoLogic } from './geo-utils.js';
import { AuthManager } from './auth.js';
import { initUI } from './ui-controller.js';
import { CATEGORIAS } from './categories.js';

// --- CONFIGURACIÓN ---
const RELAYS = ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']; 
const ROSARIO_COORDS = [-32.9468, -60.6393];

// --- INICIALIZACIÓN ---
const map = new MapManager('map', ROSARIO_COORDS); 
const nostr = new NostrService(RELAYS);
const filterContainer = document.getElementById('filter-bar-container');
const categorySelect = document.getElementById('poi-category');

// 2. Renderizar Chips y Opciones de Select
if (filterContainer && categorySelect) {
    CATEGORIAS.forEach(cat => {
        // A) Crear botones de filtro (Barra superior estilo Google Maps)
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.textContent = cat.label;
        
        // Al hacer clic, marcamos el filtro como activo visualmente
        chip.onclick = () => {
            toggleFilter(cat.id, chip);
        };
        filterContainer.appendChild(chip);

        // B) Crear opciones en el formulario (Selector obligatorio)
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.label;
        categorySelect.appendChild(option);
    });
}

// Cargar puntos existentes

function iniciarSuscripcion() {
    nostr.subscribeToAnchors(async (event) => {
        // 1. Intentar obtener el perfil completo (Foto, Nombre real, etc.)
        let profile = AuthManager.profileCache[event.pubkey];
        
        if (!profile) {
            profile = await nostr.getUserProfile(event.pubkey);
            if (profile) AuthManager.saveProfile(event.pubkey, profile);
        }

        const name = AuthManager.getDisplayName(event.pubkey);

        const hash = GeoLogic.getHashFromEvent(event);
        if (hash) {
            const { lat, lon } = GeoLogic.decode(hash);
            const popupHTML = map.createPopupHTML(event, profile);
            const tagCat = event.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor');
            const categoriaEvento = tagCat ? tagCat[1] : 'todos';
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

// --- VINCULACIÓN DE BOTONES ---

initUI(nostr, iniciarSuscripcion);

// Publicar Anclaje

document.getElementById('btn-anchor').addEventListener('click', async () => {
    if (!AuthManager.userPubkey) {
        alert("Debes iniciar sesión primero.");
        return;
    }

    const categoria = categorySelect.value;
    if (!categoria) {
    alert("⚠️ Por favor, selecciona una categoría para clasificar este punto.");
    categorySelect.focus();
    return;
}

    try {
        const pos = await map.getCurrentLocation(); 
        const nombre = document.getElementById('poi-name').value || "Nuevo Punto";
        const desc = document.getElementById('poi-desc').value || "";

        const eventData = {
    pubkey: AuthManager.userPubkey,
    content: `${nombre}\n\n${desc}`,
    tags: [
        ["g", GeoLogic.encode(pos.lat, pos.lon)],
        ["t", "spatial_anchor"],
        ["t", categoria],            // Tag de categoría (ej: 'gastronomia')
        ["l", "category", categoria], // NIP-32 Label
        ["location", pos.lat + "," + pos.lon]
    ]
};

        const signedEvent = await nostr.publishAnchor(eventData);
        
        const name = AuthManager.getDisplayName(signedEvent.pubkey);
        const html = map.createPopupHTML(signedEvent, name);
        map.addMarker(signedEvent.id, pos.lat, pos.lon, html);
        
    document.getElementById('poi-name').value = '';
    document.getElementById('poi-desc').value = '';
        
            alert("¡Posición anclada con éxito!");

    } catch (err) {
        console.error("Error al anclar:", err);
        alert("Error de GPS o de firma: " + err.message);
    }
});


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

function toggleFilter(id, element) {
    const yaEstabaActivo = element.classList.contains('active');

    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));

    const filtroAAplicar = yaEstabaActivo ? 'todos' : id;

    if (!yaEstabaActivo) {
        element.classList.add('active');
    }

    map.markers.forEach((marker) => {
        const catMarcador = String(marker.categoria).toLowerCase().trim();
        const catFiltro = String(filtroAAplicar).toLowerCase().trim();

        if (catFiltro === 'todos' || catMarcador === catFiltro) {
            marker.addTo(map.map);
        } else {
            marker.remove();
        }
    });
}