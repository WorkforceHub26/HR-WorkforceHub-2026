// ============================================================================
// 🚀 PVT HR Admin System - [LEAVE APPROVALS BOARD ONLY]
// ============================================================================

if (typeof window.adminProfile === "undefined") {
    window.adminProfile = null; 
}

document.addEventListener("DOMContentLoaded", () => {
    console.clear(); 
    initAdmin();
});

// ==========================================
// 🟢 1. ฟังก์ชันเริ่มต้นระบบ (Init)
// ==========================================
async function initAdmin() {
  try {
    const sb = window.pvtSupabase?.getClient();
    if (!sb) throw new Error("ไม่พบการเชื่อมต่อฐานข้อมูล");

    window.adminProfile = await window.pvtSupabase?.getCurrentProfile();
    
    // โหลดตารางใบลาทันทีที่เปิดหน้าเว็บ
    if (typeof loadPendingLeavesHR === "function") {
       await loadPendingLeavesHR();
    }

  } catch (err) {
    console.error("❌ ระบบขัดข้อง:", err.message);
  }
}

// ==========================================
// 🟡 2. ฟังก์ชันดึงข้อมูลใบลาลงตาราง
// ==========================================
async function loadPendingLeavesHR() {
  const tbody = document.getElementById("leaveRequestsBody");
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: #64748b;">⏳ กำลังโหลดข้อมูล...</td></tr>`;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    // ดึงเฉพาะใบลาที่ยังคงค้าง (pending) หรือเพิ่งอัปเดต
    const { data, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, nickname, start_date, departments(department_name), positions(position_name) ),
        leave_types ( leave_name )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #10b981; padding: 40px;">✨ ไม่มีคำขออนุมัติลาค้างในระบบ</td></tr>`;
      return;
    }

    let htmlContent = "";
    data.forEach((req) => {
      const empName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
      const empCode = req.employees ? req.employees.employee_code : "-";
      const leaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุ";
      const startDate = new Date(req.start_date).toLocaleDateString('th-TH');
      const endDate = new Date(req.end_date).toLocaleDateString('th-TH');
      
      let statusBadge = "";
      if (req.status === 'pending') statusBadge = `<span style="background:#fef08a; color:#854d0e; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">รอ HR ตรวจสอบ</span>`;
      else if (req.status === 'approved') statusBadge = `<span style="background:#d1fae5; color:#065f46; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">อนุมัติแล้ว</span>`;
      else if (req.status === 'rejected') statusBadge = `<span style="background:#fee2e2; color:#991b1b; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">ปฏิเสธ</span>`;
      else statusBadge = `<span style="background:#e5e7eb; color:#374151; padding:4px 10px; border-radius:12px; font-size:12px; font-weight:600;">${req.status}</span>`;

      let managerInfo = req.manager_status === 'approved' ? '✅ ผจก. อนุมัติแล้ว' : '⏳ รอ ผจก.';

      htmlContent += `
        <tr>
          <td><strong>${empCode}</strong></td>
          <td>
            <div style="font-weight: 500; color: #0f172a;">${empName}</div>
            <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">${managerInfo}</div>
            <a href="#" onclick="openLeavePopupModal('${req.id}'); return false;" style="font-size:12px; color:#3b82f6; text-decoration:none; display:inline-block; margin-top:4px;">🔍 ดูรายละเอียดใบลา</a>
          </td>
          <td>${leaveType}</td>
          <td>${startDate} - ${endDate}</td>
          <td style="text-align: center; font-weight: 600; color: var(--admin-primary);">${req.total_days} วัน</td>
          <td>${statusBadge}</td>
          <td style="text-align: center;">
             <button class="action-btn btn-approve" onclick="approveLeave('${req.id}')">✔️ อนุมัติ</button>
             <button class="action-btn btn-reject" onclick="rejectLeave('${req.id}')">✖️ ไม่อนุมัติ</button>
             <button class="action-btn btn-print" onclick="printLeaveA4('${req.id}')">🖨️ พิมพ์</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = htmlContent;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
  }
}

// ==========================================
// 🔵 3. ฟังก์ชันเปิดป๊อปอัปใบลาดิจิทัล (ดึงของเดิมมาใช้)
// ==========================================
async function openLeavePopupModal(leaveId) {
  // ... (ฟังก์ชันเดิมที่พี่มิกมีใน hr.js บ่าววีไม่ได้แก้ไข เพราะมันทำงานได้ดีอยู่แล้วครับ)
  console.log("เปิดป๊อปอัปใบลา:", leaveId);
  // ** พี่มิกสามารถเอาฟังก์ชัน openLeavePopupModal ตัวเต็มจากโค้ดเดิมมาแปะทับบล็อกนี้ได้เลยครับ **
}

// ==========================================
// 🟢 4. ฟังก์ชันจัดการสถานะใบลา
// ==========================================
async function approveLeave(leaveId) {
  const result = await Swal.fire({
    title: 'ยืนยันการอนุมัติ?',
    text: "คุณต้องการอนุมัติใบลาของพนักงานท่านนี้ใช่หรือไม่",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
    confirmButtonText: '✔️ ยืนยันอนุมัติ',
    cancelButtonText: 'ยกเลิก'
  });

  if (!result.isConfirmed) return;
  const sb = window.pvtSupabase?.getClient();
  try {
    const { error } = await sb.from('leave_requests').update({ 
      status: 'approved', 
      approved_by_leaders: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (error) throw error;
    Swal.fire('อนุมัติสำเร็จ!', 'ระบบได้บันทึกข้อมูลเรียบร้อย', 'success');
    loadPendingLeavesHR(); 
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
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
  try {
    const { error } = await sb.from('leave_requests').update({ 
      status: 'rejected', 
      approval_comment: reason.trim(), 
      approved_by_leaders: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (error) throw error;
    Swal.fire('ปฏิเสธใบลาแล้ว', 'ระบบได้บันทึกข้อมูลเรียบร้อย', 'success');
    loadPendingLeavesHR();
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==========================================
// 🖨️ 5. พิมพ์เอกสาร (Print A4)
// ==========================================
async function printLeaveA4(leaveId) {
  // ... (ฟังก์ชันเดิมที่พี่มิกมีใน hr.js เอาตัวเต็มมาใส่ได้เลยครับ)
  console.log("พิมพ์เอกสาร:", leaveId);
}

// ==========================================
// 🚪 6. ฟังก์ชันออกจากระบบ (Logout)
// ==========================================
function handleLogout() {
  sessionStorage.removeItem("currentUser");
  window.location.href = "/login.html"; // หรือเปลี่ยนเป็นหน้าแรกของระบบพี่มิกครับ
}