/**
 * ==========================================================
 * SAPA V2
 * Global Configuration
 * ==========================================================
 * Seluruh konfigurasi aplikasi berada di sini.
 * Jangan hardcode angka/string penting di file lain.
 * ==========================================================
 */

export const CONFIG = Object.freeze({

    APP: {
        NAME: "SAPA",
        FULL_NAME: "Sahabat AI Pasar Anda",
        VERSION: "2.0.0",
        AUTHOR: "SAPA Team"
    },

    STORAGE: {
        PREFIX: "sapa_",
        PROFILE: "sapa_profile",
        SETTINGS: "sapa_settings",
        TRANSACTIONS: "sapa_transactions",
        STOCK: "sapa_stock",
        HISTORY: "sapa_history",
        DASHBOARD: "sapa_dashboard",
        THEME: "sapa_theme"
    },

    UI: {
        DEFAULT_THEME: "light",
        DEFAULT_ACCENT: "violet",
        DEFAULT_FONT_SIZE: "medium",
        TOAST_DURATION: 3000,
        MODAL_ANIMATION: 250,
        CARD_ANIMATION: 250,
        PAGE_ANIMATION: 300
    },

    AI: {
    PROVIDER: "worker",
    DAHL_MODEL: "MiniMaxAI/MiniMax-M2.7",
    DAHL_URL: "https://sapa.khusushackathon.workers.dev/text",
    POLLINATIONS_EDIT_URL: "https://sapa.khusushackathon.workers.dev/image",
    TIMEOUT: 30000,
    MAX_HISTORY: 100,
    TEMPERATURE: 0.35,
    MAX_TOKENS: 900
},

    NETWORK: {
        RETRY: 2,
        RETRY_DELAY: 1200
    },

    SUPABASE: {
        ENABLED: false,
        URL: "",
        ANON_KEY: ""
    }
});

export const DAHL_MODEL = CONFIG.AI.DAHL_MODEL;
export const DAHL_URL = CONFIG.AI.DAHL_URL;
export const POLLINATIONS_EDIT_URL = CONFIG.AI.POLLINATIONS_EDIT_URL;