import { SimplePool } from 'nostr-tools';
import { AuthManager } from './auth.js';

export class NostrService {
    constructor(relayUrls) {
        this.relays = relayUrls;
        this.pool = new SimplePool();
    }

    
    subscribeToAnchors(onEvent) {
        // 1. Definimos el filtro global inicial
        const filtroGlobal = {
            kinds: [1],
            "#t": ["spatial_anchor"],
            limit: 200
        };

        
        const filtros = [filtroGlobal];

        if (AuthManager.userPubkey) {
            filtros.push({
                kinds: [1],
                authors: [AuthManager.userPubkey],
                limit: 50
            });
        }

        console.log("📡 Suscribiendo a relays con filtros:", filtros);

        console.log("🔍 Depuración: Suscribiendo a estos relays:", this.relays);
        console.log("📋 Depuración: Filtros enviados:", JSON.stringify(filtros));

        return this.pool.subscribeMany(
        this.relays, 
        filtros, 
        {
            onevent(event) {
                // Verificamos si el evento tiene etiquetas de geohash (NIP-01/Geo)
                console.log("✨ Evento recibido de relay:", event.id);
                onEvent(event);
            },
            oneose() {
                // EOSE (End of Stored Events): Esto confirma que el relay 
                // ya terminó de enviarnos los eventos PASADOS.
                console.log("✅ Fin de eventos almacenados (EOSE). Buscando nuevos...");
            },
            onerror(err) {
                console.error("❌ Error en relay durante suscripción:", err);
            }
        }
    );
}

    
    async publishAnchor(eventData) {
        const event = {
            kind: 1,
            pubkey: eventData.pubkey,
            created_at: Math.floor(Date.now() / 1000),
            content: eventData.content,
            tags: eventData.tags
        };

        try {
            // Llama a la extensión del navegador para firmar
            const signedEvent = await window.nostr.signEvent(event);
            
            // Publica el evento firmado en todos los relays
            await Promise.any(this.pool.publish(this.relays, signedEvent));
            
            console.log("🚀 Evento anclado y publicado:", signedEvent);
            return signedEvent;
        } catch (err) {
            console.error("❌ Error en el proceso de anclaje:", err);
            throw err;
        }
    }

    /**
     * Recupera los metadatos de perfil del usuario (Kind 0).
     */
    async getUserProfile(pubkey) {
        const filter = { kinds: [0], authors: [pubkey], limit: 1 };
        
        try {
            // Intentamos obtener el perfil con un límite de tiempo de 3 segundos
            const event = await this.pool.get(this.relays, filter, { timeout: 3000 });
            
            if (event && event.content) {
                return JSON.parse(event.content);
            }
        } catch (e) {
            console.warn("⚠️ No se pudo cargar el perfil para:", pubkey);
        }
        return null;
    }
}