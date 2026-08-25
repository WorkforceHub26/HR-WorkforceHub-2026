/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - DASHBOARD CORE SYSTEM (BATCH CARD PRINT ENHANCED)
 * ==========================================================================
 */

/* ==========================================================================
   1. 🎨 CSS INSPECTION GUARDIAN
   ========================================================================== */


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
    fetchRealNotifications();

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
  // Handled globally by auth-guard.js
}

function setupBellNotificationToggle() {
  const bellBtn = document.getElementById("notifBellBtn");
  const dropdown = document.getElementById("notifDropdown");

  if (!bellBtn || !dropdown) return;

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
    return;
  }

  try {
    // 🟢 ดึงข้อมูลแบบสมบูรณ์พร้อม Fallback ป้องกัน Join Error
    let resRequests = null;
    let resEmployees = null;
    let resLeaveTypes = null;

    try {
      const results = await Promise.all([
        sb.from("leave_requests").select(`
          *,
          employees (
            id, employee_code, full_name, first_name, last_name, nickname, role, image_url, department_id,
            departments ( id, department_name ),
            positions ( position_name )
          ),
          leave_types ( id, leave_code, leave_name )
        `).order("created_at", { ascending: false }),
        sb.from("employees").select("*, departments(id, department_name), positions(position_name)"),
        sb.from("leave_types").select("*")
      ]);
      resRequests = results[0];
      resEmployees = results[1];
      resLeaveTypes = results[2];
    } catch (joinErr) {
      console.warn("⚠️ Complex Join Query Failed, retrying simple select:", joinErr);
      const fallbackResults = await Promise.all([
        sb.from("leave_requests").select("*").order("created_at", { ascending: false }),
        sb.from("employees").select("*"),
        sb.from("leave_types").select("*")
      ]);
      resRequests = fallbackResults[0];
      resEmployees = fallbackResults[1];
      resLeaveTypes = fallbackResults[2];
    }

    if (resRequests?.error) console.error("❌ Supabase Request Error:", resRequests.error);
    if (resEmployees?.error) console.error("❌ Supabase Employees Error:", resEmployees.error);

    rawRequests = resRequests?.data || [];
    rawEmployees = resEmployees?.data || [];
    const allLeaveTypes = resLeaveTypes?.data || [];

    // ผูกข้อมูลสัมพันธ์เพิ่มเติมเพื่อความสมบูรณ์ 100%
    const empMap = new Map((rawEmployees || []).map(e => [String(e.id), e]));
    const typeMap = new Map((allLeaveTypes || []).map(t => [String(t.id), t]));

    rawRequests.forEach(r => {
      if (!r.employees && r.employee_id) {
        r.employees = empMap.get(String(r.employee_id)) || null;
      }
      if (!r.leave_types && r.leave_type_id) {
        r.leave_types = typeMap.get(String(r.leave_type_id)) || null;
      }
    });

    if (rawRequests.length === 0 && rawEmployees.length === 0) {
      rawRequests = mockRequests;
      rawEmployees = mockEmployees;
    }

    const pendingCount = rawRequests.filter(r => {
      if (!r || !r.status) return false;
      const st = String(r.status).toLowerCase();
      return st === "pending" || st === "รออนุมัติ" || st === "cancel_pending" || st === "cancel_requested";
    }).length;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLeavesCount = rawRequests.filter(r => {
      const isApproved = (r.status === "approved" || r.status === "อนุมัติ");
      const inRange = r.start_date && r.end_date && (todayStr >= r.start_date && todayStr <= r.end_date);
      return isApproved && inRange;
    }).length;

    const totalEmp = rawEmployees.length;

    renderCounters(pendingCount, todayLeavesCount, totalEmp);
    drawCharts();
    showToast(`✅ ซิงค์ข้อมูลระบบเรียบร้อยแล้ว`, "success");

  } catch (error) {
    console.error("❌ [Catch Error]: เกิดข้อผิดพลาดระหว่างคิวรีข้อมูล:", error);
    rawRequests = mockRequests;
    rawEmployees = mockEmployees;
    renderCounters(1, 1, 1);
    drawCharts();
  }
};

/* ==========================================================================
   5. 📊 CHARTS & TOP LEAVE TAKERS (ENHANCED ENGINE)
   ========================================================================== */
// ประกาศตัวแปร Global สำหรับเก็บ Chart Instance (ป้องกัน ReferenceError)
if (typeof window.chartTypeInstance === "undefined") window.chartTypeInstance = null;
if (typeof window.chartDeptInstance === "undefined") window.chartDeptInstance = null;

function drawCharts() {
  // 1. ตรวจสอบว่ามีไลบรารี Chart.js หรือไม่
  if (typeof Chart === "undefined") {
    console.warn("⚠️ Chart.js library not loaded yet, retrying in 300ms...");
    setTimeout(drawCharts, 300);
    return;
  }

  // 2. ข้อมูลคำขอที่ปลอดภัย
  const safeRequests = Array.isArray(typeof rawRequests !== "undefined" ? rawRequests : null)
    ? rawRequests
    : [];

  const canvasType = document.getElementById("chartLeaveTypes");
  const canvasDept = document.getElementById("chartDepartments");

  // 🟢 กรองรายการที่อนุมัติแล้ว
  const approvedRequests = safeRequests.filter(r => {
    if (!r || !r.status) return false;
    const st = String(r.status).trim().toLowerCase();
    return st === "approved" || st === "อนุมัติ" || st === "pass";
  });

  // หากไม่มีรายการอนุมัติเลย ให้ใช้ข้อมูลทั้งหมดเพื่อแสดงโครงสร้างกราฟพร้อมระบุข้อมูล
  const activeDataset = approvedRequests.length > 0 ? approvedRequests : safeRequests;
  const isApprovedData = approvedRequests.length > 0;
  const hasData = activeDataset.length > 0;

  // --- 1. กราฟสัดส่วนประเภทการลา ---
  if (canvasType) {
    const typeSummary = {};
    let totalCount = 0;

    activeDataset.forEach(r => {
      const typeName = r.leave_types?.leave_name || r.leave_type_name || "อื่น ๆ";
      typeSummary[typeName] = (typeSummary[typeName] || 0) + 1;
      totalCount++;
    });

    const headerTotalEl = document.getElementById("leaveTypeTotalHeader");
    if (headerTotalEl) {
      headerTotalEl.textContent = isApprovedData 
        ? `(อนุมัติแล้ว ${totalCount} รายการ)` 
        : `(รวม ${totalCount} รายการ)`;
    }

    const centerTotalEl = document.getElementById("leaveTypeTotalCenter");
    if (centerTotalEl) centerTotalEl.textContent = totalCount;

    const typeLabels = hasData ? Object.keys(typeSummary) : ["ไม่มีข้อมูล"];
    const typeValues = hasData ? Object.values(typeSummary) : [1];
    const colorPalette = ['#0fa472', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4', '#64748b'];
    const bgColors = hasData ? typeLabels.map((_, i) => colorPalette[i % colorPalette.length]) : ['#e2e8f0'];

    // เคลียร์กราฟเก่า
    if (window.chartTypeInstance) {
      window.chartTypeInstance.destroy();
      window.chartTypeInstance = null;
    }

    // วาดกราฟใหม่
    window.chartTypeInstance = new Chart(canvasType.getContext("2d"), {
      type: 'doughnut',
      data: {
        labels: typeLabels,
        datasets: [{
          data: typeValues,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            callbacks: {
              label: function(context) {
                const val = context.raw || 0;
                const pct = totalCount > 0 ? ((val / totalCount) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val} รายการ (${pct}%)`;
              }
            }
          }
        },
        cutout: '70%'
      }
    });

    if (typeof renderLeaveBreakdownList === "function") {
      renderLeaveBreakdownList(typeSummary, totalCount, colorPalette);
    }
  }

  // --- 2. กราฟสถิติจำนวนวันลาแยกตามแผนก ---
  if (canvasDept) {
    const deptSummary = {};

    activeDataset.forEach(r => {
      const deptObj = r.employees?.departments;
      const deptName = (Array.isArray(deptObj) ? deptObj[0]?.department_name : deptObj?.department_name)
        || r.department
        || "ส่วนกลาง / ไม่ระบุ";

      const rawDays = r.actual_days ?? r.total_days ?? r.days_requested ?? r.days ?? 1;
      const days = parseFloat(rawDays) || 1;

      deptSummary[deptName] = (deptSummary[deptName] || 0) + days;
    });

    const deptLabels = hasData ? Object.keys(deptSummary) : ["ไม่มีข้อมูล"];
    const deptValues = hasData ? Object.values(deptSummary) : [0];

    // เคลียร์กราฟเก่า
    if (window.chartDeptInstance) {
      window.chartDeptInstance.destroy();
      window.chartDeptInstance = null;
    }

    // วาดกราฟใหม่
    window.chartDeptInstance = new Chart(canvasDept.getContext("2d"), {
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
            enabled: hasData,
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
            ticks: { 
              font: { family: 'Sarabun', size: 12 },
              color: '#64748b'
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              font: { family: 'Sarabun', size: 12 },
              color: '#64748b',
              callback: function(val) { return val + ' วัน'; }
            },
            grid: { color: '#f1f5f9' }
          }
        }
      }
    });
  }

  // --- 3. อันดับพนักงานที่ลาเยอะที่สุด ---
  if (typeof renderTopLeaveEmployees === "function") {
    renderTopLeaveEmployees(activeDataset);
  }
}

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
   7. 💳 DIGITAL EMPLOYEE CARD MANAGER & BATCH PRINT SYSTEM (FUTURE-PROOFED)
   ========================================================================== */

// 🟢 7.0 CONFIG & HELPER CENTRAL FOR QR CODE & ROUTING
const PVT_CARD_CONFIG = {
  // หากพัฒนาบน localhost จะสลับไปใช้ Domain จริงให้อัตโนมัติ เพื่อให้โทรศัพท์สแกนได้
  PRODUCTION_DOMAIN: "https://dev-workforcehub-2026.pages.dev",
  // ระบุไฟล์ปลายทางให้ชัดเจนเพื่อป้องกันปัญหา Blank Page (หน้าขาว)
  ENTRY_PAGE_PATH: "/index.html", 
  QR_SIZE: "180x180"
};

/**
 * ดึง Base URL ของระบบอย่างปลอดภัย
 */
function getSystemBaseUrl() {
  const currentOrigin = window.location.origin;
  if (!currentOrigin || currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1") || currentOrigin.includes("file://")) {
    return PVT_CARD_CONFIG.PRODUCTION_DOMAIN;
  }
  return currentOrigin;
}

/**
 * ฟังก์ชันกลางสำหรับสร้าง URL ปลายทาง และ URL รูปภาพ QR Code
 */
function generateEmployeeQrUrl(empCode) {
  if (!empCode) return "";
  
  const cleanCode = String(empCode).trim();
  const baseUrl = getSystemBaseUrl();
  
  try {
    // รวม Base Domain และ Path เข้าด้วยกันอย่างถูกต้อง
    const targetUrl = new URL(PVT_CARD_CONFIG.ENTRY_PAGE_PATH, baseUrl);
    targetUrl.searchParams.set("auto_login", cleanCode);
    targetUrl.searchParams.set("token", "PVT_SECURE_BYPASS");

    const encodedTarget = encodeURIComponent(targetUrl.toString());
    return `https://api.qrserver.com/v1/create-qr-code/?size=${PVT_CARD_CONFIG.QR_SIZE}&data=${encodedTarget}`;
  } catch (err) {
    console.error("❌ Error generating QR URL:", err);
    // Fallback URL กรณีโครงสร้าง URL มีปัญหา
    const fallbackTarget = `${baseUrl}${PVT_CARD_CONFIG.ENTRY_PAGE_PATH}?auto_login=${encodeURIComponent(cleanCode)}&token=PVT_SECURE_BYPASS`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${PVT_CARD_CONFIG.QR_SIZE}&data=${encodeURIComponent(fallbackTarget)}`;
  }
}

// ตัวแปร Cache เก็บรายชื่อพนักงาน
let cachedEmployeeList = null;

// 🟢 7.1 ฟังก์ชันเปิด Popup เลือกพนักงาน (Batch Print & Card Selection)
window.openEmployeeCardManagerPopup = async function (forceRefresh = false) {
  if (typeof Swal === "undefined") {
    alert("⚠️ ไม่พบลายบรารี SweetAlert2");
    return;
  }

  if (!cachedEmployeeList || forceRefresh) {
    Swal.fire({
      title: 'กำลังโหลดบัญชีรายชื่อ...',
      html: '<div style="padding:20px; font-size:14px; color:#0fa472;">⌛ กรุณารอสักครู่กำลังดึงข้อมูล...</div>',
      showConfirmButton: false,
      allowOutsideClick: false
    });

    const client = window.sb || window.pvtSupabase?.getClient();
    if (!client) {
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
      return;
    }

    try {
      const { data: employees, error } = await client
        .from('employees')
        .select(`
          id,
          employee_code,
          full_name,
          departments ( department_name ),
          positions ( position_name )
        `)
        .order('employee_code', { ascending: true });

      if (error) throw error;
      cachedEmployeeList = employees || [];
    } catch (err) {
      console.error("Error loading employees for cards:", err);
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดึงรายชื่อพนักงานได้', 'error');
      return;
    }
  }

  let rowsHtml = "";
  if (cachedEmployeeList.length === 0) {
    rowsHtml = `<tr><td colspan="4" style="text-align:center; padding:16px; color:#64748b;">ไม่พบข้อมูลพนักงานในระบบ</td></tr>`;
  } else {
    cachedEmployeeList.forEach(emp => {
      const empRole = emp.positions?.position_name || 'พนักงาน';
      const empDept = emp.departments?.department_name || 'ไม่ระบุแผนก';
      const empName = emp.full_name || 'ไม่ระบุชื่อ';
      const empCode = emp.employee_code || '';

      rowsHtml += `
        <tr class="emp-card-row" style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 8px; text-align: center; width: 40px;">
            <input type="checkbox" class="emp-card-checkbox" 
                   data-code="${empCode}" 
                   data-name="${escapeHtmlAttribute(empName)}" 
                   data-role="${escapeHtmlAttribute(empRole)}" 
                   data-dept="${escapeHtmlAttribute(empDept)}"
                   style="cursor: pointer; width: 16px; height: 16px;" />
          </td>
          <td style="padding: 12px 8px; font-weight: 600; color: #475569;">${empCode}</td>
          <td style="padding: 12px 8px; text-align: left;">
            <span style="font-weight: 600; color: #1e293b; display:block;">${escapeHtmlText(empName)}</span>
            <div style="display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap;">
              <small style="color: #0fa472; background: #ebf7f3; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">💼 ${escapeHtmlText(empRole)}</small>
              <small style="color: #3b82f6; background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">🏢 ${escapeHtmlText(empDept)}</small>
            </div>
          </td>
          <td style="padding: 12px 8px; text-align: center;">
            <button class="btn-view-card" 
                    data-code="${empCode}" 
                    data-name="${escapeHtmlAttribute(empName)}" 
                    data-role="${escapeHtmlAttribute(empRole)}" 
                    data-dept="${escapeHtmlAttribute(empDept)}"
              style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size:16px;">visibility</span> ดู
            </button>
          </td>
        </tr>
      `;
    });
  }

  Swal.fire({
    title: '👥 เลือกพนักงานเพื่อพิมพ์บัตรประจำตัว',
    width: '740px',
    html: `
      <div style="display: flex; gap: 10px; margin-bottom: 12px; align-items: center; justify-content: space-between;">
        <input type="text" id="cardSearchInput" placeholder="🔍 ค้นหารหัส, ชื่อ-สกุล, ตำแหน่ง..." 
          style="flex: 1; padding: 10px 14px; font-size: 14px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; font-family: inherit;" />
        <button id="btnPrintSelectedCards" onclick="handlePrintSelectedCardsFromPopup()" disabled
          style="background: #10b981; color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: not-allowed; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; opacity: 0.5; transition: all 0.2s;">
          <span class="material-symbols-outlined" style="font-size:18px;">print</span> 
          พิมพ์ที่เลือก (<span id="selectedCardCount">0</span>)
        </button>
      </div>
      <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; position: sticky; top: 0; z-index: 10;">
              <th style="padding: 12px 8px; text-align: center; width: 40px;">
                <input type="checkbox" id="selectAllCardsCheckbox" onchange="toggleSelectAllCards(this)" style="cursor: pointer; width: 16px; height: 16px;" />
              </th>
              <th style="padding: 12px 8px; text-align: left; color: #475569; width: 90px;">รหัส</th>
              <th style="padding: 12px 8px; text-align: left; color: #475569;">ชื่อ-นามสกุล / ตำแหน่ง / แผนก</th>
              <th style="padding: 12px 8px; text-align: center; color: #475569; width: 80px;">ตัวเลือก</th>
            </tr>
          </thead>
          <tbody id="employeeCardTableBody">${rowsHtml}</tbody>
        </table>
        <div id="noMatchCardMessage" style="display: none; padding: 24px; text-align: center; color: #64748b; font-size: 14px;">
          ❌ ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา
        </div>
      </div>
    `,
    confirmButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#64748b',
    didOpen: () => {
      const searchInput = document.getElementById("cardSearchInput");
      const tableBody = document.getElementById("employeeCardTableBody");
      const noMatchMsg = document.getElementById("noMatchCardMessage");

      tableBody.addEventListener('change', (e) => {
        if (e.target.classList.contains('emp-card-checkbox')) {
          updateCardSelectionCount();
        }
      });

      tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-view-card');
        if (btn) {
          const { code, name, role, dept } = btn.dataset;
          showIndividualIdCard(code, name, role, dept);
        }
      });

      if (searchInput && tableBody) {
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

          if (noMatchMsg) {
            noMatchMsg.style.display = (visibleCount === 0 && rows.length > 0) ? "block" : "none";
          }
        });
      }
    }
  });
};

// 🟢 7.2 ฟังก์ชัน Helper เลือก Checkbox
window.toggleSelectAllCards = function (masterCb) {
  const checkboxes = document.querySelectorAll('.emp-card-checkbox');
  checkboxes.forEach(cb => {
    const row = cb.closest('tr');
    if (row && row.style.display !== 'none') {
      cb.checked = masterCb.checked;
    }
  });
  updateCardSelectionCount();
};

window.updateCardSelectionCount = function () {
  const checkedBoxes = document.querySelectorAll('.emp-card-checkbox:checked');
  const countEl = document.getElementById('selectedCardCount');
  const btnPrint = document.getElementById('btnPrintSelectedCards');

  const count = checkedBoxes.length;
  if (countEl) countEl.textContent = count;

  if (btnPrint) {
    if (count > 0) {
      btnPrint.disabled = false;
      btnPrint.style.opacity = '1';
      btnPrint.style.cursor = 'pointer';
    } else {
      btnPrint.disabled = true;
      btnPrint.style.opacity = '0.5';
      btnPrint.style.cursor = 'not-allowed';
    }
  }
};

window.handlePrintSelectedCardsFromPopup = function () {
  const checkedBoxes = document.querySelectorAll('.emp-card-checkbox:checked');
  if (checkedBoxes.length === 0) return;

  const selectedEmployees = Array.from(checkedBoxes).map(cb => ({
    empCode: cb.dataset.code,
    empName: cb.dataset.name,
    empRole: cb.dataset.role,
    empDept: cb.dataset.dept
  }));

  printMultipleCards(selectedEmployees);
};

// 🟢 7.3 ฟังก์ชันแสดงพรีวิวบัตรใบเดียว (Single Card Modal)
window.showIndividualIdCard = function (empCode, empName, empRole, empDept) {
  // เรียกใช้ Centralized QR URL Generator
  const qrUrl = generateEmployeeQrUrl(empCode);
  
  Swal.fire({
    title: '💳 ตัวอย่างบัตรพนักงานดิจิทัล',
    width: '400px',
    html: `
      <div id="pvt-id-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); width: 280px; margin: 15px auto; border-radius: 20px; padding: 24px; color: white; box-shadow: 0 15px 30px rgba(30,58,138,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1);">
        <div style="font-weight: 700; font-size: 14px; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 20px;">PVT WORKFORCE HUB</div>
        <div style="width: 76px; height: 76px; background: rgba(255,255,255,0.1); border-radius: 50%; margin: 0 auto 14px auto; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.2);">
          <span class="material-symbols-outlined" style="font-size: 42px; color: #93c5fd;">account_circle</span>
        </div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 6px;">${escapeHtmlText(empName)}</div>
        <div style="font-size: 13px; color: #38bdf8; font-weight: 600; margin-bottom: 2px;">ตำแหน่ง: ${escapeHtmlText(empRole)}</div>
        <div style="font-size: 12px; color: #94a3b8; font-weight: 500; margin-bottom: 20px;">แผนก: ${escapeHtmlText(empDept)}</div>
        <div style="background: white; padding: 10px; border-radius: 14px; display: inline-block; margin-bottom: 16px;">
          <img src="${qrUrl}" alt="Employee QR Code" style="width: 140px; height: 140px; display: block;" 
               onerror="this.onerror=null; this.src='https://via.placeholder.com/140?text=QR+Error';" />
        </div>
        <div>
          <span style="font-size: 11px; color: #94a3b8; display: block; text-transform: uppercase;">Employee ID</span>
          <span style="font-size: 16px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 4px 16px; border-radius: 30px; display: inline-block;">
            ${escapeHtmlText(empCode)}
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

// 🟢 7.4 ฟังก์ชันพิมพ์บัตรแบบใบเดียว (Single Print)
window.printSingleCard = function (empCode, empName, position, department, pictureUrl) {
  let employee = {};
  
  if (typeof empCode === 'object' && empCode !== null) {
    employee = {
      code: empCode.employee_code || empCode.empCode || empCode.id || '',
      name: empCode.name || empCode.empName || empCode.full_name || '-',
      position: empCode.position || empCode.empRole || '-',
      department: empCode.department || empCode.empDept || '-',
      qr_url: empCode.qr_url || generateEmployeeQrUrl(empCode.employee_code || empCode.empCode)
    };
  } else {
    employee = {
      code: empCode || '',
      name: empName || '-',
      position: position || '-',
      department: department || '-',
      qr_url: (pictureUrl && pictureUrl.includes('qrserver.com')) ? pictureUrl : generateEmployeeQrUrl(empCode)
    };
  }

  const printWindow = window.open('', '_blank', 'width=500,height=600');
  if (!printWindow) {
    alert('⚠️ เบราว์เซอร์ระงับการเปิด Pop-up! กรุณากด "อนุญาตให้เปิด Pop-up" ที่แถบ URL ด้านบน');
    return;
  }

  const cardHtml = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>พิมพ์บัตรพนักงาน - ${escapeHtmlText(employee.name)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        @page { size: 85.6mm 53.98mm; margin: 0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: 'Sarabun', sans-serif; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f1f5f9; }
        .card {
          position: relative; width: 85.6mm; height: 53.98mm; border-radius: 8px; padding: 8px 12px;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white;
          display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .card-header { font-size: 10px; font-weight: 700; color: #38bdf8; text-align: center; letter-spacing: 1px; }
        .card-body { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
        .details { flex: 1; font-size: 9px; line-height: 1.3; }
        .name { font-weight: 700; font-size: 11px; color: #fff; margin-bottom: 2px; }
        .meta { color: #94a3b8; font-size: 9px; }
        .role { color: #38bdf8; font-weight: 600; }
        .qr-box { background: white; padding: 4px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        .qr-box img { width: 52px; height: 52px; display: block; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 3px; }
        .emp-id { font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 10px; }
        @media print { body { background: transparent; } .card { border: none; box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="card-header">PVT WORKFORCE HUB</div>
        <div class="card-body">
          <div class="details">
            <div class="name">${escapeHtmlText(employee.name)}</div>
            <div class="meta role">ตำแหน่ง: ${escapeHtmlText(employee.position)}</div>
            <div class="meta">แผนก: ${escapeHtmlText(employee.department)}</div>
          </div>
          <div class="qr-box">
            <img id="singleQrImg" src="${employee.qr_url}" alt="QR Code" />
          </div>
        </div>
        <div class="card-footer">
          <span style="font-size: 8px; color: #94a3b8;">EMPLOYEE ID</span>
          <span class="emp-id">${escapeHtmlText(employee.code)}</span>
        </div>
      </div>
      <script>
        const img = document.getElementById('singleQrImg');
        let printed = false;
        function triggerPrint() {
          if (printed) return;
          printed = true;
          setTimeout(() => {
            window.print();
            setTimeout(() => { window.close(); }, 500);
          }, 300);
        }
        
        if (img.complete) { triggerPrint(); } 
        else { img.onload = triggerPrint; img.onerror = triggerPrint; }
        
        // Timeout สำรอง กันหน้าพิมพ์ค้าง
        setTimeout(triggerPrint, 1500);
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(cardHtml);
  printWindow.document.close();
};

// 🟢 7.5 ฟังก์ชันพิมพ์บัตรแบบชุดหลายใบ (Batch Print Multiple Cards)
window.printMultipleCards = function (selectedList = []) {
  if (!Array.isArray(selectedList) || selectedList.length === 0) {
    alert("⚠️ กรุณาเลือกพนักงานที่ต้องการพิมพ์บัตร");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    alert('⚠️ เบราว์เซอร์ระงับการเปิด Pop-up! กรุณากด "อนุญาตให้เปิด Pop-up" ที่แถบ URL ด้านบน');
    return;
  }

  let cardsHtml = selectedList.map(item => {
    const empCode = item.empCode || item.employee_code || '';
    const qrUrl = generateEmployeeQrUrl(empCode);

    return `
      <div class="card">
        <div class="lanyard-hole"></div>
        <div class="company">PVT WORKFORCE HUB</div>
        <div class="profile-section">
          <div class="name">${escapeHtmlText(item.empName)}</div>
          <div class="badge-container">
            <span class="role-badge">${escapeHtmlText(item.empRole)}</span>
            <span class="dept-text">แผนก: ${escapeHtmlText(item.empDept)}</span>
          </div>
        </div>
        <div class="qr-box"><img class="batch-qr-img" src="${qrUrl}" alt="QR Code" /></div>
        <div class="footer-section"><div class="id-tag">${escapeHtmlText(empCode)}</div></div>
      </div>
    `;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="UTF-8">
        <title>Batch Print ID Cards (${selectedList.length} รายการ)</title>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Sarabun', sans-serif; background: #f1f5f9; padding: 20px; margin: 0; }
          .card-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; }
          .card { 
            position: relative; background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%); 
            width: 240px; height: 380px; border-radius: 16px; padding: 18px 14px; color: white; 
            text-align: center; border: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column;
            justify-content: space-between; align-items: center; overflow: hidden; page-break-inside: avoid;
          }
          .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #06b6d4, #3b82f6, #6366f1); }
          .lanyard-hole { width: 32px; height: 6px; background: #020617; border-radius: 10px; margin-bottom: 6px; border: 1px solid rgba(255, 255, 255, 0.15); }
          .company { font-weight: 700; font-size: 10px; letter-spacing: 2px; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px; }
          .profile-section { margin-bottom: 4px; width: 100%; }
          .name { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; line-height: 1.2; word-break: break-word; }
          .badge-container { display: flex; flex-direction: column; gap: 3px; align-items: center; justify-content: center; }
          .role-badge { font-size: 10px; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 2px 8px; border-radius: 12px; font-weight: 500; }
          .dept-text { font-size: 10px; color: #94a3b8; font-weight: 400; }
          .qr-box { background: #ffffff; padding: 6px; border-radius: 10px; display: inline-block; border: 2px solid #38bdf8; }
          .qr-box img { width: 110px; height: 110px; display: block; }
          .footer-section { width: 100%; }
          .id-tag { font-size: 13px; font-weight: 700; letter-spacing: 1.5px; color: #f8fafc; background: rgba(255, 255, 255, 0.08); padding: 4px 14px; border-radius: 20px; display: inline-block; border: 1px solid rgba(255,255,255,0.15); font-family: monospace, 'Sarabun'; }
          @media print { body { background: transparent; padding: 0; } .card-grid { gap: 15px; } }
        </style>
      </head>
      <body>
        <div class="card-grid">${cardsHtml}</div>
        <script>
          const images = document.querySelectorAll('.batch-qr-img');
          let loadedCount = 0;
          let printed = false;

          function triggerPrint() {
            if (printed) return;
            printed = true;
            setTimeout(() => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            }, 400);
          }

          function checkAllLoaded() {
            loadedCount++;
            if (loadedCount >= images.length) {
              triggerPrint();
            }
          }

          if (images.length === 0) {
            triggerPrint();
          } else {
            images.forEach(img => {
              if (img.complete) { checkAllLoaded(); } 
              else { img.onload = checkAllLoaded; img.onerror = checkAllLoaded; }
            });
          }

          // Timeout สำรองสูงสุด 2.5 วินาที สำหรับ Batch หลายใบ
          setTimeout(triggerPrint, 2500);
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  setTimeout(() => { openEmployeeCardManagerPopup(); }, 800);
};

// 🛠️ Helper Functions สำหรับ Escape ข้อความ ป้องกัน XSS และ Syntax Error
function escapeHtmlText(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ==========================================================================
   8. 🔔 REAL NOTIFICATION SYSTEM WITH SUPABASE (FIXED & LOCAL STORAGE SYNC)
   ========================================================================== */

// Helper: ดึงและบันทึกรายชื่อ ID การแจ้งเตือนที่กดอ่านแล้วลง LocalStorage
function getReadNotifIds() {
  try {
    return JSON.parse(localStorage.getItem('pvt_read_notifs') || '[]');
  } catch (e) {
    return [];
  }
}

function addReadNotifId(id) {
  const readIds = getReadNotifIds();
  const strId = String(id);
  if (!readIds.includes(strId)) {
    readIds.push(strId);
    localStorage.setItem('pvt_read_notifs', JSON.stringify(readIds));
  }
}

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

async function fetchRealNotifications() {
  const client = sb || window.pvtSupabase?.getClient();
  const container = document.getElementById('notifListContainer');
  const badge = document.getElementById('notifBadge');
  const unreadCountPill = document.getElementById('notifUnreadCount');

  if (!container) return;

  try {
    let dbNotifications = [];

    // 1. ดึงข้อมูลการแจ้งเตือนจากตาราง notifications ใน Supabase
    if (client) {
      const { data, error } = await client
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        dbNotifications = data;
      }
    }

    const readNotifIds = getReadNotifIds();

    // 2. แปลงรายการใบลาค้างอนุมัติ (rawRequests) เป็นรายการแจ้งเตือน
    const pendingLeaves = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ"));
    const pendingNotifications = pendingLeaves.map(item => {
      const empName = item.employees?.full_name || item.emp_name || 'พนักงาน';
      const leaveType = item.leave_types?.leave_name || item.leave_type_name || 'ใบลา';
      const notifId = `pending-${item.id}`;

      return {
        id: notifId,
        title: `คำขอลาใหม่: ${empName}`,
        message: `ยื่นขอ${leaveType} (${item.total_days || 1} วัน) รอการพิจารณา`,
        type: 'leave',
        is_read: readNotifIds.includes(notifId),
        created_at: item.created_at || new Date().toISOString(),
        link: '/pages/hr/hr.html'
      };
    });

    // 3. รวมการแจ้งเตือนจากทั้งสองส่วนเข้าด้วยกัน
    const allNotifications = [
      ...pendingNotifications, 
      ...dbNotifications.map(n => ({
        ...n,
        is_read: n.is_read || readNotifIds.includes(String(n.id))
      }))
    ];

    if (allNotifications.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: var(--text-soft); font-size: 13px;">
          🔕 ไม่มีรายการแจ้งเตือนในขณะนี้
        </div>`;
      if (badge) badge.style.display = 'none';
      if (unreadCountPill) unreadCountPill.textContent = '0 รายการใหม่';
      return;
    }

    const unreadCount = allNotifications.filter(n => !n.is_read).length;

    // อัปเดตตัวเลข Badge บนไอคอนกระดิ่ง
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

    // สร้าง HTML แสดงผลใน Dropdown
    let html = '';
    allNotifications.forEach(item => {
      const theme = getNotifTheme(item.type);
      const isUnreadClass = item.is_read ? '' : 'unread';
      const timeText = formatTimeAgo(item.created_at);

      html += `
        <div class="notif-item ${isUnreadClass}" onclick="handleNotifClick('${item.id}', '${item.link}')" style="cursor: pointer;">
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
      <div style="padding: 16px; text-align: center; color: #ef4444; font-size: 13px;">
        ❌ ไม่สามารถโหลดการแจ้งเตือนได้
      </div>`;
  }
}

async function handleNotifClick(notifId, redirectUrl) {
  // 1. บันทึก ID ลง LocalStorage ทันที
  addReadNotifId(notifId);

  // 2. ถ้าเป็น ID จากตาราง Supabase ให้ส่งไปอัปเดตที่ DB ด้วย
  const client = sb || window.pvtSupabase?.getClient();
  if (client && notifId && !String(notifId).startsWith('pending-')) {
    try {
      await client.from('notifications').update({ is_read: true }).eq('id', notifId);
    } catch (e) {
      console.warn('DB update failed:', e);
    }
  }

  // 3. ย้ายหน้า หรือ อัปเดต UI ทันที
  if (redirectUrl && redirectUrl !== '#' && redirectUrl !== 'undefined') {
    window.location.href = redirectUrl;
  } else {
    fetchRealNotifications();
  }
}

async function markAllNotificationsAsRead() {
  const client = sb || window.pvtSupabase?.getClient();

  // 1. มาร์กรายการใบลารออนุมัติทั้งหมดเป็นอ่านแล้ว
  const pendingLeaves = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ"));
  pendingLeaves.forEach(item => addReadNotifId(`pending-${item.id}`));

  // 2. มาร์กรายการใน Supabase เป็นอ่านแล้ว
  if (client) {
    try {
      const { data } = await client.from('notifications').select('id').eq('is_read', false);
      if (data) {
        data.forEach(n => addReadNotifId(n.id));
      }
      await client.from('notifications').update({ is_read: true }).eq('is_read', false);
    } catch (err) {
      console.warn('Supabase mark all error:', err);
    }
  }

  // 3. รีเฟรชการแสดงผลกระดิ่งทันที
  fetchRealNotifications();
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
  Swal.fire({
    title: 'ยืนยันการออกจากระบบ',
    text: 'คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ออกจากระบบ',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true,
    focusCancel: true
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: 'กำลังออกจากระบบ...',
        text: 'ระบบกำลังล้างข้อมูลเซสชันและนำคุณกลับสู่หน้าแรก',
        icon: 'success',
        showConfirmButton: false,
        timer: 1200,
        timerProgressBar: true
      });

      setTimeout(() => {
        localStorage.clear();
        localStorage.clear();
        window.location.href = "/index.html";
      }, 1200);
    }
  });
};

// ฟังก์ชันเปิด Pop-up แสดงการแจ้งเตือนทั้งหมด
window.openAllNotificationsModal = async function() {
  if (typeof Swal === "undefined") {
    alert("⚠️ ไม่พบลายบรารี SweetAlert2");
    return;
  }

  Swal.fire({
    title: 'กำลังโหลดการแจ้งเตือน...',
    html: '<div style="padding:20px; font-size:14px; color:#0fa472;">⌛ กรุณารอสักครู่...</div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  try {
    const client = sb || window.pvtSupabase?.getClient();
    let dbNotifications = [];

    if (client) {
      const { data } = await client
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) dbNotifications = data;
    }

    const readNotifIds = getReadNotifIds();

    // รวมคำขอลาค้างอนุมัติ
    const pendingLeaves = rawRequests.filter(r => r && (r.status === "pending" || r.status === "รออนุมัติ"));
    const pendingNotifications = pendingLeaves.map(item => {
      const empName = item.employees?.full_name || item.emp_name || 'พนักงาน';
      const leaveType = item.leave_types?.leave_name || item.leave_type_name || 'ใบลา';
      const notifId = `pending-${item.id}`;

      return {
        id: notifId,
        title: `คำขอลาใหม่: ${empName}`,
        message: `ยื่นขอ${leaveType} (${item.total_days || 1} วัน) รอการพิจารณา`,
        type: 'leave',
        is_read: readNotifIds.includes(notifId),
        created_at: item.created_at || new Date().toISOString(),
        link: '/pages/hr/hr.html'
      };
    });

    const allNotifications = [
      ...pendingNotifications, 
      ...dbNotifications.map(n => ({
        ...n,
        is_read: n.is_read || readNotifIds.includes(String(n.id))
      }))
    ];

    let listHtml = '';
    if (allNotifications.length === 0) {
      listHtml = `<div style="padding: 24px; text-align: center; color: #64748b; font-size: 14px;">🔕 ไม่มีรายการแจ้งเตือนในขณะนี้</div>`;
    } else {
      allNotifications.forEach(item => {
        const theme = getNotifTheme(item.type);
        const timeText = formatTimeAgo(item.created_at);
        const bgStyle = item.is_read 
          ? 'background: #ffffff; border: 1px solid #e2e8f0;' 
          : 'background: #f0fdfa; border: 1px solid #a7f3d0; border-left: 4px solid #0fa472;';

        listHtml += `
          <div onclick="Swal.close(); handleNotifClick('${item.id}', '${item.link}');" 
               style="display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 10px; margin-bottom: 8px; ${bgStyle} cursor: pointer; text-align: left; transition: all 0.2s;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
              <span class="material-symbols-outlined" style="font-size: 20px; color: #0fa472;">${theme.icon}</span>
            </div>
            <div style="flex: 1;">
              <div style="font-size: 13.5px; color: #0f172a; line-height: 1.4;">
                <strong style="color: #0f172a;">${item.title}</strong> ${item.message}
              </div>
              <span style="font-size: 11px; color: #64748b; margin-top: 4px; display: block;">${timeText}</span>
            </div>
            ${!item.is_read ? '<span style="width: 8px; height: 8px; background: #0fa472; border-radius: 50%; margin-top: 6px;"></span>' : ''}
          </div>
        `;
      });
    }

    Swal.fire({
      title: '🔔 การแจ้งเตือนทั้งหมด',
      width: '540px',
      html: `
        <div style="max-height: 420px; overflow-y: auto; padding-right: 4px; margin-top: 10px;">
          ${listHtml}
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#64748b'
    });

  } catch (err) {
    console.error("Error opening notifications modal:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดรายการแจ้งเตือนทั้งหมดได้', 'error');
  }
};