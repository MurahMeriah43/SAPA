/**
 * ==========================================================
 * SAPA V2
 * UI Manager
 * ==========================================================
 */

import { escapeHtml } from "./utils.js";

export const UI = {
    toast: {},
    modal: {},
    loader: {},
    page: {},
    dialog: {}
};

/* ==========================================================
   TOAST
========================================================== */

UI.toast.show = function(message){

    const toast = document.getElementById("toast");

    if(!toast) return;

    clearTimeout(toast._timer);

    toast.textContent = message;

    toast.classList.add("show");

    toast._timer = setTimeout(()=>{

        toast.classList.remove("show");

    },2600);

}

window.showToast = UI.toast.show;
UI.showToast = UI.toast.show; // alias, jaga-jaga ada kode lama yang manggil nama ini

/* ==========================================================
   MODAL
========================================================== */

UI.modal.open = function(id){

    const el = document.getElementById(id);

    if(!el) return;

    el.classList.remove("hidden");

    // Fokus ke input pertama biar user langsung bisa ngetik.
    const firstField = el.querySelector("input");
    if (firstField) setTimeout(() => firstField.focus(), 50);

};

UI.modal.close = function(id){

    const el = document.getElementById(id);

    if(!el) return;

    el.classList.add("hidden");

};

// Klik di luar kartu modal, atau tombol Escape, nutup modal
// overlay mana pun yang lagi kebuka — bukan cuma satu modal
// tertentu, biar konsisten di semua modal auth & konfirmasi.
document.addEventListener("click", (e) => {

    if (!e.target.classList?.contains("modal-overlay")) return;

    e.target.classList.add("hidden");

});

document.addEventListener("keydown", (e) => {

    if (e.key !== "Escape") return;

    document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(el => {
        el.classList.add("hidden");
    });

});

// Checkbox "Tampilkan PIN" — toggle type password/text pada
// satu atau beberapa input sekaligus (data-pin-toggle bisa
// berisi beberapa id dipisah koma, dipakai di form Daftar
// yang punya PIN + Konfirmasi PIN).
document.addEventListener("change", (e) => {

    const toggle = e.target.closest("[data-pin-toggle]");

    if (!toggle) return;

    const ids = toggle.dataset.pinToggle.split(",");

    ids.forEach(id => {
        const field = document.getElementById(id.trim());
        if (field) field.type = toggle.checked ? "text" : "password";
    });

});

/* ==========================================================
   LOADER
========================================================== */

UI.loader.show = function(){

    console.log("Loader Show");

};

UI.loader.hide = function(){

    console.log("Loader Hide");

};

/* ==========================================================
   PAGE
========================================================== */

UI.page.show=function(id){

    [

        "pageWelcome",

        "pageMenu"

    ].forEach(page=>{

        document.getElementById(page)

            ?.classList.toggle(

                "hidden",

                page!==id

            );

    });

    document

        .querySelectorAll('main[id^="page-"]')

        .forEach(page=>page.classList.add("hidden"));

    document

        .getElementById("guideModal")

        ?.classList.add("hidden");

    window.scrollTo(0,0);

}

window.showPage=UI.page.show;

/* ==========================================================
   DIALOG
========================================================== */

UI.dialog.confirm = function(message, opts = {}){

    return new Promise((resolve) => {

        const modal   = document.getElementById("confirmModal");
        const titleEl = document.getElementById("confirmTitle");
        const msgEl   = document.getElementById("confirmMessage");
        const okBtn   = document.getElementById("confirmOk");
        const cancelBtn = document.getElementById("confirmCancel");

        if (!modal) {
            // Fallback kalau markup modal belum ada di halaman ini.
            resolve(confirm(message));
            return;
        }

        titleEl.textContent = opts.title || "Yakin?";
        msgEl.textContent = message || "";
        okBtn.textContent = opts.okLabel || "Ya, lanjutkan";
        cancelBtn.textContent = opts.cancelLabel || "Batal";

        modal.classList.remove("hidden");

        function cleanup(result){
            modal.classList.add("hidden");
            okBtn.removeEventListener("click", onOk);
            cancelBtn.removeEventListener("click", onCancel);
            resolve(result);
        }

        function onOk(){ cleanup(true); }
        function onCancel(){ cleanup(false); }

        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);

    });

};

/* ==========================================================
   GUIDE BOX
========================================================== */

UI.initGuideBox=function(){

    const toggle=document.getElementById("guideToggle");

    const body=document.getElementById("guideBody");

    const box=document.getElementById("guideBox");

    if(!toggle||!body||!box) return;

    toggle.addEventListener("click",()=>{

        const open=!body.classList.contains("hidden");

        body.classList.toggle("hidden",open);

        box.classList.toggle("open",!open);

    });

}

window.initGuideBox=UI.initGuideBox;

/* ==========================================================
   HELP MODAL
========================================================== */

const guideContent = {
    konten: {
        title: "Bikin Konten Jualan",
        body: "Ceritain produk kamu, mau posting ke mana, dan lagi kondisi jualan gimana. SAPA bakal kasih 3 ide konten berbeda, lengkap kalimat pembuka, caption, dan saran fotonya. Tinggal pilih yang paling cocok, salin, langsung posting."
    },
    iklan: {
        title: "Bantuan Iklan Digital",
        body: "Buat kamu yang belum pernah coba iklan berbayar sama sekali. Isi info produk dan budget yang kamu punya, nanti dikasih contoh teks iklan, saran target, dan langkah super simpel cara mulai boost postingan."
    },
    harga: {
        title: "Hitung Harga Jual",
        body: "Masukkan modal per satuan produk, berapa persen untung yang kamu mau, dan lewat mana kamu jual. SAPA hitungin harga jual yang pas biar untungnya kepakai, bukan asal ngikutin harga tetangga."
    },
    catat: {
        title: "Catat Untung Rugi",
        body: "Cerita aja transaksi hari ini pakai kata-kata biasa — boleh diketik atau diomongin pakai tombol mic. SAPA otomatis pisahin mana pemasukan mana pengeluaran, terus dijumlahin jadi ringkasan yang rapi."
    },
    balasan: {
        title: "Balas Chat Pelanggan",
        body: "Tempel pertanyaan dari pembeli di WA/IG kamu ke sini. SAPA bikinin balasan yang sopan dan lengkap, tinggal salin dan kirim ke pelanggan. Bisa atur gayanya mau ramah, formal, atau singkat."
    },
    tren: {
        title: "Baca Tren Usaha",
        body: "Ceritain produk yang paling laku minggu ini dan gimana dibanding minggu lalu. SAPA bantu jelasin apa artinya tren itu dan kasih satu saran konkret buat minggu depan."
    },
    stok: {
        title: "Cek Stok Aman",
        body: "Masukkan sisa stok sekarang dan biasanya habis berapa per hari. SAPA hitungin kira-kira berapa hari lagi stok itu bertahan, dan kasih tahu kapan waktu paling pas buat belanja lagi."
    },
    foto: {
        title: "Poles Foto Produk",
        body: "Ada 2 mode. Mode Dasar: foto jadi lebih cerah dan rapi, semua proses langsung di HP kamu, selalu gratis tanpa syarat apa pun. Mode Studio: latar belakang foto benar-benar diganti dengan yang baru."
    }
};

UI.initHelpModal = function () {

    document.querySelectorAll(".btn-help").forEach(btn => {

        btn.addEventListener("click", () => {

            const g = guideContent[btn.dataset.guide];

            if (!g) return;

            document.getElementById("modalTitle").textContent = g.title;
            document.getElementById("modalBody").textContent = g.body;

            const iconEl = document.getElementById("modalIcon");

            const badgeSource =
                btn.closest(".tool-header")
                   ?.querySelector(".tool-icon-badge");

            iconEl.innerHTML = badgeSource
                ? badgeSource.innerHTML
                : "";

            document
                .getElementById("guideModal")
                .classList.remove("hidden");

        });

    });

    document
        .getElementById("modalClose")
        ?.addEventListener("click", () => {

            document
                .getElementById("guideModal")
                .classList.add("hidden");

        });

    document
        .getElementById("guideModal")
        ?.addEventListener("click", (e) => {

            if (e.target.id === "guideModal") {

                e.target.classList.add("hidden");

            }

        });

};

window.initHelpModal = UI.initHelpModal;

/* ==========================================================
   CUSTOM SELECT
========================================================== */

UI.getSelectVal = function (id) {

    const el = document.getElementById(id);

    return el ? el.dataset.value : "";

};

UI.initCustomSelects = function () {

    document.querySelectorAll(".custom-select").forEach(cs => {

        const trigger = cs.querySelector(".cs-trigger");
        const valueEl = cs.querySelector(".cs-value");

        trigger.addEventListener("click", (e) => {

            e.stopPropagation();

            const wasOpen = cs.classList.contains("open");

            document
                .querySelectorAll(".custom-select.open")
                .forEach(o => o.classList.remove("open"));

            if (!wasOpen) {

                cs.classList.add("open");

            }

        });

        cs.querySelectorAll(".cs-option").forEach(opt => {

            opt.addEventListener("click", () => {

                cs.querySelectorAll(".cs-option")
                    .forEach(o => o.classList.remove("active"));

                opt.classList.add("active");

                valueEl.textContent = opt.textContent;

                cs.dataset.value = opt.dataset.value;

                cs.classList.remove("open");

            });

        });

    });

    document.addEventListener("click", () => {

        document
            .querySelectorAll(".custom-select.open")
            .forEach(o => o.classList.remove("open"));

    });

};

window.getSelectVal = UI.getSelectVal;
window.initCustomSelects = UI.initCustomSelects;

/* ==========================================================
   VOICE INPUT
========================================================== */

UI.initVoiceButtons = function () {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    document.querySelectorAll(".btn-mic").forEach(btn => {

        if (!SpeechRecognition) {
            btn.classList.add("hidden");
            return;
        }

        const targetId = btn.dataset.target;

        const recognition = new SpeechRecognition();

        recognition.lang = "id-ID";
        recognition.continuous = false;
        recognition.interimResults = false;

        let recording = false;

        btn.addEventListener("click", () => {

            if (recording) {
                recognition.stop();
                return;
            }

            try {

                recognition.start();

                recording = true;

                btn.classList.add("recording");

            } catch (e) {

                UI.toast.show("Mic gagal diakses.");

            }

        });

        recognition.addEventListener("result", (e) => {

            const transcript = e.results[0][0].transcript;

            const field = document.getElementById(targetId);

            if (!field) return;

            field.value = field.value
                ? field.value + " " + transcript
                : transcript;

        });

        recognition.addEventListener("end", () => {

            recording = false;

            btn.classList.remove("recording");

        });

        recognition.addEventListener("error", (e) => {

            recording = false;

            btn.classList.remove("recording");

            if (e.error === "not-allowed") {

                UI.toast.show("Izin mic ditolak, cek pengaturan browser.");

            }

        });

    });

};

window.initVoiceButtons = UI.initVoiceButtons;

/* ==========================================================
   UI INITIALIZER
========================================================== */

UI.init = function () {

    UI.initGuideBox();

    UI.initHelpModal();

    UI.initCustomSelects();

    UI.initVoiceButtons();

};

window.initUI = UI.init;