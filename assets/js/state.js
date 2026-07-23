/**
 * ==========================================================
 * SAPA V2
 * Global Application State
 * ==========================================================
 */

export const AppState = {
    app: {
        version: "2.0.0",
        initialized: false,
        currentPage: "register",
        loading: false
    },
    profile: null,
    ui: {
        theme: "light",
        accent: "violet",
        fontSize: "medium",
        sidebar: false,
        modal: null,
        toastQueue: []
    },
    dashboard: {
        stats: {},
        insight: null,
        recentActivity: []
    },
    transaction: {
        list: []
    },
    stock: {
        list: []
    },
    history: {
    ai: [],
    activity: [],

    lastKontenInput: null,
    lastBalasanInput: null,
    lastKonsepList: null
    },
    settings: {
        apiProvider: "worker",
        workerURL: "",
        supabase: false
    }
};

// ==========================================================
// STATE API
// ==========================================================

export const State = {

    get currentProfile() {
        return AppState.profile;
    },

    set currentProfile(profile) {
        AppState.profile = profile;
    },

    get transaksi() {
        return AppState.transaction.list;
    },

    set transaksi(list) {
        AppState.transaction.list = list;
    },

    get lastKontenInput() {
        return AppState.history.lastKontenInput;
    },

    set lastKontenInput(value) {
        AppState.history.lastKontenInput = value;
    },

    get lastBalasanInput() {
        return AppState.history.lastBalasanInput;
    },

    set lastBalasanInput(value) {
        AppState.history.lastBalasanInput = value;
    },

    get lastKonsepList() {
        return AppState.history.lastKonsepList;
    },

    set lastKonsepList(value) {
        AppState.history.lastKonsepList = value;
    }

};