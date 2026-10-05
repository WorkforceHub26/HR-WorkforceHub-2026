/* ==========================================================================
   PVT WORKFORCE HUB — ตัวแสดงประวัติการเข้าสู่ระบบ (login-logs-viewer.js)
   --------------------------------------------------------------------------
   ใช้ได้ 2 แบบ
   1) แบบเต็มหน้า  : /pages/hr/login-logs.html
        const v = new window.LoginLogsViewerComponent({ containerId: 'pageLoginLogsContainer', limit: 500 });
        v.fetchLogs();  v.exportToCsv();
   2) แบบ Modal    : window.openLoginLogsViewerModal()  (ปุ่มในหน้า HR อื่น ๆ เรียกผ่าน viewLoginAuditLogs)

   แหล่งข้อมูล (เรียงลำดับ)
   - window.getLoginLogs(limit)  ← จาก auth/supabase-config.js (ลอง /api/login-logs → Supabase → localStorage)
   - fetch('/api/login-logs')    ← สำรอง กรณี supabase-config.js ยังไม่โหลด

   ไฟล์นี้โหลดได้ทั้งแบบ <script type="module"> และ <script> ธรรมดา (ไม่มี import/export)
   ========================================================================== */
(function () {
  'use strict';
  if (window.LoginLogsViewerComponent) return; // กันโหลดซ้ำ

  const STYLE_ID = 'pvt-llv-styles';
  const METHOD_LABELS = {
    password: 'รหัสผ่าน',
    webauthn: 'สแกนนิ้ว/ใบหน้า',
    passkey: 'Passkey',
    biometric: 'สแกนนิ้ว/ใบหน้า',
    line: 'LINE',
    otp: 'OTP',
    sso: 'SSO',
  };

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
.llv{--llv-p:var(--th-p-600, #0d9488);--llv-pd:var(--th-p-700, #0f766e);--llv-t:#0f172a;--llv-t2:#475569;--llv-m:#94a3b8;--llv-b:#e2e8f0;--llv-s:#fff;
  font-family:"Sarabun",system-ui,sans-serif;color:var(--llv-t);background:var(--llv-s);border:1px solid var(--llv-b);
  border-radius:16px;box-shadow:0 1px 3px rgba(15, 23, 42, .05),0 4px 14px rgba(15, 23, 42, .04);overflow:hidden;text-align:left}
.llv *{box-sizing:border-box}
.llv-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--llv-b);border-bottom:1px solid var(--llv-b)}
.llv-stat{background:var(--llv-s);padding:14px 18px}
.llv-stat span{display:block;font-size:12px;color:var(--llv-t2);font-weight:600}
.llv-stat strong{display:block;font-size:22px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}
.llv-stat--ok strong{color:#059669}.llv-stat--bad strong{color:#dc2626}
.llv-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;padding:14px 18px;border-bottom:1px solid var(--llv-b);background:#f8fafc}
.llv-field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:var(--llv-t2)}
.llv-field input,.llv-field select{height:38px;padding:0 10px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;font-size:14px;color:var(--llv-t);background:#fff;min-width:0}
.llv-field--grow{flex:1 1 220px}
.llv-field input:focus,.llv-field select:focus{outline:2px solid rgba(var(--th-p-600-rgb, 13, 148, 136), .35);border-color:var(--llv-p)}
.llv-clear{height:38px;padding:0 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font:inherit;font-weight:700;font-size:13px;color:var(--llv-t2);cursor:pointer}
.llv-clear:hover{background:#f1f5f9}
.llv-tablewrap{overflow:auto;max-height:65vh}
.llv-table{width:100%;border-collapse:collapse;font-size:13.5px}
.llv-table th{position:sticky;top:0;z-index:1;background:#f1f5f9;color:var(--llv-t2);font-weight:700;text-align:left;padding:10px 14px;border-bottom:1px solid var(--llv-b);white-space:nowrap}
.llv-table td{padding:10px 14px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.llv-table tbody tr:hover{background:var(--th-p-50, #f0fdfa)}
.llv-name{font-weight:700}.llv-sub{display:block;font-size:12px;color:var(--llv-m);margin-top:2px}
.llv-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
.llv-num{font-variant-numeric:tabular-nums;white-space:nowrap}
.llv-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.llv-badge--ok{background:#dcfce7;color:#166534}.llv-badge--bad{background:#fee2e2;color:#991b1b}
.llv-badge--m{background:var(--th-k-100, #e0f2fe);color:var(--th-k-800, #075985)}
.llv-empty{padding:40px 18px;text-align:center;color:var(--llv-t2)}
.llv-empty .material-symbols-outlined{font-size:40px;color:var(--llv-m);display:block;margin-bottom:6px}
.llv-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 18px;font-size:12px;color:var(--llv-t2);background:#f8fafc}
.llv-loading{padding:40px 18px;text-align:center;color:var(--llv-t2)}
.llv-loading .material-symbols-outlined{font-size:36px;color:var(--llv-p);animation:llv-spin 1s linear infinite;display:inline-block}
@keyframes llv-spin{to{transform:rotate(360deg)}}
@media (max-width:760px){
  .llv-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .llv-table thead{display:none}
  .llv-table,.llv-table tbody,.llv-table tr,.llv-table td{display:block;width:100%}
  .llv-table tr{padding:10px 14px;border-bottom:1px solid var(--llv-b)}
  .llv-table td{border:0;padding:3px 0}
  .llv-table td[data-label]::before{content:attr(data-label) ": ";font-weight:700;color:var(--llv-t2)}
}
.llv-modal-popup{width:min(1100px,96vw)!important;padding:0!important}
.llv-modal-popup .swal2-html-container{margin:0!important;padding:0 16px 16px!important}
.llv-modal-popup .llv{box-shadow:none}
`;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ---------- helpers ----------
  const esc = (v) => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function parseDevice(info) {
    if (!info) return { device: '-', browser: '' };
    if (typeof info === 'string') {
      try { info = JSON.parse(info); } catch (e) { return { device: info, browser: '' }; }
    }
    const ua = String(info.userAgent || info.user_agent || info.ua || '');
    let device = info.device || info.deviceType || info.platform || info.os || '';
    let browser = info.browser || '';
    if (ua) {
      if (!device) {
        if (/iPhone|iPad|iPod/i.test(ua)) device = 'iOS';
        else if (/Android/i.test(ua)) device = 'Android';
        else if (/Windows/i.test(ua)) device = 'Windows';
        else if (/Mac OS X|Macintosh/i.test(ua)) device = 'macOS';
        else if (/Linux/i.test(ua)) device = 'Linux';
      }
      if (!browser) {
        if (/Line\//i.test(ua)) browser = 'LINE';
        else if (/Edg\//i.test(ua)) browser = 'Edge';
        else if (/Chrome\//i.test(ua)) browser = 'Chrome';
        else if (/Firefox\//i.test(ua)) browser = 'Firefox';
        else if (/Safari\//i.test(ua)) browser = 'Safari';
      }
    }
    if (!device && info.description) device = info.description;
    return { device: device || '-', browser };
  }

  function normalize(row) {
    const ts = row.timestamp || row.created_at || row.login_at || null;
    const status = String(row.status || 'success').toLowerCase();
    const method = String(row.login_method || row.method || 'password').toLowerCase();
    const dev = parseDevice(row.device_info || row.deviceInfo);
    return {
      raw: row,
      time: ts ? new Date(ts) : null,
      userId: row.user_id || row.userId || '',
      name: row.full_name || row.fullName || row.name || '',
      code: row.employee_code || row.employeeCode || '',
      role: row.role || '',
      ip: row.ip_address || row.ip || '',
      method,
      methodLabel: METHOD_LABELS[method] || method,
      ok: !/fail|error|denied|reject/.test(status),
      status,
      device: dev.device,
      browser: dev.browser,
    };
  }

  const pad = (n) => String(n).padStart(2, '0');
  const fmtTime = (d) => (d && !isNaN(d))
    ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    : '-';
  const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  async function loadLogs(limit) {
    if (typeof window.getLoginLogs === 'function') {
      try {
        const data = await window.getLoginLogs(limit);
        if (Array.isArray(data)) return data;
      } catch (e) { console.warn('[LoginLogsViewer] getLoginLogs failed:', e); }
    }
    const res = await fetch(`/api/login-logs?limit=${encodeURIComponent(limit)}`);
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.includes('json')) throw new Error(`โหลดข้อมูลไม่สำเร็จ (HTTP ${res.status})`);
    const json = await res.json();
    return Array.isArray(json.data) ? json.data : [];
  }

  // ---------- component ----------
  class LoginLogsViewerComponent {
    constructor(opts = {}) {
      this.containerId = opts.containerId || 'pageLoginLogsContainer';
      this.limit = Math.min(Math.max(parseInt(opts.limit, 10) || 200, 1), 500);
      this.logs = [];
      this.filter = { q: '', from: '', to: '', status: 'all' };
      this.loading = false;
      injectStyles();
    }

    get container() { return document.getElementById(this.containerId); }

    async fetchLogs() {
      const box = this.container;
      if (!box || this.loading) return this.logs;
      this.loading = true;
      box.innerHTML = `<div class="llv"><div class="llv-loading"><span class="material-symbols-outlined">progress_activity</span><p>กำลังโหลดประวัติการเข้าสู่ระบบ...</p></div></div>`;
      try {
        const rows = await loadLogs(this.limit);
        this.logs = rows.map(normalize).sort((a, b) => (b.time || 0) - (a.time || 0));
        this.render();
      } catch (err) {
        console.error('[LoginLogsViewer]', err);
        box.innerHTML = `<div class="llv"><div class="llv-empty"><span class="material-symbols-outlined">error</span>
          <strong>โหลดประวัติไม่สำเร็จ</strong><p>${esc(err.message || err)}</p></div></div>`;
      } finally {
        this.loading = false;
      }
      return this.logs;
    }

    filtered() {
      const { q, from, to, status } = this.filter;
      const needle = q.trim().toLowerCase();
      return this.logs.filter((l) => {
        if (status === 'success' && !l.ok) return false;
        if (status === 'failed' && l.ok) return false;
        if ((from || to) && l.time) {
          const day = isoDay(l.time);
          if (from && day < from) return false;
          if (to && day > to) return false;
        }
        if (needle) {
          const hay = [l.name, l.code, l.userId, l.ip, l.device, l.browser, l.methodLabel, l.role].join(' ').toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
    }

    render() {
      const box = this.container;
      if (!box) return;
      const list = this.filtered();
      const today = isoDay(new Date());
      const users = new Set(list.map((l) => l.userId || l.code || l.name)).size;
      const todayCount = list.filter((l) => l.time && isoDay(l.time) === today).length;
      const failed = list.filter((l) => !l.ok).length;
      const f = this.filter;

      const rows = list.map((l) => `
        <tr>
          <td data-label="เวลา" class="llv-num">${esc(fmtTime(l.time))}</td>
          <td data-label="ผู้ใช้"><span class="llv-name">${esc(l.name || '-')}</span>
            <span class="llv-sub">${esc([l.code, l.role].filter(Boolean).join(' · ') || l.userId)}</span></td>
          <td data-label="วิธีเข้าระบบ"><span class="llv-badge llv-badge--m">${esc(l.methodLabel)}</span></td>
          <td data-label="อุปกรณ์">${esc(l.device)}${l.browser ? `<span class="llv-sub">${esc(l.browser)}</span>` : ''}</td>
          <td data-label="IP" class="llv-mono">${esc(l.ip || '-')}</td>
          <td data-label="สถานะ"><span class="llv-badge ${l.ok ? 'llv-badge--ok' : 'llv-badge--bad'}">${l.ok ? 'สำเร็จ' : 'ไม่สำเร็จ'}</span></td>
        </tr>`).join('');

      box.innerHTML = `
        <div class="llv">
          <div class="llv-stats">
            <div class="llv-stat"><span>รายการทั้งหมด</span><strong>${list.length.toLocaleString('th-TH')}</strong></div>
            <div class="llv-stat"><span>ผู้ใช้ไม่ซ้ำ</span><strong>${users.toLocaleString('th-TH')}</strong></div>
            <div class="llv-stat llv-stat--ok"><span>เข้าระบบวันนี้</span><strong>${todayCount.toLocaleString('th-TH')}</strong></div>
            <div class="llv-stat llv-stat--bad"><span>ไม่สำเร็จ</span><strong>${failed.toLocaleString('th-TH')}</strong></div>
          </div>
          <div class="llv-filters">
            <label class="llv-field llv-field--grow">ค้นหา
              <input type="search" data-f="q" value="${esc(f.q)}" placeholder="ชื่อ, รหัสพนักงาน, IP, อุปกรณ์" /></label>
            <label class="llv-field">ตั้งแต่วันที่<input type="date" data-f="from" value="${esc(f.from)}" /></label>
            <label class="llv-field">ถึงวันที่<input type="date" data-f="to" value="${esc(f.to)}" /></label>
            <label class="llv-field">สถานะ
              <select data-f="status">
                <option value="all"${f.status === 'all' ? ' selected' : ''}>ทั้งหมด</option>
                <option value="success"${f.status === 'success' ? ' selected' : ''}>สำเร็จ</option>
                <option value="failed"${f.status === 'failed' ? ' selected' : ''}>ไม่สำเร็จ</option>
              </select></label>
            <button type="button" class="llv-clear" data-act="clear">ล้างตัวกรอง</button>
          </div>
          ${list.length ? `
          <div class="llv-tablewrap">
            <table class="llv-table">
              <thead><tr><th>เวลา</th><th>ผู้ใช้</th><th>วิธีเข้าระบบ</th><th>อุปกรณ์</th><th>IP Address</th><th>สถานะ</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>` : `
          <div class="llv-empty"><span class="material-symbols-outlined">manage_search</span>
            <strong>${this.logs.length ? 'ไม่พบรายการที่ตรงกับตัวกรอง' : 'ยังไม่มีประวัติการเข้าสู่ระบบ'}</strong></div>`}
          <div class="llv-foot">
            <span>แสดง ${list.length.toLocaleString('th-TH')} จาก ${this.logs.length.toLocaleString('th-TH')} รายการล่าสุด</span>
            <span>ข้อมูลเก็บย้อนหลัง 90 วัน (PDPA)</span>
          </div>
        </div>`;

      this.bind(box);
    }

    bind(box) {
      let t;
      box.querySelectorAll('[data-f]').forEach((el) => {
        const key = el.getAttribute('data-f');
        const apply = () => {
          this.filter[key] = el.value;
          const pos = el.selectionStart;
          this.render();
          const again = this.container && this.container.querySelector(`[data-f="${key}"]`);
          if (again && key === 'q') { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
        };
        if (key === 'q') el.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 250); });
        else el.addEventListener('change', apply);
      });
      const clear = box.querySelector('[data-act="clear"]');
      if (clear) clear.addEventListener('click', () => {
        this.filter = { q: '', from: '', to: '', status: 'all' };
        this.render();
      });
    }

    exportToCsv() {
      const list = this.filtered();
      if (!list.length) {
        if (window.Swal) window.Swal.fire('ไม่มีข้อมูล', 'ไม่มีรายการให้ส่งออก', 'info');
        return;
      }
      const head = ['เวลา', 'ชื่อ-สกุล', 'รหัสพนักงาน', 'User ID', 'บทบาท', 'วิธีเข้าระบบ', 'อุปกรณ์', 'เบราว์เซอร์', 'IP Address', 'สถานะ'];
      const cell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
      const lines = [head.map(cell).join(',')].concat(list.map((l) => [
        l.time ? l.time.toISOString() : '', l.name, l.code, l.userId, l.role, l.methodLabel,
        l.device, l.browser, l.ip, l.ok ? 'สำเร็จ' : 'ไม่สำเร็จ',
      ].map(cell).join(',')));
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `login-logs-${isoDay(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    async openModal() { return window.openLoginLogsViewerModal(); }
  }

  // ---------- modal (ใช้จากหน้าอื่น) ----------
  async function openLoginLogsViewerModal() {
    injectStyles();
    if (!window.Swal) {
      window.location.href = '/pages/hr/login-logs.html';
      return;
    }
    const id = 'llvModalContainer';
    let viewer;
    await window.Swal.fire({
      title: 'ประวัติการเข้าสู่ระบบ',
      html: `<div id="${id}"></div>`,
      showConfirmButton: true,
      confirmButtonText: 'ส่งออก CSV',
      confirmButtonColor: 'var(--th-p-600, #0d9488)',
      showCancelButton: true,
      cancelButtonText: 'ปิด',
      customClass: { popup: 'llv-modal-popup' },
      didOpen: () => {
        viewer = new LoginLogsViewerComponent({ containerId: id, limit: 200 });
        viewer.fetchLogs();
      },
      preConfirm: () => { viewer && viewer.exportToCsv(); return false; },
    });
  }

  window.LoginLogsViewerComponent = LoginLogsViewerComponent;
  window.openLoginLogsViewerModal = openLoginLogsViewerModal;
})();
