/* ==========================================================================
   📱 PVT WORKFORCE HUB — mobile-shell.js  (ใช้ร่วมกันทั้ง 5 หน้าหลัก)
   - สร้างแถบเมนูล่างจากรายการเดียว (TABS) → ทุกหน้าเหมือนกันเสมอ
   - ไฮไลต์เมนูตามหน้าที่เปิดอยู่อัตโนมัติ (บังคับเองได้ด้วย <body data-pvt-tab="history">)
   - ซ่อนแถบล่างตอนคีย์บอร์ดขึ้น
   - ส่วนหัว .pvt-appbar: เงาตอนเลื่อน + ปุ่มย้อนกลับใช้ history.back()
   - API: PVTShell.setBadge('history', 3) / PVTShell.setBadge('history', 0)

   วิธีโหลด:  <script src="/js/mobile-shell.js" defer></script>
   ========================================================================== */
(function () {
  "use strict";
  if (window.PVTShell) return;

  /* แก้เมนูที่นี่ที่เดียว มีผลทั้ง 5 หน้า */
  var TABS = [
    { key: "home",     href: "/pages/user/index-user.html",    icon: "home",           label: "หน้าหลัก" },
    { key: "history",  href: "/pages/user/leave-history.html", icon: "receipt_long",   label: "ประวัติลา" },
    { key: "leave",    href: "/pages/user/leave-user.html",    icon: "add",            label: "ยื่นใบลา", primary: true },
    { key: "holidays", href: "/pages/user/holidays.html",      icon: "calendar_month", label: "วันหยุด" },
    { key: "profile",  href: "/pages/user/profile-user.html",  icon: "person",         label: "โปรไฟล์", aria: "ข้อมูลส่วนตัว" }
  ];

  var root = document.documentElement;
  var badgeCounts = {}; // จำค่าไว้ เผื่อหน้าเรียก setBadge ก่อนแถบถูกสร้าง

  function detectActiveTab() {
    var forced = document.body && document.body.getAttribute("data-pvt-tab");
    if (forced) return forced;

    var path = location.pathname.replace(/\/+$/, "");
    for (var i = 0; i < TABS.length; i++) {
      var href = TABS[i].href;
      if (path.endsWith(href) || path.endsWith(href.replace(/\.html$/, ""))) return TABS[i].key;
    }
    // สำรอง: เทียบเฉพาะชื่อไฟล์ (เช่น HR เปิด /pages/hr/holidays.html)
    var file = path.split("/").pop().replace(/\.html$/, "");
    for (var j = 0; j < TABS.length; j++) {
      if (TABS[j].href.split("/").pop().replace(/\.html$/, "") === file) return TABS[j].key;
    }
    if (/\/pages\/user$/.test(path)) return "home";
    return "";
  }

  function tabHtml(tab, isActive) {
    var cls = "pvt-tab" + (tab.primary ? " pvt-tab--primary" : "") + (isActive ? " is-active" : "");
    var icon = tab.primary
      ? '<span class="pvt-tab-fab" aria-hidden="true"><span class="material-symbols-outlined">' + tab.icon + "</span></span>"
      : '<span class="pvt-tab-icon material-symbols-outlined" aria-hidden="true">' + tab.icon + "</span>";

    return (
      '<a href="' + tab.href + '" class="' + cls + '" data-tab="' + tab.key + '"' +
      (isActive ? ' aria-current="page"' : "") +
      (tab.aria ? ' aria-label="' + tab.aria + '"' : "") +
      ">" + icon + '<span class="pvt-tab-label">' + tab.label + "</span></a>"
    );
  }

  function renderTabbar() {
    var active = detectActiveTab();

    // ลบแถบล่างแบบเก่าที่ฝังไว้ในแต่ละหน้า (ถ้ายังมี) เพื่อไม่ให้ซ้อนกัน
    var old = document.querySelectorAll(".mobile-bottom-nav, #pvtTabbar");
    for (var i = 0; i < old.length; i++) old[i].remove();

    var nav = document.createElement("nav");
    nav.id = "pvtTabbar";
    nav.className = "pvt-tabbar";
    nav.setAttribute("aria-label", "เมนูหลัก");
    nav.innerHTML = TABS.map(function (t) { return tabHtml(t, t.key === active); }).join("");

    // แตะเมนูของหน้าที่เปิดอยู่ = เลื่อนกลับขึ้นบนสุด (เหมือนแอปทั่วไป)
    nav.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a.pvt-tab");
      if (!a || !a.classList.contains("is-active") || a.classList.contains("pvt-tab--primary")) return;
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    document.body.appendChild(nav);
    document.body.classList.add("pvt-has-tabbar");
    Object.keys(badgeCounts).forEach(function (k) { applyBadge(k, badgeCounts[k]); });
    return nav;
  }

  function setBadge(key, count) {
    badgeCounts[key] = parseInt(count, 10) || 0;
    applyBadge(key, badgeCounts[key]);
  }

  function applyBadge(key, n) {
    var tab = document.querySelector('#pvtTabbar .pvt-tab[data-tab="' + key + '"]');
    if (!tab) return;
    var badge = tab.querySelector(".pvt-tab-badge");
    if (n <= 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "pvt-tab-badge";
      badge.setAttribute("aria-hidden", "true");
      tab.appendChild(badge);
    }
    badge.textContent = n > 99 ? "99+" : String(n);
  }

  /* คีย์บอร์ดมือถือ → ซ่อนแถบล่าง + ตั้งค่า CSS vars ให้หน้าต่างที่ต้องหลบคีย์บอร์ด */
  function watchKeyboard() {
    var vv = window.visualViewport;
    function update() {
      var h = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--pvt-vvh", Math.round(h) + "px");
      root.style.setProperty("--pvt-vv-top", Math.round(vv ? vv.offsetTop : 0) + "px");
      root.classList.toggle("pvt-kb-open", !!vv && window.innerHeight - vv.height > 150);
    }
    update();
    (vv || window).addEventListener("resize", update);
    if (vv) vv.addEventListener("scroll", update);
  }

  function enhanceAppbars() {
    var bars = document.querySelectorAll(".pvt-appbar");
    if (!bars.length) return;

    // ปุ่มย้อนกลับ: ถ้ามาจากหน้าในระบบเดียวกันให้ย้อนประวัติ ไม่ก็ไปตาม href
    var backs = document.querySelectorAll(".pvt-appbar-back");
    for (var i = 0; i < backs.length; i++) {
      backs[i].addEventListener("click", function (e) {
        try {
          var ref = document.referrer ? new URL(document.referrer) : null;
          if (ref && ref.origin === location.origin && history.length > 1) {
            e.preventDefault();
            history.back();
          }
        } catch (err) { /* ใช้ href ตามปกติ */ }
      });
    }

    // ให้หัวชนขอบจอพอดี: อ่าน padding จริงของกล่องแม่ แทนการเดาค่า
    function fitToEdges() {
      for (var k = 0; k < bars.length; k++) {
        var parent = bars[k].parentElement;
        if (!parent) continue;
        var cs = getComputedStyle(parent);
        bars[k].style.setProperty("--pvt-bleed-l", cs.paddingLeft);
        bars[k].style.setProperty("--pvt-bleed-r", cs.paddingRight);
      }
    }
    fitToEdges();
    window.addEventListener("resize", fitToEdges);

    // เงาใต้หัวเมื่อเลื่อนหน้าลง
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var scrolled = window.scrollY > 4;
        for (var j = 0; j < bars.length; j++) bars[j].classList.toggle("is-scrolled", scrolled);
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function init() {
    renderTabbar();
    watchKeyboard();
    enhanceAppbars();
  }

  window.PVTShell = {
    tabs: TABS,
    setBadge: setBadge,
    refresh: renderTabbar
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();