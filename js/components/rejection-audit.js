/* ==========================================================================
   🔎 PVT Rejection Audit — การพิจารณาที่ไม่อนุมัติ (หน้า /pages/hr/hr.html)
   --------------------------------------------------------------------------
   สำหรับ HR / Admin / ผู้บริหาร: ดูการไม่อนุมัติทั้งหมดว่า "ใครไม่อนุมัติ ใคร
   ขั้นไหน เพราะอะไร ใช้เวลาเท่าไร" และสรุปพฤติกรรมการพิจารณารายผู้อนุมัติ
   เพื่อใช้ตรวจสอบความเป็นธรรมต่อพนักงาน

   แหล่งข้อมูล (อ่านอย่างเดียว ไม่แก้ข้อมูลใด ๆ):
     • leave_approval_logs   หลักฐานการพิจารณาทุกขั้น (แก้/ลบไม่ได้)
     • leave_approval_steps  ขั้นของใบลา (ใช้หาผู้อนุมัติที่ปล่อยให้หมดเวลา 48 ชม.
                             และเวลาที่ใบลามาถึงขั้นนั้น)
     • leave_requests        ใบลาที่ไม่อนุมัติก่อนมีระบบหลักฐาน (ไม่มีชื่อผู้กด)

   ใช้งาน: window.PVTRejectionAudit.open()  (hr.js เรียกเมื่อกดแท็บ)
   ========================================================================== */
(function (global) {
  'use strict';
  if (global.PVTRejectionAudit) return;

  const PANEL_ID = 'rejectionAuditPanel';
  const DECISION_ACTIONS = ['step_approved', 'approved', 'rejected', 'auto_rejected'];

  const state = {
    loaded: false,
    loading: false,
    rangeKey: '',
    rejections: [],      // รายการที่ไม่อนุมัติ
    approvers: [],       // สรุปรายผู้พิจารณา
    overallRate: 0,
    filters: { dept: '', approver: '', kind: '', q: '' }
  };

  // ---------------------------------------------------------------------
  // ตัวช่วย
  // ---------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const sb = () => global.pvtSupabase?.getClient?.() || global.PVTSDK?.client || global.supabaseClient || null;
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const pad = (n) => String(n).padStart(2, '0');
  const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function thDate(v, withTime) {
    if (!v) return '-';
    const s = String(v);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
    if (isNaN(d)) return s;
    let out = `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`;
    if (withTime) out += ` ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return out;
  }
  function hoursText(h) {
    if (h == null || !isFinite(h)) return '-';
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} นาที`;
    if (h < 48) return `${Math.round(h)} ชม.`;
    return `${(h / 24).toFixed(1)} วัน`;
  }
  const isBlankReason = (c) => String(c || '').replace(/\s+/g, '').length < 4;
  const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };

  // รอบปีการลา: 1 ธ.ค. – 30 พ.ย. (ธ.ค. นับเป็นรอบปีถัดไป)
  function leaveYearRange() {
    const ly = typeof global.getCurrentLeaveYear === 'function'
      ? global.getCurrentLeaveYear()
      : (() => { const d = new Date(); return d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear(); })();
    return { from: `${ly - 1}-12-01`, to: localDate(new Date()), label: `รอบปีการลา ${ly + 543}` };
  }

  // ---------------------------------------------------------------------
  // โหลดข้อมูล
  // ---------------------------------------------------------------------
  async function fetchAll(buildQuery) {
    const rows = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await buildQuery().range(from, from + 999);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  }

  async function load(fromDate, toDate) {
    const client = sb();
    if (!client) throw new Error('ยังเชื่อมต่อฐานข้อมูลไม่ได้');
    const fromIso = new Date(`${fromDate}T00:00:00`).toISOString();
    const toIso = new Date(new Date(`${toDate}T00:00:00`).getTime() + 864e5).toISOString();

    // 1) หลักฐานการพิจารณาในช่วงเวลา
    let logs = [];
    let logsAvailable = true;
    try {
      logs = await fetchAll(() => client.from('leave_approval_logs')
        .select('id, leave_id, employee_id, employee_code, employee_name, action, step_level, step_label, actor_id, actor_name, actor_role, comment, leave_snapshot, created_at')
        .in('action', DECISION_ACTIONS)
        .gte('created_at', fromIso).lt('created_at', toIso)
        .order('created_at', { ascending: false }));
    } catch (err) {
      if (/does not exist|PGRST205|42P01|Could not find the table/i.test(`${err.code} ${err.message}`)) logsAvailable = false;
      else throw err;
    }

    // 2) ใบลาที่ไม่อนุมัติในช่วงเวลา (รวมใบเก่าที่ไม่มีหลักฐาน)
    const rejectedLeaves = await fetchAll(() => client.from('leave_requests')
      .select('id, employee_id, created_at, updated_at, start_date, end_date, total_days, reason, approval_comment, manager_status, director_status, executive_status, employees!employee_id(id, full_name, employee_code, departments!department_id(department_name)), leave_types!leave_type_id(leave_name)')
      .eq('status', 'rejected')
      .gte('updated_at', fromIso).lt('updated_at', toIso)
      .order('updated_at', { ascending: false }));

    // 3) ข้อมูลใบลาที่เกี่ยวข้อง (วันที่ยื่น / แผนกปัจจุบัน) + ขั้นอนุมัติ
    const leaveIds = Array.from(new Set([...logs.map((l) => l.leave_id), ...rejectedLeaves.map((r) => r.id)].filter(Boolean)));
    const leaves = {};
    rejectedLeaves.forEach((r) => { leaves[r.id] = r; });
    const missing = leaveIds.filter((id) => !leaves[id]);
    for (const part of chunk(missing, 150)) {
      const { data } = await client.from('leave_requests')
        .select('id, employee_id, created_at, start_date, end_date, total_days, reason, employees!employee_id(id, full_name, employee_code, departments!department_id(department_name)), leave_types!leave_type_id(leave_name)')
        .in('id', part);
      (data || []).forEach((r) => { leaves[r.id] = r; });
    }

    const steps = {};
    for (const part of chunk(leaveIds, 150)) {
      const { data, error } = await client.from('leave_approval_steps')
        .select('leave_id, step_no, step_label, status, approver_ids, approver_names, hr_any, activated_at, acted_at')
        .in('leave_id', part);
      if (error) break; // ยังไม่ได้รัน migration ระยะ 2
      (data || []).forEach((s) => { (steps[s.leave_id] = steps[s.leave_id] || []).push(s); });
    }

    // ใบที่มีหลักฐาน "ไม่อนุมัติ" อยู่แล้ว (ไม่ว่าช่วงเวลาไหน) → ไม่ต้องนับเป็นใบเก่า
    const loggedReject = new Set(logs.filter((l) => l.action === 'rejected' || l.action === 'auto_rejected').map((l) => l.leave_id));
    if (logsAvailable) {
      const unknown = rejectedLeaves.map((r) => r.id).filter((id) => !loggedReject.has(id));
      for (const part of chunk(unknown, 150)) {
        const { data } = await client.from('leave_approval_logs').select('leave_id').in('leave_id', part).in('action', ['rejected', 'auto_rejected']);
        (data || []).forEach((l) => loggedReject.add(l.leave_id));
      }
    }

    build(logs, rejectedLeaves, leaves, steps, loggedReject, logsAvailable);
  }

  // ---------------------------------------------------------------------
  // ประมวลผล
  // ---------------------------------------------------------------------
  function stepNoOf(log) {
    const m = String(log.step_level || '').match(/^S(\d+)$/);
    return m ? Number(m[1]) : null;
  }

  function build(logs, rejectedLeaves, leaves, steps, loggedReject, logsAvailable) {
    const approvers = {};
    const keyOf = (id, name) => (id ? `id:${id}` : `name:${name || 'ไม่ทราบชื่อ'}`);
    const getA = (id, name) => {
      const k = keyOf(id, name);
      if (!approvers[k]) approvers[k] = { key: k, id: id || null, name: name || 'ไม่ทราบชื่อ', roles: new Set(), steps: new Set(), total: 0, approved: 0, rejected: 0, expired: 0, noReason: 0, hours: [], perEmp: {} };
      return approvers[k];
    };
    const empInfo = (log, leave) => {
      const snap = log?.leave_snapshot || {};
      const emp = leave?.employees || {};
      return {
        name: emp.full_name || log?.employee_name || snap.employee_name || '-',
        code: emp.employee_code || log?.employee_code || snap.employee_code || '',
        id: leave?.employee_id || log?.employee_id || snap.employee_id || '',
        dept: emp.departments?.department_name || snap.department_name || '-',
        type: leave?.leave_types?.leave_name || snap.leave_type || '-',
        start: leave?.start_date || snap.start_date,
        end: leave?.end_date || snap.end_date,
        days: leave?.total_days ?? snap.total_days,
        reason: leave?.reason || snap.reason || '',
        submittedAt: leave?.created_at || null
      };
    };
    const stepStart = (log, leave) => {
      const no = stepNoOf(log);
      const st = no != null ? (steps[log.leave_id] || []).find((s) => s.step_no === no) : null;
      return st?.activated_at || leave?.created_at || null;
    };

    const rejections = [];

    logs.forEach((log) => {
      const leave = leaves[log.leave_id] || null;
      const info = empInfo(log, leave);

      if (log.action === 'auto_rejected') {
        // ผู้ที่ปล่อยให้หมดเวลา: จากขั้นที่ "expired" ของใบนั้น
        const exp = (steps[log.leave_id] || []).find((s) => s.status === 'expired');
        let who = '';
        if (exp) {
          if (exp.hr_any || !(exp.approver_ids || []).length) who = 'ฝ่ายบุคคล (HR)';
          else {
            who = (exp.approver_names || []).join(' หรือ ');
            (exp.approver_ids || []).forEach((id, i) => {
              const a = getA(String(id), (exp.approver_names || [])[i]);
              a.expired += 1;
              if (exp.step_label) a.steps.add(exp.step_label);
            });
          }
        }
        rejections.push({
          kind: 'expired', at: log.created_at, leaveId: log.leave_id, ...info,
          step: exp?.step_label || log.step_label || '-',
          decidedBy: who ? `${who} (ไม่พิจารณาภายใน 48 ชม.)` : 'ไม่พิจารณาภายใน 48 ชม.',
          approverKeys: exp && !exp.hr_any ? (exp.approver_ids || []).map((id) => keyOf(String(id))) : [],
          comment: log.comment || '',
          hours: info.submittedAt ? (new Date(log.created_at) - new Date(info.submittedAt)) / 36e5 : null
        });
        return;
      }

      if (!log.actor_id && !log.actor_name) return;
      if (log.actor_role === 'system') return;
      const a = getA(log.actor_id ? String(log.actor_id) : null, log.actor_name);
      if (log.actor_role) a.roles.add(String(log.actor_role));
      if (log.step_label) a.steps.add(String(log.step_label).replace(/\s*\((อนุมัติแทน)?โดย .*\)$/, ''));
      a.total += 1;
      const start = stepStart(log, leave);
      const hrs = start ? (new Date(log.created_at) - new Date(start)) / 36e5 : null;
      if (hrs != null && hrs >= 0) a.hours.push(hrs);

      if (log.action === 'rejected') {
        a.rejected += 1;
        if (isBlankReason(log.comment)) a.noReason += 1;
        if (info.id) a.perEmp[info.id] = { n: (a.perEmp[info.id]?.n || 0) + 1, name: info.name };
        rejections.push({
          kind: 'manual', at: log.created_at, leaveId: log.leave_id, ...info,
          step: log.step_label || log.step_level || '-',
          decidedBy: log.actor_name || 'ไม่ทราบชื่อ',
          approverKeys: [a.key],
          comment: log.comment || '',
          hours: hrs
        });
      } else {
        a.approved += 1;
      }
    });

    // ใบเก่าที่ไม่มีหลักฐาน (ก่อนเปิดระบบบันทึก) — ไม่ทราบชื่อผู้กด
    rejectedLeaves.filter((r) => !loggedReject.has(r.id)).forEach((r) => {
      const info = empInfo(null, r);
      const step = r.manager_status === 'rejected' ? 'ลำดับที่ 1' : r.director_status === 'rejected' ? 'ลำดับที่ 2' : r.executive_status === 'rejected' ? 'ลำดับที่ 3' : '-';
      const auto = /อัตโนมัติ|48/.test(r.approval_comment || '');
      rejections.push({
        kind: auto ? 'expired' : 'legacy', at: r.updated_at || r.created_at, leaveId: r.id, ...info,
        step,
        decidedBy: auto ? 'ไม่พิจารณาภายใน 48 ชม.' : 'ไม่มีบันทึกผู้พิจารณา (ข้อมูลก่อนเปิดระบบหลักฐาน)',
        approverKeys: [],
        comment: r.approval_comment || '',
        hours: r.created_at && r.updated_at ? (new Date(r.updated_at) - new Date(r.created_at)) / 36e5 : null
      });
    });

    rejections.sort((x, y) => new Date(y.at) - new Date(x.at));

    const list = Object.values(approvers).map((a) => {
      const decided = a.approved + a.rejected;
      const rate = decided ? a.rejected / decided : 0;
      const avgH = a.hours.length ? a.hours.reduce((s, h) => s + h, 0) / a.hours.length : null;
      const topEmp = Object.values(a.perEmp).sort((x, y) => y.n - x.n)[0] || null;
      return { ...a, roles: [...a.roles], steps: [...a.steps], decided, rate, avgH, topEmp };
    });
    const tot = list.reduce((s, a) => ({ d: s.d + a.decided, r: s.r + a.rejected }), { d: 0, r: 0 });
    const overall = tot.d ? tot.r / tot.d : 0;
    list.forEach((a) => {
      const flags = [];
      if (a.rejected >= 3 && a.rate >= Math.max(overall * 2, 0.2)) flags.push(`อัตราไม่อนุมัติ ${Math.round(a.rate * 100)}% (เฉลี่ยทั้งองค์กร ${Math.round(overall * 100)}%)`);
      if (a.expired >= 3) flags.push(`ปล่อยใบลาหมดเวลา ${a.expired} ใบ`);
      if (a.noReason >= 2) flags.push(`ไม่อนุมัติโดยไม่ระบุเหตุผล ${a.noReason} ครั้ง`);
      if (a.topEmp && a.topEmp.n >= 3) flags.push(`ไม่อนุมัติ ${a.topEmp.name} ซ้ำ ${a.topEmp.n} ครั้ง`);
      a.flags = flags;
    });
    list.sort((x, y) => (y.flags.length - x.flags.length) || (y.rejected + y.expired - x.rejected - x.expired) || (y.decided - x.decided));

    state.rejections = rejections;
    state.approvers = list;
    state.overallRate = overall;
    state.logsAvailable = logsAvailable;
    state.loaded = true;
  }

  // ---------------------------------------------------------------------
  // แสดงผล
  // ---------------------------------------------------------------------
  function ensurePanel() {
    let panel = $(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.className = 'panel ra-panel';
    panel.hidden = true;
    const anchor = $('leaveTablePanel');
    if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    else ($('pageContent') || document.body).appendChild(panel);
    return panel;
  }

  function shell() {
    const r = leaveYearRange();
    return `
      <div class="ra-head">
        <div class="ra-title">
          <span class="material-symbols-outlined">gavel</span>
          <div>
            <h2>การพิจารณาที่ไม่อนุมัติ</h2>
            <p>ใครไม่อนุมัติ ขั้นไหน เหตุผลอะไร และสรุปการพิจารณาของผู้อนุมัติแต่ละคน (อ่านอย่างเดียว จากบันทึกหลักฐานที่แก้ไขไม่ได้)</p>
          </div>
        </div>
        <div class="ra-filters">
          <label>ตั้งแต่ <input type="date" id="raFrom" class="form-select" value="${r.from}"></label>
          <label>ถึง <input type="date" id="raTo" class="form-select" value="${r.to}"></label>
          <button type="button" class="ap-btn ap-btn--light" id="raReload"><span class="material-symbols-outlined">sync</span><span>โหลด</span></button>
        </div>
      </div>
      <div id="raBody"><div class="ra-loading"><span class="material-symbols-outlined spin">sync</span> กำลังรวบรวมข้อมูล...</div></div>`;
  }

  function filtered() {
    const f = state.filters;
    const q = f.q.trim().toLowerCase();
    return state.rejections.filter((r) =>
      (!f.dept || r.dept === f.dept) &&
      (!f.kind || r.kind === f.kind) &&
      (!f.approver || r.approverKeys.includes(f.approver)) &&
      (!q || [r.name, r.code, r.dept, r.type, r.decidedBy, r.comment, r.reason, r.step].some((v) => String(v || '').toLowerCase().includes(q))));
  }

  function renderBody() {
    const body = $('raBody');
    if (!body) return;
    const rows = filtered();
    const all = state.rejections;
    const nManual = all.filter((r) => r.kind === 'manual').length;
    const nExpired = all.filter((r) => r.kind === 'expired').length;
    const nLegacy = all.filter((r) => r.kind === 'legacy').length;
    const depts = [...new Set(all.map((r) => r.dept).filter((d) => d && d !== '-'))].sort();
    const f = state.filters;
    const approverOpts = state.approvers.filter((a) => a.rejected || a.expired);

    body.innerHTML = `
      ${state.logsAvailable ? '' : `<div class="ra-note ra-note--warn">ยังไม่มีตารางบันทึกหลักฐาน (leave_approval_logs) — แสดงได้เฉพาะใบลาที่ไม่อนุมัติ โดยไม่ทราบชื่อผู้พิจารณา กรุณารัน supabase/migrations/20261005_leave_approval_logs.sql</div>`}

      <div class="ra-kpis">
        <div class="ra-kpi"><span>ไม่อนุมัติทั้งหมด</span><strong>${all.length}</strong><small>ในช่วงเวลาที่เลือก</small></div>
        <div class="ra-kpi"><span>ผู้พิจารณากดไม่อนุมัติ</span><strong>${nManual}</strong><small>มีชื่อผู้กดและเหตุผล</small></div>
        <div class="ra-kpi"><span>หมดเวลา 48 ชม.</span><strong>${nExpired}</strong><small>ผู้อนุมัติไม่พิจารณาตามกำหนด</small></div>
        <div class="ra-kpi"><span>อัตราไม่อนุมัติรวม</span><strong>${Math.round(state.overallRate * 100)}%</strong><small>จากการพิจารณาทุกขั้น</small></div>
      </div>

      <h3 class="ra-h3"><span class="material-symbols-outlined">groups</span> สรุปรายผู้พิจารณา</h3>
      <p class="ra-hint">กดที่ชื่อเพื่อดูรายการไม่อนุมัติของคนนั้น · ป้าย "ควรตรวจสอบ" เป็นเพียงข้อสังเกตจากตัวเลข ไม่ใช่ข้อสรุป ควรอ่านเหตุผลประกอบทุกครั้ง</p>
      ${state.approvers.length ? `
      <div class="ra-table-wrap">
        <table class="ra-table">
          <thead><tr>
            <th>ผู้พิจารณา</th><th>ขั้นที่พิจารณา</th><th class="num">พิจารณา</th><th class="num">อนุมัติ</th>
            <th class="num">ไม่อนุมัติ</th><th class="num">% ไม่อนุมัติ</th><th class="num">ปล่อยหมดเวลา</th>
            <th class="num">ไม่ระบุเหตุผล</th><th class="num">เวลาพิจารณาเฉลี่ย</th><th>ข้อสังเกต</th>
          </tr></thead>
          <tbody>
            ${state.approvers.map((a) => `
              <tr class="${a.flags.length ? 'is-flagged' : ''} ${f.approver === a.key ? 'is-selected' : ''}">
                <td><button type="button" class="ra-link" data-approver="${esc(a.key)}">${esc(a.name)}</button>${a.roles.length ? `<small>${esc(a.roles.join(', '))}</small>` : ''}</td>
                <td class="ra-steps">${esc(a.steps.join(' · ') || '-')}</td>
                <td class="num">${a.decided}</td>
                <td class="num">${a.approved}</td>
                <td class="num ${a.rejected ? 'neg' : ''}">${a.rejected}</td>
                <td class="num">${a.decided ? Math.round(a.rate * 100) + '%' : '-'}</td>
                <td class="num ${a.expired ? 'warn' : ''}">${a.expired}</td>
                <td class="num">${a.noReason}</td>
                <td class="num">${hoursText(a.avgH)}</td>
                <td>${a.flags.length ? a.flags.map((x) => `<span class="ra-flag">ควรตรวจสอบ: ${esc(x)}</span>`).join('') : '<span class="ra-ok">-</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div class="ra-empty">ยังไม่มีบันทึกการพิจารณาในช่วงเวลานี้</div>`}

      <h3 class="ra-h3"><span class="material-symbols-outlined">block</span> รายการที่ไม่อนุมัติ <span class="ra-count">${rows.length} / ${all.length}</span></h3>
      <div class="ra-toolbar">
        <div class="search-box-wrap"><span class="material-symbols-outlined">search</span>
          <input type="text" id="raSearch" class="search-input" placeholder="ค้นหาพนักงาน ผู้พิจารณา เหตุผล..." value="${esc(f.q)}"></div>
        <select id="raDept" class="form-select"><option value="">ทุกแผนก</option>${depts.map((d) => `<option ${f.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
        <select id="raApprover" class="form-select"><option value="">ผู้พิจารณาทุกคน</option>${approverOpts.map((a) => `<option value="${esc(a.key)}" ${f.approver === a.key ? 'selected' : ''}>${esc(a.name)} (${a.rejected + a.expired})</option>`).join('')}</select>
        <select id="raKind" class="form-select">
          <option value="">ทุกรูปแบบ</option>
          <option value="manual" ${f.kind === 'manual' ? 'selected' : ''}>ผู้พิจารณากดไม่อนุมัติ</option>
          <option value="expired" ${f.kind === 'expired' ? 'selected' : ''}>หมดเวลา 48 ชม.</option>
          ${nLegacy ? `<option value="legacy" ${f.kind === 'legacy' ? 'selected' : ''}>ข้อมูลเก่า (ไม่มีบันทึกผู้กด)</option>` : ''}
        </select>
        <button type="button" class="ap-btn ap-btn--excel" id="raExport"><span class="material-symbols-outlined">download</span><span>CSV</span></button>
      </div>
      ${rows.length ? `
      <div class="ra-table-wrap">
        <table class="ra-table ra-table--list">
          <thead><tr>
            <th>วันที่พิจารณา</th><th>พนักงาน</th><th>ใบลา</th><th>ขั้น</th><th>ผู้พิจารณา</th>
            <th>เหตุผลที่ไม่อนุมัติ</th><th>เหตุผลการลาของพนักงาน</th><th class="num">ใช้เวลา</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr class="ra-kind-${r.kind}">
                <td data-label="วันที่พิจารณา">${thDate(r.at, true)}</td>
                <td data-label="พนักงาน"><strong>${esc(r.name)}</strong><small>${esc(r.code ? '#' + r.code + ' · ' : '')}${esc(r.dept)}</small></td>
                <td data-label="ใบลา">${esc(r.type)}<small>${thDate(r.start)}${r.end && r.end !== r.start ? ' – ' + thDate(r.end) : ''}${r.days != null ? ` · ${esc(r.days)} วัน` : ''}</small></td>
                <td data-label="ขั้น">${esc(r.step)}</td>
                <td data-label="ผู้พิจารณา"><span class="ra-badge ra-badge--${r.kind}">${r.kind === 'manual' ? 'ไม่อนุมัติ' : r.kind === 'expired' ? 'หมดเวลา' : 'ข้อมูลเก่า'}</span> ${esc(r.decidedBy)}</td>
                <td data-label="เหตุผลที่ไม่อนุมัติ" class="ra-reason">${r.kind === 'manual' && isBlankReason(r.comment) ? '<em class="ra-missing">ไม่ได้ระบุเหตุผล</em>' : esc(r.comment || '-')}</td>
                <td data-label="เหตุผลการลา" class="ra-reason">${esc(r.reason || '-')}</td>
                <td data-label="ใช้เวลา" class="num">${hoursText(r.hours)}</td>
                <td>${r.leaveId ? `<button type="button" class="btn-act btn-act-preview" data-preview="${esc(r.leaveId)}" title="ดูรายละเอียดและประวัติการพิจารณา"><span class="material-symbols-outlined">visibility</span></button>` : ''}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div class="ra-empty">ไม่พบรายการตามเงื่อนไข</div>`}`;
  }

  function exportCsv() {
    const rows = filtered();
    const head = ['วันที่พิจารณา', 'รหัสพนักงาน', 'ชื่อพนักงาน', 'แผนก', 'ประเภทการลา', 'วันที่ลา', 'ถึง', 'จำนวนวัน', 'ขั้น', 'รูปแบบ', 'ผู้พิจารณา', 'เหตุผลที่ไม่อนุมัติ', 'เหตุผลการลา', 'ใช้เวลา (ชม.)'];
    const kindTxt = { manual: 'ผู้พิจารณาไม่อนุมัติ', expired: 'หมดเวลา 48 ชม.', legacy: 'ข้อมูลเก่า' };
    const lines = [head].concat(rows.map((r) => [
      thDate(r.at, true), r.code, r.name, r.dept, r.type, r.start || '', r.end || '', r.days ?? '', r.step,
      kindTxt[r.kind], r.decidedBy, r.comment, r.reason, r.hours != null ? r.hours.toFixed(1) : ''
    ]));
    const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `การไม่อนุมัติใบลา_${$('raFrom')?.value || ''}_${$('raTo')?.value || ''}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function bind(panel) {
    if (panel.dataset.bound) return;
    panel.dataset.bound = '1';
    panel.addEventListener('click', (e) => {
      const ap = e.target.closest('[data-approver]');
      if (ap) {
        state.filters.approver = state.filters.approver === ap.dataset.approver ? '' : ap.dataset.approver;
        renderBody();
        $('raSearch')?.closest('.ra-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const pv = e.target.closest('[data-preview]');
      if (pv) {
        if (typeof global.previewLeaveModal === 'function') {
          try { global.previewLeaveModal(pv.dataset.preview); } catch (err) { console.warn(err); }
        }
        return;
      }
      if (e.target.closest('#raReload')) { refresh(true); return; }
      if (e.target.closest('#raExport')) exportCsv();
    });
    panel.addEventListener('input', (e) => {
      if (e.target.id === 'raSearch') {
        state.filters.q = e.target.value;
        const pos = e.target.selectionStart;
        renderBody();
        const s = $('raSearch'); if (s) { s.focus(); try { s.setSelectionRange(pos, pos); } catch (x) {} }
      }
    });
    panel.addEventListener('change', (e) => {
      const map = { raDept: 'dept', raApprover: 'approver', raKind: 'kind' };
      if (map[e.target.id]) { state.filters[map[e.target.id]] = e.target.value; renderBody(); }
      if (e.target.id === 'raFrom' || e.target.id === 'raTo') refresh(true);
    });
  }

  async function refresh(force) {
    const from = $('raFrom')?.value;
    const to = $('raTo')?.value;
    if (!from || !to) return;
    const key = `${from}|${to}`;
    if (!force && state.loaded && state.rangeKey === key) { renderBody(); return; }
    if (state.loading) return;
    state.loading = true;
    const body = $('raBody');
    if (body) body.innerHTML = `<div class="ra-loading"><span class="material-symbols-outlined spin">sync</span> กำลังรวบรวมข้อมูล...</div>`;
    try {
      await load(from, to);
      state.rangeKey = key;
      renderBody();
    } catch (err) {
      console.error('[Rejection Audit]', err);
      if (body) body.innerHTML = `<div class="ra-empty ra-note--warn">โหลดข้อมูลไม่สำเร็จ: ${esc(err.message || err)}</div>`;
    } finally {
      state.loading = false;
    }
  }

  function open() {
    const panel = ensurePanel();
    if (!panel.dataset.ready) { panel.innerHTML = shell(); panel.dataset.ready = '1'; bind(panel); }
    panel.hidden = false;
    refresh(false);
  }

  function close() {
    const panel = $(PANEL_ID);
    if (panel) panel.hidden = true;
  }

  global.PVTRejectionAudit = { open, close, refresh, _state: state, _build: build };
})(typeof window !== 'undefined' ? window : this);
