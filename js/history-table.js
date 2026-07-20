let supabaseClient = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === "function") {
    supabaseClient = window.pvtSupabase.getClient();
  } else if (window.supabase) {
    supabaseClient = window.supabase;
  } else {
    document.getElementById("employeeTableBody").innerHTML = `
      <tr><td colspan="8" style="text-align:center; padding:30px; color:red;">❌ เชื่อมต่อ Supabase ไม่สำเร็จ</td></tr>
    `;
    return;
  }
  
  await fetchAllEmployees();
});

/* ==========================================================================
   🧼 HELPER FUNCTION: จัดการล้างและซ่อมแซม URL รูปภาพ (ป้องกันภาพแตก 100%)
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
  return "/assets/img/default-avatar.jpg"; // คืนค่ารูป Default หากไม่มีข้อมูล
}

/* ==========================================================================
   🔄 โหลดทำเนียบพนักงานแบบ JOIN (employees + departments + positions)
   ========================================================================== */
async function fetchAllEmployees() {
  const tbody = document.getElementById("employeeTableBody");
  try {
    let { data: employees, error } = await supabaseClient
      .from('employees')
      .select(`
        id,
        employee_code,
        full_name,
        start_date,
        hospital,
        image_url,
        departments ( department_name ),
        positions ( position_name )
      `)
      .order('employee_code', { ascending: true });

    if (error) throw error;

    if (!employees || employees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-soft);">ไม่พบข้อมูลพนักงานในระบบ</td></tr>`;
      return;
    }

    let html = "";
    employees.forEach(emp => {
      const eId = emp.employee_code || '-';
      const eName = emp.full_name || '-';
      const eRole = emp.positions ? emp.positions.position_name : '-';
      const eDept = emp.departments ? emp.departments.department_name : '-';
      const eSS = emp.hospital || '-'; 
      const eStart = emp.start_date || '-';
      
      // เรียกใช้งานเครื่องมือแปลง URL รูปภาพ
      const avatarUrl = getAvatarUrl(emp.image_url);

      html += `
        <tr>
          <td style="text-align: center; vertical-align: middle;">
            <img src="${avatarUrl}" 
                 alt="${eName}" 
                 style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #e2e8f0; display: block; margin: 0 auto;"
                 onerror="this.src='/assets/img/default-avatar.jpg';">
          </td>
          <td><b>${eId}</b></td>
          <td><span style="font-weight: 500; color: #1e293b;">${eName}</span></td>
          <td>${eRole}</td>
          <td>${eDept}</td>
          <td style="color:var(--text-soft);">${eSS}</td>
          <td>${eStart}</td>
          <td style="text-align: center;">
            <button class="btn-check-history" onclick="openEmployeeLeaveHistoryPopup('${eId}', '${eName}')">
              <span class="material-symbols-outlined" style="font-size: 18px;">analytics</span> เช็คประวัติ
            </button>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (err) {
    console.error("Error loading employee directory:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--danger);">⚠️ เกิดข้อผิดพลาดในการโหลดข้อมูล: ${err.message}</td></tr>`;
  }
}

/* ==========================================================================
   ✨ เปิดหน้าต่าง Pop-up ดึงข้อมูลใบลาสะสม และสิทธิ์คงเหลือ
   ========================================================================== */
async function openEmployeeLeaveHistoryPopup(empCode, empName) {
  Swal.fire({
    title: 'กำลังตรวจสอบคลังข้อมูล...',
    html: '<div class="pvt-spinner"></div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  // ใช้ supabaseClient ตัวกลางของระบบที่เช็คจาก DOMContentLoaded แล้ว
  const sb = supabaseClient || window.supabaseClient || window.pvtSupabase?.getClient();
  if (!sb) {
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
      return;
  }

  let balance = null;
  let requests = [];
  let employeeUuid = null;
  let dbImageUrl = null;

  // 🔍 Step 1: หารหัส UUID และรูปภาพของพนักงาน
  try {
    const { data: empData, error: empError } = await sb
      .from('employees')
      .select('id, image_url')
      .eq('employee_code', empCode)
      .single();

    if (empError || !empData) {
      Swal.fire('ไม่พบข้อมูล', `ไม่พบพนักงานรหัส ${empCode} ในระบบ`, 'warning');
      return;
    }
    
    employeeUuid = empData.id;
    dbImageUrl = empData.image_url;

  } catch (e) {
    console.error("Error fetching employee:", e);
    Swal.fire('ข้อผิดพลาด', 'เกิดปัญหาในการค้นหาข้อมูลพนักงาน', 'error');
    return;
  }

  // 🔍 Step 2: ดึงสิทธิ์คงเหลือจาก leave_balances
  try {
    const { data: balData } = await sb
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeUuid)
      .maybeSingle();
      
    if (balData) balance = balData;
  } catch (e) {
    console.warn("⚠️ ไม่พบตาราง leave_balances:", e.message);
  }

  // 🔍 Step 3: ดึงตารางใบลาสะสม (leave_requests)
  try {
    const { data: reqData } = await sb
      .from('leave_requests')
      .select('*, leave_types(leave_name)')
      .eq('employee_id', employeeUuid)
      .order('created_at', { ascending: false });
      
    if (reqData) requests = reqData;
  } catch (e) {
    console.warn("⚠️ เกิดข้อผิดพลาดในการดึงข้อมูลตาราง leave_requests:", e.message);
  }

  // แปลง URL รูปภาพสำหรับโชว์บนหัวข้อ Pop-up
  const popAvatarUrl = getAvatarUrl(dbImageUrl);

  // ตั้งค่าโควตาเริ่มต้นแสดงผล
  let sRem = balance?.sick_remaining ?? 30, sMax = balance?.sick_max ?? 30;
  let pRem = balance?.personal_remaining ?? 6, pMax = balance?.personal_max ?? 6;
  let vRem = balance?.vacation_remaining ?? 6, vMax = balance?.vacation_max ?? 6;

  let quotaHtml = `
    <div class="popup-quota-container">
      <div class="popup-quota-box sick">
        <p>🤒 ลาป่วยคงเหลือ</p>
        <h3>${sRem}/${sMax}</h3>
        <p>วัน</p>
      </div>
      <div class="popup-quota-box personal">
        <p>💼 ลากิจคงเหลือ</p>
        <h3>${pRem}/${pMax}</h3>
        <p>วัน</p>
      </div>
      <div class="popup-quota-box vacation">
        <p>🏖️ พักร้อนคงเหลือ</p>
        <h3>${vRem}/${vMax}</h3>
        <p>วัน</p>
      </div>
    </div>
  `;

  let historyTableRows = "";
  if (requests.length === 0) {
    historyTableRows = `<tr><td colspan="5" style="text-align:center; padding:16px; color:var(--text-soft);">ไม่พบประวัติการยื่นคำขอลาหยุดของพนักงานรายนี้</td></tr>`;
  } else {
    requests.forEach(req => {
      let reqType = req.leave_types?.leave_name || req.leave_name || req.leave_type || 'การลาทั่วไป';
      let reqStatus = req.status || 'pending';
      let reqReason = req.reason || req.detail || '-';
      let rId = req.id || '###';
      
      let badgeClass = reqStatus === 'approved' ? 'approved' : (reqStatus === 'rejected' ? 'rejected' : 'pending');
      let statusText = reqStatus === 'approved' ? 'อนุมัติแล้ว' : (reqStatus === 'rejected' ? 'ปฏิเสธ' : 'รอพิจารณา');
      
      historyTableRows += `
        <tr>
          <td><b>#${rId.toString().substring(0, 5)}</b></td>
          <td><span style="font-weight:600; color:var(--primary);">${reqType}</span></td>
          <td>${req.start_date || '-'} ถึง ${req.end_date || '-'}<br><small style="color:var(--text-soft);">(${req.total_days || req.days || '0'} วัน)</small></td>
          <td style="font-size:12px; color:var(--text-soft); max-width:180px; white-space:normal;">${reqReason}</td>
          <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
        </tr>
      `;
    });
  }

  // ยิงกล่องข้อมูลออกหน้าจอ (ปิดฟังก์ชันได้สมบูรณ์และเปิดอ่าน HTML หัวข้อครบถ้วน)
  Swal.fire({
    width: '780px',
    html: `
      <div style="display: flex; align-items: center; gap: 14px; text-align: left; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px;">
        <img src="${popAvatarUrl}" 
             style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #0fa472; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" 
             onerror="this.src='/assets/img/default-avatar.jpg';">
        <div>
          <div style="font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.2;">ตรวจสอบประวัติพนักงาน: ${empName}</div>
          <div style="font-size: 13.5px; font-weight: 500; color: #64748b; margin-top: 3px;">รหัสประจำตัวพนักงาน: ${empCode}</div>
        </div>
      </div>

      <div style="text-align: left;">
        <div style="border-bottom: 2px dashed #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
          <span style="font-size:13.5px; color:var(--text-soft); font-weight:600; display:block; margin-top:8px; margin-bottom: 6px;">📊 ยอดสิทธิ์วันลาคงเหลือประจำปีปัจจุบัน:</span>
          ${quotaHtml}
        </div>
        
        <span style="font-size:13.5px; color:var(--text-soft); font-weight:600; display:block; margin-top:16px; margin-bottom:8px;">📜 ประวัติรายการเอกสารใบลาสะสมทั้งหมดในตาราง (${requests.length} รายการ):</span>
        <div style="max-height: 260px; overflow-y: auto; border: 1px solid var(--border); border-radius: 12px; background: #fafafa;">
          <table class="swal-leave-table">
            <thead>
              <tr>
                <th>เลขใบลา</th>
                <th>ประเภทการลา</th>
                <th>วันที่ลา (จำนวน)</th>
                <th>เหตุผลความจำเป็น</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              ${historyTableRows}
            </tbody>
          </table>
        </div>
      </div>
    `,
    confirmButtonText: 'ปิดหน้าต่างข้อมูล',
    confirmButtonColor: '#0fa472'
  });
} //  ปิดปีกกาฟังก์ชันประวัติใบลาอย่างสมบูรณ์

/* ==========================================================================
   🔍 LIVE SEARCH FUNCTION
   ========================================================================== */
function filterEmployeeTable() {
  const searchVal = document.getElementById("empSearchInput").value.toLowerCase();
  const table = document.getElementById("mainEmployeeTable");
  const rows = table.getElementsByTagName("tbody")[0].getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cells.length < 5) continue; 
    const totalRowText = rows[i].textContent.toLowerCase();
    rows[i].style.display = totalRowText.includes(searchVal) ? "" : "none";
  }
}