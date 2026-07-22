/**
 * ============================================
 * SAPA Dashboard Module
 * ============================================
 */

import {
    fmtRp,
    fmtWaktu,
    escapeHtml,
    markdownRingan,
    markdownIklan
} from "./utils.js";
import { State } from "./state.js";

export const Dashboard = {

    renderKonsep(){},

    renderRiwayat(){

        const box    = document.getElementById("riwayatBox");
        const list   = document.getElementById("riwayatList");
        const strip  = document.getElementById("ringkasanStrip");
        const statEl = document.getElementById("statTransaksi");

        const riwayat = State.transaksi || [];

        if (statEl) statEl.textContent = riwayat.length;
        if (!box || !list || !strip) return;

        if (riwayat.length === 0) {
            box.classList.add("hidden");
            return;
        }

        list.innerHTML = riwayat.map(t => `
            <div class="riwayat-item">
                <span>${fmtWaktu(t.waktu)}</span>
                <span>${escapeHtml(String(t.teks || "").slice(0, 50))}${(t.teks || "").length > 50 ? "…" : ""}</span>
            </div>`).join("");

        const totalMasuk  = riwayat.reduce((s, t) => s + (t.masuk  || 0), 0);
        const totalKeluar = riwayat.reduce((s, t) => s + (t.keluar || 0), 0);

        strip.innerHTML = `
            <div class="ring-item"><span class="rl">Masuk</span><span class="rv">${fmtRp(totalMasuk)}</span></div>
            <div class="ring-item"><span class="rl">Keluar</span><span class="rv">${fmtRp(totalKeluar)}</span></div>
            <div class="ring-item"><span class="rl">Selisih</span><span class="rv">${fmtRp(totalMasuk - totalKeluar)}</span></div>`;

        box.classList.remove("hidden");
    },

    renderGaleriFotoAI(){},

    renderHarga(){},

    renderTrend(){},

    renderInsight(){},

    renderStok(){}

};