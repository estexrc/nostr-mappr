import { CATEGORIAS } from './categories.js';

export function initFilters(mapManager) {
    const filterContainer = document.getElementById('filter-bar-container');
    const scrollRight = document.getElementById('btn-scroll-right');
    const scrollLeft = document.getElementById('btn-scroll-left');

    if (!filterContainer) return;

    // 1. Renderizar Chips
    CATEGORIAS.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = 'filter-chip';
        chip.textContent = cat.label;
        
        chip.onclick = () => toggleFilter(cat.id, chip, mapManager);
        filterContainer.appendChild(chip);
    });

    // 2. Lógica de Scroll Mejorada
    const checkScroll = () => {
        const scrollPos = filterContainer.scrollLeft;
        const maxScroll = filterContainer.scrollWidth - filterContainer.clientWidth;
        
        if (scrollLeft) {
            scrollLeft.style.opacity = scrollPos > 5 ? "1" : "0";
            scrollLeft.style.visibility = scrollPos > 5 ? "visible" : "hidden";
        }
        if (scrollRight) {
            // Si el scroll máximo es mayor a 0, significa que hay desborde
            const showRight = scrollPos < maxScroll - 5;
            scrollRight.style.opacity = showRight ? "1" : "0";
            scrollRight.style.visibility = showRight ? "visible" : "hidden";
        }
    };

    if (scrollRight && scrollLeft) {
        scrollRight.onclick = () => filterContainer.scrollBy({ left: 240, behavior: 'smooth' });
        scrollLeft.onclick = () => filterContainer.scrollBy({ left: -240, behavior: 'smooth' });
        filterContainer.onscroll = checkScroll;

        // NUEVO: Comprobación inicial apenas se cargan los chips
        setTimeout(checkScroll, 300); 
    }
}


// 3. Función de Filtrado Modularizada
function toggleFilter(id, element, mapManager) {
    const yaEstabaActivo = element.classList.contains('active');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));

    const filtroAAplicar = yaEstabaActivo ? 'todos' : id;

    if (!yaEstabaActivo) {
        element.classList.add('active');
    }

    // Recorremos todos los marcadores usando la nueva estructura
    mapManager.markers.forEach((marker) => {
        const catMarcador = String(marker.categoria).toLowerCase().trim();
        const catFiltro = String(filtroAAplicar).toLowerCase().trim();

        if (catFiltro === 'todos' || catMarcador === catFiltro) {
            // Decidimos en qué capa volver a ponerlo
            if (marker.markerType === 'draft') {
                marker.addTo(mapManager.draftLayer);
            } else {
                marker.addTo(mapManager.publicLayer);
            }
        } else {
            marker.remove(); // Se quita visualmente pero sigue en MapManager.markers
        }
    });
}