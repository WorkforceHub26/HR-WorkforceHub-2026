/* ==========================================================================
   💬 PVT WORKFORCE HUB — ตัวนับการส่งข้อความ LINE ต่อเดือน (line-usage.js)
   --------------------------------------------------------------------------
   แสดงในคอนโซลผู้ดูแลระบบ (/pages/hr/admin-dashboard.html → <div id="lineUsageBody">)
   1) ตัวเลขจาก LINE โดยตรง: ใช้ไปเดือนนี้ / โควตา / คงเหลือ
        Edge Function line-send { action: 'quota' } → สำรอง GET /api/line-quota
   2) บันทึกของระบบ (ตาราง line_message_logs): แยกตามเรื่อง · สำเร็จ/ไม่สำเร็จ/ยังไม่ผูก LINE · ย้อนหลัง 6 เดือน
   ต้องรัน supabase/migrations/20261021_line_message_logs.sql และ deploy line-send เวอร์ชันใหม่
   ========================================================================== */
(function () {
  'use strict';
  if (window.PVTLineUsage) return;

  const HOST_ID = 'lineUsageBody';
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const GROUPS = [
    ['ใบลาใหม่ (ถึงผู้อนุมัติลำดับแรก)', ['NEW_REQUEST']],
    ['ส่งต่อผู้อนุมัติลำดับถัดไป', ['LEADER_APPROVED', 'MANAGER_APPROVED', 'EXECUTIVE_APPROVED', 'PENDING_HR', 'HR_REVIEW']],
    ['แจ้งพนักงาน: อนุมัติแล้ว', ['REQUEST_APPROVED', 'FINAL_APPROVED']],
    ['แจ้งพนักงาน: ไม่อนุมัติ', ['REJECTED']],
    ['ขอยกเลิกใบลา', ['CANCELLATION']],
    ['ทดสอบการส่ง', ['TEST']]
  ];

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sb = () => window.pvtSupabase?.getClient?.() || window.PVTSDK?.client || window.supabaseClient || null;
  const n = (v) => Number(v || 0).toLocaleString('th-TH');
  const pad = (x) => String(x).padStart(2, '0');
  const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  const monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return `${TH_M[m - 1]} ${String(y + 543).slice(-2)}`; };
  const groupOf = (type) => (GROUPS.find(([, ts]) => ts.includes(String(type || '').toUpperCase())) || ['อื่น ๆ'])[0];

  function injectStyle() {
    if (document.getElementById('lu-style')) return;
    const css = `
.lu{font-size:13.5px;color:#1e293b}
.lu-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.lu-stat{border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;background:#fff;min-width:0}
.lu-stat span{display:block;font-size:12.5px;font-weight:700;color:#475569}
.lu-stat strong{display:block;font-size:26px;font-weight:800;line-height:1.2;margin-top:4px;font-variant-numeric:tabular-nums;color:#0f172a}
.lu-stat small{display:block;font-size:12px;color:#64748b;margin-top:3px;line-height:1.45}
.lu-bar{height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin:14px 0 6px}
.lu-bar i{display:block;height:100%;border-radius:999px;transition:width .4s}
.lu-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:#64748b}
.lu-warn{margin:12px 0 0;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.5}
.lu-warn--amber{background:#fffbeb;border:1px solid #fde68a;color:#92400e}
.lu-warn--red{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.lu-warn--gray{background:#f8fafc;border:1px solid #e2e8f0;color:#475569}
.lu-cols{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:16px;margin-top:16px}
.lu h3{font-size:13.5px;font-weight:800;color:#334155;margin:0 0 8px}
.lu table{width:100%;border-collapse:collapse;font-size:13px}
.lu th,.lu td{padding:7px 9px;border-bottom:1px solid #f1f5f9;text-align:left}
.lu th{font-size:12px;color:#64748b;font-weight:700;background:#f8fafc}
.lu td.n,.lu th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.lu tfoot td{font-weight:800;border-top:1.5px solid #cbd5e1}
.lu-hist{display:flex;flex-direction:column;gap:7px}
.lu-hrow{display:grid;grid-template-columns:52px 1fr 64px;gap:8px;align-items:center;font-size:12.5px}
.lu-hrow .t{height:16px;border-radius:5px;background:#f1f5f9;overflow:hidden;display:flex}
.lu-hrow .t i{display:block;height:100%}
.lu-hrow b{text-align:right;font-variant-numeric:tabular-nums}
.lu-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11.5px;color:#64748b;margin-top:8px}
.lu-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.lu-note{font-size:12px;color:#64748b;margin:12px 0 0;line-height:1.55}
@media (max-width:900px){.lu-stats,.lu-cols{grid-template-columns:1fr}}
`;
    const el = document.createElement('style');
    el.id = 'lu-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ---------------------------------------------------------------- data
  async function fetchQuota() {
    try {
      const cfg = window.getSupabaseConfigs?.()?.activeConfig;
      if (cfg?.URL && cfg?.ANON_KEY) {
        const r = await fetch(`${cfg.URL}/functions/v1/line-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: cfg.ANON_KEY, Authorization: `Bearer ${cfg.ANON_KEY}` },
          body: JSON.stringify({ action: 'quota' })
        });
        const j = await r.json().catch(() => null);
        if (r.ok && j?.success) return j;
      }
    } catch (e) { /* ลองทาง server */ }
    try {
      const r = await fetch('/api/line-quota');
      const j = await r.json().catch(() => null);
      if (r.ok && j?.success) return j;
      return { success: false, error: j?.error || `HTTP ${r.status}` };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  }

  async function fetchLogs() {
    const c = sb();
    if (!c) return { rows: [], error: 'ยังเชื่อมต่อฐานข้อมูลไม่ได้' };
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const rows = [];
    // ดึงทีละ 1,000 แถว (ข้อจำกัดของ Supabase) สูงสุด 20,000 แถว
    for (let page = 0; page < 20; page++) {
      const { data, error } = await c.from('line_message_logs').select('sent_at, msg_type, result')
        .gte('sent_at', from.toISOString()).order('sent_at', { ascending: true }).range(page * 1000, page * 1000 + 999);
      if (error) {
        const missing = /does not exist|PGRST205|42P01|Could not find the table/i.test(`${error.code} ${error.message}`);
        return { rows, error: missing ? 'ยังไม่ได้รัน supabase/migrations/20261021_line_message_logs.sql' : error.message };
      }
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return { rows, error: null };
  }

  // ---------------------------------------------------------------- view
  function render(host, quota, logs) {
    const now = new Date();
    const curKey = monthKey(now);
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // บันทึกของระบบ
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    const perMonth = Object.fromEntries(months.map((k) => [k, { sent: 0, failed: 0, no_line: 0 }]));
    const byGroup = {};
    logs.rows.forEach((r) => {
      const k = monthKey(new Date(r.sent_at));
      if (perMonth[k] && perMonth[k][r.result] != null) perMonth[k][r.result]++;
      if (k === curKey) {
        const g = groupOf(r.msg_type);
        byGroup[g] = byGroup[g] || { sent: 0, failed: 0, no_line: 0 };
        if (byGroup[g][r.result] != null) byGroup[g][r.result]++;
      }
    });
    const cur = perMonth[curKey];

    // ตัวเลขจาก LINE
    const hasLine = quota && quota.success && quota.used != null;
    const used = hasLine ? Number(quota.used) : cur.sent;
    const limit = hasLine && quota.quotaType === 'limited' ? Number(quota.quota) : null;
    const left = limit != null ? Math.max(0, limit - used) : null;
    const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const projected = day > 0 ? Math.round((used / day) * daysInMonth) : used;
    const barColor = pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#0d9488';

    let warn = '';
    if (!hasLine) {
      warn = `<div class="lu-warn lu-warn--gray">ดึงตัวเลขจาก LINE ไม่ได้ (${esc(quota?.error || 'ไม่ทราบสาเหตุ')}) · ตัวเลข "ใช้ไป" ด้านบนนับจากบันทึกของระบบแทน · ตรวจว่า deploy Edge Function line-send เวอร์ชันใหม่แล้ว</div>`;
    } else if (limit && used >= limit) {
      warn = '<div class="lu-warn lu-warn--red"><b>ใช้ครบโควตาเดือนนี้แล้ว</b> · LINE จะไม่ส่งข้อความเพิ่มจนถึงวันที่ 1 เดือนหน้า (การแจ้งเตือนในระบบยังทำงานปกติ) · ปิดการแจ้งเตือน LINE บางขั้นได้ที่หน้าตั้งค่าการอนุมัติ หรืออัปเกรดแพ็กเกจ LINE OA</div>';
    } else if (limit && (pct >= 80 || projected > limit)) {
      warn = `<div class="lu-warn lu-warn--amber"><b>ใกล้ครบโควตา</b> · ใช้ไปแล้ว ${pct}% · คาดว่าสิ้นเดือนจะใช้ประมาณ ${n(projected)} ข้อความ (โควตา ${n(limit)}) · ปิดการแจ้งเตือน LINE บางขั้นได้ที่หน้าตั้งค่าการอนุมัติ</div>`;
    }
    if (logs.error) warn += `<div class="lu-warn lu-warn--gray">บันทึกของระบบ: ${esc(logs.error)}</div>`;

    const groupNames = [...GROUPS.map(([g]) => g), 'อื่น ๆ'].filter((g) => byGroup[g]);
    const tot = groupNames.reduce((a, g) => ({ sent: a.sent + byGroup[g].sent, failed: a.failed + byGroup[g].failed, no_line: a.no_line + byGroup[g].no_line }), { sent: 0, failed: 0, no_line: 0 });
    const maxMonth = Math.max(1, ...months.map((k) => perMonth[k].sent + perMonth[k].failed + perMonth[k].no_line));

    host.innerHTML = `<div class="lu">
      <div class="lu-stats">
        <div class="lu-stat"><span>ใช้ไปเดือนนี้${hasLine ? ' (ตัวเลขจาก LINE)' : ' (บันทึกของระบบ)'}</span>
          <strong>${n(used)}</strong>
          <small>${limit != null ? `จากโควตา ${n(limit)} ข้อความ` : hasLine ? 'แพ็กเกจไม่จำกัดจำนวนข้อความ' : 'ข้อความที่ส่งสำเร็จ'}</small></div>
        <div class="lu-stat"><span>คงเหลือเดือนนี้</span>
          <strong>${left != null ? n(left) : '—'}</strong>
          <small>คาดว่าสิ้นเดือนใช้ประมาณ ${n(projected)} · LINE เริ่มนับใหม่วันที่ 1</small></div>
        <div class="lu-stat"><span>บันทึกของระบบ เดือน${esc(TH_MONTH[now.getMonth()])}</span>
          <strong>${n(cur.sent)}</strong>
          <small>ส่งสำเร็จ · ไม่สำเร็จ ${n(cur.failed)} · ผู้รับยังไม่ผูก LINE ${n(cur.no_line)}</small></div>
      </div>
      ${limit ? `<div class="lu-bar" role="img" aria-label="ใช้ไป ${pct}% ของโควตา"><i style="width:${pct}%;background:${barColor}"></i></div>
        <div class="lu-meta"><span>ใช้ไป ${pct}% ของโควตา</span><span>${quota?.checkedAt ? `ตรวจล่าสุด ${new Date(quota.checkedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : ''}</span></div>` : ''}
      ${warn}
      <div class="lu-cols">
        <div>
          <h3>แยกตามเรื่อง (เดือนนี้)</h3>
          <div style="overflow-x:auto"><table>
            <thead><tr><th>เรื่อง</th><th class="n">สำเร็จ</th><th class="n">ไม่สำเร็จ</th><th class="n">ไม่ได้ผูก LINE</th></tr></thead>
            <tbody>${groupNames.length ? groupNames.map((g) => `<tr><td>${esc(g)}</td><td class="n">${n(byGroup[g].sent)}</td><td class="n">${n(byGroup[g].failed)}</td><td class="n">${n(byGroup[g].no_line)}</td></tr>`).join('')
              : '<tr><td colspan="4" style="text-align:center;color:#64748b;padding:16px">ยังไม่มีการส่งเดือนนี้</td></tr>'}</tbody>
            ${groupNames.length ? `<tfoot><tr><td>รวม</td><td class="n">${n(tot.sent)}</td><td class="n">${n(tot.failed)}</td><td class="n">${n(tot.no_line)}</td></tr></tfoot>` : ''}
          </table></div>
        </div>
        <div>
          <h3>ย้อนหลัง 6 เดือน (บันทึกของระบบ)</h3>
          <div class="lu-hist">${months.map((k) => {
            const m = perMonth[k];
            const w = (v) => `${(v / maxMonth) * 100}%`;
            return `<div class="lu-hrow"><span>${esc(monthLabel(k))}</span>
              <span class="t" title="สำเร็จ ${m.sent} · ไม่สำเร็จ ${m.failed} · ไม่ได้ผูก LINE ${m.no_line}"><i style="width:${w(m.sent)};background:#0d9488"></i><i style="width:${w(m.failed)};background:#dc2626"></i><i style="width:${w(m.no_line)};background:#cbd5e1"></i></span>
              <b>${n(m.sent)}</b></div>`;
          }).join('')}</div>
          <div class="lu-legend"><span><i style="background:#0d9488"></i>ส่งสำเร็จ</span><span><i style="background:#dc2626"></i>ไม่สำเร็จ</span><span><i style="background:#cbd5e1"></i>ไม่ได้ผูก LINE</span></div>
        </div>
      </div>
      <p class="lu-note">ตัวเลขจาก LINE นับทุกข้อความที่ส่งออกจาก LINE OA ในเดือนนี้ (รวมที่ส่งจาก LINE Official Account Manager)
        · บันทึกของระบบนับเฉพาะการแจ้งเตือนจากระบบใบลา และเริ่มนับตั้งแต่ติดตั้งตัวนับ · ข้อความตอบกลับตอนผูกบัญชี LINE ไม่เสียโควตา</p>
    </div>`;
  }

  async function refresh() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;
    injectStyle();
    if (!host.dataset.loaded) host.innerHTML = '<p style="color:#64748b;margin:0">กำลังโหลด...</p>';
    const [quota, logs] = await Promise.all([fetchQuota(), fetchLogs()]);
    host.dataset.loaded = '1';
    render(host, quota, logs);
  }

  window.PVTLineUsage = { refresh };

  function boot() {
    let tries = 0;
    const go = () => {
      if (sb()) { refresh(); return; }
      if (++tries < 40) setTimeout(go, 250);
    };
    if (document.getElementById(HOST_ID)) go();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
