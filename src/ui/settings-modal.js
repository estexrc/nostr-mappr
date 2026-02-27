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

            // Identidad Tab Logic
            if (tab === 'identidad') {
                const btnShowNsec = document.getElementById('btn-show-nsec');
                const nsecInput = document.getElementById('set-nsec');
                if (btnShowNsec && nsecInput) {
                    btnShowNsec.onclick = () => {
                        if (nsecInput.type === 'password') {
                            nsecInput.type = 'text';
                            btnShowNsec.innerText = 'Ocultar';
                        } else {
                            nsecInput.type = 'password';
                            btnShowNsec.innerText = 'Mostrar';
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
                            <div class="relative">
                                <input type="password" id="set-nsec" readonly value="${nsec}" class="input-glass w-full font-mono-key pr-20">
                                <button id="btn-show-nsec" class="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-colors bg-white/50 px-3 py-1.5 rounded-lg border border-slate-200">Mostrar</button>
                            </div>
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

                        <div class="space-y-4">
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Email</label>
                                <input type="email" placeholder="tu@email.com" class="input-glass w-full">
                            </div>
                            <div class="space-y-1.5">
                                <label class="text-[10px] font-black text-slate-400 tracking-widest ml-1">Contraseña (opcional)</label>
                                <input type="password" placeholder="Contraseña segura" class="input-glass w-full">
                            </div>
                        </div>

                        <!-- Estado actual (Moved below fields) -->
                        <div class="bg-slate-50/50 rounded-2xl border border-slate-100 p-6">
                            <h4 class="text-[10px] font-black text-slate-400 tracking-widest mb-4">Estado actual</h4>
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[11px] text-slate-500">Email</span>
                                    <span class="text-[11px] font-bold text-slate-900">—</span>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <span class="text-[11px] text-slate-500">Contraseña</span>
                                    <span class="text-[11px] font-bold text-slate-500">No establecida</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex justify-end pt-8 shrink-0">
                         <button class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black tracking-widest text-xs shadow-lg hover:bg-indigo-700 transition-all">
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
