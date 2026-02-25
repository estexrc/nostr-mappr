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

            // Fetch real profiles for these users
            const pks = sorted.map(s => s[0]);
            await Promise.all(SEARCH_RELAYS.map(url => new Promise((resolve) => {
                const ws = new WebSocket(url);
                ws.onopen = () => {
                    ws.send(JSON.stringify(['REQ', 'profiles', { kinds: [0], authors: pks }]));
                };
                ws.onmessage = (msg) => {
                    try {
                        const data = JSON.parse(msg.data);
                        if (data[0] === 'EVENT') {
                            const event = data[2];
                            const profile = JSON.parse(event.content);
                            userProfiles.set(event.pubkey, profile);
                        }
                        if (data[0] === 'EOSE') { ws.close(); resolve(); }
                    } catch { }
                };
                ws.onerror = resolve;
                setTimeout(() => { ws.close(); resolve(); }, 4000);
            })));

            tbody.innerHTML = sorted.map(([pk, count]) => {
                const profile = userProfiles.get(pk) || {};
                const name = profile.display_name || profile.name || `Usuario ${pk.substring(0, 4)}`;
                const pic = profile.picture || `https://robohash.org/${pk.substring(0, 8)}?set=set4`;

                return `
                <tr class="group border-b border-transparent hover:border-slate-200">
                    <td>
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full border border-slate-200 overflow-hidden bg-slate-100">
                                <img src="${pic}" class="w-full h-full object-cover" onerror="this.src='https://robohash.org/${pk.substring(0, 8)}?set=set4'">
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[13px] font-bold text-slate-800" id="name-${pk.substring(0, 8)}">${name}</span>
                                <span class="text-[10px] text-slate-500 font-medium">${profile.nip05 || 'Activo recientemente'}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="flex items-center gap-2">
                            <span class="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">${pk.substring(0, 16)}…</span>
                        </div>
                    </td>
                    <td>
                        <div class="flex items-center gap-1.5">
                            <div style="padding:2px 8px; border-radius:12px; background:rgba(99,102,241,0.06); border:1px solid rgba(99,102,241,0.1); font-size:11px; font-weight:700; color:#4f46e5;">
                                ${count} anclas
                            </div>
                        </div>
                    </td>
                    <td>
                        <button class="btn-ghost group-hover:bg-brand group-hover:text-white transition-all duration-300" style="padding:6px 14px; font-size:11px; border-radius:8px;" onclick="grantBadgeTo('${pk}')">
                            <i class="fas fa-award mr-1.5 opacity-80"></i>Otorgar
                        </button>
                    </td>
                </tr>`;
            }).join('');

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
