// ============================================================================
// 🚀 PVT HR System - [ROLE-BASED APPROVALS BOARD & DATA SECURITY]
// ============================================================================

// 🌐 Global Variables
let currentRole = "hr"; // 'hr' | 'leader' | 'manager'
let currentUserProfile = null;
let allLeaveRequests = []; // เก็บรายการคำขอทั้งหมดที่ดึงมาจาก Database
let currentLeaveTab = "pending"; // 'pending' | 'history'

document.addEventListener("DOMContentLoaded", async () => {
  await initSystemAndPermissions();
});

/* ==========================================================================
   🔑 1. ROLE PERMISSIONS & DYNAMIC UI CONTROL
   ========================================================================== */

async function initSystemAndPermissions() {
  try {
    const sb = window.pvtSupabase?.getClient();
    
    // ดึง Profile จาก Supabase หรือ Session Storage
    if (window.pvtSupabase?.getCurrentProfile) {
      currentUserProfile = await window.pvtSupabase.getCurrentProfile();
    }
    
    const savedSession = sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    
    const rawRole = String(currentUserProfile?.role || sessionUser?.role || empData?.role || "").toLowerCase();
    const positionName = String(empData?.positions?.position_name || empData?.position_name || "").toLowerCase();

    // 🎯 จำแนกกลุ่มสิทธิ์การใช้งาน
    if (rawRole === "hr" || rawRole === "admin") {
      currentRole = "hr";
    } else if (rawRole === "director" || positionName.includes("ผู้จัดการ") || positionName.includes("ผู้อำนวยการ")) {
      currentRole = "manager";
    } else if (rawRole === "leader" || positionName.includes("หัวหน้า")) {
      currentRole = "leader";
    } else {
      // พนักงานทั่วไปไม่มีสิทธิ์เข้าหน้านี้ -> เด้งกลับหน้า User
      alert("⛔ คุณไม่มีสิทธิ์เข้าถึงหน้าระบบอนุมัติใบลา");
      window.location.href = "/pages/user/index-user.html";
      return;
    }

    // 👤 [เพิ่มใหม่] แสดงชื่อ ตำแหน่ง และรูปโปรไฟล์ผู้ใช้งานบน Topbar
    const userNameEl = document.getElementById("userNameHeader");
    const userPositionEl = document.getElementById("userPositionHeader");
    const userAvatarEl = document.getElementById("userAvatarHeader");

    if (userNameEl) {
      userNameEl.textContent = empData?.full_name || currentUserProfile?.full_name || "ผู้ใช้งาน";
    }
    if (userPositionEl) {
      userPositionEl.textContent = empData?.positions?.position_name || empData?.position_name || "ไม่ระบุตำแหน่ง";
    }
    if (userAvatarEl) {
      userAvatarEl.src = getAvatarUrl(empData?.image_url || currentUserProfile?.image_url);
    }

    // 🎨 ปรับ Layout และซ่อน/แสดง Sidebar & ปุ่มย้อนกลับ
    applyRoleBasedUI();

    // 📊 โหลดข้อมูลใบลาตามสิทธิ์ของ Role
    await loadPendingLeavesHR();

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการเริ่มต้นระบบ:", err.message);
  }
}

/** 🎨 1. ปรับการแสดงผล Layout ตามสิทธิ์ */
function applyRoleBasedUI() {
  const sidebar = document.getElementById("mainSidebar") || document.getElementById("sidebar") || document.querySelector(".sidebar") || document.querySelector("aside");
  const mainContent = document.getElementById("mainContent") || document.querySelector(".main-content") || document.querySelector("main");
  const btnBack = document.getElementById("btnHeaderBack") || document.querySelector(".btn-back");
  const roleBadge = document.getElementById("userRoleBadge");

  if (currentRole === "leader" || currentRole === "manager") {
    // 🚫 ซ่อน Sidebar สำหรับ Leader / Manager
    if (sidebar) {
      sidebar.style.setProperty("display", "none", "important");
    }

    // 📐 ขยายพื้นที่หน้าจอหลักให้เต็ม 100%
    if (mainContent) {
      mainContent.style.setProperty("margin-left", "0", "important");
      mainContent.style.setProperty("width", "100%", "important");
      mainContent.style.setProperty("max-width", "100%", "important");
      mainContent.style.setProperty("padding", "24px 32px", "important");
    }

    // 🔙 แสดงปุ่มย้อนกลับ
    if (btnBack) btnBack.style.display = "inline-flex";

    // 🏷️ อัปเดตข้อความสิทธิ์และสี Badge
    if (roleBadge) {
      if (currentRole === "manager") {
        roleBadge.textContent = "ผู้จัดการอนุมัติ (L2)";
        roleBadge.className = "status-badge status-pending";
      } else {
        roleBadge.textContent = "หัวหน้างานอนุมัติ (L1)";
        roleBadge.className = "status-badge status-pending";
      }
    }

  } else {
    // 👑 สิทธิ์ HR/Admin แสดง Sidebar ตามปกติ
    if (sidebar) sidebar.style.display = "flex";
    if (btnBack) btnBack.style.display = "none";
    if (roleBadge) {
      roleBadge.textContent = "PVT HR Administrator";
      roleBadge.className = "status-badge status-approved";
    }
  }
}

/* ==========================================================================
   🛠️ HELPER FUNCTIONS (รูปภาพ, คำนวณวันหยุด, ตรวจเช็กสถานะ)
   ========================================================================== */

function getAvatarUrl(imageUrl) {
  if (imageUrl && imageUrl.trim() !== "") {
    let url = imageUrl;
    if (!url.startsWith("http")) {
      url = `https://pgogmhqjdchakcytsomx.supabase.co/storage/v1/object/public/employee-images/${url}`;
    }
    if (url.includes("storage/v1/object/") && !url.includes("storage/v1/object/public/")) {
      url = url.replace("storage/v1/object/", "storage/v1/object/public/");
    }
    return url;
  }
  return "/assets/img/default-avatar.jpg";
}

/** 🛠️ ตรวจสอบว่าเป็นสถานะ "รออนุมัติ" หรือไม่ (แบบรองรับทุกรูปแบบตัวอักษร) */
function isPendingStatus(status) {
  if (!status) return false;
  const s = String(status).trim().toLowerCase();
  return s === 'pending' || s === 'รออนุมัติ' || s === 'wait';
}

async function calculateActualLeaveDays(startDateStr, endDateStr) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return 0;

  try {
    const { data: holidayData, error } = await sb
      .from('holidays') 
      .select('holiday_date')
      .gte('holiday_date', startDateStr)
      .lte('holiday_date', endDateStr);

    if (error) throw error;

    const holidaySet = new Set(holidayData ? holidayData.map(h => h.holiday_date) : []);
    let totalDays = 0;
    let start = new Date(startDateStr);
    const end = new Date(endDateStr);

    while (start <= end) {
      const dayOfWeek = start.getDay(); 
      const currentIsoString = start.toISOString().split('T')[0];

      if (dayOfWeek !== 0 && !holidaySet.has(currentIsoString)) {
        totalDays++;
      }
      start.setDate(start.getDate() + 1);
    }
    return totalDays;

  } catch (err) {
    console.error("❌ คำนวณวันหยุดพิเศษล้มเหลว:", err.message);
    let totalDays = 0;
    let start = new Date(startDateStr);
    const end = new Date(endDateStr);
    while (start <= end) {
      if (start.getDay() !== 0) totalDays++;
      start.setDate(start.getDate() + 1);
    }
    return totalDays;
  }
}





/* ==========================================================================
   📊 2. DATA FETCHING & FILTERING (โครงสร้างอนุมัติ 2 ระดับ: หัวหน้าแผนก & ผู้จัดการฝ่าย)
   ========================================================================== */

/** 📊 2. ดึงข้อมูลรายการใบลา */
async function loadPendingLeavesHR() {
  console.group("🚀 [STEP-BY-STEP TRACE] เริ่มต้นโหลดรายการใบลา");

  const tbody = document.getElementById("leaveRequestsBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: #64748b;">⏳ กำลังโหลดคลังข้อมูลคำขอ...</td></tr>`;
  }

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    console.error("❌ ไม่พบ Supabase Client");
    console.groupEnd();
    return;
  }

  try {
    const savedSession = sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};

    // 🆔 1. ดึง ID พนักงานปัจจุบัน
    const currentEmpId = empData?.id || empData?.employee_id || currentUserProfile?.employee_id;

    // 🏬 2. ดึงข้อมูลแผนกจริงจาก DB (ดึงจาก employees.department_id ตรงๆ)
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
        console.log("✅ [Step 2] ข้อมูลแผนกผู้ล็อกอิน:", { name: myEmpInfo.full_name, myDeptId, myDeptName });
      }
    }

    // 📥 3. ดึงข้อมูลคำขอใบลาทั้งหมด
    let { data, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( 
          id, full_name, employee_code, nickname, role,
          department_id, departments!department_id(id, department_name), 
          positions(position_name) 
        ),
        leave_types ( leave_name ) 
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    let rawData = data || [];
    console.log(`📦 [Step 3] คำขอใบลาทั้งหมดจาก DB: ${rawData.length} รายการ`);

    // 🔒 4. กรองข้อมูลเฉพาะลูกน้องตามระดับสิทธิ์ 2 ชั้น
    const userRole = (currentRole || '').toLowerCase();

    if (userRole === "leader" || userRole === "manager" || userRole === "director") {
      console.group(`🔒 [Step 4] กรองคำขอลาสำหรับ Role: ${userRole}`);
      
      rawData = rawData.filter((req, index) => {
        const reqEmp = req.employees;
        if (!reqEmp) return false;

        const reqDeptId = reqEmp.department_id;
        const reqDeptName = reqEmp.departments?.department_name;
        const reqEmpId = req.employee_id;
        const reqEmpRole = String(reqEmp.role || 'user').toLowerCase();

        const cleanName = (str) => String(str || '').trim().toLowerCase();

        // 4.1 อยู่แผนกเดียวกัน
        const isSameDeptId = myDeptId && String(reqDeptId) === String(myDeptId);
        const isSameDeptName = myDeptName && cleanName(reqDeptName) === cleanName(myDeptName);
        const isSameDept = (myDeptId || myDeptName) ? (isSameDeptId || isSameDeptName) : true;

        // 4.2 ไม่ใช่ใบลาของตัวเอง
        const isNotSelf = currentEmpId ? String(reqEmpId) !== String(currentEmpId) : true;

        // 👑 4.3 เช็กสิทธิ์ 2 ระดับตามจริง (แก้ไขแยก Manager ออกจาก Leader)
        let isSubordinate = false;
        
        if (userRole === "leader") {
          // 🔹 หัวหน้างาน (L1): เห็นเฉพาะพนักงานทั่วไป (user)
          isSubordinate = (reqEmpRole === "user");

        } else if (userRole === "manager" || userRole === "director") {
          // 🔹 ผู้จัดการฝ่าย / ผู้อำนวยการ (L2): เห็นทั้ง พนักงานทั่วไป (user) และ หัวหน้างาน (leader/manager)
          isSubordinate = (reqEmpRole === "user" || reqEmpRole === "leader" || reqEmpRole === "manager");
        }
        const pass = isSameDept && isNotSelf && isSubordinate;

        console.log(`  ${pass ? "✅ [ผ่าน]" : "🚫 [ถูกกรองออก]"} [รายการที่ ${index + 1}] ${reqEmp.full_name} (Role: ${reqEmpRole})`, {
          isSameDept,
          isNotSelf,
          isSubordinate,
          pass
        });

        return pass;
      });

      console.groupEnd();
    }

    allLeaveRequests = rawData;
    updateTabBadges();
    renderLeaveTable();

  } catch (err) {
    console.error("💥 เกิดข้อผิดพลาด:", err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red; padding: 20px;">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
    }
  } finally {
    console.groupEnd();
  }
}

// อัปเดตตัวนับจำนวนบน Tab
function updateTabBadges() {
  const pendingCount = allLeaveRequests.filter(r => isPendingStatus(r.status)).length;
  const historyCount = allLeaveRequests.filter(r => !isPendingStatus(r.status)).length;

  const pBadge = document.getElementById("pendingCountBadge");
  const hBadge = document.getElementById("historyCountBadge");

  if (pBadge) pBadge.textContent = pendingCount;
  if (hBadge) hBadge.textContent = historyCount;
}

// ฟังก์ชันสำหรับสลับ Tab
window.switchLeaveTab = function(tabName, btnEl) {
  currentLeaveTab = tabName;
  
  document.querySelectorAll('.leave-tab-container .tab-btn').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const headerTitle = document.getElementById("sectionHeaderTitle");
  const headerIcon = document.getElementById("sectionHeaderIcon");

  if (tabName === 'pending') {
    if (headerTitle) headerTitle.textContent = "คำขออนุมัติลาค้างพิจารณา";
    if (headerIcon) headerIcon.textContent = "hourglass_top";
  } else {
    if (headerTitle) headerTitle.textContent = "ประวัติการพิจารณาใบลาทั้งหมด";
    if (headerIcon) headerIcon.textContent = "history";
  }

  renderLeaveTable();
};

/* ==========================================================================
   🖼️ 3. RENDER TABLE DATA
   ========================================================================== */

/** 🖼️ 3. RENDER TABLE DATA (พร้อม Log เช็กการวาดตาราง) */
function renderLeaveTable() {
  console.group("🎨 [RENDER TABLE TRACE] วาดตารางข้อมูล HTML");
  
  const tbody = document.getElementById("leaveRequestsBody");
  if (!tbody) {
    console.error("❌ ไม่พบธาตุ HTML #leaveRequestsBody ในหน้าเว็บ");
    console.groupEnd();
    return;
  }

  console.log("📍 Tab ที่เลือกอยู่ปัจจุบัน:", currentLeaveTab);
  console.log("📍 ข้อมูลทั้งหมดใน Memory (allLeaveRequests):", allLeaveRequests.length, allLeaveRequests);

  // แยกรายการตาม Tab
  let filteredRequests = [];
  if (currentLeaveTab === "pending") {
    filteredRequests = allLeaveRequests.filter(r => isPendingStatus(r.status));
  } else {
    filteredRequests = allLeaveRequests.filter(r => !isPendingStatus(r.status));
  }

  console.log(`📍 ข้อมูลที่กรองตรงตาม Tab '${currentLeaveTab}': ${filteredRequests.length} รายการ`, filteredRequests);

  if (filteredRequests.length === 0) {
    const emptyMsg = currentLeaveTab === "pending" 
      ? "✨ ไม่มีคำขออนุมัติลาค้างในระบบ" 
      : "📜 ยังไม่มีประวัติรายการพิจารณาใบลา";
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 50px; font-weight: 500;">${emptyMsg}</td></tr>`;
    console.warn("⚠️ ไม่พบข้อมูลที่จะวาดลงตาราง แสดงข้อความตารางว่างเปล่า");
    console.groupEnd();
    return;
  }

  let htmlContent = "";
  filteredRequests.forEach((req, idx) => {
    const empName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
    const empCode = req.employees ? req.employees.employee_code : "-";
    const leaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุ";
    const startDate = req.start_date ? new Date(req.start_date).toLocaleDateString("th-TH") : "-";
    const endDate = req.end_date ? new Date(req.end_date).toLocaleDateString("th-TH") : "-";
    const reason = req.reason || "-";
    const avatarUrl = getAvatarUrl(req.employees?.image_url);

    // สร้างปุ่ม Action ตาม Tab
    let actionButtons = "";
    if (currentLeaveTab === "pending") {
      actionButtons = `
        <button onclick="approveLeave('${req.id}')" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500; margin-right:4px;">✔️ อนุมัติ</button>
        <button onclick="rejectLeave('${req.id}')" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500; margin-right:4px;">✖️ ไม่อนุมัติ</button>
        <button onclick="printLeaveA4('${req.id}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;">🖨️ พิมพ์</button>
      `;
    } else {
      actionButtons = `
        <button onclick="printLeaveA4('${req.id}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;">🖨️ พิมพ์เอกสาร</button>
      `;
    }

    htmlContent += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="text-align: center; padding:16px;">
          <img src="${avatarUrl}" style="width:38px; height:38px; border-radius:50%; object-fit:cover;" onerror="this.src='/assets/img/default-avatar.jpg';">
        </td>
        <td style="padding:16px;"><strong>${empCode}</strong></td>
        <td style="padding:16px;">${empName}</td>
        <td style="padding:16px;">${leaveType}</td>
        <td style="padding:16px;">${startDate} - ${endDate}<br><small style="color:#64748b;">${reason}</small></td>
        <td style="text-align: center; padding:16px; font-weight:600;">${req.total_days} วัน</td>
        <td style="text-align: center; padding:16px;">${req.manager_status || "รออนุมัติ"}</td>
        <td style="text-align: center; padding:16px;">${req.director_status || "รออนุมัติ"}</td>
        <td style="text-align: center; padding:16px;">${req.status || "รออนุมัติ"}</td>
        <td style="text-align: center; padding:16px; white-space:nowrap;">${actionButtons}</td>
      </tr>
    `;
  });

  tbody.innerHTML = htmlContent;
  console.log("✨ [Success] เขียน HTML วาดตารางเรียบร้อยแล้ว!");
  console.groupEnd();
}


/* ==========================================================================
   🔵 4. ACTION WORKFLOW HANDLERS (แก้ไข ป้องกัน Error 400)
   ========================================================================== */

/** 🛠️ Helper ตรวจสอบว่า String เป็น UUID หรือไม่ */
function isValidUUID(str) {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(str.trim());
}

async function approveLeave(leaveId) {
  const result = await Swal.fire({
    title: 'ยืนยันการอนุมัติ?',
    text: "คุณต้องการอนุมัติและหักโควตาวันลาของพนักงานท่านนี้ใช่หรือไม่?",
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
  
  Swal.fire({
    title: 'กำลังประมวลผล...',
    text: 'ระบบกำลังคำนวณวันหยุดและตัดยอดวันลา กรุณารอสักครู่',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // 🆔 1. ดึง ID พนักงานผู้กดอนุมัติจริง และตรวจสอบรูปแบบ UUID
    const savedSession = sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    
    let currentEmpId = empData?.id || currentUserProfile?.employee_id || empData?.employee_id || null;

    // 🔍 ถ้า currentEmpId ไม่ใช่ UUID ให้ค้นหา UUID จริงจาก DB ด้วย id หรือ employee_code
    if (currentEmpId && !isValidUUID(currentEmpId)) {
      const { data: fetchEmp } = await sb
        .from('employees')
        .select('id')
        .or(`id.eq.${currentEmpId},employee_code.eq.${currentEmpId}`)
        .maybeSingle();
      if (fetchEmp?.id) currentEmpId = fetchEmp.id;
    }

    // 📄 2. ดึงข้อมูลใบลา
    const { data: reqData, error: reqErr } = await sb
      .from('leave_requests')
      .select('employee_id, leave_type_id, total_days, start_date, end_date')
      .eq('id', leaveId)
      .single();
      
    if (reqErr) throw new Error("ดึงข้อมูลใบลาไม่สำเร็จ: " + reqErr.message);

    const auditedTotalDays = await calculateActualLeaveDays(reqData.start_date, reqData.end_date);
    const currentYear = new Date(reqData.start_date).getFullYear();

    // 📊 3. หักโควตาวันลาใน leave_balances
    const { data: balData, error: balErr } = await sb
      .from('leave_balances')
      .select('id, remaining_days, used_days')
      .eq('employee_id', reqData.employee_id)
      .eq('leave_type_id', reqData.leave_type_id)
      .eq('year', currentYear)
      .single();

    if (!balErr && balData) {
      const newUsed = (balData.used_days || 0) + auditedTotalDays;
      const newRemaining = (balData.remaining_days || 0) - auditedTotalDays;

      const { error: updateBalErr } = await sb
        .from('leave_balances')
        .update({ remaining_days: newRemaining, used_days: newUsed })
        .eq('id', balData.id);

      if (updateBalErr) console.warn("⚠️ ไม่สามารถหักโควตาวันลาได้:", updateBalErr.message);
    }

    // 📝 4. อัปเดตสถานะใบลาตามสิทธิ์ของ Role
    const updatePayload = { 
      status: 'approved', 
      total_days: auditedTotalDays, 
      approved_at: new Date().toISOString() 
    };

    if (currentRole === 'leader' || currentRole === 'manager') {
      updatePayload.manager_status = 'approved';
    } else if (currentRole === 'director') {
      updatePayload.director_status = 'approved';
    }

    // ใส่ approved_by เมื่อค่านั้นเป็น UUID ที่ถูกต้องเท่านั้น
    if (currentEmpId && isValidUUID(currentEmpId)) {
      updatePayload.approved_by = currentEmpId;
    }

    // ส่งคำขออัปเดตไปยัง Supabase
    let { error: approveErr } = await sb
      .from('leave_requests')
      .update(updatePayload)
      .eq('id', leaveId);
    
    // 🛡️ Fallback: หากตารางใน DB ไม่มีคอลัมน์ approved_by ให้ตัดออกแล้วลองบันทึกใหม่
    if (approveErr && approveErr.message?.includes('approved_by')) {
      delete updatePayload.approved_by;
      const fallbackRes = await sb
        .from('leave_requests')
        .update(updatePayload)
        .eq('id', leaveId);
      approveErr = fallbackRes.error;
    }

    if (approveErr) throw approveErr;
    
    await Swal.fire('อนุมัติสำเร็จ!', `ระบบได้คำนวณและหักโควตาจริงจำนวน ${auditedTotalDays} วัน เรียบร้อยแล้ว`, 'success');
    loadPendingLeavesHR();
    
  } catch (err) {
    console.error("💥 Approve Leave Detailed Error:", {
      message: err.message,
      details: err.details,
      hint: err.hint,
      code: err.code
    });
    Swal.fire('เกิดข้อผิดพลาด', err.message || err.details || 'ไม่สามารถอนุมัติได้', 'error');
  }
}

async function rejectLeave(leaveId) {
  const { value: reason } = await Swal.fire({
    title: 'ปฏิเสธใบลา',
    input: 'textarea',
    inputLabel: 'โปรดระบุเหตุผลที่ไม่อนุมัติ:',
    inputPlaceholder: 'พิมพ์เหตุผลที่นี่...',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: '❌ ปฏิเสธ',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => { if (!value) return 'กรุณาระบุเหตุผลด้วยครับ!' }
  });

  if (!reason) return; 
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const savedSession = sessionStorage.getItem("currentUser");
    const sessionUser = savedSession ? JSON.parse(savedSession) : {};
    const empData = currentUserProfile?.employees || sessionUser?.employees || sessionUser || {};
    let currentEmpId = empData?.id || currentUserProfile?.employee_id || empData?.employee_id || null;

    if (currentEmpId && !isValidUUID(currentEmpId)) {
      const { data: fetchEmp } = await sb
        .from('employees')
        .select('id')
        .or(`id.eq.${currentEmpId},employee_code.eq.${currentEmpId}`)
        .maybeSingle();
      if (fetchEmp?.id) currentEmpId = fetchEmp.id;
    }

    const updatePayload = { 
      status: 'rejected', 
      approval_comment: reason.trim(), 
      approved_at: new Date().toISOString() 
    };

    if (currentRole === 'leader' || currentRole === 'manager') {
      updatePayload.manager_status = 'rejected';
    } else if (currentRole === 'director') {
      updatePayload.director_status = 'rejected';
    }

    if (currentEmpId && isValidUUID(currentEmpId)) {
      updatePayload.approved_by = currentEmpId;
    }

    let { error } = await sb
      .from('leave_requests')
      .update(updatePayload)
      .eq('id', leaveId);

    if (error && error.message?.includes('approved_by')) {
      delete updatePayload.approved_by;
      const fallbackRes = await sb
        .from('leave_requests')
        .update(updatePayload)
        .eq('id', leaveId);
      error = fallbackRes.error;
    }
    
    if (error) throw error;
    await Swal.fire('ปฏิเสธใบลาแล้ว', 'รายการถูกย้ายไปที่ประวัติการพิจารณาเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR();
  } catch (err) {
    console.error("💥 Reject Leave Error:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถปฏิเสธใบลาได้', 'error');
  }
}

async function cancelLeaveHR(leaveId) {
  const result = await Swal.fire({
    title: 'ยืนยันการยกเลิกใบลา',
    input: 'text',
    inputLabel: 'ระบุเหตุผล (เช่น พนักงานมาทำงาน, ขอยกเลิกเอง)',
    inputPlaceholder: 'พิมพ์เหตุผลที่นี่...',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: '✔️ ยืนยันยกเลิก',
    cancelButtonText: 'ปิด',
    allowOutsideClick: false
  });

  if (!result.isConfirmed) return;

  const reason = result.value && result.value.trim() !== "" 
    ? result.value.trim() 
    : 'HR ยกเลิกรายการ';

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  Swal.fire({
    title: 'กำลังประมวลผล...',
    text: 'กำลังบันทึกข้อมูลลงฐานข้อมูล...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { data, error } = await sb
      .from('leave_requests')
      .update({
        status: 'cancelled', 
        approval_comment: `[ยกเลิกโดย HR] ${reason}`,
        approved_at: new Date().toISOString()
      })
      .eq('id', leaveId)
      .select();

    if (error) throw error;

    await Swal.fire('ยกเลิกสำเร็จ!', 'ระบบได้ทำการยกเลิกและย้ายรายการไปที่ประวัติเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR();

  } catch (err) {
    Swal.fire('ไม่สามารถยกเลิกได้', err.message, 'error');
  }
}

window.approveLeave = approveLeave;
window.rejectLeave = rejectLeave;
window.cancelLeaveHR = cancelLeaveHR;

window.approveLeave = approveLeave;
window.rejectLeave = rejectLeave;
window.cancelLeaveHR = cancelLeaveHR;

/* ==========================================================================
   🔵 5. DIGITAL MODAL VIEW & PRINT A4
   ========================================================================== */

async function openLeavePopupModal(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { data: leave, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, nickname, image_url, departments(department_name), positions(position_name) ),
        leave_types ( leave_name )
      `)
      .eq("id", leaveId)
      .single();

    if (error) throw error;

    const emp = leave.employees || {};
    const dStart = new Date(leave.start_date).toLocaleDateString('th-TH');
    const dEnd = new Date(leave.end_date).toLocaleDateString('th-TH');
    const modalAvatarUrl = getAvatarUrl(emp.image_url);

    Swal.fire({
      width: '560px',
      html: `
        <div style="display: flex; align-items: center; gap: 14px; text-align: left; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px;">
          <img src="${modalAvatarUrl}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6;" onerror="this.src='/assets/img/default-avatar.jpg';">
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #0f172a;">📄 รายละเอียดใบลาดิจิทัล</div>
            <div style="font-size: 13px; color: #64748b;">คำขอผ่านระบบอิเล็กทรอนิกส์หลัก</div>
          </div>
        </div>
        
        <div style="text-align: left; font-size: 14px; line-height: 1.8; color: #334155;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #3b82f6;">
            <strong>พนักงาน:</strong> ${emp.full_name || '-'} (${emp.nickname || '-'}) <br>
            <strong>รหัสพนักงาน:</strong> ${emp.employee_code || '-'} | <strong>แผนก:</strong> ${emp.departments?.department_name || '-'}
          </div>
          <strong>ประเภทการลา:</strong> <span style="color: #0284c7; font-weight: bold;">${leave.leave_types?.leave_name || '-'}</span><br>
          <strong>ช่วงวันที่ลา:</strong> ${dStart} ถึง ${dEnd} (${leave.total_days} วัน)<br>
          <strong>เหตุผลการลา:</strong> ${leave.reason || '-'}<br>
          <strong>สถานะปัจจุบัน:</strong> <span style="padding: 2px 8px; font-size: 12px; font-weight: 600; background:#e2e8f0; border-radius:4px;">${leave.status}</span><br>
          <strong>หมายเหตุจากระบบ/HR:</strong> <span style="color: #ef4444;">${leave.approval_comment || '-'}</span>
        </div>
      `,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748b'
    });

  } catch (err) {
    Swal.fire('ไม่สามารถดึงรายละเอียดได้', err.message, 'error');
  }
}

async function printLeaveA4(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  Swal.fire({
    title: 'กำลังจัดทำหน้าเอกสาร...',
    text: 'โปรดรอมุมมองพิมพ์สักครู่',
    showConfirmButton: false,
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const { data: leave, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, nickname, departments(department_name), positions(position_name) ),
        leave_types ( leave_name )
      `)
      .eq("id", leaveId)
      .single();

    if (error) throw error;
    Swal.close(); 

    const emp = leave.employees || {};
    const formatFullDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
    const formatDateTime = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' น.' : '-';

    const st = String(leave.status || '').toLowerCase();
    let stampHtml = "";
    if (st === 'approved' || st === 'อนุมัติ') {
      stampHtml = `<div class="digital-stamp approved-stamp"><div class="stamp-title">APPROVED</div><div class="stamp-sub">อนุมัติผ่านระบบดิจิทัล</div><div class="stamp-date">${formatDateTime(leave.approved_at)}</div></div>`;
    } else if (st === 'rejected' || st === 'ปฏิเสธ') {
      stampHtml = `<div class="digital-stamp rejected-stamp"><div class="stamp-title">REJECTED</div><div class="stamp-sub">ปฏิเสธผ่านระบบ</div><div class="stamp-date">${formatDateTime(leave.approved_at)}</div></div>`;
    } else {
      stampHtml = `<div class="digital-stamp pending-stamp"><div class="stamp-title">PENDING</div><div class="stamp-sub">รอผลการพิจารณา</div></div>`;
    }

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ใบคำขออนุมัติลาหยุดงาน - ${emp.full_name || ''}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 15mm 20mm; }
          body { font-family: 'Sarabun', sans-serif; color: #1e293b; margin: 0; padding: 0; line-height: 1.5; font-size: 14px; }
          .document-container { position: relative; width: 100%; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .logo-placeholder { background: #1e3a8a; color: white; font-weight: bold; font-size: 18px; padding: 8px 14px; border-radius: 4px; margin-right: 12px; }
          .company-title { font-size: 14px; font-weight: 700; color: #0f172a; }
          .doc-title-main { font-size: 20px; font-weight: 700; color: #1e3a8a; }
          .digital-stamp { position: absolute; top: 70px; right: 0; border: 3px double; border-radius: 8px; padding: 8px 15px; text-align: center; font-weight: bold; transform: rotate(-3deg); opacity: 0.85; width: 160px; background: rgba(255, 255, 255, 0.9); }
          .approved-stamp { color: #059669; border-color: #059669; }
          .rejected-stamp { color: #dc2626; border-color: #dc2626; }
          .pending-stamp { color: #d97706; border-color: #d97706; }
          .stamp-title { font-size: 18px; letter-spacing: 2px; }
          .meta-table { width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 25px; }
          .meta-table td { padding: 10px 15px; border-bottom: 1px solid #e2e8f0; }
          .section-heading { font-size: 13px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 12px; margin-top: 15px; }
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .details-table th { background-color: #f1f5f9; padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left; }
          .details-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="document-container">
          ${stampHtml}
          <table class="header-table">
            <tr>
              <td><span class="logo-placeholder">PVT</span> <span class="company-title">บริษัท พีวีที เทคโนโลยี (ประเทศไทย) จำกัด</span></td>
              <td style="text-align: right;"><div class="doc-title-main">ใบขออนุมัติลาหยุดงาน</div><div>LEAVE REQUEST FORM</div></td>
            </tr>
          </table>

          <div class="section-heading">ข้อมูลผู้ยื่นคำขอ</div>
          <table class="meta-table">
            <tr><td><strong>รหัสพนักงาน:</strong> ${emp.employee_code || '-'}</td><td><strong>ชื่อ - นามสกุล:</strong> ${emp.full_name || '-'} (${emp.nickname || '-'})</td></tr>
            <tr><td><strong>สังกัดแผนก:</strong> ${emp.departments?.department_name || '-'}</td><td><strong>ตำแหน่ง:</strong> ${emp.positions?.position_name || '-'}</td></tr>
          </table>

          <div class="section-heading">รายละเอียดการลา</div>
          <table class="details-table">
            <thead>
              <tr><th>ประเภทการลา</th><th>ช่วงเวลาเริ่มต้น - สิ้นสุด</th><th>รวมระยะเวลา</th><th>เหตุผล</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600; color: #1e3a8a;">${leave.leave_types?.leave_name || '-'}</td>
                <td>${formatFullDate(leave.start_date)} - ${formatFullDate(leave.end_date)}</td>
                <td><strong>${leave.total_days} วัน</strong></td>
                <td>${leave.reason || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();

  } catch (err) {
    Swal.fire('ไม่สามารถพิมพ์เอกสารได้', err.message, 'error');
  }
}

/* ==========================================================================
   🚪 6. SECURITY & UTILS
   ========================================================================== */

window.handleLogout = function() {
  Swal.fire({
    title: 'ยืนยันการออกจากระบบ',
    text: 'คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก'
  }).then((result) => {
    if (result.isConfirmed) {
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = "/index.html";
    }
  });
};

function toggleFloatingGuide() {
  const card = document.getElementById("floating-guide-card");
  const icon = document.getElementById("pvt-fab-icon");
  const btn = document.getElementById("pvt-fab-btn");
  
  if (!card || !icon || !btn) return;

  const isHidden = card.style.display === "none" || card.style.display === "";

  if (isHidden) {
    card.style.display = "block";
    icon.innerText = "close";
    btn.style.background = "#ef4444";
  } else {
    card.style.display = "none";
    icon.innerText = "help";
    btn.style.background = "#1e3a8a";
  }
}