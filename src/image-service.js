/* Service to handle authenticated image uploads via NIP-98 (NIP-94 compliant) */
export class ImageService {
    static async upload(file) {
        const formData = new FormData();
        formData.append('file[]', file);

        /* Create a signed event to authorize the upload (NIP-98) */
        const event = {
            kind: 27235,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ["u", "https://nostr.build/api/v2/upload/files"],
                ["method", "POST"]
            ],
            content: ""
        };

        /* Request signature from the user's Nostr extension */
        const signedEvent = await window.nostr.signEvent(event);
        const authHeader = btoa(JSON.stringify(signedEvent));

        try {
            const response = await fetch('https://nostr.build/api/v2/upload/files', {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Nostr ${authHeader}`
                }
            });

            if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
            const result = await response.json();
            return result.data[0].url;
        } catch (error) {
            console.error("ImageService Final Error:", error);
            throw error;
        }
    }
}