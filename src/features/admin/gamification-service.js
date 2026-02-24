import { AdminAuth } from './admin-auth.js';

const ADMIN_RELAYS = [
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.snort.social'
];

const RULES_D_TAG = 'mappr-game-rules-v1';

export const GamificationService = {
    pubkey: null,

    init(pubkey) {
        this.pubkey = pubkey;
        document.getElementById('btn-save-rules')?.addEventListener('click', () => this.saveRules());
    },

    _getRulesFromForm() {
        return {
            points_per_pin: parseInt(document.getElementById('rule-points-pin')?.value || '10', 10),
            daily_cap: parseInt(document.getElementById('rule-daily-cap')?.value || '100', 10),
            streak_bonus: parseInt(document.getElementById('rule-streak-bonus')?.value || '5', 10),
            level_bronze: parseInt(document.getElementById('rule-level-bronze')?.value || '100', 10),
            level_silver: parseInt(document.getElementById('rule-level-silver')?.value || '500', 10),
            level_gold: parseInt(document.getElementById('rule-level-gold')?.value || '2000', 10),
        };
    },

    async saveRules() {
        const btn = document.getElementById('btn-save-rules');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Firmando…';
        window.setTxStatus('rules-tx-status', 'pending', 'Esperando firma NIP-07…');

        try {
            const rules = this._getRulesFromForm();
            const eventTemplate = {
                kind: 30078,
                content: JSON.stringify(rules),
                tags: [
                    ['d', RULES_D_TAG],
                    ['app', 'mappr'],
                ],
                created_at: Math.floor(Date.now() / 1000),
                pubkey: this.pubkey,
            };

            const signedEvent = await AdminAuth.signEvent(eventTemplate);
            window.setTxStatus('rules-tx-status', 'pending', 'Publicando configuración…');

            let ok = 0;
            for (const url of ADMIN_RELAYS) {
                try {
                    const ws = new WebSocket(url);
                    await new Promise((resolve) => {
                        ws.onopen = () => { ws.send(JSON.stringify(['EVENT', signedEvent])); ok++; ws.close(); resolve(); };
                        ws.onerror = resolve;
                        setTimeout(resolve, 5000);
                    });
                } catch { }
            }

            window.setTxStatus('rules-tx-status', 'success', `Reglas guardadas en ${ok}/${ADMIN_RELAYS.length} relays.`);
            window.showAdminToast('Reglas de juego guardadas.', 'success');

            const el = document.getElementById('rules-sync-status');
            if (el) el.innerHTML = `<span class="status-dot status-success inline-block"></span> Sincronizado · ${new Date().toLocaleTimeString()}`;
        } catch (err) {
            window.setTxStatus('rules-tx-status', 'error', `Error: ${err.message}`);
            window.showAdminToast('Error al guardar las reglas.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save mr-2"></i>Guardar configuración en Nostr (Kind 30078)';
        }
    },

    async loadRules() {
        const el = document.getElementById('rules-sync-status');
        if (el) el.textContent = 'Cargando configuración…';

        try {
            for (const url of ADMIN_RELAYS) {
                const result = await new Promise((resolve) => {
                    const ws = new WebSocket(url);
                    let found = null;
                    ws.onopen = () => {
                        ws.send(JSON.stringify(['REQ', 'admin-rules', { kinds: [30078], authors: [this.pubkey], '#d': [RULES_D_TAG], limit: 1 }]));
                    };
                    ws.onmessage = (msg) => {
                        const data = JSON.parse(msg.data);
                        if (data[0] === 'EVENT') { found = data[2]; ws.close(); resolve(found); }
                        if (data[0] === 'EOSE') { ws.close(); resolve(null); }
                    };
                    ws.onerror = () => resolve(null);
                    setTimeout(() => { ws.close(); resolve(null); }, 5000);
                });
                if (result) {
                    const rules = JSON.parse(result.content);
                    this._applyRulesToForm(rules);
                    if (el) el.innerHTML = `<span class="status-dot status-success inline-block"></span> Cargado desde relay`;
                    return;
                }
            }
            if (el) el.textContent = 'No se encontró configuración guardada, usando valores predeterminados.';
        } catch (err) {
            console.warn('[GamificationService] loadRules error:', err);
        }
    },

    _applyRulesToForm(rules) {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set('rule-points-pin', rules.points_per_pin ?? 10);
        set('rule-daily-cap', rules.daily_cap ?? 100);
        set('rule-streak-bonus', rules.streak_bonus ?? 5);
        set('rule-level-bronze', rules.level_bronze ?? 100);
        set('rule-level-silver', rules.level_silver ?? 500);
        set('rule-level-gold', rules.level_gold ?? 2000);
    }
};
