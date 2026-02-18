import L from 'leaflet';
import { CATEGORIAS } from './categories.js';

export class MapManager {
    constructor(containerId, defaultCoords) {
        this.map = L.map(containerId, { zoomControl: false }).setView(defaultCoords, 13);        
        this.markers = new Map(); 

        /* Independent layers for public and draft markers. */
        this.publicLayer = L.layerGroup().addTo(this.map);
        this.draftLayer = L.layerGroup().addTo(this.map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors, © CARTO'
        }).addTo(this.map);

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);
    }

    /* Centralized icon generator. */
    _createIcon(type = 'public') {
        let colorClass = 'pin-img-blue';
        if (type === 'draft') colorClass = 'pin-img-orange';
        if (type === 'temp') colorClass = 'pin-img-purple'; 
        
        return L.divIcon({
            className: 'custom-pin-container',
            html: `<img src="https://www.iconpacks.net/icons/2/free-location-pin-icon-2965-thumb.png" class="pin-custom-img ${colorClass}">`,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });
    }

    /* Obtains user GPS coordinates. */
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject(new Error("No geo support"));
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
                (e) => reject(e),
                { enableHighAccuracy: true }
            );
        });
    }

    /* Sets map view to specific coordinates. */
    setView(lat, lon, zoom = 14) {
        this.map.setView([lat, lon], zoom);
    }

    /* Adds a marker to the map and stores it in the internal registry. */
    addMarker(id, lat, lon, popupHTML, category = 'all', type = 'public') {
        if (this.markers.has(id)) return this.markers.get(id); 

        const icon = this._createIcon(type);
        const marker = L.marker([lat, lon], { icon }).bindPopup(popupHTML);
        marker.category = category;
        marker.markerType = type; 

            if (type === 'draft') {
            marker.addTo(this.draftLayer);
            } else if (type === 'temp') {
                marker.addTo(this.map);
            } else {
                marker.addTo(this.publicLayer);
            }

            this.markers.set(id, marker);
            return marker;
    }

    /* Generates popup HTML based on event data and user profile. */
    createPopupHTML(event, profile, categoryId = 'general', isDraft = false) {
        const name = profile?.display_name || profile?.name || event.pubkey.substring(0, 8);
        const picture = profile?.picture || 'https://www.gravatar.com/avatar/0?d=mp';
        
        const parts = event.content.split('\n\n');
        const title = isDraft ? (event.tags.find(t => t[0] === 'title')?.[1] || "Draft") : (parts[0] || "Point of Interest");
        const description = isDraft ? "" : (parts.slice(1).join('\n\n') || ""); 
        
        const imageTag = event.tags.find(t => t[0] === 'image' || t[0] === 'imeta');
        const contentImageMatch = event.content.match(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\.bmp)(?:\?[^\s]*)?/i);
        const imageUrl = imageTag ? imageTag[1] : (contentImageMatch ? contentImageMatch[0] : null);

        if (!imageUrl && event.content.includes("http")) {
            console.log("Se detectó un link pero no se reconoció como imagen:", event.content);
        }
        
        const imageHTML = imageUrl ? `
            <div class="popup-image-container" style="margin: 10px 0; overflow: hidden; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);">
                <img src="${imageUrl}" 
                     style="width: 100%; max-height: 150px; object-fit: cover; display: block; cursor: zoom-in;" 
                     onerror="this.style.display='none'"
                     onclick="window.open('${imageUrl}', '_blank')">
            </div>
        ` : '';

        const catInfo = CATEGORIAS.find(c => c.id === categoryId) || CATEGORIAS.find(c => c.id === 'nostr');

        /* Actions updated to match the new global functions in main.js. */
        const actionsHTML = isDraft ? `
            <button onclick="window.completeAnchor('${event.id}')" class="btn-popup btn-follow">🚀 Publish</button>
            <button onclick="window.deleteEntry('${event.id}')" class="btn-popup btn-delete">🗑️ Delete</button>
        ` : `
            <button onclick="window.followUser('${event.pubkey}', '${name}')" class="btn-popup btn-follow">Follow</button>
            <button onclick="window.zapUser('${event.pubkey}', '${name}', '${title}')" class="btn-popup btn-zap">⚡ Zap</button>
            <button onclick="window.deleteAnchor('${event.id}')" class="btn-popup btn-delete owner-only" data-owner="${event.pubkey}">🗑️ Delete</button>
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
                    <strong class="popup-title">${title}</strong>
                    ${catInfo ? `<span class="popup-category-badge"></i> ${catInfo.label}</span>` : ''}
                    ${imageHTML}
                    <p class="popup-description">${description}</p>
                </div>
                <div class="popup-actions">
                    ${actionsHTML}
                </div>
            </div>
        `;
    }

    /* Searches for an address using Nominatim API. */
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

            this.tempSearchMarker.bindPopup(`<strong>📍 Location found</strong><br>${result.display_name}`).openPopup();
            
            if (result.boundingbox) {
                const b = result.boundingbox;
                this.map.fitBounds([ [b[0], b[2]], [b[1], b[3]] ]);
            } else {
                this.setView(lat, lon, 16);
            }
            return { lat, lon };
        } else {
            throw new Error("Location not found");
        }
    }

    /* Clears temporary search results from the map. */
    clearSearchSelection() {
        if (this.tempSearchGeometry) this.map.removeLayer(this.tempSearchGeometry);
        if (this.tempSearchMarker) this.map.removeLayer(this.tempSearchMarker);
        
        const tempPoP = this.markers.get('temp-pop');
        if (tempPoP) {
            this.map.removeLayer(tempPoP);
            this.markers.delete('temp-pop');
        }
        
        this.map.closePopup();
    }

    /* Clears visual draft layers and removes draft markers from memory. */
    clearDraftLayers() {
        this.draftLayer.clearLayers();
        for (let [id, marker] of this.markers) {
            if (marker.markerType === 'draft') {
                this.markers.delete(id);
            }
        }
    }
}