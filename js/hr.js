// ============================================================================
// 🚀 PVT HR System - [FULL ROLE-BASED APPROVALS & CANCELLATION WORKFLOW]
// ============================================================================

let currentRole = "hr"; 
let currentUserProfile = null;
let allLeaveRequests = []; 
let currentLeaveTab = "pending"; // 'pending' | 'cancellation' | 'history'
let hasExecutiveColumn = false;

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
  const tbody = document.getElementById("leaveRequestsBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty-state">⏳ กำลังโหลดคลังข้อมูลคำขอ...</td></tr>`;
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
    if (userRole === "leader" || userRole === "manager" || userRole === "director" || userRole === "executive" || userRole === "owner") {
      rawData = rawData.filter((req) => {
        const reqEmp = req.employees;
        if (!reqEmp) return false;

        const reqDeptId = reqEmp.department_id;
        const reqDeptName = reqEmp.departments?.department_name;
        const reqEmpId = req.employee_id;
        const reqEmpRole = String(reqEmp.role || 'user').toLowerCase();

        const isNotSelf = currentEmpId ? String(reqEmpId) !== String(currentEmpId) : true;
        
        let isSameDept = true;
        let isSubordinate = false;

        if (userRole === "leader") {
          isSameDept = (myDeptId || myDeptName) 
            ? (String(reqDeptId) === String(myDeptId) || String(reqDeptName).toLowerCase() === String(myDeptName).toLowerCase())
            : true;
          isSubordinate = (reqEmpRole === "user");
        } else if (userRole === "manager") {
          // ผู้จัดการเห็นเฉพาะหัวหน้าแผนก (leader) ตัวเองเท่านั้น
          isSameDept = (myDeptId || myDeptName) 
            ? (String(reqDeptId) === String(myDeptId) || String(reqDeptName).toLowerCase() === String(myDeptName).toLowerCase())
            : true;
          isSubordinate = (reqEmpRole === "leader");
        } else if (userRole === "director" || userRole === "executive" || userRole === "owner") {
          // ผู้บริหาร / ผู้อำนวยการ เห็นเฉพาะหัวหน้าแผนก (leader) และผู้จัดการ (manager) ส่งใบลามาเท่านั้น ทั่วทั้งองค์กร
          isSameDept = true; 
          isSubordinate = (reqEmpRole === "leader" || reqEmpRole === "manager");
        }

        return isSameDept && isNotSelf && isSubordinate;
      });
    }

    allLeaveRequests = rawData;
    hasExecutiveColumn = rawData.length > 0 && rawData.some(r => r.hasOwnProperty('executive_status'));
    updateTabAndStatBadges();
    renderLeaveTable();

  } catch (err) {
    console.error("💥 เกิดข้อผิดพลาด:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="12" class="empty-state" style="color: var(--danger);">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
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
      text: 'คุณไม่สามารถกดอนุมัติใบลาของตนเองได้ กรุณาให้ผู้จัดการฝ่าย หรือ Admin/Director เป็นผู้อนุมัติ',
      icon: 'warning',
      confirmButtonColor: '#06b6d4'
    });
    return false;
  }

  // ดึง Role ของ "ผู้ยื่นขอลา"
  const applicantRole = String(req.employees?.role || '').toLowerCase();
  const isApplicantHeadOrHr = ['leader', 'manager', 'director', 'hr', 'admin'].includes(applicantRole);
  const isApplicantLeaderOrManager = ['leader', 'manager'].includes(applicantRole);

  // 🔵 2. กรณีผู้จัดการ (L2) กำลังพิจารณา
  if (role === 'manager') {
    // ถ้าพนักงานทั่วไปยื่น ต้องผ่าน L1 ก่อน แต่ถ้าผู้ยื่นเป็นระดับ Leader ขึ้นไป ให้ข้าม L1 ได้เลย
    if (!isApplicantHeadOrHr && req.manager_status !== 'approved') {
      Swal.fire('ไม่สามารถดำเนินการได้', 'คำร้องนี้ต้องรอให้ "หัวหน้าแผนก (L1)" พิจารณาอนุมัติก่อน', 'warning');
      return false;
    }
  }

  // 🟡 3. กรณีผู้บริหาร (L3) กำลังพิจารณา ในระบบ 4 ขั้นตอน
  if (hasExecutiveColumn && (role === 'executive' || role === 'director' || role === 'owner')) {
    if (!isApplicantLeaderOrManager) {
      Swal.fire('ไม่จำเป็นต้องอนุมัติ', 'พนักงานท่านนี้ไม่จำเป็นต้องผ่านการอนุมัติจากผู้บริหาร (L3)', 'info');
      return false;
    }
    if (req.director_status !== 'approved') {
      Swal.fire('ไม่สามารถดำเนินการได้', 'คำร้องนี้ต้องรอให้ "ผู้จัดการฝ่าย (L2)" พิจารณาอนุมัติก่อน', 'warning');
      return false;
    }
  }

  // 🟢 4. กรณีฝ่าย HR / Admin กำลังพิจารณา
  if (role === 'hr' || role === 'admin') {
    if (hasExecutiveColumn) {
      if (isApplicantLeaderOrManager) {
        if (req.executive_status !== 'approved') {
          Swal.fire('ไม่สามารถดำเนินการได้', 'คำร้องนี้ต้องรอให้ "ผู้บริหาร (L3)" พิจารณาอนุมัติก่อน', 'warning');
          return false;
        }
      } else {
        // พนักงานธรรมดา ไม่ต้องรอ L3 (ข้ามไปได้เลย) แต่ต้องผ่าน L2 (ผู้จัดการฝ่าย) ก่อน
        if (req.director_status !== 'approved') {
          Swal.fire('ไม่สามารถดำเนินการได้', 'คำร้องนี้ต้องรอให้ "ผู้จัดการฝ่าย (L2)" พิจารณาอนุมัติก่อน', 'warning');
          return false;
        }
      }
    } else {
      // ระบบ 3 ขั้นตอนปกติ: ต้องรอ L2 ก่อน (ถ้าผู้ยื่นไม่ใช่ระดับหัวหน้า/HR)
      if (!isApplicantHeadOrHr && req.director_status !== 'approved') {
        Swal.fire('ไม่สามารถดำเนินการได้', 'คำร้องนี้ต้องรอให้ "ผู้จัดการฝ่าย (L2)" พิจารณาอนุมัติก่อน', 'warning');
        return false;
      }
    }
  }

  return true;
}

/* ==========================================================================
   🖼️ 4. RENDER TABLE DATA
   ========================================================================== */

function renderLeaveTable() {
  const tbody = document.getElementById("leaveRequestsBody");
  const stepFilter = document.getElementById("filterStepSelect")?.value || "all";
  if (!tbody) return;

  // ปรับแต่งคอลัมน์ส่วนหัวและตัวเลือกฟิลเตอร์ให้ตรงตามสิทธิ์
  const headerRow = document.getElementById("tableHeaderRow") || document.querySelector(".approval-table thead tr");
  if (headerRow) {
    if (hasExecutiveColumn) {
      headerRow.innerHTML = `
        <th class="text-center">โปรไฟล์</th>
        <th>รหัสพนักงาน</th>
        <th>ข้อมูลผู้ลา</th>
        <th>ประเภทการลา</th>
        <th class="text-center">ช่วงวันที่ลา</th>
        <th>เหตุผล / หมายเหตุ</th>
        <th class="text-center">หลักฐาน</th>
        <th class="text-center">จำนวนวัน</th>
        <th class="text-center">สถานะ หัวหน้า (L1)</th>
        <th class="text-center">สถานะ ผู้จัดการ (L2)</th>
        <th class="text-center">สถานะ ผู้บริหาร (L3)</th>
        <th class="text-center">สถานะ HR (L4)</th>
        <th class="text-center">การจัดการ</th>
      `;
    } else {
      headerRow.innerHTML = `
        <th class="text-center">โปรไฟล์</th>
        <th>รหัสพนักงาน</th>
        <th>ข้อมูลผู้ลา</th>
        <th>ประเภทการลา</th>
        <th class="text-center">ช่วงวันที่ลา</th>
        <th>เหตุผล / หมายเหตุ</th>
        <th class="text-center">หลักฐาน</th>
        <th class="text-center">จำนวนวัน</th>
        <th class="text-center">สถานะ หัวหน้า (L1)</th>
        <th class="text-center">สถานะ ผู้จัดการ (L2)</th>
        <th class="text-center">สถานะ HR (L3)</th>
        <th class="text-center">การจัดการ</th>
      `;
    }
  }

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
    const totalCols = hasExecutiveColumn ? 13 : 12;
    tbody.innerHTML = `<tr><td colspan="${totalCols}" class="empty-state">ไม่พบรายการใบลาตามเงื่อนไขที่เลือก</td></tr>`;
    return;
  }

  let htmlContent = "";
  filteredRequests.forEach((req) => {
    const empName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
    const empCode = req.employees ? req.employees.employee_code : "-";
    const empDeptName = req.employees?.departments?.department_name || "-";
    const empPositionName = req.employees?.positions?.position_name || "-";
    const leaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุ";
    const startDate = formatThaiDate(req.start_date);
    const endDate = formatThaiDate(req.end_date);
    const avatarUrl = getAvatarUrl(req.employees?.image_url);
    const displayDays = req.actual_days || req.days_requested || req.total_days || 0;
    const attachmentUrl = getAttachmentUrl(req);

    let actionButtons = "";

    if (currentLeaveTab === "cancellation") {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')"><span class="material-symbols-outlined">visibility</span></button>
          <button class="btn-act btn-act-approve" onclick="approveCancellation('${req.id}')"><span class="material-symbols-outlined">check_circle</span> อนุมัติยกเลิก</button>
          <button class="btn-act btn-act-reject" onclick="rejectCancellation('${req.id}')"><span class="material-symbols-outlined">cancel</span> ปฏิเสธ</button>
        </div>
      `;
    } else if (currentLeaveTab === "history") {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')"><span class="material-symbols-outlined">visibility</span> รายละเอียด</button>
          ${req.status === 'approved' ? `
            <button class="btn-act btn-act-cancel" onclick="forceCancelLeave('${req.id}')"><span class="material-symbols-outlined">block</span> ยกเลิกใบลา</button>
          ` : ''}
        </div>
      `;
    } else {
      actionButtons = `
        <div class="action-btn-group">
          <button class="btn-act btn-act-preview" onclick="previewLeaveModal('${req.id}')" title="ดูรายละเอียด"><span class="material-symbols-outlined">visibility</span></button>
          <button class="btn-act btn-act-approve" onclick="approveLeave('${req.id}')" title="อนุมัติ"><span class="material-symbols-outlined">check_circle</span> อนุมัติ</button>
          <button class="btn-act btn-act-reject" onclick="rejectLeave('${req.id}')" title="ปฏิเสธ"><span class="material-symbols-outlined">cancel</span> ไม่อนุมัติ</button>
        </div>
      `;
    }

    let statusColumnsHTML = "";
    if (hasExecutiveColumn) {
      const isApplicantLeaderOrManager = ['leader', 'manager'].includes(String(req.employees?.role || '').toLowerCase());
      let executiveCell = "";
      if (isApplicantLeaderOrManager) {
        executiveCell = `<td class="text-center">${getStatusBadgeHTML(req.executive_status)}</td>`;
      } else {
        executiveCell = `<td class="text-center" style="color: #cbd5e1; font-weight: 300;">-</td>`;
      }

      statusColumnsHTML = `
        <td class="text-center">${getStatusBadgeHTML(req.manager_status)}</td>
        <td class="text-center">${getStatusBadgeHTML(req.director_status)}</td>
        ${executiveCell}
        <td class="text-center">${getStatusBadgeHTML(req.status)}</td>
      `;
    } else {
      statusColumnsHTML = `
        <td class="text-center">${getStatusBadgeHTML(req.manager_status)}</td>
        <td class="text-center">${getStatusBadgeHTML(req.director_status)}</td>
        <td class="text-center">${getStatusBadgeHTML(req.status)}</td>
      `;
    }

    htmlContent += `
      <tr>
        <td class="text-center"><img src="${avatarUrl}" class="avatar-cell" onerror="this.src='/assets/img/default-avatar.jpg';"></td>
        <td><strong>${empCode}</strong></td>
        <td>
          <strong>${empName}</strong>
          <div style="font-size: 11px; color: var(--text-soft); margin-top: 3px; line-height: 1.3;">
            <span style="display: inline-flex; align-items: center; gap: 2px;">📂 ${empDeptName}</span><br>
            <span style="display: inline-flex; align-items: center; gap: 2px;">💼 ${empPositionName}</span>
          </div>
        </td>
        <td><span style="color: var(--primary); font-weight: 600;">${leaveType}</span></td>
        <td class="text-center" style="white-space:nowrap; font-size: 12px;">${startDate}<br>ถึง ${endDate}</td>
        <td>${req.reason || "-"}</td>
        <td class="text-center">${renderAttachmentCell(attachmentUrl, req.id)}</td>
        <td class="text-center"><strong>${displayDays} วัน</strong></td>
        ${statusColumnsHTML}
        <td class="text-center">${actionButtons}</td>
      </tr>
    `;
  });

  tbody.innerHTML = htmlContent;
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
        <label>จำนวนวันลาทั้งหมด</label>
        <div>${displayDays} วัน</div>
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

    <div style="margin-bottom: 16px;">
      <label style="font-size: 12px; font-weight: 700; color: var(--text-soft); display: block; margin-bottom: 6px;">สถานะการอนุมัติตามลำดับขั้น</label>
      <div class="workflow-steps">
        <div class="step-card">
          <span class="role-title">1. หัวหน้าแผนก (L1)</span>
          ${getStatusBadgeHTML(req.manager_status)}
        </div>
        <div class="step-card">
          <span class="role-title">2. ผู้จัดการฝ่าย (L2)</span>
          ${getStatusBadgeHTML(req.director_status)}
        </div>
        ${hasExecutiveColumn ? `
        ${['leader', 'manager'].includes(String(req.employees?.role || '').toLowerCase()) ? `
        <div class="step-card">
          <span class="role-title">3. ผู้บริหาร (L3)</span>
          ${getStatusBadgeHTML(req.executive_status)}
        </div>
        ` : ''}
        <div class="step-card">
          <span class="role-title">${['leader', 'manager'].includes(String(req.employees?.role || '').toLowerCase()) ? '4. ฝ่าย HR (L4)' : '3. ฝ่าย HR (L3)'}</span>
          ${getStatusBadgeHTML(req.status)}
        </div>
        ` : `
        <div class="step-card">
          <span class="role-title">3. ฝ่าย HR (L3)</span>
          ${getStatusBadgeHTML(req.status)}
        </div>
        `}
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
      updateFields.manager_status = 'approved';
    } else if (currentRole === 'manager') {
      updateFields.director_status = 'approved';
      // ถ้าเป็นพนักงานทั่วไป ไม่ต้องมีผู้บริหาร (L3) อนุมัติ ให้เปลี่ยนสถานะ executive_status เป็น 'approved' ควบคู่ไปด้วยเลย เพื่อความสมบูรณ์ของประวัติใน DB
      if (hasExecutiveColumn) {
        const applicantRole = String(reqData.employees?.role || '').toLowerCase();
        const isApplicantLeaderOrManager = ['leader', 'manager'].includes(applicantRole);
        if (!isApplicantLeaderOrManager) {
          updateFields.executive_status = 'approved';
        }
      }
    } else if (currentRole === 'executive' || currentRole === 'director' || currentRole === 'owner') {
      if (hasExecutiveColumn) {
        updateFields.executive_status = 'approved';
      } else {
        updateFields.director_status = 'approved';
        updateFields.status = 'approved';
        updateFields.approved_at = new Date().toISOString();
      }
    } else {
      // HR / Admin / อื่นๆ
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

    // 💬 ส่งแจ้งเตือน LINE OA ตามลำดับสายงาน (หัวหน้า -> ผู้จัดการ -> พนักงาน)
    if (window.PVTSDK?.line) {
      try {
        const applicantName = reqData.employees?.full_name || 'พนักงาน';
        const applicantCode = reqData.employees?.employee_code || '';
        const applicantLineId = reqData.employees?.line_id || '';
        const leaveTypeName = reqData.leave_types?.leave_name || 'ใบลา';

        if (currentRole === 'leader') {
          // หัวหน้าอนุมัติ L1 -> แจ้งผู้จัดการฝ่าย (L2)
          await window.PVTSDK.line.sendWorkflowNotification({
            type: 'LEADER_APPROVED',
            leaveId: leaveId,
            employeeName: applicantName,
            employeeCode: applicantCode,
            recipientRole: 'manager',
            leaveType: leaveTypeName,
            startDate: reqData.start_date,
            endDate: reqData.end_date,
            totalDays: reqData.total_days
          });
        } else {
          // ผู้จัดการ/HR/ผู้บริหาร อนุมัติขั้นสุดท้าย -> แจ้งพนักงานเจ้าของใบลา
          await window.PVTSDK.line.sendWorkflowNotification({
            type: 'FINAL_APPROVED',
            leaveId: leaveId,
            employeeName: applicantName,
            employeeCode: applicantCode,
            recipientRole: 'employee',
            recipientLineId: applicantLineId,
            leaveType: leaveTypeName,
            startDate: reqData.start_date,
            endDate: reqData.end_date,
            totalDays: reqData.total_days
          });
        }
      } catch (lineErr) {
        console.warn("⚠️ [LINE OA Trigger] Approval notice error:", lineErr);
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

    // 💬 แจ้งเตือนพนักงานผ่าน LINE OA เมื่อคำขอลาโดนปฏิเสธ
    if (window.PVTSDK?.line) {
      try {
        const reqData = allLeaveRequests.find(r => r.id === leaveId);
        if (reqData) {
          await window.PVTSDK.line.sendWorkflowNotification({
            type: 'REJECTED',
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
        approval_comment: `[ยกเลิกโดย HR/ผู้ดูแล] ${reason}`
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
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; background: #ffffff; color: #0f172a; }
          .page { width: 210mm; min-height: 297mm; padding: 18mm 20mm; margin: 0 auto; background: #ffffff; position: relative; }
          .doc-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0fa472; padding-bottom: 12px; margin-bottom: 20px; }
          .company-name { font-size: 18px; font-weight: 700; color: #0fa472; }
          .company-sub { font-size: 11px; color: #64748b; }
          .doc-meta { text-align: right; font-size: 12px; color: #475569; }
          .form-title-box { text-align: center; margin: 16px 0 24px 0; background: #f0fdf4; border: 1px dashed #86efac; padding: 10px; border-radius: 8px; }
          .form-title-box h1 { margin: 0; font-size: 20px; font-weight: 700; color: #166534; }
          .section-label { font-size: 14px; font-weight: 700; color: #0fa472; margin-bottom: 8px; border-left: 4px solid #0fa472; padding-left: 8px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 8px 12px; font-size: 13.5px; border: 1px solid #e2e8f0; }
          .info-table td.label { width: 22%; background: #f8fafc; font-weight: 600; color: #334155; }
          .reason-box { background: #fafafa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 16px; font-size: 13.5px; min-height: 60px; margin-bottom: 20px; line-height: 1.5; }
          .signature-section { margin-top: 40px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center; }
          .sig-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px 8px 10px 8px; }
          .sig-line { border-bottom: 1px dashed #64748b; height: 45px; margin: 0 10px 10px 10px; }
          .doc-footer { position: absolute; bottom: 12mm; left: 20mm; right: 20mm; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="doc-header">
            <div>
              <div class="company-name">PVT WORKFORCE MANAGEMENT</div>
              <div class="company-sub">บริษัท พีวีที คอร์ปอเรชั่น จำกัด (สำนักงานใหญ่)</div>
            </div>
            <div class="doc-meta">
              เลขที่เอกสาร: <strong>LV-${String(req.id).substring(0, 8).toUpperCase()}</strong><br>
              วันที่พิมพ์: ${formatThaiDate(new Date().toISOString(), true)}
            </div>
          </div>

          <div class="form-title-box">
            <h1>ใบขออนุมัติลาหยุดงาน (LEAVE REQUEST FORM)</h1>
          </div>

          <div class="section-label">ข้อมูลผู้ยื่นคำขอลา</div>
          <table class="info-table">
            <tr>
              <td class="label">รหัสพนักงาน</td>
              <td><strong>${emp.employee_code || '-'}</strong></td>
              <td class="label">ชื่อ-นามสกุล</td>
              <td><strong>${emp.full_name || '-'} ${emp.nickname ? `(${emp.nickname})` : ''}</strong></td>
            </tr>
            <tr>
              <td class="label">แผนก / สังกัด</td>
              <td>${deptName}</td>
              <td class="label">ตำแหน่งงาน</td>
              <td>${posName}</td>
            </tr>
          </table>

          <div class="section-label">รายละเอียดการขอลา</div>
          <table class="info-table">
            <tr>
              <td class="label">ประเภทการลา</td>
              <td><strong style="color: #0fa472;">${leaveName}</strong></td>
              <td class="label">จำนวนวันลาทั้งสิ้น</td>
              <td><strong>${printDays} วัน</strong></td>
            </tr>
            <tr>
              <td class="label">ตั้งแต่วันที่</td>
              <td>${formatThaiDate(req.start_date)}</td>
              <td class="label">ถึงวันที่</td>
              <td>${formatThaiDate(req.end_date)}</td>
            </tr>
          </table>

          <div class="section-label">เหตุผลประกอบการลา</div>
          <div class="reason-box">
            ${req.reason || 'ไม่ได้ระบุเหตุผล'}
            ${req.approval_comment ? `<br><small style="color: #dc2626;">* หมายเหตุผู้พิจารณา: ${req.approval_comment}</small>` : ''}
          </div>

          <div class="signature-section">
            <div class="sig-card">
              <div class="sig-line"></div>
              <div>( ${emp.full_name || 'ผู้ยื่นคำขอ'} )</div>
              <div style="font-size:11px; color:#64748b;">พนักงานผู้ขอลา</div>
            </div>
            <div class="sig-card">
              <div class="sig-line"></div>
              <div>( ................................................... )</div>
              <div style="font-size:11px; color:#64748b;">หัวหน้างาน / ผู้จัดการ</div>
            </div>
            <div class="sig-card">
              <div class="sig-line"></div>
              <div>( ................................................... )</div>
              <div style="font-size:11px; color:#64748b;">ฝ่ายทรัพยากรบุคคล (HR)</div>
            </div>
          </div>

          <div class="doc-footer">
            เอกสารนี้สร้างขึ้นโดยอัตโนมัติจากระบบ PVT HR Hub &bull; Ref: ${req.id}
          </div>
        </div>

        <script>
          window.onload = function() {
            if (typeof Swal !== 'undefined') Swal.close();
            window.print();
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