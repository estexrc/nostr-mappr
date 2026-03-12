import * as nip19 from 'nostr-tools/nip19'
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { hexToBytes, bytesToHex } from '@noble/hashes/utils'

export const AuthManager = {
    /* Load stored pubkey and profile cache from localStorage on startup. */
    userPubkey: localStorage.getItem('nostr_user_pubkey') || null,
    profileCache: JSON.parse(localStorage.getItem('nostr_profiles')) || {},
    loginMethod: localStorage.getItem('nostr_login_method') || 'extension', // 'extension', 'read-only', 'connect', or 'local'
    connectData: JSON.parse(localStorage.getItem('nostr_connect_data')) || null, // { signerPubkey, clientSecretKey }
    localSecretKey: localStorage.getItem('nostr_local_sk') || null,

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
     * Signs an event using the available NIP-07 extension.
     */
    async signEvent(event) {
        if (window.nostr) {
            return await window.nostr.signEvent(event);
        }
        throw new Error("No hay extensión disponible para firmar.");
    },

    /**
     * Manual Login (npub, hex, or NIP-05 - NIP-05 removed)
     */
    async loginManual(input) {
        let pubkey = input.trim();

        try {
            // 1. Check if npub
            if (pubkey.startsWith('npub1')) {
                const { type, data } = nip19.decode(pubkey);
                if (type !== 'npub') throw new Error("Npub inválido");
                pubkey = data;
            }
            // 2. Check if 64-char hex
            else if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
                throw new Error("Formato de llave pública no reconocido (prohibido NIP-05)");
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
     * Login with Secret Key (nsec1... or hex)
     */
    async loginSecret(input) {
        let skBytes;
        try {
            if (input.startsWith('nsec1')) {
                const { type, data } = nip19.decode(input);
                if (type !== 'nsec') throw new Error("nsec inválido");
                skBytes = data;
            } else if (/^[0-9a-fA-F]{64}$/.test(input)) {
                skBytes = hexToBytes(input);
            } else {
                throw new Error("Formato de clave privada no reconocido");
            }

            const pubkey = getPublicKey(skBytes);
            this.userPubkey = pubkey;
            this.loginMethod = 'local';
            this.localSecretKey = bytesToHex(skBytes);

            localStorage.setItem('nostr_user_pubkey', pubkey);
            localStorage.setItem('nostr_login_method', 'local');
            localStorage.setItem('nostr_local_sk', this.localSecretKey);

            return this.userPubkey;
        } catch (error) {
            console.error("Secret login error:", error);
            throw error;
        }
    },

    /**
     * Generate new Nostr Identity
     */
    async generate() {
        const sk = generateSecretKey();
        const pk = getPublicKey(sk); // already returns hex from nostr-tools
        const nsec = nip19.nsecEncode(sk);

        this.userPubkey = pk;
        this.loginMethod = 'local';
        this.localSecretKey = bytesToHex(sk);

        localStorage.setItem('nostr_user_pubkey', pk);
        localStorage.setItem('nostr_login_method', 'local');
        localStorage.setItem('nostr_local_sk', this.localSecretKey);

        return { pubkey: pk, nsec };
    },

    /**
     * Email Login leveraging NIP-46 (Nostr Connect)
     * STRICT NIP-46 flow (Bunker Pull).
     * NIP-05 lookup is EXPLICITLY PROHIBITED.
     */
    async loginEmail(email, password) {
        // We do NOT purge local identity here, only the active session
        this.userPubkey = null;
        this.loginMethod = 'connect';
        return { email };
    },

    /**
     * Selective reset of session state.
     * @param {boolean} hard - If true, clears EVERYTHING including local identity.
     */
    purgeSession(hard = false) {
        // Always clear active session state
        this.userPubkey = null;
        this.loginMethod = null;
        this.connectData = null;

        localStorage.removeItem('nostr_user_pubkey');
        localStorage.removeItem('nostr_login_method');
        localStorage.removeItem('nostr_connect_data');

        if (hard) {
            this.localSecretKey = null;
            localStorage.clear();
            sessionStorage.clear();
            // Clear Cookies
            document.cookie.split(";").forEach((c) => {
                document.cookie = c
                    .replace(/^ +/, "")
                    .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            console.log("♻️ Hard-reset: Everything purged.");
        } else {
            console.log("♻️ Session logout: Identity preserved.");
        }
    },

    /* Clears session but keeps identity unless hard logout is invoked. */
    logout(hard = false) {
        this.purgeSession(hard);
        location.reload();
    },

    /**
     * Specialized cleanup for bunker sessions to prevent corrupt half-states.
     */
    clearBunkerSession() {
        localStorage.removeItem('nostr_connect_data');
        this.connectData = null;
        // Specifically clear the bunker_ptr cookie
        document.cookie = "bunker_ptr=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    },

    /* Stores profile metadata in the local cache. */
    saveProfile(pubkey, profileData) {
        this.profileCache[pubkey] = profileData;
        localStorage.setItem('nostr_profiles', JSON.stringify(this.profileCache));
    },

    /* Retrieves a display name from cache or returns a shortened pubkey. */
    getDisplayName(pubkey) {
        if (!pubkey) return "Invitado";
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
        if (window.nostr) return true; // Extension is always an option if present
        if (!this.isLoggedIn()) return false;
        if (this.loginMethod === 'connect') return true; // Managed by SDK/Bunker
        if (this.loginMethod === 'local' && this.localSecretKey) return true;
        return false;
    }
};