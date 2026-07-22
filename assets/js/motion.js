/* ================================================
   SAPA — Lapisan gerak (motion.js)
   Terpisah total dari app.js, gak nyentuh logic
   inti. Kalau GSAP gagal load, aplikasi tetap jalan
   normal — cuma tanpa polesan animasi.
   Prinsip: HIERARKI. Cuma elemen penting yang
   dikasih gerak besar, sisanya halus aja biar orang
   fokus kerja.
   ================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof gsap !== "undefined";

  /* ---------- 0. Splash: hapus dari DOM setelah animasi CSS selesai ---------- */
  /* ---------- 0b. Tip harian di kartu hero — ganti tiap hari, bukan statis ---------- */
  function setHeroTip() {
    var el = document.getElementById("heroTipText");
    if (!el) return;
    var tips = [
      "Foto produk yang cerah bisa naikin minat pembeli sampai 2x lipat — coba modul Poles Foto.",
      "Balas chat pembeli dalam 15 menit pertama bikin peluang closing jauh lebih besar.",
      "Catat transaksi setiap hari, sekecil apapun — biar di akhir bulan gak nebak-nebak untung.",
      "Harga jual yang sehat itu bukan yang paling murah, tapi yang untungnya kepakai.",
      "Posting konten di jam makan siang atau habis maghrib biasanya lebih banyak dilihat.",
      "Stok yang terlalu dikit bikin pembeli kecewa, terlalu banyak bikin modal nyangkut — cek rutin."
    ];
    var dayIndex = new Date().getDate() % tips.length;
    el.textContent = tips[dayIndex];
  }

  function cleanupSplash() {
    var splash = document.getElementById("sapaSplash");
    if (!splash) return;
    setTimeout(function () {
      if (splash.parentNode) splash.parentNode.removeChild(splash);
    }, reduceMotion ? 50 : 1300);
  }

  /* ---------- 1. Atmosfer — dua medan warna, hanyut pelan ---------- */
  function buildAtmosphere() {
    if (reduceMotion) return;
    var wrap = document.createElement("div");
    wrap.className = "sapa-atmos";
    wrap.setAttribute("aria-hidden", "true");
    var fields = [
      { c: "var(--accent)", top: "-8%", left: "-6%", size: "46vw" },
      { c: "#22C55E", top: "62%", left: "68%", size: "40vw" }
    ];
    fields.forEach(function (f, i) {
      var el = document.createElement("span");
      el.style.width = f.size;
      el.style.height = f.size;
      el.style.top = f.top;
      el.style.left = f.left;
      el.style.background = f.c;
      wrap.appendChild(el);
      if (hasGsap) {
        gsap.to(el, {
          x: (i % 2 === 0 ? 1 : -1) * 70,
          y: (i % 2 === 0 ? -1 : 1) * 50,
          duration: 22 + i * 6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      }
    });
    document.body.insertBefore(wrap, document.body.firstChild);
  }

  /* ---------- 2. Transisi antar halaman ---------- */
  function revealPage(page) {
    if (!hasGsap || reduceMotion) return;
    var targets = page.querySelectorAll(
      ".greeting-row, .guide-box, .stat-strip, .menu-card, .back-btn, .tool-header, .tool-sub, .form-card, .auth-card"
    );
    if (!targets.length) return;
    gsap.fromTo(
      targets,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power3.out", stagger: 0.045, overwrite: true }
    );
  }

  var pageObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName !== "class") return;
      var el = m.target;
      if (!el.classList.contains("page")) return;
      if (!el.classList.contains("hidden")) revealPage(el);
    });
  });
  document.querySelectorAll("main.page").forEach(function (p) {
    pageObserver.observe(p, { attributes: true });
  });

  /* ---------- 3. Angka statistik ngitung naik ---------- */
  function animateCount(el) {
    if (!hasGsap || el.dataset.counted) return;
    var raw = el.textContent.trim();
    var match = raw.match(/[\d.]+/);
    if (!match) return;
    var target = parseFloat(match[0]);
    var suffix = raw.replace(match[0], "");
    el.dataset.counted = "1";
    var obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1,
      ease: "power2.out",
      onUpdate: function () {
        el.textContent = Math.round(obj.v) + suffix;
      }
    });
  }
  var menuPage = document.getElementById("pageMenu");
  if (menuPage) {
    var statObserver = new MutationObserver(function () {
      if (!menuPage.classList.contains("hidden")) {
        menuPage.querySelectorAll(".stat-num").forEach(animateCount);
      }
    });
    statObserver.observe(menuPage, { attributes: true, attributeFilter: ["class"] });
    if (!menuPage.classList.contains("hidden")) {
      menuPage.querySelectorAll(".stat-num").forEach(animateCount);
    }
  }

  /* ---------- 4. Riak halus pas tombol utama ditekan ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".btn-main, .btn-outline");
    if (!btn || reduceMotion) return;
    var ripple = document.createElement("span");
    var r = btn.getBoundingClientRect();
    var size = Math.max(r.width, r.height) * 1.3;
    ripple.style.cssText =
      "position:absolute;left:" + (e.clientX - r.left - size / 2) + "px;top:" + (e.clientY - r.top - size / 2) +
      "px;width:" + size + "px;height:" + size + "px;border-radius:50%;background:rgba(255,255,255,0.3);pointer-events:none;";
    var prevPosition = getComputedStyle(btn).position;
    if (prevPosition === "static") btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.appendChild(ripple);
    if (hasGsap) {
      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 0.5 },
        { scale: 1, opacity: 0, duration: 0.5, ease: "power2.out", onComplete: function () { ripple.remove(); } }
      );
    } else {
      ripple.style.transition = "transform 0.5s ease, opacity 0.5s ease";
      requestAnimationFrame(function () {
        ripple.style.transform = "scale(1)";
        ripple.style.opacity = "0";
      });
      setTimeout(function () { ripple.remove(); }, 550);
    }
  });

  /* ---------- init ---------- */
  var initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    cleanupSplash();
    buildAtmosphere();
    setHeroTip();
    var initialPage = document.querySelector("main.page:not(.hidden)");
    if (initialPage) revealPage(initialPage);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
