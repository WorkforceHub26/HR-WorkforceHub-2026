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
