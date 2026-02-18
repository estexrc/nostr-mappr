import { AuthManager } from './auth.js';
import { CATEGORIAS } from './categories.js';

/* --- FLOATING UI ELEMENTS --- */
const userNameMini = document.getElementById('user-name-mini');
const userAvatarMini = document.getElementById('user-avatar-small');
const userPubkeyMini = document.getElementById('user-pubkey-mini');

/* --- MODAL ELEMENTS --- */
const modalContainer = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');

/* Generates dynamic HTML for the profile modal based on session state. */
function getProfileModalHTML(profile = null) {
    if (profile) {
        /* UI: CONNECTED USER */
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
                    <div class="stat-box"><strong>${profile.following || 0}</strong><span>FOLLOWING</span></div>
                    <div class="stat-box"><strong>${profile.followers || 0}</strong><span>FOLLOWERS</span></div>
                </div>

                <div class="profile-settings-section">
                    <p class="profile-bio">${profile.about || 'No description provided on Nostr.'}</p>
                    <button class="btn-settings-item"><i class="fas fa-user-gear"></i> Profile Settings</button>
                </div>

                <button id="btn-modal-logout" class="btn-logout-modal">LOG OUT</button>
            </div>
        `;
    } else {
        /* UI: GUEST MODE */
        return `
            <div class="profile-modal-inner guest-mode">
                <button class="close-btn" onclick="closeModal()">✕</button>
                <div class="guest-header">
                    <div class="guest-icon-circle"><i class="fas fa-user-secret"></i></div>
                    <h2>Guest Mode</h2>
                    <p>Connect your Nostr identity to start anchoring places on the map.</p>
                </div>
                <button id="btn-modal-login" class="btn-login-modal">
                    <i class="fas fa-key"></i> CONNECT WITH ALBY / NOS2X
                </button>
            </div>
        `;
    }
}

/* Generates HTML for the temporary Draft modal. */
export function getDraftModalHTML(lat, lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    const options = CATEGORIAS.map(cat => `<option value="${cat.id}">${cat.label}</option>`).join('');
    return `
        <div class="profile-modal-inner draft-modal">
            <button class="close-btn" id="btn-close-draft">✕</button>
            <div class="profile-main-header">
                <h2 style="margin-top: 10px;">Provisional Anchor</h2>
                <span class="pubkey-badge">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
            </div>

            <div class="form-group" style="width: 100%; text-align: left;">
                <label>PLACE TITLE</label>
                <input type="text" id="draft-title" placeholder="e.g., Corner Café..." 
                       style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); margin-top: 5px;">
            </div>

            <div class="form-group" style="width: 100%; text-align: left; margin-bottom: 15px;">
                <label>CATEGORY</label>
                <select id="draft-category" style="width: 100%; padding: 12px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.1); margin-top: 5px;">
                    <option value="">Select category...</option>
                    ${options}
                </select>
            </div>
            
            <div class="photo-upload-zone" id="draft-upload-zone" style="width: 100%; border: 2px dashed rgba(88, 81, 219, 0.3); padding: 20px; border-radius: 20px; text-align: center; cursor: pointer; background: rgba(255,255,255,0.3);">
                <i class="fas fa-camera" style="font-size: 24px; color: #8e44ad; margin-bottom: 10px;"></i>
                <p style="font-size: 11px; font-weight: bold; color: #8e44ad; margin: 0;">UPLOAD OR TAKE PHOTO</p>
                <input type="file" id="draft-photo" accept="image/*" multiple style="display: none;">
            </div>
            <div id="preview-container" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;"></div>
            <div id="draft-preview-container" style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;"></div>
            <button id="btn-save-draft" class="btn-primary">
                SAVE TO JOURNAL
            </button>
        </div>
    `;
}

/* Updates visible info on the floating user button. */
export function updateFloatingUser(profile = null) {
    if (profile) {
        userNameMini.textContent = profile.display_name || profile.name || "User";
        if (profile.picture) userAvatarMini.src = profile.picture;
        
        const npubShort = AuthManager.userPubkey ? AuthManager.userPubkey.substring(0, 8) : '...';
        userPubkeyMini.textContent = '@' + npubShort;
    } else {
        userNameMini.textContent = "Guest";
        userAvatarMini.src = "https://www.gravatar.com/avatar/0?d=mp";
        userPubkeyMini.textContent = "@...";
    }
}

/* Opens the modal container and injects provided HTML. */
export function openModal(html) {
    modalContent.innerHTML = html;
    modalContainer.style.display = 'flex';
}

/* Closes and clears the modal. */
export function closeModal() {
    modalContainer.style.display = 'none';
    modalContent.innerHTML = '';
}

/* Centralized state definitions for scalability. */
const ANCHOR_STATES = {
    1: { label: 'ANCHORED', class: 'public', canPublish: false },
    30024: { label: 'DRAFT', class: 'draft', canPublish: true }
};

/* Generates dynamic HTML for the Journal/Logbook table. */
export function getJournalModalHTML(entries = []) {
    const rows = entries.map(ev => {
        const config = ANCHOR_STATES[ev.kind] || { label: 'Unknown', class: 'unknown', canPublish: false };
        
        /* 1. Logic for dynamic titles. */
        const title = ev.kind === 1 
            ? (ev.content.split('\n\n')[0] || "Public Anchor") 
            : (ev.tags.find(t => t[0] === 'title')?.[1] || 'Untitled');

        /* 2. Coordinates and Date. */
        const coords = ev.tags.find(t => t[0] === 'g')?.[1] || '0,0';
        const [lat, lng] = coords.split(',');
        const date = new Date(ev.created_at * 1000).toLocaleDateString();
        
        /* 3. Robust category logic. */
        const catId = ev.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor')?.[1];
        const catInfo = CATEGORIAS.find(c => c.id === catId);
        const categoryText = catInfo ? catInfo.label : '-';

        /* 4. Dynamic status badge. */
        const statusBadge = `<span class="status-pill ${config.class}">${config.label}</span>`;

        return `
            <tr>
                <td class="journal-date">${date}</td>
                <td style="font-weight: 700;">${title}</td>
                <td style="color: #5851db; font-weight: 600;">${categoryText}</td>
                <td style="text-align: center;">${statusBadge}</td>
                <td>
                    <div class="actions-row">
                    <button class="btn-action-icon" 
                        onclick="window.centerMapAndOpenPopup('${ev.id}', ${lat}, ${lng})" 
                        title="View on Map">📍</button>
                        ${config.canPublish ? `<button class="btn-action-icon" onclick="window.completeAnchor('${ev.id}')" title="Publish">🚀</button>` : ''}
                        <button class="btn-action-icon" onclick="window.deleteEntry('${ev.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="profile-modal-inner" style="max-width: 800px;">
            <button class="close-btn" id="btn-close-journal">✕</button>
            <h2 style="font-size: 24px; font-weight: 800; color: #1a1a1a; align-self: center;">Anchor Journal</h2>
            
            <div class="journal-white-container">
                <table class="journal-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th style="text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="5" style="text-align:center; padding: 40px; color: #999;">No entries found yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

/* Initializes floating button events. */
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
            if (closeBtn) closeBtn.onclick = () => closeModal();
        });
    }

    /* Journal Button Click Logic. */
    document.getElementById('btn-open-journal')?.addEventListener('click', async () => {
        if (!AuthManager.isLoggedIn()) {
            showToast("Log in to your Nostr identity to see your Journal.", "error");
            return;
        }

        /* Open modal with initial loading state. */
        openModal(getJournalModalHTML([])); 
        
        /* Calls global function defined in main.js. */
        if (window.fetchAndShowJournal) {
            window.fetchAndShowJournal();
        }

        const closeBtn = document.getElementById('btn-close-journal');
        if (closeBtn) closeBtn.onclick = () => closeModal();
    });

    /* Close modal when clicking outside. */
    modalContainer?.addEventListener('click', (e) => {
        if (e.target === modalContainer) closeModal();
    });

    /* Initial floating button update. */
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

/* Generates HTML for the final Publication modal. */
export function getPublishModalHTML(lat, lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    const categoryOptions = CATEGORIAS.map(cat => 
        `<option value="${cat.id}">${cat.label}</option>`
    ).join('');

    return `
        <div class="modal-card glass-panel-modal">
            <button id="btn-close-publish" class="close-btn-alt">×</button>
            <h2 class="modal-title">🚀 Publish Anchor</h2>
            <p class="modal-coords">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            
            <div class="form-group">
                <label>PLACE NAME</label>
                <input type="text" id="pub-title" class="glass-input" placeholder="e.g., Corner Café...">
            </div>

            <div class="form-group">
                <label>DESCRIPTION / REVIEW</label>
                <textarea id="pub-description" class="glass-textarea" placeholder="Tell us why this place is special..."></textarea>
            </div>

            <div class="form-group">
                <label>CATEGORY</label>
                <select id="pub-category" class="glass-select">
                    ${categoryOptions} 
                </select>
            </div>

            <div id="pub-upload-zone" class="upload-zone-publish">
                <input type="file" id="pub-photo" multiple accept="image/*" style="display: none;">
                <i class="fas fa-camera"></i>
                <p>UPLOAD OR TAKE PHOTO</p>
            </div>
            <div id="pub-preview-container" class="preview-grid"></div>

            <button id="btn-do-publish" class="btn-primary-publish">PUBLISH TO NOSTR</button>
        </div>
    `;
}

/* Renders a toast notification on screen. */
export function showToast(message, type = 'success', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-card ${type}`;
    
    const icon = type === 'success' ? '🚀' : '⚠️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px) scale(0.9)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

window.showToast = showToast;

/* Generates HTML for the confirmation modal. */
export function getConfirmModalHTML(message, onConfirm) {
    window.executeConfirmAction = () => {
        onConfirm();
        closeModal();
    };

    return `
        <div class="modal-card glass-panel-modal" style="max-width: 320px; text-align: center; padding: 30px;">
            <div style="font-size: 40px; margin-bottom: 15px;">⚠️</div>
            <h3 style="color: #5851db; margin-bottom: 10px; font-size: 20px;">Confirm Action?</h3>
            <p style="font-size: 14px; color: #555; line-height: 1.5; margin-bottom: 25px;">${message}</p>
            
            <div style="display: flex; gap: 12px; justify-content: center;">
                <button onclick="window.closeModal()" class="glass-input" 
                        style="margin-top:0; cursor:pointer; font-weight:700; background: rgba(0,0,0,0.05);">
                    CANCEL
                </button>
                <button onclick="window.executeConfirmAction()" class="btn-primary-publish" 
                        style="margin-top:0; background: #e74c3c; padding: 10px 20px; flex: 1;">
                    DELETE
                </button>
            </div>
        </div>
    `;
}

window.closeModal = closeModal;