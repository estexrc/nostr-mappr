// ui-controller.js
import { AuthManager } from './auth.js';

// --- ELEMENTOS FLOTANTES ---
const userNameMini = document.getElementById('user-name-mini');
const userAvatarMini = document.getElementById('user-avatar-small');
const userPubkeyMini = document.getElementById('user-pubkey-mini');

// --- ELEMENTOS DE MODAL ---
const modalContainer = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');

/* Genera el HTML dinámico para el modal de perfil basado en el estado de sesión. */

function getProfileModalHTML(profile = null) {
    if (profile) {
        // VISTA: USUARIO CONECTADO
        const npubShort = AuthManager.userPubkey.substring(0, 10) + '...';
        return `
            <div class="profile-modal-inner connected-mode">
                <button class="close-btn" onclick="closeModal()">✕</button>
                <div class="profile-main-header">
                    <img src="${profile.picture || 'https://www.gravatar.com/avatar/0?d=mp'}" alt="Avatar" class="large-avatar">
                    <h2>Hi, ${profile.display_name || profile.name || 'User'}!</h2>
                    <span class="pubkey-badge">${npubShort}</span>
                </div>

                <div class="profile-stats-grid">
                    <div class="stat-box"><strong>24.5K</strong><span>⚡ SATS</span></div>
                    <div class="stat-box"><strong>${profile.following || 0}</strong><span>SIGUIENDO</span></div>
                    <div class="stat-box"><strong>${profile.followers || 0}</strong><span>SEGUIDORES</span></div>
                </div>

                <div class="profile-settings-section">
                    <p class="profile-bio">${profile.about || 'Sin descripción en Nostr.'}</p>
                    <button class="btn-settings-item"><i class="fas fa-user-gear"></i> Profile Settings</button>
                </div>

                <button id="btn-modal-logout" class="btn-logout-modal">CERRAR SESIÓN</button>
            </div>
        `;
    } else {
        // VISTA: INVITADO
        return `
            <div class="profile-modal-inner guest-mode">
                <button class="close-btn" onclick="closeModal()">✕</button>
                <div class="guest-header">
                    <div class="guest-icon-circle"><i class="fas fa-user-secret"></i></div>
                    <h2>Modo Invitado</h2>
                    <p>Conecta tu identidad Nostr para empezar a anclar lugares en el mapa.</p>
                </div>
                <button id="btn-modal-login" class="btn-login-modal">
                    <i class="fas fa-key"></i> CONECTAR CON ALBY / NOS2X
                </button>
            </div>
        `;
    }
}

export function getDraftModalHTML(lat, lng) {
    return `
        <div class="profile-modal-inner draft-modal">
            <button class="close-btn" id="btn-close-draft">✕</button>
            <div class="profile-main-header">
                <h2 style="margin-top: 10px;">Anclaje Provisorio</h2>
                <span class="pubkey-badge">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
            </div>

            <div class="form-group" style="width: 100%; text-align: left;">
                <label>TÍTULO DEL LUGAR</label>
                <input type="text" id="draft-title" placeholder="Ej: Café de la Esquina..." 
                       style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); margin-top: 5px;">
            </div>

            <div class="photo-upload-zone" id="upload-zone" style="width: 100%; border: 2px dashed rgba(88, 81, 219, 0.3); padding: 20px; border-radius: 20px; text-align: center; cursor: pointer; background: rgba(255,255,255,0.3);">
                <i class="fas fa-camera" style="font-size: 24px; color: #8e44ad; margin-bottom: 10px;"></i>
                <p style="font-size: 11px; font-weight: bold; color: #8e44ad; margin: 0;">SUBIR O TOMAR FOTO</p>
                <input type="file" id="draft-photo" accept="image/*" multiple style="display: none;">
            </div>
            <div id="preview-container" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;"></div>

            <button id="btn-save-draft" class="btn-primary">
                GUARDAR EN DIARIO
            </button>
        </div>
    `;
}

/* Actualiza la información visible en el botón flotante de usuario. */

export function updateFloatingUser(profile = null) {
    if (profile) {
        userNameMini.textContent = profile.display_name || profile.name || "Usuario";
        if (profile.picture) userAvatarMini.src = profile.picture;
        
        const npubShort = AuthManager.userPubkey ? AuthManager.userPubkey.substring(0, 8) : '...';
        userPubkeyMini.textContent = '@' + npubShort;
    } else {
        userNameMini.textContent = "Invitado";
        userAvatarMini.src = "https://www.gravatar.com/avatar/0?d=mp";
        userPubkeyMini.textContent = "@...";
    }
}

/* Abre el contenedor de modales e inyecta el HTML proporcionado. */
export function openModal(html) {
    modalContent.innerHTML = html;
    modalContainer.style.display = 'flex';
}

/* Cierra y limpia el modal. */
export function closeModal() {
    modalContainer.style.display = 'none';
    modalContent.innerHTML = '';
}

/* Genera el HTML dinámico para el modal del diario de anclajes. */

export function getJournalModalHTML(eventosBorrador = []) {
    const filas = eventosBorrador.map(ev => {
        const titulo = ev.tags.find(t => t[0] === 'title')?.[1] || 'Sin título';
        const coords = ev.tags.find(t => t[0] === 'g')?.[1] || '0,0';
        const [lat, lng] = coords.split(',');
        const fecha = new Date(ev.created_at * 1000).toLocaleDateString();

        return `
            <tr>
                <td class="journal-date">${fecha}</td>
                <td style="font-weight: 700;">${titulo}</td>
                <td>
                    <a href="#" class="geo-link" onclick="window.centrarMapa(${lat}, ${lng})" 
                       style="display: flex; align-items: center; gap: 6px; color: #5851db; text-decoration: none; font-weight: 700;">
                        <i class="fas fa-map-marker-alt"></i> Ver
                    </a>
                </td>
                <td style="color: #999;">-</td>
                <td class="journal-status-text">Anclado</td>
                <td>
                    <div class="actions-row">
                        <button class="btn-action-icon" onclick="window.completarAnclaje('${ev.id}')">🚀</button>
                        <button class="btn-action-icon" onclick="window.borrarBorrador('${ev.id}')">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="profile-modal-inner">
            <button class="close-btn" id="btn-close-journal">✕</button>
            <h2 style="font-size: 24px; font-weight: 800; color: #1a1a1a; align-self: center;">Diario de anclajes</h2>
            
            <div class="journal-white-container">
                <table class="journal-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Título</th>
                            <th>Ubicación</th>
                            <th>Categoría</th>
                            <th>Estado</th>
                            <th style="text-align: center;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filas || '<tr><td colspan="6" style="text-align:center; padding: 40px; color: #999;">Aún no tienes registros.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/* Inicializa los eventos de los botones flotantes. */

export function initUI(nostrInstance) {

    const userBtn = document.getElementById('user-floating-btn'); 
    const modalContainer = document.getElementById('modal-container');

    if (userBtn) {
        userBtn.addEventListener('click', async () => {
            let profile = null;
            if (AuthManager.isLoggedIn()) {
                profile = AuthManager.profileCache[AuthManager.userPubkey];
                if (!profile) profile = await nostrInstance.getUserProfile(AuthManager.userPubkey);
            }
            
            openModal(getProfileModalHTML(profile));

            document.getElementById('btn-modal-login')?.addEventListener('click', async () => {
                await AuthManager.login();
                location.reload();
            });

            document.getElementById('btn-modal-logout')?.addEventListener('click', () => {
                AuthManager.logout();
                location.reload();
            });

            const closeBtn = modalContent.querySelector('.close-btn');
                if (closeBtn) {
                closeBtn.onclick = () => closeModal();
}
        });
    }

    // 2. Click en PoP
    const btnQuickPop = document.getElementById('btn-quick-pop');

            btnQuickPop?.addEventListener('click', async () => {
        // 1. Efecto visual de carga
        const originalContent = btnQuickPop.innerHTML;
        btnQuickPop.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; 
        btnQuickPop.style.opacity = "0.7";

        try {
            // 2. Pedimos ubicación
            const pos = await window.map.getCurrentLocation();
            
            window.dispatchEvent(new CustomEvent('trigger-pop', { 
                detail: { lat: pos.lat, lng: pos.lon } 
            }));
        } catch (err) {
            alert("📍 Error: No se pudo obtener ubicación.");
        } finally {
            // 3. Restauramos el botón
            btnQuickPop.innerHTML = originalContent;
            btnQuickPop.style.opacity = "1";
        }
    });

    // 3. Click en Diario
    document.getElementById('btn-open-journal')?.addEventListener('click', async () => {
        if (!AuthManager.isLoggedIn()) {
            alert("Debes conectar tu identidad Nostr para ver tu Diario.");
            return;
        }

        // Abrimos el modal con un estado de carga inicial
        openModal(getJournalModalHTML([])); 
        
        // Llamamos a la función global que definiremos en main.js
        if (window.fetchAndShowJournal) {
            window.fetchAndShowJournal();
        }

        const closeBtn = document.getElementById('btn-close-journal');
        if (closeBtn) closeBtn.onclick = () => closeModal();
    });

    // Cerrar modal al hacer clic fuera
    modalContainer?.addEventListener('click', (e) => {
        if (e.target === modalContainer) closeModal();
    });

    // Actualización inicial del botón flotante
    if (AuthManager.isLoggedIn()) {
        const pubkey = AuthManager.userPubkey;
        const cachedProfile = AuthManager.profileCache[pubkey];
        if (cachedProfile) {
            updateFloatingUser(cachedProfile);
        } else {
            nostrInstance.getUserProfile(pubkey).then(profile => {
                if (profile) {
                    AuthManager.saveProfile(pubkey, profile);
                    updateFloatingUser(profile);
                }
            });
        }
    }
}