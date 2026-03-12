import { AuthManager } from '../core/auth.js';
import { CATEGORIAS } from '../core/categories.js';
import { openSettingsModal } from './settings-modal.js';

/* --- FLOATING UI ELEMENTS --- */
const userNameMini = document.getElementById('user-name-mini');
const userAvatarMini = document.getElementById('user-avatar-small');
const userPubkeyMini = document.getElementById('user-pubkey-mini');

/* --- MODAL ELEMENTS --- */
const modalContainer = document.getElementById('modal-container');
const modalContent = document.getElementById('modal-content');

/* --- JOURNAL MODAL (dedicated wide overlay) --- */
const journalModal = document.getElementById('journal-modal');
const journalModalContent = document.getElementById('journal-modal-content');

/**
 * Generates dynamic HTML for the profile modal based on session state.
 */
function getProfileModalHTML(profile = null) {
    if (profile) {
        const npubShort = AuthManager.userPubkey.substring(0, 10) + '...';
        const isReadOnly = AuthManager.loginMethod === 'read-only';
        const isConnect = AuthManager.loginMethod === 'connect';

        return `
            <div class="p-8 flex flex-col items-center text-center gap-6 animate-fade-slide">
                <button class="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors" onclick="closeModal()">
                    <span class="material-symbols-rounded text-[24px]">close</span>
                </button>
                <div class="flex flex-col items-center">
                    <div class="relative">
                        <img src="${profile.picture || 'https://www.gravatar.com/avatar/0?d=mp'}" alt="Avatar" 
                             class="w-24 h-24 rounded-full border-2 border-white shadow-xl object-cover glass">
                        <div class="absolute bottom-0 right-0 w-6 h-6 ${(isReadOnly || isConnect) ? 'bg-amber-400' : 'bg-green-500'} border-2 border-white rounded-full flex items-center justify-center text-[10px]">
                            ${isConnect ? '🔗' : ''}
                        </div>
                    </div>
                    <h2 class="mt-4 text-2xl font-black text-slate-900 leading-tight">¡Hola, ${profile.display_name || profile.name || 'Usuario'}!</h2>
                    <div class="flex flex-col items-center gap-2 mt-1">
                        <span class="bg-indigo-50/50 px-3 py-1 rounded-full text-[10px] font-mono text-indigo-600 font-bold border border-indigo-100/50 tracking-wider">${npubShort}</span>
                        ${isReadOnly ? `
                            <span class="bg-amber-50 text-amber-600 text-[9px] font-black px-2 py-0.5 rounded-full border border-amber-100 tracking-widest">
                                👁️ Modo solo lectura
                            </span>
                        ` : ''}
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-1 w-full bg-slate-50/30 p-4 rounded-[28px] border border-slate-100/50 glass shadow-sm">
                    <div class="flex flex-col"><strong class="text-lg font-black text-slate-900">24K</strong><span class="text-[9px] font-bold text-slate-400">⚡ Sats</span></div>
                    <div class="flex flex-col border-x border-slate-200/50"><strong class="text-lg font-black text-slate-900">${profile.following || 0}</strong><span class="text-[9px] font-bold text-slate-400">Siguiendo</span></div>
                    <div class="flex flex-col"><strong class="text-lg font-black text-slate-900">${profile.followers || 0}</strong><span class="text-[9px] font-bold text-slate-400">Seguidores</span></div>
                </div>

                <div class="w-full text-left">
                    <p id="profile-about" class="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                        "${profile.about?.length > 150
                ? `${profile.about.substring(0, 150)}... <button onclick="window.showFullDescription('profile')" class="text-indigo-600 font-bold">Ver más</button>`
                : (profile.about || 'No description provided on Nostr.')}"
                    </p>
                    ${isReadOnly ? `
                        <div class="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 text-xs text-indigo-700 font-medium glass">
                            Conecta una extensión o usa Nostr Connect para poder publicar anclas.
                        </div>
                    ` : `
                        <button id="btn-open-settings" class="w-full flex items-center justify-center gap-2 py-3.5 border border-slate-200/50 rounded-2xl font-bold text-slate-700 hover:bg-white/50 transition-all glass">
                            <span class="material-symbols-rounded text-indigo-500 text-[20px]">settings</span>
                            Ajustes de perfil
                        </button>
                    `}
                </div>

                <button id="btn-modal-logout" class="w-full py-4 bg-rose-50/50 text-rose-500 rounded-2xl font-black hover:bg-rose-100/50 transition-all tracking-widest text-xs glass border border-rose-100/30">
                    Cerrar sesión (Mantener Llave)
                </button>
                <button id="btn-modal-logout-hard" class="w-full text-[9px] font-bold text-slate-400 hover:text-rose-400 transition-colors mt-2">
                    Hard Reset (Borrar todo)
                </button>
            </div>
        `;
    } else {
        // Redirigir al nuevo Portal de Autentificación
        return `
            <div class="p-10 flex flex-col items-center text-center gap-6 animate-fade-slide">
                <button class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-xl transition-colors" onclick="closeModal()">✕</button>
                <div class="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-2 shadow-inner">
                    <span class="material-symbols-rounded text-indigo-600 text-[48px]">account_circle</span>
                </div>
                <div>
                    <h2 class="text-2xl font-black text-slate-900 leading-tight">Acceso Mappr</h2>
                    <p class="mt-2 text-slate-500 text-sm leading-relaxed max-w-[240px]">Conecta tu identidad Nostr para empezar a mapear el mundo.</p>
                </div>
                
                <button onclick="window.openAuthModal('nip07')" class="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-xl">
                     Configurar acceso
                </button>
            </div>
        `;
    }
}

/**
 * Generates the HTML for the new Auth Portal tabs.
 */
export function getAuthPortalHTML(activeTab = 'generar') {
    const tabs = [
        { id: 'generar', label: 'Generar' },
        { id: 'email', label: 'Email' },
        { id: 'importar', label: 'Importar' },
        { id: 'nip07', label: 'NIP-07' }
    ];

    const navHTML = tabs.map(tab => `
        <button class="auth-tab-btn ${activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}">
            ${tab.label}
            <div class="auth-indicator"></div>
        </button>
    `).join('');

    let contentHTML = '';

    switch (activeTab) {
        case 'generar':
            contentHTML = `
                <div class="tab-content-fade flex flex-col h-full">
                    <div class="auth-info-box">
                        <h4 class="text-sm font-bold text-slate-900 mb-1">Autenticación con Nostr</h4>
                        <p class="text-[12px] text-slate-500 leading-relaxed">Se generará automáticamente un par de claves (keypair) Nostr único para ti.</p>
                    </div>
                    <ul class="space-y-4 mb-auto pt-6">
                        <li class="flex items-start gap-4">
                            <span class="w-2.5 h-2.5 rounded-full bg-yellow-400 mt-1 shrink-0"></span>
                            <div>
                                <p class="text-[13px] font-bold text-slate-800">Generación automática</p>
                                <p class="text-[12px] text-slate-500">Se crea un par de claves nuevo y único</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-4">
                            <span class="w-2.5 h-2.5 rounded-full bg-yellow-400 mt-1 shrink-0"></span>
                            <div>
                                <p class="text-[13px] font-bold text-slate-800">Almacenamiento seguro</p>
                                <p class="text-[12px] text-slate-500">La identidad se guarda localmente en tu navegador</p>
                            </div>
                        </li>
                    </ul>
                    <div class="mt-auto">
                        <button id="btn-auth-generate" class="btn-auth-primary">Generar identidad y continuar</button>
                        <p class="mt-6 text-[10px] text-slate-400 text-center leading-relaxed">
                            Al continuar, aceptas que se almacene tu identidad Nostr en este navegador.
                        </p>
                    </div>
                </div>
            `;
            break;
        case 'email':
            contentHTML = `
                <div class="tab-content-fade flex flex-col h-full">
                    <div class="auth-info-box">
                        <h4 class="text-sm font-bold text-slate-900 mb-1">Email y contraseña</h4>
                        <p class="text-[12px] text-slate-500 leading-relaxed">Si vinculaste tu Nostr a un email, puedes iniciar sesión aquí.</p>
                    </div>
                    <form id="auth-email-form" onsubmit="return false;" class="space-y-4 mb-auto pt-4">
                        <div class="auth-input-group">
                            <label class="auth-input-label">Email</label>
                            <input type="email" id="auth-email" autocomplete="username" placeholder="tu@email.com" class="input-glass input-auth-glass w-full">
                        </div>
                        <div class="auth-input-group">
                            <label class="auth-input-label">Contraseña</label>
                            <input type="password" id="auth-password" autocomplete="current-password" placeholder="Mínimo 8 caracteres" class="input-glass input-auth-glass w-full">
                        </div>
                    </form>
                    <div class="mt-auto">
                        <button id="btn-auth-email" class="btn-auth-primary" disabled>Iniciar sesión</button>
                        <p class="mt-4 text-[11px] text-slate-400 text-center">¿Olvidaste tu contraseña? Usa tu código de recuperación.</p>
                    </div>
                </div>
            `;
            break;
        case 'importar':
            contentHTML = `
                <div class="tab-content-fade flex flex-col h-full">
                    <div class="auth-info-box">
                        <h4 class="text-sm font-bold text-slate-900 mb-1">Importar clave privada</h4>
                        <p class="text-[12px] text-slate-500 leading-relaxed">Ingresa tu clave privada (nsec). No se comparte con nadie.</p>
                    </div>
                    <form id="auth-import-form" onsubmit="return false;" class="auth-input-group mb-auto pt-8">
                        <label class="auth-input-label">Clave privada (nsec)</label>
                        <input type="password" id="auth-nsec" autocomplete="current-password" placeholder="nsec1..." class="input-glass input-auth-glass w-full">
                    </form>
                    <div class="mt-auto">
                        <button id="btn-auth-import" class="btn-auth-primary" disabled>Importar clave</button>
                        <p class="mt-6 text-[11px] text-slate-400 text-center leading-relaxed">
                            Tu clave privada nunca se comparte y se guarda localmente.
                        </p>
                    </div>
                </div>
            `;
            break;
        case 'nip07':
            contentHTML = `
                <div class="tab-content-fade flex flex-col h-full">
                    <div class="auth-info-box">
                        <h4 class="text-sm font-bold text-slate-900 mb-1">Wallet / Extensión</h4>
                        <p class="text-[12px] text-slate-500 leading-relaxed">Conecta usando una extensión NIP-07 como Alby, nos2x, etc.</p>
                    </div>
                    
                    <div class="bg-slate-50/50 p-8 rounded-[24px] mb-auto mt-4 text-center border border-slate-100/50">
                        <p class="text-[12px] text-slate-500 leading-relaxed mb-0">
                            Tu extensión de navegador firmará las operaciones de forma segura sin exponer tu clave privada a esta aplicación.
                        </p>
                    </div>

                    <div class="mt-auto">
                        <button id="btn-auth-nip07" class="btn-auth-primary flex items-center justify-center gap-2">
                            <span class="material-symbols-rounded text-[20px]">account_balance_wallet</span>
                            Conectar wallet
                        </button>
                        <p class="mt-6 text-[11px] text-slate-400 text-center font-medium">Requiere extensión NIP-07 instalada.</p>
                    </div>
                </div>
            `;
            break;
    }

    return `
        <div class="auth-overlay" id="auth-portal-overlay">
            <div class="glass auth-modal p-10 flex flex-col relative" id="auth-portal-modal">
                <div class="auth-tabs-nav">
                    ${navHTML}
                </div>

                <div id="auth-tab-content" class="flex-1 flex flex-col min-h-0">
                    ${contentHTML}
                </div>
            </div>
        </div>
    `;
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
                <h2 class="text-2xl font-black text-slate-900">Ancla provisional</h2>
                <span class="inline-block mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-mono font-bold border border-indigo-100 tracking-wider">
                    📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}
                </span>
            </div>

            <div class="space-y-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 tracking-widest ml-1">Título del lugar</label>
                    <input type="text" id="draft-title" placeholder="Ej: Café de la Esquina..." 
                           class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400">
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 tracking-widest ml-1">Categoría</label>
                    <select id="draft-category" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800">
                        <option value="">Seleccionar categoría...</option>
                        ${options}
                    </select>
                </div>
                
                <div id="draft-upload-zone" class="relative group cursor-pointer border-2 border-dashed border-indigo-200 p-8 rounded-[24px] bg-indigo-50/30 hover:bg-indigo-50/50 hover:border-indigo-400 transition-all text-center">
                    <input type="file" id="draft-photo" accept="image/*" multiple class="hidden">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-camera text-2xl text-indigo-500 group-hover:scale-110 transition-transform"></i>
                        <p class="text-[10px] font-black text-indigo-600 tracking-widest">Subir o tomar foto</p>
                    </div>
                </div>
                <div id="draft-preview-container" class="flex gap-2 flex-wrap empty:hidden"></div>
            </div>

            <button id="btn-save-draft" class="w-full py-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all tracking-widest text-xs">
                Guardar en diario
            </button>
        </div>
    `;
}

/**
 * Updates visible info on the floating user button.
 */
export function updateFloatingUser(profile = null) {
    if (profile) {
        userNameMini.textContent = profile.display_name || profile.name || "Usuario";

        // Use Robohash as Identicon fallback if no picture
        const avatarUrl = profile.picture || `https://robohash.org/${AuthManager.userPubkey}.png?set=set4`;
        userAvatarMini.src = avatarUrl;

        const npubShort = AuthManager.userPubkey ? AuthManager.userPubkey.substring(0, 8) : '...';
        userPubkeyMini.textContent = '@' + npubShort;
    } else {
        userNameMini.textContent = "Invitado";
        userAvatarMini.src = "https://www.gravatar.com/avatar/0?d=mp";
        userPubkeyMini.textContent = "@...";
    }
}

export function openModal(html, sizeClass = 'modal-lg') {
    modalContent.innerHTML = html;
    modalContent.className = `bg-white/70 backdrop-blur-xl border border-white/50 rounded-[32px] shadow-2xl w-full max-h-[90vh] overflow-y-auto animate-fade-slide modal-content-base ${sizeClass}`;
    modalContent.style.cssText = ''; // clear any leftover inline styles
    modalContainer.classList.remove('hidden');
    modalContainer.classList.add('flex');
}

export function closeModal() {
    modalContainer.classList.add('hidden');
    modalContainer.classList.remove('flex');
    modalContent.innerHTML = '';
    modalContent.style.cssText = '';
}

/**
 * High-fidelity Authentication Portal Manager
 */
export function openAuthModal(initialTab = 'generar') {
    closeModal(); // Close legacy modal if open

    const renderPortal = (tab) => {
        const portalHTML = getAuthPortalHTML(tab);
        let overlay = document.getElementById('auth-portal-overlay');

        if (!overlay) {
            document.body.insertAdjacentHTML('beforeend', portalHTML);
            overlay = document.getElementById('auth-portal-overlay');

            // Setup Click-Outside once
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    window.closeAuthPortal();
                }
            };
        } else {
            // Update only content to prevent flicker
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = portalHTML;

            // Update Navigation
            const newNav = tempDiv.querySelector('.auth-tabs-nav');
            overlay.querySelector('.auth-tabs-nav').innerHTML = newNav.innerHTML;

            // Update Content
            const newContent = tempDiv.querySelector('#auth-tab-content');
            overlay.querySelector('#auth-tab-content').innerHTML = newContent.innerHTML;
        }

        // Setup Tab Events
        overlay.querySelectorAll('.auth-tab-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                renderPortal(btn.dataset.tab);
            };
        });

        // Setup Action Events & Validations
        const btnNip07 = document.getElementById('btn-auth-nip07');
        if (btnNip07) {
            btnNip07.onclick = async () => {
                try {
                    await AuthManager.login();
                    showToast("Sesión iniciada correctamente", "success");
                    window.closeAuthPortal();
                    location.reload();
                } catch (e) {
                    showToast(e.message, "error");
                }
            };
        }

        const btnImport = document.getElementById('btn-auth-import');
        const inputNsec = document.getElementById('auth-nsec');
        if (btnImport && inputNsec) {
            inputNsec.oninput = () => {
                btnImport.disabled = inputNsec.value.trim().length < 10;
            };
            btnImport.onclick = async () => {
                try {
                    await AuthManager.loginSecret(inputNsec.value.trim());
                    showToast("Cuenta importada correctamente", "success");
                    window.closeAuthPortal();
                    location.reload();
                } catch (e) {
                    showToast(e.message, "error");
                }
            };
        }

        const btnEmail = document.getElementById('btn-auth-email');
        const inputEmail = document.getElementById('auth-email');
        const inputPass = document.getElementById('auth-password');
        const tabContent = document.getElementById('auth-tab-content');

        if (btnEmail && inputEmail && inputPass) {
            const validateEmail = () => {
                btnEmail.disabled = !inputEmail.value.includes('@') || inputPass.value.length < 8;
            };
            inputEmail.oninput = validateEmail;
            inputPass.oninput = validateEmail;

            btnEmail.onclick = async (e) => {
                e.preventDefault();
                // Clear previous errors
                tabContent.querySelectorAll('.auth-error-msg').forEach(msg => msg.remove());

                // Set Loading State
                const originalContent = btnEmail.innerHTML;
                btnEmail.disabled = true;
                btnEmail.classList.add('loading');
                btnEmail.innerHTML = `<span class="auth-spinner"></span> Iniciando sesión...`;

                try {
                    // Logic for Bunker Pull (Login) via nostr-login SDK
                    const email = inputEmail.value.trim();
                    const password = inputPass.value.trim();

                    // Import the SDK dynamically to avoid heavy initial bundle
                    const { init, launch } = await import('nostr-login');
                    init({
                        theme: 'dark',
                        noHeader: true
                    });

                    // Trigger the login flow
                    const result = await AuthManager.loginEmail(email, password);

                    // The SDK handles NIP-46 handshake. 
                    // We need to wait for the result or use the launch flow
                    const sessionPromise = launch(email, {
                        password,
                        // We strictly want Bunker Pull
                        forceBunker: true,
                        noHeader: true,
                        img: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                        devOverrideBunkerOrigin: 'wss://relay.nsec.app'
                    });

                    // Wrap in timeout like in settings
                    const session = await Promise.race([
                        sessionPromise,
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Time-out: El búnker no respondió. Reintenta en unos segundos.")), 120000))
                    ]);

                    if (!session || !session.pubkey) {
                        throw new Error("Error de comunicación con el Búnker de Identidad");
                    }

                    // Success: SDK usually handles storage, but we sync our AuthManager
                    AuthManager.userPubkey = session.pubkey;
                    AuthManager.loginMethod = 'connect';

                    // Re-hydration: If bunker provides secret key (some do if authorized)
                    if (session.privkey) {
                        AuthManager.localSecretKey = session.privkey;
                        localStorage.setItem('nostr_local_sk', session.privkey);
                    }

                    localStorage.setItem('nostr_user_pubkey', session.pubkey);
                    localStorage.setItem('nostr_login_method', 'connect');

                    // iOS Safari persistence: Save bunker_ptr in cookie with strict flags
                    if (session.bunkerPtr) {
                        const expiry = new Date();
                        expiry.setFullYear(expiry.getFullYear() + 1);
                        document.cookie = `bunker_ptr=${session.bunkerPtr}; expires=${expiry.toUTCString()}; path=/; Secure; SameSite=Lax`;
                    }

                    // Auto-Hydrate Metadata & Immediate UI Sync (FORCED COMPLETION)
                    let profileForSync = null;
                    try {
                        // Display "Hydrating" state in toast or inner UI if needed
                        profileForSync = await nostrInstance.getUserProfile(session.pubkey);
                        if (profileForSync) {
                            AuthManager.saveProfile(session.pubkey, profileForSync);
                            updateFloatingUser(profileForSync);
                        } else {
                            updateFloatingUser({ name: 'Usuario Conectado' });
                        }
                    } catch (pErr) {
                        console.warn("Auto-hydrate failed:", pErr);
                        updateFloatingUser({ name: 'Usuario Conectado' });
                    }

                    showToast("Sesión iniciada correctamente", "success");

                    // Crucial: Wait a bit before closing to allow user to see success
                    setTimeout(() => {
                        window.closeAuthPortal();
                        setTimeout(() => location.reload(), 1000);
                    }, 800);
                } catch (err) {
                    btnEmail.disabled = false;
                    btnEmail.classList.remove('loading');
                    btnEmail.innerHTML = originalContent;

                    // Capture exceptions and show friendly visual alert
                    const errorEl = document.createElement('div');
                    errorEl.className = 'auth-error-msg';
                    errorEl.innerText = (err.message && (err.message.includes('CORS') || err.message.includes('fetch')))
                        ? "No se pudo conectar con el servidor de llaves (Error de Red/Búnker)"
                        : (err.message || "Error al conectar con la identidad");
                    tabContent.appendChild(errorEl);
                }
            };
        }

        const btnGenerate = document.getElementById('btn-auth-generate');
        if (btnGenerate) {
            btnGenerate.onclick = async () => {
                const originalText = btnGenerate.innerHTML;
                try {
                    btnGenerate.disabled = true;
                    btnGenerate.innerHTML = `<span class="auth-spinner"></span> Generando...`;

                    // 1. Generate local identity
                    const { nsec } = await AuthManager.generate();

                    // 2. Clear content and show onboarding
                    tabContent.innerHTML = `
                        <div class="tab-content-fade flex flex-col h-full">
                            <div class="auth-info-box">
                                <h4 class="text-sm font-bold text-slate-900 mb-1">¡Identidad Creada!</h4>
                                <p class="text-[12px] text-slate-500 leading-relaxed">Esta es tu clave secreta de acceso. Úsala para recuperar tu cuenta en el futuro.</p>
                            </div>

                            <div class="nsec-alert-box">
                                <p class="text-[11px] font-bold text-amber-700 flex items-center gap-2">
                                    <span class="material-symbols-rounded text-[16px]">warning</span>
                                    Guardado Obligatorio
                                </p>
                                <div class="nsec-display" id="nsec-output">${nsec}</div>
                                <p class="text-[10px] text-slate-400 mt-3 leading-tight">Mappr no guarda tus claves en ningún servidor. Si pierdes este código, perderás el acceso.</p>
                            </div>

                            <div class="mt-auto pt-6">
                                <button id="btn-copy-start" class="btn-auth-primary">
                                    Copiar y Empezar
                                </button>
                            </div>
                        </div>
                    `;

                    // 3. Setup Copy & Start logic
                    const btnCopy = document.getElementById('btn-copy-start');
                    btnCopy.onclick = async () => {
                        try {
                            // Unified clipboard for iOS/Safari
                            await navigator.clipboard.writeText(nsec);
                            showToast("¡Clave copiada con éxito!", "success");

                            // Success Animation
                            btnCopy.classList.add('btn-auth-success');
                            btnCopy.innerHTML = `<span class="material-symbols-rounded text-[20px]">check_circle</span> ¡Todo listo!`;

                            // Delayed Exit
                            setTimeout(() => {
                                window.closeAuthPortal();
                                setTimeout(() => location.reload(), 400);
                            }, 1000);

                        } catch (err) {
                            showToast("Error al copiar. Por favor hazlo manualmente.", "error");
                        }
                    };

                } catch (e) {
                    showToast(e.message, "error");
                    btnGenerate.disabled = false;
                    btnGenerate.innerHTML = originalText;
                }
            };
        }
    };

    renderPortal(initialTab);
}

window.openAuthModal = openAuthModal;
window.closeAuthPortal = () => {
    const overlay = document.getElementById('auth-portal-overlay');
    const modal = document.getElementById('auth-portal-modal');
    if (overlay && modal) {
        overlay.classList.add('closing');
        modal.classList.add('closing');
        setTimeout(() => overlay.remove(), 400);
    } else if (overlay) {
        overlay.remove();
    }
};

/** Opens the dedicated wide Journal overlay (no CSS class conflicts) */
export function openJournalModal(html) {
    closeModal(); // Guarantee no overlap
    journalModalContent.innerHTML = html;
    journalModal.style.display = 'flex';
}
/** Closes the dedicated Journal overlay */
export function closeJournalModal() {
    journalModal.style.display = 'none';
    journalModalContent.innerHTML = '';
}

const ANCHOR_STATES = {
    1: { label: 'ANCHORED', color: 'bg-indigo-500', text: 'text-indigo-500' },
    30024: { label: 'DRAFT', color: 'bg-orange-500', text: 'text-orange-500' },
    'local': { label: 'LOCAL', color: 'bg-slate-900', text: 'text-slate-900' }
};

/**
 * Generates only the <tr> rows for the journal table.
 */
export function getJournalTableRowsHTML(entries = []) {
    if (entries.length === 0) {
        return '<tr><td colspan="5" class="py-24 text-center font-bold text-slate-300 tracking-widest text-sm">No hay registros aún</td></tr>';
    }

    return entries.map(ev => {
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
                <td class="py-4 text-[11px] font-bold text-slate-400 tracking-tighter text-center">${date}</td>
                <td class="py-4 max-w-[200px] font-black text-slate-800 text-sm truncate text-center">${title}</td>
                <td class="py-4 text-center">
                    <span class="font-bold text-indigo-500 text-[10px] tracking-wider">${categoryText}</span>
                </td>
                <td class="py-4 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[8px] font-black text-white ${config.color}">${config.label}</span>
                </td>
                <td class="py-4 pr-6">
                    <div class="flex items-center justify-center gap-2">
                        <button class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 transition-all border border-indigo-100" 
                                onclick="window.centerMapAndOpenPopup('${ev.id}', ${lat}, ${lng}); window.closeJournalModal()" title="Ver en mapa">📍</button>
                        ${(ev.kind === 30024 || ev.kind === 'local') ? `<button class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-all border border-purple-100" onclick="window.completeAnchor('${ev.id}')" title="Publicar">🚀</button>` : ''}
                        <button class="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100" onclick="window.deleteEntry('${ev.id}')" title="Borrar">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Generates dynamic HTML for the Journal/Logbook table.
 */
export function getJournalModalHTML(entries = []) {
    const rowsHTML = getJournalTableRowsHTML(entries);

    const categoriesHTML = [
        { id: 'all', label: 'Categorías' },
        ...CATEGORIAS
    ].map(cat => `<option value="${cat.id}">${cat.label}</option>`).join('');

    const statusOptions = [
        { id: 'all', label: 'Estados' },
        { id: '1', label: '⚓ Anchored' },
        { id: '30024', label: '📝 Draft' },
        { id: 'local', label: '💾 Local' }
    ].map(opt => `<option value="${opt.id}">${opt.label}</option>`).join('');

    return `
        <div class="p-8 flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300 w-full relative h-[75vh]">
            <button class="absolute top-8 right-8 text-slate-400 hover:text-slate-600 text-2xl transition-colors" id="btn-close-journal">✕</button>
            
            <div class="flex flex-col items-center gap-2">
                <h2 class="text-3xl font-black text-slate-900 tracking-tighter">Diario de anclas</h2>
                <div class="h-1.5 w-14 bg-indigo-500 rounded-full shadow-sm shadow-indigo-200"></div>
            </div>

            <!-- Filters Section (4-Column Grid) -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                <!-- Date Filter -->
                <div class="flex flex-col gap-2 relative">
                    <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] pl-1">Fecha</label>
                    <div id="journal-filter-date-trigger" class="input-glass w-full cursor-pointer group">
                        <span id="journal-filter-date-label" class="text-slate-600 font-bold truncate">Todas</span>
                        <span class="material-symbols-rounded text-slate-400 ml-auto text-lg group-hover:text-indigo-500 transition-colors">calendar_month</span>
                    </div>
                </div>

                <!-- Name Filter -->
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] pl-1">Nombre</label>
                    <input type="text" id="journal-filter-name" maxlength="25"
                        class="input-glass w-full text-xs" 
                        value="">
                </div>

                <!-- Category Filter -->
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] pl-1">Categoría</label>
                    <select id="journal-filter-category" class="input-glass select-glass w-full cursor-pointer">
                        ${categoriesHTML}
                    </select>
                </div>

                <!-- Status Filter -->
                <div class="flex flex-col gap-2">
                    <label class="text-[10px] font-black text-slate-400 tracking-[0.2em] pl-1">Estado</label>
                    <select id="journal-filter-status" class="input-glass select-glass w-full cursor-pointer">
                        ${statusOptions}
                    </select>
                </div>
            </div>

            <!-- Clear Filters Link -->
            <div class="flex justify-center -mt-2">
                <button id="journal-clear-filters" class="text-[10px] font-black underline text-slate-400 hover:text-indigo-500 transition-colors">
                    Borrar filtros
                </button>
            </div>
            
            <div class="flex-1 min-h-0 overflow-hidden bg-white rounded-[32px] border border-slate-100 shadow-2xl shadow-slate-200/40 flex flex-col">
                <div class="flex-1 overflow-y-auto custom-scrollbar">
                    <table class="w-full border-collapse">
                        <thead class="sticky top-0 z-10">
                            <tr class="bg-slate-50/90 backdrop-blur-md text-[10px] font-black text-slate-400 tracking-widest border-b border-slate-100">
                                <th class="py-5 text-center px-6">Fecha</th>
                                <th class="py-5 text-center px-6">Lugar</th>
                                <th class="py-5 text-center px-6">Categoría</th>
                                <th class="py-5 text-center px-6">Estado</th>
                                <th class="py-5 text-center px-6">Acción</th>
                            </tr>
                        </thead>
                        <tbody id="journal-entries-body" class="divide-y divide-slate-50">
                            ${rowsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

export function initUI(nostrInstance) {
    const userBtn = document.getElementById('user-floating-btn');
    const modalContainer = document.getElementById('modal-container');

    if (userBtn) {
        userBtn.addEventListener('click', async () => {
            if (AuthManager.isLoggedIn()) {
                let profile = AuthManager.profileCache[AuthManager.userPubkey];
                if (!profile) {
                    try {
                        profile = await nostrInstance.getUserProfile(AuthManager.userPubkey);
                    } catch (e) {
                        console.warn("Could not fetch profile, using default.");
                    }
                }

                // If still null, pass empty object to trigger the Profile Panel instead of legacy login
                openModal(getProfileModalHTML(profile || {}), 'modal-md');
            } else {
                openAuthModal('generar');
                return;
            }
        });
    }

    // Modal Event Delegation for better reliability
    modalContent.addEventListener('click', (e) => {
        if (e.target.closest('#btn-modal-logout')) {
            AuthManager.logout(false);
        }
        if (e.target.closest('#btn-modal-logout-hard')) {
            AuthManager.logout(true);
        }

        if (e.target.closest('#btn-open-settings')) {
            closeModal();
            openSettingsModal('perfil', nostrInstance);
        }
    });

    document.getElementById('btn-open-journal')?.addEventListener('click', async () => {
        if (!AuthManager.isLoggedIn()) {
            showToast("Debes conectarte para ver tu diario.", "error");
            return;
        }
        if (window.fetchAndShowJournal) window.fetchAndShowJournal();
    });

    modalContainer?.addEventListener('click', (e) => {
        if (e.target === modalContainer) closeModal();
    });

    journalModal?.addEventListener('click', (e) => {
        if (e.target === journalModal) closeJournalModal();
    });

    // Handle close buttons in modals via event delegation
    modalContent.addEventListener('click', (e) => {
        if (e.target.closest('#btn-close-draft') || e.target.closest('#btn-close-publish')) {
            closeModal();
        }
    });

    journalModalContent.addEventListener('click', (e) => {
        if (e.target.closest('#btn-close-journal')) {
            closeJournalModal();
        }
    });

    if (AuthManager.isLoggedIn()) {
        const pubkey = AuthManager.userPubkey;
        const cachedProfile = AuthManager.profileCache[pubkey];
        if (cachedProfile) {
            updateFloatingUser(cachedProfile);
        } else {
            // Show minimal info (Identicon fallback) immediately for new identities
            updateFloatingUser({});

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
                <h2 class="text-2xl font-black text-slate-900">🚀 Publicar ancla</h2>
                <span class="inline-block mt-2 bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-mono font-bold border border-indigo-100 tracking-wider">
                    📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}
                </span>
            </div>
            
            <div class="space-y-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 tracking-widest ml-1">Nombre del lugar</label>
                    <input type="text" id="pub-title" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800" placeholder="Ej: Café de la Esquina...">
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 tracking-widest ml-1">Descripción / reseña</label>
                    <textarea id="pub-description" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 h-24 resize-none" placeholder="Cuenta por qué este lugar es especial..."></textarea>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-black text-indigo-600 tracking-widest ml-1">Categoría</label>
                    <select id="pub-category" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800">
                        ${categoryOptions} 
                    </select>
                </div>

                <div id="pub-upload-zone" class="relative group cursor-pointer border-2 border-dashed border-indigo-200 p-8 rounded-[24px] bg-indigo-50/30 hover:bg-indigo-50/50 hover:border-indigo-400 transition-all text-center">
                    <input type="file" id="pub-photo" multiple accept="image/*" class="hidden">
                    <div class="flex flex-col items-center gap-2">
                        <i class="fas fa-camera text-2xl text-indigo-500 group-hover:scale-110 transition-transform"></i>
                        <p class="text-[10px] font-black text-indigo-600 tracking-widest">Subir o tomar foto</p>
                    </div>
                </div>
                <div id="pub-preview-container" class="grid grid-cols-4 gap-2 empty:hidden"></div>
            </div>

            <button id="btn-do-publish" class="w-full py-5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all tracking-widest text-xs">
                Publicar en Nostr
            </button>
        </div>
    `;
}

export function showToast(message, type = 'success', duration = 3000) {
    let container = document.querySelector('#toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[10000] flex flex-col gap-2 pointer-events-none w-full px-5 max-w-sm';
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
    toast.innerHTML = `<span class="text-xl">${icon}</span> <span class="font-black text-[12px] tracking-wider grow">${message}</span>`;

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
        <div class="p-8 flex flex-col gap-6 animate-fade-slide">
            <button class="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors" onclick="closeModal()">
                <span class="material-symbols-rounded text-[24px]">close</span>
            </button>
            <div class="text-center">
                <h2 class="text-2xl font-black text-slate-900">${title}</h2>
                <div class="h-1 w-12 bg-indigo-500 rounded-full mx-auto mt-3"></div>
            </div>
            <div class="text-[13px] text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-3 font-medium">
                ${description.replace(/\n/g, '<br>')}
            </div>
            <button onclick="closeModal()" class="w-full py-4 bg-brand text-white rounded-2xl font-black tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-500/20">
                Cerrar
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
                <button onclick="window.closeModal(); window.closeJournalModal();" class="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black hover:bg-slate-200 transition-all tracking-widest text-[10px]">
                    Cancelar
                </button>
                <button onclick="window.executeConfirmAction()" class="py-4 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all tracking-widest text-[10px]">
                    Eliminar
                </button>
            </div>
        </div>
    `;
}

window.closeModal = closeModal;
window.closeJournalModal = closeJournalModal;

/**
 * Shows a modern custom glassmorphism calendar.
 * @param {HTMLElement} trigger - The element that triggered the calendar.
 * @param {string} currentVal - Current selected date in 'YYYY-MM-DD' format.
 * @param {Array<string>} activeDates - Array of dates in 'YYYY-MM-DD' that have data.
 * @param {Function} onSelect - Callback when a date is selected.
 */
export function showCustomCalendar(trigger, currentVal, activeDates = [], onSelect) {
    const existing = document.getElementById('stitch-calendar-popup');
    if (existing) existing.remove();

    const calendar = document.createElement('div');
    calendar.id = 'stitch-calendar-popup';
    calendar.className = 'stitch-calendar';

    // Position
    const rect = trigger.getBoundingClientRect();
    calendar.style.top = `${rect.bottom + window.scrollY + 8}px`;
    calendar.style.left = `${rect.left + window.scrollX}px`;

    let viewDate = currentVal ? new Date(currentVal + 'T12:00:00') : new Date();
    if (isNaN(viewDate.getTime())) viewDate = new Date();

    const render = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const monthName = viewDate.toLocaleString('es-ES', { month: 'long' });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const daysHTML = [];
        // Empty slots for first week
        for (let i = 0; i < firstDay; i++) daysHTML.push('<div class="calendar-day opacity-0 pointer-events-none"></div>');

        const todayStr = new Date().toISOString().split('T')[0];

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isSelected = dateStr === currentVal;
            const isToday = dateStr === todayStr;
            const hasData = activeDates.includes(dateStr);
            daysHTML.push(`
                <div class="calendar-day relative ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${hasData ? 'calendar-day-active' : ''}" 
                     data-date="${dateStr}">${d}</div>
            `);
        }

        calendar.innerHTML = `
            <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between px-1">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-black text-slate-400 tracking-widest">${year}</span>
                        <span class="text-sm font-black text-slate-800 capitalize">${monthName}</span>
                    </div>
                    <div class="flex gap-1">
                        <button class="calendar-header-btn" id="cal-prev"><span class="material-symbols-rounded text-lg">chevron_left</span></button>
                        <button class="calendar-header-btn" id="cal-next"><span class="material-symbols-rounded text-lg">chevron_right</span></button>
                    </div>
                </div>
                <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 pb-1">
                    <div>Do</div><div>Lu</div><div>Ma</div><div>Mi</div><div>Ju</div><div>Vi</div><div>Sá</div>
                </div>
                <div class="grid grid-cols-7 gap-1">
                    ${daysHTML.join('')}
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-slate-100/50 mt-1">
                    <button id="cal-clear" class="text-[10px] font-black text-indigo-500 hover:text-indigo-700 tracking-wider px-2 py-1">Limpiar</button>
                    <button id="cal-today" class="text-[10px] font-black text-slate-400 hover:text-slate-600 tracking-wider px-2 py-1">Hoy</button>
                </div>
            </div>
        `;

        // Events
        calendar.querySelector('#cal-prev').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() - 1); render(); };
        calendar.querySelector('#cal-next').onclick = (e) => { e.stopPropagation(); viewDate.setMonth(viewDate.getMonth() + 1); render(); };
        calendar.querySelector('#cal-today').onclick = (e) => { e.stopPropagation(); onSelect(todayStr); calendar.remove(); };
        calendar.querySelector('#cal-clear').onclick = (e) => { e.stopPropagation(); onSelect(''); calendar.remove(); };
        calendar.querySelectorAll('.calendar-day[data-date]').forEach(day => {
            day.onclick = (e) => { e.stopPropagation(); onSelect(day.dataset.date); calendar.remove(); };
        });
    };

    render();
    document.body.appendChild(calendar);

    // Global click listener to close
    const closeCal = (e) => {
        if (!calendar.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) {
            calendar.remove();
            document.removeEventListener('click', closeCal);
        }
    };
    setTimeout(() => document.addEventListener('click', closeCal), 0);
}

// Global exposure
window.openModal = openModal;
window.openJournalModal = openJournalModal;
window.showCustomCalendar = showCustomCalendar;
