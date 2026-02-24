import { AdminAuth } from './admin-auth.js';

const ADMIN_RELAYS = [
    'wss://nos.lol',
    'wss://relay.damus.io',
    'wss://relay.snort.social'
];

export const BadgeManager = {
    pubkey: null,
    relayConnections: [],

    init(pubkey) {
        this.pubkey = pubkey;
        this._connectRelays();
        this._initBadgeForm();
        this._initAwardForm();
        this._initImageUpload();
        this._initPreviewSync();
    },

    /* ── Relay pool ─────────────────────────────────── */
    async _connectRelays() {
        this.relayConnections = ADMIN_RELAYS.map(url => {
            try { return new WebSocket(url); } catch { return null; }
        }).filter(Boolean);
    },

    async _broadcastEvent(signedEvent) {
        const results = [];
        for (const relay of ADMIN_RELAYS) {
            try {
                const ws = new WebSocket(relay);
                await new Promise((resolve, reject) => {
                    ws.onopen = () => {
                        ws.send(JSON.stringify(['EVENT', signedEvent]));
                        results.push({ relay, ok: true });
                        ws.close();
                        resolve();
                    };
                    ws.onerror = () => { results.push({ relay, ok: false }); reject(); };
                    setTimeout(resolve, 5000);
                });
            } catch {
                results.push({ relay, ok: false });
            }
        }
        console.log('[BadgeManager] Broadcast results:', results);
        return results;
    },

    /* ── Badge Definition: Kind 30009 ──────────────── */
    _initBadgeForm() {
        document.getElementById('btn-publish-badge')?.addEventListener('click', async () => {
            const name = document.getElementById('badge-name')?.value.trim();
            const d = document.getElementById('badge-d')?.value.trim().toLowerCase().replace(/\s+/g, '-');
            const description = document.getElementById('badge-description')?.value.trim();
            const imageUrl = document.getElementById('badge-image-url')?.value.trim();
            const thumbUrl = document.getElementById('badge-thumb-url')?.value.trim();

            if (!name || !d) {
                window.showAdminToast('Nombre y tag único son obligatorios.', 'error');
                return;
            }

            const btn = document.getElementById('btn-publish-badge');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Firmando…';
            window.setTxStatus('badge-tx-status', 'pending', 'Esperando firma NIP-07…');

            try {
                const tags = [
                    ['d', d],
                    ['name', name],
                ];
                if (description) tags.push(['description', description]);
                if (imageUrl) tags.push(['image', imageUrl]);
                if (thumbUrl) tags.push(['thumb', thumbUrl]);

                const eventTemplate = {
                    kind: 30009,
                    content: description || '',
                    tags,
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: this.pubkey,
                };

                const signedEvent = await AdminAuth.signEvent(eventTemplate);
                window.setTxStatus('badge-tx-status', 'pending', 'Publicando en relays…');

                const results = await this._broadcastEvent(signedEvent);
                const ok = results.filter(r => r.ok).length;

                window.setTxStatus('badge-tx-status', 'success', `✅ Medalla publicada en ${ok}/${results.length} relays. ID: ${signedEvent.id.substring(0, 12)}…`);
                window.showAdminToast(`Medalla "${name}" publicada exitosamente.`, 'success');

            } catch (err) {
                window.setTxStatus('badge-tx-status', 'error', `Error: ${err.message}`);
                window.showAdminToast('Error al publicar la medalla.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-bolt mr-2"></i>Publicar medalla en Nostr';
            }
        });
    },

    /* ── Badge Award: Kind 8 ────────────────────────── */
    _initAwardForm() {
        document.getElementById('btn-award-badge')?.addEventListener('click', async () => {
            const recipientRaw = document.getElementById('award-recipient')?.value.trim();
            const badgeD = document.getElementById('award-badge-d')?.value.trim();

            if (!recipientRaw || !badgeD) {
                window.showAdminToast('Recipient y badge d-tag son obligatorios.', 'error');
                return;
            }

            // Decode npub if needed
            let recipient = recipientRaw;
            if (recipientRaw.startsWith('npub1')) {
                try {
                    const { nip19 } = await import('nostr-tools/nip19');
                    recipient = nip19.decode(recipientRaw).data;
                } catch {
                    window.showAdminToast('npub inválida.', 'error');
                    return;
                }
            }

            const btn = document.getElementById('btn-award-badge');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Firmando…';
            window.setTxStatus('award-tx-status', 'pending', 'Esperando firma NIP-07…');

            try {
                const badgeAddr = `30009:${this.pubkey}:${badgeD}`;
                const eventTemplate = {
                    kind: 8,
                    content: '',
                    tags: [
                        ['a', badgeAddr],
                        ['p', recipient, '', 'awarded'],
                    ],
                    created_at: Math.floor(Date.now() / 1000),
                    pubkey: this.pubkey,
                };

                const signedEvent = await AdminAuth.signEvent(eventTemplate);
                window.setTxStatus('award-tx-status', 'pending', 'Publicando en relays…');
                const results = await this._broadcastEvent(signedEvent);
                const ok = results.filter(r => r.ok).length;

                window.setTxStatus('award-tx-status', 'success', `Medalla otorgada en ${ok}/${results.length} relays.`);
                window.showAdminToast('¡Medalla otorgada!', 'success');

                document.getElementById('award-recipient').value = '';
                document.getElementById('award-badge-d').value = '';
            } catch (err) {
                window.setTxStatus('award-tx-status', 'error', `Error: ${err.message}`);
                window.showAdminToast('Error al otorgar la medalla.', 'error');
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-award mr-2"></i>Publicar Kind 8';
            }
        });
    },

    /* ── Image Upload → nostr.build ──────────────────── */
    _initImageUpload() {
        document.getElementById('badge-image-file')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const statusEl = document.getElementById('badge-upload-status');
            statusEl.textContent = 'Subiendo imagen…';
            try {
                const formData = new FormData();
                formData.append('fileToUpload', file);
                const res = await fetch('https://nostr.build/api/v2/upload/files', { method: 'POST', body: formData });
                const json = await res.json();
                const url = json?.data?.[0]?.url;
                if (!url) throw new Error('URL no encontrada en respuesta');
                document.getElementById('badge-image-url').value = url;
                statusEl.textContent = '✅ Imagen subida';
                this._updatePreview();
            } catch (err) {
                statusEl.textContent = `❌ ${err.message}`;
            }
        });
    },

    /* ── Live Preview ─────────────────────────────────── */
    _initPreviewSync() {
        ['badge-name', 'badge-d', 'badge-description', 'badge-image-url'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this._updatePreview());
        });
    },

    _updatePreview() {
        const name = document.getElementById('badge-name')?.value || 'Nombre de la medalla';
        const d = document.getElementById('badge-d')?.value || 'd-tag';
        const desc = document.getElementById('badge-description')?.value || 'La descripción aparecerá aquí.';
        const imgUrl = document.getElementById('badge-image-url')?.value;

        document.getElementById('badge-preview-name').textContent = name;
        document.getElementById('badge-preview-d').textContent = `@${d}`;
        document.getElementById('badge-preview-desc').textContent = desc;

        const wrapper = document.getElementById('badge-preview-img-wrapper');
        if (imgUrl) {
            wrapper.innerHTML = `<img src="${imgUrl}" class="w-full h-full object-cover rounded-full" onerror="this.style.display='none'">`;
        } else {
            wrapper.innerHTML = `<span class="material-symbols-rounded text-4xl text-slate-600" style="font-variation-settings:'FILL' 1">workspace_premium</span>`;
        }
    }
};
