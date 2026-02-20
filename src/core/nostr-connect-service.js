import { generateSecretKey, getPublicKey } from 'nostr-tools'
import * as nip46 from 'nostr-tools/nip46'
import { hexToBytes } from 'nostr-tools/utils'

export class NostrConnectService {
    constructor(nostrPool, relays) {
        this.pool = nostrPool;
        this.relays = relays;
        this.signerPubkey = null;
        this.clientSecretKey = null;
        this.clientPubkey = null;
        this.connection = null;
    }

    /**
     * Initializes a connection with a remote signer (Bunker).
     * @param {string} bunkerUrl - Connection string (bunker://<pubkey>?relay=<relay>&token=<token>)
     */
    async connect(bunkerUrl) {
        try {
            // 1. Setup ephemeral client key
            this.clientSecretKey = generateSecretKey();
            this.clientPubkey = getPublicKey(this.clientSecretKey);

            // 2. Parse bunker URL
            const bp = await nip46.parseBunkerInput(bunkerUrl);
            if (!bp) throw new Error("URL de Bunker inválida o perfil no encontrado");

            this.signerPubkey = bp.pubkey;

            // 3. Setup NIP-46 Connection (BunkerSigner)
            this.connection = nip46.BunkerSigner.fromBunker(this.clientSecretKey, bp, {
                pool: this.pool
            });

            // 4. Send connect request
            await this.connection.connect();

            console.log("✅ Nostr Connect established with:", this.signerPubkey);
            return this.signerPubkey;
        } catch (err) {
            console.error("Nostr Connect failure:", err);
            throw err;
        }
    }

    /**
     * Signs an event using the remote signer.
     */
    async signEvent(event) {
        if (!this.connection) throw new Error("No hay un firmador remoto conectado");

        try {
            const signedEvent = await this.connection.signEvent(event);
            return signedEvent;
        } catch (err) {
            console.error("Remote signing error:", err);
            throw err;
        }
    }

    /**
     * Deserializes connection from storage.
     */
    async resume(signerPubkey, secretKeyHex) {
        try {
            this.signerPubkey = signerPubkey;
            this.clientSecretKey = hexToBytes(secretKeyHex);
            this.clientPubkey = getPublicKey(this.clientSecretKey);

            // Reconstruct Bunker Pointer (assuming the signer pubkey and original relays are sufficient)
            // Note: In a real scenario, we'd store the relays associated with that bunker too.
            const bp = {
                pubkey: this.signerPubkey,
                relays: this.relays, // Using app relays as fallback
                secret: null
            };

            this.connection = nip46.BunkerSigner.fromBunker(this.clientSecretKey, bp, {
                pool: this.pool
            });

            console.log("🔄 Nostr Connect resumed for:", this.signerPubkey);
        } catch (err) {
            console.error("Failed to resume Nostr Connect:", err);
        }
    }
}
