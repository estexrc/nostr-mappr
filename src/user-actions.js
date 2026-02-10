import { AuthManager } from './auth.js';
import { showToast, openModal, getConfirmModalHTML } from './ui-controller.js';

export const UserActions = {
    /* Lógica de Follow */
    async followUser(pubkey, name) {
        if (!AuthManager.isLoggedIn()) {
            showToast("🔑 Debes iniciar sesión para seguir a otros usuarios.", "error");
            return;
        }

        if (pubkey === AuthManager.userPubkey) {
            showToast("❌ No puedes seguirte a ti mismo.", "error");
            return;
        }

        // Usamos el nombre del caché si está disponible para una mejor UX
        const displayName = AuthManager.getDisplayName(pubkey) || name;
        showToast(`✅ Siguiendo a ${name} (Próximamente)`, "success");
    },

    /* Lógica de Zap */
    zapUser(pubkey, name, titulo) {
        if (!AuthManager.isLoggedIn()) {
            showToast("⚡ Conecta tu cuenta para enviar Zaps", "error"); //
            return;
        }

        const displayName = AuthManager.getDisplayName(pubkey) || name;
        console.log(`⚡ Zap iniciado para ${displayName} por: ${titulo}`);
        showToast(`⚡ Enviando sats a ${displayName} por recomendar "${titulo}"`, "success");
    },

    /* Lógica de Borrado */
    async borrarPunto(eventId, mapManager, nostrService, eventosProcesados) {
        // Definimos la acción real de borrado
        const ejecutarBorrado = async () => {
            try {
                // Kind 5: Solicitud de borrado en Nostr
                const exito = await nostrService.deleteEvent(eventId); 

                if (exito) {
                    // Eliminación visual del mapa
                    const marcador = mapManager.markers.get(eventId);
                    if (marcador) {
                        mapManager.map.removeLayer(marcador);
                        mapManager.markers.delete(eventId);
                    }
                    
                    if (eventosProcesados) eventosProcesados.delete(eventId);
                    showToast("✅ Solicitud de borrado enviada", "success");
                } else {
                    showToast("❌ El relay no pudo procesar el borrado", "error");
                }
            } catch (err) {
                console.error("Error en el proceso de borrado:", err);
                showToast("❌ Error inesperado al intentar borrar", "error");
            }
        };

        // En lugar de confirm(), abrimos nuestro modal de vidrio
        openModal(getConfirmModalHTML(
            "¿Deseas eliminar permanentemente este anclaje? Esta acción enviará un evento Kind 5 a la red.", 
            ejecutarBorrado
        ));
    }
};