import { AuthManager } from './auth.js';

// Elementos del DOM
const viewAnon = document.getElementById('view-anon');
const viewConnected = document.getElementById('view-connected'); // ¡Ahora sí existe!
const tabRadar = document.getElementById('tab-radar');
const tabDiario = document.getElementById('tab-diario');
const sectionRadar = document.getElementById('section-radar');
const sectionDiario = document.getElementById('section-diario');

// Gestión de Vistas (Invitado <-> Conectado)
function updateView(isLoggedIn, profile = null) {
    if (isLoggedIn) {
        viewAnon.style.display = 'none';
        viewConnected.style.display = 'block';

        // Inyectar datos del perfil
        if (profile) {
            document.getElementById('profile-name').textContent = profile.display_name || profile.name || "Nostr User";
            if (profile.picture) document.getElementById('profile-avatar').src = profile.picture;
            
            // Hardcodeado por ahora (Stats)
            document.getElementById('stat-sats').textContent = "24.5K";
        }
        
        // Pubkey acortada
        const npubShort = AuthManager.userPubkey ? AuthManager.userPubkey.substring(0, 8) + '...' : '...';
        document.getElementById('profile-pubkey').textContent = '@' + npubShort;

    } else {
        viewAnon.style.display = 'block';
        viewConnected.style.display = 'none';
    }
}

// Gestión de Pestañas
function setupTabs() {
    if (!tabRadar) return; // Validación mínima

    tabRadar.addEventListener('click', () => {
        tabRadar.classList.add('active');
        tabDiario.classList.remove('active');
        sectionRadar.style.display = 'block';
        sectionDiario.style.display = 'none';
    });

    tabDiario.addEventListener('click', () => {
        tabDiario.classList.add('active');
        tabRadar.classList.remove('active');
        sectionDiario.style.display = 'block';
        sectionRadar.style.display = 'none';
    });
}

// Inicialización Pública
export function initUI(nostrInstance, refreshMapCallback) {
    setupTabs();

    // Listener Login
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            try {
                await AuthManager.login();
                const profile = await nostrInstance.getUserProfile(AuthManager.userPubkey);
                updateView(true, profile);
                if (refreshMapCallback) refreshMapCallback();
            } catch (err) {
                console.error("Login fallido:", err);
            }
        });
    }

    // Listener Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => window.location.reload());
    }
}