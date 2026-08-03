// ==========================================
// 1. GLOBAL STATE & INITIALIZATION
// ==========================================
let employees = [];
let leaveRequests = [];
let leaveBalances = [];
let leaveTypes = [];

document.addEventListener("DOMContentLoaded", refreshDashboard);

// ==========================================
// 2. DASHBOARD MAIN CONTROLLER
// ==========================================
async function refreshDashboard() {
  const status = document.getElementById("loadStatus");
  if (status) {
    status.textContent = "กำลังโหลด";
    status.className = "status pending";
  }

  try {
    await Promise.all([
      fetchEmployees(),
      fetchLeaveTypes(),
      fetchLeaveBalances(),
      fetchLeaveRequests(),
    ]);

    fillDepartmentFilter();
    renderSummary();
    renderEmployeeTable();

    if (status) {
      status.textContent = "โหลดสำเร็จ";
      status.className = "status active";
    }
  } catch (error) {
    console.error("Dashboard Loading Error:", error);
    if (status) {
      status.textContent = "เกิด error";
      status.className = "status rejected";
    }
    const tableBody = document.getElementById("employeeTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="8" class="empty">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

// ==========================================
// 3. SUPABASE DATA FETCHING
// ==========================================

// Helper ดึงข้อมูลแบบ Pagination รองรับข้อมูลมากกว่า 1,000 รายการ
async function fetchAllPaginated(tableName, selectQuery, orderColumn, ascending = true) {
  const sb = getSb();
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await sb
      .from(tableName)
      .select(selectQuery)
      .order(orderColumn, { ascending })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }
  return allData;
}

async function fetchEmployees() {
  const query = `
    id, employee_code, full_name, nickname, phone, email, hospital,
    bank_account, line_id, image_url, start_date, status, role,
    employment_type, departments(department_name), positions(position_name)
  `;
  employees = await fetchAllPaginated("employees", query, "employee_code", true);
}

async function fetchLeaveRequests() {
  const query = `
    id, employee_id, leave_type_id, start_date, end_date, total_days, reason,
    attachment_url, status, approved_at, approval_comment, start_period, end_period,
    leave_hours, note, manager_status, director_status, is_over_quota, created_at
  `;
  leaveRequests = await fetchAllPaginated("leave_requests", query, "created_at", false);
}

async function fetchLeaveTypes() {
  const sb = getSb();
  const { data, error } = await sb
    .from("leave_types")
    .select("id, leave_code, leave_name, yearly_quota, require_advance_days, max_days_per_request, paid_leave")
    .order("leave_name", { ascending: true });

  if (error) throw error;
  leaveTypes = data || [];
}

async function fetchLeaveBalances() {
  const sb = getSb();
  const year = new Date().getFullYear();
  const { data, error } = await sb
    .from("leave_balances")
    .select("employee_id, leave_type_id, year, entitlement_days, used_days, remaining_days")
    .eq("year", year);

  if (error) {
    console.warn("leave_balances unavailable", error);
    leaveBalances = [];
    return;
  }
  leaveBalances = data || [];
}

// ==========================================
// 4. UI RENDERERS & FILTERS
// ==========================================
function fillDepartmentFilter() {
  const select = document.getElementById("deptFilter");
  if (!select) return;

  const current = select.value;
  const departments = [...new Set(employees.map((emp) => emp.departments?.department_name).filter(Boolean))].sort();

  select.innerHTML = `<option value="">ทุกแผนก</option>` + 
    departments.map((dept) => `<option value="${escapeHtml(dept)}">${escapeHtml(dept)}</option>`).join("");
  
  select.value = departments.includes(current) ? current : "";
}

function renderSummary() {
  const approvedRequests = leaveRequests.filter((item) => String(item.status).toLowerCase() === "approved");
  const totalApprovedDays = approvedRequests.reduce((sum, item) => sum + Number(item.total_days || 0), 0);

  setText("statEmployees", employees.length);
  setText("statLeaves", leaveRequests.length);
  setText("statPending", leaveRequests.filter((item) => String(item.status).toLowerCase() === "pending").length);
  setText("statDays", totalApprovedDays.toFixed(1).replace(/\.0$/, ""));

  renderBarChart("typeChart", groupByLeaveType());
  renderBarChart("statusChart", groupByStatus(), true);
}

function groupByLeaveType() {
  const map = new Map();
  leaveRequests.forEach((request) => {
    if (String(request.status).toLowerCase() === "approved") {
      const type = getLeaveType(request.leave_type_id)?.leave_name || "ไม่ระบุประเภท";
      map.set(type, (map.get(type) || 0) + Number(request.total_days || 0));
    }
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function groupByStatus() {
  const map = new Map();
  leaveRequests.forEach((request) => {
    const label = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(request.status) : (request.status || "-");
    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderBarChart(targetId, rows, countMode = false) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (!rows.length) {
    target.innerHTML = `<div class="empty">ยังไม่มีข้อมูลสำหรับแสดงกราฟ</div>`;
    return;
  }

  const max = Math.max(...rows.map(([, value]) => value), 1);
  target.innerHTML = rows.map(([label, value]) => {
    const pct = Math.max(4, Math.round((value / max) * 100));
    const display = countMode ? `${value} รายการ` : `${Number(value).toFixed(1).replace(/\.0$/, "")} วัน`;
    return `
      <div class="bar-row">
        <strong>${escapeHtml(label)}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span>${display}</span>
      </div>
    `;
  }).join("");
}

function renderEmployeeTable() {
  const tbody = document.getElementById("employeeTableBody");
  if (!tbody) return;

  const search = document.getElementById("empSearchInput")?.value.trim().toLowerCase() || "";
  const dept = document.getElementById("deptFilter")?.value || "";

  const filtered = employees.filter((emp) => {
    const department = emp.departments?.department_name || "";
    const haystack = [
      emp.employee_code,
      emp.full_name,
      emp.positions?.position_name,
      department,
      emp.hospital,
    ].join(" ").toLowerCase();
    
    return (!search || haystack.includes(search)) && (!dept || department === dept);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty">ไม่พบพนักงานตามเงื่อนไข</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((emp) => `
    <tr>
      <td><img class="avatar" src="${window.pvtSupabase?.getAvatarUrl ? window.pvtSupabase.getAvatarUrl(emp.image_url) : ''}" onerror="this.src='/assets/img/default-avatar.jpg'" alt=""></td>
      <td><strong>${escapeHtml(emp.employee_code || "-")}</strong></td>
      <td>${escapeHtml(emp.full_name || "-")}</td>
      <td>${escapeHtml(emp.positions?.position_name || "-")}</td>
      <td>${escapeHtml(emp.departments?.department_name || "-")}</td>
      <td>${window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(emp.start_date) : emp.start_date}</td>
      <td><span class="status ${emp.status || "active"}">${emp.status === "inactive" ? "ปิดใช้งาน" : "ใช้งาน"}</span></td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn-light" onclick="openEmployeeDetail('${emp.id}')">
            <span class="material-symbols-outlined">analytics</span>ดูประวัติ
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

// ==========================================
// 5. EMPLOYEE DETAIL MODAL
// ==========================================
function openEmployeeDetail(employeeId) {
  const emp = employees.find((item) => item.id === employeeId);
  if (!emp) return;

  const requests = leaveRequests.filter((item) => item.employee_id === employeeId);
  const balances = leaveBalances.filter((item) => item.employee_id === employeeId);
  const modal = document.getElementById("employeeModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");

  const modalDownloadBtn = document.getElementById("modalDownloadBtn");
  if (modalDownloadBtn) {
    modalDownloadBtn.onclick = () => exportIndividualLeaveExcel(employeeId);
  }

  if (title) title.textContent = `${emp.employee_code || "-"} · ${emp.full_name || "-"}`;
  if (body) {
    body.innerHTML = `
      <div class="detail-grid">
        ${detail("ตำแหน่ง", emp.positions?.position_name || "-")}
        ${detail("แผนก", emp.departments?.department_name || "-")}
        ${detail("วันเริ่มงาน", window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(emp.start_date) : emp.start_date)}
        ${detail("เบอร์โทร", emp.phone || "-")}
        ${detail("อีเมล", emp.email || "-")}
        ${detail("Line ID", emp.line_id || "-")}
        ${detail("โรงพยาบาล", emp.hospital || "-")}
        ${detail("บัญชีธนาคาร", emp.bank_account || "-")}
        ${detail("ประเภทพนักงาน", emp.employment_type || "-")}
      </div>
      <section class="grid chart-grid">
        <article class="panel">
          <div class="panel-head"><h2>สิทธิคงเหลือ</h2></div>
          ${renderBalanceCards(balances)}
        </article>
        <article class="panel">
          <div class="panel-head"><h2>สรุปการลา (เฉพาะอนุมัติ)</h2></div>
          <div class="bars">${renderInlineBars(groupRequestsByType(requests))}</div>
        </article>
      </section>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ประเภท</th>
              <th>ช่วงวันที่</th>
              <th>จำนวน</th>
              <th>เหตุผล</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${requests.length ? requests.map(renderLeaveRow).join("") : `<tr><td colspan="5" class="empty">ยังไม่มีประวัติการลา</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }
  if (modal) modal.classList.add("open");
}

function closeEmployeeModal(event) {
  if (event && event.target.id !== "employeeModal") return;
  document.getElementById("employeeModal")?.classList.remove("open");
}

function detail(label, value) {
  return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderBalanceCards(rows) {
  if (!rows.length) return `<div class="empty">ยังไม่มีข้อมูลโควตาวันลา</div>`;
  return `<div class="detail-grid">${rows.map((row) => {
    const typeObj = getLeaveType(row.leave_type_id);
    const type = typeObj?.leave_name || "สิทธิการลา";
    
    const entitlement = Number(row.entitlement_days ?? typeObj?.yearly_quota ?? 0);
    const used = Number(row.used_days ?? 0);
    const remaining = row.remaining_days !== undefined ? Number(row.remaining_days) : (entitlement - used);

    return detail(type, `${remaining}/${entitlement} วัน`);
  }).join("")}</div>`;
}

function groupRequestsByType(requests) {
  const map = new Map();
  requests.forEach((request) => {
    if (String(request.status).toLowerCase() === "approved") {
      const type = getLeaveType(request.leave_type_id)?.leave_name || "ไม่ระบุ";
      map.set(type, (map.get(type) || 0) + Number(request.total_days || 0));
    }
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderInlineBars(rows) {
  if (!rows.length) return `<div class="empty">ไม่มีข้อมูลการลาที่อนุมัติ</div>`;
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return rows.map(([label, value]) => `
    <div class="bar-row">
      <strong>${escapeHtml(label)}</strong>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, Math.round((value / max) * 100))}%"></div></div>
      <span>${Number(value).toFixed(1).replace(/\.0$/, "")} วัน</span>
    </div>
  `).join("");
}

function renderLeaveRow(request) {
  const type = getLeaveType(request.leave_type_id)?.leave_name || "ไม่ระบุ";
  const startDate = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(request.start_date) : request.start_date;
  const endDate = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(request.end_date) : request.end_date;
  const statusLabel = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(request.status) : request.status;

  return `
    <tr>
      <td>${escapeHtml(type)}</td>
      <td>${startDate} - ${endDate}</td>
      <td>${request.total_days || 0} วัน</td>
      <td>${escapeHtml(request.reason || request.note || "-")}</td>
      <td><span class="status ${request.status || "pending"}">${statusLabel}</span></td>
    </tr>
  `;
}

// ==========================================
// 6. EXCEL EXPORT FUNCTIONS
// ==========================================

// 🎯 ส่งออก Excel ประวัติการลาภาพรวมทั้งหมด
async function exportAllLeaveHistoryExcel() {
  try {
    if (!employees?.length) await fetchEmployees();
    if (!leaveTypes?.length) await fetchLeaveTypes();
    if (!leaveRequests?.length) await fetchLeaveRequests();

    if (!leaveRequests?.length) {
      if (window.Swal) Swal.fire("ไม่พบข้อมูล", "ไม่มีรายการประวัติการลาในระบบ", "warning");
      else alert("ไม่มีรายการประวัติการลา");
      return;
    }

    if (typeof ExcelJS === "undefined") {
      alert("กรุณาติดตั้ง ExcelJS ใน HTML ก่อนครับ");
      return;
    }

    let exportMode = null;

    if (window.Swal) {
      const result = await Swal.fire({
        title: '📊 เลือกรูปแบบรายงาน Dashboard',
        html: `
          <div style="text-align: left; font-size: 15px; line-height: 1.6; font-family: Kanit, sans-serif;">
            <p style="margin-bottom: 10px;">กรุณาเลือกรูปแบบไฟล์ Excel ที่ต้องการดาวน์โหลด:</p>
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 12px;">
              <b style="color: #0f766e; font-size: 16px;">🖼️ แบบที่ 1: แบบมีรูปกราฟ</b><br>
              <span style="color: #475569; font-size: 13.5px;">ระบบจะสร้างกราฟแปะเป็นรูปภาพลงในไฟล์ให้อัตโนมัติ</span>
            </div>
            <div style="background: #f0f9ff; padding: 12px; border-radius: 8px; border: 1px solid #bae6fd;">
              <b style="color: #0369a1; font-size: 16px;">📈 แบบที่ 2: แบบตารางข้อมูลล้วน</b><br>
              <span style="color: #475569; font-size: 13.5px;">มีเฉพาะตารางสรุป คลุมดำตารางแล้วกด <b style="color: #000;">Alt + F1</b> ใน Excel</span>
            </div>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'ดาวน์โหลดแบบที่ 1 (มีรูปกราฟ)',
        denyButtonText: 'ดาวน์โหลดแบบที่ 2 (ตารางล้วน)',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#0f766e',
        denyButtonColor: '#0369a1',
        cancelButtonColor: '#94a3b8',
        width: '600px'
      });

      if (result.isConfirmed) exportMode = 'image';
      else if (result.isDenied) exportMode = 'table';
      else return;

      Swal.fire({
        title: 'กำลังสร้างไฟล์ Excel...',
        text: 'กรุณารอสักครู่ ระบบกำลังจัดเตรียมข้อมูล',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });
    } else {
      exportMode = confirm("กด OK เพื่อโหลดแบบที่ 1 (มีรูปกราฟ)\nกด Cancel เพื่อโหลดแบบที่ 2 (ตารางข้อมูลล้วน)") ? 'image' : 'table';
    }

    // Helper ย่อยสกัดข้อมูลคำขอลา
    const parseRequest = (req) => {
      let emp = req.employees || req.profiles || {};
      if (!emp.id && employees?.length) {
        const empId = req.employee_id || req.user_id || req.emp_id;
        emp = employees.find(e => String(e.id) === String(empId) || String(e.employee_code) === String(empId)) || {};
      }

      let deptName = "";
      if (Array.isArray(emp.departments)) deptName = emp.departments[0]?.department_name || emp.departments[0]?.name;
      else if (emp.departments && typeof emp.departments === 'object') deptName = emp.departments.department_name || emp.departments.name;
      deptName = deptName || emp.department || emp.dept_name || emp.department_name || req.department || "ไม่ระบุแผนก";

      let leaveName = "";
      if (req.leave_types) leaveName = req.leave_types.leave_name || req.leave_types.name;
      else if (req.leave_type_name) leaveName = req.leave_type_name;
      else {
        const typeId = req.leave_type_id || req.leave_id || req.type_id;
        const typeObj = (leaveTypes || []).find(t => String(t.id) === String(typeId));
        leaveName = typeObj?.leave_name || typeObj?.name || req.leave_type || "ไม่ระบุประเภท";
      }

      const days = Number(req.total_days ?? req.days ?? req.amount_days ?? req.num_days ?? 0);
      const rawStatus = String(req.status || req.approval_status || req.leave_status || '').toLowerCase().trim();
      const isApproved = ['approved', 'อนุมัติ', 'approved_manager', 'approved_director', 'pass'].includes(rawStatus) || rawStatus === '';

      return {
        empId: emp.id || req.employee_id || req.user_id || "unknown",
        empCode: emp.employee_code || emp.code || "-",
        empName: emp.full_name || emp.name || "ไม่ระบุชื่อ",
        deptName,
        leaveName,
        startDate: req.start_date || req.from_date || "-",
        endDate: req.end_date || req.to_date || "-",
        days,
        statusRaw: req.status || req.approval_status || "-",
        isApproved
      };
    };

    const workbook = new ExcelJS.Workbook();
    const deptStats = {};
    const empStats = {};
    const typeStats = {};

    leaveRequests.forEach((reqItem) => {
      const data = parseRequest(reqItem);
      const statusLower = String(data.statusRaw).toLowerCase();
      
      if (statusLower.includes('reject') || statusLower.includes('cancel') || statusLower.includes('ไม่อนุมัติ')) {
        return;
      }

      if (!deptStats[data.deptName]) deptStats[data.deptName] = { requests: 0, days: 0 };
      deptStats[data.deptName].requests += 1;
      deptStats[data.deptName].days += data.days;

      const empKey = `${data.empCode}|${data.empName}|${data.deptName}`;
      if (!empStats[empKey]) empStats[empKey] = { requests: 0, days: 0 };
      empStats[empKey].requests += 1;
      empStats[empKey].days += data.days;

      if (!typeStats[data.leaveName]) typeStats[data.leaveName] = { requests: 0, days: 0, uniqueEmps: new Set() };
      typeStats[data.leaveName].requests += 1;
      typeStats[data.leaveName].days += data.days;
      typeStats[data.leaveName].uniqueEmps.add(data.empId);
    });

    const sortedDepts = Object.entries(deptStats).sort((a, b) => b[1].days - a[1].days);
    const sortedEmps = Object.entries(empStats).sort((a, b) => b[1].days - a[1].days);
    const sortedTypes = Object.entries(typeStats).sort((a, b) => b[1].days - a[1].days);

    const generateChartImage = (labels, data, title, color) => {
      return new Promise((resolve) => {
        if (!window.Chart || exportMode !== 'image') { resolve(null); return; }

        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 350;
        canvas.style.display = 'none';
        document.body.appendChild(canvas);

        const customBg = {
          id: 'custom_canvas_bg',
          beforeDraw: (chart) => {
            const ctx = chart.canvas.getContext('2d');
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
          }
        };

        const chart = new Chart(canvas, {
          type: 'bar',
          data: { labels, datasets: [{ label: title, data, backgroundColor: color }] },
          plugins: [customBg],
          options: {
            animation: false,
            devicePixelRatio: 2,
            plugins: { title: { display: true, text: title, font: { size: 18 } }, legend: { display: false } }
          }
        });

        setTimeout(() => {
          const base64 = chart.toBase64Image();
          chart.destroy();
          document.body.removeChild(canvas);
          resolve(base64);
        }, 150);
      });
    };

    const addTip = (sheet) => {
      sheet.getCell('E1').value = "💡 ทริคสร้างกราฟ Excel แท้: ใช้เมาส์คลุมดำตารางข้อมูลด้านซ้ายทั้งหมด แล้วกดปุ่ม Alt + F1 บนคีย์บอร์ด";
      sheet.getCell('E1').font = { color: { argb: 'FF0F766E' }, bold: true };
    };

    // --- Sheet 1: ประวัติการลา (ทั้งหมด) ---
    const sheet1 = workbook.addWorksheet("ประวัติการลา (ทั้งหมด)", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
    sheet1.columns = [
      { header: "รหัสพนักงาน", key: "emp_code", width: 15 },
      { header: "ชื่อ-นามสกุล", key: "full_name", width: 25 },
      { header: "แผนก", key: "dept", width: 20 },
      { header: "ประเภทการลา", key: "leave_type", width: 18 },
      { header: "วันที่เริ่มลา", key: "start_date", width: 15 },
      { header: "วันที่สิ้นสุด", key: "end_date", width: 15 },
      { header: "จำนวนวัน", key: "days", width: 12 },
      { header: "สถานะ", key: "status", width: 15 }
    ];
    sheet1.getRow(1).font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    
    leaveRequests.forEach((reqItem) => {
      const data = parseRequest(reqItem);
      const statusLabel = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(data.statusRaw) : data.statusRaw;
      const row = sheet1.addRow({
        emp_code: data.empCode,
        full_name: data.empName,
        dept: data.deptName,
        leave_type: data.leaveName,
        start_date: data.startDate,
        end_date: data.endDate, 
        days: data.days,
        status: statusLabel
      });
      if (row.number % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    });

    // --- Sheet 2: สรุปตามแผนก ---
    const sheet2 = workbook.addWorksheet("สรุปตามแผนก", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
    sheet2.columns = [
      { header: "แผนก", key: "dept", width: 25 },
      { header: "จำนวนครั้งที่ลา", key: "requests", width: 18 },
      { header: "รวมจำนวนวัน", key: "days", width: 18 }
    ];
    sheet2.getRow(1).font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

    if (sortedDepts.length > 0) {
      sortedDepts.forEach(([dept, stats]) => sheet2.addRow({ dept, requests: stats.requests, days: stats.days }));
    } else {
      sheet2.addRow({ dept: "ไม่มีข้อมูลรายการที่บันทึก", requests: 0, days: 0 });
    }
    
    addTip(sheet2);
    if (exportMode === 'image' && sortedDepts.length > 0) {
      const deptBase64 = await generateChartImage(sortedDepts.map(d => d[0]), sortedDepts.map(d => d[1].days), 'รวมจำนวนวันลาตามแผนก', '#0F766E');
      if (deptBase64) sheet2.addImage(workbook.addImage({ base64: deptBase64, extension: 'png' }), { tl: { col: 4, row: 2 }, ext: { width: 600, height: 350 } });
    }

    // --- Sheet 3: สรุปรายบุคคล (Top) ---
    const sheet3 = workbook.addWorksheet("สรุปรายบุคคล (Top)", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
    sheet3.columns = [
      { header: "พนักงาน (รหัส-ชื่อ)", key: "emp_info", width: 35 },
      { header: "แผนก", key: "dept", width: 20 },
      { header: "จำนวนครั้งที่ลา", key: "requests", width: 18 },
      { header: "รวมจำนวนวัน", key: "days", width: 18 }
    ];
    sheet3.getRow(1).font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };

    if (sortedEmps.length > 0) {
      sortedEmps.forEach(([key, stats]) => {
        const [empCode, empName, deptName] = key.split('|');
        sheet3.addRow({ emp_info: `${empCode} - ${empName}`, dept: deptName, requests: stats.requests, days: stats.days });
      });
    } else {
      sheet3.addRow({ emp_info: "ไม่มีข้อมูลรายการที่บันทึก", dept: "-", requests: 0, days: 0 });
    }

    addTip(sheet3);
    if (exportMode === 'image' && sortedEmps.length > 0) {
      const topEmps = sortedEmps.slice(0, 10);
      const empBase64 = await generateChartImage(topEmps.map(e => e[0].split('|')[1]), topEmps.map(e => e[1].days), 'Top 10 พนักงานที่ลาเยอะที่สุด', '#D97706');
      if (empBase64) sheet3.addImage(workbook.addImage({ base64: empBase64, extension: 'png' }), { tl: { col: 5, row: 2 }, ext: { width: 600, height: 350 } });
    }

    // --- Sheet 4: สรุปตามประเภท ---
    const sheet4 = workbook.addWorksheet("สรุปตามประเภท", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
    sheet4.columns = [
      { header: "ประเภทการลา", key: "leave_type", width: 25 },
      { header: "จำนวนคนลา (คน)", key: "users", width: 20 },
      { header: "รวมจำนวนวัน", key: "days", width: 18 }
    ];
    sheet4.getRow(1).font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet4.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } };

    if (sortedTypes.length > 0) {
      sortedTypes.forEach(([type, stats]) => sheet4.addRow({ leave_type: type, users: stats.uniqueEmps.size, days: stats.days }));
    } else {
      sheet4.addRow({ leave_type: "ไม่มีข้อมูลรายการที่บันทึก", users: 0, days: 0 });
    }
    
    addTip(sheet4);
    if (exportMode === 'image' && sortedTypes.length > 0) {
      const typeBase64 = await generateChartImage(sortedTypes.map(t => t[0]), sortedTypes.map(t => t[1].days), 'จำนวนวันลาตามประเภท', '#8B5CF6');
      if (typeBase64) sheet4.addImage(workbook.addImage({ base64: typeBase64, extension: 'png' }), { tl: { col: 4, row: 2 }, ext: { width: 600, height: 350 } });
    }

    // Border และ Font Formatting
    [sheet1, sheet2, sheet3, sheet4].forEach(sheet => {
      sheet.eachRow((row) => row.eachCell((cell) => {
        if (!cell.border) cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        if (!cell.font) cell.font = { name: 'Sarabun', size: 11 };
      }));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PVT_Leave_Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);

    if (window.Swal) Swal.close(); 

  } catch (error) {
    console.error("Export ExcelJS Error:", error);
    if (window.Swal) Swal.fire("ข้อผิดพลาด", "ไม่สามารถสร้างไฟล์ Excel ได้", "error");
    else alert("ข้อผิดพลาด: ไม่สามารถสร้างไฟล์ Excel ได้");
  }
}

// 🎯 ส่งออก Excel ประวัติการลารายบุคคล
async function exportIndividualLeaveExcel(employeeId) {
  const emp = employees.find((item) => String(item.id) === String(employeeId));
  if (!emp) {
    if (window.Swal) Swal.fire("ไม่พบข้อมูล", "ไม่พบข้อมูลพนักงานในระบบ", "error");
    else alert("ไม่พบข้อมูลพนักงาน");
    return;
  }

  if (!leaveRequests.length) await fetchLeaveRequests();
  if (!leaveBalances.length) await fetchLeaveBalances();

  const userRequests = leaveRequests.filter((item) => String(item.employee_id) === String(employeeId));
  const userBalances = leaveBalances.filter((item) => String(item.employee_id) === String(employeeId));

  const empCode = emp.employee_code || "-";
  const empName = emp.full_name || "-";
  const deptName = emp.departments?.department_name || "-";
  const posName = emp.positions?.position_name || "-";
  const todayStr = new Date().toISOString().slice(0, 10);
  const fileName = `Leave_History_${empCode}_${todayStr}.xlsx`;

  if (typeof ExcelJS !== "undefined") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("ประวัติการลา", {
      views: [{ state: "frozen", xSplit: 0, ySplit: 11 }]
    });

    // Header ชื่อรายงาน
    sheet.mergeCells("A1:G1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `รายงานประวัติการลาส่วนบุคคล (Individual Leave Report)`;
    titleCell.font = { name: "Sarabun", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    sheet.getRow(1).height = 32;

    // ข้อมูลพนักงาน
    sheet.getCell("A3").value = "รหัสพนักงาน:";
    sheet.getCell("B3").value = empCode;
    sheet.getCell("D3").value = "ชื่อ-นามสกุล:";
    sheet.getCell("E3").value = empName;

    sheet.getCell("A4").value = "แผนก:";
    sheet.getCell("B4").value = deptName;
    sheet.getCell("D4").value = "ตำแหน่ง:";
    sheet.getCell("E4").value = posName;

    ["A3", "D3", "A4", "D4"].forEach((c) => {
      sheet.getCell(c).font = { name: "Sarabun", bold: true, color: { argb: "FF334155" } };
    });
    ["B3", "E3", "B4", "E4"].forEach((c) => {
      sheet.getCell(c).font = { name: "Sarabun", color: { argb: "FF0F172A" } };
    });

    // สรุปโควตาวันลาคงเหลือ
    sheet.getCell("A6").value = "📊 สรุปสิทธิวันลาคงเหลือประจำปี";
    sheet.getCell("A6").font = { name: "Sarabun", size: 11, bold: true, color: { argb: "FF0F766E" } };

    const quotaHeaders = ["ประเภทการลา", "สิทธิทั้งหมด (วัน)", "ใช้ไป (วัน)", "คงเหลือ (วัน)", "รูปแบบการแสดงผล"];
    const quotaHeaderRow = sheet.getRow(7);
    quotaHeaderRow.values = quotaHeaders;
    quotaHeaderRow.font = { name: "Sarabun", size: 10, bold: true, color: { argb: "FF1E293B" } };
    quotaHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

    let quotaRowIndex = 8;
    if (userBalances.length) {
      userBalances.forEach((b) => {
        const typeObj = getLeaveType(b.leave_type_id);
        const typeName = typeObj?.leave_name || "ไม่ระบุประเภท";
        const entitlement = Number(b.entitlement_days ?? typeObj?.yearly_quota ?? 0);
        const used = Number(b.used_days ?? 0);
        const remaining = b.remaining_days !== undefined ? Number(b.remaining_days) : entitlement - used;

        const qRow = sheet.getRow(quotaRowIndex);
        qRow.values = [typeName, entitlement, used, remaining, `${remaining}/${entitlement} วัน`];
        qRow.font = { name: "Sarabun", size: 10 };
        qRow.getCell(2).alignment = { horizontal: "right" };
        qRow.getCell(3).alignment = { horizontal: "right" };
        qRow.getCell(4).alignment = { horizontal: "right" };
        qRow.getCell(5).alignment = { horizontal: "center" };

        quotaRowIndex++;
      });
    } else {
      sheet.getCell("A8").value = "ไม่มีข้อมูลโควตาวันลา";
      sheet.getCell("A8").font = { name: "Sarabun", italic: true, color: { argb: "FF94A3B8" } };
      quotaRowIndex = 9;
    }

    // ตารางประวัติการลา
    const historyStartRow = quotaRowIndex + 1;
    sheet.getCell(`A${historyStartRow}`).value = "📋 รายละเอียดประวัติการลาทั้งหมด";
    sheet.getCell(`A${historyStartRow}`).font = { name: "Sarabun", size: 11, bold: true, color: { argb: "FF0F766E" } };

    const tableHeaderRowIndex = historyStartRow + 1;
    const historyHeaders = ["ประเภทการลา", "วันที่เริ่มลา", "วันที่สิ้นสุด", "จำนวน (วัน)", "เหตุผล/หมายเหตุ", "สถานะคำขอ", "วันที่ยื่นคำขอ"];
    const historyHeaderRow = sheet.getRow(tableHeaderRowIndex);
    historyHeaderRow.values = historyHeaders;
    historyHeaderRow.font = { name: "Sarabun", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
    historyHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    historyHeaderRow.height = 24;

    let historyRowIndex = tableHeaderRowIndex + 1;

    if (!userRequests.length) {
      sheet.mergeCells(`A${historyRowIndex}:G${historyRowIndex}`);
      const emptyCell = sheet.getCell(`A${historyRowIndex}`);
      emptyCell.value = "ยังไม่มีประวัติการลาในระบบ";
      emptyCell.alignment = { horizontal: "center" };
      emptyCell.font = { name: "Sarabun", italic: true, color: { argb: "FF94A3B8" } };
    } else {
      userRequests.forEach((req, idx) => {
        const type = getLeaveType(req.leave_type_id)?.leave_name || "ไม่ระบุประเภท";
        const statusTxt = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(req.status) : req.status;
        const startDate = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(req.start_date) : req.start_date;
        const endDate = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(req.end_date) : req.end_date;
        const createdAt = req.created_at ? req.created_at.slice(0, 10) : "-";

        const row = sheet.getRow(historyRowIndex);
        row.values = [
          type,
          startDate,
          endDate,
          Number(req.total_days || 0),
          req.reason || req.note || "-",
          statusTxt,
          createdAt,
        ];

        row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
        row.getCell(2).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(3).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(4).alignment = { vertical: "middle", horizontal: "right" };
        row.getCell(5).alignment = { vertical: "middle", horizontal: "left" };
        row.getCell(6).alignment = { vertical: "middle", horizontal: "center" };
        row.getCell(7).alignment = { vertical: "middle", horizontal: "center" };

        if (idx % 2 === 1) {
          row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }

        const statusCell = row.getCell(6);
        const reqStatus = String(req.status || "").toLowerCase();
        if (reqStatus === "approved") {
          statusCell.font = { name: "Sarabun", color: { argb: "FF15803D" }, bold: true };
        } else if (reqStatus === "pending") {
          statusCell.font = { name: "Sarabun", color: { argb: "FFD97706" }, bold: true };
        } else if (reqStatus === "rejected") {
          statusCell.font = { name: "Sarabun", color: { argb: "FFDC2626" }, bold: true };
        }

        historyRowIndex++;
      });
    }

    sheet.columns = [
      { width: 22 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
      { width: 32 },
      { width: 16 },
      { width: 16 },
    ];

    sheet.eachRow((row, rowNumber) => {
      if ((rowNumber >= 7 && rowNumber < historyStartRow) || rowNumber >= tableHeaderRowIndex) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          if (!cell.font) cell.font = { name: "Sarabun", size: 10 };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    return;
  }

  // Fallback กรณีไม่มี ExcelJS
  const rows = userRequests.map((request) => {
    const type = getLeaveType(request.leave_type_id) || {};
    return {
      "รหัสพนักงาน": emp.employee_code || "",
      "ชื่อ-นามสกุล": emp.full_name || "",
      "แผนก": emp.departments?.department_name || "",
      "ตำแหน่ง": emp.positions?.position_name || "",
      "ประเภทการลา": type.leave_name || "",
      "วันที่เริ่มลา": request.start_date || "",
      "วันที่สิ้นสุด": request.end_date || "",
      "จำนวนวัน": Number(request.total_days || 0),
      "เหตุผล": request.reason || request.note || "",
      "สถานะ": window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(request.status) : request.status,
      "วันที่ส่งคำขอ": request.created_at || "",
    };
  });

  if (window.XLSX) {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "ประวัติการลา");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    return;
  }

  const csv = toCsv(rows);
  if (window.pvtSupabase?.downloadBlob) {
    window.pvtSupabase.downloadBlob(`${fileName}.csv`, csv, "text/csv;charset=utf-8");
  } else {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${fileName}.csv`;
    link.click();
  }
}

// ==========================================
// 7. GENERAL UTILITIES
// ==========================================
function getSb() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) throw new Error("ไม่พบการเชื่อมต่อ Supabase");
  return sb;
}

function getLeaveType(id) {
  return leaveTypes.find((type) => String(type.id) === String(id));
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`).join(","));
  return `\uFEFF${headers.join(",")}\n${body.join("\n")}`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return window.pvtSupabase?.escapeHtml ? window.pvtSupabase.escapeHtml(value) : String(value ?? "");
}