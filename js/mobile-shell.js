/* ==========================================================================
   📱 PVT WORKFORCE HUB — mobile-shell.js  (ใช้ร่วมกันทั้ง 5 หน้าหลัก)
   - สร้างแถบเมนูล่างจากรายการเดียว (TABS) → ทุกหน้าเหมือนกันเสมอ
   - หน้าอนุมัติใบลา (/pages/approver/) ปุ่มกลางเป็น "อนุมัติ" แทน "ยื่นใบลา"
   - ไฮไลต์เมนูตามหน้าที่เปิดอยู่อัตโนมัติ (บังคับเองได้ด้วย <body data-pvt-tab="history">)
   - ซ่อนแถบล่างตอนคีย์บอร์ดขึ้น
   - ส่วนหัว .pvt-appbar: เงาตอนเลื่อน + ปุ่มย้อนกลับใช้ history.back()
   - เมนูข้างบนมือถือ (Drawer) ชุดเดียวทุกหน้า แทนเมนูข้างเดิมของแต่ละหน้า
   - API: PVTShell.setBadge('history', 3) / PVTShell.setBadge('history', 0)
          PVTShell.openMenu() / PVTShell.closeMenu()

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

  /* หน้าอนุมัติใบลาของหัวหน้างาน (/pages/approver/ หรือ <body data-portal="approver">)
     ใช้แถบเดียวกันทุกอย่าง แต่ปุ่มกลางเป็น "อนุมัติ" แทน "ยื่นใบลา" */
  var APPROVE_TAB = { key: "approve", href: "/pages/approver/leave-approvals.html", icon: "fact_check", label: "อนุมัติ", primary: true };

  function isApproverPortal() {
    var b = document.body;
    return (b && b.getAttribute("data-portal") === "approver") || /\/pages\/approver\//.test(location.pathname);
  }

  function getTabs() {
    if (!isApproverPortal()) return TABS;
    return TABS.map(function (t) { return t.primary ? APPROVE_TAB : t; });
  }

  var root = document.documentElement;
  var badgeCounts = {}; // จำค่าไว้ เผื่อหน้าเรียก setBadge ก่อนแถบถูกสร้าง

  function detectActiveTab() {
    var forced = document.body && document.body.getAttribute("data-pvt-tab");
    if (forced) return forced;

    var tabs = getTabs();
    var path = location.pathname.replace(/\/+$/, "");
    for (var i = 0; i < tabs.length; i++) {
      var href = tabs[i].href;
      if (path.endsWith(href) || path.endsWith(href.replace(/\.html$/, ""))) return tabs[i].key;
    }
    // สำรอง: เทียบเฉพาะชื่อไฟล์ (เช่น HR เปิด /pages/hr/holidays.html)
    var file = path.split("/").pop().replace(/\.html$/, "");
    for (var j = 0; j < tabs.length; j++) {
      if (tabs[j].href.split("/").pop().replace(/\.html$/, "") === file) return tabs[j].key;
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
    var old = document.querySelectorAll(".mobile-bottom-nav, .approver-bottom-nav, #pvtTabbar");
    for (var i = 0; i < old.length; i++) old[i].remove();

    var nav = document.createElement("nav");
    nav.id = "pvtTabbar";
    nav.className = "pvt-tabbar";
    nav.setAttribute("aria-label", "เมนูหลัก");
    nav.innerHTML = getTabs().map(function (t) { return tabHtml(t, t.key === active); }).join("");

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


  /* ==========================================================================
     เมนูข้างบนมือถือ (Drawer) — ชุดเดียวใช้ทุกหน้าที่มีแถบล่าง
     - ไม่มีปุ่ม "ยื่นใบลาออนไลน์" และไม่ซ้ำกับเมนูในแถบล่าง
       (หน้าหลัก / ประวัติลา / ยื่นใบลา / วันหยุด / โปรไฟล์ อยู่ในแถบล่างแล้ว)
     - แก้รายการเมนูที่ DRAWER_SECTIONS ที่เดียว มีผลทุกหน้า
     - จอคอม (> 1024px) ยังใช้เมนูข้างเดิมของแต่ละหน้า
     ========================================================================== */
  var DRAWER_SECTIONS = [
    {
      title: "หัวหน้างาน", approverOnly: true, items: [
        { key: "approve", icon: "fact_check", label: "อนุมัติใบลา", href: "/pages/approver/leave-approvals.html" },
        { key: "stats",   icon: "analytics",  label: "สถิติวันลา",  href: "/pages/user/leave-stats.html" }
      ]
    },
    {
      title: "บริการ", items: [
        { key: "card",  icon: "badge",        label: "บัตรพนักงาน",      fn: "viewMyDigitalCard",     fallback: "/pages/user/index-user.html?action=digital_card" },
        { key: "line",  icon: "chat",         label: "เชื่อมต่อ LINE",    fn: "generateLineLinkToken", fallback: "/pages/user/index-user.html?action=line_link" },
        { key: "rules", icon: "gavel",        label: "กฎระเบียบการลา",   href: "/pages/user/leave-rules.html" },
        { key: "news",  icon: "campaign",     label: "ข่าวสาร",          href: "/pages/user/news.html" }
      ]
    },
    {
      title: "ระบบ", items: [
        { key: "settings", icon: "settings", label: "ตั้งค่า", fn: "openSystemSettingsModal" }
      ]
    }
  ];

  var MOBILE_MAX = 1024;
  var drawerEl = null;
  var lastFocus = null;

  function isMobileWidth() { return window.innerWidth <= MOBILE_MAX; }

  function escapeHtml(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function getSessionUser() {
    try { return JSON.parse(localStorage.getItem("currentUser") || "null") || {}; } catch (e) { return {}; }
  }

  // ใช้เกณฑ์เดียวกับ early-auth-guard.js: ถ้าไม่ใช่หัวหน้างาน จะมี style #pvt-approval-nav-visibility ซ่อนเมนูอนุมัติไว้
  function canApprove() {
    if (isApproverPortal()) return true;
    if (document.getElementById("pvt-approval-nav-visibility")) return false;
    if (typeof window.getUserRoleCategory === "function") {
      try {
        var cat = window.getUserRoleCategory(getSessionUser()).category;
        return cat === "leader_manager";
      } catch (e) {}
    }
    return false;
  }

  function currentPath() { return location.pathname.replace(/\/+$/, ""); }

  function drawerItemHtml(item) {
    var active = item.href && currentPath().endsWith(item.href);
    var inner =
      '<span class="pvt-drawer__icon material-symbols-outlined" aria-hidden="true">' + item.icon + "</span>" +
      '<span class="pvt-drawer__label">' + escapeHtml(item.label) + "</span>" +
      '<span class="pvt-drawer__chev material-symbols-outlined" aria-hidden="true">chevron_right</span>';
    if (item.href) {
      return '<a class="pvt-drawer__item' + (active ? " is-active" : "") + '" href="' + item.href + '"' +
        (active ? ' aria-current="page"' : "") + ' data-key="' + item.key + '">' + inner + "</a>";
    }
    return '<button type="button" class="pvt-drawer__item" data-key="' + item.key + '">' + inner + "</button>";
  }

  function buildDrawer() {
    var u = getSessionUser();
    var name = u.full_name || u.name || "ผู้ใช้งาน";
    var sub = [u.employee_code, u.position_name || (u.positions && u.positions.position_name) || u.department_name]
      .filter(Boolean).join(" · ");
    var initial = String(name).trim().charAt(0) || "?";
    var approver = canApprove();

    var sections = DRAWER_SECTIONS.filter(function (sec) { return !sec.approverOnly || approver; })
      .map(function (sec) {
        return '<div class="pvt-drawer__section"><div class="pvt-drawer__title">' + escapeHtml(sec.title) + "</div>" +
          sec.items.filter(function (it) {
            // เมนูเชื่อมต่อ LINE: เฉพาะผู้มีสิทธิ์ (PVTLine ใน auth-guard.js ใส่ class pvt-line-allowed)
            return it.key !== "line" || root.classList.contains("pvt-line-allowed");
          }).map(drawerItemHtml).join("") + "</div>";
      }).join("");

    var wrap = document.createElement("div");
    wrap.id = "pvtDrawer";
    wrap.className = "pvt-drawer";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML =
      '<div class="pvt-drawer__backdrop" data-close="1"></div>' +
      // ใช้ <div> ไม่ใช่ <aside> เพราะ CSS เดิมของบางหน้าเล็ง aside ทุกตัว (ซ่อนไว้นอกจอ) จะทับแผงนี้
      '<div class="pvt-drawer__panel" role="dialog" aria-modal="true" aria-label="เมนู" tabindex="-1">' +
        '<div class="pvt-drawer__head">' +
          '<div class="pvt-drawer__brand"><img src="/assets/icons/PVTT_LEAVE.png" alt="" width="32" height="32" />' +
            "<span>PVTT WORKFORCE HUB</span></div>" +
          '<button type="button" class="pvt-drawer__close" data-close="1" aria-label="ปิดเมนู">' +
            '<span class="material-symbols-outlined" aria-hidden="true">close</span></button>' +
        "</div>" +
        '<a class="pvt-drawer__user" href="/pages/user/profile-user.html">' +
          '<span class="pvt-drawer__avatar" aria-hidden="true">' + escapeHtml(initial) + "</span>" +
          '<span class="pvt-drawer__who"><strong>' + escapeHtml(name) + "</strong>" +
          (sub ? "<small>" + escapeHtml(sub) + "</small>" : "") + "</span>" +
        "</a>" +
        '<nav class="pvt-drawer__nav" aria-label="เมนูเพิ่มเติม">' + sections + "</nav>" +
        '<div class="pvt-drawer__foot">' +
          '<button type="button" class="pvt-drawer__logout" data-key="logout">' +
            '<span class="material-symbols-outlined" aria-hidden="true">logout</span><span>ออกจากระบบ</span></button>' +
        "</div>" +
      "</div>";

    wrap.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { closeDrawer(); return; }
      var btn = e.target.closest("[data-key]");
      if (!btn) return;
      var key = btn.getAttribute("data-key");
      if (key === "logout") { closeDrawer(); runLogout(e); return; }
      var item = findItem(key);
      if (!item || item.href) { closeDrawer(); return; } // ลิงก์ปกติ: ปล่อยให้เบราว์เซอร์เปิดหน้า
      closeDrawer();
      if (item.fn && typeof window[item.fn] === "function") {
        setTimeout(function () { window[item.fn](); }, 180);
      } else if (item.fallback) {
        location.href = item.fallback;
      }
    });
    return wrap;
  }

  function findItem(key) {
    for (var i = 0; i < DRAWER_SECTIONS.length; i++) {
      for (var j = 0; j < DRAWER_SECTIONS[i].items.length; j++) {
        if (DRAWER_SECTIONS[i].items[j].key === key) return DRAWER_SECTIONS[i].items[j];
      }
    }
    return null;
  }

  function runLogout(e) {
    if (typeof window.handleLogout === "function") return window.handleLogout(e);
    if (typeof window.logout === "function") return window.logout(e);
    if (typeof window.executePvtLogout === "function") return window.executePvtLogout();
    try { sessionStorage.setItem("pvt_explicit_logout", "true"); localStorage.clear(); } catch (err) {}
    location.replace("/index.html?logout=true");
  }

  function onDrawerKey(e) {
    if (e.key === "Escape") closeDrawer();
  }

  function openDrawer() {
    // สร้างใหม่ทุกครั้ง เพื่อให้ชื่อผู้ใช้/สิทธิ์ล่าสุด (auth-guard อาจอัปเดต session หลังโหลดหน้า)
    if (drawerEl) drawerEl.remove();
    drawerEl = buildDrawer();
    document.body.appendChild(drawerEl);
    lastFocus = document.activeElement;
    // บังคับ reflow ก่อนใส่คลาส เพื่อให้ animation เลื่อนเข้าทำงาน
    void drawerEl.offsetWidth;
    drawerEl.classList.add("is-open");
    drawerEl.setAttribute("aria-hidden", "false");
    root.classList.add("pvt-drawer-open");
    document.addEventListener("keydown", onDrawerKey);
    var panel = drawerEl.querySelector(".pvt-drawer__panel");
    if (panel) panel.focus({ preventScroll: true });
  }

  function closeDrawer() {
    if (!drawerEl || !drawerEl.classList.contains("is-open")) return;
    drawerEl.classList.remove("is-open");
    drawerEl.setAttribute("aria-hidden", "true");
    root.classList.remove("pvt-drawer-open");
    document.removeEventListener("keydown", onDrawerKey);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }

  function toggleDrawer() {
    if (drawerEl && drawerEl.classList.contains("is-open")) closeDrawer(); else openDrawer();
  }

  // ปุ่มเปิดเมนูของทุกหน้า (☰ / ⋮) → บนมือถือให้เปิด Drawer ชุดนี้แทนเมนูข้างเดิมของหน้า
  var MENU_BUTTONS = ".mobile-menu-btn, #mobileMenuBtn, .approvals-menu-btn, .approver-menu-btn";

  function interceptMenuButtons() {
    document.addEventListener("click", function (e) {
      if (!isMobileWidth()) return;
      var btn = e.target.closest && e.target.closest(MENU_BUTTONS);
      if (!btn || (drawerEl && drawerEl.contains(btn))) return;
      // หยุดก่อนถึง onclick เดิมของปุ่ม (ซึ่งจะเปิดเมนูข้างเก่า)
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      toggleDrawer();
    }, true);

    // โค้ดเดิมที่เรียก toggleMobileSidebar()/openMobileSidebar() ตรง ๆ → บนมือถือใช้ Drawer
    function wrap(name, action) {
      var orig = window[name];
      if (typeof orig !== "function" || orig.__pvtDrawer) return;
      var wrapped = function (arg) {
        if (!isMobileWidth()) return orig.apply(this, arguments);
        if (action === "close" || arg === false) return closeDrawer();
        if (action === "open") return openDrawer();
        return toggleDrawer();
      };
      wrapped.__pvtDrawer = true;
      window[name] = wrapped;
    }
    function wrapAll() {
      wrap("toggleMobileSidebar", "toggle");
      wrap("openMobileSidebar", "open");
      wrap("closeMobileSidebar", "close");
    }
    wrapAll();
    window.addEventListener("load", wrapAll);
    setTimeout(wrapAll, 1500); // เผื่อสคริปต์ของหน้าประกาศฟังก์ชันทับทีหลัง

    window.addEventListener("resize", function () { if (!isMobileWidth()) closeDrawer(); });
  }


  /* ======================================================================
     📲 ความรู้สึกแบบแอป: ดึงลงรีเฟรช · สั่นตอบสนอง · Bottom sheet ปัดลงปิด
                         · ปุ่มแชทหลบตอนเลื่อน · ชวนติดตั้งแอป
     ====================================================================== */
  var reduceMotion = function () {
    return root.getAttribute("data-reduced-motion") === "true" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  };

  // สั่นเบา ๆ (Android; iPhone ไม่รองรับการสั่นจากเว็บ → เงียบ ๆ ไม่มีผล)
  function haptic(pattern) {
    try { if (navigator.vibrate && isMobileWidth()) navigator.vibrate(pattern || 10); } catch (e) {}
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }

  function anOverlayIsOpen() {
    if (root.classList.contains("pvt-user-boot") || root.classList.contains("pvt-drawer-open") || document.body.classList.contains("swal2-shown") ||
        document.body.classList.contains("hr-chat-open")) return true;
    var overlays = document.querySelectorAll(".holiday-modal-overlay, .pvt-modal-overlay, #hrChatbotModal, .notif-dropdown, .flatpickr-calendar.open");
    for (var i = 0; i < overlays.length; i++) {
      var o = overlays[i];
      if (o.classList.contains("flatpickr-calendar")) return true;
      var cs = getComputedStyle(o);
      if (cs.display !== "none" && cs.visibility !== "hidden" && o.getClientRects().length) return true;
    }
    return false;
  }

  function scrolledAwayFromTop(el) {
    var se = document.scrollingElement || document.documentElement;
    if (se.scrollTop > 0 || window.scrollY > 0) return true;
    for (var n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      if (n.scrollTop > 0) {
        var oy = getComputedStyle(n).overflowY;
        if (oy === "auto" || oy === "scroll") return true;
      }
    }
    return false;
  }

  /* --- ดึงลงเพื่อรีเฟรช ---------------------------------------------- */
  var PTR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>';

  function defaultRefresh() {
    // หน้าแรกมีฟังก์ชันโหลดข้อมูลใหม่โดยไม่ต้องรีโหลดหน้า
    if (typeof window.refreshUserData === "function") {
      try { return Promise.resolve(window.refreshUserData()); } catch (e) { return Promise.resolve(); }
    }
    location.reload();
    return new Promise(function () {});
  }

  function setupPullToRefresh() {
    // หน้ายื่นใบลามีแบบฟอร์ม → ไม่ใช้ (กันข้อมูลที่กรอกไว้หาย)
    if (document.body.getAttribute("data-pvt-ptr") === "off" || /\/leave-user\.html$/.test(location.pathname)) return;

    var ind = document.createElement("div");
    ind.className = "pvt-ptr";
    ind.setAttribute("aria-hidden", "true");
    ind.innerHTML = PTR_SVG;
    document.body.appendChild(ind);

    var THRESHOLD = 72, MAX = 120;
    var startY = 0, startX = 0, pulling = false, armed = false, dist = 0, busy = false;

    function paint(d) {
      var p = Math.min(d / THRESHOLD, 1);
      ind.style.translate = "0 " + (Math.min(d, MAX) - 56) + "px";
      ind.style.opacity = String(Math.min(1, p * 1.2));
      ind.querySelector("svg").style.transform = "rotate(" + Math.round(p * 270) + "deg)";
      var ready = d >= THRESHOLD;
      if (ready !== armed) { armed = ready; ind.classList.toggle("is-ready", ready); if (ready) haptic(8); }
    }
    function reset() {
      ind.classList.add("is-animating");
      ind.classList.remove("is-ready", "is-loading");
      ind.style.translate = ""; ind.style.opacity = "";
      setTimeout(function () { ind.classList.remove("is-animating"); }, 260);
    }

    document.addEventListener("touchstart", function (e) {
      if (busy || !isMobileWidth() || e.touches.length !== 1) return;
      var t = e.target;
      if (t.closest && t.closest("input, textarea, select, [contenteditable], .pvt-tabbar, .swal2-container")) return;
      if (scrolledAwayFromTop(t) || anOverlayIsOpen()) return;
      startY = e.touches[0].clientY; startX = e.touches[0].clientX;
      pulling = true; armed = false; dist = 0;
    }, { passive: true });

    document.addEventListener("touchmove", function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY, dx = Math.abs(e.touches[0].clientX - startX);
      if (dy <= 0 || dx > dy) { if (dist === 0 && (dy < -4 || dx > 10)) pulling = false; if (dist) { dist = 0; paint(0); } return; }
      if (scrolledAwayFromTop(e.target)) { pulling = false; reset(); return; }
      dist = dy * 0.5; // แรงต้านแบบแอป
      paint(dist);
    }, { passive: true });

    function end() {
      if (!pulling) return;
      pulling = false;
      if (dist >= THRESHOLD) {
        busy = true; haptic(12);
        ind.classList.add("is-animating", "is-loading", "is-ready");
        ind.style.translate = "0 " + (THRESHOLD - 50) + "px"; ind.style.opacity = "1";
        var fn = (window.PVTShell && typeof window.PVTShell.onRefresh === "function") ? window.PVTShell.onRefresh : defaultRefresh;
        var done = function () { busy = false; reset(); };
        var minWait = new Promise(function (r) { setTimeout(r, 600); });
        Promise.all([Promise.resolve().then(fn).catch(function () {}), minWait]).then(done, done);
      } else if (dist > 0) {
        reset();
      }
      dist = 0;
    }
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
  }

  /* --- ปุ่มแชทลอยหลบตอนเลื่อนลง ---------------------------------------- */
  function setupFabAutoHide() {
    var lastY = window.scrollY, ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY, d = y - lastY;
        if (Math.abs(d) > 6) {
          document.body.classList.toggle("pvt-fab-hidden", d > 0 && y > 80);
          lastY = y;
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* --- Bottom sheet: ปัดลงเพื่อปิด + สั่นตอนสำเร็จ/ผิดพลาด -------------- */
  var CLOSE_SEL = ".swal2-close, .swal2-cancel, .modal-close, .close-btn, .btn-close, .btn-close-modal, " +
    "[aria-label^='ปิด'], [title^='ปิด'], button[onclick*='close' i]";

  function visibleCloseButton(sheet, scope) {
    var list = (scope || sheet).querySelectorAll(CLOSE_SEL);
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.getClientRects().length && getComputedStyle(b).display !== "none" && !b.disabled) return b;
    }
    return null;
  }

  function makeSwipeable(sheet, scope) {
    if (!sheet || sheet.__pvtSwipe) return;
    sheet.__pvtSwipe = true;
    sheet.classList.add("pvt-sheet-card");
    var y0 = 0, dy = 0, t0 = 0, active = false;
    sheet.addEventListener("touchstart", function (e) {
      if (!isMobileWidth() || e.touches.length !== 1 || window.innerWidth > 640) return;
      if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (sheet.scrollTop > 0) return;
      if (window.Swal && sheet.classList.contains("swal2-popup") && Swal.isLoading && Swal.isLoading()) return;
      if (!visibleCloseButton(sheet, scope)) return; // ป๊อปอัปที่ต้องเลือกตอบ (ไม่มีปุ่มปิด/ยกเลิก) ปัดปิดไม่ได้
      y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; active = true;
    }, { passive: true });
    sheet.addEventListener("touchmove", function (e) {
      if (!active) return;
      dy = e.touches[0].clientY - y0;
      if (dy <= 0) { sheet.style.transform = ""; return; }
      if (sheet.scrollTop > 0) { active = false; sheet.style.transform = ""; return; }
      sheet.classList.add("pvt-sheet-dragging");
      sheet.style.transform = "translateY(" + dy + "px)";
    }, { passive: true });
    function end() {
      if (!active) return;
      active = false;
      sheet.classList.remove("pvt-sheet-dragging");
      var fast = dy > 40 && (dy / Math.max(1, Date.now() - t0)) > 0.6;
      if (dy > 110 || fast) {
        var btn = visibleCloseButton(sheet, scope);
        sheet.style.transition = "transform 0.18s ease-in";
        sheet.style.transform = "translateY(100%)";
        haptic(8);
        setTimeout(function () {
          sheet.style.transition = ""; sheet.style.transform = "";
          if (btn) btn.click();
        }, 170);
      } else {
        sheet.style.transition = "transform 0.2s ease";
        sheet.style.transform = "";
        setTimeout(function () { sheet.style.transition = ""; }, 220);
      }
    }
    sheet.addEventListener("touchend", end, { passive: true });
    sheet.addEventListener("touchcancel", end, { passive: true });
  }

  function watchSheets() {
    var seenIcon = new WeakSet();
    function scan() {
      var pop = document.querySelector(".swal2-container.swal2-center > .swal2-popup:not(.swal2-toast)");
      if (pop) {
        makeSwipeable(pop);
        var icon = pop.querySelector(".swal2-icon.swal2-success, .swal2-icon.swal2-error");
        if (icon && !seenIcon.has(icon) && getComputedStyle(icon).display !== "none") {
          seenIcon.add(icon);
          haptic(icon.classList.contains("swal2-success") ? [12, 60, 18] : [40, 50, 40]);
        }
      }
      var cards = document.querySelectorAll(".holiday-modal-overlay > .holiday-modal-card, #visualTimelineModal > .pvt-modal-card, #leavePreviewModal > .pvt-modal-card");
      for (var i = 0; i < cards.length; i++) makeSwipeable(cards[i], cards[i].parentElement);
    }
    scan();
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () { pending = false; scan(); });
    }).observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
    // หน้าต่างของหน้าเอง (มีอยู่แล้วใน HTML) อาจถูกสร้างช้ากว่า
    setTimeout(scan, 1500);
  }

  /* --- ชวนติดตั้งแอป (Add to Home Screen) ------------------------------ */
  var INSTALL_KEY = "pvt_install_prompt_dismissed_at";
  function installDismissedRecently() {
    try { var t = +localStorage.getItem(INSTALL_KEY) || 0; return Date.now() - t < 14 * 864e5; } catch (e) { return true; }
  }
  function showInstallBanner(kind, deferred) {
    if (document.getElementById("pvtInstall") || isStandalone() || installDismissedRecently() || !isMobileWidth()) return;
    var bar = document.createElement("div");
    bar.id = "pvtInstall";
    bar.className = "pvt-install";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "ติดตั้งแอป");
    var shareIcon = '<svg class="pvt-ios-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>';
    bar.innerHTML = '<img src="/assets/icons/icon-192.png" alt="" />' +
      '<div class="pvt-install__text"><strong>ติดตั้งแอปบนหน้าจอโฮม</strong>' +
      (kind === "ios"
        ? "<small>แตะ " + shareIcon + " แชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”</small></div>"
        : "<small>เปิดเร็วขึ้น เต็มจอเหมือนแอป</small></div>" +
          '<button type="button" class="pvt-install__btn">ติดตั้ง</button>') +
      '<button type="button" class="pvt-install__close" aria-label="ปิด">×</button>';
    function close(remember) {
      if (remember) { try { localStorage.setItem(INSTALL_KEY, String(Date.now())); } catch (e) {} }
      bar.remove();
    }
    bar.querySelector(".pvt-install__close").addEventListener("click", function () { close(true); });
    var btn = bar.querySelector(".pvt-install__btn");
    if (btn && deferred) {
      btn.addEventListener("click", function () {
        deferred.prompt();
        (deferred.userChoice || Promise.resolve()).then(function () { close(true); });
      });
    }
    document.body.appendChild(bar);
  }
  function setupInstallPrompt() {
    if (isStandalone()) { root.classList.add("pvt-standalone"); return; }
    // แสดงเฉพาะหน้าแรก เพื่อไม่รบกวนตอนทำงานหน้าอื่น
    var onHome = /\/index-user\.html$/.test(location.pathname);
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      if (onHome) setTimeout(function () { showInstallBanner("android", e); }, 2500);
    });
    var ua = navigator.userAgent || "";
    var isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|line\//i.test(ua);
    if (onHome && isIOS && isSafari) setTimeout(function () { showInstallBanner("ios"); }, 3000);
  }


  /* --- หน้าโปรไฟล์: ปุ่ม "ตั้งค่า" + "ออกจากระบบ" ท้ายหน้า (แบบแอป) ---------- */
  function addProfileActions() {
    if (!/\/profile-user\.html$/.test(location.pathname) || document.getElementById("pvtProfileActions")) return;
    var host = document.querySelector(".main-content .app");
    if (!host) return;
    var box = document.createElement("section");
    box.id = "pvtProfileActions";
    box.className = "pvt-profile-actions";
    box.innerHTML =
      '<button type="button" data-act="settings"><span class="material-symbols-outlined" aria-hidden="true">settings</span><span>ตั้งค่า</span><span class="material-symbols-outlined pvt-chev" aria-hidden="true">chevron_right</span></button>' +
      '<button type="button" data-act="logout" class="is-danger"><span class="material-symbols-outlined" aria-hidden="true">logout</span><span>ออกจากระบบ</span></button>';
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.getAttribute("data-act") === "logout") runLogout(e);
      else if (typeof window.openSystemSettingsModal === "function") window.openSystemSettingsModal();
    });
    host.appendChild(box);
  }

  function initAppFeel() {
    setupPullToRefresh();
    setupFabAutoHide();
    watchSheets();
    setupInstallPrompt();
    addProfileActions();
    // สั่นเบา ๆ ตอนแตะแถบล่าง
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".pvt-tab")) haptic(8);
    }, true);
  }

  function init() {
    renderTabbar();
    watchKeyboard();
    enhanceAppbars();
    interceptMenuButtons();
    document.body.classList.add("pvt-has-drawer");
    initAppFeel();
  }

  window.PVTShell = {
    tabs: TABS,
    setBadge: setBadge,
    refresh: renderTabbar,
    drawer: DRAWER_SECTIONS,
    openMenu: openDrawer,
    closeMenu: closeDrawer,
    haptic: haptic,
    // ตั้งเองได้ต่อหน้า: PVTShell.onRefresh = () => loadData();  (คืน Promise ได้)
    onRefresh: null
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();