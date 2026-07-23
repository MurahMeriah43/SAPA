// ==========================================
// SETTINGS MODULE
// ==========================================

import { State } from "./state.js";
import { SapaDB } from "./supabase-client.js";

export const Settings = {
  initApiStatus,
  refreshSettingsStatus,
  initTheme,
  initFontSize,
  initSettings,
  applyProfilePrefs,
};

function initApiStatus() {
  const el = document.getElementById("apiStatus");
  if (!el) return;

  el.textContent =
    "Tersambung ke AI — semua hasil diproses langsung secara real-time.";
  el.classList.add("connected");
}

function refreshSettingsStatus() {
  // Status AI sudah hardcoded di HTML sebagai "Tersambung"
}

function initTheme() {
  // Sebelum login ikuti preferensi browser.
  // Setelah login akan dioverride oleh applyProfilePrefs().
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;

  document.documentElement.setAttribute(
    "data-theme",
    prefersDark ? "dark" : "light"
  );

  const btn = document.getElementById("themeToggle");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";

    document.documentElement.setAttribute("data-theme", next);

    if (
      State.currentProfile &&
      SapaDB.isConfigured()
    ) {
      try {
        await SapaDB.updatePrefs(State.currentProfile.id, {
          theme: next,
        });

        State.currentProfile.theme = next;
      } catch (err) {
        console.error(err);
      }
    }
  });
}

function initFontSize() {
  document.documentElement.setAttribute("data-fontsize", "medium");

  document.querySelectorAll(".font-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.size === "medium"
    );
  });

  document.querySelectorAll(".font-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const size = btn.dataset.size;

      document.documentElement.setAttribute(
        "data-fontsize",
        size
      );

      document.querySelectorAll(".font-btn").forEach((b) => {
        b.classList.remove("active");
      });

      btn.classList.add("active");

      if (
        State.currentProfile &&
        SapaDB.isConfigured()
      ) {
        try {
          await SapaDB.updatePrefs(State.currentProfile.id, {
            font_size: size,
          });

          State.currentProfile.font_size = size;
        } catch (err) {
          console.error(err);
        }
      }
    });
  });
}

/**
 * Dipanggil setelah login / daftar.
 * Terapkan preferensi tema & ukuran font milik profil.
 */
function applyProfilePrefs(profile) {
  if (!profile) return;

  // Theme
  const theme = profile.theme || "light";
  document.documentElement.setAttribute(
    "data-theme",
    theme
  );

  // Font Size
  const size = profile.font_size || "medium";
  document.documentElement.setAttribute(
    "data-fontsize",
    size
  );

  document.querySelectorAll(".font-btn").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.size === size
    );
  });
}

function initSettings() {
  const modal = document.getElementById("settingsModal");
  if (!modal) return;

  const btnSettings = document.getElementById("btnSettings");
  const btnClose = document.getElementById("settingsClose");
  const btnSave = document.getElementById("btnSaveProfil");
  const inputNama = document.getElementById("inputNamaUsaha");
  const greeting = document.getElementById("greetingLabel");

  btnSettings?.addEventListener("click", () => {
  const sudahLogin = !!State.currentProfile;

  inputNama.value = sudahLogin ? State.currentProfile.nama : "";
  inputNama.disabled = !sudahLogin;
  inputNama.placeholder = sudahLogin
    ? ""
    : "Masuk atau daftar dulu buat atur nama usaha";

  if (btnSave) {
    btnSave.disabled = !sudahLogin;
  }

  modal.classList.remove("hidden");
});

  btnClose?.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });

  btnSave?.addEventListener("click", async () => {
    const namaBaru = inputNama.value.trim();

    if (!namaBaru) {
      showToast("Nama usaha tidak boleh kosong");
      return;
    }

    if (!State.currentProfile) {
      showToast("Belum ada profil aktif");
      return;
    }

    // Mode Preview
    if (!SapaDB.isConfigured()) {
      State.currentProfile.nama = namaBaru;

      if (greeting) {
        greeting.textContent = `Halo, ${namaBaru}`;
      }

      showToast(
        "Mode preview — nama berubah sementara, gak kesimpen"
      );

      modal.classList.add("hidden");
      return;
    }

    try {
      await SapaDB.renameProfile(
        State.currentProfile.id,
        namaBaru
      );

      State.currentProfile.nama = namaBaru;

      if (greeting) {
        greeting.textContent = `Halo, ${namaBaru}`;
      }

      showToast("Nama usaha diperbarui!");

      modal.classList.add("hidden");
    } catch (err) {
      console.error(err);

      showToast(
        err.message ||
        "Gagal simpan, nama mungkin sudah dipakai"
      );
    }
  });

  refreshSettingsStatus();
}