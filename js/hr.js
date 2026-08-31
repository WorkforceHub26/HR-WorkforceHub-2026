// ============================================================================
// 🚀 PVT HR System - [FULL ROLE-BASED APPROVALS & CANCELLATION WORKFLOW]
// ============================================================================

let currentRole = "hr"; 
let currentUserProfile = null;
let allLeaveRequests = []; 
let currentLeaveTab = "pending"; // 'pending' | 'cancellation' | 'history'
let hasExecutiveColumn = false;
let deptApproversMap = {};

// ⚡ [1. IMMEDIATE CHECK]: เช็กสิทธิ์ทันทีตั้งแต่นาทีแรกที่โหลด JS
(function checkRoleImmediately() {
  try {
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = sessionUser?.employees || sessionUser || {};
    
    const fastRole = String(sessionUser?.role || empData?.role || "").toLowerCase();
    const fastPosition = String(empData?.positions?.position_name || empData?.position_name || "").toLowerCase();

    const isAllowedRole = (
      fastRole === "hr" || fastRole === "admin" || fastRole === "director" || 
      fastRole === "manager" || fastRole === "leader" || fastRole === "executive" || fastRole === "owner" ||
      fastPosition.includes("ผู้จัดการ") || fastPosition.includes("ผู้อำนวยการ") || fastPosition.includes("หัวหน้า") || fastPosition.includes("บริหาร")
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
        confirmButtonColor: '#06b6d4',
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

    // ตรวจสอบกับ department_approvers เพื่อความแม่นยำของสายอนุมัติ
    const sb = window.pvtSupabase?.getClient();
    let isDeptSupervisor = false;
    let isDeptManager = false;
    if (sb && empData?.id) {
      try {
        const { data: apprvList } = await sb.from("department_approvers").select("department_id, supervisor_id, manager_id");
        if (apprvList && apprvList.length > 0) {
          deptApproversMap = {};
          apprvList.forEach(a => {
            if (a.department_id) deptApproversMap[a.department_id] = a;
          });
          isDeptSupervisor = apprvList.some(a => String(a.supervisor_id) === String(empData.id));
          isDeptManager = apprvList.some(a => String(a.manager_id) === String(empData.id));
        }
      } catch (e) {
        console.warn("Error checking approver list:", e);
      }
    }

    // กำหนดกลุ่ม Role เพื่อใช้ในการ Filter ข้อมูล
    if (rawRole === "hr" || rawRole === "admin" || rawRole === "superadmin" || rawRole.includes("hr") || rawRole.includes("admin")) {
      currentRole = "hr";
    } else if (rawRole === "director" || rawRole === "executive" || rawRole === "owner" || rawPos.includes("ผู้อำนวยการ") || rawPos.includes("บริหาร") || rawPos.includes("director") || rawPos.includes("executive") || rawPos.includes("owner")) {
      currentRole = "director";
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
    if (userAvatarEl) userAvatarEl.src = getAvatarUrl(empData?.image_url);

    applyRoleBasedUI();
    
    // โหลดข้อมูลใบลา
    await loadPendingLeavesHR();

  } catch (err) {
    console.error("💥 Error during HR System Init:", err);
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
      if (window.innerWidth <= 768) {
        mainContent.style.setProperty("padding", "16px 12px", "important");
      } else {
        mainContent.style.setProperty("padding", "24px 32px", "important");
      }
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

  // โหลดรายชื่อพนักงานในแผนก
  renderDepartmentTeamRoster();
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

function getAttachmentUrl(reqData) {
  if (!reqData) return null;
  let url = reqData.attachment_url || reqData.file_url || reqData.attachment || reqData.medical_certificate || null;
  if (!url || String(url).trim() === '' || url === 'null' || url === 'undefined') return null;
  
  url = String(url).trim();
  if (!url.startsWith('http') && !url.startsWith('data:')) {
    url = `https://pgogmhqjdchakcytsomx.supabase.co/storage/v1/object/public/leave-attachments/${url}`;
  }
  return url;
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
      const isSaturday = (dayOfWeek === 6);
      const isSpecialHoliday = holidaySet.has(currentIsoString);

      if (!isSunday && !isSaturday && !isSpecialHoliday) {
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

/* ==========================================================================
   📊 2. DATA FETCHING & TAB BADGES
   ========================================================================== */

async function loadPendingLeavesHR() {
  const container = document.getElementById("leaveListContainer");
  if (!container) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    container.innerHTML = `<div class="empty-state">❌ ระบบฐานข้อมูลไม่พร้อมใช้งาน</div>`;
    return;
  }

  try {
    // แสดงสถานะ Loading ระหว่างดึงข้อมูล
    container.innerHTML = `
      <div style="padding: 100px 0; text-align: center; color: var(--text-soft);">
        <div class="pvt-loader" style="margin: 0 auto 20px;"></div>
        <p>กำลังดึงข้อมูลใบลา...</p>
      </div>`;

    const { data, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( 
          id, full_name, employee_code, nickname, role, image_url,
          department_id, 
          departments!department_id (id, department_name), 
          positions!position_id (position_name) 
        ),
        leave_types!leave_type_id (id, leave_name, leave_code) 
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Supabase Select Error:", error);
      throw error;
    }
    
    let rawData = data || [];
    console.log("[HR Load] Fetch success. Total records from DB:", rawData.length);

    // ระบุตัวตนของผู้ใช้งานปัจจุบันให้ชัดเจน (ต้องเป็น Employee UUID)
    const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const myEmp = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    const currentEmpId = myEmp?.id;
    const myDeptId = myEmp?.department_id;
    const myDeptName = myEmp?.departments?.department_name || myEmp?.department_name;

    const userRole = (currentRole || '').toLowerCase();
    const isHrOrAdmin = (userRole === "hr" || userRole === "admin");

    // ถ้าไม่ใช่ HR/Admin ให้กรองเห็นเฉพาะลูกน้อง (Subordinates) ตามโครงสร้างองค์กร
    if (!isHrOrAdmin) {
      console.log("[HR Load] Applying hierarchical filters for:", userRole);
      rawData = rawData.filter((req) => {
        const reqEmp = req.employees;
        if (!reqEmp) return false;

        const reqEmpId = reqEmp.id;
        const reqEmpRole = String(reqEmp.role || "").toLowerCase();
        const reqDeptId = reqEmp.department_id;
        const reqDeptName = reqEmp.departments?.department_name;

        // 1. ห้ามเห็นใบลาของตัวเองในหน้านี้ (ให้ไปดูในหน้าประวัติส่วนตัว)
        const isNotSelf = currentEmpId ? String(reqEmpId) !== String(currentEmpId) : true;
        if (!isNotSelf) return false;
        
        let isSubordinate = false;

        if (userRole === "leader") {
          // Leader เห็นเฉพาะพนักงาน (User) ในแผนกเดียวกัน
          const isSameDept = (myDeptId || myDeptName) 
            ? (String(reqDeptId) === String(myDeptId) || String(reqDeptName).toLowerCase() === String(myDeptName).toLowerCase())
            : true;
          isSubordinate = isSameDept && (reqEmpRole === "user" || reqEmpRole === "");
        } 
        else if (userRole === "manager") {
          // Manager เห็นทั้ง User และ Leader ในแผนกตัวเอง
          const isSameDept = (myDeptId || myDeptName) 
            ? (String(reqDeptId) === String(myDeptId) || String(reqDeptName).toLowerCase() === String(myDeptName).toLowerCase())
            : true;
          isSubordinate = isSameDept && (reqEmpRole === "user" || reqEmpRole === "leader" || reqEmpRole === "");
        } 
        else if (userRole === "director" || userRole === "executive" || userRole === "owner") {
          // ระดับบริหาร เห็น Leader/Manager ทั่วองค์กร และเห็นพนักงานทุกคนในแผนกตัวเอง (ถ้ามี)
          const isOrgSub = (reqEmpRole === "leader" || reqEmpRole === "manager" || reqEmpRole === "user");
          isSubordinate = isOrgSub; 
        }

        return isSubordinate;
      });
      console.log("[HR Load] Post-filter records:", rawData.length);
    }

    allLeaveRequests = rawData;
    hasExecutiveColumn = rawData.length > 0 && rawData.some(r => r.hasOwnProperty('executive_status'));
    
    updateTabAndStatBadges();
    renderLeaveTable();

  } catch (err) {
    console.error("💥 Critical Failure in loadPendingLeavesHR:", err);
    if (container) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px;">
          <span class="material-symbols-outlined" style="font-size: 48px; color: var(--danger); margin-bottom: 16px;">error</span>
          <h3 style="margin-bottom: 8px;">ไม่สามารถโหลดข้อมูลได้</h3>
          <p style="color: var(--text-soft); font-size: 14px;">${err.message}</p>
          <button onclick="loadPendingLeavesHR()" class="btn-primary" style="margin-top: 20px; padding: 8px 24px;">🔄 ลองใหม่อีกครั้ง</button>
        </div>`;
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
   🔒 SEQUENTIAL APPROVAL GUARD (UPDATED FOR FLEXIBLE WORKFLOW)
   ========================================================================== */

function canApproveStep(req, role) {
  // ดึงข้อมูลผู้ใช้งานปัจจุบันที่กำลังกดปุ่ม
  const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const sessionUser = savedSession ? JSON.parse(savedSession) : {};
  const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
  const currentEmpId = empData?.id || empData?.employee_id || currentUserProfile?.employee_id;

  // 🛑 1. ป้องกันการกดอนุมัติใบลาของตัวเอง (Self-Approval Guard)
  if (currentEmpId && String(req.employee_id) === String(currentEmpId)) {
    Swal.fire({
      title: 'ไม่สามารถทำรายการได้',
      text: 'คุณไม่สามารถกดอนุมัติใบลาของตนเองได้ กรุณาให้ผู้จัดการฝ่าย หรือ ผู้บริหาร/HR เป็นผู้อนุมัติ',
      icon: 'warning',
      confirmButtonColor: '#06b6d4'
    });
    return false;
  }

  // ดึงสถานะปัจจุบันของแต่ละขั้น
  const isL1Approved = req.manager_status === 'approved';
  const isL2Approved = req.director_status === 'approved';
  const isL3Approved = req.executive_status === 'approved';
  const isFinalApproved = req.status === 'approved';

  // 🔵 2. กรณีหัวหน้างาน (L1 Leader) กำลังพิจารณา
  if (role === 'leader') {
    if (isL1Approved) {
      Swal.fire('ดำเนินการแล้ว', 'คำขอนี้หัวหน้างาน (L1) ได้พิจารณาอนุมัติเรียบร้อยแล้ว อยู่ในขั้นตอนของผู้จัดการฝ่าย/HR', 'info');
      return false;
    }
  }

  // 🔵 3. กรณีผู้จัดการ (L2 Manager) กำลังพิจารณา
  if (role === 'manager') {
    if (isL2Approved) {
      Swal.fire('ดำเนินการแล้ว', 'คำขอนี้ผู้จัดการฝ่าย (L2) ได้พิจารณาอนุมัติเรียบร้อยแล้ว อยู่ในขั้นตอนของ HR/ผู้บริหาร', 'info');
      return false;
    }
    // หาก L1 ยังไม่ได้รับอนุมัติ ผู้จัดการมีสิทธิ์พิจารณาอนุมัติแทนหรืออนุมัติข้ามขั้นได้ทันที
  }

  // 🟡 4. กรณีผู้บริหาร (L3 Executive / Director) กำลังพิจารณา
  if (role === 'director' || role === 'executive' || role === 'owner') {
    if (isL3Approved || isFinalApproved) {
      Swal.fire('ดำเนินการแล้ว', 'คำขอนี้ได้รับการอนุมัติเรียบร้อยแล้ว', 'info');
      return false;
    }
  }

  // 🟢 5. กรณีฝ่ายบุคคล (HR / Admin) กำลังพิจารณา
  if (role === 'hr' || role === 'admin') {
    if (isFinalApproved) {
      Swal.fire('ดำเนินการแล้ว', 'ใบลาฉบับนี้ได้รับการอนุมัติขั้นสุดท้ายแล้ว', 'info');
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
        <option value="pending_manager">1. รอหัวหน้าแผนกอนุมัติ (L1)</option>
        <option value="pending_director">2. หัวหน้าผ่านแล้ว / รอผู้จัดการอนุมัติ (L2)</option>
        <option value="pending_executive">3. ผู้จัดการผ่านแล้ว / รอผู้บริหารอนุมัติ (L3)</option>
        <option value="pending_hr">4. ผู้บริหารผ่านแล้ว / รอ HR อนุมัติขั้นสุดท้าย (L4)</option>
        <option value="fully_approved">อนุมัติครบทุกระดับแล้ว</option>
        <option value="rejected">ถูกปฏิเสธ (Rejected)</option>
      `;
    } else if (!hasExecutiveColumn && selectFilter.dataset.hasExecutive) {
      delete selectFilter.dataset.hasExecutive;
      selectFilter.innerHTML = `
        <option value="all">-- แสดงทั้งหมด --</option>
        <option value="pending_manager">1. รอหัวหน้าแผนกอนุมัติ (L1)</option>
        <option value="pending_director">2. หัวหน้าผ่านแล้ว / รอผู้จัดการอนุมัติ (L2)</option>
        <option value="pending_hr">3. ผู้จัดการผ่านแล้ว / รอ HR อนุมัติขั้นสุดท้าย (L3)</option>
        <option value="fully_approved">อนุมัติครบทุกระดับแล้ว</option>
        <option value="rejected">ถูกปฏิเสธ (Rejected)</option>
      `;
    }
  }

  let filteredRequests = [];

  if (currentLeaveTab === "pending") {
    filteredRequests = allLeaveRequests.filter(r => isPendingStatus(r.status));
  } else if (currentLeaveTab === "cancellation") {
    filteredRequests = allLeaveRequests.filter(r => isCancelRequestStatus(r.status));
  } else {
    filteredRequests = allLeaveRequests.filter(r => !isPendingStatus(r.status) && !isCancelRequestStatus(r.status));
  }

  if (stepFilter !== "all") {
    filteredRequests = filteredRequests.filter(req => {
      const mStatus = req.manager_status || 'pending';
      const dStatus = req.director_status || 'pending';
      const execStatus = req.executive_status || 'pending';
      const hrStatus = req.status || 'pending';

      const applicantRole = String(req.employees?.role || '').toLowerCase();
      const isApplicantLeaderOrManager = ['leader', 'manager'].includes(applicantRole);

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
    container.innerHTML = `<div class="empty-state" style="padding: 80px 20px; text-align: center; color: var(--text-soft); font-style: italic;">
      <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.2; display: block; margin-bottom: 12px;">inbox</span>
      ไม่พบรายการใบลาตามเงื่อนไขที่เลือก
    </div>`;
    return;
  }

  let cardsContent = "";
  filteredRequests.forEach((req) => {
    const empName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
    const empCode = req.employees ? req.employees.employee_code : "-";
    const empDeptName = req.employees?.departments?.department_name || "-";
    const empPositionName = req.employees?.positions?.position_name || "-";
    const leaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุ";
    const startDate = formatThaiDate(req.start_date);
    const endDate = formatThaiDate(req.end_date);
    const avatarUrl = getAvatarUrl(req.employees?.image_url);
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

    let actionButtons = "";

    if (currentLeaveTab === "cancellation") {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')" title="ดูรายละเอียด"><span class="material-symbols-outlined">visibility</span></button>
          <button class="btn-act btn-act-print" onclick="printLeaveA4('${req.id}')" title="พิมพ์ใบลา" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;"><span class="material-symbols-outlined">print</span></button>
          <button class="btn-act btn-act-approve" onclick="approveCancellation('${req.id}')"><span class="material-symbols-outlined">check_circle</span> อนุมัติยกเลิก</button>
          <button class="btn-act btn-act-reject" onclick="rejectCancellation('${req.id}')"><span class="material-symbols-outlined">cancel</span> ปฏิเสธ</button>
        </div>
      `;
    } else if (currentLeaveTab === "history") {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')" title="ดูรายละเอียด"><span class="material-symbols-outlined">visibility</span> รายละเอียด</button>
          <button class="btn-act btn-act-print" onclick="printLeaveA4('${req.id}')" title="พิมพ์ใบลา" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;"><span class="material-symbols-outlined">print</span> พิมพ์</button>
          ${req.status === 'approved' ? `
            <button class="btn-act btn-act-cancel" onclick="forceCancelLeave('${req.id}')"><span class="material-symbols-outlined">block</span> ยกเลิกใบลา</button>
          ` : ''}
        </div>
      `;
    } else {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')" title="ดูรายละเอียด"><span class="material-symbols-outlined">visibility</span></button>
          <button class="btn-act btn-act-print" onclick="printLeaveA4('${req.id}')" title="พิมพ์ใบลา" style="background:#f1f5f9; color:#475569; border-color:#e2e8f0;"><span class="material-symbols-outlined">print</span></button>
          <button class="btn-act btn-act-approve" onclick="approveLeave('${req.id}')" title="อนุมัติ"><span class="material-symbols-outlined">check_circle</span> อนุมัติ</button>
          <button class="btn-act btn-act-reject" onclick="rejectLeave('${req.id}')" title="ปฏิเสธ"><span class="material-symbols-outlined">cancel</span> ไม่อนุมัติ</button>
        </div>
      `;
    }

    const isApplicantLeaderOrManager = ['leader', 'manager'].includes(String(req.employees?.role || '').toLowerCase());
    let executiveStatusHTML = "-";
    if (isApplicantLeaderOrManager) {
      executiveStatusHTML = getStatusBadgeHTML(req.executive_status);
    }

    cardsContent += `
      <div class="leave-card-item">
        <!-- Zone 1: Profile & Emp Info -->
        <div class="card-zone profile-zone">
          <img src="${avatarUrl}" class="card-avatar" onerror="this.src='/assets/img/default-avatar.jpg';">
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
          <div class="detail-row reason-row">
            <span class="label">เหตุผล:</span>
            <span class="val text-truncate-2">${req.reason || "-"}</span>
            <div class="attachment-trigger">
              ${renderAttachmentCell(attachmentUrl, req.id)}
            </div>
          </div>
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
          <div class="status-steps-grid">
            ${(() => {
              const reqDeptId = req.department_id || req.employees?.department_id;
              const reqDeptInfo = deptApproversMap[reqDeptId];
              const hasL1 = reqDeptInfo ? Boolean(reqDeptInfo.supervisor_id) : true;
              const hasL2 = reqDeptInfo ? Boolean(reqDeptInfo.manager_id) : true;

              let stepsHtml = '';
              let stepIdx = 1;

              if (hasL1) {
                stepsHtml += `
                  <div class="step-item">
                    <span class="step-lbl">หัวหน้า (L${stepIdx})</span>
                    ${getStatusBadgeHTML(req.manager_status)}
                  </div>
                `;
                stepIdx++;
              }

              if (hasL2) {
                stepsHtml += `
                  <div class="step-item">
                    <span class="step-lbl">ผู้จัดการ (L${stepIdx})</span>
                    ${getStatusBadgeHTML(req.director_status)}
                  </div>
                `;
                stepIdx++;
              }

              if (hasExecutiveColumn && isApplicantLeaderOrManager) {
                stepsHtml += `
                  <div class="step-item">
                    <span class="step-lbl">บริหาร (L${stepIdx})</span>
                    <div class="badge-mini">${executiveStatusHTML}</div>
                  </div>
                `;
                stepIdx++;
              }

              stepsHtml += `
                <div class="step-item">
                  <span class="step-lbl">HR (L${stepIdx})</span>
                  ${getStatusBadgeHTML(req.status)}
                </div>
              `;

              return stepsHtml;
            })()}
          </div>
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
      <div class="col-status-group">สถานะการอนุมัติ (L1-L4)</div>
      <div class="col-actions">การจัดการ</div>
    </div>
  `;
  container.innerHTML = listHeader + `<div class="leave-cards-container">${cardsContent}</div>`;
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

function previewLeaveModal(leaveId) {
  const req = allLeaveRequests.find(r => r.id === leaveId);
  if (!req) return;

  const modal = document.getElementById("leavePreviewModal");
  const modalBody = document.getElementById("leavePreviewModalBody");
  const btnPrint = document.getElementById("btnModalPrint");

  if (!modal || !modalBody) return;

  const emp = req.employees || {};
  const avatarUrl = getAvatarUrl(emp.image_url);
  const displayDays = req.actual_days || req.days_requested || req.total_days || 0;
  const friendlyDuration = window.PVTSDK?.formatLeaveDurationFriendly ? window.PVTSDK.formatLeaveDurationFriendly(displayDays, req.leave_hours || 0) : `${displayDays} วัน`;
  const leaveName = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุประเภทการลา";
  const attachUrl = getAttachmentUrl(req);
  const isImage = attachUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachUrl.split('?')[0]);

  modalBody.innerHTML = `
    <div class="preview-user-card">
      <img src="${avatarUrl}" class="preview-avatar" onerror="this.src='/assets/img/default-avatar.jpg';">
      <div class="preview-user-info">
        <h4>${emp.full_name || 'ไม่ระบุชื่อ'} ${emp.nickname ? `(${emp.nickname})` : ''}</h4>
        <p>รหัสพนักงาน: <strong>${emp.employee_code || '-'}</strong> | แผนก: ${emp.departments?.department_name || '-'} | ตำแหน่ง: ${emp.positions?.position_name || '-'}</p>
      </div>
    </div>

    <div class="preview-grid">
      <div class="preview-item">
        <label>ประเภทการลา</label>
        <div style="color: var(--primary); font-weight:700;">${leaveName}</div>
      </div>
      <div class="preview-item">
        <label>ระยะเวลาการลา</label>
        <div style="font-weight:700; color:var(--text);">${friendlyDuration}</div>
      </div>
      <div class="preview-item">
        <label>ตั้งแต่วันที่</label>
        <div>${formatThaiDate(req.start_date)}</div>
      </div>
      <div class="preview-item">
        <label>ถึงวันที่</label>
        <div>${formatThaiDate(req.end_date)}</div>
      </div>
    </div>

    <div class="preview-item" style="margin-bottom: 16px;">
      <label>เหตุผล / หมายเหตุประกอบการลา</label>
      <div style="font-weight: 400; line-height: 1.5; color: var(--text);">${req.reason || 'ไม่ได้ระบุเหตุผล'}</div>
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

    <div style="margin-bottom: 16px;">
      <label style="font-size: 12px; font-weight: 700; color: var(--text-soft); display: block; margin-bottom: 6px;">สถานะการอนุมัติตามลำดับขั้น</label>
      <div class="workflow-steps">
        ${(() => {
          const reqDeptId = req.department_id || req.employees?.department_id;
          const reqDeptInfo = deptApproversMap[reqDeptId];
          const hasL1 = reqDeptInfo ? Boolean(reqDeptInfo.supervisor_id) : true;
          const hasL2 = reqDeptInfo ? Boolean(reqDeptInfo.manager_id) : true;

          let modalStepsHtml = '';
          let modalStepNum = 1;

          if (hasL1) {
            modalStepsHtml += `
              <div class="step-card">
                <span class="role-title">${modalStepNum}. หัวหน้าแผนก (L${modalStepNum})</span>
                ${getStatusBadgeHTML(req.manager_status)}
              </div>
            `;
            modalStepNum++;
          }

          if (hasL2) {
            modalStepsHtml += `
              <div class="step-card">
                <span class="role-title">${modalStepNum}. ผู้จัดการฝ่าย (L${modalStepNum})</span>
                ${getStatusBadgeHTML(req.director_status)}
              </div>
            `;
            modalStepNum++;
          }

          if (hasExecutiveColumn && ['leader', 'manager'].includes(String(req.employees?.role || '').toLowerCase())) {
            modalStepsHtml += `
              <div class="step-card">
                <span class="role-title">${modalStepNum}. ผู้บริหาร (L${modalStepNum})</span>
                ${getStatusBadgeHTML(req.executive_status)}
              </div>
            `;
            modalStepNum++;
          }

          modalStepsHtml += `
            <div class="step-card">
              <span class="role-title">${modalStepNum}. ฝ่าย HR (L${modalStepNum})</span>
              ${getStatusBadgeHTML(req.status)}
            </div>
          `;

          return modalStepsHtml;
        })()}
      </div>
    </div>

    <div>
      <label style="font-size: 12px; font-weight: 700; color: var(--text-soft); display: block; margin-bottom: 6px;">หลักฐานแนบประกอบการลา</label>
      ${attachUrl ? `
        <div class="preview-attachment-box">
          ${isImage ? `
            <img src="${attachUrl}" class="preview-attachment-img" alt="หลักฐานการลา" onclick="openImageLightbox('${attachUrl}', 'รายการ #${req.id}')">
            <p style="font-size:11px; color:var(--text-soft); margin-top:6px;">(คลิกรูปเพื่อดูขนาดเต็ม)</p>
          ` : `
            <a href="${attachUrl}" target="_blank" style="color: var(--primary); font-weight: 600; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined">attach_file</span> เปิดดูเอกสารแนบ
            </a>
          `}
        </div>
      ` : `
        <div class="preview-attachment-none">ไม่มีหลักฐานแนบ</div>
      `}
    </div>
  `;

  if (btnPrint) {
    btnPrint.onclick = () => {
      closePreviewModal();
      printLeaveA4(req.id);
    };
  }

  modal.classList.add("active");
}

function closePreviewModal() {
  const modal = document.getElementById("leavePreviewModal");
  if (modal) modal.classList.remove("active");
}

/* ==========================================================================
   🔵 6. WORKFLOW ACTIONS (APPROVE / REJECT / CANCEL)
   ========================================================================== */

async function approveLeave(leaveId) {
  const reqData = allLeaveRequests.find(r => r.id === leaveId);
  if (!reqData) return;

  if (!canApproveStep(reqData, currentRole)) return;

  const roleTitle = currentRole === 'leader' 
    ? 'หัวหน้างาน (L1)' 
    : currentRole === 'manager' 
    ? 'ผู้จัดการฝ่าย (L2)' 
    : (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner')
    ? 'ผู้บริหาร (L3)'
    : 'ฝ่ายบุคคล HR / Admin';

  const result = await Swal.fire({
    title: 'ยืนยันอนุมัติใบลา?',
    text: `คุณกำลังอนุมัติในฐานะ ${roleTitle}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: '✔️ ยืนยันอนุมัติ',
    cancelButtonText: 'ยกเลิก'
  });

  if (!result.isConfirmed) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  try {
    let updateFields = {};

    // 🛡️ ตรวจสอบและสร้างโควตาวันลาใน leave_balances อัตโนมัติ (รองรับทั้งปี ค.ศ. และ พ.ศ. 2569) เพื่อป้องกัน Trigger Error
    if (window.PVTSDK?.user?.ensureLeaveBalances) {
      await window.PVTSDK.user.ensureLeaveBalances(reqData.employee_id, reqData.start_date);
    }

    if (currentRole === 'leader') {
      // ✅ L1 อนุมัติ (หัวหน้างาน / Supervisor)
      updateFields.manager_status = 'approved';

      // 🔀 ตรวจสายอนุมัติของแผนกจาก department_approvers
      // ถ้าแผนกนี้ไม่มี L2 ให้ข้าม L2 และส่งต่อไป HR ทันที
      const deptId = reqData.employees?.department_id || null;

      if (deptId) {
        const { data: approverConfig, error: approverConfigError } = await sb
          .from('department_approvers')
          .select('supervisor_id, manager_id')
          .eq('department_id', deptId)
          .maybeSingle();

        if (approverConfigError) throw approverConfigError;

        if (!approverConfig?.manager_id) {
          console.log('ℹ️ [Approval Routing] แผนกนี้ไม่มี L2 → ข้ามไป HR');
          updateFields.director_status = 'approved';
          if (hasExecutiveColumn) {
            updateFields.executive_status = 'approved';
          }
        }
      }
    } else if (currentRole === 'manager') {
      // ✅ L2 อนุมัติ (ผู้จัดการฝ่าย / Department Manager)
      updateFields.director_status = 'approved';
      if (reqData.manager_status !== 'approved') {
        updateFields.manager_status = 'approved';
      }
      if (hasExecutiveColumn) {
        const applicantRole = String(reqData.employees?.role || '').toLowerCase();
        const isApplicantLeaderOrManager = ['leader', 'manager'].includes(applicantRole);
        if (!isApplicantLeaderOrManager) {
          updateFields.executive_status = 'approved';
        }
      }
    } else if (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner') {
      // ✅ L3 อนุมัติ (ผู้บริหารระดับสูง / Director / Executive)
      if (reqData.manager_status !== 'approved') updateFields.manager_status = 'approved';
      if (reqData.director_status !== 'approved') updateFields.director_status = 'approved';
      if (hasExecutiveColumn) {
        updateFields.executive_status = 'approved';
      } else {
        updateFields.status = 'approved';
        updateFields.approved_at = new Date().toISOString();
      }
    } else {
      // ✅ L4 / ขั้นสุดท้าย (ฝ่ายบุคคล HR / Super Admin)
      if (reqData.manager_status !== 'approved') updateFields.manager_status = 'approved';
      if (reqData.director_status !== 'approved') updateFields.director_status = 'approved';
      if (hasExecutiveColumn) updateFields.executive_status = 'approved';
      updateFields.status = 'approved';
      updateFields.approved_at = new Date().toISOString();
    }

    // หักยอดวันลาหากได้รับการอนุมัติขั้นสุดท้ายเรียบร้อยแล้ว (status = approved)
    if (updateFields.status === 'approved') {
      const leaveDays = await getEffectiveLeaveDays(reqData);
      const currentYear = getADYear(reqData.start_date);

      const { data: balDataList } = await sb
        .from('leave_balances')
        .select('id, remaining_days, used_days')
        .eq('employee_id', reqData.employee_id)
        .eq('leave_type_id', reqData.leave_type_id)
        .in('year', [currentYear, currentYear + 543]);

      if (balDataList && balDataList.length > 0) {
        for (const balData of balDataList) {
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

    // 🔔 บันทึกแจ้งเตือนลงฐานข้อมูล (In-app)
    const notificationTitle = `ใบลาของคุณได้รับการอนุมัติ (ขั้นสุดท้าย)`;
    const notificationMessage = `ใบลาประเภท ${reqData.leave_types?.leave_name || 'ใบลา'} วันที่ ${reqData.start_date} ได้รับการอนุมัติเรียบร้อยแล้ว`;
    
    await sb.from('notifications').insert({
      employee_id: reqData.employee_id,
      title: notificationTitle,
      message: notificationMessage,
      type: 'leave',
      link_url: '/pages/user/index-user.html'
    });

    // 💬 ส่งแจ้งเตือน LINE ผ่าน Server API
    try {
      await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: reqData.employee_id,
          title: notificationTitle,
          message: notificationMessage
        })
      });
    } catch (lineErr) {
      console.error('Error calling LINE notification API:', lineErr);
    }
    if (window.PVTSDK?.line) {
      try {
        const applicantName = reqData.employees?.full_name || 'พนักงาน';
        const applicantCode = reqData.employees?.employee_code || '';
        const applicantLineId = reqData.employees?.line_id || '';
        const leaveTypeName = reqData.leave_types?.leave_name || 'ใบลา';

        if (currentRole === 'leader') {
          // 🔀 ใช้ Manager L2 ที่ Admin กำหนดไว้ในตาราง departments
          const deptId = reqData.employees?.department_id || null;
          const deptName = reqData.employees?.departments?.department_name || '';

          let managerId = null;

          if (deptId) {
            const { data: approverConfig, error: approverError } = await sb
              .from('department_approvers')
              .select('manager_id')
              .eq('department_id', deptId)
              .maybeSingle();

            if (approverError) throw approverError;

            managerId = approverConfig?.manager_id || null;

            // มี L2 → ดึง LINE User ID และส่งแจ้งเตือน
            if (managerId) {
              const { data: managerEmp, error: managerError } = await sb
                .from('employees')
                .select('id, full_name, line_id')
                .eq('id', managerId)
                .maybeSingle();

              if (managerError) throw managerError;

              managerLineId = managerEmp?.line_id || '';

              await window.PVTSDK.line.sendWorkflowNotification({
                type: 'LEADER_APPROVED',
                recipientId: managerId,
                recipientLineId: managerLineId,
                leaveId: leaveId,
                employeeName: applicantName,
                employeeCode: applicantCode,
                departmentName: deptName,
                recipientRole: 'manager',
                leaveType: leaveTypeName,
                startDate: reqData.start_date,
                endDate: reqData.end_date,
                totalDays: reqData.total_days,
                comment: reqData.approval_comment || 'หัวหน้างานตรวจสอบแล้ว เห็นควรอนุมัติ'
              });

              if (!managerLineId) {
                console.warn('⚠️ [LINE OA] ผู้จัดการ L2 ยังไม่มี LINE User ID');
              }
            } else {
              // ไม่มี L2 → ไม่ส่ง LINE ให้ HR ตาม Requirement
              console.log('ℹ️ [LINE OA] แผนกนี้ไม่มี L2 → ข้าม LINE และส่งรายการไป HR ในระบบ');
            }
          }

        } else if (currentRole === 'manager') {
          // ผู้จัดการ L2 อนุมัติคำขอของ "หัวหน้างาน/ผู้จัดการ"
          // → แจ้งผู้บริหาร L3
          const applicantRole = String(reqData.employees?.role || '').toLowerCase();
          const needsExecutive = ['leader', 'manager'].includes(applicantRole);

          if (needsExecutive) {
            const { data: executiveSetting, error: executiveSettingError } = await sb
              .from('system_settings')
              .select('employee_id')
              .eq('setting_key', 'leave_executive_approver')
              .maybeSingle();

            if (executiveSettingError) throw executiveSettingError;

            let executiveEmp = null;

            if (executiveSetting?.employee_id) {
              const { data: executiveData, error: executiveError } = await sb
                .from('employees')
                .select('id, full_name, line_id, role')
                .eq('id', executiveSetting.employee_id)
                .maybeSingle();

              if (executiveError) throw executiveError;
              executiveEmp = executiveData || null;
            }

            if (executiveEmp) {
              await window.PVTSDK.line.sendWorkflowNotification({
                type: 'MANAGER_APPROVED',
                recipientId: executiveEmp.id,
                recipientLineId: executiveEmp.line_id || '',
                leaveId: leaveId,
                employeeName: applicantName,
                employeeCode: applicantCode,
                departmentName: reqData.employees?.departments?.department_name || '',
                recipientRole: 'executive',
                leaveType: leaveTypeName,
                startDate: reqData.start_date,
                endDate: reqData.end_date,
                totalDays: reqData.total_days,
                comment: reqData.approval_comment || 'ผู้จัดการตรวจสอบแล้ว เห็นควรอนุมัติ'
              });

              if (!executiveEmp.line_id) {
                console.warn('⚠️ [LINE OA] ผู้บริหารยังไม่มี LINE User ID');
              }
            } else {
              console.warn('⚠️ [LINE OA] ไม่พบผู้บริหาร role executive/director/owner');
            }
          }
        }
      } catch (lineErr) {
        console.warn("⚠️ [LINE OA Trigger] Approval notice error:", lineErr);
      }
    }

    // 💬 ส่งแจ้งเตือนกลับหาพนักงานเจ้าของใบลา
    if (window.PVTSDK?.line) {
      try {
        await window.PVTSDK.line.sendWorkflowNotification({
          type: 'REQUEST_APPROVED',
          recipientId: reqData.employee_id, // เจ้าของใบลา
          recipientLineId: reqData.employees?.line_id || '',
          leaveId: leaveId,
          employeeName: reqData.employees?.full_name || 'พนักงาน',
          employeeCode: reqData.employees?.employee_code || '',
          departmentName: reqData.employees?.departments?.department_name || '',
          recipientRole: 'employee',
          leaveType: reqData.leave_types?.leave_name || 'ใบลา',
          startDate: reqData.start_date,
          endDate: reqData.end_date,
          totalDays: reqData.total_days,
          comment: 'ใบลาของคุณได้รับการอนุมัติเรียบร้อยแล้ว'
        });
      } catch (lineErr) {
        console.warn("⚠️ [Workflow Notification] Approval notice error:", lineErr);
      }
    }

    await Swal.fire('อนุมัติสำเร็จ!', 'บันทึกสถานะการอนุมัติเรียบร้อยแล้ว', 'success');
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
    } else if (currentRole === 'manager') {
      updateFields.director_status = 'rejected';
    } else if (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner') {
      if (hasExecutiveColumn) {
        updateFields.executive_status = 'rejected';
      } else {
        updateFields.director_status = 'rejected';
      }
    }

    const { error } = await sb
      .from('leave_requests')
      .update(updateFields)
      .eq('id', leaveId);

    if (error) throw error;

    // 🔔 บันทึกแจ้งเตือนลงฐานข้อมูล (In-app)
    const reqData = allLeaveRequests.find(r => r.id === leaveId);
    if (reqData) {
      const notificationTitle = `ใบลาของคุณถูกปฏิเสธ`;
      const notificationMessage = `ใบลาประเภท ${reqData.leave_types?.leave_name || 'ใบลา'} วันที่ ${reqData.start_date} ไม่ได้รับการอนุมัติ\nเหตุผล: ${reason.trim()}`;
      
      await sb.from('notifications').insert({
        employee_id: reqData.employee_id,
        title: notificationTitle,
        message: notificationMessage,
        type: 'leave',
        link_url: '/pages/user/index-user.html'
      });

      // 💬 ส่งแจ้งเตือน LINE ผ่าน Server API
      try {
        await fetch('/api/send-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: reqData.employee_id,
            title: notificationTitle,
            message: notificationMessage
          })
        });
      } catch (lineErr) {
        console.error('Error calling LINE notification API:', lineErr);
      }
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
            comment: reason.trim()
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
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยันยกเลิกใบลา',
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

    const { error } = await sb
      .from('leave_requests')
      .update({ 
        status: 'cancelled',
        cancel_reason: reason.trim(),
        approval_comment: `[ยกเลิกโดย HR/ผู้ดูแล] ${reason.trim()}`
      })
      .eq('id', leaveId);

    if (error) throw error;

    await Swal.fire('สำเร็จ!', 'ทำการยกเลิกใบลาและคืนวันลาเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR();
  } catch (err) {
    console.error('Error cancelling leave:', err);
    Swal.fire('เกิดข้อผิดพลาด!', err.message || 'ไม่สามารถยกเลิกใบลาได้', 'error');
  }
}

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
   🖨️ 7. PRINT LEAVE A4 DOCUMENT
   ========================================================================== */

async function printLeaveA4(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'กำลังเตรียมเอกสารใบลา...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
      });
    }

    const { data: req, error } = await sb
      .from('leave_requests')
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, nickname, departments(department_name), positions(position_name) ),
        leave_types ( leave_name )
      `)
      .eq('id', leaveId)
      .single();

    if (error || !req) throw new Error("ไม่พบข้อมูลเอกสารใบลา");

    const emp = req.employees || {};
    const printDays = req.actual_days || req.days_requested || req.total_days || 0;
    const printDurationFormatted = window.PVTSDK?.formatLeaveDurationFriendly ? window.PVTSDK.formatLeaveDurationFriendly(printDays, req.leave_hours || 0) : `${printDays} วัน`;
    const leaveName = req.leave_types?.leave_name || 'ไม่ระบุประเภทการลา';
    const deptName = emp.departments?.department_name || '-';
    const posName = emp.positions?.position_name || '-';

    const attachUrl = getAttachmentUrl(req);
    const isImageAttachment = attachUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(attachUrl.split('?')[0]);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      if (typeof Swal !== 'undefined') Swal.close();
      alert("กรุณาอนุญาตให้เปิด Pop-up ในเบราว์เซอร์เพื่อพิมพ์เอกสาร");
      return;
    }

    const docTitle = `ใบลา_${emp.employee_code || ''}_${emp.full_name || 'พนักงาน'}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>${docTitle}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; background: #ffffff; color: #1e293b; line-height: 1.6; }
          .page { width: 210mm; min-height: 297mm; padding: 10mm; margin: 0 auto; background: #ffffff; position: relative; }
          
          .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 15px; margin-bottom: 25px; }
          .logo-area { display: flex; align-items: center; gap: 15px; }
          .logo-placeholder { width: 50px; height: 50px; background: #059669; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 24px; }
          .company-name { font-size: 22px; font-weight: 800; color: #059669; letter-spacing: -0.5px; }
          .company-sub { font-size: 12px; color: #64748b; font-weight: 500; }
          
          .doc-meta { text-align: right; font-size: 12px; color: #475569; }
          .doc-meta strong { color: #0f172a; }

          .form-title-box { text-align: center; margin: 20px 0 30px 0; border: 2px solid #e2e8f0; padding: 15px; border-radius: 12px; background: #f8fafc; }
          .form-title-box h1 { margin: 0; font-size: 22px; font-weight: 800; color: #1e293b; text-transform: uppercase; }
          
          .section { margin-bottom: 25px; }
          .section-label { font-size: 15px; font-weight: 700; color: #059669; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
          .section-label::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; margin-left: 10px; }
          
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
          .info-table td { padding: 10px 15px; font-size: 14px; border: 1px solid #e2e8f0; }
          .info-table td.label { width: 25%; background: #f1f5f9; font-weight: 600; color: #475569; }
          .info-table td.value { background: #ffffff; }

          .reason-container { padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #fafafa; font-size: 14px; min-height: 80px; }
          
          .status-indicator { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-bottom: 15px; }
          .status-approved { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
          .status-pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

          .signature-grid { margin-top: 50px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
          .sig-box { text-align: center; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 10px 15px 10px; background: #fff; }
          .sig-space { height: 60px; margin-bottom: 10px; display: flex; align-items: flex-end; justify-content: center; }
          .sig-line { width: 80%; border-bottom: 1px solid #cbd5e1; margin: 0 auto; }
          .sig-name { font-size: 13px; font-weight: 600; margin-top: 8px; }
          .sig-title { font-size: 11px; color: #64748b; margin-top: 2px; }

          .doc-footer { position: absolute; bottom: 10mm; left: 10mm; right: 10mm; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="doc-header">
            <div class="logo-area">
              <div class="logo-placeholder">PVT</div>
              <div>
                <div class="company-name">PVT WORKFORCE HUB</div>
                <div class="company-sub">บริษัท พีวีที คอร์ปอเรชั่น จำกัด (สำนักงานใหญ่)</div>
              </div>
            </div>
            <div class="doc-meta">
              เลขที่เอกสาร: <strong>LV-${String(req.id).substring(0, 8).toUpperCase()}</strong><br>
              วันที่พิมพ์: <strong>${formatThaiDate(new Date().toISOString(), true)}</strong>
            </div>
          </div>

          <div class="form-title-box">
            <h1>ใบขออนุมัติลาหยุดงาน (LEAVE REQUEST FORM)</h1>
          </div>

          <div class="section">
            <div class="section-label">ข้อมูลผู้ยื่นคำขอลา</div>
            <table class="info-table">
              <tr>
                <td class="label">รหัสพนักงาน</td>
                <td class="value"><strong>${emp.employee_code || '-'}</strong></td>
                <td class="label">ชื่อ-นามสกุล</td>
                <td class="value"><strong>${emp.full_name || '-'} ${emp.nickname ? `(${emp.nickname})` : ''}</strong></td>
              </tr>
              <tr>
                <td class="label">แผนก / สังกัด</td>
                <td class="value">${deptName}</td>
                <td class="label">ตำแหน่งงาน</td>
                <td class="value">${posName}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <div class="section-label">รายละเอียดการขอลา</div>
            <table class="info-table">
              <tr>
                <td class="label">ประเภทการลา</td>
                <td class="value"><strong style="color: #059669;">${leaveName}</strong></td>
                <td class="label">สถานะปัจจุบัน</td>
                <td class="value">
                  <span class="status-indicator ${req.status === 'approved' ? 'status-approved' : 'status-pending'}">
                    ${req.status === 'approved' ? 'อนุมัติแล้ว' : req.status === 'rejected' ? 'ปฏิเสธ' : 'รอการพิจารณา'}
                  </span>
                </td>
              </tr>
              <tr>
                <td class="label">ตั้งแต่วันที่</td>
                <td class="value"><strong>${formatThaiDate(req.start_date)}</strong></td>
                <td class="label">ถึงวันที่</td>
                <td class="value"><strong>${formatThaiDate(req.end_date)}</strong></td>
              </tr>
              <tr>
                <td class="label">รวมระยะเวลาการลา</td>
                <td class="value" colspan="3"><strong style="font-size: 16px; color: #059669;">${printDurationFormatted}</strong></td>
              </tr>
            </table>
          </div>

          <div class="section">
            <div class="section-label">เหตุผลความจำเป็น</div>
            <div class="reason-container">
              ${req.reason || 'ไม่ได้ระบุเหตุผลความจำเป็น'}
              ${req.approval_comment ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; color: #dc2626; font-size: 13px;"><strong>* ความเห็นจากผู้อนุมัติ:</strong> ${req.approval_comment}</div>` : ''}
            </div>
          </div>

          <div class="signature-grid">
            <div class="sig-box">
              <div class="sig-space"><div class="sig-line"></div></div>
              <div class="sig-name">( ${emp.full_name || 'ผู้ยื่นคำขอ'} )</div>
              <div class="sig-title">พนักงานผู้ขอลา</div>
            </div>
            <div class="sig-box">
              <div class="sig-space">
                ${req.manager_status === 'approved' ? '<span style="color:#15803d; font-weight:bold; font-size:12px;">[ อนุมัติผ่านระบบ ]</span>' : '<div class="sig-line"></div>'}
              </div>
              <div class="sig-name">( ................................................... )</div>
              <div class="sig-title">หัวหน้างาน / ผู้จัดการ</div>
            </div>
            <div class="sig-box">
              <div class="sig-space">
                ${req.status === 'approved' ? '<span style="color:#15803d; font-weight:bold; font-size:12px;">[ อนุมัติผ่านระบบ HR ]</span>' : '<div class="sig-line"></div>'}
              </div>
              <div class="sig-name">( ................................................... )</div>
              <div class="sig-title">ฝ่ายทรัพยากรบุคคล (HR)</div>
            </div>
          </div>

          <div class="doc-footer">
            เอกสารฉบับนี้พิมพ์จากระบบ PVT WORKFORCE HUB เมื่อวันที่ ${formatThaiDate(new Date().toISOString(), true)}<br>
            รหัสตรวจสอบ: ${req.id}
          </div>
        </div>

        <script>
          window.onload = function() {
            if (window.opener && window.opener.Swal) window.opener.Swal.close();
            setTimeout(() => { window.print(); }, 500);
          };
        </script>
      </body>
      </html>
    `);

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
    headerCell.value = "🏢 บริษัท พีวีที เวิร์กฟอร์ซ ฮับ | รายงานสรุปภาพรวมการลาพนักงาน (Executive Leave Dashboard)";
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

      cellV.font = { name: "Kanit", size: 13, bold: true, color: { argb: c === 3 ? "FF059669" : c === 4 ? "FFD97706" : "FF0F172A" } };
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
        "สถานะหัวหน้า (L1)",
        "สถานะผู้จัดการ (L2)",
        "สถานะสุดท้าย HR (L3)",
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
        const hrStatus = r.status === 'approved' ? 'อนุมัติครบสมบูรณ์' : r.status === 'rejected' ? 'ไม่อนุมัติ' : isCancelRequestStatus(r.status) ? 'ขอยกเลิก' : 'รอ HR พิจารณา';
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
        { width: 18 },  // L1
        { width: 18 },  // L2
        { width: 22 },  // L3
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
      confirmButtonColor: '#0fa472'
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
   👥 7.5 TEAM ROSTER FOR DEPARTMENTS
   ========================================================================== */
async function renderDepartmentTeamRoster() {
  const container = document.getElementById("hrTeamContainer");
  const titleEl = document.getElementById("hrTeamSectionTitle");
  const badgeEl = document.getElementById("hrTeamCountBadge");

  if (!container) return;

  const savedSession = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
  const sessionUser = savedSession ? JSON.parse(savedSession) : {};
  const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
  const userDeptId = empData?.department_id || currentUserProfile?.department_id;
  const userRole = currentRole || "leader";

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    let query = sb.from("employees").select("id, full_name, nickname, employee_code, image_url, line_id, role, department_id, departments(department_name), positions(position_name)").order("full_name");

    // ถ้าเป็น Leader หรือ Manager ที่ไม่ใช่ HR/Admin ให้กรองเฉพาะพนักงานในแผนกตัวเอง
    if (["leader", "manager"].includes(userRole) && userDeptId) {
      query = query.eq("department_id", userDeptId);
    }

    const { data: list, error } = await query;
    if (error || !list || list.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-soft);">ไม่พบข้อมูลพนักงานในแผนก</div>`;
      if (badgeEl) badgeEl.textContent = "0 คน";
      return;
    }

    if (badgeEl) badgeEl.textContent = `${list.length} คน`;

    if (titleEl) {
      if (["hr", "admin", "director"].includes(userRole)) {
        titleEl.textContent = "รายชื่อพนักงานในองค์กรทั้งหมด";
      } else {
        const deptName = list[0]?.departments?.department_name || "แผนกของคุณ";
        titleEl.textContent = `รายชื่อสมาชิกพนักงานในแผนก (${deptName})`;
      }
    }

    container.innerHTML = list.map(emp => {
      const avatar = getAvatarUrl(emp.image_url);
      const pos = emp.positions?.position_name || "พนักงาน";
      const deptName = emp.departments?.department_name || "-";
      const codeStr = emp.employee_code ? `รหัส: ${emp.employee_code}` : "";
      const nickStr = emp.nickname ? `(${emp.nickname})` : "";
      const roleStr = (emp.role || "").toLowerCase();

      let roleTag = '<span class="status-badge status-cancelled" style="font-size:10px; padding:2px 6px;">พนักงาน</span>';
      if (roleStr === "leader" || roleStr.includes("leader")) {
        roleTag = '<span class="status-badge status-pending" style="font-size:10px; padding:2px 6px; background:#fef3c7; color:#b45309;">👑 หัวหน้า (L1)</span>';
      } else if (roleStr === "manager" || roleStr.includes("manager")) {
        roleTag = '<span class="status-badge status-approved" style="font-size:10px; padding:2px 6px; background:#dbeafe; color:#1d4ed8;">💼 ผู้จัดการ (L2)</span>';
      } else if (["hr", "admin"].includes(roleStr)) {
        roleTag = '<span class="status-badge status-approved" style="font-size:10px; padding:2px 6px; background:#f3e8ff; color:#6b21a8;">⚙️ ฝ่ายบุคคล</span>';
      }

      const lineStatus = emp.line_id 
        ? '<span style="color:#16a34a; font-size:11px; font-weight:600;">● LINE เชื่อมแล้ว</span>'
        : '<span style="color:#94a3b8; font-size:11px;">○ ยังไม่ผูก LINE</span>';

      return `
        <div style="display:flex; align-items:center; gap:12px; padding:12px; background:#ffffff; border:1px solid var(--border); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.02);">
          <img src="${avatar}" style="width:46px; height:46px; border-radius:50%; object-fit:cover; border:2px solid var(--border-soft); flex-shrink:0;" onerror="this.src='/assets/img/default-avatar.jpg';">
          <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${escapeHtml(emp.full_name)} ${nickStr}
            </div>
            <div style="font-size:12px; color:var(--primary); font-weight:600; margin:2px 0;">
              💼 ${escapeHtml(pos)} <span style="font-weight:400; color:var(--text-soft); font-size:11px;">(${escapeHtml(deptName)})</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--text-soft);">
              <span>${codeStr}</span>
              ${lineStatus}
            </div>
            <div style="margin-top:4px;">${roleTag}</div>
          </div>
        </div>
      `;
    }).join("");

  } catch(e) {
    console.error("renderDepartmentTeamRoster error:", e);
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#ef4444;">เกิดข้อผิดพลาดในการโหลดสมาชิก</div>`;
  }
}

window.toggleHrTeamContainer = function(btn) {
  const container = document.getElementById("hrTeamContainer");
  const icon = document.getElementById("hrTeamToggleIcon");
  if (!container) return;
  if (container.style.display === "none") {
    container.style.display = "grid";
    if (icon) icon.textContent = "expand_less";
  } else {
    container.style.display = "none";
    if (icon) icon.textContent = "expand_more";
  }
};

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
window.previewLeaveModal = previewLeaveModal;
window.closePreviewModal = closePreviewModal;
window.openImageLightbox = openImageLightbox;
window.closeImageLightbox = closeImageLightbox;
window.exportLeaveReportExcel = exportLeaveReportExcel;

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
      window.location.href = "/index.html";
    }
  });
};