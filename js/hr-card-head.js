/* ==========================================================================
   หัวการ์ดสีเดียวกับเมนูด้านข้าง (ทุกหน้าฝั่ง HR) — คู่กับ css/hr-card-head.css
   - หาหัวการ์ดของแต่ละหน้า (รายชื่อด้านล่าง) แล้วใส่คลาส .pvt-card-head
   - อ่าน padding / มุมโค้งของการ์ดจริง แล้วตั้งตัวแปร CSS ให้แถบสีชิดขอบการ์ดพอดี
     (คำนวณใหม่เมื่อย่อ/ขยายจอ และเมื่อมีการ์ดถูกสร้างเพิ่มด้วย JS)
   - สีมาจาก --pvt-sidebar-bg-from/to (ตัวแปรเดียวกับเมนูด้านข้าง) จึงเปลี่ยนตามธีม
   ========================================================================== */
(function () {
  'use strict';
  if (window.__pvtCardHead) return;
  window.__pvtCardHead = true;

  var SELECTORS = [
    '#page-hr-home .leave-analytics-card > .panel-header',
    '#page-hr-home .panel > .panel-header',
    '#page-hr-home .panel > .panel-head',
    '#page-hr-approval .panel > .panel-header',
    '#page-hr-approval .ra-panel > .ra-head',
    '#page-hr-management .panel > .panel-head',
    '#page-hr-leave-stats .ls-panel > .ls-panel-head',
    '#page-hr-approval-settings .card-panel > .card-panel-header',
    '#page-hr-approval-chains .ac-card > .ac-card__head',
    '#page-hr-approval-chains .ac-editor__head',
    '#page-hr-admin-dashboard .panel > :first-child',
    '#page-hr-holidays .admin-calendar-panel > .admin-cal-head'
  ].join(',');

  function px(v) { return parseFloat(v) || 0; }

  function apply() {
    var heads = document.querySelectorAll(SELECTORS);
    for (var i = 0; i < heads.length; i++) {
      var el = heads[i];
      var card = el.parentElement;
      if (!card) continue;
      var cs = getComputedStyle(card);
      var pt = px(cs.paddingTop), pr = px(cs.paddingRight), pl = px(cs.paddingLeft);
      var r = Math.max(0, px(cs.borderTopLeftRadius) - px(cs.borderTopWidth));
      el.classList.add('pvt-card-head');
      el.style.setProperty('--hh-r', r + 'px');
      // หัวการ์ดต้องเป็นลูกตัวแรก จึงยืดขึ้นไปชนขอบบนได้
      var first = card.firstElementChild === el;
      if (first && (pt || pr || pl)) {
        el.classList.add('is-bleed');
        el.style.setProperty('--hh-pt', pt + 'px');
        el.style.setProperty('--hh-pr', pr + 'px');
        el.style.setProperty('--hh-pl', pl + 'px');
      } else {
        el.classList.remove('is-bleed');
        if (!first) el.style.setProperty('--hh-r', '12px');
      }
    }
  }

  var timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; apply(); }, 120);
  }

  function start() {
    apply();
    window.addEventListener('resize', schedule);
    try {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].addedNodes && list[i].addedNodes.length) { schedule(); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ==========================================================================
   ป๊อปอัป (SweetAlert) ฝั่ง HR บนจอ PC: ขยายตามเนื้อหา (จอมาตรฐาน 21 นิ้ว / 1920px)
   - มีตาราง → เกือบเต็มจอ (สูงสุด 1600px / 96% ของจอ) · ฟอร์มหลายช่อง → กลาง (สูงสุด 860px) · ข้อความยืนยันสั้นๆ → ขนาดเดิม
   - กล่องเลื่อนในป๊อปอัป (ที่ตั้ง max-height ไว้) → สูงได้ถึง ~65% ของจอ
   - ไม่ย่อป๊อปอัปที่กว้างอยู่แล้ว / ไม่แตะป๊อปอัปเต็มจอและ toast · จอเล็กกว่า 1200px ใช้ขนาดเดิม
   ========================================================================== */
(function () {
  'use strict';
  if (window.__pvtSwalSize) return;
  window.__pvtSwalSize = true;

  var css = [
    '@media (min-width: 1200px) {',
    '  .swal2-popup.pvt-swal-wide { width: min(1600px, 96vw) !important; max-width: 96vw !important; max-height: 92vh; padding: 1.6em 2em 1.4em !important; }',
    '  .swal2-popup.pvt-swal-form { width: min(860px, 88vw) !important; max-width: 88vw !important; padding: 1.5em 1.8em 1.3em !important; }',
    '  .swal2-popup.pvt-swal-wide .swal2-title, .swal2-popup.pvt-swal-form .swal2-title { font-size: 1.6em !important; }',
    '  .swal2-popup.pvt-swal-wide .swal2-html-container, .swal2-popup.pvt-swal-form .swal2-html-container { font-size: 1.05em; margin-left: .4em; margin-right: .4em; }',
    '  .swal2-popup.pvt-swal-form .swal2-html-container [style*="max-height"] { max-height: min(65vh, 760px) !important; }',
    '  .swal2-popup.pvt-swal-wide .swal2-html-container [style*="max-height"] { max-height: calc(92vh - 230px) !important; }',
    '  .swal2-popup.pvt-swal-wide table { font-size: 14.5px !important; }',
    /* คอลัมน์แคบที่ตั้งความกว้างไว้ (เช่น โควตา / จัดการ) → ให้ที่หายใจ ไม่เบียดกัน ช่องชื่อยังกว้างตามที่เหลือ */
    '  .swal2-popup.pvt-swal-wide table th { white-space: nowrap; }',
    '  .swal2-popup.pvt-swal-wide table th[style*="width"] { width: auto !important; min-width: 170px; }',
    '  .swal2-popup.pvt-swal-wide table td, .swal2-popup.pvt-swal-wide table th { padding-left: 14px !important; padding-right: 14px !important; }',
    '  .swal2-popup.pvt-swal-wide table td input[type="number"] { width: 120px !important; max-width: 100%; }',
    '  .swal2-popup.pvt-swal-wide table td button, .swal2-popup.pvt-swal-wide table td .btn, .swal2-popup.pvt-swal-wide table td a[class*="btn"] { white-space: nowrap; padding: 8px 16px !important; font-size: 13.5px !important; border-radius: 8px !important; }',
    '  .swal2-popup.pvt-swal-wide table td:has(> button:only-child), .swal2-popup.pvt-swal-wide table td:has(> input[type="number"]) { text-align: center; }',
  '  .swal2-popup.pvt-swal-wide table td, .swal2-popup.pvt-swal-wide table th { padding-top: 10px; padding-bottom: 10px; }',
    '}'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'pvt-swal-size-style';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function visibleFields(root) {
    var n = 0;
    var list = root.querySelectorAll('input, select, textarea');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.type === 'hidden' || el.type === 'checkbox' || el.type === 'radio') continue;
      if (el.offsetParent === null && !el.classList.contains('swal2-input')) continue;
      n++;
    }
    return n;
  }

  function size(popup) {
    if (!popup || popup.classList.contains('swal2-toast')) return;
    if (/fullscreen/.test(popup.className) || /100vw/.test(popup.style.width || '')) return;
    var box = popup.querySelector('.swal2-html-container');
    if (!box || box.style.display === 'none') { popup.classList.remove('pvt-swal-wide', 'pvt-swal-form'); return; }
    var wide = !!box.querySelector('table') || box.scrollWidth > box.clientWidth + 8;
    // ฟอร์มหลายช่อง หรือรายการที่มีปุ่มจัดการหลายแถว (เช่น เงื่อนไขการลา) → ขนาดกลาง
    var form = !wide && (visibleFields(box) >= 3 || box.querySelectorAll('button, a[onclick]').length >= 6);
    var cur = popup.getBoundingClientRect().width;
    // ไม่ย่อ: ถ้ากว้างกว่าขนาดเป้าหมายอยู่แล้ว ปล่อยไว้
    var vw = window.innerWidth;
    var targetWide = Math.min(1600, vw * 0.96), targetForm = Math.min(860, vw * 0.88);
    // ตั้งขนาดครั้งเดียวต่อป๊อปอัพ: ถ้าใส่ class แล้วให้คงไว้ (เดิมวัดซ้ำทุกครั้งที่หน้าอัปเดต → ใส่/ถอดสลับ ป๊อปอัพเด้งไปมา)
    var hasWide = popup.classList.contains('pvt-swal-wide'), hasForm = popup.classList.contains('pvt-swal-form');
    if (hasWide || hasForm) return;
    if (wide && cur < targetWide) popup.classList.add('pvt-swal-wide');
    else if (form && cur < targetForm) popup.classList.add('pvt-swal-form');
  }

  var t = null;
  function check() {
    if (t) return;
    t = setTimeout(function () {
      t = null;
      var pops = document.querySelectorAll('.swal2-container .swal2-popup');
      for (var i = 0; i < pops.length; i++) {
        // ป๊อปอัพใหม่ (Swal ใช้ element เดิมซ้ำ) → ล้าง class เก่าก่อนวัดใหม่
        var key = (pops[i].querySelector('.swal2-title') || {}).textContent + '|' + ((pops[i].querySelector('.swal2-html-container') || {}).childElementCount || 0);
        if (pops[i].getAttribute('data-pvt-size-key') !== key) {
          pops[i].classList.remove('pvt-swal-wide', 'pvt-swal-form');
          pops[i].setAttribute('data-pvt-size-key', key);
        }
        size(pops[i]);
      }
    }, 30);
  }

  function start() {
    try {
      new MutationObserver(function (list) {
        for (var i = 0; i < list.length; i++) {
          var m = list[i];
          if (m.type === 'childList' && m.addedNodes.length && m.target.closest && (m.target.closest('.swal2-container') || (m.addedNodes[0].classList && m.addedNodes[0].classList.contains('swal2-container')))) { check(); return; }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
    window.addEventListener('resize', check);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
