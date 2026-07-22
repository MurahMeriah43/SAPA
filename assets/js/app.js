/* ================================================
   SAPA — App Logic
   8 alat: Konten, Iklan, Harga, Catat, Balasan,
   Tren, Stok, Poles Foto

   AI: Dahl API (MiniMax-M2.7) via Cloudflare Worker
   Pollinations.ai untuk Poles Foto Produk
   ================================================ */

import { UI } from "./ui.js";
import {
    fmtRp,
    fmtWaktu,
    escapeHtml,
    sanitizeJsonString,
    parseJsonSafe,
    markdownRingan,
    markdownIklan
} from "./utils.js";
import { Settings } from "./settings.js";
import { Auth } from "./auth.js";
import { AppState } from "./state.js";
import { AI } from "./ai.js";
import { Dashboard } from "./dashboard.js";
import { Router } from "./router.js";
import { State } from "./state.js";
import { SapaDB } from "./supabase-client.js";

const DAHL_MODEL            = "MiniMaxAI/MiniMax-M2.7";
const DAHL_URL              = "https://sapa.khusushackathon.workers.dev/text";
const POLLINATIONS_EDIT_URL = "https://sapa.khusushackathon.workers.dev/image";

const isApiConnected        = () => true;
const isPollinationsConnected = () => true;

let lastKontenInput  = null, lastKonsepList = null;
let lastBalasanInput = null;

// Riwayat transaksi & profil aktif dibaca/ditulis langsung lewat State
// (module yang sama dipakai Auth.initAuth), biar app.js dan auth.js
// megang data yang sama persis — dulu app.js punya variabel sendiri
// yang gak pernah keisi karena initAuth-nya sendiri gak pernah jalan.

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════

window.addEventListener("DOMContentLoaded", async () => {
  // initAuth sekarang async (nunggu jawaban dari Supabase), jadi dijalanin
  // duluan sendirian, baru sisanya nyusul kayak biasa.
  try {
    await Auth.initAuth();
  } catch (err) {
    console.error("Gagal jalanin initAuth:", err);
    showToast("Gagal konek ke server. Cek koneksi internet kamu.");
  }

  const inits = [
    Settings.initTheme,
    Settings.initFontSize,
    UI.initVoiceButtons,
    Settings.initApiStatus,
    UI.initGuideBox,
    UI.initHelpModal,
    UI.initCustomSelects,
    initPolesFoto,
    Settings.initSettings,
];
  inits.forEach(fn => {
    try { fn(); }
    catch (err) { console.error(`Gagal jalanin ${fn.name}:`, err); }
  });
});

// ══════════════════════════════════════════════
//  SCHEMA — tidak dipakai untuk call tapi tetap disimpan
//  sebagai referensi struktur data yang diharapkan
// ══════════════════════════════════════════════

const SCHEMA_KONSEP_KONTEN = {
  type: "array",
  items: {
    type: "object",
    properties: {
      angle:   { type: "string" },
      hook:    { type: "string" },
      caption: { type: "string" },
      visual:  { type: "string" },
    },
    required: ["angle", "hook", "caption", "visual"],
  },
};

const SCHEMA_JADWAL = {
  type: "array",
  items: {
    type: "object",
    properties: {
      hari:   { type: "string" },
      ide_ke: { type: "integer" },
      alasan: { type: "string" },
    },
    required: ["hari", "ide_ke", "alasan"],
  },
};

const SCHEMA_TRANSAKSI = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ket:     { type: "string" },
          jenis:   { type: "string", enum: ["masuk", "keluar"] },
          nominal: { type: "number" },
        },
        required: ["ket", "jenis", "nominal"],
      },
    },
    total_masuk:  { type: "number" },
    total_keluar: { type: "number" },
    ringkasan:    { type: "string" },
  },
  required: ["items", "total_masuk", "total_keluar", "ringkasan"],
};

// ══════════════════════════════════════════════
//  MODUL 1: KONTEN
// ══════════════════════════════════════════════

const trenLabel = {
  naik:   "produk ini sedang laris/naik daun minggu ini",
  stabil: "penjualan stabil, tidak ada lonjakan khusus",
  turun:  "penjualan sedang sepi/menurun minggu ini",
  baru:   "ini produk baru yang baru saja diluncurkan",
};

async function generateKontenAI(nama, desc, harga, platform, tren) {

  const sys = `Kamu adalah copywriter dan content strategist untuk UMKM Indonesia.

Tugasmu membuat TEPAT 3 ide konten yang benar-benar berbeda.

ATURAN WAJIB:

- Ide 1 harus fokus menjual produk.
- Ide 2 harus fokus edukasi atau manfaat.
- Ide 3 harus fokus membangun kedekatan dengan calon pembeli.

FORMAT WAJIB:

---IDE---
ANGLE:
HOOK:
CAPTION:
FOTO:

---IDE---
ANGLE:
HOOK:
CAPTION:
FOTO:

---IDE---
ANGLE:
HOOK:
CAPTION:
FOTO:

ATURAN TAMBAHAN:

- Jangan menambahkan teks sebelum IDE pertama.
- Jangan menambahkan teks setelah IDE terakhir.
- Caption siap diposting.
- Hook maksimal 1 kalimat.
- Angle maksimal 5 kata.
- Saran foto harus realistis.
- Ketiga ide tidak boleh mirip.
- Jangan gunakan markdown.
- Jangan gunakan numbering.
- Gunakan Bahasa Indonesia yang natural.`;

  const usr = `

Nama Produk:
${nama}

Deskripsi:
${desc || "-"}

Harga:
${harga || "-"}

Platform:
${platform}

Kondisi Penjualan:
${trenLabel[tren]}
`;

  const raw = await AI.callAI(sys, usr, 1800);

  const blok = raw
    .split(/---IDE---/i)
    .map(v => v.trim())
    .filter(v => v.length);

  const hasil = [];

  for (const item of blok) {

    const ambil = (label) => {
      const regex = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)(?=ANGLE:|HOOK:|CAPTION:|FOTO:|$)`, "i");
      return regex.exec(item)?.[1]?.trim() || "";
    };

    const data = {
      angle: ambil("ANGLE"),
      hook: ambil("HOOK"),
      caption: ambil("CAPTION"),
      visual: ambil("FOTO")
    };

    if (data.hook || data.caption) {
      hasil.push({
        angle: data.angle || "Ide Konten",
        hook: data.hook,
        caption: data.caption,
        visual: data.visual || "Gunakan foto produk asli dengan pencahayaan yang baik."
      });
    }
  }

  if (hasil.length < 3) {
    throw new Error("AI belum berhasil membuat 3 ide konten. Silakan coba lagi.");
  }

  return hasil.slice(0, 3);
}

function renderKonsep(list) {
  const box = document.getElementById("konsepList");
  box.innerHTML = list.map((k, i) => `
    <div class="konsep-card">
      <div class="kc-head">Ide ${i + 1}: ${escapeHtml(k.angle)}</div>
      <div class="kc-body">
        <div><div class="kc-label">Kalimat Pembuka</div><div class="kc-hook">"${escapeHtml(k.hook)}"</div></div>
        <div><div class="kc-label">Caption</div><div class="kc-caption">${escapeHtml(k.caption)}</div></div>
        <div><div class="kc-label">Saran Foto</div><div class="kc-visual">${escapeHtml(k.visual)}</div></div>
      </div>
      <div class="kc-foot"><button class="btn-copy-mini" data-idx="${i}">Salin Caption Ini</button></div>
    </div>`).join("");

  box.querySelectorAll(".btn-copy-mini").forEach(btn => {
    btn.addEventListener("click", () => {
      const k = list[parseInt(btn.dataset.idx)];
      navigator.clipboard.writeText(`${k.hook}\n\n${k.caption}`).then(() => {
        showToast("Caption disalin!");
        btn.textContent = "Tersalin!";
        setTimeout(() => btn.textContent = "Salin Caption Ini", 1800);
      });
    });
  });
}

async function handleKonten() {

  const nama = document.getElementById("kNama").value.trim();
  const desc = document.getElementById("kDesc").value.trim();
  const harga = document.getElementById("kHarga").value.trim();
  const platform = getSelectVal("kPlatform");
  const tren = getSelectVal("kTren");

  if (!nama) {
    showToast("Nama produk wajib diisi");
    document.getElementById("kNama").focus();
    return;
  }

  lastKontenInput = {
    nama,
    desc,
    harga,
    platform,
    tren
  };

  const btn = document.getElementById("btnKonten");
  btn.disabled = true;

  document.getElementById("loadKonten").classList.remove("hidden");
  document.getElementById("resKonten").classList.add("hidden");

  try {

    const result = await generateKontenAI(
      nama,
      desc,
      harga,
      platform,
      tren
    );

    lastKonsepList = result;

    renderKonsep(result);

    document.getElementById("resKonten").classList.remove("hidden");

  } catch (e) {

    AI.tanganiErrorAI(e, btn);

  } finally {

    document.getElementById("loadKonten").classList.add("hidden");

    btn.disabled = false;

  }
}

document.getElementById("btnKonten").addEventListener("click", handleKonten);

document.getElementById("btnRegenKonten").addEventListener("click", async () => {
  if (!lastKontenInput) return;
  document.getElementById("loadKonten").classList.remove("hidden");
  try {
    const result   = await generateKontenAI(
      lastKontenInput.nama, lastKontenInput.desc,
      lastKontenInput.harga, lastKontenInput.platform, lastKontenInput.tren
    );
    lastKonsepList = result;
    renderKonsep(result);
  } catch (e) { AI.tanganiErrorAI(e, document.getElementById("btnRegenKonten")); }
  finally { document.getElementById("loadKonten").classList.add("hidden"); }
});

document.getElementById("btnJadwal").addEventListener("click", async () => {
  if (!lastKonsepList) { showToast("Buat konten dulu ya."); return; }
  document.getElementById("loadJadwal").classList.remove("hidden");
  document.getElementById("jadwalList").innerHTML = "";

  try {
    const hariValid = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
    const angles    = lastKonsepList.map((k, i) => `${i + 1}. ${k.angle}`).join("\n");

    const sys = `Kamu konsultan strategi media sosial UMKM Indonesia.

Tugasmu: buat jadwal posting untuk 3 ide konten di ${lastKontenInput.platform}.

FORMAT KETAT — satu baris per hari, tidak ada teks lain:
HARI: [nama hari] | IDE: [nomor 1/2/3] | ALASAN: [alasan singkat satu kalimat]

Contoh output yang benar:
HARI: Senin | IDE: 1 | ALASAN: Awal minggu orang semangat cari inspirasi.
HARI: Rabu | IDE: 2 | ALASAN: Tengah minggu cocok konten edukatif.
HARI: Sabtu | IDE: 3 | ALASAN: Weekend banyak orang santai scroll media sosial.

LARANGAN:
- Jangan tambahkan teks sebelum atau sesudah baris HARI:.
- Jangan beri penjelasan.
- Jangan beri penomoran.`;

    const rawJadwal   = await AI.callAI(sys, `3 ide konten:\n${angles}`, 600);
    const jadwalLines = rawJadwal.split("\n").map(l => l.trim()).filter(l => /^HARI:/i.test(l));
    const jadwal      = jadwalLines.map(line => {
      const hari   = (line.match(/HARI:\s*([^|]+)/i)?.[1] || "").trim();
      const ide_ke = parseInt(line.match(/IDE:\s*(\d)/i)?.[1] || "1");
      const alasan = (line.match(/ALASAN:\s*(.+)/i)?.[1] || "").trim();
      return { hari, ide_ke, alasan };
    }).filter(j => hariValid.includes(j.hari) && j.ide_ke >= 1 && j.ide_ke <= 3);

    document.getElementById("jadwalList").innerHTML = jadwal.map(j => {
      const k = lastKonsepList[j.ide_ke - 1];
      return `<div class="jadwal-item">
        <div class="jadwal-day">${escapeHtml(j.hari)}</div>
        <div class="jadwal-desc"><strong>${k ? escapeHtml(k.angle) : ""}</strong><br>${escapeHtml(j.alasan)}</div>
      </div>`;
    }).join("");
  } catch (e) { AI.tanganiErrorAI(e, document.getElementById("btnJadwal")); }
  finally { document.getElementById("loadJadwal").classList.add("hidden"); }
});

// ══════════════════════════════════════════════
//  MODUL 2: HARGA
// ══════════════════════════════════════════════

const feeRate = { langsung: 0, marketplace: 0.06, reseller: 0.17 };

async function handleHarga() {
  const modal    = parseFloat(document.getElementById("hModal").value.replace(/[^0-9]/g, ""));
  const margin   = parseFloat(document.getElementById("hMargin").value.replace(/[^0-9]/g, "")) || 30;
  const platform = getSelectVal("hPlatform");
  const nama     = document.getElementById("hNama").value.trim();

  if (!modal || modal <= 0) {
    showToast("Isi modal per satuan dulu");
    document.getElementById("hModal").focus();
    return;
  }

  const fee       = feeRate[platform];
  const totalCut  = (margin / 100) + fee;
  const hargaJual = modal / (1 - totalCut > 0.05 ? 1 - totalCut : 0.05);
  const feeAmount = hargaJual * fee;
  const untung    = hargaJual - modal - feeAmount;

  const modalPct  = Math.max(0, Math.min(100, (modal / hargaJual) * 100));
  const feePct    = Math.max(0, Math.min(100, (feeAmount / hargaJual) * 100));
  const untungPct = Math.max(0, 100 - modalPct - feePct);

  document.getElementById("hargaOutput").innerHTML = `
    <div class="harga-main">
      <div class="harga-main-label">Harga Jual Disarankan</div>
      <div class="harga-main-num">${fmtRp(hargaJual)}</div>
    </div>
    <div class="harga-rows">
      <div class="harga-row"><span>Modal per satuan</span><span>${fmtRp(modal)}</span></div>
      <div class="harga-row"><span>Potongan platform</span><span>${fmtRp(feeAmount)}</span></div>
      <div class="harga-row total"><span>Untung bersih per satuan</span><span>${fmtRp(untung)}</span></div>
    </div>
    <div class="harga-bar-wrap">
      <div class="harga-bar">
        <div class="harga-bar-seg" data-tone="neutral" style="--pct:${modalPct}%"></div>
        <div class="harga-bar-seg" data-tone="warn"    style="--pct:${feePct}%"></div>
        <div class="harga-bar-seg" data-tone="good"    style="--pct:${untungPct}%"></div>
      </div>
      <div class="harga-bar-legend">
        <span class="harga-bar-legend-item"><span class="harga-bar-dot" data-tone="neutral"></span>Modal</span>
        <span class="harga-bar-legend-item"><span class="harga-bar-dot" data-tone="warn"></span>Potongan</span>
        <span class="harga-bar-legend-item"><span class="harga-bar-dot" data-tone="good"></span>Untung</span>
      </div>
    </div>`;

  document.getElementById("resHarga").classList.remove("hidden");
  document.getElementById("hargaInsight").classList.add("hidden");
  if (!nama) return;

  const btn = document.getElementById("btnHarga");
  btn.disabled = true;
  document.getElementById("loadHarga").classList.remove("hidden");

  try {
    const sys = `Kamu adalah konsultan bisnis UMKM Indonesia yang berpengalaman membantu penjual di Shopee, Tokopedia, TikTok Shop, Instagram, dan WhatsApp.

Berikan analisis singkat mengenai harga jual berikut.

ATURAN WAJIB:

- Maksimal 2 paragraf.
- Jangan menggunakan markdown.
- Jangan menggunakan bullet.
- Jangan menggunakan numbering.
- Jangan mengarang kondisi pasar.
- Jangan menyebut data yang tidak diberikan.
- Gunakan bahasa sederhana yang mudah dipahami pemilik UMKM.
- Paragraf pertama jelaskan apakah harga tersebut sudah masuk akal.
- Paragraf kedua berikan SATU saran konkret agar keuntungan tetap bagus tanpa harus perang harga.
- Jangan lebih dari sekitar 120 kata.
`;

    const usr = `
Nama produk:
${nama}

Modal:
${fmtRp(modal)}

Harga jual yang disarankan:
${fmtRp(hargaJual)}

Margin yang diinginkan:
${margin}%

Platform:
${platform}

Potongan platform:
${fmtRp(feeAmount)}

Keuntungan bersih:
${fmtRp(untung)}
`;
    const insight = await AI.callAI(sys, usr, 500);

    document.getElementById("hargaInsight").innerHTML = `<div class="kc-label">Saran Tambahan</div>${markdownRingan(insight)}`;
    document.getElementById("hargaInsight").classList.remove("hidden");
  } catch (e) { AI.tanganiErrorAI(e, btn); }
  finally {
    document.getElementById("loadHarga").classList.add("hidden");
    btn.disabled = false;
  }
}

document.getElementById("btnHarga").addEventListener("click", handleHarga);

// ══════════════════════════════════════════════
//  MODUL 3: CATAT UNTUNG RUGI
// ══════════════════════════════════════════════

async function handleCatat() {
  const input = document.getElementById("cInput").value.trim();
  if (!input) { showToast("Ceritakan transaksinya dulu"); document.getElementById("cInput").focus(); return; }

  const btn = document.getElementById("btnCatat");
  btn.disabled = true;
  document.getElementById("loadCatat").classList.remove("hidden");
  document.getElementById("resCatat").classList.add("hidden");

  try {
    const sys = `Kamu asisten keuangan UMKM Indonesia.

Tugas: ekstrak transaksi dari cerita pengguna lalu tampilkan dalam format di bawah.

FORMAT KETAT — hanya tulis baris berikut, tidak ada teks lain:
MASUK: [keterangan singkat] | [nominal angka saja, tanpa titik atau koma]
KELUAR: [keterangan singkat] | [nominal angka saja, tanpa titik atau koma]
RINGKASAN: [satu kalimat ringkasan kondisi keuangan hari ini dalam Bahasa Indonesia]

Contoh output yang benar:
MASUK: Jual keripik 10 bungkus | 150000
KELUAR: Beli minyak goreng | 30000
KELUAR: Bayar plastik kemasan | 12000
RINGKASAN: Hari ini untung bersih Rp 108.000 dari jualan keripik.

LARANGAN:
- Jangan tambahkan teks apapun sebelum baris MASUK/KELUAR pertama.
- Jangan tambahkan teks apapun setelah baris RINGKASAN.
- Jangan gunakan bullet, numbering, atau markdown.
- Nominal hanya angka, tidak pakai titik ribuan atau koma desimal.`;

    const rawText = await AI.callAI(sys, `Cerita transaksi: ${input}`, 800);
    const lines   = rawText.split("\n").map(l => l.trim()).filter(Boolean);

    const items    = [];
    let ringkasan  = "";
    let total_masuk  = 0;
    let total_keluar = 0;

    for (const line of lines) {
      if (/^MASUK:/i.test(line)) {
        const parts   = line.replace(/^MASUK:/i, "").split("|");
        const ket     = (parts[0] || "").trim();
        const nominal = parseInt((parts[1] || "0").replace(/\D/g, "")) || 0;
        if (ket) { items.push({ ket, jenis: "masuk", nominal }); total_masuk += nominal; }
      } else if (/^KELUAR:/i.test(line)) {
        const parts   = line.replace(/^KELUAR:/i, "").split("|");
        const ket     = (parts[0] || "").trim();
        const nominal = parseInt((parts[1] || "0").replace(/\D/g, "")) || 0;
        if (ket) { items.push({ ket, jenis: "keluar", nominal }); total_keluar += nominal; }
      } else if (/^RINGKASAN:/i.test(line)) {
        ringkasan = line.replace(/^RINGKASAN:/i, "").trim();
      }
    }

    if (items.length === 0) throw new Error("Gagal baca transaksi, coba tulis lebih jelas ya.");

    const data = {
      items,
      total_masuk,
      total_keluar,
      ringkasan: ringkasan || `Total masuk ${fmtRp(total_masuk)}, keluar ${fmtRp(total_keluar)}.`,
    };

    let itemsHtml = "";
    data.items.forEach(it => {
      const jenis = it.jenis === "masuk" ? "masuk" : "keluar";
      const sign  = jenis === "masuk" ? "+" : "−";
      itemsHtml += `
        <div class="ledger-item">
          <span class="ledger-icon ${jenis}">${sign}</span>
          <span class="ledger-ket">${escapeHtml(it.ket)}</span>
          <span class="ledger-nominal ${jenis}">${fmtRp(it.nominal)}</span>
        </div>`;
    });

    document.getElementById("catatOutput").innerHTML = `
      <div class="ledger-list">${itemsHtml}</div>
      <div class="ledger-summary">
        <div class="ring-item"><span class="rl">Masuk</span><span class="rv" data-tone="good">${fmtRp(data.total_masuk)}</span></div>
        <div class="ring-item"><span class="rl">Keluar</span><span class="rv" data-tone="bad">${fmtRp(data.total_keluar)}</span></div>
        <div class="ring-item"><span class="rl">Selisih</span><span class="rv">${fmtRp(data.total_masuk - data.total_keluar)}</span></div>
      </div>
      <div class="reply-card is-stacked">${markdownRingan(data.ringkasan)}</div>`;

    document.getElementById("resCatat").classList.remove("hidden");

    if (!State.currentProfile) {
      showToast("Profil belum siap, coba muat ulang halaman.");
      return;
    }

    let transaksiBaru;
    try {
      transaksiBaru = await SapaDB.addTransaksi(State.currentProfile.id, {
        teks: input,
        masuk: data.total_masuk,
        keluar: data.total_keluar,
      });
    } catch (err) {
      console.error("Gagal simpan transaksi ke server:", err);
      showToast("Hasilnya kehitung, tapi gagal kesimpan ke server. Cek koneksi internet.");
      transaksiBaru = { id: "lokal-" + Date.now(), waktu: new Date().toISOString(), teks: input, masuk: data.total_masuk, keluar: data.total_keluar };
    }

    if (!State.transaksi.some(t => t.id === transaksiBaru.id)) {
      State.transaksi.push(transaksiBaru);
    }

    Dashboard.renderRiwayat();
    document.getElementById("cInput").value = "";
  } catch (e) { AI.tanganiErrorAI(e, btn); }
  finally {
    document.getElementById("loadCatat").classList.add("hidden");
    btn.disabled = false;
  }
}

document.getElementById("btnCatat").addEventListener("click", handleCatat);

// ══════════════════════════════════════════════
//  MODUL 4: BALASAN CHAT
// ══════════════════════════════════════════════

async function handleBalasan() {
  const pesan = document.getElementById("bPesan").value.trim();
  const info  = document.getElementById("bInfo").value.trim();
  const nada  = getSelectVal("bNada");

  if (!pesan) { showToast("Isi pesan pelanggan dulu"); document.getElementById("bPesan").focus(); return; }

  lastBalasanInput = { pesan, info, nada };
  const btn = document.getElementById("btnBalasan");
  btn.disabled = true;
  document.getElementById("loadBalasan").classList.remove("hidden");
  document.getElementById("resBalasan").classList.add("hidden");

  try {
    const hasil = await AI.generateBalasanAI(pesan, info, nada);
    document.getElementById("balasanPesanEcho").textContent = pesan;
    document.getElementById("balasanOutput").innerHTML      = markdownRingan(hasil);
    document.getElementById("resBalasan").classList.remove("hidden");
  } catch (e) { AI.tanganiErrorAI(e, btn); }
  finally {
    document.getElementById("loadBalasan").classList.add("hidden");
    btn.disabled = false;
  }
}

document.getElementById("btnBalasan").addEventListener("click", handleBalasan);

document.getElementById("btnRegenBalasan").addEventListener("click", async () => {
  if (!lastBalasanInput) return;
  document.getElementById("loadBalasan").classList.remove("hidden");
  try {
    const hasil = await AI.generateBalasanAI(
      lastBalasanInput.pesan, lastBalasanInput.info, lastBalasanInput.nada
    );
    document.getElementById("balasanOutput").innerHTML = markdownRingan(hasil);
  } catch (e) { AI.tanganiErrorAI(e, document.getElementById("btnRegenBalasan")); }
  finally { document.getElementById("loadBalasan").classList.add("hidden"); }
});

document.getElementById("btnCopyBalasan").addEventListener("click", () => {
  navigator.clipboard.writeText(document.getElementById("balasanOutput").textContent)
    .then(() => showToast("Balasan disalin!"));
});

// ══════════════════════════════════════════════
//  MODUL 5: TREN USAHA
// ══════════════════════════════════════════════

async function handleTren() {
  const produk = document.getElementById("tProduk").value.trim();
  const arah   = getSelectVal("tArah");
  const alasan = document.getElementById("tAlasan").value.trim();

  if (!produk) { showToast("Isi nama produk dulu"); document.getElementById("tProduk").focus(); return; }

  const btn = document.getElementById("btnTren");
  btn.disabled = true;
  document.getElementById("loadTren").classList.remove("hidden");
  document.getElementById("resTren").classList.add("hidden");

  try {
    const sys = `Kamu adalah konsultan bisnis UMKM Indonesia.

Tugasmu menganalisis kondisi penjualan berdasarkan tren yang diberikan.

ATURAN WAJIB:

- Maksimal 5 kalimat.
- Kalimat pertama menjelaskan arti kondisi penjualan saat ini.
- Kalimat kedua dan ketiga menjelaskan kemungkinan dampaknya terhadap usaha.
- Kalimat keempat dan kelima memberikan SATU saran konkret yang bisa dilakukan dalam minggu ini.
- Jangan mengarang data pasar.
- Jangan menyebut statistik.
- Jangan menggunakan markdown.
- Jangan menggunakan bullet.
- Jangan menggunakan numbering.
- Gunakan Bahasa Indonesia sehari-hari.
- Fokus pada solusi yang realistis untuk UMKM kecil.
`;

    const usr = `
    Produk:
    ${produk}

    Kondisi penjualan:
    ${arah}

    ${alasan ? `Kemungkinan penyebab:
    ${alasan}` : "Tidak ada penyebab tambahan."}
    `;
    const hasil = await AI.callAI(sys, usr, 600);

    document.getElementById("trenOutput").innerHTML = markdownRingan(hasil);

    const arrowSvg = {
      naik:  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
      sama:  '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>',
      turun: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/></svg>',
    }[arah];

    const labelText = { naik: "Lagi Naik / Laris", sama: "Stabil, Belum Berubah", turun: "Lagi Turun / Sepi" }[arah];
    const tone      = { naik: "good", sama: "neutral", turun: "bad" }[arah];

    const signalArrow = document.getElementById("signalArrow");
    signalArrow.innerHTML    = arrowSvg;
    signalArrow.dataset.tone = tone;
    document.getElementById("signalLabel").textContent = labelText;

    document.getElementById("resTren").classList.remove("hidden");
  } catch (e) { AI.tanganiErrorAI(e, btn); }
  finally {
    document.getElementById("loadTren").classList.add("hidden");
    btn.disabled = false;
  }
}

document.getElementById("btnTren").addEventListener("click", handleTren);

// ══════════════════════════════════════════════
//  MODUL 6: POLES FOTO PRODUK
// ══════════════════════════════════════════════

let fotoAsliDataUrl  = null;
let fotoAsliFile     = null;
let fotoAsliFileName = "foto-produk";
let modeFotoAktif    = "dasar";

const GAYA_FOTO_FILTER = {
  cerah:   "brightness(1.12) contrast(1.12) saturate(1.15)",
  hangat:  "brightness(1.06) contrast(1.08) saturate(1.2) sepia(0.08)",
  kontras: "brightness(1.04) contrast(1.28) saturate(1.1)",
};

const JUMLAH_VARIASI_AI = 4;

function initPolesFoto() {
  const input    = document.getElementById("fotoInput");
  const dropZone = document.getElementById("photoDropZone");
  const dropText = document.getElementById("photoDropText");
  const btnPoles = document.getElementById("btnPolesFoto");

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;

    fotoAsliFile     = file;
    fotoAsliFileName = file.name.replace(/\.[^.]+$/, "") || "foto-produk";

    const reader   = new FileReader();
    reader.onload  = (e) => {
      fotoAsliDataUrl = e.target.result;
      dropZone.classList.add("has-photo");
      dropText.textContent = `Terpilih: ${file.name}`;
      btnPoles.classList.remove("hidden");
      gantiModeFoto(modeFotoAktif);
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("btnModeDasar").addEventListener("click", () => gantiModeFoto("dasar"));
  document.getElementById("btnModeAI").addEventListener("click",    () => gantiModeFoto("ai"));
  gantiModeFoto("dasar");

  document.querySelectorAll("#pillGayaFoto .pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#pillGayaFoto .pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.querySelectorAll("#pillGayaAI .pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("instruksiAI").value = btn.dataset.val;
    });
  });

  btnPoles.addEventListener("click", prosesPolesFoto);
  document.getElementById("btnRegenFoto").addEventListener("click",    prosesPolesFoto);
  document.getElementById("btnRegenFotoAI").addEventListener("click",  prosesPolesFoto);
  document.getElementById("btnUnduhFoto").addEventListener("click",    unduhFotoTunggal);
}

function gantiModeFoto(mode) {
  modeFotoAktif = mode;
  document.getElementById("btnModeDasar").classList.toggle("active", mode === "dasar");
  document.getElementById("btnModeAI").classList.toggle("active",    mode === "ai");
  document.getElementById("gayaFotoGroup").classList.toggle("hidden",      mode !== "dasar" || !fotoAsliFile);
  document.getElementById("gayaAIGroup").classList.toggle("hidden",        mode !== "ai"    || !fotoAsliFile);
  document.getElementById("instruksiAIGroup").classList.toggle("hidden",   mode !== "ai"    || !fotoAsliFile);
}

function gayaFotoAktif() {
  const active = document.querySelector("#pillGayaFoto .pill.active");
  return active ? active.dataset.val : "cerah";
}

function prosesPolesFoto() {
  if (!fotoAsliFile) { showToast("Pilih foto dulu ya"); return; }
  if (modeFotoAktif === "ai") prosesModeAI();
  else prosesModeDasar();
}

function prosesModeDasar() {
  document.getElementById("loadFotoMsg").textContent = "Memoles foto...";
  document.getElementById("loadFoto").classList.remove("hidden");
  document.getElementById("resFotoDasar").classList.add("hidden");
  document.getElementById("resFotoAI").classList.add("hidden");

  const img     = new Image();
  img.onload = () => {
    const canvas  = document.getElementById("fotoCanvas");
    const size    = Math.min(img.width, img.height);
    canvas.width  = size;
    canvas.height = size;
    const ctx     = canvas.getContext("2d");
    const offsetX = (img.width  - size) / 2;
    const offsetY = (img.height - size) / 2;

    ctx.filter = GAYA_FOTO_FILTER[gayaFotoAktif()];
    ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);

    document.getElementById("fotoAsli").src   = fotoAsliDataUrl;
    document.getElementById("fotoHasil").src  = canvas.toDataURL("image/jpeg", 0.92);
    document.getElementById("loadFoto").classList.add("hidden");
    document.getElementById("resFotoDasar").classList.remove("hidden");
  };
  img.onerror = () => {
    document.getElementById("loadFoto").classList.add("hidden");
    showToast("Gagal baca foto, coba foto lain ya");
  };
  img.src = fotoAsliDataUrl;
}

async function generateSatuVariasiAI(prompt) {
  const formData = new FormData();
  formData.append("image",  fotoAsliFile);
  formData.append("prompt", prompt);
  formData.append("model",  "kontext");

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(POLLINATIONS_EDIT_URL, {
      method: "POST",
      body:   formData,
      signal: controller.signal,
    });
  } catch (fetchErr) {
    if (fetchErr.name === "AbortError") throw new Error("Koneksi ke AI foto timeout, coba lagi ya.");
    throw fetchErr;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    if (res.status === 429) {
      const err429        = new Error("Pollinations lagi penuh dipakai orang.");
      err429.isRateLimit  = true;
      err429.retrySeconds = 20;
      err429.service      = "Pollinations";
      throw err429;
    }
    const text = await res.text();

if (
    text.includes("PAYMENT_REQUIRED") ||
    text.includes("Insufficient balance")
) {
    throw new Error("AI_STUDIO_QUOTA_HABIS");
}

throw new Error(text);

  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data   = await res.json();
    const hasilUrl = data?.data?.[0]?.url  || data?.url;
    const hasilB64 = data?.data?.[0]?.b64_json || data?.b64_json;
    const src    = hasilUrl || (hasilB64 ? `data:image/png;base64,${hasilB64}` : null);
    if (!src) throw new Error("AI tidak balikin gambar, coba lagi ya.");
    return src;
  } else if (contentType.startsWith("image/")) {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }
  throw new Error("AI tidak balikin gambar, coba lagi ya.");
}

async function prosesModeAI() {
  if (!isPollinationsConnected()) return;

  const instruksi = document.getElementById("instruksiAI").value.trim();
  if (!instruksi) { showToast("Ceritain dulu mau latar & gaya seperti apa"); return; }

  const btn = document.getElementById("btnPolesFoto");
  btn.disabled = true;
  document.getElementById("loadFotoMsg").textContent = `AI lagi bikin ${JUMLAH_VARIASI_AI} variasi foto, tunggu sebentar...`;
  document.getElementById("loadFoto").classList.remove("hidden");
  document.getElementById("resFotoDasar").classList.add("hidden");
  document.getElementById("resFotoAI").classList.add("hidden");

  const prompt = `product photography, ${instruksi}, keep the product exactly the same, high quality, sharp focus, commercial photography`;

  try {
    const hasilSettled = await Promise.allSettled(
      Array.from({ length: JUMLAH_VARIASI_AI }, () => generateSatuVariasiAI(prompt))
    );

    const berhasil = hasilSettled.filter(r => r.status === "fulfilled").map(r => r.value);
    const gagal    = hasilSettled.filter(r => r.status === "rejected");

    if (berhasil.length === 0) throw gagal[0].reason;

    renderGaleriFotoAI(berhasil);
    document.getElementById("resFotoAI").classList.remove("hidden");

    if (gagal.length > 0) {
      showToast(`${berhasil.length} dari ${JUMLAH_VARIASI_AI} berhasil dibuat, sisanya gagal.`);
    }
  } catch (e) {

    if (e.message === "AI_STUDIO_QUOTA_HABIS") {

        const modal = document.getElementById("confirmModal");
        const title = document.getElementById("confirmTitle");
        const msg = document.getElementById("confirmMessage");
        const cancelBtn = document.getElementById("confirmCancel");
        const okBtn = document.getElementById("confirmOk");

        title.textContent = "AI Studio Sedang Tidak Tersedia";

        msg.textContent =
            "Kuota layanan AI Studio untuk saat ini telah habis karena menggunakan layanan AI gratis.\n\nSilakan coba kembali beberapa saat lagi.";

        cancelBtn.style.display = "none";
        okBtn.textContent = "Mengerti";

        modal.classList.remove("hidden");

        okBtn.onclick = () => {
            modal.classList.add("hidden");

            cancelBtn.style.display = "";
            okBtn.textContent = "Ya, lanjutkan";
            okBtn.onclick = null;
        };

    } else {

        AI.tanganiErrorAI(e, btn);

    }

} finally {

    document.getElementById("loadFoto").classList.add("hidden");
    btn.disabled = false;

}
}

function renderGaleriFotoAI(daftarSrc) {
  const grid  = document.getElementById("fotoGalleryGrid");
  grid.innerHTML = daftarSrc.map((src, i) => `
    <div class="foto-gallery-item">
      <img src="${escapeHtml(src)}" alt="Variasi hasil AI ke-${i + 1}"/>
      <span class="foto-gallery-num">${i + 1}</span>
      <button type="button" class="foto-gallery-download" data-src="${escapeHtml(src)}" title="Unduh variasi ini">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <path d="M7 10l5 5 5-5"/>
          <path d="M12 15V3"/>
        </svg>
      </button>
    </div>`).join("");

  grid.querySelectorAll(".foto-gallery-download").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      unduhDariSrc(btn.dataset.src, "-ai");
    });
  });
}

function unduhDariSrc(src, sufiks = "") {
  const a        = document.createElement("a");
  a.href         = src;
  a.download     = `${fotoAsliFileName}${sufiks}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Foto diunduh! (Kalau kebuka tab baru, tekan lama gambarnya lalu simpan)");
}

function unduhFotoTunggal() {
  const src = document.getElementById("fotoHasil").src;
  if (!src) { showToast("Belum ada foto hasil buat diunduh"); return; }
  unduhDariSrc(src, "-poles");
}

// ══════════════════════════════════════════════
//  MODUL 7: BANTUAN IKLAN DIGITAL
// ══════════════════════════════════════════════

const budgetLabel = {
  kecil:  "budget kecil, di bawah Rp 50.000 per hari",
  sedang: "budget sedang, Rp 50.000 - 150.000 per hari",
  besar:  "budget lumayan, di atas Rp 150.000 per hari",
};

async function handleIklan() {
  const nama     = document.getElementById("iNama").value.trim();
  const desc     = document.getElementById("iDesc").value.trim();
  const budget   = getSelectVal("iBudget");
  const platform = getSelectVal("iPlatform");

  if (!nama) { showToast("Nama produk wajib diisi"); document.getElementById("iNama").focus(); return; }

  const btn = document.getElementById("btnIklan");
  btn.disabled = true;
  document.getElementById("loadIklan").classList.remove("hidden");
  document.getElementById("resIklan").classList.add("hidden");

  try {
    const sys = `Kamu adalah mentor digital marketing yang membantu UMKM Indonesia memasang iklan pertama mereka.

Tugasmu adalah membuat panduan iklan yang sederhana, praktis, dan langsung bisa dipakai.

FORMAT WAJIB:

CONTOH IKLAN
[tulis contoh iklan singkat 2-3 kalimat yang terasa natural]

TARGET PEMBELI
[jelaskan target pembeli yang paling potensial berdasarkan produk]

LANGKAH MEMULAI IKLAN
- langkah pertama
- langkah kedua
- langkah ketiga
- langkah keempat bila diperlukan

TIPS TAMBAHAN
[satu tips yang sering dilupakan pemula]

ATURAN WAJIB:

- Jangan mengarang keunggulan produk.
- Gunakan hanya informasi yang diberikan.
- Jangan menggunakan markdown.
- Jangan menggunakan numbering.
- Jangan menggunakan bahasa Inggris kecuali nama platform.
- Gunakan Bahasa Indonesia sehari-hari.
- Semua saran harus realistis untuk UMKM dengan budget kecil.
- Hindari istilah teknis digital marketing yang rumit.
`;
    const usr = `
    Nama produk:
    ${nama}

    Deskripsi:
    ${desc || "Tidak ada deskripsi."}

    Budget iklan:
    ${budgetLabel[budget]}

    Platform:
    ${platform}
    `;
    const hasil = await AI.callAI(sys, usr, 900);

    document.getElementById("iklanOutput").innerHTML = markdownIklan(hasil);
    document.getElementById("resIklan").classList.remove("hidden");
  } catch (e) { AI.tanganiErrorAI(e, btn); }
  finally {
    document.getElementById("loadIklan").classList.add("hidden");
    btn.disabled = false;
  }
}

document.getElementById("btnIklan").addEventListener("click", handleIklan);

// ══════════════════════════════════════════════
//  MODUL 8: CEK STOK AMAN
// ══════════════════════════════════════════════

function parseAngka(str) {
  const match = str.match(/[\d.,]+/);
  return match ? parseFloat(match[0].replace(/\./g, "").replace(",", ".")) : 0;
}

async function generateInsightStokAI(
  bahan,
  sisa,
  pakai,
  waktuBelanja,
  hariBertahan,
  status
) {

  const sys = `Kamu adalah konsultan operasional UMKM Indonesia.

Tugasmu adalah membantu pemilik usaha memahami kondisi stok dengan bahasa yang sederhana.

ATURAN WAJIB:

- Maksimal 2 paragraf.
- Jangan menggunakan markdown.
- Jangan menggunakan bullet.
- Jangan menggunakan numbering.
- Jangan mengarang data.
- Jangan mengarang kondisi pasar.
- Gunakan Bahasa Indonesia yang santai dan mudah dipahami.
- Hindari istilah teknis seperti "lead time", "inventory", "safety stock", atau istilah bisnis lainnya.
- Jika nama bahan memberikan petunjuk mengenai jenis usaha (misalnya kopi, tepung, deterjen, oli), kamu boleh menggunakan konteks tersebut. Jika tidak yakin, berikan saran yang bersifat umum.
- Berikan satu saran yang realistis mengenai kapan sebaiknya mulai membeli stok lagi.
- Jangan menghitung ulang angka yang tidak diminta.
- Jangan menyebut jumlah stok ideal (misalnya 50 kg atau 100 unit) kecuali bisa dihitung langsung dari data yang diberikan.
- Fokus pada waktu terbaik untuk mulai membeli kembali, bukan menentukan jumlah pembelian.

Fokus pada:
- Risiko kehabisan stok
- Waktu terbaik membeli kembali
- Efisiensi persediaan
- Kelancaran operasional
`;

  const usr = `
Nama bahan:
${bahan}

Sisa stok:
${sisa}

Pemakaian per hari:
${pakai}

Kalau pesan hari ini, biasanya barang sampai dalam:
${waktuBelanja} hari

Perkiraan stok bertahan:
${hariBertahan.toFixed(1)} hari

Status:
${status}

Instruksi:

Berikan analisis singkat mengenai kondisi stok ini dan jelaskan kapan waktu terbaik untuk mulai melakukan pembelian kembali agar operasional tidak terganggu.
`;

  return await AI.callAI(sys, usr, 500);
}

async function handleStok() {
  const bahan    = document.getElementById("sBahan").value.trim();
  const sisaRaw  = document.getElementById("sSisa").value.trim();
  const pakaiRaw = document.getElementById("sPakai").value.trim();
  const waktuRaw = document.getElementById("sWaktu").value.trim();

  if (!bahan || !sisaRaw || !pakaiRaw) {
    showToast("Isi bahan, sisa stok, dan pemakaian harian dulu");
    return;
  }

  const sisa         = parseAngka(sisaRaw);
  const pakai        = parseAngka(pakaiRaw) || 1;
  const waktuBelanja = parseAngka(waktuRaw) || 1;

  const hariBertahan    = sisa / pakai;
  const hariHarusBelanja = hariBertahan - waktuBelanja;

  let status, tone, saran;
  if (hariHarusBelanja <= 0) {
    status = "Harus Belanja Sekarang";
    tone = "bad";
    saran = `Persediaan ${bahan} diperkirakan habis sebelum stok baru datang. Sebaiknya lakukan pemesanan hari ini agar produksi atau penjualan tidak terhenti.`;
  } else if (hariHarusBelanja <= 2) {
    status = "Segera Jadwalkan Belanja";
    tone = "warn";
    saran = `Stok ${bahan} masih mencukupi untuk sementara, tetapi sebaiknya mulai menjadwalkan pembelian dalam 1 sampai 2 hari ke depan agar tetap aman.`;
  } else {
    status = "Stok Masih Aman";
    tone = "good";
    saran = `Persediaan ${bahan} masih cukup sekitar ${Math.floor(hariBertahan)} hari. Belum perlu melakukan pembelian, tetapi tetap pantau penggunaan setiap hari.`;
  }

  const btn = document.getElementById("btnStok");
  btn.disabled = true;
  document.getElementById("loadStok").classList.remove("hidden");

  const insightPromise = generateInsightStokAI(
  bahan,
  sisa,
  pakai,
  waktuBelanja,
  hariBertahan,
  status
  );

  const gaugePct = Math.max(4, Math.min(100, (hariBertahan / (waktuBelanja * 4)) * 100));

  document.getElementById("stokOutput").innerHTML = `
    <div class="harga-main">
      <div class="harga-main-label">Status Stok ${escapeHtml(bahan)}</div>
      <div class="harga-main-num is-compact" data-tone="${tone}">${escapeHtml(status)}</div>
    </div>
    <div class="gauge-wrap">
      <div class="gauge-track">
        <div class="gauge-fill" data-tone="${tone}" style="--pct:${gaugePct}%"></div>
      </div>
      <div class="gauge-caption">
        <span>0 hari</span>
        <span>${Math.floor(hariBertahan)} hari tersisa</span>
      </div>
    </div>
    <div class="harga-rows">
      <div class="harga-row"><span>Sisa stok sekarang</span><span>${escapeHtml(sisaRaw)}</span></div>
      <div class="harga-row total"><span>Perkiraan tahan berapa hari</span><span>${Math.floor(hariBertahan)} hari</span></div>
    </div>
    `;

  try {
  const insight = await insightPromise;

  document.getElementById("stokOutput").insertAdjacentHTML(
    "beforeend",
    `
      <div class="kc-card" style="margin-top:16px">
        <div class="kc-label">
          🤖 Analisis AI
        </div>
        ${markdownRingan(insight)}
      </div>
    `
  );
} catch (e) {
  console.error(e);
}
  document.getElementById("loadStok").classList.add("hidden");
  document.getElementById("resStok").classList.remove("hidden");
  btn.disabled = false;
}

document.getElementById("btnStok").addEventListener("click", handleStok);

// ══════════════════════════════════════════════
//  SERVICE WORKER
// ══════════════════════════════════════════════

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/assets/js/sw.js").catch((err) => {
      console.log("Service worker gagal daftar (tidak fatal):", err);
    });
  });
}