/* ==========================================================================
   FILE   : /js/layout.js
   PURPOSE: พฤติกรรมของ Sidebar + Topbar (ไม่ผูกกับ Supabase/ระบบ login ใดๆ)

   หน้าที่:
     1) พับ/กาง Sidebar บน PC และ "จำสถานะ" ไว้ใน localStorage
     2) เปิด/ปิดลิ้นชักเมนูบนมือถือ (ปุ่ม ☰, ปุ่ม X, แตะฉากมืด, กด Esc, กดเลือกเมนู)
     3) ไฮไลต์เมนูของหน้าปัจจุบันให้อัตโนมัติจาก URL
     4) ปุ่มออกจากระบบ (เรียกฟังก์ชันเดิมของระบบถ้ามี ไม่มีก็ใช้วิธีสำรอง)
     5) เปิด API กลางให้โค้ดอื่นเรียก:  window.PVTLayout.*

   วิธีโหลด (ท้าย <body> ของทุกหน้า — ไม่ต้องใส่ type="module"):
       <script src="/js/layout.js"></script>

   API ที่เรียกใช้ได้จากไฟล์ JS ของแต่ละหน้า:
       PVTLayout.setUser({ name, roleDept, avatarUrl, initials })   // ใส่ข้อมูลผู้ใช้ที่มุมขวาบน
       PVTLayout.setPageTitle(title, subtitle)                      // เปลี่ยนชื่อหน้าบนแถบหัว
       PVTLayout.setNavBadge('sidebarSlaPendingBadge', 5)           // ตั้งตัวเลขแจ้งเตือนข้างเมนู (0 = ซ่อน)
       PVTLayout.toggleSidebar() / openMobile() / closeMobile()     // สั่งพับ/เปิด/ปิดเมนูด้วยโค้ด

   ชื่อฟังก์ชันเดิม (toggleMobileSidebar / closeMobileSidebar) ยังใช้ได้ เพื่อไม่ให้โค้ดเก่าพัง
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     0) ค่าคงที่
     ------------------------------------------------------------------ */
  var STORAGE_KEY = 'pvt_sidebar_collapsed';              // คีย์ที่ใช้จำสถานะพับ ('1' = พับ)
  var MOBILE_QUERY = '(max-width: 1024px)';               // ต้องตรงกับ breakpoint ใน CSS
  var TRANSITION_MS = 320;                                // เวลารอให้แอนิเมชันเสร็จ (ms)

  /* ------------------------------------------------------------------
     1) ตัวช่วยเล็กๆ
     ------------------------------------------------------------------ */
  function $(selector, root) { return (root || document).querySelector(selector); }
  function $all(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  // localStorage อาจใช้ไม่ได้ (โหมดส่วนตัว/ถูกบล็อก) → ครอบ try/catch ไว้เสมอ
  function storageGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function storageSet(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* ข้าม */ } }

  function isMobile() { return window.matchMedia(MOBILE_QUERY).matches; }

  /* ------------------------------------------------------------------
     2) อ้างอิง element หลัก (หาครั้งเดียวตอน init)
     ------------------------------------------------------------------ */
  var app, sidebar, toggleBtn, burgerBtn, closeBtn, overlay;

  /* ------------------------------------------------------------------
     3) พับ / กาง Sidebar (PC)
     ------------------------------------------------------------------ */
  function setCollapsed(collapsed, persist) {
    app.classList.toggle('is-sidebar-collapsed', collapsed);

    // อัปเดตข้อความสำหรับโปรแกรมอ่านหน้าจอ + tooltip ของปุ่ม
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(!collapsed));
      toggleBtn.title = collapsed ? 'ขยายเมนู' : 'ย่อเมนู';
    }
    if (persist) storageSet(STORAGE_KEY, collapsed ? '1' : '0');

    // กราฟ (Chart.js / Recharts) ฟังเหตุการณ์ resize ของหน้าต่าง
    // พื้นที่เนื้อหากว้างขึ้น/แคบลงหลังแอนิเมชัน → สั่ง resize ให้กราฟปรับขนาดตาม
    window.setTimeout(function () { window.dispatchEvent(new Event('resize')); }, TRANSITION_MS);
  }

  function toggleSidebar() { setCollapsed(!app.classList.contains('is-sidebar-collapsed'), true); }

  /* ------------------------------------------------------------------
     4) ลิ้นชักเมนูบนมือถือ
     ------------------------------------------------------------------ */
  function openMobile() {
    app.classList.add('is-mobile-open');
    document.body.style.overflow = 'hidden';               // ล็อกไม่ให้หน้าเบื้องหลังเลื่อน
    if (burgerBtn) burgerBtn.setAttribute('aria-expanded', 'true');
  }
  function closeMobile() {
    app.classList.remove('is-mobile-open');
    document.body.style.overflow = '';
    if (burgerBtn) burgerBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleMobile() {
    if (app.classList.contains('is-mobile-open')) closeMobile(); else openMobile();
  }

  /* ------------------------------------------------------------------
     5) ไฮไลต์เมนูของหน้าปัจจุบัน
        เทียบ pathname ของลิงก์กับ URL ปัจจุบัน ถ้าตรงจะใส่ .active + aria-current
        ถ้าไม่มีลิงก์ไหนตรงเลย จะคงค่า .active ที่เขียนไว้ใน HTML ไว้ตามเดิม
        เคล็ดลับ: ใส่ data-match="prefix" ที่ลิงก์ เพื่อให้หน้าย่อยก็ไฮไลต์เมนูแม่ด้วย
                  เช่น /pages/hr/news-management.html กับ /pages/hr/news-edit.html
     ------------------------------------------------------------------ */
  function highlightActiveNav() {
    // Cloudflare Pages ตัด .html ออกจากลิงก์ → เทียบแบบไม่สน .html
    var current = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    var items = $all('.pvt-nav__item[href]', sidebar);
    var matched = null;

    items.forEach(function (a) {
      var path = a.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
      var isPrefix = a.getAttribute('data-match') === 'prefix';
      if (path === current || (isPrefix && current.indexOf(path) === 0)) matched = a;
    });

    if (!matched) return;
    items.forEach(function (a) { a.classList.remove('active'); a.removeAttribute('aria-current'); });
    matched.classList.add('active');
    matched.setAttribute('aria-current', 'page');
  }

  /* ------------------------------------------------------------------
     6) ออกจากระบบ
        ลำดับ: handleLogout → logout → executePvtLogout (ฟังก์ชันเดิมของระบบ)
        ถ้าไม่มีเลย ใช้วิธีสำรอง: ล้าง storage แล้วกลับหน้า login
     ------------------------------------------------------------------ */
  function doLogout(event) {
    if (event) event.preventDefault();
    if (typeof window.handleLogout === 'function') return window.handleLogout(event);
    if (typeof window.logout === 'function') return window.logout(event);
    if (typeof window.executePvtLogout === 'function') return window.executePvtLogout();

    try {
      sessionStorage.setItem('pvt_explicit_logout', 'true');
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) { /* ข้าม */ }
    window.location.replace('/index.html?logout=true');
  }

  /* ------------------------------------------------------------------
     7) API: ใส่ข้อมูลผู้ใช้ที่มุมขวาบน
        opts = { name, roleDept, avatarUrl, initials }
        • ไม่ส่ง avatarUrl หรือโหลดรูปไม่ได้ → แสดงตัวอักษรย่อ (initials) แทน
     ------------------------------------------------------------------ */
  function setUser(opts) {
    opts = opts || {};
    var nameEl = $('#headerUserName');
    var roleEl = $('#headerUserRoleDept');
    var avatarEl = $('#headerUserAvatar');

    if (nameEl && opts.name) nameEl.textContent = opts.name;
    if (roleEl && opts.roleDept) roleEl.textContent = opts.roleDept;

    if (avatarEl) {
      var initials = opts.initials ||
        (opts.name ? String(opts.name).replace(/^(คุณ|นาย|นางสาว|นาง)\s*/, '').trim().slice(0, 2).toUpperCase() : 'HR');

      avatarEl.textContent = initials;                      // เริ่มจากตัวอักษรย่อก่อนเสมอ
      if (opts.avatarUrl) {
        var img = new Image();
        img.alt = opts.name || '';
        img.onload = function () { avatarEl.textContent = ''; avatarEl.appendChild(img); };   // โหลดสำเร็จจึงสลับเป็นรูป
        img.src = opts.avatarUrl;                           // โหลดไม่สำเร็จ → คงตัวอักษรย่อไว้
      }
    }
  }

  /* ------------------------------------------------------------------
     8) API: เปลี่ยนชื่อหน้าบนแถบหัว (และชื่อแท็บของเบราว์เซอร์)
     ------------------------------------------------------------------ */
  function setPageTitle(title, subtitle) {
    var h1 = $('.pvt-topbar__title h1');
    var p = $('.pvt-topbar__title p');
    if (h1 && title) h1.textContent = title;
    if (p && typeof subtitle === 'string') p.textContent = subtitle;
    if (title) document.title = title + ' | PVT System';
  }

  /* ------------------------------------------------------------------
     9) API: ตั้งตัวเลขแจ้งเตือนข้างเมนู (count <= 0 = ซ่อน)
     ------------------------------------------------------------------ */
  function setNavBadge(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    var n = Number(count) || 0;
    el.textContent = n > 99 ? '99+' : String(n);
    el.style.display = n > 0 ? '' : 'none';
  }

  /* ------------------------------------------------------------------
     9.5) เมนูเสริมใน Sidebar
          - "ตั้งค่า" (ธีมสี ขนาดตัวอักษร โหมดสบายตา ฯลฯ) ท้ายรายการเมนูทุกหน้า
          - "สายอนุมัติ" ในหน้า HR (ถ้าหน้านั้นยังไม่มีลิงก์)
     ------------------------------------------------------------------ */
  var settingsLoading = null;
  function openSettings() {
    if (isMobile()) closeMobile();
    if (typeof window.openSystemSettingsModal === 'function') { window.openSystemSettingsModal(); return; }
    // หน้าที่ยังไม่ได้โหลดตัวตั้งค่า → โหลดเมื่อกดครั้งแรก
    if (!settingsLoading) {
      settingsLoading = import('/js/system-settings.js').catch(function (err) {
        settingsLoading = null;
        console.warn('[layout.js] โหลดหน้าต่างตั้งค่าไม่สำเร็จ', err);
      });
    }
    settingsLoading.then(function () {
      if (typeof window.openSystemSettingsModal === 'function') window.openSystemSettingsModal();
    });
  }

  function navItemHtml(icon, label) {
    return '<span class="material-symbols-outlined">' + icon + '</span><span class="pvt-nav__label">' + label + '</span>';
  }

  function addExtraNavItems() {
    var nav = $('.pvt-sidebar__nav', sidebar);
    if (!nav) return;

    if (/\/pages\/hr\//.test(window.location.pathname) && !$('a[href="/pages/hr/approval-chains.html"]', nav)) {
      var chains = document.createElement('a');
      chains.href = '/pages/hr/approval-chains.html';
      chains.className = 'pvt-nav__item';
      chains.title = 'สายอนุมัติใบลา';
      chains.innerHTML = navItemHtml('account_tree', 'สายอนุมัติ');
      var after = $('a[href="/pages/hr/management.html"]', nav);
      if (after && after.nextSibling) nav.insertBefore(chains, after.nextSibling); else nav.appendChild(chains);
    }

    // เมนู "ตั้งค่า": หน้า HR ใส่ไว้ใน HTML แล้ว (ไม่หายแม้ JS โหลดช้า) — ถ้ายังไม่มีค่อยเติมให้
    var btn = $('#pvtNavSettings', nav);
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'pvtNavSettings';
      btn.className = 'pvt-nav__item pvt-nav__item--settings';
      btn.title = 'ตั้งค่า (ธีมสี ขนาดตัวอักษร การแสดงผล)';
      btn.innerHTML = navItemHtml('settings', 'ตั้งค่า');
      nav.appendChild(btn);
    }
    if (!btn.dataset.bound) { btn.dataset.bound = '1'; btn.addEventListener('click', openSettings); }
  }

  /* ------------------------------------------------------------------
     10) เริ่มทำงาน
     ------------------------------------------------------------------ */
  function init() {
    app = $('.pvt-app');
    sidebar = $('.pvt-sidebar');
    if (!app || !sidebar) { console.warn('[layout.js] ไม่พบ .pvt-app หรือ .pvt-sidebar'); return; }

    toggleBtn = $('.pvt-sidebar__toggle', sidebar);
    closeBtn = $('.pvt-sidebar__close', sidebar);
    burgerBtn = $('.pvt-topbar__burger');
    overlay = $('.pvt-overlay');

    // 10.1 คืนสถานะพับที่จำไว้ (ทำก่อนเติม .is-ready เพื่อไม่ให้เห็นแอนิเมชันตอนโหลดหน้า)
    setCollapsed(storageGet(STORAGE_KEY) === '1', false);

    // 10.2 ผูกปุ่มต่างๆ
    if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);
    if (burgerBtn) burgerBtn.addEventListener('click', toggleMobile);
    if (closeBtn) closeBtn.addEventListener('click', closeMobile);
    if (overlay) overlay.addEventListener('click', closeMobile);

    addExtraNavItems();

    var logoutBtn = $('#btnSidebarLogout');
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

    // 10.3 เลือกเมนูบนมือถือแล้วให้ลิ้นชักปิดเอง
    $all('.pvt-nav__item', sidebar).forEach(function (a) {
      a.addEventListener('click', function () { if (isMobile()) closeMobile(); });
    });

    // 10.4 กด Esc ปิดลิ้นชัก
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && app.classList.contains('is-mobile-open')) closeMobile();
    });

    // 10.5 ขยายหน้าต่างจากมือถือ → PC ให้ปิดลิ้นชักและปลดล็อกการเลื่อนหน้า
    window.matchMedia(MOBILE_QUERY).addEventListener('change', function (e) { if (!e.matches) closeMobile(); });

    highlightActiveNav();

    // 10.6 เปิดแอนิเมชันหลังจัดสถานะเสร็จ (รอ 2 เฟรมให้เบราว์เซอร์วาดสถานะเริ่มต้นก่อน)
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { app.classList.add('is-ready'); });
    });
  }

  /* ------------------------------------------------------------------
     11) เปิด API ออกสู่ภายนอก + ชื่อฟังก์ชันเดิมเพื่อความเข้ากันได้ย้อนหลัง
     ------------------------------------------------------------------ */
  window.PVTLayout = {
    setUser: setUser,
    setPageTitle: setPageTitle,
    setNavBadge: setNavBadge,
    toggleSidebar: toggleSidebar,
    openMobile: openMobile,
    closeMobile: closeMobile,
    openSettings: openSettings
  };
  window.toggleMobileSidebar = toggleMobile;   // เดิม: ใช้ใน onclick ของหน้าเก่า
  window.closeMobileSidebar = closeMobile;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
