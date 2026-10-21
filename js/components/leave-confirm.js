/* ==========================================================================
   ✍️ PVT WORKFORCE HUB — พนักงานยืนยันสรุปวันลา (leave-confirm.js)
   --------------------------------------------------------------------------
   รายเดือน : "แจ้งให้ทราบ" ไม่ต้องกด — การ์ดสรุปใบลาที่อนุมัติแล้วของเดือนที่ผ่านมา
              (เฉพาะคนที่มีรายการลา) · ทักท้วงได้ถึงวันที่ MONTH_DUE_DAY ของเดือนถัดไป
              (หรือ 7 วันหลังเห็นครั้งแรก ถ้าเห็นช้า) · ถ้าไม่ทักท้วง = ถือว่ารับทราบ
              ระบบบันทึก "seen" ให้อัตโนมัติเมื่อการ์ดแสดง · กด "รับทราบ" เพื่อปิดการ์ดได้ (ไม่บังคับ)
   รายปี    : กดยืนยันครั้งเดียวต่อปี — สรุปทั้งรอบปีการลา (1 ธ.ค. – 30 พ.ย.) + วันลาคงเหลือ
              "ทุกคนต้องยืนยัน" แม้ไม่ได้ลาเลย · เปิด 1 ธ.ค. · ครบกำหนด YEAR_DUE (ก่อน HR สรุปสิ้นปี)
   ถ้าข้อมูลการลาเปลี่ยนหลังแจ้ง/ยืนยัน (HR แก้ใบลา/ยอด) → แสดงใหม่ (ตรวจจาก fingerprint)
   พนักงานแจ้ง "ข้อมูลไม่ถูกต้อง" ได้ → HR ตรวจสอบ/แก้ แล้วกด "แก้ไขแล้ว" → พนักงานเห็นสรุปใหม่

   ฝั่งพนักงาน: ใส่ <div id="lcNotice" hidden></div> ในหน้า (ถ้าไม่มี จะแทรกบนสุดของ #pageContent)
   ฝั่ง HR   : window.PVTLeaveConfirm.openHrTracker()  (ปุ่มในหน้าระบบจัดการส่วนกลาง)
   ต้องรัน supabase/migrations/20261021_leave_confirmations.sql ก่อน

   🧪 โหมดทดสอบ (จำลองวันที่) — ใช้ได้เฉพาะฐานข้อมูล DEV ที่ไม่ใช่โปรเจกต์ MAIN
      เปิด:  เพิ่ม ?lc_test_date=2026-12-03 ท้าย URL หน้าใดก็ได้ (จำไว้จนปิดแท็บ)
      ปิด:   ?lc_test_date=off
      (บันทึกการยืนยันลบไม่ได้ จึงห้ามทดสอบบนฐานข้อมูลจริง)
   ========================================================================== */
(function () {
  'use strict';
  if (window.PVTLeaveConfirm) return;

  // ---------------------------------------------------------------- ตั้งค่า
  const FIRST_MONTH = '2026-10';   // เดือนแรกที่ต้องยืนยัน (เปิดยืนยัน 1 พ.ย. 2569)
  const FIRST_YEAR = 2026;         // รอบปีการลาแรกที่ต้องยืนยัน (ปีการลา 2569 · เปิดยืนยัน 1 ธ.ค. 2569)
  const MONTH_DUE_DAY = 7;         // รายเดือน: ทักท้วงได้ถึงวันที่ 7 ของเดือนถัดไป
  const LATE_SEEN_DAYS = 7;        // เห็นสรุปช้ากว่ากำหนด → ทักท้วงได้อีก 7 วันนับจากวันที่เห็น
  const YEAR_DUE = '12-15';        // ยืนยันรายปีภายใน 15 ธ.ค. (ก่อนสรุปสิ้นปี)
  const OPEN_MONTHS_BACK = 6;      // แสดงรายการค้างย้อนหลังไม่เกินกี่เดือน
  const TABLE = 'leave_confirmations';

  const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const BAL = [['ลาป่วย', 'sick'], ['ลากิจ', 'personal'], ['ลาพักร้อน', 'vacation'], ['ลาคลอด', 'maternity'], ['ลาอื่น ๆ', 'other']];

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sb = () => window.pvtSupabase?.getClient?.() || window.PVTSDK?.client || window.supabaseClient || null;
  const me = () => {
    try {
      const s = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}') || {};
      const e = s.employees || {};
      return { id: s.id || e.id || null, code: s.employee_code || e.employee_code || '', name: s.full_name || e.full_name || '', role: String(s.role || e.role || '').toLowerCase(), loginMethod: s.login_method || s.loginMethod || '' };
    } catch (e) { return {}; }
  };
  const isMissingTable = (err) => /does not exist|PGRST205|42P01|Could not find the table/i.test(`${err?.code} ${err?.message}`);

  // ---------------------------------------------------------------- วันที่ / รอบ
  const pad = (n) => String(n).padStart(2, '0');
  const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // 🧪 โหมดทดสอบ: จำลองวันที่ (เฉพาะ DEV ที่ไม่ใช่ฐานข้อมูล MAIN)
  const TEST_KEY = 'pvt_lc_test_date';
  function testEnvOk() {
    try {
      const cfg = window.getSupabaseConfigs?.();
      if (!cfg || cfg.activeEnv !== 'DEV') return false;
      const url = String(cfg.activeConfig?.URL || '');
      const mainUrl = String(cfg.allConfigs?.MAIN?.URL || '');
      return !!url && url !== mainUrl;
    } catch (e) { return false; }
  }
  const testState = { requested: null, active: null };
  (function readTestParam() {
    try {
      const v = new URLSearchParams(location.search).get('lc_test_date');
      if (v === 'off') sessionStorage.removeItem(TEST_KEY);
      else if (/^\d{4}-\d{2}-\d{2}$/.test(v || '')) sessionStorage.setItem(TEST_KEY, v);
      testState.requested = sessionStorage.getItem(TEST_KEY);
    } catch (e) {}
  })();
  function testDate() {
    if (!testState.requested) return null;
    testState.active = testEnvOk() ? testState.requested : null;
    return testState.active;
  }
  function testBanner() {
    if (!testState.requested) return '';
    return testDate()
      ? `<div class="lc-test">🧪 โหมดทดสอบ: จำลองวันที่ <b>${esc(thShort(testState.active))}</b> · ฐานข้อมูล DEV · ปิดด้วย ?lc_test_date=off</div>`
      : '<div class="lc-test lc-test--off">🧪 โหมดทดสอบใช้ได้เฉพาะฐานข้อมูล DEV (ไม่ใช่ฐานข้อมูลจริง) · ตอนนี้ใช้วันที่จริง</div>';
  }
  const today = () => testDate() || isoLocal(new Date());
  const thShort = (iso) => { if (!iso) return '-'; const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return `${d} ${TH_M[m - 1]} ${y + 543}`; };
  const thStamp = (ts) => { const d = new Date(ts); return isNaN(d) ? '-' : `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear() + 543} ${pad(d.getHours())}:${pad(d.getMinutes())} น.`; };

  function monthRange(key) {
    const [y, m] = key.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from: `${key}-01`, to: `${key}-${pad(last)}` };
  }
  function yearRange(y) { return { from: `${y - 1}-12-01`, to: `${y}-11-30` }; }
  function nextMonthKey(key) { const [y, m] = key.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; }
  function currentLeaveYear(iso) { const [y, m] = iso.split('-').map(Number); return m === 12 ? y + 1 : y; }

  const period = {
    month(key) {
      const [y, m] = key.split('-').map(Number);
      return { type: 'month', key, range: monthRange(key), label: `เดือน${TH_MONTH[m - 1]} ${y + 543}`, due: `${nextMonthKey(key)}-${pad(MONTH_DUE_DAY)}` };
    },
    year(y) {
      y = Number(y);
      return { type: 'year', key: String(y), year: y, range: yearRange(y), label: `ปีการลา ${y + 543}`, sub: `1 ธ.ค. ${y + 542} – 30 พ.ย. ${y + 543}`, due: `${y}-${YEAR_DUE}` };
    },
    of(type, key) { return type === 'year' ? this.year(key) : this.month(key); }
  };

  // รอบที่เปิดให้ยืนยันแล้ว ณ วันนี้ (เดือนที่จบแล้ว / ปีการลาที่จบแล้ว)
  function openPeriods(iso = today()) {
    const out = [];
    const curMonth = iso.slice(0, 7);
    const months = [];
    for (let k = FIRST_MONTH; k < curMonth; k = nextMonthKey(k)) months.push(k);
    months.slice(-OPEN_MONTHS_BACK).forEach((k) => out.push(period.month(k)));
    const lastYear = currentLeaveYear(iso) - 1;
    for (let y = Math.max(FIRST_YEAR, lastYear - 1); y <= lastYear; y++) out.push(period.year(y));
    return out;
  }

  // ---------------------------------------------------------------- ข้อมูล
  function chargeYear(lv) {
    if (typeof window.getLeaveChargeYear === 'function') return window.getLeaveChargeYear(lv);
    const cy = Number(lv.charge_year);
    if (cy > 1900) return cy > 2400 ? cy - 543 : cy;
    return currentLeaveYear(String(lv.start_date).slice(0, 10));
  }

  function inPeriod(lv, p) {
    if (p.type === 'year') return chargeYear(lv) === p.year;
    return String(lv.start_date) <= p.range.to && String(lv.end_date || lv.start_date) >= p.range.from;
  }

  // ใบลาที่อนุมัติแล้วของพนักงาน (คนเดียว หรือหลายคน) ในรอบ
  async function loadLeaves(c, p, employeeIds) {
    const from = p.type === 'year' ? `${p.year - 2}-12-01` : p.range.from; // ปี: ดึงกว้างไว้รวมใบที่ยืมสิทธิ์ข้ามปี
    const to = p.type === 'year' ? `${p.year + 1}-11-30` : p.range.to;
    let q = c.from('leave_requests').select('*, leave_types(leave_name, leave_code)')
      .eq('status', 'approved').lte('start_date', to).gte('end_date', from).order('start_date');
    if (employeeIds && employeeIds.length === 1) q = q.eq('employee_id', employeeIds[0]);
    const { data, error } = await q.limit(5000);
    if (error) throw error;
    return (data || []).filter((lv) => inPeriod(lv, p));
  }

  async function loadBalances(c, year, employeeIds) {
    let q = c.from('employee_leave_balances').select('*').eq('year', year);
    if (employeeIds && employeeIds.length === 1) q = q.eq('employee_id', employeeIds[0]);
    const { data, error } = await q.limit(5000);
    if (error) return {};
    const map = {};
    (data || []).forEach((b) => { map[String(b.employee_id)] = b; });
    return map;
  }

  function leaveRow(lv) {
    return {
      id: lv.id,
      type: lv.leave_types?.leave_name || 'ใบลา',
      start: String(lv.start_date).slice(0, 10),
      end: String(lv.end_date || lv.start_date).slice(0, 10),
      days: Number(lv.total_days) || 0,
      hours: Number(lv.leave_hours) || 0
    };
  }

  function balanceRows(b) {
    if (!b) return [];
    return BAL.map(([label, k]) => {
      const total = Number(b[`${k}_total`]) || 0;
      const used = Number(b[`${k}_used`]) || 0;
      return { label, total, used, left: Math.round((total - used) * 100) / 100 };
    }).filter((r) => r.total || r.used);
  }

  // ลายนิ้วมือข้อมูล: ใช้ตรวจว่าข้อมูลเปลี่ยนหลังยืนยันหรือไม่ (ต้องคำนวณแบบเดียวกันทั้งฝั่งพนักงานและ HR)
  function fingerprint(rows, bals) {
    const s = rows.map((r) => `${r.id}|${r.start}|${r.end}|${r.days}|${r.hours}`).sort().join(';') +
      '#' + (bals || []).map((b) => `${b.label}|${b.total}|${b.used}`).join(';');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return `v1-${h.toString(16)}-${rows.length}`;
  }

  const sumDays = (rows) => Math.round(rows.reduce((a, r) => a + r.days, 0) * 100) / 100;
  const fmtDays = (r) => (r.hours && !r.days ? `${r.hours} ชม.` : `${r.days} วัน${r.hours ? ` ${r.hours} ชม.` : ''}`);

  // ล่าสุดต่อ (พนักงาน, รอบ)
  function latestMap(rows) {
    const m = {};
    (rows || []).forEach((r) => {
      const k = `${r.employee_id}|${r.period_type}|${r.period_key}`;
      if (!m[k] || new Date(r.created_at) > new Date(m[k].created_at)) m[k] = r;
    });
    return m;
  }

  // สถานะของรอบนี้สำหรับพนักงานคนหนึ่ง
  //   ทั้งสองแบบ: missing · disputed · resolved · changed (ข้อมูลเปลี่ยนหลังแจ้ง/ยืนยัน)
  //   รายเดือน: done (กดรับทราบ) · seen (เปิดเห็นแล้ว) · notified (HR ส่งสรุปแล้ว)
  //   รายปี   : done (กดยืนยัน) · อื่น ๆ = ยังไม่ยืนยัน
  function stateOf(latest, fp, type) {
    if (!latest) return 'missing';
    if (latest.action === 'disputed') return 'disputed';
    if (latest.action === 'hr_resolved') return 'resolved';
    if (latest.fingerprint && latest.fingerprint !== fp) return 'changed';
    if (latest.action === 'confirmed') return 'done';
    if (type === 'month' && (latest.action === 'seen' || latest.action === 'notified')) return latest.action;
    return 'missing';
  }

  // ---------------------------------------------------------------- สไตล์
  function injectStyle() {
    if (document.getElementById('lc-style')) return;
    const css = `
.lc-card{margin:0 0 16px;padding:16px 18px;background:#fff;border:1.5px solid #fcd34d;border-radius:18px;box-shadow:0 1px 3px rgba(15,23,42,.05);font-family:inherit;display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
.lc-card.is-late{border-color:#fca5a5;background:#fffbfb}
.lc-card.is-wait{border-color:#bfdbfe}
.lc-ico{flex-shrink:0;width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#fef3c7;font-size:21px}
.lc-card.is-late .lc-ico{background:#fee2e2}.lc-card.is-wait .lc-ico{background:#dbeafe}
.lc-txt{flex:1 1 240px;min-width:0}
.lc-txt h3{margin:0;font-size:15.5px;font-weight:800;color:#0f172a;line-height:1.4}
.lc-txt p{margin:3px 0 0;font-size:13px;color:#475569;line-height:1.55}
.lc-txt .lc-due{font-weight:700;color:#b45309}.lc-card.is-late .lc-due{color:#b91c1c}
.lc-btn{align-self:center;border:0;border-radius:12px;padding:10px 16px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;background:var(--th-p-600,#0d9488);color:#fff;white-space:nowrap}
.lc-btn:hover{filter:brightness(.95)}.lc-btn:focus-visible{outline:2px solid #0f172a;outline-offset:2px}
.lc-btn--ghost{background:#fff;color:#b45309;border:1.5px solid #fcd34d}
.lc-acts{display:flex;gap:8px;align-self:center;flex-wrap:wrap}
.lc-card.is-info{border-color:#bae6fd}.lc-card.is-info .lc-ico{background:#e0f2fe}
.lc-list{margin:6px 0 0;padding-left:18px;font-size:13px;color:#334155;line-height:1.6}
.lc-hint{font-size:12.5px!important;color:#64748b!important}
.lc-m{text-align:left;font-size:14px;color:#1e293b;line-height:1.55}
.lc-m h4{margin:14px 0 6px;font-size:13.5px;font-weight:800;color:#334155}
.lc-m table{width:100%;border-collapse:collapse;font-size:13.5px}
.lc-m th,.lc-m td{border:1px solid #e2e8f0;padding:7px 9px;text-align:left}
.lc-m th{background:#f8fafc;font-weight:700;color:#475569;font-size:12.5px}
.lc-m td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.lc-m .lc-empty{padding:14px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;color:#475569;background:#f8fafc}
.lc-m .lc-sum{margin-top:6px;font-size:13px;color:#475569}
.lc-m .lc-decl{margin:14px 0 0;padding:12px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;font-size:13.5px}
.lc-m .lc-warn{margin:0 0 10px;padding:9px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;font-size:13px;color:#92400e}
.lc-m textarea{width:100%;min-height:90px;padding:10px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;font-size:14px;box-sizing:border-box}
.lc-tw{overflow-x:auto}
.lc-test{margin:0 0 12px;padding:9px 14px;border-radius:12px;background:#fef9c3;border:1px dashed #ca8a04;color:#713f12;font-size:13px;line-height:1.5}
.lc-test--off{background:#fee2e2;border-color:#dc2626;color:#7f1d1d}
/* HR tracker */
.lch{text-align:left;font-size:13.5px;color:#1e293b}
.lch-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
.lch-bar select,.lch-bar input{height:38px;padding:0 10px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;font-size:14px;background:#fff;min-width:0}
.lch-bar input{flex:1 1 180px}
.lch-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.lch-chip{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#334155}
.lch-chip b{margin-left:4px;font-variant-numeric:tabular-nums}
.lch-chip[aria-pressed="true"]{background:#0f172a;border-color:#0f172a;color:#fff}
.lch-note{font-size:12.5px;color:#64748b;margin:0 0 10px}
.lch-tw{overflow:auto;max-height:55vh;border:1px solid #e2e8f0;border-radius:12px}
.lch table{width:100%;border-collapse:collapse;font-size:13px}
.lch th{position:sticky;top:0;background:#f1f5f9;text-align:left;padding:8px 10px;font-weight:700;color:#475569;white-space:nowrap;z-index:1}
.lch td{padding:8px 10px;border-top:1px solid #f1f5f9;vertical-align:top}
.lch td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.lch .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.pill-done{background:#dcfce7;color:#166534}.pill-missing{background:#f1f5f9;color:#475569}.pill-late{background:#fee2e2;color:#991b1b}
.pill-disputed{background:#fef3c7;color:#92400e}.pill-changed{background:#ede9fe;color:#5b21b6}.pill-resolved{background:#dbeafe;color:#1e40af}
.lch .sub{display:block;font-size:12px;color:#64748b;margin-top:2px}
.lch .act{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:#0f172a}
.lch .resolve{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.lch .resolve input{flex:1 1 160px;height:32px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px;font:inherit;font-size:13px}
.lch-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center;margin-top:10px}
.lch-foot button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.lch-foot .primary{background:var(--th-p-600,#0d9488);border-color:var(--th-p-600,#0d9488);color:#fff}
.lch-msg{font-size:12.5px;color:#475569}
`;
    const el = document.createElement('style');
    el.id = 'lc-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ================================================================ ฝั่งพนักงาน
  const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return isoLocal(new Date(y, m - 1, d + n)); };

  async function employeeTasks() {
    const c = sb();
    const u = me();
    if (!c || !u.id) return null;
    const { data: conf, error } = await c.from(TABLE).select('*').eq('employee_id', u.id).order('created_at', { ascending: false }).limit(300);
    if (error) {
      if (!isMissingTable(error)) console.warn('[LeaveConfirm] โหลดประวัติการยืนยันไม่สำเร็จ:', error.message);
      return null;
    }
    const latest = latestMap(conf);
    const now = today();
    const tasks = [];
    for (const p of openPeriods()) {
      const rows = (await loadLeaves(c, p, [u.id])).filter((lv) => String(lv.employee_id) === String(u.id)).map(leaveRow);
      if (p.type === 'month' && !rows.length) continue; // รายเดือน: ไม่มีรายการลา ไม่ต้องแจ้ง
      const bals = p.type === 'year' ? balanceRows((await loadBalances(c, p.year, [u.id]))[String(u.id)]) : [];
      const fp = fingerprint(rows, bals);
      const last = latest[`${u.id}|${p.type}|${p.key}`] || null;
      const st = stateOf(last, fp, p.type);
      if (st === 'done') continue;
      const t = { p, rows, bals, fp, state: st, last };
      if (p.type === 'month' && st !== 'disputed') {
        // ช่วงทักท้วง: ถึงวันครบกำหนด หรือ 7 วันหลังเห็นครั้งแรก (ถ้าเห็นช้า)
        const seenAt = (st === 'seen' || st === 'notified') ? isoLocal(new Date(last.created_at)) : now;
        t.until = [p.due, addDaysIso(seenAt, LATE_SEEN_DAYS)].sort().pop();
        if (now > t.until) continue;          // พ้นช่วงทักท้วง → ถือว่ารับทราบ
      }
      tasks.push(t);
    }
    // ปีก่อน → เดือนเก่าก่อน
    return tasks.sort((a, b) => (a.p.type === b.p.type ? a.p.key.localeCompare(b.p.key) : a.p.type === 'year' ? -1 : 1));
  }

  const leaveLine = (r) => `${r.type} ${thShort(r.start)}${r.end !== r.start ? ` – ${thShort(r.end)}` : ''} (${fmtDays(r)})`;

  function cardHtml(t, i) {
    if (t.state === 'disputed') {
      return `<div class="lc-card is-wait"><div class="lc-ico" aria-hidden="true">📨</div><div class="lc-txt">
        <h3>แจ้งแก้ไขสรุปการลา${esc(t.p.label)} แล้ว</h3>
        <p>ฝ่ายบุคคลกำลังตรวจสอบ เมื่อแก้ไขเสร็จระบบจะแสดงสรุปใหม่ให้คุณ</p></div></div>`;
    }
    const why = t.state === 'changed' ? 'ข้อมูลการลามีการเปลี่ยนแปลง · ' : t.state === 'resolved' ? `ฝ่ายบุคคลแก้ไขตามที่แจ้งแล้ว${t.last?.note ? ` (${t.last.note})` : ''} · ` : '';
    if (t.p.type === 'month') {
      const shown = t.rows.slice(0, 4).map((r) => `<li>${esc(leaveLine(r))}</li>`).join('');
      const more = t.rows.length > 4 ? `<li>และอีก ${t.rows.length - 4} รายการ</li>` : '';
      return `<div class="lc-card is-info"><div class="lc-ico" aria-hidden="true">🗓️</div><div class="lc-txt">
        <h3>สรุปการลา${esc(t.p.label)}</h3>
        <p>${esc(why)}ใบลาที่อนุมัติแล้ว ${t.rows.length} รายการ รวม ${sumDays(t.rows)} วัน</p>
        <ul class="lc-list">${shown}${more}</ul>
        <p class="lc-hint">ถ้าไม่ถูกต้อง กด "แจ้งแก้ไข" ได้ถึง ${esc(thShort(t.until))} · ถ้าไม่แจ้ง ถือว่ารับทราบ</p></div>
        <div class="lc-acts"><button type="button" class="lc-btn lc-btn--ghost" data-lc="${i}" data-act="dispute">แจ้งแก้ไข</button>
        <button type="button" class="lc-btn" data-lc="${i}" data-act="ack">รับทราบ</button></div></div>`;
    }
    const late = today() > t.p.due;
    const n = t.rows.length;
    const what = n ? `ใบลาที่อนุมัติแล้ว ${n} รายการ รวม ${sumDays(t.rows)} วัน พร้อมวันลาคงเหลือ` : 'ทั้งปีไม่มีรายการลา · ตรวจสอบวันลาคงเหลือแล้วกดยืนยัน';
    return `<div class="lc-card${late ? ' is-late' : ''}"><div class="lc-ico" aria-hidden="true">✍️</div><div class="lc-txt">
      <h3>ยืนยันสรุปการลา${esc(t.p.label)}</h3>
      <p>${esc(why)}${esc(what)}<br><span class="lc-due">${late ? `เลยกำหนดยืนยัน (${esc(thShort(t.p.due))}) แล้ว` : `กรุณายืนยันภายใน ${esc(thShort(t.p.due))}`}</span></p></div>
      <div class="lc-acts"><button type="button" class="lc-btn" data-lc="${i}" data-act="open">ตรวจสอบและยืนยัน</button></div></div>`;
  }

  function detailHtml(t) {
    const u = me();
    const rows = t.rows.map((r) => `<tr><td>${esc(r.type)}</td><td>${esc(thShort(r.start))}${r.end !== r.start ? ` – ${esc(thShort(r.end))}` : ''}</td><td class="n">${esc(fmtDays(r))}</td></tr>`).join('');
    const leaves = t.rows.length
      ? `<div class="lc-tw"><table><thead><tr><th>ประเภทการลา</th><th>วันที่</th><th style="text-align:right">จำนวน</th></tr></thead><tbody>${rows}</tbody></table></div>
         <div class="lc-sum">รวม ${t.rows.length} รายการ · ${sumDays(t.rows)} วัน</div>`
      : `<div class="lc-empty">${t.p.type === 'year' ? 'ตลอดปีการลานี้ ไม่มีรายการลาที่อนุมัติ' : 'ไม่มีรายการลา'}</div>`;
    const bals = t.p.type === 'year'
      ? `<h4>วันลาคงเหลือ ณ สิ้นปีการลา</h4>${t.bals.length
        ? `<div class="lc-tw"><table><thead><tr><th>ประเภท</th><th style="text-align:right">สิทธิ์</th><th style="text-align:right">ใช้ไป</th><th style="text-align:right">คงเหลือ</th></tr></thead><tbody>${t.bals.map((b) => `<tr><td>${esc(b.label)}</td><td class="n">${b.total}</td><td class="n">${b.used}</td><td class="n"><b>${b.left}</b></td></tr>`).join('')}</tbody></table></div>`
        : '<div class="lc-empty">ไม่พบข้อมูลสิทธิ์วันลาของปีนี้ ถ้าไม่ถูกต้องให้กด "แจ้งแก้ไข"</div>'}`
      : '';
    const warn = t.state === 'changed' ? '<p class="lc-warn">ข้อมูลการลามีการเปลี่ยนแปลงหลังจากที่คุณเคยยืนยันไว้ กรุณาตรวจสอบอีกครั้ง</p>'
      : t.state === 'resolved' ? `<p class="lc-warn">ฝ่ายบุคคลตรวจสอบตามที่คุณแจ้งแล้ว${t.last?.note ? `: ${esc(t.last.note)}` : ''}</p>` : '';
    return `<div class="lc-m">${warn}
      <div><b>${esc(t.p.label)}</b>${t.p.sub ? ` <span style="color:#64748b">(${esc(t.p.sub)})</span>` : ''}</div>
      <h4>รายการลาที่อนุมัติแล้ว</h4>${leaves}${bals}
      <p class="lc-decl">เมื่อกด “ยืนยันว่าถูกต้อง” ข้าพเจ้า <b>${esc(u.name || u.code)}</b> รับรองว่าได้ตรวจสอบรายการข้างต้นแล้ว
        ${t.rows.length ? 'เป็นการลาของข้าพเจ้าจริง และ' : ''}ข้อมูลถูกต้องครบถ้วน</p>
    </div>`;
  }

  async function saveAction(t, action, note) {
    const c = sb();
    const u = me();
    const row = {
      employee_id: u.id,
      period_type: t.p.type,
      period_key: t.p.key,
      action,
      leave_count: t.rows.length,
      total_days: sumDays(t.rows),
      fingerprint: t.fp,
      snapshot: { period: t.p.label, range: t.p.range, employee: { code: u.code, name: u.name }, leaves: t.rows, balances: t.bals },
      note: note || null,
      actor_id: u.id,
      actor_name: u.name || u.code,
      user_agent: navigator.userAgent.slice(0, 400),
      device_info: { platform: navigator.platform || '', language: navigator.language || '', screen: `${screen.width}x${screen.height}`, login_method: u.loginMethod || null }
    };
    const { error } = await c.from(TABLE).insert(row);
    if (error) throw error;
    if (action === 'disputed') {
      // แจ้ง HR ในระบบ (ไม่ส่ง LINE)
      try {
        const hrs = window.PVTLeaveAudit ? await window.PVTLeaveAudit.hrRecipients() : [];
        if (hrs.length) {
          await c.from('notifications').insert(hrs.map((h) => ({
            employee_id: h.id,
            title: `แจ้งแก้ไขสรุปวันลา: ${u.name || u.code}`,
            message: `${t.p.label}\nรายละเอียด: ${note}`,
            type: 'leave_confirm',
            link_url: `/pages/hr/management.html?open=leave-confirm&type=${t.p.type}&key=${encodeURIComponent(t.p.key)}`
          })));
        }
      } catch (e) { /* แจ้งไม่ได้ก็ยังบันทึกคำขอแล้ว */ }
    }
  }

  async function askDispute(t) {
    const list = t.rows.length ? `<ul class="lc-list">${t.rows.map((r) => `<li>${esc(leaveLine(r))}</li>`).join('')}</ul>` : '';
    const d = await window.Swal.fire({
      title: `แจ้งแก้ไขสรุปการลา${t.p.label}`,
      html: `<div class="lc-m">${list}<p style="margin:8px 0">ระบุว่ารายการไหนไม่ถูกต้อง เช่น วันที่ จำนวนวัน หรือไม่ได้ลาวันนั้น</p><textarea id="lcNote" maxlength="1000" placeholder="รายละเอียด"></textarea></div>`,
      showCancelButton: true,
      confirmButtonText: 'ส่งให้ฝ่ายบุคคล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#b45309',
      preConfirm: () => {
        const v = String(document.getElementById('lcNote')?.value || '').trim();
        if (v.length < 5) { window.Swal.showValidationMessage('กรุณาระบุรายละเอียดอย่างน้อย 5 ตัวอักษร'); return false; }
        return v;
      }
    });
    if (!d.isConfirmed) return;
    await saveAction(t, 'disputed', d.value);
    await window.Swal.fire({ icon: 'info', title: 'ส่งให้ฝ่ายบุคคลแล้ว', text: 'เมื่อตรวจสอบเสร็จ ระบบจะแสดงสรุปใหม่ให้คุณ', confirmButtonText: 'ตกลง' });
  }

  async function openTask(t, act, rerender) {
    if (!window.Swal) { alert('กรุณารีเฟรชหน้าเว็บแล้วลองใหม่'); return; }
    try {
      if (t.p.type === 'month') {
        if (act === 'ack') {
          await saveAction(t, 'confirmed');
          window.Swal.fire({ icon: 'success', title: 'รับทราบแล้ว', timer: 1200, showConfirmButton: false });
        } else {
          await askDispute(t);
        }
      } else {
        const res = await window.Swal.fire({
          title: 'ยืนยันสรุปการลาประจำปี',
          html: detailHtml(t),
          width: 640,
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'ยืนยันว่าถูกต้อง',
          denyButtonText: 'แจ้งแก้ไข',
          cancelButtonText: 'ไว้ทีหลัง',
          confirmButtonColor: 'var(--th-p-600, #0d9488)',
          denyButtonColor: '#b45309',
          focusConfirm: false
        });
        if (res.isConfirmed) {
          await saveAction(t, 'confirmed');
          await window.Swal.fire({ icon: 'success', title: 'ยืนยันเรียบร้อย', text: `บันทึกการยืนยันสรุปการลา${t.p.label}แล้ว`, timer: 1800, showConfirmButton: false });
        } else if (res.isDenied) {
          await askDispute(t);
        }
      }
    } catch (err) {
      window.Swal.fire('บันทึกไม่สำเร็จ', err.message || String(err), 'error');
    }
    rerender();
  }

  async function mountEmployee() {
    let host = document.getElementById('lcNotice');
    if (!host) {
      const page = document.getElementById('pageContent');
      if (!page) return;
      host = document.createElement('div');
      host.id = 'lcNotice';
      host.hidden = true;
      page.insertBefore(host, page.firstChild);
    }
    injectStyle();
    const render = async () => {
      let tasks = null;
      try { tasks = await employeeTasks(); } catch (err) { console.warn('[LeaveConfirm]', err?.message || err); }
      const banner = testBanner();
      if (!tasks || !tasks.length) {
        host.innerHTML = banner ? `${banner}${tasks ? `<div class="lc-test">ไม่มีรอบที่ต้องยืนยัน ณ ${testState.active ? 'วันที่จำลองนี้' : 'วันนี้'}</div>` : '<div class="lc-test lc-test--off">โหลดข้อมูลการยืนยันไม่ได้ (รัน SQL migration แล้วหรือยัง?)</div>'}` : '';
        host.hidden = !banner;
        return;
      }
      host.innerHTML = banner + tasks.map(cardHtml).join('');
      host.hidden = false;
      host.querySelectorAll('[data-lc]').forEach((b) => b.addEventListener('click', () => openTask(tasks[Number(b.dataset.lc)], b.dataset.act, render)));
      // รายเดือน: บันทึกว่า "เห็นสรุปแล้ว" (ครั้งเดียวต่อชุดข้อมูล) — เป็นหลักฐานว่าแจ้งพนักงานแล้ว
      tasks.filter((t) => t.p.type === 'month' && ['missing', 'notified', 'changed', 'resolved'].includes(t.state)).forEach((t) => {
        saveAction(t, 'seen').then(() => { t.state = 'seen'; }).catch((err) => console.warn('[LeaveConfirm] บันทึกการเห็นสรุปไม่สำเร็จ:', err?.message || err));
      });
    };
    await render();
  }

  // ================================================================ ฝั่ง HR
  const STATE_TEXT = { done: 'ยืนยันแล้ว', missing: 'ยังไม่ยืนยัน', late: 'เลยกำหนด', disputed: 'แจ้งแก้ไข', changed: 'ข้อมูลเปลี่ยนหลังยืนยัน', resolved: 'รอพนักงานยืนยันใหม่' };
  // รายเดือน (แจ้งให้ทราบ)
  const MONTH_TEXT = { done: 'กดรับทราบแล้ว', seen: 'เห็นสรุปแล้ว', notified: 'ส่งสรุปแล้ว', missing: 'ยังไม่เห็นสรุป', disputed: 'แจ้งแก้ไข', changed: 'ข้อมูลเปลี่ยนหลังแจ้ง', resolved: 'แก้ไขแล้ว รอพนักงานเห็นสรุปใหม่' };
  const MONTH_ACK = ['done', 'seen', 'notified'];
  // รายเดือน: ช่วงทักท้วงสิ้นสุด = วันครบกำหนด หรือ 7 วันหลังแจ้ง/เห็น (ถ้าแจ้งช้า)
  const disputeUntil = (r, p) => {
    const at = r?.last?.created_at ? isoLocal(new Date(r.last.created_at)) : today();
    const [y, m, d] = at.split('-').map(Number);
    return [p.due, isoLocal(new Date(y, m - 1, d + LATE_SEEN_DAYS))].sort().pop();
  };
  const stateText = (st, p, r) => {
    if (p.type !== 'month') return STATE_TEXT[st];
    if (st === 'seen' || st === 'notified') {
      const until = disputeUntil(r, p);
      return today() > until ? `${MONTH_TEXT[st]} · ถือว่ารับทราบ` : `${MONTH_TEXT[st]} · ทักท้วงได้ถึง ${thShort(until)}`;
    }
    return MONTH_TEXT[st];
  };
  const pillClass = (st) => (st === 'seen' || st === 'notified' ? 'done' : st);
  const isTodo = (st, p) => (p.type === 'month' ? !MONTH_ACK.includes(st) : st !== 'done');

  async function hrData(p) {
    const c = sb();
    const [empRes, leaves, confRes, balMap] = await Promise.all([
      c.from('employees').select('id, employee_code, full_name, status, start_date, departments!department_id(department_name)').limit(5000),
      loadLeaves(c, p),
      c.from(TABLE).select('*').eq('period_type', p.type).eq('period_key', p.key).order('created_at', { ascending: false }).limit(10000),
      p.type === 'year' ? loadBalances(c, p.year) : Promise.resolve({})
    ]);
    if (empRes.error) throw empRes.error;
    if (confRes.error) throw confRes.error;
    const latest = latestMap(confRes.data);
    const byEmp = {};
    leaves.forEach((lv) => { (byEmp[String(lv.employee_id)] = byEmp[String(lv.employee_id)] || []).push(leaveRow(lv)); });
    const late = today() > p.due;
    const out = [];
    (empRes.data || []).forEach((e) => {
      const id = String(e.id);
      const active = !e.status || String(e.status).toLowerCase() === 'active';
      const rows = byEmp[id] || [];
      const last = latest[`${id}|${p.type}|${p.key}`] || null;
      const required = p.type === 'month' ? rows.length > 0 : (!e.start_date || String(e.start_date) <= p.range.to);
      if (!active && !last) return;          // พ้นสภาพและไม่เคยยืนยัน → ไม่แสดง
      if (!required && !last) return;
      const bals = p.type === 'year' ? balanceRows(balMap[id]) : [];
      const fp = fingerprint(rows, bals);
      let st = stateOf(last, fp, p.type);
      if (p.type === 'year' && st === 'missing' && late) st = 'late';
      out.push({ e, rows, bals, fp, last, state: st, days: sumDays(rows) });
    });
    const order = { disputed: 0, late: 1, changed: 2, resolved: 3, missing: 4, notified: 5, seen: 6, done: 7 };
    return out.sort((a, b) => order[a.state] - order[b.state] || String(a.e.employee_code).localeCompare(String(b.e.employee_code)));
  }

  function periodOptions() {
    const now = today();
    const months = [];
    for (let k = FIRST_MONTH; k < now.slice(0, 7); k = nextMonthKey(k)) months.push(period.month(k));
    const years = [];
    for (let y = FIRST_YEAR; y <= currentLeaveYear(now) - 1; y++) years.push(period.year(y));
    return { months: months.reverse(), years: years.reverse() };
  }

  async function openHrTracker(opts = {}) {
    if (!window.Swal) return;
    injectStyle();
    const opt = periodOptions();
    const state = {
      type: opts.type || (opt.months.length || !opt.years.length ? 'month' : 'year'),
      key: opts.key || null, filter: 'todo', q: '', rows: [], p: null, msg: ''
    };
    const keysFor = (type) => (type === 'year' ? opt.years : opt.months);
    if (!state.key || !keysFor(state.type).some((x) => x.key === state.key)) state.key = keysFor(state.type)[0]?.key || null;

    const body = () => document.getElementById('lchBody');
    const csvCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

    function view() {
      const el = body();
      if (!el) return;
      if (!state.key) { el.innerHTML = `<p class="lch-note">ยังไม่มีรอบให้ยืนยัน · รอบแรก: เดือนตุลาคม 2569 (เปิดยืนยัน 1 พ.ย. 2569) และปีการลา 2569 (เปิดยืนยัน 1 ธ.ค. 2569)</p>`; return; }
      const p = state.p;
      const isMonth = p.type === 'month';
      const counts = { all: state.rows.length, todo: 0, ack: 0 };
      state.rows.forEach((r) => {
        counts[r.state] = (counts[r.state] || 0) + 1;
        if (isTodo(r.state, p)) counts.todo++; else counts.ack++;
      });
      const chip = (id, label) => `<button type="button" class="lch-chip" data-f="${id}" aria-pressed="${state.filter === id}">${label}<b>${counts[id] || 0}</b></button>`;
      const q = state.q.trim().toLowerCase();
      const match = (r) => state.filter === 'all' || (state.filter === 'todo' ? isTodo(r.state, p) : state.filter === 'ack' ? !isTodo(r.state, p) : r.state === state.filter);
      const list = state.rows.filter((r) => match(r) &&
        (!q || `${r.e.employee_code} ${r.e.full_name} ${r.e.departments?.department_name || ''}`.toLowerCase().includes(q)));
      const notConfirmed = state.rows.filter((r) => (isMonth ? ['missing', 'changed', 'resolved'] : ['missing', 'late', 'changed', 'resolved']).includes(r.state)).length;
      const chips = isMonth
        ? `${chip('todo', 'ต้องติดตาม')}${chip('ack', 'แจ้งแล้ว / รับทราบ')}${chip('missing', 'ยังไม่เห็นสรุป')}${chip('disputed', 'แจ้งแก้ไข')}${chip('changed', 'ข้อมูลเปลี่ยน')}${chip('all', 'ทั้งหมด')}`
        : `${chip('todo', 'ต้องติดตาม')}${chip('done', 'ยืนยันแล้ว')}${chip('disputed', 'แจ้งแก้ไข')}${chip(today() > p.due ? 'late' : 'missing', today() > p.due ? 'เลยกำหนด' : 'ยังไม่ยืนยัน')}${chip('resolved', 'รอยืนยันใหม่')}${chip('changed', 'ข้อมูลเปลี่ยน')}${chip('all', 'ทั้งหมด')}`;
      el.innerHTML = `
        <p class="lch-note">${esc(p.label)}${p.sub ? ` (${esc(p.sub)})` : ''} ·
          ${isMonth
            ? `แจ้งให้ทราบ ไม่ต้องกดยืนยัน · เฉพาะพนักงานที่มีใบลาอนุมัติในเดือนนี้ · ทักท้วงได้ถึง ${esc(thShort(p.due))} (เห็นช้า: 7 วันหลังเห็น) · ไม่ทักท้วง = ถือว่ารับทราบ`
            : `ครบกำหนดยืนยัน ${esc(thShort(p.due))} · พนักงานทุกคนต้องกดยืนยัน รวมถึงคนที่ไม่ได้ลา`}</p>
        <div class="lch-chips">${chips}</div>
        <div class="lch-tw"><table>
          <thead><tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>แผนก</th><th style="text-align:right">ใบลา</th><th>สถานะ</th></tr></thead>
          <tbody>${list.length ? list.map((r) => `
            <tr>
              <td>${esc(r.e.employee_code)}</td>
              <td>${esc(r.e.full_name)}</td>
              <td>${esc(r.e.departments?.department_name || '-')}</td>
              <td class="n">${r.rows.length} · ${r.days} วัน</td>
              <td><span class="pill pill-${pillClass(r.state)}">${esc(stateText(r.state, p, r))}</span>
                ${r.last ? `<span class="sub">${esc(r.last.action === 'hr_resolved' ? `HR: ${r.last.actor_name || ''}` : '')} ${esc(thStamp(r.last.created_at))}</span>` : ''}
                ${r.state === 'disputed' ? `<span class="sub">“${esc(r.last.note || '')}”</span>
                  <div class="resolve"><input type="text" placeholder="สิ่งที่แก้ไข (จะแจ้งพนักงาน)" data-note="${esc(r.e.id)}" maxlength="300">
                  <button type="button" class="act" data-resolve="${esc(r.e.id)}">${isMonth ? 'แก้ไขแล้ว · แจ้งพนักงาน' : 'แก้ไขแล้ว · ให้ยืนยันใหม่'}</button></div>` : ''}
              </td>
            </tr>`).join('') : '<tr><td colspan="5" style="text-align:center;color:#64748b;padding:20px">ไม่มีรายการ</td></tr>'}</tbody>
        </table></div>
        <div class="lch-foot">
          <span class="lch-msg">${esc(state.msg)}</span>
          <span style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" data-csv>ส่งออก CSV</button>
            <button type="button" class="primary" data-remind ${notConfirmed ? '' : 'disabled'}>${isMonth ? `ส่งสรุปให้คนที่ยังไม่เห็น (${notConfirmed} คน)` : `แจ้งเตือนคนที่ยังไม่ยืนยัน (${notConfirmed} คน)`}</button>
          </span>
        </div>`;
      el.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.f; view(); }));
      el.querySelectorAll('[data-resolve]').forEach((b) => b.addEventListener('click', () => resolve(b.dataset.resolve)));
      el.querySelector('[data-csv]').addEventListener('click', exportCsv);
      el.querySelector('[data-remind]').addEventListener('click', remind);
    }

    async function load() {
      const el = body();
      if (!state.key) { view(); return; }
      state.p = period.of(state.type, state.key);
      el.innerHTML = '<p class="lch-note">กำลังโหลด...</p>';
      try {
        state.rows = await hrData(state.p);
      } catch (err) {
        el.innerHTML = `<p class="lch-note" style="color:#b91c1c">${isMissingTable(err) ? 'ยังไม่ได้รัน supabase/migrations/20261021_leave_confirmations.sql' : esc(err.message || err)}</p>`;
        return;
      }
      view();
    }

    async function resolve(empId) {
      const r = state.rows.find((x) => String(x.e.id) === String(empId));
      if (!r) return;
      const note = String(document.querySelector(`[data-note="${CSS.escape(String(empId))}"]`)?.value || '').trim();
      const u = me();
      const c = sb();
      try {
        const { error } = await c.from(TABLE).insert({
          employee_id: r.e.id, period_type: state.p.type, period_key: state.p.key, action: 'hr_resolved',
          leave_count: r.rows.length, total_days: r.days, note: note || 'ฝ่ายบุคคลตรวจสอบแล้ว',
          actor_id: u.id, actor_name: u.name || u.code, user_agent: navigator.userAgent.slice(0, 400)
        });
        if (error) throw error;
        await c.from('notifications').insert({
          employee_id: r.e.id,
          title: `ฝ่ายบุคคลตรวจสอบสรุปวันลา${state.p.label}แล้ว`,
          message: `${note || 'ตรวจสอบตามที่คุณแจ้งแล้ว'}\n${state.p.type === 'month' ? 'ดูสรุปการลาที่แก้ไขแล้วได้ที่หน้าหลัก' : 'กรุณาเข้าระบบเพื่อยืนยันสรุปการลาอีกครั้ง'}`,
          type: 'leave_confirm',
          link_url: '/pages/user/index-user.html'
        });
        state.msg = state.p.type === 'month' ? `บันทึกแล้ว: แจ้ง ${r.e.full_name} แล้ว` : `บันทึกแล้ว: ${r.e.full_name} ต้องยืนยันใหม่`;
        window.PVTHrInbox?.refresh?.();
        await load();
      } catch (err) {
        state.msg = `บันทึกไม่สำเร็จ: ${err.message || err}`;
        view();
      }
    }

    async function remind() {
      const isMonth = state.p.type === 'month';
      const targets = state.rows.filter((r) => (isMonth ? ['missing', 'changed', 'resolved'] : ['missing', 'late', 'changed', 'resolved']).includes(r.state));
      if (!targets.length) return;
      const btn = body().querySelector('[data-remind]');
      if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.textContent = `กดอีกครั้งเพื่อส่งถึง ${targets.length} คน`; return; }
      btn.disabled = true;
      const u = me();
      const c = sb();
      try {
        const lines = (r) => r.rows.slice(0, 6).map((x) => `• ${leaveLine(x)}`).join('\n') + (r.rows.length > 6 ? `\n• และอีก ${r.rows.length - 6} รายการ` : '');
        const { error } = await c.from('notifications').insert(targets.map((r) => (isMonth ? {
          employee_id: r.e.id,
          title: `สรุปการลา${state.p.label}`,
          message: `${lines(r)}\nรวม ${r.days} วัน · ถ้าไม่ถูกต้อง แจ้งแก้ไขที่หน้าหลักได้ถึง ${thShort(state.p.due)} (ถ้าไม่แจ้ง ถือว่ารับทราบ)`,
          type: 'leave_confirm',
          link_url: '/pages/user/index-user.html'
        } : {
          employee_id: r.e.id,
          title: `กรุณายืนยันสรุปการลา${state.p.label}`,
          message: `ครบกำหนดยืนยัน ${thShort(state.p.due)} · เข้าหน้าหลักแล้วกด "ตรวจสอบและยืนยัน"`,
          type: 'leave_confirm',
          link_url: '/pages/user/index-user.html'
        })));
        if (error) throw error;
        if (isMonth) {
          // หลักฐานว่า HR ส่งสรุปถึงพนักงานแล้ว (พร้อมสำเนารายการที่ส่ง)
          const { error: e2 } = await c.from(TABLE).insert(targets.map((r) => ({
            employee_id: r.e.id, period_type: 'month', period_key: state.p.key, action: 'notified',
            leave_count: r.rows.length, total_days: r.days, fingerprint: r.fp,
            snapshot: { period: state.p.label, range: state.p.range, employee: { code: r.e.employee_code, name: r.e.full_name }, leaves: r.rows, balances: [] },
            actor_id: u.id, actor_name: u.name || u.code, user_agent: navigator.userAgent.slice(0, 400)
          })));
          if (e2) throw e2;
        }
        state.msg = isMonth ? `ส่งสรุปการลาในระบบถึง ${targets.length} คนแล้ว` : `ส่งแจ้งเตือนในระบบถึง ${targets.length} คนแล้ว`;
        if (isMonth) { await load(); return; }
      } catch (err) {
        state.msg = `ส่งไม่สำเร็จ: ${err.message || err}`;
      }
      view();
    }

    function exportCsv() {
      const head = ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'จำนวนใบลา', 'จำนวนวัน', 'สถานะ', 'วันเวลาล่าสุด', 'หมายเหตุ'];
      const lines = [head.map(csvCell).join(',')].concat(state.rows.map((r) => [
        r.e.employee_code, r.e.full_name, r.e.departments?.department_name || '', r.rows.length, r.days,
        stateText(r.state, state.p, r), r.last ? thStamp(r.last.created_at) : '', r.last?.note || ''
      ].map(csvCell).join(',')));
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `ยืนยันสรุปวันลา_${state.type}_${state.key}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }

    const keyOptions = (type) => keysFor(type).map((x) => `<option value="${esc(x.key)}">${esc(x.label)}</option>`).join('');
    await window.Swal.fire({
      title: 'ติดตามการยืนยันสรุปการลา',
      width: 'min(1100px, 96vw)',
      showConfirmButton: false,
      showCloseButton: true,
      html: `<div class="lch">${testBanner()}
        <div class="lch-bar">
          <select id="lchType" aria-label="ประเภทรอบ"><option value="month">รายเดือน (แจ้งให้ทราบ)</option><option value="year">รายปี (กดยืนยัน ก่อนสรุปสิ้นปี)</option></select>
          <select id="lchKey" aria-label="รอบ"></select>
          <input id="lchQ" type="search" placeholder="ค้นหารหัส ชื่อ แผนก">
        </div>
        <div id="lchBody"></div></div>`,
      didOpen: () => {
        const t = document.getElementById('lchType');
        const k = document.getElementById('lchKey');
        t.value = state.type;
        k.innerHTML = keyOptions(state.type);
        if (state.key) k.value = state.key;
        t.addEventListener('change', () => { state.type = t.value; state.msg = ''; k.innerHTML = keyOptions(state.type); state.key = keysFor(state.type)[0]?.key || null; load(); });
        k.addEventListener('change', () => { state.key = k.value; state.msg = ''; load(); });
        let tm;
        document.getElementById('lchQ').addEventListener('input', (ev) => { clearTimeout(tm); tm = setTimeout(() => { state.q = ev.target.value; view(); }, 200); });
        load();
      }
    });
  }

  // สำหรับกระดิ่ง HR: รายการ "แจ้งแก้ไข" ที่ยังไม่ได้ตรวจสอบ
  async function pendingDisputes() {
    const c = sb();
    if (!c) return [];
    const since = new Date(Date.now() - 430 * 86400000).toISOString();
    const { data, error } = await c.from(TABLE).select('id, employee_id, period_type, period_key, action, note, created_at, employees!employee_id(full_name, employee_code)')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(2000);
    if (error) return [];
    return Object.values(latestMap(data)).filter((r) => r.action === 'disputed').map((r) => ({ ...r, label: period.of(r.period_type, r.period_key).label }));
  }

  window.PVTLeaveConfirm = { openHrTracker, pendingDisputes, openPeriods, period, fingerprint, mountEmployee, config: { FIRST_MONTH, FIRST_YEAR, MONTH_DUE_DAY, YEAR_DUE } };

  // หน้าพนักงาน / หน้า HR หน้าหลัก: แสดงการ์ดยืนยัน
  function boot() {
    let tries = 0;
    const go = () => {
      if (sb() && me().id) { mountEmployee(); return; }
      if (++tries < 40) setTimeout(go, 250);
    };
    if (document.getElementById('lcNotice') || document.body?.dataset.leaveConfirm === 'self') go();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
