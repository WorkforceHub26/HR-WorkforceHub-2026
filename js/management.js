/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - INTEGRATED HR MANAGEMENT & DASHBOARD SYSTEM
 * [FULL INTEGRATED, BUG-FIXED EDITION - 2026]
 * ==========================================================================
 */

// ==========================================
// 0. CONFIGURATION & REAL CREDENTIALS
// ==========================================
const SUPABASE_URL = "https://pgogmhqjdchakcytsomx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRsomxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

window.PVT_SUPABASE_URL = SUPABASE_URL;
window.PVT_SUPABASE_ANON_KEY = SUPABASE_KEY;

function showAppError(title, message) {
  console.error(`❌ [${title}]:`, message);
  if (window.Swal) {
    Swal.fire({
      icon: 'error',
      title: title || 'เกิดข้อผิดพลาด',
      text: String(message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุในการทำงานของระบบ'),
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#ef4444'
    });
  } else {
    alert(`❌ ${title}\n${message}`);
  }
}

// ==========================================
// 1. PVT SUPABASE MODULE DEFINITION
// ==========================================
window.pvtSupabase = (() => {
  let client = null;

  function getClient() {
    if (client) return client;
    if (window.supabaseClient) {
      client = window.supabaseClient;
      return client;
    }
    if (typeof supabase === 'undefined' || !supabase?.createClient) {
      console.warn("⚠️ Supabase SDK ยังไม่ได้โหลดบนหน้าเว็บ");
      return null;
    }
    try {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
        global: { headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' } }
      });
      window.supabaseClient = client;
      return client;
    } catch (err) {
      showAppError("ข้อผิดพลาดการเชื่อมต่อ Supabase", err.message);
      return null;
    }
  }

  async function getSession() {
    const sb = getClient();
    if (!sb?.auth) return null;
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      return data?.session || null;
    } catch (err) {
      console.error("Get Session Error:", err);
      return null;
    }
  }

  function getCachedUser() {
    try {
      return JSON.parse(localStorage.getItem("currentUser") || "null");
    } catch {
      return null;
    }
  }

  async function getCurrentProfile() {
    const sb = getClient();
    if (!sb) return null;

    try {
      const cached = getCachedUser();
      if (cached?.id || cached?.employee_code) {
        const query = sb
          .from("employees")
          .select(`
            id, employee_code, full_name, nickname, phone, email, hospital,
            bank_account, line_id, image_url, start_date, status, role,
            employment_type, department_id, position_id,
            departments(department_name),
            positions(position_name)
          `);

        const { data: employee, error } = cached.id
          ? await query.eq("id", cached.id).maybeSingle()
          : await query.eq("employee_code", cached.employee_code).maybeSingle();

        if (error) console.warn("Fetch cached employee error:", error);

        const emp = employee || cached;
        return {
          id: cached.auth_id || cached.profile_id || emp.id,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          display_name: emp.full_name,
          role: emp.role || cached.role || "user",
          status: emp.status || "active",
          employees: emp,
        };
      }

      const session = await getSession();
      if (!session?.user) return null;

      const { data: profile, error } = await sb
        .from("profiles")
        .select("id, employee_id, email, username, display_name, role, status")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error || !profile) return null;
      if (!profile.employee_id) return profile;

      const { data: employee } = await sb
        .from("employees")
        .select(`
          id, employee_code, full_name, nickname, phone, email, hospital,
          bank_account, line_id, image_url, start_date, status, role,
          employment_type, department_id, position_id,
          departments(department_name),
          positions(position_name)
        `)
        .eq("id", profile.employee_id)
        .maybeSingle();

      return { ...profile, employees: employee };
    } catch (err) {
      console.error("getCurrentProfile Exception:", err);
      return null;
    }
  }

  function toISODate(input) {
    if (!input) return null;
    const value = String(input).trim();
    if (!value) return null;
    if (value.includes("/")) {
      const [rawDay, rawMonth, rawYear] = value.split("/");
      if (!rawDay || !rawMonth || !rawYear) return null;
      let year = Number(rawYear);
      if (year > 2400) year -= 543;
      return `${year}-${rawMonth.padStart(2, "0")}-${rawDay.padStart(2, "0")}`;
    }
    if (value.includes("-")) {
      const parts = value.split("-");
      if (parts.length < 3) return value;
      let year = Number(parts[0]);
      if (year > 2400) year -= 543;
      return `${year}-${parts[1].padStart(2, "0")}-${parts[2].substring(0, 2).padStart(2, "0")}`;
    }
    return null;
  }

  function formatThaiDate(dateValue) {
    if (!dateValue) return "-";
    const cleanDateStr = String(dateValue).trim().split("T")[0];
    const date = new Date(`${cleanDateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return new Intl.DateTimeFormat("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function statusLabel(status) {
    return {
      pending: "รออนุมัติ",
      approved: "อนุมัติแล้ว",
      rejected: "ไม่อนุมัติ",
      cancelled: "ยกเลิก",
    }[status] || status || "-";
  }

  function getAvatarUrl(imageUrl) {
    if (!imageUrl) return "/assets/img/default-avatar.jpg";
    let url = String(imageUrl).trim();
    if (!url) return "/assets/img/default-avatar.jpg";
    if (!url.startsWith("http")) {
      url = `${SUPABASE_URL}/storage/v1/object/public/employee-images/${url}`;
    }
    return url.replace("storage/v1/object/", "storage/v1/object/public/");
  }

  function downloadBlob(filename, content, mimeType = "text/plain;charset=utf-8") {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return {
    getClient,
    getSession,
    getCachedUser,
    getCurrentProfile,
    toISODate,
    formatThaiDate,
    escapeHtml,
    statusLabel,
    getAvatarUrl,
    downloadBlob,
  };
})();

window.pvtSupabase.getClient();

// ==========================================
// 2. GLOBAL STATE & INITIALIZATION
// ==========================================
let employees = [];
let leaveRequests = [];
let leaveBalances = [];
let leaveTypes = [];

document.addEventListener("DOMContentLoaded", async () => {
  console.clear();
  console.group("🚀 [SYSTEM BOOT] เริ่มต้นโหลดระบบจัดการ HR และ Dashboard");
  console.time("⏱️ เวลาที่ใช้ในการ Boot ระบบทั้งหมด");

  const authSuccess = await initManagementSystem();

  if (authSuccess || document.getElementById("employeeTableBody")) {
    await refreshDashboard();
  }

  console.timeEnd("⏱️ เวลาที่ใช้ในการ Boot ระบบทั้งหมด");
  console.groupEnd();
});

function handleLogout() {
  if (window.Swal) {
    Swal.fire({
      title: 'ยืนยันการออกจากระบบ?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.clear();
        localStorage.clear();
        window.location.href = '/pages/index.html';
      }
    });
  } else {
    localStorage.clear();
    localStorage.clear();
    window.location.href = '/pages/index.html';
  }
}

// ==========================================
// 3. SUPABASE CONNECTOR & AUDIT LOGS
// ==========================================
function getSupabase() {
  const client = window.pvtSupabase?.getClient();
  if (client && typeof client.from === 'function') {
    return client;
  }
  if (window.supabaseClient && typeof window.supabaseClient.from === 'function') {
    return window.supabaseClient;
  }
  return null;
}

function escapeHtml(str) {
  if (window.pvtSupabase?.escapeHtml) {
    return window.pvtSupabase.escapeHtml(str);
  }
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function getLeaveType(typeId) {
  return leaveTypes.find(t => String(t.id) === String(typeId)) || null;
}

async function initManagementSystem() {
  const supabase = getSupabase();
  if (!supabase) {
    showAppError("ไม่พบการเชื่อมต่อ", "ไม่สามารถเริ่มทำงานระบบได้เนื่องจากไม่ได้เชื่อมต่อ Supabase");
    return false;
  }

  try {
    let profile = await window.pvtSupabase?.getCurrentProfile?.();

    if (!profile) {
      const savedUser = localStorage.getItem("currentUser");
      if (savedUser) {
        try { profile = JSON.parse(savedUser); } catch {}
      }
    }

    if (!profile) {
      if (window.Swal) {
        await Swal.fire({
          icon: 'error',
          title: 'เซสชันหมดอายุหรือยังไม่ได้ล็อกอิน',
          text: 'กรุณาเข้าสู่ระบบผ่านหน้าล็อกอินก่อนเข้าใช้งาน',
          confirmButtonText: 'ไปหน้าเข้าสู่ระบบ'
        });
      } else {
        alert('เซสชันหมดอายุหรือยังไม่ได้ล็อกอิน กรุณาเข้าสู่ระบบก่อน');
      }
      window.location.href = '/pages/index.html';
      return false;
    }

    const userRole = profile.role ? profile.role.toLowerCase() : 'user';
    if (userRole !== 'admin' && userRole !== 'hr' && userRole !== 'it' && userRole !== 'user') {
      showAppError("ไม่มีสิทธิ์เข้าใช้งาน", "หน้านี้สงวนไว้สำหรับ HR, Admin และ IT เท่านั้น");
      return false;
    }

    return true;
  } catch (err) {
    showAppError("เกิดข้อผิดพลาดในการตรวจสอบระบบเริ่มต้น", err.message);
    return false;
  }
}

async function saveHRActivityLog(moduleName, actionType, targetId, detailText) {
  const supabase = getSupabase();
  if (!supabase || typeof supabase.from !== 'function') return;

  try {
    const { error } = await supabase
      .from('hr_activity_logs')
      .insert([
        {
          module: moduleName,
          action: actionType,
          target_id: String(targetId || ''),
          details: detailText,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.warn("⚠️ Save Log Warning:", error.message);
    }
  } catch (err) {
    console.warn("⚠️ Log Exception:", err.message);
  }
}

async function viewAuditLogs() {
  const supabase = getSupabase();
  if (!supabase) {
    showAppError("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อฐานข้อมูลเพื่อดึงประวัติได้");
    return;
  }

  try {
    if (window.Swal) {
      Swal.fire({ title: 'กำลังโหลดประวัติการปรับปรุงระบบ...', didOpen: () => Swal.showLoading() });
    }

    const { data: logs, error } = await supabase
      .from('hr_activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    let logTableHTML = `
      <div style="max-height: 400px; overflow-y: auto; font-family:'Sarabun', sans-serif; text-align:left; font-size:12px;">
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
              <th style="padding:6px; border:1px solid #cbd5e1;">เวลา</th>
              <th style="padding:6px; border:1px solid #cbd5e1;">โมดูล</th>
              <th style="padding:6px; border:1px solid #cbd5e1;">การกระทำ</th>
              <th style="padding:6px; border:1px solid #cbd5e1;">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (!logs || logs.length === 0) {
      logTableHTML += `<tr><td colspan="4" style="text-align:center; padding:15px; color:#64748b;">ไม่พบประวัติการแก้ไขระบบ</td></tr>`;
    } else {
      logs.forEach(l => {
        const timeStr = new Date(l.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
        logTableHTML += `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:6px; border:1px solid #cbd5e1; white-space:nowrap;">${timeStr}</td>
            <td style="padding:6px; border:1px solid #cbd5e1;"><b>${escapeHtml(l.module || 'System')}</b></td>
            <td style="padding:6px; border:1px solid #cbd5e1;"><span style="background:#e2e8f0; padding:2px 4px; border-radius:4px;">${escapeHtml(l.action || '-')}</span></td>
            <td style="padding:6px; border:1px solid #cbd5e1;">${escapeHtml(l.details || '-')}</td>
          </tr>
        `;
      });
    }

    logTableHTML += `</tbody></table></div>`;

    if (window.Swal) {
      Swal.fire({
        title: '📜 ประวัติการแก้ไขระบบ (Audit Logs)',
        html: logTableHTML,
        width: 'min(92vw, 750px)',
        confirmButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#0d9488'
      });
    }

  } catch (err) {
    showAppError("ไม่สามารถดึงประวัติ Audit Log ได้", err.message);
  }
}

async function resetYearlyLeave() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const confirm = await Swal.fire({
    title: '🚨 เตือนความปลอดภัย: ล้างโควตาประจำปี',
    html: `คุณกำลังจะทำการรีเซ็ตและสร้างโควตาวันลาสำหรับปี <b>${nextYear}</b><br><span style="color:#ef4444; font-size:12px;">การดำเนินการนี้จะมีผลกับพนักงานทุกคนในระบบ!</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ยืนยันการตั้งค่าโควตาปีใหม่',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444'
  });

  if (!confirm.isConfirmed) return;

  try {
    Swal.fire({ title: 'กำลังประมวลผลโควตาปีใหม่...', didOpen: () => Swal.showLoading() });

    if (!employees.length) await fetchEmployees();
    if (!leaveTypes.length) await fetchLeaveTypes();

    let newBalances = [];
    employees.forEach(emp => {
      leaveTypes.forEach(t => {
        newBalances.push({
          employee_id: emp.id,
          leave_type_id: t.id,
          year: nextYear,
          entitlement_days: t.yearly_quota || 0,
          used_days: 0,
          remaining_days: t.yearly_quota || 0
        });
      });
    });

    const { error } = await supabase.from('leave_balances').upsert(newBalances, { onConflict: 'employee_id,leave_type_id,year' });
    if (error) throw error;

    await saveHRActivityLog('LEAVE_QUOTA', 'RESET', `Year ${nextYear}`, `ล้างและรีเซ็ตโควตาวันลาเข้าสู่ปี ${nextYear}`);
    Swal.fire('สำเร็จ!', `สร้างและปรับปรุงโควตาวันลาประจำปี ${nextYear} เรียบร้อยแล้ว`, 'success');
    await refreshDashboard();

  } catch (err) {
    showAppError("ไม่สามารถล้างโควตาได้", err.message);
  }
}

// ==========================================
// 4. DASHBOARD MAIN CONTROLLER & FETCHING
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
    showAppError("เกิดข้อผิดพลาดในการโหลดแดชบอร์ด", error.message);
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

async function fetchAllPaginated(tableName, selectQuery, orderColumn, ascending = true) {
  const sb = getSupabase();
  if (!sb) return [];

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
  try {
    const query = `
      id, employee_code, full_name, nickname, phone, email, hospital,
      bank_account, line_id, image_url, start_date, status, role,
      employment_type, department_id, position_id, departments(department_name), positions(position_name)
    `;
    employees = await fetchAllPaginated("employees", query, "employee_code", true);
  } catch (err) {
    showAppError("ดึงข้อมูลพนักงานล้มเหลว", err.message);
  }
}

async function fetchLeaveRequests() {
  try {
    const query = `
      id, employee_id, leave_type_id, start_date, end_date, total_days, reason,
      attachment_url, status, approved_at, approval_comment, start_period, end_period,
      leave_hours, note, manager_status, director_status, is_over_quota, created_at
    `;
    leaveRequests = await fetchAllPaginated("leave_requests", query, "created_at", false);
  } catch (err) {
    showAppError("ดึงคำขอการลาล้มเหลว", err.message);
  }
}

async function fetchLeaveTypes() {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const { data, error } = await sb
      .from("leave_types")
      .select("id, leave_code, leave_name, yearly_quota, require_advance_days, max_days_per_request, paid_leave")
      .order("leave_name", { ascending: true });

    if (error) throw error;
    leaveTypes = data || [];
  } catch (err) {
    showAppError("ดึงประเภทวันลาล้มเหลว", err.message);
  }
}

async function fetchLeaveBalances() {
  const sb = getSupabase();
  if (!sb) return;

  try {
    const year = new Date().getFullYear();
    const { data, error } = await sb
      .from("leave_balances")
      .select("id, employee_id, leave_type_id, year, entitlement_days, used_days, remaining_days")
      .eq("year", year);

    if (error) throw error;
    leaveBalances = data || [];
  } catch (err) {
    console.warn("leave_balances unavailable", err);
    leaveBalances = [];
  }
}

// ==========================================
// 5. UI RENDERERS & FILTERS
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
      <td>${window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(emp.start_date) : (emp.start_date || "-")}</td>
      <td><span class="status ${emp.status || "active"}">${emp.status === "inactive" || emp.status === "resigned" ? "ลาออก" : "ใช้งาน"}</span></td>
      <td style="text-align: center; white-space: nowrap;">
        <button class="btn-light btn-sm" onclick="openEmployeeDetail('${emp.id}')" title="ดูรายละเอียด / แก้ไขข้อมูล">
          <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">analytics</span> ดูรายละเอียด
        </button>
        <button class="btn-light btn-sm danger-zone" 
                onclick="deleteEmployee('${emp.id}', '${escapeHtml(emp.employee_code)}', '${escapeHtml(emp.full_name)}')" 
                style="margin-left: 4px; padding: 0.4rem 0.6rem; background: #fff1f2; color: #e11d48; border-color: #fecdd3;" 
                title="ลบพนักงานถาวร">
          <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">delete</span>
        </button>
      </td>
    </tr>
  `).join("");
}

// ==========================================
// 6. EMPLOYEE DETAIL MODAL & EXPORT
// ==========================================
function formatEmploymentType(typeStr) {
  if (!typeStr || typeStr === "-" || typeStr === "null") return "ไม่ระบุ";
  const str = String(typeStr).toLowerCase().trim();

  if (str.includes("full") || str.includes("ประจำ")) return "พนักงานประจำ (Full-time)";
  if (str.includes("part") || str.includes("พาร์ทไทม์")) return "พนักงานพาร์ทไทม์ (Part-time)";
  if (str.includes("contract") || str.includes("สัญญาจ้าง")) return "พนักงานสัญญาจ้าง (Contract)";
  if (str.includes("intern") || str.includes("ฝึกงาน")) return "นักศึกษาฝึกงาน (Intern)";

  return typeStr;
}

function exportIndividualLeaveExcel(employeeId) {
  const emp = employees.find((item) => String(item.id) === String(employeeId));
  if (!emp) {
    showAppError("ไม่พบข้อมูล", "ไม่พบข้อมูลพนักงานสำหรับส่งออก Excel");
    return;
  }

  const requests = leaveRequests.filter((item) => String(item.employee_id) === String(employeeId));
  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += `รหัสพนักงาน,ชื่อ-นามสกุล,แผนก,ประเภทการลา,วันที่เริ่มต้น,วันที่สิ้นสุด,จำนวนวัน,เหตุผล,สถานะ\n`;

  requests.forEach((r) => {
    const type = getLeaveType(r.leave_type_id)?.leave_name || "ไม่ระบุ";
    const status = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(r.status) : r.status;
    const cleanReason = (r.reason || r.note || '').replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
    csvContent += `"${emp.employee_code || ''}","${emp.full_name || ''}","${emp.departments?.department_name || ''}","${type}","${r.start_date || ''}","${r.end_date || ''}","${r.total_days || 0}","${cleanReason}","${status}"\n`;
  });

  const filename = `ประวัติการลา_${emp.employee_code}_${emp.full_name}.csv`;
  window.pvtSupabase.downloadBlob(filename, csvContent, "text/csv;charset=utf-8;");
}

function openEmployeeDetail(employeeId, isEditMode = false) {
  const emp = employees.find((item) => String(item.id) === String(employeeId));
  if (!emp) return;

  const requests = leaveRequests.filter((item) => String(item.employee_id) === String(employeeId));
  const balances = leaveBalances.filter((item) => String(item.employee_id) === String(employeeId));
  const modal = document.getElementById("employeeModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");

  const modalDownloadBtn = document.getElementById("modalDownloadBtn");
  if (modalDownloadBtn) {
    modalDownloadBtn.onclick = () => exportIndividualLeaveExcel(employeeId);
  }

  if (!isEditMode) {
    if (title) {
      title.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span>${escapeHtml(emp.employee_code || "-")} · ${escapeHtml(emp.full_name || "-")}</span>
          <button class="btn-light btn-sm" onclick="openEmployeeDetail('${emp.id}', true)" title="แก้ไขข้อมูลพนักงาน" style="padding: 4px 10px; font-size:12px;">
            <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">edit</span> กดแก้ไขข้อมูล
          </button>
        </div>
      `;
    }

    if (body) {
      body.innerHTML = `
        <div class="detail-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px;">
          ${detail("ตำแหน่ง", emp.positions?.position_name || "-")}
          ${detail("แผนก", emp.departments?.department_name || "-")}
          ${detail("วันเริ่มงาน", window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(emp.start_date) : (emp.start_date || "-"))}
          ${detail("เบอร์โทร", emp.phone || "-")}
          ${detail("อีเมล", emp.email || "-")}
          ${detail("Line ID", emp.line_id || "-")}
          ${detail("โรงพยาบาล", emp.hospital || "-")}
          ${detail("บัญชีธนาคาร", emp.bank_account || "-")}
          ${detail("ประเภทพนักงาน", formatEmploymentType(emp.employment_type))}
        </div>

        <div style="margin-bottom:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="font-size:14px;">📊 สิทธิวันลาคงเหลือประจำปี</strong>
            <button class="btn-light btn-sm" onclick="editIndividualLeaveBalance('${escapeHtml(emp.employee_code)}')" style="font-size:12px;">
              ⚙️ ปรับสิทธิ์พิเศษ
            </button>
          </div>
          ${renderBalanceCards(balances)}
        </div>

        <div>
          <strong style="font-size:14px; display:block; margin-bottom:8px;">📋 ประวัติการลาทั้งหมด</strong>
          <div style="max-height:250px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px;">
            <table style="width:100%; font-size:13px; text-align:left; border-collapse:collapse;">
              <thead style="background:#f8fafc; sticky:top;">
                <tr>
                  <th style="padding:8px;">ประเภท</th>
                  <th style="padding:8px;">วันที่</th>
                  <th style="padding:8px;">จำนวน</th>
                  <th style="padding:8px;">เหตุผล</th>
                  <th style="padding:8px;">สถานะ</th>
                  <th style="padding:8px; text-align:center;">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                ${requests.length ? requests.map(renderLeaveRow).join("") : '<tr><td colspan="6" class="empty">ไม่มีประวัติการลา</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } else {
    if (title) {
      title.innerHTML = `<span>✏️ แก้ไขข้อมูลพนักงาน: ${escapeHtml(emp.full_name || "-")}</span>`;
    }

    const supabase = getSupabase();
    Promise.all([
      supabase ? supabase.from('departments').select('id, department_name') : Promise.resolve({ data: [] }),
      supabase ? supabase.from('positions').select('id, position_name') : Promise.resolve({ data: [] })
    ]).then(([{ data: depts }, { data: roles }]) => {
      const deptOptions = depts?.map(d => `<option value="${d.id}" ${String(d.id) === String(emp.department_id) ? 'selected' : ''}>${escapeHtml(d.department_name)}</option>`).join('') || '';
      const roleOptions = roles?.map(r => `<option value="${r.id}" ${String(r.id) === String(emp.position_id) ? 'selected' : ''}>${escapeHtml(r.position_name)}</option>`).join('') || '';

      if (body) {
        body.innerHTML = `
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; text-align:left; font-family:'Sarabun', sans-serif;">
            <div style="grid-column: 1 / -1; text-align: center; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px dashed #cbd5e1;">
              <img id="inlineEditPreview" src="${window.pvtSupabase?.getAvatarUrl ? window.pvtSupabase.getAvatarUrl(emp.image_url) : 'https://placehold.co/100?text=No+Image'}" 
                   style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #0d9488; margin-bottom: 8px; background: #fff;">
              <input type="file" id="inline-edit-img" class="select-input" accept="image/*" style="display: block; margin: 0 auto; font-size: 12px;" onchange="if(this.files[0]) document.getElementById('inlineEditPreview').src = URL.createObjectURL(this.files[0]);">
            </div>

            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">รหัสพนักงาน *</label>
              <input id="inline-edit-code" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.employee_code || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">คำนำหน้า</label>
              <select id="inline-edit-title" class="select-input" style="width:100%; padding:0.5rem; margin-top:4px;">
                <option value="" ${!emp.title ? 'selected' : ''}>เลือกคำนำหน้า...</option>
                <option value="นาย" ${emp.title === 'นาย' ? 'selected' : ''}>นาย</option>
                <option value="นาง" ${emp.title === 'นาง' ? 'selected' : ''}>นาง</option>
                <option value="นางสาว" ${emp.title === 'นางสาว' ? 'selected' : ''}>นางสาว</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">ชื่อ-นามสกุลจริง *</label>
              <input id="inline-edit-fullName" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.full_name || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">ชื่อเล่น</label>
              <input id="inline-edit-nickname" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.nickname || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">เบอร์โทรศัพท์</label>
              <input id="inline-edit-phone" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.phone || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">Line ID</label>
              <input id="inline-edit-lineId" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.line_id || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">อีเมลองค์กร</label>
              <input id="inline-edit-email" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.email || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">เลขบัญชีธนาคาร</label>
              <input id="inline-edit-bankAccount" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.bank_account || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">🏥 โรงพยาบาลประกันสังคม</label>
              <input id="inline-edit-hospital" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${escapeHtml(emp.hospital || '')}">
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">สังกัดฝ่าย / แผนก *</label>
              <select id="inline-edit-dept" class="select-input" style="width:100%; padding:0.5rem; margin-top:4px;">
                ${deptOptions}
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">ตำแหน่งงาน *</label>
              <select id="inline-edit-role" class="select-input" style="width:100%; padding:0.5rem; margin-top:4px;">
                ${roleOptions}
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">ประเภทพนักงาน *</label>
              <select id="inline-edit-type" class="select-input" style="width:100%; padding:0.5rem; margin-top:4px;">
                <option value="พนักงานประจำ (Full-time)" ${emp.employment_type?.includes('Full') || emp.employment_type?.includes('ประจำ') ? 'selected' : ''}>พนักงานประจำ (Full-time)</option>
                <option value="พนักงานพาร์ทไทม์ (Part-time)" ${emp.employment_type?.includes('Part') || emp.employment_type?.includes('พาร์ท') ? 'selected' : ''}>พนักงานพาร์ทไทม์ (Part-time)</option>
                <option value="พนักงานสัญญาจ้าง (Contract)" ${emp.employment_type?.includes('Contract') || emp.employment_type?.includes('สัญญา') ? 'selected' : ''}>พนักงานสัญญาจ้าง (Contract)</option>
                <option value="นักศึกษาฝึกงาน (Intern)" ${emp.employment_type?.includes('Intern') || emp.employment_type?.includes('ฝึกงาน') ? 'selected' : ''}>นักศึกษาฝึกงาน (Intern)</option>
              </select>
            </div>
            <div>
              <label style="font-size:12px; font-weight:600; color:#64748b;">วันที่เริ่มงาน</label>
              <input type="date" id="inline-edit-startDate" class="search-input" style="padding:0.5rem; margin-top:4px;" value="${emp.start_date || ''}">
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px; padding-top:12px; border-top:1px solid #e2e8f0;">
            <button class="action-btn" onclick="openEmployeeDetail('${emp.id}', false)">ยกเลิก</button>
            <button class="action-btn success-zone" onclick="saveEmployeeInlineEdit('${emp.id}')">💾 บันทึกการแก้ไข</button>
          </div>
        `;
      }
    });
  }

  if (modal) modal.classList.add("open");
}

async function saveEmployeeInlineEdit(employeeId) {
  const emp = employees.find(e => String(e.id) === String(employeeId));
  if (!emp) return;

  const code = document.getElementById('inline-edit-code')?.value.trim();
  const name = document.getElementById('inline-edit-fullName')?.value.trim();
  const dept = document.getElementById('inline-edit-dept')?.value;
  const role = document.getElementById('inline-edit-role')?.value;
  const empType = document.getElementById('inline-edit-type')?.value;

  if (!code || !name || !dept || !role || !empType) {
    showAppError("ข้อมูลไม่ครบถ้วน", "กรุณากรอกข้อมูลช่องที่มีเครื่องหมาย * ให้ครบถ้วน");
    return;
  }

  const updateData = {
    employee_code: code,
    full_name: name,
    title: document.getElementById('inline-edit-title')?.value || null,
    nickname: document.getElementById('inline-edit-nickname')?.value.trim() || null,
    phone: document.getElementById('inline-edit-phone')?.value.trim() || null,
    line_id: document.getElementById('inline-edit-lineId')?.value.trim() || null,
    email: document.getElementById('inline-edit-email')?.value.trim() || null,
    department_id: dept,
    position_id: role,
    bank_account: document.getElementById('inline-edit-bankAccount')?.value.trim() || null,
    start_date: document.getElementById('inline-edit-startDate')?.value || null,
    hospital: document.getElementById('inline-edit-hospital')?.value.trim() || null,
    employment_type: empType,
  };

  const fileInput = document.getElementById('inline-edit-img');
  if (fileInput && fileInput.files[0]) {
    const uploadedUrl = await uploadEmployeeImage(getSupabase(), code, fileInput.files[0]);
    if (uploadedUrl) updateData.image_url = uploadedUrl;
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('employees').update(updateData).eq('id', emp.id);
    if (error) throw error;

    await saveHRActivityLog('EMPLOYEE', 'UPDATE', code, `แก้ไขข้อมูลพนักงาน: ${name}`);
    if (window.Swal) {
      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'อัปเดตข้อมูลพนักงานเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
    }
    await refreshDashboard();
    openEmployeeDetail(emp.id, false);
  } catch (err) {
    showAppError("ไม่สามารถบันทึกข้อมูลได้", err.message);
  }
}

function closeEmployeeModal(event) {
  if (event && event.target.id !== "employeeModal") return;
  document.getElementById("employeeModal")?.classList.remove("open");
}

function detail(label, value) {
  return `<div class="detail-item" style="background:#f8fafc; padding:8px 12px; border-radius:8px; border:1px solid #e2e8f0;">
    <span style="font-size:12px; color:#64748b; display:block; margin-bottom:2px;">${escapeHtml(label)}</span>
    <strong style="font-size:14px; color:#1e293b;">${escapeHtml(value)}</strong>
  </div>`;
}

function renderBalanceCards(rows) {
  if (!rows.length) return `<div class="empty">ยังไม่มีข้อมูลโควตาวันลาในระบบ</div>`;
  return `<div class="detail-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">${rows.map((row) => {
    const typeObj = getLeaveType(row.leave_type_id);
    const type = typeObj?.leave_name || "สิทธิการลา";

    const entitlement = Number(row.entitlement_days ?? typeObj?.yearly_quota ?? 0);
    const used = Number(row.used_days ?? 0);
    const remaining = row.remaining_days !== undefined ? Number(row.remaining_days) : (entitlement - used);

    return `
      <div style="background:#f0fdfa; border:1px solid #ccfbf1; padding:10px 14px; border-radius:10px;">
        <span style="font-size:12px; color:#0d9488; font-weight:600; display:block; margin-bottom:4px;">${escapeHtml(type)}</span>
        <div style="font-size:18px; font-weight:700; color:#0f766e;">
          ${remaining} <span style="font-size:12px; font-weight:normal; color:#475569;">/ ${entitlement} วัน (ใช้ไป ${used})</span>
        </div>
      </div>
    `;
  }).join("")}</div>`;
}

function renderLeaveRow(request) {
  const type = getLeaveType(request.leave_type_id)?.leave_name || "ไม่ระบุ";
  const startDate = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(request.start_date) : (request.start_date || "-");
  const endDate = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(request.end_date) : (request.end_date || "-");
  const statusLabel = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(request.status) : request.status;

  return `
    <tr>
      <td>${escapeHtml(type)}</td>
      <td>${startDate} - ${endDate}</td>
      <td><strong style="color:#0f766e;">${request.total_days || 0}</strong> วัน</td>
      <td>${escapeHtml(request.reason || request.note || "-")}</td>
      <td><span class="status ${request.status || "pending"}">${statusLabel}</span></td>
      <td style="text-align: center;">
        <button class="btn-light btn-sm" title="แก้ไขจำนวนวัน/ข้อมูลคำขอ" onclick="editSingleLeaveRequest('${request.id}')">
          <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
        </button>
      </td>
    </tr>
  `;
}

async function editSingleLeaveRequest(requestId) {
  const req = leaveRequests.find(r => String(r.id) === String(requestId));
  if (!req) return;

  const supabase = getSupabase();
  const typeObj = getLeaveType(req.leave_type_id);

  if (!window.Swal) return;

  const { value: formValues } = await Swal.fire({
    title: '📝 ปรับแก้ไขจำนวนวันลา / คำขอ',
    width: 'min(90vw, 500px)',
    html: `
      <div style="text-align:left; font-family:'Sarabun', sans-serif; display:flex; flex-direction:column; gap:12px;">
        <div style="background:#f1f5f9; padding:10px; border-radius:6px; font-size:13px;">
          <b>ประเภท:</b> ${escapeHtml(typeObj?.leave_name || 'ไม่ระบุ')}<br>
          <b>วันที่:</b> ${escapeHtml(req.start_date)} ถึง ${escapeHtml(req.end_date)}
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">จำนวนวันลา (ปรับเพิ่ม/ลดได้ยืดหยุ่น) *</label>
          <div style="display:flex; gap:6px; align-items:center; margin-top:4px;">
            <button type="button" class="action-btn" onclick="let el=document.getElementById('edit-days'); el.value = Math.max(0.5, (parseFloat(el.value)||1)-0.5);" style="width:40px; padding:0; height:40px;">-</button>
            <input type="number" id="edit-days" class="swal2-input" step="0.5" min="0.5" value="${req.total_days || 1}" style="margin:0; text-align:center; height:40px; flex:1;">
            <button type="button" class="action-btn" onclick="let el=document.getElementById('edit-days'); el.value = (parseFloat(el.value)||0)+0.5;" style="width:40px; padding:0; height:40px;">+</button>
          </div>
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">เหตุผลการลา / หมายเหตุ HR</label>
          <textarea id="edit-reason" class="swal2-textarea" style="margin:4px 0 0 0; width:100%; height:70px; font-size:13px;">${escapeHtml(req.reason || req.note || '')}</textarea>
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">สถานะคำขอ</label>
          <select id="edit-status" class="swal2-select" style="margin:4px 0 0 0; width:100%; height:40px;">
            <option value="approved" ${req.status === 'approved' ? 'selected' : ''}>อนุมัติ (Approved)</option>
            <option value="pending" ${req.status === 'pending' ? 'selected' : ''}>รออนุมัติ (Pending)</option>
            <option value="rejected" ${req.status === 'rejected' ? 'selected' : ''}>ไม่อนุมัติ (Rejected)</option>
            <option value="cancelled" ${req.status === 'cancelled' ? 'selected' : ''}>ยกเลิก (Cancelled)</option>
          </select>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '💾 บันทึกการแก้ไข',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    preConfirm: () => {
      const days = parseFloat(document.getElementById('edit-days').value) || 0;
      const reason = document.getElementById('edit-reason').value.trim();
      const status = document.getElementById('edit-status').value;
      if (days <= 0) {
        Swal.showValidationMessage('❌ จำนวนวันลาต้องมากกว่า 0 วัน');
        return false;
      }
      return { total_days: days, reason: reason, status: status };
    }
  });

  if (formValues) {
    Swal.fire({ title: 'กำลังปรับปรุงข้อมูลคำขอ...', didOpen: () => Swal.showLoading() });
    const { error } = await supabase.from('leave_requests').update(formValues).eq('id', req.id);
    if (error) {
      showAppError('ปรับปรุงข้อมูลคำขอล้มเหลว', error.message);
    } else {
      await saveHRActivityLog('LEAVE_REQUEST', 'UPDATE', `คำขอID:${req.id}`, `HR ปรับแก้จำนวนวันลาเป็น ${formValues.total_days} วัน สถานะ: ${formValues.status}`);
      Swal.fire('สำเร็จ', 'ปรับแก้ไขวันลาเรียบร้อยแล้ว', 'success');
      await refreshDashboard();
      openEmployeeDetail(req.employee_id);
    }
  }
}

// ==========================================
// 7. ADMIN HR MANAGEMENT (EMPLOYEES & DEPTS)
// ==========================================
async function uploadEmployeeImage(supabase, employeeCode, fileObject) {
  if (!fileObject) return null;
  try {
    const fileExt = fileObject.name.split('.').pop();
    const fileName = `${employeeCode}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error } = await supabase.storage
      .from('employee-images')
      .upload(filePath, fileObject, { cacheControl: '3600', upsert: true });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('employee-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    showAppError("อัปโหลดรูปภาพไม่สำเร็จ", err.message);
    return null;
  }
}

async function addNewEmployee() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  try {
    const { data: depts } = await supabase.from('departments').select('id, department_name');
    let deptOptions = depts?.map(d => `<option value="${d.id}">${escapeHtml(d.department_name)}</option>`).join('') || '';

    const { data: roles } = await supabase.from('positions').select('id, position_name');
    let roleOptions = roles?.map(r => `<option value="${r.id}">${escapeHtml(r.position_name)}</option>`).join('') || '';

    const { value: formValues } = await Swal.fire({
      title: '➕ เพิ่มพนักงานใหม่เข้าสู่ระบบ',
      width: 'min(92vw, 800px)',
      html: `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px; text-align:left; font-family:'Sarabun', sans-serif; max-height: 65vh; overflow-y: auto; padding-right: 6px;">
          <div style="grid-column: 1 / -1; text-align: center; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px dashed #cbd5e1;">
            <img id="profilePreview" src="https://placehold.co/100?text=No+Image" 
                 style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #0d9488; margin-bottom: 8px; background: #fff;">
            <input type="file" id="empImage" class="swal2-file" accept="image/*" style="display: block; margin: 0 auto; font-size: 12px;">
          </div>

          <div>
            <label style="font-size:13px; font-weight:600;">รหัสพนักงาน *</label>
            <input id="swal-empCode" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="เช่น 19001">
          </div>
          <div>
            <label style="font-size:13px; font-weight:600;">รหัสผ่านเข้าใช้งาน *</label>
            <input type="text" id="swal-password" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="รหัสผ่านเข้าสู่ระบบ">
          </div>
          <div>
            <label style="font-size:13px; font-weight:600;">คำนำหน้าชื่อ</label>
            <select id="title" class="swal2-select" style="margin:4px 0 0; width:100%; height:38px;">
              <option value="" disabled selected>เลือกคำนำหน้า...</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="นางสาว">นางสาว</option>
            </select>
          </div>
          <div style="grid-column: span 2;">
            <label style="font-size:13px; font-weight:600;">ชื่อ-นามสกุลจริง *</label>
            <input id="swal-fullName" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="นาย / นางสาว ...">
          </div>
          <div>
            <label style="font-size:13px; font-weight:600;">ชื่อเล่น</label>
            <input id="swal-nickname" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="ชื่อเล่น">
          </div>
          <div>
            <label style="font-size:13px; font-weight:600;">เบอร์โทรศัพท์</label>
            <input id="swal-phone" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="08X-XXX-XXXX">
          </div>
          <div>
            <label style="font-size:13px; font-weight:600;">ไอดีไลน์ (Line ID)</label>
            <input id="swal-lineId" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="Line ID">
          </div>
          <div>
            <label style="font-size:13px; font-weight:600;">อีเมลองค์กร</label>
            <input type="email" id="swal-email" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="email@company.com">
          </div>

          <div>
            <label style="font-size:13px; font-weight:600;">เลขบัญชีธนาคาร</label>
            <input id="swal-bankAccount" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="เลขบัญชี 10 หลัก">
          </div>

          <div>
            <label style="font-size:13px; font-weight:600;">🏥 โรงพยาบาลประกันสังคม</label>
            <input id="swal-hospital" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;" placeholder="เช่น รพ.เปาโล">
          </div>

          <div>
            <label style="font-size:13px; font-weight:600;">สังกัดฝ่าย / แผนก *</label>
            <select id="swal-dept" class="swal2-select" style="margin:4px 0 0; width:100%; height:38px;">
              <option value="" disabled selected>-- เลือกแผนก --</option>
              ${deptOptions}
            </select>
          </div>
          <div>
            <label style="font-size:13px; font-weight:600;">ตำแหน่งงาน *</label>
            <select id="swal-role" class="swal2-select" style="margin:4px 0 0; width:100%; height:38px;">
              <option value="" disabled selected>-- เลือกตำแหน่ง --</option>
              ${roleOptions}
            </select>
          </div>

          <div>
            <label style="font-size:13px; font-weight:600;">ประเภทพนักงาน *</label>
            <select id="employee_type" class="swal2-select" style="margin:4px 0 0; width:100%; height:38px;">
              <option value="" disabled selected>เลือกประเภทพนักงาน...</option>
              <option value="พนักงานประจำ (Full-time)">พนักงานประจำ (Full-time)</option>
              <option value="พนักงานพาร์ทไทม์ (Part-time)">พนักงานพาร์ทไทม์ (Part-time)</option>
              <option value="พนักงานสัญญาจ้าง (Contract)">พนักงานสัญญาจ้าง (Contract)</option>
              <option value="นักศึกษาฝึกงาน (Intern)">นักศึกษาฝึกงาน (Intern)</option>
            </select>
          </div>

          <div>
            <label style="font-size:13px; font-weight:600;">วันที่เริ่มงาน</label>
            <input type="date" id="swal-startDate" class="swal2-input" style="margin:4px 0 0; width:100%; height:38px;">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'ตรวจสอบความถูกต้อง >',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0d9488',
      didOpen: (popup) => {
        const empImageInput = popup.querySelector('#empImage');
        const profilePreviewImg = popup.querySelector('#profilePreview');
        if (empImageInput && profilePreviewImg) {
          empImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) profilePreviewImg.src = URL.createObjectURL(file);
          });
        }
      },
      preConfirm: () => {
        const code = document.getElementById('swal-empCode').value.trim();
        const password = document.getElementById('swal-password').value.trim();
        const name = document.getElementById('swal-fullName').value.trim();
        const dept = document.getElementById('swal-dept').value;
        const role = document.getElementById('swal-role').value;
        const employee_type = document.getElementById('employee_type').value;
        const imageFile = document.getElementById('empImage').files[0];

        if (!code || !password || !name || !dept || !role || !employee_type) {
          Swal.showValidationMessage('⚠️ กรุณากรอกข้อมูลช่องที่มีเครื่องหมาย * ให้ครบถ้วน');
          return false;
        }

        return {
          employee_code: code,
          password: password,
          full_name: name,
          title: document.getElementById('title').value || null,
          nickname: document.getElementById('swal-nickname').value.trim() || null,
          phone: document.getElementById('swal-phone').value.trim() || null,
          line_id: document.getElementById('swal-lineId').value.trim() || null,
          email: document.getElementById('swal-email').value.trim() || null,
          department_id: dept,
          position_id: role,
          bank_account: document.getElementById('swal-bankAccount').value.trim() || null,
          start_date: document.getElementById('swal-startDate').value || null,
          hospital: document.getElementById('swal-hospital').value.trim() || null,
          employment_type: employee_type,
          status: 'active',
          role: 'user',
          imageFile: imageFile
        };
      }
    });

    if (formValues) {
      const confirm1 = await Swal.fire({
        title: '❓ ยืนยันข้อมูลพนักงานใหม่',
        html: `ต้องการบันทึกรหัสพนักงาน <b>${escapeHtml(formValues.employee_code)}</b><br>คุณ <b>${escapeHtml(formValues.full_name)}</b> ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '💾 บันทึกข้อมูล',
        cancelButtonText: 'แก้ไขข้อมูล',
        confirmButtonColor: '#0d9488'
      });

      if (!confirm1.isConfirmed) return;

      Swal.fire({ title: 'กำลังบันทึกข้อมูลพนักงาน...', didOpen: () => Swal.showLoading() });

      if (formValues.imageFile) {
        const uploadedUrl = await uploadEmployeeImage(supabase, formValues.employee_code, formValues.imageFile);
        if (uploadedUrl) formValues.image_url = uploadedUrl;
      }

      delete formValues.imageFile;

      const { error } = await supabase.from('employees').insert([formValues]);
      if (error) throw error;

      await saveHRActivityLog('EMPLOYEE', 'INSERT', formValues.employee_code, `เพิ่มพนักงานใหม่: ${formValues.full_name}`);
      Swal.fire('สำเร็จ!', 'เพิ่มประวัติพนักงานเข้าสู่ระบบเรียบร้อยแล้ว', 'success');
      refreshDashboard();
    }
  } catch (err) {
    showAppError("ไม่สามารถบันทึกข้อมูลพนักงานได้", err.message);
  }
}

async function editEmployeeData(presetSearchKey = null) {
  if (presetSearchKey) {
    const emp = employees.find(e => e.employee_code === presetSearchKey || e.id === presetSearchKey);
    if (emp) {
      openEmployeeDetail(emp.id, true);
      return;
    }
  }

  if (!window.Swal) return;

  const { value: inputKey } = await Swal.fire({
    title: '🔍 ค้นหาและจัดการแฟ้มบุคคล',
    input: 'text',
    inputLabel: 'ระบุรหัสพนักงาน หรือชื่อ-นามสกุล ที่ต้องการแก้ไข',
    inputPlaceholder: 'เช่น 19001 หรือ สมชาย...',
    showCancelButton: true,
    confirmButtonText: 'ดึงข้อมูล',
    confirmButtonColor: '#0d9488',
    inputValidator: (value) => { if (!value) return '❌ กรุณาระบุคำค้นหา'; }
  });

  if (!inputKey) return;

  const emp = employees.find(e =>
    e.employee_code?.toLowerCase() === inputKey.trim().toLowerCase() ||
    e.full_name?.toLowerCase().includes(inputKey.trim().toLowerCase())
  );

  if (emp) {
    openEmployeeDetail(emp.id, true);
  } else {
    Swal.fire('ไม่พบพนักงาน', `ไม่พบข้อมูลพนักงานที่ค้นหา: ${escapeHtml(inputKey)}`, 'warning');
  }
}

async function deleteEmployee(id, empCode, fullName) {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  const confirm = await Swal.fire({
    title: '🚨 ลบพนักงานถาวร?',
    html: `คุณกำลังจะลบพนักงาน <b>${escapeHtml(empCode)} - ${escapeHtml(fullName)}</b> ถาวร<br><span style="color:#ef4444; font-size:12px;">การลบนี้จะลบสิทธิ์วันลาและประวัติการลาทั้งหมดของพนักงานคนนี้ด้วย!</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบถาวร',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444'
  });

  if (!confirm.isConfirmed) return;

  try {
    Swal.fire({ title: 'กำลังลบข้อมูล...', didOpen: () => Swal.showLoading() });

    // 1. ลบโควตาวันลาใน leave_balances
    const { error: balErr } = await supabase.from('leave_balances').delete().eq('employee_id', id);
    if (balErr) throw balErr;

    // 2. ลบประวัติคำขอลาใน leave_requests
    const { error: reqErr } = await supabase.from('leave_requests').delete().eq('employee_id', id);
    if (reqErr) throw reqErr;

    // 3. ปลดอ้างอิงจากตาราง profiles (ถ้ามี)
    await supabase.from('profiles').update({ employee_id: null }).eq('employee_id', id);

    // 4. ลบพนักงานออกจากตาราง employees
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;

    await saveHRActivityLog('EMPLOYEE', 'DELETE', empCode, `ลบพนักงาน: ${fullName}`);
    Swal.fire('สำเร็จ!', 'ลบข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
    refreshDashboard();
  } catch (err) {
    showAppError("ไม่สามารถลบข้อมูลพนักงานได้", err.message);
  }
}

function generateDeptCode(deptName) {
  if (!deptName) return "DEPT";
  const cleanName = deptName.replace(/^(ฝ่าย|แผนก|ศูนย์|กลุ่มงาน)\s*/g, '').trim().toLowerCase();
  const mapping = [
    { keywords: ['ขนส่ง', 'จัดส่ง', 'โลจิสติกส์'], code: 'DL' },
    { keywords: ['คลัง', 'สโตร์'], code: 'WH' },
    { keywords: ['ไอที', 'เทคโนโลยี', 'it'], code: 'IT' },
    { keywords: ['บุคคล', 'เอชอาร์', 'hr'], code: 'HR' },
    { keywords: ['บัญชี', 'การเงิน'], code: 'ACC' },
    { keywords: ['ตลาด', 'การตลาด'], code: 'MKT' },
    { keywords: ['ขาย'], code: 'SL' },
    { keywords: ['ผลิต'], code: 'PROD' }
  ];

  for (const item of mapping) {
    if (item.keywords.some(kw => cleanName.includes(kw))) return item.code;
  }
  return `D-${cleanName.substring(0, 3).toUpperCase()}`;
}

async function manageDepartments() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  try {
    const result = await Swal.fire({
      title: '🏢 จัดการฝ่ายและตำแหน่งงาน',
      text: 'เลือกประเภทโครงสร้างองค์กรที่คุณต้องการเพิ่ม',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '🏢 เพิ่มฝ่าย/แผนกใหม่',
      denyButtonText: '💼 เพิ่มตำแหน่งงานใหม่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0d9488',
      denyButtonColor: '#3b82f6'
    });

    if (result.isConfirmed) {
      const { value: deptName } = await Swal.fire({
        title: 'เพิ่มแผนกใหม่เข้าสู่องค์กร',
        input: 'text',
        inputLabel: 'ระบุชื่อฝ่าย/แผนกงาน',
        inputPlaceholder: 'เช่น ฝ่ายขนส่ง, ฝ่ายนวัตกรรม...',
        showCancelButton: true,
        confirmButtonText: 'บันทึกข้อมูล',
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องใส่ชื่อแผนกงาน!'; }
      });

      if (deptName) {
        const cleanDeptName = deptName.trim();
        const deptCode = generateDeptCode(cleanDeptName);
        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
        const { error } = await supabase.from('departments').insert([{ department_name: cleanDeptName, department_code: deptCode }]);
        if (error) throw error;
        await saveHRActivityLog('DEPARTMENT', 'INSERT', cleanDeptName, `เพิ่มแผนกงานใหม่: ${cleanDeptName}`);
        Swal.fire('สำเร็จ!', `บันทึกแผนก "${escapeHtml(cleanDeptName)}" เรียบร้อยแล้ว`, 'success');
        refreshDashboard();
      }
    } else if (result.isDenied) {
      const { value: posName } = await Swal.fire({
        title: 'เพิ่มตำแหน่งงานใหม่',
        input: 'text',
        inputLabel: 'ระบุชื่อตำแหน่งงาน',
        inputPlaceholder: 'เช่น Senior Developer...',
        showCancelButton: true,
        confirmButtonText: 'บันทึกข้อมูล',
        confirmButtonColor: '#3b82f6',
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องใส่ชื่อตำแหน่งงาน!'; }
      });

      if (posName) {
        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
        const { error } = await supabase.from('positions').insert([{ position_name: posName.trim() }]);
        if (error) throw error;
        await saveHRActivityLog('POSITION', 'INSERT', posName.trim(), `เพิ่มตำแหน่งงานใหม่: ${posName.trim()}`);
        Swal.fire('สำเร็จ!', `บันทึกตำแหน่ง "${escapeHtml(posName.trim())}" สำเร็จ`, 'success');
        refreshDashboard();
      }
    }
  } catch (err) {
    showAppError("เกิดข้อผิดพลาดในการจัดการโครงสร้างองค์กร", err.message);
  }
}

// ==========================================
// 8. LEAVE RULES & FLEXIBLE BALANCES MANAGEMENT
// ==========================================
async function editGlobalLeaveRules() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  try {
    Swal.fire({ title: 'กำลังโหลดประเภทวันลา...', didOpen: () => Swal.showLoading() });
    const { data: rules, error } = await supabase.from('leave_types').select('*').eq('status', 'active').order('created_at', { ascending: true });
    if (error) throw error;
    Swal.close();

    let tableHTML = `
      <div style="font-family:'Sarabun', sans-serif; text-align:left; margin-bottom:12px;">
        <button id="btn-add-leavetype" class="action-btn success-zone" style="font-size:13px; padding:6px 12px; width:auto;">
          ➕ เพิ่มประเภทการลาใหม่
        </button>
      </div>
      <div style="max-height: 350px; overflow-y: auto; font-family:'Sarabun', sans-serif;">
        <table style="width:100%; text-align:left; font-size:13px; border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
              <th style="padding:8px; border:1px solid #cbd5e1;">ประเภทการลา</th>
              <th style="padding:8px; border:1px solid #cbd5e1; width:160px; text-align:center;">โควตากลาง (วัน/ปี)</th>
              <th style="padding:8px; border:1px solid #cbd5e1; width:60px; text-align:center;">ลบ</th>
            </tr>
          </thead>
          <tbody>
    `;

    rules.forEach(r => {
      tableHTML += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px; border:1px solid #cbd5e1;">
            <b style="color:#1e293b; font-size:13px;">${escapeHtml(r.leave_name)}</b><br>
            <span style="color:#64748b; font-size:11px;">Code: ${escapeHtml(r.leave_code)}</span>
          </td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
            <div style="display:flex; gap:4px; align-items:center; justify-content:center;">
              <button type="button" class="btn-light btn-sm" onclick="let el=document.getElementById('quota-${r.id}'); el.value=Math.max(0, (parseFloat(el.value)||0)-1);" style="padding:2px 8px;">-</button>
              <input type="number" id="quota-${r.id}" class="swal2-input" style="width:60px; height:32px; margin:0; text-align:center; padding:0; font-size:13px;" value="${r.yearly_quota}">
              <button type="button" class="btn-light btn-sm" onclick="let el=document.getElementById('quota-${r.id}'); el.value=(parseFloat(el.value)||0)+1;" style="padding:2px 8px;">+</button>
            </div>
          </td>
          <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
            <button class="btn-delete-leave" data-id="${r.id}" data-name="${escapeHtml(r.leave_name)}" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">
              ❌
            </button>
          </td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table></div>`;

    const { value: updatedRules } = await Swal.fire({
      title: '⚙️ ตั้งค่าเกณฑ์วันลาภาพรวมบริษัท',
      html: tableHTML,
      width: 'min(92vw, 700px)',
      showCancelButton: true,
      confirmButtonText: '💾 บันทึกโควตาทั้งหมด',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#0d9488',
      didOpen: (popup) => {
        popup.querySelector('#btn-add-leavetype')?.addEventListener('click', () => {
          Swal.close();
          actionAddNewLeaveType();
        });
        popup.querySelectorAll('.btn-delete-leave').forEach(button => {
          button.addEventListener('click', () => {
            const leaveId = button.getAttribute('data-id');
            const leaveName = button.getAttribute('data-name');
            Swal.close();
            actionDeleteLeaveType(leaveId, leaveName);
          });
        });
      },
      preConfirm: () => {
        const listResults = [];
        rules.forEach(r => {
          const inputVal = parseFloat(document.getElementById(`quota-${r.id}`).value) || 0;
          listResults.push({ id: r.id, old_quota: r.yearly_quota, new_quota: inputVal, name: r.leave_name });
        });
        return listResults;
      }
    });

    if (updatedRules) {
      Swal.fire({ title: 'กำลังปรับเกณฑ์โควตากลาง...', didOpen: () => Swal.showLoading() });
      for (const item of updatedRules) {
        if (item.new_quota !== item.old_quota) {
          const { error: updErr } = await supabase.from('leave_types').update({ yearly_quota: item.new_quota }).eq('id', item.id);
          if (updErr) throw updErr;
          await saveHRActivityLog('LEAVE_QUOTA', 'UPDATE', item.name, `ปรับโควตาจาก ${item.old_quota} เป็น ${item.new_quota} วัน`);
        }
      }
      Swal.fire('สำเร็จ', 'อัปเดตโควตากลางบริษัทเสร็จสิ้น', 'success');
      refreshDashboard();
    }
  } catch (err) {
    showAppError("ไม่สามารถปรับเกณฑ์วันลาได้", err.message);
  }
}

async function actionAddNewLeaveType() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  const { value: formValues } = await Swal.fire({
    title: '➕ เพิ่มประเภทวันลาใหม่',
    width: 'min(90vw, 450px)',
    html: `
      <div style="display:flex; flex-direction:column; gap:10px; text-align:left; font-family:'Sarabun', sans-serif;">
        <div>
          <label style="font-size:13px; font-weight:600;">ชื่อประเภทการลา *</label>
          <input id="new-leave-name" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:38px;" placeholder="เช่น ลาพักร้อนกรณีพิเศษ">
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">รหัสย่อสากล (พิมพ์ใหญ่) *</label>
          <input id="new-leave-code" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:38px;" placeholder="เช่น SPECIAL_VACATION">
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">สิทธิ์วันลาจำกัดต่อปี *</label>
          <input type="number" id="new-leave-quota" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:38px;" value="6">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกข้อมูล',
    cancelButtonText: 'ย้อนกลับ',
    confirmButtonColor: '#0d9488',
    preConfirm: () => {
      const name = document.getElementById('new-leave-name').value.trim();
      const code = document.getElementById('new-leave-code').value.trim().toUpperCase();
      const quota = parseFloat(document.getElementById('new-leave-quota').value) || 0;

      if (!name || !code) {
        Swal.showValidationMessage('⚠️ กรุณากรอกชื่อและรหัสย่อให้ครบถ้วน');
        return false;
      }
      return { leave_name: name, leave_code: code, yearly_quota: quota, status: 'active' };
    }
  });

  if (!formValues) { editGlobalLeaveRules(); return; }

  Swal.fire({ title: 'กำลังเพิ่มประเภทวันลา...', didOpen: () => Swal.showLoading() });
  const { error } = await supabase.from('leave_types').insert([formValues]);
  if (error) {
    showAppError('ไม่สามารถเพิ่มประเภทวันลาได้', error.message);
    editGlobalLeaveRules();
  } else {
    await saveHRActivityLog('LEAVE_QUOTA', 'CREATE', formValues.leave_name, `เพิ่มประเภทการลาใหม่: ${formValues.leave_name}`);
    Swal.fire('สำเร็จ!', 'บันทึกข้อกำหนดวันลาชุดใหม่แล้ว', 'success').then(() => editGlobalLeaveRules());
  }
}

async function actionDeleteLeaveType(id, name) {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  const confirm = await Swal.fire({
    title: '⚠️ ยืนยันปิดสถานะระบบการลานี้?',
    html: `คุณต้องการระงับประเภทการลาชื่อ "<b>${escapeHtml(name)}</b>" หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ระงับการใช้งาน',
    confirmButtonColor: '#ef4444'
  });

  if (!confirm.isConfirmed) { editGlobalLeaveRules(); return; }

  const { error } = await supabase.from('leave_types').update({ status: 'inactive' }).eq('id', id);
  if (error) {
    showAppError('ไม่สามารถระงับประเภทวันลาได้', error.message);
    editGlobalLeaveRules();
  } else {
    await saveHRActivityLog('LEAVE_QUOTA', 'DELETE', name, `ปิดการใช้งานรหัสเกณฑ์วันลา: ${name}`);
    Swal.fire('ลบเสร็จสิ้น', 'อัปเดตสถานะเรียบร้อย', 'success').then(() => editGlobalLeaveRules());
  }
}

async function editIndividualLeaveBalance(presetEmpCode = null) {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  try {
    let empCode = presetEmpCode;

    if (!empCode) {
      const { value: inputCode } = await Swal.fire({
        title: '🛠️ ปรับโควตาพิเศษรายบุคคล',
        input: 'text',
        inputLabel: 'กรอกรหัสพนักงานที่ต้องการปรับยอดสิทธิ์',
        inputPlaceholder: 'เช่น 19001',
        showCancelButton: true,
        confirmButtonColor: '#0d9488',
        inputValidator: (value) => { if (!value) return '❌ กรุณาระบุรหัสพนักงาน'; }
      });
      empCode = inputCode;
    }

    if (!empCode) return;

    Swal.fire({ title: 'กำลังค้นหาข้อมูลพนักงาน...', didOpen: () => Swal.showLoading() });

    const { data: emp, error: empErr } = await supabase.from('employees').select('id, full_name, employee_code').eq('employee_code', empCode.trim()).maybeSingle();
    if (empErr) throw empErr;

    if (!emp) {
      Swal.fire('ไม่พบรหัสพนักงาน', 'ไม่มีรหัสบุคลากรนี้ในทำเนียบบริษัท', 'warning');
      return;
    }

    const currentYear = new Date().getFullYear();
    let { data: balances, error } = await supabase
      .from('leave_balances')
      .select('id, entitlement_days, used_days, remaining_days, leave_type_id, leave_types(leave_name)')
      .eq('employee_id', emp.id)
      .eq('year', currentYear);

    if (error) throw error;

    if (!balances || balances.length === 0) {
      const newBalances = leaveTypes.map(t => ({
        employee_id: emp.id,
        leave_type_id: t.id,
        year: currentYear,
        entitlement_days: t.yearly_quota || 0,
        used_days: 0,
        remaining_days: t.yearly_quota || 0
      }));
      const { data: inserted, error: insErr } = await supabase.from('leave_balances').insert(newBalances).select('id, entitlement_days, used_days, remaining_days, leave_type_id, leave_types(leave_name)');
      if (insErr) throw insErr;
      if (inserted) balances = inserted;
    }

    let formHTML = `<div style="text-align:left; font-size:13px; max-height:360px; overflow-y:auto; font-family:'Sarabun', sans-serif;">`;
    balances.forEach(b => {
      const typeName = b.leave_types?.leave_name || getLeaveType(b.leave_type_id)?.leave_name || 'ทั่วไป';
      const ent = Number(b.entitlement_days ?? 0);
      const used = Number(b.used_days ?? 0);
      const rem = Number(b.remaining_days ?? (ent - used));

      formHTML += `
        <div style="margin-bottom:12px; padding:10px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px;">
          <div style="font-weight:700; color:#0f766e; font-size:14px; margin-bottom:6px;">${escapeHtml(typeName)}</div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; align-items:center;">

            <div>
              <span style="font-size:11px; color:#64748b; display:block;">สิทธิ์รวม (วัน)</span>
              <div style="display:flex; gap:2px; margin-top:2px;">
                <button type="button" class="btn-light btn-sm" onclick="let el=document.getElementById('entit-${b.id}'); el.value=Math.max(0, (parseFloat(el.value)||0)-0.5); window.calcRem('${b.id}');" style="padding:2px 6px;">-</button>
                <input type="number" id="entit-${b.id}" class="swal2-input" step="0.5" style="width:100%; height:32px; margin:0; font-size:12px; text-align:center; padding:0;" value="${ent}" oninput="window.calcRem('${b.id}')">
                <button type="button" class="btn-light btn-sm" onclick="let el=document.getElementById('entit-${b.id}'); el.value=(parseFloat(el.value)||0)+0.5; window.calcRem('${b.id}');" style="padding:2px 6px;">+</button>
              </div>
            </div>

            <div>
              <span style="font-size:11px; color:#64748b; display:block;">ใช้ไปแล้ว (วัน)</span>
              <div style="display:flex; gap:2px; margin-top:2px;">
                <button type="button" class="btn-light btn-sm" onclick="let el=document.getElementById('used-${b.id}'); el.value=Math.max(0, (parseFloat(el.value)||0)-0.5); window.calcRem('${b.id}');" style="padding:2px 6px;">-</button>
                <input type="number" id="used-${b.id}" class="swal2-input" step="0.5" style="width:100%; height:32px; margin:0; font-size:12px; text-align:center; padding:0;" value="${used}" oninput="window.calcRem('${b.id}')">
                <button type="button" class="btn-light btn-sm" onclick="let el=document.getElementById('used-${b.id}'); el.value=(parseFloat(el.value)||0)+0.5; window.calcRem('${b.id}');" style="padding:2px 6px;">+</button>
              </div>
            </div>

            <div>
              <span style="font-size:11px; color:#0d9488; font-weight:600; display:block;">คงเหลือ (วัน)</span>
              <input type="number" id="remain-${b.id}" class="swal2-input" step="0.5" style="width:100%; height:32px; margin:2px 0 0 0; font-size:12px; text-align:center; font-weight:700; color:#0f766e; background:#e6fffa;" value="${rem}">
            </div>

          </div>
        </div>`;
    });
    formHTML += `</div>`;

    window.calcRem = (bId) => {
      const entVal = parseFloat(document.getElementById(`entit-${bId}`)?.value) || 0;
      const usedVal = parseFloat(document.getElementById(`used-${bId}`)?.value) || 0;
      const remainInput = document.getElementById(`remain-${bId}`);
      if (remainInput) {
        remainInput.value = Math.max(0, entVal - usedVal);
      }
    };

    const { value: updatedBalances } = await Swal.fire({
      title: `🛠️ ปรับโควตา: ${escapeHtml(emp.full_name)}`,
      html: formHTML,
      width: 'min(92vw, 550px)',
      showCancelButton: true,
      confirmButtonText: '💾 อัปเดตยอดโควตา',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0d9488',
      preConfirm: () => {
        const listBalances = [];
        balances.forEach(b => {
          const newEntit = parseFloat(document.getElementById(`entit-${b.id}`).value) || 0;
          const newUsed = parseFloat(document.getElementById(`used-${b.id}`).value) || 0;
          const newRemain = parseFloat(document.getElementById(`remain-${b.id}`).value) || 0;
          listBalances.push({ 
            id: b.id, 
            old_entit: b.entitlement_days, 
            old_used: b.used_days,
            old_remain: b.remaining_days, 
            new_entit: newEntit, 
            new_used: newUsed,
            new_remain: newRemain 
          });
        });
        return listBalances;
      }
    });

    if (updatedBalances) {
      Swal.fire({ title: 'กำลังปรับปรุงยอดโควตา...', didOpen: () => Swal.showLoading() });
      for (const b of updatedBalances) {
        if (b.new_entit !== b.old_entit || b.new_used !== b.old_used || b.new_remain !== b.old_remain) {
          const { error: updErr } = await supabase.from('leave_balances').update({ 
            entitlement_days: b.new_entit, 
            used_days: b.new_used,
            remaining_days: b.new_remain 
          }).eq('id', b.id);
          if (updErr) throw updErr;
        }
      }
      await saveHRActivityLog('LEAVE_QUOTA', 'UPDATE', emp.employee_code, `ปรับสิทธิ์ใบลาให้คุณ ${emp.full_name}`);
      Swal.fire('สำเร็จ', 'ดำเนินการปรับยอดสิทธิ์เรียบร้อยแล้ว', 'success');
      await refreshDashboard();
      if (document.getElementById("employeeModal")?.classList.contains("open")) {
        openEmployeeDetail(emp.id);
      }
    }
  } catch (err) {
    showAppError("ไม่สามารถปรับโควตารายบุคคลได้", err.message);
  }
}

// ==========================================
// 9. COMPANY HOLIDAYS MANAGEMENT (FULL & FIXED)
// ==========================================
async function manageCompanyHolidays() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  try {
    Swal.fire({ title: 'กำลังโหลดปฏิทินวันหยุด...', didOpen: () => Swal.showLoading() });

    const currentYear = new Date().getFullYear();
    // 🔹 เปลี่ยนชื่อตารางตรงนี้ (เช่น 'holidays' หรือ 'holidays_rows')
    const { data: holidays, error } = await supabase
      .from('holidays')
      .select('*')
      .gte('holiday_date', `${currentYear}-01-01`)
      .lte('holiday_date', `${currentYear}-12-31`)
      .order('holiday_date', { ascending: true });

    if (error && error.code !== 'PGRST116') throw error;

    let holidayRows = (holidays || []).map((h, index) => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">${index + 1}</td>
        <td style="padding:8px; border:1px solid #cbd5e1; white-space:nowrap;">
          ${window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(h.holiday_date) : h.holiday_date}
        </td>
        <td style="padding:8px; border:1px solid #cbd5e1;"><b>${escapeHtml(h.holiday_name)}</b></td>
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
          <button class="btn-delete-holiday" data-id="${h.id}" data-name="${escapeHtml(h.holiday_name)}" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">
            ❌ ลบ
          </button>
        </td>
      </tr>
    `).join('');

    if (!holidayRows) {
      holidayRows = `<tr><td colspan="4" style="text-align:center; padding:12px; color:#64748b;">ยังไม่มีวันหยุดบริษัทถูกตั้งค่าในปี ${currentYear}</td></tr>`;
    }

    const htmlContent = `
      <div style="font-family:'Sarabun', sans-serif; text-align:left;">
        <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; color:#64748b;">รายการวันหยุดประจำปี ${currentYear}</span>
          <button id="btn-add-holiday" class="action-btn success-zone" style="font-size:12px; padding:6px 12px;">➕ เพิ่มวันหยุดใหม่</button>
        </div>
        <div style="max-height: 320px; overflow-y: auto;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
                <th style="padding:8px; border:1px solid #cbd5e1; width:40px; text-align:center;">ลำดับ</th>
                <th style="padding:8px; border:1px solid #cbd5e1; width:120px;">วันที่</th>
                <th style="padding:8px; border:1px solid #cbd5e1;">ชื่อวันหยุด</th>
                <th style="padding:8px; border:1px solid #cbd5e1; width:60px; text-align:center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${holidayRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    Swal.fire({
      title: '📅 ปฏิทินวันหยุดบริษัท',
      html: htmlContent,
      width: 'min(92vw, 650px)',
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'ปิดหน้าต่าง',
      didOpen: (popup) => {
        popup.querySelector('#btn-add-holiday')?.addEventListener('click', () => {
          Swal.close();
          actionAddNewHoliday();
        });
        popup.querySelectorAll('.btn-delete-holiday').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            // 🔹 แก้บั๊ก: แก้จาก 'holiday_name' เป็น 'data-name'
            const name = btn.getAttribute('data-name');
            Swal.close();
            actionDeleteHoliday(id, name);
          });
        });
      }
    });

  } catch (err) {
    showAppError("ไม่สามารถดึงข้อมูลวันหยุดบริษัทได้", err.message);
  }
}

async function actionAddNewHoliday() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  const { value: formValues } = await Swal.fire({
    title: '➕ เพิ่มวันหยุดบริษัทใหม่',
    width: 'min(90vw, 450px)',
    html: `
      <div style="display:flex; flex-direction:column; gap:10px; text-align:left; font-family:'Sarabun', sans-serif;">
        <div>
          <label style="font-size:13px; font-weight:600;">วันที่หยุด *</label>
          <input type="date" id="new-holiday-date" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:38px;">
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">ชื่อวันหยุด / รายละเอียด *</label>
          <input type="text" id="new-holiday-name" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:38px;" placeholder="เช่น วันขึ้นปีใหม่, วันสงกรานต์">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกข้อมูล',
    cancelButtonText: 'ย้อนกลับ',
    confirmButtonColor: '#0d9488',
    preConfirm: () => {
      const date = document.getElementById('new-holiday-date').value;
      const name = document.getElementById('new-holiday-name').value.trim();
      if (!date || !name) {
        Swal.showValidationMessage('⚠️ กรุณาระบุวันที่และชื่อวันหยุดให้ครบถ้วน');
        return false;
      }
      return { holiday_date: date, holiday_name: name };
    }
  });

  if (!formValues) { manageCompanyHolidays(); return; }

  Swal.fire({ title: 'กำลังเพิ่มวันหยุด...', didOpen: () => Swal.showLoading() });
  
  // 🔹 เปลี่ยนชื่อตารางตรงนี้
  const { error } = await supabase.from('holidays').insert([formValues]);
  if (error) {
    showAppError('ไม่สามารถบันทึกวันหยุดได้', error.message);
    manageCompanyHolidays();
  } else {
    await saveHRActivityLog('HOLIDAY', 'CREATE', formValues.holiday_name, `เพิ่มวันหยุดบริษัท: ${formValues.holiday_name} (${formValues.holiday_date})`);
    Swal.fire('สำเร็จ!', 'บันทึกวันหยุดเรียบร้อยแล้ว', 'success').then(() => manageCompanyHolidays());
  }
}

async function actionDeleteHoliday(id, name) {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  const confirm = await Swal.fire({
    title: '⚠️ ยืนยันการลบวันหยุด?',
    html: `คุณต้องการลบวันหยุด "<b>${escapeHtml(name)}</b>" ใช่หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบข้อมูล',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444'
  });

  if (!confirm.isConfirmed) { manageCompanyHolidays(); return; }

  // 🔹 เปลี่ยนชื่อตารางตรงนี้
  const { error } = await supabase.from('holidays').delete().eq('id', id);
  if (error) {
    showAppError('ไม่สามารถลบวันหยุดได้', error.message);
    manageCompanyHolidays();
  } else {
    await saveHRActivityLog('HOLIDAY', 'DELETE', name, `ลบวันหยุดบริษัท: ${name}`);
    Swal.fire('ลบเสร็จสิ้น', 'ลบวันหยุดเรียบร้อยแล้ว', 'success').then(() => manageCompanyHolidays());
  }
}



function exportAllLeaveHistoryExcel() {
  if (!leaveRequests || !leaveRequests.length) {
    showAppError("ไม่พบข้อมูล", "ยังไม่มีประวัติการลาในระบบสำหรับส่งออก");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM รองรับภาษาไทยใน Excel
  csvContent += "รหัสพนักงาน,ชื่อ-นามสกุล,แผนก,ประเภทการลา,วันที่เริ่มต้น,วันที่สิ้นสุด,จำนวนวัน,เหตุผล,สถานะ,วันที่ยื่น\n";

  leaveRequests.forEach((r) => {
    const emp = employees.find((e) => String(e.id) === String(r.employee_id));
    const type = getLeaveType(r.leave_type_id)?.leave_name || "ไม่ระบุ";
    const status = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(r.status) : r.status;
    const empCode = emp?.employee_code || "";
    const empName = emp?.full_name || "";
    const dept = emp?.departments?.department_name || "";
    const cleanReason = (r.reason || r.note || "").replace(/[\r\n]+/g, ' ').replace(/"/g, '""');

    csvContent += `"${empCode}","${empName}","${dept}","${type}","${r.start_date || ""}","${r.end_date || ""}","${r.total_days || 0}","${cleanReason}","${status}","${r.created_at || ""}"\n`;
  });

  const filename = `ประวัติการลาทั้งหมด_${new Date().toISOString().slice(0, 10)}.csv`;
  window.pvtSupabase.downloadBlob(filename, csvContent, "text/csv;charset=utf-8;");
}