import { AuthManager } from './auth.js';

export const UserActions = {
    /* Lógica de Follow */
    async followUser(pubkey, name) {
        if (!AuthManager.isLoggedIn()) {
            alert("¡Hola! Necesitas iniciar sesión para seguir a otros usuarios.");
            return;
        }

        if (pubkey === AuthManager.userPubkey) {
            alert("¡Ese eres tú! No puedes seguirte a ti mismo.");
            return;
        }

        // Usamos el nombre del caché si está disponible para una mejor UX
        const displayName = AuthManager.getDisplayName(pubkey) || name;
        console.log(`✅ Siguiendo a ${displayName} (${pubkey})`);
        alert(`Próximamente: Siguiendo a ${displayName} en la red Nostr`);
    },

    /* Lógica de Zap */
    zapUser(pubkey, name, titulo) {
        if (!AuthManager.isLoggedIn()) {
            alert("Debes estar conectado para enviar Zaps.");
            return;
        }

        const displayName = AuthManager.getDisplayName(pubkey) || name;
        console.log(`⚡ Zap iniciado para ${displayName} por: ${titulo}`);
        alert(`⚡ Próximamente: Enviando sats a ${displayName} por recomendar "${titulo}"`);
    },

    /* Lógica de Borrado */
    async borrarPunto(eventId, mapManager, nostrService, eventosProcesados) {
        if (!confirm("¿Deseas eliminar permanentemente este anclaje de la red Nostr?")) return;

        try {
            // Kind 5: Solicitud de borrado en Nostr
            const exito = await nostrService.deleteEvent(eventId); 

            if (exito) {
                // Eliminación visual y de memoria usando el MapManager modular
                const marcador = mapManager.markers.get(eventId);
                if (marcador) {
                    mapManager.map.removeLayer(marcador);
                    mapManager.markers.delete(eventId);
                }
                
                if (eventosProcesados) eventosProcesados.delete(eventId);
                alert("✅ Solicitud de borrado enviada con éxito.");
            } else {
                alert("❌ Hubo un problema al procesar el borrado.");
            }
        } catch (err) {
            console.error("Error en el proceso de borrado:", err);
            alert("Ocurrió un error inesperado al intentar borrar.");
        }
    }
};