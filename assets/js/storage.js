/**
 * ==========================================================
 * SAPA V2
 * Storage Manager
 * ==========================================================
 */

const STORAGE_KEYS = {
    PROFILE: "sapa_profile",
    SETTINGS: "sapa_settings",
    TRANSACTIONS: "sapa_transactions",
    STOCK: "sapa_stock",
    HISTORY: "sapa_history",
    THEME: "sapa_theme"
};
export const Storage = {
    save(key, value){
        localStorage.setItem(
            key,
            JSON.stringify(value)
        );
    },
    load(key, fallback = null){
        const raw = localStorage.getItem(key);
        if(!raw) return fallback;
        try{
            return JSON.parse(raw);
        }
        catch{
            return fallback;
        }
    },
    remove(key){
        localStorage.removeItem(key);
    },
    clear(){
        localStorage.clear();
    }
};
export { STORAGE_KEYS };