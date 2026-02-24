import { AdminAuth } from './admin-auth.js';

const SEARCH_RELAYS = ['wss://nos.lol', 'wss://relay.damus.io'];

export const UserSearchService = {
    pubkey: null,

    init(pubkey) {
        this.pubkey = pubkey;
        document.getElementById('btn-load-users')?.addEventListener('click', () => this.loadUsers());
    },

    async loadUsers() {
        const tbody = document.getElementById('users-table-body');
        const btn = document.getElementById('btn-load-users');
        if (!tbody || !btn) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Buscando…';
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 text-sm py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Buscando usuarios activos en relays…</td></tr>';

        try {
            const userPinCount = new Map();
            const userProfiles = new Map();

            await Promise.all(SEARCH_RELAYS.map(url => new Promise((resolve) => {
                const ws = new WebSocket(url);
                ws.onopen = () => {
                    ws.send(JSON.stringify(['REQ', 'user-search', { kinds: [1], '#t': ['spatial_anchor'], limit: 200 }]));
                };
                ws.onmessage = (msg) => {
                    try {
                        const data = JSON.parse(msg.data);
                        if (data[0] === 'EVENT') {
                            const event = data[2];
                            userPinCount.set(event.pubkey, (userPinCount.get(event.pubkey) || 0) + 1);
                        }
                        if (data[0] === 'EOSE') { ws.close(); resolve(); }
                    } catch { }
                };
                ws.onerror = resolve;
                setTimeout(() => { ws.close(); resolve(); }, 8000);
            })));

            // Sort by activity
            const sorted = [...userPinCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);

            if (sorted.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-slate-500 text-sm py-8">No se encontraron usuarios con anclas.</td></tr>';
                return;
            }

            tbody.innerHTML = sorted.map(([pk, count]) => `
                <tr>
                    <td>
                        <div class="flex items-center gap-3">
                            <img src="https://www.gravatar.com/avatar/${pk.substring(0, 8)}?d=mp" class="w-8 h-8 rounded-full border border-white/10">
                            <span class="text-xs font-semibold text-slate-300" id="name-${pk.substring(0, 8)}">@${pk.substring(0, 8)}…</span>
                        </div>
                    </td>
                    <td><span class="font-mono text-[10px] text-slate-500">${pk.substring(0, 16)}…</span></td>
                    <td><span class="text-sm font-bold text-brand">${count}</span></td>
                    <td>
                        <button class="btn-ghost text-[11px]" onclick="grantBadgeTo('${pk}')">
                            <i class="fas fa-award mr-1 text-amber-400"></i>Otorgar medalla
                        </button>
                    </td>
                </tr>
            `).join('');

            // Show award panel when clicking
            window.grantBadgeTo = (pk) => {
                document.getElementById('award-recipient').value = pk;
                document.getElementById('award-panel').classList.remove('hidden');
                document.getElementById('award-panel').scrollIntoView({ behavior: 'smooth' });
            };

        } catch (err) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-red-400 text-sm py-8">Error: ${err.message}</td></tr>`;
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync mr-2"></i>Cargar usuarios activos';
        }
    }
};
