/**
 * ==========================================================
 * SAPA V2
 * AI Module
 * ==========================================================
 */

import {
    DAHL_URL,
    DAHL_MODEL
} from "./config.js";
import { UI } from "./ui.js";

    const SYSTEM_GLOBAL = `Kamu adalah asisten AI khusus UMKM Indonesia.

    ATURAN WAJIB — IKUTI TANPA PENGECUALIAN:
    - Gunakan Bahasa Indonesia 100%. Jangan gunakan bahasa Mandarin, Jepang, Korea, atau bahasa asing lainnya.
    - Nama aplikasi seperti Instagram, WhatsApp, Facebook, TikTok, Shopee, Tokopedia boleh tetap dalam bahasa aslinya.
    - Jangan tampilkan proses berpikir. Jangan tampilkan tag <think> atau </think>.
    - Jangan gunakan simbol markdown seperti **, ##, atau tanda backtick.
    - Jangan gunakan penomoran (1. 2. 3.) kecuali format yang diminta secara spesifik.
    - Gunakan bullet (-) jika harus membuat daftar, bukan angka.
    - Gunakan bahasa yang mudah dipahami pemilik UMKM. Hindari istilah teknis tanpa penjelasan.
    - Jawaban harus langsung ke poin. Jangan berputar-putar.`;

    const PESAN_LIMIT = {
    Dahl: {
        judul: "AI lagi sibuk sebentar",
        sub: "Trafik lagi tinggi. Sebentar lagi lanjut otomatis, tenang aja."
    },
    Pollinations: {
        judul: "Pollinations lagi penuh dipakai",
        sub: "Wajar buat layanan gratis pas lagi ramai. Sebentar lagi lanjut otomatis."
    },
    default: {
        judul: "AI-nya lagi penuh dipakai orang lain",
        sub: "Wajar buat layanan gratis pas lagi ramai. Sebentar lagi lanjut otomatis sendiri."
    }
};

let cooldownTimer = null;

export const AI = {

    async callAI(systemTambahan, user, maxTokens = 900) {

        const systemFinal = `${SYSTEM_GLOBAL}\n\n${systemTambahan}`.trim();

        const MAX_RETRY = 1;

        for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {

            const controller = new AbortController();

            const timeout = setTimeout(() => {
                controller.abort();
            }, 30000);

            let res;

            try {

                res = await fetch(DAHL_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: DAHL_MODEL,
                        max_tokens: maxTokens,
                        temperature: 0.35,
                        top_p: 0.9,
                        frequency_penalty: 0,
                        presence_penalty: 0,
                        messages: [
                            {
                                role: "system",
                                content: systemFinal
                            },
                            {
                                role: "user",
                                content: user
                            }
                        ]
                    })
                });

            } catch (err) {

                clearTimeout(timeout);

                if (err.name === "AbortError") {
                    throw new Error("Timeout");
                }

                if (attempt < MAX_RETRY) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                throw err;
            }

            clearTimeout(timeout);

            if (!res.ok) {

                if (
                    (
                        res.status === 502 ||
                        res.status === 503 ||
                        res.status === 504
                    ) &&
                    attempt < MAX_RETRY
                ) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const err = await res.json().catch(() => ({}));

                const msg =
                    err?.error?.message ||
                    `HTTP ${res.status}`;

                if (res.status === 429) {

                    const rateLimitError = new Error(
                        "AI lagi penuh dipakai, giliran kamu sebentar lagi."
                    );

                    rateLimitError.isRateLimit = true;
                    rateLimitError.retrySeconds = 60;
                    rateLimitError.service = "Dahl";

                    throw rateLimitError;
                }

                throw new Error(msg);
            }

            const data = await res.json();

            const choice = data.choices?.[0];

            if (!choice) {
                throw new Error("AI tidak memberikan jawaban.");
            }

            return (choice.message?.content || "")
            .replace(/<think>[\s\S]*?<\/think>/gi, "")
            .replace(/\r/g, "")
            .replace(/\u200B/g, "")
            .replace(/[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g, "")
            .trim();
        }

        throw new Error("AI gagal memberikan jawaban.");
    },

    async generateKontenAI(nama, desc, harga, platform, tren, trenLabel) {

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

        const raw = await this.callAI(sys, usr, 1800);

        const blok = raw
            .split(/---IDE---/i)
            .map(v => v.trim())
            .filter(v => v.length);

        const hasil = [];

        for (const item of blok) {

            const ambil = (label) => {
                const regex = new RegExp(
                    `${label}\\s*:\\s*([\\s\\S]*?)(?=ANGLE:|HOOK:|CAPTION:|FOTO:|$)`,
                    "i"
                );

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

    },

    tampilkanCooldownBanner(seconds, service) {

    const banner = document.getElementById("cooldownBanner");

    const pesan = PESAN_LIMIT[service] || PESAN_LIMIT.default;

    document.getElementById("cooldownTitle").textContent = pesan.judul;

    document.getElementById("cooldownSub").textContent = pesan.sub;

    const countEl = document.getElementById("cooldownCount");

    let sisa = seconds;

    countEl.textContent = sisa;

    banner.classList.remove("hidden");

    if (cooldownTimer) {

        clearInterval(cooldownTimer);

    }

    cooldownTimer = setInterval(() => {

        sisa--;

        if (sisa <= 0) {

            clearInterval(cooldownTimer);

            cooldownTimer = null;

            banner.classList.add("hidden");

        } else {

            countEl.textContent = sisa;

        }

        }, 1000);

     },

     mulaiCooldown(btn, seconds, service) {

        this.tampilkanCooldownBanner(seconds, service);

        if (!btn) return;

        const labelAsli = btn.dataset.labelAsli || btn.innerHTML;

        btn.dataset.labelAsli = labelAsli;

        btn.disabled = true;

        btn.innerHTML = "<span>Menunggu giliran...</span>";

        setTimeout(() => {

            btn.disabled = false;

            btn.innerHTML = labelAsli;

        }, seconds * 1000);

        },

        tanganiErrorAI(err, btn) {

        console.error(err);

        if (err.isRateLimit) {

        this.mulaiCooldown(btn, err.retrySeconds || 60, err.service);

        return;

        }

        const msg = err.message || "";

        if (msg.includes("502")) {

        UI.toast.show("Server AI sedang sibuk. Coba lagi beberapa saat.");

        } else if (msg.includes("503")) {

        UI.toast.show("AI sedang ramai digunakan. Silakan coba lagi sebentar.");

        } else if (msg.includes("504")) {

        UI.toast.show("AI terlalu lama merespons.");

        } else if (msg.toLowerCase().includes("timeout")) {

        UI.toast.show("Koneksi ke AI terlalu lama. Silakan coba lagi.");

            } else {

            UI.toast.show(msg || "Terjadi kesalahan.");

        }

    },

    async generateBalasanAI(pesan, info, nada) {

    const sys = `Kamu adalah admin customer service UMKM Indonesia yang membalas chat pelanggan melalui WhatsApp, Instagram, Facebook, dan marketplace.

Balaslah seperti manusia sungguhan.

ATURAN WAJIB:

- Langsung tulis isi balasan.
- Jangan gunakan markdown.
- Jangan gunakan bullet.
- Jangan gunakan numbering.
- Jangan gunakan tanda kutip.
- Jangan menambahkan catatan.
- Jangan menyebut bahwa kamu AI.
- Jangan mengarang informasi produk.
- Jika informasi tidak tersedia, katakan dengan sopan bahwa pelanggan bisa menghubungi admin untuk memastikan.
- Gunakan Bahasa Indonesia sehari-hari.
- Maksimal sekitar 120 kata.
- Jangan menggunakan emoji berlebihan.
- Balasan harus terasa ramah, membantu, dan natural.

Sesuaikan gaya balasan dengan nada yang diminta.`;

    const usr = `
Pesan pelanggan:
"${pesan}"

Informasi toko:
${info || "Tidak ada informasi tambahan."}

Nada balasan:
${nada}
`;

    const hasil = await this.callAI(sys, usr, 500);

    return hasil.trim();
},

};