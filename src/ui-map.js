import L from 'leaflet';
import { CATEGORIAS } from './categories.js';

export class MapManager {
    constructor(containerId, defaultCoords) {
        this.map = L.map(containerId, { zoomControl: false }).setView(defaultCoords, 13);        
        this.markers = new Map(); 

        // Capas independientes (Punto 1 y 4)
        this.publicLayer = L.layerGroup().addTo(this.map);
        this.draftLayer = L.layerGroup().addTo(this.map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors, © CARTO'
        }).addTo(this.map);

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    }

    /* Generador de iconos centralizado */
    _createIcon(type = 'public') {
        let colorClass = 'pin-img-blue';
        if (type === 'draft') colorClass = 'pin-img-orange';
        if (type === 'temp') colorClass = 'pin-img-purple'; // Nuevo color
        
        return L.divIcon({
            className: 'custom-pin-container',
            html: `<img src="https://www.iconpacks.net/icons/2/free-location-pin-icon-2965-thumb.png" class="pin-custom-img ${colorClass}">`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });
    }

    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!("geolocation" in navigator)) reject("GPS no disponible");
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                err => reject(err)
            );
        });
    }

    setView(lat, lon, zoom = 14) {
        this.map.setView([lat, lon], zoom);
    }

    /* addMarker mejorado para soportar tipos */
    addMarker(id, lat, lon, popupHTML, categoria = 'todos', type = 'public') {
        if (this.markers.has(id)) return; 

        const icon = this._createIcon(type);
        const marker = L.marker([lat, lon], { icon }).bindPopup(popupHTML);
        marker.categoria = categoria;
        marker.markerType = type; // Guardamos el tipo para la limpieza

        if (type === 'draft') {
            marker.addTo(this.draftLayer);
        } else {
            marker.addTo(this.publicLayer);
        }

        this.markers.set(id, marker);
        return marker;
    }

    /* reatePopupHTML original recuperado y limpiado de estilos */
    createPopupHTML(event, profile, categoriaId = 'general', isDraft = false) {
        const name = profile?.display_name || profile?.name || event.pubkey.substring(0, 8);
        const picture = profile?.picture || 'https://www.gravatar.com/avatar/0?d=mp';
        
        const partes = event.content.split('\n\n');
        const titulo = isDraft ? (event.tags.find(t => t[0] === 'title')?.[1] || "Borrador") : (partes[0] || "Punto de interés");
        const descripcion = isDraft ? "" : (partes.slice(1).join('\n\n') || ""); 
        
        const infoCat = CATEGORIAS.find(c => c.id === categoriaId) || CATEGORIAS.find(c => c.id === 'nostr');

        const actionsHTML = isDraft ? `
            <button onclick="window.completeAnchor('${event.id}')" class="btn-popup btn-follow">🚀 Publish</button>
            <button onclick="window.deleteDraft('${event.id}')" class="btn-popup btn-delete">🗑️ Delete</button>
        ` : `
            <button onclick="window.followUser('${event.pubkey}', '${name}')" class="btn-popup btn-follow">Follow</button>
            <button onclick="window.zapUser('${event.pubkey}', '${name}', '${titulo}')" class="btn-popup btn-zap">⚡ Zap</button>
            <button onclick="window.borrarPunto('${event.id}')" class="btn-popup btn-delete owner-only" data-owner="${event.pubkey}">🗑️ Delete</button>
        `;

        return `
            <div class="popup-container" data-pubkey="${event.pubkey}">
                <div class="popup-header">
                    <img src="${picture}" class="popup-avatar" alt="${name}">
                    <div class="popup-user-info">
                        <span class="popup-username">${name}</span>
                        <span class="popup-pubkey">@${event.pubkey.substring(0, 8)}</span>
                    </div>
                </div>
                <div class="popup-content">
                    <strong class="popup-title">${titulo}</strong>
                    ${infoCat ? `<span class="popup-category-badge"></i> ${infoCat.label}</span>` : ''}
                    <p class="popup-description">${descripcion}</p>
                </div>
                <div class="popup-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    /* Búsqueda Nominatim recuperada íntegramente */
    async searchAddress(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&q=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);

            if (this.tempSearchMarker) this.map.removeLayer(this.tempSearchMarker);
            if (this.tempSearchGeometry) this.map.removeLayer(this.tempSearchGeometry);

            if (result.geojson && result.geojson.type !== 'Point') { 
                this.tempSearchGeometry = L.geoJSON(result.geojson, {
                    style: { color: '#1a73e8', weight: 5, opacity: 0.6, fillColor: '#1a73e8', fillOpacity: 0.1 },
                    pointToLayer: () => null 
                }).addTo(this.map);
            }

            this.tempSearchMarker = L.marker([lat, lon], {
                icon: L.icon({
                    iconUrl: 'https://www.iconpacks.net/icons/2/free-location-pin-icon-2965-thumb.png',
                    iconSize: [45, 45],
                    iconAnchor: [22.5, 45],
                    popupAnchor: [0, -45]
                })
            }).addTo(this.map);

            this.tempSearchMarker.bindPopup(`<strong>📍 Ubicación encontrada</strong><br>${result.display_name}`).openPopup();
            
            if (result.boundingbox) {
                const b = result.boundingbox;
                this.map.fitBounds([ [b[0], b[2]], [b[1], b[3]] ]);
            } else {
                this.setView(lat, lon, 16);
            }
            return { lat, lon };
        } else {
            throw new Error("No se encontró la ubicación");
        }
    }

    clearSearchSelection() {
        if (this.tempSearchGeometry) this.map.removeLayer(this.tempSearchGeometry);
        if (this.tempSearchMarker) this.map.removeLayer(this.tempSearchMarker);
        this.map.closePopup();
    }

    clearDrafts() {
        // 1. Limpiamos visualmente la capa de borradores
        this.draftLayer.clearLayers();

        // 2. Limpiamos la memoria interna usando la propiedad markerType
        for (let [id, marker] of this.markers) {
            if (marker.markerType === 'draft') {
                this.markers.delete(id);
            }
        }
    }
}