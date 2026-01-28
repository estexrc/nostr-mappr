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
        
        chip.onclick = () => {
            toggleFilter(cat.id, chip, mapManager);
        };
        filterContainer.appendChild(chip);
    });

    // 2. Lógica de Scroll
    if (scrollRight && scrollLeft) {
        if (scrollRight && scrollLeft) {
        // Cambiamos filterBar por filterContainer aquí:
        scrollRight.onclick = () => filterContainer.scrollBy({ left: 240, behavior: 'smooth' });
        scrollLeft.onclick = () => filterContainer.scrollBy({ left: -240, behavior: 'smooth' });

        // Y cambiamos filterBar por filterContainer aquí también:
        filterContainer.onscroll = () => {
            const scrollPos = filterContainer.scrollLeft;
            const maxScroll = filterContainer.scrollWidth - filterContainer.clientWidth;
            
            scrollLeft.style.opacity = scrollPos > 10 ? "1" : "0";
            scrollLeft.style.pointerEvents = scrollPos > 10 ? "auto" : "none";
            scrollRight.style.opacity = scrollPos < maxScroll - 10 ? "1" : "0";
            scrollRight.style.pointerEvents = scrollPos < maxScroll - 10 ? "auto" : "none";
        };
    }
    }
}

// 3. Función de Filtrado
function toggleFilter(id, element, mapManager) {
    const yaEstabaActivo = element.classList.contains('active');
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));

    const filtroAAplicar = yaEstabaActivo ? 'todos' : id;

    if (!yaEstabaActivo) {
        element.classList.add('active');
    }

    mapManager.markers.forEach((marker) => {
        const catMarcador = String(marker.categoria).toLowerCase().trim();
        const catFiltro = String(filtroAAplicar).toLowerCase().trim();

        if (catFiltro === 'todos' || catMarcador === catFiltro) {
            marker.addTo(mapManager.map);
        } else {
            marker.remove();
        }
    });
}