// ============================================================================
// 🚀 PVT HR System - [FULL ROLE-BASED APPROVALS & CANCELLATION WORKFLOW]
// ============================================================================

let currentRole = "hr"; 
let currentUserProfile = null;
let allLeaveRequests = []; 
let currentLeaveTab = "pending"; // 'pending' | 'cancellation' | 'history'
let hasExecutiveColumn = true;
let deptApproversMap = {};

// ⚡ [1. IMMEDIATE CHECK]: เช็กสิทธิ์ทันทีตั้งแต่นาทีแรกที่โหลด JS
(function checkRoleImmediately() {
  try {
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = sessionUser?.employees || sessionUser || {};
    
    const fastRole = String(sessionUser?.role || empData?.role || "").toLowerCase();
    const fastPosition = String(empData?.positions?.position_name || empData?.position_name || "").toLowerCase();

    const fastCode = String(empData?.employee_code || sessionUser?.employee_code || "").toLowerCase().trim();
    // ใช้เกณฑ์เดียวกับตัวตรวจสิทธิ์ตอนเปิดหน้า (early-auth-guard) — เดิมเช็กแค่ชื่อ role ตรงตัว
    // บัญชีอย่าง superadmin / hr_manager / HR-xxx จึงโดนปฏิเสธ แล้วหน้าว่างทั้งหน้า
    let guardCat = "";
    try { guardCat = window.PVTGuardRoleCategory ? (window.PVTGuardRoleCategory(sessionUser) || {}).category || "" : ""; } catch (_) {}
    const isAllowedRole = (
      guardCat === "hr_exec" || guardCat === "leader_manager" ||
      /(^|_)(hr|admin|superadmin|director|manager|leader|supervisor|head|executive|owner)($|_)/.test(fastRole) ||
      fastRole.includes("admin") || fastRole.includes("hr") ||
      fastCode === "admin" || fastCode.startsWith("hr-") || fastCode === "10001" ||
      fastPosition.includes("ผู้จัดการ") || fastPosition.includes("ผู้อำนวยการ") || fastPosition.includes("หัวหน้า") || fastPosition.includes("บริหาร") ||
      fastPosition.includes("manager") || fastPosition.includes("leader") || fastPosition.includes("supervisor")
    );

    if (!isAllowedRole) {
      document.documentElement.style.visibility = 'hidden';
      window.__PVT_ACCESS_DENIED__ = true;
    }
  } catch (e) {
    console.error("🔒 Auth Check Error:", e);
  }
})();

// 🛡️ Helper function to escape HTML string to prevent XSS
function escapeHtml(value) {
  if (window.PVTSDK?.utils?.escapeHtml) {
    return window.PVTSDK.utils.escapeHtml(value);
  }
  if (window.pvtSupabase?.utils?.escapeHtml) {
    return window.pvtSupabase.utils.escapeHtml(value);
  }
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__PVT_ACCESS_DENIED__) {
    // ต้องแสดงหน้าก่อน ไม่งั้นกล่องแจ้งเตือนถูกซ่อนไปด้วย (หน้าว่างค้าง)
    document.documentElement.style.visibility = 'visible';
    console.warn('[HR] บัญชีนี้ไม่มีสิทธิ์เข้าหน้าตรวจใบลา', { role: (JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || '{}') || {}).role });
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        title: '<span style="color: #0f172a; font-size: 20px; font-weight: 700;">⛔ ปฏิเสธการเข้าถึง</span>',
        html: `
          <div style="font-family: 'Sarabun', sans-serif; text-align: center; color: #475569; padding: 10px 0;">
            <p style="font-size: 15px; margin-bottom: 6px; font-weight: 600; color: #1e293b;">คุณไม่มีสิทธิ์เข้าถึงหน้าระบบอนุมัติใบลา</p>
            <p style="font-size: 13px; color: #64748b; margin: 0;">หน้านี้สำหรับหัวหน้างาน ผู้จัดการ หรือ HR เท่านั้น</p>
          </div>
        `,
        icon: 'error',
        confirmButtonText: '🏠 กลับหน้าหลักพนักงาน',
        confirmButtonColor: 'var(--th-s-500, #06b6d4)',
        allowOutsideClick: false,
        allowEscapeKey: false
      });
    } else {
      alert("⛔ คุณไม่มีสิทธิ์เข้าถึงหน้าระบบอนุมัติใบลา");
    }

    window.location.href = "/pages/user/index-user.html";
    return;
  }

  await initSystemAndPermissions();
});

/* ==========================================================================
   🔑 1. ROLE PERMISSIONS & DYNAMIC UI CONTROL
   ========================================================================== */

async function initSystemAndPermissions() {
  try {
    // 1. ดึงข้อมูล Profile อย่างละเอียดผ่าน SDK
    if (window.pvtSupabase?.hr?.getProfile) {
      currentUserProfile = await window.pvtSupabase.hr.getProfile();
    }
    
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    
    // สำคัญ: ดึงข้อมูลพนักงาน (empData) จากจุดที่ลึกที่สุดเพื่อให้ได้ ID ที่ถูกต้อง (Employee UUID ไม่ใช่ Auth ID)
    const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    
    // ตรวจสอบ Role และ Position เพื่อกำหนดสิทธิ์การมองเห็น
    const rawRole = String(currentUserProfile?.role || sessionUser?.role || empData?.role || "").toLowerCase();
    const rawPos = String(empData?.position_name || empData?.positions?.position_name || sessionUser?.position_name || "").toLowerCase();

    console.log("[HR Init] User Identity:", { rawRole, rawPos, empId: empData?.id });

    // ตรวจสอบโครงสร้างสายอนุมัติของแต่ละแผนก (department_approvers + รายชื่อหัวหน้า/ผู้จัดการจริงในแต่ละแผนก)
    const sb = window.pvtSupabase?.getClient();
    let isDeptSupervisor = false;
    let isDeptManager = false;
    if (sb) {
      try {
        const [apprvRes, deptRes, empRes] = await Promise.all([
          sb.from("department_approvers").select("department_id, supervisor_id, manager_id"),
          sb.from("departments").select("id, department_name, approver_id, backup_approver_id"),
          sb.from("employees").select("id, department_id, role, positions!position_id(position_name), status, l1_approver_id, l2_approver_id")
        ]);

        const apprvList = apprvRes.data || [];
        const depts = deptRes.data || [];
        const allEmps = empRes.data || [];

        const approverConfigByDept = {};
        apprvList.forEach(a => {
          if (a.department_id) approverConfigByDept[a.department_id] = a;
        });

        deptApproversMap = {};
        depts.forEach(d => {
          const cfg = approverConfigByDept[d.id];
          const deptEmps = allEmps.filter(e => e.department_id === d.id && (e.status === 'active' || !e.status));
          const deptName = String(d.department_name || '').toLowerCase();
          const isHrDept = deptName.includes('บุคคล') || deptName.includes('hr') || deptName.includes('ทรัพยากรบุคคล');
          
          let hasLeader = false;
          let supervisor_id = null;
          let hasManager = false;
          let manager_id = null;

          if (isHrDept) {
            // 🛡️ แผนกบุคคล/ทรัพยากรบุคคล: ไม่มีหัวหน้างาน (L1) มีแต่ผู้จัดการฝ่าย (L2)
            hasLeader = false;
            supervisor_id = null;
            hasManager = true;
            manager_id = cfg?.manager_id || d.approver_id || deptEmps.find(e => String(e.role || '').toLowerCase().includes('manager') || String(e.positions?.position_name || '').toLowerCase().includes('ผู้จัดการ'))?.id || null;
          } else if (cfg) {
            // 🎯 กำหนดค่าอย่างเป็นทางการจากตาราง department_approvers
            hasLeader = Boolean(cfg.supervisor_id);
            supervisor_id = cfg.supervisor_id || null;
            hasManager = Boolean(cfg.manager_id || d.approver_id);
            manager_id = cfg.manager_id || d.approver_id || null;
          } else {
            // สำรอง (Fallback) เฉพาะแผนกที่ยังไม่เคยตั้งค่าในตาราง department_approvers
            const leaders = deptEmps.filter(e => {
              const r = String(e.role || '').toLowerCase();
              const p = String(e.positions?.position_name || '').toLowerCase();
              return (r === 'leader' || r.includes('leader') || r.includes('supervisor') || p.includes('หัวหน้า')) && !r.includes('manager') && !p.includes('ผู้จัดการ');
            });
            const managers = deptEmps.filter(e => {
              const r = String(e.role || '').toLowerCase();
              const p = String(e.positions?.position_name || '').toLowerCase();
              return r === 'manager' || r.includes('manager') || p.includes('ผู้จัดการ');
            });
            hasLeader = leaders.length > 0;
            supervisor_id = leaders[0]?.id || null;
            hasManager = Boolean(d.approver_id || managers.length > 0);
            manager_id = d.approver_id || managers[0]?.id || null;
          }

          deptApproversMap[d.id] = {
            hasLeader,
            hasManager,
            supervisor_id,
            manager_id,
            // 'config' = HR ตั้งไว้ในหน้า ตั้งค่าสายอนุมัติ, 'hr' = แผนกบุคคล, 'fallback' = เดาจากตำแหน่ง
            source: isHrDept ? 'hr' : (cfg ? 'config' : 'fallback')
          };
        });
        window.deptApproversMap = deptApproversMap;

        const deptNamesMap = {};
        depts.forEach(d => {
          deptNamesMap[d.id] = d.department_name;
        });
        window.allDepartmentsMap = deptNamesMap;

        if (empData?.id) {
          const empIdStr = String(empData.id);
          isDeptSupervisor = apprvList.some(a => String(a.supervisor_id) === empIdStr) ||
            depts.some(d => String(d.backup_approver_id) === empIdStr) ||
            allEmps.some(e => String(e.l1_approver_id) === empIdStr) ||
            allEmps.some(e => String(e.id) === empIdStr && (e.role === 'leader' || String(e.positions?.position_name || '').includes('หัวหน้า')));
          
          isDeptManager = apprvList.some(a => String(a.manager_id) === empIdStr) ||
            depts.some(d => String(d.approver_id) === empIdStr) ||
            allEmps.some(e => String(e.l2_approver_id) === empIdStr) ||
            allEmps.some(e => String(e.id) === empIdStr && (e.role === 'manager' || String(e.positions?.position_name || '').includes('ผู้จัดการ')));
        }
      } catch (e) {
        console.warn("Error checking approver list:", e);
      }
    }

    // ดึงค่าผู้บริหารสูงสุดอนุมัติหลัก (L3) จาก system_settings
    let isExecutiveApprover = false;
    try {
      const { data: execSet } = await sb.from("system_settings").select("employee_id").eq("setting_key", "leave_executive_approver").maybeSingle();
      if (execSet?.employee_id) {
        window.executiveSetting = execSet;
        window.executiveApproverId = execSet.employee_id;
        if (empData?.id && String(empData.id) === String(execSet.employee_id)) {
          isExecutiveApprover = true;
        }
      }
    } catch(err) {
      console.warn("Could not check executive approver setting:", err);
    }

    const empCode = String(empData?.employee_code || "").trim();

    // กำหนดกลุ่ม Role เพื่อใช้ในการ Filter ข้อมูล (ให้สิทธิ์ L3 Executive Approver เป็นอันดับสูงสุด)
    window.isViewOnlyHR = false; // Flag สำหรับสิทธิ์การดูอย่างเดียว

    if (empCode === '19122') {
      // 🌟 น.ส. ปณัยยา บุญเกิด: ผู้จัดการฝ่ายบุคคล-ธุรการ
      // มีแอคเคาต์แยกสำหรับ HR กลาง (HR-001/002/003) ให้ทำหน้าที่เป็น Manager อนุมัติเฉพาะคนในแผนกตนเอง
      currentRole = "manager";
    } else if (empCode === 'HR-001-3') {
      // 🌟 เฉพาะรหัส HR-001-3: ให้มีสิทธิ์เป็น HR (ดูได้อย่างเดียว ไม่สามารถอนุมัติได้)
      currentRole = "hr";
      window.isViewOnlyHR = true;
    } else if (isExecutiveApprover || rawRole === "director" || rawRole === "executive" || rawRole === "owner" || rawPos.includes("ผู้อำนวยการ") || rawPos.includes("ผู้บริหาร") || rawPos.includes("director") || rawPos.includes("executive") || rawPos.includes("owner")) {
      currentRole = "director";
    } else if (rawRole === "admin" || rawRole === "superadmin" || rawRole.includes("admin")) {
      currentRole = "admin";
    } else if (rawRole === "hr" || rawRole.includes("hr")) {
      currentRole = "hr";
    } else if (rawRole === "manager" || isDeptManager || rawPos.includes("ผู้จัดการ") || rawPos.includes("manager")) {
      currentRole = "manager";
    } else if (rawRole === "leader" || isDeptSupervisor || rawPos.includes("หัวหน้า") || rawPos.includes("leader") || rawPos.includes("supervisor")) {
      currentRole = "leader";
    } else {
      currentRole = "user"; // Default สำหรับพนักงานทั่วไป
    }
    
    console.log("[HR Init] Assigned System Role:", currentRole);

    document.documentElement.style.visibility = 'visible';

    const userNameEl = document.getElementById("userNameHeader");
    const userPositionEl = document.getElementById("userPositionHeader");
    const userAvatarEl = document.getElementById("userAvatarHeader");

    if (userNameEl) userNameEl.textContent = empData?.full_name || "ผู้ใช้งาน";
    if (userPositionEl) userPositionEl.textContent = empData?.positions?.position_name || empData?.position_name || "ไม่ระบุตำแหน่ง";
    if (userAvatarEl) userAvatarEl.src = getAvatarUrl(empData || null);

    applyRoleBasedUI();
    
    // โหลดข้อมูลใบลา
    await loadPendingLeavesHR();

    // 🎯 [Query Param Tab/Status Auto Handler]:
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get("tab");
    const filterParam = urlParams.get("filter") || urlParams.get("status");

    if (tabParam) {
      console.log(`🎯 [Query Param]: Auto-switching tab to: ${tabParam}`);
      currentLeaveTab = tabParam;
      
      const tabBtn = document.querySelector(`.leave-tab-container .tab-btn[onclick*="${tabParam}"]`);
      if (tabBtn) {
        document.querySelectorAll('.leave-tab-container .tab-btn').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
      }

      // Update header titles based on tab
      const headerTitle = document.getElementById("sectionHeaderTitle");
      const headerIcon = document.getElementById("sectionHeaderIcon");
      const slaContainer = document.getElementById("leaveSlaTrackerContainer");
      const leaveTablePanel = document.getElementById("leaveTablePanel");

      if (tabParam === 'pending') {
        if (headerTitle) headerTitle.textContent = "คำขออนุมัติลาค้างพิจารณา";
        if (headerIcon) headerIcon.textContent = "hourglass_top";
        if (slaContainer) slaContainer.style.display = "block";
        if (leaveTablePanel) leaveTablePanel.style.display = "none";
      } else if (tabParam === 'cancellation') {
        if (headerTitle) headerTitle.textContent = "คำร้องขอยกเลิกใบลาหยุดงาน";
        if (headerIcon) headerIcon.textContent = "published_with_changes";
        if (slaContainer) slaContainer.style.display = "none";
        if (leaveTablePanel) leaveTablePanel.style.display = "block";
      } else {
        if (headerTitle) headerTitle.textContent = "ประวัติการพิจารณาใบลาทั้งหมด";
        if (headerIcon) headerIcon.textContent = "history";
        if (slaContainer) slaContainer.style.display = "none";
        if (leaveTablePanel) leaveTablePanel.style.display = "block";
      }
    }

    if (filterParam) {
      console.log(`🎯 [Query Param]: Auto-filtering to status/step: ${filterParam}`);
      const selectEl = document.getElementById("filterStepSelect");
      if (selectEl) {
        selectEl.value = filterParam;
      }
    }

    // Now render the table with the applied query parameters
    renderLeaveTable();

    // 🎯 [Query Param Auto Action Engine]:
    const leaveIdParam = urlParams.get("id") || urlParams.get("leave_id");
    const actionParam = urlParams.get("action");
    if (leaveIdParam) {
      console.log(`🎯 [Query Param]: Auto-opening leave preview/action for ID: ${leaveIdParam}`);
      setTimeout(() => {
        const found = allLeaveRequests.find(r => String(r.id) === String(leaveIdParam));
        if (found) {
          // If the leave status is cancellation or historical, automatically switch tab to make it visual
          const isCancel = found.status === 'cancel_requested' || found.status === 'cancel_pending' || found.status === 'ขอยกเลิก';
          const isHistory = found.status !== 'pending' && found.status !== 'รออนุมัติ' && !isCancel;
          
          if (isCancel) {
            currentLeaveTab = "cancellation";
            const tabBtn = document.querySelector('[onclick*="switchLeaveTab(\'cancellation\')"]');
            if (tabBtn) {
              document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
              tabBtn.classList.add('active');
            }
            renderLeaveTable();
          } else if (isHistory) {
            currentLeaveTab = "history";
            const tabBtn = document.querySelector('[onclick*="switchLeaveTab(\'history\')"]');
            if (tabBtn) {
              document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
              tabBtn.classList.add('active');
            }
            renderLeaveTable();
          }

          if ((actionParam === "approve" || actionParam === "reject") && (isHistory || isCancel)) {
            // ลิงก์ปุ่มอนุมัติ/ไม่อนุมัติจาก LINE แต่ใบลาดำเนินการไปแล้ว → แจ้งผลชัด ๆ
            showLeaveAlreadyHandled(leaveIdParam, found);
          } else if (actionParam === "approve") {
            approveLeave(leaveIdParam);
          } else if (actionParam === "reject") {
            rejectLeave(leaveIdParam);
          } else {
            previewLeaveModal(leaveIdParam);
          }
        } else {
          console.warn(`⚠️ [Query Param]: Leave ID ${leaveIdParam} not found in the loaded requests.`);
          // ลิงก์จาก LINE แต่ไม่พบใบลานี้ในรายการของท่าน → ดึงสถานะจริงจากฐานข้อมูลแล้วแจ้งว่าดำเนินการแล้ว
          showLeaveAlreadyHandled(leaveIdParam, null);
        }
      }, 800);
    }

  } catch (err) {
    console.error("💥 Error during HR System Init:", err);
  }
}

/* ==========================================================================
   📨 เปิดลิงก์จาก LINE แต่ใบลาดำเนินการไปแล้ว (อนุมัติ / ไม่อนุมัติ / ยกเลิก / ไม่ได้รอท่าน)
   → แจ้งผลชัด ๆ ว่า "ดำเนินการแล้ว" พร้อมรายละเอียด แทนการเปิดหน้าที่ไม่มีใบลา
   ========================================================================== */
async function showLeaveAlreadyHandled(leaveId, found) {
  if (!window.Swal) return;
  const sb = window.pvtSupabase?.getClient?.() || window.supabaseClient;
  let lv = found || null;
  let last = null;
  if (sb) {
    try {
      if (!lv) {
        const { data } = await sb.from('leave_requests')
          .select('id, status, start_date, end_date, total_days, leave_hours, approved_at, updated_at, cancel_reason, approval_comment, employees!employee_id(full_name, nickname), leave_types!leave_type_id(leave_name)')
          .eq('id', leaveId).maybeSingle();
        lv = data || null;
      }
      const { data: logs } = await sb.from('leave_approval_logs')
        .select('action, actor_name, step_label, created_at')
        .eq('leave_id', leaveId).order('created_at', { ascending: false }).limit(1);
      last = (logs && logs[0]) || null;
    } catch (e) {}
  }

  const goPending = () => {
    const pendBtn = document.querySelector('.tab-btn[onclick*="switchLeaveTab(\'pending\'"]');
    if (pendBtn) pendBtn.click();
    try { history.replaceState(null, '', `${location.pathname}?tab=pending`); } catch (e) {}
  };

  if (!lv) {
    await Swal.fire({
      icon: 'info', title: 'ไม่พบใบลานี้',
      html: 'ใบลานี้อาจถูกลบออกจากระบบแล้ว<br>ดูใบลาที่รอท่านอนุมัติได้ที่แท็บ <b>รออนุมัติ</b>',
      confirmButtonText: 'ดูใบลารออนุมัติ'
    });
    return goPending();
  }

  const st = String(lv.status || '').toLowerCase();
  const S = {
    approved:         { icon: 'success', head: 'ใบลานี้อนุมัติแล้ว',             color: '#15803d' },
    rejected:         { icon: 'error',   head: 'ใบลานี้ไม่ได้รับอนุมัติ',        color: '#b91c1c' },
    cancelled:        { icon: 'warning', head: 'ใบลานี้ถูกยกเลิกแล้ว',            color: '#b45309' },
    cancel_requested: { icon: 'warning', head: 'ผู้ยื่นขอยกเลิกใบลานี้',          color: '#b45309' },
    pending:          { icon: 'info',    head: 'ใบลานี้ไม่ได้รอท่านพิจารณาแล้ว', color: '#1d4ed8' }
  }[st] || { icon: 'info', head: 'ใบลานี้ดำเนินการแล้ว', color: '#334155' };

  const esc = (v) => escapeHtml(String(v ?? ''));
  const name = lv.employees?.full_name || '';
  const nick = lv.employees?.nickname ? ` (${lv.employees.nickname})` : '';
  const type = lv.leave_types?.leave_name || 'ใบลา';
  const range = lv.start_date === lv.end_date
    ? formatThaiDate(lv.start_date)
    : `${formatThaiDate(lv.start_date)} – ${formatThaiDate(lv.end_date)}`;
  const actionText = {
    approved: 'อนุมัติ', step_approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', auto_rejected: 'ไม่อนุมัติ (อัตโนมัติ)',
    cancelled: 'ยกเลิก', cancel_requested: 'ขอยกเลิก', cancel_approved: 'อนุมัติการยกเลิก', cancel_rejected: 'ไม่อนุมัติการยกเลิก'
  };
  const whoLine = last
    ? `${esc(actionText[last.action] || last.action)}โดย <b>${esc(last.actor_name || 'ระบบ')}</b>${last.created_at ? ` · ${esc(formatThaiDate(last.created_at, true))}` : ''}`
    : (lv.approved_at ? `เมื่อ ${esc(formatThaiDate(lv.approved_at, true))}` : '');
  const sub = st === 'pending'
    ? 'มีผู้อนุมัติดำเนินการลำดับนี้ไปแล้ว หรือใบลาอยู่ในลำดับของผู้อนุมัติคนอื่น'
    : st === 'cancel_requested'
      ? 'ใบลานี้รอ HR ตรวจสอบคำขอยกเลิก ท่านไม่ต้องดำเนินการ'
      : 'ท่านไม่ต้องดำเนินการกับใบลานี้แล้ว';
  const reason = (st === 'cancelled' || st === 'rejected') && (lv.cancel_reason || lv.approval_comment)
    ? `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:13px;text-align:left">เหตุผล: ${esc(lv.cancel_reason || lv.approval_comment)}</div>` : '';

  const res = await Swal.fire({
    icon: S.icon,
    title: S.head,
    html: `
      <div style="font-size:14.5px;line-height:1.7;color:#334155">
        <div style="font-weight:700;color:#0f172a">${esc(name)}${esc(nick)}</div>
        <div>${esc(type)} · ${esc(range)}</div>
        ${whoLine ? `<div style="margin-top:6px;color:${S.color}">${whoLine}</div>` : ''}
        ${reason}
        <div style="margin-top:10px;font-size:13px;color:#64748b">${esc(sub)}</div>
      </div>`,
    showCancelButton: !!found,
    confirmButtonText: 'ดูใบลารออนุมัติ',
    cancelButtonText: 'ดูรายละเอียดใบลานี้',
    reverseButtons: false
  });
  if (res.dismiss === Swal.DismissReason.cancel && found) return previewLeaveModal(leaveId);
  goPending();
}

function applyRoleBasedUI() {
  const sidebar = document.getElementById("mainSidebar");
  const mainContent = document.getElementById("mainContent");
  const btnBack = document.getElementById("btnHeaderBack");
  const roleBadge = document.getElementById("userRoleBadge");
  const cancellationTabBtn = document.querySelector('[onclick*="cancellation"]');

  if (cancellationTabBtn) {
    cancellationTabBtn.style.display = canReviewCancellationRequests() ? 'inline-flex' : 'none';
  }

  // แท็บ "การพิจารณาที่ไม่อนุมัติ": HR / Admin เท่านั้น (ผู้บริหาร หัวหน้า ผู้จัดการ ไม่เห็น)
  const rejectionsTabBtn = document.getElementById("tabBtnRejections");
  if (rejectionsTabBtn) rejectionsTabBtn.hidden = !canViewRejectionAudit();

  // กรองเมนูด้านข้างสำหรับ Leader/Manager
  // (layout ใหม่ใช้ .pvt-nav__item — selector เดิม .nav-menu .nav-item หาไม่เจอ เมนูจึงไม่เคยถูกซ่อน)
  // ใช้ hidden แทน inline display + important เพื่อไม่ไปทับ CSS ของ layout
  if (sidebar) {
    const navItems = sidebar.querySelectorAll(".pvt-nav__item, .nav-menu .nav-item");
    const isApproverOnly = currentRole === "leader" || currentRole === "manager";
    navItems.forEach(item => {
      const href = item.getAttribute("href") || "";
      // ซ่อนเมนู "ระบบจัดการส่วนกลาง" สำหรับหัวหน้า/ผู้จัดการ, HR/Admin เห็นทั้งหมด
      item.hidden = isApproverOnly && href.includes("management.html");
    });
  }

  if (currentRole === "leader" || currentRole === "manager") {
    // แถบเมนูด้านข้าง: ให้ layout-sidebar.css คุมการแสดงผลเอง (ไม่ใส่ inline display)
    if (mainContent) {
      // ล้าง inline styles เพื่อให้สไตล์ CSS ปกติและระบบย่อขยายเมนูด้านข้าง (Collapsible Sidebar) ทำงานได้ปกติ
      mainContent.style.removeProperty("margin-left");
      mainContent.style.removeProperty("width");
      mainContent.style.removeProperty("padding");
    }
    if (btnBack) btnBack.style.display = "inline-flex";

    if (roleBadge) {
      const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
      const sessionUser = savedSession ? JSON.parse(savedSession) : {};
      const empCode = String(currentUserProfile?.employee_code || currentUserProfile?.employees?.employee_code || sessionUser?.employee_code || '').trim();
      if (empCode === '19122') {
        roleBadge.textContent = "ผู้จัดการฝ่ายบุคคล-ธุรการ (อนุมัติคนในแผนก)";
        const pageSubTitle = document.getElementById("pageSubTitle");
        if (pageSubTitle) pageSubTitle.textContent = "ฝ่ายบุคคล-ธุรการ (อนุมัติเฉพาะคนในแผนก)";
      } else {
        roleBadge.textContent = currentRole === "manager" ? "ผู้อนุมัติ ลำดับที่ 2" : "ผู้อนุมัติ ลำดับที่ 1";
      }
      roleBadge.className = "status-badge status-pending";
    }
  } else {
    if (mainContent) {
      mainContent.style.removeProperty("margin-left");
      mainContent.style.removeProperty("width");
      mainContent.style.removeProperty("padding");
    }
    if (btnBack) btnBack.style.display = "none";
    if (roleBadge) {
      roleBadge.textContent = "PVT HR Administrator";
      roleBadge.className = "status-badge status-approved";
    }
  }
}

/* ==========================================================================
   🛠️ HELPER FUNCTIONS & DATE UTILS
   ========================================================================== */

function getAvatarUrl(imageUrl, title = "", gender = "", fullName = "") {
  // ใช้ตัวกลางของระบบ (รองรับรูปที่อัปโหลด + เพศตามคำนำหน้า)
  if (window.PVTSDK?.storage?.getAvatarUrl) return window.PVTSDK.storage.getAvatarUrl(imageUrl, title, gender, fullName);
  if (typeof imageUrl === 'object' && imageUrl !== null) {
    const obj = imageUrl;
    imageUrl = obj.image_url || obj.avatar_url || obj.avatar || obj.employees?.image_url || null;
    title = title || obj.title || obj.prefix || obj.employees?.title || "";
    gender = gender || obj.gender || obj.employees?.gender || "";
    fullName = fullName || obj.full_name || obj.name || obj.employees?.full_name || "";
  }

  const isPlaceholder = typeof window.pvtIsPlaceholderAvatar === 'function' ? window.pvtIsPlaceholderAvatar(imageUrl) : /default-avatar|avatar-(male|female)/i.test(String(imageUrl || ''));
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== "" && imageUrl !== "null" && imageUrl !== "undefined" && !isPlaceholder) {
    let url = imageUrl.trim();
    if (!url.startsWith("http")) {
      const baseUrl = window.SUPABASE_URL || 'https://pgogmhqjdchakcytsomx.supabase.co';
      url = `${baseUrl}/storage/v1/object/public/employee-images/${url.replace(/^\//, '')}`;
    }
    return url;
  }
  return typeof window.getDefaultAvatarUrl === "function"
    ? window.getDefaultAvatarUrl(title, gender, fullName)
    : (title.includes('สาว') || title.includes('นาง') || title.includes('น.ส.') || gender === 'female' || fullName.includes('นาง') || fullName.includes('น.ส.') ? '/assets/img/avatar-female.jpg?v=2' : '/assets/img/avatar-male.jpg?v=2');
}

function getAttachmentUrl(reqData) {
  if (!reqData) return null;
  let url = reqData.attachment_url || reqData.file_url || reqData.attachment || reqData.medical_certificate || null;
  if (!url || String(url).trim() === '' || url === 'null' || url === 'undefined') return null;
  
  url = String(url).trim();
  if (!url.startsWith('http') && !url.startsWith('data:')) {
    const baseUrl = window.SUPABASE_URL || 'https://pgogmhqjdchakcytsomx.supabase.co';
    url = `${baseUrl}/storage/v1/object/public/leave-attachments/${url}`;
  }
  return url;
}

function isPendingStatus(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'pending' || s === 'รออนุมัติ' || s === 'wait' || s === 'waiting' || s.startsWith('pending_');
}

function isLeaderOrManagerRole(roleStr, posStr = '') {
  const r = String(roleStr || '').toLowerCase();
  const p = String(posStr || '').toLowerCase();
  return (
    r.includes('leader') || r.includes('supervisor') || r.includes('head') ||
    r.includes('manager') || r.includes('director') || r.includes('executive') || r.includes('owner') ||
    r.includes('ผู้จัดการ') || r.includes('หัวหน้า') || r.includes('ผู้บริหาร') ||
    p.includes('ผู้จัดการ') || p.includes('หัวหน้า') || p.includes('ผู้บริหาร') ||
    p.includes('ผู้อำนวยการ') || p.includes('ผจก')
  );
}

function isCancelRequestStatus(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'cancel_requested' || s === 'cancel_pending' || s === 'ขอยกเลิก' || s === 'รออนุมัติยกเลิก';
}

function canReviewCancellationRequests() {
  const role = String(currentRole || '').toLowerCase();
  return role === 'hr' || role === 'admin';
}

function canDecideCancellationRequests() {
  return canReviewCancellationRequests() && !window.isViewOnlyHR;
}
window.canReviewCancellationRequests = canReviewCancellationRequests;
window.canDecideCancellationRequests = canDecideCancellationRequests;

// 👤 รหัสพนักงาน (UUID) ของผู้ใช้ปัจจุบัน
function getMyEmpId() {
  const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const sessionUser = savedSession ? JSON.parse(savedSession) : {};
  const id = currentUserProfile?.employees?.id || currentUserProfile?.id || sessionUser?.employees?.id || sessionUser?.id || sessionUser?.employee_id;
  return id ? String(id) : '';
}

function isStepPending(v) {
  return !v || String(v).trim().toLowerCase() === 'pending';
}

// 🔗 สายอนุมัติของใบลา (เฉพาะที่ HR กำหนดไว้ชัดเจน: รายบุคคล หรือ ตั้งค่าแผนก)
//    l1 = หัวหน้างาน, l2 = ผู้จัดการ — ถ้า L1 กับ L2 เป็นคนเดียวกัน ถือว่ามีขั้นเดียว (L2)
function resolveRequestChain(req) {
  const emp = req?.employees || {};
  const cfg = (window.deptApproversMap && emp.department_id) ? (window.deptApproversMap[emp.department_id] || {}) : {};
  const fromCfg = cfg.source === 'config' || cfg.source === 'hr';
  let l1 = String(emp.l1_approver_id || (fromCfg ? cfg.supervisor_id || '' : '') || '');
  const l2 = String(emp.l2_approver_id || (fromCfg ? cfg.manager_id || '' : '') || '');
  if (l1 && l1 === l2) l1 = '';
  return { l1, l2 };
}

function stepInfoForRole(role) {
  if (role === 'leader') return { level: 'L1', label: 'ผู้อนุมัติ ลำดับที่ 1' };
  if (role === 'manager') return { level: 'L2', label: 'ผู้อนุมัติ ลำดับที่ 2' };
  if (role === 'executive' || role === 'director' || role === 'owner') return { level: 'L3', label: 'ผู้อนุมัติ ลำดับสูง' };
  return { level: 'HR', label: 'ฝ่ายบุคคล (HR/Admin)' };
}

function isPendingForRole(r, role) {
  if (!isPendingStatus(r.status)) return false;

  // 🚫 ห้ามตรวจ/อนุมัติใบลาของตนเอง (Self-Leave Exclusion):
  // ผู้จัดการ/หัวหน้างานไม่สามารถตรวจหรืออนุมัติใบลาของตนเองได้ (ต้องส่งให้ผู้บริหาร L3 พิจารณา)
  const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const sessionUser = savedSession ? JSON.parse(savedSession) : {};
  const currentEmpId = currentUserProfile?.employees?.id || currentUserProfile?.id || sessionUser?.employees?.id || sessionUser?.id || sessionUser?.employee_id;
  const currentEmpIdStr = currentEmpId ? String(currentEmpId) : '';
  const currentEmpCode = String(currentUserProfile?.employee_code || sessionUser?.employee_code || '').trim();
  if (currentEmpIdStr && (String(r.employee_id || '') === currentEmpIdStr || String(r.employees?.id || '') === currentEmpIdStr)) {
    return false;
  }
  if (currentEmpCode && String(r.employees?.employee_code || '').trim() === currentEmpCode) {
    return false;
  }

  // 🔗 ใบลาที่มีขั้นอนุมัติ (ระยะ 2): รอเราเมื่อขั้นปัจจุบันมีชื่อเรา / HR เห็นทุกใบที่รอ
  if (r.__steps && r.__steps.length) {
    const cur = r.__steps.find((st) => st.status === 'pending');
    if (!cur) return false;
    const roleL = String(role || '').toLowerCase();
    if ((cur.approver_ids || []).map(String).includes(currentEmpIdStr)) return true;
    return roleL === 'hr' || roleL === 'admin';
  }

  // 🌟 สำหรับ น.ส. ปณัยยา บุญเกิด (รหัส: 19122) ผู้จัดการฝ่ายบุคคล-ธุรการ:
  if (currentEmpCode === '19122') {
    const isDirectorPending = (r.director_status || 'pending') === 'pending';
    const isManagerPending = (r.manager_status || 'pending') === 'pending';
    // แสดงรายการที่รอการพิจารณา ตราบใดที่ยังไม่ได้ approved_by หรือสถานะยัง pending
    return isDirectorPending || isManagerPending || !r.approved_by;
  }

  const userRole = String(role || '').toLowerCase();
  const me = getMyEmpId();
  const chain = resolveRequestChain(r);
  if (userRole === 'leader') {
    if (!isStepPending(r.manager_status)) return false;
    // ใบลาที่ HR กำหนดหัวหน้างาน (L1) เป็นคนอื่นไว้ → ไม่ใช่คิวของเรา
    if (chain.l1 && chain.l1 !== me && chain.l2 !== me) return false;
    return true;
  }
  if (userRole === 'manager') {
    // 🔢 ต้องเรียงลำดับ: ระหว่างรอหัวหน้างาน (L1) ผู้จัดการยังไม่เห็น
    //    ยกเว้นผู้จัดการเป็น L1 ของใบนี้เอง หรือใบนี้ไม่มี L1 ที่เป็นคนอื่น
    if (isStepPending(r.manager_status)) {
      return !chain.l1 || chain.l1 === me;
    }
    return isStepPending(r.director_status);
  }
  if (userRole === 'director' || userRole === 'executive' || userRole === 'owner') {
    return (r.executive_status || 'pending') === 'pending';
  }
  return true;
}
window.isPendingForRole = isPendingForRole;

function isHistoryForRole(r, role) {
  const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const sessionUser = savedSession ? JSON.parse(savedSession) : {};
  const currentEmpCode = String(currentUserProfile?.employee_code || sessionUser?.employee_code || '').trim();

  if (currentEmpCode === '19122') {
    if (!isPendingStatus(r.status) && !isCancelRequestStatus(r.status)) {
      return true;
    }
    if (isPendingStatus(r.status)) {
      return (r.director_status || 'pending') !== 'pending' && Boolean(r.approved_by);
    }
    return false;
  }

  const userRole = String(role || '').toLowerCase();
  if (!isPendingStatus(r.status) && !isCancelRequestStatus(r.status)) {
    return true;
  }
  if (isPendingStatus(r.status)) {
    if (userRole === 'leader') {
      return (r.manager_status || 'pending') !== 'pending';
    }
    if (userRole === 'manager') {
      return (r.director_status || 'pending') !== 'pending' && (r.manager_status || 'pending') !== 'pending';
    }
    if (userRole === 'director' || userRole === 'executive' || userRole === 'owner') {
      return (r.executive_status || 'pending') !== 'pending';
    }
  }
  return false;
}
window.isHistoryForRole = isHistoryForRole;

function getADYear(dateStr) {
  if (typeof window.getADYear === 'function' && window.getADYear !== getADYear) {
    return window.getADYear(dateStr);
  }
  if (!dateStr) {
    const now = new Date();
    return now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  }
  const str = String(dateStr).trim();
  const parts = str.split('T')[0].split('-');
  let yearPart = parseInt(parts[0], 10);
  if (isNaN(yearPart)) {
    const now = new Date();
    return now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  }
  if (yearPart > 2400) yearPart -= 543;
  if (parts.length >= 2 && parseInt(parts[1], 10) === 12) {
    yearPart += 1;
  }
  return yearPart;
}

async function calculateActualLeaveDays(startDateStr, endDateStr) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb || !startDateStr || !endDateStr) return 0;

  try {
    const cleanStart = String(startDateStr).split('T')[0];
    const cleanEnd = String(endDateStr).split('T')[0];

    const { data: holidayData } = await sb
      .from('holidays') 
      .select('*')
      .gte('holiday_date', cleanStart)
      .lte('holiday_date', cleanEnd);

    // วันทำงานพิเศษตามข้อตกลง (is_working_day) ทับวันหยุด/วันเสาร์-อาทิตย์
    const workdaySet = new Set((holidayData || []).filter(h => h.is_working_day).map(h => String(h.holiday_date).split('T')[0]));
    const holidaySet = new Set((holidayData || []).filter(h => !h.is_working_day).map(h => String(h.holiday_date).split('T')[0]));
    let totalDays = 0;

    const [sYear, sMonth, sDay] = cleanStart.split('-').map(Number);
    const [eYear, eMonth, eDay] = cleanEnd.split('-').map(Number);

    let start = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);

    while (start <= end) {
      const dayOfWeek = start.getDay();
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, '0');
      const d = String(start.getDate()).padStart(2, '0');
      const currentIsoString = `${y}-${m}-${d}`;

      const isSunday = (dayOfWeek === 0);
      const isSaturday = (dayOfWeek === 6);
      const isSpecialHoliday = holidaySet.has(currentIsoString);

      if (workdaySet.has(currentIsoString) || (!isSunday && !isSaturday && !isSpecialHoliday)) {
        totalDays++;
      }
      start.setDate(start.getDate() + 1);
    }

    return totalDays;
  } catch (err) {
    console.error("💥 คำนวณวันลาผิดพลาด:", err);
    return 0;
  }
}

async function getEffectiveLeaveDays(reqData) {
  if (reqData.actual_days && Number(reqData.actual_days) > 0) return Number(reqData.actual_days);
  // ใช้ total_days ที่บันทึกตอนยื่น (รองรับลาครึ่งวัน/รายชั่วโมง และวันเสาร์ที่ทำงาน) ให้ตรงกับ
  // ตัวเลขที่ผู้อนุมัติเห็น, การตัดยอดใน approval-engine.js และการคำนวณยอดใหม่ใน index-user.js
  // (เดิมคำนวณใหม่จากวันที่ จ.–ศ. → ลาครึ่งวันถูกตัด 1 วัน, ลาวันเสาร์ไม่ถูกตัด)
  if (Number(reqData.total_days) > 0) return Number(reqData.total_days);
  if (reqData.start_date && reqData.end_date) {
    const calc = await calculateActualLeaveDays(reqData.start_date, reqData.end_date);
    if (calc > 0) return calc;
  }
  return Number(reqData.total_days || 0);
}

function formatThaiDate(dateStr, showTime = false) {
  if (!dateStr) return "-";
  try {
    const cleanStr = String(dateStr).replace("Z", "");
    const dateObj = new Date(cleanStr);
    if (isNaN(dateObj.getTime())) return dateStr;

    const thaiMonths = [
      "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
      "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
    ];

    const day = dateObj.getDate();
    const month = thaiMonths[dateObj.getMonth()];
    const year = dateObj.getFullYear() + 543;

    let result = `${day} ${month} ${year}`;
    if (showTime) {
      const hours = String(dateObj.getHours()).padStart(2, "0");
      const mins = String(dateObj.getMinutes()).padStart(2, "0");
      result += ` เวลา ${hours}:${mins} น.`;
    }
    return result;
  } catch (e) {
    return dateStr;
  }
}

/**
 * ⏱️ คำนวณสถานะ SLA การพิจารณาอนุมัติใบลา
 * กฎบริษัท: หัวหน้างาน (L1) และ ผู้จัดการ (L2) ต้องพิจารณาอนุมัติภายใน 2 วันทำการ (48 ชม.)
 * หากเกินกำหนด 2 วัน ระบบจะระบุว่า "เกินกำหนด" / "ใบลาไม่ได้รับการพิจารณาในเวลาที่กำหนด"
 */
function getLeaveApprovalSLA(req) {
  if (!req || !req.created_at) {
    return { isOverdue: false, elapsedDays: 0, elapsedHours: 0, label: "" };
  }

  const st = String(req.status || '').toLowerCase();
  const isFinalApproved = (st === 'approved' || st === 'อนุมัติแล้ว');
  const isFinalRejected = (st === 'rejected' || st === 'ไม่อนุมัติ');
  const isCancelled = (st === 'cancelled' || st === 'ยกเลิก' || isCancelRequestStatus(st));

  // ถ้าสิ้นสุดกระบวนการแล้ว ไม่ถือว่าค้างพิจารณา
  if (isFinalApproved || isFinalRejected || isCancelled) {
    return { isOverdue: false, isClosed: true, elapsedDays: 0, elapsedHours: 0, label: "" };
  }

  const createdTime = new Date(req.created_at).getTime();
  const now = Date.now();
  if (isNaN(createdTime)) {
    return { isOverdue: false, elapsedDays: 0, elapsedHours: 0, label: "" };
  }

  const diffMs = now - createdTime;
  const elapsedHours = Math.max(0, diffMs / (1000 * 60 * 60));
  const elapsedDays = Math.floor(elapsedHours / 24);

  // เงื่อนไข: เกิน 2 วัน (>= 48 ชั่วโมง)
  const isOverdue = elapsedHours >= 48;

  return {
    isOverdue,
    elapsedHours: Math.round(elapsedHours * 10) / 10,
    elapsedDays,
    label: isOverdue 
      ? `เกินกำหนด (${elapsedDays} วัน)` 
      : `เหลือเวลาพิจารณา ${Math.max(0, Math.ceil(48 - elapsedHours))} ชม.`
  };
}
window.getLeaveApprovalSLA = getLeaveApprovalSLA;

/**
 * 🚚 สถานะการอนุมัติแบบ "จุดเชื่อมต่อ" (เหมือนติดตามพัสดุ)
 *   ยื่นใบลา → ลำดับที่ 1 → ลำดับที่ 2 → … · จุดเขียว = อนุมัติแล้ว · จุดส้มกะพริบ = กำลังรอ · จุดเทา = ยังไม่ถึง · จุดแดง = ไม่อนุมัติ
 */
function renderApprovalTimelineHTML(req, workflowSteps) {
  const norm = (v) => {
    const st = String(v || 'pending').toLowerCase();
    if (st === 'approved' || st === 'อนุมัติแล้ว') return 'done';
    if (st === 'rejected' || st === 'ไม่อนุมัติ') return 'rejected';
    if (st === 'cancelled' || st === 'ยกเลิก') return 'cancelled';
    if (st === 'skipped') return 'skipped';
    return 'pending';
  };
  const leaveSt = String(req.status || '').toLowerCase();
  const fmt = (iso) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  };
  let currentFound = false;
  const nodes = [{ cls: 'done', icon: 'edit_document', label: 'ยื่นใบลา', sub: fmt(req.created_at) }];
  (workflowSteps || []).forEach((step, idx) => {
    let k = norm(step.status);
    if (k === 'pending') {
      if (leaveSt === 'approved') k = 'done';   // ใบลาอนุมัติครบแล้ว แต่คอลัมน์สถานะขั้นเก่าไม่ได้อัปเดต
      else if (leaveSt === 'rejected' || leaveSt === 'cancelled') k = 'idle';
      else if (!currentFound) { k = 'current'; currentFound = true; }
      else k = 'idle';
    }
    const meta = {
      done:      { icon: 'check',          sub: 'อนุมัติแล้ว' },
      rejected:  { icon: 'close',          sub: 'ไม่อนุมัติ' },
      cancelled: { icon: 'block',          sub: 'ยกเลิก' },
      skipped:   { icon: 'redo',           sub: 'ข้ามขั้นตอน' },
      current:   { icon: 'hourglass_top',  sub: 'รอพิจารณา' },
      idle:      { icon: 'more_horiz',     sub: leaveSt === 'rejected' || leaveSt === 'cancelled' ? '—' : 'ยังไม่ถึง' }
    }[k];
    const name = String(step.shortName || `ผู้อนุมัติ ลำดับที่ ${idx + 1}`);
    const pre = name.startsWith('ผู้อนุมัติ ') ? 'ผู้อนุมัติ ' : '';
    nodes.push({ cls: k, icon: meta.icon, pre, label: name.slice(pre.length), tail: ` (L${idx + 1})`, sub: meta.sub });
  });
  if (leaveSt === 'approved') {
    nodes.push({ cls: 'done final', icon: 'verified', label: 'อนุมัติครบ', sub: fmt(req.approved_at) || 'เสร็จสิ้น' });
  } else if (leaveSt === 'rejected') {
    if (!nodes.some((n) => n.cls === 'rejected')) nodes.push({ cls: 'rejected', icon: 'close', label: 'ไม่อนุมัติ', sub: fmt(req.approved_at || req.updated_at) });
  } else if (leaveSt === 'cancelled') {
    nodes.push({ cls: 'cancelled', icon: 'block', label: 'ยกเลิกใบลา', sub: fmt(req.updated_at) });
  }
  return `
    <ol class="ap-track" style="--ap-n:${nodes.length}">
      ${nodes.map((n, i) => `
        <li class="ap-track-node is-${n.cls.split(' ').join(' is-')}${i > 0 && nodes[i - 1].cls.startsWith('done') ? ' is-linked' : ''}">
          <span class="ap-track-dot"><span class="material-symbols-outlined">${n.icon}</span></span>
          <span class="ap-track-lbl">${n.pre ? `<span class="ap-track-pre">${escapeHtml(n.pre)}</span>` : ''}${escapeHtml(n.label)}${n.tail ? `<span class="ap-track-pre">${escapeHtml(n.tail)}</span>` : ''}</span>
          ${n.sub ? `<span class="ap-track-sub">${escapeHtml(n.sub)}</span>` : ''}
        </li>`).join('')}
    </ol>`;
}

function getStatusBadgeHTML(status) {
  const st = (status || 'pending').toLowerCase();
  if (st === 'approved' || st === 'อนุมัติแล้ว') {
    return `<span class="status-badge status-approved"><span class="material-symbols-outlined">check_circle</span> อนุมัติแล้ว</span>`;
  }
  if (st === 'rejected' || st === 'ไม่อนุมัติ') {
    return `<span class="status-badge status-rejected"><span class="material-symbols-outlined">cancel</span> ไม่อนุมัติ</span>`;
  }
  if (st === 'cancelled' || st === 'ยกเลิก') {
    return `<span class="status-badge status-cancelled"><span class="material-symbols-outlined">block</span> ยกเลิกแล้ว</span>`;
  }
  return `<span class="status-badge status-pending"><span class="material-symbols-outlined">schedule</span> รอพิจารณา</span>`;
}

/**
 * 🔀 คำนวณลำดับและรายการขั้นตอนการอนุมัติสำหรับใบลาแต่ละใบ
 * แผนกไหนไม่มี หัวหน้า (L1) หรือ ผู้จัดการ (L2) ให้ซ่อน/ตัดขั้นตอนนั้นออกไปเลย
 */
function getApprovalWorkflowSteps(req) {
  if (req.__steps && req.__steps.length && window.PVTApproval) {
    return window.PVTApproval.toDisplaySteps(req.__steps);
  }
  const reqEmp = req.employees || {};
  const reqDeptId = req.department_id || reqEmp.department_id;
  const deptInfo = (window.deptApproversMap && window.deptApproversMap[reqDeptId]) || 
                   (typeof deptApproversMap !== 'undefined' && deptApproversMap[reqDeptId]) || 
                   { hasLeader: false, hasManager: false };

  const deptName = String(req.departments?.department_name || reqEmp.departments?.department_name || '').toLowerCase();
  const applicantRole = String(reqEmp.role || '').toLowerCase();
  const applicantPos = String(reqEmp.positions?.position_name || '').toLowerCase();

  const isApplicantLeader = (applicantRole === 'leader' || applicantRole.includes('leader') || applicantRole.includes('supervisor') || applicantPos.includes('หัวหน้า')) && !applicantPos.includes('หัวหน้ากะ') && !applicantPos.includes('หัวหน้าส่วน');
  const isApplicantManager = applicantRole === 'manager' || applicantRole.includes('manager') || applicantPos.includes('ผู้จัดการ') || applicantPos.includes('ผจก');
  const isApplicantExecutive = applicantRole === 'director' || applicantRole === 'executive' || applicantRole === 'owner' || applicantPos.includes('ผู้บริหาร') || applicantPos.includes('ผู้อำนวยการ');
  const isHrDept = deptName.includes('บุคคล') || deptName.includes('hr') || deptName.includes('ทรัพยากรบุคคล') || applicantRole === 'hr' || applicantRole.includes('hr');

  // 1. ตรวจสอบขั้นตอน "หัวหน้า" (L1):
  // - แผนกบุคคล (HR) ไม่มีหัวหน้า มีแต่ผู้จัดการฝ่าย -> ซ่อน/ตัด L1 ออก 100%
  // - ซ่อน/ตัดออก ถ้าผู้ยื่นเป็นระดับหัวหน้า/ผู้จัดการ/ผู้บริหาร เองอยู่แล้ว
  // - หรือ แผนกนั้นไม่มีหัวหน้า (และไม่มีรายบุคคล l1_approver_id กำหนดไว้)
  let hasL1 = false;
  if (!isHrDept && !isApplicantLeader && !isApplicantManager && !isApplicantExecutive) {
    if (reqEmp.l1_approver_id) {
      hasL1 = true;
    } else {
      hasL1 = Boolean(deptInfo && deptInfo.hasLeader && deptInfo.supervisor_id);
    }
  }

  // 2. ตรวจสอบขั้นตอน "ผู้จัดการ" (L2):
  // - ซ่อน/ตัดออก ถ้าผู้ยื่นเป็นผู้จัดการ/ผู้บริหาร เองอยู่แล้ว
  // - แผนกบุคคล (HR) มีผู้จัดการฝ่าย (19122) เป็นผู้อนุมัติเสมอ
  let hasL2 = false;
  if (!isApplicantManager && !isApplicantExecutive) {
    if (isHrDept) {
      hasL2 = true;
    } else if (reqEmp.l2_approver_id) {
      hasL2 = true;
    } else {
      hasL2 = Boolean(deptInfo && (deptInfo.hasManager || deptInfo.manager_id));
    }
  }

  // 3. ตรวจสอบขั้นตอน "ผู้บริหาร" (L3):
  // - มีเฉพาะกรณี: มีการระบุ l3_approver_id เฉพาะบุคคล, หรือผู้ยื่นเป็นผู้จัดการฝ่าย (L2), หรือหัวหน้า (L1) ในแผนกที่ไม่มี L2
  // - พนักงานทั่วไป (รวมถึงพนักงานฝ่ายบุคคล) จะไม่ปรากฏขั้นตอน L3 ให้เกะกะสายตา
  let hasExecutive = false;
  if (typeof hasExecutiveColumn !== 'undefined' && hasExecutiveColumn) {
    if (reqEmp.l3_approver_id) {
      hasExecutive = true;
    } else if (isApplicantManager) {
      hasExecutive = true;
    } else if (isApplicantLeader && !hasL2) {
      hasExecutive = true;
    }
  }

  // สร้างลำดับขั้นตอนการอนุมัติเฉพาะขั้นตอนที่มีอยู่จริงในสายงาน
  const steps = [];

  if (hasL1) {
    steps.push({
      role: 'leader',
      shortName: 'ผู้อนุมัติ ลำดับที่ 1',
      fullName: 'หัวหน้างานชั้นต้น (ลำดับที่ 1: Leader / Supervisor)',
      status: req.manager_status || 'pending'
    });
  }

  if (hasL2) {
    steps.push({
      role: 'manager',
      shortName: 'ผู้อนุมัติ ลำดับที่ 2',
      fullName: 'ผู้จัดการฝ่าย (ลำดับที่ 2: Director / Manager)',
      status: req.director_status || 'pending'
    });
  }

  if (hasExecutive) {
    steps.push({
      role: 'executive',
      shortName: 'ผู้อนุมัติ ลำดับสูง',
      fullName: 'ผู้บริหารสูงสุด (ลำดับที่ 3: Executive / MD)',
      status: req.executive_status || 'pending'
    });
  }

  return steps;
}
window.getApprovalWorkflowSteps = getApprovalWorkflowSteps;

/* ==========================================================================
   📊 2. DATA FETCHING & TAB BADGES
   ========================================================================== */

async function loadPendingLeavesHR(isSilent = false) {
  const container = document.getElementById("leaveListContainer");
  if (!container) return;
  // 🔔 อัปเดตกระดิ่งงานรอดำเนินการ (hr-inbox.js) หลังอนุมัติ/ไม่อนุมัติ/ยกเลิก
  if (!isSilent) setTimeout(() => window.PVTHrInbox?.refresh?.(), 800);

  // รีเฟรชเบื้องหลัง (polling / realtime) ระหว่างที่ผู้ใช้ติ๊กเลือกหรือเปิดรายละเอียดอยู่ → ข้ามไปก่อน
  if (isSilent && typeof isUserBusyOnHrPage === 'function' && isUserBusyOnHrPage()) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    if (!isSilent) {
      container.innerHTML = `<div class="ap-empty is-error"><span class="material-symbols-outlined">cloud_off</span><strong>ระบบฐานข้อมูลไม่พร้อมใช้งาน</strong><small>กรุณารีเฟรชหน้านี้อีกครั้ง</small></div>`;
    }
    return;
  }

  try {
    // แสดงสถานะ Loading ระหว่างดึงข้อมูล
    if (!isSilent) {
      container.innerHTML = `
        <div style="padding: 100px 0; text-align: center; color: var(--text-soft);">
          <div class="pvt-loader" style="margin: 0 auto 20px;"></div>
          <p>กำลังดึงข้อมูลใบลา...</p>
        </div>`;
    }

    let queryResult = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( 
          id, full_name, employee_code, nickname, role, image_url, title, prefix,
          department_id, l1_approver_id, l2_approver_id, l3_approver_id,
          departments!department_id (id, department_name), 
          positions!position_id (position_name, level_type) 
        ),
        leave_types!leave_type_id (id, leave_name, leave_code) 
      `)
      .order("created_at", { ascending: false });

    if (queryResult.error) {
      console.warn("⚠️ Complex Join Query Failed in HR load, retrying fallback fetch:", queryResult.error);
      const simpleRes = await sb.from("leave_requests").select("*").order("created_at", { ascending: false });
      if (simpleRes.data && simpleRes.data.length > 0) {
        try {
          const [empsRes, typesRes, deptsRes] = await Promise.all([
            sb.from("employees").select("*, departments!department_id(id, department_name), positions!position_id(position_name, level_type)").then((r) => (r.error ? sb.from("employees").select("*") : r)),
            sb.from("leave_types").select("id, leave_name, leave_code"),
            sb.from("departments").select("id, department_name")
          ]);
          const deptIdMap = {};
          (deptsRes.data || []).forEach(d => { deptIdMap[d.id] = d.department_name; });
          const empMap = {};
          (empsRes.data || []).forEach(e => {
            if (e.department_id && !e.departments && deptIdMap[e.department_id]) {
              e.departments = { id: e.department_id, department_name: deptIdMap[e.department_id] };
            }
            empMap[e.id] = e;
          });
          const typeMap = {};
          (typesRes.data || []).forEach(t => { typeMap[t.id] = t; });

          queryResult = {
            data: simpleRes.data.map(r => {
              const emp = r.employees || empMap[r.employee_id] || null;
              if (emp && !emp.departments && emp.department_id && deptIdMap[emp.department_id]) {
                emp.departments = { id: emp.department_id, department_name: deptIdMap[emp.department_id] };
              }
              return {
                ...r,
                employees: emp,
                leave_types: r.leave_types || typeMap[r.leave_type_id] || null,
                department_name: r.department_name || emp?.departments?.department_name || (r.department_id ? deptIdMap[r.department_id] : '')
              };
            }),
            error: null
          };
        } catch(joinFallbackErr) {
          console.warn("Enrichment fallback failed:", joinFallbackErr);
          queryResult = simpleRes;
        }
      } else {
        queryResult = simpleRes;
      }
    }

    let rawData = queryResult.data || [];

    if ((queryResult.error || !rawData.length)) {
      try {
        const cached = localStorage.getItem("pvt_cached_hr_requests");
        if (cached) {
          rawData = JSON.parse(cached);
          console.log("📦 Loaded HR leave requests from local cache fallback.");
        }
      } catch(e) {}
    } else if (rawData.length) {
      try { localStorage.setItem("pvt_cached_hr_requests", JSON.stringify(rawData)); } catch(e) {}
    }
    console.log("[HR Load] Fetch success. Total records from DB:", rawData.length);

    // ⏱️ ตรวจสอบและตัดใบลาที่ค้างเกิน 2 วัน (48 ชม.) เป็น "ไม่อนุมัติ" อัตโนมัติ
    if (typeof window.autoRejectOverdueLeaves === 'function') {
      window.autoRejectOverdueLeaves();
    }

    const nowMs = Date.now();
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
    rawData = rawData.map(req => {
      const st = String(req.status || '').toLowerCase();
      const isPending = (st === 'pending' || st === 'pending_l1' || st === 'pending_l2' || st.includes('รออนุมัติ'));
      if (isPending && req.created_at) {
        const createdTime = new Date(req.created_at).getTime();
        if (!isNaN(createdTime) && (nowMs - createdTime >= TWO_DAYS_MS)) {
          return {
            ...req,
            status: 'rejected',
            approval_comment: req.approval_comment || 'ไม่อนุมัติอัตโนมัติ: ไม่มีการพิจารณาภายในเวลาที่กำหนด (48 ชั่วโมง)',
            rejected_at: req.rejected_at || new Date().toISOString()
          };
        }
      }
      return req;
    });

    // 🛡️ [Legacy Stuck Data Auto-Healing]: ตรวจหาใบลาเก่าที่เคยรอ HR อนุมัติ (หรือผ่านขั้นตอนทั้งหมดแล้วแต่ค้างอยู่) และปรับเป็นอนุมัติอัตโนมัติ
    rawData = rawData.map(req => {
      const st = String(req.status || '').toLowerCase();
      const isPending = (st === 'pending' || st === 'pending_l1' || st === 'pending_l2' || st === 'pending_hr' || st.includes('รออนุมัติ'));
      if (isPending) {
        // ดึงขั้นตอนการอนุมัติที่ควรจะมีจริงในระบบ ณ ปัจจุบัน
        const steps = getApprovalWorkflowSteps(req);
        if (steps.length > 0) {
          const allApproved = steps.every(step => {
            const stepSt = String(step.status || '').toLowerCase();
            return stepSt === 'approved' || stepSt === 'อนุมัติแล้ว';
          });

          // ⚠️ หากสถานะผู้บริหาร (L3) ยังรอพิจารณา ต้องห้าม auto-approve เด็ดขาด
          const reqExecSt = String(req.executive_status || '').toLowerCase();
          const isWaitingExecutive = (reqExecSt === 'pending' || reqExecSt === 'wait' || reqExecSt.includes('รอ'));
          
          // ปิดการ "ปรับเป็นอนุมัติเอง" (เดิมไม่มีผู้อนุมัติ/ไม่ตัดวันลา) → ให้ HR กดอนุมัติจริงเพื่อมีหลักฐาน
          if (false && allApproved && !isWaitingExecutive) {
            console.log(`💡 [Auto-Healing] ใบลา #${req.id} ผ่านการอนุมัติครบทุกระดับชั้นแล้ว (ลำดับที่ 1–3) → ปรับสถานะเป็นอนุมัติเสร็จสิ้นโดยอัตโนมัติ`);
            // ยิงอัปเดตลงดาต้าเบสในเบื้องหลังแบบ non-blocking
            const sb = window.PVTSDK?.supabase;
            if (sb) {
              sb.from('leave_requests')
                .update({ status: 'approved', approved_at: new Date().toISOString() })
                .eq('id', req.id)
                .then(({ error }) => {
                  if (error) console.error(`💥 [Auto-Healing Fail]`, error);
                  else console.log(`✔️ [Auto-Healing DB Update Success] #${req.id}`);
                });
            }
            return {
              ...req,
              status: 'approved',
              approved_at: req.approved_at || new Date().toISOString()
            };
          }
        }
      }
      return req;
    });

    // 🔗 ขั้นอนุมัติของแต่ละใบ (ระยะ 2) — โหลดเฉพาะใบที่ยังรอ หรือยื่นภายใน 90 วัน
    if (window.PVTApproval) {
      try {
        const since = Date.now() - 90 * 864e5;
        const ids = rawData.filter((r) => isPendingStatus(r.status) || r.current_step != null || new Date(r.created_at).getTime() > since).map((r) => r.id);
        const stepMap = await window.PVTApproval.getStepsForLeaves(ids);
        rawData.forEach((r) => { if (stepMap[r.id]) r.__steps = stepMap[r.id]; });
      } catch (stepErr) {
        console.warn('⚠️ [Approval Chain] โหลดขั้นอนุมัติไม่สำเร็จ:', stepErr);
      }
    }

    // ระบุตัวตนของผู้ใช้งานปัจจุบันให้ชัดเจน (ต้องเป็น Employee UUID)
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const myEmp = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    const currentEmpId = myEmp?.id;
    const currentEmpCode = String(myEmp?.employee_code || sessionUser?.employee_code || '').trim();
    let myDeptId = myEmp?.department_id || sessionUser?.department_id;
    let myDeptName = myEmp?.departments?.department_name || myEmp?.department_name || sessionUser?.department_name;
    if (currentEmpCode === '19122') {
      if (!myDeptId) myDeptId = 'a318f70f-8e24-4e36-958a-7726d6c9da4d';
      if (!myDeptName) myDeptName = 'บุคคล-ธุรการ';
    }

    const userRole = (currentRole || '').toLowerCase();
    const isHrOrAdmin = (userRole === "hr" || userRole === "admin") && currentEmpCode !== '19122';

    // ถ้าไม่ใช่ HR/Admin (หรือเป็นรหัส 19122) ให้กรองเห็นเฉพาะลูกน้อง (Subordinates) ตามโครงสร้างองค์กร
    if (!isHrOrAdmin || currentEmpCode === '19122') {
      console.log("[HR Load] Applying hierarchical filters for:", userRole, "EmpCode:", currentEmpCode);
      rawData = rawData.filter((req) => {
        const reqEmp = req.employees;
        if (!reqEmp) return false;

        const reqEmpId = String(reqEmp.id || req.employee_id || '');
        const currentEmpIdStr = currentEmpId ? String(currentEmpId) : '';
        const reqEmpRole = String(reqEmp.role || "").toLowerCase();
        const reqDeptId = reqEmp.department_id ? String(reqEmp.department_id) : '';
        const myDeptIdStr = myDeptId ? String(myDeptId) : '';
        // Resolve Department Names with robust fallback mapping
        let reqDeptName = String(reqEmp.departments?.department_name || req.department_name || '').toLowerCase();
        if (!reqDeptName && reqDeptId && window.allDepartmentsMap) {
          reqDeptName = String(window.allDepartmentsMap[reqDeptId] || '').toLowerCase();
        }
        let myDeptNameStr = String(myDeptName || '').toLowerCase();
        if (!myDeptNameStr && myDeptId && window.allDepartmentsMap) {
          myDeptNameStr = String(window.allDepartmentsMap[myDeptId] || '').toLowerCase();
        }

        // 🚫 ซ่อนใบลาของตนเองในหน้าตรวจใบลา (Self-Leave Exclusion):
        // ผู้จัดการหรือหัวหน้างานไม่ต้องเห็นใบลาของตนเองในหน้าตรวจใบลา
        // เพราะใบลาของผู้จัดการ/หัวหน้าฝ่ายจะต้องส่งให้ผู้บริหาร (Executive L3) เป็นผู้อนุมัติ
        // หากต้องการดูข้อมูลบริษัทในภาพรวม ให้เข้าสู่ระบบผ่านแอคเคาต์แยก
        const isSelf = currentEmpIdStr && (reqEmpId === currentEmpIdStr || String(req.employee_id || '') === currentEmpIdStr);
        if (isSelf) {
          return false;
        }

        // 🔗 ใบลาที่มีขั้นอนุมัติ: เห็นเมื่อเราเป็นผู้อนุมัติขั้นใดขั้นหนึ่งของใบนั้น
        if (req.__steps && req.__steps.length) {
          return req.__steps.some((st) => (st.approver_ids || []).map(String).includes(currentEmpIdStr));
        }

        // 🎯 ตรวจสอบความสอดคล้องของแผนก (Same Department Check)
        const isSameDept = Boolean(
          (myDeptIdStr && reqDeptId && myDeptIdStr === reqDeptId) ||
          (myDeptNameStr && reqDeptName && (
            myDeptNameStr === reqDeptName ||
            myDeptNameStr.includes(reqDeptName) ||
            reqDeptName.includes(myDeptNameStr)
          ))
        );

        const isHrDept = (
          reqDeptName.includes('บุคคล') || 
          reqDeptName.includes('ธุรการ') || 
          reqDeptName.includes('hr') || 
          reqDeptName.includes('human') || 
          reqDeptName.includes('personnel') || 
          reqDeptName.includes('admin') ||
          myDeptNameStr.includes('บุคคล') || 
          myDeptNameStr.includes('ธุรการ') || 
          myDeptNameStr.includes('hr')
        );

        // 🌟 พิเศษสำหรับ น.ส. ปณัยยา บุญเกิด (รหัส: 19122) ผู้จัดการฝ่าย - บุคคล-ธุรการ
        // มีแอคเคาต์แยกสำหรับ HR กลางในการดูข้อมูลรวม ดั้งนั้นแอคเคาต์นี้ให้เห็นเฉพาะใบลาของคนในแผนกตนเองเท่านั้น
        if (currentEmpCode === '19122') {
          const isHigherExec = ['director', 'executive', 'owner'].includes(reqEmpRole);
          const isMyHrDept = (
            reqDeptId === 'a318f70f-8e24-4e36-958a-7726d6c9da4d' ||
            isSameDept ||
            reqDeptName.includes('บุคคล') ||
            reqDeptName.includes('ธุรการ') ||
            reqDeptName.includes('hr')
          );
          return isMyHrDept && !isHigherExec;
        }

        // 🎯 ตรวจสอบว่าผู้ใช้งานปัจจุบันถูกระบุเป็นผู้อนุมัติโดยตรง (L1 / L2 / L3) หรือไม่
        const isDirectL1 = currentEmpIdStr && String(reqEmp.l1_approver_id || '') === currentEmpIdStr;
        const isDirectL2 = currentEmpIdStr && String(reqEmp.l2_approver_id || '') === currentEmpIdStr;
        const isDirectL3 = currentEmpIdStr && (
          String(reqEmp.l3_approver_id || '') === currentEmpIdStr ||
          String(window.executiveSetting?.employee_id || '') === currentEmpIdStr
        );
        if (isDirectL1 || isDirectL2 || isDirectL3) return true;

        // 🎯 ตรวจสอบการเป็นผู้จัดการ/หัวหน้าตามการตั้งค่าแผนก (deptApproversMap)
        const deptCfg = (window.deptApproversMap && reqDeptId) ? window.deptApproversMap[reqDeptId] : null;
        if (deptCfg) {
          if (currentEmpIdStr && (String(deptCfg.manager_id || '') === currentEmpIdStr || String(deptCfg.supervisor_id || '') === currentEmpIdStr)) {
            return true;
          }
        }

        let isSubordinate = false;
        const isHigherRole = ['director', 'executive', 'owner', 'superadmin'].includes(reqEmpRole);

        if (userRole === "leader") {
          // Leader เห็นพนักงานในแผนกเดียวกัน
          const isNotLeaderOrHigher = !['leader', 'manager', 'director', 'executive', 'owner'].includes(reqEmpRole);
          isSubordinate = isSameDept && isNotLeaderOrHigher;
        } 
        else if (userRole === "manager") {
          // Manager เห็นพนักงานและหัวหน้างานในแผนกตัวเอง
          isSubordinate = isSameDept && !isHigherRole;
        } 
        else if (userRole === "director" || userRole === "executive" || userRole === "owner" || isDirectL3) {
          // ระดับบริหาร เห็นทุกแผนกทั่วองค์กร
          isSubordinate = true; 
        } else {
          // กรณี role อื่นๆ ให้ดูคนในแผนกเดียวกันได้ถ้าได้รับสิทธิ์
          isSubordinate = isSameDept;
        }

        return isSubordinate;
      });
      console.log("[HR Load] Post-filter records:", rawData.length);
    }

    allLeaveRequests = rawData;
    hasExecutiveColumn = true;
    
    updateTabAndStatBadges();
    renderLeaveTable();

    // ⏱️ อัปเดตและแสดงผล SLA Countdown Tracker สำหรับรายการรอพิจารณาของผู้ใช้ปัจจุบัน
    if (typeof window.renderLeaveSlaTracker === 'function') {
      const pendingForRoleRequests = allLeaveRequests.filter(r => isPendingForRole(r, currentRole));
      window.renderLeaveSlaTracker("leaveSlaTrackerContainer", pendingForRoleRequests);
    }

    // 💡 จัดการการแสดงผลตาราง: ยุบตารางล่างเมื่ออยู่ในแท็บ 'รออนุมัติ' (SLA Tracker ทำหน้าที่แทน)
    const leaveTablePanel = document.getElementById("leaveTablePanel");
    const slaContainer = document.getElementById("leaveSlaTrackerContainer");
    if (currentLeaveTab === 'pending') {
      if (slaContainer) slaContainer.style.display = "block";
      if (leaveTablePanel) leaveTablePanel.style.display = "none";
    } else if (currentLeaveTab === 'rejections') {
      // แท็บนี้จัดการแสดงผลเอง (rejection-audit.js)
      if (slaContainer) slaContainer.style.display = "none";
      if (leaveTablePanel) leaveTablePanel.style.display = "none";
    } else {
      if (slaContainer) slaContainer.style.display = "none";
      if (leaveTablePanel) leaveTablePanel.style.display = "block";
    }

  } catch (err) {
    console.error("💥 Critical Failure in loadPendingLeavesHR:", err);
    if (container) {
      container.innerHTML = `
        <div class="ap-empty is-error">
          <span class="material-symbols-outlined">error</span>
          <strong>ไม่สามารถโหลดข้อมูลได้</strong>
          <small>${escapeHtml(err?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ')}</small>
          <button type="button" onclick="loadPendingLeavesHR()" class="ap-btn ap-btn--primary">
            <span class="material-symbols-outlined">refresh</span> ลองใหม่อีกครั้ง
          </button>
        </div>`;
      // แท็บ "รออนุมัติ" ซ่อนกล่องรายการไว้ → ต้องเปิดให้เห็นข้อความผิดพลาด
      const panel = document.getElementById("leaveTablePanel");
      if (panel) panel.style.display = "block";
    }
  }
}

function updateTabAndStatBadges() {
  const pendingRequests = allLeaveRequests.filter(r => isPendingForRole(r, currentRole));
  const cancelRequests = canReviewCancellationRequests()
    ? allLeaveRequests.filter(r => isCancelRequestStatus(r.status))
    : [];
  const approvedRequests = allLeaveRequests.filter(r => String(r.status).toLowerCase() === 'approved');
  const historyRequests = allLeaveRequests.filter(r => isHistoryForRole(r, currentRole));

  const pBadge = document.getElementById("pendingCountBadge");
  const cBadge = document.getElementById("cancelCountBadge");
  const hBadge = document.getElementById("historyCountBadge");

  if (pBadge) pBadge.textContent = pendingRequests.length;
  if (cBadge) cBadge.textContent = cancelRequests.length;
  if (hBadge) hBadge.textContent = historyRequests.length;

  document.getElementById("statPendingCount") && (document.getElementById("statPendingCount").innerHTML = `${pendingRequests.length} <small>รายการ</small>`);
  document.getElementById("statCancelCount") && (document.getElementById("statCancelCount").innerHTML = `${cancelRequests.length} <small>รายการ</small>`);
  document.getElementById("statApprovedCount") && (document.getElementById("statApprovedCount").innerHTML = `${approvedRequests.length} <small>รายการ</small>`);
  document.getElementById("statTotalCount") && (document.getElementById("statTotalCount").innerHTML = `${allLeaveRequests.length} <small>รายการ</small>`);
  const rejectedCount = allLeaveRequests.filter(r => String(r.status).toLowerCase() === 'rejected').length;
  document.getElementById("statRejectedCount") && (document.getElementById("statRejectedCount").innerHTML = `${rejectedCount} <small>รายการ</small>`);
}

function canViewRejectionAudit() {
  const sessionUser = (() => { try { return JSON.parse(localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser") || "{}"); } catch (e) { return {}; } })();
  const empCode = String(currentUserProfile?.employee_code || currentUserProfile?.employees?.employee_code || sessionUser?.employee_code || '').trim();
  // ผู้บริหาร (currentRole = director) ไม่เห็นแท็บนี้ — ตามที่ฝ่ายบุคคลกำหนด
  return ['hr', 'admin'].includes(String(currentRole || '').toLowerCase()) && empCode !== '19122';
}

window.switchLeaveTab = function(tabName, btnEl) {
  if (tabName === 'rejections' && !canViewRejectionAudit()) return;
  // "อนุมัติแล้ว" = ประวัติ + กรองเฉพาะที่อนุมัติครบ / "ประวัติทั้งหมด" = ล้างตัวกรองสถานะ
  const stepSelect = document.getElementById("filterStepSelect");
  if (tabName === 'approved') {
    tabName = 'history';
    if (stepSelect) stepSelect.value = 'fully_approved';
  } else if (tabName === 'history' && stepSelect && stepSelect.value === 'fully_approved') {
    stepSelect.value = 'all';
  } else if (tabName === 'pending' || tabName === 'cancellation') {
    if (stepSelect) stepSelect.value = 'all';
  }
  if (tabName !== 'rejections') window.PVTRejectionAudit?.close();
  if (tabName === 'cancellation' && !canReviewCancellationRequests()) {
    Swal.fire({
      icon: 'info',
      title: 'คำขอยกเลิกส่งให้ HR/Admin',
      text: 'ขั้นตอนการยกเลิกหลังผ่านการอนุมัติจะถูกตรวจสอบโดย HR/Admin เท่านั้น',
      confirmButtonColor: 'var(--th-p-700, #0f766e)'
    });
    return;
  }

  currentLeaveTab = tabName;
  
  document.querySelectorAll('.leave-tab-container .tab-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const headerTitle = document.getElementById("sectionHeaderTitle");
  const headerIcon = document.getElementById("sectionHeaderIcon");
  const slaContainer = document.getElementById("leaveSlaTrackerContainer");
  const leaveTablePanel = document.getElementById("leaveTablePanel");

  if (tabName === 'pending') {
    if (headerTitle) headerTitle.textContent = "คำขออนุมัติลาค้างพิจารณา";
    if (headerIcon) headerIcon.textContent = "hourglass_top";
    if (slaContainer) slaContainer.style.display = "block";
    // 💡 ยุบตารางล่างเมื่ออยู่ในแท็บ 'รออนุมัติ' (SLA Tracker ทำหน้าที่แทน)
    if (leaveTablePanel) leaveTablePanel.style.display = "none";
  } else if (tabName === 'rejections') {
    if (slaContainer) slaContainer.style.display = "none";
    if (leaveTablePanel) leaveTablePanel.style.display = "none";
    window.PVTRejectionAudit?.open();
  } else if (tabName === 'cancellation') {
    if (headerTitle) headerTitle.textContent = "คำร้องขอยกเลิกใบลาหยุดงาน";
    if (headerIcon) headerIcon.textContent = "published_with_changes";
    if (slaContainer) slaContainer.style.display = "none";
    if (leaveTablePanel) leaveTablePanel.style.display = "block";
    renderLeaveTable();
  } else {
    const onlyApproved = stepSelect && stepSelect.value === 'fully_approved';
    if (headerTitle) headerTitle.textContent = onlyApproved ? "ใบลาที่อนุมัติแล้ว" : "ประวัติการพิจารณาใบลาทั้งหมด";
    if (headerIcon) headerIcon.textContent = onlyApproved ? "task_alt" : "history";
    if (slaContainer) slaContainer.style.display = "none";
    if (leaveTablePanel) leaveTablePanel.style.display = "block";
    renderLeaveTable();
  }
};

/* ==========================================================================
   🔒 SEQUENTIAL APPROVAL GUARD (UPDATED FOR FLEXIBLE WORKFLOW)
   ========================================================================== */

/**
 * ปุ่มอนุมัติ/ไม่อนุมัติ แสดงแบบไหนสำหรับผู้ใช้คนนี้
 *  'normal'   = เป็นผู้อนุมัติของขั้นปัจจุบันจริง (หรือขั้นที่ส่งถึง HR) → แสดงปุ่มปกติ
 *  'override' = HR/Admin ที่ไม่ใช่ผู้อนุมัติขั้นนี้ → ไม่แสดงปุ่ม (ข้ามสายอนุมัติขององค์กร)
 *               ใช้ได้เฉพาะ "กรณีพิเศษ" ในหน้ารายละเอียด ต้องยืนยันก่อน
 *  'none'     = ไม่มีสิทธิ์ / ไม่ได้รออนุมัติ
 */
function getApproveMode(reqOrId) {
  try {
    const req = (reqOrId && typeof reqOrId === 'object')
      ? (allLeaveRequests.find(r => String(r.id) === String(reqOrId.id)) || reqOrId)
      : allLeaveRequests.find(r => String(r.id) === String(reqOrId));
    const role = String(currentRole || '').toLowerCase();
    const isHrAdmin = role === 'hr' || role === 'admin';
    if (!req) return isHrAdmin ? 'override' : 'normal';
    if (!isPendingStatus(req.status)) return 'none';
    if (window.isViewOnlyHR) return 'none';
    if (req.__steps && req.__steps.length && window.PVTApproval) {
      const check = window.PVTApproval.canAct(window.PVTApproval.currentStep(req.__steps), window.PVTApproval.me(), role);
      if (!check.ok) return 'none';
      return check.override ? 'override' : 'normal';
    }
    // ใบลาแบบเดิม (ไม่มีขั้นอนุมัติ): HR/Admin = กรณีพิเศษเท่านั้น
    if (isHrAdmin) return 'override';
    return canApproveStep(req, currentRole, true) ? 'normal' : 'none';
  } catch (e) {
    return 'none';
  }
}
window.pvtApproveMode = getApproveMode;

// กรณีพิเศษ: HR/Admin อนุมัติ/ไม่อนุมัติแทนสายอนุมัติ (ต้องยืนยันก่อนทุกครั้ง)
async function specialCaseLeaveAction(leaveId, action) {
  const req = allLeaveRequests.find(r => String(r.id) === String(leaveId));
  if (!req || getApproveMode(req) !== 'override') return;
  const name = escapeHtml(req.employees?.full_name || 'พนักงาน');
  const res = await Swal.fire({
    icon: 'warning',
    title: action === 'approve' ? 'อนุมัติกรณีพิเศษ?' : 'ไม่อนุมัติกรณีพิเศษ?',
    html: `<div style="text-align:left; font-size:15px; line-height:1.7;">
      ใบลาของ <b>${name}</b> ยังอยู่ระหว่างสายอนุมัติขององค์กร<br>
      การดำเนินการนี้จะ<b>ข้ามขั้นตอนผู้อนุมัติ</b> และบันทึกว่า HR/Admin เป็นผู้ตัดสิน<br>
      <span style="color:#b45309;">ใช้เฉพาะกรณีจำเป็น เช่น ผู้อนุมัติไม่อยู่และใกล้ครบกำหนด</span></div>`,
    showCancelButton: true,
    confirmButtonText: 'ยืนยัน ดำเนินการกรณีพิเศษ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: action === 'approve' ? '#10b981' : '#ef4444',
    focusCancel: true
  });
  if (!res.isConfirmed) return;
  if (action === 'approve') await approveLeave(req.id); else await rejectLeave(req.id);
}
window.specialCaseLeaveAction = specialCaseLeaveAction;

function canApproveStep(req, role, silent = false) {
  const warn = (...args) => { if (!silent) Swal.fire(...args); };
  // ดึงข้อมูลผู้ใช้งานปัจจุบันที่กำลังกดปุ่ม
  const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const sessionUser = savedSession ? JSON.parse(savedSession) : {};
  const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
  const currentEmpId = empData?.id || empData?.employee_id || currentUserProfile?.employee_id;
  const rawRole = String(empData?.role || sessionUser?.role || role || '').toLowerCase();

  const isAdminOrSuper = rawRole === 'admin' || rawRole === 'superadmin' || role === 'admin';

  // 🛑 1. ป้องกันการกดอนุมัติใบลาของตัวเอง (Self-Approval Guard) - ยกเว้น Admin สำหรับทดสอบ
  if (!isAdminOrSuper && currentEmpId && String(req.employee_id) === String(currentEmpId)) {
    warn({
      title: 'ไม่สามารถทำรายการได้',
      text: 'คุณไม่สามารถกดอนุมัติใบลาของตนเองได้ กรุณาให้ผู้จัดการฝ่าย หรือ ผู้บริหาร/HR เป็นผู้อนุมัติ',
      icon: 'warning',
      confirmButtonColor: 'var(--th-s-500, #06b6d4)'
    });
    return false;
  }

  // 🔗 ใบลาที่มีขั้นอนุมัติ (ระยะ 2)
  if (req.__steps && req.__steps.length && window.PVTApproval) {
    if (!isPendingStatus(req.status)) { warn('ดำเนินการแล้ว', 'ใบลานี้ไม่ได้อยู่ในสถานะรอพิจารณาแล้ว', 'info'); return false; }
    const actor = window.PVTApproval.me();
    const check = window.PVTApproval.canAct(window.PVTApproval.currentStep(req.__steps), actor, role);
    if (!check.ok) { warn('ยังไม่ถึงขั้นของท่าน', check.reason, 'info'); return false; }
    return true;
  }

  // ดึงสถานะปัจจุบันของแต่ละขั้น
  const isL1Approved = req.manager_status === 'approved';
  const isL2Approved = req.director_status === 'approved';
  const isL3Approved = req.executive_status === 'approved';
  const isFinalApproved = req.status === 'approved';

  if (isFinalApproved) {
    warn('ดำเนินการแล้ว', 'คำขอนี้ได้รับการอนุมัติเรียบร้อยแล้ว', 'info');
    return false;
  }

  if (!isPendingStatus(req.status)) {
    warn('ดำเนินการแล้ว', 'ใบลานี้ไม่ได้อยู่ในสถานะรอพิจารณาแล้ว', 'info');
    return false;
  }

  // 🟡 2. Admin / Superadmin / Executive L3 สามารถอนุมัติได้เสมอ
  const isExecutiveUser = (
    role === 'director' || role === 'executive' || role === 'owner' || role === 'admin' || isAdminOrSuper ||
    (currentEmpId && (
      String(currentEmpId) === String(window.executiveSetting?.employee_id || '') ||
      String(currentEmpId) === String(window.executiveApproverId || '')
    ))
  );

  if (isExecutiveUser) {
    if (isL3Approved && isFinalApproved) {
      warn('ดำเนินการแล้ว', 'คำขอนี้ได้รับการอนุมัติเรียบร้อยแล้ว', 'info');
      return false;
    }
    return true;
  }

  // 🔢 ตรวจลำดับขั้นตามสายอนุมัติที่ HR กำหนด
  const me = currentEmpId ? String(currentEmpId) : getMyEmpId();
  const chain = resolveRequestChain(req);
  if (role === 'leader' && chain.l1 && chain.l1 !== me && chain.l2 !== me) {
    warn('ไม่ใช่ผู้อนุมัติของใบลานี้', 'ใบลานี้กำหนดให้หัวหน้างานท่านอื่นเป็นผู้พิจารณา', 'info');
    return false;
  }
  if (role === 'manager' && !isL1Approved && chain.l1 && chain.l1 !== me) {
    warn('รอหัวหน้างานพิจารณาก่อน', 'ใบลานี้ยังรอผู้อนุมัติ ลำดับที่ 1 พิจารณา เมื่อหัวหน้างานอนุมัติแล้วระบบจะแจ้งให้ท่านพิจารณาต่อ', 'info');
    return false;
  }
  if (role === 'manager' && isL2Approved) {
    warn('ดำเนินการแล้ว', 'ท่านพิจารณาใบลานี้แล้ว อยู่ระหว่างรอขั้นถัดไป', 'info');
    return false;
  }

  // 🔵 3. กรณีหัวหน้างาน (L1 Leader) กำลังพิจารณา
  if (role === 'leader') {
    if (isL1Approved) {
      warn('ดำเนินการแล้ว', 'คำขอนี้ผู้อนุมัติ ลำดับที่ 1 ได้พิจารณาอนุมัติเรียบร้อยแล้ว อยู่ในขั้นตอนของผู้จัดการฝ่าย/ผู้บริหาร', 'info');
      return false;
    }
  }

  // 🔵 4. กรณีผู้จัดการ (L2 Manager) กำลังพิจารณา
  if (role === 'manager') {
    if (isL2Approved && isL3Approved) {
      warn('ดำเนินการแล้ว', 'คำขอนี้ได้รับการอนุมัติเรียบร้อยแล้ว', 'info');
      return false;
    }
  }

  return true;
}

/* ==========================================================================
   🖼️ 4. RENDER TABLE DATA
   ========================================================================== */

function renderLeaveTable() {
  const container = document.getElementById("leaveListContainer");
  const stepFilter = document.getElementById("filterStepSelect")?.value || "all";
  if (!container) return;

  const selectFilter = document.getElementById("filterStepSelect");
  if (selectFilter) {
    if (hasExecutiveColumn && !selectFilter.dataset.hasExecutive) {
      selectFilter.dataset.hasExecutive = "true";
      selectFilter.innerHTML = `
        <option value="all">-- แสดงทั้งหมด --</option>
        <option value="overdue">⚠️ ค้างพิจารณาเกิน 2 วัน (เกินกำหนด)</option>
        <option value="pending_manager">1. รอผู้อนุมัติ ลำดับที่ 1</option>
        <option value="pending_director">2. ลำดับที่ 1 ผ่านแล้ว / รอผู้อนุมัติ ลำดับที่ 2</option>
        <option value="pending_executive">3. ลำดับที่ 2 ผ่านแล้ว / รอผู้อนุมัติ ลำดับสูง</option>
        <option value="fully_approved">อนุมัติครบทุกระดับแล้ว</option>
        <option value="rejected">ถูกปฏิเสธ (Rejected)</option>
      `;
    } else if (!hasExecutiveColumn && selectFilter.dataset.hasExecutive) {
      delete selectFilter.dataset.hasExecutive;
      selectFilter.innerHTML = `
        <option value="all">-- แสดงทั้งหมด --</option>
        <option value="overdue">⚠️ ค้างพิจารณาเกิน 2 วัน (เกินกำหนด)</option>
        <option value="pending_manager">1. รอผู้อนุมัติ ลำดับที่ 1</option>
        <option value="pending_director">2. ลำดับที่ 1 ผ่านแล้ว / รอผู้อนุมัติ ลำดับที่ 2</option>
        <option value="fully_approved">อนุมัติครบทุกระดับแล้ว</option>
        <option value="rejected">ถูกปฏิเสธ (Rejected)</option>
      `;
    }
  }

  let filteredRequests = [];

  if (currentLeaveTab === "pending") {
    filteredRequests = allLeaveRequests.filter(r => isPendingForRole(r, currentRole));
  } else if (currentLeaveTab === "cancellation") {
    filteredRequests = canReviewCancellationRequests()
      ? allLeaveRequests.filter(r => isCancelRequestStatus(r.status))
      : [];
  } else {
    filteredRequests = allLeaveRequests.filter(r => isHistoryForRole(r, currentRole));
  }

  // 🔍 Real-time Search Filter
  const searchTerm = (document.getElementById("hrLeaveSearchInput")?.value || "").trim().toLowerCase();
  if (searchTerm) {
    filteredRequests = filteredRequests.filter(r => {
      const eName = (r.employees?.full_name || "").toLowerCase();
      const eCode = (r.employees?.employee_code || "").toLowerCase();
      const eDept = (r.employees?.departments?.department_name || "").toLowerCase();
      const ePos = (r.employees?.positions?.position_name || "").toLowerCase();
      const lType = (r.leave_types?.leave_name || "").toLowerCase();
      const reason = (r.reason || "").toLowerCase();
      return eName.includes(searchTerm) || eCode.includes(searchTerm) || 
             eDept.includes(searchTerm) || ePos.includes(searchTerm) || 
             lType.includes(searchTerm) || reason.includes(searchTerm);
    });
  }

  if (stepFilter !== "all") {
    filteredRequests = filteredRequests.filter(req => {
      const sla = getLeaveApprovalSLA(req);
      if (stepFilter === "overdue") {
        return sla.isOverdue;
      }

      const mStatus = req.manager_status || 'pending';
      const dStatus = req.director_status || 'pending';
      const execStatus = req.executive_status || 'pending';
      const hrStatus = req.status || 'pending';

      const isApplicantLeaderOrManager = isLeaderOrManagerRole(req.employees?.role, req.employees?.positions?.position_name);

      if (stepFilter === "pending_manager") return mStatus === 'pending';
      if (stepFilter === "pending_director") return mStatus === 'approved' && dStatus === 'pending';
      if (stepFilter === "pending_executive") {
        if (!isApplicantLeaderOrManager) return false;
        return mStatus === 'approved' && dStatus === 'approved' && execStatus === 'pending';
      }
      if (stepFilter === "pending_hr") {
        if (hasExecutiveColumn) {
          if (isApplicantLeaderOrManager) {
            return mStatus === 'approved' && dStatus === 'approved' && execStatus === 'approved' && hrStatus === 'pending';
          } else {
            return mStatus === 'approved' && dStatus === 'approved' && hrStatus === 'pending';
          }
        } else {
          return mStatus === 'approved' && dStatus === 'approved' && hrStatus === 'pending';
        }
      }
      if (stepFilter === "fully_approved") return hrStatus === 'approved';
      if (stepFilter === "rejected") {
        return mStatus === 'rejected' || dStatus === 'rejected' || execStatus === 'rejected' || hrStatus === 'rejected';
      }
      return true;
    });
  }

  if (filteredRequests.length === 0) {
    container.innerHTML = `<div class="ap-empty">
      <span class="material-symbols-outlined">inbox</span>
      <strong>ไม่พบรายการใบลาตามเงื่อนไขที่เลือก</strong>
      <small>ลองล้างคำค้นหา หรือเปลี่ยนตัวกรองสถานะ</small>
    </div>`;
    return;
  }

  let cardsContent = "";

  const highlightMatch = (text, term) => {
    if (!term || !text) return escapeHtml(text || "");
    const cleanText = String(text);
    const idx = cleanText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return escapeHtml(cleanText);
    const before = escapeHtml(cleanText.slice(0, idx));
    const matched = escapeHtml(cleanText.slice(idx, idx + term.length));
    const after = escapeHtml(cleanText.slice(idx + term.length));
    return `${before}<mark class="text-highlight">${matched}</mark>${after}`;
  };

  filteredRequests.forEach((req) => {
    const rawEmpName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
    const rawEmpCode = req.employees ? req.employees.employee_code : "-";
    let rawDeptName = req.employees?.departments?.department_name || req.department_name || "";
    if (!rawDeptName && req.employees?.department_id && window.allDepartmentsMap) {
      rawDeptName = window.allDepartmentsMap[req.employees.department_id] || "";
    }
    if (!rawDeptName) rawDeptName = "-";
    const rawPositionName = req.employees?.positions?.position_name || "-";
    const rawLeaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุ";

    const empName = highlightMatch(rawEmpName, searchTerm);
    const empCode = highlightMatch(rawEmpCode, searchTerm);
    const empDeptName = highlightMatch(rawDeptName, searchTerm);
    const empPositionName = highlightMatch(rawPositionName, searchTerm);
    const leaveType = highlightMatch(rawLeaveType, searchTerm);
    const reasonText = highlightMatch(req.reason || "-", searchTerm);

    const startDate = formatThaiDate(req.start_date);
    const endDate = formatThaiDate(req.end_date);
    const avatarUrl = getAvatarUrl(req.employees || null);
    const avTitle = req.employees?.title || req.employees?.prefix || '';
    const avName = req.employees?.full_name || '';
    const rawDays = req.actual_days || req.days_requested || req.total_days || 0;
    const leaveHours = req.leave_hours || 0;
    let durationText = `${rawDays} วัน`;
    if (leaveHours > 0) {
      const d = Math.floor(leaveHours / 8);
      const remH = leaveHours % 8;
      const wholeH = Math.floor(remH);
      const mins = Math.round((remH - wholeH) * 60);
      let parts = [];
      if (d > 0) parts.push(`${d} วัน`);
      if (wholeH > 0) parts.push(`${wholeH} ชม.`);
      if (mins > 0) parts.push(`${mins} นาที`);
      durationText = parts.length > 0 ? parts.join(" ") : `${leaveHours} ชม.`;
    } else if (rawDays % 1 !== 0) {
      const wholeDays = Math.floor(rawDays);
      const totalH = (rawDays - wholeDays) * 8;
      const wholeH = Math.floor(totalH);
      const mins = Math.round((totalH - wholeH) * 60);
      let parts = [];
      if (wholeDays > 0) parts.push(`${wholeDays} วัน`);
      if (wholeH > 0) parts.push(`${wholeH} ชม.`);
      if (mins > 0) parts.push(`${mins} นาที`);
      durationText = parts.length > 0 ? parts.join(" ") : `${rawDays} วัน`;
    }
    const attachmentUrl = getAttachmentUrl(req);

    // ⏱️ คำนวณ SLA การพิจารณาอนุมัติ 2 วัน
    const sla = getLeaveApprovalSLA(req);
    const isOverdue = sla.isOverdue;

    let actionButtons = "";

    const isHrOrAdmin = canReviewCancellationRequests();

    if (currentLeaveTab === "cancellation") {
      const canDecideCancellation = canDecideCancellationRequests();
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')" title="ดูรายละเอียด"><span class="material-symbols-outlined">visibility</span></button>
          <button class="btn-act btn-act-print" onclick="printLeaveA4('${req.id}')" title="พิมพ์ใบลา" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;"><span class="material-symbols-outlined">print</span></button>
          ${canDecideCancellation ? `
            <button class="btn-act btn-act-approve" onclick="approveCancellation('${req.id}')"><span class="material-symbols-outlined">check_circle</span> อนุมัติยกเลิก</button>
            <button class="btn-act btn-act-reject" onclick="rejectCancellation('${req.id}')"><span class="material-symbols-outlined">cancel</span> ปฏิเสธ</button>
          ` : `
            <span style="font-size:12px; color:#64748b; font-weight:600;">สิทธิ์ดูข้อมูลเท่านั้น</span>
          `}
        </div>
      `;
    } else if (currentLeaveTab === "history") {
      const userRoleLower = String(currentRole || '').toLowerCase();
      // Even if HR/Admin could force cancel in the past, let's keep it or remove it depending on intent. The user said: "มีหน้าที่แค่ดูข้อมูลไม่ต้องอนุมัติใบลา แก้ให้หมดนะด่วนๆ" (only has role to view data, does not approve leave). They can keep print and preview.
      const canForceCancel = !isHrOrAdmin && (userRoleLower === 'superadmin');
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')" title="ดูรายละเอียด"><span class="material-symbols-outlined">visibility</span><span class="btn-text"> รายละเอียด</span></button>
          <button class="btn-act btn-act-print" onclick="printLeaveA4('${req.id}')" title="พิมพ์ใบลา" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;"><span class="material-symbols-outlined">print</span><span class="btn-text"> พิมพ์</span></button>
          ${(req.status === 'approved' && canForceCancel) ? `
            <button class="btn-act btn-act-cancel" onclick="forceCancelLeave('${req.id}')"><span class="material-symbols-outlined">block</span> ยกเลิกใบลา</button>
          ` : ''}
        </div>
      `;
    } else {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')" title="ดูรายละเอียด"><span class="material-symbols-outlined">visibility</span></button>
          <button class="btn-act btn-act-print" onclick="printLeaveA4('${req.id}')" title="พิมพ์ใบลา" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;"><span class="material-symbols-outlined">print</span></button>
          ${getApproveMode(req) === 'normal' ? `
            <button class="btn-act btn-act-approve" onclick="approveLeave('${req.id}')" title="อนุมัติ"><span class="material-symbols-outlined">check_circle</span> อนุมัติ</button>
            <button class="btn-act btn-act-reject" onclick="rejectLeave('${req.id}')" title="ปฏิเสธ"><span class="material-symbols-outlined">cancel</span> ไม่อนุมัติ</button>
          ` : ''}
        </div>
      `;
    }

    const isApplicantLeaderOrManager = isLeaderOrManagerRole(req.employees?.role, req.employees?.positions?.position_name);
    let executiveStatusHTML = "-";
    if (isApplicantLeaderOrManager) {
      executiveStatusHTML = getStatusBadgeHTML(req.executive_status);
    }

    const isPendingTab = (currentLeaveTab === "pending" && currentRole !== 'hr' && currentRole !== 'admin');
    const checkboxHTML = isPendingTab ? `
      <div class="bulk-check-wrapper" style="display: flex; align-items: center; justify-content: center; padding-right: 12px; margin-right: 4px;">
        <input type="checkbox" class="bulk-item-check" data-id="${req.id}" onclick="handleBulkItemCheckChange()" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--th-p-600, #0d9488);">
      </div>
    ` : '';

    cardsContent += `
      <div class="leave-card-item ${isOverdue ? 'is-overdue' : ''}">
        <!-- Zone 1: Profile & Emp Info -->
        <div class="card-zone profile-zone" style="display: flex; align-items: center;">
          ${checkboxHTML}
          <img src="${avatarUrl}" class="card-avatar" data-av-title="${avTitle}" data-av-name="${avName}" onerror="pvtAvatarError(this)">
          <div class="profile-info">
            <span class="emp-code">#${empCode}</span>
            <strong class="emp-name">${empName}</strong>
            <span class="emp-dept">📂 ${empDeptName} · 💼 ${empPositionName}</span>
          </div>
        </div>

        <!-- Zone 2: Leave Details -->
        <div class="card-zone details-zone">
          <div class="detail-row">
            <span class="label">ประเภท:</span>
            <span class="val-highlight">${leaveType} (${durationText})</span>
          </div>
          <div class="detail-row">
            <span class="label">วันที่:</span>
            <span class="val">${startDate} ถึง ${endDate}</span>
          </div>
          <div class="detail-row reason-row" ${req.is_emergency ? 'style="background: #fef2f2; padding: 6px 8px; border-radius: 8px; border: 1px solid #fecaca;"' : ''}>
            <span class="label">เหตุผล:</span>
            <span class="val text-truncate-2" ${req.is_emergency ? 'style="color: #b91c1c; font-weight: 700;"' : ''}>
              ${req.is_emergency ? '<span style="background: #ef4444; color: #fff; font-size: 10px; padding: 1px 6px; border-radius: 6px; font-weight: 800; margin-right: 4px; display: inline-block;">🚨 ฉุกเฉิน</span>' : ''}${reasonText}
            </span>
            <div class="attachment-trigger">
              ${renderAttachmentCell(attachmentUrl, req.id)}
            </div>
          </div>
          ${isOverdue ? `
            <div class="overdue-alert-box">
              <span class="material-symbols-outlined" style="font-size: 16px; flex-shrink: 0; color: #ea580c;">timer_off</span>
              <div>
                <strong>ใบลาไม่ได้รับการพิจารณาในเวลาที่กำหนด:</strong> ค้างพิจารณามาแล้ว <strong>${sla.elapsedDays} วัน</strong> (กำหนดหัวหน้าและผู้จัดการอนุมัติภายใน 2 วัน)
              </div>
            </div>
          ` : ''}
          ${(req.cancel_reason || (req.approval_comment && req.approval_comment.includes('ยกเลิก')) || req.status === 'cancelled') ? `
            <div class="cancellation-reason-box" style="margin-top: 6px; padding: 6px 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; font-size: 12px; color: #be123c; display: flex; align-items: flex-start; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 16px; margin-top: 1px; flex-shrink: 0;">info</span>
              <div>
                <strong>เหตุผลที่ยกเลิก:</strong> ${escapeHtml(req.cancel_reason || req.approval_comment || 'ไม่ได้ระบุเหตุผล')}
              </div>
            </div>
          ` : ''}
          ${(req.status === 'rejected' && req.approval_comment && !req.approval_comment.includes('ยกเลิก')) ? `
            <div class="rejection-reason-box" style="margin-top: 6px; padding: 6px 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; font-size: 12px; color: #be123c; display: flex; align-items: flex-start; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 16px; margin-top: 1px; flex-shrink: 0;">cancel</span>
              <div>
                <strong>เหตุผลที่ไม่อนุมัติ:</strong> ${escapeHtml(req.approval_comment)}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Zone 3: Approval Steps (ซ่อน L1/L2 หากแผนกไม่มีผู้รับผิดชอบในระดับนั้น) -->
        <div class="card-zone status-zone">
          ${(() => {
            const workflowSteps = getApprovalWorkflowSteps(req);
            return `
              ${renderApprovalTimelineHTML(req, workflowSteps)}
              ${isOverdue ? `
                <div style="margin-top: 6px; text-align: center;">
                  <span class="status-badge status-overdue" style="font-size: 11px; padding: 2px 8px;" title="เกินกรอบเวลาพิจารณา 2 วัน">
                    <span class="material-symbols-outlined" style="font-size: 13px;">timer_off</span> เกินกำหนด (${sla.elapsedDays} วัน)
                  </span>
                </div>
              ` : ''}
            `;
          })()}
        </div>

        <!-- Zone 4: Actions -->
        <div class="card-zone actions-zone">
          ${actionButtons}
        </div>
      </div>
    `;
  });

  // สร้างส่วน Header ของรายการ (ใช้สำหรับ Desktop ให้ดูเป็นระเบียบ)
  const listHeader = `
    <div class="leave-list-header">
      <div class="col-profile">ผู้ขอลา / ข้อมูลพนักงาน</div>
      <div class="col-details">รายละเอียดการลา / ช่วงเวลา</div>
      <div class="col-status-group">สถานะการอนุมัติ (ลำดับที่ 1–3)</div>
      <div class="col-actions">การจัดการ</div>
    </div>
  `;
  container.innerHTML = listHeader + `<div class="leave-cards-container">${cardsContent}</div>`;

  // Update Bulk Action Bar visibility
  const bulkBar = document.getElementById("bulkActionBar");
  if (bulkBar) {
    if (currentLeaveTab === "pending" && filteredRequests.length > 0 && currentRole !== 'hr' && currentRole !== 'admin') {
      bulkBar.style.display = "flex";
      // Reset select all checkbox
      const selectAllCheckbox = document.getElementById("selectAllBulk");
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      document.getElementById("bulkSelectedCount").innerText = "เลือกแล้ว 0 รายการ";
    } else {
      bulkBar.style.display = "none";
    }
  }
}

/* ==========================================================================
   🖼️ ATTACHMENT CELL & LIGHTBOX PREVIEW
   ========================================================================== */

function renderAttachmentCell(rawUrl, rowId) {
  if (!rawUrl) {
    return `
      <span class="status-badge status-cancelled" style="font-size: 11px;">
        <span class="material-symbols-outlined" style="font-size:13px;">no_photography</span> ไม่มี
      </span>`;
  }

  const cleanUrl = String(rawUrl).trim();
  const isImage = /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(cleanUrl) || cleanUrl.startsWith('data:image/');

  if (isImage) {
    return `
      <button type="button" class="btn-act btn-act-preview" onclick="openImageLightbox('${cleanUrl}', 'หลักฐานการลา #${rowId}')" title="ดูรูปภาพ">
        <span class="material-symbols-outlined">image</span> ดูรูป
      </button>`;
  }

  return `
    <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="btn-act btn-act-print" style="text-decoration:none;">
      <span class="material-symbols-outlined">description</span> เปิดไฟล์
    </a>`;
}

function openImageLightbox(imgUrl, titleText = 'หลักฐานการลา') {
  const existingModal = document.getElementById('imageLightboxModal');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="imageLightboxModal" class="pvt-modal-overlay active" onclick="closeImageLightbox(event)" style="z-index: 99999;">
      <div class="pvt-modal-card" style="max-width: 800px; width: 90%; text-align: center;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3><span class="material-symbols-outlined">image</span> ${titleText}</h3>
          <button class="modal-close-btn" onclick="closeImageLightbox()">&times;</button>
        </div>
        <div class="modal-body" style="padding: 16px;">
          <img src="${imgUrl}" alt="หลักฐานขยาย" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 12px; box-shadow: var(--shadow-md);" />
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.addEventListener('keydown', handleEscKey);
}

function closeImageLightbox(e) {
  const modal = document.getElementById('imageLightboxModal');
  if (modal) modal.remove();
  document.removeEventListener('keydown', handleEscKey);
}

function handleEscKey(e) {
  if (e.key === 'Escape') closeImageLightbox();
}

/* ==========================================================================
   👁️ 5. MODAL PREVIEW & LEAVE DETAILS
   ========================================================================== */

function previewLeaveModal(leaveId, isReviewMode = false) {
  const req = allLeaveRequests.find(r => String(r.id) === String(leaveId));
  if (!req) return;

  const modal = document.getElementById("leavePreviewModal");
  const modalBody = document.getElementById("leavePreviewModalBody");
  const modalFooter = document.getElementById("leavePreviewModalFooter");
  const modalHeaderTitle = document.querySelector("#leavePreviewModal .modal-header h3");

  if (!modal || !modalBody) return;

  if (modalHeaderTitle) {
    modalHeaderTitle.innerHTML = isReviewMode
      ? '<span class="material-symbols-outlined" style="color: var(--th-p-600, #0d9488);">gavel</span> พิจารณาอนุมัติคำขอลาหยุดงาน'
      : '<span class="material-symbols-outlined">description</span> ตรวจสอบรายละเอียดใบขออนุมัติลา';
  }

  const emp = req.employees || {};
  const avatarUrl = getAvatarUrl(emp);
  const displayDays = req.actual_days || req.days_requested || req.total_days || 0;
  const friendlyDuration = window.PVTSDK?.formatLeaveDurationFriendly ? window.PVTSDK.formatLeaveDurationFriendly(displayDays, req.leave_hours || 0) : `${displayDays} วัน`;
  const leaveName = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุประเภทการลา";
  const attachUrl = getAttachmentUrl(req);
  const isImage = attachUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachUrl.split('?')[0]);

  const sla = getLeaveApprovalSLA(req);
  const isOverdue = sla.isOverdue;
  const isPending = (!req.status || req.status === 'pending' || req.status === 'รออนุมัติ') && currentRole !== 'hr' && currentRole !== 'admin';

  modalBody.innerHTML = `
    <div class="preview-user-card">
      <img src="${avatarUrl}" class="preview-avatar" data-av-id="${emp.id || ''}" data-av-title="${emp.title || emp.prefix || ''}" data-av-name="${emp.full_name || ''}" onerror="pvtAvatarError(this)">
      <div class="preview-user-info">
        <h4>${emp.full_name || 'ไม่ระบุชื่อ'} ${emp.nickname ? `(${emp.nickname})` : ''}</h4>
        <p>รหัสพนักงาน: <strong>${emp.employee_code || '-'}</strong> | แผนก: ${emp.departments?.department_name || '-'} | ตำแหน่ง: ${emp.positions?.position_name || '-'}</p>
      </div>
    </div>

    ${isOverdue ? `
      <div class="preview-item" style="margin-bottom: 16px; background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 10px; padding: 12px 16px;">
        <label style="color: #c2410c; font-weight: 800; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 13px;">
          <span class="material-symbols-outlined" style="font-size:20px; color:#ea580c;">timer_off</span> ใบลาไม่ได้รับการพิจารณาในเวลาที่กำหนด (Overdue Leave Request)
        </label>
        <div style="font-weight: 600; line-height: 1.5; color: #9a3412; font-size: 13px;">
          คำขอนี้ค้างการพิจารณามาแล้ว <strong>${sla.elapsedDays} วัน</strong> (${sla.elapsedHours} ชม.) ซึ่งเกินกำหนดเวลาที่หัวหน้าและผู้จัดการต้องพิจารณาภายใน 2 วันทำการ
        </div>
      </div>
    ` : ''}

    <div class="preview-grid">
      <div class="preview-item">
        <label>ประเภทการลา</label>
        <span class="value" style="color: var(--primary); font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 18px;">event_note</span> ${leaveName}
        </span>
      </div>
      <div class="preview-item">
        <label>ระยะเวลาการลา</label>
        <span class="value" style="font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 18px;">schedule</span> ${friendlyDuration}
        </span>
      </div>
      <div class="preview-item">
        <label>ตั้งแต่วันที่</label>
        <span class="value" style="display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 18px; color: #64748b;">calendar_today</span> ${formatThaiDate(req.start_date)}
        </span>
      </div>
      <div class="preview-item">
        <label>ถึงวันที่</label>
        <span class="value" style="display: flex; align-items: center; gap: 6px;">
          <span class="material-symbols-outlined" style="font-size: 18px; color: #64748b;">calendar_today</span> ${formatThaiDate(req.end_date)}
        </span>
      </div>
    </div>

    <div class="preview-item-full" ${req.is_emergency ? 'style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;"' : ''}>
      <label ${req.is_emergency ? 'style="color: #b91c1c; font-weight: 800; display: flex; align-items: center; gap: 6px;"' : ''}>
        ${req.is_emergency ? '<span class="material-symbols-outlined" style="font-size: 18px; color: #ef4444;">warning</span> 🚨 กรณีลาฉุกเฉิน / ลากะทันหัน (Emergency Leave)' : 'เหตุผล / หมายเหตุประกอบการลา'}
      </label>
      <div style="font-weight: 600; line-height: 1.6; color: ${req.is_emergency ? '#9f1239' : '#334155'}; font-size: 14px;">
        ${escapeHtml(req.reason || 'ไม่ได้ระบุเหตุผล')}
      </div>
    </div>

    ${(req.cancel_reason || (req.approval_comment && req.approval_comment.includes('ยกเลิก')) || req.status === 'cancelled') ? `
      <div class="preview-item" style="margin-bottom: 16px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 12px;">
        <label style="color: #be123c; font-weight: 700; display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
          <span class="material-symbols-outlined" style="font-size:18px;">warning</span> เหตุผลการยกเลิกใบลา (Cancellation Reason)
        </label>
        <div style="font-weight: 500; line-height: 1.5; color: #9f1239;">${escapeHtml(req.cancel_reason || req.approval_comment || 'ไม่ได้ระบุเหตุผล')}</div>
      </div>
    ` : ''}

    ${(req.status === 'rejected' && req.approval_comment && !req.approval_comment.includes('ยกเลิก')) ? `
      <div class="preview-item" style="margin-bottom: 16px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; padding: 12px;">
        <label style="color: #be123c; font-weight: 700; display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
          <span class="material-symbols-outlined" style="font-size:18px;">cancel</span> เหตุผลที่ไม่อนุมัติ (Rejection Reason)
        </label>
        <div style="font-weight: 500; line-height: 1.5; color: #9f1239;">${escapeHtml(req.approval_comment)}</div>
      </div>
    ` : ''}

    <div class="workflow-section" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 20px 22px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--th-p-50, #f0fdfa); color: var(--th-p-600, #0d9488); display: flex; align-items: center; justify-content: center;">
            <span class="material-symbols-outlined" style="font-size: 20px;">timeline</span>
          </div>
          <div>
            <h4 style="margin: 0; font-size: 15px; font-weight: 800; color: #0f172a;">ติดตามสถานะและขั้นตอนการพิจารณา (Visual Progress Tracker)</h4>
            <span style="font-size: 12px; color: #64748b; font-weight: 500;">คำนวณตามโครงสร้างสายงานจริงของแผนก (${escapeHtml(emp.departments?.department_name || '-')})</span>
          </div>
        </div>
      </div>

      <!-- Stepper Vertical Timeline -->
      <div style="position: relative; padding-left: 38px; display: flex; flex-direction: column; gap: 20px;">
        <!-- Vertical connecting line -->
        <div style="position: absolute; left: 14px; top: 14px; bottom: 20px; width: 2px; background: #e2e8f0; z-index: 1;"></div>

        ${(() => {
          const workflowSteps = getApprovalWorkflowSteps(req);
          const stepsList = [];
          
          // 1. Step 1: ยื่นคำขอลาสำเร็จ
          stepsList.push({
            title: '1. ยื่นคำขอลาสำเร็จ',
            badge: '<span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">check_circle</span> สำเร็จแล้ว</span>',
            desc: 'คำขอลาถูกส่งเข้าระบบ PVT Workforce Hub เรียบร้อยแล้ว',
            circle: { bg: '#10b981', color: '#ffffff', icon: 'check' }
          });

          let stepIndex = 2;
          let priorStepApproved = true;

          workflowSteps.forEach(ws => {
            const st = String(ws.status || 'pending').toLowerCase();
            const isApproved = st === 'approved' || st === 'อนุมัติแล้ว';
            const isRejected = st === 'rejected' || st === 'ไม่อนุมัติ';
            
            let badgeHtml = '';
            let circleStyle = { bg: '#f59e0b', color: '#ffffff', icon: 'hourglass_empty' };
            let descText = '';

            if (!priorStepApproved && !isApproved && !isRejected) {
              badgeHtml = '<span style="background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">schedule</span> รอดำเนินการ</span>';
              circleStyle = { bg: '#e2e8f0', color: '#94a3b8', icon: 'schedule' };
              descText = `รอดำเนินการหลังจากขั้นตอนก่อนหน้าได้รับการอนุมัติ`;
            } else if (isApproved) {
              badgeHtml = '<span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">check_circle</span> อนุมัติแล้ว</span>';
              circleStyle = { bg: '#10b981', color: '#ffffff', icon: 'check' };
              descText = `${ws.fullName} ตรวจสอบและลงนามอนุมัติเรียบร้อยแล้ว`;
            } else if (isRejected) {
              badgeHtml = '<span style="background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">cancel</span> ไม่อนุมัติ</span>';
              circleStyle = { bg: '#ef4444', color: '#ffffff', icon: 'close' };
              descText = `${ws.fullName} พิจารณาไม่อนุมัติคำขอนี้`;
              priorStepApproved = false;
            } else {
              badgeHtml = '<span style="background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">hourglass_top</span> กำลังรอพิจารณา</span>';
              circleStyle = { bg: '#f59e0b', color: '#ffffff', icon: 'hourglass_empty' };
              descText = `กำลังรอ ${ws.fullName} ตรวจสอบและพิจารณาตามขั้นตอน`;
              priorStepApproved = false;
            }

            stepsList.push({
              title: `${stepIndex}. ${ws.fullName}`,
              badge: badgeHtml,
              desc: descText,
              circle: circleStyle
            });

            stepIndex++;
          });

          // Final step: อนุมัติเสร็จสมบูรณ์ (Final Decision)
          const overallStatus = String(req.status || 'pending').toLowerCase();
          const allStepsDone = workflowSteps.length > 0 && workflowSteps.every(ws => {
            const s = String(ws.status || '').toLowerCase();
            return s === 'approved' || s === 'อนุมัติแล้ว';
          });
          const isFinalApproved = overallStatus === 'approved' || overallStatus === 'อนุมัติแล้ว' || allStepsDone;
          const isFinalRejected = overallStatus === 'rejected' || overallStatus === 'ไม่อนุมัติ';
          const isFinalCancelled = overallStatus === 'cancelled' || overallStatus === 'ยกเลิก';

          let finalBadge = '';
          let finalCircle = { bg: '#f59e0b', color: '#ffffff', icon: 'hourglass_empty' };
          let finalDesc = '';

          if (isFinalApproved) {
            finalBadge = '<span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">verified</span> อนุมัติเสร็จสมบูรณ์</span>';
            finalCircle = { bg: '#10b981', color: '#ffffff', icon: 'verified' };
            finalDesc = 'คำขอลาผ่านการอนุมัติครบถ้วนสมบูรณ์ มีผลบันทึกในระบบและตัดยอดวันลาเรียบร้อยแล้ว';
          } else if (isFinalRejected) {
            finalBadge = '<span style="background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">cancel</span> สิ้นสุด (ไม่อนุมัติ)</span>';
            finalCircle = { bg: '#ef4444', color: '#ffffff', icon: 'close' };
            finalDesc = 'คำขอลาไม่ได้รับการอนุมัติ';
          } else if (isFinalCancelled) {
            finalBadge = '<span style="background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">block</span> ยกเลิกคำขอแล้ว</span>';
            finalCircle = { bg: '#94a3b8', color: '#ffffff', icon: 'block' };
            finalDesc = 'ใบลาถูกยกเลิกเรียบร้อยแล้ว';
          } else if (overallStatus === 'cancel_pending' || overallStatus === 'cancel_requested' || overallStatus === 'ขอยกเลิก') {
            finalBadge = '<span style="background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">hourglass_top</span> รอการติดตามผลคำร้องขอยกเลิก</span>';
            finalCircle = { bg: '#f59e0b', color: '#ffffff', icon: 'hourglass_empty' };
            finalDesc = 'มีการยื่นคำร้องขอยกเลิกใบลา อยู่ระหว่างรอการตรวจสอบและพิจารณาจาก HR / ผู้ดูแล';
          } else {
            finalBadge = '<span style="background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 12px; display: inline-flex; align-items: center; gap: 3px;"><span class="material-symbols-outlined" style="font-size: 13px;">hourglass_top</span> กำลังรอพิจารณา</span>';
            finalCircle = { bg: '#f59e0b', color: '#ffffff', icon: 'hourglass_empty' };
            finalDesc = 'ตรวจสอบความถูกต้องและผ่านการอนุมัติระดับแผนกเรียบร้อย';
          }

          stepsList.push({
            title: `${stepIndex}. อนุมัติเสร็จสมบูรณ์ (Final Decision)`,
            badge: finalBadge,
            desc: finalDesc,
            circle: finalCircle
          });

          return stepsList.map(step => `
            <div style="position: relative; z-index: 2;">
              <div style="position: absolute; left: -38px; top: 0; width: 30px; height: 30px; border-radius: 50%; background: ${step.circle.bg}; color: ${step.circle.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px #ffffff, 0 2px 5px rgba(0,0,0,0.08);">
                <span class="material-symbols-outlined" style="font-size: 17px; font-weight: bold;">${step.circle.icon}</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                <div style="font-size: 13.5px; font-weight: 700; color: #1e293b;">${step.title}</div>
                <div>${step.badge}</div>
              </div>
              <div style="font-size: 12px; color: #64748b; margin-top: 3px; line-height: 1.5;">${step.desc}</div>
            </div>
          `).join('');
        })()}
      </div>

      <div style="margin-top: 18px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 10px 14px; display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #166534; line-height: 1.5;">
        <span class="material-symbols-outlined" style="font-size: 18px; color: #15803d; flex-shrink: 0; margin-top: 1px;">info</span>
        <div><strong>ระบบสายอนุมัติอัตโนมัติ:</strong> แสดงเฉพาะขั้นตอนที่จำเป็นตามโครงสร้างแผนกจริง หากแผนกไม่มีหัวหน้างาน หรือไม่ต้องผ่านผู้บริหาร ระบบจะข้ามขั้นตอนนั้นไปโดยอัตโนมัติ</div>
      </div>
    </div>

    <div class="preview-attachment-section" style="margin-bottom: 8px;">
      <label style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">หลักฐานแนบประกอบการลา</label>
      ${attachUrl ? `
        <div class="preview-attachment-box">
          ${isImage ? `
            <img src="${attachUrl}" class="preview-attachment-img" alt="หลักฐานการลา" onclick="openImageLightbox('${attachUrl}', 'รายการ #${req.id}')">
            <p style="font-size:11px; color:var(--text-soft); margin-top:8px; font-weight: 500;">(คลิกรูปเพื่อดูขนาดเต็ม)</p>
          ` : `
            <a href="${attachUrl}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px; font-size: 14px;">
              <span class="material-symbols-outlined">attach_file</span> เปิดดูเอกสารแนบ
            </a>
          `}
        </div>
      ` : `
        <div class="preview-attachment-none">ไม่มีหลักฐานแนบ</div>
      `}
    </div>
  `;

  // 🔘 Footer Action Buttons
  if (modalFooter) {
    modalFooter.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn-act btn-act-print" id="btnModalPrint" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 7px 14px; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 18px;">print</span> พิมพ์ใบลา A4
          </button>
          ${attachUrl ? `
            <button type="button" class="btn-act btn-act-preview" id="btnModalAttach" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; padding: 7px 14px; border-radius: 8px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
              <span class="material-symbols-outlined" style="font-size: 18px;">${isImage ? 'image' : 'attach_file'}</span> ${isImage ? 'ดูรูปหลักฐาน' : 'เปิดไฟล์แนบ'}
            </button>
          ` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${isPendingStatus(req.status) && getApproveMode(req) === 'override' ? `
            <details class="pvt-special-case" style="position:relative;">
              <summary style="list-style:none; cursor:pointer; padding:7px 14px; border-radius:8px; border:1px dashed #f59e0b; background:#fffbeb; color:#92400e; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
                <span class="material-symbols-outlined" style="font-size:18px;">shield_person</span> กรณีพิเศษ (HR)
              </summary>
              <div style="position:absolute; right:0; bottom:calc(100% + 8px); z-index:5; width:300px; background:#fff; border:1px solid #fde68a; border-radius:12px; box-shadow:0 10px 30px rgba(15,23,42,.15); padding:14px;">
                <div style="font-size:13px; color:#78350f; line-height:1.6; margin-bottom:10px;">ข้ามสายอนุมัติขององค์กร ใช้เมื่อจำเป็นเท่านั้น</div>
                <div style="display:flex; gap:8px;">
                  <button type="button" onclick="closePreviewModal(); specialCaseLeaveAction('${req.id}', 'approve')" style="flex:1; background:#10b981; color:#fff; border:none; padding:8px; border-radius:8px; font-weight:700; cursor:pointer;">อนุมัติ</button>
                  <button type="button" onclick="closePreviewModal(); specialCaseLeaveAction('${req.id}', 'reject')" style="flex:1; background:#ef4444; color:#fff; border:none; padding:8px; border-radius:8px; font-weight:700; cursor:pointer;">ไม่อนุมัติ</button>
                </div>
              </div>
            </details>
          ` : ''}
          ${isPending && getApproveMode(req) === 'normal' ? `
            <button type="button" class="btn-act btn-act-approve" id="btnModalApprove" style="background: #10b981; color: #ffffff; border: none; padding: 7px 18px; border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);">
              <span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span> อนุมัติ
            </button>
            <button type="button" class="btn-act btn-act-reject" id="btnModalReject" style="background: #ef4444; color: #ffffff; border: none; padding: 7px 18px; border-radius: 8px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.3);">
              <span class="material-symbols-outlined" style="font-size: 18px;">cancel</span> ไม่อนุมัติ
            </button>
          ` : ''}
          <button type="button" class="tab-btn" onclick="closePreviewModal()" style="padding: 7px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #ffffff; color: #64748b; font-weight: 600; cursor: pointer;">
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    `;

    const btnModalPrintEl = document.getElementById("btnModalPrint");
    if (btnModalPrintEl) {
      btnModalPrintEl.onclick = () => {
        closePreviewModal();
        printLeaveA4(req.id);
      };
    }

    const btnModalAttachEl = document.getElementById("btnModalAttach");
    if (btnModalAttachEl) {
      btnModalAttachEl.onclick = () => {
        if (isImage) {
          openImageLightbox(attachUrl, `หลักฐานการลา #${req.id}`);
        } else {
          window.open(attachUrl, '_blank');
        }
      };
    }

    const btnModalApproveEl = document.getElementById("btnModalApprove");
    if (btnModalApproveEl) {
      btnModalApproveEl.onclick = () => {
        closePreviewModal();
        approveLeave(req.id);
      };
    }

    const btnModalRejectEl = document.getElementById("btnModalReject");
    if (btnModalRejectEl) {
      btnModalRejectEl.onclick = () => {
        closePreviewModal();
        rejectLeave(req.id);
      };
    }
  }

  // 🧾 ประวัติการพิจารณาทุกขั้น (หลักฐาน)
  if (modalBody && window.PVTLeaveAudit) {
    const tl = document.createElement('div');
    tl.id = 'leaveAuditTimeline';
    tl.style.cssText = 'margin-top:16px;';
    modalBody.appendChild(tl);
    renderLeaveAuditTimeline(leaveId, tl);
  }

  modal.classList.add("active");
}

const AUDIT_ACTION_UI = {
  submitted:        { icon: 'send',          color: '#2563eb', text: 'ยื่นใบลา' },
  step_approved:    { icon: 'check',         color: '#0f766e', text: 'อนุมัติแล้ว (ส่งต่อลำดับถัดไป)' },
  approved:         { icon: 'verified',      color: '#15803d', text: 'อนุมัติลำดับสุดท้าย' },
  rejected:         { icon: 'close',         color: '#dc2626', text: 'ไม่อนุมัติ' },
  auto_rejected:    { icon: 'timer_off',     color: '#b45309', text: 'ไม่อนุมัติอัตโนมัติ (ค้างเกิน 48 ชม.)' },
  cancelled:        { icon: 'block',         color: '#64748b', text: 'ยกเลิกใบลา' },
  cancel_requested: { icon: 'undo',          color: '#b45309', text: 'ขอยกเลิกใบลา' },
  cancel_approved:  { icon: 'block',         color: '#64748b', text: 'HR อนุมัติการยกเลิก' },
  cancel_rejected:  { icon: 'undo',          color: '#0f766e', text: 'HR ไม่อนุมัติการยกเลิก' },
  reassigned:       { icon: 'swap_horiz',    color: '#7c3aed', text: 'HR โอนผู้อนุมัติ' }
};

async function renderLeaveAuditTimeline(leaveId, el) {
  if (!el) return;
  el.innerHTML = '<div style="font-size:13px;color:#64748b;">กำลังโหลดประวัติการพิจารณา...</div>';
  const rows = await window.PVTLeaveAudit.history(leaveId);
  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || '-'; }
  };
  const items = rows.map((r) => {
    const ui = AUDIT_ACTION_UI[r.action] || { icon: 'info', color: '#64748b', text: r.action };
    return `
      <li style="display:flex;gap:10px;padding:8px 0;border-bottom:1px dashed #e2e8f0;">
        <span class="material-symbols-outlined" style="flex:0 0 26px;width:26px;height:26px;border-radius:50%;background:${ui.color}1a;color:${ui.color};font-size:16px;display:flex;align-items:center;justify-content:center;">${ui.icon}</span>
        <div style="flex:1;min-width:0;font-size:13px;line-height:1.5;">
          <div style="font-weight:700;color:#0f172a;">${escapeHtml(ui.text)}${r.step_label ? ` <span style="font-weight:500;color:#64748b;">· ${escapeHtml(window.PVTApproval?.neutralText ? window.PVTApproval.neutralText(r.step_label) : r.step_label)}</span>` : ''}</div>
          <div style="color:#475569;">โดย ${escapeHtml(r.actor_name || '-')} · ${escapeHtml(fmt(r.created_at))}</div>
          ${r.comment ? `<div style="color:#334155;margin-top:2px;">💬 ${escapeHtml(r.comment)}</div>` : ''}
        </div>
      </li>`;
  }).join('');
  el.innerHTML = `
    <div style="font-weight:800;font-size:14px;color:#0f172a;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      <span class="material-symbols-outlined" style="font-size:18px;">history</span> ประวัติการพิจารณา (หลักฐาน)
    </div>
    ${rows.length
      ? `<ul style="list-style:none;margin:0;padding:0;">${items}</ul>`
      : '<div style="font-size:12.5px;color:#94a3b8;">ยังไม่มีบันทึก (ใบลาที่ยื่นก่อนเปิดใช้ระบบบันทึกหลักฐาน)</div>'}`;
}
window.renderLeaveAuditTimeline = renderLeaveAuditTimeline;

function closePreviewModal() {
  const modal = document.getElementById("leavePreviewModal");
  if (modal) modal.classList.remove("active");
}

/* ==========================================================================
   🔵 6. WORKFLOW ACTIONS (APPROVE / REJECT / CANCEL)
   ========================================================================== */

/**
 * 🛡️ สร้างโครงร่าง HTML สรุปข้อมูลใบลาสำหรับกล่องยืนยัน SweetAlert2
 * ป้องกันการกดยืนยันหรือไม่อนุมัติโดยไม่ตั้งใจ (Accidental Submissions)
 */
function buildLeaveActionConfirmDialogHtml(reqData, roleTitle, actionType = 'approve') {
  const empName = reqData.employees?.full_name || reqData.employees?.name || 'ไม่ระบุชื่อพนักงาน';
  const empCode = reqData.employees?.employee_code ? `รหัส ${reqData.employees.employee_code}` : '';
  let deptName = reqData.employees?.departments?.department_name || reqData.department_name || '';
  if (!deptName && reqData.employees?.department_id && window.allDepartmentsMap) {
    deptName = window.allDepartmentsMap[reqData.employees.department_id] || '';
  }
  if (!deptName) deptName = '-';
  const posName = reqData.employees?.positions?.position_name || '-';
  const leaveName = reqData.leave_types ? reqData.leave_types.leave_name : 'ไม่ระบุประเภท';
  const startDate = typeof formatThaiDate === 'function' ? formatThaiDate(reqData.start_date) : reqData.start_date;
  const endDate = typeof formatThaiDate === 'function' ? formatThaiDate(reqData.end_date) : reqData.end_date;
  const reason = reqData.reason || 'ไม่ได้ระบุเหตุผล';

  const rawDays = reqData.actual_days || reqData.days_requested || reqData.total_days || 0;
  const leaveHours = reqData.leave_hours || 0;
  let durationText = `${rawDays} วัน`;
  if (leaveHours > 0) {
    const d = Math.floor(leaveHours / 8);
    const remH = leaveHours % 8;
    const wholeH = Math.floor(remH);
    const mins = Math.round((remH - wholeH) * 60);
    let parts = [];
    if (d > 0) parts.push(`${d} วัน`);
    if (wholeH > 0) parts.push(`${wholeH} ชม.`);
    if (mins > 0) parts.push(`${mins} นาที`);
    durationText = parts.length > 0 ? parts.join(' ') : `${leaveHours} ชม.`;
  } else if (rawDays % 1 !== 0) {
    const wholeDays = Math.floor(rawDays);
    const totalH = (rawDays - wholeDays) * 8;
    const wholeH = Math.floor(totalH);
    const mins = Math.round((totalH - wholeH) * 60);
    let parts = [];
    if (wholeDays > 0) parts.push(`${wholeDays} วัน`);
    if (wholeH > 0) parts.push(`${wholeH} ชม.`);
    if (mins > 0) parts.push(`${mins} นาที`);
    durationText = parts.length > 0 ? parts.join(' ') : `${rawDays} วัน`;
  }

  const isApprove = actionType === 'approve';
  const themeColor = isApprove ? '#10b981' : '#ef4444';
  const themeBg = isApprove ? '#f0fdf4' : '#fef2f2';
  const themeBorder = isApprove ? '#bbf7d0' : '#fecaca';

  return `
    <div style="text-align: left; font-size: 13.5px; line-height: 1.5; color: #334155; margin-top: 6px;">
      <!-- กล่องรายละเอียดข้อมูลใบลา -->
      <div style="background: ${themeBg}; border: 1.5px solid ${themeBorder}; border-radius: 14px; padding: 14px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-symbols-outlined" style="font-size: 22px; color: ${themeColor};">person</span>
            <div>
              <strong style="color: #0f172a; font-size: 15px;">${escapeHtml(empName)}</strong>
              ${empCode ? `<span style="background: #ffffff; color: #475569; font-size: 11.5px; font-weight: 600; padding: 1px 7px; border-radius: 6px; border: 1px solid #cbd5e1; margin-left: 6px;">${escapeHtml(empCode)}</span>` : ''}
            </div>
          </div>
          <span style="font-size: 11.5px; font-weight: 700; color: ${themeColor}; background: #ffffff; padding: 2px 9px; border-radius: 12px; border: 1px solid ${themeBorder};">
            #${escapeHtml(String(reqData.id).slice(-6))}
          </span>
        </div>

        <div style="font-size: 12.5px; color: #64748b; margin-bottom: 10px; padding-left: 30px;">
          <span>แผนก: <strong style="color: #334155;">${escapeHtml(deptName)}</strong></span>
          <span style="margin: 0 6px;">•</span>
          <span>ตำแหน่ง: <strong style="color: #334155;">${escapeHtml(posName)}</strong></span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #ffffff; border-radius: 10px; padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 13px;">
          <div>
            <span style="color: #64748b; font-size: 11.5px; display: block; margin-bottom: 2px;">ประเภทการลา</span>
            <strong style="color: var(--th-p-600, #0d9488); font-size: 13.5px;">${escapeHtml(leaveName)}</strong>
          </div>
          <div>
            <span style="color: #64748b; font-size: 11.5px; display: block; margin-bottom: 2px;">จำนวนเวลาลา</span>
            <strong style="color: #0f172a; font-size: 13.5px;">${durationText}</strong>
          </div>
          <div style="grid-column: span 2; border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 2px;">
            <span style="color: #64748b; font-size: 11.5px; display: block; margin-bottom: 2px;">ช่วงวันที่ขอลา</span>
            <strong style="color: #334155; font-size: 13px;">${startDate} - ${endDate}</strong>
          </div>
        </div>

        <div style="margin-top: 10px; font-size: 12.5px; background: #ffffff; border-radius: 10px; padding: 8px 12px; border: 1px solid #e2e8f0;">
          <span style="color: #64748b; font-weight: 600;">เหตุผลการลา:</span>
          <span style="color: #1e293b; margin-left: 4px;">${escapeHtml(reason)}</span>
        </div>
      </div>

      <!-- ข้อมูลสิทธิ์ผู้พิจารณา -->
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #64748b; padding: 2px 4px 6px 4px;">
        <span>สิทธิ์ผู้พิจารณา:</span>
        <span style="font-weight: 700; color: ${themeColor}; background: ${themeBg}; padding: 3px 10px; border-radius: 8px; border: 1px solid ${themeBorder};">
          ${escapeHtml(roleTitle)}
        </span>
      </div>

      ${isApprove ? `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #065f46; display: flex; align-items: center; gap: 6px; margin-top: 6px;">
          <span class="material-symbols-outlined" style="font-size: 17px; color: #10b981; flex-shrink: 0;">check_circle</span>
          <span>การอนุมัติจะมีผลตัดยอดวันลาและส่งการแจ้งเตือนไปยังพนักงานทันที</span>
        </div>
      ` : `
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #9f1239; display: flex; align-items: center; gap: 6px; margin-top: 6px;">
          <span class="material-symbols-outlined" style="font-size: 17px; color: #ef4444; flex-shrink: 0;">warning</span>
          <span>การไม่อนุมัติจะมีผลสิ้นสุดคำขอนี้ทันที และส่งเหตุผลแจ้งเตือนให้พนักงานทราบ</span>
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   ✅ ขั้นตอนอนุมัติ (ใช้ร่วมกัน: อนุมัติทีละใบ และอนุมัติกลุ่ม)
   - อัปเดตแบบมีเงื่อนไข: ต้องยังรออยู่ที่ขั้นนี้ (กันกดซ้ำ / สองคนกดพร้อมกัน)
   - ทุกขั้นครบ → อนุมัติขั้นสุดท้ายอัตโนมัติ
   - ตัดยอดวันลา "หลัง" บันทึกผลสำเร็จเท่านั้น
   - บันทึกหลักฐานทุกขั้น (leave_approval_logs) และแจ้ง HR เมื่อจบ (ในระบบ ไม่ส่ง LINE)
   - แจ้ง LINE ผู้อนุมัติขั้นถัดไป
   ========================================================================== */
async function performApprovalStep(reqData) {
  // 🔗 ใบลาที่มีขั้นอนุมัติ (ระยะ 2) → ใช้ตัวจัดการสายอนุมัติ
  if (reqData.__steps && reqData.__steps.length && window.PVTApproval) {
    const res = await window.PVTApproval.approve(reqData.id, { actorRole: currentRole });
    if (res.ok || res.reason !== 'no_steps') {
      return { ok: res.ok, final: !!res.final, balanceError: res.balanceError || null, reason: res.reason, nextLabel: res.nextLabel };
    }
  }
  const sb = window.pvtSupabase?.getClient?.() || window.supabaseClient;
  if (!sb) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
  const me = getMyEmpId();
  const chain = resolveRequestChain(reqData);
  const nowIso = new Date().toISOString();

  // หัวหน้างานที่เป็นผู้จัดการ (L2) ของใบนี้ด้วย → อนุมัติทั้งสองขั้นในครั้งเดียว
  let actRole = currentRole;
  if (actRole === 'leader' && chain.l2 && chain.l2 === me) actRole = 'manager';
  const isExecActor = actRole === 'executive' || actRole === 'director' || actRole === 'owner' ||
    (window.executiveApproverId && me === String(window.executiveApproverId));

  if (window.PVTSDK?.user?.ensureLeaveBalances) {
    await window.PVTSDK.user.ensureLeaveBalances(reqData.employee_id, reqData.start_date);
  }

  const updateFields = {};
  let guardField = null;
  if (actRole === 'leader') {
    updateFields.manager_status = 'approved';
    guardField = 'manager_status';
    // แผนกไม่มีผู้จัดการ (L2) → ข้าม L2
    const deptInfo = deptApproversMap[reqData.employees?.department_id] || {};
    const hasManagerInDept = Boolean(chain.l2) || deptInfo.hasManager || Boolean(reqData.employees?.l2_approver_id);
    if (!hasManagerInDept) updateFields.director_status = 'approved';
  } else if (actRole === 'manager') {
    updateFields.director_status = 'approved';
    guardField = 'director_status';
    if (reqData.manager_status !== 'approved') updateFields.manager_status = 'approved';
    const needsExecutive = isLeaderOrManagerRole(reqData.employees?.role, reqData.employees?.positions?.position_name) ||
      Boolean(reqData.employees?.l3_approver_id);
    if (!needsExecutive && reqData.executive_status !== 'approved') updateFields.executive_status = 'approved';
  } else if (isExecActor) {
    if (reqData.manager_status !== 'approved') updateFields.manager_status = 'approved';
    if (reqData.director_status !== 'approved') updateFields.director_status = 'approved';
    updateFields.executive_status = 'approved';
  } else {
    // HR / Admin (อนุมัติแทนได้ทุกขั้น)
    if (reqData.manager_status !== 'approved') updateFields.manager_status = 'approved';
    if (reqData.director_status !== 'approved') updateFields.director_status = 'approved';
    updateFields.executive_status = 'approved';
  }

  // ทุกขั้นผ่านครบ → อนุมัติขั้นสุดท้าย
  const merged = Object.assign({}, reqData, updateFields);
  const allStepsApproved = ['manager_status', 'director_status', 'executive_status']
    .every((f) => String(merged[f] || '').toLowerCase() === 'approved');
  const isFinal = allStepsApproved;
  if (isFinal) {
    updateFields.status = 'approved';
    updateFields.approved_at = nowIso;
    if (me) updateFields.approved_by = me;
  }
  updateFields.updated_at = nowIso;

  // 🔄 อนุมัติแทนตาม Auto-Delegation (หัวหน้าลาพักร้อน) → เก็บเป็นหมายเหตุ
  let delegationNote = '';
  if (window.AutoDelegationService) {
    try {
      const delegation = await window.AutoDelegationService.resolveDelegationForRequest(reqData);
      if (delegation && delegation.isDelegated) {
        const actorName = currentUserProfile?.full_name || 'ผู้รักษาการแทน';
        delegationNote = `[Auto-Delegation] อนุมัติโดย ${actorName} รักษาการแทน ${delegation.originalApproverName} (${delegation.reason})`;
        updateFields.approval_comment = delegationNote;
      }
    } catch (delErr) {
      console.warn("[Auto-Delegation] Audit resolution error:", delErr);
    }
  }

  // 🛡️ บันทึกเฉพาะเมื่อใบลายังอยู่ในสถานะเดิม (มีคนกดไปก่อน → ไม่มีแถวถูกแก้)
  let q = sb.from('leave_requests').update(updateFields).eq('id', reqData.id).eq('status', reqData.status || 'pending');
  if (guardField) q = q.or(`${guardField}.is.null,${guardField}.eq.pending`);
  const { data: changed, error: updateErr } = await q.select('id');
  if (updateErr) throw updateErr;
  if (!changed || !changed.length) return { ok: false, reason: 'stale' };

  // ตัดยอดวันลาหลังบันทึกผลสำเร็จ
  let balanceError = null;
  if (isFinal && window.PVTSDK?.user?.updateLeaveBalance) {
    try {
      const leaveDays = await getEffectiveLeaveDays(reqData);
      const currentYear = (typeof window.getLeaveChargeYear === 'function') ? window.getLeaveChargeYear(reqData) : getADYear(reqData.start_date);
      await window.PVTSDK.user.updateLeaveBalance(reqData.employee_id, reqData.leave_type_id, reqData.leave_types?.leave_code || null, currentYear, leaveDays);
    } catch (balErr) {
      balanceError = balErr?.message || String(balErr);
    }
  }

  // 🧾 หลักฐาน + แจ้ง HR เมื่อจบ
  const step = isExecActor ? stepInfoForRole('executive') : stepInfoForRole(actRole);
  const stepLabel = (currentRole === 'leader' && actRole === 'manager') ? 'ผู้อนุมัติ ลำดับที่ 1+2 (คนเดียวกัน)' : step.label;
  const auditOpts = {
    stepLevel: step.level, stepLabel, comment: delegationNote || null,
    statusBefore: reqData.status || 'pending', statusAfter: isFinal ? 'approved' : 'pending',
    meta: balanceError ? { balance_error: balanceError } : undefined
  };
  if (window.PVTLeaveAudit) {
    if (isFinal) await window.PVTLeaveAudit.recordOutcome(reqData, 'approved', auditOpts);
    else await window.PVTLeaveAudit.log(reqData, 'step_approved', auditOpts);
  }

  // 🔔 แจ้งพนักงานในระบบ "เฉพาะเมื่อจบขั้นตอน" — ระหว่างขั้นไม่แจ้ง (กันพนักงานเข้าใจว่าอนุมัติแล้ว)
  //    ถ้ามี SDK: REQUEST_APPROVED ด้านล่างบันทึกแจ้งเตือนในระบบให้แล้ว จึงไม่บันทึกซ้ำ
  if (isFinal && !window.PVTSDK?.line) try {
    const leaveName = reqData.leave_types?.leave_name || 'ใบลา';
    await sb.from('notifications').insert({
      employee_id: reqData.employee_id,
      title: 'ใบลาของคุณได้รับการอนุมัติแล้ว',
      message: `ใบลาประเภท ${leaveName} วันที่ ${reqData.start_date} ได้รับการอนุมัติเรียบร้อยแล้ว`,
      type: 'leave',
      link_url: '/pages/user/leave-history.html'
    });
  } catch (e) {
    console.warn('⚠️ แจ้งพนักงานไม่สำเร็จ:', e);
  }

  // 💬 LINE: ผู้อนุมัติขั้นถัดไป / พนักงาน (เมื่อจบ) — ไม่ส่ง LINE หา HR
  if (!isFinal) {
    await notifyNextApproverByLine(reqData, actRole, chain, merged);
  } else if (window.PVTSDK?.line) {
    try {
      await window.PVTSDK.line.sendWorkflowNotification({
        type: 'REQUEST_APPROVED',
        recipientId: reqData.employee_id,
        recipientLineId: reqData.employees?.line_id || '',
        leaveId: reqData.id,
        employeeName: reqData.employees?.full_name || 'พนักงาน',
        employeeCode: reqData.employees?.employee_code || '',
        departmentName: reqData.employees?.departments?.department_name || '',
        recipientRole: 'employee',
        leaveType: reqData.leave_types?.leave_name || 'ใบลา',
        startDate: reqData.start_date,
        endDate: reqData.end_date,
        totalDays: reqData.total_days,
        comment: 'ใบลาของคุณได้รับการอนุมัติเรียบร้อยแล้ว',
        attachmentUrl: reqData.attachment_url || ""
      });
    } catch (lineErr) {
      console.warn("⚠️ [Workflow Notification] Approval notice error to employee:", lineErr);
    }
  }

  return { ok: true, final: isFinal, balanceError };
}

// 💬 แจ้ง LINE ผู้อนุมัติขั้นถัดไป (+ แจ้งในระบบ)
async function notifyNextApproverByLine(reqData, actRole, chain, merged) {
  const sb = window.pvtSupabase?.getClient?.() || window.supabaseClient;
  if (!sb) return;
  try {
    let nextId = null, recipientRole = 'manager', type = 'LEADER_APPROVED';
    if (isStepPending(merged.director_status)) {
      nextId = chain.l2 || null;
      if (!nextId && reqData.employees?.department_id) {
        const { data: cfg } = await sb.from('department_approvers').select('manager_id').eq('department_id', reqData.employees.department_id).maybeSingle();
        nextId = cfg?.manager_id || null;
      }
      recipientRole = 'manager';
      type = 'LEADER_APPROVED';
    } else if (isStepPending(merged.executive_status)) {
      nextId = reqData.employees?.l3_approver_id || null;
      if (!nextId) {
        const { data: executiveSetting } = await sb.from('system_settings').select('employee_id').eq('setting_key', 'leave_executive_approver').maybeSingle();
        nextId = executiveSetting?.employee_id || null;
      }
      recipientRole = 'executive';
      type = actRole === 'leader' ? 'LEADER_APPROVED' : 'MANAGER_APPROVED';
    }
    if (!nextId) {
      console.warn('⚠️ [Next Approver] ไม่พบผู้อนุมัติขั้นถัดไป — HR/Admin จะเห็นในรายการรออนุมัติ');
      return;
    }

    const { data: nextEmp } = await sb.from('employees').select('id, full_name, line_id').eq('id', nextId).maybeSingle();
    const applicantName = reqData.employees?.full_name || 'พนักงาน';
    const deptName = reqData.employees?.departments?.department_name || '';
    const leaveTypeName = reqData.leave_types?.leave_name || 'ใบลา';

    // แจ้งในระบบ (ถ้ามี SDK LINE จะบันทึกแจ้งเตือนในระบบให้เองแล้ว)
    if (!window.PVTSDK?.line) await sb.from('notifications').insert({
      employee_id: nextId,
      title: `มีใบลารอท่านพิจารณา: ${applicantName}`,
      message: `พนักงาน: ${applicantName} (${reqData.employees?.employee_code || '-'})\nแผนก: ${deptName || '-'}\nประเภท: ${leaveTypeName}\nวันที่: ${reqData.start_date} ถึง ${reqData.end_date}\n(ผ่านการพิจารณาขั้นก่อนหน้าแล้ว)`,
      type: 'leave',
      link_url: '/pages/approver/leave-approvals.html'
    });

    if (window.PVTSDK?.line) {
      const nextLineId = nextEmp?.line_id || '';
      await window.PVTSDK.line.sendWorkflowNotification({
        type,
        recipientId: nextId,
        recipientLineId: nextLineId,
        leaveId: reqData.id,
        employeeName: applicantName,
        employeeCode: reqData.employees?.employee_code || '',
        departmentName: deptName,
        recipientRole,
        leaveType: leaveTypeName,
        startDate: reqData.start_date,
        endDate: reqData.end_date,
        totalDays: reqData.total_days,
        comment: reqData.approval_comment || 'ผ่านการพิจารณาขั้นก่อนหน้าแล้ว เห็นควรอนุมัติ',
        attachmentUrl: reqData.attachment_url || ""
      });
      if (!nextLineId) console.warn('⚠️ [LINE OA] ผู้อนุมัติขั้นถัดไปยังไม่ได้ผูก LINE');
    }
  } catch (err) {
    console.warn('⚠️ [Next Approver] แจ้งผู้อนุมัติขั้นถัดไปไม่สำเร็จ:', err);
  }
}

async function approveLeave(leaveId) {
  const reqData = allLeaveRequests.find(r => r.id === leaveId);
  if (!reqData) return;

  const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const sessionUser = savedSession ? JSON.parse(savedSession) : {};
  const currentEmpId = currentUserProfile?.employees?.id || currentUserProfile?.id || sessionUser?.employees?.id || sessionUser?.id || sessionUser?.employee_id;

  if (!canApproveStep(reqData, currentRole)) return;

  const roleTitle = currentRole === 'leader' 
    ? 'ผู้อนุมัติ ลำดับที่ 1' 
    : currentRole === 'manager' 
    ? 'ผู้อนุมัติ ลำดับที่ 2' 
    : (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner')
    ? 'ผู้อนุมัติ ลำดับสูง'
    : 'ฝ่ายบุคคล HR / Admin';

  // 🛡️ กล่องยืนยัน SweetAlert2 ก่อนทำการอนุมัติเพื่อป้องกันการกดผิดพลาดโดยไม่ตั้งใจ
  // ⚡ ข้ามได้ถ้าเปิด "ระบบอนุมัติเร็วแบบคลิกเดียว" ในหน้าต่างตั้งค่า (pvt_double_confirm = "false")
  const isQuickApprove = localStorage.getItem("pvt_double_confirm") === "false";
  const result = isQuickApprove ? { isConfirmed: true } : await Swal.fire({
    title: '<span style="font-size: 20px; font-weight: 800; color: #0f172a;">ยืนยันอนุมัติคำขอลา</span>',
    html: buildLeaveActionConfirmDialogHtml(reqData, roleTitle, 'approve'),
    icon: 'question',
    iconColor: '#10b981',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">check_circle</span> ยืนยันอนุมัติคำขอลา',
    cancelButtonText: 'ยกเลิก',
    focusCancel: true,
    allowOutsideClick: false,
    customClass: {
      popup: 'swal-refined-popup',
      confirmButton: 'swal-btn-success',
      cancelButton: 'swal-btn-cancel'
    }
  });

  if (!result.isConfirmed) return;
  if (typeof closePreviewModal === 'function') closePreviewModal();

  Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    const outcome = await performApprovalStep(reqData);
    if (!outcome.ok) {
      await Swal.fire('ไม่สามารถอนุมัติได้', outcome.reason || 'มีผู้พิจารณาใบลานี้ไปก่อนหน้าแล้ว ระบบจะแสดงสถานะล่าสุดให้', 'info');
      loadPendingLeavesHR();
      return;
    }
    const updateFields = { status: outcome.final ? 'approved' : 'pending' };
    if (outcome.balanceError) {
      console.warn('⚠️ ตัดยอดวันลาไม่สำเร็จ:', outcome.balanceError);
    }

    if (updateFields.status === 'approved' || reqData.status === 'approved') {
      // ✅ อนุมัติครบทุกลำดับ — แจ้งสั้น ๆ (เอาส่วนซิงค์ปฏิทินออกแล้ว ผู้ใช้สับสน)
      await Swal.fire({
        icon: 'success',
        title: 'อนุมัติเรียบร้อย',
        html: `ใบลาของ <strong>${reqData.employees?.full_name || 'พนักงาน'}</strong> ได้รับการอนุมัติแล้ว<br><span style="font-size:13px;color:#64748b;">ระบบแจ้งพนักงานและบันทึกให้ HR แล้ว</span>`,
        confirmButtonText: 'ตกลง',
        confirmButtonColor: 'var(--th-p-600, #0d9488)'
      });
    } else {
      await Swal.fire('อนุมัติแล้ว ส่งต่อลำดับถัดไป', outcome.nextLabel ? `ระบบส่งต่อให้ "${outcome.nextLabel}" พิจารณาแล้ว` : 'ระบบส่งต่อให้ผู้อนุมัติขั้นถัดไปพิจารณาแล้ว', 'success');
    }
    loadPendingLeavesHR();

  } catch (err) {
    console.error("💥 Approve Error:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถทำรายการอนุมัติได้', 'error');
  }
}

async function rejectLeave(leaveId) {
  const reqData = allLeaveRequests.find(r => r.id === leaveId);
  if (!reqData) return;
  if (!canApproveStep(reqData, currentRole)) return;

  const roleTitle = currentRole === 'leader' 
    ? 'ผู้อนุมัติ ลำดับที่ 1' 
    : currentRole === 'manager' 
    ? 'ผู้อนุมัติ ลำดับที่ 2' 
    : (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner')
    ? 'ผู้อนุมัติ ลำดับสูง'
    : 'ฝ่ายบุคคล HR / Admin';

  const summaryHtml = buildLeaveActionConfirmDialogHtml(reqData, roleTitle, 'reject');

  // 🛡️ กล่องยืนยัน SweetAlert2 ก่อนทำการไม่อนุมัติ เพื่อป้องกันการกดผิดพลาดโดยไม่ตั้งใจ
  const { value: reason, isConfirmed } = await Swal.fire({
    title: '<span style="font-size: 20px; font-weight: 800; color: #b91c1c;">ยืนยันไม่อนุมัติ / ปฏิเสธคำขอลา</span>',
    html: `
      ${summaryHtml}
      <div style="text-align: left; margin-top: 14px;">
        <label for="swal-reject-reason-input" style="font-size: 13px; font-weight: 700; color: #b91c1c; display: block; margin-bottom: 6px;">
          โปรดระบุเหตุผลความจำเป็นที่ไม่อนุมัติ (บังคับกรอก เพื่อแจ้งเตือนพนักงาน):
        </label>
        <textarea id="swal-reject-reason-input" class="swal2-textarea" placeholder="ระบุเหตุผล เช่น ติดภารกิจเร่งด่วนในแผนก, กำลังพลไม่เพียงพอ, ยื่นเอกสารไม่สมบูรณ์..." style="width: 100%; min-height: 80px; margin: 0; box-sizing: border-box; font-size: 13.5px; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 10px; font-family: inherit;"></textarea>
      </div>
    `,
    icon: 'warning',
    iconColor: '#ef4444',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">cancel</span> ยืนยันไม่อนุมัติคำขอ',
    cancelButtonText: 'ยกเลิก',
    focusCancel: true,
    allowOutsideClick: false,
    customClass: {
      popup: 'swal-refined-popup',
      confirmButton: 'swal-btn-danger',
      cancelButton: 'swal-btn-cancel'
    },
    preConfirm: () => {
      const textarea = document.getElementById('swal-reject-reason-input');
      const val = textarea ? textarea.value.trim() : '';
      if (!val) {
        Swal.showValidationMessage('กรุณาระบุเหตุผลในการไม่อนุมัติคำขอลาด้วยครับ เพื่อแจ้งให้พนักงานทราบ');
        return false;
      }
      return val;
    }
  });

  if (!isConfirmed || !reason) return;
  if (typeof closePreviewModal === 'function') closePreviewModal();

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  // 🔗 ใบลาที่มีขั้นอนุมัติ (ระยะ 2)
  if (reqData.__steps && reqData.__steps.length && window.PVTApproval) {
    try {
      const res = await window.PVTApproval.reject(leaveId, reason.trim(), { actorRole: currentRole });
      if (res.ok || res.reason !== 'no_steps') {
        if (res.ok) await Swal.fire('ปฏิเสธสำเร็จ', 'บันทึกสถานะไม่อนุมัติและแจ้ง HR เรียบร้อยแล้ว', 'success');
        else await Swal.fire('ไม่สามารถทำรายการได้', res.reason || 'ใบลานี้ถูกดำเนินการไปแล้ว', 'info');
        loadPendingLeavesHR();
        return;
      }
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
      return;
    }
  }

  try {
    let updateFields = {
      status: 'rejected',
      approval_comment: reason.trim(),
      updated_at: new Date().toISOString()
    };

    // ขั้นที่ไม่อนุมัติ = ขั้นที่ใบลารออยู่จริง (หัวหน้าที่เป็นผู้จัดการด้วย → ขั้นปัจจุบัน)
    let rejectRole = currentRole;
    if (currentRole === 'leader' && !isStepPending(reqData.manager_status)) rejectRole = 'manager';
    if (currentRole === 'leader') {
      updateFields.manager_status = 'rejected';
    } else if (currentRole === 'manager') {
      if (isStepPending(reqData.manager_status)) updateFields.manager_status = 'rejected';
      updateFields.director_status = 'rejected';
    } else if (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner') {
      updateFields.executive_status = 'rejected';
    } else {
      // HR / Admin: ระบุขั้นที่ค้างอยู่
      if (isStepPending(reqData.manager_status)) updateFields.manager_status = 'rejected';
      else if (isStepPending(reqData.director_status)) updateFields.director_status = 'rejected';
      else if (isStepPending(reqData.executive_status)) updateFields.executive_status = 'rejected';
    }

    // 🛡️ บันทึกเฉพาะเมื่อยังรอพิจารณาอยู่ (มีคนกดไปก่อน → แจ้งให้ทราบ)
    const { data: changed, error } = await sb
      .from('leave_requests')
      .update(updateFields)
      .eq('id', leaveId)
      .eq('status', reqData.status || 'pending')
      .select('id');

    if (error) throw error;
    if (!changed || !changed.length) {
      await Swal.fire('ใบลานี้ถูกดำเนินการไปแล้ว', 'มีผู้พิจารณาใบลานี้ไปก่อนหน้าแล้ว ระบบจะแสดงสถานะล่าสุดให้', 'info');
      loadPendingLeavesHR();
      return;
    }

    // 🧾 หลักฐาน + แจ้ง HR (ในระบบ) ทุกครั้งที่ไม่อนุมัติ ไม่ว่าขั้นไหน
    if (window.PVTLeaveAudit) {
      const step = stepInfoForRole(rejectRole);
      await window.PVTLeaveAudit.recordOutcome(reqData, 'rejected', {
        stepLevel: step.level, stepLabel: step.label, comment: reason.trim(),
        statusBefore: reqData.status || 'pending', statusAfter: 'rejected'
      });
    }

    // 🔔 บันทึกแจ้งเตือนลงฐานข้อมูล (In-app) — ถ้ามี SDK LINE จะบันทึกให้เองตอนส่ง REJECTED
    if (reqData && !window.PVTSDK?.line) {
      const notificationTitle = `ใบลาของคุณถูกปฏิเสธ`;
      const notificationMessage = `ใบลาประเภท ${reqData.leave_types?.leave_name || 'ใบลา'} วันที่ ${reqData.start_date} ไม่ได้รับการอนุมัติ\nเหตุผล: ${reason.trim()}`;
      
      await sb.from('notifications').insert({
        employee_id: reqData.employee_id,
        title: notificationTitle,
        message: notificationMessage,
        type: 'leave',
        link_url: '/pages/user/index-user.html'
      });

      // 💬 ส่งแจ้งเตือน LINE โดยอัตโนมัติผ่าน SDK ด้านล่าง (ส่ง Flex Message)
    }

    // 💬 แจ้งเตือนพนักงานผ่าน LINE OA เมื่อคำขอลาโดนปฏิเสธ
    if (window.PVTSDK?.line) {
      try {
        const reqData = allLeaveRequests.find(r => r.id === leaveId);
        if (reqData) {
          await window.PVTSDK.line.sendWorkflowNotification({
            type: 'REJECTED',
            recipientId: reqData.employee_id, // ระบุผู้รับ (พนักงาน)
            leaveId: leaveId,
            employeeName: reqData.employees?.full_name || 'พนักงาน',
            employeeCode: reqData.employees?.employee_code || '',
            recipientRole: 'employee',
            recipientLineId: reqData.employees?.line_id || '',
            leaveType: reqData.leave_types?.leave_name || 'ใบลา',
            startDate: reqData.start_date,
            endDate: reqData.end_date,
            totalDays: reqData.total_days,
            comment: reason.trim(),
            attachmentUrl: reqData.attachment_url || ""
          });
        }
      } catch (lineErr) {
        console.warn("⚠️ [LINE OA Trigger] Rejection notice error:", lineErr);
      }
    }

    await Swal.fire('ปฏิเสธสำเร็จ', 'บันทึกสถานะไม่อนุมัติเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR();

  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function forceCancelLeave(leaveId) {
  const { value: reason } = await Swal.fire({
    title: 'ยืนยันการยกเลิกใบลาย้อนหลัง?',
    text: 'การยกเลิกจะทำการ คืนจำนวนวันลา กลับเข้าสู่ระบบของพนักงาน',
    icon: 'warning',
    input: 'textarea',
    inputPlaceholder: 'ระบุเหตุผลการยกเลิกใบลา...',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: '✖️ ยืนยันยกเลิกใบลา',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => {
      if (!value) return 'กรุณาระบุเหตุผลในการยกเลิกใบลา!';
    }
  });

  if (!reason) return;
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    Swal.fire({ title: 'กำลังดำเนินการ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    const { data: reqData } = await sb
      .from('leave_requests')
      .select('*, leave_types!leave_type_id(leave_code, leave_name)')
      .eq('id', leaveId)
      .single();

    if (!reqData) throw new Error('ไม่พบข้อมูลใบลา');
    if (String(reqData.status).toLowerCase() === 'cancelled') throw new Error('ใบลานี้ถูกยกเลิกไปแล้ว');
    // คำนวณจากข้อมูลเดิมก่อน (กรณีด้านล่างต้องย้ายวันที่เพื่อเลี่ยง trigger ซ้อนทับ)
    const wasApproved = reqData.status === 'approved';
    const currentYear = (typeof window.getLeaveChargeYear === 'function') ? window.getLeaveChargeYear(reqData) : getADYear(reqData.start_date);
    const daysToReturn = wasApproved ? await getEffectiveLeaveDays(reqData) : 0;

    // บันทึกสถานะ "ก่อน" คืนวันลา และเฉพาะเมื่อสถานะยังเหมือนเดิม (กันกดซ้ำ/สองคนกดพร้อมกัน → คืนวันลาซ้ำ)
    let { data: changedRows, error } = await sb
      .from('leave_requests')
      .update({ 
        status: 'cancelled',
        cancel_reason: reason.trim(),
        approval_comment: `[ยกเลิกโดย HR/ผู้ดูแล] ${reason.trim()}`
      })
      .eq('id', leaveId)
      .eq('status', reqData.status)
      .select('id');

    if (error && (error.code === 'P0001' || (error.message && (error.message.includes('ช่วงวันที่ดังกล่าว') || error.message.includes('ซ้อนทับ'))))) {
      await sb.from('leave_requests').update({ start_date: '2099-12-31', end_date: '2099-12-31' }).eq('id', leaveId).eq('status', reqData.status);
      const retry = await sb.from('leave_requests').update({
        status: 'cancelled',
        cancel_reason: reason.trim(),
        approval_comment: `[ยกเลิกโดย HR/ผู้ดูแล] ${reason.trim()}`
      }).eq('id', leaveId).eq('status', reqData.status).select('id');
      error = retry.error;
      changedRows = retry.data;
    }

    if (error) throw error;
    if (!changedRows || !changedRows.length) throw new Error('สถานะใบลาเปลี่ยนไปแล้ว (อาจมีผู้ดำเนินการไปก่อน) กรุณารีเฟรชแล้วลองใหม่');

    if (wasApproved && daysToReturn > 0 && window.PVTSDK?.user?.updateLeaveBalance) {
      const lCode = reqData.leave_types?.leave_code || null;
      await window.PVTSDK.user.updateLeaveBalance(reqData.employee_id, reqData.leave_type_id, lCode, currentYear, -daysToReturn);
    }

    if (window.PVTApproval) await window.PVTApproval.closeOpenSteps(leaveId, 'cancelled', `ยกเลิกโดย HR: ${reason.trim()}`);
    if (window.PVTLeaveAudit) {
      await window.PVTLeaveAudit.recordOutcome(reqData, 'cancelled', {
        stepLevel: 'HR', stepLabel: 'ฝ่ายบุคคล (ยกเลิกโดย HR/ผู้ดูแล)', comment: reason.trim(),
        statusBefore: reqData.status, statusAfter: 'cancelled'
      });
    }

    await Swal.fire('สำเร็จ!', 'ทำการยกเลิกใบลาและคืนวันลาเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR();
  } catch (err) {
    console.error('Error cancelling leave:', err);
    Swal.fire('เกิดข้อผิดพลาด!', err.message || 'ไม่สามารถยกเลิกใบลาได้', 'error');
  }
}

async function approveCancellation(leaveId) {
  if (!canDecideCancellationRequests()) {
    await Swal.fire({
      icon: 'warning',
      title: 'ไม่มีสิทธิ์อนุมัติคำขอยกเลิก',
      text: 'คำขอยกเลิกหลังผ่านการอนุมัติ ให้ HR/Admin เป็นผู้ตรวจสอบและตัดสินเท่านั้น',
      confirmButtonColor: 'var(--th-p-700, #0f766e)'
    });
    return;
  }

  const reqData = allLeaveRequests.find(r => r.id === leaveId);
  const empName = reqData?.employees?.full_name || reqData?.employees?.name || 'พนักงาน';
  const leaveName = reqData?.leave_types?.leave_name || 'ใบลา';

  const result = await Swal.fire({
    title: '<span style="font-size: 20px; font-weight: 800; color: #0f172a;">ยืนยันอนุมัติการยกเลิกใบลา</span>',
    html: `
      <div style="text-align: left; font-size: 13.5px; color: #334155; margin-top: 8px;">
        <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: #166534; font-size: 14px; margin-bottom: 4px;">
            ${escapeHtml(empName)} - ${escapeHtml(leaveName)}
          </div>
          <div style="font-size: 12.5px; color: #64748b;">
            ช่วงวันที่: ${reqData ? formatThaiDate(reqData.start_date) : '-'} - ${reqData ? formatThaiDate(reqData.end_date) : '-'}
          </div>
          ${reqData?.cancel_reason ? `
            <div style="margin-top: 8px; font-size: 12px; color: #991b1b; background: #fef2f2; padding: 6px 10px; border-radius: 6px; border: 1px solid #fecaca;">
              <strong>เหตุผลขอยกเลิก:</strong> ${escapeHtml(reqData.cancel_reason)}
            </div>
          ` : ''}
        </div>

        <div style="font-size: 13px; color: #92400e; background: #fffbeb; border-radius: 8px; padding: 10px 12px; border: 1px solid #fde68a; margin-bottom: 10px;">
          <strong>ขั้นตอน HR:</strong> กรุณาตรวจสอบข้อมูลลงเวลาหรือหลักฐานการมาทำงานก่อนอนุมัติยกเลิก
        </div>

        <label style="display:flex; align-items:flex-start; gap:8px; padding:10px 12px; border:1px solid #cbd5e1; border-radius:8px; background:#f8fafc; cursor:pointer;">
          <input type="checkbox" id="hr-cancel-attendance-confirm" style="margin-top:3px; width:17px; height:17px;">
          <span style="font-size:13px; color:#334155;">
            ฉันตรวจสอบแล้วว่า <strong>พนักงานมาทำงานจริงในวัน/ช่วงวันที่ที่ขอยกเลิก</strong>
          </span>
        </label>
      </div>
    `,
    icon: 'warning',
    iconColor: '#10b981',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: '✔️ อนุมัติการยกเลิก',
    cancelButtonText: 'ยังไม่อนุมัติ',
    focusCancel: true,
    allowOutsideClick: false,
    customClass: {
      popup: 'swal-refined-popup',
      confirmButton: 'swal-btn-success',
      cancelButton: 'swal-btn-cancel'
    },
    preConfirm: () => {
      const checked = document.getElementById('hr-cancel-attendance-confirm')?.checked;
      if (!checked) {
        Swal.showValidationMessage('กรุณายืนยันว่าตรวจสอบแล้วว่าพนักงานมาทำงานจริง');
        return false;
      }
      return true;
    }
  });

  if (!result.isConfirmed) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  Swal.fire({
    title: 'กำลังอนุมัติการยกเลิก...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { data: freshReq, error: reqErr } = await sb
      .from('leave_requests')
      .select('*, leave_types!leave_type_id(leave_code, leave_name)')
      .eq('id', leaveId)
      .single();

    if (reqErr || !freshReq) throw new Error("ไม่พบข้อมูลใบลา");
    if (!isCancelRequestStatus(freshReq.status)) {
      throw new Error("รายการนี้ไม่ได้อยู่ในสถานะรอตรวจสอบคำขอยกเลิก");
    }

    const wasFinalApproved = Boolean(freshReq.approved_at || freshReq.approved_by);
    const daysToReturn = await getEffectiveLeaveDays(freshReq);
    const currentYear = (typeof window.getLeaveChargeYear === 'function') ? window.getLeaveChargeYear(freshReq) : getADYear(freshReq.start_date);


    const approvalComment = wasFinalApproved
      ? '[HR อนุมัติยกเลิก] ตรวจสอบแล้วว่าพนักงานมาทำงานจริง และคืนโควตาวันลาแล้ว'
      : '[HR อนุมัติยกเลิก] ตรวจสอบแล้วว่าพนักงานมาทำงานจริง (ใบลายังไม่เคยหักโควตา)';

    // บันทึกสถานะ "ก่อน" คืนวันลา และเฉพาะเมื่อยังรอตรวจสอบอยู่ (กัน HR สองคนกดพร้อมกัน → คืนวันลาซ้ำ)
    let { data: changedRows, error: updateErr } = await sb
      .from('leave_requests')
      .update({
        status: 'cancelled',
        cancel_status: 'approved_by_hr',
        approval_comment: approvalComment
      })
      .eq('id', leaveId)
      .eq('status', freshReq.status)
      .select('id');

    if (updateErr && (updateErr.code === 'P0001' || (updateErr.message && (updateErr.message.includes('ช่วงวันที่ดังกล่าว') || updateErr.message.includes('ซ้อนทับ'))))) {
      await sb.from('leave_requests').update({ start_date: '2099-12-31', end_date: '2099-12-31' }).eq('id', leaveId).eq('status', freshReq.status);
      const retry = await sb.from('leave_requests').update({
        status: 'cancelled',
        cancel_status: 'approved_by_hr',
        approval_comment: approvalComment
      }).eq('id', leaveId).eq('status', freshReq.status).select('id');
      updateErr = retry.error;
      changedRows = retry.data;
    }

    if (updateErr) throw updateErr;
    if (!changedRows || !changedRows.length) throw new Error('คำขอยกเลิกนี้ถูกดำเนินการไปแล้ว กรุณารีเฟรชแล้วลองใหม่');

    // ปิดขั้นอนุมัติที่ยังค้าง/พักไว้ (ใบลาที่ยังไม่จบขั้นตอน)
    if (window.PVTApproval) {
      try { await window.PVTApproval.closeOpenSteps(leaveId, 'cancelled', 'HR อนุมัติการยกเลิก'); } catch (e) {}
    }

    if (wasFinalApproved && daysToReturn > 0 && window.PVTSDK?.user?.updateLeaveBalance) {
      const lCode = freshReq.leave_types?.leave_code || null;
      await window.PVTSDK.user.updateLeaveBalance(freshReq.employee_id, freshReq.leave_type_id, lCode, currentYear, -daysToReturn);
    }

    if (window.PVTLeaveAudit) {
      // วันที่ลาเดิมเก็บไว้ในหลักฐาน (กรณีระบบต้องย้ายวันที่เพื่อเลี่ยงการซ้อนทับ)
      await window.PVTLeaveAudit.recordOutcome(
        Object.assign({}, allLeaveRequests.find(r => String(r.id) === String(leaveId)) || {}, freshReq),
        'cancel_approved',
        { stepLevel: 'HR', stepLabel: 'ฝ่ายบุคคล (HR)', comment: approvalComment, statusBefore: freshReq.status, statusAfter: 'cancelled' }
      );
    }

    const successText = wasFinalApproved
      ? `อนุมัติการยกเลิกเรียบร้อยแล้ว และคืนโควตาวันลา ${daysToReturn} วัน ให้พนักงานแล้ว`
      : 'อนุมัติการยกเลิกเรียบร้อยแล้ว รายการนี้ยังไม่เคยหักโควตา จึงไม่มีการคืนโควตาซ้ำ';

    await Swal.fire('ยกเลิกใบลาสำเร็จ!', successText, 'success');
    loadPendingLeavesHR();

  } catch (err) {
    console.error("💥 Approve Cancellation Error:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถยกเลิกได้', 'error');
  }
}

async function rejectCancellation(leaveId) {
  if (!canDecideCancellationRequests()) {
    await Swal.fire({
      icon: 'warning',
      title: 'ไม่มีสิทธิ์ปฏิเสธคำขอยกเลิก',
      text: 'คำขอยกเลิกหลังผ่านการอนุมัติ ให้ HR/Admin เป็นผู้ตรวจสอบและตัดสินเท่านั้น',
      confirmButtonColor: 'var(--th-p-700, #0f766e)'
    });
    return;
  }

  const reqData = allLeaveRequests.find(r => r.id === leaveId);
  const empName = reqData?.employees?.full_name || reqData?.employees?.name || 'พนักงาน';
  const leaveName = reqData?.leave_types?.leave_name || 'ใบลา';

  const { value: reason, isConfirmed } = await Swal.fire({
    title: '<span style="font-size: 20px; font-weight: 800; color: #b91c1c;">ปฏิเสธคำร้องขอยกเลิกใบลา</span>',
    html: `
      <div style="text-align: left; font-size: 13.5px; color: #334155; margin-top: 8px;">
        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 12px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: #991b1b; font-size: 14px; margin-bottom: 4px;">
            ${escapeHtml(empName)} - ${escapeHtml(leaveName)}
          </div>
          <div style="font-size: 12.5px; color: #64748b;">
            ช่วงวันที่: ${reqData ? formatThaiDate(reqData.start_date) : '-'} - ${reqData ? formatThaiDate(reqData.end_date) : '-'}
          </div>
        </div>
        <label for="swal-reject-cancel-input" style="font-size: 13px; font-weight: 700; color: #b91c1c; display: block; margin-bottom: 6px;">
          โปรดระบุเหตุผลที่ไม่อนุมัติให้ยกเลิก (บังคับกรอก):
        </label>
        <textarea id="swal-reject-cancel-input" class="swal2-textarea" placeholder="เช่น ตรวจสอบแล้วไม่พบการมาทำงานในวันดังกล่าว..." style="width: 100%; min-height: 75px; margin: 0; box-sizing: border-box; font-size: 13.5px; border-radius: 8px; border: 1.5px solid #cbd5e1; padding: 10px; font-family: inherit;"></textarea>
      </div>
    `,
    icon: 'warning',
    iconColor: '#ef4444',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonColor: '#ef4444',
    confirmButtonText: '✖️ ยืนยันปฏิเสธคำร้อง',
    cancelButtonText: 'ยกเลิก',
    focusCancel: true,
    allowOutsideClick: false,
    customClass: {
      popup: 'swal-refined-popup',
      confirmButton: 'swal-btn-danger',
      cancelButton: 'swal-btn-cancel'
    },
    preConfirm: () => {
      const el = document.getElementById('swal-reject-cancel-input');
      const val = el ? el.value.trim() : '';
      if (!val) {
        Swal.showValidationMessage('กรุณาระบุเหตุผลที่ไม่อนุมัติให้ยกเลิกใบลาด้วยครับ');
        return false;
      }
      return val;
    }
  });

  if (!isConfirmed || !reason) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { data: freshReq, error: reqErr } = await sb
      .from('leave_requests')
      .select('id, status, cancel_status, approved_by, approved_at')
      .eq('id', leaveId)
      .single();

    if (reqErr || !freshReq) throw new Error('ไม่พบข้อมูลใบลา');
    if (!isCancelRequestStatus(freshReq.status)) {
      throw new Error('รายการนี้ไม่ได้อยู่ในสถานะรอตรวจสอบคำขอยกเลิก');
    }

    let restoreStatus = null;
    const cancelState = String(freshReq.cancel_status || '');
    const originalMatch = cancelState.match(/^pending_hr:(pending|approved)$/i);
    if (originalMatch) {
      restoreStatus = originalMatch[1].toLowerCase();
    }

    if (!restoreStatus) {
      restoreStatus = (freshReq.approved_at || freshReq.approved_by) ? 'approved' : 'pending';
    }

    const { error } = await sb
      .from('leave_requests')
      .update({
        status: restoreStatus,
        cancel_status: `rejected_by_hr:${restoreStatus}`,
        approval_comment: `[HR ไม่อนุมัติให้ยกเลิก] ${reason.trim()}`
      })
      .eq('id', leaveId);

    if (error) throw error;

    // ใบลาที่ยังไม่จบขั้นตอน: คืนขั้นอนุมัติที่พักไว้ แล้วแจ้งผู้อนุมัติลำดับถัดไปให้พิจารณาต่อ
    let resumedStep = null;
    if (restoreStatus === 'pending' && window.PVTApproval?.resumeHeldSteps) {
      try { resumedStep = await window.PVTApproval.resumeHeldSteps(leaveId); } catch (e) { console.warn('⚠️ คืนขั้นอนุมัติไม่สำเร็จ:', e); }
    }

    if (window.PVTLeaveAudit) {
      await window.PVTLeaveAudit.recordOutcome(
        Object.assign({}, allLeaveRequests.find(r => String(r.id) === String(leaveId)) || {}, freshReq),
        'cancel_rejected',
        { stepLevel: 'HR', stepLabel: 'ฝ่ายบุคคล (HR)', comment: reason.trim(), statusBefore: freshReq.status, statusAfter: restoreStatus }
      );
    }

    const restoreLabel = restoreStatus === 'approved'
      ? 'ใบลายังคงสถานะอนุมัติเดิม'
      : (resumedStep ? `ใบลาถูกส่งกลับไปให้ "${(window.PVTApproval?.stepLabelOf ? window.PVTApproval.stepLabelOf(resumedStep) : resumedStep.step_label) || 'ผู้อนุมัติลำดับถัดไป'}" พิจารณาต่อแล้ว` : 'ใบลาถูกส่งกลับเข้าสู่ขั้นตอนอนุมัติเดิมต่อไป');

    await Swal.fire('ปฏิเสธคำร้องแล้ว', restoreLabel, 'success');
    loadPendingLeavesHR();

  } catch (err) {
    console.error('💥 Reject Cancellation Error:', err);
    Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถปฏิเสธคำร้องได้', 'error');
  }
}

/* ==========================================================================
   🖨️ 7. PRINT LEAVE A4 DOCUMENT
   ========================================================================== */

/* ==========================================================================
   🖨️ พิมพ์ใบลา (A4) — แบบฟอร์มทางการ บริษัท พี.วี.ที. แอนด์ ที.พลาส จำกัด
   - หัวกระดาษบริษัท + เลขที่เอกสาร · ตัวเนื้อความแบบหนังสือขออนุญาตลา
   - ประเภทการลาแบบช่องเลือก (ดึงจากตาราง leave_types)
   - ตารางผลการพิจารณาตามขั้นอนุมัติจริง (leave_approval_steps) / แบบเดิม (manager/director/executive_status)
   - ช่องสำหรับฝ่ายทรัพยากรบุคคล · ลายน้ำเมื่อยังไม่อนุมัติ / ไม่อนุมัติ / ยกเลิก
   - สีตามประเภทพนักงาน (employees.employment_type): สีฟ้า = รายเดือน · สีชมพู = รายวัน
   - โลโก้บริษัท: /assets/img/company-logo.png
   - @page margin 0 → เบราว์เซอร์ไม่พิมพ์ URL/วันที่ที่หัว-ท้ายกระดาษ
   ========================================================================== */
const PVT_COMPANY_NAME_TH = 'บริษัท พี.วี.ที. แอนด์ ที.พลาส จำกัด';

async function printLeaveA4(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  // ✅ แปลงวันเวลาให้ถูกเขตเวลา (formatThaiDate เดิมตัด "Z" ทิ้ง ทำให้เวลาคลาด 7 ชม.)
  const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const toDate = (v) => {
    if (!v) return null;
    const s = String(v);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  const thLong = (v) => { const d = toDate(v); return d ? `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}` : '-'; };
  const thShort = (v) => { const d = toDate(v); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}` : ''; };
  const thTime = (v) => { const d = toDate(v); return d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} น.` : ''; };
  const e = (v) => escapeHtml(v == null ? '' : String(v));
  const box = (on) => `<span class="cb${on ? ' cb--on' : ''}">${on ? '✓' : ''}</span>`;

  try {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ title: 'กำลังเตรียมเอกสารใบลา...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    }

    const { data: req, error } = await sb
      .from('leave_requests')
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, nickname, title, employment_type, departments!department_id(department_name), positions(position_name) ),
        leave_types ( leave_name, leave_code )
      `)
      .eq('id', leaveId)
      .single();
    if (error || !req) throw new Error("ไม่พบข้อมูลเอกสารใบลา");

    // ประเภทการลาทั้งหมดของบริษัท (สำหรับช่องเลือก) + ขั้นอนุมัติจริง
    let leaveTypes = [];
    try {
      const { data } = await sb.from('leave_types').select('id, leave_name, status').order('leave_code');
      leaveTypes = (data || []).filter((t) => !t.status || String(t.status).toLowerCase() === 'active');
    } catch (err) { /* ใช้เฉพาะประเภทของใบนี้ */ }
    let steps = [];
    try {
      const { data, error: stErr } = await sb.from('leave_approval_steps')
        .select('step_no, step_label, approver_names, hr_any, status, acted_by_name, acted_at, comment')
        .eq('leave_id', leaveId).order('step_no');
      if (!stErr && data) steps = data.filter((s) => s.status !== 'skipped');
    } catch (err) { /* ยังไม่มีตาราง → ใช้แบบเดิม */ }

    const emp = req.employees || {};
    const printDays = req.actual_days || req.days_requested || req.total_days || 0;
    const duration = window.PVTSDK?.formatLeaveDurationFriendly ? window.PVTSDK.formatLeaveDurationFriendly(printDays, req.leave_hours || 0) : `${printDays} วัน`;
    const leaveName = req.leave_types?.leave_name || 'ไม่ระบุประเภทการลา';
    const fullName = `${emp.title && !String(emp.full_name || '').startsWith(emp.title) ? emp.title : ''}${emp.full_name || '-'}`;
    const attachUrl = getAttachmentUrl(req);
    const docNo = `LV-${String(req.id).substring(0, 8).toUpperCase()}`;
    // 🎨 สีตามประเภทพนักงาน: รายวัน = ชมพู · รายเดือน (ค่าเริ่มต้น) = ฟ้า
    const isDaily = /daily|รายวัน/i.test(String(emp.employment_type || ''));
    const empTypeText = isDaily ? 'พนักงานรายวัน' : 'พนักงานรายเดือน';
    const tone = isDaily
      ? { main: '#be185d', soft: '#fce7f3', mid: '#f9a8d4' }
      : { main: '#0369a1', soft: '#e0f2fe', mid: '#7dd3fc' };
    // โลโก้: แปลงเป็น data URL ก่อนเขียนลงหน้าต่างพิมพ์ (หน้าต่าง about:blank โหลดรูปไม่ทันก่อนสั่งพิมพ์)
    let logoUrl = `${window.location.origin}/assets/img/company-logo.png`;
    try {
      const res = await fetch('/assets/img/company-logo.png', { cache: 'force-cache' });
      if (res.ok) {
        const blob = await res.blob();
        logoUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
      }
    } catch (err) { /* ใช้ URL ตรง */ }
    const st = String(req.status || 'pending').toLowerCase();
    const statusText = st === 'approved' ? 'อนุมัติ' : st === 'rejected' ? 'ไม่อนุมัติ'
      : (st === 'cancelled' || st === 'canceled') ? 'ยกเลิกแล้ว' : st === 'cancel_requested' ? 'ขอยกเลิก (รอ HR ตรวจสอบ)' : 'รอพิจารณา';
    const watermark = st === 'approved' ? '' : st === 'rejected' ? 'ไม่อนุมัติ' : (st === 'cancelled' || st === 'canceled') ? 'ยกเลิก' : st === 'cancel_requested' ? 'ขอยกเลิก' : 'รอพิจารณา';

    // ช่องเลือกประเภทการลา
    const names = leaveTypes.map((t) => t.leave_name).filter(Boolean);
    if (!names.includes(leaveName)) names.push(leaveName);
    const typeChecks = names.slice(0, 10).map((n) => `<span class="opt">${box(n === leaveName)} ${e(n)}</span>`).join('');

    // ตารางผลการพิจารณา
    const isAutoText = (c) => /ผ่านอัตโนมัติ|ผู้อนุมัติคนเดียวกับขั้นก่อนหน้า/.test(String(c || ''));
    let rows = [];
    if (steps.length) {
      rows = steps.map((s, i) => ({
        no: i + 1,
        role: window.PVTApproval?.stepTitle ? window.PVTApproval.stepTitle(s.step_label, i + 1) : `ผู้อนุมัติ ลำดับที่ ${i + 1}`,
        who: s.acted_by_name || (s.hr_any ? 'ฝ่ายทรัพยากรบุคคล' : (s.approver_names || []).join(' / ')),
        result: s.status === 'approved' ? 'approved' : (s.status === 'rejected' || s.status === 'expired') ? 'rejected' : s.status === 'cancelled' ? 'cancelled' : 'pending',
        expired: s.status === 'expired',
        at: s.acted_at,
        comment: isAutoText(s.comment) ? '' : (s.comment || '')
      }));
    } else {
      const legacy = [
        ['manager_status', 'ผู้อนุมัติ ลำดับที่ 1'],
        ['director_status', 'ผู้อนุมัติ ลำดับที่ 2'],
        ['executive_status', 'ผู้อนุมัติ ลำดับสูง']
      ];
      rows = legacy.map(([f, label], i) => {
        const v = String(req[f] || 'pending').toLowerCase();
        return { no: i + 1, role: label, who: '', result: v === 'approved' ? 'approved' : v === 'rejected' ? 'rejected' : 'pending', at: v === 'approved' && st === 'approved' && i === legacy.length - 1 ? req.approved_at : null, comment: '' };
      });
      if (req.approval_comment) rows[rows.length - 1].comment = req.approval_comment;
    }
    const approvalRows = rows.map((r) => `
      <tr>
        <td class="c">${r.no}</td>
        <td><strong>${e(r.role)}</strong>${r.who ? `<div class="sub">${e(r.who)}</div>` : ''}</td>
        <td class="res">
          <div>${box(r.result === 'approved')} อนุมัติ</div>
          <div>${box(r.result === 'rejected')} ไม่อนุมัติ${r.expired ? ' <span class="sub">(พ้นกำหนด 48 ชม.)</span>' : ''}</div>
        </td>
        <td class="sig">${(r.result === 'approved' || r.result === 'rejected') && !r.expired
          ? `<div class="esig">ลงนามอิเล็กทรอนิกส์</div><div class="sub">${e(r.who || r.role)}</div>`
          : r.result === 'cancelled' ? '<div class="sub">ยกเลิกคำขอ</div>' : '<div class="dots"></div>'}</td>
        <td class="c">${r.at ? `${thShort(r.at)}<div class="sub">${thTime(r.at)}</div>` : (r.result === 'pending' ? '' : '-')}</td>
      </tr>
      ${r.comment ? `<tr class="note"><td></td><td colspan="4">ความเห็น: ${e(r.comment)}</td></tr>` : ''}`).join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (typeof Swal !== 'undefined') Swal.close();
      alert("กรุณาอนุญาตให้เปิด Pop-up ในเบราว์เซอร์เพื่อพิมพ์เอกสาร");
      return;
    }
    const docTitle = `ใบลา_${emp.employee_code || ''}_${emp.full_name || 'พนักงาน'}`;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>${e(docTitle)}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 0; }
  :root { --tone: ${tone.main}; --tone-soft: ${tone.soft}; --tone-mid: ${tone.mid}; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #e5e7eb; }
  body { font-family: 'Sarabun', 'TH Sarabun New', Tahoma, sans-serif; color: #111827; font-size: 13.5px; line-height: 1.55; }
  .page { width: 210mm; height: 297mm; margin: 0 auto; padding: 14mm 17mm 12mm; background: #fff; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  @media screen { .page { margin: 16px auto; box-shadow: 0 4px 24px rgba(0,0,0,.15); } }
  @media print { html, body { background: #fff; } .page { margin: 0; box-shadow: none; } }

  .wm { position: absolute; top: 46%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg); font-size: 96px; font-weight: 700; color: rgba(17,24,39,.06); white-space: nowrap; pointer-events: none; letter-spacing: 6px; }

  .band { position: absolute; top: 0; left: 0; right: 0; height: 5mm; background: var(--tone); }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 8px; border-bottom: 2.5px solid var(--tone); }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 17mm; width: auto; display: block; }
  .co-name { font-size: 21px; font-weight: 700; letter-spacing: .2px; line-height: 1.25; }
  .co-sub { font-size: 12.5px; color: #374151; }
  .doc-box { border: 1px solid #111827; font-size: 12px; min-width: 52mm; }
  .doc-box div { display: flex; justify-content: space-between; gap: 10px; padding: 3px 8px; }
  .doc-box div + div { border-top: 1px solid #9ca3af; }
  .doc-box b { font-weight: 600; }
  .rule2 { border-top: 0.6px solid var(--tone); margin-top: 2px; }
  .doc-box .type { background: var(--tone-soft); color: var(--tone); font-weight: 700; justify-content: center; letter-spacing: .3px; }

  .title { text-align: center; margin: 16px 0 6px; }
  .title h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: .5px; color: var(--tone); }
  .title p { margin: 0; font-size: 11.5px; letter-spacing: 2.5px; color: #374151; }

  .dateline { text-align: right; margin: 10px 0 4px; }
  .salute { margin: 4px 0 8px; }
  .salute b { font-weight: 600; }
  .body p { margin: 0 0 7px; text-indent: 12mm; text-align: justify; }
  .fill { font-weight: 600; border-bottom: 1px dotted #111827; padding: 0 6px; }
  .opts { display: flex; flex-wrap: wrap; gap: 4px 20px; margin: 4px 0 8px 12mm; }
  .opt { white-space: nowrap; }
  .cb { display: inline-flex; width: 13px; height: 13px; border: 1.2px solid #111827; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; line-height: 1; vertical-align: -2px; margin-right: 3px; }
  .grid2 { display: grid; grid-template-columns: auto 1fr auto 1fr; gap: 4px 10px; margin: 0 0 8px 12mm; align-items: baseline; }
  .reason { margin: 0 0 8px 12mm; padding: 6px 10px; border: 1px solid var(--tone-mid); min-height: 16mm; white-space: pre-wrap; word-break: break-word; }

  .sign-row { display: flex; justify-content: flex-end; margin: 10px 0 4px; }
  .sign { width: 78mm; text-align: center; }
  .sign .line { border-bottom: 1px dotted #111827; height: 22px; margin: 0 6mm; display: flex; align-items: flex-end; justify-content: center; font-size: 11.5px; color: #374151; }
  .sign .who { margin-top: 4px; }
  .sign .sub { font-size: 11.5px; color: #374151; }

  h2 { font-size: 14px; font-weight: 700; margin: 12px 0 6px; padding: 3px 8px; background: var(--tone-soft); border-left: 4px solid var(--tone); color: #111827; }
  table.ap { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.ap th, table.ap td { border: 1px solid #111827; padding: 5px 7px; vertical-align: middle; }
  table.ap th { background: var(--tone-soft); font-weight: 600; font-size: 12px; }
  table.ap td.c { text-align: center; }
  table.ap td.res { white-space: nowrap; font-size: 12px; }
  table.ap td.sig { text-align: center; width: 40mm; }
  table.ap .esig { font-size: 11.5px; font-weight: 600; letter-spacing: .3px; }
  table.ap .dots { border-bottom: 1px dotted #111827; height: 18px; margin: 0 4px; }
  table.ap tr.note td { font-size: 12px; color: #374151; border-top: 0; padding-top: 2px; }
  .sub { font-size: 11px; color: #4b5563; font-weight: 400; }

  .hr-box { border: 1px solid #111827; padding: 8px 10px; display: grid; grid-template-columns: 1fr 70mm; gap: 8px 16px; font-size: 12.5px; }
  .hr-box .checks div { margin-bottom: 3px; }
  .hr-box .sign { width: auto; }

  .foot { margin-top: auto; padding-top: 6px; border-top: 1px solid var(--tone-mid); display: flex; justify-content: space-between; gap: 12px; font-size: 10.5px; color: #4b5563; }
</style>
</head>
<body>
<div class="page">
  <div class="band"></div>
  ${watermark ? `<div class="wm">${e(watermark)}</div>` : ''}

  <div class="letterhead">
    <div class="brand">
      <img src="${e(logoUrl)}" alt="P.V.T.&amp;T. PLAS CO.,LTD." onerror="this.remove()">
      <div>
        <div class="co-name">${e(PVT_COMPANY_NAME_TH)}</div>
        <div class="co-sub">ฝ่ายทรัพยากรบุคคล</div>
      </div>
    </div>
    <div class="doc-box">
      <div class="type">${e(empTypeText)}</div>
      <div><span>เลขที่เอกสาร</span><b>${e(docNo)}</b></div>
      <div><span>วันที่ยื่น</span><b>${e(thShort(req.created_at) || '-')}</b></div>
      <div><span>สถานะ</span><b>${e(statusText)}</b></div>
    </div>
  </div>
  <div class="rule2"></div>

  <div class="title">
    <h1>ใบขออนุญาตลาหยุดงาน</h1>
    <p>LEAVE APPLICATION FORM</p>
  </div>

  <div class="dateline">เขียนวันที่ <span class="fill">${e(thLong(req.created_at))}</span></div>
  <div class="salute"><b>เรื่อง</b>&nbsp; ขออนุญาต${e(/^ลา/.test(leaveName) ? leaveName : `ลา${leaveName}`)}</div>
  <div class="salute"><b>เรียน</b>&nbsp; ผู้บังคับบัญชา</div>

  <div class="body">
    <p>ข้าพเจ้า <span class="fill">${e(fullName)}</span> รหัสพนักงาน <span class="fill">${e(emp.employee_code || '-')}</span>
      ตำแหน่ง <span class="fill">${e(emp.positions?.position_name || '-')}</span>
      แผนก <span class="fill">${e(emp.departments?.department_name || '-')}</span> มีความประสงค์ขออนุญาตลา ดังนี้</p>
  </div>
  <div class="opts">${typeChecks}</div>
  <div class="grid2">
    <span>ตั้งแต่วันที่</span><span class="fill">${e(thLong(req.start_date))}</span>
    <span>ถึงวันที่</span><span class="fill">${e(thLong(req.end_date || req.start_date))}</span>
    <span>รวมเป็นเวลา</span><span class="fill">${e(duration)}</span>
    <span>เอกสารแนบ</span><span>${box(!!attachUrl)} มี &nbsp;&nbsp; ${box(!attachUrl)} ไม่มี</span>
    <span>ประเภทพนักงาน</span><span>${box(!isDaily)} รายเดือน &nbsp;&nbsp; ${box(isDaily)} รายวัน</span>
  </div>
  <div style="margin-left:12mm">เนื่องจาก</div>
  <div class="reason">${e(req.reason || 'ไม่ได้ระบุเหตุผล')}</div>

  <div class="sign-row">
    <div class="sign">
      <div class="line">ยื่นผ่านระบบอิเล็กทรอนิกส์</div>
      <div class="who">( ${e(fullName)} )</div>
      <div class="sub">ผู้ขอลา · ${e(thShort(req.created_at))} ${e(thTime(req.created_at))}</div>
    </div>
  </div>

  <h2>ผลการพิจารณาของผู้บังคับบัญชา</h2>
  <table class="ap">
    <thead><tr><th style="width:10mm">ลำดับ</th><th>ผู้พิจารณา</th><th style="width:30mm">ผลการพิจารณา</th><th>ลงชื่อ</th><th style="width:24mm">วันที่</th></tr></thead>
    <tbody>${approvalRows}</tbody>
  </table>

  <h2>สำหรับฝ่ายทรัพยากรบุคคล</h2>
  <div class="hr-box">
    <div class="checks">
      <div>${box(false)} ตรวจสอบสิทธิ์และวันลาคงเหลือแล้ว</div>
      <div>${box(false)} ตรวจสอบเอกสารประกอบแล้ว</div>
      <div>${box(false)} บันทึกข้อมูลเพื่อคำนวณค่าจ้างแล้ว</div>
    </div>
    <div class="sign">
      <div class="line"></div>
      <div class="who">( ........................................................ )</div>
      <div class="sub">เจ้าหน้าที่ฝ่ายทรัพยากรบุคคล &nbsp; วันที่ ......../......../........</div>
    </div>
  </div>

  <div class="foot">
    <span>เอกสารนี้ออกจากระบบ PVT Workforce Hub · อ้างอิง ${e(req.id)}</span>
    <span>พิมพ์เมื่อ ${e(thShort(new Date().toISOString()))} ${e(thTime(new Date().toISOString()))}</span>
  </div>
</div>
<script>
  window.onload = function () {
    try { if (window.opener && window.opener.Swal) window.opener.Swal.close(); } catch (e) {}
    var go = function () { setTimeout(function () { window.print(); }, 300); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
  };
<\/script>
</body>
</html>`);

    printWindow.document.close();
    if (typeof Swal !== 'undefined') Swal.close();

  } catch (err) {
    console.error("💥 Print Error:", err);
    if (typeof Swal !== 'undefined') {
      Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถสร้างเอกสารสำหรับพิมพ์ได้', 'error');
    }
  }
}

/* ==========================================================================
   📊 EXCEL EXPORT ENGINE (PREMIUM EXECUTIVE SUMMARY & CATEGORIZED SHEETS)
   ========================================================================== */

async function exportLeaveReportExcel() {
  if (!allLeaveRequests || !allLeaveRequests.length) {
    Swal.fire({
      title: 'ไม่พบข้อมูล',
      text: 'ยังไม่มีข้อมูลใบลาในระบบสำหรับการส่งออก',
      icon: 'info',
      confirmButtonColor: '#0fa472'
    });
    return;
  }

  if (typeof ExcelJS === 'undefined') {
    Swal.fire({
      title: 'กำลังเตรียมระบบ',
      text: 'กรุณารอสักครู่ กำลังโหลดเครื่องมือสร้างรายงาน Excel',
      icon: 'warning',
      confirmButtonColor: '#0fa472'
    });
    return;
  }

  // 1. ตัวเลือกการดาวน์โหลด
  const { value: exportOption } = await Swal.fire({
    title: '<span style="color:#0f172a; font-weight:700; font-size:20px;">📊 ดาวน์โหลดรายงานการลา Excel</span>',
    html: `
      <div style="text-align: left; font-family: 'Sarabun', sans-serif; font-size: 14px; color: #475569; display:flex; flex-direction:column; gap:14px;">
        <p>เลือกประเภทและขอบเขตข้อมูลที่ต้องการส่งออกเป็นรายงานและนำเข้าเครื่องมือคำนวณเงินเดือน (Payroll):</p>
        
        <div>
          <label style="font-weight: 600; color: #1e293b; display: block; margin-bottom: 4px;">รูปแบบรายงาน:</label>
          <select id="swalExportFormat" class="swal2-select" style="width: 100%; margin: 0; height: 42px; border-radius: 8px; font-size: 13.5px; border-color: #cbd5e1;">
            <option value="executive_full">📈 เล่มรายงานสมบูรณ์ (สรุป Dashboard + แยกประเภท + รายบุคคล)</option>
            <option value="summary_only">📊 สรุปภาพรวม Dashboard & สถิติรายแผนก (Executive Summary)</option>
            <option value="raw_active">📋 รายการตามที่กำลังแสดงบนตาราง (${currentLeaveTab === 'pending' ? 'รออนุมัติ' : currentLeaveTab === 'cancellation' ? 'ขอยกเลิก' : 'ประวัติทั้งหมด'})</option>
          </select>
        </div>

        <div>
          <label style="font-weight: 600; color: #1e293b; display: block; margin-bottom: 4px;">ตัวกรองสถานะ:</label>
          <select id="swalExportStatus" class="swal2-select" style="width: 100%; margin: 0; height: 42px; border-radius: 8px; font-size: 13.5px; border-color: #cbd5e1;">
            <option value="all">-- รวมทุกสถานะ (All Statuses) --</option>
            <option value="approved" selected>เฉพาะที่ "อนุมัติแล้ว" (Approved Only - แนะนำสำหรับทำเงินเดือน)</option>
            <option value="pending">เฉพาะที่ "รอพิจารณา" (Pending Only)</option>
            <option value="rejected">เฉพาะที่ "ไม่อนุมัติ / ยกเลิก" (Rejected/Cancelled)</option>
          </select>
        </div>

        <div>
          <label style="font-weight: 600; color: #1e293b; display: block; margin-bottom: 4px;">รอบระยะเวลา (วีค / 15 วัน เพื่อคำนวณเงินเดือน):</label>
          <select id="swalExportPeriod" class="swal2-select" style="width: 100%; margin: 0; height: 42px; border-radius: 8px; font-size: 13.5px; border-color: #cbd5e1;">
            <option value="all_time" selected>แสดงทั้งหมด (All dates)</option>
            <option value="first_15_cur">📅 วีคที่ 1: วันที่ 1 - 15 ของเดือนนี้</option>
            <option value="last_15_cur">📅 วีคที่ 2: วันที่ 16 - สิ้นเดือน ของเดือนนี้</option>
            <option value="first_15_prev">📅 วีคที่ 1: วันที่ 1 - 15 ของเดือนที่แล้ว</option>
            <option value="last_15_prev">📅 วีคที่ 2: วันที่ 16 - สิ้นเดือน ของเดือนที่แล้ว</option>
            <option value="weekly_cur">📅 สัปดาห์ปัจจุบัน (7 วันล่าสุด)</option>
            <option value="custom_range">⚙️ กำหนดช่วงวันที่เอง (Custom Range)</option>
          </select>
        </div>

        <div id="swalCustomDatesContainer" style="display: none; border: 1px dashed #cbd5e1; padding: 12px; border-radius: 8px; background: #f8fafc; gap: 8px;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <div style="flex: 1;">
              <label style="font-size: 11px; font-weight:600; color:#475569;">วันที่เริ่มต้น:</label>
              <input type="date" id="swalStartDate" class="swal2-input" style="width: 100%; margin: 4px 0 0 0; height: 38px; border-radius: 6px; font-size: 13px; padding: 4px 8px;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 11px; font-weight:600; color:#475569;">วันที่สิ้นสุด:</label>
              <input type="date" id="swalEndDate" class="swal2-input" style="width: 100%; margin: 4px 0 0 0; height: 38px; border-radius: 6px; font-size: 13px; padding: 4px 8px;">
            </div>
          </div>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '📥 ดาวน์โหลด Excel',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0fa472',
    cancelButtonColor: '#64748b',
    focusConfirm: false,
    didOpen: () => {
      const selectPeriod = document.getElementById('swalExportPeriod');
      const customDatesDiv = document.getElementById('swalCustomDatesContainer');
      if (selectPeriod && customDatesDiv) {
        selectPeriod.addEventListener('change', (e) => {
          if (e.target.value === 'custom_range') {
            customDatesDiv.style.display = 'flex';
          } else {
            customDatesDiv.style.display = 'none';
          }
        });
      }
    },
    preConfirm: () => {
      return {
        format: document.getElementById('swalExportFormat').value,
        statusFilter: document.getElementById('swalExportStatus').value,
        period: document.getElementById('swalExportPeriod').value,
        startDate: document.getElementById('swalStartDate')?.value || '',
        endDate: document.getElementById('swalEndDate')?.value || ''
      };
    }
  });

  if (!exportOption) return;

  Swal.fire({
    title: 'กำลังสร้างไฟล์ Excel...',
    text: 'ระบบกำลังจัดทำสรุปภาพรวม สถิติ และแยกชีตข้อมูลอย่างสวยงาม',
    didOpen: () => Swal.showLoading(),
    allowOutsideClick: false
  });

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PVT Workforce Hub";
    workbook.created = new Date();

    // กรองตาม statusFilter ที่เลือก
    let targetLeaves = [...allLeaveRequests];
    if (exportOption.statusFilter === 'approved') {
      targetLeaves = targetLeaves.filter(r => String(r.status).toLowerCase() === 'approved');
    } else if (exportOption.statusFilter === 'pending') {
      targetLeaves = targetLeaves.filter(r => isPendingStatus(r.status));
    } else if (exportOption.statusFilter === 'rejected') {
      targetLeaves = targetLeaves.filter(r => String(r.status).toLowerCase() === 'rejected' || isCancelRequestStatus(r.status));
    }

    if (exportOption.format === 'raw_active') {
      if (currentLeaveTab === 'pending') {
        targetLeaves = targetLeaves.filter(r => isPendingStatus(r.status));
      } else if (currentLeaveTab === 'cancellation') {
        targetLeaves = targetLeaves.filter(r => isCancelRequestStatus(r.status));
      }
    }

    // 🟢 ประยุกต์ใช้ตัวกรองรอบระยะเวลา (วีค / 15 วัน)
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth();

    let rangeStart = null;
    let rangeEnd = null;

    if (exportOption.period === 'first_15_cur') {
      rangeStart = new Date(curYear, curMonth, 1);
      rangeEnd = new Date(curYear, curMonth, 15, 23, 59, 59);
    } else if (exportOption.period === 'last_15_cur') {
      rangeStart = new Date(curYear, curMonth, 16);
      rangeEnd = new Date(curYear, curMonth + 1, 0, 23, 59, 59);
    } else if (exportOption.period === 'first_15_prev') {
      let prevMonth = curMonth - 1;
      let prevYear = curYear;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
      }
      rangeStart = new Date(prevYear, prevMonth, 1);
      rangeEnd = new Date(prevYear, prevMonth, 15, 23, 59, 59);
    } else if (exportOption.period === 'last_15_prev') {
      let prevMonth = curMonth - 1;
      let prevYear = curYear;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear--;
      }
      rangeStart = new Date(prevYear, prevMonth, 16);
      rangeEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);
    } else if (exportOption.period === 'weekly_cur') {
      rangeStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      rangeEnd = new Date(today.getTime());
    } else if (exportOption.period === 'custom_range' && exportOption.startDate && exportOption.endDate) {
      rangeStart = new Date(exportOption.startDate);
      rangeEnd = new Date(exportOption.endDate + 'T23:59:59');
    }

    if (rangeStart && rangeEnd) {
      targetLeaves = targetLeaves.filter(r => {
        if (!r.start_date || !r.end_date) return false;
        const lStart = new Date(r.start_date);
        const lEnd = new Date(r.end_date);
        // เช็คการคาบเกี่ยวของช่วงวันที่ลาและรอบการสแกน
        return lStart <= rangeEnd && lEnd >= rangeStart;
      });
    }

    // -------------------------------------------------------------
    // 🌟 SHEET 1: สรุปภาพรวม (Executive Leave Dashboard)
    // -------------------------------------------------------------
    const summarySheet = workbook.addWorksheet("📊 สรุปภาพรวม (Executive Summary)", {
      views: [{ showGridLines: true }]
    });

    // 1. หัวตารางรายงาน
    summarySheet.mergeCells("A1:G1");
    const headerCell = summarySheet.getCell("A1");
    headerCell.value = "🏢 บริษัท พี.วี.ที. แอนด์ ที.พลาส จำกัด | รายงานสรุปภาพรวมการลาพนักงาน (Executive Leave Dashboard)";
    headerCell.font = { name: "Sarabun", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
    headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B845C" } };
    headerCell.alignment = { vertical: "middle", horizontal: "center" };
    summarySheet.getRow(1).height = 36;

    summarySheet.mergeCells("A2:G2");
    const subHeader = summarySheet.getCell("A2");
    let filterPeriodText = "รอบเวลา: ทั้งหมด";
    if (rangeStart && rangeEnd) {
      filterPeriodText = `รอบเวลา: ${rangeStart.toLocaleDateString("th-TH")} ถึง ${rangeEnd.toLocaleDateString("th-TH")}`;
    }
    subHeader.value = `วันที่สร้างรายงาน: ${new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} | ${filterPeriodText} | สิทธิ์: HR`;
    subHeader.font = { name: "Sarabun", size: 10, italic: true, color: { argb: "FF475569" } };
    subHeader.alignment = { vertical: "middle", horizontal: "center" };
    summarySheet.getRow(2).height = 20;

    // 2. การ์ด KPI รวม (Stats KPI Cards)
    const totalRequests = targetLeaves.length;
    const approvedCount = targetLeaves.filter(r => String(r.status).toLowerCase() === 'approved').length;
    const pendingCount = targetLeaves.filter(r => isPendingStatus(r.status)).length;
    const cancelCount = targetLeaves.filter(r => isCancelRequestStatus(r.status)).length;
    const totalApprovedDays = targetLeaves
      .filter(r => String(r.status).toLowerCase() === 'approved')
      .reduce((sum, r) => sum + Number(r.actual_days || r.total_days || 0), 0);

    summarySheet.getRow(4).values = ["ตัวชี้วัดสำคัญ (Key Metrics)", "รายการรวม", "อนุมัติแล้ว", "รอพิจารณา", "ขอยกเลิก", "วันลาที่อนุมัติสะสม", "เฉลี่ยวัน/รายการ"];
    summarySheet.getRow(5).values = [
      "สถิติภาพรวมบริษัท", 
      totalRequests, 
      approvedCount, 
      pendingCount, 
      cancelCount, 
      totalApprovedDays,
      approvedCount > 0 ? Number((totalApprovedDays / approvedCount).toFixed(1)) : 0
    ];

    const kpiHead = summarySheet.getRow(4);
    const kpiVal = summarySheet.getRow(5);
    kpiHead.height = 24;
    kpiVal.height = 28;

    for (let c = 1; c <= 7; c++) {
      const cellH = kpiHead.getCell(c);
      const cellV = kpiVal.getCell(c);

      cellH.font = { name: "Sarabun", size: 11, bold: true, color: { argb: "FF0F172A" } };
      cellH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
      cellH.alignment = { vertical: "middle", horizontal: "center" };
      cellH.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

      cellV.font = { name: "Sarabun", size: 13, bold: true, color: { argb: c === 3 ? "FF059669" : c === 4 ? "FFD97706" : "FF0F172A" } };
      cellV.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c === 3 ? "FFECFDF5" : c === 4 ? "FFFFFBEB" : "FFF8FAFC" } };
      cellV.alignment = { vertical: "middle", horizontal: "center" };
      cellV.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    }

    // 3. ตารางแยกสถิติตามประเภทการลา (Summary by Leave Type)
    summarySheet.getCell("A7").value = "📋 1. สรุปสถิติแยกตามประเภทการลา (Breakdown by Leave Type)";
    summarySheet.getCell("A7").font = { name: "Sarabun", size: 12, bold: true, color: { argb: "FF0B845C" } };

    const typeSummaryRow = summarySheet.getRow(8);
    typeSummaryRow.values = ["ประเภทการลา", "จำนวนคำขอ (รายการ)", "อนุมัติแล้ว", "วันลารวม (วัน)", "สัดส่วน %", "สถานะ"];
    typeSummaryRow.height = 24;
    for (let c = 1; c <= 6; c++) {
      const cell = typeSummaryRow.getCell(c);
      cell.font = { name: "Sarabun", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0FA472" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }

    // รวมกลุ่มประเภทการลา
    const leaveTypeMap = {};
    targetLeaves.forEach(r => {
      const type = r.leave_types?.leave_name || "ไม่ระบุประเภท";
      if (!leaveTypeMap[type]) {
        leaveTypeMap[type] = { count: 0, approvedCount: 0, days: 0 };
      }
      leaveTypeMap[type].count++;
      if (String(r.status).toLowerCase() === 'approved') {
        leaveTypeMap[type].approvedCount++;
        leaveTypeMap[type].days += Number(r.actual_days || r.total_days || 0);
      }
    });

    let rowIdx = 9;
    Object.entries(leaveTypeMap).forEach(([tName, data]) => {
      const pct = totalRequests > 0 ? ((data.count / totalRequests) * 100).toFixed(1) + "%" : "0%";
      const row = summarySheet.getRow(rowIdx);
      row.values = [tName, data.count, data.approvedCount, data.days, pct, data.count > 0 ? "มีรายการลา" : "ไม่มีข้อมูล"];
      row.height = 20;

      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.font = { name: "Sarabun", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "center" };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      }
      rowIdx++;
    });

    // 4. ตารางแยกสถิติตามแผนก (Summary by Department)
    rowIdx += 2;
    summarySheet.getCell(`A${rowIdx}`).value = "🏢 2. สรุปสถิติแยกตามแผนก (Breakdown by Department)";
    summarySheet.getCell(`A${rowIdx}`).font = { name: "Sarabun", size: 12, bold: true, color: { argb: "FF0B845C" } };
    rowIdx++;

    const deptHeaderRow = summarySheet.getRow(rowIdx);
    deptHeaderRow.values = ["ชื่อแผนก / ฝ่าย", "จำนวนคำขอทั้งหมด", "อนุมัติแล้ว", "วันลารวม (วัน)", "รอตรวจสอบ", "สัดส่วน %"];
    deptHeaderRow.height = 24;
    for (let c = 1; c <= 6; c++) {
      const cell = deptHeaderRow.getCell(c);
      cell.font = { name: "Sarabun", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B82F6" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    }
    rowIdx++;

    const deptMap = {};
    targetLeaves.forEach(r => {
      const dept = r.employees?.departments?.department_name || "ส่วนกลาง / ไม่ระบุ";
      if (!deptMap[dept]) {
        deptMap[dept] = { count: 0, approved: 0, days: 0, pending: 0 };
      }
      deptMap[dept].count++;
      if (String(r.status).toLowerCase() === 'approved') {
        deptMap[dept].approved++;
        deptMap[dept].days += Number(r.actual_days || r.total_days || 0);
      }
      if (isPendingStatus(r.status)) {
        deptMap[dept].pending++;
      }
    });

    Object.entries(deptMap).forEach(([dName, data]) => {
      const pct = totalRequests > 0 ? ((data.count / totalRequests) * 100).toFixed(1) + "%" : "0%";
      const row = summarySheet.getRow(rowIdx);
      row.values = [dName, data.count, data.approved, data.days, data.pending, pct];
      row.height = 20;

      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.font = { name: "Sarabun", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: c === 1 ? "left" : "center" };
        cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
      }
      rowIdx++;
    });

    // ปรับความกว้างคอลัมน์ของชีตสรุป
    summarySheet.columns = [
      { width: 34 },
      { width: 22 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 20 },
      { width: 18 }
    ];

    // -------------------------------------------------------------
    // 📄 SHEET 2: รายการคำขอลาทั้งหมด (Detailed Requests Log)
    // -------------------------------------------------------------
    if (exportOption.format !== 'summary_only') {
      const detailSheet = workbook.addWorksheet("📋 ข้อมูลการลาละเอียด (Detailed Records)", {
        views: [{ showGridLines: true }]
      });

      // Headers
      const headers = [
        "ลำดับ",
        "รหัสพนักงาน",
        "ชื่อ-นามสกุล",
        "ชื่อเล่น",
        "แผนก",
        "ตำแหน่ง",
        "ประเภทการลา",
        "สิทธิ์จ่ายเงิน (Paid/Unpaid)",
        "วันที่เริ่มต้น",
        "วันที่สิ้นสุด",
        "จำนวนวันลา",
        "เหตุผลการลา",
        "สถานะผู้อนุมัติ ลำดับที่ 1",
        "สถานะผู้อนุมัติ ลำดับที่ 2",
        "สถานะสุดท้าย HR (ลำดับที่ 3)",
        "วันที่ยื่นคำขอ"
      ];

      const headerRow = detailSheet.getRow(1);
      headerRow.values = headers;
      headerRow.height = 26;

      for (let c = 1; c <= headers.length; c++) {
        const cell = headerRow.getCell(c);
        cell.font = { name: "Sarabun", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0FA472" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
      }

      // Populate Data
      targetLeaves.forEach((r, idx) => {
        const emp = r.employees || {};
        const empCode = emp.employee_code || "-";
        const empName = emp.full_name || "-";
        const nickname = emp.nickname || "-";
        const dept = emp.departments?.department_name || "-";
        const position = emp.positions?.position_name || "-";
        const leaveType = r.leave_types?.leave_name || "ไม่ระบุ";
        const isPaidText = r.leave_types?.paid_leave ? "ได้รับค่าจ้าง (Paid)" : "หักค่าจ้าง (Unpaid)";
        const startDate = formatThaiDate(r.start_date);
        const endDate = formatThaiDate(r.end_date);
        const days = r.actual_days || r.days_requested || r.total_days || 0;
        const reason = (r.reason || r.note || "-").replace(/[\r\n]+/g, " ");
        
        const mStatus = r.manager_status === 'approved' ? 'อนุมัติแล้ว' : r.manager_status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา';
        const dStatus = r.director_status === 'approved' ? 'อนุมัติแล้ว' : r.director_status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา';
        const hrStatus = r.status === 'approved' ? 'อนุมัติครบสมบูรณ์' : r.status === 'rejected' ? 'ไม่อนุมัติ' : isCancelRequestStatus(r.status) ? 'ขอยกเลิก' : 'รออนุมัติ';
        const createdAt = r.created_at ? new Date(r.created_at).toLocaleDateString("th-TH") : "-";

        const row = detailSheet.getRow(idx + 2);
        row.values = [
          idx + 1,
          empCode,
          empName,
          nickname,
          dept,
          position,
          leaveType,
          isPaidText,
          startDate,
          endDate,
          days,
          reason,
          mStatus,
          dStatus,
          hrStatus,
          createdAt
        ];
        row.height = 20;

        // สลับสีแถว (Zebra striping)
        const isEven = idx % 2 === 0;
        const rowBg = isEven ? "FFFFFFFF" : "FFF8FAFC";

        for (let c = 1; c <= headers.length; c++) {
          const cell = row.getCell(c);
          cell.font = { name: "Sarabun", size: 10 };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowBg } };
          cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };

          // ปรับการจัดแนว (ลำดับ, รหัส, ชื่อเล่น, วันที่เริ่มต้น, วันที่สิ้นสุด, จำนวนวัน, L1, L2, L3, วันที่ยื่น, สิทธิ์จ่ายเงิน)
          if ([1, 2, 4, 8, 9, 10, 11, 13, 14, 15, 16].includes(c)) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }

          // ไฮไลต์สิทธิ์จ่ายเงิน
          if (c === 8) {
            if (r.leave_types?.paid_leave) {
              cell.font = { name: "Sarabun", size: 10, bold: true, color: { argb: "FF059669" } };
            } else {
              cell.font = { name: "Sarabun", size: 10, bold: true, color: { argb: "FFD97706" } };
            }
          }

          // ไฮไลต์สถานะสุดท้าย L3
          if (c === 15) {
            if (r.status === 'approved') {
              cell.font = { name: "Sarabun", size: 10, bold: true, color: { argb: "FF059669" } };
            } else if (r.status === 'rejected') {
              cell.font = { name: "Sarabun", size: 10, bold: true, color: { argb: "FFDC2626" } };
            }
          }
        }
      });

      // ปรับขนาดคอลัมน์ให้สวยงาม
      detailSheet.columns = [
        { width: 8 },   // ลำดับ
        { width: 14 },  // รหัส
        { width: 24 },  // ชื่อ
        { width: 12 },  // ชื่อเล่น
        { width: 22 },  // แผนก
        { width: 22 },  // ตำแหน่ง
        { width: 18 },  // ประเภท
        { width: 22 },  // สิทธิ์จ่ายเงิน (NEW!)
        { width: 16 },  // เริ่ม
        { width: 16 },  // สิ้นสุด
        { width: 14 },  // จำนวนวัน
        { width: 30 },  // เหตุผล
        { width: 18 },  // Step 1
        { width: 18 },  // Step 2
        { width: 22 },  // Step 3
        { width: 16 }   // วันที่ยื่น
      ];
    }

    // ทำการแปลงและดาวน์โหลดไฟล์
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `รายงานสรุปภาพรวมการลา_PVT_${timestamp}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    Swal.fire({
      title: 'ดาวน์โหลดสำเร็จ!',
      text: 'รายงานสรุปภาพรวมและข้อมูลการลาถูกสร้างเรียบร้อยแล้ว',
      icon: 'success',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#0fa472',
      showDenyButton: false,
      showCancelButton: false,
      showCloseButton: false
    });

  } catch (err) {
    console.error("💥 Excel Export Error:", err);
    Swal.fire({
      title: 'เกิดข้อผิดพลาด',
      text: 'ไม่สามารถสร้างไฟล์ Excel ได้: ' + err.message,
      icon: 'error',
      confirmButtonColor: '#ef4444'
    });
  }
}

/* ==========================================================================
   🚪 8. GLOBAL EXPORTS & LOGOUT
   ========================================================================== */

window.approveLeave = approveLeave;
window.rejectLeave = rejectLeave;
window.forceCancelLeave = forceCancelLeave;
window.approveCancellation = approveCancellation;
window.rejectCancellation = rejectCancellation;
window.printLeaveA4 = printLeaveA4;
window.loadPendingLeavesHR = loadPendingLeavesHR;
// ช่องค้นหา (oninput) และตัวกรองสถานะ (onchange) ใน hr.html เรียก renderLeaveTable()
// แต่ hr.js โหลดแบบ module → ถ้าไม่ผูกกับ window ฟังก์ชันจะหาไม่เจอ ค้นหา/กรองไม่ทำงาน
window.renderLeaveTable = renderLeaveTable;
window.previewLeaveModal = previewLeaveModal;
window.closePreviewModal = closePreviewModal;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.exportLeaveReportExcel = exportLeaveReportExcel;

/* ==========================================================================
   ⚡ BULK ACTION WORKFLOW (อนุมัติหลายรายการพร้อมกัน)
   ========================================================================== */
window.toggleSelectAllBulk = function(sourceCheckbox) {
  const checkboxes = document.querySelectorAll(".bulk-item-check");
  checkboxes.forEach(cb => {
    cb.checked = sourceCheckbox.checked;
  });
  handleBulkItemCheckChange();
};

window.handleBulkItemCheckChange = function() {
  const checkboxes = document.querySelectorAll(".bulk-item-check");
  const checkedBoxes = document.querySelectorAll(".bulk-item-check:checked");
  const countSpan = document.getElementById("bulkSelectedCount");
  const selectAll = document.getElementById("selectAllBulk");
  
  if (countSpan) {
    countSpan.innerText = `เลือกแล้ว ${checkedBoxes.length} รายการ`;
  }
  if (selectAll) {
    selectAll.checked = checkboxes.length > 0 && checkedBoxes.length === checkboxes.length;
  }
};

window.cancelBulkSelection = function() {
  const checkboxes = document.querySelectorAll(".bulk-item-check");
  checkboxes.forEach(cb => cb.checked = false);
  const selectAll = document.getElementById("selectAllBulk");
  if (selectAll) selectAll.checked = false;
  const countSpan = document.getElementById("bulkSelectedCount");
  if (countSpan) countSpan.innerText = "เลือกแล้ว 0 รายการ";
};

window.submitBulkApproval = async function() {
  const checkedBoxes = Array.from(document.querySelectorAll(".bulk-item-check:checked"));
  if (checkedBoxes.length === 0) {
    return Swal.fire({
      icon: 'warning',
      title: 'ยังไม่ได้เลือกรายการ',
      text: 'กรุณาทำเครื่องหมายถูกที่ช่องหน้ารายการใบลาที่ต้องการอนุมัติครับ',
      confirmButtonColor: 'var(--th-p-600, #0d9488)'
    });
  }

  const result = await Swal.fire({
    title: 'ยืนยันอนุมัติกลุ่ม?',
    html: `คุณต้องการอนุมัติใบลาทั้งหมด <strong>${checkedBoxes.length} รายการ</strong> ที่เลือกพร้อมกันทันทีหรือไม่?`,
    icon: 'question',
    showCancelButton: true,
    showDenyButton: false,
    confirmButtonColor: 'var(--th-p-600, #0d9488)',
    cancelButtonColor: '#64748b',
    confirmButtonText: `✔️ ยืนยันอนุมัติ (${checkedBoxes.length} รายการ)`,
    cancelButtonText: 'ยกเลิก'
  });

  if (!result.isConfirmed) return;

  const total = checkedBoxes.length;
  let successCount = 0;
  let failCount = 0;

  Swal.fire({
    title: 'กำลังอนุมัติกลุ่ม...',
    html: `ระบบกำลังประมวลผล <strong>0</strong> จาก ${total} รายการ`,
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  let skipped = 0;
  for (let i = 0; i < total; i++) {
    const leaveId = checkedBoxes[i].dataset.id;
    try {
      const reqData = allLeaveRequests.find(r => String(r.id) === String(leaveId));
      if (!reqData) continue;
      // ใช้กติกาเดียวกับการอนุมัติทีละใบ (ตรวจสิทธิ์/ลำดับขั้น, บันทึกหลักฐาน, แจ้งขั้นถัดไป/HR)
      if (getApproveMode(reqData) !== 'normal' || !canApproveStep(reqData, currentRole, true)) { skipped++; continue; }
      const outcome = await performApprovalStep(reqData);
      if (outcome.ok) successCount++; else skipped++;
    } catch (err) {
      console.error(`Bulk item ${leaveId} failed:`, err);
      failCount++;
    }

    const htmlContent = `ระบบกำลังประมวลผล <strong>${i + 1}</strong> จาก ${total} รายการ`;
    const popup = Swal.getHtmlContainer();
    if (popup) popup.innerHTML = htmlContent;
  }

  Swal.fire({
    icon: 'success',
    title: 'อนุมัติกลุ่มสำเร็จ!',
    html: `ระบบดำเนินการอนุมัติเรียบร้อยทั้งหมด <strong>${successCount}</strong> รายการ${skipped > 0 ? `<br><small style="color:#b45309">ข้าม ${skipped} รายการ (ยังไม่ถึงขั้นของท่าน หรือมีผู้พิจารณาไปแล้ว)</small>` : ''}${failCount > 0 ? `<br><small style="color:red">ไม่สำเร็จ ${failCount} รายการ</small>` : ''}`,
    confirmButtonColor: 'var(--th-p-600, #0d9488)',
    confirmButtonText: 'ตกลง'
  }).then(() => {
    loadPendingLeavesHR();
  });
};

window.handleLogout = function(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (event && event.stopPropagation) event.stopPropagation();

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'ยืนยันการออกจากระบบ',
      text: 'คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่?',
      icon: 'warning',
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ตกลง (ยืนยันการออก)',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: false,
      focusConfirm: true,
      customClass: {
        popup: 'pvt-logout-popup'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (typeof window.executePvtLogout === 'function') {
          window.executePvtLogout();
        } else {
          sessionStorage.setItem('pvt_explicit_logout', 'true');
          localStorage.clear();
          sessionStorage.clear();
          window.location.replace("/index.html?logout=true");
        }
      }
    });
  } else {
    if (confirm('คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่? (กด ตกลง / OK เพื่อยืนยันการออก)')) {
      if (typeof window.executePvtLogout === 'function') {
        window.executePvtLogout();
      } else {
        sessionStorage.setItem('pvt_explicit_logout', 'true');
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace("/index.html?logout=true");
      }
    }
  }
};

// 📱 Auto-sync on Android/Mobile WebView foreground resume for HR Dashboard
let lastHrSyncTime = Date.now();
async function handleHrAutoSync() {
  if (document.visibilityState === 'visible' || !document.hidden) {
    const now = Date.now();
    if (now - lastHrSyncTime > 4000) {
      lastHrSyncTime = now;
      console.log("📱 [AUTO-SYNC] HR Dashboard foreground resume, refreshing pending leaves & stats...");
      try {
        if (typeof loadPendingLeavesHR === 'function') loadPendingLeavesHR();
        if (typeof loadDeptApproversMapping === 'function') loadDeptApproversMapping();
      } catch (err) {
        console.warn("HR auto-sync error:", err);
      }
    }
  }
}

document.addEventListener("visibilitychange", handleHrAutoSync);
window.addEventListener("pageshow", handleHrAutoSync);
window.addEventListener("focus", handleHrAutoSync);

// ผู้ใช้กำลังทำงานค้างอยู่หรือไม่ (ติ๊กเลือกหลายรายการ / เปิดหน้ารายละเอียด / มีกล่องยืนยันเปิดอยู่)
// ถ้าใช่ → ข้ามการรีเฟรชอัตโนมัติรอบนั้น เพราะการ render ใหม่จะล้างช่องที่ติ๊กไว้ทุก 15 วินาที
function isUserBusyOnHrPage() {
  const hasCheckedBulk = !!document.querySelector('.bulk-item-check:checked');
  const isPreviewOpen = !!document.querySelector('#leavePreviewModal.active');
  const isSwalOpen = typeof Swal !== 'undefined' && typeof Swal.isVisible === 'function' && Swal.isVisible();
  return hasCheckedBulk || isPreviewOpen || isSwalOpen;
}

// Polling ทุกๆ 15 วินาที
setInterval(() => {
  if (document.visibilityState === 'visible' && !document.hidden && !isUserBusyOnHrPage()) {
    if (typeof loadPendingLeavesHR === 'function') loadPendingLeavesHR(true);
  }
}, 15000);

// ⚡ Realtime Channel Subscription for instant leave updates
let hrRealtimeChannel = null;
function setupHrRealtimeSubscription() {
  try {
    const sb = window.pvtSupabase?.getClient();
    if (!sb || hrRealtimeChannel) return;

    hrRealtimeChannel = sb
      .channel('hr-leave-requests-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leave_requests' },
        (payload) => {
          console.log('⚡ [Realtime Leave INSERT]:', payload.new?.id);
          if (typeof loadPendingLeavesHR === 'function') {
            loadPendingLeavesHR(true);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leave_requests' },
        (payload) => {
          console.log('⚡ [Realtime Leave UPDATE]:', payload.new?.id);
          if (typeof loadPendingLeavesHR === 'function') {
            loadPendingLeavesHR(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('⚡ [Realtime Channel Status]:', status);
      });
  } catch (err) {
    console.warn('Realtime subscription error:', err);
  }
}

// Initialize Realtime once SDK is ready
if (window.pvtSupabase) {
  setupHrRealtimeSubscription();
} else {
  window.addEventListener('load', () => {
    setTimeout(setupHrRealtimeSubscription, 1000);
  });
}