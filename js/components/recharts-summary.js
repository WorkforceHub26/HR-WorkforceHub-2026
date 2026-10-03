/* ==========================================================================
   PVT WORKFORCE HUB — กราฟแนวโน้มรายวันประจำเดือน (recharts-summary.js)
   --------------------------------------------------------------------------
   วาดลงใน <div id="rechartsSummaryPanel"> (ถ้าหน้านั้นไม่มี div นี้ จะไม่ทำอะไร)
   ข้อมูล:
     - window.leaveRequests   ← home.js / management.js ตั้งค่าไว้หลังโหลดข้อมูล
     - window.getLoginLogs()  ← auth/supabase-config.js (จำนวนการเข้าใช้งานต่อวัน)
   เรียกวาดใหม่ได้ด้วย window.renderRechartsDashboard()
   ใช้ React + Recharts (UMD จาก CDN) ถ้าไม่มี จะวาดกราฟแท่ง SVG แบบง่ายแทน
   ========================================================================== */
(function () {
  'use strict';
  if (window.renderRechartsDashboard && window.renderRechartsDashboard.__pvt) return;

  const PANEL_ID = 'rechartsSummaryPanel';
  const STYLE_ID = 'pvt-rcs-styles';
  const COLORS = { onLeave: '#0d9488', submitted: '#f59e0b', logins: '#6366f1' };
  let root = null;
  let loginCache = null;
  let loginFetchedAt = 0;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
.rcs{font-family:"Sarabun",system-ui,sans-serif;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;box-shadow:0 1px 3px rgba(15,23,42,.05),0 4px 14px rgba(15,23,42,.04)}
.rcs-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}
.rcs-kpi{border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px}
.rcs-kpi span{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#475569}
.rcs-kpi i{width:10px;height:10px;border-radius:3px;display:inline-block}
.rcs-kpi strong{display:block;font-size:22px;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums}
.rcs-kpi small{color:#94a3b8;font-size:11.5px}
.rcs-chart{width:100%;height:300px}
.rcs-note{font-size:12px;color:#94a3b8;margin-top:6px}
@media (max-width:640px){.rcs-kpis{grid-template-columns:1fr}.rcs-chart{height:240px}}`;
    document.head.appendChild(el);
  }

  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isApproved = (s) => /approved|อนุมัติ/i.test(String(s || '')) && !/reject|ไม่อนุมัติ/i.test(String(s || ''));
  const isCancelled = (s) => /cancel|reject|ยกเลิก|ไม่อนุมัติ/i.test(String(s || ''));

  async function getLogins() {
    if (loginCache && Date.now() - loginFetchedAt < 5 * 60 * 1000) return loginCache;
    if (typeof window.getLoginLogs !== 'function') return null;
    try {
      const rows = await window.getLoginLogs(500);
      loginCache = Array.isArray(rows) ? rows : [];
      loginFetchedAt = Date.now();
      return loginCache;
    } catch (e) {
      return null;
    }
  }

  function buildSeries(requests, logins) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const todayIdx = now.getDate();
    const data = [];
    for (let d = 1; d <= days; d++) {
      data.push({ day: d, label: `${d}`, date: iso(new Date(y, m, d)), onLeave: 0, submitted: 0, logins: logins ? 0 : null });
    }
    const byDate = Object.fromEntries(data.map((r) => [r.date, r]));

    (requests || []).forEach((r) => {
      const s = String(r.start_date || '').slice(0, 10);
      const e = String(r.end_date || r.start_date || '').slice(0, 10);
      if (s && isApproved(r.status)) {
        data.forEach((row) => { if (row.date >= s && row.date <= e) row.onLeave += 1; });
      }
      const c = r.created_at ? new Date(r.created_at) : null;
      if (c && !isNaN(c) && !isCancelled(r.status)) {
        const row = byDate[iso(c)];
        if (row) row.submitted += 1;
      }
    });

    (logins || []).forEach((l) => {
      const t = l.timestamp || l.created_at;
      if (!t) return;
      const d = new Date(t);
      if (isNaN(d)) return;
      const row = byDate[iso(d)];
      if (row) row.logins += 1;
    });

    // วันในอนาคต: ไม่นับยอดยื่น/เข้าใช้ (แต่ยังแสดงวันลาที่อนุมัติล่วงหน้า)
    data.forEach((row) => {
      if (row.day > todayIdx) { row.submitted = null; if (logins) row.logins = null; }
    });
    return data;
  }

  function sum(arr, k) { return arr.reduce((a, r) => a + (r[k] || 0), 0); }

  function kpisHtml(data, hasLogins) {
    const peak = data.reduce((best, r) => (r.onLeave > (best ? best.onLeave : -1) ? r : best), null);
    const k = (color, label, value, sub) =>
      `<div class="rcs-kpi"><span><i style="background:${color}"></i>${label}</span><strong>${value}</strong><small>${sub}</small></div>`;
    return `<div class="rcs-kpis">
      ${k(COLORS.onLeave, 'วันลาสูงสุดในเดือน', peak && peak.onLeave ? `${peak.onLeave} คน` : '0 คน', peak && peak.onLeave ? `วันที่ ${peak.day}` : 'ยังไม่มีการลา')}
      ${k(COLORS.submitted, 'ใบลาที่ยื่นเดือนนี้', `${sum(data, 'submitted').toLocaleString('th-TH')} รายการ`, 'นับจากวันที่ยื่นคำขอ')}
      ${k(COLORS.logins, 'การเข้าใช้งานเดือนนี้', hasLogins ? `${sum(data, 'logins').toLocaleString('th-TH')} ครั้ง` : '—', hasLogins ? 'จากประวัติการเข้าสู่ระบบ' : 'ไม่มีข้อมูลประวัติเข้าระบบ')}
    </div>`;
  }

  function renderWithRecharts(mount, data, hasLogins) {
    const R = window.Recharts;
    const h = window.React.createElement;
    const series = [
      h(R.Bar, { key: 'b', dataKey: 'onLeave', name: 'พนักงานที่ลา (คน)', fill: COLORS.onLeave, radius: [4, 4, 0, 0], maxBarSize: 18 }),
      h(R.Line, { key: 's', type: 'monotone', dataKey: 'submitted', name: 'ใบลาที่ยื่น', stroke: COLORS.submitted, strokeWidth: 2, dot: false, connectNulls: false }),
    ];
    if (hasLogins) {
      series.push(h(R.Line, { key: 'l', type: 'monotone', dataKey: 'logins', name: 'การเข้าใช้งาน', stroke: COLORS.logins, strokeWidth: 2, dot: false, yAxisId: 'right' }));
    }
    const chart = h(R.ResponsiveContainer, { width: '100%', height: '100%' },
      h(R.ComposedChart, { data, margin: { top: 8, right: 8, bottom: 0, left: -16 } },
        h(R.CartesianGrid, { strokeDasharray: '3 3', stroke: '#eef2f7', vertical: false }),
        h(R.XAxis, { dataKey: 'label', tick: { fontSize: 11, fill: '#64748b' }, tickLine: false, axisLine: { stroke: '#e2e8f0' }, interval: 'preserveStartEnd' }),
        h(R.YAxis, { allowDecimals: false, tick: { fontSize: 11, fill: '#64748b' }, tickLine: false, axisLine: false }),
        hasLogins ? h(R.YAxis, { yAxisId: 'right', orientation: 'right', allowDecimals: false, tick: { fontSize: 11, fill: '#64748b' }, tickLine: false, axisLine: false }) : null,
        h(R.Tooltip, { labelFormatter: (l) => `วันที่ ${l}`, contentStyle: { borderRadius: 10, border: '1px solid #e2e8f0', fontFamily: 'Sarabun' } }),
        h(R.Legend, { wrapperStyle: { fontSize: 12, fontFamily: 'Sarabun' } }),
        ...series));

    const RD = window.ReactDOM;
    if (RD.createRoot) {
      if (!root || root.__el !== mount) { root = RD.createRoot(mount); root.__el = mount; }
      root.render(chart);
    } else {
      RD.render(chart, mount);
    }
  }

  function renderFallbackSvg(mount, data) {
    const W = 720, H = 260, P = 24;
    const max = Math.max(1, ...data.map((r) => r.onLeave));
    const bw = (W - P * 2) / data.length;
    const bars = data.map((r, i) => {
      const bh = (r.onLeave / max) * (H - P * 2);
      return `<rect x="${(P + i * bw + bw * 0.15).toFixed(1)}" y="${(H - P - bh).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${COLORS.onLeave}"><title>วันที่ ${r.day}: ${r.onLeave} คน</title></rect>` +
        (r.day % 5 === 1 ? `<text x="${(P + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" font-size="11" text-anchor="middle" fill="#64748b">${r.day}</text>` : '');
    }).join('');
    mount.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="100%" role="img" aria-label="จำนวนพนักงานที่ลารายวัน">
      <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="#e2e8f0"/>${bars}</svg>`;
  }

  async function renderRechartsDashboard() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    injectStyles();

    const requests = Array.isArray(window.leaveRequests) ? window.leaveRequests : [];
    const logins = await getLogins();
    const hasLogins = Array.isArray(logins) && logins.length > 0;
    const data = buildSeries(requests, hasLogins ? logins : null);
    const monthName = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

    let card = panel.querySelector('.rcs');
    if (!card) {
      panel.innerHTML = '<div class="rcs"><div class="rcs-kpis-slot"></div><div class="rcs-chart"></div><div class="rcs-note"></div></div>';
      card = panel.querySelector('.rcs');
      root = null;
    }
    card.querySelector('.rcs-kpis-slot').innerHTML = kpisHtml(data, hasLogins);
    card.querySelector('.rcs-note').textContent = `ข้อมูลเดือน${monthName} · นับเฉพาะใบลาที่อนุมัติแล้วสำหรับจำนวนพนักงานที่ลา`;

    const mount = card.querySelector('.rcs-chart');
    try {
      if (window.React && window.ReactDOM && window.Recharts && window.Recharts.ComposedChart) {
        renderWithRecharts(mount, data, hasLogins);
      } else {
        renderFallbackSvg(mount, data);
      }
    } catch (err) {
      console.warn('[RechartsSummary] Recharts render failed, using SVG fallback:', err);
      root = null;
      renderFallbackSvg(mount, data);
    }
  }

  renderRechartsDashboard.__pvt = true;
  window.renderRechartsDashboard = renderRechartsDashboard;

  // ถ้าข้อมูลถูกโหลดก่อนไฟล์นี้ ให้วาดทันที
  if (Array.isArray(window.leaveRequests)) renderRechartsDashboard();
})();
