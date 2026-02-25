import { CATEGORIAS } from '../../core/categories.js';
import { store } from '../../core/store.js';

export function initFilters(mapManager) {
    const filterContainer = document.getElementById('filter-bar-container');
    const scrollRight = document.getElementById('btn-scroll-right');
    const scrollLeft = document.getElementById('btn-scroll-left');

    if (!filterContainer) return;

    /* Renders Category Chips from the categories definition. */
    CATEGORIAS.forEach(cat => {
        const chip = document.createElement('div');
        // Initial Light Glass Classes
        const isNostr = cat.group.includes('Nostr');
        const nostrClass = isNostr ? 'neon-pulse-nostr' : '';

        chip.className = `px-5 py-2.5 glass rounded-full font-label text-slate-500 hover:text-brand hover:scale-105 transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-2 ${nostrClass}`;
        chip.innerHTML = `<span>${cat.label}</span>`;
        chip.id = `chip-${cat.id}`;
        chip.onclick = () => toggleFilter(cat.id, chip, mapManager);
        filterContainer.appendChild(chip);
    });

    // Add Feedback Toast Container
    const feedbackToast = document.createElement('div');
    feedbackToast.id = 'map-feedback-toast';
    feedbackToast.className = 'map-feedback-toast';
    document.body.appendChild(feedbackToast);

    /* Updates scroll button visibility based on container position. */
    const checkScroll = () => {
        const scrollPos = filterContainer.scrollLeft;
        const maxScroll = filterContainer.scrollWidth - filterContainer.clientWidth;

        if (scrollLeft) {
            const isVisible = scrollPos > 10;
            scrollLeft.classList.toggle('opacity-0', !isVisible);
            scrollLeft.classList.toggle('invisible', !isVisible);
        }
        if (scrollRight) {
            const isVisible = scrollPos < maxScroll - 10;
            scrollRight.classList.toggle('opacity-0', !isVisible);
            scrollRight.classList.toggle('invisible', !isVisible);
        }
    };

    if (scrollRight && scrollLeft) {
        scrollRight.onclick = () => filterContainer.scrollBy({ left: 300, behavior: 'smooth' });
        scrollLeft.onclick = () => filterContainer.scrollBy({ left: -300, behavior: 'smooth' });
        filterContainer.onscroll = checkScroll;
        setTimeout(checkScroll, 500); // Wait for rendering
    }
}

/* Toggles visibility of map markers based on selected category. */
async function toggleFilter(id, element, mapManager) {
    const isActive = element.getAttribute('data-active') === 'true';
    const feedbackToast = document.getElementById('map-feedback-toast');

    // Reset all chips styles
    document.querySelectorAll('#filter-bar-container div').forEach(c => {
        c.setAttribute('data-active', 'false');
        const catId = c.id.replace('chip-', '');
        const cat = CATEGORIAS.find(cat => cat.id === catId);
        const isNostr = cat?.group.includes('Nostr');
        const nostrClass = isNostr ? 'neon-pulse-nostr' : '';
        c.className = `px-5 py-2.5 glass rounded-full font-label text-slate-500 hover:text-brand hover:scale-105 transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-2 ${nostrClass}`;
    });

    const filterToApply = isActive ? 'all' : id;

    if (!isActive) {
        element.setAttribute('data-active', 'true');
        element.className = 'px-5 py-2.5 bg-brand border-indigo-400 text-white rounded-full font-label transition-all cursor-pointer whitespace-nowrap shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-2';
    }

    /* Show/hide markers by category */
    let visibleMarkers = [];
    mapManager.markers.forEach((marker) => {
        const markerCategory = String(marker.category).toLowerCase().trim();
        const filterId = String(filterToApply).toLowerCase().trim();

        if (filterId === 'all' || markerCategory === filterId) {
            visibleMarkers.push(marker);
            if (marker.markerType === 'draft') {
                marker.addTo(mapManager.draftLayer);
            } else if (marker.markerType === 'temp') {
                marker.addTo(mapManager.map);
            } else {
                marker.addTo(mapManager.publicLayer);
            }
        } else {
            marker.remove();
        }
    });

    // Smart Proximity Zoom: Show nearby points (2km radius from user location)
    if (!isActive && filterToApply !== 'all') {
        const userLocation = store.state.currentLocation;
        const RADIUS_KM = 2;

        /**
         * Haversine formula to compute distance in km between two lat/lon pairs.
         */
        function haversineKm(lat1, lon1, lat2, lon2) {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        // Filter to markers within 2km of the user
        let nearbyMarkers = [];
        if (userLocation) {
            nearbyMarkers = visibleMarkers.filter(marker => {
                const { lat, lng } = marker.getLatLng();
                return haversineKm(userLocation.lat, userLocation.lon, lat, lng) <= RADIUS_KM;
            });
        }

        if (nearbyMarkers.length > 0) {
            // Zoom to the nearest marker to the user
            nearbyMarkers.sort((a, b) => {
                const da = haversineKm(userLocation.lat, userLocation.lon, a.getLatLng().lat, a.getLatLng().lng);
                const db = haversineKm(userLocation.lat, userLocation.lon, b.getLatLng().lat, b.getLatLng().lng);
                return da - db;
            });
            const closest = nearbyMarkers[0].getLatLng();
            mapManager.map.setView([closest.lat, closest.lng], 15);
        } else {
            // No nearby points: show toast feedback
            if (feedbackToast) {
                feedbackToast.textContent = 'No se encontraron puntos en esta zona';
                feedbackToast.classList.add('show');
                setTimeout(() => feedbackToast.classList.remove('show'), 3000);
            }
        }
    }
}