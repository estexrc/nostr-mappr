/**
 * Centralized Store for managing application state.
 * Uses a Proxy to intercept changes if needed later for reactivity.
 */
class ViewModel {
    constructor() {
        this.state = {
            user: null, // { pubkey, profile }
            relays: ['wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io'],
            processedEvents: new Set(),
            pins: new Map(), // Processed pins for the map
            currentLocation: null, // { lat, lon }
            temporalPin: null, // { id: 'temp', lat, lon, type: 'pop'|'search' }
            isLoggedIn: false
        };
        this.listeners = [];
        this.watchId = null;
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        this.listeners.forEach(l => l(this.state));
    }

    /**
     * Cleans event content by removing image URLs and metadata.
     */
    cleanContent(content) {
        if (!content) return "";
        return content
            .replace(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\.bmp)(?:\?[^\s]*)?/gi, '')
            .trim();
    }

    /**
     * Processes a Nostr event into a clean pin object.
     */
    processEventToPin(event, profile, isDraft = false) {
        const titleTag = event.tags.find(t => t[0] === 'title')?.[1];
        const parts = event.content.split('\n\n');

        const title = titleTag || (isDraft ? "Borrador" : parts[0]) || "Punto de Interés";
        const rawDescription = titleTag ? event.content : (parts.slice(1).join('\n\n') || parts[0] || "");

        return {
            id: event.id,
            pubkey: event.pubkey,
            title,
            description: this.cleanContent(rawDescription),
            categoryId: event.tags.find(t => t[0] === 't' && t[1] !== 'spatial_anchor')?.[1] || 'all',
            images: [
                ...new Set([
                    ...event.tags.filter(t => t[0] === 'image' || t[0] === 'imeta').map(t => t[1]),
                    ...(event.content.match(/https?:\/\/[^\s]+(?:\.jpg|\.jpeg|\.png|\.webp|\.gif|\.bmp)(?:\?[^\s]*)?/gi) || [])
                ])
            ],
            isDraft,
            type: isDraft ? 'draft' : 'public'
        };
    }

    /**
     * Starts watching GPS position to maintain zero-latency location state.
     */
    startLocationWatch() {
        if (!navigator.geolocation) return;
        if (this.watchId) navigator.geolocation.clearWatch(this.watchId);

        // Immediate fetch to seed the state
        navigator.geolocation.getCurrentPosition(
            (p) => {
                this.setState({
                    currentLocation: { lat: p.coords.latitude, lon: p.coords.longitude }
                });
            },
            null,
            { enableHighAccuracy: true }
        );

        this.watchId = navigator.geolocation.watchPosition(
            (p) => {
                this.setState({
                    currentLocation: { lat: p.coords.latitude, lon: p.coords.longitude }
                });
            },
            (err) => console.error("Location watch error:", err),
            { enableHighAccuracy: true, maximumAge: 10000 }
        );
    }
}

export const store = new ViewModel();
