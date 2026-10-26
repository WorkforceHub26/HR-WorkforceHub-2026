/* ==========================================================================
   PVT WORKFORCE HUB — กระดิ่ง "งานรอดำเนินการ" ของฝ่ายบุคคล (hr-inbox.js)
   --------------------------------------------------------------------------
   ใส่ไว้ทุกหน้าใน /pages/hr/ (แสดงในแถบหัว .pvt-topbar__actions)
   แจ้งในระบบเท่านั้น ไม่ส่ง LINE

   งานรอดำเนินการ (นับในตัวเลขสีแดง)
     1) ใบลารอคุณอนุมัติ          leave_approval_steps: status = pending และมีชื่อคุณใน approver_ids
     2) ใบลารอฝ่ายบุคคลพิจารณา    leave_approval_steps: status = pending และ hr_any = true   (เฉพาะ HR/Admin)
     3) คำขอยกเลิกใบลา            leave_requests.status = cancel_requested / cancel_pending   (เฉพาะ HR/Admin)
     4) คำขอแก้ไขข้อมูลพนักงาน     employee_change_requests.status = pending                  (เฉพาะ HR/Admin)
     5) แจ้งแก้ไขสรุปวันลา          leave_confirmations ล่าสุด = disputed (leave-confirm.js)    (เฉพาะ HR/Admin)
   ติดตาม (ไม่นับในตัวเลข): ใบลาที่เหลือไม่ถึง 24 ชม. ก่อนระบบ "ไม่อนุมัติอัตโนมัติ"
                            (ครบ 48 ชม. นับจากวันยื่น — autoRejectOverdueLeaves ใน supabase-config.js) (เฉพาะ HR/Admin)
   ข้อความ: ตาราง notifications ของผู้ใช้คนนี้ (อ่านแล้ว/ยังไม่อ่าน)

   - เข้าระบบครั้งแรกของรอบ (session) ถ้ามีงานค้าง → การ์ดแจ้งมุมขวาล่าง
   - อัปเดตทุก 1 นาที + ทันทีเมื่อฐานข้อมูลเปลี่ยน (Supabase Realtime ถ้าเปิดไว้)
   - มีรายการใหม่ระหว่างเปิดหน้า → การ์ดแจ้ง "รายการใหม่"
   - ตัวเลขบนเมนู "สถานะใบลา" / "ระบบจัดการส่วนกลาง" และบนชื่อแท็บเบราว์เซอร์
   ========================================================================== */
(function () {
  'use strict';
  if (window.PVTHrInbox) return;

  const POLL_MS = 60 * 1000;
  const SLA_MS = 48 * 3600 * 1000;   // ครบเวลานี้ (นับจากวันยื่น) ระบบไม่อนุมัติอัตโนมัติ
  const WARN_MS = 24 * 3600 * 1000;  // เหลือน้อยกว่านี้ = ใกล้หมดเวลา
  const LIST_MAX = 6;
  const HR_ROLES = ['hr', 'admin', 'hr_manager', 'superadmin'];
  const STYLE_ID = 'pvt-hrinbox-styles';

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sb = () => window.pvtSupabase?.getClient?.() || window.PVTSDK?.client || window.supabaseClient || null;
  const me = () => {
    try {
      const s = JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}') || {};
      const e = s.employees || {};
      return {
        id: s.id || e.id || null,
        code: String(s.employee_code || e.employee_code || ''),
        name: s.full_name || e.full_name || '',
        role: String(s.role || e.role || '').toLowerCase().trim()
      };
    } catch (e) { return {}; }
  };
  const isHr = (u) => HR_ROLES.includes(u.role) || u.code.toLowerCase().startsWith('hr-');
  const isMissingTable = (err) => /does not exist|PGRST205|42P01|Could not find the table/i.test(`${err?.code} ${err?.message}`);

  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function thDate(iso) {
    if (!iso) return '';
    const d = new Date(String(iso).length <= 10 ? `${iso}T00:00:00` : iso);
    if (isNaN(d)) return String(iso);
    return `${d.getDate()} ${TH_M[d.getMonth()]}`;
  }
  function dateRange(a, b) { return !b || a === b ? thDate(a) : `${thDate(a)} – ${thDate(b)}`; }
  function ago(iso) {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (!(ms >= 0)) return '';
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'เมื่อสักครู่';
    if (m < 60) return `${m} นาทีที่แล้ว`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ชม.ที่แล้ว`;
    return `${Math.floor(h / 24)} วันที่แล้ว`;
  }
  // เวลาที่เหลือก่อนระบบไม่อนุมัติอัตโนมัติ (ms) — นับจาก created_at ของใบลา
  const remainMs = (lv) => (lv && lv.created_at ? new Date(lv.created_at).getTime() + SLA_MS - Date.now() : Infinity);
  function remainText(ms) {
    if (!(ms < WARN_MS)) return '';
    if (ms <= 0) return 'หมดเวลา';
    const h = Math.floor(ms / 3600000);
    return h >= 1 ? `เหลือ ${h} ชม.` : `เหลือ ${Math.max(1, Math.floor(ms / 60000))} นาที`;
  }
  const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const FIELD_LABEL = { hospital: 'โรงพยาบาลประกันสังคม', title: 'คำนำหน้า', full_name: 'ชื่อ-นามสกุล', bank_account: 'เลขบัญชีธนาคาร', nickname: 'ชื่อเล่น', phone: 'เบอร์โทร', email: 'อีเมล' };
  const LEAVE_SELECT = 'id, status, start_date, end_date, total_days, created_at, updated_at, cancel_reason, employee_id, employees!employee_id(full_name, employee_code, departments!department_id(department_name)), leave_types!leave_type_id(leave_name)';

  // ------------------------------------------------------------------ data
  async function fetchLeavesByIds(c, ids) {
    if (!ids.length) return {};
    const { data, error } = await c.from('leave_requests').select(LEAVE_SELECT).in('id', ids);
    if (error) throw error;
    return Object.fromEntries((data || []).map((r) => [String(r.id), r]));
  }

  function leaveItem(kind, lv, extra = {}) {
    const emp = lv.employees || {};
    return Object.assign({
      key: `${kind}:${lv.id}`,
      kind,
      who: emp.full_name || 'พนักงาน',
      code: emp.employee_code || '',
      dept: emp.departments?.department_name || '',
      what: `${lv.leave_types?.leave_name || 'ใบลา'} · ${dateRange(lv.start_date, lv.end_date)}${lv.total_days ? ` (${lv.total_days} วัน)` : ''}`,
      at: lv.created_at,
      due: remainText(remainMs(lv)),
      href: `/pages/hr/hr.html?id=${encodeURIComponent(lv.id)}`
    }, extra);
  }

  async function loadSteps(c, u, hr) {
    const out = { mine: [], hr: [], ok: true };
    const pending = [];
    try {
      const q1 = await c.from('leave_approval_steps').select('id, leave_id, step_label, activated_at, approver_ids, hr_any')
        .eq('status', 'pending').contains('approver_ids', [u.id]).limit(100);
      if (q1.error) throw q1.error;
      (q1.data || []).forEach((s) => pending.push(['mine', s]));
      if (hr) {
        const q2 = await c.from('leave_approval_steps').select('id, leave_id, step_label, activated_at, approver_ids, hr_any')
          .eq('status', 'pending').eq('hr_any', true).limit(100);
        if (q2.error) throw q2.error;
        (q2.data || []).forEach((s) => pending.push(['hr', s]));
      }
    } catch (err) {
      out.ok = false;
      if (!isMissingTable(err)) console.warn('[HR Inbox] โหลดขั้นอนุมัติไม่สำเร็จ:', err?.message || err);
      return out;
    }
    const leaves = await fetchLeavesByIds(c, [...new Set(pending.map(([, s]) => s.leave_id))]);
    const seen = new Set();
    pending.forEach(([bucket, s]) => {
      const lv = leaves[String(s.leave_id)];
      if (!lv || lv.status !== 'pending' || String(lv.employee_id) === String(u.id)) return;
      const k = `${bucket}:${lv.id}`;
      if (seen.has(k) || (bucket === 'hr' && seen.has(`mine:${lv.id}`))) return;
      seen.add(k);
      out[bucket].push(leaveItem(bucket === 'mine' ? 'approve' : 'hrstep', lv, {
        what: `${lv.leave_types?.leave_name || 'ใบลา'} · ${dateRange(lv.start_date, lv.end_date)}${s.step_label ? ` · ${window.PVTApproval?.neutralText ? window.PVTApproval.neutralText(s.step_label) : s.step_label}` : ''}`,
        at: s.activated_at || lv.created_at
      }));
    });
    return out;
  }

  async function loadCancels(c) {
    const { data, error } = await c.from('leave_requests').select(LEAVE_SELECT)
      .in('status', ['cancel_requested', 'cancel_pending']).order('updated_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data || []).map((lv) => leaveItem('cancel', lv, {
      what: `ขอยกเลิก${lv.leave_types?.leave_name || 'ใบลา'} · ${dateRange(lv.start_date, lv.end_date)}${lv.cancel_reason ? ` · เหตุผล: ${lv.cancel_reason}` : ''}`,
      at: lv.updated_at || lv.created_at,
      due: ''
    }));
  }

  async function loadChangeRequests(c) {
    try {
      const { data, error } = await c.from('employee_change_requests')
        .select('id, field, new_value, created_at, employee_id, employees!employee_id(full_name, employee_code)')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data || []).map((r) => ({
        key: `profile:${r.id}`,
        kind: 'profile',
        who: r.employees?.full_name || 'พนักงาน',
        code: r.employees?.employee_code || '',
        what: `ขอแก้ไข${FIELD_LABEL[r.field] || r.field}`,
        at: r.created_at,
        due: '',
        href: '/pages/hr/management.html?open=change-requests'
      }));
    } catch (err) {
      if (!isMissingTable(err)) console.warn('[HR Inbox] โหลดคำขอแก้ไขข้อมูลไม่สำเร็จ:', err?.message || err);
      return [];
    }
  }

  // ใบลาที่ใกล้หมดเวลา 48 ชม. (เหลือ < 24 ชม.) ไม่ว่าอยู่ขั้นไหน — ให้ HR ตามผู้อนุมัติก่อนระบบไม่อนุมัติอัตโนมัติ
  async function loadLeaveConfirmDisputes(c) {
    try {
      const since = new Date(Date.now() - 430 * 86400000).toISOString();
      const { data, error } = await c.from('leave_confirmations')
        .select('id, employee_id, period_type, period_key, action, note, created_at, employees!employee_id(full_name, employee_code)')
        .gte('created_at', since).order('created_at', { ascending: false }).limit(2000);
      if (error) throw error;
      const latest = {};
      (data || []).forEach((r) => {
        const k = `${r.employee_id}|${r.period_type}|${r.period_key}`;
        if (!latest[k] || new Date(r.created_at) > new Date(latest[k].created_at)) latest[k] = r;
      });
      return Object.values(latest).filter((r) => r.action === 'disputed').map((r) => {
        const label = r.period_type === 'year' ? `ปีการลา ${Number(r.period_key) + 543}`
          : (() => { const [y, m] = r.period_key.split('-').map(Number); return `${TH_M[m - 1]} ${y + 543}`; })();
        return {
          key: `confirm:${r.id}`,
          kind: 'confirm',
          who: r.employees?.full_name || 'พนักงาน',
          code: r.employees?.employee_code || '',
          what: `แจ้งแก้ไขสรุปวันลา${label}${r.note ? ` · ${r.note}` : ''}`,
          at: r.created_at,
          due: '',
          href: `/pages/hr/management.html?open=leave-confirm&type=${r.period_type}&key=${encodeURIComponent(r.period_key)}`
        };
      });
    } catch (err) {
      if (!isMissingTable(err)) console.warn('[HR Inbox] โหลดคำแจ้งแก้ไขสรุปวันลาไม่สำเร็จ:', err?.message || err);
      return [];
    }
  }

  async function loadStale(c, excludeKeys) {
    const from = new Date(Date.now() - SLA_MS).toISOString();
    const to = new Date(Date.now() - (SLA_MS - WARN_MS)).toISOString();
    const { data, error } = await c.from('leave_requests').select(LEAVE_SELECT)
      .eq('status', 'pending').gte('created_at', from).lt('created_at', to).order('created_at', { ascending: true }).limit(50);
    if (error) throw error;
    return (data || []).filter((lv) => !excludeKeys.has(String(lv.id))).map((lv) => leaveItem('stale', lv));
  }

  async function loadMessages(c, u) {
    const { data, error } = await c.from('notifications').select('id, title, message, link_url, is_read, created_at, type')
      .eq('employee_id', u.id).order('created_at', { ascending: false }).limit(30);
    if (error) throw error;
    return data || [];
  }

  async function collect() {
    const c = sb();
    const u = me();
    if (!c || !u.id) return null;
    const hr = isHr(u);
    const res = { hr, mine: [], hrstep: [], cancel: [], profile: [], confirm: [], stale: [], messages: [], at: new Date() };
    const jobs = [
      loadSteps(c, u, hr).then((r) => { res.mine = r.mine; res.hrstep = r.hr; }),
      loadMessages(c, u).then((r) => { res.messages = r; }).catch((e) => console.warn('[HR Inbox] โหลดข้อความไม่สำเร็จ:', e?.message || e))
    ];
    if (hr) {
      jobs.push(loadCancels(c).then((r) => { res.cancel = r; }).catch((e) => console.warn('[HR Inbox] โหลดคำขอยกเลิกไม่สำเร็จ:', e?.message || e)));
      jobs.push(loadChangeRequests(c).then((r) => { res.profile = r; }));
      jobs.push(loadLeaveConfirmDisputes(c).then((r) => { res.confirm = r; }));
    }
    await Promise.all(jobs);
    if (hr) {
      const inQueue = new Set([...res.mine, ...res.hrstep].map((i) => String(i.key.split(':')[1])));
      try { res.stale = await loadStale(c, inQueue); } catch (e) { res.stale = []; }
    }
    res.actionable = [...res.mine, ...res.hrstep, ...res.cancel, ...res.profile, ...res.confirm];
    res.unread = res.messages.filter((m) => !m.is_read).length;
    return res;
  }

  // ------------------------------------------------------------------ UI
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
.hib{--hib-p:var(--th-p-600,#0d9488);--hib-pd:var(--th-p-700,#0f766e);--hib-ps:var(--th-p-50,#f0fdfa);--hib-t:#0f172a;--hib-t2:#475569;--hib-m:#94a3b8;--hib-b:#e2e8f0;--hib-s:#fff;--hib-red:#dc2626;--hib-amber:#b45309;--hib-amber-s:#fef3c7;position:relative;font-family:inherit}
.hib-btn{position:relative;width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--hib-b);border-radius:50%;background:var(--hib-s);color:var(--hib-t2);cursor:pointer;padding:0;transition:background .15s,border-color .15s}
.hib-btn:hover{background:var(--hib-ps);border-color:var(--hib-p);color:var(--hib-pd)}
.hib-btn:focus-visible{outline:2px solid var(--hib-p);outline-offset:2px}
.hib-btn svg{width:22px;height:22px}
.hib-btn.is-ringing svg{animation:hib-ring 1s ease-in-out 2}
@keyframes hib-ring{0%,100%{transform:rotate(0)}20%{transform:rotate(14deg)}40%{transform:rotate(-12deg)}60%{transform:rotate(8deg)}80%{transform:rotate(-4deg)}}
.hib-count{position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--hib-red);color:#fff;font-size:11.5px;font-weight:800;line-height:20px;text-align:center;box-shadow:0 0 0 2px var(--hib-s);font-variant-numeric:tabular-nums}
.hib-dot{position:absolute;top:3px;right:3px;width:10px;height:10px;border-radius:50%;background:var(--hib-p);box-shadow:0 0 0 2px var(--hib-s)}
.hib-panel{position:fixed;top:calc(var(--pvt-topbar-total,72px) + 6px);right:max(12px,env(safe-area-inset-right,0px));width:min(420px,calc(100vw - 24px));max-height:calc(100vh - var(--pvt-topbar-total,72px) - 24px);display:flex;flex-direction:column;background:var(--hib-s);color:var(--hib-t);border:1px solid var(--hib-b);border-radius:16px;box-shadow:0 18px 48px rgba(15,23,42,.18);z-index:10050;overflow:hidden;text-align:left}
.hib-panel[hidden]{display:none!important}
.hib-head{display:flex;align-items:center;gap:8px;padding:14px 16px 10px}
.hib-head h3{margin:0;font-size:16px;font-weight:800;flex:1;min-width:0}
.hib-icon{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--hib-t2);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}
.hib-icon:hover{background:#f1f5f9}
.hib-icon svg{width:18px;height:18px}
.hib-tabs{display:flex;gap:4px;padding:0 12px 8px;border-bottom:1px solid var(--hib-b)}
.hib-tab{flex:1;border:0;background:transparent;padding:8px 10px;border-radius:10px;font:inherit;font-size:13.5px;font-weight:700;color:var(--hib-t2);cursor:pointer}
.hib-tab[aria-selected="true"]{background:var(--hib-ps);color:var(--hib-pd)}
.hib-tab b{display:inline-block;min-width:20px;margin-left:4px;padding:0 6px;border-radius:999px;background:#e2e8f0;color:var(--hib-t2);font-size:11.5px;line-height:18px}
.hib-tab[aria-selected="true"] b{background:var(--hib-p);color:#fff}
.hib-tab .hib-b-red{background:var(--hib-red)!important;color:#fff!important}
.hib-body{overflow-y:auto;padding:4px 0 8px;flex:1}
.hib-group{padding:10px 16px 2px}
.hib-group h4{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:12.5px;font-weight:800;color:var(--hib-t2);letter-spacing:.02em}
.hib-group h4 span{padding:0 7px;border-radius:999px;background:#f1f5f9;font-size:11.5px;line-height:18px;color:var(--hib-t)}
.hib-group--watch h4{color:var(--hib-amber)}
.hib-item{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 10px;margin:0 -10px;border-radius:10px;color:inherit;text-decoration:none}
.hib-item:hover,.hib-item:focus-visible{background:var(--hib-ps);outline:none}
.hib-item strong{font-size:14px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hib-item small{grid-column:1/-1;font-size:12.5px;color:var(--hib-t2);line-height:1.45;overflow-wrap:anywhere}
.hib-time{font-size:11.5px;color:var(--hib-m);white-space:nowrap;align-self:center}
.hib-late{display:inline-block;margin-left:6px;padding:0 6px;border-radius:4px;background:#fee2e2;color:var(--hib-red);font-size:11px;font-weight:800;vertical-align:1px}
.hib-more{display:block;padding:4px 0 6px;font-size:12.5px;font-weight:700;color:var(--hib-pd);text-decoration:none}
.hib-more:hover{text-decoration:underline}
.hib-empty{padding:30px 20px;text-align:center;color:var(--hib-t2);font-size:14px}
.hib-empty strong{display:block;color:var(--hib-t);font-size:15px;margin-bottom:4px}
.hib-msg{display:block;padding:10px 16px;border:0;border-bottom:1px solid #f1f5f9;color:inherit;text-decoration:none;cursor:pointer;background:transparent;border-left:3px solid transparent;width:100%;text-align:left;font:inherit}
.hib-msg:hover{background:#f8fafc}
.hib-msg.is-unread{border-left-color:var(--hib-p);background:var(--hib-ps)}
.hib-msg strong{display:block;font-size:13.5px;font-weight:700}
.hib-msg span{display:block;font-size:12.5px;color:var(--hib-t2);white-space:pre-line;max-height:3.1em;overflow:hidden;margin-top:2px}
.hib-msg time{display:block;font-size:11.5px;color:var(--hib-m);margin-top:3px}
.hib-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 16px;border-top:1px solid var(--hib-b);background:#f8fafc;font-size:12px;color:var(--hib-t2)}
.hib-foot button{border:0;background:transparent;color:var(--hib-pd);font:inherit;font-weight:700;cursor:pointer;padding:2px 4px}
.hib-navbadge{margin-left:auto;min-width:20px;padding:0 6px;border-radius:999px;background:var(--hib-red,#dc2626);color:#fff;font-size:11px;font-weight:800;line-height:18px;text-align:center;font-variant-numeric:tabular-nums}
.hib-toast{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 32px));background:#0f172a;color:#f8fafc;border-radius:14px;box-shadow:0 18px 40px rgba(15,23,42,.35);padding:14px 16px;z-index:10060;font-size:13.5px;line-height:1.5;transform:translateY(16px);opacity:0;transition:opacity .25s,transform .25s}
.hib-toast.is-on{opacity:1;transform:none}
.hib-toast strong{display:block;font-size:15px;margin-bottom:4px}
.hib-toast ul{margin:0 0 10px;padding-left:18px}
.hib-toast-actions{display:flex;gap:8px;justify-content:flex-end}
.hib-toast button{border:0;border-radius:8px;padding:7px 12px;font:inherit;font-weight:700;cursor:pointer}
.hib-toast .hib-go{background:var(--th-p-500,#14b8a6);color:#04211d}
.hib-toast .hib-x{background:transparent;color:#cbd5e1}
@media (max-width:640px){.hib-toast{bottom:calc(84px + env(safe-area-inset-bottom,0px))}.hib-panel{left:8px;right:8px;width:auto;top:calc(var(--pvt-topbar-total,60px) + 4px)}.hib-btn{width:38px;height:38px}}
@media (prefers-reduced-motion:reduce){.hib-btn.is-ringing svg{animation:none}.hib-toast{transition:none}}
`;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  const ICON_BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>';
  const ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  const GROUPS = [
    { id: 'mine', title: 'ใบลารอคุณอนุมัติ', more: '/pages/hr/hr.html', moreText: 'ไปหน้าสถานะใบลา' },
    { id: 'hrstep', title: 'ใบลารอฝ่ายบุคคลพิจารณา', more: '/pages/hr/hr.html', moreText: 'ไปหน้าสถานะใบลา' },
    { id: 'cancel', title: 'คำขอยกเลิกใบลา', more: '/pages/hr/hr.html', moreText: 'ไปหน้าสถานะใบลา' },
    { id: 'profile', title: 'คำขอแก้ไขข้อมูลพนักงาน', more: '/pages/hr/management.html?open=change-requests', moreText: 'เปิดรายการคำขอ' },
    { id: 'confirm', title: 'พนักงานแจ้งแก้ไขสรุปวันลา', more: '/pages/hr/management.html?open=leave-confirm', moreText: 'เปิดหน้าติดตาม' }
  ];

  const state = { data: null, tab: 'tasks', open: false, knownKeys: null, timer: null, loading: false, root: null };
  const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');

  function itemHtml(i) {
    return `<a class="hib-item" href="${esc(i.href)}">
      <strong>${esc(i.who)}${i.code ? ` <span style="font-weight:500;color:var(--hib-m)">${esc(i.code)}</span>` : ''}${i.due ? `<span class="hib-late" title="ครบ 48 ชม. ระบบจะไม่อนุมัติอัตโนมัติ">${esc(i.due)}</span>` : ''}</strong>
      <span class="hib-time">${esc(ago(i.at))}</span>
      <small>${esc(i.what)}${i.dept ? ` · ${esc(i.dept)}` : ''}</small>
    </a>`;
  }

  function groupHtml(g, items, watch) {
    if (!items.length) return '';
    const shown = items.slice(0, LIST_MAX).map(itemHtml).join('');
    const rest = items.length > LIST_MAX ? `<a class="hib-more" href="${esc(g.more)}">ดูอีก ${items.length - LIST_MAX} รายการ →</a>` : '';
    return `<section class="hib-group${watch ? ' hib-group--watch' : ''}"><h4>${esc(g.title)} <span>${items.length}</span></h4>${shown}${rest}</section>`;
  }

  function tasksHtml(d) {
    const groups = GROUPS.map((g) => groupHtml(g, d[g.id] || [])).join('');
    const watch = d.hr ? groupHtml({ title: 'ติดตาม: ใกล้หมดเวลา 48 ชม. (ยังอยู่ที่ผู้อนุมัติ)', more: '/pages/hr/hr.html' }, d.stale, true) : '';
    if (!groups && !watch) {
      return `<div class="hib-empty"><strong>ไม่มีงานค้าง</strong>ใบลา คำขอยกเลิก และคำขอแก้ไขข้อมูล ได้รับการพิจารณาครบแล้ว</div>`;
    }
    return groups + watch;
  }

  function messagesHtml(d) {
    if (!d.messages.length) return '<div class="hib-empty"><strong>ยังไม่มีข้อความ</strong>ข้อความแจ้งเตือนในระบบจะแสดงที่นี่</div>';
    return d.messages.map((m) => `
      <button type="button" class="hib-msg${m.is_read ? '' : ' is-unread'}" data-msg="${esc(m.id)}" data-href="${esc(m.link_url || '')}">
        <strong>${esc(m.title)}</strong><span>${esc(m.message)}</span><time>${esc(ago(m.created_at))}</time>
      </button>`).join('');
  }

  function render() {
    const root = state.root;
    const d = state.data;
    if (!root) return;
    const n = d ? d.actionable.length : 0;
    const unread = d ? d.unread : 0;
    const btn = root.querySelector('.hib-btn');
    btn.querySelector('.hib-count')?.remove();
    btn.querySelector('.hib-dot')?.remove();
    if (n) btn.insertAdjacentHTML('beforeend', `<span class="hib-count">${n > 99 ? '99+' : n}</span>`);
    else if (unread) btn.insertAdjacentHTML('beforeend', '<span class="hib-dot"></span>');
    btn.setAttribute('aria-label', n ? `งานรอดำเนินการ ${n} รายการ` : unread ? `ข้อความใหม่ ${unread} รายการ` : 'การแจ้งเตือน');
    btn.title = btn.getAttribute('aria-label');
    document.title = n ? `(${n}) ${baseTitle}` : baseTitle;
    updateNavBadges(d);

    const panel = root.querySelector('.hib-panel');
    panel.hidden = !state.open;
    if (!state.open) return;
    root.querySelector('[data-tab="tasks"]').setAttribute('aria-selected', String(state.tab === 'tasks'));
    root.querySelector('[data-tab="messages"]').setAttribute('aria-selected', String(state.tab === 'messages'));
    root.querySelector('[data-tab="tasks"] b').textContent = n;
    root.querySelector('[data-tab="tasks"] b').className = n ? 'hib-b-red' : '';
    root.querySelector('[data-tab="messages"] b').textContent = unread;
    const body = root.querySelector('.hib-body');
    if (!d) body.innerHTML = '<div class="hib-empty">กำลังโหลด...</div>';
    else body.innerHTML = state.tab === 'tasks' ? tasksHtml(d) : messagesHtml(d);
    root.querySelector('.hib-updated').textContent = d ? `อัปเดตอัตโนมัติทุก 1 นาที · ล่าสุด ${hhmm(d.at)}` : '';
    const markAll = root.querySelector('.hib-markall');
    markAll.hidden = !(state.tab === 'messages' && unread);
  }

  function updateNavBadges(d) {
    const set = (selector, count, id) => {
      document.querySelectorAll(selector).forEach((a) => {
        let b = a.querySelector(`.hib-navbadge[data-for="${id}"]`);
        if (!count) { b?.remove(); return; }
        if (!b) {
          b = document.createElement('span');
          b.className = 'hib-navbadge';
          b.dataset.for = id;
          a.appendChild(b);
        }
        b.textContent = count > 99 ? '99+' : String(count);
        b.title = `${count} รายการรอดำเนินการ`;
      });
    };
    const leaves = d ? d.mine.length + d.hrstep.length + d.cancel.length : 0;
    set('a.pvt-nav__item[href="/pages/hr/hr.html"]', leaves, 'leaves');
    set('a.pvt-nav__item[href="/pages/hr/management.html"]', d ? d.profile.length + d.confirm.length : 0, 'profile');
  }

  // ------------------------------------------------------------------ toasts
  let toastTimer = null;
  function toast(title, lines) {
    document.querySelector('.hib-toast')?.remove();
    clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.className = 'hib-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<strong>${esc(title)}</strong>${lines.length ? `<ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      <div class="hib-toast-actions"><button type="button" class="hib-x">ปิด</button><button type="button" class="hib-go">ดูรายการ</button></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-on'));
    const close = () => { el.classList.remove('is-on'); setTimeout(() => el.remove(), 300); };
    el.querySelector('.hib-x').onclick = close;
    el.querySelector('.hib-go').onclick = () => { close(); openPanel('tasks'); };
    toastTimer = setTimeout(close, 12000);
  }

  function summaryLines(d) {
    const lines = [];
    if (d.mine.length) lines.push(`ใบลารอคุณอนุมัติ ${d.mine.length} รายการ`);
    if (d.hrstep.length) lines.push(`ใบลารอฝ่ายบุคคลพิจารณา ${d.hrstep.length} รายการ`);
    if (d.cancel.length) lines.push(`คำขอยกเลิกใบลา ${d.cancel.length} รายการ`);
    if (d.profile.length) lines.push(`คำขอแก้ไขข้อมูลพนักงาน ${d.profile.length} รายการ`);
    if (d.confirm.length) lines.push(`พนักงานแจ้งแก้ไขสรุปวันลา ${d.confirm.length} รายการ`);
    return lines;
  }

  const KIND_TEXT = { approve: 'ใบลารอคุณอนุมัติ', hrstep: 'ใบลารอฝ่ายบุคคลพิจารณา', cancel: 'คำขอยกเลิกใบลา', profile: 'คำขอแก้ไขข้อมูล', confirm: 'แจ้งแก้ไขสรุปวันลา' };

  function announce(d) {
    const keys = new Set(d.actionable.map((i) => i.key));
    const u = me();
    const sessKey = `pvt_hr_inbox_greeted_${u.id}`;
    let greeted = false;
    try { greeted = sessionStorage.getItem(sessKey) === '1'; } catch (e) {}

    if (state.knownKeys === null) {
      if (!greeted && d.actionable.length) {
        toast(`มีงานรอดำเนินการ ${d.actionable.length} รายการ`, summaryLines(d));
        ring();
      }
      try { sessionStorage.setItem(sessKey, '1'); } catch (e) {}
    } else {
      const fresh = d.actionable.filter((i) => !state.knownKeys.has(i.key));
      if (fresh.length) {
        toast(fresh.length === 1 ? 'รายการใหม่' : `รายการใหม่ ${fresh.length} รายการ`,
          fresh.slice(0, 4).map((i) => `${KIND_TEXT[i.kind] || ''}: ${i.who}`));
        ring();
      }
    }
    state.knownKeys = keys;
  }

  function ring() {
    const btn = state.root?.querySelector('.hib-btn');
    if (!btn) return;
    btn.classList.remove('is-ringing');
    void btn.offsetWidth;
    btn.classList.add('is-ringing');
  }

  // ------------------------------------------------------------------ actions
  async function refresh() {
    if (state.loading) return;
    state.loading = true;
    try {
      const d = await collect();
      if (d) {
        state.data = d;
        announce(d);
        render();
      }
    } catch (err) {
      console.warn('[HR Inbox] โหลดไม่สำเร็จ:', err?.message || err);
    } finally {
      state.loading = false;
    }
  }

  function openPanel(tab) {
    state.open = true;
    if (tab) state.tab = tab;
    render();
    refresh();
  }
  function closePanel() { state.open = false; render(); }

  async function markRead(ids) {
    const c = sb();
    const u = me();
    if (!c || !ids.length) return;
    try { await c.from('notifications').update({ is_read: true }).in('id', ids).eq('employee_id', u.id); } catch (e) {}
    if (state.data) {
      state.data.messages.forEach((m) => { if (ids.includes(m.id)) m.is_read = true; });
      state.data.unread = state.data.messages.filter((m) => !m.is_read).length;
      render();
    }
  }

  let debounce = null;
  function soon() { clearTimeout(debounce); debounce = setTimeout(refresh, 1500); }

  function subscribeRealtime() {
    const c = sb();
    const u = me();
    if (!c || typeof c.channel !== 'function' || !u.id) return;
    try {
      c.channel(`hr-inbox-${u.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, soon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_approval_steps' }, soon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_change_requests' }, soon)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_confirmations' }, soon)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `employee_id=eq.${u.id}` }, soon)
        .subscribe();
    } catch (e) { /* ไม่มี Realtime ก็ใช้การอัปเดตทุก 1 นาทีแทน */ }
  }

  function mount() {
    const u = me();
    if (!u.id) return false;
    const host = document.querySelector('.pvt-topbar__actions');
    if (!host || document.getElementById('hrInbox')) return !!host;
    injectStyles();
    const root = document.createElement('div');
    root.className = 'hib';
    root.id = 'hrInbox';
    root.innerHTML = `
      <button type="button" class="hib-btn" aria-haspopup="dialog" aria-expanded="false" title="การแจ้งเตือน">${ICON_BELL}</button>
      <div class="hib-panel" role="dialog" aria-label="งานรอดำเนินการและการแจ้งเตือน" hidden>
        <div class="hib-head">
          <h3>การแจ้งเตือน</h3>
          <button type="button" class="hib-icon hib-refresh" title="โหลดใหม่">${ICON_REFRESH}</button>
          <button type="button" class="hib-icon hib-close" title="ปิด">${ICON_CLOSE}</button>
        </div>
        <div class="hib-tabs" role="tablist">
          <button type="button" class="hib-tab" role="tab" data-tab="tasks" aria-selected="true">งานรอดำเนินการ<b>0</b></button>
          <button type="button" class="hib-tab" role="tab" data-tab="messages" aria-selected="false">ข้อความ<b>0</b></button>
        </div>
        <div class="hib-body"></div>
        <div class="hib-foot"><span class="hib-updated"></span><button type="button" class="hib-markall" hidden>อ่านทั้งหมด</button></div>
      </div>`;
    host.insertBefore(root, host.firstChild);
    state.root = root;

    const btn = root.querySelector('.hib-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.open) closePanel(); else openPanel();
      btn.setAttribute('aria-expanded', String(state.open));
    });
    root.querySelector('.hib-close').addEventListener('click', () => { closePanel(); btn.setAttribute('aria-expanded', 'false'); btn.focus(); });
    root.querySelector('.hib-refresh').addEventListener('click', refresh);
    root.querySelectorAll('.hib-tab').forEach((t) => t.addEventListener('click', () => { state.tab = t.dataset.tab; render(); }));
    root.querySelector('.hib-markall').addEventListener('click', () => {
      markRead((state.data?.messages || []).filter((m) => !m.is_read).map((m) => m.id));
    });
    root.querySelector('.hib-body').addEventListener('click', async (e) => {
      const m = e.target.closest('.hib-msg');
      if (!m) return;
      await markRead([m.dataset.msg]);
      const href = m.dataset.href;
      if (href && href !== location.pathname + location.search) location.href = href;
    });
    document.addEventListener('click', (e) => {
      if (state.open && !root.contains(e.target)) { closePanel(); btn.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.open) { closePanel(); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
    render();
    return true;
  }

  function start() {
    let tries = 0;
    const boot = () => {
      tries += 1;
      const mounted = mount();
      if (mounted && sb()) {
        refresh();
        subscribeRealtime();
        state.timer = setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
        return;
      }
      if (tries < 40) setTimeout(boot, 250); // รอ supabase-config.js / แถบหัวโหลดเสร็จ (สูงสุด ~10 วินาที)
    };
    boot();
  }

  window.PVTHrInbox = { refresh, open: openPanel, close: closePanel, _state: state };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
