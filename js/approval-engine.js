/* ==========================================================================
   🔗 PVT Approval Engine — สายอนุมัติแบบหลายขั้น (ระยะ 2)
   --------------------------------------------------------------------------
   หาสายอนุมัติ:  รายบุคคล (l1/l2/l3) → ทีม/กะ → แผนก → (ผู้บริหาร) → HR
   กติกา:
     • ขั้นเดียวมีผู้อนุมัติได้หลายคน "คนใดคนหนึ่งกดก็ได้"
     • ผู้ยื่นเป็นผู้อนุมัติขั้นไหน → ข้ามขั้นนั้นและขั้นที่ต่ำกว่า
     • ผู้อนุมัติชุดเดียวกันซ้ำขั้นติดกัน → รวมเป็นขั้นเดียว
     • ผู้อนุมัติที่พ้นสภาพ/ไม่ active → ตัดออก (ขั้นว่าง = ข้าม)
     • ใบลาของหัวหน้า/ผู้จัดการ → ต่อด้วยผู้บริหาร (ตั้งค่า approval_policy)
     • ไม่เหลือใครเลย → ขั้น "ฝ่ายบุคคล (HR)" (HR/Admin คนใดก็ได้)
   ทุกใบลาเก็บขั้นไว้ใน leave_approval_steps (ล็อกตอนยื่น)
   และอัปเดตคอลัมน์เดิม (manager_status / director_status / executive_status)
   ให้หน้าจอเดิมแสดงผลได้เหมือนเดิม
   ต้องรัน supabase/migrations/20261006_approval_chains.sql ก่อน
   ถ้ายังไม่รัน → ระบบใช้ขั้นตอนแบบเดิม (ระยะ 1) อัตโนมัติ
   ========================================================================== */
(function (global) {
  'use strict';
  if (global.PVTApproval) return;

  const HR_ROLES = ['hr', 'admin', 'hr_manager', 'superadmin'];
  const OVERRIDE_ROLES = ['hr', 'admin', 'superadmin', 'director', 'executive', 'owner'];
  const LEGACY_COL = (n) => (n === 1 ? 'manager_status' : n === 2 ? 'director_status' : 'executive_status');

  function client() {
    return global.pvtSupabase?.getClient?.() || global.PVTSDK?.client || global.pvtSupabase?.client || global.supabaseClient || null;
  }
  function sessionUser() {
    try { return JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || 'null') || {}; } catch (e) { return {}; }
  }
  function me() {
    const u = sessionUser();
    const e = u.employees || u;
    return {
      id: String(e.id || u.employee_id || ''),
      name: e.full_name || u.full_name || u.name || '',
      role: String(u.role || e.role || '').toLowerCase(),
      code: String(e.employee_code || u.employee_code || '')
    };
  }
  const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean).map(String)));
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const isHrLike = (emp) => {
    const role = String(emp?.role || '').toLowerCase();
    const code = String(emp?.employee_code || '').toLowerCase();
    return HR_ROLES.includes(role) || code === 'admin' || code === 'superadmin' || code.startsWith('hr-');
  };
  const isActive = (emp) => emp && (!emp.status || String(emp.status).toLowerCase() === 'active');
  const nowIso = () => new Date().toISOString();

  // ---------------------------------------------------------------------
  // ตรวจว่ารัน migration ระยะ 2 แล้วหรือยัง (แคชไว้)
  // ---------------------------------------------------------------------
  let readyPromise = null;
  function isReady() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const sb = client();
      if (!sb) { readyPromise = null; return false; }
      const { error } = await sb.from('leave_approval_steps').select('id').limit(1);
      if (error) {
        if (!/does not exist|PGRST205|42P01|Could not find the table/i.test(`${error.code} ${error.message}`)) readyPromise = null; // ลองใหม่ภายหลัง
        return false;
      }
      return true;
    })().catch(() => { readyPromise = null; return false; });
    return readyPromise;
  }

  // ---------------------------------------------------------------------
  // ข้อมูลที่ต้องใช้คำนวณสาย (โหลดครั้งเดียวต่อการเรียก)
  // ---------------------------------------------------------------------
  async function loadContext(applicantId) {
    const sb = client();
    const { data: applicant, error } = await sb.from('employees')
      .select('id, full_name, employee_code, role, status, department_id, team_id, l1_approver_id, l2_approver_id, l3_approver_id, positions!position_id(position_name)')
      .eq('id', applicantId).maybeSingle();
    if (error) throw error;
    if (!applicant) throw new Error('ไม่พบข้อมูลพนักงานผู้ยื่น');

    const scopes = [];
    if (applicant.department_id) scopes.push(`and(scope_type.eq.department,scope_id.eq.${applicant.department_id})`);
    if (applicant.team_id) scopes.push(`and(scope_type.eq.team,scope_id.eq.${applicant.team_id})`);
    const [chainRes, policyRes, execRes, daRes] = await Promise.all([
      scopes.length ? sb.from('approval_chain_steps').select('scope_type, scope_id, step_no, step_label, approver_ids').or(scopes.join(',')) : Promise.resolve({ data: [] }),
      sb.from('system_settings').select('setting_value').eq('setting_key', 'approval_policy').maybeSingle(),
      sb.from('system_settings').select('employee_id').eq('setting_key', 'leave_executive_approver').maybeSingle(),
      applicant.department_id ? sb.from('department_approvers').select('supervisor_id, manager_id').eq('department_id', applicant.department_id).maybeSingle() : Promise.resolve({ data: null })
    ]);
    if (chainRes.error) throw chainRes.error;
    const chainRows = chainRes.data || [];
    const policy = Object.assign({ executive_for_approvers: true }, policyRes?.data?.setting_value || {});
    const executiveId = execRes?.data?.employee_id ? String(execRes.data.employee_id) : '';

    // รายชื่อ/สถานะของผู้อนุมัติทุกคนที่เกี่ยวข้อง
    const ids = uniq([
      ...chainRows.flatMap((r) => r.approver_ids || []),
      applicant.l1_approver_id, applicant.l2_approver_id, applicant.l3_approver_id, executiveId,
      daRes?.data?.supervisor_id, daRes?.data?.manager_id
    ]);
    let people = {};
    if (ids.length) {
      const { data: rows } = await sb.from('employees').select('id, full_name, role, status, employee_code').in('id', ids);
      (rows || []).forEach((r) => { people[String(r.id)] = r; });
    }
    return { applicant, chainRows, policy, executiveId, legacyDept: daRes?.data || null, people };
  }

  // ---------------------------------------------------------------------
  // คำนวณสายอนุมัติของพนักงาน → [{ step_no, step_label, approver_ids, approver_names, hr_any, status, skip_reason, source }]
  // ---------------------------------------------------------------------
  function buildChain(ctx) {
    const { applicant, chainRows, policy, executiveId, legacyDept, people } = ctx;
    const selfId = String(applicant.id);
    const byNo = {};

    // 1) แผนก
    const deptRows = chainRows.filter((r) => r.scope_type === 'department').sort((a, b) => a.step_no - b.step_no);
    deptRows.forEach((r) => { byNo[r.step_no] = { label: r.step_label || `ขั้นที่ ${r.step_no}`, ids: uniq(r.approver_ids), source: 'department' }; });
    // ยังไม่ได้ตั้งในตารางใหม่ → ใช้ค่าเดิม (department_approvers)
    if (!deptRows.length && legacyDept) {
      const sup = legacyDept.supervisor_id ? String(legacyDept.supervisor_id) : '';
      const mgr = legacyDept.manager_id ? String(legacyDept.manager_id) : '';
      if (sup && sup !== mgr) { byNo[1] = { label: 'หัวหน้างาน', ids: [sup], source: 'department' }; if (mgr) byNo[2] = { label: 'ผู้จัดการ', ids: [mgr], source: 'department' }; }
      else if (mgr) byNo[1] = { label: 'ผู้จัดการ', ids: [mgr], source: 'department' };
    }
    // 2) ทีม/กะ (แทนที่เฉพาะขั้นที่ตั้งไว้)
    chainRows.filter((r) => r.scope_type === 'team').forEach((r) => {
      byNo[r.step_no] = { label: r.step_label || byNo[r.step_no]?.label || `ขั้นที่ ${r.step_no}`, ids: uniq(r.approver_ids), source: 'team' };
    });
    // 3) รายบุคคล (ข้อยกเว้น)
    [['l1_approver_id', 1, 'หัวหน้างาน'], ['l2_approver_id', 2, 'ผู้จัดการ'], ['l3_approver_id', 3, 'ผู้บริหาร']].forEach(([col, no, label]) => {
      if (applicant[col]) byNo[no] = { label: byNo[no]?.label || label, ids: [String(applicant[col])], source: 'personal' };
    });

    // เรียงขั้น + ตัดผู้อนุมัติที่ไม่ active
    let steps = Object.keys(byNo).map(Number).sort((a, b) => a - b).map((no) => {
      const s = byNo[no];
      const activeIds = s.ids.filter((id) => isActive(people[id]));
      return { label: s.label, ids: activeIds, source: s.source, removed: s.ids.length - activeIds.length };
    });

    const out = [];
    const push = (s, status, reason) => out.push({
      step_label: s.label,
      approver_ids: s.ids,
      approver_names: s.ids.map((id) => people[id]?.full_name || '-'),
      hr_any: !!s.hr_any,
      status,
      skip_reason: reason || null,
      source: s.source
    });

    // ผู้ยื่นเป็นผู้อนุมัติขั้นไหน → ข้ามขั้นนั้นและขั้นที่ต่ำกว่า
    let selfIdx = -1;
    steps.forEach((s, i) => { if (s.ids.includes(selfId)) selfIdx = i; });

    let lastKept = null;
    steps.forEach((s, i) => {
      if (i <= selfIdx) return push(s, 'skipped', i === selfIdx ? 'ผู้ยื่นเป็นผู้อนุมัติขั้นนี้เอง' : 'ขั้นต่ำกว่าตำแหน่งของผู้ยื่น');
      if (!s.ids.length) return push(s, 'skipped', s.removed ? 'ผู้อนุมัติไม่อยู่ในสถานะใช้งาน' : 'ยังไม่ได้กำหนดผู้อนุมัติ');
      if (lastKept && sameSet(lastKept.ids, s.ids)) return push(s, 'skipped', 'ผู้อนุมัติคนเดียวกับขั้นก่อนหน้า');
      lastKept = s;
      push(s, 'waiting');
    });

    // ใบลาของหัวหน้า/ผู้จัดการ → ผู้บริหาร
    const applicantRole = String(applicant.role || '').toLowerCase();
    const isApproverApplicant = selfIdx >= 0 || ['leader', 'manager', 'supervisor'].includes(applicantRole);
    const activeIds = out.filter((s) => s.status === 'waiting').flatMap((s) => s.approver_ids);
    if (policy.executive_for_approvers !== false && isApproverApplicant && executiveId && executiveId !== selfId &&
        isActive(people[executiveId]) && !activeIds.includes(executiveId)) {
      push({ label: 'ผู้บริหาร', ids: [executiveId], source: 'executive' }, 'waiting');
    }

    // ไม่มีใครอนุมัติเลย → HR
    if (!out.some((s) => s.status === 'waiting')) {
      push({ label: 'ฝ่ายบุคคล (HR)', ids: [], hr_any: true, source: 'hr' }, 'waiting');
    }

    out.forEach((s, i) => { s.step_no = i + 1; });
    const first = out.find((s) => s.status === 'waiting');
    if (first) first.status = 'pending';
    return out;
  }

  async function resolveChain(applicantId) {
    return buildChain(await loadContext(applicantId));
  }

  // คอลัมน์เดิมให้หน้าจอเดิมแสดงผลได้ (ข้าม/ไม่มี = approved)
  function legacyColumns(steps) {
    const cols = { manager_status: 'approved', director_status: 'approved', executive_status: 'approved' };
    steps.forEach((s) => {
      const col = LEGACY_COL(s.step_no);
      const st = s.status === 'skipped' || s.status === 'approved' ? 'approved'
        : (s.status === 'rejected' || s.status === 'expired') ? 'rejected' : 'pending';
      if (cols[col] === 'approved' || st === 'rejected') cols[col] = st === 'approved' ? cols[col] : st;
    });
    return cols;
  }

  // ---------------------------------------------------------------------
  // ตอนยื่นใบลา: บันทึกขั้นของใบลา (คืน steps ที่บันทึก)
  // ---------------------------------------------------------------------
  async function createSteps(leaveRow, chain) {
    const sb = client();
    const rows = chain.map((s) => ({
      leave_id: leaveRow.id,
      step_no: s.step_no,
      step_label: s.step_label,
      approver_ids: s.approver_ids,
      approver_names: s.approver_names,
      hr_any: s.hr_any,
      status: s.status,
      skip_reason: s.skip_reason,
      activated_at: s.status === 'pending' ? nowIso() : null
    }));
    const { error } = await sb.from('leave_approval_steps').insert(rows);
    if (error) throw error;
    const first = chain.find((s) => s.status === 'pending');
    const upd = Object.assign({ current_step: first ? first.step_no : null }, legacyColumns(chain));
    await sb.from('leave_requests').update(upd).eq('id', leaveRow.id);
    return chain;
  }

  // คอลัมน์ step เริ่มต้นสำหรับ payload ตอน insert (ก่อนมี id)
  function initialLegacyFields(chain) {
    const first = chain.find((s) => s.status === 'pending');
    return Object.assign({ current_step: first ? first.step_no : null }, legacyColumns(chain));
  }

  async function getSteps(leaveId) {
    const sb = client();
    const { data, error } = await sb.from('leave_approval_steps').select('*').eq('leave_id', leaveId).order('step_no', { ascending: true });
    if (error) return null;
    return data || [];
  }

  async function getStepsForLeaves(leaveIds) {
    const out = {};
    const ids = uniq(leaveIds);
    if (!ids.length || !(await isReady())) return out;
    const sb = client();
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await sb.from('leave_approval_steps').select('*').in('leave_id', ids.slice(i, i + 150));
      (data || []).forEach((s) => { (out[s.leave_id] = out[s.leave_id] || []).push(s); });
    }
    Object.values(out).forEach((arr) => arr.sort((a, b) => a.step_no - b.step_no));
    return out;
  }

  function currentStep(steps) {
    return (steps || []).find((s) => s.status === 'pending') || null;
  }

  // ผู้ใช้คนนี้กดขั้นนี้ได้ไหม → { ok, override, reason }
  function canAct(step, actor, actorRole) {
    if (!step) return { ok: false, reason: 'ใบลานี้ไม่มีขั้นที่รอพิจารณา' };
    const role = String(actorRole || actor.role || '').toLowerCase();
    if ((step.approver_ids || []).map(String).includes(actor.id)) return { ok: true, override: false };
    if (step.hr_any && (HR_ROLES.includes(role) || actor.code.toLowerCase().startsWith('hr-'))) return { ok: true, override: false };
    if (OVERRIDE_ROLES.includes(role)) return { ok: true, override: true };
    return { ok: false, reason: `ใบลานี้รอ "${step.step_label || 'ผู้อนุมัติ'}" (${(step.approver_names || []).join(' หรือ ') || 'HR'}) พิจารณาอยู่` };
  }

  // ---------------------------------------------------------------------
  // แจ้งเตือน
  // ---------------------------------------------------------------------
  async function notifyApprovers(leave, step, typeHint) {
    const sb = client();
    const ids = step.hr_any ? [] : uniq(step.approver_ids);
    const applicantName = leave.employees?.full_name || 'พนักงาน';
    const deptName = leave.employees?.departments?.department_name || '';
    const leaveTypeName = leave.leave_types?.leave_name || 'ใบลา';
    if (!ids.length) {
      // ขั้น HR: แจ้ง HR ทุกคนในระบบ (ไม่ส่ง LINE)
      if (global.PVTLeaveAudit) {
        const hrs = await global.PVTLeaveAudit.hrRecipients();
        if (hrs.length) {
          await sb.from('notifications').insert(hrs.map((h) => ({
            employee_id: h.id,
            title: `มีใบลารอ HR พิจารณา: ${applicantName}`,
            message: `ประเภท: ${leaveTypeName}\nวันที่: ${leave.start_date} ถึง ${leave.end_date}\n(ไม่มีผู้อนุมัติในสายงาน หรือผ่านขั้นก่อนหน้าแล้ว)`,
            type: 'leave',
            link_url: `/pages/hr/hr.html?id=${encodeURIComponent(leave.id)}`
          })));
        }
      }
      return;
    }
    const { data: people } = await sb.from('employees').select('id, full_name, line_id').in('id', ids);
    for (const p of people || []) {
      try {
        if (global.PVTSDK?.line) {
          // SDK บันทึกแจ้งเตือนในระบบ + ส่ง LINE (ถ้าผูกไว้และเปิดใช้)
          await global.PVTSDK.line.sendWorkflowNotification({
            type: typeHint || 'NEW_REQUEST',
            recipientId: p.id,
            recipientLineId: p.line_id || '',
            leaveId: leave.id,
            employeeName: applicantName,
            employeeCode: leave.employees?.employee_code || '',
            departmentName: deptName,
            recipientRole: 'approver',
            leaveType: leaveTypeName,
            startDate: leave.start_date,
            endDate: leave.end_date,
            totalDays: leave.total_days,
            reason: leave.reason || '',
            comment: step.step_label ? `รอ${step.step_label}พิจารณา` : '',
            attachmentUrl: leave.attachment_url || ''
          });
        } else {
          await sb.from('notifications').insert({
            employee_id: p.id,
            title: `มีใบลารอท่านพิจารณา: ${applicantName}`,
            message: `ประเภท: ${leaveTypeName}\nวันที่: ${leave.start_date} ถึง ${leave.end_date}\nขั้น: ${step.step_label || '-'}`,
            type: 'leave',
            link_url: '/pages/approver/leave-approvals.html'
          });
        }
      } catch (err) {
        console.warn('⚠️ [Approval] แจ้งผู้อนุมัติไม่สำเร็จ:', p.id, err);
      }
    }
  }

  async function notifyEmployee(leave, kind, comment, stepLabel) {
    const sb = client();
    const leaveName = leave.leave_types?.leave_name || 'ใบลา';
    try {
      if ((kind === 'approved' || kind === 'rejected') && global.PVTSDK?.line) {
        await global.PVTSDK.line.sendWorkflowNotification({
          type: kind === 'approved' ? 'REQUEST_APPROVED' : 'REJECTED',
          recipientId: leave.employee_id,
          recipientLineId: leave.employees?.line_id || '',
          leaveId: leave.id,
          employeeName: leave.employees?.full_name || 'พนักงาน',
          employeeCode: leave.employees?.employee_code || '',
          departmentName: leave.employees?.departments?.department_name || '',
          recipientRole: 'employee',
          leaveType: leaveName,
          startDate: leave.start_date,
          endDate: leave.end_date,
          totalDays: leave.total_days,
          comment: comment || (kind === 'approved' ? 'ใบลาของคุณได้รับการอนุมัติเรียบร้อยแล้ว' : ''),
          attachmentUrl: leave.attachment_url || ''
        });
        return;
      }
      const titles = {
        approved: 'ใบลาของคุณได้รับการอนุมัติแล้ว',
        rejected: 'ใบลาของคุณไม่ได้รับการอนุมัติ',
        progress: `ใบลาของคุณผ่านการพิจารณาของ${stepLabel || 'ผู้อนุมัติ'}แล้ว`
      };
      await sb.from('notifications').insert({
        employee_id: leave.employee_id,
        title: titles[kind] || titles.progress,
        message: kind === 'progress'
          ? `ใบลาประเภท ${leaveName} วันที่ ${leave.start_date} ผ่านการพิจารณาของ${stepLabel || 'ผู้อนุมัติ'}แล้ว อยู่ระหว่างรอขั้นถัดไป`
          : `ใบลาประเภท ${leaveName} วันที่ ${leave.start_date}${comment ? `\nเหตุผล/ความเห็น: ${comment}` : ''}`,
        type: 'leave',
        link_url: '/pages/user/leave-history.html'
      });
    } catch (err) {
      console.warn('⚠️ [Approval] แจ้งพนักงานไม่สำเร็จ:', err);
    }
  }

  async function loadLeave(leaveId) {
    const sb = client();
    const { data, error } = await sb.from('leave_requests')
      .select('*, employees!employee_id(id, full_name, employee_code, line_id, role, department_id, departments!department_id(department_name)), leave_types!leave_type_id(id, leave_name, leave_code)')
      .eq('id', leaveId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function deductBalance(leave) {
    if (!global.PVTSDK?.user?.updateLeaveBalance) return null;
    try {
      let days = Number(leave.total_days) || 0;
      if (typeof global.getEffectiveLeaveDays === 'function') {
        try { days = await global.getEffectiveLeaveDays(leave); } catch (e) {}
      }
      let year = new Date(leave.start_date).getFullYear();
      if (year > 2400) year -= 543;
      await global.PVTSDK.user.updateLeaveBalance(leave.employee_id, leave.leave_type_id, leave.leave_types?.leave_code || null, year, days);
      return null;
    } catch (err) {
      return err?.message || String(err);
    }
  }

  // ---------------------------------------------------------------------
  // อนุมัติขั้นปัจจุบัน → { ok, final, reason, stepLabel, balanceError }
  // ---------------------------------------------------------------------
  async function approve(leaveId, opts = {}) {
    const sb = client();
    const actor = opts.actor || me();
    const leave = await loadLeave(leaveId);
    if (!leave) return { ok: false, reason: 'ไม่พบใบลา' };
    if (String(leave.status).toLowerCase() !== 'pending') return { ok: false, reason: 'ใบลานี้ไม่ได้อยู่ในสถานะรอพิจารณาแล้ว', stale: true };
    const steps = await getSteps(leaveId);
    if (!steps || !steps.length) return { ok: false, reason: 'no_steps' };
    const cur = currentStep(steps);
    const perm = canAct(cur, actor, opts.actorRole);
    if (!perm.ok) return { ok: false, reason: perm.reason, denied: true };
    if (String(leave.employee_id) === actor.id && !['admin', 'superadmin'].includes(actor.role)) {
      return { ok: false, reason: 'ไม่สามารถอนุมัติใบลาของตนเองได้', denied: true };
    }

    const t = nowIso();
    const label = perm.override ? `${cur.step_label} (อนุมัติแทนโดย ${actor.name || 'HR/ผู้บริหาร'})` : cur.step_label;
    const { data: changed, error } = await sb.from('leave_approval_steps')
      .update({ status: 'approved', acted_by: actor.id || null, acted_by_name: actor.name || null, acted_at: t, comment: opts.comment || null })
      .eq('id', cur.id).eq('status', 'pending').select('id');
    if (error) throw error;
    if (!changed || !changed.length) return { ok: false, reason: 'มีผู้พิจารณาขั้นนี้ไปก่อนหน้าแล้ว', stale: true };
    cur.status = 'approved';

    // ขั้นถัดไป: ถ้าผู้อนุมัติคือคนเดิมคนเดียว → ผ่านต่ออัตโนมัติ
    let next = steps.find((s) => s.step_no > cur.step_no && s.status === 'waiting') || null;
    while (next && !next.hr_any && sameSet(uniq(next.approver_ids), [actor.id])) {
      await sb.from('leave_approval_steps').update({ status: 'approved', acted_by: actor.id, acted_by_name: actor.name, acted_at: t, comment: 'ผู้อนุมัติคนเดียวกับขั้นก่อนหน้า (ผ่านอัตโนมัติ)' }).eq('id', next.id).eq('status', 'waiting');
      next.status = 'approved';
      next = steps.find((s) => s.step_no > next.step_no && s.status === 'waiting') || null;
    }

    const auditBase = { stepLevel: `S${cur.step_no}`, stepLabel: label, comment: opts.comment || null, statusBefore: 'pending' };

    if (next) {
      await sb.from('leave_approval_steps').update({ status: 'pending', activated_at: t }).eq('id', next.id).eq('status', 'waiting');
      next.status = 'pending';
      await sb.from('leave_requests').update(Object.assign({ current_step: next.step_no, updated_at: t }, legacyColumns(steps))).eq('id', leaveId).eq('status', 'pending');
      if (global.PVTLeaveAudit) await global.PVTLeaveAudit.log(leave, 'step_approved', Object.assign({}, auditBase, { statusAfter: 'pending' }));
      await notifyApprovers(leave, next, cur.step_no === 1 ? 'LEADER_APPROVED' : 'MANAGER_APPROVED');
      await notifyEmployee(leave, 'progress', null, cur.step_label);
      return { ok: true, final: false, stepLabel: label, nextLabel: next.step_label };
    }

    // ขั้นสุดท้าย
    const final = Object.assign({ status: 'approved', approved_at: t, approved_by: actor.id || null, current_step: null, updated_at: t }, legacyColumns(steps));
    const { data: fin, error: finErr } = await sb.from('leave_requests').update(final).eq('id', leaveId).eq('status', 'pending').select('id');
    if (finErr) throw finErr;
    if (!fin || !fin.length) return { ok: false, reason: 'ใบลาถูกดำเนินการไปแล้ว', stale: true };
    const balanceError = await deductBalance(leave);
    if (global.PVTLeaveAudit) {
      await global.PVTLeaveAudit.recordOutcome(leave, 'approved', Object.assign({}, auditBase, {
        statusAfter: 'approved', meta: balanceError ? { balance_error: balanceError } : undefined
      }));
    }
    await notifyEmployee(leave, 'approved');
    return { ok: true, final: true, stepLabel: label, balanceError };
  }

  // ---------------------------------------------------------------------
  // ไม่อนุมัติ (จบที่ขั้นนี้) → { ok, reason }
  // ---------------------------------------------------------------------
  async function reject(leaveId, comment, opts = {}) {
    const sb = client();
    const actor = opts.actor || me();
    const leave = await loadLeave(leaveId);
    if (!leave) return { ok: false, reason: 'ไม่พบใบลา' };
    if (String(leave.status).toLowerCase() !== 'pending') return { ok: false, reason: 'ใบลานี้ไม่ได้อยู่ในสถานะรอพิจารณาแล้ว', stale: true };
    const steps = await getSteps(leaveId);
    if (!steps || !steps.length) return { ok: false, reason: 'no_steps' };
    const cur = currentStep(steps);
    const perm = canAct(cur, actor, opts.actorRole);
    if (!perm.ok) return { ok: false, reason: perm.reason, denied: true };

    const t = nowIso();
    const { data: changed, error } = await sb.from('leave_approval_steps')
      .update({ status: 'rejected', acted_by: actor.id || null, acted_by_name: actor.name || null, acted_at: t, comment: comment || null })
      .eq('id', cur.id).eq('status', 'pending').select('id');
    if (error) throw error;
    if (!changed || !changed.length) return { ok: false, reason: 'มีผู้พิจารณาขั้นนี้ไปก่อนหน้าแล้ว', stale: true };
    cur.status = 'rejected';
    await sb.from('leave_approval_steps').update({ status: 'cancelled' }).eq('leave_id', leaveId).eq('status', 'waiting');
    steps.forEach((s) => { if (s.status === 'waiting') s.status = 'cancelled'; });

    const upd = Object.assign({ status: 'rejected', approval_comment: comment || null, current_step: null, updated_at: t }, legacyColumns(steps));
    const { data: fin, error: finErr } = await sb.from('leave_requests').update(upd).eq('id', leaveId).eq('status', 'pending').select('id');
    if (finErr) throw finErr;
    if (!fin || !fin.length) return { ok: false, reason: 'ใบลาถูกดำเนินการไปแล้ว', stale: true };

    const label = perm.override ? `${cur.step_label} (โดย ${actor.name || 'HR/ผู้บริหาร'})` : cur.step_label;
    if (global.PVTLeaveAudit) {
      await global.PVTLeaveAudit.recordOutcome(leave, 'rejected', { stepLevel: `S${cur.step_no}`, stepLabel: label, comment, statusBefore: 'pending', statusAfter: 'rejected' });
    }
    await notifyEmployee(leave, 'rejected', comment);
    return { ok: true, stepLabel: label };
  }

  // ---------------------------------------------------------------------
  // ปิดขั้นที่ค้าง (ยกเลิก / หมดเวลา) — ใช้กับยกเลิกใบลา และไม่อนุมัติอัตโนมัติ
  // ---------------------------------------------------------------------
  async function closeOpenSteps(leaveId, pendingStatus, comment) {
    if (!(await isReady())) return;
    const sb = client();
    try {
      await sb.from('leave_approval_steps').update({ status: pendingStatus, acted_at: nowIso(), comment: comment || null }).eq('leave_id', leaveId).eq('status', 'pending');
      await sb.from('leave_approval_steps').update({ status: 'cancelled' }).eq('leave_id', leaveId).eq('status', 'waiting');
      await sb.from('leave_requests').update({ current_step: null }).eq('id', leaveId);
    } catch (e) { /* ใบลาเก่าไม่มีขั้น */ }
  }

  // ---------------------------------------------------------------------
  // โอนขั้นที่ค้างให้ผู้อนุมัติใหม่ (HR)
  // ---------------------------------------------------------------------
  async function reassignStep(stepId, newApproverIds, opts = {}) {
    const sb = client();
    const actor = opts.actor || me();
    const ids = uniq(newApproverIds);
    const { data: step } = await sb.from('leave_approval_steps').select('*').eq('id', stepId).maybeSingle();
    if (!step) return { ok: false, reason: 'ไม่พบขั้นอนุมัติ' };
    if (!['pending', 'waiting'].includes(step.status)) return { ok: false, reason: 'ขั้นนี้ไม่ได้ค้างอยู่แล้ว' };
    let names = [];
    if (ids.length) {
      const { data: people } = await sb.from('employees').select('id, full_name').in('id', ids);
      names = ids.map((id) => (people || []).find((p) => String(p.id) === id)?.full_name || '-');
    }
    const { data: changed, error } = await sb.from('leave_approval_steps')
      .update({ approver_ids: ids, approver_names: names, hr_any: ids.length === 0 })
      .eq('id', stepId).in('status', ['pending', 'waiting']).select('id');
    if (error) throw error;
    if (!changed || !changed.length) return { ok: false, reason: 'ขั้นนี้ถูกพิจารณาไปแล้ว' };
    const leave = await loadLeave(step.leave_id);
    if (global.PVTLeaveAudit && leave) {
      await global.PVTLeaveAudit.log(leave, 'reassigned', {
        stepLevel: `S${step.step_no}`, stepLabel: step.step_label,
        comment: `${(step.approver_names || []).join(', ') || 'HR'} → ${names.join(', ') || 'HR'}${opts.reason ? ` (${opts.reason})` : ''}`,
        actor
      });
    }
    if (step.status === 'pending' && leave) {
      await notifyApprovers(leave, Object.assign({}, step, { approver_ids: ids, approver_names: names, hr_any: ids.length === 0 }), 'NEW_REQUEST');
    }
    return { ok: true, names };
  }

  // ---------------------------------------------------------------------
  // แสดงผลขั้นในรูปแบบเดียวกับ getApprovalWorkflowSteps เดิม
  // ---------------------------------------------------------------------
  function toDisplaySteps(steps) {
    return (steps || []).filter((s) => s.status !== 'skipped').map((s) => {
      const st = s.status === 'waiting' ? 'pending' : s.status === 'expired' ? 'rejected' : s.status;
      const who = s.hr_any ? 'HR' : (s.approver_names || []).join(' / ');
      return {
        role: 'step',
        stepNo: s.step_no,
        shortName: s.step_label || `ขั้นที่ ${s.step_no}`,
        fullName: `${s.step_label || `ขั้นที่ ${s.step_no}`}${who ? ` — ${who}` : ''}`,
        approverNames: who,
        actedBy: s.acted_by_name || '',
        actedAt: s.acted_at || '',
        status: st
      };
    });
  }

  global.PVTApproval = {
    isReady, resolveChain, buildChain, loadContext, createSteps, initialLegacyFields,
    getSteps, getStepsForLeaves, currentStep, canAct, approve, reject,
    closeOpenSteps, reassignStep, toDisplaySteps, legacyColumns, me, notifyApprovers
  };
})(typeof window !== 'undefined' ? window : this);
