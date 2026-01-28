
export function initSearch(mapManager) {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('btn-search');
    const btnClear = document.getElementById('btn-clear-search');

    if (!searchInput || !searchBtn || !btnClear) return;

    async function ejecutarBusqueda() {
        const query = searchInput.value.trim();
        if (!query) return;

        try {
            // Usamos el mapManager que recibe la función
            await mapManager.searchAddress(query);
            console.log(`Búsqueda exitosa: ${query}`);
        } catch (err) {
            alert("📍 Lo sentimos, no pudimos encontrar esa dirección.");
        }
    }

    // Listeners (Copiados de tu main.js líneas 254-273)
    searchBtn.onclick = ejecutarBusqueda;

    searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') ejecutarBusqueda();
    };

    // Lógica de la 'X' (Línea 319 de tu main.js)
    searchInput.addEventListener('input', () => {
        btnClear.style.display = searchInput.value.length > 0 ? 'block' : 'none';
    });

    btnClear.addEventListener('click', () => {
        searchInput.value = '';
        btnClear.style.display = 'none';
        if (mapManager && typeof mapManager.clearSearchSelection === 'function') {
            mapManager.clearSearchSelection();
        }
        searchInput.focus();
    });
}