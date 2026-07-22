/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - DASHBOARD CORE SYSTEM (ENHANCED CHARTS & METRICS)
 * ==========================================================================
 */

/* ==========================================================================
   1. 🎨 CSS INSPECTION GUARDIAN
   ========================================================================== */
(function () {
  console.group("🎨 [CSS Verification Timeline]: เริ่มต้นตรวจสอบสไตล์ชีท...");

  const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
  if (cssLinks.length === 0) {
    console.warn("⚠️ [CSS Warning]: ไม่พบแท็กผูก CSS (<link rel='stylesheet'>) ในหน้า HTML นี้เลย!");
  }

  cssLinks.forEach((link, index) => {
    const url = link.getAttribute('href');
    link.addEventListener('load', () => {
      console.log(`✅ [CSS Loaded] [ตัวที่ ${index + 1}]: โหลดสำเร็จ -> "${url}"`);
    });
    link.addEventListener('error', () => {
      console.error(`🚨 [CSS CRITICAL ERROR] [ตัวที่ ${index + 1}]: ไม่สามารถโหลดไฟล์นี้ได้! -> "${url}"`);
    });
  });

  window.addEventListener('load', () => {
    setTimeout(() => {
      console.group("🔍 [Deep CSS Inspection]: เจาะลึกโครงสร้างภายในไฟล์ CSS...");
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const rules = sheet.cssRules || sheet.rules;
          const sheetUrl = sheet.href ? sheet.href.split('/').pop() : 'Inline Style';
          console.log(`📋 ตรวจสอบไฟล์: "${sheetUrl}" (มีคำสั่งสไตล์ทั้งหมด ${rules.length} บรรทัด)`);
        } catch (e) {
          console.error(`❌ [CSS Rule Blocked]: เบราว์เซอร์ปฏิเสธการอ่านเนื้อหา (URL: ${sheet.href})`);
        }
      });
      console.groupEnd();
      console.groupEnd();
    }, 500);
  });
})();

/* ==========================================================================
   2. ⚙️ GLOBAL STATE VARIABLES
   ========================================================================== */
let sb = null;
let rawRequests = [];
let rawEmployees = [];
let chartDeptInstance = null;
let chartTypeInstance = null;
let currentTabState = "pending";
let toastTimer = null;

/* ==========================================================================
   3. 🚀 INITIALIZATION & EVENT LISTENERS
   ========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  console.group("🚀 [Timeline Step 1]: เริ่มต้นโหลดระบบ Dashboard Core");
  
  try {
    setupSidebarToggle();
    initializeSupabaseConnection();
    setupBellNotificationToggle();

    await refreshDashboardData();
    
    switchTab(currentTabState);
    setupTableSearch();

  } catch (criticalError) {
    console.error("🚨 [CRITICAL ERROR] เกิดข้อผิดพลาดใน Process หลัก:", criticalError);
  }
  
  console.groupEnd();
});

function initializeSupabaseConnection() {
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === "function") {
    sb = window.pvtSupabase.getClient();
    console.log("🔌 [DB Connect]: เชื่อมต่อผ่าน window.pvtSupabase สำเร็จ");
  } else if (typeof window.supabaseClient !== "undefined") {
    sb = window.supabaseClient;
    console.log("🔌 [DB Connect]: เชื่อมต่อผ่าน window.supabaseClient สำเร็จ");
  } else if (typeof supabase !== "undefined") {
    sb = supabase;
    console.log("🔌 [DB Connect]: เชื่อมต่อผ่านตัวแปรส่วนกลาง supabase สำเร็จ");
  } else {
    console.warn("⚠️ [DB Connect]: ไม่พบ Supabase Client สลับใช้ Mock Mode");
  }
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("toggleSidebar");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.querySelector(".sidebar")?.classList.toggle("collapsed");
      document.querySelector(".sidebar-light")?.classList.toggle("collapsed");
      document.querySelector(".main-content")?.classList.toggle("expanded");
    });
  }
}

function setupBellNotificationToggle() {
  const bellTrigger = document.getElementById("bellTrigger");
  const bellDropdown = document.getElementById("bellDropdown");
  const bellBadge = document.getElementById("bellBadge");
  
  if (bellBadge) bellBadge.style.display = "none";

  if (bellTrigger && bellDropdown) {
    bellTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      bellDropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (bellDropdown.classList.contains("active")) {
        if (!bellDropdown.contains(e.target) && e.target !== bellTrigger && !bellTrigger.contains(e.target)) {
          bellDropdown.classList.remove("active");
        }
      }
    });
  }
}

/* ==========================================================================
   4. 🔄 DATA SYNC & FETCHING
   ========================================================================== */
window.refreshDashboardData = async function() {
  console.log("🔄 [Process]: ฟังก์ชัน refreshDashboardData() เริ่มซิงค์ข้อมูล...");
  
  const mockRequests = [
    { id: 1, emp_name: "คุณ สมศักดิ์ ผลดี", department: "ฝ่ายผลิต", leave_type_name: "ลาป่วย", total_days: 2, status: "pending", start_date: "2026-07-08", end_date: "2026-07-09", reason: "ไข้ขึ้นสูง" },
    { id: 2, emp_name: "คุณ เจนจิรา มีสุข", department: "ฝ่ายออฟฟิศ", leave_type_name: "ลาพักร้อน", total_days: 3, status: "approved", start_date: "2026-07-10", end_date: "2026-07-12", reason: "พักผ่อนประจำปี" },
    { id: 3, emp_name: "คุณ วิชัย ใจดี", department: "ฝ่ายการตลาด", leave_type_name: "ลากิจ", total_days: 1, status: "approved", start_date: "2026-07-15", end_date: "2026-07-15", reason: "ทำธุระที่ธนาคาร" }
  ];
  const mockEmployees = [{ emp_code: "PVT-001", first_name: "สมศักดิ์", last_name: "ผลดี", full_name: "สมศักดิ์ ผลดี", department: "ฝ่ายผลิต" }];

  if (!sb) {
    rawRequests = mockRequests;
    rawEmployees = mockEmployees;
    renderCounters(1, 1, 1);
    drawCharts();
    renderBellNotifications(rawRequests);
    return;
  }

  try {
    const [resRequests, resEmployees] = await Promise.all([
      sb.from("leave_requests").select("*, employees!leave_requests_employee_id_fkey(*, departments(department_name)), leave_types(*)"),
      sb.from("employees").select("*, departments(department_name)")
    ]);

    if (resRequests.error) console.error("❌ Supabase Request Error:", resRequests.error);
    if (resEmployees.error) console.error("❌ Supabase Employees Error:", resEmployees.error);

    rawRequests = resRequests.data || [];
    rawEmployees = resEmployees.data || [];

    if (rawRequests.length === 0 && rawEmployees.length === 0) {
      rawRequests = mockRequests;
      rawEmployees = mockEmployees;
    }

    const pendingCount = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ")).length;
    
    // คำนวณยอดลาวันนี้
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLeavesCount = rawRequests.filter(r => {
      const isApproved = (r.status === "approved" || r.status === "อนุมัติ");
      const inRange = r.start_date && r.end_date && (todayStr >= r.start_date && todayStr <= r.end_date);
      return isApproved && inRange;
    }).length;

    const totalEmp = rawEmployees.length;

    renderCounters(pendingCount, todayLeavesCount, totalEmp);
    drawCharts();
    renderBellNotifications(rawRequests);

    showToast(`✅ ซิงค์ข้อมูลระบบเรียบร้อยแล้ว`, "success");

  } catch (error) {
    console.error("❌ [Catch Error]: เกิดข้อผิดพลาดระหว่างคิวรีข้อมูล:", error);
    rawRequests = mockRequests;
    rawEmployees = mockEmployees;
    renderCounters(1, 1, 1);
    drawCharts();
    renderBellNotifications(rawRequests);
  }
};

/* ==========================================================================
   5. 📊 CHARTS & TOP LEAVE TAKERS (CHART.JS INTEGRATION)
   ========================================================================== */
// ==========================================
// 📊 ฟังก์ชันวาดกราฟสัดส่วนการลา (ฉบับแก้ไข Layout & Text Overlap)
// ==========================================
function drawCharts() {
  if (typeof Chart === "undefined") return;

  const canvasType = document.getElementById("chartLeaveTypes");
  const canvasDept = document.getElementById("chartDepartments");

  const approvedRequests = rawRequests.filter(r => r && (r.status === "approved" || r.status === "อนุมัติ"));
  const activeDataset = approvedRequests.length > 0 ? approvedRequests : rawRequests;

  // 🍩 1. Donut Chart: สัดส่วนประเภทการลา
  if (canvasType) {
    const typeSummary = {};
    let totalCount = 0;

    rawRequests.forEach(r => {
      if (!r) return;
      const typeName = r.leave_types?.leave_name || r.leave_type_name || "อื่น ๆ";
      typeSummary[typeName] = (typeSummary[typeName] || 0) + 1;
      totalCount++;
    });

    // 1️⃣ อัปเดตตัวเลขรวมบนหัวข้อการ์ด และตรงกลางกราฟ
    const headerTotalEl = document.getElementById("leaveTypeTotalHeader");
    if (headerTotalEl) headerTotalEl.textContent = `(รวม ${totalCount} รายการ)`;

    const centerTotalEl = document.getElementById("leaveTypeTotalCenter");
    if (centerTotalEl) centerTotalEl.textContent = totalCount;

    const typeLabels = Object.keys(typeSummary);
    const typeValues = Object.values(typeSummary);
    const colorPalette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

    if (chartTypeInstance) chartTypeInstance.destroy();

    chartTypeInstance = new Chart(canvasType.getContext("2d"), {
      type: 'doughnut',
      data: {
        labels: typeLabels.length ? typeLabels : ["ไม่มีข้อมูล"],
        datasets: [{
          data: typeValues.length ? typeValues : [1],
          backgroundColor: typeValues.length ? colorPalette.slice(0, typeLabels.length) : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          // 2️⃣ ปิด Legend ใน Canvas เพื่อป้องกันข้อความซ้อนและตัวอักษรโดนตัด
          legend: {
            display: false
          },
          tooltip: {
            enabled: typeValues.length > 0,
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val} รายการ (${pct}%)`;
              }
            }
          }
        },
        cutout: '72%' // ขยายช่องว่างตรงกลางป้องกันตัวเลขเกยขอบ
      }
    });

    // 3️⃣ แสดงรายการสัดส่วนพร้อม Progress Bar ด้านขวา (แทนที่ข้อความ "กำลังโหลด...")
    renderLeaveBreakdownList(typeSummary, totalCount, colorPalette);
  }

  // 📊 2. Bar Chart: วันลาแยกตามแผนก
  if (canvasDept) {
    const deptSummary = {};

    activeDataset.forEach(r => {
      const deptName = r.employees?.departments?.department_name || r.department || "ไม่ระบุแผนก";
      const days = parseFloat(r.total_days || r.days || 1);
      deptSummary[deptName] = (deptSummary[deptName] || 0) + days;
    });

    const deptLabels = Object.keys(deptSummary).length ? Object.keys(deptSummary) : ["ไม่มีข้อมูล"];
    const deptValues = Object.keys(deptSummary).length ? Object.values(deptSummary) : [0];

    if (chartDeptInstance) chartDeptInstance.destroy();
    chartDeptInstance = new Chart(canvasDept.getContext("2d"), {
      type: 'bar',
      data: {
        labels: deptLabels,
        datasets: [{
          label: 'รวมวันลา (วัน)',
          data: deptValues,
          backgroundColor: '#0fa472',
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: '#0b845c'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` รวมวันลา: ${context.raw} วัน`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Sarabun', size: 12 } }
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              font: { family: 'Sarabun', size: 12 },
              callback: function(val) { return val + ' วัน'; }
            },
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  }

  // 🏆 3. ประมวลผลตารางพนักงานลาเยอะที่สุด
  renderTopLeaveEmployees(activeDataset);
}

// ==========================================
// 📝 ฟังก์ชันสร้าง Progress Bar สัดส่วนการลาด้านขวา
// ==========================================
function renderLeaveBreakdownList(typeSummary, totalCount, colors) {
  const detailsList = document.getElementById("leaveDetailsList") || document.querySelector(".details-list");
  if (!detailsList) return;

  const keys = Object.keys(typeSummary);

  if (keys.length === 0) {
    detailsList.innerHTML = `<div style="color:var(--text-soft); font-size:14px; text-align:center; padding:20px;">ไม่มีข้อมูลประวัติการลา</div>`;
    return;
  }

  let html = "";
  keys.forEach((key, index) => {
    const count = typeSummary[key];
    const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
    const color = colors[index % colors.length];

    html += `
      <div class="detail-item">
        <div class="item-info">
          <span class="badge-dot" style="background-color: ${color};"></span>
          <span class="item-name">${key}</span>
          <span class="item-val">${count} รายการ</span>
          <span class="item-pct" style="color: ${color};">${pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="fill" style="width: ${pct}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  });

  detailsList.innerHTML = html;
}

function renderTopLeaveEmployees(approvedRequests) {
  const tbody = document.getElementById("topLeaveEmployeesTable");
  if (!tbody) return;

  if (!approvedRequests || approvedRequests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--text-soft);">ไม่มีข้อมูลประวัติการลาที่อนุมัติ</td></tr>`;
    return;
  }

  const empMap = {};

  approvedRequests.forEach(r => {
    const empId = r.employee_id || r.employees?.employee_code || r.emp_name || "Unknown";
    const empName = r.employees?.full_name || r.employees?.first_name || r.emp_name || "ไม่ระบุชื่อ";
    const deptName = r.employees?.departments?.department_name || r.department || "-";
    const days = parseFloat(r.total_days || r.days || 1);

    if (!empMap[empId]) {
      empMap[empId] = { name: empName, dept: deptName, count: 0, totalDays: 0 };
    }
    empMap[empId].count += 1;
    empMap[empId].totalDays += days;
  });

  const sortedEmployees = Object.values(empMap)
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 5);

  let html = "";
  sortedEmployees.forEach((emp, index) => {
    let rankBadge = `<span style="font-weight:700; color:#64748b;">${index + 1}</span>`;
    if (index === 0) rankBadge = `<span style="font-size:16px;">🥇</span>`;
    if (index === 1) rankBadge = `<span style="font-size:16px;">🥈</span>`;
    if (index === 2) rankBadge = `<span style="font-size:16px;">🥉</span>`;

    html += `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="text-align: center; padding: 12px 8px;">${rankBadge}</td>
        <td style="padding: 12px 8px; font-weight: 600;">${emp.name}</td>
        <td style="padding: 12px 8px; color: var(--text-soft);">${emp.dept}</td>
        <td style="text-align: center; padding: 12px 8px;"><span style="background:#f1f5f9; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:600;">${emp.count} ครั้ง</span></td>
        <td style="text-align: right; padding: 12px 8px; font-weight: 700; color: #ef4444;">${emp.totalDays} วัน</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/* ==========================================================================
   6. 📋 TABLE DATA & TAB SWITCHING
   ========================================================================== */
window.switchTab = function(targetTab) {
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
        const safeEmp = item.employees || {};
        const safeType = item.leave_types || {};

        const name = safeEmp.full_name || safeEmp.name || getSafeValue(item, ["emp_name", "employee_name", "name"]);
        const type = safeType.leave_name || getSafeValue(item, ["leave_type_name", "leave_type"]);
        const dept = safeEmp.departments?.department_name || getSafeValue(item, ["department", "division"]);
        
        const sDate = formatThaiDate(getSafeValue(item, ["start_date", "date"]));
        const eDate = formatThaiDate(getSafeValue(item, ["end_date"]));
        const dateStr = sDate !== "-" ? `${sDate} - ${eDate !== "-" ? eDate : sDate}` : `${getSafeValue(item, ["total_days", "days"], 0)} วัน`;

        bodyHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:600;">${name}</td>
            <td style="padding:16px 20px;">${dept || "-"}</td>
            <td style="padding:16px 20px;"><span style="background:#f1f5f9; padding:4px 10px; border-radius:6px; font-size:13px;">${type || "-"}</span></td>
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

    const filtered = rawRequests.filter(r => r && (r.status === "approved" || r.status === "rejected" || r.status === "อนุมัติ"));
    if (filtered.length === 0) {
      bodyHtml = `<tr><td colspan="5" style="padding:35px; text-align:center; color:var(--text-soft);">ยังไม่มีประวัติการบันทึกผลในระบบ</td></tr>`;
    } else {
      filtered.forEach(item => {
        const safeEmp = item.employees || {};
        const safeType = item.leave_types || {};

        const name = safeEmp.full_name || safeEmp.name || getSafeValue(item, ["emp_name", "employee_name", "name"]);
        const type = safeType.leave_name || getSafeValue(item, ["leave_type_name", "leave_type"]);
        const dateStr = formatThaiDate(getSafeValue(item, ["start_date", "date"]));
        const reason = getSafeValue(item, ["reason", "detail"], "-");
        const isApp = item.status === "approved" || item.status === "อนุมัติ";
        
        bodyHtml += `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:600;">${name || "-"}</td>
            <td style="padding:16px 20px;">${type || "-"}</td>
            <td style="padding:16px 20px; font-weight:500;">${dateStr}</td>
            <td style="padding:16px 20px;">${reason}</td>
            <td style="padding:16px 20px;"><span style="background:${isApp?'#dcfce7':'#fee2e2'}; color:${isApp?'#15803d':'#b91c1c'}; padding:4px 12px; border-radius:99px; font-size:12px; font-weight:600;">${isApp?'อนุมัติแล้ว':'ปฏิเสธ'}</span></td>
          </tr>`;
      });
    }
  }

  tHeader.innerHTML = headersHtml;
  tBody.innerHTML = bodyHtml;
  setTimeout(() => { tBody.style.opacity = "1"; }, 20);
};

function renderCounters(pending, todayLeaves, employees) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl("statPendingLeaves", pending);
  setEl("statTodayLeaves", todayLeaves);
  setEl("statTotalEmployees", employees);
  
  setEl("countPending", pending);
  setEl("countApproved", todayLeaves);
  setEl("countEmployees", employees);
}

function setupTableSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const keyword = e.target.value.toLowerCase();
    const trs = document.querySelectorAll("#tableBody tr");
    
    trs.forEach(tr => {
      if (tr.cells.length === 1) return; 
      const text = tr.innerText.toLowerCase();
      tr.style.display = text.includes(keyword) ? "" : "none";
    });
  });
}

/* ==========================================================================
   🔔 RENDER BELL NOTIFICATIONS (FIX: SORT BY LATEST & SLICE)
   ========================================================================== */
function renderBellNotifications(requests) {
  const bellDropdown = document.getElementById("bellDropdown");
  if (!bellDropdown) return;

  const safeRequests = requests || [];

  // 1. กรองเฉพาะรายการที่รออนุมัติ
  let pendingReqs = safeRequests.filter(r => {
    if (!r) return false;
    const checkStatus = r.status || r.leave_status;
    return checkStatus === "pending" || checkStatus === "รออนุมัติ";
  });

  // ⚡ 2. [เพิ่มจุดนี้] เรียงลำดับจาก "ใหม่ล่าสุด -> เก่าสุด" (Descending Order)
  pendingReqs.sort((a, b) => {
    const dateA = new Date(a.created_at || a.created_date || a.start_date || a.id || 0);
    const dateB = new Date(b.created_at || b.created_date || b.start_date || b.id || 0);
    return dateB - dateA; // วันที่ล่าสุดจะขึ้นก่อนเสมอ
  });

  // ⚡ 3. [เพิ่มจุดนี้] ตัดเอาเฉพาะ 5 รายการล่าสุดมาแสดงใน Dropdown
  const latestReqs = pendingReqs.slice(0, 5);

  const bellBadge = document.getElementById("bellBadge");
  if (bellBadge) {
    if (pendingReqs.length > 0) {
      bellBadge.textContent = pendingReqs.length; // จำนวนค้างอนุมัติทั้งหมด
      bellBadge.style.display = "flex";
    } else {
      bellBadge.style.display = "none";
    }
  }

  bellDropdown.innerHTML = `
    <div class="bell-panel-header" style="padding:16px; border-bottom:1px solid var(--border);">
      <h4 style="font-size:15px; font-weight:700;">การแจ้งเตือนล่าสุด</h4>
      <span class="panel-subtitle" style="font-size:12px; color:var(--text-soft); display:block; margin-top:2px;">
        มีคำขอลาใหม่ทั้งหมด ${pendingReqs.length} รายการ
      </span>
    </div>
    <div class="bell-panel-body" id="bellNotiBody"></div>
  `;

  const bellNotiBody = document.getElementById("bellNotiBody");
  if (!bellNotiBody) return;

  if (latestReqs.length === 0) {
    bellNotiBody.innerHTML = `<div class="bell-empty-state" style="padding:24px; text-align:center; color:var(--text-soft); font-size:13px; font-style:italic;">ไม่มีรายการคำขอค้างพิจารณา</div>`;
    return;
  }

  // วนลูปเฉพาะ 5 รายการล่าสุด (latestReqs)
  latestReqs.forEach((r) => {
    const div = document.createElement("div");
    div.className = "bell-noti-item";
    div.style.cssText = "padding:12px 16px; border-bottom:1px solid var(--border); display:flex; gap:12px; cursor:pointer;";
    
    const empName = r.employees?.full_name || r.employees?.first_name || r.emp_name || "-";
    const leaveTypeName = r.leave_types?.leave_name || r.leave_type_name || "-";
    const duration = r.total_days || 1;

    div.innerHTML = `
      <div class="bell-noti-icon-box" style="color:var(--primary); display:flex; align-items:center;">
        <span class="material-symbols-outlined">pending_actions</span>
      </div>
      <div class="bell-noti-info">
        <div class="bell-noti-title" style="font-size:13px;"><strong>${empName}</strong> ยื่นคำขอ <strong>${leaveTypeName}</strong></div>
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
  });
}

/* ==========================================================================
   8. 💳 DIGITAL EMPLOYEE CARD & QR CODE MANAGER (WITH LIVE SEARCH)
   ========================================================================== */
window.openEmployeeCardManagerPopup = async function () {
  if (typeof Swal === "undefined") {
    alert("⚠️ ไม่พบลายบรารี SweetAlert2");
    return;
  }

  Swal.fire({
    title: 'กำลังโหลดบัญชีรายชื่อ...',
    html: '<div style="padding:20px; font-size:14px; color:#0fa472;">⌛ กรุณารอสักครู่กำลังดึงข้อมูล...</div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  const client = sb || window.pvtSupabase?.getClient();
  if (!client) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    return;
  }

  try {
    const { data: employees, error } = await client
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
      rowsHtml = `<tr><td colspan="3" style="text-align:center; padding:16px; color:#64748b;">ไม่พบข้อมูลพนักงานในระบบ</td></tr>`;
    } else {
      employees.forEach(emp => {
        const empRole = emp.positions?.position_name || emp.role || 'พนักงาน';
        const empDept = emp.departments?.department_name || 'ไม่ระบุแผนก';

        // ป้องกัน Error จากเครื่องหมาย ' ในชื่อ
        const safeName = (emp.full_name || '').replace(/'/g, "\\'");
        const safeRole = empRole.replace(/'/g, "\\'");
        const safeDept = empDept.replace(/'/g, "\\'");

        rowsHtml += `
          <tr class="emp-card-row" style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 8px; font-weight: 600; color: #475569;">${emp.employee_code}</td>
            <td style="padding: 12px 8px; text-align: left;">
              <span style="font-weight: 600; color: #1e293b; display:block;">${emp.full_name}</span>
              <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
                <small style="color: #0fa472; background: #ebf7f3; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">💼 ${empRole}</small>
                <small style="color: #3b82f6; background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">🏢 ${empDept}</small>
              </div>
            </td>
            <td style="padding: 12px 8px; text-align: center;">
              <button onclick="showIndividualIdCard('${emp.employee_code}', '${safeName}', '${safeRole}', '${safeDept}')" 
                style="background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size:16px;">visibility</span> ดูบัตร
              </button>
            </td>
          </tr>
        `;
      });
    }

    Swal.fire({
      title: '👥 เลือกพนักงานเพื่อพิมพ์บัตรประจำตัว',
      width: '680px',
      html: `
        <!-- 🔍 ช่องกรอกข้อมูลสำหรับค้นหา -->
        <div style="margin-bottom: 12px; text-align: left;">
          <input type="text" id="cardSearchInput" placeholder="🔍 พิมพ์รหัสพนักงาน, ชื่อ-สกุล, ตำแหน่ง หรือ แผนก เพื่อค้นหา..." 
            style="width: 100%; padding: 10px 14px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; box-sizing: border-box; font-family: inherit; transition: all 0.2s;"
            onfocus="this.style.borderColor='#0fa472'; this.style.boxShadow='0 0 0 3px rgba(15,164,114,0.15)'" 
            onblur="this.style.borderColor='#cbd5e1'; this.style.boxShadow='none'" />
        </div>

        <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; position: sticky; top: 0; z-index: 10;">
                <th style="padding: 12px 8px; text-align: left; color: #475569; width: 90px;">รหัส</th>
                <th style="padding: 12px 8px; text-align: left; color: #475569;">ชื่อ-นามสกุล / ตำแหน่ง / แผนก</th>
                <th style="padding: 12px 8px; text-align: center; color: #475569; width: 100px;">ตัวเลือก</th>
              </tr>
            </thead>
            <tbody id="employeeCardTableBody">
              ${rowsHtml}
            </tbody>
          </table>
          
          <!-- ข้อความกรณีค้นหาไม่พบ -->
          <div id="noMatchCardMessage" style="display: none; padding: 24px; text-align: center; color: #64748b; font-size: 14px;">
            ❌ ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา
          </div>
        </div>
      `,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748b',
      didOpen: () => {
        // ⚡ ระบบ Real-time Search Event Listener
        const searchInput = document.getElementById("cardSearchInput");
        const tableBody = document.getElementById("employeeCardTableBody");
        const noMatchMsg = document.getElementById("noMatchCardMessage");

        if (searchInput && tableBody) {
          // โฟกัสไปที่ช่องค้นหาอัตโนมัติเมื่อเปิด Popup
          searchInput.focus();

          searchInput.addEventListener("input", (e) => {
            const keyword = e.target.value.trim().toLowerCase();
            const rows = tableBody.querySelectorAll(".emp-card-row");
            let visibleCount = 0;

            rows.forEach(row => {
              const text = row.innerText.toLowerCase();
              if (text.includes(keyword)) {
                row.style.display = "";
                visibleCount++;
              } else {
                row.style.display = "none";
              }
            });

            // แสดงข้อความเตือนถ้าค้นหาไม่พบรายการใดๆ
            if (noMatchMsg) {
              noMatchMsg.style.display = (visibleCount === 0 && rows.length > 0) ? "block" : "none";
            }
          });
        }
      }
    });

  } catch (err) {
    console.error("Error loading employees for cards:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดึงรายชื่อพนักงานได้', 'error');
  }
};

window.showIndividualIdCard = function (empCode, empName, empRole, empDept) {
  const secureData = encodeURIComponent(`${empCode}|PVT_SECURE_BYPASS`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${secureData}`;
  
  Swal.fire({
    title: '💳 ตัวอย่างบัตรพนักงานดิจิทัล',
    width: '400px',
    html: `
      <div id="pvt-id-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); width: 280px; margin: 15px auto; border-radius: 20px; padding: 24px; color: white; box-shadow: 0 15px 30px rgba(30,58,138,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden;">
        
        <div style="font-weight: 700; font-size: 14px; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 20px; text-transform: uppercase;">PVT WORKFORCE HUB</div>
        
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
      printSingleCard(empCode, empName, empRole, empDept, qrUrl);
    }
  });
};

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

/* ==========================================================================
   9. 🛠️ UTILITY & HELPERS
   ========================================================================== */
function getSafeValue(item, possibleKeys, defaultValue = "-") {
  if (!item) return defaultValue;
  for (let key of possibleKeys) {
    if (item[key] !== undefined && item[key] !== null) return item[key];
  }
  return defaultValue;
}

function formatThaiDate(dateStr) {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function showToast(msg, type = "success") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast status-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3000);
}

window.handleLogout = function() {
  if (confirm("คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่?")) {
    showToast("กำลังออกจากระบบ...", "info");
    setTimeout(() => {
      sessionStorage.clear();
      window.location.href = "/index.html";
    }, 1000);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const bellBtn = document.getElementById("notifBellBtn");
  const dropdown = document.getElementById("notifDropdown");

  if (!bellBtn || !dropdown) return;

  // 1. สลับ เปิด/ปิด Dropdown เมื่อกดปุ่มกระดิ่ง
  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("show");
  });

  // 2. ปิด Dropdown อัตโนมัติเมื่อคลิกที่อื่นบนหน้าจอ
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
      dropdown.classList.remove("show");
    }
  });
});

/* ==========================================================================
   🛠️ HELPER FUNCTIONS (เชื่อมต่อกับฟังก์ชันแจ้งเตือนของคุณ)
   ========================================================================== */

// กดเพื่อทำเครื่องหมายอ่านแล้วทั้งหมด
function markAllNotificationsAsRead() {
  const unreadItems = document.querySelectorAll(".notif-item.unread");
  unreadItems.forEach(item => {
    item.classList.remove("unread");
    const dot = item.querySelector(".unread-dot");
    if (dot) dot.remove();
  });

  // อัปเดต UI Badge
  const badge = document.getElementById("notifBadge");
  const unreadPill = document.getElementById("notifUnreadCount");
  
  if (badge) badge.style.display = "none";
  if (unreadPill) unreadPill.textContent = "0 รายการใหม่";

  // TODO: เรียกใช้ฟังก์ชัน Backend ของคุณตรงนี้ เช่น
  // await api.markAllRead();
}

// เมื่อกดคลิกที่รายการแจ้งเตือนแต่ละอัน
function handleNotifClick(notifId, redirectUrl) {
  console.log("Notification Clicked ID:", notifId);
  
  // TODO: ส่งค่าไปอัปเดตสถานะใน Backend ของคุณว่าอ่านรายการนี้แล้ว
  // await api.markAsRead(notifId);

  if (redirectUrl) {
    window.location.href = redirectUrl;
  }
}

/* ==========================================================================
   🔔 REAL NOTIFICATION SYSTEM WITH SUPABASE
   ========================================================================== */

// 1. ฟังก์ชันแปลงเวลาเป็นภาษาไทยแบบสัมพัทธ์ (เช่น "5 นาทีที่แล้ว")
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'เมื่อสักครู่นี้';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} นาทีที่แล้ว`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ชั่วโมงที่แล้ว`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} วันที่แล้ว`;
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// 2. แปลง Icon และ สี ตามประเภทแจ้งเตือน (Type)
function getNotifTheme(type) {
  switch (type) {
    case 'leave':
      return { icon: 'event_note', bgClass: 'bg-orange' };
    case 'payroll':
      return { icon: 'payments', bgClass: 'bg-green' };
    case 'employee':
      return { icon: 'badge', bgClass: 'bg-blue' };
    default:
      return { icon: 'notifications', bgClass: 'bg-purple' };
  }
}

// 3. ฟังก์ชันดึงข้อมูลการแจ้งเตือนจาก Supabase
async function fetchRealNotifications() {
  const client = window.sb || window.pvtSupabase?.getClient();
  const container = document.getElementById('notifListContainer');
  const badge = document.getElementById('notifBadge');
  const unreadCountPill = document.getElementById('notifUnreadCount');

  if (!client || !container) return;

  try {
    // Query ข้อมูลจาก Supabase ดึง 15 รายการล่าสุด
    const { data: notifications, error } = await client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (error) throw error;

    if (!notifications || notifications.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-soft); font-size: 13px;">
          🔕 ไม่มีรายการแจ้งเตือนในขณะนี้
        </div>`;
      if (badge) badge.style.display = 'none';
      if (unreadCountPill) unreadCountPill.textContent = '0 รายการใหม่';
      return;
    }

    // นับจำนวนรายการที่ยังไม่ได้อ่าน
    const unreadCount = notifications.filter(n => !n.is_read).length;

    // อัปเดต Badge ตัวเลข
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (unreadCountPill) {
      unreadCountPill.textContent = `${unreadCount} รายการใหม่`;
    }

    // สร้าง HTML จากข้อมูลจริง
    let html = '';
    notifications.forEach(item => {
      const theme = getNotifTheme(item.type);
      const isUnreadClass = item.is_read ? '' : 'unread';
      const timeText = formatTimeAgo(item.created_at);

      html += `
        <div class="notif-item ${isUnreadClass}" onclick="handleNotifClick(${item.id}, '${item.link}')">
          <div class="notif-icon ${theme.bgClass}">
            <span class="material-symbols-outlined">${theme.icon}</span>
          </div>
          <div class="notif-content">
            <p class="notif-text"><strong>${item.title}</strong> ${item.message}</p>
            <span class="notif-time">${timeText}</span>
          </div>
          ${!item.is_read ? '<span class="unread-dot"></span>' : ''}
        </div>
      `;
    });

    container.innerHTML = html;

  } catch (err) {
    console.error('Error loading notifications:', err);
    container.innerHTML = `
      <div style="padding: 16px; text-align: center; color: var(--danger); font-size: 13px;">
        ❌ ไม่สามารถโหลดการแจ้งเตือนได้
      </div>`;
  }
}

// 4. คลิกอ่านรายการเดียวแล้วอัปเดตลง Database
async function handleNotifClick(notifId, redirectUrl) {
  const client = window.sb || window.pvtSupabase?.getClient();
  if (client && notifId) {
    await client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notifId);
  }

  if (redirectUrl && redirectUrl !== '#') {
    window.location.href = redirectUrl;
  } else {
    fetchRealNotifications(); // โหลดข้อมูลใหม่เพื่ออัปเดต UI
  }
}

// 5. คลิกอ่านทั้งหมด (Mark All as Read) ลง Database
async function markAllNotificationsAsRead() {
  const client = window.sb || window.pvtSupabase?.getClient();
  if (!client) return;

  try {
    const { error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) throw error;
    fetchRealNotifications(); // รีโหลดข้อมูล UI
  } catch (err) {
    console.error('Error marking all as read:', err);
  }
}

// 6. ตั้งค่า Event Listeners และ Realtime Sync เมื่อโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", () => {
  const bellBtn = document.getElementById("notifBellBtn");
  const dropdown = document.getElementById("notifDropdown");

  if (bellBtn && dropdown) {
    bellBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
        dropdown.classList.remove("show");
      }
    });
  }

  // ดึงข้อมูลครั้งแรกเมื่อเปิดหน้าเว็บ
  fetchRealNotifications();

  // ⚡ ระบบ Realtime Listeners (ถ้ามีการ INSERT ข้อมูลใหม่จะโหลด UI ใหม่ทันที)
  const client = window.sb || window.pvtSupabase?.getClient();
  if (client) {
    client
      .channel('realtime_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchRealNotifications();
      })
      .subscribe();
  }
});

// ฟังก์ชันบันทึก Log การเข้าชมหน้าเว็บ
async function logUserVisit(customAction = 'PAGE_VISIT', customDetails = '') {
    try {
        const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
        if (!supabase) return;

        // ดึงข้อมูล User ที่ล็อกอินอยู่ (ถ้ามี)
        const { data: { user } } = await supabase.auth.getUser();
        let userName = 'ผู้ใช้งานทั่วไป (Guest)';

        if (user) {
            // ดึงชื่อจาก profiles หรือใช้อีเมล
            const { data: profile } = await supabase
                .from('profiles')
                .select('display_name, username')
                .eq('id', user.id)
                .single();
            
            userName = profile?.display_name || profile?.username || user.email || 'Logged-in User';
        }

        // ส่งข้อมูลเข้าตาราง audit_logs
        await supabase.from('audit_logs').insert([{
            user_id: user ? user.id : null,
            user_name: userName,
            page_url: window.location.pathname,
            action: customAction,
            details: customDetails || `เข้าชมหน้า ${document.title}`,
            user_agent: navigator.userAgent
        }]);

    } catch (err) {
        console.error("Logging Error:", err);
    }
}

// สั่งให้ทำงานทันทีเมื่อโหลดหน้าเว็บสำเร็จ
document.addEventListener("DOMContentLoaded", () => {
    logUserVisit();
});