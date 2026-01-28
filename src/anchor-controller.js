
import { GeoLogic } from './geo-utils.js';
import { CATEGORIAS } from './categories.js';
import { AuthManager } from './auth.js';

export function initAnchor(mapManager, nostrService) {
    const categorySelect = document.getElementById('poi-category');
    const btnAnchor = document.getElementById('btn-anchor');
    const debugToggle = document.getElementById('debug-mode-toggle');

    if (!categorySelect || !btnAnchor) return;

    // 1. Poblamos el selector
    CATEGORIAS.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.label;
        categorySelect.appendChild(option);
    });

    // 2. Lógica Unificada
    btnAnchor.onclick = async () => {
        const categoria = categorySelect.value;
        if (!categoria) {
            alert("⚠️ Selecciona una categoría.");
            return;
        }

        const isDebug = debugToggle?.checked; // ¿Está activo el modo prueba?

        try {
            const pos = await mapManager.getCurrentLocation();
            const nombre = document.getElementById('poi-name').value || "Punto";
            const desc = document.getElementById('poi-desc').value || "";

            if (isDebug) {
                // --- MODO PRUEBA (Volátil) ---
                const mockEvent = {
                    id: "test-" + Date.now(),
                    pubkey: AuthManager.userPubkey || "00000000",
                    content: `${nombre}\n\n${desc}`,
                    tags: [["t", categoria], ["t", "spatial_anchor"]]
                };
                ejecutarAnclajeVisual(mockEvent, pos, categoria, mapManager);
                console.log("🧪 Anclaje de prueba creado localmente.");
            } else {
                // --- MODO REAL (Nostr) ---
                if (!AuthManager.userPubkey) {
                    alert("Debes iniciar sesión para publicar en Nostr.");
                    return;
                }
                
                const eventData = {
                    pubkey: AuthManager.userPubkey,
                    content: `${nombre}\n\n${desc}`,
                    tags: [
                        ["g", GeoLogic.encode(pos.lat, pos.lon)], // Geohash
                        ["t", "spatial_anchor"],                         // Identificador de la app
                        ["t", categoria],                                // Tag de búsqueda
                        ["l", "category", categoria],                    // NIP-32 Label
                        ["location", pos.lat + "," + pos.lon]            // Coordenadas raw
                    ]
                };

                const signedEvent = await nostrService.publishAnchor(eventData);
                ejecutarAnclajeVisual(signedEvent, pos, categoria, mapManager);
                alert("🚀 ¡Posición anclada con éxito en la red Nostr!");
            }

            // Limpiar formulario
            document.getElementById('poi-name').value = '';
            document.getElementById('poi-desc').value = '';

        } catch (err) {
            console.error("Error al anclar:", err);
            alert("Error: " + err.message);
        }
    };
}

// Función auxiliar para no repetir código de dibujo
function ejecutarAnclajeVisual(event, pos, categoria, mapManager) {
    const profile = AuthManager.profileCache[event.pubkey];
    const html = mapManager.createPopupHTML(event, profile, categoria);
    mapManager.addMarker(event.id, pos.lat, pos.lon, html, categoria);
}