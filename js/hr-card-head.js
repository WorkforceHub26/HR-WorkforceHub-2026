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
