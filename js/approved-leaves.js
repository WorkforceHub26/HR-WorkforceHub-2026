/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - LEADER APPROVAL ENGINE (FULLY ALIGNED VERSION)
 * ==========================================================================
 */

let _pvtDebugSbInstance = null;
let rawRequests = [];
let currentRoleState = "manager"; // 'manager' = หัวหน้าแผนก (ด่าน 1), 'director' = ผู้จัดการฝ่าย (ด่าน 2)

// บังคับให้ระบบโหลดโครงสร้างหน้าเว็บ (HTML DOM) ให้เสร็จสมบูรณ์ 100% ก่อนเริ่มรันสคริปต์
document.addEventListener("DOMContentLoaded", async () => {
  console.group("🚀 [PVT INIT] เริ่มต้นโหลดระบบพิจารณาอนุมัติใบลา");
  
  // 1. ตรวจสอบและเปิดท่อเชื่อมต่อ Supabase
  const isConnected = initializeSupabaseWithDebug();
  
  if (!isConnected) {
    console.error("❌ [PVT INIT] ปิดการทำงาน: เชื่อมต่อ Supabase ไม่สำเร็จ!");
    console.groupEnd();
    updateUiWithError("ไม่สามารถเชื่อมต่อฐานข้อมูลหลักได้");
    return;
  }

  // 🆕 [ระบบตรวจสอบและแยกสิทธิ์อัตโนมัติเมื่อผู้ใช้งาน Login เข้ามา]
  try {
    const savedSession = sessionStorage.getItem("currentUser");
    if (savedSession) {
      const currentUser = JSON.parse(savedSession);
      const role = (currentUser.role || "").toLowerCase();
      const position = (currentUser.position_name || "").toLowerCase();
      
      // ตรวจสอบคำว่า 'ผู้จัดการฝ่าย' หรือ 'ผู้อำนวยการ' หรือสิทธิ์ระดับบริหาร
      if (role === "director" || role === "admin" || position.includes("ผู้จัดการฝ่าย") || position.includes("ผู้อำนวยการ")) {
        currentRoleState = "director";
        console.log("👮 [Auto Detect] ตรวจพบสิทธิ์: ระดับผู้จัดการฝ่าย/ผู้บริหาร (ปรับเป็นด่านที่ 2 อัตโนมัติ)");
      } else {
        currentRoleState = "manager";
        console.log("🧑‍💼 [Auto Detect] ตรวจพบสิทธิ์: ระดับหัวหน้าแผนก (ปรับเป็นด่านที่ 1 อัตโนมัติ)");
      }
    }
  } catch (ex) {
    console.error("⚠️ ไม่สามารถตรวจสอบประวัติการ Login (Session) ได้:", ex);
  }

  // 2. สร้างแท็บสลับสิทธิ์ผู้ใช้งานอัตโนมัติ (เนื่องจากมีการถอด Sidebar ออกไป)
  injectRoleTabs();

  // 🆕 [ซิงค์ไฮไลท์สีปุ่มแท็บและหัวตารางให้ตรงกับสิทธิ์ที่ตรวจเจออัตโนมัติ]
  const btnManager = document.getElementById('btnRoleManager');
  const btnDirector = document.getElementById('btnRoleDirector');
  if (btnManager && btnDirector) {
    if (currentRoleState === 'manager') {
      btnManager.style.background = 'var(--primary, #0fa472)';
      btnManager.style.color = 'white';
      btnDirector.style.background = '#ffffff';
      btnDirector.style.color = 'var(--text-soft, #64748b)';
    } else {
      btnDirector.style.background = 'var(--primary, #0fa472)';
      btnDirector.style.color = 'white';
      btnManager.style.background = '#ffffff';
      btnManager.style.color = 'var(--text-soft, #64748b)';
    }
  }

  const titleEl = document.getElementById("tableTitle") || document.querySelector(".section-title strong");
  if (titleEl) {
    titleEl.textContent = currentRoleState === "manager" 
      ? "ตารางพิจารณาคำขอลา (ด่านที่ 1: หัวหน้าแผนกตรวจสอบ)" 
      : "ตารางพิจารณาคำขอลา (ด่านที่ 2: ผู้จัดการฝ่ายอนุมัติสมบูรณ์)";
  }

  // 3. ดึงข้อมูลมาแสดงผล (หน่วงเวลาเล็กน้อยเพื่อให้ HTML Render ตัวเองเสร็จชัวร์ๆ)
  setTimeout(async () => {
    console.log("📥 [PVT INIT] เริ่มส่งคำสั่งคิวรีข้อมูลใบลาจาก Database...");
    await fetchLeaveRequestsData();
    console.groupEnd();
  }, 100);
});

/**
 * 🔌 1. ฟังก์ชันเชื่อมต่อฐานข้อมูล Supabase Client
 */
function initializeSupabaseWithDebug() {
  const CONF_SUPABASE_URL = window.SUPABASE_URL || "https://pgogmhqjdchakcytsomx.supabase.co"; 
  const CONF_SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

  if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
    _pvtDebugSbInstance = window.supabaseClient;
    return true;
  }
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === "function") {
    _pvtDebugSbInstance = window.pvtSupabase.getClient();
    return true;
  }
  if (typeof window.supabase !== "undefined") {
    try {
      _pvtDebugSbInstance = window.supabase.createClient(CONF_SUPABASE_URL, CONF_SUPABASE_ANON_KEY);
      if (_pvtDebugSbInstance && typeof _pvtDebugSbInstance.from === "function") return true;
    } catch (err) {
      console.error("❌ สั่ง createClient อัตโนมัติล้มเหลว:", err);
    }
  }
  return false;
}

/**
 * 🎫 2. ฟังก์ชันฉีดแท็บสลับสิทธิ์การอนุมัติ (Manager / Director) เข้าสู่หน้าจอโดยตรง
 */
function injectRoleTabs() {
  const statsGrid = document.querySelector('.stats-grid');
  if (statsGrid && !document.getElementById('pvtRoleTabs')) {
    const tabContainer = document.createElement('div');
    tabContainer.id = 'pvtRoleTabs';
    tabContainer.style.cssText = 'display: flex; gap: 10px; margin-top: 24px; margin-bottom: 8px; flex-wrap: wrap;';
    tabContainer.innerHTML = `
      <button id="btnRoleManager" style="padding: 10px 20px; border-radius: 10px; border: 1px solid var(--border); background: var(--primary, #0fa472); color: white; font-family: inherit; font-weight: 600; cursor: pointer; transition: all 0.2s;" onclick="switchRole('manager')">ด่านที่ 1: หัวหน้าแผนก (รอตรวจ)</button>
      <button id="btnRoleDirector" style="padding: 10px 20px; border-radius: 10px; border: 1px solid var(--border); background: #ffffff; color: var(--text-soft, #64748b); font-family: inherit; font-weight: 600; cursor: pointer; transition: all 0.2s;" onclick="switchRole('director')">ด่านที่ 2: ผู้จัดการฝ่าย (อนุมัติ)</button>
    `;
    statsGrid.parentNode.insertBefore(tabContainer, statsGrid);
  }
}

/**
 * 🔄 3. ฟังก์ชันสลับบทบาทการตรวจสอบ และเปลี่ยนสีปุ่มไฮไลท์แท็บ
 */
async function switchRole(role) {
  console.group(`🔄 [ROLE SWITCH] สลับสิทธิ์เป็น -> "${role}"`);
  currentRoleState = role;
  
  // อัปเดตสไตล์สีปุ่มแท็บ
  const btnManager = document.getElementById('btnRoleManager');
  const btnDirector = document.getElementById('btnRoleDirector');
  if (btnManager && btnDirector) {
    if (role === 'manager') {
      btnManager.style.background = 'var(--primary, #0fa472)';
      btnManager.style.color = 'white';
      btnDirector.style.background = '#ffffff';
      btnDirector.style.color = 'var(--text-soft, #64748b)';
    } else {
      btnDirector.style.background = 'var(--primary, #0fa472)';
      btnDirector.style.color = 'white';
      btnManager.style.background = '#ffffff';
      btnManager.style.color = 'var(--text-soft, #64748b)';
    }
  }

  // อัปเดตข้อความหัวตาราง (ดักจับผ่านโครงสร้าง Element ของตัวแทนคลาส)
  const titleEl = document.getElementById("tableTitle") || document.querySelector(".section-title strong");
  if (titleEl) {
    titleEl.textContent = role === "manager" 
      ? "ตารางพิจารณาคำขอลา (ด่านที่ 1: หัวหน้าแผนกตรวจสอบ)" 
      : "ตารางพิจารณาคำขอลา (ด่านที่ 2: ผู้จัดการฝ่ายอนุมัติสมบูรณ์)";
  }

  await fetchLeaveRequestsData();
  console.groupEnd();
}

/**
 * 📥 4. ฟังก์ชันดึงข้อมูลใบลาค้างพิจารณา
 */
async function fetchLeaveRequestsData() {
  if (!_pvtDebugSbInstance) return;

  try {
    let query = _pvtDebugSbInstance
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id (
          full_name,
          employee_code,
          start_date,
          nickname,
          departments ( department_name ),
          positions ( position_name )
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

    rawRequests = leaves || [];
    renderTable(rawRequests);
    updateCounterCards(rawRequests);

  } catch (err) {
    console.error("💥 ระบบดึงข้อมูลขัดข้อง:", err);
    updateUiWithError("เกิดข้อผิดพลาดในการดึงข้อมูลใบลาจากระบบฐานข้อมูล");
  }
}

/**
 * 🎨 5. ฟังก์ชันวาดตารางรายการใบลาลงบนหน้าจอ HTML
 */
function renderTable(requests) {
  const tableBody = document.getElementById("leaveTableBody");
  if (!tableBody) return;

  if (requests.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:#64748b; font-weight:500;">ไม่มีรายการคำขอลาค้างพิจารณาในระบบสิทธิ์นี้</td></tr>`;
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
      if(!dateStr) return "-";
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
    };
    const leavePeriod = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;
    
    let statusBadge = "";
    if (req.status === 'pending') {
      statusBadge = `<span style="background:#fef3c7; color:#d97706; padding:4px 10px; border-radius:99px; font-size:12px; font-weight:500;">รอหัวหน้าตรวจ</span>`;
    } else if (req.status === 'approved_by_leaders') {
      statusBadge = `<span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:99px; font-size:12px; font-weight:500;">หัวหน้าผ่านแล้ว</span>`;
    } else {
      statusBadge = `<span style="background:#e5e7eb; color:#374151; padding:4px 10px; border-radius:99px; font-size:12px; font-weight:500;">${req.status}</span>`;
    }

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid var(--border)";
    tr.innerHTML = `
      <td style="padding:16px; font-weight:600; color:#475569;">${empCode}</td>
      <td style="padding:16px; font-weight:500; color:#0f172a;">${empName}</td>
      <td style="padding:16px;"><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:13px; font-weight:500;">${leaveName}</span></td>
      <td style="padding:16px; color:#475569;">${leavePeriod}</td>
      <td style="padding:16px; font-weight:600; color:#0fa472;">${req.total_days || 0} วัน</td>
      <td style="padding:16px; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reasonText}">${reasonText}</td>
      <td style="padding:16px;">${statusBadge}</td>
      <td style="padding:16px; text-align:center;">
        <div style="display:flex; gap:6px; justify-content:center;">
          <button style="background:#0fa472; color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="processApproval('${req.id}', '${req.status}')">พิจารณา</button>
          <button style="background:#f1f5f9; color:#475569; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="printLeaveA4('${req.id}')">พิมพ์ A4</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

/**
 * 🔢 6. ฟังก์ชันอัปเดตตัวเลขการ์ดสถิติ
 */
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

/**
 * ⚠️ 7. ฟังก์ชันแสดงข้อความ Error บนตารางกรณีระบบขัดข้อง
 */
function updateUiWithError(message) {
  const tableBody = document.getElementById("leaveTableBody");
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px; font-weight:bold;">❌ ${message}</td></tr>`;
  }
}

/**
 * 🛠️ 8. ฟังก์ชันเปิดหน้าต่างจัดการคำขอลา (เชื่อมเข้าหากล่อง #actionModal ใน HTML จริงอย่างสมบูรณ์)
 */
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

  // ส่งข้อมูลพนักงานขึ้น Modal แสดงผล
  if (modalTitle) modalTitle.textContent = `พิจารณาอนุมัติใบลาโดย: ${roleTitle}`;
  if (modalEmpName) modalEmpName.textContent = `พนักงาน: ${selectedLeave.employees?.full_name || '-'} (${selectedLeave.leave_types?.leave_name})`;
  if (commentInput) commentInput.value = ""; // เคลียร์ข้อความเก่าออกก่อน

  // ทำการสลับปุ่มกดยืนยันให้มีตัวเลือก [อนุมัติ] และ [ปฏิเสธ] ในหน้าต่างของกล่อง HTML
  const footerLayout = modal.querySelector('div[style*="justify-content:flex-end"]');
  if (footerLayout) {
    footerLayout.innerHTML = `
      <button id="btnCancelAction" style="background:#f1f5f9; color:#475569; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:500;">ยกเลิก</button>
      <button id="btnRejectAction" style="background:#ef4444; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:600;">✕ ปฏิเสธการลา</button>
      <button id="btnApproveAction" style="background:#0fa472; color:#fff; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:600;">✓ อนุมัติใบลา</button>
    `;

    // ผูก Event ฝังคำสั่งเมื่อกดปุ่ม
    document.getElementById("btnCancelAction").onclick = () => { modal.style.display = "none"; };
    document.getElementById("btnApproveAction").onclick = () => { executeStatusUpdate(id, currentStatus, 'approve'); };
    document.getElementById("btnRejectAction").onclick = () => { executeStatusUpdate(id, currentStatus, 'reject'); };
  }

  // สั่งเปิดแสดงผล Modal ขึ้นหน้าจอ
  modal.style.display = "flex";
}

/**
 * 💾 9. ฟังก์ชันยิงอัปเดตสถานะใบลาลงสู่ Supabase Database
 */
async function executeStatusUpdate(id, currentStatus, action) {
  if (!_pvtDebugSbInstance) return;

  const isManager = currentStatus === 'pending';
  const commentText = document.getElementById("approvalComment")?.value.trim() || "";
  
  let finalStatus = null;
  let updatePayload = {};

  if (action === 'approve') {
    finalStatus = isManager ? 'approved_by_leaders' : 'approved';
    if (isManager) {
      updatePayload.manager_status = 'approved';
    } else {
      updatePayload.director_status = 'approved';
    }
  } else {
    finalStatus = 'rejected';
    if (isManager) {
      updatePayload.manager_status = 'rejected';
    } else {
      updatePayload.director_status = 'rejected';
    }
  }

  updatePayload.status = finalStatus;
  
  // หมายเหตุ: โค้ดส่วนนี้รองรับฟิลด์บันทึกความเห็นลงตาราง (กรณีมีคอลัมน์ leader_comment ใน DB)
  // updatePayload.leader_comment = commentText;

  try {
    const { error } = await _pvtDebugSbInstance
      .from("leave_requests")
      .update(updatePayload)
      .eq("id", id);

    if (error) throw error;

    // ซ่อนหน้าต่างและแจ้งเตือนผลลัพธ์
    document.getElementById("actionModal").style.display = "none";
    alert('🎉 บันทึกผลการพิจารณาใบลาเรียบร้อยแล้ว!');
    await fetchLeaveRequestsData();

  } catch (err) {
    console.error("💥 ไม่สามารถอัปเดตสถานะได้:", err);
    alert('เกิดข้อผิดพลาด: ไม่สามารถบันทึกการเปลี่ยนสิทธิ์ใบลาใบนี้ได้');
  }
}

/**
 * 🖨️ 10. ฟังก์ชันพิมพ์สลิปเอกสารลงกระดาษขนาด A4
 */
async function printLeaveA4(leaveId) {
  if(!_pvtDebugSbInstance) return;
  try {
    const { data: leave } = await _pvtDebugSbInstance.from("leave_requests").select().eq("id", leaveId).maybeSingle();
    const { data: emp } = await _pvtDebugSbInstance.from("employees").select(`
        full_name, employee_code, start_date, nickname,
        departments(department_name), positions(position_name)
    `).eq("id", leave.employee_id).maybeSingle();
    const { data: leaveType } = await _pvtDebugSbInstance.from("leave_types").select("leave_name").eq("id", leave.leave_type_id).maybeSingle();

    const formatShortDate = (dStr) => {
      if(!dStr) return '';
      const d = new Date(dStr);
      return `${d.getDate().toString().padStart(2,'0')}${(d.getMonth()+1).toString().padStart(2,'0')}${(d.getFullYear()+543).toString().slice(-2)}`;
    };

    const dWrite = formatShortDate(leave.created_at);
    const dStart = formatShortDate(leave.start_date);
    const dEnd = formatShortDate(leave.end_date);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>พิมพ์ใบลา - ${emp?.full_name}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
          body { font-family: 'Sarabun', sans-serif; padding: 30px; color: #000; }
          .header-title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 25px; }
          .info-group { margin-bottom: 20px; line-height: 2; }
          .row { display: flex; margin-bottom: 5px; }
          .col { font-size: 14px; }
          .underline { font-weight: bold; border-bottom: 1px dotted #000; padding: 0 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #000; padding: 10px; text-align: center; font-size: 13px; }
        </style>
      </head>
      <body onload="window.print()">
        <div class="header-title">ใบขออนุมัติลาหยุดงาน</div>
        <div class="info-group">
          <div class="row">
            <div class="col" style="width: 50%;">ชื่อ-สกุล: <span class="underline">${emp?.full_name || '-'}</span></div>
            <div class="col" style="width: 50%;">รหัสพนักงาน: <span class="underline">${emp?.employee_code || '-'}</span></div>
          </div>
          <div class="row">
            <div class="col" style="width: 50%;">ตำแหน่ง: <span class="underline">${emp?.positions?.position_name || '-'}</span></div>
            <div class="col" style="width: 50%;">ฝ่าย/แผนก: <span class="underline">${emp?.departments?.department_name || '-'}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>วันที่เขียน</th>
              <th>จากวันที่</th>
              <th>ถึงวันที่</th>
              <th>รวมวัน</th>
              <th>ประเภทการลา</th>
              <th>เหตุผลการลา</th>
              <th>ผู้ขอลา</th>
              <th>ผอ.อนุมัติ</th>
              <th>ผจก.อนุมัติ</th>
              <th>HR บันทึก</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${dWrite}</td>
              <td>${dStart}</td>
              <td>${dEnd}</td>
              <td style="font-weight:bold;">${leave.total_days}</td>
              <td>${leaveType?.leave_name || '-'}</td>
              <td style="text-align:left;">${leave.reason || '-'}</td>
              <td>${emp?.nickname || ''}</td>
              <td style="color:green; font-weight:bold;">${leave.director_status === 'approved' ? '✓ อนุมัติ' : ''}</td>
              <td style="color:green; font-weight:bold;">${leave.manager_status === 'approved' ? '✓ อนุมัติ' : ''}</td>
              <td style="color:blue; font-weight:bold;">${leave.status === 'approved' ? '✓ บันทึก' : ''}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (err) {
    console.error("❌ ระบบพิมพ์รายงานขัดข้อง:", err);
  }
}