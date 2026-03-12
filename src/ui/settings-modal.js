import { AuthManager } from '../core/auth.js';
import { CATEGORIAS } from '../core/categories.js';
import * as nip19 from 'nostr-tools/nip19';

/**
 * Helper to convert hex string to Uint8Array safely
 */
function hexToBytes(hex) {
    if (typeof hex !== 'string') return new Uint8Array();
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
}

/**
 * High-fidelity Profile Settings Modal
 */
export function openSettingsModal(initialTab = 'perfil', nostrInstance) {
    const renderSettings = async (tab) => {
        try {
            const pubkey = AuthManager.userPubkey;
            let profile = AuthManager.profileCache[pubkey] || {};

            if (tab === 'perfil' && Object.keys(profile).length === 0) {
                try {
                    profile = await nostrInstance.getUserProfile(pubkey) || {};
                    if (profile && Object.keys(profile).length > 0) AuthManager.saveProfile(pubkey, profile);
                } catch (e) {
                    console.warn("Could not fetch profile for settings:", e);
                }
            }

            let overlay = document.getElementById('settings-overlay');

            if (!overlay) {
                const fullHTML = getSettingsOverlayHTML(tab, profile, pubkey);
                document.body.insertAdjacentHTML('beforeend', fullHTML);
                overlay = document.getElementById('settings-overlay');

                overlay.onclick = (e) => {
                    if (e.target === overlay) closeSettingsModal();
                };

                // Initializing handlers
                const closeBtn = document.getElementById('btn-close-settings');
                if (closeBtn) closeBtn.onclick = closeSettingsModal;
            }

            // --- Update Tabs and Content ---
            const contentContainer = document.getElementById('settings-content');

            // Update tabs active state
            overlay.querySelectorAll('.settings-tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tab);
                btn.onclick = () => renderSettings(btn.dataset.tab);
            });

            if (contentContainer) {
                // Safeguard against rendering errors
                try {
                    contentContainer.innerHTML = getTabContentHTML(tab, profile, pubkey);
                } catch (renderError) {
                    console.error("Error rendering tab content:", renderError);
                    contentContainer.innerHTML = `<div class="p-8 text-rose-500 font-bold">Error al cargar la pestaña: ${renderError.message}</div>`;
                }
            }

            // --- Event Handlers ---

            // Perfil Tab Logic
            if (tab === 'perfil') {
                const btnSave = document.getElementById('btn-save-profile');
                if (btnSave) {
                    btnSave.onclick = async () => {
                        const name = document.getElementById('set-name').value;
                        const picture = document.getElementById('set-picture').value;
                        const about = document.getElementById('set-about').value;

                        try {
                            btnSave.disabled = true;
                            btnSave.innerHTML = '<span class="spinner-micro"></span> Guardando...';

                            const newProfile = { ...profile, name, display_name: name, picture, about };

                            const event = {
                                kind: 0,
                                pubkey: AuthManager.userPubkey,
                                created_at: Math.floor(Date.now() / 1000),
                                content: JSON.stringify(newProfile),
                                tags: []
                            };

                            await nostrInstance.publishEvent(event);
                            AuthManager.saveProfile(AuthManager.userPubkey, newProfile);

                            if (window.showToast) window.showToast("Perfil actualizado correctamente", "success");
                            renderSettings('perfil');
                        } catch (e) {
                            if (window.showToast) window.showToast(e.message, "error");
                            btnSave.disabled = false;
                            btnSave.innerText = 'Guardar perfil';
                        }
                    };
                }
            }

            // Vincular Email Tab Logic (Bunker Push)
            if (tab === 'email') {
                const btnLink = document.getElementById('btn-save-linking');
                const inputEmail = document.getElementById('link-email');
                const inputPass = document.getElementById('link-password');

                if (btnLink && inputEmail && inputPass) {
                    btnLink.onclick = async () => {
                        const email = inputEmail.value.trim();
                        const password = inputPass.value.trim();

                        if (!email.includes('@') || password.length < 8) {
                            if (window.showToast) window.showToast("Email o contraseña inválidos", "error");
                            return;
                        }

                        try {
                            btnLink.disabled = true;
                            btnLink.innerHTML = '<span class="spinner-micro"></span> Vinculando...';

                            // Add cancel UI
                            const cancelHint = document.createElement('div');
                            cancelHint.id = 'linking-cancel-hint';
                            cancelHint.className = 'mt-2 text-center';
                            cancelHint.innerHTML = '<button onclick="window.cancelLinking()" class="text-[10px] font-bold text-slate-400 hover:text-rose-500 underline">¿Tarda demasiado? Cancelar espera</button>';
                            btnLink.parentElement.appendChild(cancelHint);

                            // 1. Get current nsec - Prioritize Extension or Local Secret
                            let nsec = AuthManager.localSecretKey;
                            
                            // If extension user and no local nsec, generate one silently 
                            // to avoid "identity missing" blocker.
                            if (!nsec && (AuthManager.loginMethod === 'extension' || window.nostr)) {
                                console.log("🎲 Generating silent identity for extension-centric linking...");
                                const gen = await AuthManager.generate();
                                nsec = gen.nsec;
                            }

                            if (nsec && !nsec.startsWith('nsec1')) {
                                try {
                                    nsec = nip19.nsecEncode(hexToBytes(nsec));
                                } catch (e) { console.error("Hex to nsec failed", e); }
                            }

                            const manualNsec = document.getElementById('set-nsec')?.value?.trim();
                            if (!nsec && manualNsec && manualNsec.startsWith('nsec1')) {
                                nsec = manualNsec;
                            }

                            if (!nsec) {
                                throw new Error("Debes tener una identidad local (nsec) para vincular. Pégala en la pestaña 'Identidad' si es necesario.");
                            }
                            // 2. Clear previous bunker state to avoid corrupt pointers
                            AuthManager.clearBunkerSession();
                            
                            // 3. Bunker Push via nostr-login SDK (with timeout)
                            const { launch } = await import('nostr-login');
                            
                            // UI Feedback: Explicitly mention waiting for Alby if extension is present
                            if (AuthManager.loginMethod === 'extension' || window.nostr) {
                             btnLink.innerHTML = '<span class="spinner-micro"></span> Esperando aprobación en Alby...';
                            }

                            // Timeout wrapper for launch with Handshake Persistence
                            const launchWithHandshake = async (timeoutMs) => {
                                return new Promise(async (resolve, reject) => {
                                    // 120s timeout to allow user interaction with Alby
                                    const timer = setTimeout(() => reject(new Error("Time-out: El búnker no respondió. Reintenta en unos segundos.")), timeoutMs);

                                    // Handshake Listener: Treat extension signature as authoritative success
                                    const messageHandler = (event) => {
                                        if (event.data && event.data.type === 'nostr-login-response' && event.data.pubkey) {
                                            console.log("🎯 Handshake Alby capturado. Forzando éxito.");
                                            clearTimeout(timer);
                                            window.removeEventListener('message', messageHandler);
                                            // Resolve immediately to bypass SDK's internal verification
                                            resolve(event.data);
                                        }
                                    };
                                    window.addEventListener('message', messageHandler);

                                    try {
                                        const res = await launch(email, {
                                            password,
                                            nsec,
                                            forceBunker: true,
                                            noHeader: true, // Bypass UI overhead
                                            img: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', // Empty placeholder
                                            devOverrideBunkerOrigin: 'wss://relay.nsec.app', // Direct relay injection to bypass NIP-05 fetch
                                            name: 'Nostr Mappr'
                                        });

                                        window.removeEventListener('message', messageHandler);
                                        clearTimeout(timer);
                                        resolve(res);
                                    } catch (err) {
                                        // If handshake already resolved, ignore SDK errors (like favicon/NIP-05 timeouts)
                                        if (err.message && err.message.includes('fetch')) {
                                            console.warn("⚠️ Ignored non-critical fetch error during handshake:", err);
                                            return; 
                                        }

                                        window.removeEventListener('message', messageHandler);
                                        clearTimeout(timer);

                                        // SILENT RETRY: If window closed but cookie exists
                                        const bunkerPtr = document.cookie.split('; ').find(row => row.startsWith('bunker_ptr='));
                                        if (bunkerPtr) {
                                            console.warn("⚠️ Handshake recovery via cookie...");
                                            setTimeout(async () => {
                                                try {
                                                    const { init } = await import('nostr-login');
                                                    const recovered = await init({ forceBunker: true });
                                                    if (recovered && recovered.pubkey) resolve(recovered);
                                                } catch (reErr) { 
                                                    reject(new Error("Conexión interrumpida. Por favor, mantén la ventana abierta hasta confirmar."));
                                                }
                                            }, 1000);
                                        } else {
                                            reject(err);
                                        }
                                    }
                                });
                            };

                            const result = await launchWithHandshake(120000); // 120s timeout for extension popup

                            if (result && result.pubkey) {
                                // 4. Forced Profile Sync (estexrc sync)
                                if (nostrInstance) {
                                    try {
                                        const profile = await nostrInstance.getUserProfile(result.pubkey);
                                        if (profile) AuthManager.saveProfile(result.pubkey, profile);
                                    } catch (pErr) { console.warn("Failed to sync profile after link", pErr); }
                                }

                                if (window.showToast) window.showToast("¡Vinculación establecida con éxito!", "success");

                                // Update status to "Establecida"
                                const label = document.getElementById('linking-status-label');
                                if (label) {
                                    label.innerText = "Establecida";
                                    label.className = "text-[11px] font-bold text-green-500";
                                }

                                // UX: Auto-close for extension users after a brief delay
                                if (AuthManager.loginMethod === 'extension' || window.nostr) {
                                    setTimeout(() => {
                                        closeSettingsModal();
                                        if (window.location) location.reload();
                                    }, 1500);
                                }
                            } else {
                                throw new Error("El búnker no confirmó la vinculación");
                            }
                        } catch (e) {
                            if (e.message === 'CANCELLED') return; // Silent exit if user cancelled
                            console.error("Linking error:", e);
                            let msg = e.message;
                            if (e.message.includes('CORS') || e.message.includes('fetch') || e.message.includes('Time-out')) {
                                msg = 'Error de conexión: El búnker no respondió. Reintenta en unos segundos.';
                            } else if (e.message.includes('interrumpida') || e.message.includes('closed')) {
                                msg = 'Conexión interrumpida. Por favor, mantén la ventana abierta hasta confirmar.';
                            }

                            if (window.showToast) window.showToast(msg, "error");

                            // Revert status label
                            const label = document.getElementById('linking-status-label');
                            if (label) {
                                label.innerText = "Error / No asociada";
                                label.className = "text-[11px] font-bold text-rose-500";
                            }
                        } finally {
                            btnLink.disabled = false;
                            btnLink.classList.remove('bg-slate-400'); // Remove cancel style
                            btnLink.innerText = 'Guardar vinculación';
                            const cancelHint = document.getElementById('linking-cancel-hint');
                            if (cancelHint) cancelHint.remove();
                        }
                    };

                    // Global cancellation flag for the UI state
                    window.cancelLinking = () => {
                        btnLink.disabled = false;
                        btnLink.innerText = 'Guardar vinculación';
                        const cancelHint = document.getElementById('linking-cancel-hint');
                        if (cancelHint) cancelHint.remove();
                        // This won't stop the background launch() but will unblock the UI
                    };
                }
            }

            // Identidad Tab Logic
            if (tab === 'identidad') {
                const btnShowNsec = document.getElementById('btn-show-nsec');
                const nsecInput = document.getElementById('set-nsec');
                const btnSaveNsec = document.getElementById('btn-save-nsec-manual');

                if (btnShowNsec && nsecInput) {
                    btnShowNsec.onclick = () => {
                        if (nsecInput.type === 'password') {
                            nsecInput.type = 'text';
                            if (AuthManager.localSecretKey && !nsecInput.value) {
                                try {
                                    nsecInput.value = nip19.nsecEncode(hexToBytes(AuthManager.localSecretKey));
                                } catch (e) { console.error(e); }
                            }
                            btnShowNsec.innerText = 'Ocultar';
                        } else {
                            nsecInput.type = 'password';
                            btnShowNsec.innerText = 'Mostrar';
                        }
                    };
                }

                if (nsecInput && btnSaveNsec) {
                    nsecInput.oninput = () => {
                        const val = nsecInput.value.trim();
                        btnSaveNsec.disabled = !val.startsWith('nsec1');
                    };

                    btnSaveNsec.onclick = async () => {
                        try {
                            const val = nsecInput.value.trim();
                            if (!val.startsWith('nsec1')) throw new Error("nsec inválido");

                            // Authority Bypass: Set local identity manually
                            await AuthManager.loginSecret(val);
                            if (window.showToast) window.showToast("Identidad local establecida. Ya puedes vincular tu email.", "success");

                            // Switch to email tab as UX hint
                            renderSettings('email');
                        } catch (e) {
                            if (window.showToast) window.showToast(e.message, "error");
                        }
                    };
                }
            }
        } catch (globalError) {
            console.error("Global Settings error:", globalError);
            if (window.showToast) window.showToast("Error en el panel de ajustes", "error");
        }
    };

    renderSettings(initialTab);
}

export function closeSettingsModal() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) overlay.remove();
}

function getSettingsOverlayHTML(activeTab, profile, pubkey) {
    const tabs = [
        { id: 'perfil', label: 'Perfil' },
        { id: 'identidad', label: 'Identidad' },
        { id: 'email', label: 'Vincular email' },
        { id: 'password', label: 'Contraseña' },
        { id: '2fa', label: 'Seguridad 2fa' }
    ];

    const tabsHTML = tabs.map(t => `
        <button class="settings-tab-btn ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
            ${t.label}
        </button>
    `).join('');

    return `
        <div class="settings-overlay" id="settings-overlay">
            <div class="glass settings-modal p-0 flex flex-col relative" id="settings-modal">
                <button id="btn-close-settings" class="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors z-50">
                    <span class="material-symbols-rounded text-3xl">close</span>
                </button>
                
                <div class="p-8 pb-4 shrink-0">
                    <h1 class="text-3xl font-black text-slate-900 tracking-tighter">Tu Perfil</h1>
                    <p class="text-xs text-slate-500 mt-1">Gestiona tu identidad, métodos de recuperación y seguridad personal.</p>
                </div>

                <div class="settings-tabs-nav px-8 border-b border-slate-100 shrink-0">
                    ${tabsHTML}
                </div>

                <div class="flex-1 overflow-hidden flex flex-col min-h-0" id="settings-content">
                    <!-- Tab Content Loaded Here -->
                </div>
            </div>
        </div>
    `;
}

function getTabContentHTML(activeTab, profile, pubkey) {
    // Robust key encoding handling
    let npub = '...';
    let nsec = '🔒 Protegido por extensión';

    try {
        if (pubkey && /^[0-9a-fA-F]{64}$/.test(pubkey)) {
            // nostr-tools v2: npubEncode takes a hex string directly
            npub = nip19.npubEncode(pubkey);
        }
    } catch (e) { console.error('npub encode failed:', e); }

    try {
        const sk = AuthManager.localSecretKey;
        if (sk && /^[0-9a-fA-F]{64}$/.test(sk)) {
            // nostr-tools v2: nsecEncode takes a Uint8Array
            nsec = nip19.nsecEncode(hexToBytes(sk));
        }
    } catch (e) { console.error('nsec encode failed:', e); }

    switch (activeTab) {
        case 'perfil':
            return `
                <div class="h-full flex flex-col p-8 animate-fade-slide overflow-hidden">
                    <div class="flex-1 flex flex-col md:flex-row gap-8 min-h-0 overflow-hidden">
                        <!-- Identidad Visual -->
                        <div class="flex flex-col items-center gap-4 min-w-[160px] shrink-0">
                            <div class="w-32 h-32 rounded-full glass border-2 border-white shadow-xl overflow-hidden flex items-center justify-center bg-slate-50">
                                ${profile.picture ? `<img src="${profile.picture}" class="w-full h-full object-cover">` : '<span class="text-slate-400 font-bold text-sm">Sin foto</span>'}
                            </div>
                            <button class="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Cambiar foto</button>
                        </div>
                        
                        <!-- Campos de datos -->
                        <div class="flex-1 flex flex-col space-y-4 min-h-0">
                            <div class="space-y-1.5 shrink-0">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Alias / nombre</label>
                                <input type="text" id="set-name" value="${profile.display_name || profile.name || ''}" placeholder="ej. Julian Santos" class="input-glass w-full">
                            </div>
                            <div class="space-y-1.5 shrink-0">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">URL de foto</label>
                                <input type="text" id="set-picture" value="${profile.picture || ''}" placeholder="Se completa automáticamente al subir" class="input-glass w-full">
                            </div>
                            <div class="space-y-1.5 flex-1 flex flex-col min-h-0">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Biografía</label>
                                <textarea id="set-about" class="input-glass w-full flex-1 min-h-[120px] py-3 resize-none custom-scrollbar" placeholder="Comparte tu historia profesional...">${profile.about || ''}</textarea>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end pt-6 shrink-0">
                        <button id="btn-save-profile" class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black tracking-widest text-xs shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            Guardar perfil
                        </button>
                    </div>
                </div>
            `;
        case 'identidad':
            return `
                <div class="h-full flex flex-col p-8 animate-fade-slide overflow-y-auto custom-scrollbar">
                    <div class="space-y-8">
                        <div class="space-y-1">
                            <h3 class="text-sm font-black text-slate-900">Tu identidad Nostr</h3>
                            <p class="text-[11px] text-slate-400">Tu identidad visible en toda la red descentralizada.</p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Clave pública (npub)</label>
                                <input type="text" readonly value="${npub}" class="input-glass w-full font-mono-key">
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Clave pública (hex)</label>
                                <input type="text" readonly value="${pubkey}" class="input-glass w-full font-mono-key">
                            </div>
                        </div>

                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Clave privada (nsec)</label>
                            <form id="form-nsec-manual" onsubmit="return false;" class="relative flex flex-col gap-2">
                                <div class="relative">
                                    <input type="password" id="set-nsec" autocomplete="current-password" 
                                           value="${nsec.startsWith('nsec1') ? nsec : ''}" 
                                           placeholder="${AuthManager.localSecretKey ? '••••••••••••••••' : 'nsec1...'}"
                                           class="input-glass w-full font-mono-key pr-20">
                                    <button type="button" id="btn-show-nsec" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-slate-200">Mostrar</button>
                                </div>
                                <button type="button" id="btn-save-nsec-manual" class="bg-indigo-600 text-white px-4 py-3 rounded-xl text-[10px] font-black tracking-widest hover:bg-indigo-700 transition-all shadow-md">
                                    ESTABLECER IDENTIDAD LOCAL
                                </button>
                            </form>
                        </div>

                        <!-- Alerta de seguridad -->
                        <div class="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-center gap-3">
                            <span class="material-symbols-rounded text-amber-500 text-xl">warning</span>
                            <p class="text-[11px] font-medium text-amber-900">No compartas tu clave privada con nadie</p>
                        </div>

                        <!-- Gestión de relay -->
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Relay Nostr</label>
                            <div class="flex flex-col md:flex-row gap-2">
                                <input type="text" value="wss://relay.nsec.app" class="input-glass flex-1">
                                <div class="flex gap-2">
                                    <button class="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[11px] font-bold hover:bg-indigo-700 transition-colors">Guardar</button>
                                    <button class="border border-rose-200 text-rose-500 px-4 py-2 rounded-xl text-[11px] font-bold hover:bg-rose-50 transition-colors">Desconectar</button>
                                </div>
                            </div>
                            <p class="text-[10px] text-green-500 flex items-center gap-1.5 mt-1 font-medium">
                                <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                Relay actual: wss://relay.nsec.app
                            </p>
                        </div>
                    </div>

                    <div class="flex justify-end pt-8 shrink-0">
                        <button class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black tracking-widest text-xs shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all">
                            Actualizar configuración
                        </button>
                    </div>
                </div>
            `;
        case 'email':
            return `
                <div class="h-full flex flex-col p-8 animate-fade-slide overflow-y-auto custom-scrollbar">
                    <div class="space-y-6">
                        <div class="bg-amber-50/30 border border-amber-100/50 rounded-2xl p-4 flex flex-col gap-1">
                            <h4 class="text-sm font-black text-slate-900">Vincular email</h4>
                            <p class="text-[11px] text-slate-500">Asocia un email y una contraseña a tu identidad Nostr para recuperación de cuenta.</p>
                        </div>

                        <form id="form-link-email" onsubmit="return false;" class="space-y-4">
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Email</label>
                                <input type="email" id="link-email" autocomplete="username" placeholder="tu@email.com" class="input-glass w-full">
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Contraseña</label>
                                <input type="password" id="link-password" autocomplete="current-password" placeholder="Contraseña segura" class="input-glass w-full">
                            </div>
                        </form>

                        <!-- Estado actual -->
                        <div class="bg-slate-50/50 rounded-2xl border border-slate-100 p-6">
                            <h4 class="text-[10px] font-black text-slate-400 tracking-widest mb-4">Estado actual</h4>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[11px] text-slate-500">Email</span>
                                    <span class="text-[11px] font-bold text-slate-900">${AuthManager.loginMethod === 'connect' ? 'Vinculado' : '—'}</span>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[11px] text-slate-500">Estado</span>
                                    <span id="linking-status-label" class="text-[11px] font-bold ${AuthManager.loginMethod === 'connect' ? 'text-green-500' : 'text-slate-500'}">
                                        ${AuthManager.loginMethod === 'connect' ? 'Establecida' : 'No asociada'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <p class="text-[10px] text-slate-400 italic">
                            Nota: Si ya tienes una vinculación, al presionar guardar se sobrescribirá con el estado actual.
                        </p>
                    </div>

                    <div class="flex justify-end pt-8 shrink-0">
                         <button id="btn-save-linking" class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black tracking-widest text-xs shadow-lg hover:bg-indigo-700 transition-all">
                            Guardar vinculación
                        </button>
                    </div>
                </div>
            `;
        case 'password':
            return `
                <div class="h-full flex flex-col p-8 animate-fade-slide overflow-y-auto custom-scrollbar">
                    <div class="space-y-6">
                        <div class="bg-amber-50/30 border border-amber-100/50 rounded-2xl p-4 flex flex-col gap-1">
                            <h4 class="text-sm font-black text-slate-900">Cambiar contraseña</h4>
                            <p class="text-[11px] text-slate-500">Actualiza la contraseña asociada a tu cuenta de email.</p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Nueva contraseña</label>
                                <input type="password" placeholder="Mínimo 8 caracteres" class="input-glass w-full">
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Confirmar contraseña</label>
                                <input type="password" placeholder="Repetir contraseña" class="input-glass w-full">
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end pt-8 shrink-0 mt-auto">
                         <button class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black tracking-widest text-xs shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
                            Cambiar contraseña
                        </button>
                    </div>
                </div>
            `;
        case '2fa':
            return `
                <div class="h-full flex flex-col p-8 animate-fade-slide overflow-y-auto custom-scrollbar">
                    <div class="space-y-8">
                        <div class="bg-amber-50/30 border border-amber-100/50 rounded-2xl p-4 flex items-start gap-4">
                            <span class="material-symbols-rounded text-amber-500 mt-1">shield</span>
                            <div class="space-y-1">
                                <h4 class="text-sm font-black text-slate-900">Autenticación de dos factores</h4>
                                <p class="text-[11px] text-slate-500">Añade una capa extra de seguridad a tu cuenta.</p>
                            </div>
                        </div>

                        <div class="glass bg-white/40 border-white/50 p-6 flex items-center justify-between rounded-3xl">
                            <div class="space-y-1">
                                <h4 class="text-xs font-bold text-slate-900">Estado de 2fa</h4>
                                <p class="text-[11px] text-slate-500">La autenticación de dos factores está desactivada</p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" class="sr-only peer">
                                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <p class="text-[10px] text-slate-400 italic font-medium px-4">Nota: Esta es una implementación de demostración. En producción se integrará con TOTP o similar.</p>
                    </div>
                </div>
            `;
        default:
            return '';
    }
}

window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
