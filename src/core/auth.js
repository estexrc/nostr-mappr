import * as nip19 from 'nostr-tools/nip19'
import * as nip05 from 'nostr-tools/nip05'

export const AuthManager = {
    /* Load stored pubkey and profile cache from localStorage on startup. */
    userPubkey: localStorage.getItem('nostr_user_pubkey') || null,
    profileCache: JSON.parse(localStorage.getItem('nostr_profiles')) || {},
    loginMethod: localStorage.getItem('nostr_login_method') || 'extension', // 'extension', 'read-only', or 'connect'
    connectData: JSON.parse(localStorage.getItem('nostr_connect_data')) || null, // { signerPubkey, clientSecretKey }

    /**
     * Extension Login (NIP-07)
     */
    async login() {
        if (!window.nostr) {
            throw new Error("No se detectó una extensión de Nostr. Intenta el login manual.");
        }

        try {
            const pubkey = await window.nostr.getPublicKey();
            this.userPubkey = pubkey;
            this.loginMethod = 'extension';

            localStorage.setItem('nostr_user_pubkey', pubkey);
            localStorage.setItem('nostr_login_method', 'extension');

            return this.userPubkey;
        } catch (error) {
            console.error("Login extension error:", error);
            throw error;
        }
    },

    /**
     * Manual Login (npub, hex, or NIP-05)
     */
    async loginManual(input) {
        let pubkey = input.trim();

        try {
            // 1. Check if NIP-05 (user@domain.com)
            if (pubkey.includes('@')) {
                const profile = await nip05.queryProfile(pubkey);
                if (!profile || !profile.pubkey) throw new Error("No se pudo resolver la dirección NIP-05");
                pubkey = profile.pubkey;
            }
            // 2. Check if npub
            else if (pubkey.startsWith('npub1')) {
                const { type, data } = nip19.decode(pubkey);
                if (type !== 'npub') throw new Error("Npub inválido");
                pubkey = data;
            }
            // 3. Check if 64-char hex
            else if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
                throw new Error("Formato de llave pública no reconocido");
            }

            this.userPubkey = pubkey;
            this.loginMethod = 'read-only';

            localStorage.setItem('nostr_user_pubkey', pubkey);
            localStorage.setItem('nostr_login_method', 'read-only');

            return this.userPubkey;
        } catch (error) {
            console.error("Manual login error:", error);
            throw error;
        }
    },

    /**
     * Nostr Connect Login (NIP-46)
     */
    async loginConnect(signerPubkey, clientSecretKeyHex) {
        this.userPubkey = signerPubkey;
        this.loginMethod = 'connect';
        this.connectData = { signerPubkey, clientSecretKey: clientSecretKeyHex };

        localStorage.setItem('nostr_user_pubkey', signerPubkey);
        localStorage.setItem('nostr_login_method', 'connect');
        localStorage.setItem('nostr_connect_data', JSON.stringify(this.connectData));

        return this.userPubkey;
    },

    /* Clears session data and reloads the application. */
    logout() {
        this.userPubkey = null;
        this.loginMethod = null;
        this.connectData = null;
        localStorage.removeItem('nostr_user_pubkey');
        localStorage.removeItem('nostr_login_method');
        localStorage.removeItem('nostr_connect_data');
        location.reload();
    },

    /* Stores profile metadata in the local cache. */
    saveProfile(pubkey, profileData) {
        this.profileCache[pubkey] = profileData;
        localStorage.setItem('nostr_profiles', JSON.stringify(this.profileCache));
    },

    /* Retrieves a display name from cache or returns a shortened pubkey. */
    getDisplayName(pubkey) {
        return this.profileCache[pubkey]?.name ||
            this.profileCache[pubkey]?.display_name ||
            pubkey.substring(0, 8);
    },

    /* Simple check to verify if a user session is active. */
    isLoggedIn() {
        return !!this.userPubkey;
    },

    /* Returns true if the user can sign events */
    canSign() {
        if (!this.isLoggedIn()) return false;
        if (this.loginMethod === 'extension' && !!window.nostr) return true;
        if (this.loginMethod === 'connect' && this.connectData) return true;
        return false;
    }
};