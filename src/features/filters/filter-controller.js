import { CATEGORIAS } from '../../core/categories.js';

export function initFilters(mapManager) {
    const filterContainer = document.getElementById('filter-bar-container');
    const scrollRight = document.getElementById('btn-scroll-right');
    const scrollLeft = document.getElementById('btn-scroll-left');

    if (!filterContainer) return;

    /* Renders Category Chips from the categories definition. */
    CATEGORIAS.forEach(cat => {
        const chip = document.createElement('div');
        // Initial Light Glass Classes
        chip.className = 'px-5 py-2.5 glass rounded-full font-label text-slate-500 hover:text-brand hover:scale-105 transition-all cursor-pointer whitespace-nowrap active:scale-95';
        chip.textContent = cat.label;

        chip.onclick = () => toggleFilter(cat.id, chip, mapManager);
        filterContainer.appendChild(chip);
    });

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
function toggleFilter(id, element, mapManager) {
    const isActive = element.getAttribute('data-active') === 'true';

    // Reset all chips
    document.querySelectorAll('#filter-bar-container div').forEach(c => {
        c.setAttribute('data-active', 'false');
        c.className = 'px-5 py-2.5 glass rounded-full font-label text-slate-500 hover:text-brand hover:scale-105 transition-all cursor-pointer whitespace-nowrap active:scale-95';
    });

    const filterToApply = isActive ? 'all' : id;

    if (!isActive) {
        element.setAttribute('data-active', 'true');
        // Active Styles: Brand color + Neon Pulse (shadow pulse)
        element.className = 'px-5 py-2.5 bg-brand border-indigo-400 text-white rounded-full font-label transition-all cursor-pointer whitespace-nowrap shadow-xl shadow-indigo-500/20 active:scale-95 animate-neon-pulse';
    }

    /* Filters markers by comparing category and assigning to correct layers. */
    mapManager.markers.forEach((marker) => {
        const markerCategory = String(marker.category).toLowerCase().trim();
        const filterId = String(filterToApply).toLowerCase().trim();

        if (filterId === 'all' || markerCategory === filterId) {
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
}