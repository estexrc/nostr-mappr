import L from 'leaflet';
import { AuthManager } from '../../core/auth.js';
import { CATEGORIAS } from '../../core/categories.js';
import { store } from '../../core/store.js';

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
        const colors = {
            public: 'indigo-500',
            draft: 'amber-500',
            temp: 'purple-500'
        };
        const color = colors[type] || colors.public;

        return L.divIcon({
            className: 'custom-pin-container',
            html: `
                <div class="relative w-10 h-10 flex items-center justify-center animate-fade-slide">
                    ${type === 'public' ? `<div class="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping opacity-75"></div>` : ''}
                    <div class="relative w-8 h-8 rounded-full glass flex items-center justify-center shadow-lg border-2 border-white">
                        <span class="material-symbols-rounded text-${color} text-[20px]" style="font-variation-settings:'FILL' 1">
                            ${type === 'draft' ? 'description' : 'location_on'}
                        </span>
                    </div>
                    <div class="absolute -bottom-1 w-1.5 h-1.5 bg-${color} rounded-full border border-white"></div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -42]
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

    /* Synchronizes the map with the Context VM state (Optimized rendering/diffing) */
    syncWithVM(state) {
        const { pins, temporalPin } = state;

        // 1. Handle Network/Journal Pins
        const currentPinIds = new Set(pins.keys());

        // Remove old pins
        for (let [id, marker] of this.markers) {
            if (id !== 'temp-pop' && id !== 'temp-search' && !currentPinIds.has(id)) {
                this._removeMarker(id);
            }
        }

        // Add or update pins
        for (let [id, pin] of pins) {
            if (!this.markers.has(id)) {
                const coordsTag = pin.event?.tags.find(t => t[0] === 'g')?.[1];
                if (!coordsTag) continue;
                const [lat, lng] = coordsTag.split(',').map(Number);

                // Fetch profile from cache via VM if possible, or use placeholder
                const popupHTML = this.createPopupHTMLFromPin(pin);
                this.addMarker(id, lat, lng, popupHTML, pin.categoryId, pin.type);
            }
        }

        // 2. Handle Temporal User Pin (Zero Delay)
        if (temporalPin) {
            const marker = this.markers.get('temp-pop');
            if (!marker) {
                this.addMarker('temp-pop', temporalPin.lat, temporalPin.lon, temporalPin.popupHTML || '', 'none', 'temp');
                const newMarker = this.markers.get('temp-pop');
                newMarker.openPopup();

                // Sync VM state when user closes popup manually via X
                newMarker.on('popupclose', () => {
                    store.setState({ temporalPin: null });
                });
            } else {
                // Actualizar posición siempre por si se movió el mapa/GPS
                marker.setLatLng([temporalPin.lat, temporalPin.lon]);

                // Solo actualizar contenido si cambió para evitar parpadeos
                if (marker.getPopup().getContent() !== temporalPin.popupHTML) {
                    marker.setPopupContent(temporalPin.popupHTML);
                    // Re-abrir popup si el contenido es nuevo
                    if (!marker.isPopupOpen()) marker.openPopup();
                }
            }
        } else {
            this._removeMarker('temp-pop');
        }
    }

    _removeMarker(id) {
        const marker = this.markers.get(id);
        if (marker) {
            this.map.removeLayer(marker);
            this.publicLayer.removeLayer(marker);
            this.draftLayer.removeLayer(marker);
            this.markers.delete(id);
        }
    }

    /* Adds a marker to the map and stores it in the internal registry. */
    addMarker(id, lat, lon, popupHTML, category = 'all', type = 'public', options = {}) {
        if (this.markers.has(id)) return this.markers.get(id);

        const icon = this._createIcon(type);
        const marker = L.marker([lat, lon], { icon }).bindPopup(popupHTML, {
            maxWidth: 320,
            className: 'custom-tailwind-popup',
            ...options
        });

        // Asegurar limpieza de temporalPin al cerrar el popup
        if (id === 'temp-pop') {
            marker.on('popupclose', () => {
                store.setState({ temporalPin: null });
            });
        }
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

    /* Generates popup HTML based on pre-processed pin data from VM. */
    createPopupHTMLFromPin(pin) {
        const profile = AuthManager.profileCache[pin.pubkey] || null;
        const name = profile?.display_name || profile?.name || pin.pubkey.substring(0, 8);
        const picture = profile?.picture || 'https://www.gravatar.com/avatar/0?d=mp';

        let imageHTML = '';
        if (pin.images.length > 0) {
            const carouselId = `carousel-${pin.id.substring(0, 8)}`;
            imageHTML = `
            <div class="relative my-3 group">
                <div id="${carouselId}" class="flex overflow-x-auto snap-x snap-mandatory gap-2 no-scrollbar scroll-smooth rounded-2xl border border-slate-50">
                    ${pin.images.map(url => `
                        <div class="flex-none w-full snap-center aspect-video overflow-hidden cursor-zoom-in">
                            <img src="${url}" class="w-full h-full object-cover" onclick="window.open('${url}', '_blank')">
                        </div>
                    `).join('')}
                </div>
                ${pin.images.length > 1 ? `
                    <button onclick="document.getElementById('${carouselId}').scrollBy({left: -240, behavior: 'smooth'})" 
                        class="absolute left-2 top-1/2 -translate-y-1/2 glass text-indigo-600 rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:scale-110 transition-all opacity-0 group-hover:opacity-100">
                        <span class="material-symbols-rounded text-[18px]">chevron_left</span>
                    </button>
                    <button onclick="document.getElementById('${carouselId}').scrollBy({left: 240, behavior: 'smooth'})" 
                        class="absolute right-2 top-1/2 -translate-y-1/2 glass text-indigo-600 rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:scale-110 transition-all opacity-0 group-hover:opacity-100">
                        <span class="material-symbols-rounded text-[18px]">chevron_right</span>
                    </button>
                ` : ''}
            </div>`;
        }

        const catInfo = CATEGORIAS.find(c => c.id === pin.categoryId) || CATEGORIAS.find(c => c.id === 'nostr');

        const btnBase = "w-full py-2.5 px-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 text-center shadow-sm flex items-center justify-center gap-1.5";
        const followBtn = `${btnBase} bg-brand text-white hover:bg-brand-dark shadow-indigo-500/10`;
        const zapBtn = `${btnBase} bg-amber-400 text-amber-950 hover:bg-amber-500 shadow-amber-500/10`;
        const deleteBtn = `${btnBase} bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100`;

        const actionsHTML = pin.isDraft ? `
            <div class="grid grid-cols-2 gap-3 w-full">
                <button onclick="window.completeAnchor('${pin.id}')" class="${followBtn} !py-3">
                    <span class="material-symbols-rounded text-[18px]">rocket_launch</span>
                    <span>Publicar</span>
                </button>
                <button onclick="window.deleteEntry('${pin.id}')" class="${deleteBtn} !py-3">
                    <span class="material-symbols-rounded text-[18px]">delete</span>
                    <span>Borrar</span>
                </button>
            </div>
        ` : `
            <div class="grid grid-cols-2 gap-2 w-full">
                <button onclick="window.followUser('${pin.pubkey}', '${name}')" class="${followBtn}">
                    <span class="material-symbols-rounded text-[16px]">person_add</span>
                    <span>Seguir</span>
                </button>
                <button onclick="window.zapUser('${pin.pubkey}', '${name}', '${pin.title}')" class="${zapBtn}">
                    <span class="material-symbols-rounded text-[16px]" style="font-variation-settings:'FILL' 1">bolt</span>
                    <span>Zap</span>
                </button>
                ${pin.pubkey === AuthManager.userPubkey ? `
                    <button onclick="window.deleteAnchor('${pin.id}')" class="${deleteBtn} col-span-2 mt-1">
                        <span class="material-symbols-rounded text-[16px]">delete</span>
                        <span>Eliminar mi ancla</span>
                    </button>` : ''}
            </div>
        `;

        return `
            <div class="popup-container p-5 font-sans animate-fade-slide min-w-[280px]" data-pubkey="${pin.pubkey}">
                <div class="flex items-center gap-3 mb-4">
                    <div class="relative">
                        <img src="${picture}" class="w-10 h-10 rounded-full border border-slate-100 object-cover shadow-sm" alt="${name}">
                        <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-indigo-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-[13px] font-bold text-slate-900 truncate">${name}</span>
                        <span class="text-[10px] font-mono text-slate-400 truncate">@${pin.pubkey.substring(0, 10)}...</span>
                    </div>
                </div>
                <div class="space-y-2">
                    <div class="flex flex-col gap-1.5">
                        <h3 class="text-[14px] font-heading text-slate-800 leading-tight">${pin.title}</h3>
                        ${catInfo ? `<span class="bg-indigo-50 text-brand text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-100 self-start animate-neon-pulse">${catInfo.label}</span>` : ''}
                    </div>
                    ${imageHTML}
                    ${!pin.isDraft ? `
                    <p class="text-[12px] text-slate-600 leading-relaxed font-medium">
                        ${pin.description.length > 120
                    ? `${pin.description.substring(0, 120)}... <button onclick="window.showFullDescription('${pin.id}')" class="text-brand font-bold hover:underline">Leer más</button>`
                    : pin.description
                }
                    </p>` : ''}
                </div>
                <div class="mt-5 w-full">${actionsHTML}</div>
            </div>
        `;
    }

    /* Generates popup HTML based on event data and user profile. (LEGACY - keep for stability until fully synced) */
    createPopupHTML(event, profile, categoryId = 'general', isDraft = false) {
        const name = profile?.display_name || profile?.name || event.pubkey.substring(0, 8);
        const picture = profile?.picture || 'https://www.gravatar.com/avatar/0?d=mp';

        const parts = event.content.split('\n\n');
        const title = isDraft ? (event.tags.find(t => t[0] === 'title')?.[1] || "Draft") : (parts[0] || "Point of Interest");

        const rawDescription = isDraft ? "" : (parts.slice(1).join('\n\n') || "");
        const allImageUrls = [...new Set([
            ...event.tags.filter(t => t[0] === 'image' || t[0] === 'imeta').map(t => t[1]),
            ...(event.content.match(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\.bmp)(?:\?[^\s]*)?/gi) || [])
        ])];

        const cleanDescription = rawDescription.replace(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\.bmp)(?:\?[^\s]*)?/gi, '').trim();

        let imageHTML = '';
        if (allImageUrls.length > 0) {
            const carouselId = `carousel-${event.id.substring(0, 8)}`;
            imageHTML = `
            <div class="relative my-3 group">
                <div id="${carouselId}" class="flex overflow-x-auto snap-x snap-mandatory gap-2 no-scrollbar scroll-smooth rounded-2xl border border-slate-100 shadow-inner">
                    ${allImageUrls.map(url => `
                        <div class="flex-none w-full snap-center aspect-video overflow-hidden cursor-zoom-in">
                            <img src="${url}" class="w-full h-full object-cover" onclick="window.open('${url}', '_blank')">
                        </div>
                    `).join('')}
                </div>
                ${allImageUrls.length > 1 ? `
                    <button onclick="document.getElementById('${carouselId}').scrollBy({left: -240, behavior: 'smooth'})" 
                        class="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur text-slate-800 rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-white transition-all opacity-0 group-hover:opacity-100">❮</button>
                    <button onclick="document.getElementById('${carouselId}').scrollBy({left: 240, behavior: 'smooth'})" 
                        class="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur text-slate-800 rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-white transition-all opacity-0 group-hover:opacity-100">❯</button>
                ` : ''}
            </div>`;
        }

        const catInfo = CATEGORIAS.find(c => c.id === categoryId) || CATEGORIAS.find(c => c.id === 'nostr');

        const btnClass = "flex-1 py-2 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 text-center shadow-sm";
        const followBtn = `${btnClass} bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200`;
        const zapBtn = `${btnClass} bg-amber-400 text-black hover:bg-amber-500 shadow-amber-200`;
        const deleteBtn = `${btnClass} bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200`;

        const actionsHTML = isDraft ? `
            <button onclick="window.completeAnchor('${event.id}')" class="${followBtn}">🚀 Publicar</button>
            <button onclick="window.deleteEntry('${event.id}')" class="${deleteBtn}">🗑️ Borrar</button>
        ` : `
            <button onclick="window.followUser('${event.pubkey}', '${name}')" class="${followBtn}">Follow</button>
            <button onclick="window.zapUser('${event.pubkey}', '${name}', '${title}')" class="${zapBtn}">⚡ Zap</button>
            ${event.pubkey === AuthManager.userPubkey ? `<button onclick="window.deleteAnchor('${event.id}')" class="${deleteBtn}">🗑️ Borrar</button>` : ''}
        `;

        const descriptionTruncationLimit = 120;
        const truncatedDescription = cleanDescription.length > descriptionTruncationLimit
            ? `${cleanDescription.substring(0, descriptionTruncationLimit)}... <button onclick="window.showFullDescription('${event.id}')" class="text-indigo-600 font-bold hover:underline">Ver más</button>`
            : cleanDescription;

        return `
            <div class="popup-container min-w-[240px] p-1 font-sans" data-pubkey="${event.pubkey}">
                <div class="flex items-center gap-3 mb-3 pb-3 border-b border-slate-50">
                    <img src="${picture}" class="w-10 h-10 rounded-full border-2 border-slate-100 object-cover" alt="${name}">
                    <div class="flex flex-col">
                        <span class="text-sm font-black text-slate-900 leading-none">${name}</span>
                        <span class="text-[10px] font-mono text-slate-400">@${event.pubkey.substring(0, 8)}</span>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="flex flex-col gap-1 mb-2">
                        <strong class="text-sm font-black text-slate-800">${title}</strong>
                        ${catInfo ? `<span class="bg-indigo-50 text-indigo-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-indigo-100 self-start">${catInfo.label}</span>` : ''}
                    </div>
                    ${imageHTML}
                    ${!isDraft ? `
                    <div class="text-[12px] text-slate-600 leading-relaxed font-medium mt-1">
                        ${cleanDescription.length > 120
                    ? `${cleanDescription.substring(0, 120)}... <button onclick="window.showFullDescription('${event.id}')" class="text-indigo-600 font-bold hover:underline">Ver más</button>`
                    : cleanDescription
                }
                    </div>` : ''}
                </div>
                <div class="flex items-center gap-2 pt-2 border-t border-slate-50">${actionsHTML}</div>
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
                    style: { color: '#6366f1', weight: 4, opacity: 0.5, fillColor: '#6366f1', fillOpacity: 0.1 },
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

            this.tempSearchMarker.bindPopup(`
                <div class="p-2 text-center">
                    <strong class="text-slate-900 text-sm">📍 Ubicación encontrada</strong>
                    <p class="text-[11px] text-slate-500 mt-1">${result.display_name}</p>
                </div>
            `).openPopup();

            if (result.boundingbox) {
                const b = result.boundingbox;
                this.map.fitBounds([[b[0], b[2]], [b[1], b[3]]]);
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
            import('../../core/store.js').then(({ store }) => {
                store.setState({ temporalPin: null });
            });
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