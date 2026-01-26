// ui-map.js
import L from 'leaflet';

export class MapManager {
    constructor(containerId, defaultCoords) {
        this.map = L.map(containerId).setView(defaultCoords, 13);
        this.markers = new Map(); // Para rastrear marcadores por ID de evento

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors, © CARTO'
        }).addTo(this.map);
    }

    /* Obtiene la ubicación actual del usuario mediante el navegador. */

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!("geolocation" in navigator)) {
                reject("GPS no disponible");
            }
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                err => reject(err)
            );
        });
    }

    /* Mueve la vista del mapa a una ubicación. */
     
    setView(lat, lon, zoom = 14) {
        this.map.setView([lat, lon], zoom);
    }

    /* Añade un marcador al mapa si no existe ya.*/
     
    addMarker(id, lat, lon, popupHTML, categoria = 'todos') {
        if (this.markers.has(id)) return; // Evitar duplicados

        const marker = L.marker([lat, lon]).addTo(this.map).bindPopup(popupHTML);
        marker.categoria = categoria;
        this.markers.set(id, marker);
    }

    /* Genera el HTML para el popup del marcador. */

createPopupHTML(event, profile, categoriaId = 'general') {
    const name = profile?.display_name || profile?.name || event.pubkey.substring(0, 8);
    const picture = profile?.picture || 'https://www.gravatar.com/avatar/0000?d=mp&f=y';
    
    // Separamos Título y Descripción
    const partes = event.content.split('\n\n');
    const titulo = partes[0] || "Punto de interés";
    const descripcion = partes.slice(1).join('\n\n') || ""; 

    // Convertimos el ID técnico (ej: 'gastronomia') en algo legible
    const categoriaLabel = categoriaId.charAt(0).toUpperCase() + categoriaId.slice(1);

    return `
        <div class="popup-container">
            <div class="popup-header">
                <img src="${picture}" class="popup-avatar" alt="${name}">
                <div class="popup-user-info">
                    <span class="popup-username">${name}</span>
                    <span class="popup-pubkey">@${event.pubkey.substring(0, 8)}</span>
                </div>
            </div>

            <div class="popup-content">
                <strong class="popup-title">${titulo}</strong>
                <span class="popup-category-badge">${categoriaLabel}</span>
                
                <p class="popup-description">${descripcion}</p>
            </div>

            <div class="popup-actions">
                <button onclick="window.followUser('${event.pubkey}', '${name}')" class="btn-popup btn-follow">Follow</button>
                <button onclick="window.zapUser('${event.pubkey}', '${name}', '${titulo}')" class="btn-popup btn-zap">⚡ Zap</button>
            </div>
        </div>
    `;
}
// En ui-map.js, dentro de la clase MapManager
async searchAddress(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.length > 0) {
        const result = data[0];
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        
        this.setView(lat, lon, 16); // Volamos hacia la dirección encontrada
        return { lat, lon };
    } else {
        throw new Error("No se encontró la ubicación");
    }
}
}