import { AdminAuth } from './admin-auth.js';
import { BadgeManager } from './badge-manager.js';
import { GamificationService } from './gamification-service.js';
import { UserSearchService } from './user-search-service.js';

/* ─── Navigation ─────────────────────────────────────────── */
window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.getElementById(`section-${id}`)?.classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => {
        if (l.getAttribute('onclick')?.includes(id)) l.classList.add('active');
    });
};

/* ─── Toast ──────────────────────────────────────────────── */
window.showAdminToast = (message, type = 'info') => {
    const colors = { success: 'bg-green-500/20 border border-green-500/40 text-green-300', error: 'bg-red-500/20 border border-red-500/40 text-red-300', info: 'bg-brand/20 border border-brand/40 text-indigo-300' };
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${colors[type]}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
};

/* ─── Status Box ─────────────────────────────────────────── */
function setTxStatus(elId, type, message) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = `rounded-xl p-3 text-sm font-semibold flex items-center gap-2`;
    const states = {
        pending: 'bg-amber-500/15 text-amber-300',
        success: 'bg-green-500/15 text-green-300',
        error: 'bg-red-500/15 text-red-300'
    };
    el.classList.add(...(states[type] || states.pending).split(' '));
    const icons = { pending: '⏳', success: '✅', error: '❌' };
    el.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    el.classList.remove('hidden');
}

window.setTxStatus = setTxStatus;

/* ─── Bootstrap ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    // Auth gate
    document.getElementById('btn-auth-login').addEventListener('click', async () => {
        const btn = document.getElementById('btn-auth-login');
        const errEl = document.getElementById('auth-error');
        btn.disabled = true;
        btn.textContent = 'Conectando…';
        errEl.classList.add('hidden');
        try {
            const pubkey = await AdminAuth.login();
            if (!AdminAuth.isAdmin(pubkey)) {
                document.getElementById('auth-gate').classList.add('hidden');
                document.getElementById('unauthorized-gate').classList.remove('hidden');
                return;
            }
            document.getElementById('auth-gate').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('sidebar-pubkey').textContent = `@${pubkey.substring(0, 10)}…`;
            initModules(pubkey);
        } catch (err) {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = 'Conectar con extensión Nostr';
        }
    });
});

function initModules(pubkey) {
    BadgeManager.init(pubkey);
    GamificationService.init(pubkey);
    UserSearchService.init(pubkey);
    loadDashboardStats();
}

async function loadDashboardStats() {
    // Load saved rules from Kind 30078
    await GamificationService.loadRules();
}
