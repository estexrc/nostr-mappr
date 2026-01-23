import ngeohash from 'ngeohash'; // O window.ngeohash si no usas bundler

export const GeoLogic = {

    /* Convierte lat/lon a un geohash de precisión 9 */
    encode: (lat, lon) => {
        return ngeohash.encode(lat, lon, 9);
    },

    /* Decodifica un geohash y devuelve un objeto con lat/lon */
    decode: (hash) => {
        const decoded = ngeohash.decode(hash);
        return {
            lat: decoded.latitude,
            lon: decoded.longitude
        };
    },

    /* Extrae el geohash de los tags de un evento Nostr */
    getHashFromEvent: (event) => {
        const gTag = event.tags.find(t => t[0] === 'g');
        return gTag ? gTag[1] : null;
    }
};