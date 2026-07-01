// ============================================================================
// 🚀 PVT HR Admin System - [FIXED MULTIPLE RELATIONSHIPS BUG]
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
// 2. ฟังก์ชันดึงข้อมูลใบลา (ปุ่มแบบ ไอคอน + ข้อความ ชัดเจน 100%)
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
        employees!employee_id ( full_name, employee_code ),
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
    console.log("🎉 [SUCCESS] พ่นข้อมูลลงตาราง (แบบปุ่มข้อความ) เรียบร้อย!");

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาด:", err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">❌ เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
  } finally {
    console.groupEnd();
  }
}

// ==========================================
// 🔵 4. ฟังก์ชันเปิดป๊อปอัปใบลาดิจิทัล (เวอร์ชัน Luxury Icons & 4 ลายเซ็นต์) - [แก้ไขบั๊กแล้ว]
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
  
  // โหลด Google Material Icons และฟอนต์ Sarabun / Kanit
  const styleBlock = `
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    <style>
      .pvt-modal-overlay { 
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); 
        display: flex; justify-content: center; align-items: center; z-index: 9999; 
        animation: pvtFadeIn 0.3s ease; font-family: 'Kanit', 'Sarabun', sans-serif; 
      }
      .pvt-modal-content { 
        background: #ffffff; width: 94%; max-width: 840px; border-radius: 20px; 
        box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.3); overflow: hidden; 
        animation: pvtSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
      }
      .pvt-stamp-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
      }
      .pvt-stamp-box { 
        text-align: center; padding: 20px 12px; border-radius: 14px; border: 1.5px dashed #cbd5e1; 
        background: #f8fafc; transition: all 0.3s ease; display: flex; flex-direction: column; align-items: center; justify-content: center;
      }
      .pvt-stamp-box .material-symbols-outlined {
        font-size: 32px; margin-bottom: 8px; transition: transform 0.3s ease;
      }
      .pvt-stamp-box.approved { border-color: #10b981; background: #f0fdf4; color: #14532d; }
      .pvt-stamp-box.approved .material-symbols-outlined { color: #10b981; font-fill: 1; }
      .pvt-stamp-box.rejected { border-color: #ef4444; background: #fef2f2; color: #742a2a; }
      .pvt-stamp-box.rejected .material-symbols-outlined { color: #ef4444; }
      .pvt-stamp-box.pending { border-color: #f59e0b; background: #fffbeb; color: #78350f; }
      .pvt-stamp-box.pending .material-symbols-outlined { color: #f59e0b; }
      @keyframes pvtFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes pvtSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
    </style>
  `;

  modalContainer.innerHTML = styleBlock + `
    <div class="pvt-modal-overlay">
      <div class="pvt-modal-content">
        <div style="padding:50px; text-align:center;">
          <span style="font-size:20px; color:#64748b; font-weight:300;">⏳ กำลังเรียกเอกสารและตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    </div>
  `;
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
    
    // 1. ตัวแปรจัดการไอคอนและตราประทับ - ผู้จัดการฝ่าย (Manager)
    const mngStampClass = leave.manager_status === 'approved' ? 'approved' : leave.manager_status === 'rejected' ? 'rejected' : 'pending';
    const mngStampIcon = leave.manager_status === 'approved' ? 'check_circle' : leave.manager_status === 'rejected' ? 'cancel' : 'pending';
    const mngStampText = leave.manager_status === 'approved' ? 'อนุมัติแล้ว' : leave.manager_status === 'rejected' ? 'ปฏิเสธคำขอ' : 'รอพิจารณา';

    // 2. ตัวแปรจัดการไอคอนและตราประทับ - หัวหน้าแผนก (Director/Dept Head)
    const deptStatus = leave.director_status || 'pending'; 
    const deptStampClass = deptStatus === 'approved' ? 'approved' : deptStatus === 'rejected' ? 'rejected' : 'pending';
    const deptStampIcon = deptStatus === 'approved' ? 'verified' : deptStatus === 'rejected' ? 'disabled_by_default' : 'hourglass_empty';
    const deptStampText = deptStatus === 'approved' ? 'อนุมัติแล้ว' : deptStatus === 'rejected' ? 'ปฏิเสธคำขอ' : 'รอพิจารณา';
    
    // 3. ตัวแปรจัดการไอคอนและตราประทับ - ฝ่ายบุคคล (HR Admin)
    const hrStampClass = leave.status === 'approved' ? 'approved' : leave.status === 'rejected' ? 'rejected' : 'pending';
    const hrStampIcon = leave.status === 'approved' ? 'assignment_turned_in' : leave.status === 'rejected' ? 'assignment_late' : 'rule';
    const hrStampText = leave.status === 'approved' ? 'บันทึกสำเร็จ' : leave.status === 'rejected' ? 'ปฏิเสธคำขอ' : 'รอตรวจสอบ';

    modalContainer.innerHTML = styleBlock + `
      <div class="pvt-modal-overlay">
        <div class="pvt-modal-content">
          
          <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #10b981;">
            <h2 style="margin:0; font-size: 20px; font-weight: 500; color: #ffffff; display: flex; align-items: center; gap: 12px; letter-spacing: 0.5px;">
              <span class="material-symbols-outlined" style="color:#10b981; font-size:26px;">verified_user</span> 
              ใบคำขออนุมัติลา (Digital Leave Slip)
            </h2>
            
            <div style="display: flex; gap: 12px; align-items: center;">
              <button onclick="printLeaveA4('${leaveId}')" style="background: #3b82f6; border: none; color: white; padding: 6px 14px; border-radius: 6px; cursor: pointer; display:flex; align-items:center; gap:6px; font-family:'Kanit'; transition:0.2s; font-size: 14px;" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                <span class="material-symbols-outlined" style="font-size:18px;">print</span> พิมพ์ A4
              </button>
              
              <button onclick="document.getElementById('pvtLeaveModal').style.display='none'" style="background: rgba(255,255,255,0.08); border: none; color: #94a3b8; width: 36px; height: 36px; border-radius: 50%; font-size: 18px; cursor: pointer; display:flex; align-items:center; justify-content:center; transition: 0.2s;" onmouseover="this.style.color='#fff'; this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.color='#94a3b8'; this.style.background='rgba(255,255,255,0.08)'">✕</button>
            </div>
          </div>
          
          <div style="padding: 30px;">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 22px; border-radius: 16px; margin-bottom: 22px; border: 1px solid #e2e8f0;">
              <div>
                <p style="margin:0 0 4px 0; color:#64748b; font-size:12px; font-weight:500; letter-spacing:0.3px;">รหัสพนักงาน</p>
                <strong style="font-size:15px; color:#1e293b;">${emp?.employee_code || "-"}</strong>
              </div>
              <div>
                <p style="margin:0 0 4px 0; color:#64748b; font-size:12px; font-weight:500; letter-spacing:0.3px;">วันที่ยื่นคำขอ</p>
                <strong style="font-size:14px; color:#1e293b;">${dateWritten}</strong>
              </div>
              <div style="grid-column: span 2; border-top: 1px dashed #e2e8f0; padding-top: 12px;">
                <p style="margin:0 0 4px 0; color:#64748b; font-size:12px; font-weight:500;">ชื่อ - นามสกุลพนักงาน</p>
                <strong style="font-size:17px; color:#0f172a; font-weight:600;">${emp?.full_name || "-"}</strong>
              </div>
              <div style="border-top: 1px dashed #e2e8f0; padding-top: 12px;">
                <p style="margin:0 0 6px 0; color:#64748b; font-size:12px; font-weight:500;">ประเภทการลา</p>
                <span style="font-size:13px; color:#2563eb; background:#eff6ff; border: 1px solid #bfdbfe; padding:4px 12px; border-radius:20px; font-weight:500;">${leaveType?.leave_name || "-"}</span>
              </div>
              <div style="border-top: 1px dashed #e2e8f0; padding-top: 12px;">
                <p style="margin:0 0 4px 0; color:#64748b; font-size:12px; font-weight:500;">ระยะเวลาที่ขอลา</p>
                <strong style="font-size:14px; color:#0f172a;">${sDate} — ${eDate} <span style="color:#ef4444; font-weight:600; margin-left:4px;">(${leave.total_days} วัน)</span></strong>
              </div>
            </div>

            <div style="margin-bottom: 28px;">
              <p style="margin:0 0 6px 0; color:#475569; font-size:13px; font-weight:600;">เหตุผลและรายละเอียดความจำเป็น:</p>
              <div style="background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; font-size: 14px; color: #334155; line-height: 1.6; font-family:'Sarabun';">
                ${leave.reason || "<span style='color:#94a3b8; font-style:italic;'>- ไม่ระบุรายละเอียดความจำเป็นเพิ่มเติม -</span>"}
              </div>
            </div>

            <p style="margin:0 0 12px 0; color:#475569; font-size:13px; font-weight:600; text-align:center; letter-spacing:0.5px;">
              🛡️ ตรวจสอบสถานะการลงนามดิจิทัล (Digital Signature Tracking)
            </p>
            
            <div class="pvt-stamp-grid">
              <div class="pvt-stamp-box approved">
                <p style="margin:0 0 10px 0; color:#64748b; font-size:11px; font-weight:500;">1. พนักงานผู้ขอลา</p>
                <span class="material-symbols-outlined">person</span>
                <strong style="font-size:13px; font-weight:600;">ส่งคำขอแล้ว</strong>
                <p style="margin:6px 0 0 0; font-size:11px; color:#64748b; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; max-width:100%; font-family:'Sarabun';">${emp?.full_name || "-"}</p>
              </div>

              <div class="pvt-stamp-box ${mngStampClass}">
                <p style="margin:0 0 10px 0; color:#64748b; font-size:11px; font-weight:500;">2. ผู้จัดการฝ่าย</p>
                <span class="material-symbols-outlined">${mngStampIcon}</span>
                <strong style="font-size:13px; font-weight:600;">${mngStampText}</strong>
                <p style="margin:6px 0 0 0; font-size:11px; color:#94a3b8;">ฝ่ายบริหารต้นสังกัด</p>
              </div>

              <div class="pvt-stamp-box ${deptStampClass}">
                <p style="margin:0 0 10px 0; color:#64748b; font-size:11px; font-weight:500;">3. หัวหน้าแผนก</p>
                <span class="material-symbols-outlined">${deptStampIcon}</span>
                <strong style="font-size:13px; font-weight:600;">${deptStampText}</strong>
                <p style="margin:6px 0 0 0; font-size:11px; color:#94a3b8;">ผู้บังคับบัญชาสายตรง</p>
              </div>

              <div class="pvt-stamp-box ${hrStampClass}">
                <p style="margin:0 0 10px 0; color:#64748b; font-size:11px; font-weight:500;">4. ฝ่ายบุคคล (HR)</p>
                <span class="material-symbols-outlined">${hrStampIcon}</span>
                <strong style="font-size:13px; font-weight:600;">${hrStampText}</strong>
                <p style="margin:6px 0 0 0; font-size:11px; color:#94a3b8;">ผู้บันทึกสิทธิ์โควตา</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("❌ โหลดป๊อปอัปพัง:", err);
    modalContainer.innerHTML = `
      <div class="pvt-modal-overlay">
        <div class="pvt-modal-content" style="max-width: 420px; padding: 32px; text-align: center;">
          <span class="material-symbols-outlined" style="font-size: 48px; color:#ef4444; margin-bottom:12px;">error</span>
          <h3 style="color:#ef4444; margin:0 0 8px 0; font-weight:600;">เกิดข้อผิดพลาดในการเรียกข้อมูล</h3>
          <p style="color:#64748b; margin-bottom: 24px; font-size:14px;">${err.message}</p>
          <button onclick="document.getElementById('pvtLeaveModal').style.display='none'" style="background:#1e293b; color:#fff; border:none; padding:10px 24px; border-radius:8px; cursor:pointer; width:100%; font-size:14px; font-weight:500;">ปิดหน้าต่าง</button>
        </div>
      </div>`;
  } finally {
    // ✅ แก้ไขตรงนี้เรียบร้อยครับ เปลี่ยนจาก catch เป็น finally
    console.groupEnd();
  }
}

// ==========================================
// 🟢 5. ฟังก์ชันอนุมัติ / 🔴 ปฏิเสธ (อัปเกรด Premium แบบ SweetAlert2)
// ==========================================
async function approveLeave(leaveId) {
  // 1. เด้งกล่องถามยืนยันแบบสวยงาม
  const result = await Swal.fire({
    title: 'ยืนยันการอนุมัติ?',
    text: "คุณต้องการอนุมัติใบลาของพนักงานท่านนี้ใช่หรือไม่",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#10b981', // สีเขียวพรีเมียม
    cancelButtonColor: '#64748b', // สีเทา
    confirmButtonText: '✔️ ยืนยันอนุมัติ',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true
  });

  // ถ้ายกเลิก ให้ออกจากฟังก์ชัน
  if (!result.isConfirmed) return;

  const sb = window.pvtSupabase?.getClient();
  try {
    // 🌟 เปลี่ยนคอลัมน์เป็น approved_by_leaders ตามที่พี่ระบุ
    const { error } = await sb.from('leave_requests').update({ 
      status: 'approved', 
      approved_by_leaders: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (error) throw error;
    
    // 2. เด้งกล่องแจ้งเตือนสำเร็จ!
    Swal.fire({
      title: 'อนุมัติสำเร็จ!',
      text: 'ระบบได้บันทึกการอนุมัติเรียบร้อยแล้ว',
      icon: 'success',
      confirmButtonColor: '#10b981'
    });
    
    loadPendingLeavesHR(); 
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function rejectLeave(leaveId) {
  // 1. เด้งกล่องให้กรอกเหตุผลแบบสวยงาม
  const { value: reason, isDismissed } = await Swal.fire({
    title: 'ปฏิเสธใบลา',
    input: 'textarea',
    inputLabel: 'โปรดระบุเหตุผลที่ไม่อนุมัติ:',
    inputPlaceholder: 'พิมพ์เหตุผลที่นี่ (จำเป็นต้องกรอก)...',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444', // สีแดงพรีเมียม
    cancelButtonColor: '#64748b', // สีเทา
    confirmButtonText: '❌ ยืนยันการปฏิเสธ',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
    inputValidator: (value) => {
      // บังคับให้ต้องพิมพ์เหตุผล ไม่พิมพ์กดผ่านไม่ได้
      if (!value || value.trim() === '') {
        return 'กรุณาระบุเหตุผลที่ปฏิเสธด้วยครับ!'
      }
    }
  });

  // ถ้ายกเลิกหรือปิดกล่อง ให้ออกจากฟังก์ชัน
  if (isDismissed || !reason) return; 

  const sb = window.pvtSupabase?.getClient();
  try {
    // 🌟 เปลี่ยนคอลัมน์เป็น approved_by_leaders ตามที่พี่ระบุ
    const { error } = await sb.from('leave_requests').update({ 
      status: 'rejected', 
      approval_comment: reason.trim(), 
      approved_by_leaders: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (error) throw error;
    
    // 2. เด้งกล่องแจ้งเตือนสำเร็จ (การปฏิเสธเสร็จสมบูรณ์)
    Swal.fire({
      title: 'ปฏิเสธใบลาแล้ว',
      text: 'ระบบได้บันทึกการปฏิเสธและส่งเหตุผลเรียบร้อยแล้ว',
      icon: 'success',
      confirmButtonColor: '#10b981'
    });
    
    loadPendingLeavesHR();
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function rejectLeave(leaveId) {
  // 1. เด้งกล่องให้กรอกเหตุผลแบบสวยงาม
  const { value: reason, isDismissed } = await Swal.fire({
    title: 'ปฏิเสธใบลา',
    input: 'textarea',
    inputLabel: 'โปรดระบุเหตุผลที่ไม่อนุมัติ:',
    inputPlaceholder: 'พิมพ์เหตุผลที่นี่ (จำเป็นต้องกรอก)...',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444', // สีแดงพรีเมียม
    cancelButtonColor: '#64748b', // สีเทา
    confirmButtonText: '❌ ยืนยันการปฏิเสธ',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
    inputValidator: (value) => {
      // บังคับให้ต้องพิมพ์เหตุผล ไม่พิมพ์กดผ่านไม่ได้
      if (!value || value.trim() === '') {
        return 'กรุณาระบุเหตุผลที่ปฏิเสธด้วยครับ!'
      }
    }
  });

  // ถ้ายกเลิกหรือปิดกล่อง ให้ออกจากฟังก์ชัน
  if (isDismissed || !reason) return; 

  const sb = window.pvtSupabase?.getClient();
  try {
    const { error } = await sb.from('leave_requests').update({ 
      status: 'rejected', 
      approval_comment: reason.trim(), 
      approved_by: window.adminProfile?.employee_id || null, 
      approved_at: new Date().toISOString() 
    }).eq('id', leaveId);
    
    if (error) throw error;
    
    // 2. เด้งกล่องแจ้งเตือนสำเร็จ (การปฏิเสธเสร็จสมบูรณ์)
    Swal.fire({
      title: 'ปฏิเสธใบลาแล้ว',
      text: 'ระบบได้บันทึกการปฏิเสธและส่งเหตุผลเรียบร้อยแล้ว',
      icon: 'success',
      confirmButtonColor: '#10b981'
    });
    
    loadPendingLeavesHR();
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==========================================
// 🖨️ 6. ฟังก์ชันพิมพ์ใบลาลงกระดาษ A4 (โคลนนิ่งฟอร์มกระดาษ 100% + โลโก้บริษัท)
// ==========================================
async function printLeaveA4(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  try {
    const { data: leave } = await sb.from("leave_requests").select("*").eq("id", leaveId).maybeSingle();
    const { data: emp } = await sb.from("employees").select(`
        full_name, employee_code, start_date, nickname,
        departments(department_name), positions(position_name)
    `).eq("id", leave.employee_id).maybeSingle();
    const { data: leaveType } = await sb.from("leave_types").select("leave_name").eq("id", leave.leave_type_id).maybeSingle();

    // ฟังก์ชันแปลงวันที่เป็นแบบย่อ (เช่น 18/12/68)
    const formatShortDate = (dStr) => {
      if(!dStr) return '';
      const d = new Date(dStr);
      return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${(d.getFullYear()+543).toString().slice(-2)}`;
    };

    const dWrite = formatShortDate(leave.created_at);
    const dStart = formatShortDate(leave.start_date);
    const dEnd = formatShortDate(leave.end_date);
    
    const currentYear = new Date().getFullYear() + 543;
    const startPeriod = `1 ธันวาคม ${currentYear - 1}`;
    const endPeriod = `30 พฤศจิกายน ${currentYear}`;

    // สร้างตารางว่างเผื่อไว้ให้ครบ 21 บรรทัด (ให้เต็มพอดีหน้า A4)
    let emptyRows = '';
    for (let i = 0; i < 21; i++) {
      emptyRows += `<tr class="row-data"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="text-left"></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }

    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>พิมพ์ใบลา A4 - ${emp?.full_name || 'Unknown'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body { font-family: 'Sarabun', sans-serif; font-size: 11px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          
          /* Header */
          .header-box { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
          .header-left { width: 140px; font-size: 10px; font-weight: 600; }
          .header-center { flex: 1; text-align: center; margin-top: 5px; }
          .company-name { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
          .form-title { font-size: 14px; font-weight: 700; margin: 4px 0; }
          .period-text { font-size: 12px; font-weight: 600; }
          
          /* Logo Box (ใช้รูปโลโก้บริษัท) */
          .logo-box { width: 130px; border: 1.5px solid #000; padding: 4px; text-align: center; font-size: 10px; line-height: 1.3; }
          .logo-img-container { height: 26px; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; border-bottom: 1px dashed #000; padding-bottom: 4px; }
          .logo-img-container img { max-height: 100%; max-width: 100%; object-fit: contain; }
          
          /* Employee Info */
          .emp-info { border: 1.5px solid #000; padding: 6px 10px; margin-bottom: 6px; border-radius: 1px; }
          .emp-row { display: flex; align-items: center; margin-bottom: 6px; font-size: 12px; font-weight: 600; }
          .emp-row:last-child { margin-bottom: 0; }
          .val-box { border-bottom: 1px dotted #000; display: inline-block; padding: 0 8px; font-weight: 400; text-align: center; color: #1e293b; }
          
          /* Table */
          table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 6px; border: 1.5px solid #000; }
          th, td { border: 1px solid #000; text-align: center; vertical-align: middle; padding: 2px; font-size: 11px; }
          th { font-weight: 700; background-color: #fff; line-height: 1.2; padding: 4px 2px; }
          .row-data { height: 28px; }
          .text-left { text-align: left !important; padding-left: 6px !important; font-size: 12px; }
          
          /* Footer */
          .footer-box { text-align: center; font-size: 12px; font-weight: 700; padding: 6px; border: 1.5px solid #000; background-color: #e5e7eb; margin-bottom: 2px; }
          .footer-note { text-align: right; font-size: 10px; font-weight: 600; }
        </style>
      </head>
      <body onload="setTimeout(() => { window.print(); }, 800);">
        
        <div class="header-box">
          <div class="header-left">
            <div>* ข้อ 4.2</div>
            <div style="margin-top:2px;">ชื่อ or รหัส พนักงาน</div>
          </div>
          <div class="header-center">
            <div class="company-name">บริษัท พี.วี.ที. แอนด์ พี.พลาส จำกัด</div>
            <div class="form-title">ใบรายงาน ประจำปี ${currentYear}</div>
            <div class="period-text">วันที่ ${startPeriod} - ${endPeriod} &nbsp;&nbsp;&nbsp; 1 รวม</div>
          </div>
          <div class="logo-box">
              <img src="/assets/icons/logo-pvt.png" alt="PVT Logo" style="height: 50px; width: 50px;">
          </div>
        </div>

        <div class="emp-info">
          <div class="emp-row">
            <div style="flex: 2.5;">ชื่อ - สกุล <span class="val-box" style="width: 60%;">${emp?.full_name || ''}</span></div>
            <div style="flex: 1;">ชื่อเล่น <span class="val-box" style="width: 50%;">${emp?.nickname || ''}</span></div>
            <div style="flex: 1.5;">ตำแหน่ง <span class="val-box" style="width: 55%;">${emp?.positions?.position_name || ''}</span></div>
            <div style="flex: 2.2;">ฝ่าย <span class="val-box" style="width: 70%;">${emp?.departments?.department_name || ''}</span></div>
          </div>
          <div class="emp-row">
            <div style="flex: 2.5;">สถานะ &nbsp; 
              <span style="border:1px solid #000; padding:0 4px; display:inline-block; font-size:10px;">✓</span> พนักงานปกติ &nbsp;&nbsp;
              <span style="border:1px solid #000; padding:0 4px; display:inline-block; color:#fff; font-size:10px;">✓</span> รับรายวัน
            </div>
            <div style="flex: 2;">วันเริ่มงาน <span class="val-box" style="width: 50%;">${emp?.start_date ? formatShortDate(emp.start_date) : ''}</span></div>
            <div style="flex: 2;">วันที่ผ่านโปร <span class="val-box" style="width: 45%;"></span></div>
            <div style="flex: 2.2;">เริ่มมีสิทธิ์ <span class="val-box" style="width: 60%;"></span></div>
          </div>
          <div class="emp-row" style="margin-top: 4px; font-size: 11px;">
            <div style="flex: 1;">รท.รับรองสิทธิประกันสังคม : เกษมราษฎร์-รัตนาฯ</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th rowspan="3" style="width: 6%;">ว/ด/ป<br>ที่เขียน</th>
              <th colspan="2" style="width: 14%;">วันที่ลา</th>
              <th colspan="3" style="width: 10%;">จำนวน</th>
              <th rowspan="3" style="width: 7%;">ประเภท<br>การลา</th>
              <th rowspan="3" style="width: 19%;">สาเหตุการลา</th>
              <th rowspan="3" style="width: 7%;">หลักฐาน<br>การลา</th>
              <th rowspan="3" style="width: 9%;">ลงชื่อผู้ลา</th>
              <th colspan="2" style="width: 14%;">ผู้อนุมัติ</th>
              <th rowspan="3" style="width: 7%;">ฝ่าย<br>บุคคล</th>
            </tr>
            <tr>
              <th rowspan="2" style="width: 7%;">เริ่มวันที่</th>
              <th rowspan="2" style="width: 7%;">ถึงวันที่</th>
              <th rowspan="2" style="width: 4%;">วัน</th>
              <th colspan="2" style="width: 6%;">ชั่วโมง</th>
              <th rowspan="2" style="width: 7%;">หน.แผนก</th>
              <th rowspan="2" style="width: 7%;">ผจก. ฝ่าย</th>
            </tr>
            <tr>
              <th style="width: 3%;">เช้า</th>
              <th style="width: 3%;">บ่าย</th>
            </tr>
          </thead>
          <tbody>
            <tr class="row-data">
              <td>${dWrite}</td>
              <td>${dStart}</td>
              <td>${dEnd}</td>
              <td style="font-weight: 700;">${leave.total_days}</td>
              <td></td>
              <td></td>
              <td style="font-weight: 600;">${leaveType?.leave_name || '-'}</td>
              <td class="text-left" style="font-family: 'Sarabun';">${leave.reason || '-'}</td>
              <td></td>
              <td style="font-family: cursive; font-size: 14px; color: #1e293b;">${emp?.nickname || ''}</td>
              <td style="font-family: cursive; font-size: 12px; color: #1e293b;">${leave.director_status==='approved'?'✓ อนุมัติ':''}</td>
              <td style="font-family: cursive; font-size: 12px; color: #1e293b;">${leave.manager_status==='approved'?'✓ อนุมัติ':''}</td>
              <td style="font-family: cursive; font-size: 12px; color: #1e293b;">${leave.status==='approved'?'✓ อนุมัติ':''}</td>
            </tr>
            ${emptyRows}
          </tbody>
        </table>
        
        <div class="footer-box">
          ระยะเวลาในการใช้สิทธิการลา เริ่มวันที่ ${startPeriod} - ${endPeriod}
        </div>
        <div class="footer-note">
          โปรดศึกษาหลักเกณฑ์และปฏิบัติตามหลักเกณฑ์ที่กำหนด (ด้านหลัง) >>>>>
        </div>
        
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างฟอร์ม A4 ได้: ' + err.message, 'error');
  }
}