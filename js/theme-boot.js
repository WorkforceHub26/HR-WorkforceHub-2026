/* ==========================================================================
   🎨 PVT Theme Boot — ใส่ชุดสีธีมให้ทั้งโปรแกรม (โหลดแบบ sync ใน <head> ทุกหน้า)
   --------------------------------------------------------------------------
   CSS ทั้งระบบอ้างสีแบรนด์ผ่านตัวแปร (มีสีเดิมเป็นค่า fallback):
     --th-p-<shade>  กลุ่มสีหลัก   (เดิม teal  #0d9488 …)
     --th-s-<shade>  กลุ่มสีรอง    (เดิม cyan  #0891b2 …)
     --th-b-<shade>  กลุ่มสีน้ำเงิน (เดิม blue  #2563eb … แถบล่าง/ปุ่มหลักฝั่งพนักงาน)
     --th-k-<shade>  กลุ่มสีฟ้า    (เดิม sky   #0284c7 …)
     --th-g-<shade>  สีจุดฟุ้งพื้นหลัง (เดิม emerald #a7f3d0 …)
   และ --th-*-<shade>-rgb (เช่น "13, 148, 136") สำหรับ rgba(…, alpha)
   ธีม "teal" (ค่าเริ่มต้น) = หน้าตาเดิมทุกอย่าง ธีมอื่นจะเปลี่ยนทั้ง 4 กลุ่ม
   ========================================================================== */
(function () {
  var SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
  var P = {
    teal:    ['#f0fdfa', '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e'],
    cyan:    ['#ecfeff', '#cffafe', '#a5f3fc', '#67e8f9', '#22d3ee', '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63', '#083344'],
    blue:    ['#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a', '#172554'],
    sky:     ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e', '#082f49'],
    indigo:  ['#eef2ff', '#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81', '#1e1b4b'],
    violet:  ['#f5f3ff', '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#2e1065'],
    emerald: ['#ecfdf5', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#022c22'],
    orange:  ['#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12', '#431407'],
    rose:    ['#fff1f2', '#ffe4e6', '#fecdd3', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337', '#4c0519']
  };
  // p = หลัก, s = รอง, b = แทนสีน้ำเงิน, k = แทนสีฟ้า
  var MAP = {
    teal:    { p: 'teal',    s: 'cyan',   b: 'blue',    k: 'sky' },
    blue:    { p: 'sky',     s: 'blue',   b: 'blue',    k: 'sky' },
    indigo:  { p: 'indigo',  s: 'violet', b: 'indigo',  k: 'indigo' },
    emerald: { p: 'emerald', s: 'teal',   b: 'emerald', k: 'emerald' },
    coral:   { p: 'orange',  s: 'rose',   b: 'orange',  k: 'orange' }
  };
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255);
  }
  function apply(themeKey) {
    var key = MAP[themeKey] ? themeKey : 'teal';
    var m = MAP[key];
    var root = document.documentElement;
    var s = root.style;
    ['p', 's', 'b', 'k'].forEach(function (f) {
      var pal = P[m[f]];
      SHADES.forEach(function (shade, i) {
        s.setProperty('--th-' + f + '-' + shade, pal[i]);
        s.setProperty('--th-' + f + '-' + shade + '-rgb', rgb(pal[i]));
      });
    });
    // g = สีจุดฟุ้งของพื้นหลัง (เดิมเป็นเขียวมินต์ทุกธีม) → ธีมมินต์คงเขียวเดิม ธีมอื่นใช้สีรองของธีม
    var g = key === 'teal' ? P.emerald : P[m.s];
    SHADES.forEach(function (shade, i) {
      s.setProperty('--th-g-' + shade, g[i]);
      s.setProperty('--th-g-' + shade + '-rgb', rgb(g[i]));
    });
    var p = P[m.p], sc = P[m.s];
    s.setProperty('--primary', p[6]);
    s.setProperty('--primary-dark', p[7]);
    s.setProperty('--primary-hover', p[7]);
    s.setProperty('--primary-soft', p[0]);
    s.setProperty('--primary-light', p[1]);
    s.setProperty('--primary-gradient', 'linear-gradient(135deg, ' + p[6] + ', ' + sc[6] + ')');
    // แถบล่าง/เมนูข้างมือถือ: ใช้ตัวแปรกลุ่ม b เองแล้ว ไม่ต้องตั้ง --pvt-brand แยก
    s.removeProperty('--pvt-brand');
    s.removeProperty('--pvt-brand-soft');
    root.setAttribute('data-theme', key);
    syncMeta(key, p[6]);
    return key;
  }
  function syncMeta(key, color) {
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        if (!meta.hasAttribute('data-default')) meta.setAttribute('data-default', meta.getAttribute('content') || '');
        meta.setAttribute('content', key === 'teal' ? meta.getAttribute('data-default') : color);
      }
    } catch (e) {}
  }
  var saved = 'teal';
  try { saved = localStorage.getItem('pvt_user_theme') || 'teal'; } catch (e) {}
  apply(saved);
  // <meta name="theme-color"> อาจอยู่หลังสคริปต์นี้ → อัปเดตอีกครั้งเมื่อ DOM พร้อม
  document.addEventListener('DOMContentLoaded', function () {
    var k = document.documentElement.getAttribute('data-theme') || 'teal';
    syncMeta(k, P[MAP[k].p][6]);
  });
  window.PVTTheme = { apply: apply, palettes: P, map: MAP };

  // 📦 Service Worker (เปิดแอปเร็วขึ้น + ใช้งานได้ตอนเน็ตหลุด) — ลงทะเบียนทุกหน้า
  if ('serviceWorker' in navigator && window.self === window.top && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () { /* เช่น Live Server ที่ไม่มี /sw.js */ });
    });
  }
  // เปลี่ยนธีมจากอีกแท็บ → อัปเดตหน้านี้ด้วย
  window.addEventListener('storage', function (e) {
    if (e.key === 'pvt_user_theme') apply(e.newValue || 'teal');
  });
})();

/* ==========================================================================
   ✨ PVT App Splash — อนิเมชั่นตอนเปิดเข้าแอป (ครั้งแรกของการเปิดแอป/แท็บ)
   - แสดง 1 ครั้งต่อการเปิดแอป (sessionStorage) · ใช้สีตามธีมที่เลือก
   - ถ้าหน้าแรก redirect ต่อทันที (เช่น login → หน้าหลัก) หน้าถัดไปจะแสดงต่อเนื่องไม่เริ่มใหม่
   - ข้ามเมื่อผู้ใช้ตั้งค่า "ลดการเคลื่อนไหว" / อยู่ใน iframe / หน้า offline / ?nosplash
   ========================================================================== */
(function () {
  try {
    var d = document, root = d.documentElement, now = Date.now();
    var KEY = 'pvt_splash_at', MIN = 1500, MAX = 3200, CONT = 1600;
    if (window.self !== window.top) return;
    if (/offline\.html$|\/offline$/.test(location.pathname)) return;
    if (/[?&]nosplash\b/.test(location.search)) return;
    var reduced = false;
    try { reduced = localStorage.getItem('pvt_reduced_motion') === 'true'; } catch (e) {}
    if (!reduced && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) reduced = true;
    if (reduced) return;

    var started = 0;
    try { started = parseInt(sessionStorage.getItem(KEY) || '0', 10) || 0; } catch (e) { return; }
    var mode;
    if (!started) { mode = 'full'; started = now; try { sessionStorage.setItem(KEY, String(now)); } catch (e) {} }
    else if (now - started < CONT) { mode = 'cont'; }
    else return;

    var css =
      '#pvtSplash{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;overflow:hidden;' +
      'background:radial-gradient(120% 80% at 50% 0%,var(--th-k-500,#0ea5e9) 0%,var(--th-b-600,#2563eb) 50%,var(--th-b-900,#1e3a8a) 100%);' +
      'color:#fff;font-family:"Prompt","Noto Sans Thai","Sarabun",system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;' +
      'transition:opacity .45s ease,transform .55s cubic-bezier(.4,0,.2,1),filter .45s ease}' +
      '#pvtSplash.is-out{opacity:0;transform:scale(1.08);filter:blur(6px);pointer-events:none}' +
      '#pvtSplash .pvs-glow{position:absolute;border-radius:50%;filter:blur(40px);opacity:.55;pointer-events:none}' +
      '#pvtSplash .pvs-g1{width:60vmax;height:60vmax;left:-20vmax;top:-25vmax;background:var(--th-k-300,#7dd3fc);animation:pvsDrift 6s ease-in-out infinite alternate}' +
      '#pvtSplash .pvs-g2{width:55vmax;height:55vmax;right:-22vmax;bottom:-22vmax;background:var(--th-b-400,#60a5fa);opacity:.35;animation:pvsDrift 7s ease-in-out infinite alternate-reverse}' +
      '#pvtSplash .pvs-mark{position:relative;width:170px;height:150px;display:grid;place-items:center}' +
      '#pvtSplash .pvs-ring{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;border:2px solid rgba(255,255,255,.55);opacity:0}' +
      '#pvtSplash .pvs-tile{position:relative;width:160px;display:grid;place-items:center;' +
      '-webkit-mask:url(/assets/icons/PVTT_LEAVE.png) center/contain no-repeat;mask:url(/assets/icons/PVTT_LEAVE.png) center/contain no-repeat}' +
      '#pvtSplash .pvs-tile img{width:100%;height:auto;display:block}' +
      '#pvtSplash .pvs-mark{filter:drop-shadow(0 14px 22px rgba(0,0,0,.35))}' +
      '#pvtSplash .pvs-tile::after{content:"";position:absolute;inset:-40%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.85) 50%,transparent 60%);transform:translateX(-120%)}' +
      '#pvtSplash .pvs-text{text-align:center;line-height:1.25}' +
      '#pvtSplash .pvs-name{font-size:22px;font-weight:700;letter-spacing:.3px}' +
      '#pvtSplash .pvs-sub{margin-top:4px;font-size:14px;font-weight:400;opacity:.85}' +
      '#pvtSplash .pvs-bar{position:absolute;bottom:calc(56px + env(safe-area-inset-bottom,0px));width:120px;height:4px;border-radius:4px;background:rgba(255,255,255,.22);overflow:hidden}' +
      '#pvtSplash .pvs-bar i{position:absolute;inset:0;width:40%;border-radius:4px;background:#fff;animation:pvsLoad 1.1s ease-in-out infinite}' +
      /* โหมดเต็ม: โลโก้เด้งเข้า → วงแหวนกระจาย → แสงวิ้ง → ข้อความเลื่อนขึ้น */
      '#pvtSplash.pvs-full .pvs-tile{animation:pvsPop .8s cubic-bezier(.34,1.56,.64,1) both}' +
      '#pvtSplash.pvs-full .pvs-ring{animation:pvsRing 1.1s .35s ease-out both}' +
      '#pvtSplash.pvs-full .pvs-tile::after{animation:pvsShine .9s .6s ease-in-out both}' +
      '#pvtSplash.pvs-full .pvs-name{animation:pvsUp .6s .35s cubic-bezier(.2,.8,.2,1) both}' +
      '#pvtSplash.pvs-full .pvs-sub{animation:pvsUp .6s .5s cubic-bezier(.2,.8,.2,1) both}' +
      '#pvtSplash.pvs-full .pvs-bar{animation:pvsFade .4s .7s both}' +
      '@keyframes pvsPop{0%{transform:scale(.4) rotate(-12deg);opacity:0}60%{opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}' +
      '@keyframes pvsRing{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.55);opacity:0}}' +
      '@keyframes pvsShine{to{transform:translateX(120%)}}' +
      '@keyframes pvsUp{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}' +
      '@keyframes pvsFade{from{opacity:0}to{opacity:1}}' +
      '@keyframes pvsLoad{0%{left:-40%}100%{left:100%}}' +
      '@keyframes pvsDrift{from{transform:translate(0,0)}to{transform:translate(4vmax,3vmax)}}' +
      'html.pvs-lock,html.pvs-lock body{overflow:hidden!important}';

    var st = d.createElement('style');
    st.id = 'pvtSplashStyle';
    st.textContent = css;
    (d.head || root).appendChild(st);

    var el = d.createElement('div');
    el.id = 'pvtSplash';
    el.className = 'pvs-' + mode;
    el.setAttribute('role', 'presentation');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<span class="pvs-glow pvs-g1"></span><span class="pvs-glow pvs-g2"></span>' +
      '<div class="pvs-mark"><span class="pvs-ring"></span><div class="pvs-tile"><img src="/assets/icons/PVTT_LEAVE.png" alt=""></div></div>' +
      '<div class="pvs-text"><div class="pvs-name">PVT Workforce Hub</div><div class="pvs-sub">ระบบใบลาออนไลน์</div></div>' +
      '<div class="pvs-bar"><i></i></div>';
    root.appendChild(el);
    root.classList.add('pvs-lock');

    var done = false, loaded = d.readyState === 'complete';
    function finish() {
      if (done) return; done = true;
      clearInterval(tick);
      el.classList.add('is-out');
      root.classList.remove('pvs-lock');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (st.parentNode) st.parentNode.removeChild(st);
      }, 600);
    }
    function maybe() {
      if (loaded && Date.now() - started >= MIN) finish();
    }
    // วาง splash ไว้ใต้ <html> (ไม่ย้ายเข้า body เพราะย้ายแล้วอนิเมชั่นจะเริ่มใหม่)
    window.addEventListener('load', function () { loaded = true; maybe(); });
    // หน้าใหญ่/เน็ตช้า: ไม่ต้องรอ load ครบ แค่ DOM พร้อมก็พอหลังเวลาขั้นต่ำ
    d.addEventListener('DOMContentLoaded', function () { setTimeout(function () { loaded = true; maybe(); }, 250); });
    var tick = setInterval(maybe, 120);
    setTimeout(finish, Math.max(400, MAX - (now - started)));
    el.addEventListener('click', finish);
    window.addEventListener('pagehide', function () { root.classList.remove('pvs-lock'); });
  } catch (e) { /* splash เป็นของเสริม — ห้ามทำให้หน้าพัง */ }
})();
