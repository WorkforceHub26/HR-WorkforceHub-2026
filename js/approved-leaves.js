/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - LEADER APPROVAL ENGINE (PERFECTLY MATCHED)
 * ==========================================================================
 */

let _pvtDebugSbInstance = null;
let rawRequests = [];
let currentRoleState = "manager"; // 'manager' = หัวหน้าแผนก (ด่าน 1), 'director' = ผู้จัดการฝ่าย (ด่าน 2)

// บังคับให้ระบบโหลดโครงสร้างหน้าเว็บ (HTML DOM) ให้เสร็จสมบูรณ์ 100% ก่อนเริ่มรันสคริปต์
document.addEventListener("DOMContentLoaded", async () => {
  console.group("🚀 [PVT INIT] เริ่มต้นโหลดระบบพิจารณาอนุมัติใบลา");
  
  // 1. ตรวจสอบและเปิดท่อเชื่อมต่อ
  const isConnected = initializeSupabaseWithDebug();
  
  if (!isConnected) {
    console.error("❌ [PVT INIT] ปิดการทำงาน: เชื่อมต่อ Supabase ไม่สำเร็จ!");
    console.groupEnd();
    updateUiWithError("ไม่สามารถเชื่อมต่อฐานข้อมูลหลักได้");
    return;
  }

  // 2. ดึงข้อมูลมาแสดงผล (หน่วงเวลาเล็กน้อยเพื่อให้ HTML Render ตัวเองเสร็จชัวร์ๆ)
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
  console.group("🔌 [DEBUG CONNECTION] ตรวจสอบช่องทางเกาะสัญญาณ Supabase");
  
  // คอนฟิกสำรองในกรณีระบบหา Global ไม่เจอ
  const CONF_SUPABASE_URL = window.SUPABASE_URL || "https://pgogmhqjdchakcytsomx.supabase.co"; 
  const CONF_SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

  if (window.supabaseClient && typeof window.supabaseClient.from === "function") {
    _pvtDebugSbInstance = window.supabaseClient;
    console.info("🎉 สรุป: เชื่อมต่อสำเร็จผ่าน window.supabaseClient");
    console.groupEnd();
    return true;
  }

  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === "function") {
    _pvtDebugSbInstance = window.pvtSupabase.getClient();
    console.info("🎉 สรุป: เชื่อมต่อสำเร็จผ่าน window.pvtSupabase.getClient()");
    console.groupEnd();
    return true;
  }

  if (typeof window.supabase !== "undefined") {
    try {
      _pvtDebugSbInstance = window.supabase.createClient(CONF_SUPABASE_URL, CONF_SUPABASE_ANON_KEY);
      if (_pvtDebugSbInstance && typeof _pvtDebugSbInstance.from === "function") {
        console.info("🎉 สรุป: เปิดท่อเชื่อมต่อใหม่สำเร็จผ่าน window.supabase.createClient()");
        console.groupEnd();
        return true;
      }
    } catch (err) {
      console.error("❌ สั่ง createClient อัตโนมัติล้มเหลว:", err);
    }
  }

  console.groupEnd();
  return false;
}

/**
 * 🔄 2. ฟังก์ชันสลับบทบาทการตรวจสอบ (ด่านที่ 1 / ด่านที่ 2)
 */
async function switchRole(role) {
  console.group(`🔄 [ROLE SWITCH] สลับสิทธิ์เป็น -> "${role}"`);
  currentRoleState = role;
  
  const titleEl = document.getElementById("tableTitle");
  if (titleEl) {
    titleEl.textContent = role === "manager" 
      ? "รายการใบลาที่รอหัวหน้าแผนกตรวจสอบ (ด่านที่ 1)" 
      : "รายการใบลาที่รอผู้จัดการฝ่ายพิจารณาอนุมัติ (ด่านที่ 2)";
  }

  await fetchLeaveRequestsData();
  console.groupEnd();
}

/**
 * 📥 3. ฟังก์ชันดึงข้อมูลใบลาค้างพิจารณา
 */
async function fetchLeaveRequestsData() {
  console.group(`📥 [DATABASE QUERY] ค้นหาคิวใบลาของสิทธิ์: ${currentRoleState}`);
  
  if (!_pvtDebugSbInstance) {
    console.error("❌ ไม่สามารถคิวรีได้: ไม่มี Object เชื่อมต่อฐานข้อมูล");
    console.groupEnd();
    return;
  }

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

    // คัดกรองข้อมูลตามบทบาทด่านพิจารณา
    if (currentRoleState === "manager") {
      query = query.eq("status", "pending");
    } else {
      query = query.eq("status", "approved_by_leaders");
    }

    const { data: leaves, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("❌ เซิร์ฟเวอร์พ่น Error กลับมา:", error);
      throw error;
    }

    rawRequests = leaves || [];
    console.info(`📊 ดึงสำเร็จ! พบข้อมูลค้างในระบบทั้งหมด: ${rawRequests.length} รายการ`, rawRequests);

    // ส่งต่อไปวาดตารางและอัปเดตแจ้งเตือน
    renderTable(rawRequests);
    updateCounterCards(rawRequests);

  } catch (err) {
    console.error("💥 ระบบดึงข้อมูลขัดข้อง:", err);
    updateUiWithError("เกิดข้อผิดพลาดในการดึงข้อมูลใบลาจากระบบฐานข้อมูล");
  }
  console.groupEnd();
}

/**
 * 🎨 4. ฟังก์ชันวาดตารางรายการใบลาลงบนหน้าจอ HTML (จับคู่ตรงกับ leaveTableBody)
 */
function renderTable(requests) {
  // 🔥 แก้ไขจุดนี้: ควานหา ID "leaveTableBody" ให้ตรงกับหน้า HTML เป๊ะๆ 
  const tableBody = document.getElementById("leaveTableBody");
  
  if (!tableBody) {
    console.error("❌ [RENDER ERROR] ไม่พบ Element id='leaveTableBody' ในหน้า HTML!");
    return;
  }

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
    
    // จัดฟอร์แมตวันที่ลาออกหน้าจอ
    const formatDate = (dateStr) => {
      if(!dateStr) return "-";
      const d = new Date(dateStr);
      return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
    };
    const leavePeriod = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;
    
    // ตั้งค่า Badge แสดงข้อความสถานะปัจจุบัน
    let statusBadge = "";
    if (req.status === 'pending') {
      statusBadge = `<span class="status-badge" style="background:#fef08a; color:#854d0e; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600;">รอหัวหน้าตรวจสอบ</span>`;
    } else if (req.status === 'approved_by_leaders') {
      statusBadge = `<span class="status-badge" style="background:#bfdbfe; color:#1e40af; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600;">หัวหน้าอนุมัติแล้ว</span>`;
    } else if (req.status === 'approved') {
      statusBadge = `<span class="status-badge" style="background:#bbf7d0; color:#166534; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600;">อนุมัติสมบูรณ์</span>`;
    } else if (req.status === 'rejected') {
      statusBadge = `<span class="status-badge" style="background:#fee2e2; color:#991b1b; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600;">ไม่อนุมัติ</span>`;
    } else {
      statusBadge = `<span class="status-badge" style="background:#e5e7eb; color:#374151; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:600;">${req.status}</span>`;
    }

    // สร้างแถว 8 คอลัมน์ให้ตรงตามหัวข้อตารางใน HTML 
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
        <div class="btn-action-group" style="display:flex; gap:6px; justify-content:center;">
          <button class="btn-ui approve" style="background:#0fa472; color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="processApproval('${req.id}', '${req.status}')">พิจารณา</button>
          <button class="btn-ui print" style="background:#f1f5f9; color:#475569; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="printLeaveA4('${req.id}')">พิมพ์ A4</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
  
  console.log(`🎨 [RENDER] วาดแถวตารางสำเร็จเรียบร้อย ทั้งหมด ${requests.length} รายการ`);
}

/**
 * 🔢 5. ฟังก์ชันอัปเดตตัวเลขบนการ์ดสถิติ (รออนุมัติ, อนุมัติแล้ว, ไม่อนุมัติ)
 */
function updateCounterCards(allRequests) {
  const pendingEl = document.getElementById("countPending");
  const approvedEl = document.getElementById("countApproved");
  const rejectedEl = document.getElementById("countRejected");

  // นับจำนวนจริงตามสถานะในชุดข้อมูล
  const pendingCount = allRequests.filter(r => r.status === 'pending' || r.status === 'approved_by_leaders').length;
  const approvedCount = allRequests.filter(r => r.status === 'approved').length;
  const rejectedCount = allRequests.filter(r => r.status === 'rejected').length;

  if (pendingEl) pendingEl.innerHTML = `${pendingCount} <small>รายการ</small>`;
  if (approvedEl) approvedEl.innerHTML = `${approvedCount} <small>รายการ</small>`;
  if (rejectedEl) rejectedEl.innerHTML = `${rejectedCount} <small>รายการ</small>`;
}

/**
 * ⚠️ 6. ฟังก์ชันแจ้งพ่น Error บนหน้า UI กรณีระบบขัดข้อง
 */
function updateUiWithError(message) {
  const tableBody = document.getElementById("leaveTableBody");
  if (tableBody) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px; font-weight:bold;">❌ ${message}</td></tr>`;
  }
}

/**
 * 🛠️ 7. ฟังก์ชันเปิดหน้าต่างบันทึกผลการอนุมัติใบลา
 */
async function processApproval(id, currentStatus) {
  if (!_pvtDebugSbInstance) return;

  const isManager = currentStatus === 'pending';
  const targetStatus = isManager ? 'approved_by_leaders' : 'approved';
  const roleTitle = isManager ? 'หัวหน้าแผนก (ด่านที่ 1)' : 'ผู้จัดการฝ่าย (ด่านที่ 2)';

  // ตรวจเช็คกล่อง Swal หากไม่มี จะทำการแจ้งเตือนเบื้องต้นก่อน
  if (typeof Swal === 'undefined') {
    const conf = confirm(`ต้องการยืนยันการ [อนุมัติ] ใบลาใบนี้ในฐานะ ${roleTitle} หรือไม่? (กด OK เพื่ออนุมัติ / Cancel เพื่อปฏิเสธ)`);
    let finalStatus = conf ? targetStatus : 'rejected';
    let updatePayload = { status: finalStatus };
    if (conf) {
      if (isManager) updatePayload.manager_status = 'approved'; else updatePayload.director_status = 'approved';
    } else {
      if (isManager) updatePayload.manager_status = 'rejected'; else updatePayload.director_status = 'rejected';
    }
    
    try {
      const { error } = await _pvtDebugSbInstance.from("leave_requests").update(updatePayload).eq("id", id);
      if (error) throw error;
      alert("บันทึกข้อมูลสำเร็จ!");
      await fetchLeaveRequestsData();
    } catch (e) { console.error(e); }
    return;
  }

  const result = await Swal.fire({
    title: 'บันทึกผลการพิจารณา',
    text: `กรุณายืนยันการดำเนินการพิจารณาใบลาในตำแหน่ง: ${roleTitle}`,
    icon: 'question',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonColor: '#0fa472',
    denyButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: '✓ อนุมัติ',
    denyButtonText: '✕ ปฏิเสธ',
    cancelButtonText: 'ปิดหน้าต่าง'
  });

  let finalStatus = null;
  let updatePayload = {};

  if (result.isConfirmed) {
    finalStatus = targetStatus;
    if (isManager) updatePayload.manager_status = 'approved';
    else updatePayload.director_status = 'approved';
  } else if (result.isDenied) {
    finalStatus = 'rejected';
    if (isManager) updatePayload.manager_status = 'rejected';
    else updatePayload.director_status = 'rejected';
  }

  if (finalStatus) {
    updatePayload.status = finalStatus;
    try {
      const { error } = await _pvtDebugSbInstance
        .from("leave_requests")
        .update(updatePayload)
        .eq("id", id);

      if (error) throw error;
      Swal.fire('บันทึกสำเร็จ!', 'ระบบปรับปรุงสถานะเรียบร้อยแล้ว', 'success');
      await fetchLeaveRequestsData();
    } catch (err) {
      console.error(err);
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถปรับเปลี่ยนสถานะใบลาได้', 'error');
    }
  }
}

/**
 * 🖨️ 8. ฟังก์ชันพิมพ์สลิปเอกสารลงกระดาษขนาด A4
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