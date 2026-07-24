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

/* ==========================================================================
   🟢 1. SYSTEM INITIALIZATION & UTILITIES (เริ่มต้นระบบและเครื่องมือส่วนกลาง)
   ========================================================================== */

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

// 🧼 เครื่องมือจัดการแปลงแปลง URL รูปภาพพนักงาน ป้องกันภาพแตก
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

// 📅 เครื่องมือคำนวณวันทำงานจริง (ทำงานวันเสาร์ / ข้ามวันอาทิตย์ / หักวันหยุดพิเศษจาก DB)
async function calculateActualLeaveDays(startDateStr, endDateStr) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return 0;

  try {
    // ดึงวันหยุดพิเศษจากตารางปฏิทินที่ตั้งไว้
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

    // ลูปตรวจนับวันทำงานจริงทีละวัน
    while (start <= end) {
      const dayOfWeek = start.getDay(); // 0 = วันอาทิตย์, 6 = วันเสาร์
      const currentIsoString = start.toISOString().split('T')[0];

      // เงื่อนไข: ต้องไม่ใช่คำสั่งวันอาทิตย์ และไม่อยู่ในตารางวันหยุดพิเศษของบริษัท
      if (dayOfWeek !== 0 && !holidaySet.has(currentIsoString)) {
        totalDays++;
      }
      start.setDate(start.getDate() + 1);
    }
    return totalDays;

  } catch (err) {
    console.error("❌ คำนวณวันหยุดพิเศษล้มเหลว (ใช้ระบบสำรองหักเฉพาะวันอาทิตย์):", err.message);
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

// ==========================================
// 🟡 2. ฟังก์ชันดึงข้อมูลใบลาลงตาราง
// ==========================================
async function loadPendingLeavesHR() {
  const tbody = document.getElementById("leaveRequestsBody");
  if (!tbody) return;
  
  tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: #64748b;">⏳ กำลังโหลดคลังข้อมูลคำขอ...</td></tr>`;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { data, error } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id ( 
          full_name, 
          employee_code, 
          nickname, 
          start_date, 
          image_url, 
          departments(department_name), 
          positions(position_name) 
        ),
        leave_types ( leave_name ) 
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #10b981; padding: 40px;">✨ ไม่มีคำขออนุมัติลาค้างในระบบ</td></tr>`;
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
      
      const avatarUrl = getAvatarUrl(req.employees?.image_url);
      
      const isOverQuota = reason.includes('🔴 [เกินโควตา]');
      const cleanReason = reason.replace('🔴 [เกินโควตา]', '').trim();

      const rowStyle = isOverQuota 
        ? 'background-color: #fef2f2; border-left: 4px solid #ef4444; border-bottom: 1px solid #fee2e2;' 
        : 'background-color: transparent; border-bottom: 1px solid #e2e8f0;';
      
      let managerBadge = "";
      if (req.manager_status === 'approved') {
        managerBadge = `<span style="background:#d1fae5; color:#065f46; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">✓ อนุมัติ</span>`;
      } else if (req.manager_status === 'rejected') {
        managerBadge = `<span style="background:#fee2e2; color:#991b1b; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">❌ ปฏิเสธ</span>`;
      } else {
        managerBadge = `<span style="background:#fef08a; color:#854d0e; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">⏳ รอตรวจ</span>`;
      }

      let directorBadge = "";
      if (req.director_status === 'approved') {
        directorBadge = `<span style="background:#d1fae5; color:#065f46; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">✓ อนุมัติ</span>`;
      } else if (req.director_status === 'rejected') {
        directorBadge = `<span style="background:#fee2e2; color:#991b1b; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">❌ ปฏิเสธ</span>`;
      } else {
        directorBadge = `<span style="background:#f1f5f9; color:#475569; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:600; display:inline-block; min-width:90px;">⏳ รออนุมัติ</span>`;
      }

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

      htmlContent += `
        <tr style="${rowStyle}">
          <td style="text-align: center; vertical-align: middle; padding:16px;">
            <img src="${avatarUrl}" 
                 alt="${empName}" 
                 style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #e2e8f0; display: block; margin: 0 auto;"
                 onerror="this.src='/assets/img/default-avatar.jpg';">
          </td>
          <td style="padding:16px; vertical-align: middle;"><strong>${empCode}</strong></td>
          <td style="padding:16px; vertical-align: middle;">
            <div style="font-weight: 500; color: #0f172a;">${empName}</div>
            <a href="#" onclick="openLeavePopupModal('${req.id}'); return false;" style="font-size:12px; color:#3b82f6; text-decoration:none; display:inline-block; margin-top:4px;">🔍 ดูรายละเอียดใบลา</a>
          </td>
          <td style="padding:16px; vertical-align: middle;">
            ${leaveType}
            ${isOverQuota ? '<br><span style="font-size: 11px; background: #fee2e2; color: #ef4444; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-top: 4px; display: inline-block;">⚠️ ลาเกินโควตา/หักเงิน (LWOP)</span>' : ''}
          </td>
          <td style="padding:16px; color:#475569; vertical-align: middle;">${startDate} - ${endDate}<br><span style="font-size:11px; color:#64748b;">เหตุผล: ${cleanReason}</span></td>
          <td style="text-align: center; font-weight: 600; padding:16px; vertical-align: middle; ${isOverQuota ? 'color: #ef4444;' : 'color: var(--admin-primary);'}">${req.total_days} วัน</td>
          
          <td style="text-align: center; padding:16px; vertical-align: middle;">${managerBadge}</td>
          <td style="text-align: center; padding:16px; vertical-align: middle;">${directorBadge}</td>
          <td style="text-align: center; padding:16px; vertical-align: middle;">${hrBadge}</td>
          
          <td style="text-align: center; padding:16px; vertical-align: middle; white-space: nowrap;">
             <button class="action-btn btn-approve" onclick="approveLeave('${req.id}')" style="background:#10b981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; margin-right:4px;">✔️ อนุมัติ</button>
             <button class="action-btn btn-reject" onclick="rejectLeave('${req.id}')" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; margin-right:4px;">✖️ ไม่อนุมัติ</button>
             <button onclick="cancelLeaveHR('${req.id}')" style="background:#f59e0b; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500; margin-right:4px;">🚫 ยกเลิก</button>
             <button class="action-btn btn-print" onclick="printLeaveA4('${req.id}')" style="background:#3b82f6; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;">🖨️ พิมพ์</button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = htmlContent;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red; padding: 20px;">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
  }
}

/* ==========================================================================
   🔵 3. ACTION WORKFLOW HANDLERS (กระบวนการ อนุมัติ / ปฏิเสธ / ยกเลิกใบลา)
   ========================================================================== */

// 🟢 ฟังก์ชันอนุมัติใบลา + คัดกรองคำนวณวันหยุดพิเศษเพื่อหักยอดโควตาจริงแบบแม่นยำ
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
  
  Swal.fire({
    title: 'กำลังประมวลผล...',
    text: 'ระบบกำลังคำนวณวันหยุดและตัดยอดวันลา กรุณารอสักครู่',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // ดึงข้อมูลวันที่ของใบลาเพื่อนำมา Re-calculate
    const { data: reqData, error: reqErr } = await sb
      .from('leave_requests')
      .select('employee_id, leave_type_id, total_days, start_date, end_date')
      .eq('id', leaveId)
      .single();
      
    if (reqErr) throw new Error("ดึงข้อมูลใบลาไม่สำเร็จ");

    // 🔥 ตรวจสอบวันลาสุทธิผ่านฟังก์ชันจัดการปฏิทิน (Audit check)
    const auditedTotalDays = await calculateActualLeaveDays(reqData.start_date, reqData.end_date);
    const currentYear = new Date(reqData.start_date).getFullYear();

    const { data: balData, error: balErr } = await sb
      .from('leave_balances')
      .select('id, remaining_days, used_days')
      .eq('employee_id', reqData.employee_id)
      .eq('leave_type_id', reqData.leave_type_id)
      .eq('year', currentYear)
      .single();

    if (!balErr && balData) {
      // ใช้ผลลัพธ์จาก auditedTotalDays ที่ลบวันหยุดพิเศษกับวันอาทิตย์แล้ว
      const newUsed = (balData.used_days || 0) + auditedTotalDays;
      const newRemaining = (balData.remaining_days || 0) - auditedTotalDays;

      const { error: updateBalErr } = await sb
        .from('leave_balances')
        .update({ remaining_days: newRemaining, used_days: newUsed })
        .eq('id', balData.id);

      if (updateBalErr) throw new Error("เกิดข้อผิดพลาดในการหักโควตาวันลา");
    }

    // อัปเดตสถานะและบันทึกยอดวันลาสุทธิที่ผ่านการตรวจทานแล้วลงในตารางหลัก
    const { error: approveErr } = await sb.from('leave_requests').update({ 
      status: 'approved', 
      total_days: auditedTotalDays, 
      approved_by: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (approveErr) throw approveErr;
    
    Swal.fire('อนุมัติสำเร็จ!', `ระบบได้คำนวณและหักโควตาจริงจำนวน ${auditedTotalDays} วัน เรียบร้อยแล้ว`, 'success');
    loadPendingLeavesHR();
    
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// 🟡 ฟังก์ชันปฏิเสธใบลาค้างพิจารณา
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

// 🔴 ฟังก์ชัน HR สั่งยกเลิกใบลาทีหลัง (พร้อมระบบ Refund คืนยอดโควตาวันลากลับเข้าบัญชีอัตโนมัติ)
async function cancelLeaveHR(leaveId) {
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

  if (reason === undefined) return; 

  const sb = window.pvtSupabase?.getClient();

  Swal.fire({
    title: 'กำลังประมวลผล...',
    text: 'ระบบกำลังดำเนินการยกเลิกและคืนสิทธิ์วันลา (ถ้ามี)',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const { data: reqData, error: reqErr } = await sb
      .from('leave_requests')
      .select('employee_id, leave_type_id, total_days, start_date, status')
      .eq('id', leaveId)
      .single();
      
    if (reqErr) throw new Error("ดึงข้อมูลใบลาไม่สำเร็จ");

    if (reqData.status === 'approved') {
      const currentYear = new Date(reqData.start_date).getFullYear();
      
      const { data: balData, error: balErr } = await sb
        .from('leave_balances')
        .select('id, remaining_days, used_days')
        .eq('employee_id', reqData.employee_id)
        .eq('leave_type_id', reqData.leave_type_id)
        .eq('year', currentYear)
        .single();

      if (!balErr && balData) {
        const newRemaining = (balData.remaining_days || 0) + reqData.total_days;
        const newUsed = Math.max(0, (balData.used_days || 0) - reqData.total_days);

        const { error: updateBalErr } = await sb
          .from('leave_balances')
          .update({ remaining_days: newRemaining, used_days: newUsed })
          .eq('id', balData.id);

        if (updateBalErr) throw new Error("เกิดข้อผิดพลาดในการคืนโควตาวันลา");
      }
    }

    const { error: cancelErr } = await sb.from('leave_requests').update({ 
      status: 'rejected', 
      approval_comment: reason || 'HR ยกเลิกรายการ (พนักงานมาทำงาน)',
      approved_by: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (cancelErr) throw cancelErr;
    
    Swal.fire('ยกเลิกสำเร็จ!', 'ระบบได้ทำการยกเลิกและคืนโควตาวันลาให้พนักงานเรียบร้อยแล้ว', 'success');
    loadPendingLeavesHR(); 
    
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

/* ==========================================================================
   🔵 4. DIGITAL MODAL VIEW (หน้าต่างเปิดส่องดูข้อมูลใบลาอิเล็กทรอนิกส์)
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
          <img src="${modalAvatarUrl}" 
               style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #3b82f6; box-shadow: 0 2px 6px rgba(0,0,0,0.08);"
               onerror="this.src='/assets/img/default-avatar.jpg';">
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.2;">📄 รายละเอียดใบลาดิจิทัล</div>
            <div style="font-size: 13px; color: #64748b; margin-top: 2px;">คำขอผ่านระบบอิเล็กทรอนิกส์หลัก</div>
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
          <strong>สถานะปัจจุบัน:</strong> <span class="status-badge pending" style="padding: 2px 8px; font-size: 12px; font-weight: 600;">${leave.status}</span><br>
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

/* ==========================================================================
   🖨️ 5. DOCUMENT GENERATION ENGINE (พิมพ์เอกสารคำขอลาขนาด A4 Premium Style)
   ========================================================================== */

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
    Swal.close(); 

    const emp = leave.employees || {};
    const deptName = emp.departments?.department_name || '-';
    const posName = emp.positions?.position_name || '-';
    
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
          @page { size: A4; margin: 15mm 20mm; }
          body {
            font-family: 'Sarabun', sans-serif;
            color: #1e293b;
            background-color: #fff;
            margin: 0; padding: 0;
            line-height: 1.5; font-size: 14px;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .document-container { position: relative; width: 100%; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .logo-placeholder {
            display: inline-block; background: #1e3a8a; color: white;
            font-weight: bold; font-size: 18px; padding: 8px 14px;
            border-radius: 4px; letter-spacing: 1px; margin-right: 12px;
          }
          .company-title { font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
          .doc-title-container { text-align: right; vertical-align: middle; }
          .doc-title-main { font-size: 20px; font-weight: 700; color: #1e3a8a; margin: 0 0 5px 0; }
          .doc-title-sub { font-size: 11px; color: #64748b; letter-spacing: 0.5px; }
          .digital-stamp {
            position: absolute; top: 70px; right: 0; border: 3px double;
            border-radius: 8px; padding: 8px 15px; text-align: center;
            font-weight: bold; transform: rotate(-3deg); opacity: 0.85;
            width: 160px; background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          }
          .approved-stamp { color: #059669; border-color: #059669; }
          .rejected-stamp { color: #dc2626; border-color: #dc2626; }
          .pending-stamp { color: #d97706; border-color: #d97706; }
          .stamp-title { font-size: 18px; letter-spacing: 2px; }
          .stamp-sub { font-size: 10px; font-weight: normal; margin-top: 2px; }
          .stamp-date { font-size: 9px; font-weight: normal; color: #64748b; }
          .meta-table { width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 25px; }
          .meta-table td { padding: 10px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; }
          .meta-table tr:last-child td { border-bottom: none; }
          .meta-label { color: #64748b; font-weight: 500; width: 20%; }
          .meta-val { color: #0f172a; font-weight: 600; width: 30%; }
          .section-heading {
            font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase;
            border-bottom: 2px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 12px; margin-top: 15px;
          }
          .details-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .details-table th { background-color: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 12px; font-size: 13px; border-bottom: 2px solid #cbd5e1; }
          .details-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 13.5px; }
          .signature-section { margin-top: 40px; page-break-inside: avoid; }
          .signature-grid { width: 100%; border-collapse: collapse; }
          .signature-box { width: 25%; border: 1px solid #cbd5e1; padding: 12px; text-align: center; vertical-align: bottom; font-size: 12px; background: #fff; }
          .signature-title { font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 40px; text-align: center; }
          .sig-line { border-bottom: 1px dotted #94a3b8; width: 85%; margin: 0 auto 5px auto; min-height: 20px; }
          .sig-name { font-weight: 500; color: #0f172a; margin-bottom: 2px; }
          .sig-date { font-size: 11px; color: #64748b; }
          .footer-note { margin-top: 35px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="document-container">
          ${stampHtml}
          <table class="header-table">
            <tr>
              <td>
                <span class="logo-placeholder">PVT</span>
                <span class="company-title">บริษัท พีวีที เทคโนโลยี (ประเทศไทย) จำกัด</span>
              </td>
              <td class="doc-title-container">
                <div class="doc-title-main">ใบขออนุมัติลาหยุดงาน</div>
                <div class="doc-title-sub">LEAVE REQUEST FORM / E-LEAVE SYSTEM</div>
              </td>
            </tr>
          </table>

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
                <td style="font-weight: 600; color: #1e3a8a;">${leave.leave_types?.leave_name || '-'}</td>
                <td><strong>วันที่เริ่มลา:</strong> ${dStart}<br><strong>ถึงวันที่ลา:</strong> ${dEnd}</td>
                <td style="text-align: center; font-weight: 700; font-size: 15px; color: #0f172a;">${leave.total_days} วัน</td>
                <td style="font-size:12.5px; color:#475569;">${leave.reason || '-'}</td>
              </tr>
            </tbody>
          </table>

          ${leave.approval_comment ? `
          <div class="section-heading" style="color:#dc2626;">ความคิดเห็น/หมายเหตุประกอบการพิจารณา</div>
          <div style="background-color: #fff5f5; border: 1px solid #fee2e2; border-radius: 6px; padding: 12px 15px; font-size:13px; color: #991b1b; font-weight:500;">
             📝 ${leave.approval_comment}
          </div>
          ` : ''}

          <div class="section-heading" style="margin-top: 30px;">การตรวจสอบและพิจารณาอนุมัติ (Workflow Approvals)</div>
          <table class="signature-grid">
            <tr>
              <td class="signature-box">
                <div class="signature-title">ผู้ขออนุมัติลา</div>
                <div class="sig-line"></div>
                <div class="sig-name">( ${emp.full_name || '...........................................'} )</div>
                <div class="sig-date">วันที่ยื่น: ${formatFullDate(leave.created_at)}</div>
              </td>
              <td class="signature-box">
                <div class="signature-title">ผู้บังคับบัญชาชั้นต้น (หัวหน้า)</div>
                <div class="sig-line">
                  ${leave.manager_status === 'approved' ? '<span style="color:#059669; font-weight:bold;">✓ ได้รับอนุมัติผ่านระบบ</span>' : (leave.manager_status === 'rejected' ? '<span style="color:#dc2626; font-weight:bold;">❌ ปฏิเสธการลา</span>' : '')}
                </div>
                <div class="sig-name">...................................................</div>
                <div class="sig-date">สถานะ: ${leave.manager_status === 'approved' ? 'ผ่านอนุมัติแล้ว' : (leave.manager_status === 'rejected' ? 'ปฏิเสธ' : 'รอการพิจารณา')}</div>
              </td>
              <td class="signature-box">
                <div class="signature-title">ผู้พิจารณาขั้นสูง (ผู้จัดการ)</div>
                <div class="sig-line">
                  ${leave.director_status === 'approved' ? '<span style="color:#059669; font-weight:bold;">✓ ได้รับอนุมัติผ่านระบบ</span>' : (leave.director_status === 'rejected' ? '<span style="color:#dc2626; font-weight:bold;">❌ ปฏิเสธการลา</span>' : '')}
                </div>
                <div class="sig-name">...................................................</div>
                <div class="sig-date">สถานะ: ${leave.director_status === 'approved' ? 'ผ่านอนุมัติแล้ว' : (leave.director_status === 'rejected' ? 'ปฏิเสธ' : 'รอการพิจารณา')}</div>
              </td>
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

          <div class="footer-note">
            เอกสารฉบับนี้ถูกจัดทำขึ้นด้วยระบบบริหารจัดการทรัพยากรบุคคลอัตโนมัติ PVT HR E-Leave System<br>
            รหัสร่องรอยตรวจสอบ (Trace ID): ${leaveId}
          </div>
        </div>

        <script>
          window.onload = function() { 
            setTimeout(() => { window.print(); window.close(); }, 500);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();

  } catch (err) {
    Swal.fire('ไม่สามารถพิมพ์เอกสารได้', err.message, 'error');
  }
}

/* ==========================================================================
   🚪 6. SECURITY MANAGEMENT (ระบบล็อกเอาต์และจัดเก็บเซสชัน)
   ========================================================================== */

function handleLogout() {
  sessionStorage.removeItem("currentUser");
  window.location.href = "/index.html"; 
}

/* ==========================================================================
   💡 7. FLOATING INSTRUCTION GUIDE CONTROLLER (ระบบควบคุมปุ่มคู่มือลอย)
   ========================================================================== */

function toggleFloatingGuide() {
  const card = document.getElementById("floating-guide-card");
  const icon = document.getElementById("pvt-fab-icon");
  const btn = document.getElementById("pvt-fab-btn");
  
  if (!card || !icon || !btn) return;

  const isHidden = card.style.display === "none" || card.style.display === "";

  if (isHidden) {
    card.style.display = "block";
    icon.innerText = "close";
    icon.style.transform = "rotate(90deg)";
    btn.style.background = "#ef4444"; // เปลี่ยนสีปุ่มเป็นสีแดงชั่วคราวตอนที่เปิดคู่มือค้างไว้
  } else {
    card.style.display = "none";
    icon.innerText = "help";
    icon.style.transform = "rotate(0deg)";
    btn.style.background = "#1e3a8a";
  }
}

