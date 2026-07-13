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
// 🟡 2. ฟังก์ชันดึงข้อมูลใบลาลงตาราง (เวอร์ชันแยกครบ 3 สถานะ: หัวหน้า / ผู้จัดการ / HR)
// ==========================================
// ==========================================
// 🟡 2. ฟังก์ชันดึงข้อมูลใบลาลงตาราง (แยกครบ 3 สถานะ: หัวหน้า / ผู้จัดการ / HR)
// ==========================================
async function loadPendingLeavesHR() {
  const tbody = document.getElementById("leaveRequestsBody");
  if (!tbody) return;
  
  // ปรับ colspan เป็น 9 ให้ตรงกับโครงสร้างหัวตารางใหม่ใน HTML
  tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 40px; color: #64748b;">⏳ กำลังโหลดข้อมูล...</td></tr>`;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
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
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #10b981; padding: 40px;">✨ ไม่มีคำขออนุมัติลาค้างในระบบ</td></tr>`;
      return;
    }

    let htmlContent = "";
    data.forEach((req) => {
      const empName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
      const empCode = req.employees ? req.employees.employee_code : "-";
      const leaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ระบุ";
      const startDate = new Date(req.start_date).toLocaleDateString('th-TH');
      const endDate = new Date(req.end_date).toLocaleDateString('th-TH');
      const reason = req.reason || "-";
      
      // ==========================================
      // 🚨 1. ตรวจสอบการ "ลาเกินโควตา" จากตัวแดงที่แอบฝังมาจากหน้าพนักงาน
      // ==========================================
      const isOverQuota = reason.includes('🔴 [เกินโควตา]');
      
      // ลบข้อความ 🔴 [เกินโควตา] ออกตอนแสดงผลเหตุผล เพื่อความสะอาดตา 
      // (เราจะเอาไปทำไฮไลท์ตารางแทนให้ดูเป็นมืออาชีพกว่า)
      const cleanReason = reason.replace('🔴 [เกินโควตา]', '').trim();

      // กำหนดสีพื้นหลังแถว ถ้าเกินโควตา -> สีแดงอ่อน
      const rowStyle = isOverQuota 
        ? 'background-color: #fef2f2; border-left: 4px solid #ef4444; border-bottom: 1px solid #fee2e2;' 
        : 'background-color: transparent; border-bottom: 1px solid #e2e8f0;';
      // ==========================================
      
      // 🟢 1. Badge สถานะฝั่ง "หัวหน้า"
      let managerBadge = "";
      if (req.manager_status === 'approved') {
        managerBadge = `<span style="background:#d1fae5; color:#065f46; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">✓ อนุมัติ</span>`;
      } else if (req.manager_status === 'rejected') {
        managerBadge = `<span style="background:#fee2e2; color:#991b1b; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">❌ ปฏิเสธ</span>`;
      } else {
        managerBadge = `<span style="background:#fef08a; color:#854d0e; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">⏳ รอตรวจ</span>`;
      }

      // 🟢 2. Badge สถานะฝั่ง "ผู้จัดการ"
      let directorBadge = "";
      if (req.director_status === 'approved') {
        directorBadge = `<span style="background:#d1fae5; color:#065f46; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">✓ อนุมัติ</span>`;
      } else if (req.director_status === 'rejected') {
        directorBadge = `<span style="background:#fee2e2; color:#991b1b; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">❌ ปฏิเสธ</span>`;
      } else {
        directorBadge = `<span style="background:#f1f5f9; color:#475569; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">⏳ รออนุมัติ</span>`;
      }

      // 🟢 3. Badge สถานะฝั่ง "HR บันทึกผล"
      let hrBadge = "";
      if (req.status === 'pending') {
        hrBadge = `<span style="background:#eff6ff; color:#1d4ed8; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:95px;">⏳ รอ HR บันทึก</span>`;
      } else if (req.status === 'approved') {
        hrBadge = `<span style="background:#ecfdf5; color:#047857; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:95px;">🎉 บันทึกสำเร็จ</span>`;
      } else if (req.status === 'rejected') {
        hrBadge = `<span style="background:#fff5f5; color:#c53030; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:95px;">❌ ไม่ผ่านอนุมัติ</span>`;
      } else {
        hrBadge = `<span style="background:#e5e7eb; color:#374151; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:95px;">${req.status}</span>`;
      }

      // ประกอบช่องข้อมูล 9 คอลัมน์ตรงล็อกพอดี พร้อมแปะ rowStyle ให้สีพื้นหลัง
      htmlContent += `
        <tr style="${rowStyle}">
          <td style="padding:16px;"><strong>${empCode}</strong></td>
          <td style="padding:16px;">
            <div style="font-weight: 500; color: #0f172a;">${empName}</div>
            <a href="#" onclick="openLeavePopupModal('${req.id}'); return false;" style="font-size:12px; color:#3b82f6; text-decoration:none; display:inline-block; margin-top:4px;">🔍 ดูรายละเอียดใบลา</a>
          </td>
          <td style="padding:16px;">
            ${leaveType}
            ${isOverQuota ? '<br><span style="font-size: 11px; background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; display: inline-block;">⚠️ ลาเกินโควตา/หักเงิน (LWOP)</span>' : ''}
          </td>
          <td style="padding:16px; color:#475569;">${startDate} - ${endDate}<br><span style="font-size:11px; color:#64748b;">เหตุผล: ${cleanReason}</span></td>
          <td style="text-align: center; font-weight: 600; padding:16px; ${isOverQuota ? 'color: #ef4444;' : 'color: var(--admin-primary);'}">${req.total_days} วัน</td>
          
          <td style="text-align: center; padding:16px;">${managerBadge}</td>
          <td style="text-align: center; padding:16px;">${directorBadge}</td>
          <td style="text-align: center; padding:16px;">${hrBadge}</td>
          
          <td style="text-align: center; padding:16px;">
             <button class="action-btn btn-approve" onclick="approveLeave('${req.id}')" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; margin-right:4px;">✔️ อนุมัติ</button>
             <button class="action-btn btn-reject" onclick="rejectLeave('${req.id}')" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; margin-right:4px;">✖️ ไม่อนุมัติ</button>
             <button onclick="cancelLeaveHR('${req.id}')" style="background:#f59e0b; color:white; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;">🚫 ยกเลิก</button>
             <button class="action-btn btn-print" onclick="printLeaveA4('${req.id}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;">🖨️ พิมพ์</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = htmlContent;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red; padding: 20px;">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
  }
}

// ฟังก์ชันปุ่มยกเลิก
async function cancelLeaveHR(leaveId) {
  await rejectLeave(leaveId);
}

// 🆕 ฟังก์ชันรองรับเมื่อกดปุ่ม "🚫 ยกเลิก" (กรณีต้องการปัดตกใบลาผ่านบอร์ด HR)
async function cancelLeaveHR(leaveId) {
  // วิ่งไปใช้ Logic กล่องถามเหตุผลปฏิเสธร่วมกับปุ่มปฏิเสธได้ทันที
  await rejectLeave(leaveId);
}

// ==========================================
// 🔵 3. ฟังก์ชันเปิดป๊อปอัปใบลาดิจิทัล
// ==========================================
async function openLeavePopupModal(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

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

    const emp = leave.employees || {};
    const dStart = new Date(leave.start_date).toLocaleDateString('th-TH');
    const dEnd = new Date(leave.end_date).toLocaleDateString('th-TH');

    Swal.fire({
      title: '📄 รายละเอียดใบลาดิจิทัล',
      html: `
        <div style="text-align: left; font-size: 14px; line-height: 1.8; color: #334155;">
          <div style="background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #3b82f6;">
            <strong>พนักงาน:</strong> ${emp.full_name || '-'} (${emp.nickname || '-'}) <br>
            <strong>รหัสพนักงาน:</strong> ${emp.employee_code || '-'} | <strong>แผนก:</strong> ${emp.departments?.department_name || '-'}
          </div>
          <strong>ประเภทการลา:</strong> <span style="color: #0284c7; font-weight: bold;">${leave.leave_types?.leave_name || '-'}</span><br>
          <strong>ช่วงวันที่ลา:</strong> ${dStart} ถึง ${dEnd} (${leave.total_days} วัน)<br>
          <strong>เหตุผลการลา:</strong> ${leave.reason || '-'}<br>
          <strong>สถานะปัจจุบัน:</strong> ${leave.status}<br>
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

// ==========================================
// 🟢 ฟังก์ชันอนุมัติใบลา (พร้อมระบบตัดยอดโควตาวันลาอัตโนมัติ)
// ==========================================
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
  
  // ⏳ แสดงหน้าต่างโหลดข้อมูล ป้องกันคนกดซ้ำ
  Swal.fire({
    title: 'กำลังประมวลผล...',
    text: 'ระบบกำลังตรวจสอบและตัดยอดวันลา กรุณารอสักครู่',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // 1️⃣ ดึงข้อมูลใบลาใบนี้ ว่าพนักงานขอลาประเภทไหน และขอกี่วัน
    const { data: reqData, error: reqErr } = await sb
      .from('leave_requests')
      .select('employee_id, leave_type_id, total_days, start_date')
      .eq('id', leaveId)
      .single();
      
    if (reqErr) throw new Error("ดึงข้อมูลใบลาไม่สำเร็จ");

    // หาปีของวันที่เริ่มลา
    const currentYear = new Date(reqData.start_date).getFullYear();

    // 2️⃣ ไปดึงโควตาปัจจุบันของพนักงานในตาราง leave_balances
    const { data: balData, error: balErr } = await sb
      .from('leave_balances')
      .select('id, remaining_days, used_days')
      .eq('employee_id', reqData.employee_id)
      .eq('leave_type_id', reqData.leave_type_id)
      .eq('year', currentYear)
      .single();

    // ถ้าไม่เจอโควตา ให้ข้ามการตัดยอดไป (เผื่อเป็นเคสลานอกเหนือโควตา)
    if (!balErr && balData) {
      // 3️⃣ คำนวณวันลาที่เหลือและที่ใช้ไป
      const newUsed = (balData.used_days || 0) + reqData.total_days;
      const newRemaining = (balData.remaining_days || 0) - reqData.total_days;

      // 4️⃣ อัปเดตตาราง leave_balances (หักโควตาจริง)
      const { error: updateBalErr } = await sb
        .from('leave_balances')
        .update({ remaining_days: newRemaining, used_days: newUsed })
        .eq('id', balData.id);

      if (updateBalErr) throw new Error("เกิดข้อผิดพลาดในการหักโควตาวันลา");
    }

    // 5️⃣ อัปเดตสถานะใบลาเป็น approved (เสร็จสมบูรณ์)
    const { error: approveErr } = await sb.from('leave_requests').update({ 
      status: 'approved', 
      approved_by: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (approveErr) throw approveErr;
    
    Swal.fire('อนุมัติสำเร็จ!', 'ระบบได้อนุมัติและหักโควตาวันลาเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR(); // รีเฟรชตารางใหม่
    
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
    // 🎯 แก้ไขจาก approved_by_leaders เป็น approved_by ให้ตรงตาม DB
    const { error } = await sb.from('leave_requests').update({ 
      status: 'rejected', 
      approval_comment: reason.trim(), 
      approved_by: window.adminProfile?.employee_id || null, 
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
// 🔴 ฟังก์ชัน HR กดยกเลิก/ปฏิเสธใบลา (พร้อมระบบ "คืนโควตาวันลา" อัตโนมัติ)
// ==========================================
async function cancelLeaveHR(leaveId) {
  // 1️⃣ เด้งหน้าต่างให้ HR พิมพ์เหตุผลที่ยกเลิก
  const { value: reason } = await Swal.fire({
    title: 'ยืนยันการยกเลิกใบลา',
    input: 'text',
    inputLabel: 'ระบุเหตุผล (เช่น พนักงานมาทำงาน, ขอยกเลิกเอง)',
    inputPlaceholder: 'พิมพ์เหตุผลที่นี่...',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: '✔️ ยืนยันยกเลิก',
    cancelButtonText: 'ปิด'
  });

  if (reason === undefined) return; // ถ้า HR กดปุ่ม "ปิด/Cancel" ให้หยุดทำงาน

  const sb = window.pvtSupabase?.getClient();

  // ⏳ แสดงหน้าต่างโหลดข้อมูล
  Swal.fire({
    title: 'กำลังประมวลผล...',
    text: 'ระบบกำลังดำเนินการยกเลิกและคืนสิทธิ์วันลา (ถ้ามี)',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // 2️⃣ ดึงข้อมูลใบลาก่อน ว่าสถานะปัจจุบันคืออะไร ขอกี่วัน
    const { data: reqData, error: reqErr } = await sb
      .from('leave_requests')
      .select('employee_id, leave_type_id, total_days, start_date, status')
      .eq('id', leaveId)
      .single();
      
    if (reqErr) throw new Error("ดึงข้อมูลใบลาไม่สำเร็จ");

    // 3️⃣ ตรวจสอบว่า "เคยอนุมัติ (ตัดยอดไปแล้ว)" หรือไม่? 
    if (reqData.status === 'approved') {
      // 🔄 กระบวนการ "คืนโควตาวันลา" (Refund)
      const currentYear = new Date(reqData.start_date).getFullYear();
      
      const { data: balData, error: balErr } = await sb
        .from('leave_balances')
        .select('id, remaining_days, used_days')
        .eq('employee_id', reqData.employee_id)
        .eq('leave_type_id', reqData.leave_type_id)
        .eq('year', currentYear)
        .single();

      if (!balErr && balData) {
        // คืนวันลา: เอาวันลาคงเหลือมาบวกกลับ และเอาวันที่ใช้ไปมาลบออก
        const newRemaining = (balData.remaining_days || 0) + reqData.total_days;
        const newUsed = Math.max(0, (balData.used_days || 0) - reqData.total_days); // ลบแล้วห้ามติดลบ

        // ยิงคำสั่งอัปเดตคืนวันลากลับเข้าฐานข้อมูล
        const { error: updateBalErr } = await sb
          .from('leave_balances')
          .update({ remaining_days: newRemaining, used_days: newUsed })
          .eq('id', balData.id);

        if (updateBalErr) throw new Error("เกิดข้อผิดพลาดในการคืนโควตาวันลา");
      }
    }

    // 4️⃣ อัปเดตสถานะใบลาเป็น rejected พร้อมเซฟหมายเหตุที่ HR พิมพ์
    const { error: cancelErr } = await sb.from('leave_requests').update({ 
      status: 'rejected', 
      approval_comment: reason || 'HR ยกเลิกรายการ (พนักงานมาทำงาน)',
      approved_by: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (cancelErr) throw cancelErr;
    
    Swal.fire('ยกเลิกสำเร็จ!', 'ระบบได้ทำการยกเลิกและคืนโควตาวันลาให้พนักงานเรียบร้อยแล้ว', 'success');
    
    // โหลดตารางใหม่เพื่อแสดงผลล่าสุด
    if (typeof loadPendingLeavesHR === "function") {
      loadPendingLeavesHR(); 
    }
    
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==========================================
// 🖨️ 5. พิมพ์เอกสาร (Print A4)
// ==========================================
async function printLeaveA4(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { data: leave, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( full_name, employee_code, nickname, departments(department_name) ),
        leave_types ( leave_name )
      `)
      .eq("id", leaveId)
      .single();

    if (error) throw error;

    const emp = leave.employees || {};
    const dWrite = new Date(leave.created_at).toLocaleDateString('th-TH');
    const dStart = new Date(leave.start_date).toLocaleDateString('th-TH');
    const dEnd = new Date(leave.end_date).toLocaleDateString('th-TH');

    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
      <head>
        <title>พิมพ์ใบลาพนักงาน - ${emp.full_name || ''}</title>
        <style>
          body { font-family: 'Angsana New', 'Sarabun', sans-serif; padding: 40px; color: #000; line-height: 1.6; }
          .header { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 30px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 18px; }
          .info-table td { padding: 8px; vertical-align: top; }
          table.data-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 16px; }
          table.data-table th, table.data-table td { border: 1px solid #000; padding: 10px; text-align: center; }
          .underline { border-bottom: 1px dotted #000; padding-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="header">ใบขออนุมัติลาหยุดงาน (PVT HR SYSTEM)</div>
        <table class="info-table">
          <tr>
            <td width="50%"><strong>ชื่อ-นามสกุล:</strong> <span class="underline">${emp.full_name || '-'} (${emp.nickname || '-'})</span></td>
            <td width="50%"><strong>รหัสพนักงาน:</strong> <span class="underline">${emp.employee_code || '-'}</span></td>
          </tr>
          <tr>
            <td><strong>สังกัดแผนก:</strong> <span class="underline">${emp.departments?.department_name || '-'}</span></td>
            <td><strong>วันที่เขียนใบลา:</strong> <span class="underline">${dWrite}</span></td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr>
              <th>ประเภทการลา</th>
              <th>จากวันที่</th>
              <th>ถึงวันที่</th>
              <th>รวมจำนวนวัน</th>
              <th>เหตุผลความจำเป็น</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${leave.leave_types?.leave_name || '-'}</td>
              <td>${dStart}</td>
              <td>${dEnd}</td>
              <td style="font-weight:bold;">${leave.total_days} วัน</td>
              <td style="text-align:left;">${leave.reason || '-'}</td>
            </tr>
          </tbody>
        </table>
        
        <div style="margin-top: 60px; display: flex; justify-content: space-between; font-size: 18px;">
          <div style="text-align: center; width: 40%;">
            <br>ลงชื่อ..........................................................ผู้ขอลา<br>( ${emp.full_name || '...........................................'} )
          </div>
          <div style="text-align: center; width: 40%;">
            <br>ลงชื่อ..........................................................ผู้อนุมัติ<br>( HR / ผู้บังคับบัญชา )
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();

  } catch (err) {
    Swal.fire('ไม่สามารถพิมพ์ได้', err.message, 'error');
  }
}

// ==========================================
// 🚪 6. ฟังก์ชันออกจากระบบ (Logout)
// ==========================================
function handleLogout() {
  sessionStorage.removeItem("currentUser");
  window.location.href = "/login.html"; 
}