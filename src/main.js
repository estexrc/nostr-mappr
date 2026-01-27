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
window.map = map;
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
        let profile = AuthManager.profileCache[event.pubkey];
        
        if (!profile) {
            profile = await nostr.getUserProfile(event.pubkey);
            if (profile) AuthManager.saveProfile(event.pubkey, profile);
        }

        const name = AuthManager.getDisplayName(event.pubkey);

        const hash = GeoLogic.getHashFromEvent(event);
        if (hash) {
            const { lat, lon } = GeoLogic.decode(hash);
            const tagCat = event.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor');
            const categoriaEvento = tagCat ? tagCat[1] : 'todos';
            const popupHTML = map.createPopupHTML(event, profile, categoriaEvento);
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

        const currentProfile = AuthManager.profileCache[signedEvent.pubkey];
        const html = map.createPopupHTML(signedEvent, currentProfile, categoria);
        map.addMarker(signedEvent.id, pos.lat, pos.lon, html, categoria);
        
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

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('btn-search');
const btnClear = document.getElementById('btn-clear-search');


async function ejecutarBusqueda() {
    const query = searchInput.value.trim();
    if (!query) return;

    try {
        // Usamos el método que ya tienes en ui-map.js
        await map.searchAddress(query);
        console.log(`Búsqueda exitosa: ${query}`);
    } catch (err) {
        alert("📍 Lo sentimos, no pudimos encontrar esa dirección.");
    }
}

// Buscar al hacer clic en la lupa
searchBtn.onclick = ejecutarBusqueda;

// Buscar al presionar "Enter" en el teclado
searchInput.onkeypress = (e) => {
    if (e.key === 'Enter') ejecutarBusqueda();
};

// Acción de limpiar
btnClear.addEventListener('click', () => {
    // Limpiar el campo de texto
    searchInput.value = '';
    btnClear.style.display = 'none';

    // Llamar a la limpieza profunda del mapa
    if (window.map && typeof window.map.clearSearchSelection === 'function') {
        window.map.clearSearchSelection();
    }

    searchInput.focus();
});

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
        icon.className = "fas fa-location-arrow";
    }
};

const scrollRight = document.getElementById('btn-scroll-right');
const scrollLeft = document.getElementById('btn-scroll-left');
const filterBar = document.getElementById('filter-bar-container');

if (filterBar) {
    // Función para mover a la derecha
    scrollRight.onclick = () => filterBar.scrollBy({ left: 240, behavior: 'smooth' });

    // Función para mover a la izquierda
    scrollLeft.onclick = () => filterBar.scrollBy({ left: -240, behavior: 'smooth' });

    // Control de visibilidad de flechas
    filterBar.onscroll = () => {
        const scrollPos = filterBar.scrollLeft;
        const maxScroll = filterBar.scrollWidth - filterBar.clientWidth;

        // Mostrar/Ocultar Izquierda: Si nos movimos más de 10px del inicio
        scrollLeft.style.opacity = scrollPos > 10 ? "1" : "0";
        scrollLeft.style.pointerEvents = scrollPos > 10 ? "auto" : "none";

        // Mostrar/Ocultar Derecha: Si faltan más de 10px para llegar al final
        scrollRight.style.opacity = scrollPos < maxScroll - 10 ? "1" : "0";
        scrollRight.style.pointerEvents = scrollPos < maxScroll - 10 ? "auto" : "none";
    };
}


// Mostrar/ocultar la X según el contenido del input
searchInput.addEventListener('input', () => {
    btnClear.style.display = searchInput.value.length > 0 ? 'block' : 'none';
});

