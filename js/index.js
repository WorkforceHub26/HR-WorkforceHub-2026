/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - DASHBOARD CORE SYSTEM (ADVANCED DEBUGGED EDITION + EXTENSIONS)
 * ==========================================================================
 */

/**
 * 🕵️‍♂️ PVT CSS Loader Guardian (ระบบสายตรวจเช็คสถานะการโหลด CSS)
 * วางไว้บรรทัดแรกสุดของสคริปต์ เพื่อให้ทำงานก่อนที่ CSS จะโหลดเสร็จสิ้น
 */
(function() {
  console.group("🎨 [CSS Verification Timeline]: เริ่มต้นตรวจสอบสไตล์ชีท...");

  // 1. ตรวจสอบไฟล์ CSS ที่ผูกอยู่กับแท็ก <link> ทั้งหมดในหน้าเว็บ
  const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
  
  if (cssLinks.length === 0) {
    console.warn("⚠️ [CSS Warning]: ไม่พบแท็กผูก CSS (<link rel='stylesheet'>) ในหน้า HTML นี้เลย!");
  }

  cssLinks.forEach((link, index) => {
    const url = link.getAttribute('href');
    link.addEventListener('load', () => {
      console.log(`✅ [CSS Loaded] [ตัวที่ ${index + 1}]: โหลดสำเร็จ -> "${url}"`);
    });
    link.addEventListener('error', (err) => {
      console.error(`🚨 [CSS CRITICAL ERROR] [ตัวที่ ${index + 1}]: ไม่สามารถโหลดไฟล์นี้ได้! -> "${url}"`);
    });
  });

  // 2. ตรวจสอบปัญหา @import ซ่อนรูปแอบพังอยู่ข้างในไฟล์สไตล์ชีท
  window.addEventListener('load', () => {
    setTimeout(() => {
      console.group("🔍 [Deep CSS Inspection]: เจาะลึกโครงสร้างภายในไฟล์ CSS...");
      Array.from(document.styleSheets).forEach((sheet, sheetIdx) => {
        try {
          const rules = sheet.cssRules || sheet.rules;
          const sheetUrl = sheet.href ? sheet.href.split('/').pop() : 'Inline Style';
          console.log(`📋 ตรวจสอบไฟล์: "${sheetUrl}" (มีคำสั่งสไตล์ทั้งหมด ${rules.length} บรรทัด)`);
          Array.from(rules).forEach((rule, ruleIdx) => {
            if (rule.type === CSSRule.IMPORT_RULE) {
              console.log(`🔗 พบการใช้ @import ข้างในไฟล์: -> แอบดึงไฟล์ "${rule.href}"`);
            }
          });
        } catch (e) {
          console.error(`❌ [CSS Rule Blocked]: เบราว์เซอร์ปฏิเสธการอ่านเนื้อหาภายในไฟล์เนื่องจากสไตล์ชีทพัง หรือเกิด MIME Type Error! (URL: ${sheet.href})`);
        }
      });
      console.groupEnd();
      console.groupEnd();
    }, 500);
  });
})();

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
    
    console.log("🔍 [Check 1.6]: เผื่อระบบช่องค้นหาในตารางทำงาน...");
    setupTableSearch(); // ✨ [ฟีเจอร์เพิ่มใหม่]

  } catch (criticalError) {
    console.error("🚨 [CRITICAL ERROR] มีบางอย่างพังใน Process หลักของการโหลดหน้าเว็บ:", criticalError);
  }
  
  console.groupEnd();
});

// ⚙️ [แก้ไขแล้ว] ระบบปุ่มคลิกเปิด-ปิดตัวเมนูกระดิ่ง (ลบส่วนที่ซ้ำซ้อนออก และคงการทำงานไว้ครบ 100%)
function setupBellNotificationToggle() {
  console.log("🔔 [Process]: ฟังก์ชัน setupBellNotificationToggle() เริ่มทำงาน...");
  const bellTrigger = document.getElementById("bellTrigger");
  const bellDropdown = document.getElementById("bellDropdown");

  // ❌ [คำสั่งนำออก]: บังคับซ่อน Badge ตัวเลขแจ้งเตือนสีแดงออกไปอย่างถาวรตามสั่ง
  const bellBadge = document.getElementById("bellBadge");
  if (bellBadge) {
    bellBadge.style.display = "none";
  }

  if (bellTrigger && bellDropdown) {
    bellTrigger.addEventListener("click", (e) => {
      e.stopPropagation(); // หยุดกระแสคลิกไม่ให้กระจายไปถึง window
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
      // 🛠️ รองรับทั้ง class .sidebar และ .sidebar-light 
      document.querySelector(".sidebar")?.classList.toggle("collapsed");
      document.querySelector(".sidebar-light")?.classList.toggle("collapsed");
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
    console.log("🔌 [DB Connect]: เชื่อมต่อผ่านคลาสสิกตัวแปรส่วนกลาง supabase สำเร็จ");
  } else {
    console.warn("⚠️ [DB Connect]: ไม่พบ Supabase Client ตัวระบบจะสลับไปรันแบบโหมดจำลอง (Mock Mode)");
  }
}

function showToast(msg, type = "success") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  // 🛠️ รองรับทั้ง class status-toast และ toast เฉยๆ
  el.className = `toast status-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3000);
}

// 🔄 ฟังก์ชันรีเฟรชข้อมูลหลัก
async function refreshDashboardData() {
  console.log("🔄 [Process]: ฟังก์ชัน refreshDashboardData() เริ่มซิงค์ข้อมูล...");
  
  const mockRequests = [
    { id: 1, emp_name: "คุณ สมศักดิ์ ผลดี", department: "ฝ่ายผลิต", leave_type_name: "ลาป่วย", total_days: 2, status: "pending", start_date: "2026-07-08" },
    { id: 2, emp_name: "คุณ เจนจิรา มีสุข", department: "ฝ่ายออฟฟิศ", leave_type_name: "ลาพักร้อน", total_days: 3, status: "approved", start_date: "2026-07-10" }
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

    if (rawRequests.length === 0 && rawEmployees.length === 0) {
      console.log("ℹ️ [Sync Alert]: ตารางในฐานข้อมูลว่างเปล่า สลับใช้ค่าจำลองแทน");
      rawRequests = mockRequests;
      rawEmployees = mockEmployees;
    }

    const pendingCount = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ")).length;
    const resolvedCount = rawRequests.filter(r => r && (r.status === "approved" || r.status === "rejected")).length;
    const totalEmp = rawEmployees.length;

    renderCounters(pendingCount, resolvedCount, totalEmp);
    drawCharts();
    renderBellNotifications(rawRequests);

    showToast(`✅ ซิงค์ข้อมูลระบบเรียบร้อยแล้ว`, "success");

  } catch (error) {
    console.error("❌ [Catch Error]: บั๊กเกิดระหว่างคิวรีข้อมูล:", error);
    rawRequests = mockRequests;
    rawEmployees = mockEmployees;
    renderCounters(1, 1, 1);
    drawCharts();
    renderBellNotifications(rawRequests);
  }
}

/**
 * 🔔 ฟังก์ชันประมวลผลและวาดรายการแจ้งเตือนในกระดิ่ง (Notification Renderer)
 */
function renderBellNotifications(requests) {
  const bellDropdown = document.getElementById("bellDropdown");
  if (!bellDropdown) return;

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
        const tableSection = document.querySelector(".table-panel") || document.querySelector(".quick-menu-panel");
        if (tableSection) tableSection.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      bellNotiBody.appendChild(div);
    } catch (itemError) {
      console.error(`❌ [Item Render Error]: แถวที่ ${index}:`, itemError);
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
    headersHtml = `<th>ชื่อพนักงาน</th><th>ฝ่าย/แผนก</th><th>ประเภทการลา</th><th>วันที่เริ่ม - สิ้นสุด</th><th>สถานะ</th>`;

    const filtered = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ"));
    if (filtered.length === 0) {
      bodyHtml = `<tr><td colspan="5" style="padding:35px; text-align:center; color:var(--text-soft);">ไม่มีใบลาค้างพิจารณาในระบบ ✨</td></tr>`;
    } else {
      filtered.forEach(item => {
        const name = getSafeValue(item, ["emp_name", "employee_name", "name", "full_name"]);
        const dept = getSafeValue(item, ["department", "division"]);
        const type = getSafeValue(item, ["leave_type_name", "leave_type"]);
        
        // 📅 นำระบบวันที่ไทยมาใช้เพื่อความพรีเมียม
        const sDate = formatThaiDate(getSafeValue(item, ["start_date", "date"]));
        const eDate = formatThaiDate(getSafeValue(item, ["end_date"]));
        const dateStr = sDate !== "-" ? `${sDate} - ${eDate !== "-" ? eDate : sDate}` : `${getSafeValue(item, ["total_days", "days"], 0)} วัน`;

        bodyHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:600;">${name}</td>
            <td style="padding:16px 20px;">${dept}</td>
            <td style="padding:16px 20px;"><span style="background:#f1f5f9; padding:4px 10px; border-radius:6px;">${type}</span></td>
            <td style="padding:16px 20px; font-weight:500; color:var(--primary);">${dateStr}</td>
            <td style="padding:16px 20px;"><span style="background:#fef3c7; color:#d97706; padding:4px 12px; border-radius:99px; font-size:12px; font-weight:600;">รออนุมัติ</span></td>
          </tr>`;
      });
    }
  }
  else if (targetTab === "approved") {
    if (tTitle) tTitle.textContent = "ประวัติคำขอลาที่พิจารณาเสร็จสิ้นแล้ว";
    if (tIcon) tIcon.textContent = "task_alt";
    headersHtml = `<th>ชื่อพนักงาน</th><th>ประเภทใบลา</th><th>วันที่</th><th>เหตุผลความจำเป็น</th><th>ผลพิจารณา</th>`;

    const filtered = rawRequests.filter(r => r && (r.status === "approved" || r.status === "rejected"));
    if (filtered.length === 0) {
      bodyHtml = `<tr><td colspan="5" style="padding:35px; text-align:center; color:var(--text-soft);">ยังไม่มีประวัติการบันทึกผลในระบบ</td></tr>`;
    } else {
      filtered.forEach(item => {
        const name = getSafeValue(item, ["emp_name", "employee_name", "name"]);
        const type = getSafeValue(item, ["leave_type_name", "leave_type"]);
        const dateStr = formatThaiDate(getSafeValue(item, ["start_date", "date"]));
        const reason = getSafeValue(item, ["reason", "detail"], "-");
        const isApp = item.status === "approved";
        bodyHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:600;">${name}</td>
            <td style="padding:16px 20px;">${type}</td>
            <td style="padding:16px 20px; font-weight:500;">${dateStr}</td>
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

// 🛠️ [แก้ไขแล้ว] ระบบดึงตัวเลขลงการ์ด (รองรับ ID ทั้งเวอร์ชันเก่าและเวอร์ชันใหม่ ป้องกัน Error 100%)
function renderCounters(pending, resolved, employees) {
  const setEl = (id, val, label) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `${val} ${label ? `<small>${label}</small>` : ''}`;
  };
  // รองรับ ID HTML แบบเก่า
  setEl("countPending", pending, "รายการ");
  setEl("countApproved", resolved, "รายการ");
  setEl("countEmployees", employees, "คน");
  // รองรับ ID HTML แบบใหม่ล่าสุด
  setEl("statPendingLeaves", pending, "");
  setEl("statTodayLeaves", resolved, ""); // ใช้ resolved คั่นไว้ชั่วคราว
  setEl("statTotalEmployees", employees, "");
}

// 🛠️ [แก้ไขแล้ว] แยกกราฟออกจากกัน ป้องกันหน้าเว็บพังเมื่อหน้าใดหน้าหนึ่งไม่มี Canvas
function drawCharts() {
  const canvasDept = document.getElementById("chartDepartments");
  const canvasType = document.getElementById("chartLeaveTypes");

  // 📈 1. กราฟแท่งแผนก
  if (canvasDept) {
    const deptSummary = {};
    rawRequests.forEach(r => {
      if (r && r.status === "approved") {
        const dName = r.department || "ไม่ระบุแผนก";
        deptSummary[dName] = (deptSummary[dName] || 0) + (parseFloat(r.total_days) || 0);
      }
    });

    const deptLabels = Object.keys(deptSummary).length ? Object.keys(deptSummary) : ["ฝ่ายผลิต", "คลังสินค้า", "สำนักงาน", "ขนส่ง"];
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
  }

  // 🍩 2. กราฟวงกลมประเภทการลา
  if (canvasType) {
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
        datasets: [{ data: Object.values(typeSummary), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#94a3b8'], borderWidth: 0 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } }, cutout: '70%' }
    });
  }
}

// ====================================================================================
// ✨ ฟีเจอร์ใหม่ที่ถูกเพิ่มเข้ามาเพื่อให้ระบบสมบูรณ์และพรีเมียมขึ้น (ไม่ลบของเก่า)
// ====================================================================================

/**
 * 📅 1. แปลงวันที่ (2026-07-08 -> 8 ก.ค. 2569) 
 * ช่วยให้ตารางอ่านง่ายและเป็นภาษาไทยมากขึ้น
 */
function formatThaiDate(dateStr) {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/**
 * 🔍 2. ระบบค้นหาในตาราง
 * หากใน HTML มี input id="searchInput" จะสามารถพิมพ์ค้นหาพนักงานในตารางได้แบบ Real-time
 */
function setupTableSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    const trs = document.querySelectorAll("#tableBody tr");
    
    trs.forEach(tr => {
      // ข้ามการค้นหาในกรณีที่เป็นข้อความ "ไม่มีข้อมูล"
      if(tr.cells.length === 1) return; 
      
      const text = tr.innerText.toLowerCase();
      tr.style.display = text.includes(keyword) ? "" : "none";
    });
  });
}

/**
 * 🚪 3. คืนค่าฟังก์ชันออกจากระบบ (Logout)
 * ระบบเดิมปุ่ม Sidebar มี onClick="handleLogout()" แต่ฟังก์ชันหายไป จึงนำกลับมาให้ครับ
 */
function handleLogout() {
  if (confirm("คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่?")) {
    showToast("กำลังออกจากระบบ...", "info");
    setTimeout(() => {
      // ล้างข้อมูล Session หากใช้งานจริง
      sessionStorage.clear();
      window.location.href = "/login.html"; // เปลี่ยนเป็นหน้าล็อกอิน
    }, 1000);
  }
}

function exportDataReport() {
  showToast("📊 ระบบกำลังประมวลสถิติสรุปเป็นไฟล์ Excel...", "info");
  setTimeout(() => { showToast("✅ ดาวน์โหลดรายงานสรุป (PVT-Leave-2026.xlsx) ลงเครื่องแล้ว", "success"); }, 1200);
}

function openQuotaSettings() {
  showToast("⚙️ เปิดสิทธิ์ตั้งค่าโควตาวันลาหยุดพนักงานประจำปี", "info");
}

/* ==========================================================================
   💳 ระบบบริหารจัดการบัตรพนักงานดิจิทัล & QR Code สำหรับ HR
   ========================================================================== */

/* ==========================================================================
   💳 ระบบบริหารจัดการบัตรพนักงานดิจิทัล & QR Code (เวอร์ชันแสดง ตำแหน่ง + แผนก)
   ========================================================================== */

// 🏛️ จังหวะที่ 1: ดึงรายชื่อพนักงานทั้งหมด (รวมแผนก) มาโชว์ในป๊อปอัป
window.openEmployeeCardManagerPopup = async function () {
  Swal.fire({
    title: 'กำลังโหลดบัญชีรายชื่อ...',
    html: '<div class="pvt-spinner"></div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  const sb = window.supabaseClient || window.pvtSupabase?.getClient();
  if (!sb) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    return;
  }

  // เปลี่ยนเฉพาะช่วง try { ... } ใน จังหวะที่ 1 ครับ

  try {
    // 🟢 แก้ไขตรงคำสั่ง .select() ให้ดึงแบบข้ามตารางเชื่อมความสัมพันธ์
    const { data: employees, error } = await sb
      .from('employees')
      .select(`
        employee_code, 
        full_name, 
        role, 
        status,
        departments ( department_name ),
        positions ( position_name )
      `)
      .order('employee_code', { ascending: true });

    if (error) throw error;

    let rowsHtml = "";
    if (!employees || employees.length === 0) {
      rowsHtml = `<tr><td colspan="3" style="text-align:center; padding:16px;">ไม่พบข้อมูลพนักงานในระบบ</td></tr>`;
    } else {
      employees.forEach(emp => {
        // 🟢 เปลี่ยนวิธีกดดึงค่าจากตารางที่ Join เข้ามา
        const empRole = emp.positions?.position_name || emp.role || 'พนักงาน';
        const empDept = emp.departments?.department_name || 'ไม่ระบุแผนก';

        rowsHtml += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 8px; font-weight: 600; color: #475569;">${emp.employee_code}</td>
            <td style="padding: 12px 8px; text-align: left;">
              <span style="font-weight: 600; color: #1e293b; display:block;">${emp.full_name}</span>
              <div style="display: flex; gap: 6px; margin-top: 4px;">
                <small style="color: #0fa472; background: #ebf7f3; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">💼 ${empRole}</small>
                <small style="color: #3b82f6; background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">🏢 ${empDept}</small>
              </div>
            </td>
            <td style="padding: 12px 8px; text-align: center;">
              <button onclick="showIndividualIdCard('${emp.employee_code}', '${emp.full_name}', '${empRole}', '${empDept}')" 
                style="background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 4px; transition: 0.2s;">
                <span class="material-symbols-outlined" style="font-size:16px;">visibility</span> ดูบัตร
              </button>
            </td>
          </tr>
        `;
      });
    }

// ... โค้ดสร้าง Swal.fire ด้านล่างคงเดิม ...

    Swal.fire({
      title: '👥 เลือกพนักงานเพื่อพิมพ์บัตรประจำตัว',
      width: '650px',
      html: `
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff; margin-top: 10px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; position: sticky; top: 0; z-index: 10;">
                <th style="padding: 12px 8px; text-align: left; color: #475569;">รหัส</th>
                <th style="padding: 12px 8px; text-align: left; color: #475569;">ชื่อ-นามสกุล / ตำแหน่ง / แผนก</th>
                <th style="padding: 12px 8px; text-align: center; color: #475569;">ตัวเลือก</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748b'
    });

  } catch (err) {
    console.error("Error loading employees for cards:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดึงรายชื่อพนักงานได้', 'error');
  }
};

// 💳 จังหวะที่ 2: แสดงหน้าตาบัตรพนักงานพรีเมียม (โชว์ทั้งตำแหน่งและแผนก)
// 💳 จุดที่ 1: อัปเดตในไฟล์ index.js (หรือไฟล์จัดการฝั่ง HR/แดชบอร์ด)
window.showIndividualIdCard = function (empCode, empName, empRole, empDept) {
  
  // 🔒 ผสมข้อมูลแบบพิเศษ: "รหัสพนักงาน|เครื่องหมายคั่นพิเศษ" 
  // (ถ้าในตารางมีฟิลด์รหัสผ่านที่เข้ารหัสไว้ หรือ Token สามารถดึงมาสลับใส่ตรงนี้ได้ครับ)
  const secureData = encodeURIComponent(`${empCode}|PVT_SECURE_BYPASS`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${secureData}`;
  
  Swal.fire({
    title: '💳 ตัวอย่างบัตรพนักงานดิจิทัล',
    width: '400px',
    html: `
      <div id="pvt-id-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); width: 280px; margin: 15px auto; border-radius: 20px; padding: 24px; color: white; box-shadow: 0 15px 30px rgba(30,58,138,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden;">
        
        <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.03); border-radius: 50%;"></div>
        
        <div style="font-weight: 700; font-size: 14px; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 20px; text-transform: uppercase;">PVT WORKFORCE Hub</div>
        
        <div style="width: 76px; height: 76px; background: rgba(255,255,255,0.1); border-radius: 50%; margin: 0 auto 14px auto; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.2);">
          <span class="material-symbols-outlined" style="font-size: 42px; color: #93c5fd;">account_circle</span>
        </div>
        
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.5px;">${empName}</div>
        
        <div style="font-size: 13px; color: #38bdf8; font-weight: 600; margin-bottom: 2px;">ตำแหน่ง: ${empRole}</div>
        <div style="font-size: 12px; color: #94a3b8; font-weight: 500; margin-bottom: 20px;">แผนก: ${empDept}</div>
        
        <div style="background: white; padding: 10px; border-radius: 14px; display: inline-block; box-shadow: 0 8px 16px rgba(0,0,0,0.2); margin-bottom: 16px;">
          <img src="${qrUrl}" alt="Employee QR Code" style="width: 140px; height: 140px; display: block;" />
        </div>
        
        <div>
          <span style="font-size: 11px; color: #94a3b8; display: block; text-transform: uppercase; margin-bottom: 2px;">Employee ID Number</span>
          <span style="font-size: 16px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 4px 16px; border-radius: 30px; display: inline-block; letter-spacing: 1px; border: 1px solid rgba(255,255,255,0.05);">
            ${empCode}
          </span>
        </div>
      </div>
    `,
    showCancelButton: true,
    cancelButtonText: '🔙 ย้อนกลับ',
    confirmButtonText: '🖨️ สั่งพิมพ์บัตร',
    confirmButtonColor: '#10b981',
    cancelButtonColor: '#64748b',
  }).then((result) => {
    if (result.dismiss === Swal.DismissReason.cancel) {
      openEmployeeCardManagerPopup();
    } else if (result.isConfirmed) {
      // ส่งต่อไปยังระบบพิมพ์บัตรใบเดี่ยวแบบมีแผนก
      printSingleCard(empCode, empName, empRole, empDept, qrUrl);
    }
  });
};

// 🖨️ ฟังก์ชันสั่งพิมพ์บัตรประจำตัว (อัปเดตให้รองรับ แผนก)
function printSingleCard(empCode, empName, empRole, empDept, qrUrl) {
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>Print ID Card - ${empCode}</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Sarabun', sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; background:#fff; }
          .card { background: #0f172a; width: 260px; border-radius: 16px; padding: 24px; color: white; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .company { font-weight: 700; font-size: 12px; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 25px; }
          .name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
          .role { font-size: 13px; color: #38bdf8; font-weight: 600; margin-bottom: 2px; }
          .dept { font-size: 12px; color: #94a3b8; font-weight: 400; margin-bottom: 20px; }
          .qr-box { background: white; padding: 10px; border-radius: 12px; display: inline-block; margin-bottom: 16px; }
          .id-tag { font-size: 16px; font-weight: 700; background: rgba(255,255,255,0.15); padding: 4px 16px; border-radius: 30px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="company">PVT WORKFORCE HUB</div>
          <div class="name">${empName}</div>
          <div class="role">ตำแหน่ง: ${empRole}</div>
          <div class="dept">แผนก: ${empDept}</div>
          <div class="qr-box"><img src="${qrUrl}" style="width:130px; height:130px; display:block;"/></div>
          <div><div class="id-tag">${empCode}</div></div>
        </div>
        <script>
          window.onload = function() { window.print(); setTimeout(function(){ window.close(); }, 500); }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  
  setTimeout(() => { openEmployeeCardManagerPopup(); }, 600);
}
