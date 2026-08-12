// ============================================================================
// 🚀 PVT HR System - [FULL ROLE-BASED APPROVALS & CANCELLATION WORKFLOW]
// ============================================================================

let currentRole = "hr"; 
let currentUserProfile = null;
let allLeaveRequests = []; 
let currentLeaveTab = "pending"; // 'pending' | 'cancellation' | 'history'

// ⚡ [1. IMMEDIATE CHECK]: เช็กสิทธิ์ทันทีตั้งแต่นาทีแรกที่โหลด JS (ไม่รอ DOMDOMContentLoaded)
(function checkRoleImmediately() {
  try {
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = sessionUser?.employees || sessionUser || {};
    
    const fastRole = String(sessionUser?.role || empData?.role || "").toLowerCase();
    const fastPosition = String(empData?.positions?.position_name || empData?.position_name || "").toLowerCase();

    const isAllowedRole = (
      fastRole === "hr" || fastRole === "admin" || fastRole === "director" || 
      fastRole === "manager" || fastRole === "leader" ||
      fastPosition.includes("ผู้จัดการ") || fastPosition.includes("ผู้อำนวยการ") || fastPosition.includes("หัวหน้า")
    );

    // ⛔ ถ้าไม่มีสิทธิ์ บังคับซ่อนหน้าเว็บทันทีตั้งแต่ตอนนี้ เพื่อไม่ให้auth-guardสั่งโชว์หน้าเว็บ
    if (!isAllowedRole) {
      document.documentElement.style.visibility = 'hidden';
      window.__PVT_ACCESS_DENIED__ = true; // ทำเครื่องหมายไว้ว่าไม่มีสิทธิ์
    }
  } catch (e) {
    console.error("🔒 Auth Check Error:", e);
  }
})();

document.addEventListener("DOMContentLoaded", async () => {
  // ⛔ ถ้าโดนบล็อกสิทธิ์ไว้ตั้งแต่ขั้นตอน Immediate Check ให้เด้ง Swal ทันที
  if (window.__PVT_ACCESS_DENIED__) {
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
        iconColor: '#ef4444',
        confirmButtonText: '🏠 กลับหน้าหลักพนักงาน',
        confirmButtonColor: '#06b6d4',
        allowOutsideClick: false,
        allowEscapeKey: false,
        customClass: { popup: 'pvt-guard-popup' }
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
    if (window.pvtSupabase?.getCurrentProfile) {
      currentUserProfile = await window.pvtSupabase.getCurrentProfile();
    }
    
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    
    const rawRole = String(currentUserProfile?.role || sessionUser?.role || empData?.role || "").toLowerCase();
    const positionName = String(empData?.positions?.position_name || empData?.position_name || "").toLowerCase();

    if (rawRole === "hr" || rawRole === "admin") {
      currentRole = "hr";
    } else if (rawRole === "director" || positionName.includes("ผู้จัดการ") || positionName.includes("ผู้อำนวยการ")) {
      currentRole = "manager";
    } else if (rawRole === "leader" || positionName.includes("หัวหน้า")) {
      currentRole = "leader";
    }

    // เปิดให้แสดงหน้าเว็บเมื่อสิทธิ์ถูกต้องแน่นอนแล้ว
    document.documentElement.style.visibility = 'visible';

    const userNameEl = document.getElementById("userNameHeader");
    const userPositionEl = document.getElementById("userPositionHeader");
    const userAvatarEl = document.getElementById("userAvatarHeader");

    if (userNameEl) userNameEl.textContent = empData?.full_name || currentUserProfile?.full_name || "ผู้ใช้งาน";
    if (userPositionEl) userPositionEl.textContent = empData?.positions?.position_name || empData?.position_name || "ไม่ระบุตำแหน่ง";
    if (userAvatarEl) userAvatarEl.src = getAvatarUrl(empData?.image_url || currentUserProfile?.image_url);

    applyRoleBasedUI();
    await loadPendingLeavesHR();

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการเริ่มต้นระบบ:", err.message);
  }
}

function applyRoleBasedUI() {
  const sidebar = document.getElementById("mainSidebar");
  const mainContent = document.getElementById("mainContent");
  const btnBack = document.getElementById("btnHeaderBack");
  const roleBadge = document.getElementById("userRoleBadge");

  if (currentRole === "leader" || currentRole === "manager") {
    if (sidebar) sidebar.style.setProperty("display", "none", "important");
    if (mainContent) {
      mainContent.style.setProperty("margin-left", "0", "important");
      mainContent.style.setProperty("width", "100%", "important");
      mainContent.style.setProperty("padding", "24px 32px", "important");
    }
    if (btnBack) btnBack.style.display = "inline-flex";

    if (roleBadge) {
      roleBadge.textContent = currentRole === "manager" ? "ผู้จัดการอนุมัติ (L2)" : "หัวหน้างานอนุมัติ (L1)";
      roleBadge.className = "status-badge status-pending";
    }
  } else {
    if (sidebar) sidebar.style.display = "flex";
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

function getAvatarUrl(imageUrl) {
  if (imageUrl && imageUrl.trim() !== "") {
    let url = imageUrl;
    if (!url.startsWith("http")) {
      url = `https://pgogmhqjdchakcytsomx.supabase.co/storage/v1/object/public/employee-images/${url}`;
    }
    return url;
  }
  return "/assets/img/default-avatar.jpg";
}

function formatStatusThai(status) {
  if (!status) return '<span class="status-badge status-pending">รออนุมัติ</span>';
  
  const s = String(status).trim().toLowerCase();
  switch (s) {
    case 'approved': case 'อนุมัติแล้ว': case 'อนุมัติ':
      return '<span class="status-badge status-approved">อนุมัติแล้ว</span>';
    case 'pending': case 'รออนุมัติ': case 'wait':
      return '<span class="status-badge status-pending">รออนุมัติ</span>';
    case 'rejected': case 'ไม่อนุมัติ':
      return '<span class="status-badge status-rejected">ไม่อนุมัติ</span>';
    case 'cancel_requested': case 'cancel_pending': case 'ขอยกเลิก': case 'รออนุมัติยกเลิก':
      return '<span class="status-badge status-cancel-req">รอ HR อนุมัติยกเลิก</span>';
    case 'cancelled': case 'cancelled_by_user': case 'ยกเลิกแล้ว': case 'ยกเลิก':
      return '<span class="status-badge status-cancelled">ยกเลิกเรียบร้อย</span>';
    default:
      return `<span class="status-badge">${status}</span>`;
  }
}

function isPendingStatus(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'pending' || s === 'รออนุมัติ' || s === 'wait';
}

function isCancelRequestStatus(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'cancel_requested' || s === 'cancel_pending' || s === 'ขอยกเลิก' || s === 'รออนุมัติยกเลิก';
}

function getADYear(dateStr) {
  if (!dateStr) return new Date().getFullYear();
  const yearPart = parseInt(String(dateStr).split('-')[0], 10);
  if (isNaN(yearPart)) return new Date().getFullYear();
  return yearPart > 2400 ? yearPart - 543 : yearPart;
}

async function calculateActualLeaveDays(startDateStr, endDateStr) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb || !startDateStr || !endDateStr) return 0;

  try {
    const cleanStart = String(startDateStr).split('T')[0];
    const cleanEnd = String(endDateStr).split('T')[0];

    const { data: holidayData } = await sb
      .from('holidays') 
      .select('holiday_date')
      .gte('holiday_date', cleanStart)
      .lte('holiday_date', cleanEnd);

    const holidaySet = new Set(holidayData ? holidayData.map(h => String(h.holiday_date).split('T')[0]) : []);
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
      const isSpecialHoliday = holidaySet.has(currentIsoString);

      if (!isSunday && !isSpecialHoliday) {
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
  if (reqData.actual_days && Number(reqData.actual_days) > 0) {
    return Number(reqData.actual_days);
  }
  
  if (reqData.start_date && reqData.end_date) {
    const calc = await calculateActualLeaveDays(reqData.start_date, reqData.end_date);
    if (calc > 0) return calc;
  }

  return Number(reqData.total_days || 0);
}

/* ==========================================================================
   📊 2. DATA FETCHING & TAB BADGES
   ========================================================================== */

async function loadPendingLeavesHR() {
  const tbody = document.getElementById("leaveRequestsBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">⏳ กำลังโหลดคลังข้อมูลคำขอ...</td></tr>`;
  }

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const savedSession = localStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    const currentEmpId = empData?.id || empData?.employee_id || currentUserProfile?.employee_id;

    let myDeptId = null;
    let myDeptName = null;

    if (currentEmpId) {
      const { data: myEmpInfo } = await sb
        .from("employees")
        .select("id, full_name, department_id, departments!department_id(id, department_name)")
        .eq("id", currentEmpId)
        .single();

      if (myEmpInfo) {
        myDeptId = myEmpInfo.department_id;
        myDeptName = myEmpInfo.departments?.department_name;
      }
    }

    let { data, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( 
          id, full_name, employee_code, nickname, role, image_url,
          department_id, departments!department_id(id, department_name), 
          positions(position_name) 
        ),
        leave_types ( leave_name ) 
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    let rawData = data || [];

    const userRole = (currentRole || '').toLowerCase();
    if (userRole === "leader" || userRole === "manager" || userRole === "director") {
      rawData = rawData.filter((req) => {
        const reqEmp = req.employees;
        if (!reqEmp) return false;

        const reqDeptId = reqEmp.department_id;
        const reqDeptName = reqEmp.departments?.department_name;
        const reqEmpId = req.employee_id;
        const reqEmpRole = String(reqEmp.role || 'user').toLowerCase();

        const isSameDept = (myDeptId || myDeptName) 
          ? (String(reqDeptId) === String(myDeptId) || String(reqDeptName).toLowerCase() === String(myDeptName).toLowerCase())
          : true;

        const isNotSelf = currentEmpId ? String(reqEmpId) !== String(currentEmpId) : true;
        let isSubordinate = false;
        
        if (userRole === "leader") {
          isSubordinate = (reqEmpRole === "user");
        } else {
          isSubordinate = (reqEmpRole === "user" || reqEmpRole === "leader" || reqEmpRole === "manager");
        }

        return isSameDept && isNotSelf && isSubordinate;
      });
    }

    allLeaveRequests = rawData;
    updateTabAndStatBadges();
    renderLeaveTable();

  } catch (err) {
    console.error("💥 เกิดข้อผิดพลาด:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="11" class="empty-state" style="color: var(--danger);">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
    }
  }
}

function updateTabAndStatBadges() {
  const pendingRequests = allLeaveRequests.filter(r => isPendingStatus(r.status));
  const cancelRequests = allLeaveRequests.filter(r => isCancelRequestStatus(r.status));
  const approvedRequests = allLeaveRequests.filter(r => String(r.status).toLowerCase() === 'approved');
  const historyRequests = allLeaveRequests.filter(r => !isPendingStatus(r.status) && !isCancelRequestStatus(r.status));

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
}

window.switchLeaveTab = function(tabName, btnEl) {
  currentLeaveTab = tabName;
  
  document.querySelectorAll('.leave-tab-container .tab-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const headerTitle = document.getElementById("sectionHeaderTitle");
  const headerIcon = document.getElementById("sectionHeaderIcon");

  if (tabName === 'pending') {
    if (headerTitle) headerTitle.textContent = "คำขออนุมัติลาค้างพิจารณา";
    if (headerIcon) headerIcon.textContent = "hourglass_top";
  } else if (tabName === 'cancellation') {
    if (headerTitle) headerTitle.textContent = "คำร้องขอยกเลิกใบลาหยุดงาน";
    if (headerIcon) headerIcon.textContent = "published_with_changes";
  } else {
    if (headerTitle) headerTitle.textContent = "ประวัติการพิจารณาใบลาทั้งหมด";
    if (headerIcon) headerIcon.textContent = "history";
  }

  renderLeaveTable();
};

/* ==========================================================================
   🖼️ 3. RENDER TABLE DATA
   ========================================================================== */

function renderLeaveTable() {
  const tbody = document.getElementById("leaveRequestsBody");
  if (!tbody) return;

  let filteredRequests = [];
  if (currentLeaveTab === "pending") {
    filteredRequests = allLeaveRequests.filter(r => isPendingStatus(r.status));
  } else if (currentLeaveTab === "cancellation") {
    filteredRequests = allLeaveRequests.filter(r => isCancelRequestStatus(r.status));
  } else {
    filteredRequests = allLeaveRequests.filter(r => !isPendingStatus(r.status) && !isCancelRequestStatus(r.status));
  }

  if (filteredRequests.length === 0) {
    let emptyMsg = "✨ ไม่มีคำขออนุมัติลาค้างในระบบ";
    if (currentLeaveTab === "cancellation") emptyMsg = "🎉 ไม่มีคำร้องขอยกเลิกใบลาค้างพิจารณา";
    if (currentLeaveTab === "history") emptyMsg = "📜 ยังไม่มีประวัติรายการพิจารณาใบลา";

    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">${emptyMsg}</td></tr>`;
    return;
  }

  let htmlContent = "";
  filteredRequests.forEach((req) => {
    const empName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
    const empCode = req.employees ? req.employees.employee_code : "-";
    const leaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุ";
    const startDate = req.start_date ? new Date(req.start_date).toLocaleDateString("th-TH") : "-";
    const endDate = req.end_date ? new Date(req.end_date).toLocaleDateString("th-TH") : "-";
    const avatarUrl = getAvatarUrl(req.employees?.image_url);

    const displayDays = req.actual_days || req.days_requested || req.total_days || 0;

    let noteContent = req.reason || "-";
    if (req.approval_comment && req.approval_comment.trim() !== "") {
      noteContent += `<br><small style="color: var(--danger); font-weight: 500;">(${req.approval_comment})</small>`;
    }

    let actionButtons = "";
    if (currentLeaveTab === "pending") {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-approve" onclick="approveLeave('${req.id}')" title="อนุมัติ">✔️ อนุมัติ</button>
          <button class="btn-act btn-act-reject" onclick="rejectLeave('${req.id}')" title="ไม่อนุมัติ">✖️ ปฏิเสธ</button>
          <button class="btn-act btn-act-cancel" onclick="cancelLeaveHR('${req.id}')" title="ยกเลิก">🚫 ยกเลิก</button>
          <button class="btn-act btn-act-print" onclick="printLeaveA4('${req.id}')" title="พิมพ์">🖨️ พิมพ์</button>
        </div>
      `;
    } else if (currentLeaveTab === "cancellation") {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-approve" onclick="approveCancellation('${req.id}')" title="อนุมัติยกเลิกและคืนโควตา">✔️ อนุมัติยกเลิก</button>
          <button class="btn-act btn-act-reject" onclick="rejectCancellation('${req.id}')" title="ปฏิเสธคำร้อง">✖️ ปฏิเสธยกเลิก</button>
        </div>
      `;
    } else {
      actionButtons = `
        <button class="btn-act btn-act-print" style="width:100%;" onclick="printLeaveA4('${req.id}')">🖨️ พิมพ์เอกสาร</button>
      `;
    }

    htmlContent += `
      <tr>
        <td class="text-center">
          <img src="${avatarUrl}" class="avatar-cell" onerror="this.src='/assets/img/default-avatar.jpg';">
        </td>
        <td><strong>${empCode}</strong></td>
        <td><strong>${empName}</strong></td>
        <td><span style="color: var(--primary); font-weight: 600;">${leaveType}</span></td>
        <td class="text-center" style="white-space:nowrap;">${startDate} - ${endDate}</td>
        <td>${noteContent}</td>
        <td class="text-center"><strong>${displayDays} วัน</strong></td>
        <td class="text-center">${formatStatusThai(req.manager_status)}</td>
        <td class="text-center">${formatStatusThai(req.director_status)}</td>
        <td class="text-center">${formatStatusThai(req.status)}</td>
        <td class="text-center" style="white-space:nowrap;">${actionButtons}</td>
      </tr>
    `;
  });

  tbody.innerHTML = htmlContent;
}

/* ==========================================================================
   🔵 4. LEAVE WORKFLOW ACTIONS
   ========================================================================== */

async function approveLeave(leaveId) {
  const result = await Swal.fire({
    title: 'ยืนยันอนุมัติใบลา?',
    text: currentRole === 'leader' 
      ? 'คุณกำลังอนุมัติในฐานะหัวหน้างาน (L1) เพื่อส่งต่อให้ผู้จัดการพิจารณา' 
      : 'ระบบจะบันทึกสถานะการอนุมัติและหักโควตาวันลาของพนักงาน',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: '✔️ อนุมัติ',
    cancelButtonText: 'ยกเลิก'
  });

  if (!result.isConfirmed) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    const { data: reqData, error: fetchErr } = await sb
      .from('leave_requests')
      .select('*')
      .eq('id', leaveId)
      .single();

    if (fetchErr || !reqData) throw new Error("ไม่พบข้อมูลคำขออนุมัติลา");

    const isAlreadyApproved = (reqData.status === 'approved');
    let updateFields = {};

    if (currentRole === 'leader') {
      updateFields.manager_status = 'approved';
    } else {
      updateFields.manager_status = 'approved';
      updateFields.director_status = 'approved';
      updateFields.status = 'approved';
      updateFields.approved_at = new Date().toISOString();

      if (!isAlreadyApproved) {
        const leaveDays = await getEffectiveLeaveDays(reqData);
        const currentYear = getADYear(reqData.start_date);

        const { data: balData } = await sb
          .from('leave_balances')
          .select('id, remaining_days, used_days')
          .eq('employee_id', reqData.employee_id)
          .eq('leave_type_id', reqData.leave_type_id)
          .eq('year', currentYear)
          .maybeSingle();

        if (balData) {
          const newUsed = (balData.used_days || 0) + leaveDays;
          const newRemaining = Math.max(0, (balData.remaining_days || 0) - leaveDays);

          await sb
            .from('leave_balances')
            .update({ remaining_days: newRemaining, used_days: newUsed })
            .eq('id', balData.id);
        }
      }
    }

    const { error: updateErr } = await sb
      .from('leave_requests')
      .update(updateFields)
      .eq('id', leaveId);

    if (updateErr) throw updateErr;

    await Swal.fire('อนุมัติสำเร็จ!', 'รายการใบลานี้ได้รับการอนุมัติเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR();

  } catch (err) {
    console.error("💥 Approve Error:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถทำรายการอนุมัติได้', 'error');
  }
}

async function rejectLeave(leaveId) {
  const { value: reason } = await Swal.fire({
    title: 'ปฏิเสธการขอลา',
    input: 'textarea',
    inputLabel: 'โปรดระบุเหตุผลการไม่อนุมัติ:',
    inputPlaceholder: 'พิมพ์เหตุผลที่นี่...',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: '✖️ ยืนยันไม่อนุมัติ',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => { if (!value) return 'กรุณาระบุเหตุผลด้วยครับ!' }
  });

  if (!reason) return;
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    let updateFields = {
      status: 'rejected',
      approval_comment: reason.trim()
    };

    if (currentRole === 'leader') {
      updateFields.manager_status = 'rejected';
    } else {
      updateFields.director_status = 'rejected';
    }

    const { error } = await sb
      .from('leave_requests')
      .update(updateFields)
      .eq('id', leaveId);

    if (error) throw error;

    await Swal.fire('ปฏิเสธสำเร็จ', 'บันทึกสถานะไม่อนุมัติเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR();

  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function cancelLeaveHR(leaveId) {
  const { value: reason } = await Swal.fire({
    title: 'ยืนยันยกเลิกใบลาโดย HR',
    input: 'textarea',
    inputLabel: 'ระบุเหตุผลในการยกเลิกรายการนี้:',
    inputPlaceholder: 'พิมพ์เหตุผล...',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f59e0b',
    confirmButtonText: '🚫 ยกเลิกใบลา',
    cancelButtonText: 'ปิด',
    inputValidator: (v) => !v && 'โปรดระบุเหตุผลด้วยครับ'
  });

  if (!reason) return;
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { data: reqData } = await sb
      .from('leave_requests')
      .select('*')
      .eq('id', leaveId)
      .single();

    if (reqData && reqData.status === 'approved') {
      const currentYear = getADYear(reqData.start_date);
      const daysToReturn = await getEffectiveLeaveDays(reqData);

      const { data: balData } = await sb
        .from('leave_balances')
        .select('id, remaining_days, used_days')
        .eq('employee_id', reqData.employee_id)
        .eq('leave_type_id', reqData.leave_type_id)
        .eq('year', currentYear)
        .maybeSingle();

      if (balData) {
        await sb.from('leave_balances').update({
          remaining_days: (balData.remaining_days || 0) + daysToReturn,
          used_days: Math.max(0, (balData.used_days || 0) - daysToReturn)
        }).eq('id', balData.id);
      }
    }

    await sb.from('leave_requests').update({
      status: 'cancelled',
      approval_comment: `[ยกเลิกโดย HR] ${reason.trim()}`
    }).eq('id', leaveId);

    await Swal.fire('ยกเลิกใบลาแล้ว', 'ทำรายการยกเลิกเรียบร้อย', 'success');
    loadPendingLeavesHR();

  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

/* ==========================================================================
   🔵 5. CANCELLATION WORKFLOW HANDLERS
   ========================================================================== */

async function approveCancellation(leaveId) {
  const result = await Swal.fire({
    title: 'ยืนยันอนุมัติการยกเลิกใบลา?',
    text: "ระบบจะทำรายการยกเลิกใบลา และคืนจำนวนวันลาที่หักไปกลับเข้าโควตาพนักงานทันที",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: '✔️ อนุมัติยกเลิก (คืนโควตา)',
    cancelButtonText: 'ยกเลิก'
  });

  if (!result.isConfirmed) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  Swal.fire({
    title: 'กำลังคืนโควตาวันลา...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { data: reqData, error: reqErr } = await sb
      .from('leave_requests')
      .select('*')
      .eq('id', leaveId)
      .single();

    if (reqErr || !reqData) throw new Error("ไม่พบข้อมูลใบลา");

    const daysToReturn = await getEffectiveLeaveDays(reqData);
    const currentYear = getADYear(reqData.start_date);

    const { data: balData } = await sb
      .from('leave_balances')
      .select('id, remaining_days, used_days')
      .eq('employee_id', reqData.employee_id)
      .eq('leave_type_id', reqData.leave_type_id)
      .eq('year', currentYear)
      .maybeSingle();

    if (balData) {
      const newUsed = Math.max(0, (balData.used_days || 0) - daysToReturn);
      const newRemaining = (balData.remaining_days || 0) + daysToReturn;

      await sb
        .from('leave_balances')
        .update({ remaining_days: newRemaining, used_days: newUsed })
        .eq('id', balData.id);
    }

    const { error: updateErr } = await sb
      .from('leave_requests')
      .update({
        status: 'cancelled',
        approval_comment: '[อนุมัติยกเลิกคำร้อง] คืนวันลาเข้าระบบเรียบร้อย',
        approved_at: new Date().toISOString()
      })
      .eq('id', leaveId);

    if (updateErr) throw updateErr;

    await Swal.fire('ยกเลิกใบลาสำเร็จ!', `อนุมัติการยกเลิกเรียบร้อยแล้ว คืนโควตาวันลาจำนวน ${daysToReturn} วัน ให้พนักงานแล้ว`, 'success');
    loadPendingLeavesHR();

  } catch (err) {
    console.error("💥 Approve Cancellation Error:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถยกเลิกได้', 'error');
  }
}

async function rejectCancellation(leaveId) {
  const { value: reason } = await Swal.fire({
    title: 'ปฏิเสธคำร้องขอยกเลิก',
    input: 'textarea',
    inputLabel: 'โปรดระบุเหตุผลที่ไม่อนุมัติให้ยกเลิก:',
    inputPlaceholder: 'พิมพ์เหตุผลที่นี่...',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: '❌ ยืนยันปฏิเสธ',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => { if (!value) return 'กรุณาระบุเหตุผลด้วยครับ!' }
  });

  if (!reason) return;
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { error } = await sb
      .from('leave_requests')
      .update({
        status: 'approved',
        approval_comment: `[ไม่อนุมัติให้ยกเลิก] ${reason.trim()}`
      })
      .eq('id', leaveId);

    if (error) throw error;

    await Swal.fire('ปฏิเสธคำร้องแล้ว', 'ใบลาจะยังคงสถานะอนุมัติตามเดิม', 'success');
    loadPendingLeavesHR();

  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

/* ==========================================================================
   🖨️ 6. PRINT LEAVE DOCUMENT (A4 PRINT VIEW)
   ========================================================================== */

async function printLeaveA4(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { data: req, error } = await sb
      .from('leave_requests')
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, departments(department_name), positions(position_name) ),
        leave_types ( leave_name )
      `)
      .eq('id', leaveId)
      .single();

    if (error || !req) throw new Error("ไม่พบข้อมูลเอกสารใบลา");

    const emp = req.employees || {};
    const printDays = req.actual_days || req.days_requested || req.total_days || 0;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>ใบขออนุมัติลา - ${emp.full_name || 'พนักงาน'}</title>
        <style>
          body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 40px; color: #000; }
          .a4-page { width: 210mm; min-height: 297mm; margin: auto; padding: 20mm; background: #fff; box-sizing: border-box; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
          .header h2 { margin: 0; font-size: 22px; }
          .header p { margin: 5px 0 0 0; font-size: 14px; color: #555; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .info-table td { padding: 10px; font-size: 15px; border-bottom: 1px solid #ddd; }
          .info-table td.title { font-weight: bold; width: 25%; background: #f9f9f9; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
          .sig-box { text-align: center; width: 30%; }
          .sig-line { border-bottom: 1px solid #000; height: 50px; margin-bottom: 8px; }
          @media print { .a4-page { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="a4-page">
          <div class="header">
            <h2>เอกสารใบขออนุมัติลาหยุดงาน</h2>
            <p>PVT WORKFORCE MANAGEMENT SYSTEM</p>
          </div>

          <table class="info-table">
            <tr><td class="title">รหัสพนักงาน:</td><td>${emp.employee_code || '-'}</td></tr>
            <tr><td class="title">ชื่อ-นามสกุล:</td><td>${emp.full_name || '-'}</td></tr>
            <tr><td class="title">แผนก/ตำแหน่ง:</td><td>${emp.departments?.department_name || '-'} / ${emp.positions?.position_name || '-'}</td></tr>
            <tr><td class="title">ประเภทการลา:</td><td>${req.leave_types?.leave_name || '-'}</td></tr>
            <tr><td class="title">วันที่ลา:</td><td>${new Date(req.start_date).toLocaleDateString('th-TH')} ถึง ${new Date(req.end_date).toLocaleDateString('th-TH')} (${printDays} วัน)</td></tr>
            <tr><td class="title">เหตุผลการลา:</td><td>${req.reason || '-'}</td></tr>
            <tr><td class="title">สถานะการอนุมัติ:</td><td>${req.status.toUpperCase()}</td></tr>
            <tr><td class="title">หมายเหตุผู้พิจารณา:</td><td>${req.approval_comment || '-'}</td></tr>
          </table>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div>( ${emp.full_name || 'ผู้ขอลา'} )</div>
              <div>ผู้ยื่นคำขอ</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div>( .................................... )</div>
              <div>หัวหน้างาน / ผู้จัดการ</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div>( .................................... )</div>
              <div>ฝ่ายทรัพยากรบุคคล (HR)</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();

  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

/* ==========================================================================
   🚪 7. GLOBAL EXPORTS & LOGOUT
   ========================================================================== */

window.approveLeave = approveLeave;
window.rejectLeave = rejectLeave;
window.cancelLeaveHR = cancelLeaveHR;
window.approveCancellation = approveCancellation;
window.rejectCancellation = rejectCancellation;
window.printLeaveA4 = printLeaveA4;
window.loadPendingLeavesHR = loadPendingLeavesHR;

window.handleLogout = function() {
  Swal.fire({
    title: 'ยืนยันการออกจากระบบ',
    text: 'คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  }).then((result) => {
    if (result.isConfirmed) {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/pages/index.html";
    }
  });
};