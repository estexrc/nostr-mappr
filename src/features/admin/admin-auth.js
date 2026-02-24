import { decode } from 'nostr-tools/nip19';

/**
 * AdminAuth - Zero-nsec policy enforced.
 * All signing is done via NIP-07 browser extension only.
 * ADMIN_PUBKEY accepts both npub and 64-char hex format.
 */

// ✅ Paste your pubkey here — npub OR hex both work
const ADMIN_PUBKEY_RAW = 'npub16yzjf9uteycy2anufy53hdv8njuvj268x7phzjckt4cl8usmykvsfjccqy';

/**
 * Converts ADMIN_PUBKEY_RAW to hex (strips npub encoding if needed).
 */
function resolveAdminHex() {
    const raw = ADMIN_PUBKEY_RAW.trim();
    if (raw.startsWith('npub1')) {
        try {
            const { type, data } = decode(raw);
            if (type === 'npub') return data;
        } catch (e) {
            console.error('[AdminAuth] Failed to decode npub:', e);
        }
    }
    return raw; // assume already hex
}

const ADMIN_PUBKEY_HEX = resolveAdminHex();

export const AdminAuth = {
    pubkey: null,

    /**
     * NIP-07 login — requests pubkey from browser extension.
     * @returns {Promise<string>} hex pubkey
     */
    async login() {
        if (!window.nostr) {
            throw new Error('No se detectó una extensión Nostr (NIP-07). Instala Alby, nos2x o similar.');
        }
        const pubkey = await window.nostr.getPublicKey();
        this.pubkey = pubkey;
        return pubkey;
    },

    /**
     * Returns true only if pubkey (hex) matches the resolved ADMIN_PUBKEY.
     */
    isAdmin(pubkey) {
        return pubkey === ADMIN_PUBKEY_HEX;
    },

    /**
     * Signs an event via NIP-07. Never touches private keys.
     * @param {object} eventTemplate - unsigned Nostr event
     * @returns {Promise<object>} signed event
     */
    async signEvent(eventTemplate) {
        if (!window.nostr) throw new Error('Extensión Nostr no disponible.');
        return await window.nostr.signEvent(eventTemplate);
    }
};
