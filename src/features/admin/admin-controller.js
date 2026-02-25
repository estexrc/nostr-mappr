import { AdminAuth } from './admin-auth.js';
import { BadgeManager } from './badge-manager.js';
import { GamificationService } from './gamification-service.js';
import { UserSearchService } from './user-search-service.js';

/* ─── Navigation ─────────────────────────────────────────── */


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
    // 1. Load saved rules from Kind 30078
    await GamificationService.loadRules();

    // 2. Start Live Activity Feed
    startLiveActivityFeed();
}

function startLiveActivityFeed() {
    const list = document.getElementById('event-log-list');
    if (!list) return;

    // Use a public relay for live activity
    const ws = new WebSocket('wss://nos.lol');

    ws.onopen = () => {
        // Subscribe to global notes (Kind 1) just to show "live" activity
        // In a real app, we might filter for app-specific tags
        ws.send(JSON.stringify(['REQ', 'live-feed', { kinds: [1], limit: 0 }]));
    };

    ws.onmessage = (msg) => {
        try {
            const data = JSON.parse(msg.data);
            if (data[0] === 'EVENT') {
                const event = data[2];
                const item = document.createElement('div');
                item.className = 'flex gap-4 group cursor-default animate-fade-slide';

                // Truncate message
                const text = event.content.length > 60 ? event.content.substring(0, 57) + '...' : event.content;
                const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                item.innerHTML = `
                    <div class="flex flex-col items-center">
                        <div class="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>
                        <div class="flex-1 w-0.5 bg-slate-200 my-1"></div>
                    </div>
                    <div class="flex-1 pb-1">
                        <div class="flex items-center justify-between mb-0.5">
                            <span class="text-[13px] font-bold text-slate-800 line-clamp-1">${text}</span>
                            <span class="text-[10px] font-medium text-slate-400">${time}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="material-symbols-rounded text-[12px] text-indigo-400" style="font-variation-settings:'FILL' 1">chat_bubble</span>
                            <span class="text-[11px] text-slate-500 font-mono">${event.pubkey.substring(0, 8)}</span>
                        </div>
                    </div>
                `;

                if (list.querySelector('div[style*="text-align:center"]')) {
                    list.innerHTML = '';
                }

                list.prepend(item);

                // Keep only last 20 items
                if (list.children.length > 20) {
                    list.removeChild(list.lastChild);
                }
            }
        } catch { }
    };
}
