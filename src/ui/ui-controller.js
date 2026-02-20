import { AuthManager } from '../core/auth.js';
import { CATEGORIAS } from '../core/categories.js';

/* --- FLOATING UI ELEMENTS --- */
const userNameMini = document.getElementById('user-name-mini');
const userAvatarMini = document.getElementById('user-avatar-small');
const userPubkeyMini = document.getElementById('user-pubkey-mini');

/* --- MODAL ELEMENTS --- */
const modalContainer = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');

/**
 * Generates dynamic HTML for the profile modal based on session state.
 */
function getProfileModalHTML(profile = null) {
    if (profile) {
        const npubShort = AuthManager.userPubkey.substring(0, 10) + '...';
        const isReadOnly = AuthManager.loginMethod === 'read-only';
        const isConnect = AuthManager.loginMethod === 'connect';

        return `
            <div class="p-8 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in duration-300">
                <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl transition-colors" onclick="closeModal()">✕</button>
                <div class="flex flex-col items-center">
                    <div class="relative">
                        <img src="${profile.picture || 'https://www.gravatar.com/avatar/0?d=mp'}" alt="Avatar" 
                             class="w-24 h-24 rounded-full border-4 border-indigo-500 shadow-xl object-cover">
                        <div class="absolute bottom-0 right-0 w-6 h-6 ${(isReadOnly || isConnect) ? 'bg-amber-400' : 'bg-green-500'} border-2 border-white rounded-full flex items-center justify-center text-[10px]">
                            ${isConnect ? '🔗' : ''}
                        </div>
                    </div>
                    <h2 class="mt-4 text-2xl font-black text-slate-900 leading-tight">¡Hola, ${profile.display_name || profile.name || 'User'}!</h2>
                    <div class="flex flex-col items-center gap-2 mt-1">
                        <span class="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-mono text-slate-500 tracking-wider uppercase border border-slate-200">${npubShort}</span>
                        ${isReadOnly ? `
                            <span class="bg-amber-50 text-amber-600 text-[9px] font-black px-2 py-0.5 rounded border border-amber-100 uppercase tracking-widest">
                                👁️ Modo Solo Lectura
                            </span>
                        ` : ''}
                        ${isConnect ? `
                            <span class="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-widest">
                                🔗 Nostr Connect
                            </span>
                        ` : ''}
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-1 w-full bg-slate-50/50 p-4 rounded-3xl border border-slate-100">
                    <div class="flex flex-col"><strong class="text-lg font-black text-slate-900">24K</strong><span class="text-[9px] font-bold text-slate-400 uppercase">⚡ SATS</span></div>
                    <div class="flex flex-col border-x border-slate-200"><strong class="text-lg font-black text-slate-900">${profile.following || 0}</strong><span class="text-[9px] font-bold text-slate-400 uppercase">FOLLOWING</span></div>
                    <div class="flex flex-col"><strong class="text-lg font-black text-slate-900">${profile.followers || 0}</strong><span class="text-[9px] font-bold text-slate-400 uppercase">FOLLOWERS</span></div>
                </div>

                <div class="w-full text-left">
                    <p id="profile-about" class="text-sm text-slate-600 leading-relaxed mb-6 italic">
                        "${profile.about?.length > 150
                ? `${profile.about.substring(0, 150)}... <button onclick="window.showFullDescription('profile')" class="text-indigo-600 font-bold not-italic">Ver más</button>`
                : (profile.about || 'No description provided on Nostr.')}"
                    </p>
                    ${isReadOnly ? `
                        <div class="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 text-xs text-indigo-700 font-medium">
                            Conecta una extensión o usa Nostr Connect para poder publicar anclas.
                        </div>
                    ` : `
                        <button class="w-full flex items-center justify-center gap-2 py-3 border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                            <i class="fas fa-user-gear text-indigo-500"></i> Ajustes de Perfil
                        </button>
                    `}
                </div>

                <button id="btn-modal-logout" class="w-full py-4 bg-slate-100 text-rose-500 rounded-2xl font-black hover:bg-rose-50 hover:text-rose-600 transition-all uppercase tracking-widest text-xs">
                    CERRAR SESIÓN
                </button>
            </div>
        `;
    } else {
        return `
            <div class="p-10 flex flex-col items-center text-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl transition-colors" onclick="closeModal()">✕</button>
                <div class="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-2 shadow-inner">
                    <i class="fas fa-user-secret text-4xl text-indigo-600"></i>
                </div>
                <div>
                    <h2 class="text-2xl font-black text-slate-900 leading-tight">Conectar Identidad</h2>
                    <p class="mt-2 text-slate-500 text-sm leading-relaxed max-w-[240px]">Para anclar lugares o guardar favoritos, conecta tu cuenta de Nostr.</p>
                </div>
                
                <div class="w-full flex flex-col gap-4">
                    <button id="btn-modal-login" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl group">
                        <i class="fas fa-key text-indigo-400 group-hover:rotate-12 transition-transform"></i> USAR EXTENSIÓN (ALBY/NOS2X)
                    </button>
                    
                    <button id="btn-show-manual" class="text-[11px] font-black text-slate-400 hover:text-indigo-500 transition-colors uppercase tracking-widest">
                        O CONECTAR MANUALMENTE (npub/email)
                    </button>

                    <div id="manual-login-section" class="hidden flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
                        <div class="h-[1px] bg-slate-100 w-full my-1"></div>
                        
                        <label class="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">LECTURA (npub/NIP-05)</label>
                        <input type="text" id="manual-pubkey-input" placeholder="npub... o usuario@dominio" 
                               class="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm">
                        <button id="btn-manual-login" class="w-full py-3 bg-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-300">
                            ENTRAR MODO LECTURA
                        </button>

                        <div class="h-[1px] bg-slate-100 w-full my-2"></div>

                        <label class="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">FIRMA REMOTA (Bunker URL)</label>
                        <input type="text" id="bunker-url-input" placeholder="bunker://pubkey?relay=..." 
                               class="w-full p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm">
                        <button id="btn-connect-login" class="w-full py-3 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                            CONECTAR SIGNER
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

/**
 * Generates HTML for the temporary Draft modal.
 */
export function getDraftModalHTML(lat, lng) {
    const options = CATEGORIAS.map(cat => `<option value="${cat.id}">${cat.label}</option>`).join('');
    return `
        <div class="p-8 flex flex-col gap-6 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl transition-colors" id="btn-close-draft">✕</button>
            <div class="text-center">
                <h2 class="text-2xl font-black text-slate-900">Ancla Provisional</h2>
                <span class="inline-block mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-mono font-bold border border-indigo-100 uppercase tracking-widest">
                    📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}
                </span>
            </div>

            <div class="space-y-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">TÍTULO DEL LUGAR</label>
                    <input type="text" id="draft-title" placeholder="Ej: Café de la Esquina..." 
                           class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400">
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">CATEGORÍA</label>
                    <select id="draft-category" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800">
                        <option value="">Seleccionar categoría...</option>
                        ${options}
                    </select>
                </div>
                
                <div id="draft-upload-zone" class="relative group cursor-pointer border-2 border-dashed border-indigo-200 p-8 rounded-[24px] bg-indigo-50/30 hover:bg-indigo-50/50 hover:border-indigo-400 transition-all text-center">
                    <input type="file" id="draft-photo" accept="image/*" multiple class="hidden">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-camera text-2xl text-indigo-500 group-hover:scale-110 transition-transform"></i>
                        <p class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">SUBIR O TOMAR FOTO</p>
                    </div>
                </div>
                <div id="draft-preview-container" class="flex gap-2 flex-wrap empty:hidden"></div>
            </div>

            <button id="btn-save-draft" class="w-full py-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs">
                GUARDAR EN DIARIO
            </button>
        </div>
    `;
}

/**
 * Updates visible info on the floating user button.
 */
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

export function openModal(html) {
    modalContent.innerHTML = html;
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
}

export function closeModal() {
    modalContainer.classList.add('hidden');
    modalContainer.classList.remove('flex');
    modalContent.innerHTML = '';
}

const ANCHOR_STATES = {
    1: { label: 'ANCHORED', color: 'bg-indigo-500', text: 'text-indigo-500' },
    30024: { label: 'DRAFT', color: 'bg-orange-500', text: 'text-orange-500' },
    'local': { label: 'LOCAL', color: 'bg-slate-900', text: 'text-slate-900' }
};

/**
 * Generates dynamic HTML for the Journal/Logbook table.
 */
export function getJournalModalHTML(entries = []) {
    const rows = entries.map(ev => {
        const config = ANCHOR_STATES[ev.kind] || { label: 'Unknown', color: 'bg-slate-400', text: 'text-slate-400' };

        const title = ev.kind === 1
            ? (ev.content.split('\n\n')[0] || "Public Anchor")
            : (ev.tags.find(t => t[0] === 'title')?.[1] || 'Untitled');

        const coords = ev.tags.find(t => t[0] === 'g')?.[1] || '0,0';
        const [lat, lng] = coords.split(',');
        const date = new Date(ev.created_at * 1000).toLocaleDateString();

        const catId = ev.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor')?.[1];
        const catInfo = CATEGORIAS.find(c => c.id === catId);
        const categoryText = catInfo ? catInfo.label : '-';

        return `
            <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td class="py-4 pl-6 text-[11px] font-bold text-slate-400 uppercase tracking-tighter">${date}</td>
                <td class="py-4 max-w-[200px] font-black text-slate-800 text-sm truncate">${title}</td>
                <td class="py-4">
                    <span class="font-bold text-indigo-500 text-[10px] uppercase tracking-wider">${categoryText}</span>
                </td>
                <td class="py-4 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[8px] font-black uppercase text-white ${config.color}">${config.label}</span>
                </td>
                <td class="py-4 pr-6">
                    <div class="flex items-center justify-end gap-2">
                        <button class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-all border border-indigo-100" 
                                onclick="window.centerMapAndOpenPopup('${ev.id}', ${lat}, ${lng})" title="View on Map">📍</button>
                        ${(ev.kind === 30024 || ev.kind === 'local') ? `<button class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-all border border-purple-100" onclick="window.completeAnchor('${ev.id}')" title="Publish">🚀</button>` : ''}
                        <button class="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100" onclick="window.deleteEntry('${ev.id}')" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="p-8 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300 w-full lg:max-w-3xl">
            <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl transition-colors" id="btn-close-journal">✕</button>
            <h2 class="text-2xl font-black text-slate-900 self-center">Diario de Anclas</h2>
            
            <div class="overflow-x-auto bg-white rounded-[24px] border border-slate-100 shadow-inner">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <th class="py-3 pl-6">Fecha</th>
                            <th class="py-3">Lugar</th>
                            <th class="py-3">Categoría</th>
                            <th class="py-3 text-center">Estado</th>
                            <th class="py-3 pr-6 text-right">Acción</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${rows || '<tr><td colspan="5" class="py-20 text-center font-bold text-slate-300 uppercase tracking-widest">No hay entradas aún.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

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

            // Extension Login
            document.getElementById('btn-modal-login')?.addEventListener('click', async () => {
                try {
                    await AuthManager.login();
                    location.reload();
                } catch (err) {
                    showToast(err.message, "error");
                }
            });

            // Toggle Manual Login Section
            document.getElementById('btn-show-manual')?.addEventListener('click', () => {
                const section = document.getElementById('manual-login-section');
                const btn = document.getElementById('btn-show-manual');
                if (section) {
                    section.classList.toggle('hidden');
                    btn.classList.add('hidden'); // Hide the toggle button when section is shown
                }
            });

            // Manual Login
            document.getElementById('btn-manual-login')?.addEventListener('click', async () => {
                const input = document.getElementById('manual-pubkey-input');
                const val = input ? input.value.trim() : "";
                if (!val) return showToast("Por favor ingresa una identidad", "info");

                const btn = document.getElementById('btn-manual-login');
                const originalText = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> CONECTANDO...';
                btn.disabled = true;

                try {
                    await AuthManager.loginManual(val);
                    location.reload();
                } catch (err) {
                    showToast(err.message, "error");
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            });

            // Nostr Connect Login
            document.getElementById('btn-connect-login')?.addEventListener('click', async () => {
                const input = document.getElementById('bunker-url-input');
                const val = input ? input.value.trim() : "";
                if (!val) return showToast("Ingresa una URL de Bunker", "info");

                const btn = document.getElementById('btn-connect-login');
                btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> CONECTANDO...';
                btn.disabled = true;

                try {
                    const signerPubkey = await nostrInstance.connect.connect(val);
                    const clientSecretHex = bytesToHex(nostrInstance.connect.clientSecretKey);

                    await AuthManager.loginConnect(signerPubkey, clientSecretHex);
                    showToast("¡Vínculo establecido!", "success");

                    setTimeout(() => location.reload(), 1000);
                } catch (err) {
                    showToast("Error al conectar: " + err.message, "error");
                    btn.innerHTML = 'CONECTAR SIGNER';
                    btn.disabled = false;
                }
            });

            document.getElementById('btn-modal-logout')?.addEventListener('click', () => {
                AuthManager.logout();
                location.reload();
            });
        });
    }

    document.getElementById('btn-open-journal')?.addEventListener('click', async () => {
        if (!AuthManager.isLoggedIn()) {
            showToast("Debes conectarte para ver tu diario.", "error");
            return;
        }
        openModal(getJournalModalHTML([]));
        if (window.fetchAndShowJournal) window.fetchAndShowJournal();
    });

    modalContainer?.addEventListener('click', (e) => {
        if (e.target === modalContainer) closeModal();
    });

    // Handle close buttons in modals via event delegation
    modalContent.addEventListener('click', (e) => {
        if (e.target.closest('#btn-close-journal') || e.target.closest('#btn-close-draft') || e.target.closest('#btn-close-publish')) {
            closeModal();
        }
    });

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

export function getPublishModalHTML(lat, lng) {
    const categoryOptions = CATEGORIAS.map(cat => `<option value="${cat.id}">${cat.label}</option>`).join('');
    return `
        <div class="p-8 flex flex-col gap-6 animate-in fade-in zoom-in duration-300 max-h-[90vh] overflow-y-auto w-full">
            <button id="btn-close-publish" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl transition-colors">×</button>
            <div class="text-center">
                <h2 class="text-2xl font-black text-slate-900 uppercase">🚀 Publicar Ancla</h2>
                <span class="inline-block mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-mono font-bold border border-indigo-100 uppercase tracking-widest">
                    📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}
                </span>
            </div>
            
            <div class="space-y-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">NOMBRE DEL LUGAR</label>
                    <input type="text" id="pub-title" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800" placeholder="Ej: Café de la Esquina...">
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">DESCRIPCIÓN / RESEÑA</label>
                    <textarea id="pub-description" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 h-24 resize-none" placeholder="Cuenta por qué este lugar es especial..."></textarea>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 uppercase tracking-widest ml-1">CATEGORÍA</label>
                    <select id="pub-category" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800">
                        ${categoryOptions} 
                    </select>
                </div>

                <div id="pub-upload-zone" class="relative group cursor-pointer border-2 border-dashed border-indigo-200 p-8 rounded-[24px] bg-indigo-50/30 hover:bg-indigo-50/50 hover:border-indigo-400 transition-all text-center">
                    <input type="file" id="pub-photo" multiple accept="image/*" class="hidden">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-camera text-2xl text-indigo-500 group-hover:scale-110 transition-transform"></i>
                        <p class="text-[10px] font-black text-indigo-600 uppercase tracking-widest">SUBIR O TOMAR FOTO</p>
                    </div>
                </div>
                <div id="pub-preview-container" class="grid grid-cols-4 gap-2 empty:hidden"></div>
            </div>

            <button id="btn-do-publish" class="w-full py-5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-xs">
                PUBLICAR EN NOSTR
            </button>
        </div>
    `;
}

export function showToast(message, type = 'success', duration = 3000) {
    let container = document.querySelector('#toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[3000] flex flex-col gap-2 pointer-events-none w-full px-5 max-w-sm';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-indigo-600 border-indigo-500 text-white',
        error: 'bg-rose-600 border-rose-500 text-white',
        info: 'bg-slate-800 border-slate-700 text-white'
    };

    toast.className = `${colors[type] || colors.info} p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 pointer-events-auto cursor-pointer`;

    const icon = type === 'success' ? '🚀' : '⚠️';
    toast.innerHTML = `<span class="text-xl">${icon}</span> <span class="font-black text-[12px] uppercase tracking-wider grow">${message}</span>`;

    toast.onclick = () => {
        toast.classList.add('animate-out', 'fade-out', 'zoom-out', 'duration-300');
        setTimeout(() => toast.remove(), 300);
    };

    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentElement) {
            toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-4', 'duration-500');
            setTimeout(() => toast.remove(), 500);
        }
    }, duration);
}

window.showToast = showToast;

export function getDescriptionModalHTML(title, description) {
    return `
        <div class="p-8 flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
            <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl transition-colors" onclick="closeModal()">✕</button>
            <div class="text-center">
                <h2 class="text-2xl font-black text-slate-900">${title}</h2>
                <div class="h-1 w-12 bg-indigo-500 rounded-full mx-auto mt-2"></div>
            </div>
            <div class="text-sm text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 italic">
                ${description.replace(/\n/g, '<br>')}
            </div>
            <button onclick="closeModal()" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-800 transition-all">
                CERRAR
            </button>
        </div>
    `;
}

export function getConfirmModalHTML(message, onConfirm) {
    window.executeConfirmAction = () => {
        onConfirm();
        closeModal();
    };

    return `
        <div class="p-8 flex flex-col items-center text-center gap-6 animate-in fade-in zoom-in duration-300">
            <div class="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center shadow-inner">
                <i class="fas fa-exclamation-triangle text-3xl text-rose-500"></i>
            </div>
            <div>
                <h3 class="text-2xl font-black text-slate-900 leading-tight">¿Confirmar Acción?</h3>
                <p class="mt-2 text-sm text-slate-500 leading-relaxed">${message}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-3 w-full">
                <button onclick="window.closeModal()" class="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]">
                    CANCELAR
                </button>
                <button onclick="window.executeConfirmAction()" class="py-4 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all uppercase tracking-widest text-[10px]">
                    ELIMINAR
                </button>
            </div>
        </div>
    `;
}

window.closeModal = closeModal;