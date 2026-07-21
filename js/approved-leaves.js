/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - LEADER APPROVAL ENGINE (FIXED ACCESS & PERMISSIONS)
 * ==========================================================================
 */

let _pvtDebugSbInstance = null;
let rawRequests = [];
let currentRoleState = "manager"; // 'manager' = หัวหน้าแผนก (ด่าน 1), 'director' = ผู้จัดการฝ่าย (ด่าน 2)
let managerDepartmentId = null;   // ID แผนกของหัวหน้างานที่ Login

document.addEventListener("DOMContentLoaded", async () => {
  console.group("🏢 [LEADER ENGINE] เริ่มต้นโหลดหน้าระบบหัวหน้างาน");

  // 1. 🔌 ต้องเชื่อมต่อ Supabase เป็นอันดับแรกเสมอ
  initializeSupabaseWithDebug();

  // 2. 👤 ดึงข้อมูลโปรไฟล์ (รองรับทั้งจาก Supabase และ Session Storage เป็นแผนสำรอง)
  let profile = null;
  if (window.pvtSupabase && typeof window.pvtSupabase.getCurrentProfile === "function") {
    profile = await window.pvtSupabase.getCurrentProfile();
  }

  let currentUser = null;
  try {
    const savedSession = sessionStorage.getItem("currentUser");
    if (savedSession) currentUser = JSON.parse(savedSession);
  } catch (ex) {
    console.error("⚠️ อ่าน Session ล้มเหลว:", ex);
  }

  // รวมข้อมูลเพื่อเช็ก Role จากทุกช่องทาง
  const empData = profile?.employees || currentUser?.employees || currentUser || {};
  const userRole = String(profile?.role || currentUser?.role || empData?.role || "").toLowerCase();
  const positionName = String(empData?.positions?.position_name || empData?.position_name || currentUser?.position_name || "").toLowerCase();

  const allowedRoles = ["leader", "manager", "director", "hr", "admin"];
  const isAllowed = allowedRoles.includes(userRole) || 
                    positionName.includes("ผู้จัดการ") || 
                    positionName.includes("หัวหน้า") || 
                    positionName.includes("ผู้อำนวยการ");

  console.log(`🔍 [PERMIT CHECK] Role: "${userRole}", Position: "${positionName}", IsAllowed: ${isAllowed}`);

  // 🛑 3. ถ้าสิทธิ์ไม่ใช่หัวหน้า/ผู้จัดการ ให้เด้งกลับหน้าพนักงาน
  if (!isAllowed) {
    alert("⛔ คุณไม่มีสิทธิ์เข้าถึงหน้าระบบหัวหน้างาน");
    window.location.href = "/pages/user/index-user.html";
    console.groupEnd();
    return;
  }

  // 4. กำหนด Role State (ด่าน 1 หรือ ด่าน 2)
  if (userRole === "director" || userRole === "admin" || positionName.includes("ผู้จัดการฝ่าย") || positionName.includes("ผู้อำนวยการ")) {
    currentRoleState = "director";
  } else {
    currentRoleState = "manager";
  }

  // 5. ค้นหา department_id ของหัวหน้าเพื่อใช้กรองใบลาในแผนก
  const targetEmpId = profile?.employee_id || profile?.id || currentUser?.employee_id || currentUser?.id;
  
  if (_pvtDebugSbInstance && targetEmpId) {
    try {
      const { data: leaderProfile } = await _pvtDebugSbInstance
        .from("employees")
        .select("department_id")
        .eq("id", targetEmpId)
        .maybeSingle();

      if (leaderProfile?.department_id) {
        managerDepartmentId = leaderProfile.department_id;
      } else {
        managerDepartmentId = empData?.department_id || currentUser?.department_id || null;
      }
    } catch (ex) {
      console.warn("⚠️ ค้นหา department_id ขัดข้อง ใช้ค่าจาก Session แทน:", ex);
      managerDepartmentId = empData?.department_id || currentUser?.department_id || null;
    }
  } else {
    managerDepartmentId = empData?.department_id || currentUser?.department_id || null;
  }

  // 6. สร้าง แท็บ UI และดึงรายการใบลามาแสดง
  injectRoleTabs();
  updateTabUiStyles();
  await fetchLeaveRequestsData();

  console.groupEnd();
});

/** 🔌 เชื่อมต่อ Supabase */
function initializeSupabaseWithDebug() {
  if (_pvtDebugSbInstance) return true;

  const CONF_SUPABASE_URL = window.SUPABASE_URL || "https://pgogmhqjdchakcytsomx.supabase.co"; 
  const CONF_SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === "function") {
    _pvtDebugSbInstance = window.pvtSupabase.getClient();
    return true;
  }
  if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
    _pvtDebugSbInstance = window.supabaseClient;
    return true;
  }
  if (typeof window.supabase !== "undefined") {
    try {
      _pvtDebugSbInstance = window.supabase.createClient(CONF_SUPABASE_URL, CONF_SUPABASE_ANON_KEY);
      if (_pvtDebugSbInstance) return true;
    } catch (err) {
      console.error("❌ สร้าง client ล้มเหลว:", err);
    }
  }
  return false;
}

/** 🎫 ฉีดแท็บสลับบทบาท (พร้อมซ่อนแท็บผู้จัดการ หากสิทธิ์ไม่ถึง) */
function injectRoleTabs() {
  const statsGrid = document.querySelector('.stats-grid');
  if (statsGrid && !document.getElementById('pvtRoleTabs')) {
    const tabContainer = document.createElement('div');
    tabContainer.id = 'pvtRoleTabs';
    tabContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 16px; margin-bottom: 8px; flex-wrap: wrap;';

    // 🔍 ตรวจสอบสิทธิ์ผู้ใช้งานปัจจุบัน
    const savedSession = sessionStorage.getItem("currentUser");
    const currentUser = savedSession ? JSON.parse(savedSession) : {};
    const userRole = String(currentUser.role || window.currentProfile?.role || "").toLowerCase();
    const positionName = String(currentUser.position_name || "").toLowerCase();

    // กำหนดว่าใครบ้างที่จะเห็นแท็บ "ด่านที่ 2: ผู้จัดการฝ่าย"
    const canAccessDirectorTab = userRole === "director" || 
                                 userRole === "admin" || 
                                 userRole === "hr" || 
                                 positionName.includes("ผู้จัดการฝ่าย") || 
                                 positionName.includes("ผู้อำนวยการ");

    let tabsHtml = `
      <button id="btnRoleManager" style="padding: 10px 20px; border-radius: 10px; border: 1px solid var(--border-light); background: var(--primary); color: white; font-family: inherit; font-weight: 600; cursor: pointer; transition: all 0.2s;" onclick="switchRole('manager')">
        ด่านที่ 1: หัวหน้าแผนก (รอตรวจ)
      </button>
    `;

    // แสดงปุ่มด่านที่ 2 เฉพาะผู้ที่มีสิทธิ์เท่านั้น
    if (canAccessDirectorTab) {
      tabsHtml += `
        <button id="btnRoleDirector" style="padding: 10px 20px; border-radius: 10px; border: 1px solid var(--border-light); background: #ffffff; color: var(--text-muted); font-family: inherit; font-weight: 600; cursor: pointer; transition: all 0.2s;" onclick="switchRole('director')">
          ด่านที่ 2: ผู้จัดการฝ่าย (อนุมัติ)
        </button>
      `;
    }

    tabContainer.innerHTML = tabsHtml;
    statsGrid.parentNode.insertBefore(tabContainer, statsGrid);
  }
}

/** 🔄 สลับบทบาท (พร้อมระบบ Guard เช็กสิทธิ์ก่อนเปลี่ยนด่าน) */
async function switchRole(role) {
  // 🔍 ตรวจสอบสิทธิ์ก่อนยอมให้สลับไปด่านที่ 2
  if (role === "director") {
    const savedSession = sessionStorage.getItem("currentUser");
    const currentUser = savedSession ? JSON.parse(savedSession) : {};
    const userRole = String(currentUser.role || window.currentProfile?.role || "").toLowerCase();
    const positionName = String(currentUser.position_name || "").toLowerCase();

    const canAccessDirector = userRole === "director" || 
                              userRole === "admin" || 
                              userRole === "hr" || 
                              positionName.includes("ผู้จัดการฝ่าย") || 
                              positionName.includes("ผู้อำนวยการ");

    if (!canAccessDirector) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'warning',
          title: 'สิทธิ์ไม่ถูกต้อง',
          text: 'เฉพาะผู้จัดการฝ่ายหรือผู้อำนวยการเท่านั้น ที่สามารถเข้าถึงด่านอนุมัตินี้ได้'
        });
      } else {
        alert("⛔ เฉพาะผู้จัดการฝ่ายหรือผู้อำนวยการเท่านั้น ที่สามารถเข้าถึงด่านอนุมัตินี้ได้");
      }
      return; // 🛑 บล็อกไม่ให้สลับด่าน
    }
  }

  currentRoleState = role;
  updateTabUiStyles();
  await fetchLeaveRequestsData();
}

function updateTabUiStyles() {
  const btnManager = document.getElementById('btnRoleManager');
  const btnDirector = document.getElementById('btnRoleDirector');
  if (btnManager && btnDirector) {
    if (currentRoleState === 'manager') {
      btnManager.style.background = 'var(--primary)';
      btnManager.style.color = 'white';
      btnDirector.style.background = '#ffffff';
      btnDirector.style.color = 'var(--text-muted)';
    } else {
      btnDirector.style.background = 'var(--primary)';
      btnDirector.style.color = 'white';
      btnManager.style.background = '#ffffff';
      btnManager.style.color = 'var(--text-muted)';
    }
  }

  const titleEl = document.getElementById("tableTitle");
  if (titleEl) {
    titleEl.textContent = currentRoleState === "manager" 
      ? "รายการคำขอลาของพนักงานในแผนก (ด่านที่ 1: หัวหน้าแผนกตรวจสอบ)" 
      : "รายการคำขอลาของพนักงานทั้งฝ่าย (ด่านที่ 2: ผู้จัดการฝ่ายอนุมัติสมบูรณ์)";
  }
}

/** 📥 ดึงข้อมูลใบลา */
async function fetchLeaveRequestsData() {
  if (!initializeSupabaseWithDebug()) {
    updateUiWithError("ไม่สามารถเชื่อมต่อฐานข้อมูล Supabase ได้");
    return;
  }

  try {
    let query = _pvtDebugSbInstance
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id (
          id, full_name, employee_code, start_date, nickname, department_id,
          departments ( department_name ), positions ( position_name )
        ),
        leave_types ( leave_name )
      `);

    if (currentRoleState === "manager") {
      query = query.eq("status", "pending");
    } else {
      query = query.eq("status", "approved_by_leaders");
    }

    const { data: leaves, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    let finalFilteredData = leaves || [];
    if (currentRoleState === "manager" && managerDepartmentId) {
      finalFilteredData = finalFilteredData.filter(
        req => req.employees?.department_id === managerDepartmentId
      );
    }

    rawRequests = finalFilteredData;
    renderTable(rawRequests);
    updateCounterCards(rawRequests);

  } catch (err) {
    console.error("💥 ดึงข้อมูลขัดข้อง:", err);
    updateUiWithError("เกิดข้อผิดพลาดในการดึงข้อมูลใบลาจากระบบ");
  }
}

/** 🎨 วาดตารางข้อมูล */
function renderTable(requests) {
  const tableBody = document.getElementById("leaveTableBody");
  if (!tableBody) return;

  if (requests.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:40px; color:var(--text-muted);">ไม่มีรายการคำขอลาค้างพิจารณาในระบบขณะนี้</td></tr>`;
    return;
  }

  tableBody.innerHTML = "";
  
  requests.forEach((req) => {
    const empData = req.employees || {};
    const empCode = empData.employee_code || "-";
    const empName = empData.full_name || "-";
    const leaveName = req.leave_types?.leave_name || "-";
    const reasonText = req.reason || "-";
    
    const formatDate = (dateStr) => {
      if (!dateStr) return "-";
      return new Date(dateStr).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
    };
    const leavePeriod = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;
    
    let statusBadge = "";
    if (req.status === 'pending') {
      statusBadge = `<span class="status-badge status-pending">รอหัวหน้าตรวจ</span>`;
    } else if (req.status === 'approved_by_leaders') {
      statusBadge = `<span class="status-badge status-approved">หัวหน้าผ่านแล้ว</span>`;
    } else {
      statusBadge = `<span class="status-badge">${req.status}</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:600; color:var(--text-dark);">${empName}</div>
        <div style="font-size:12px; color:var(--text-muted);">รหัส: ${empCode}</div>
      </td>
      <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:13px; font-weight:500;">${leaveName}</span></td>
      <td style="color:var(--text-muted); font-size:13px;">${leavePeriod}</td>
      <td style="font-weight:600; color:var(--primary); text-align:center;">${req.total_days || 0} วัน</td>
      <td style="max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reasonText}">${reasonText}</td>
      <td style="text-align:center;">${statusBadge}</td>
      <td style="text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button style="background:var(--primary); color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;" onclick="processApproval('${req.id}', '${req.status}')">พิจารณา</button>
          <button style="background:#f1f5f9; color:var(--text-muted); border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="printLeaveA4('${req.id}')">พิมพ์ A4</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/** 🔢 อัปเดตการ์ดสถิติ */
function updateCounterCards(allRequests) {
  const pendingEl = document.getElementById("countPending");
  const approvedEl = document.getElementById("countApproved");
  const rejectedEl = document.getElementById("countRejected");

  const pendingCount = allRequests.filter(r => r.status === 'pending' || r.status === 'approved_by_leaders').length;
  const approvedCount = allRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length;

  if (pendingEl) pendingEl.innerHTML = `${pendingCount} <small>รายการ</small>`;
  if (approvedEl) approvedEl.innerHTML = `${approvedCount} <small>รายการ</small>`;
  if (rejectedEl) rejectedEl.innerHTML = `${rejectedCount} <small>รายการ</small>`;
}

function updateUiWithError(msg) {
  const tableBody = document.getElementById("leaveTableBody");
  if (tableBody) tableBody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#ef4444; padding:20px; font-weight:bold;">❌ ${msg}</td></tr>`;
}

/** 🛠️ เปิด Modal พิจารณาใบลา */
function processApproval(id, currentStatus) {
  const selectedLeave = rawRequests.find(r => r.id === id);
  if (!selectedLeave) return;

  const modal = document.getElementById("actionModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalEmpName = document.getElementById("modalEmployeeName");
  const commentInput = document.getElementById("approvalComment");

  if (!modal) return;

  const isManager = currentStatus === 'pending';
  const roleTitle = isManager ? 'หัวหน้าแผนก (ด่านที่ 1)' : 'ผู้จัดการฝ่าย (ด่านที่ 2)';

  if (modalTitle) modalTitle.textContent = `พิจารณาอนุมัติใบลาโดย: ${roleTitle}`;
  if (modalEmpName) modalEmpName.textContent = `พนักงาน: ${selectedLeave.employees?.full_name || '-'} (${selectedLeave.leave_types?.leave_name})`;
  if (commentInput) commentInput.value = "";

  const footerLayout = modal.querySelector('.modal-actions');
  if (footerLayout) {
    footerLayout.innerHTML = `
      <button id="btnCancelAction" style="background:#f1f5f9; color:var(--text-muted); border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:500;">ยกเลิก</button>
      <button id="btnRejectAction" style="background:#ef4444; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:600;">✕ ปฏิเสธการลา</button>
      <button id="btnApproveAction" style="background:var(--primary); color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-weight:600;">✓ อนุมัติใบลา</button>
    `;

    document.getElementById("btnCancelAction").onclick = () => { modal.style.display = "none"; };
    document.getElementById("btnApproveAction").onclick = () => { executeStatusUpdate(id, currentStatus, 'approve'); };
    document.getElementById("btnRejectAction").onclick = () => { executeStatusUpdate(id, currentStatus, 'reject'); };
  }

  modal.style.display = "flex";
}

/** 💾 บันทึกผลอนุมัติ */
async function executeStatusUpdate(id, currentStatus, action) {
  if (!initializeSupabaseWithDebug()) return;

  const isManager = currentStatus === 'pending';
  let finalStatus = action === 'approve' ? (isManager ? 'approved_by_leaders' : 'approved') : 'rejected';
  
  let updatePayload = { status: finalStatus };
  if (isManager) updatePayload.manager_status = action === 'approve' ? 'approved' : 'rejected';
  else updatePayload.director_status = action === 'approve' ? 'approved' : 'rejected';

  try {
    const { error } = await _pvtDebugSbInstance
      .from("leave_requests")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;

    document.getElementById("actionModal").style.display = "none";
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', text: 'อัปเดตสถานะเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
    } else {
      alert('🎉 บันทึกผลเรียบร้อยแล้ว!');
    }
    await fetchLeaveRequestsData();

  } catch (err) {
    console.error("💥 อัปเดตล้มเหลว:", err);
    alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
}

/** 🖨️ พิมพ์เอกสาร A4 */
async function printLeaveA4(leaveId) {
  if (!initializeSupabaseWithDebug()) return;

  try {
    const { data: leave, error } = await _pvtDebugSbInstance
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, nickname, departments(department_name), positions(position_name) ),
        leave_types ( leave_name )
      `)
      .eq("id", leaveId)
      .single();

    if (error) throw error;

    const emp = leave.employees || {};
    const printWin = window.open("", "_blank");
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ใบขออนุมัติลาหยุด - ${emp.full_name || ''}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 15mm 20mm; }
          body { font-family: 'Sarabun', sans-serif; padding: 20px; line-height: 1.6; }
          h2 { color: #0fa472; border-bottom: 2px solid #0fa472; padding-bottom: 8px; }
          .info-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .info-table td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <h2>ใบขออนุมัติลาหยุดงาน (E-Leave System)</h2>
        <table class="info-table">
          <tr><td><strong>รหัสพนักงาน:</strong> ${emp.employee_code || '-'}</td><td><strong>ชื่อ-นามสกุล:</strong> ${emp.full_name || '-'}</td></tr>
          <tr><td><strong>แผนก:</strong> ${emp.departments?.department_name || '-'}</td><td><strong>ตำแหน่ง:</strong> ${emp.positions?.position_name || '-'}</td></tr>
          <tr><td><strong>ประเภทการลา:</strong> ${leave.leave_types?.leave_name || '-'}</td><td><strong>จำนวน:</strong> ${leave.total_days} วัน</td></tr>
          <tr><td colspan="2"><strong>เหตุผล:</strong> ${leave.reason || '-'}</td></tr>
          <tr><td colspan="2"><strong>สถานะปัจจุบัน:</strong> ${leave.status}</td></tr>
        </table>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
      </html>
    `);
    printWin.document.close();
  } catch (err) {
    alert('ไม่สามารถพิมพ์เอกสารได้: ' + err.message);
  }
}