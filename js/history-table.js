/**
 * ⚙️ history-table.js
 * [เวอร์ชัน: ดึงชื่อแผนก/ตำแหน่ง ข้ามตารางแบบถูกต้อง 100% พร้อมโควตาสดจาก SQL]
 */

let allEmployeesCache = []; 
let allLeavesCache = []; 

document.addEventListener("DOMContentLoaded", async () => {
  let sb = null;
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === 'function') {
    sb = window.pvtSupabase.getClient();
  } else if (window.supabase) { sb = window.supabase; } 
  else if (window.supabaseClient) { sb = window.supabaseClient; }

  if (!sb) {
    console.error("❌ ไม่พบการเชื่อมต่อฐานข้อมูล");
    return;
  }

  // โหลดข้อมูลทั้งหมด
  await fetchData(sb);

  // จับอีเวนต์ค้นหาพนักงาน
  const inputSearch = document.getElementById("inputSearchEmployee");
  if (inputSearch) {
    inputSearch.addEventListener("input", (e) => {
      renderEmployeeTable(e.target.value.trim());
    });
  }
});

// ฟังก์ชันโหลดข้อมูล พนักงาน (Join แผนก/ตำแหน่ง) + ใบลา
async function fetchData(sb) {
  try {
    // 🌟 1. ดึงข้อมูลพนักงาน พ่วงชื่อแผนกจากตาราง departments และชื่อตำแหน่งจากตาราง positions
    const { data: empData, error: empError } = await sb
      .from('employees')
      .select(`
        *,
        departments ( department_name ),
        positions ( position_name )
      `)
      .order('employee_code', { ascending: true });

    if (empError) throw empError;
    allEmployeesCache = empData || [];

    // 2. โหลดข้อมูลใบลาทั้งหมดพ่วงประเภทการลา
    const { data: leaveData, error: leaveError } = await sb
      .from('leave_requests')
      .select('*, leave_types(*)')
      .order('created_at', { ascending: false });

    if (leaveError) throw leaveError;
    allLeavesCache = leaveData || [];

    // วาดตารางหลัก
    renderEmployeeTable(""); 

  } catch (err) {
    console.error("❌ โหลดข้อมูลล้มเหลว:", err);
    document.getElementById("employeeTableBody").innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">⚠️ โหลดข้อมูลไม่สำเร็จ (${err.message})</td></tr>`;
  }
}

// 🟢 วาดตารางหลัก (รายชื่อพนักงานหน้าแรก)
function renderEmployeeTable(keyword) {
  const tableBody = document.getElementById("employeeTableBody");
  const txtTotal = document.getElementById("txtTotalEmployees");
  const searchWord = keyword.toLowerCase();
  
  // กรองพนักงานเพื่อค้นหา
  const filtered = allEmployeesCache.filter(emp => {
    const name = (emp.full_name || "").toLowerCase();
    const code = (emp.employee_code || "").toLowerCase();
    const nick = (emp.nickname || "").toLowerCase();
    const dept = (emp.departments?.department_name || "").toLowerCase();
    const pos = (emp.positions?.position_name || "").toLowerCase();
    
    return name.includes(searchWord) || code.includes(searchWord) || nick.includes(searchWord) || dept.includes(searchWord) || pos.includes(searchWord);
  });

  if (txtTotal) txtTotal.textContent = `พบพนักงาน: ${filtered.length} คน`;

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:40px; color:#64748b;">ไม่พบข้อมูลพนักงานที่ค้นหา...</td></tr>`;
    return;
  }

  let htmlRows = "";
  filtered.forEach(emp => {
    const nickname = emp.nickname || "-";
    // 🌟 ดึงข้อมูลจากการ Join ตาราง
    const dept = emp.departments?.department_name || "-";
    const position = emp.positions?.position_name || "-";
    
    const startDate = emp.start_date ? new Date(emp.start_date).toLocaleDateString('th-TH') : "-";
    const status = emp.employee_type || emp.status || "พนักงานประจำ"; 
    const hospital = emp.social_security_hospital || "-";

    htmlRows += `
      <tr>
        <td><strong>${emp.employee_code || "-"}</strong></td>
        <td>${emp.full_name || "-"}</td>
        <td>${nickname}</td>
        <td><span class="dept-tag">${dept}</span></td>
        <td style="color:#475569;">${position}</td>
        <td>${startDate}</td>
        <td><span style="color:#059669; font-weight:500;">${status}</span></td>
        <td>${hospital}</td>
        <td style="text-align: center;">
          <button class="btn-view-details" onclick="openEmployeeModal('${emp.id}')">
            <span class="material-symbols-outlined">visibility</span> ดูรายละเอียด
          </button>
        </td>
      </tr>
    `;
  });

  tableBody.innerHTML = htmlRows;
}

// 🌟 ฟังก์ชันเปิด Modal ดึงสิทธิ์สด (ล้างเบิ้ล/ล้างแคช) + แสดงแผนกและตำแหน่งจริง
async function openEmployeeModal(empId) {
  const modal = document.getElementById("employeeDetailsModal");
  const modalBody = document.getElementById("modalDetailsBody");
  
  const emp = allEmployeesCache.find(e => e.id === empId);
  if (!emp) return;

  let sb = null;
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === 'function') {
    sb = window.pvtSupabase.getClient();
  } else if (window.supabase) { sb = window.supabase; } 
  else if (window.supabaseClient) { sb = window.supabaseClient; }

  let activeQuotas = [];
  if (sb) {
    try {
      // 🔄 ดึงโควตาสดใหม่จากดาต้าเบส ไม่ผ่านแคช
      const { data: typeData } = await sb
        .from('leave_types')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: true });
        
      if (typeData && typeData.length > 0) {
        activeQuotas = typeData.map(t => ({
          id: t.id,
          name: t.leave_name,
          code: t.leave_code,
          max: Number(t.yearly_quota || 0)
        }));
      }
    } catch (e) {
      console.error("ดึงข้อมูล leave_types ล่าสุดไม่สำเร็จ:", e);
    }
  }

  // ดึงใบลาทั้งหมดของพนักงานคนนี้
  const empLeaves = allLeavesCache.filter(leave => leave.employee_id === empId);

  // 🧮 1. สร้างกล่องสิทธิ์การลาคงเหลือประจำปี
  let quotaHtml = `<div class="quota-grid">`;
  activeQuotas.forEach(quota => {
    let totalUsed = 0;
    empLeaves.forEach(lv => {
      if (lv.status === 'approved' && lv.leave_type_id === quota.id) {
        totalUsed += Number(lv.total_days || 0);
      }
    });
    
    let remaining = quota.max - totalUsed;
    let cardClass = remaining < quota.max ? "quota-card highlight" : "quota-card";

    quotaHtml += `
      <div class="${cardClass}">
        <span class="q-title">${quota.name}</span>
        <span class="q-sub" style="display:block; margin-bottom:4px; font-size:11px; color:#94a3b8;">(${quota.code})</span>
        <span class="q-value">${remaining} <span style="font-size:12px; font-weight:normal; color:#64748b;">/ ${quota.max}</span></span>
        <span class="q-sub">ใช้ไปแล้ว ${totalUsed} วัน</span>
      </div>
    `;
  });
  quotaHtml += `</div>`;

  // 📋 2. สร้างตารางประวัติการลา
  let leaveTableHTML = "";
  if (empLeaves.length === 0) {
    leaveTableHTML = `<div style="text-align:center; padding:20px; color:#64748b; background:#f8fafc; border-radius:8px;">พนักงานคนนี้ยังไม่มีประวัติการลา</div>`;
  } else {
    let trs = "";
    empLeaves.forEach(lv => {
      const start = new Date(lv.start_date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' });
      const end = new Date(lv.end_date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' });
      const reqDate = new Date(lv.created_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' });
      
      let approvedDate = "-";
      let badge = "mini-pending"; let txt = "รอพิจารณา";
      
      if (lv.status === 'approved') { 
        badge = "mini-approved"; txt = "อนุมัติแล้ว"; 
        approvedDate = lv.updated_at ? new Date(lv.updated_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' }) : "อนุมัติแล้ว";
      }
      if (lv.status === 'rejected') { 
        badge = "mini-rejected"; txt = "ไม่อนุมัติ"; 
        approvedDate = lv.updated_at ? new Date(lv.updated_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' }) : "ปฏิเสธ";
      }

      trs += `
        <tr>
          <td>${reqDate}</td>
          <td><strong>${lv.leave_types?.leave_name || "ไม่ระบุ"}</strong></td>
          <td>${start} - ${end}</td>
          <td style="color:var(--primary); font-weight:600;">${lv.total_days} วัน</td>
          <td><span class="mini-badge ${badge}">${txt}</span></td>
          <td style="color:#64748b; font-size:12.5px;">${approvedDate}</td>
        </tr>
      `;
    });

    leaveTableHTML = `
      <div class="nested-table-wrapper">
        <table class="nested-table">
          <thead>
            <tr>
              <th>วันที่ยื่นเรื่อง</th>
              <th>ประเภทการลา</th>
              <th>ช่วงวันที่หยุด</th>
              <th>จำนวนวัน</th>
              <th>สถานะ</th>
              <th>วันที่อนุมัติ</th>
            </tr>
          </thead>
          <tbody>${trs}</tbody>
        </table>
      </div>
    `;
  }

  // 🌟 ดึงค่าที่ Join แผนกและตำแหน่งมาใส่ใน Pop-up
  const dept = emp.departments?.department_name || "-";
  const pos = emp.positions?.position_name || "-";

  modalBody.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; background:#f8fafc; padding:16px; border-radius:12px; border: 1px solid var(--border); margin-bottom: 24px;">
      <div><span class="detail-label">รหัสพนักงาน</span> <div class="detail-value" style="color:var(--primary); font-weight:600;">${emp.employee_code || "-"}</div></div>
      <div><span class="detail-label">ชื่อ-นามสกุล</span> <div class="detail-value" style="font-weight:600;">${emp.full_name || "-"}</div></div>
      <div><span class="detail-label">แผนก / ตำแหน่ง</span> <div class="detail-value" style="font-weight:600; color:#1e293b;">${dept} / ${pos}</div></div>
    </div>

    <div class="modal-section-title">
      <span class="material-symbols-outlined" style="color:var(--primary);">donut_large</span>
      สิทธิการลาคงเหลือประจำปี (คำนวณจากระบบฐานข้อมูลจริง)
    </div>
    ${quotaHtml}

    <div class="modal-section-title">
      <span class="material-symbols-outlined" style="color:var(--primary);">history</span>
      ประวัติการยื่นใบลาทั้งหมด (${empLeaves.length} รายการ)
    </div>
    ${leaveTableHTML}
  `;

  modal.classList.add("active");
}

function closeEmployeeModal() {
  document.getElementById("employeeDetailsModal").classList.remove("active");
}

function handleLogout() {
  sessionStorage.removeItem("currentUser");
  window.location.href = "/login.html";
}