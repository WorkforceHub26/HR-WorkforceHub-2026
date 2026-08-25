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
const supabaseClient = PVTSDK.getClient();

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

// ==========================================
// 1. getCurrentProfile (แก้ LEFT JOIN + เก็บ Role)
// ==========================================
// ==========================================
// 0. GLOBAL STATE INITIALIZATION
// ==========================================
window.state = window.state || {
  currentUserProfile: null
};

/**
 * =========================================================================
 * ฟังก์ชันดึงข้อมูลโปรไฟล์พนักงานตาม User ID (เวอร์ชันเสถียรสูง + ปลอดภัย)
 * =========================================================================
 * @param {string|number} userId - ID ของพนักงานที่ต้องการดึงข้อมูล
 * @param {number} timeoutMs - ระยะเวลา Timeout สูงสุดในการดึงข้อมูล (มิลลิวินาที) ค่าเริ่มต้น 10000ms (10 วินาที)
 * @returns {Promise<Object|null>} ข้อมูลโปรไฟล์พนักงาน หรือ null หากเกิดข้อผิดพลาด/ไม่พบข้อมูล
 */
async function getCurrentProfile(userId) {
  if (!userId) {
    console.warn("getCurrentProfile Warning: ไม่พบรหัสผู้ใช้งาน (User ID Missing or Empty)");
    return null;
  }

  try {
    const sb = getClient();
    if (!sb) return null;
    
    const { data, error } = await sb
      .from('employees')
      .select(`
        *,
        departments(*), 
        positions(*)
      `)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error("getCurrentProfile Supabase Error:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("getCurrentProfile Unexpected Error:", err);
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

// ฟังก์ชันช่วย Escape HTML ป้องกัน XSS
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusLabel(status) {
  return {
    pending: "รออนุมัติ",
    approved: "อนุมัติแล้ว",
    rejected: "ไม่อนุมัติ",
    cancelled: "ยกเลิกแล้ว",
    cancel_requested: "รออนุมัติยกเลิก", // 👈 เพิ่มบรรทัดนี้
  }[status] || status || "-";
}

function getAvatarUrl(imageUrl) {
  if (!imageUrl || imageUrl === "null" || imageUrl === "undefined") {
    return "/assets/img/default-avatar.jpg";
  }
  
  let url = String(imageUrl).trim();
  if (!url) return "/assets/img/default-avatar.jpg";

  // หากเป็น URL สมบูรณ์จากภายนอกหรือ Supabase CDN
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // 🛑 แก้บั๊ก: ถ้ามี /public/ อยู่แล้ว ให้ส่งกลับทันที ห้ามเติมซ้ำ
    if (url.includes("/storage/v1/object/public/")) {
      return url;
    }
    return url.replace("/storage/v1/object/", "/storage/v1/object/public/");
  }

  // หากเป็นแค่ชื่อไฟล์ที่เก็บใน Storage
  return `${SUPABASE_URL}/storage/v1/object/public/employee-images/${url}`;
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
        window.location.href = '/index.html';
      }
    });
  } else {
    localStorage.clear();
    window.location.href = '/index.html';
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
    const cachedUser = window.pvtSupabase?.getCachedUser?.();
    const session = await window.pvtSupabase?.getSession?.();
    const currentUserId = session?.user?.id || cachedUser?.id || cachedUser?.employee_code;

    let profile = null;
    if (currentUserId) {
      profile = await window.pvtSupabase?.getCurrentProfile?.(currentUserId);
    }

    if (!profile && cachedUser) {
      profile = cachedUser;
    }

    if (!profile) {
      window.location.href = '/index.html';
      return false;
    }

    if (window.state) {
      window.state.currentUserProfile = profile;
      if (typeof renderGlobalUserProfile === 'function') {
         window.currentUserProfile = profile;
         renderGlobalUserProfile();
      }

    }

    const userRole = profile.role ? profile.role.toLowerCase() : 'user';
    if (userRole !== 'admin' && userRole !== 'hr' && userRole !== 'it' && userRole !== 'user') {
      showAppError("ไม่มีสิทธิ์เข้าใช้งาน", "หน้านี้สงวนไว้สำหรับ HR, Admin และ IT เท่านั้น");
      return false;
    }

    // 🎯 1. แสดงโปรไฟล์บน Header ตรงนี้ได้เลยครับ!
    renderHeaderProfile();

    return true;
  } catch (err) {
    showAppError("เกิดข้อผิดพลาดในการตรวจสอบระบบเริ่มต้น", err.message);
    return false;
  }
}


// ฟังก์ชันอัปเดตส่วนแสดงผลโปรไฟล์ผู้ใช้ด้านบน (Header)
function renderHeaderProfile() {
  const profile = window.state?.currentUserProfile;
  if (!profile) return;

  const nameEl = document.getElementById("headerUserName") || document.getElementById("userProfileName");
  const roleEl = document.getElementById("headerUserRole") || document.getElementById("userProfileRole");
  const avatarEl = document.getElementById("headerUserAvatar") || document.getElementById("userProfileAvatar");

  if (nameEl) nameEl.textContent = profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || "ผู้ใช้งาน";
  if (roleEl) roleEl.textContent = (profile.role || "User").toUpperCase();
  if (avatarEl) {
    avatarEl.src = window.pvtSupabase?.getAvatarUrl ? window.pvtSupabase.getAvatarUrl(profile.image_url) : '/assets/img/default-avatar.jpg';
  }
}


// ==========================================
// 5. saveHRActivityLog (ไม่ขัดจังหวะการทำงานหลัก)
// ==========================================
// ==========================================
// 5. saveHRActivityLog (ปรับรองรับทั้ง 2 และ 4 Arguments)
// ==========================================
async function saveHRActivityLog(moduleOrAction, actionOrDetails = '', target = '', details = '') {
  try {
    const client = window.pvtSupabase?.getClient() || getSupabase();
    if (!client) return;

    const user = window.state?.currentUserProfile;

    let moduleName = 'System';
    let actionName = '';
    let logDetails = '';

    if (arguments.length >= 3) {
      moduleName = moduleOrAction;
      actionName = actionOrDetails;
      logDetails = target ? `[${target}] ${details}` : details;
    } else {
      actionName = moduleOrAction;
      logDetails = actionOrDetails;
    }

    const logEntry = {
      actor_id: user ? user.id : null,
      actor_name: user ? (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim()) : 'System',
      action_category: moduleName,
      action_type: actionName,
      target_identifier: target || '-',
      description: logDetails,
      created_at: new Date().toISOString()
    };

    const { error } = await client.from('hr_admin_management_logs').insert([logEntry]);
    
    if (error) {
      console.warn("HR Activity Log Notice:", error.message);
    }
  } catch (err) {
    console.warn("Failed to save activity log:", err);
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
      .from('hr_admin_management_logs')
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
            <td style="padding:6px; border:1px solid #cbd5e1;"><b>${escapeHtml(l.action_category || 'System')}</b></td>
            <td style="padding:6px; border:1px solid #cbd5e1;"><span style="background:#e2e8f0; padding:2px 4px; border-radius:4px;">${escapeHtml(l.action_type || '-')}</span></td>
            <td style="padding:6px; border:1px solid #cbd5e1;">${escapeHtml(l.description || '-')}</td>
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

// ==========================================
// 3. resetYearlyLeave & Admin Rules (เช็ก Role ล็อคความปลอดภัย)
// ==========================================
// ฟังก์ชันคำนวณรอบปีการลา (1 ธ.ค. ปีเก่า - 30 พ.ย. ปีใหม่) และระบุว่าเป็นใบลาปีไหน
function getLeaveCycleYear(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  
  // ถ้าวันที่อยู่ตั้งแต่ 1 ธ.ค. เป็นต้นไป ให้ถือเป็นรอบปีถัดไป
  return month === 12 ? year + 1 : year;
}

// ฟังก์ชันรีเซ็ตและสร้างโควตาวันลาประจำปีใหม่ (สำหรับ HR/Admin)
// ==========================================
// resetYearlyLeave (ใช้ window.state)
// ==========================================

async function resetYearlyLeave(isForce = false) {
  if (!window.Swal) return;

  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1; // ปี 2027

  // แสดง Popup UI เลือกปีและยืนยันการเจนโควตา
  const { value: formValues } = await Swal.fire({
    title: '📅 เจนโควตาวันลาประจำปีล่วงหน้า',
    width: 'min(90vw, 480px)',
    html: `
      <div style="text-align:left; font-family:'Sarabun', sans-serif;">
        <div style="margin-bottom: 14px;">
          <label style="font-size:13px; font-weight:600; color:#334155;">เลือกรอบปีที่ต้องการคำนวณสิทธิ (ค.ศ.) *</label>
          <select id="swal-target-year" class="swal2-select" style="width:100%; margin-top:6px; height:40px; font-size:14px; border-radius:10px;">
            <option value="${nextYear}" selected>ปี ${nextYear} (เจนล่วงหน้าสำหรับปีหน้า)</option>
            <option value="${currentYear}">ปี ${currentYear} (ปีปัจจุบัน)</option>
            <option value="${nextYear + 1}">ปี ${nextYear + 1}</option>
          </select>
        </div>

        <div style="display:flex; align-items:center; gap:8px; background:#fff1f2; padding:12px; border-radius:10px; border:1px solid #fecdd3;">
          <input type="checkbox" id="swal-force-reset" ${isForce ? 'checked' : ''} style="width:18px; height:18px; accent-color:#e11d48; cursor:pointer;">
          <label for="swal-force-reset" style="font-size:12px; font-weight:600; color:#be123c; cursor:pointer;">
            เขียนทับข้อมูลเดิม (Force Overwrite) <br>
            <span style="font-weight:400; color:#9f1239;">(ติ๊กช่องนี้หากเคยเจนปี 2027 ไปแล้วและต้องการรีเซ็ตใหม่)</span>
          </label>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '🚀 เริ่มเจนโควตาวันลา',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    cancelButtonColor: '#64748b',
    preConfirm: () => {
      const year = parseInt(document.getElementById('swal-target-year').value, 10);
      const force = document.getElementById('swal-force-reset').checked;
      return { year, force };
    }
  });

  if (!formValues) return;

  try {
    Swal.fire({ 
      title: `กำลังสร้างโควตาวันลาปี ${formValues.year}...`, 
      text: 'กรุณารอสักครู่ ระบบกำลังประมวลผลให้พนักงานทุกคน',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading() 
    });

    const actorName = window.state?.currentUserProfile?.full_name || 'HR Admin'; 
    const actorId = window.state?.currentUserProfile?.id || null; 

    // ยิง RPC ไปยัง Supabase พร้อมระบุปีที่เลือก
    const { data, error } = await supabaseClient.rpc('fn_reset_yearly_leave', {
      p_target_year: formValues.year,
      p_actor_id: actorId,
      p_actor_name: actorName,
      p_is_force: Boolean(formValues.force)
    });

    if (error) throw error;

    await saveHRActivityLog('LEAVE_SYSTEM', 'RESET_QUOTA', `ปี ${formValues.year}`, `สร้างโควตาวันลาประจำปี ${formValues.year}`);

    Swal.fire({
      icon: 'success',
      title: 'สร้างโควตาวันลาสำเร็จ!',
      text: data?.message || `สร้างสิทธิวันลาปี ${formValues.year} ให้พนักงานเรียบร้อยแล้ว`,
      confirmButtonColor: '#0d9488'
    });

    // ดึงข้อมูลปีที่เพิ่งเจนมาแสดงผลบน Dashboard ทันที
    await fetchLeaveBalances(formValues.year);
    if (typeof renderSummary === 'function') renderSummary();

  } catch (err) {
    showAppError('เกิดข้อผิดพลาดในการเจนโควตา', err.message);
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

// ==========================================
// 4. fetchAllPaginated (รองรับ Data Filtering ตาม Role)
// ==========================================
// ==========================================
// 4. fetchAllPaginated (ป้องกัน Type Mismatch จาก Filter)
// ==========================================
async function fetchAllPaginated(tableName, selectQuery = '*', filters = {}) {
  const client = window.pvtSupabase.getClient();
  const userRole = window.state?.currentUserProfile?.role || 'employee';
  const currentEmpId = window.state?.currentUserProfile?.id;

  let allRecords = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  // ตรวจสอบความถูกต้องของ filters (ต้องเป็น Object)
  const safeFilters = (typeof filters === 'object' && filters !== null) ? filters : {};

  while (hasMore) {
    let query = client.from(tableName).select(selectQuery);

    // ใส่ Custom Filters จาก Parameter
    Object.keys(safeFilters).forEach(key => {
      query = query.eq(key, safeFilters[key]);
    });

    // จำกัดขอบเขตข้อมูลสำหรับ พนักงานทั่วไป (ไม่ใช่ Admin/HR)
    if (userRole === 'employee' && currentEmpId) {
      if (['leave_requests', 'leave_balances'].includes(tableName)) {
        query = query.eq('employee_id', currentEmpId);
      } else if (tableName === 'employees') {
        query = query.eq('id', currentEmpId);
      }
    }

    // ดึงข้อมูลทีละ Range (Pagination)
    const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`Error fetching paginated data from ${tableName}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allRecords = allRecords.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

async function fetchEmployees() {
  try {
    const query = `
      id, employee_code, title, full_name, nickname, phone, email, hospital,
      bank_account, line_id, image_url, start_date, status, role,
      employment_type, department_id, position_id,
      departments(department_name), positions(position_name)
    `;
    employees = await fetchAllPaginated("employees", query);
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
    leaveRequests = await fetchAllPaginated("leave_requests", query);
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

async function fetchLeaveBalances(selectedYear = null) {
  const sb = getSupabase();
  if (!sb) return;

  try {
    // ถ้าไม่ระบุปี ให้ใช้ปี 2027 เป็นหลักกรณีสลับไปดูปีหน้า หรือใช้ปีปัจจุบัน
    const year = selectedYear || 2027; 

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

// ฟังก์ชันระบบช่วยเหลือแนะนำตำแหน่งตามแผนก
window.setupDepartmentPositionHelper = function(deptSelectId, positionSelectId, toggleCheckboxId) {
  const deptSelect = document.getElementById(deptSelectId);
  const posSelect = document.getElementById(positionSelectId);
  const toggleBtn = document.getElementById(toggleCheckboxId);

  if (!deptSelect || !posSelect) return;

  // เก็บ Option ทั้งหมดไว้อ้างอิง
  if (!posSelect.dataset.allOptions) {
    posSelect.dataset.allOptions = posSelect.innerHTML;
  }

  const applyFilter = () => {
    const isHelperActive = toggleBtn ? toggleBtn.checked : true;
    const selectedDeptText = deptSelect.options[deptSelect.selectedIndex]?.text || '';

    // หากปิดระบบช่วยเหลือ ให้คืนค่า Option ทั้งหมด
    if (!isHelperActive || !selectedDeptText || selectedDeptText.includes('เลือก')) {
      posSelect.innerHTML = posSelect.dataset.allOptions;
      return;
    }

    // กรองคำค้นหาเบื้องต้นจากชื่อแผนกและตำแหน่งที่เกี่ยวข้องกัน
    const deptKeywords = selectedDeptText.replace(/(ฝ่าย|แผนก|กลุ่มงาน)/g, '').trim().toLowerCase();
    const options = Array.from(new DOMParser().parseFromString(posSelect.dataset.allOptions, 'text/html').body.children);

    const filteredOptions = options.filter(opt => {
      if (!opt.value) return true; // เก็บ option `-- เลือกตำแหน่ง --` ไว้
      const posText = opt.text.toLowerCase();
      // แนะนำตำแหน่งที่มีความสอดคล้องกับชื่อแผนก
      return posText.includes(deptKeywords) || deptKeywords.includes(posText) || true; 
    });

    posSelect.innerHTML = options.map(opt => opt.outerHTML).join('');
  };

  deptSelect.addEventListener('change', applyFilter);
  if (toggleBtn) toggleBtn.addEventListener('change', applyFilter);
};

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
  const safeRequests = Array.isArray(leaveRequests) ? leaveRequests : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];

  const approvedRequests = safeRequests.filter((item) => {
    const st = String(item?.status || "").toLowerCase().trim();
    return st === "approved" || st === "อนุมัติ" || st === "pass";
  });
  
  const totalApprovedDays = approvedRequests.reduce((sum, item) => {
    return sum + Number(item.actual_days ?? item.total_days ?? item.days_requested ?? item.days ?? 0);
  }, 0);

  const pendingRequests = safeRequests.filter((item) => {
    const st = String(item?.status || "").toLowerCase().trim();
    return st === "pending" || st === "รออนุมัติ" || st === "cancel_pending" || st === "cancel_requested" || st === "ขอยกเลิก";
  });

  setText("statEmployees", safeEmployees.length);
  setText("statLeaves", safeRequests.length);
  setText("statPending", pendingRequests.length);
  setText("statDays", totalApprovedDays > 0 ? totalApprovedDays.toFixed(1).replace(/\.0$/, "") : (safeRequests.length > 0 ? "0" : "0"));

  const typeData = groupByLeaveType();
  const statusData = groupByStatus();

  renderBarChart("typeChart", typeData, false);
  renderBarChart("statusChart", statusData, true);
}

function groupByLeaveType() {
  const safeRequests = Array.isArray(leaveRequests) ? leaveRequests : [];
  const approvedRequests = safeRequests.filter((item) => {
    const st = String(item?.status || "").toLowerCase().trim();
    return st === "approved" || st === "อนุมัติ" || st === "pass";
  });

  const dataset = approvedRequests.length > 0 ? approvedRequests : safeRequests;
  const noteEl = document.getElementById("typeChartNote");
  if (noteEl) {
    noteEl.textContent = approvedRequests.length > 0 ? "อนุมัติแล้ว" : "คำขอทั้งหมด";
    noteEl.className = approvedRequests.length > 0 ? "status active" : "status";
  }

  const map = new Map();
  dataset.forEach((request) => {
    const type = request.leave_types?.leave_name || getLeaveType(request.leave_type_id)?.leave_name || "ไม่ระบุประเภท";
    const days = Number(request.actual_days ?? request.total_days ?? request.days_requested ?? request.days ?? 1) || 1;
    map.set(type, (map.get(type) || 0) + days);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function groupByStatus() {
  const safeRequests = Array.isArray(leaveRequests) ? leaveRequests : [];
  const map = new Map();
  safeRequests.forEach((request) => {
    let label = "รอพิจารณา";
    const st = String(request?.status || "").toLowerCase().trim();
    if (st === "approved" || st === "อนุมัติ" || st === "pass") label = "อนุมัติแล้ว";
    else if (st === "rejected" || st === "ไม่อนุมัติ") label = "ไม่อนุมัติ";
    else if (st === "cancelled" || st === "ยกเลิก") label = "ยกเลิกแล้ว";
    else if (st === "cancel_pending" || st === "cancel_requested" || st === "ขอยกเลิก") label = "ขอยกเลิก";
    else if (st === "pending" || st === "รออนุมัติ") label = "รอพิจารณา";
    else if (window.pvtSupabase?.statusLabel) label = window.pvtSupabase.statusLabel(request.status);
    else label = request.status || "อื่น ๆ";

    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function renderBarChart(targetId, rows, countMode = false) {
  const target = document.getElementById(targetId);
  if (!target) return;

  if (!rows || !rows.length) {
    target.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-soft); font-size:14px;">ยังไม่มีข้อมูลสำหรับแสดงกราฟ</div>`;
    return;
  }

  const max = Math.max(...rows.map(([, value]) => Number(value) || 0), 1);
  const statusColorMap = {
    "อนุมัติแล้ว": "linear-gradient(90deg, #0fa472 0%, #34d399 100%)",
    "รอพิจารณา": "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
    "ขอยกเลิก": "linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)",
    "ไม่อนุมัติ": "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
    "ยกเลิกแล้ว": "linear-gradient(90deg, #64748b 0%, #94a3b8 100%)"
  };

  const typeColorGradients = [
    "linear-gradient(90deg, #0fa472 0%, #34d399 100%)",
    "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
    "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
    "linear-gradient(90deg, #8b5cf6 0%, #c084fc 100%)",
    "linear-gradient(90deg, #ef4444 0%, #f87171 100%)",
    "linear-gradient(90deg, #ec4899 0%, #f472b6 100%)"
  ];

  target.innerHTML = rows.map(([label, value], idx) => {
    const numVal = Number(value) || 0;
    const pct = Math.max(6, Math.min(100, Math.round((numVal / max) * 100)));
    const display = countMode ? `${numVal} รายการ` : `${numVal.toFixed(1).replace(/\.0$/, "")} วัน`;
    const barGradient = statusColorMap[label] || typeColorGradients[idx % typeColorGradients.length];

    return `
      <div class="bar-row">
        <strong title="${escapeHtml(label)}">${escapeHtml(label)}</strong>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background: ${barGradient};"></div>
        </div>
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

      <td>
        <img class="table-avatar" 
            src="${window.pvtSupabase?.getAvatarUrl ? window.pvtSupabase.getAvatarUrl(emp.image_url) : '/assets/img/default-avatar.jpg'}" 
            onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(emp.full_name || 'PVT')}&background=0d9488&color=fff';" 
            alt="${escapeHtml(emp.full_name || '')}" />
      </td>
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

// ปรับปรุงฟอร์มเปิดดู/แก้ไขพนักงานแบบย่อ (ตัด Line, Email, Phone ออก)
function openEmployeeDetail(employeeId, isEditMode = false) {
  const emp = employees.find((item) => String(item.id) === String(employeeId));
  if (!emp) return;

  const requests = leaveRequests.filter((item) => String(item.employee_id) === String(employeeId));
  const balances = leaveBalances.filter((item) => String(item.employee_id) === String(employeeId));
  const modal = document.getElementById("employeeModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");

  if (!isEditMode) {
    if (title) title.innerHTML = `<span>${escapeHtml(emp.employee_code || "-")} · ${escapeHtml(emp.full_name || "-")}</span>`;
    if (body) {
      body.innerHTML = `
        <div class="detail-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 16px;">
          ${detail("ตำแหน่ง", emp.positions?.position_name || "-")}
          ${detail("แผนก", emp.departments?.department_name || "-")}
          ${detail("วันเริ่มงาน", window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(emp.start_date) : (emp.start_date || "-"))}
          ${detail("โรงพยาบาล", emp.hospital || "-")}
          ${detail("บัญชีธนาคาร", emp.bank_account || "-")}
          ${detail("ประเภทพนักงาน", formatEmploymentType(emp.employment_type))}
        </div>
        <div style="margin-bottom:16px;">
          <strong style="font-size:14px; display:block; margin-bottom:8px;">📊 สิทธิวันลาคงเหลือประจำปี</strong>
          ${renderBalanceCards(balances)}
        </div>
        <div>
          <strong style="font-size:14px; display:block; margin-bottom:8px;">📋 ประวัติการลาทั้งหมด</strong>
          <div style="max-height:250px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px;">
            <table style="width:100%; font-size:13px; text-align:left; border-collapse:collapse;">
              <thead style="background:#f8fafc;">
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
                ${requests.length ? requests.map(renderLeaveRow).join("") : '<tr><td colspan="6" class="empty" style="text-align:center; padding:12px; color:#64748b;">ไม่มีประวัติการลา</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } else {
    // โหมดแก้ไข
    if (title) title.innerHTML = `<span>แก้ไขพนักงาน: ${escapeHtml(emp.employee_code || "-")}</span>`;
    
    // สร้าง Dropdown แผนกและตำแหน่ง
    const deptOptions = departments.map(d => `<option value="${d.id}" ${d.id === emp.department_id ? 'selected' : ''}>${escapeHtml(d.department_name)}</option>`).join("");
    const roleOptions = positions.map(p => `<option value="${p.id}" ${p.id === emp.position_id ? 'selected' : ''}>${escapeHtml(p.position_name)}</option>`).join("");
    
    const empTypeOptions = [
      { val: 'full_time', label: 'พนักงานประจำ (Full-time)' },
      { val: 'part_time', label: 'พนักงานพาร์ทไทม์ (Part-time)' },
      { val: 'contract', label: 'พนักงานสัญญาจ้าง (Contract)' },
      { val: 'probation', label: 'ทดลองงาน (Probation)' }
    ].map(t => `<option value="${t.val}" ${t.val === emp.employment_type ? 'selected' : ''}>${t.label}</option>`).join("");

    if (body) {
      body.innerHTML = `
        <form id="inlineEditForm" onsubmit="event.preventDefault(); saveEmployeeInlineEdit('${emp.id}');" style="display:flex; flex-direction:column; gap:16px;">
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
            <div class="input-group">
              <label>รหัสพนักงาน <span class="required">*</span></label>
              <input type="text" id="inline-edit-code" class="text-input" value="${escapeHtml(emp.employee_code || '')}" required>
            </div>
            <div class="input-group">
              <label>ชื่อ-นามสกุล <span class="required">*</span></label>
              <input type="text" id="inline-edit-fullName" class="text-input" value="${escapeHtml(emp.full_name || '')}" required>
            </div>
            <div class="input-group">
              <label>คำนำหน้าชื่อ</label>
              <input type="text" id="inline-edit-title" class="text-input" value="${escapeHtml(emp.title || '')}">
            </div>
            <div class="input-group">
              <label>ชื่อเล่น</label>
              <input type="text" id="inline-edit-nickname" class="text-input" value="${escapeHtml(emp.nickname || '')}">
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
            <div class="input-group">
              <label>แผนก <span class="required">*</span></label>
              <select id="inline-edit-dept" class="select-input" required>
                <option value="">-- เลือกแผนก --</option>
                ${deptOptions}
              </select>
            </div>
            <div class="input-group">
              <label>ตำแหน่ง <span class="required">*</span></label>
              <select id="inline-edit-role" class="select-input" required>
                <option value="">-- เลือกตำแหน่ง --</option>
                ${roleOptions}
              </select>
            </div>
            <div class="input-group">
              <label>ประเภทพนักงาน <span class="required">*</span></label>
              <select id="inline-edit-type" class="select-input" required>
                <option value="">-- เลือกประเภทพนักงาน --</option>
                ${empTypeOptions}
              </select>
            </div>
            <div class="input-group">
              <label>วันเริ่มงาน</label>
              <input type="date" id="inline-edit-startDate" class="text-input" value="${emp.start_date ? emp.start_date.split('T')[0] : ''}">
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
            <div class="input-group">
              <label>เบอร์โทรศัพท์</label>
              <input type="tel" id="inline-edit-phone" class="text-input" value="${escapeHtml(emp.phone || '')}">
            </div>
            <div class="input-group">
              <label>อีเมล</label>
              <input type="email" id="inline-edit-email" class="text-input" value="${escapeHtml(emp.email || '')}">
            </div>
            <div class="input-group">
              <label>LINE ID</label>
              <input type="text" id="inline-edit-lineId" class="text-input" value="${escapeHtml(emp.line_id || '')}">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
            <div class="input-group">
              <label>โรงพยาบาล</label>
              <input type="text" id="inline-edit-hospital" class="text-input" value="${escapeHtml(emp.hospital || '')}">
            </div>
            <div class="input-group">
              <label>บัญชีธนาคาร</label>
              <input type="text" id="inline-edit-bankAccount" class="text-input" value="${escapeHtml(emp.bank_account || '')}">
            </div>
            <div class="input-group">
              <label>อัปเดตรูปประจำตัว</label>
              <input type="file" id="inline-edit-img" class="file-input" accept="image/png, image/jpeg, image/jpg">
            </div>
          </div>
          
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:16px;">
            <button type="button" class="btn-light" onclick="closeEmployeeModal()">ยกเลิก</button>
            <button type="submit" class="btn-primary">บันทึกข้อมูล</button>
          </div>
        </form>
      `;
    }
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

  // ดึงข้อมูล Custom Fields จากหน้าจอ
  const customFields = {};
  const inputs = document.querySelectorAll('.custom-field-input');
  let missingRequiredField = null;

  inputs.forEach(input => {
    const key = input.getAttribute('data-key');
    const isReq = input.getAttribute('data-required') === 'true';
    const val = input.value.trim();

    if (isReq && !val) {
      missingRequiredField = key;
    }
    if (key && val) {
      customFields[key] = val;
    }
  });

  if (missingRequiredField) {
    showAppError("ข้อมูลไม่ครบถ้วน", `กรุณากรอกข้อมูลในคอลัมน์บังคับ: "${missingRequiredField}"`);
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
    custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
  };

  const fileInput = document.getElementById('inline-edit-img');
  if (fileInput && fileInput.files[0]) {
    const uploadedUrl = await uploadEmployeeImage(getSupabase(), code, fileInput.files[0]);
    if (uploadedUrl) updateData.image_url = uploadedUrl;
  }

  // 🛑 เพิ่มปุ่มยืนยันก่อนบันทึกการแก้ไขข้อมูลพนักงาน (ป้องกันลืม/กดพลาด)
  if (window.Swal) {
    const confirmResult = await Swal.fire({
      title: 'ยืนยันการบันทึกแก้ไขข้อมูลพนักงาน?',
      html: `คุณกำลังจะอัปเดตข้อมูลของ <b>"${escapeHtml(name)}"</b> (${escapeHtml(code)})`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0fa472',
      cancelButtonColor: '#64748b',
      confirmButtonText: '✔️ ยืนยันบันทึก',
      cancelButtonText: 'ยกเลิก'
    });
    if (!confirmResult.isConfirmed) return;
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

// ==========================================================================
// 1. ฟังก์ชันช่วยดึง "รายชื่อคอลัมน์พิเศษทั้งหมด" ที่เคยถูกสร้างไว้ในระบบ
// ==========================================================================
async function getAllExistingCustomKeys(supabase) {
  try {
    const definitions = await getCustomFieldDefinitions(supabase);
    const keysSet = new Set();
    if (Array.isArray(definitions)) {
      definitions.forEach(def => {
        if (def && def.name) keysSet.add(def.name.trim());
      });
    }
    return Array.from(keysSet);
  } catch (err) {
    console.warn("Error fetching custom keys:", err);
    return [];
  }
}

// ==========================================================================
// SYSTEM CUSTOM FIELDS & HR MANAGEMENT (แก้ไข ReferenceError แล้ว)
// ==========================================================================

// 1. ดึง คอลัมน์พิเศษ ทั้งหมดจาก system_settings
async function getCustomFieldDefinitions(supabase) {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'custom_field_definitions')
      .maybeSingle();

    return data?.setting_value || [];
  } catch (err) {
    console.error("Error fetching custom definitions:", err);
    return [];
  }
}

// 2. บันทึก คอลัมน์พิเศษ ลง system_settings
async function saveCustomFieldDefinitions(supabase, definitions) {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      setting_key: 'custom_field_definitions',
      setting_value: definitions,
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });

  if (error) throw error;
}

// 3. UI Helpers
window.toggleCustomFieldType = function(type) {
  const optionsSec = document.getElementById('selectOptionsSection');
  if (optionsSec) optionsSec.style.display = (type === 'select') ? 'block' : 'none';
};

window.addChoiceInput = function(value = '') {
  const container = document.getElementById('choiceOptionsContainer');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'choice-option-row';
  div.style.cssText = 'display: flex; gap: 6px; margin-bottom: 6px; align-items: center;';
  div.innerHTML = `
    <input type="text" class="swal2-input choice-val" value="${escapeHtml(value)}" placeholder="เช่น ไซส์ S, แผนก A" style="margin:0; height:34px; flex:1; font-size:12px;">
    <button type="button" onclick="this.parentElement.remove()" style="height:34px; padding:0 10px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; cursor:pointer;">🗑️</button>
  `;
  container.appendChild(div);
};

// 4. Modal สำหรับสร้างคอลัมน์ใหม่ทันที
window.openCreateCustomFieldModal = async function(onSuccessCallback) {
  const supabase = getSupabase();

  const { value: fieldConfig } = await Swal.fire({
    title: '⚙️ สร้างคอลัมน์ใหม่ในระบบ',
    width: 'min(90vw, 550px)',
    html: `
      <div style="text-align:left; font-family:'Sarabun', sans-serif;">
        <div style="margin-bottom: 12px;">
          <label style="font-size:13px; font-weight:600;">ชื่อคอลัมน์ *</label>
          <input id="cf-name" class="swal2-input" placeholder="เช่น ไซส์เสื้อ, ประวัติการแพ้ยา" style="margin:4px 0 0; width:100%; height:38px; font-size:13px;">
        </div>

        <div style="margin-bottom: 12px;">
          <label style="font-size:13px; font-weight:600;">ชนิดคอลัมน์ *</label>
          <select id="cf-type" class="swal2-select" onchange="window.toggleCustomFieldType(this.value)" style="margin:4px 0 0; width:100%; height:38px; font-size:13px;">
            <option value="text">ข้อความทั่วไป (Text)</option>
            <option value="select">รายการตัวเลือก (Dropdown / Select)</option>
          </select>
        </div>

        <div id="selectOptionsSection" style="display:none; margin-bottom: 12px; padding: 10px; background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <label style="font-size:12px; font-weight:700; color:#334155;">รายการช้อยส์ตัวเลือก</label>
            <button type="button" onclick="window.addChoiceInput()" style="font-size:11px; padding:3px 8px; background:#0d9488; color:white; border:none; border-radius:4px; cursor:pointer;">+ เพิ่มช้อยส์</button>
          </div>
          <div id="choiceOptionsContainer"></div>
        </div>

        <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px; background: #fffbe3; padding: 8px 12px; border-radius: 6px; border: 1px solid #fde047;">
          <input type="checkbox" id="cf-required" style="width:16px; height:16px; cursor:pointer;">
          <label for="cf-required" style="font-size:13px; font-weight:600; cursor:pointer; color:#854d0e;">บังคับกรอกข้อมูลหรือไม่? (แสดง * Red Asterisk)</label>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '💾 บันทึกสร้างคอลัมน์',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    didOpen: () => {
      window.addChoiceInput('');
      window.addChoiceInput('');
    },
    preConfirm: () => {
      const name = document.getElementById('cf-name').value.trim();
      const type = document.getElementById('cf-type').value;
      const isRequired = document.getElementById('cf-required').checked;

      if (!name) {
        Swal.showValidationMessage('⚠️ กรุณาระบุชื่อคอลัมน์');
        return false;
      }

      let options = [];
      if (type === 'select') {
        const optionInputs = document.querySelectorAll('.choice-val');
        optionInputs.forEach(input => {
          if (input.value.trim()) options.push(input.value.trim());
        });

        if (options.length === 0) {
          Swal.showValidationMessage('⚠️ กรุณาเพิ่มช้อยส์ตัวเลือกอย่างน้อย 1 รายการ');
          return false;
        }
      }

      return {
        id: 'cf_' + Date.now(),
        name: name,
        type: type,
        required: isRequired,
        options: options
      };
    }
  });

  if (fieldConfig) {
    try {
      const currentDefs = await getCustomFieldDefinitions(supabase);
      currentDefs.push(fieldConfig);
      await saveCustomFieldDefinitions(supabase, currentDefs);

      Swal.fire('สำเร็จ!', `เพิ่มคอลัมน์ "${fieldConfig.name}" เข้าสู่ระบบเรียบร้อยแล้ว`, 'success');
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    }
  }
};

// 5. Double Confirm Delete Column
window.deleteCustomColumnWithDoubleConfirm = async function(fieldId, fieldName, onDeletedCallback) {
  const supabase = getSupabase();

  const confirm1 = await Swal.fire({
    title: `❓ ต้องการลบคอลัมน์ "${fieldName}"?`,
    text: "คอลัมน์นี้จะถูกถอดออกจากระบบและแบบฟอร์มพนักงานทุกคน",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ถัดไป >',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#f59e0b'
  });

  if (!confirm1.isConfirmed) return;

  const confirm2 = await Swal.fire({
    title: `🚨 ยืนยันครั้งที่ 2 (Double Check)`,
    html: `คุณแน่ใจจริงๆ หรือไม่ที่จะลบคอลัมน์ <b style="color:#e11d48;">"${escapeHtml(fieldName)}"</b>?<br><small style="color:#64748b;">ข้อมูลในคอลัมน์นี้ของพนักงานทุกคนอาจหายไปอย่างถาวร!</small>`,
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: '💥 ยืนยันลบเด็ดขาด',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626'
  });

  if (confirm2.isConfirmed) {
    try {
      let currentDefs = await getCustomFieldDefinitions(supabase);
      currentDefs = currentDefs.filter(item => item.id !== fieldId && item.name !== fieldName);
      await saveCustomFieldDefinitions(supabase, currentDefs);

      Swal.fire('ลบสำเร็จ!', `ถอนคอลัมน์ ${fieldName} ออกจากระบบแล้ว`, 'success');
      if (typeof onDeletedCallback === 'function') onDeletedCallback();
    } catch (err) {
      Swal.fire('ลบไม่สำเร็จ', err.message, 'error');
    }
  }
};

// 6. Render Custom Fields HTML
async function renderCustomFieldsHTML(supabase) {
  const customDefs = await getCustomFieldDefinitions(supabase);

  if (customDefs.length === 0) {
    return `<div style="text-align:center; color:#94a3b8; font-size:12px; padding:10px;">ยังไม่มีคอลัมน์พิเศษในระบบ (กดปุ่มจัดการด้านบนได้เลย)</div>`;
  }

  return customDefs.map(field => {
    const reqMark = field.required ? `<span style="color:#e11d48; font-weight:bold;">*</span>` : '';
    let inputControl = '';

    if (field.type === 'select') {
      const opts = field.options.map(o => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
      inputControl = `
        <select class="swal2-select custom-field-input" data-key="${escapeHtml(field.name)}" data-required="${field.required}" style="margin:0; height:38px; width:100%; font-size:13px; background:#fff;">
          <option value="">-- เลือก${escapeHtml(field.name)} --</option>
          ${opts}
        </select>
      `;
    } else {
      inputControl = `
        <input type="text" class="swal2-input custom-field-input" data-key="${escapeHtml(field.name)}" data-required="${field.required}" placeholder="กรอก${escapeHtml(field.name)}" style="margin:0; height:38px; width:100%; font-size:13px; background:#fff;">
      `;
    }

    return `
      <div class="custom-field-row" style="display:flex; gap:8px; align-items:flex-end; margin-bottom:10px;">
        <div style="flex:1;">
          <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:2px;">
            ${escapeHtml(field.name)} ${reqMark}
          </label>
          ${inputControl}
        </div>
        <button type="button" onclick="window.deleteCustomColumnWithDoubleConfirm('${field.id}', '${escapeHtml(field.name)}', () => window.addNewEmployee())" 
                style="height:38px; padding:0 10px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; shrink:0;" title="ลบคอลัมน์นี้ออกจากระบบ">
          🗑️ ลบ
        </button>
      </div>
    `;
  }).join('');
}

// 7. MAIN FUNCTION: addNewEmployee (ผูก window.addNewEmployee ให้ HTML เรียกได้)
window.addNewEmployee = async function addNewEmployee() {
  const supabase = getSupabase();
  if (!supabase || !window.Swal) return;

  try {
    const [deptRes, roleRes, customFieldsHTML] = await Promise.all([
      supabase.from('departments').select('id, department_name'),
      supabase.from('positions').select('id, position_name'),
      renderCustomFieldsHTML(supabase)
    ]);

    let deptOptions = deptRes.data?.map(d => `<option value="${d.id}">${escapeHtml(d.department_name)}</option>`).join('') || '';
    let roleOptions = roleRes.data?.map(r => `<option value="${r.id}">${escapeHtml(r.position_name)}</option>`).join('') || '';

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

          <!-- Section Custom Columns -->
          <div class="custom-fields-section" style="grid-column: 1 / -1; margin-top: 10px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <h6 style="margin: 0; font-weight: 700; color: #0d9488; font-size: 13px;">📌 ข้อมูลเพิ่มเติม (คอลัมน์กำหนดเอง)</h6>
              <button type="button" class="btn-light btn-sm" onclick="window.openCreateCustomFieldModal(() => window.addNewEmployee())" style="font-size: 12px; padding: 5px 12px; background: #0d9488; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ⚙️ จัดการ/เพิ่มคอลัมน์ระบบ
              </button>
            </div>
            <div id="customColumnsContainer">${customFieldsHTML}</div>
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

        // Check Validation Custom Fields (Required Check)
        const customFields = {};
        const inputs = document.querySelectorAll('.custom-field-input');
        let missingRequiredField = null;

        inputs.forEach(input => {
          const key = input.getAttribute('data-key');
          const isReq = input.getAttribute('data-required') === 'true';
          const val = input.value.trim();

          if (isReq && !val) {
            missingRequiredField = key;
          }
          if (key && val) {
            customFields[key] = val;
          }
        });

        if (missingRequiredField) {
          Swal.showValidationMessage(`⚠️ กรุณากรอกข้อมูลในคอลัมน์บังคับ: "${missingRequiredField}"`);
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
          custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
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
};

async function editEmployeeData(presetSearchKey = null) {
  if (presetSearchKey) {
    const emp = employees.find(e => e.employee_code === presetSearchKey || e.id === presetSearchKey);
    if (emp) {
      openEmployeeDetail(emp.id, true);
      return;
    }
  }

  if (!window.Swal) return;

  // 💡 สร้างรายการตัวเลือกพนักงานทั้งหมดมาเป็น <option>
  const employeeOptions = employees.map(e => 
    `<option value="${escapeHtml(e.employee_code || '')}">${escapeHtml(e.full_name || '')} (${escapeHtml(e.departments?.department_name || 'ไม่ระบุแผนก')})</option>`
  ).join('');

  const { value: inputKey } = await Swal.fire({
    title: '🔍 ค้นหาและจัดการแฟ้มบุคคล',
    html: `
      <div style="text-align:left; font-family:'Sarabun', sans-serif;">
        <label style="font-size:13px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">
          พิมพ์ค้นหารหัส หรือ ชื่อ-นามสกุล พนักงาน
        </label>
        <input id="swal-search-emp" class="swal2-input" list="employeeListSuggestions" placeholder="เช่น 19001 หรือ สมชาย..." style="margin:0; width:100%; height:42px; font-size:14px;">
        <datalist id="employeeListSuggestions">
          ${employeeOptions}
        </datalist>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'ดึงข้อมูล',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    preConfirm: () => {
      const val = document.getElementById('swal-search-emp')?.value.trim();
      if (!val) {
        Swal.showValidationMessage('❌ กรุณาระบุรหัส หรือชื่อพนักงานที่ต้องการค้นหา');
        return false;
      }
      return val;
    }
  });

  if (!inputKey) return;

  // ค้นหาจากทั้ง รหัสพนักงาน และ ชื่อ-นามสกุล
  const emp = employees.find(e =>
    e.employee_code?.toLowerCase() === inputKey.toLowerCase() ||
    e.full_name?.toLowerCase().includes(inputKey.toLowerCase())
  );

  if (emp) {
    openEmployeeDetail(emp.id, true);
  } else {
    Swal.fire('ไม่พบพนักงาน', `ไม่พบข้อมูลพนักงานที่ค้นหา: ${escapeHtml(inputKey)}`, 'warning');
  }
}

// ==========================================
// 2. deleteEmployee (มีระบบลบแบบ Cascading Safety)
// ==========================================
// ==========================================
// deleteEmployee (ใช้ window.state ป้องกัน Error)
// ==========================================
async function deleteEmployee(employeeId, employeeCode, employeeName) {
  // เช็กสิทธิ์ก่อนทำรายการ
  const userRole = window.state?.currentUserProfile?.role;
  if (!['admin', 'hr'].includes(userRole)) {
    return Swal.fire('ไม่มีสิทธิ์', 'เฉพาะ Admin และ HR เท่านั้นที่สามารถลบพนักงานได้', 'error');
  }

  const confirm = await Swal.fire({
    title: `ยืนยันการลบพนักงาน?`,
    html: `คุณกำลังจะลบ <b>"${employeeName}"</b><br><span style="color:red; font-size:13px;">* ข้อมูลวันลาและประวัติทั้งหมดจะถูกลบถาวร</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'ยืนยันลบข้อมูล',
    cancelButtonText: 'ยกเลิก'
  });

  if (!confirm.isConfirmed) return;

  Swal.showLoading();

  try {
    const client = window.pvtSupabase.getClient();

    // วิธีที่ 1: เรียกใช้ RPC (Stored Procedure) เพื่อลบแบบ atomic บน Database
    const { error: rpcError } = await client.rpc('delete_employee_cascade', {
      p_emp_id: employeeId
    });

    // วิธีที่ 2 (Fallback): หากยังไม่ได้สร้าง RPC ใน Supabase ให้ทำ Sequential Delete ฝั่ง Client
    if (rpcError) {
      console.warn("RPC delete_employee_cascade ไม่พร้อมใช้งาน, ระบบจะใช้ Fallback Delete:", rpcError.message);

      await client.from('leave_balances').delete().eq('employee_id', employeeId);
      await client.from('leave_requests').delete().eq('employee_id', employeeId);
      await client.from('profiles').update({ employee_id: null }).eq('employee_id', employeeId);
      
      const { error: empErr } = await client.from('employees').delete().eq('id', employeeId);
      if (empErr) throw empErr;
    }

    await saveHRActivityLog('EMPLOYEE', 'DELETE', employeeCode || employeeId, `ลบพนักงาน ${employeeName}`);

    Swal.fire('สำเร็จ!', 'ลบข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
    
    // รีโหลดข้อมูลหน้าเว็บ
    await refreshDashboard();
  } catch (err) {
    console.error("deleteEmployee Error:", err);
    Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถลบข้อมูลได้: ${err.message}`, 'error');
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
    const { data: rules, error } = await supabase.from('leave_types').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    Swal.close();

    let tableRowsHTML = rules.map(r => `
      <tr style="border-bottom:1px solid #e2e8f0;" id="rule-row-${r.id}">
        <td style="padding:8px; border:1px solid #cbd5e1;">
          <input type="text" id="rule-name-${r.id}" class="swal2-input" value="${escapeHtml(r.leave_name)}" style="margin:0; height:36px; font-size:13px; width:100%;">
          <small style="color:#64748b; font-size:10px;">รหัส: ${escapeHtml(r.leave_code)}</small>
        </td>
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
          <input type="number" id="rule-quota-${r.id}" class="swal2-input" value="${r.yearly_quota || 0}" step="0.5" min="0" style="margin:0; height:36px; font-size:13px; text-align:center; width:80px;">
        </td>
        <td style="padding:8px; border:1px solid #cbd5e1; text-align:center;">
          <button type="button" onclick="saveSingleLeaveRule('${r.id}')" style="padding:4px 8px; background:#0d9488; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px;">💾 บันทึก</button>
        </td>
      </tr>
    `).join('');

    await Swal.fire({
      title: '⚙️ ตั้งค่าโควตากลาง & แก้ไขชื่อประเภทวันลา',
      width: 'min(92vw, 650px)',
      html: `
        <div style="font-family:'Sarabun', sans-serif; text-align:left; margin-bottom:12px;">
          <button type="button" onclick="addNewLeaveTypeModal()" class="action-btn success-zone" style="font-size:12px; padding:6px 12px;">
            ➕ เพิ่มประเภทการลาใหม่
          </button>
        </div>
        <div style="max-height: 350px; overflow-y: auto; font-family:'Sarabun', sans-serif;">
          <table style="width:100%; text-align:left; font-size:13px; border-collapse:collapse;">
            <thead>
              <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
                <th style="padding:8px; border:1px solid #cbd5e1;">ชื่อประเภทการลา</th>
                <th style="padding:8px; border:1px solid #cbd5e1; width:100px; text-align:center;">โควตา (วัน/ปี)</th>
                <th style="padding:8px; border:1px solid #cbd5e1; width:80px; text-align:center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHTML}
            </tbody>
          </table>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'ปิดหน้าต่าง'
    });

  } catch (err) {
    showAppError("ไม่สามารถดึงข้อมูลโควตากลางได้", err.message);
  }
}

// ฟังก์ชันบันทึกชื่อและโควตา
async function saveSingleLeaveRule(ruleId) {
  const supabase = getSupabase();
  const newName = document.getElementById(`rule-name-${ruleId}`)?.value.trim();
  const newQuota = parseFloat(document.getElementById(`rule-quota-${ruleId}`)?.value) || 0;

  if (!newName) {
    Swal.fire('ข้อผิดพลาด', 'กรุณาระบุชื่อประเภทการลา', 'warning');
    return;
  }

  // 🛑 ยืนยันก่อนบันทึกโควตา/กฎการลา
  if (window.Swal) {
    const confirmResult = await Swal.fire({
      title: 'ยืนยันการปรับโควตาประเภทการลา?',
      text: `ต้องการปรับเปลี่ยนชื่อเป็น "${newName}" และโควตาเป็น ${newQuota} วัน ใช่หรือไม่`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0fa472',
      cancelButtonColor: '#64748b',
      confirmButtonText: '✔️ ยืนยันบันทึก',
      cancelButtonText: 'ยกเลิก'
    });
    if (!confirmResult.isConfirmed) return;
  }

  try {
    const { error } = await supabase
      .from('leave_types')
      .update({ leave_name: newName, yearly_quota: newQuota })
      .eq('id', ruleId);

    if (error) throw error;

    await saveHRActivityLog('LEAVE_RULE', 'UPDATE', newName, `ปรับแก้ไขชื่อประเภทวันลาเป็น "${newName}" และโควตาเป็น ${newQuota} วัน`);
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: `อัปเดตข้อมูล "${newName}" เรียบร้อยแล้ว`, timer: 1500, showConfirmButton: false });
    refreshDashboard();
  } catch (err) {
    showAppError("บันทึกโควตากลางไม่สำเร็จ", err.message);
  }
}

// ฟังก์ชันเพิ่มประเภทการลาใหม่
async function addNewLeaveTypeModal() {
  const supabase = getSupabase();
  const { value: formValues } = await Swal.fire({
    title: '➕ เพิ่มประเภทการลาใหม่',
    html: `
      <div style="text-align:left; font-family:'Sarabun', sans-serif;">
        <label style="font-size:12px; font-weight:600;">รหัสการลา (Code) *</label>
        <input id="new-lt-code" class="swal2-input" placeholder="เช่น VAC, SICK" style="margin:4px 0 10px; height:38px; font-size:13px; width:100%;">
        <label style="font-size:12px; font-weight:600;">ชื่อประเภทการลา *</label>
        <input id="new-lt-name" class="swal2-input" placeholder="เช่น ลาพักร้อนประจำปี" style="margin:4px 0 10px; height:38px; font-size:13px; width:100%;">
        <label style="font-size:12px; font-weight:600;">โควตากลาง (วัน/ปี)</label>
        <input type="number" id="new-lt-quota" class="swal2-input" value="6" step="0.5" style="margin:4px 0 0; height:38px; font-size:13px; width:100%;">
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกประเภทใหม่',
    cancelButtonText: 'ยกเลิก',
    preConfirm: () => {
      const code = document.getElementById('new-lt-code').value.trim();
      const name = document.getElementById('new-lt-name').value.trim();
      const quota = parseFloat(document.getElementById('new-lt-quota').value) || 0;
      if (!code || !name) {
        Swal.showValidationMessage('กรุณากรอกรหัสและชื่อประเภทวันลาให้ครบถ้วน');
        return false;
      }
      return { leave_code: code, leave_name: name, yearly_quota: quota };
    }
  });

  if (formValues) {
    const { error } = await supabase.from('leave_types').insert([formValues]);
    if (error) {
      showAppError('ไม่สามารถเพิ่มประเภทการลาได้', error.message);
    } else {
      Swal.fire('สำเร็จ', 'เพิ่มประเภทวันลาเรียบร้อยแล้ว', 'success');
      editGlobalLeaveRules();
    }
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

// =========================================================================
// 📅 หมวดหมู่ระบบจัดการวันหยุดบริษัท (COMPANY HOLIDAYS MANAGEMENT MODULE)
// =========================================================================

// ตัวแปรเก็บแคชรายการวันหยุด
let companyHolidaysCache = [];

/**
 * 1. ดึงข้อมูลวันหยุดจาก Supabase
 */
async function fetchCompanyHolidaysData() {
  const sb = getSupabase(); // เรียกใช้ฟังก์ชันเชื่อมต่อ Supabase ในระบบ
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from('holidays')
      .select('*')
      .order('holiday_date', { ascending: true });

    if (error) throw error;
    companyHolidaysCache = data || [];
    return companyHolidaysCache;
  } catch (err) {
    console.error("Fetch Company Holidays Error:", err);
    showAppError("โหลดข้อมูลวันหยุดไม่สำเร็จ", err.message); //
    return [];
  }
}

/**
 * 2. ฟังก์ชันหลัก: เปิดหน้าต่าง (Modal) จัดการวันหยุดทั้งหมด
 * (สร้าง UI ตาราง และปุ่มต่าง ๆ ไดนามิกจาก JS โดยไม่ต้องเขียน HTML รอตารางไว้)
 */
async function openHolidayManagerModal() {
  if (!window.Swal) return;

  Swal.fire({
    title: '⏳ กำลังโหลดข้อมูลวันหยุด...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const holidays = await fetchCompanyHolidaysData();

  const typeMap = {
    public_holiday: { label: 'วันหยุดนักขัตฤกษ์', style: 'background:#ccfbf1; color:#0f766e;' },
    company_holiday: { label: 'วันหยุดพิเศษบริษัท', style: 'background:#e0e7ff; color:#3730a3;' },
    tradition_holiday: { label: 'วันหยุดตามประเพณี', style: 'background:#fef3c7; color:#92400e;' }
  };

  const rowsHtml = holidays.length === 0
    ? `<tr><td colspan="5" style="text-align:center; padding: 24px; color: #94a3b8;">ไม่พบรายการวันหยุดบริษัท</td></tr>`
    : holidays.map(h => {
        const typeInfo = typeMap[h.holiday_type] || { label: h.holiday_type || 'วันหยุดทั่วไป', style: 'background:#f1f5f9; color:#475569;' };
        const formattedDate = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(h.holiday_date) : h.holiday_date; //

        return `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px; font-weight: 600; color: #334155; white-space: nowrap;">${formattedDate}</td>
            <td style="padding: 10px; text-align: left;">
              <div style="font-weight: 600; color: #0f172a;">${escapeHtml(h.holiday_name)}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 2px;">${escapeHtml(h.description || '-')}</div>
            </td>
            <td style="padding: 10px;">
              <span style="padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; ${typeInfo.style}">
                ${typeInfo.label}
              </span>
            </td>
            <td style="padding: 10px; text-align: center; white-space: nowrap;">
              <span style="padding: 3px 8px; border-radius: 4px; font-size: 11px; background: ${h.is_paid !== false ? '#dcfce7' : '#f1f5f9'}; color: ${h.is_paid !== false ? '#15803d' : '#64748b'}; font-weight: 600;">
                ${h.is_paid !== false ? 'ได้รับค่าจ้าง' : 'ไม่ได้รับค่าจ้าง'}
              </span>
            </td>
            <td style="padding: 10px; text-align: center; white-space: nowrap;">
              <button onclick="openEditHolidayModal(${h.id})" style="background:#f8fafc; color:#0284c7; border:1px solid #bae6fd; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px; margin-right:4px;">
                ✏️ แก้ไข
              </button>
                <button onclick="deleteHoliday('${h.id}')" style="background:#fff1f2; color:#e11d48; border:1px solid #fecdd3; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:12px;">
                  🗑️ ลบ
                </button>
            </td>
          </tr>
        `;
      }).join('');

  Swal.fire({
    title: '📅 จัดการวันหยุดบริษัท',
    width: 'min(94vw, 850px)',
    html: `
      <div style="font-family: 'Sarabun', sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <span style="font-size: 13px; color: #64748b;">รายการวันหยุดทั้งหมดประจำปี</span>
          <button onclick="openAddHolidayModal()" style="display: flex; align-items: center; gap: 4px; padding: 8px 14px; background: #0d9488; color: #fff; border: none; border-radius: 8px; font-weight: 500; font-size: 13px; cursor: pointer;">
            ➕ เพิ่มวันหยุดใหม่
          </button>
        </div>

        <div style="max-height: 420px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead style="position: sticky; top: 0; background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569;">
              <tr>
                <th style="padding: 10px;">วันที่</th>
                <th style="padding: 10px;">ชื่อวันหยุด & รายละเอียด</th>
                <th style="padding: 10px;">ประเภท</th>
                <th style="padding: 10px; text-align: center;">สิทธิ์ค่าจ้าง</th>
                <th style="padding: 10px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true
  });
}

/**
 * 3. เปิด Modal สำหรับ "เพิ่มวันหยุดใหม่"
 */
async function openAddHolidayModal() {
  if (!window.Swal) return;

  const { value: formValues } = await Swal.fire({
    title: '➕ เพิ่มวันหยุดบริษัท',
    width: 'min(92vw, 480px)',
    html: `
      <div style="text-align: left; display: flex; flex-direction: column; gap: 12px; font-family: 'Sarabun', sans-serif;">
        <div>
          <label style="font-size: 13px; font-weight: 600;">ชื่อวันหยุด *</label>
          <input id="swal-holiday-name" class="swal2-input" placeholder="เช่น วันขึ้นปีใหม่" style="margin: 4px 0 0; width: 100%; height: 38px;">
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 600;">วันที่ *</label>
          <input type="date" id="swal-holiday-date" class="swal2-input" style="margin: 4px 0 0; width: 100%; height: 38px;">
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 600;">ประเภทวันหยุด *</label>
          <select id="swal-holiday-type" class="swal2-select" style="margin: 4px 0 0; width: 100%; height: 38px;">
            <option value="public_holiday">วันหยุดนักขัตฤกษ์</option>
            <option value="company_holiday">วันหยุดพิเศษบริษัท</option>
            <option value="tradition_holiday">วันหยุดตามประเพณี</option>
          </select>
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 600;">รายละเอียดเพิ่มเติม</label>
          <textarea id="swal-holiday-desc" class="swal2-textarea" placeholder="รายละเอียดวันหยุด..." style="margin: 4px 0 0; width: 100%; height: 60px; font-size: 13px;"></textarea>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="swal-holiday-paid" checked style="width: 16px; height: 16px; cursor: pointer;">
          <label for="swal-holiday-paid" style="font-size: 13px; font-weight: 600; cursor: pointer;">ได้รับค่าจ้าง (Paid Leave)</label>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: '💾 บันทึกวันหยุด',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    preConfirm: () => {
      const name = document.getElementById('swal-holiday-name').value.trim();
      const date = document.getElementById('swal-holiday-date').value;
      const type = document.getElementById('swal-holiday-type').value;
      const desc = document.getElementById('swal-holiday-desc').value.trim();
      const isPaid = document.getElementById('swal-holiday-paid').checked;

      if (!name || !date) {
        Swal.showValidationMessage('⚠️ กรุณากรอกชื่อวันหยุดและเลือกวันที่ให้ครบถ้วน');
        return false;
      }
      return { holiday_name: name, holiday_date: date, holiday_type: type, description: desc, is_paid: isPaid };
    }
  });

  if (formValues) {
    try {
      const supabase = getSupabase();
      Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
      const { error } = await supabase.from('holidays').insert([formValues]);
      if (error) throw error;

      await saveHRActivityLog('HOLIDAY', 'INSERT', formValues.holiday_name, `เพิ่มวันหยุดบริษัท: ${formValues.holiday_name} (${formValues.holiday_date})`);
      Swal.fire('สำเร็จ!', 'บันทึกวันหยุดเรียบร้อยแล้ว', 'success');
      openHolidayManagerModal();
    } catch (err) {
      showAppError('ไม่สามารถเพิ่มวันหยุดได้', err.message);
    }
  }
}

/**
 * 4. เปิด Modal สำหรับ "แก้ไขวันหยุด" (แก้ไข ชื่อ, รายละเอียด, ประเภท, วันที่, สิทธิ์ค่าจ้าง)
 */
async function openEditHolidayModal(holidayId) {
  const holiday = companyHolidaysCache.find(h => String(h.id) === String(holidayId));
  if (!holiday) {
    showAppError("ไม่พบข้อมูล", "ไม่พบข้อมูลวันหยุดที่ต้องการแก้ไข");
    return;
  }

  const { value: formValues } = await Swal.fire({
    title: '✏️ แก้ไขวันหยุดบริษัท',
    width: 'min(92vw, 480px)',
    html: `
      <div style="text-align: left; display: flex; flex-direction: column; gap: 12px; font-family: 'Sarabun', sans-serif;">
        <div>
          <label style="font-size: 13px; font-weight: 600; color: #334155;">วันที่วันหยุด <span style="color:red">*</span></label>
          <input type="date" id="swal-edit-holiday-date" class="swal2-input" value="${holiday.holiday_date}" style="width: 100%; margin: 4px 0 0 0; font-size: 14px;">
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 600; color: #334155;">ชื่อวันหยุด <span style="color:red">*</span></label>
          <input type="text" id="swal-edit-holiday-name" class="swal2-input" value="${escapeHtml(holiday.holiday_name || '')}" placeholder="เช่น วันสงกรานต์" style="width: 100%; margin: 4px 0 0 0; font-size: 14px;">
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 600; color: #334155;">ประเภทวันหยุด</label>
          <select id="swal-edit-holiday-type" class="swal2-select" style="width: 100%; margin: 4px 0 0 0; height: 42px; border-radius: 8px; font-size: 14px;">
            <option value="public_holiday" ${holiday.holiday_type === 'public_holiday' ? 'selected' : ''}>วันหยุดนักขัตฤกษ์</option>
            <option value="company_holiday" ${holiday.holiday_type === 'company_holiday' ? 'selected' : ''}>วันหยุดพิเศษบริษัท</option>
            <option value="tradition_holiday" ${holiday.holiday_type === 'tradition_holiday' ? 'selected' : ''}>วันหยุดตามประเพณี</option>
          </select>
        </div>
        <div>
          <label style="font-size: 13px; font-weight: 600; color: #334155;">รายละเอียดเพิ่มเติม</label>
          <textarea id="swal-edit-holiday-desc" class="swal2-textarea" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)" style="width: 100%; margin: 4px 0 0 0; height: 70px; font-size: 14px;">${escapeHtml(holiday.description || '')}</textarea>
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
          <input type="checkbox" id="swal-edit-holiday-paid" ${holiday.is_paid !== false ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: #0d9488;">
          <label for="swal-edit-holiday-paid" style="font-size: 13px; font-weight: 500; cursor: pointer;">เป็นวันหยุดที่ได้รับค่าจ้าง (Paid Holiday)</label>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกการแก้ไข',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    focusConfirm: false,
    preConfirm: () => {
      const date = document.getElementById('swal-edit-holiday-date').value;
      const name = document.getElementById('swal-edit-holiday-name').value.trim();
      const type = document.getElementById('swal-edit-holiday-type').value;
      const desc = document.getElementById('swal-edit-holiday-desc').value.trim();
      const isPaid = document.getElementById('swal-edit-holiday-paid').checked;

      if (!date || !name) {
        Swal.showValidationMessage('กรุณากรอกวันที่และชื่อวันหยุดให้ครบถ้วน');
        return false;
      }
      return {
        holiday_date: date,
        holiday_name: name,
        holiday_type: type,
        description: desc,
        is_paid: isPaid
      };
    }
  });

  if (formValues) {
    const sb = getSupabase();
    const { error } = await sb
      .from('holidays')
      .update(formValues)
      .eq('id', holidayId);

    if (error) {
      showAppError('แก้ไขวันหยุดไม่สำเร็จ', error.message);
    } else {
      if (typeof saveHRActivityLog === 'function') {
        saveHRActivityLog('วันหยุดบริษัท', 'แก้ไขวันหยุด', formValues.holiday_name, `อัปเดต ID: ${holidayId}`); //
      }
      Swal.fire({ icon: 'success', title: 'อัปเดตข้อมูลวันหยุดเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
      openHolidayManagerModal(); // รีโหลด Popup ตารางหลัก
    }
  }
}

/**
 * 5. ฟังก์ชันลบรายการวันหยุด
 */
// =========================================================================
// 🗑️ ฟังก์ชันลบวันหยุด (รองรับทั้งการคลิก Inline และป้องกัน Quote Error)
// =========================================================================

/**
 * ฟังก์ชันลบรายการวันหยุด
 * @param {number|string} holidayId - ID ของวันหยุดที่ต้องการลบ
 */
async function deleteHoliday(holidayId) {
  // 1. ค้นหาข้อมูลวันหยุดจาก Cache ด้วย ID เพื่อเลี่ยงปัญหาการส่ง String ชื่อผ่าน HTML onclick
  const holiday = (companyHolidaysCache || []).find(h => String(h.id) === String(holidayId));
  const holidayName = holiday ? (holiday.holiday_name || holiday.name || 'รายการนี้') : 'รายการนี้';

  if (!window.Swal) return;

  // 2. แสดง Popup ยืนยันการลบ
  const result = await Swal.fire({
    title: 'ยืนยันลบวันหยุด?',
    text: `คุณต้องการลบ "${holidayName}" ออกจากระบบใช่หรือไม่`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยันลบ',
    cancelButtonText: 'ยกเลิก',
    reverseButtons: true
  });

  if (result.isConfirmed) {
    try {
      const sb = getSupabase();
      // ลบข้อมูลออกจากตาราง holidays ใน Supabase
      const { error } = await sb.from('holidays').delete().eq('id', holidayId);

      if (error) throw error;

      // บันทึก Log การลบ
      if (typeof saveHRActivityLog === 'function') {
        saveHRActivityLog('วันหยุดบริษัท', 'ลบวันหยุด', holidayName, `ลบข้อมูล ID: ${holidayId}`);
      }

      await Swal.fire({ 
        icon: 'success', 
        title: 'ลบรายการสำเร็จ', 
        timer: 1500, 
        showConfirmButton: false 
      });

      // รีโหลด Modal ตารางวันหยุดใหม่
      if (typeof openHolidayManagerModal === 'function') {
        openHolidayManagerModal();
      }
    } catch (err) {
      console.error("Delete Holiday Error:", err);
      showAppError('ลบวันหยุดไม่สำเร็จ', err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    }
  }
}

// ⚠️ สำคัญมาก: ผูกฟังก์ชันเข้ากับ window เพื่อให้ onclick ใน HTML เรียกใช้งานได้เสมอ
window.deleteHoliday = deleteHoliday;

// ==========================================
// EXCEL EXPORT ENGINE (EXCELJS INTEGRATION)
// ==========================================
async function exportAllLeaveHistoryExcel() {
  if (!leaveRequests || !leaveRequests.length) {
    showAppError("ไม่พบข้อมูล", "ยังไม่มีประวัติการลาในระบบสำหรับส่งออก");
    return;
  }

  if (typeof ExcelJS === "undefined") {
    showAppError("ไลบรารีไม่พร้อมใช้งาน", "ยังไม่ได้โหลด ExcelJS กรุณารีเฟรชหน้าเว็บ");
    return;
  }

  // 1. ให้ผู้ใช้เลือกรูปแบบรายงานที่ต้องการ
  const { value: exportType } = await Swal.fire({
    title: '📊 ส่งออกรายงานการลา Excel',
    text: 'กรุณาเลือกรูปแบบรายงานที่คุณต้องการดาวน์โหลด',
    icon: 'question',
    showCancelButton: true,
    showDenyButton: true,
    confirmButtonText: '📈 สรุปภาพรวม (Executive Summary)',
    denyButtonText: '📄 ข้อมูลดิบทั้งหมด (Raw Data)',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    denyButtonColor: '#3b82f6',
    width: 'min(92vw, 550px)'
  });

  if (exportType === undefined) return; // กดยกเลิก

  Swal.fire({
    title: 'กำลังสร้างไฟล์ Excel...',
    text: 'ระบบกำลังประมวลผลข้อมูลและจัดรูปแบบรายงาน',
    didOpen: () => Swal.showLoading()
  });

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PVT Workforce Hub";
    workbook.created = new Date();

    const isSummaryMode = exportType === true; // กดเลือก Executive Summary

    // -------------------------------------------------------------
    // SHEET 1: สรุปภาพรวม (กรณีเลือก Executive Summary)
    // -------------------------------------------------------------
    if (isSummaryMode) {
      const summarySheet = workbook.addWorksheet("สรุปภาพรวม (Summary)");
      summarySheet.views = [{ showGridLines: true }];

      // หัวข้อรายงาน
      summarySheet.mergeCells("A1:E1");
      const titleCell = summarySheet.getCell("A1");
      titleCell.value = "🏢 รายงานสรุปภาพรวมการลาพนักงาน (Executive Leave Dashboard)";
      titleCell.font = { name: "Sarabun", size: 16, bold: true, color: { argb: "FF0F766E" } };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };

      summarySheet.getCell("A2").value = `วันที่ดึงรายงาน: ${new Date().toLocaleDateString("th-TH")} | สังกัด: ทุกแผนก`;
      summarySheet.getCell("A2").font = { name: "Sarabun", size: 10, italic: true, color: { argb: "FF64748B" } };

      // KPI Cards (กล่องสรุปตัวเลข)
      const approvedList = leaveRequests.filter(r => String(r.status).toLowerCase() === "approved");
      const totalDays = approvedList.reduce((sum, r) => sum + Number(r.total_days || 0), 0);
      const pendingCount = leaveRequests.filter(r => String(r.status).toLowerCase() === "pending").length;

      summarySheet.getRow(4).values = ["สถิติลารวมทั้งหมด", "อนุมัติแล้ว (วัน)", "รออนุมัติ (รายการ)", "พนักงานทั้งหมด"];
      summarySheet.getRow(5).values = [leaveRequests.length, totalDays, pendingCount, employees.length];

      // จัดสไตล์ KPI Cards
      const kpiHeaderRow = summarySheet.getRow(4);
      const kpiValueRow = summarySheet.getRow(5);
      
      for (let col = 1; col <= 4; col++) {
        const hCell = kpiHeaderRow.getCell(col);
        const vCell = kpiValueRow.getCell(col);

        hCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
        hCell.font = { bold: true, size: 10, color: { argb: "FF475569" } };
        hCell.alignment = { horizontal: "center", vertical: "middle" };

        vCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDFA" } };
        vCell.font = { bold: true, size: 14, color: { argb: "FF0D9488" } };
        vCell.alignment = { horizontal: "center", vertical: "middle" };

        hCell.border = { top: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
        vCell.border = { bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
      }

      // ตารางตารางสรุปแยกตามประเภทการลา
      summarySheet.getCell("A7").value = "📊 สรุปจำนวนวันลาแยกตามประเภท (เฉพาะที่อนุมัติ)";
      summarySheet.getCell("A7").font = { bold: true, size: 12, color: { argb: "FF1E293B" } };

      const typeSummaryHeader = summarySheet.getRow(8);
      typeSummaryHeader.values = ["ประเภทการลา", "จำนวนรายการ", "รวมจำนวนวันลา"];
      typeSummaryHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
      typeSummaryHeader.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
        cell.alignment = { horizontal: "center" };
      });

      // ดึงสถิติแยกตามประเภท
      const typeMap = new Map();
      approvedList.forEach(r => {
        const typeName = getLeaveType(r.leave_type_id)?.leave_name || "อื่นๆ";
        const current = typeMap.get(typeName) || { count: 0, days: 0 };
        typeMap.set(typeName, { count: current.count + 1, days: current.days + Number(r.total_days || 0) });
      });

      let currentRowIdx = 9;
      typeMap.forEach((val, typeName) => {
        const row = summarySheet.getRow(currentRowIdx);
        row.values = [typeName, val.count, val.days];
        row.getCell(1).alignment = { horizontal: "left" };
        row.getCell(2).alignment = { horizontal: "center" };
        row.getCell(3).alignment = { horizontal: "right" };
        row.eachCell(cell => {
          cell.border = { top: {style:'thin', color:{argb:'FFE2E8F0'}}, bottom: {style:'thin', color:{argb:'FFE2E8F0'}}, left: {style:'thin', color:{argb:'FFE2E8F0'}}, right: {style:'thin', color:{argb:'FFE2E8F0'}} };
        });
        currentRowIdx++;
      });
    }

    // -------------------------------------------------------------
    // SHEET 2: ข้อมูลดิบ (RAW DATA LEAVE HISTORY)
    // -------------------------------------------------------------
    const rawSheet = workbook.addWorksheet("ประวัติการลาทั้งหมด (Data)");
    rawSheet.views = [{ showGridLines: true }];

    // กำหนดโครงสร้างคอลัมน์
    rawSheet.columns = [
      { header: "รหัสพนักงาน", key: "emp_code", width: 14 },
      { header: "ชื่อ-นามสกุล", key: "emp_name", width: 22 },
      { header: "แผนก/ฝ่าย", key: "dept", width: 18 },
      { header: "ตำแหน่ง", key: "position", width: 20 },
      { header: "ประเภทการลา", key: "leave_type", width: 18 },
      { header: "วันที่เริ่มต้น", key: "start_date", width: 14 },
      { header: "วันที่สิ้นสุด", key: "end_date", width: 14 },
      { header: "จำนวนวัน", key: "total_days", width: 12 },
      { header: "เหตุผลการลา", key: "reason", width: 30 },
      { header: "สถานะคำขอ", key: "status", width: 14 },
      { header: "วันที่ยื่นคำขอ", key: "created_at", width: 18 }
    ];

    // ตกแต่ง Header ของตารางข้อมูลดิบ
    const headerRow = rawSheet.getRow(1);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
      cell.font = { name: "Sarabun", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { top: { style: "medium" }, bottom: { style: "medium" } };
    });

    // วนลูปเพิ่ม Row ข้อมูล
    leaveRequests.forEach((r, idx) => {
      const emp = employees.find((e) => String(e.id) === String(r.employee_id));
      const leaveType = getLeaveType(r.leave_type_id)?.leave_name || "ไม่ระบุ";
      const statusText = window.pvtSupabase?.statusLabel ? window.pvtSupabase.statusLabel(r.status) : (r.status || "-");
      
      const createdDateFormatted = r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : "-";

      const addedRow = rawSheet.addRow({
        emp_code: emp?.employee_code || "-",
        emp_name: emp?.full_name || "-",
        dept: emp?.departments?.department_name || "-",
        position: emp?.positions?.position_name || "-",
        leave_type: leaveType,
        start_date: window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(r.start_date) : r.start_date,
        end_date: window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(r.end_date) : r.end_date,
        total_days: Number(r.total_days || 0),
        reason: (r.reason || r.note || "-").trim(),
        status: statusText,
        created_at: createdDateFormatted
      });

      addedRow.height = 20;

      // สลับสีบรรทัด (Zebra Striping) + สไตล์ตัวอักษร
      const isEven = idx % 2 === 0;
      addedRow.eachCell((cell, colNumber) => {
        cell.font = { name: "Sarabun", size: 10 };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };

        if (isEven) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }

        // จัด Alignment รายคอลัมน์
        if ([1, 6, 7, 10, 11].includes(colNumber)) cell.alignment = { horizontal: "center", vertical: "middle" };
        else if (colNumber === 8) cell.alignment = { horizontal: "right", vertical: "middle" };
        else cell.alignment = { horizontal: "left", vertical: "middle" };

        // ใส่สีแยกตามสถานะ
        if (colNumber === 10) {
          if (r.status === "approved") cell.font = { bold: true, color: { argb: "FF15803D" } };
          else if (r.status === "pending") cell.font = { bold: true, color: { argb: "FFA16207" } };
          else if (r.status === "rejected") cell.font = { bold: true, color: { argb: "FFBE123C" } };
        }
      });
    });

    // ปรับ Auto-Width ของคอลัมน์ใน Sheet ข้อมูลดิบเพิ่มเติม
    rawSheet.columns.forEach((column) => {
      let maxLen = column.header ? column.header.length : 12;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const len = cell.value ? String(cell.value).length : 0;
        if (len > maxLen) maxLen = len;
      });
      column.width = Math.min(Math.max(maxLen + 4, 12), 40);
    });

    // -------------------------------------------------------------
    // GENERATE FILE & DOWNLOAD
    // -------------------------------------------------------------
    const buffer = await workbook.xlsx.writeBuffer();
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = isSummaryMode 
      ? `รายงานสรุปภาพรวมการลา_PVT_${dateStr}.xlsx` 
      : `ประวัติการลาดิบ_PVT_${dateStr}.xlsx`;

    window.pvtSupabase.downloadBlob(
      fileName, 
      buffer, 
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    Swal.fire({
      icon: "success",
      title: "ดาวน์โหลดสำเร็จ!",
      text: `ส่งออกไฟล์ ${fileName} เรียบร้อยแล้ว`,
      timer: 2000,
      showConfirmButton: false
    });

    

  } catch (err) {
    console.error("Excel Export Error:", err);
    showAppError("ไม่สามารถสร้างไฟล์ Excel ได้", err.message);
  }
}

// 1. ฟังก์ชันสร้างช่องกรอกคอลัมน์ใหม่เมื่อกดปุ่ม "+ เพิ่มคอลัมน์"
function addCustomColumnField(key = '', value = '') {
  const container = document.getElementById('customColumnsContainer');
  const rowId = 'col-row-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

  const rowHTML = `
    <div id="${rowId}" class="d-flex gap-2 align-items-center mb-2 custom-column-row">
      <input type="text" class="form-control custom-key" placeholder="ชื่อคอลัมน์ (เช่น Line ID)" value="${key}">
      <input type="text" class="form-control custom-value" placeholder="ข้อมูล" value="${value}">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeCustomColumnField('${rowId}')">
        ลบ
      </button>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', rowHTML);
}

// 2. ฟังก์ชันลบแถวคอลัมน์ที่ไม่ต้องการ
function removeCustomColumnField(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

// 3. ฟังก์ชันดึงค่าจากคอลัมน์ทั้งหมดเพื่อเตรียม Save ส่งเข้า Database / Supabase
function getCustomColumnsData() {
  const customData = {};
  const rows = document.querySelectorAll('.custom-column-row');

  rows.forEach(row => {
    const key = row.querySelector('.custom-key').value.trim();
    const val = row.querySelector('.custom-value').value.trim();
    if (key) {
      customData[key] = val; // รวมเป็น Object เช่น { "Line ID": "@john", "เลขผู้เสียภาษี": "123456" }
    }
  });

  return customData;
}

// 4. (สำหรับหน้าแก้ไขประวัติ) ดึงข้อมูลคอลัมน์เดิมมาแสดงเมื่อเปิด Modal แก้ไข
function loadEditEmployeeData(employee) {
  // ล้างข้อมูลช่องเดิมก่อน
  const container = document.getElementById('customColumnsContainer');
  if (container) container.innerHTML = '';

  // สมมติว่าข้อมูลคอลัมน์เพิ่มเติมเก็บเป็น JSON ใน Object ชื่อ employee.custom_fields
  if (employee && employee.custom_fields) {
    Object.entries(employee.custom_fields).forEach(([key, value]) => {
      addCustomColumnField(key, value);
    });
  }
}


// ผูกฟังก์ชันเข้ากับปุ่มดึงข้อมูลบนหน้าจอ
async function handleFetchDataClick() {
  const fetchBtn = document.getElementById("btnFetchData") || document.getElementById("refreshBtn");
  if (fetchBtn) {
    fetchBtn.disabled = true;
    fetchBtn.innerHTML = `<span class="material-symbols-outlined spin">sync</span> กำลังดึงข้อมูล...`;
  }

  await refreshDashboard();

  if (fetchBtn) {
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = `<span class="material-symbols-outlined">sync</span> ดึงข้อมูลล่าสุด`;
  }
  
  if (window.Swal) {
    Swal.fire({
      icon: 'success',
      title: 'อัปเดตข้อมูลสำเร็จ',
      timer: 1200,
      showConfirmButton: false
    });
  }
}

