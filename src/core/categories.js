/* Full taxonomy for enterprise category navigation. */

export const CATEGORIAS = [
    { id: "monumentos", label: "🏛️ Monumentos", group: "Tourism", icon: "fa-landmark" },
    { id: "museos", label: "🖼️ Museos", group: "Tourism", icon: "fa-museum" },
    { id: "sitios_historicos", label: "📜 Sitios Históricos", group: "Tourism", icon: "fa-monument" },
    { id: "gastronomia", label: "🍔 Gastronomía", group: "Urban Life", icon: "fa-burger" },
    { id: "cafeterias", label: "☕ Cafeterías", group: "Urban Life", icon: "fa-coffee" },
    { id: "bares", label: "🍺 Bares y Vida Nocturna", group: "Urban Life", icon: "fa-glass-cheers" },
    { id: "parques", label: "🌳 Parques y Plazas", group: "Outdoors", icon: "fa-tree" },
    { id: "miradores", label: "🔭 Miradores", group: "Outdoors", icon: "fa-binoculars" },
    { id: "entretenimiento", label: "🎭 Entretenimiento", group: "Leisure", icon: "fa-ticket-alt" },
    { id: "transporte", label: "🚉 Transporte", group: "Services", icon: "fa-bus-alt" },
    { id: "salud", label: "🏥 Salud", group: "Services", icon: "fa-hospital" },
    { id: "compras", label: "🛍️ Compras", group: "Services", icon: "fa-shopping-bag" },
    { id: "alojamiento", label: "🏨 Alojamiento", group: "Services", icon: "fa-bed" },
    { id: "coworking", label: "💻 Coworking/WiFi", group: "Services", icon: "fa-laptop-code" },
    { id: "peligro", label: "⚠️ Zona de Riesgo", group: "Security", icon: "fa-exclamation-triangle" },

    /* --- CATEGORÍAS NOSTR-NATIVE (NIP-58 / SOBERANÍA) --- */

    { id: "nostr_events", label: "⚡ Nostr Events", group: "Nostr Community", icon: "fa-bolt" },
    { id: "zap_points", label: "💸 Pagos con Zap", group: "Nostr Economy", icon: "fa-bolt-lightning" },
    { id: "bitcoin_atm", "label": "🏦 ATM Bitcoin / OTC", "group": "Nostr Economy", "icon": "fa-money-bill-transfer" },
    { id: "meetup_nostr", "label": "🤝 Nostr Meetups", "group": "Nostr Community", "icon": "fa-users-rays" },
    { id: "nostr_hubs", "label": "🏠 Nostr Hubs", "group": "Nostr Community", "icon": "fa-house-signal" },
    { id: "badge_altars", "label": "🏆 Altares de Badges", "group": "Nostr Gamification", "icon": "fa-award" },
    { id: "privacy_shelters", "label": "🛡️ Refugios de Privacidad", "group": "Nostr Security", "icon": "fa-user-shield" },
    { id: "mesh_nodes", "label": "📡 Nodos Mesh/Radio", "group": "Nostr Security", "icon": "fa-tower-broadcast" }
];