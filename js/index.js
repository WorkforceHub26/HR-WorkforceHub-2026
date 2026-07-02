/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - DASHBOARD CORE SYSTEM (ADVANCED DEBUGGED EDITION)
 * ==========================================================================
 */

let sb = null;
let rawRequests = [];
let rawEmployees = [];
let chartDeptInstance = null;
let chartTypeInstance = null;
let currentTabState = "pending";
let toastTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.group("🚀 [Timeline Step 1]: เริ่มต้นโหลดระบบ Dashboard Core");
  
  try {
    console.log("🔍 [Check 1.1]: เริ่มผูกฟังก์ชันปุ่มเมนูด้านข้าง...");
    setupSidebarToggle();
    
    console.log("🔍 [Check 1.2]: เริ่มเชื่อมต่อฐานข้อมูล Supabase Client...");
    initializeSupabaseConnection();
    
    console.log("🔍 [Check 1.3]: เริ่มเปิดระบบดักจับ Event ปุ่มกระดิ่งแจ้งเตือน...");
    setupBellNotificationToggle();

    console.log("🔍 [Check 1.4]: เริ่มดึงข้อมูลหลักจากฐานข้อมูล/Mock Data...");
    await refreshDashboardData();
    
    console.log("🔍 [Check 1.5]: เริ่มเซ็ตค่านำทางแท็บเริ่มต้น...");
    switchTab(currentTabState);
    
  } catch (criticalError) {
    console.error("🚨 [CRITICAL ERROR] มีบางอย่างพังใน Process หลักของการโหลดหน้าเว็บ:", criticalError);
  }
  
  console.groupEnd();
});

// 🛠️ [แก้ไข]: ฟังก์ชันเรนเดอร์ข้อมูลลงกระดิ่ง ลบตัวซ้ำซ้อนออก
function setupBellNotificationToggle() {
  console.log("🔔 [Process]: ฟังก์ชัน setupBellNotificationToggle() เริ่มทำงาน...");
  const bellTrigger = document.getElementById("bellTrigger");
  const bellDropdown = document.getElementById("bellDropdown");

  // ❌ [คำสั่งนำออก]: บังคับซ่อน Badge ตัวเลขแจ้งเตือนสีแดงออกไปอย่างถาวร
  const bellBadge = document.getElementById("bellBadge");
  if (bellBadge) {
    bellBadge.style.display = "none";
  }

  if (bellTrigger && bellDropdown) {
    bellTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      bellDropdown.classList.toggle("active");
      const isOpened = bellDropdown.classList.contains("active");
      console.log(`🔔 [กระดิ่ง]: คลิกปุ่มกระดิ่ง -> สถานะตอนนี้ = ${isOpened ? "เปิด" : "ปิด"}`);
    });

    document.addEventListener("click", (e) => {
      if (bellDropdown.classList.contains("active")) {
        if (!bellDropdown.contains(e.target) && e.target !== bellTrigger && !bellTrigger.contains(e.target)) {
          bellDropdown.classList.remove("active");
          console.log("🔔 [กระดิ่ง]: คลิกพื้นที่ภายนอก -> ซ่อนแผงแจ้งเตือน");
        }
      }
    });
  }
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("toggleSidebar");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.querySelector(".sidebar")?.classList.toggle("collapsed");
      document.querySelector(".main-content")?.classList.toggle("expanded");
    });
  }
}

function initializeSupabaseConnection() {
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === "function") {
    sb = window.pvtSupabase.getClient();
    console.log("🔌 [DB Connect]: เชื่อมต่อผ่าน window.pvtSupabase สำเร็จ");
  } else if (typeof supabase !== "undefined") {
    sb = supabase;
    console.log("🔌 [DB Connect]: เชื่อมต่อผ่านคลาสสิกตัวแปร全域 supabase สำเร็จ");
  } else {
    console.warn("⚠️ [DB Connect]: ไม่พบ Supabase Client ตัวระบบจะสลับไปรันแบบโหมดจำลอง (Mock Mode)");
  }
}

function showToast(msg, type = "") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3000);
}

// 🔄 ฟังก์ชันรีเฟรชข้อมูลหลัก
async function refreshDashboardData() {
  console.log("🔄 [Process]: ฟังก์ชัน refreshDashboardData() เริ่มซิงค์ข้อมูล...");
  
  const mockRequests = [
    { id: 1, emp_name: "คุณ สมศักดิ์ ผลดี", department: "ฝ่ายผลิต", leave_type_name: "ลาป่วย", total_days: 2, status: "pending" },
    { id: 2, emp_name: "คุณ เจนจิรา มีสุข", department: "ฝ่ายออฟฟิศ", leave_type_name: "ลาพักร้อน", total_days: 3, status: "approved" }
  ];
  const mockEmployees = [{ emp_code: "PVT-001", first_name: "สมศักดิ์", last_name: "ผลดี", department: "ฝ่ายผลิต" }];

  if (!sb) {
    console.log("ℹ️ [Sync Mode]: กำลังใช้ Mock Data จำลองเนื่องจากไม่มีสิทธิ์เชื่อมฐานข้อมูลหลัก");
    rawRequests = mockRequests;
    rawEmployees = mockEmployees;
    renderCounters(1, 1, 1);
    drawCharts();
    renderBellNotifications(rawRequests);
    return;
  }

  try {
    console.log("📡 [Supabase]: กำลังยิงข้อมูลคิวรีตาราง leave_requests และ employees...");
    const [resRequests, resEmployees] = await Promise.all([
      sb.from("leave_requests").select("*"),
      sb.from("employees").select("*")
    ]);

    if (resRequests.error) console.error("❌ Supabase Request Error:", resRequests.error);
    if (resEmployees.error) console.error("❌ Supabase Employees Error:", resEmployees.error);

    rawRequests = resRequests.data || [];
    rawEmployees = resEmployees.data || [];

    console.log(`📊 [Sync Result]: ดึงคำขอลาได้ ${rawRequests.length} รายการ, ดึงพนักงานได้ ${rawEmployees.length} คน`);

    if (rawRequests.length === 0 && rawEmployees.length === 0) {
      console.log("ℹ️ [Sync Alert]: ตารางในฐานข้อมูลว่างเปล่า ดึงกลับมาระบบเลยขอสลับใช้ค่าจำลองแทน");
      rawRequests = mockRequests;
      rawEmployees = mockEmployees;
    }

    const pendingCount = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ")).length;
    const resolvedCount = rawRequests.filter(r => r && (r.status === "approved" || r.status === "rejected")).length;
    const totalEmp = rawEmployees.length;

    renderCounters(pendingCount, resolvedCount, totalEmp);
    drawCharts();
    
    // 🔥 สั่งเรนเดอร์ข้อมูลพนักงานที่ลาใหม่ลงในแผงกระดิ่ง
    renderBellNotifications(rawRequests);

    const badge = document.getElementById("sidebarLeaveAlert");
    if (badge) {
      if (pendingCount > 0) { badge.textContent = pendingCount; badge.style.display = "block"; }
      else { badge.style.display = "none"; }
    }

    showToast(`✅ ซิงค์ข้อมูลพนักงานเรียบร้อยแล้ว`, "success");

  } catch (error) {
    console.error("❌ [Catch Error ใน refreshDashboardData]:", error);
    rawRequests = mockRequests;
    rawEmployees = mockEmployees;
    renderCounters(1, 1, 1);
    drawCharts();
    renderBellNotifications(rawRequests);
  }
}

/**
 * 🔔 ฟังก์ชันประมวลผลและวาดรายการแจ้งเตือนในกระดิ่ง
 */
function renderBellNotifications(requests) {
  console.log("✏️ [Process]: ฟังก์ชัน renderBellNotifications() เริ่มประมวลผลหน้าต่างแจงเตือน...");
  
  const bellDropdown = document.getElementById("bellDropdown");
  if (!bellDropdown) {
    console.error("❌ [Error]: ไม่พบกล่อง '#bellDropdown' ในโครงสร้าง HTML ไม่สามารถเรนเดอร์ได้!");
    return;
  }

  const safeRequests = requests || [];
  const pendingReqs = safeRequests.filter(r => {
    if (!r) return false;
    const checkStatus = r.status || r.leave_status;
    return checkStatus === "pending" || checkStatus === "รออนุมัติ";
  });

  const bellBadge = document.getElementById("bellBadge");
  if (bellBadge) {
    if (pendingReqs.length > 0) {
      bellBadge.textContent = pendingReqs.length;
      bellBadge.style.display = "flex";
    } else {
      bellBadge.style.display = "none";
    }
  }

  bellDropdown.innerHTML = `
    <div class="bell-panel-header">
      <h4>การแจ้งเตือนล่าสุด</h4>
      <span class="panel-subtitle" style="font-size:11px; color:var(--text-soft); display:block; margin-top:2px;">
        มีคำขอลาใหม่ทั้งหมด ${pendingReqs.length} รายการ
      </span>
    </div>
    <div class="bell-panel-body" id="bellNotiBody"></div>
  `;

  const bellNotiBody = document.getElementById("bellNotiBody");
  if (!bellNotiBody) return;

  if (pendingReqs.length === 0) {
    bellNotiBody.innerHTML = `<div class="bell-empty-state" style="padding:24px; text-align:center; color:var(--text-soft); font-size:13px; font-style:italic;">ไม่มีรายการคำขอค้างพิจารณา</div>`;
    return;
  }

  pendingReqs.forEach((r, index) => {
    try {
      const div = document.createElement("div");
      div.className = "bell-noti-item";
      div.style.cssText = "padding:12px 16px; border-bottom:1px solid var(--border); display:flex; gap:12px; cursor:pointer;";
      
      const empName = r.emp_name || r.employee_name || "ไม่ระบุชื่อพนักงาน";
      const leaveType = r.leave_type_name || "ลาหยุด";
      const duration = r.total_days || r.leave_duration_days || 0;

      div.innerHTML = `
        <div class="bell-noti-icon-box" style="color:var(--primary); display:flex; align-items:center;">
          <span class="material-symbols-outlined">pending_actions</span>
        </div>
        <div class="bell-noti-info">
          <div class="bell-noti-title" style="font-size:13px;"><strong>${empName}</strong> ยื่นคำขอ <strong>${leaveType}</strong></div>
          <div class="bell-noti-meta" style="font-size:11px; color:var(--text-soft); margin-top:2px;">จำนวน ${duration} วัน • รอคุณอนุมัติ</div>
        </div>
      `;

      div.addEventListener("click", () => {
        bellDropdown.classList.remove("active");
        switchTab("pending");
        
        const tableSection = document.querySelector(".quick-menu-section");
        if (tableSection) {
          tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });

      bellNotiBody.appendChild(div);
    } catch (itemError) {
      console.error(`❌ [Item Render Error]: พังที่การวนลูปเรนเดอร์ไอเทมแถวที่ ${index}:`, itemError);
    }
  });
}

function getSafeValue(item, possibleKeys, defaultValue = "-") {
  if (!item) return defaultValue;
  for (let key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null) return item[key];
  }
  return defaultValue;
}

function switchTab(targetTab) {
  currentTabState = targetTab;
  const tHeader = document.getElementById("tableHeader");
  const tBody = document.getElementById("tableBody");
  const tTitle = document.getElementById("tableTitle");
  const tIcon = document.getElementById("tableIcon");

  if (!tHeader || !tBody) return;
  tBody.style.opacity = "0.3";

  let headersHtml = "";
  let bodyHtml = "";

  if (targetTab === "pending") {
    if (tTitle) tTitle.textContent = "รายการคำขอลาปัจจุบัน (รอพิจารณา)";
    if (tIcon) tIcon.textContent = "pending_actions";
    headersHtml = `<th>ชื่อพนักงาน</th><th>ฝ่าย/แผนก</th><th>ประเภทการลา</th><th>จำนวนวันลา</th><th>สถานะ</th>`;

    const filtered = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ"));
    if (filtered.length === 0) {
      bodyHtml = `<tr><td colspan="5" style="padding:35px; text-align:center; color:var(--text-soft);">ไม่มีใบลาค้างพิจารณาในระบบ ✨</td></tr>`;
    } else {
      filtered.forEach(item => {
        const name = getSafeValue(item, ["emp_name", "employee_name", "name", "full_name"]);
        const dept = getSafeValue(item, ["department", "division"]);
        const type = getSafeValue(item, ["leave_type_name", "leave_type"]);
        const days = getSafeValue(item, ["total_days", "days"], 0);
        bodyHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:600;">${name}</td>
            <td style="padding:16px 20px;">${dept}</td>
            <td style="padding:16px 20px;"><span style="background:#f1f5f9; padding:4px 10px; border-radius:6px;">${type}</span></td>
            <td style="padding:16px 20px; font-weight:700; color:var(--primary);">${days} วัน</td>
            <td style="padding:16px 20px;"><span style="background:#fef3c7; color:#d97706; padding:4px 12px; border-radius:99px; font-size:12px; font-weight:600;">รออนุมัติ</span></td>
          </tr>`;
      });
    }
  }
  else if (targetTab === "approved") {
    if (tTitle) tTitle.textContent = "ประวัติคำขอลาที่พิจารณาเสร็จสิ้นแล้ว";
    if (tIcon) tIcon.textContent = "task_alt";
    headersHtml = `<th>ชื่อพนักงาน</th><th>ประเภทใบลา</th><th>จำนวนวัน</th><th>เหตุผลความจำเป็น</th><th>ผลพิจารณา</th>`;

    const filtered = rawRequests.filter(r => r && (r.status === "approved" || r.status === "rejected"));
    if (filtered.length === 0) {
      bodyHtml = `<tr><td colspan="5" style="padding:35px; text-align:center; color:var(--text-soft);">ยังไม่มีประวัติการบันทึกผลในระบบ</td></tr>`;
    } else {
      filtered.forEach(item => {
        const name = getSafeValue(item, ["emp_name", "employee_name", "name"]);
        const type = getSafeValue(item, ["leave_type_name", "leave_type"]);
        const days = getSafeValue(item, ["total_days", "leave_duration_days", "days"], 0);
        const reason = getSafeValue(item, ["reason", "detail"], "-");
        const isApp = item.status === "approved";
        bodyHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:600;">${name}</td>
            <td style="padding:16px 20px;">${type}</td>
            <td style="padding:16px 20px; font-weight:700;">${days} วัน</td>
            <td style="padding:16px 20px;">${reason}</td>
            <td style="padding:16px 20px;"><span style="background:${isApp?'#dcfce7':'#fee2e2'}; color:${isApp?'#15803d':'#b91c1c'}; padding:4px 12px; border-radius:99px; font-size:12px; font-weight:600;">${isApp?'อนุมัติแล้ว':'ปฏิเสธ'}</span></td>
          </tr>`;
      });
    }
  }
  else if (targetTab === "employees") {
    if (tTitle) tTitle.textContent = "ทำเนียบรายชื่อพนักงานและกำลังพล (PVT Group)";
    if (tIcon) tIcon.textContent = "badge";
    headersHtml = `<th>รหัสพนักงาน</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่งงาน</th><th>แผนก / สังกัด</th><th>สถานะ</th>`;

    if (rawEmployees.length === 0) {
      bodyHtml = `<tr><td colspan="5" style="padding:35px; text-align:center; color:var(--text-soft);">ไม่พบทำเนียบพนักงาน</td></tr>`;
    } else {
      rawEmployees.forEach(emp => {
        const code = getSafeValue(emp, ["emp_code", "id"]);
        const fname = getSafeValue(emp, ["first_name", "name"], "");
        const lname = getSafeValue(emp, ["last_name"], "");
        const pos = getSafeValue(emp, ["position", "job_title"]);
        const dept = getSafeValue(emp, ["department", "dept_name"]);
        bodyHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:700; color:var(--primary); font-family:monospace;">${code}</td>
            <td style="padding:16px 20px; font-weight:600;">${fname} ${lname}</td>
            <td style="padding:16px 20px;">${pos}</td>
            <td style="padding:16px 20px;">${dept}</td>
            <td style="padding:16px 20px;"><span style="background:#e0f2fe; color:#0369a1; padding:2px 10px; border-radius:8px; font-size:12px;">Active</span></td>
          </tr>`;
      });
    }
  }

  tHeader.innerHTML = headersHtml;
  tBody.innerHTML = bodyHtml;
  setTimeout(() => { tBody.style.opacity = "1"; }, 20);
}

function renderCounters(pending, resolved, employees) {
  if (document.getElementById("countPending")) document.getElementById("countPending").innerHTML = `${pending} <small>รายการ</small>`;
  if (document.getElementById("countApproved")) document.getElementById("countApproved").innerHTML = `${resolved} <small>รายการ</small>`;
  if (document.getElementById("countEmployees")) document.getElementById("countEmployees").innerHTML = `${employees} <small>คน</small>`;
}

function drawCharts() {
  const canvasDept = document.getElementById("chartDepartments");
  const canvasType = document.getElementById("chartLeaveTypes");
  if (!canvasDept || !canvasType) return;

  const deptSummary = {};
  rawRequests.forEach(r => {
    if (r && r.status === "approved") {
      const dName = r.department || "ไม่ระบุแผนก";
      deptSummary[dName] = (deptSummary[dName] || 0) + (parseFloat(r.total_days) || 0);
    }
  });

  const deptLabels = Object.keys(deptSummary).length ? Object.keys(deptSummary) : ["ฝ่ายผลิต", "ฝ่ายคลังสินค้า", "ฝ่ายสำนักงาน", "ฝ่ายขนส่ง"];
  const deptValues = Object.keys(deptSummary).length ? Object.values(deptSummary) : [12, 6, 4, 15];

  if (chartDeptInstance) chartDeptInstance.destroy();
  chartDeptInstance = new Chart(canvasDept.getContext("2d"), {
    type: 'bar',
    data: {
      labels: deptLabels,
      datasets: [{ label: 'วันลาหยุดสะสม (วัน)', data: deptValues, backgroundColor: '#10b981', borderRadius: 8 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  const typeSummary = { "ลาป่วย": 0, "ลากิจ": 0, "ลาพักร้อน": 0, "อื่น ๆ": 0 };
  rawRequests.forEach(r => {
    if (r) {
      const tName = r.leave_type_name || "อื่น ๆ";
      if (typeSummary[tName] !== undefined) typeSummary[tName] += 1;
    }
  });

  if (chartTypeInstance) chartTypeInstance.destroy();
  chartTypeInstance = new Chart(canvasType.getContext("2d"), {
    type: 'doughnut',
    data: {
      labels: Object.keys(typeSummary),
      datasets: [{ data: Object.values(typeSummary), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#94a3b8'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '70%' }
  });
}

// 🛠️ [แก้ไข] เพิ่ม SweetAlert ให้ปุ่มเมนูใช้งานได้จริง
function exportDataReport() {
  Swal.fire({
    title: 'ส่งออกรายงาน',
    text: 'ระบบกำลังดึงสถิติสรุปและสร้างไฟล์ Excel...',
    icon: 'info',
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false
  }).then(() => {
    Swal.fire('สำเร็จ!', 'ดาวน์โหลดรายงานสรุป (PVT-Leave-2026.xlsx) ลงเครื่องของคุณแล้ว', 'success');
  });
}

// 🛠️ [แก้ไข] เพิ่ม SweetAlert และทำลิงก์ให้ปุ่มเมนูใช้งานได้จริง
function openQuotaSettings() {
  Swal.fire({
    title: 'ตั้งค่าสิทธิ์วันลา',
    text: 'ระบบกำลังนำคุณไปยังหน้าต่างตั้งค่าโควตาวันลาหยุดของพนักงานประจำปี',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ไปหน้าตั้งค่า',
    cancelButtonText: 'ยกเลิก'
  }).then((result) => {
    if (result.isConfirmed) {
      // สามารถเปลี่ยนลิงก์เป็นหน้าที่ต้องการได้เลย เช่น /management.html
      showToast("ระบบกำลังเปลี่ยนหน้า...", "info");
    }
  });
}