import { UI } from "./ui.js";
import { Router } from "./router.js";
import { Dashboard } from "./dashboard.js";
import { Settings } from "./settings.js";
import { State } from "./state.js";
import { SapaDB } from "./supabase-client.js";

export const Auth = {
    initAuth,
    masukKeDashboard,
};

async function initAuth() {

    const configured = SapaDB.isConfigured();

    if (!configured) {
        UI.toast.show("Supabase belum disetel — lihat SUPABASE_SETUP.md");
        showWelcomeFor(null);
    } else {
        try {

            await SapaDB.init();

            const profile = await SapaDB.myProfile();

            if (!profile) {

                showWelcomeFor(null);

            } else {

                // Profil ini cuma dipakai buat isi default field Nama
                // Usaha di modal Masuk (memudahkan, HP ini pernah dipakai
                // usaha ini) — bukan berarti otomatis login. Login tetap
                // wajib ketik ulang nama + PIN, karena HP yang sama bisa
                // gantian dipakai usaha lain.

                showWelcomeFor(profile);

            }

        } catch (err) {

            console.error("Gagal konek ke Supabase:", err);

            UI.toast.show("Gagal konek ke server, cek koneksi internet kamu");

            showWelcomeFor(null);

        }
    }

    // ======================================================
    // WELCOME SCREEN — satu tombol utama + satu link kebalikannya,
    // sesuai apakah HP ini pernah dipakai daftar/masuk atau belum.
    // ======================================================

    function showWelcomeFor(profile) {

        Router.showPage("pageWelcome");

        const btnDaftar = document.getElementById("btnWelcomeDaftar");
        const btnMasuk  = document.getElementById("btnWelcomeMasuk");
        const swMasuk   = document.getElementById("btnWelcomeSwitchMasuk");
        const swDaftar  = document.getElementById("btnWelcomeSwitchDaftar");

        if (profile) {
            btnDaftar.classList.add("hidden");
            btnMasuk.classList.remove("hidden");
            swMasuk.classList.add("hidden");
            swDaftar.classList.remove("hidden");
        } else {
            btnMasuk.classList.add("hidden");
            btnDaftar.classList.remove("hidden");
            swDaftar.classList.add("hidden");
            swMasuk.classList.remove("hidden");
        }

        const lNama = document.getElementById("lNama");
        if (lNama && profile) lNama.value = profile.nama;
    }

    document.getElementById("btnWelcomeDaftar").addEventListener("click", () => {
        UI.modal.open("modalDaftar");
    });

    document.getElementById("btnWelcomeMasuk").addEventListener("click", () => {
        UI.modal.open("modalMasuk");
    });

    document.getElementById("btnWelcomeSwitchMasuk").addEventListener("click", () => {
        UI.modal.open("modalMasuk");
    });

    document.getElementById("btnWelcomeSwitchDaftar").addEventListener("click", () => {
        UI.modal.open("modalDaftar");
    });

    document.getElementById("linkKeLoginDariDaftar").addEventListener("click", () => {
        UI.modal.close("modalDaftar");
        UI.modal.open("modalMasuk");
    });

    document.getElementById("linkKeDaftarDariMasuk").addEventListener("click", () => {
        UI.modal.close("modalMasuk");
        UI.modal.open("modalDaftar");
    });

    document.getElementById("modalDaftarClose").addEventListener("click", () => {
        UI.modal.close("modalDaftar");
    });

    document.getElementById("modalMasukClose").addEventListener("click", () => {
        UI.modal.close("modalMasuk");
    });

    // ======================================================
    // DAFTAR
    // ======================================================

document.getElementById("btnDaftar").addEventListener("click", async () => {

    const nama    = document.getElementById("dNama").value.trim();
    const pin     = document.getElementById("dPin").value.trim();
    const pinUlang = document.getElementById("dPinConfirm").value.trim();

    if (!nama) {
        UI.toast.show("Isi nama usaha kamu dulu");
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        UI.toast.show("PIN harus 4 angka");
        return;
    }

    if (pin !== pinUlang) {
        UI.toast.show("Konfirmasi PIN belum sama, coba cek lagi");
        return;
    }

    if (!SapaDB.isConfigured()) {

        State.currentProfile = {
            id: "preview",
            nama,
            theme: "light",
            font_size: "medium"
        };

        State.transaksi = [];

        UI.toast.show("Mode preview — data gak kesimpen. Setel Supabase buat simpan beneran.");

        UI.modal.close("modalDaftar");

        await masukKeDashboard();
        return;
    }

    try {

        State.currentProfile = await SapaDB.register(nama, pin);

        State.transaksi = [];

        UI.modal.close("modalDaftar");

        await masukKeDashboard();

    } catch (err) {

        UI.toast.show(err.message || "Gagal daftar, coba lagi");

    }

});

// ======================================================
// MASUK
// Selalu nama + PIN lewat SapaDB.claim(). HP yang sama bisa
// gantian dipakai banyak usaha, jadi gak ada cara aman buat
// nebak siapa yang mau login cuma dari PIN doang.
// ======================================================

document.getElementById("btnLogin").addEventListener("click", async () => {

    if (!SapaDB.isConfigured()) {
        UI.toast.show("Supabase belum disetel — lihat SUPABASE_SETUP.md");
        return;
    }

    const nama = document.getElementById("lNama").value.trim();
    const pin  = document.getElementById("lPin").value.trim();

    if (!nama) {
        UI.toast.show("Isi nama usaha kamu dulu");
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        UI.toast.show("PIN harus 4 angka");
        return;
    }

    try {

        State.currentProfile = await SapaDB.claim(nama, pin);

        UI.modal.close("modalMasuk");

        await masukKeDashboard();

    } catch (err) {

        UI.toast.show(err.message || "Nama usaha atau PIN salah");

    }

});

// ======================================================
// LOGOUT
// ======================================================

document.getElementById("btnLogout").addEventListener("click", async () => {

    const mauKeluar = await UI.dialog.confirm(
        "Kamu bakal diminta nama usaha dan PIN lagi buat masuk. Lanjut keluar?",
        { title: "Keluar dari Usaha", okLabel: "Ya, Keluar" }
    );

    if (!mauKeluar) return;

    const profileLama = State.currentProfile;
    const namaTerakhir = profileLama?.nama || "";

    // Reset state biar app beneran nganggep 'belum login',
    // bukan cuma pindah tampilan doang.
    State.currentProfile = null;
    State.transaksi = [];

    document.getElementById("lPin").value = "";
    document.getElementById("lNama").value = namaTerakhir;

    showWelcomeFor(profileLama);
    UI.modal.open("modalMasuk");

});

}

async function masukKeDashboard() {

    console.count("masukKeDashboard");

    document.getElementById("greetingLabel").textContent =
        `Halo, ${State.currentProfile.nama}`;

    Router.showPage("pageMenu");

    Router.initMenuNav();

    Settings.applyProfilePrefs(State.currentProfile);

    if (!SapaDB.isConfigured()) {

        // Mode preview
        Dashboard.renderRiwayat();

        return;

    }

    try {

        State.transaksi =
            await SapaDB.fetchTransaksi(State.currentProfile.id);

    } catch (err) {

        console.error(
            "Gagal ambil riwayat transaksi:",
            err
        );

        State.transaksi = [];

    }

    Dashboard.renderRiwayat();

    await SapaDB.subscribeTransaksi(
        State.currentProfile.id,
        (row) => {

            if (
                State.transaksi.some(
                    t => t.id === row.id
                )
            ) {
                return;
            }

            State.transaksi.push(row);

            Dashboard.renderRiwayat();

        }
    );

}
