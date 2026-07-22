/* ================================================
   SAPA — Lapisan data (Supabase)

   GANTI DUA NILAI DI BAWAH sebelum dipakai:
   ambil dari Supabase Dashboard → Project Settings
   → API, setelah kamu jalanin supabase/schema.sql
   di SQL Editor.
   ================================================ */

const SUPABASE_URL      = "https://xbfwvnvaqgkhxfmmudkg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_572qg5CSAHK5uXuAKJ0KOg_-8IbQjb7";

const SapaDB = (() => {
  let client  = null;
  let session = null;

  function isConfigured() {
    return (
      SUPABASE_URL.startsWith("https://") &&
      !SUPABASE_URL.includes("ISI-PROJECT-KAMU") &&
      SUPABASE_ANON_KEY.length > 20 &&
      !SUPABASE_ANON_KEY.includes("isi-anon-public-key")
    );
  }

  async function init() {
    if (!isConfigured()) {
      throw new Error("Supabase belum diisi. Cek js/supabase-client.js.");
    }

    // Pastikan SDK sudah load
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase SDK belum termuat. Cek koneksi internet kamu.");
    }

    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    });

    // Coba ambil sesi yang sudah ada
    const { data: { session: existing }, error: sessionError } = await client.auth.getSession();

    if (sessionError) {
      console.warn("Gagal ambil sesi lama:", sessionError.message);
    }

    if (existing) {
      session = existing;
      return session;
    }

    // Bikin sesi anonim baru
    const { data, error } = await client.auth.signInAnonymously();
    if (error) {
      // Pesan error lebih informatif
      if (error.message && error.message.includes("Anonymous")) {
        throw new Error(
          "Sesi anonim belum aktif di Supabase. Buka Authentication → Sign In / Providers → aktifkan Anonymous Sign-Ins."
        );
      }
      throw error;
    }

    session = data.session;
    return session;
  }

  async function myProfile() {
    _requireInit();
    const { data, error } = await client
      .from("profiles")
      .select("id, nama, theme, font_size")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function register(nama, pin) {
    _requireInit();
    const { data, error } = await client.rpc("register_profile", { p_nama: nama, p_pin: pin });
    if (error) {
      // 404 artinya fungsi belum ada di database
      if (error.code === "PGRST202" || (error.message && error.message.includes("404"))) {
        throw new Error(
          "Fungsi register_profile tidak ditemukan. Jalankan dulu supabase/schema.sql di SQL Editor Supabase dashboard kamu."
        );
      }
      throw new Error(cleanPgError(error));
    }
    if (!data || data.length === 0) {
      throw new Error("Registrasi gagal, tidak ada data yang dikembalikan.");
    }
    return data[0];
  }

  async function verifyPin(pin) {
    _requireInit();
    const { data, error } = await client.rpc("verify_pin", { p_pin: pin });
    if (error) {
      if (error.code === "PGRST202" || (error.message && error.message.includes("404"))) {
        throw new Error(
          "Fungsi verify_pin tidak ditemukan. Jalankan dulu supabase/schema.sql di SQL Editor Supabase dashboard kamu."
        );
      }
      throw new Error(cleanPgError(error));
    }
    if (!data || data.length === 0) {
      throw new Error("PIN salah atau profil tidak ditemukan.");
    }
    return data[0];
  }

  async function claim(nama, pin) {
    _requireInit();
    const { data, error } = await client.rpc("claim_profile", { p_nama: nama, p_pin: pin });
    if (error) {
      if (error.code === "PGRST202" || (error.message && error.message.includes("404"))) {
        throw new Error(
          "Fungsi claim_profile tidak ditemukan. Jalankan dulu supabase/schema.sql di SQL Editor Supabase dashboard kamu."
        );
      }
      throw new Error(cleanPgError(error));
    }
    if (!data || data.length === 0) {
      throw new Error("Nama usaha atau PIN salah.");
    }
    return data[0];
  }

  async function renameProfile(profileId, namaBaru) {
    _requireInit();
    const { error } = await client
      .from("profiles")
      .update({ nama: namaBaru })
      .eq("id", profileId);
    if (error) throw new Error(cleanPgError(error));
  }

  async function updatePrefs(profileId, prefs) {
    _requireInit();
    const { error } = await client
      .from("profiles")
      .update(prefs)
      .eq("id", profileId);
    if (error) console.error("Gagal simpan preferensi:", error);
  }

  async function fetchTransaksi(profileId) {
    _requireInit();
    const { data, error } = await client
      .from("transaksi")
      .select("id, waktu, teks, masuk, keluar")
      .eq("profile_id", profileId)
      .order("waktu", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addTransaksi(profileId, row) {
    _requireInit();
    const { data, error } = await client
      .from("transaksi")
      .insert({ profile_id: profileId, teks: row.teks, masuk: row.masuk, keluar: row.keluar })
      .select("id, waktu, teks, masuk, keluar")
      .single();
    if (error) throw error;
    return data;
  }

  let transaksiChannel = null;
let transaksiChannelBusy = null; // guard biar panggilan bertumpuk gak saling nyalip
async function subscribeTransaksi(profileId, onInsert) {
  _requireInit();

  // Kalau lagi ada proses subscribe/unsubscribe berjalan, tunggu itu kelar dulu
  if (transaksiChannelBusy) {
      await transaksiChannelBusy.catch(() => {});
  }

  const task = (async () => {
      // Hapus channel lama SAMPAI BENERAN kelar (baru boleh bikin channel baru dgn nama sama)
      if (transaksiChannel) {
          await client.removeChannel(transaksiChannel);
          transaksiChannel = null;
      }

      transaksiChannel = client
          .channel("transaksi-" + profileId)
          .on(
              "postgres_changes",
              {
                  event: "INSERT",
                  schema: "public",
                  table: "transaksi",
                  filter: `profile_id=eq.${profileId}`
              },
              (payload) => onInsert(payload.new)
          )
          .subscribe();

      return transaksiChannel;
  })();

  transaksiChannelBusy = task;
  try {
      return await task;
  } finally {
      if (transaksiChannelBusy === task) transaksiChannelBusy = null;
  }
}

  function _requireInit() {
    if (!client || !session) {
      throw new Error("SapaDB.init() belum dipanggil. Pastikan initAuth() sudah selesai.");
    }
  }

  function cleanPgError(error) {
    if (!error) return "Terjadi kesalahan, coba lagi.";
    // Postgres RAISE EXCEPTION muncul di error.message
    const msg = error.message || "";
    // Hapus prefix teknis kalau ada
    return msg.replace(/^ERROR:\s*/, "").trim() || "Terjadi kesalahan, coba lagi.";
  }

  return {
    isConfigured, init, myProfile, register, verifyPin, claim,
    renameProfile, updatePrefs, fetchTransaksi, addTransaksi, subscribeTransaksi,
  };
})();

export { SapaDB };
