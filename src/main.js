// main.js - El Director de Orquesta
import { MapManager } from './ui-map.js';
import { NostrService } from './nostr-service.js';
import { GeoLogic } from './geo-utils.js';
import { AuthManager } from './auth.js';
import { ListManager } from './ui-list.js';

// --- CONFIGURACIÓN ---
const RELAYS = ['wss://nos.lol', 'wss://relay.nostr.band', 'wss://relay.damus.io']; /*'wss://relay.snort.social'*/
const ROSARIO_COORDS = [-32.9468, -60.6393];

// --- INICIALIZACIÓN ---
const map = new MapManager('map', ROSARIO_COORDS); 
const nostr = new NostrService(RELAYS);

// 1. Cargar puntos existentes (Suscripción)
function iniciarSuscripcion() {
    nostr.subscribeToAnchors((event) => {
        const name = AuthManager.getDisplayName(event.pubkey);
        
        // 1. Mostrar siempre en la lista (aunque no tenga coordenadas)
        ListManager.addEventToList(event, name);
        
        // 2. Intentar mostrar en el mapa
        const hash = GeoLogic.getHashFromEvent(event);
        if (hash) {
            const { lat, lon } = GeoLogic.decode(hash);
            map.addMarker(event.id, lat, lon, map.createPopupHTML(event, name));
        }
    });
}

// Llamada inicial
iniciarSuscripcion();

// 2. Intentar centrar mapa por GPS al inicio
map.getCurrentLocation()
    .then(pos => map.setView(pos.lat, pos.lon))
    .catch(err => console.warn("Usando ubicación por defecto:", err));

// --- VINCULACIÓN DE BOTONES ---

// Login

document.getElementById('btn-login').addEventListener('click', async () => {
    try {
        await AuthManager.login();
        const pubkey = AuthManager.userPubkey;
        const profile = await nostr.getUserProfile(pubkey);

        const nameEl = document.getElementById('user-name');
        const avatarEl = document.getElementById('user-avatar');
        const statusEl = document.getElementById('user-status');
        const loginBtn = document.getElementById('btn-login');

        if (profile) {
            // 1. Mostrar y actualizar Foto
            if (profile.picture) {
                avatarEl.src = profile.picture;
                avatarEl.style.visibility = 'visible'; // Hacemos visible la foto
            }
            
            // 2. Actualizar Nombre
            nameEl.innerText = profile.display_name || profile.name || "Usuario";
            
            // 3. Mostrar y actualizar Estado
            statusEl.innerText = "● Conectado";
            statusEl.style.display = 'block';
            statusEl.style.color = '#10b981'; // Verde esmeralda
        }

        // 4. Ocultar el botón de login
        loginBtn.style.display = 'none';
        
        iniciarSuscripcion();

    } catch (err) {
        console.error("Error al identificar usuario:", err);
        alert("No se pudo conectar: " + err.message);
    }
});

// Publicar Anclaje

document.getElementById('btn-anchor').addEventListener('click', async () => {
    // 1. Verificar si hay usuario usando el AuthManager
    if (!AuthManager.userPubkey) {
        alert("Debes iniciar sesión primero.");
        return;
    }

    try {
        // 2. Obtener posición (Uso 'map' porque así lo llamaste en la línea 5)
        const pos = await map.getCurrentLocation(); 

        const nombre = document.getElementById('poi-name').value || "Nuevo Punto";
        const desc = document.getElementById('poi-desc').value || "";

        // 3. Crear el objeto de datos para el evento
        const eventData = {
    pubkey: AuthManager.userPubkey,
    content: `${nombre}\n\n${desc}`,
    tags: [
        ["g", GeoLogic.encode(pos.lat, pos.lon)],
        ["t", "spatial_anchor"], // Asegúrate de que no haya espacios extra
        ["location", pos.lat + "," + pos.lon]
    ]
};

        // 4. Publicar (Esto ahora firma y envía correctamente)
        const signedEvent = await nostr.publishAnchor(eventData);
        
        // 5. Dibujar en el mapa inmediatamente
        const name = AuthManager.getDisplayName(signedEvent.pubkey);
        const html = map.createPopupHTML(signedEvent, name);
        map.addMarker(signedEvent.id, pos.lat, pos.lon, html);

        alert("¡Posición anclada con éxito!");

    } catch (err) {
        console.error("Error al anclar:", err);
        alert("Error de GPS o de firma: " + err.message);
    }
});