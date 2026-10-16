/* ==========================================================================
   📅 ช่องวันที่แบบไทยทั้งระบบ — แสดง วัน/เดือน/ปี พ.ศ. (เช่น 28/12/2569)
   --------------------------------------------------------------------------
   โหลดอัตโนมัติจาก js/theme-boot.js (มีในทุกหน้า) ไม่ต้องใส่ในหน้าเอง
   - ทุก <input type="date"> (รวมช่องที่สร้างทีหลัง เช่น ใน SweetAlert) → ปฏิทินไทย (flatpickr)
   - ค่าที่โค้ดอ่าน/เขียน (input.value) ยังเป็น YYYY-MM-DD ค.ศ. เหมือนเดิม → ฐานข้อมูลและโค้ดเดิมไม่ต้องแก้
   - ปฏิทิน flatpickr ที่หน้าสร้างเอง (เช่น ฟอร์มยื่นลา) → เปลี่ยนการแสดงปีเป็น พ.ศ. ให้ด้วย
   - ไม่ต้องการ: ใส่ data-no-thai-date ที่ช่อง (หรือกล่องที่ครอบ)
   - ถ้าโหลด flatpickr ไม่ได้ (เช่น เน็ตหลุด) ช่องวันที่ของเบราว์เซอร์ยังใช้งานได้ตามปกติ
   ========================================================================== */
(function () {
  'use strict';
  if (window.PVTThaiDate) return;

  const FP_VER = '4.6.13';
  const CDN = `https://cdn.jsdelivr.net/npm/flatpickr@${FP_VER}/dist`;
  const pad = (n) => String(n).padStart(2, '0');
  const ALT_CLASS = 'pvt-thdate-alt';

  // ---------- โหลดไลบรารี (ถ้าหน้ายังไม่มี) ----------
  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve(true); s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }
  function ensureCss() {
    if ([...document.styleSheets].some((ss) => /flatpickr/.test(ss.href || '')) || document.querySelector('link[href*="flatpickr"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = `${CDN}/flatpickr.min.css`;
    document.head.appendChild(l);
  }
  function injectStyle() {
    if (document.getElementById('pvt-thdate-style')) return;
    const st = document.createElement('style');
    st.id = 'pvt-thdate-style';
    st.textContent = `
      .flatpickr-calendar { z-index: 3000 !important; font-family: inherit; }
      .flatpickr-calendar .pvt-be-year { font-weight: 700; font-size: 15px; margin-left: 6px; color: inherit; }
      input.${ALT_CLASS} { cursor: pointer; }
      input.${ALT_CLASS}[readonly]:not(.pvt-thdate-locked) { background-color: #fff; }
    `;
    document.head.appendChild(st);
  }
  let loading = null;
  function ensureFlatpickr() {
    if (typeof window.flatpickr === 'function' && window.flatpickr.l10ns && window.flatpickr.l10ns.th) return Promise.resolve(true);
    if (loading) return loading;
    ensureCss();
    loading = (async () => {
      if (typeof window.flatpickr !== 'function') {
        // หน้าที่ใส่ flatpickr เองแบบ defer อาจกำลังโหลด → รอสักครู่ก่อนโหลดซ้ำ
        for (let i = 0; i < 20 && typeof window.flatpickr !== 'function'; i++) await new Promise((r) => setTimeout(r, 100));
        if (typeof window.flatpickr !== 'function' && !(await loadScript(`${CDN}/flatpickr.min.js`))) return false;
      }
      if (!(window.flatpickr.l10ns && window.flatpickr.l10ns.th)) await loadScript(`${CDN}/l10n/th.js`);
      return typeof window.flatpickr === 'function';
    })();
    return loading;
  }

  // ---------- แสดงปี พ.ศ. ----------
  // ค่าที่เก็บ (dateFormat) = ค.ศ. · ค่าที่แสดง (altFormat ฯลฯ) = พ.ศ.
  function beFormatter(fp) {
    return (d, f) => {
      const fmt = String(f || '');
      if (fmt === fp.config.dateFormat || !/Y/.test(fmt)) return window.flatpickr.formatDate(d, fmt, fp.l10n);
      return window.flatpickr.formatDate(d, fmt.replace(/Y/g, '####'), fp.l10n).replace(/####/g, String(d.getFullYear() + 543));
    };
  }
  function showBE(fp) {
    const cal = fp && fp.calendarContainer;
    const wrap = cal && cal.querySelector('.numInputWrapper');
    if (!wrap) return;
    let lab = cal.querySelector('.pvt-be-year, .hs-be-year');
    if (!lab) { lab = document.createElement('span'); lab.className = 'pvt-be-year'; wrap.parentNode.insertBefore(lab, wrap); }
    wrap.style.display = 'none';
    lab.textContent = `พ.ศ. ${fp.currentYear + 543}`;
  }
  // ปรับปฏิทินที่หน้าสร้างไว้เองให้แสดง พ.ศ.
  function patchInstance(fp) {
    if (!fp || fp._pvtBE) return;
    fp._pvtBE = true;
    try {
      fp.config.formatDate = beFormatter(fp);
      ['onOpen', 'onMonthChange', 'onYearChange'].forEach((h) => { if (Array.isArray(fp.config[h])) fp.config[h].push(() => showBE(fp)); });
      showBE(fp);
      if (fp.selectedDates && fp.selectedDates.length && fp.altInput) fp.altInput.value = fp.formatDate(fp.selectedDates[0], fp.config.altFormat);
      else if (fp.selectedDates && fp.selectedDates.length && !fp.config.altInput && fp.config.dateFormat !== 'Y-m-d') fp.input.value = fp.formatDate(fp.selectedDates[0], fp.config.dateFormat);
    } catch (e) { /* ปล่อยตามเดิม */ }
  }

  // ---------- เปลี่ยน <input type="date"> เป็นปฏิทินไทย ----------
  function enhance(el) {
    if (el._flatpickr || el.dataset.pvtThdate || el.closest('[data-no-thai-date]')) return;
    if (String(el.getAttribute('type') || '').toLowerCase() !== 'date') return;
    el.dataset.pvtThdate = '1';
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const locked = el.readOnly || el.disabled;
    const fp = window.flatpickr(el, {
      locale: (window.flatpickr.l10ns && window.flatpickr.l10ns.th) || 'default',
      dateFormat: 'Y-m-d', altInput: true, altFormat: 'd/m/Y',
      altInputClass: `${el.className || ''} ${ALT_CLASS}${locked ? ' pvt-thdate-locked' : ''}`.trim(),
      allowInput: false, disableMobile: true, clickOpens: !locked,
      minDate: el.min || null, maxDate: el.max || null,
      defaultDate: el.value || null,
      onReady: (s, str, inst) => {
        const alt = inst.altInput;
        if (!alt) return;
        if (el.getAttribute('style')) alt.setAttribute('style', el.getAttribute('style'));
        alt.placeholder = el.placeholder || 'วว/ดด/ปปปป';
        if (el.required) alt.required = true;
        if (locked) alt.disabled = el.disabled;
        // ป้ายกำกับ <label for="..."> → คลิกแล้วเปิดปฏิทิน
        if (el.id) alt.setAttribute('aria-labelledby', el.id);
        showBE(inst);
      }
    });
    if (!fp || Array.isArray(fp)) return;
    patchInstance(fp);
    // โค้ดเดิมที่ตั้ง input.value = 'YYYY-MM-DD' เอง → ให้ช่องที่แสดงเปลี่ยนตาม
    let busy = false;
    try {
      Object.defineProperty(el, 'value', {
        configurable: true,
        get() { return proto.get.call(el); },
        set(v) {
          proto.set.call(el, v);
          if (busy || el._flatpickr !== fp) return;   // หน้าสร้างปฏิทินของตัวเองแทนแล้ว → ไม่ยุ่ง
          busy = true;
          try { v ? fp.setDate(v, false, 'Y-m-d') : fp.clear(false); } catch (e) {} finally { busy = false; }
        }
      });
    } catch (e) {}
    // readonly/disabled ที่เปลี่ยนภายหลัง
    try {
      new MutationObserver(() => {
        const lk = el.readOnly || el.disabled;
        fp.set('clickOpens', !lk);
        if (fp.altInput) { fp.altInput.disabled = el.disabled; fp.altInput.classList.toggle('pvt-thdate-locked', lk); }
      }).observe(el, { attributes: true, attributeFilter: ['readonly', 'disabled'] });
    } catch (e) {}
  }

  function scan(root) {
    const base = root && root.querySelectorAll ? root : document;
    if (base.matches && base.matches('input[type="date"]')) enhance(base);
    base.querySelectorAll('input[type="date"]').forEach(enhance);
    base.querySelectorAll('.flatpickr-input').forEach((i) => { if (i._flatpickr) patchInstance(i._flatpickr); });
  }

  let started = false;
  async function start() {
    if (started) return;
    started = true;
    injectStyle();
    if (!(await ensureFlatpickr())) return;   // ใช้ช่องวันที่ของเบราว์เซอร์ต่อไป
    scan(document);
    let t = null;
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
      }
      // ปฏิทินที่หน้าสร้าง/สร้างใหม่เอง (เช่น ฟอร์มยื่นลา) → ตรวจทั้งหน้าแบบหน่วงเวลาเล็กน้อย
      clearTimeout(t);
      t = setTimeout(() => document.querySelectorAll('.flatpickr-input').forEach((i) => { if (i._flatpickr) patchInstance(i._flatpickr); }), 60);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    // ปฏิทินที่หน้าสร้างเองช้ากว่าเรา
    setTimeout(() => scan(document), 1500);
    setTimeout(() => scan(document), 4000);
  }

  window.PVTThaiDate = { start, scan, enhance, formatBE: (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${pad(d)}/${pad(m)}/${y + 543}`; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
