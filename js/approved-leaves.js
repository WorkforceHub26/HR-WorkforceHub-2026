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
 * 🎨 5. ฟังก์ชันวาดตารางรายการใบลาลงบนหน้าจอ HTML (อัปเดตให้ตรงกับ HTML 7 คอลัมน์)
 */
function renderTable(requests) {
  const tableBody = document.getElementById("leaveTableBody");
  if (!tableBody) return;

  if (requests.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#64748b; font-weight:500;">ไม่มีรายการคำขอลาค้างพิจารณาในระบบสิทธิ์นี้</td></tr>`;
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
    
    // ปรับโครงสร้างใหม่ให้เป็น 7 <td> พอดีกับหัวตาราง
    tr.innerHTML = `
      <td style="padding:16px;">
        <div style="font-weight:600; color:#0f172a;">${empName}</div>
        <div style="font-size:12px; color:#64748b;">รหัส: ${empCode}</div>
      </td>
      <td style="padding:16px;"><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:13px; font-weight:500;">${leaveName}</span></td>
      <td style="padding:16px; color:#475569; font-size:13px;">${leavePeriod}</td>
      <td style="padding:16px; font-weight:600; color:#0fa472; text-align:center;">${req.total_days || 0} วัน</td>
      <td style="padding:16px; max-width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reasonText}">${reasonText}</td>
      <td style="padding:16px; text-align:center;">${statusBadge}</td>
      <td style="padding:16px; text-align:center;">
        <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
          <button style="width:100%; background:#0fa472; color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="processApproval('${req.id}', '${req.status}')">พิจารณา</button>
          <button style="width:100%; background:#f1f5f9; color:#475569; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="printLeaveA4('${req.id}')">พิมพ์ A4</button>
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
 * 🛠️ 8. ฟังก์ชันเปิดหน้าต่างจัดการคำขอลา
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

  // 🔴 จุดที่แก้ไข: เปลี่ยนมาค้นหาผ่าน Class .modal-actions หรือโครงสร้างเดิม
  const footerLayout = modal.querySelector('.modal-actions') || modal.querySelector('div[style*="justify-content:flex-end"]');
  
  if (footerLayout) {
    // สร้างปุ่มใหม่ให้ครบทั้ง ยกเลิก, ปฏิเสธ, อนุมัติ
    footerLayout.innerHTML = `
      <button id="btnCancelAction" class="btn-cancel" style="background:#f1f5f9; color:#475569; border:none; padding:10px 18px; border-radius:8px; cursor:pointer; font-family:inherit; font-weight:500;">ยกเลิก</button>
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
  // 🔴 แก้ไข: ดึงอินสแตนซ์ Supabase ที่เราเชื่อมต่อไว้แล้วตั้งแต่ต้นไฟล์มาใช้
  const sb = _pvtDebugSbInstance; 
  if (!sb) {
    alert("ไม่สามารถเชื่อมต่อฐานข้อมูลเพื่อพิมพ์เอกสารได้");
    return;
  }

  // 🔴 แก้ไข: ดักจับกรณีที่หน้า HTML ไม่ได้ติดตั้ง SweetAlert2 ไว้ โค้ดจะได้ไม่พัง
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'กำลังจัดทำหน้าเอกสาร...',
      text: 'โปรดรอมุมมองพิมพ์สักครู่',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });
  } else {
    console.log("⏳ กำลังโหลดข้อมูลสำหรับพิมพ์เอกสาร...");
  }

  try {
    // ดึงข้อมูลพนักงาน (จอยตารางแผนก และตำแหน่งเพิ่มเติมเพื่อความโปรดักทีฟสูงสุด)
    const { data: leave, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( 
          full_name, 
          employee_code, 
          nickname, 
          departments(department_name),
          positions(position_name)
        ),
        leave_types ( leave_name )
      `)
      .eq("id", leaveId)
      .single();

    if (error) throw error;
    if (typeof Swal !== 'undefined') Swal.close(); // ปิดป๊อปอัปโหลด

    const emp = leave.employees || {};
    const deptName = emp.departments?.department_name || '-';
    const posName = emp.positions?.position_name || '-';
    
    // แปลงรูปแบบวันที่และเวลาให้อ่านง่ายสไตล์ราชการ/บริษัทชั้นนำ
    const formatFullDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatDateTime = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.';
    };

    const dWrite = formatDateTime(leave.created_at);
    const dStart = formatFullDate(leave.start_date);
    const dEnd = formatFullDate(leave.end_date);

    // กำหนดการแสดตราประทับสถานะ (Digital Approved Stamp)
    let stampHtml = "";
    if (leave.status === 'approved') {
      stampHtml = `
        <div class="digital-stamp approved-stamp">
          <div class="stamp-title">APPROVED</div>
          <div class="stamp-sub">อนุมัติผ่านระบบดิจิทัล</div>
          <div class="stamp-date">${formatDateTime(leave.approved_at)}</div>
        </div>
      `;
    } else if (leave.status === 'rejected') {
      stampHtml = `
        <div class="digital-stamp rejected-stamp">
          <div class="stamp-title">REJECTED</div>
          <div class="stamp-sub">ปฏิเสธผ่านระบบ</div>
          <div class="stamp-date">${formatDateTime(leave.approved_at)}</div>
        </div>
      `;
    } else {
      stampHtml = `
        <div class="digital-stamp pending-stamp">
          <div class="stamp-title">PENDING</div>
          <div class="stamp-sub">รอผลการพิจารณา</div>
        </div>
      `;
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
          @page {
            size: A4;
            margin: 15mm 20mm;
          }
          body {
            font-family: 'Sarabun', sans-serif;
            color: #1e293b;
            background-color: #fff;
            margin: 0;
            padding: 0;
            line-height: 1.5;
            font-size: 14px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* ส่วนหัวเอกสารแบบ Corporate */
          .document-container {
            position: relative;
            width: 100%;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .company-logo-section {
            vertical-align: middle;
          }
          .logo-placeholder {
            display: inline-block;
            background: #1e3a8a;
            color: white;
            font-weight: bold;
            font-size: 18px;
            padding: 8px 14px;
            border-radius: 4px;
            letter-spacing: 1px;
            margin-right: 12px;
          }
          .company-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            text-transform: uppercase;
          }
          .doc-title-container {
            text-align: right;
            vertical-align: middle;
          }
          .doc-title-main {
            font-size: 20px;
            font-weight: 700;
            color: #1e3a8a;
            margin: 0 0 5px 0;
          }
          .doc-title-sub {
            font-size: 11px;
            color: #64748b;
            letter-spacing: 0.5px;
          }

          /* ตราประทับดิจิทัล */
          .digital-stamp {
            position: absolute;
            top: 70px;
            right: 0;
            border: 3px double;
            border-radius: 8px;
            padding: 8px 15px;
            text-align: center;
            font-weight: bold;
            transform: rotate(-3deg);
            opacity: 0.85;
            width: 160px;
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .approved-stamp {
            color: #059669;
            border-color: #059669;
          }
          .rejected-stamp {
            color: #dc2626;
            border-color: #dc2626;
          }
          .pending-stamp {
            color: #d97706;
            border-color: #d97706;
          }
          .stamp-title {
            font-size: 18px;
            letter-spacing: 2px;
          }
          .stamp-sub {
            font-size: 10px;
            font-weight: normal;
            margin-top: 2px;
          }
          .stamp-date {
            font-size: 9px;
            font-weight: normal;
            color: #64748b;
          }

          /* ข้อมูลเอกสารทั่วไป */
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            margin-bottom: 25px;
          }
          .meta-table td {
            padding: 10px 15px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 13.5px;
          }
          .meta-table tr:last-child td {
            border-bottom: none;
          }
          .meta-label {
            color: #64748b;
            font-weight: 500;
            width: 20%;
          }
          .meta-val {
            color: #0f172a;
            font-weight: 600;
            width: 30%;
          }

          /* รายละเอียดเนื้อหา */
          .section-heading {
            font-size: 13px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            border-bottom: 2px solid #cbd5e1;
            padding-bottom: 6px;
            margin-bottom: 12px;
            margin-top: 15px;
          }

          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          .details-table th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 700;
            text-align: left;
            padding: 12px;
            font-size: 13px;
            border-bottom: 2px solid #cbd5e1;
          }
          .details-table td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
            font-size: 13.5px;
          }
          
          /* กล่องลงนาม (Signatures Matrix) */
          .signature-section {
            margin-top: 40px;
            page-break-inside: avoid;
          }
          .signature-grid {
            width: 100%;
            border-collapse: collapse;
          }
          .signature-box {
            width: 25%;
            border: 1px solid #cbd5e1;
            padding: 12px;
            text-align: center;
            vertical-align: bottom;
            font-size: 12px;
            background: #fff;
          }
          .signature-title {
            font-weight: 700;
            color: #334155;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 8px;
            margin-bottom: 40px;
            text-align: center;
          }
          .sig-line {
            border-bottom: 1px dotted #94a3b8;
            width: 85%;
            margin: 0 auto 5px auto;
            min-height: 20px;
          }
          .sig-name {
            font-weight: 500;
            color: #0f172a;
            margin-bottom: 2px;
          }
          .sig-date {
            font-size: 11px;
            color: #64748b;
          }

          /* ท้ายหน้ากระดาษ */
          .footer-note {
            margin-top: 35px;
            font-size: 11px;
            color: #94a3b8;
            text-align: center;
            border-top: 1px solid #f1f5f9;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="document-container">
          
          <!-- ตราประทับผลการอนุมัติ -->
          ${stampHtml}

          <!-- Header -->
          <table class="header-table">
            <tr>
              <td class="company-logo-section">
                <span class="logo-placeholder">PVT</span>
                <span class="company-title">บริษัท พีวีที เทคโนโลยี (ประเทศไทย) จำกัด</span>
              </td>
              <td class="doc-title-container">
                <div class="doc-title-main">ใบขออนุมัติลาหยุดงาน</div>
                <div class="doc-title-sub">LEAVE REQUEST FORM / E-LEAVE SYSTEM</div>
              </td>
            </tr>
          </table>

          <!-- Section 1: ข้อมูลผู้ขออนุมัติ -->
          <div class="section-heading">ข้อมูลผู้ยื่นคำขอ (Employee Profile)</div>
          <table class="meta-table">
            <tr>
              <td class="meta-label">รหัสพนักงาน:</td>
              <td class="meta-val">${emp.employee_code || '-'}</td>
              <td class="meta-label">ชื่อ - นามสกุล:</td>
              <td class="meta-val">${emp.full_name || '-'} (${emp.nickname || '-'})</td>
            </tr>
            <tr>
              <td class="meta-label">สังกัดแผนก / ฝ่าย:</td>
              <td class="meta-val">${deptName}</td>
              <td class="meta-label">ตำแหน่งปัจจุบัน:</td>
              <td class="meta-val">${posName}</td>
            </tr>
            <tr>
              <td class="meta-label">วันที่ส่งขอใบลา:</td>
              <td class="meta-val" colspan="3">${dWrite}</td>
            </tr>
          </table>

          <!-- Section 2: รายละเอียดวันหยุดงาน -->
          <div class="section-heading">รายละเอียดความประสงค์ขอลาหยุดงาน (Request Details)</div>
          <table class="details-table">
            <thead>
              <tr>
                <th width="25%">ประเภทการลา</th>
                <th width="35%">ช่วงเวลาเริ่มต้น - สิ้นสุด</th>
                <th width="15%" style="text-align: center;">รวมระยะเวลา</th>
                <th width="25%">เหตุผลความจำเป็น</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600; color: #1e3a8a;">
                  ${leave.leave_types?.leave_name || '-'}
                </td>
                <td>
                  <strong>วันที่เริ่มลา:</strong> ${dStart}<br>
                  <strong>ถึงวันที่ลา:</strong> ${dEnd}
                </td>
                <td style="text-align: center; font-weight: 700; font-size: 15px; color: #0f172a;">
                  ${leave.total_days} วัน
                </td>
                <td style="font-size:12.5px; color:#475569;">
                  ${leave.reason || '-'}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- ระบบบันทึกผลประกอบการพิจารณาพิเศษ (ถ้ามีเหตุผลปฏิเสธหรือหมายเหตุจาก HR) -->
          ${leave.approval_comment ? `
          <div class="section-heading" style="color:#dc2626;">ความคิดเห็น/หมายเหตุประกอบการพิจารณา</div>
          <div style="background-color: #fff5f5; border: 1px solid #fee2e2; border-radius: 6px; padding: 12px 15px; font-size:13px; color: #991b1b; font-weight:500;">
             📝 ${leave.approval_comment}
          </div>
          ` : ''}

          <!-- Section 3: แผงลงลายมือชื่อพนักงานและผู้มีอำนาจ (Signatures Matrix) -->
          <div class="section-heading" style="margin-top: 30px;">การตรวจสอบและพิจารณาอนุมัติ (Workflow Approvals)</div>
          <table class="signature-grid">
            <tr>
              <!-- 1. ช่องลงนามผู้ขอลา -->
              <td class="signature-box">
                <div class="signature-title">ผู้ขออนุมัติลา</div>
                <div class="sig-line"></div>
                <div class="sig-name">( ${emp.full_name || '...........................................'} )</div>
                <div class="sig-date">วันที่ยื่น: ${formatFullDate(leave.created_at)}</div>
              </td>
              
              <!-- 2. หัวหน้างานอนุมัติ (Manager) -->
              <td class="signature-box">
                <div class="signature-title">ผู้บังคับบัญชาชั้นต้น (หัวหน้า)</div>
                <div class="sig-line">
                  ${leave.manager_status === 'approved' ? '<span style="color:#059669; font-weight:bold;">✓ ได้รับอนุมัติผ่านระบบ</span>' : (leave.manager_status === 'rejected' ? '<span style="color:#dc2626; font-weight:bold;">❌ ปฏิเสธการลา</span>' : '')}
                </div>
                <div class="sig-name">...................................................</div>
                <div class="sig-date">สถานะ: ${leave.manager_status === 'approved' ? 'ผ่านอนุมัติแล้ว' : (leave.manager_status === 'rejected' ? 'ปฏิเสธ' : 'รอการพิจารณา')}</div>
              </td>
              
              <!-- 3. ผู้บริหารระดับผู้จัดการ (Director) -->
              <td class="signature-box">
                <div class="signature-title">ผู้พิจารณาขั้นสูง (ผู้จัดการ)</div>
                <div class="sig-line">
                  ${leave.director_status === 'approved' ? '<span style="color:#059669; font-weight:bold;">✓ ได้รับอนุมัติผ่านระบบ</span>' : (leave.director_status === 'rejected' ? '<span style="color:#dc2626; font-weight:bold;">❌ ปฏิเสธการลา</span>' : '')}
                </div>
                <div class="sig-name">...................................................</div>
                <div class="sig-date">สถานะ: ${leave.director_status === 'approved' ? 'ผ่านอนุมัติแล้ว' : (leave.director_status === 'rejected' ? 'ปฏิเสธ' : 'รอการพิจารณา')}</div>
              </td>
              
              <!-- 4. HR บันทึกเข้าระบบ -->
              <td class="signature-box">
                <div class="signature-title">ฝ่ายทรัพยากรบุคคล (HR)</div>
                <div class="sig-line">
                  ${leave.status === 'approved' ? '<span style="color:#059669; font-weight:bold;">✓ บันทึกลงระบบสำเร็จ</span>' : (leave.status === 'rejected' ? '<span style="color:#dc2626; font-weight:bold;">❌ ยกเลิก/ปฏิเสธ</span>' : '')}
                </div>
                <div class="sig-name">...................................................</div>
                <div class="sig-date">สถานะ: ${leave.status === 'approved' ? 'บันทึกเรียบร้อย' : 'รอรับผล'}</div>
              </td>
            </tr>
          </table>

          <!-- Footer Metadata -->
          <div class="footer-note">
            เอกสารฉบับนี้ถูกจัดทำขึ้นด้วยระบบบริหารจัดการทรัพยากรบุคคลอัตโนมัติ PVT HR E-Leave System<br>
            รหัสร่องรอยตรวจสอบ (Trace ID): ${leaveId} (ข้อมูลเชื่อมโยงฐานข้อมูลหลัก)
          </div>

        </div>

        <script>
          window.onload = function() { 
            setTimeout(() => {
              window.print(); 
              window.close(); 
            }, 500);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();

  } catch (err) {
    if (typeof Swal !== 'undefined') {
      Swal.fire('ไม่สามารถพิมพ์เอกสารได้', err.message, 'error');
    } else {
      alert('เกิดข้อผิดพลาดในการพิมพ์: ' + err.message);
    }
  }
}