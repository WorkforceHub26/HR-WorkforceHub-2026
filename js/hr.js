// ============================================================================
// 🚀 PVT HR Admin System - [COMPLETELY FIXED WHITE SCREEN & PRINT BUG]
// ============================================================================

if (typeof window.adminProfile === "undefined") {
    window.adminProfile = null; 
}

document.addEventListener("DOMContentLoaded", () => {
    console.clear(); 
    console.group("🚀 [SYSTEM BOOT] 1. เริ่มต้นระบบ HR Admin (DOMContentLoaded)");
    console.time("⏱️ เวลาที่ใช้ Boot ระบบทั้งหมด");
    initAdmin();
    console.groupEnd();
});

// ==========================================
// 🟢 2. ฟังก์ชันเริ่มต้นระบบ (Init)
// ==========================================
async function initAdmin() {
  console.groupCollapsed("🟢 [INIT PROCESS] ฟังก์ชัน initAdmin() กำลังทำงาน...");
  try {
    const sb = window.pvtSupabase?.getClient();
    if (!sb) throw new Error("ไม่พบ window.pvtSupabase.getClient()");

    window.adminProfile = await window.pvtSupabase?.getCurrentProfile();
    
    if (!window.adminProfile || !window.adminProfile.employee_id) {
      console.warn("⚠️ [AUTH] ไม่พบเซสชันผู้ใช้จริง! สลับเข้าสู่ DEV MODE จำลองสิทธิ์ HR...");
      window.adminProfile = {
        employee_id: "11111111-1111-1111-1111-111111111111",
        display_name: "คุณมิกกี้ (HR Administrator)",
        role: "admin"
      };
    }

    console.log("👉 Step 3: กำลังสั่งให้ตาราง 'อนุมัติใบลา' ดึงข้อมูล...");
    if (typeof loadPendingLeavesHR === "function") {
       await loadPendingLeavesHR();
    }

  } catch (err) {
    console.error("❌ [CRITICAL ERROR] ระบบล่มระหว่างการ Boot:", err.message);
  } finally {
    console.timeEnd("⏱️ เวลาที่ใช้ Boot ระบบทั้งหมด");
    console.groupEnd();
  }
}

// ==========================================
// 2. ฟังก์ชันดึงข้อมูลใบลา (ดึงความสัมพันธ์ฝ่าย/ตำแหน่งภาษาไทยครบถ้วน)
// ==========================================
async function loadPendingLeavesHR() {
  console.groupCollapsed("🟡 [FETCH] โหลดข้อมูลคำขออนุมัติลา (loadPendingLeavesHR)");
  
  const tbody = document.getElementById("leaveRequestsBody");
  if (!tbody) {
    console.error("❌ [DOM ERROR] หา ID 'leaveRequestsBody' ไม่เจอ (เช็คใน hr.html ด่วน!)");
    console.groupEnd();
    return;
  }
  
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">⏳ กำลังเชื่อมต่อและดึงข้อมูลใบลา...</td></tr>`;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    console.error("❌ [DB ERROR] Supabase Client ยังไม่พร้อมทำงาน");
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">❌ ฐานข้อมูลขัดข้อง</td></tr>`;
    console.groupEnd();
    return;
  }

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
          departments ( department_name ),
          positions ( position_name )
        ),
        leave_types ( leave_name )
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">📭 ไม่มีคำขออนุมัติลาในระบบขณะนี้</td></tr>`;
      console.groupEnd();
      return;
    }

    let htmlContent = "";
    data.forEach((req, index) => {
      const empName = req.employees ? req.employees.full_name : "ไม่ทราบชื่อ";
      const empCode = req.employees ? req.employees.employee_code : "-";
      const leaveType = req.leave_types ? req.leave_types.leave_name : "ไม่ทราบประเภท";
      const startDate = new Date(req.start_date).toLocaleDateString('th-TH');
      const endDate = new Date(req.end_date).toLocaleDateString('th-TH');
      
      let statusBadge = "";
      if (req.status === 'pending') statusBadge = `<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">รออนุมัติ</span>`;
      else if (req.status === 'approved') statusBadge = `<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">อนุมัติแล้ว</span>`;
      else if (req.status === 'rejected') statusBadge = `<span style="background:#fecaca; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">ปฏิเสธ</span>`;
      else if (req.status === 'approved_by_leaders') statusBadge = `<span style="background:#bfdbfe; color:#1e40af; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">หัวหน้าอนุมัติแล้ว</span>`;
      else statusBadge = `<span style="background:#e5e7eb; color:#374151; padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold;">${req.status}</span>`;

      let managerInfo = `<br><small style="color:#64748b;">ผจก: ${req.manager_status === 'approved' ? '✅ อนุมัติแล้ว' : '⏳ รออนุมัติ'}</small>`;

      htmlContent += `
        <tr>
          <td>${empCode}</td>
          <td>
            <strong>${empName}</strong> ${managerInfo}
            <br><a href="#" onclick="openLeavePopupModal('${req.id}'); return false;" style="font-size:12px; color:#2563eb; text-decoration:underline;">🔍 ดูใบลาตัวเต็ม</a>
          </td>
          <td>${leaveType}</td>
          <td>${startDate} - ${endDate}</td>
          <td>${req.total_days} วัน</td>
          <td>${statusBadge}</td>
          <td style="white-space: nowrap; text-align: center;">
             
             <button onclick="approveLeave('${req.id}')" style="padding:6px 12px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
               <span style="margin-right:4px;">✔️</span> อนุมัติ
             </button>
             
             <button onclick="rejectLeave('${req.id}')" style="padding:6px 12px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer; margin-left:4px; font-size:13px; font-weight:600; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
               <span style="margin-right:4px;">✖️</span> ไม่อนุมัติ
             </button>
             
             <button onclick="printLeaveA4('${req.id}')" style="padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:6px; cursor:pointer; margin-left:4px; font-size:13px; font-weight:600; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
               <span style="margin-right:4px;">🖨️</span> พิมพ์
             </button>

          </td>
        </tr>
      `;
    });

    tbody.innerHTML = htmlContent;
    console.log("🎉 [SUCCESS] พ่นข้อมูลลงตารางเรียบร้อย!");

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาด:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
  } finally {
    console.groupEnd();
  }
}

// ==========================================
// 🔵 3. ฟังก์ชันเปิดป๊อปอัปใบลาดิจิทัล
// ==========================================
async function openLeavePopupModal(leaveId) {
  console.group(`🔵 [MODAL PROCESS] โหลดป๊อปอัปใบลาดิจิทัล ID: ${leaveId}`);
  const sb = window.pvtSupabase?.getClient();
  
  let modalContainer = document.getElementById("pvtLeaveModal");
  if (!modalContainer) {
    modalContainer = document.createElement("div");
    modalContainer.id = "pvtLeaveModal";
    document.body.appendChild(modalContainer);
  }
  
  const styleBlock = `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <style>
      .pvt-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 9999; font-family: 'Kanit', 'Sarabun', sans-serif; }
      .pvt-modal-content { background: #ffffff; width: 94%; max-width: 840px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.3); overflow: hidden; }
      .pvt-stamp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
      .pvt-stamp-box { text-align: center; padding: 20px 12px; border-radius: 14px; border: 1.5px dashed #cbd5e1; background: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center;}
      .pvt-stamp-box .material-symbols-outlined { font-size: 32px; margin-bottom: 8px; }
      .pvt-stamp-box.approved { border-color: #10b981; background: #f0fdf4; color: #14532d; }
      .pvt-stamp-box.approved .material-symbols-outlined { color: #10b981; }
      .pvt-stamp-box.rejected { border-color: #ef4444; background: #fef2f2; color: #742a2a; }
      .pvt-stamp-box.rejected .material-symbols-outlined { color: #ef4444; }
      .pvt-stamp-box.pending { border-color: #f59e0b; background: #fffbeb; color: #78350f; }
      .pvt-stamp-box.pending .material-symbols-outlined { color: #f59e0b; }
    </style>
  `;

  modalContainer.innerHTML = styleBlock + `
    <div class="pvt-modal-overlay"><div class="pvt-modal-content"><div style="padding:50px; text-align:center;"><span style="font-size:20px; color:#64748b;">⏳ กำลังเรียกเอกสาร...</span></div></div></div>`;
  modalContainer.style.display = "block";

  try {
    const { data: leave } = await sb.from("leave_requests").select("*").eq("id", leaveId).maybeSingle();
    if (!leave) throw new Error("ไม่พบข้อมูลใบลาในระบบ");

    const [{ data: emp }, { data: leaveType }] = await Promise.all([
      sb.from("employees").select("full_name, employee_code").eq("id", leave.employee_id).maybeSingle(),
      sb.from("leave_types").select("leave_name").eq("id", leave.leave_type_id).maybeSingle()
    ]);

    const dateWritten = leave.created_at ? new Date(leave.created_at).toLocaleDateString('th-TH', {year:'numeric', month:'long', day:'numeric'}) : "-";
    const sDate = new Date(leave.start_date).toLocaleDateString('th-TH', {day:'2-digit', month:'short', year:'numeric'});
    const eDate = new Date(leave.end_date).toLocaleDateString('th-TH', {day:'2-digit', month:'short', year:'numeric'});
    
    const mngStampClass = leave.manager_status === 'approved' ? 'approved' : leave.manager_status === 'rejected' ? 'rejected' : 'pending';
    const mngStampIcon = leave.manager_status === 'approved' ? 'check_circle' : leave.manager_status === 'rejected' ? 'cancel' : 'pending';
    const mngStampText = leave.manager_status === 'approved' ? 'อนุมัติแล้ว' : leave.manager_status === 'rejected' ? 'ปฏิเสธคำขอ' : 'รอพิจารณา';

    const deptStatus = leave.director_status || 'pending'; 
    const deptStampClass = deptStatus === 'approved' ? 'approved' : deptStatus === 'rejected' ? 'rejected' : 'pending';
    const deptStampIcon = deptStatus === 'approved' ? 'verified' : deptStatus === 'rejected' ? 'disabled_by_default' : 'hourglass_empty';
    const deptStampText = deptStatus === 'approved' ? 'อนุมัติแล้ว' : deptStatus === 'rejected' ? 'ปฏิเสธคำขอ' : 'รอพิจารณา';
    
    const hrStampClass = leave.status === 'approved' ? 'approved' : leave.status === 'rejected' ? 'rejected' : 'pending';
    const hrStampIcon = leave.status === 'approved' ? 'assignment_turned_in' : leave.status === 'rejected' ? 'assignment_late' : 'rule';
    const hrStampText = leave.status === 'approved' ? 'บันทึกสำเร็จ' : leave.status === 'rejected' ? 'ปฏิเสธคำขอ' : 'รอตรวจสอบ';

    modalContainer.innerHTML = styleBlock + `
      <div class="pvt-modal-overlay">
        <div class="pvt-modal-content">
          <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #10b981;">
            <h2 style="margin:0; font-size: 20px; color: #ffffff; display: flex; align-items: center; gap: 12px;">
              <span class="material-symbols-outlined" style="color:#10b981; font-size:26px;">verified_user</span> ใบคำขออนุมัติลา (Digital Leave Slip)
            </h2>
            <div style="display: flex; gap: 12px; align-items: center;">
              <button onclick="printLeaveA4('${leaveId}')" style="background: #3b82f6; border: none; color: white; padding: 6px 14px; border-radius: 6px; cursor: pointer; display:flex; align-items:center; gap:6px; font-family:'Kanit'; font-size: 14px;">
                <span class="material-symbols-outlined" style="font-size:18px;">print</span> พิมพ์ A4
              </button>
              <button onclick="document.getElementById('pvtLeaveModal').style.display='none'" style="background: rgba(255,255,255,0.08); border: none; color: #94a3b8; width: 36px; height: 36px; border-radius: 50%; font-size: 18px; cursor: pointer;">✕</button>
            </div>
          </div>
          <div style="padding: 30px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 22px; border-radius: 16px; margin-bottom: 22px; border: 1px solid #e2e8f0;">
              <div><p style="margin:0; color:#64748b; font-size:12px;">รหัสพนักงาน</p><strong style="font-size:15px; color:#1e293b;">${emp?.employee_code || "-"}</strong></div>
              <div><p style="margin:0; color:#64748b; font-size:12px;">วันที่ยื่นคำขอ</p><strong style="font-size:14px; color:#1e293b;">${dateWritten}</strong></div>
              <div style="grid-column: span 2; border-top: 1px solid #e2e8f0; padding-top: 12px;"><p style="margin:0; color:#64748b; font-size:12px;">ชื่อ - นามสกุลพนักงาน</p><strong style="font-size:17px; color:#0f172a;">${emp?.full_name || "-"}</strong></div>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 12px;"><p style="margin:0; color:#64748b; font-size:12px;">ประเภทการลา</p><span style="font-size:13px; color:#2563eb; background:#eff6ff; padding:2px 10px; border-radius:12px;">${leaveType?.leave_name || "-"}</span></div>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 12px;"><p style="margin:0; color:#64748b; font-size:12px;">ระยะเวลาที่ขอลา</p><strong style="font-size:14px; color:#0f172a;">${sDate} — ${eDate} <span style="color:#ef4444;">(${leave.total_days} วัน)</span></strong></div>
            </div>
            <div style="margin-bottom: 28px;">
              <p style="margin:0 0 6px 0; color:#475569; font-size:13px; font-weight:600;">เหตุผลความจำเป็น:</p>
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; font-size: 14px; font-family:'Sarabun';">${leave.reason || "-"}</div>
            </div>
            <div class="pvt-stamp-grid">
              <div class="pvt-stamp-box approved"><p style="margin:0; font-size:11px; color:#64748b;">1. ผู้ขอลา</p><span class="material-symbols-outlined">person</span><strong>ส่งคำขอแล้ว</strong></div>
              <div class="pvt-stamp-box ${mngStampClass}"><p style="margin:0; font-size:11px; color:#64748b;">2. ผู้จัดการฝ่าย</p><span class="material-symbols-outlined">${mngStampIcon}</span><strong>${mngStampText}</strong></div>
              <div class="pvt-stamp-box ${deptStampClass}"><p style="margin:0; font-size:11px; color:#64748b;">3. หัวหน้าแผนก</p><span class="material-symbols-outlined">${deptStampIcon}</span><strong>${deptStampText}</strong></div>
              <div class="pvt-stamp-box ${hrStampClass}"><p style="margin:0; font-size:11px; color:#64748b;">4. ฝ่ายบุคคล</p><span class="material-symbols-outlined">${hrStampIcon}</span><strong>${hrStampText}</strong></div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    modalContainer.innerHTML = `<div class="pvt-modal-overlay"><div class="pvt-modal-content" style="padding:32px; text-align:center;"><h3 style="color:#ef4444;">ข้อผิดพลาด: ${err.message}</h3><button onclick="document.getElementById('pvtLeaveModal').style.display='none'">ปิด</button></div></div>`;
  } finally {
    console.groupEnd();
  }
}

// ==========================================
// 🟢 4. ฟังก์ชันอนุมัติ / 🔴 ปฏิเสธ (คลีนโค้ดเรียบร้อยไม่มีซ้ำ)
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

// ============================================================================
// 🖨️ ฟังก์ชันพิมพ์ใบขออนุมัติลาหยุดงาน A4 (ฉบับแก้ไขตามใบจริง 100% - ไม่มีกล่องซ้ำซ้อน)
// ============================================================================
async function printLeaveA4(leaveId) {
  console.log("🔮 [PRINT PROCESS] เริ่มพิมพ์ฟอร์มใบลาจริง รหัส:", leaveId);
  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    alert("ระบบฐานข้อมูลไม่พร้อมทำงาน");
    return;
  }
  try {
    // 1. ดึงข้อมูลแบบ Join สัมพันธ์ตรงเพื่อความเสถียรของระบบ
    const { data: leave, error: leaveErr } = await sb
      .from("leave_requests")
      .select(`
        *,
        employees!employee_id (
          id,
          full_name,
          employee_code,
          start_date,
          nickname,
          departments ( department_name ),
          positions ( position_name )
        ),
        leave_types ( id, leave_name, leave_code )
      `)
      .eq("id", leaveId)
      .maybeSingle();

    if (leaveErr || !leave) {
      console.error("❌ Supabase Error:", leaveErr);
      alert("ไม่พบข้อมูลใบลา หรือเกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ");
      return;
    }

    const emp = leave.employees;
    const leaveType = leave.leave_types;

    const departmentName = emp?.departments?.department_name || "-";
    const positionName = emp?.positions?.position_name || "-";

    // 2. ดึงข้อมูลวันลาพักผ่อนประจำปี (พักร้อน)
    let vacationEntitlement = 6; 
    if (emp?.id) {
      const { data: balanceData } = await sb
        .from("leave_balances")
        .select("entitlement_days")
        .eq("employee_id", emp.id)
        .or("leave_type_id.eq.29add092-0601-4262-9d6a-8f6fa2494249,leave_type_id.eq.d29964cd-69c3-400f-9c04-6f26c9cb90bb")
        .maybeSingle();

      if (balanceData) {
        vacationEntitlement = balanceData.entitlement_days === 30 ? 6 : balanceData.entitlement_days;
      }
    }

    // 3. ฟอร์แมตวันที่แบบไทย (วว/ดด/ปป)
    const formatThaiDate = (dateString) => {
      if (!dateString) return "-";
      const d = new Date(dateString);
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = (d.getFullYear() + 543).toString().slice(-2);
      return `${day}/${month}/${year}`;
    };

    const dWrite = formatThaiDate(leave.created_at);
    const dStart = formatThaiDate(leave.start_date);
    const dEnd = formatThaiDate(leave.end_date);
    const dEmpStart = formatThaiDate(emp?.start_date);

    // 4. คำนวณจำแนกชั่วโมงการลา
    let leaveHoursIn = "-";
    let leaveHoursOut = "-";
    if (leave.total_days && leave.total_days < 1) {
      leaveHoursIn = "08:00";
      leaveHoursOut = "17:00";
    }

    // 5. สั่งเปิดหน้าต่างพรีวิวปริ้น A4 (ควบคุมความสูงไม่ให้ล้นไปหน้า 2)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("กรุณาเปิดการอนุญาต Pop-up บนเบราว์เซอร์เพื่อพิมพ์เอกสาร");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>ใบงานประจำปี 2569 - ${emp?.full_name || ''}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap');
          * { box-sizing: border-box; }
          
          body { 
            font-family: 'Sarabun', sans-serif; 
            padding: 20px; 
            color: #000; 
            margin: 0; 
            background: #fff; 
            line-height: 1.4; 
            font-size: 13px;
          }
          
          /* หัวใบลาบริษัท พี.วี.ที. */
          .form-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          .header-left-box { width: 75%; text-align: center; padding-left: 60px; }
          .company-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
          .doc-title { font-size: 18px; font-weight: bold; margin-bottom: 2px; }
          .doc-period { font-size: 12px; font-weight: 500; }
          
          .header-right-box { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
          .logo-placeholder { width: 135px; height: 35px; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: bold; margin-bottom: 3px; text-align: center; }
          .emp-code-box { font-size: 13px; font-weight: bold; white-space: nowrap; }

          /* ตารางข้อมูลพนักงานด้านบน */
          .emp-info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .emp-info-table td { border: 1px solid #000; padding: 6px 8px; font-size: 13px; vertical-align: middle; }
          .fill-data { font-weight: bold; padding: 0 2px; }
          
          /* ตารางบันทึกการลาหลัก (เส้นประ ลายเซ็น และช่อง "อนุมัติ" รวมอยู่ในนี้ตามรูปกระดาษจริง 100%) */
          .main-leave-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          .main-leave-table th { border: 1px solid #000; background: #f2f2f2; padding: 6px 2px; font-size: 12px; font-weight: bold; text-align: center; }
          .main-leave-table td { border: 1px solid #000; padding: 5px 2px; font-size: 12px; text-align: center; vertical-align: middle; height: 45px; }
          
          /* เส้นประสำหรับแถวถัดไปในตาราง */
          .dot-line { border-bottom: 1px dotted #000; width: 85%; margin: 4px auto 1px auto; height: 12px; display: block; }
          .date-bracket { font-size: 10px; color: #333; display: block; margin-top: 1px; }
          
          @media print { 
            html, body { height: 99%; margin: 0; padding: 10px 15px; }
            .main-leave-table th { background: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        
        <div class="form-header">
          <div class="header-left-box">
            <div class="company-name">บริษัท พี.วี.ที. แอนด์ ที.พลาส จำกัด</div>
            <div class="doc-title">ใบลางาน ประจำปี 2569</div>
            <div class="doc-period">วันที่ 1 ธันวาคม 2568 - 30 พฤศจิกายน 2569</div>
          </div>
          
          <div class="header-right-box">
            <div class="logo-placeholder">P.V.T.& T. PLAS CO.,LTD.</div>
            <div class="emp-code-box">รหัสพนักงาน: <span class="fill-data">${emp?.employee_code || '-'}</span></div>
          </div>
        </div>

        <table class="emp-info-table">
          <tr>
            <td style="width: 45%;">ชื่อ - สกุล: <span class="fill-data">${emp?.full_name || '-'}</span></td>
            <td style="width: 25%;">ชื่อเล่น: <span class="fill-data">${emp?.nickname || '-'}</span></td>
            <td style="width: 30%;">ตำแหน่ง: <span class="fill-data">${positionName}</span></td>
          </tr>
          <tr>
            <td>สถานะ: <span class="fill-data">พนักงานปกติ</span></td>
            <td>วันเริ่มงาน: <span class="fill-data">${dEmpStart}</span></td>
            <td>ฝ่าย/แผนก: <span class="fill-data">${departmentName}</span></td>
          </tr>
          <tr>
            <td>วันลาพักผ่อนได้รับสิทธิ์ประจำปี: <span class="fill-data">${vacationEntitlement} วัน</span></td>
            <td>เริ่มสิทธิ์พักร้อนเมื่อ: <span class="fill-data">${dEmpStart}</span></td>
            <td style="background: #fafafa; color: #555;">รพ.รับรองสิทธิประกันสังคม: <span style="font-style: italic; font-size:11px; color:#999;">(ดึงตามสิทธิ์ผู้ประกันตน)</span></td>
          </tr>
        </table>

        <table class="main-leave-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 8%;">ว/ด/ป<br>ที่เขียน</th>
              <th colspan="2" style="width: 14%;">วันที่ลา</th>
              <th colspan="3" style="width: 12%;">จำนวน</th>
              <th rowspan="2" style="width: 10%;">ประเภท<br>การลา</th>
              <th rowspan="2" style="width: 20%;">สาเหตุการลา</th>
              <th rowspan="2" style="width: 8%;">หลักฐาน<br>การลา</th>
              <th rowspan="2" style="width: 11%;">ลงชื่อผู้ลา</th>
              <th colspan="2" style="width: 16%;">ผู้อนุมัติ</th>
              <th rowspan="2" style="width: 9%;">ฝ่าย<br>บุคคล</th>
            </tr>
            <tr>
              <th>เริ่มวันที่</th>
              <th>ถึงวันที่</th>
              <th style="font-size:10px; font-weight:normal;">ชม.เข้า</th>
              <th style="font-size:10px; font-weight:normal;">ชม.บ่าย</th>
              <th style="font-size:11px;">วัน</th>
              <th style="font-size:10px;">หนน.แผนก</th>
              <th style="font-size:10px;">ผจก.ฝ่าย</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${dWrite}</td>
              <td>${dStart}</td>
              <td>${dEnd}</td>
              <td style="color:#444;">${leaveHoursIn}</td>
              <td style="color:#444;">${leaveHoursOut}</td>
              <td style="font-weight: bold; font-size: 13.5px;">${leave.total_days || 0}</td>
              <td style="font-weight: 500;">${leaveType?.leave_name || '-'}</td>
              <td style="text-align: left; padding-left: 5px;">${leave.reason || '-'}</td>
              <td>${leave.attachment_url ? 'มีเอกสาร' : '-'}</td>
              
              <td>
                <span style="font-weight: bold; font-size: 12.5px; color: #000;">${emp?.nickname || ''}</span>
                <span class="date-bracket">${dWrite}</span>
              </td>
              
              <td>
                <span style="color: green; font-size: 11px; font-weight: bold;">
                  ${leave.director_status === 'approved' ? '✓ ผ่าน' : leave.director_status === 'rejected' ? '✕ ปฏิเสธ' : ''}
                </span>
                <span class="dot-line"></span>
                <span class="date-bracket">(..../..../....)</span>
              </td>
              
              <td>
                <span style="color: green; font-size: 11px; font-weight: bold;">
                  ${leave.manager_status === 'approved' ? '✓ ผ่าน' : leave.manager_status === 'rejected' ? '✕ ปฏิเสธ' : ''}
                </span>
                <span class="dot-line"></span>
                <span class="date-bracket">(..../..../....)</span>
              </td>
              
              <td>
                <span style="color: blue; font-size: 11px; font-weight: bold;">
                  ${leave.status === 'approved' ? '✓ อนุมัติ' : ''}
                </span>
                <span class="dot-line"></span>
                <span class="date-bracket">(..../..../....)</span>
              </td>
            </tr>
            
            ${Array(9).fill(0).map(() => `
              <tr>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                <td><span class="dot-line"></span></td>
                <td><span class="dot-line"></span><span class="date-bracket">(..../..../....)</span></td>
                <td><span class="dot-line"></span><span class="date-bracket">(..../..../....)</span></td>
                <td><span class="dot-line"></span><span class="date-bracket">(..../..../....)</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 15px; font-size: 11px; text-align: right; color: #444; font-style: italic;">
          * โปรดศึกษาหลักเกณฑ์และปฏิบัติตามหลักเกณฑ์ที่บริษัทกำหนดอย่างเคร่งครัด (ด้านหลังใบลา)
        </div>

        <script>
          // สั่งรันคำสั่งพิมพ์กระดาษพรีวิวทันทีที่เปิดหน้า
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในระบบประมวลผลพิมพ์ฟอร์มใบลา:", err);
  }
}