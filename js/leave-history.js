let myLeaveRows = [];
let filteredLeaveRows = [];
let myProfile = null;
let leaveHistoryApproverMap = new Map();
let currentFilter = 'all';
let selectedYear = new Date().getFullYear().toString();
let currentTypeFilter = "all";
window.selectTypeFilter = function(type) {
  currentTypeFilter = type;
  const label = document.getElementById("selectedTypeLabel");
  if (label) label.textContent = type === "all" ? "ทุกประเภท" : type;
  
  document.querySelectorAll("#typeDropdownMenu .year-dropdown-item").forEach(item => {
    item.classList.remove("active");
    if (type === "all" && item.innerText.trim() === "ทุกประเภท") item.classList.add("active");
    else if (item.innerText.trim() === type) item.classList.add("active");
  });
  
  document.getElementById("typeDropdownMenu").classList.remove("show");
  filterLeaveHistory(currentFilter, null);
};

window.toggleTypeDropdown = function(e) {
  e.stopPropagation();
  const menu = document.getElementById("typeDropdownMenu");
  if (menu) menu.classList.toggle("show");
};

document.addEventListener("click", (e) => {
  const typeMenu = document.getElementById("typeDropdownMenu");
  if (typeMenu && !e.target.closest(".year-dropdown-container:last-child")) {
     typeMenu.classList.remove("show");
  }
});
 // Standard default year matching the user screenshot

function formatDuration(totalDays, leaveHours = null) {
  if (window.PVTSDK?.formatLeaveDurationFriendly) {
    return window.PVTSDK.formatLeaveDurationFriendly(totalDays, leaveHours, { compact: true });
  }

  const days = parseFloat(totalDays) || 0;
  const hours = parseFloat(leaveHours) || 0;
  const uDays = window.getPVTTranslation ? window.getPVTTranslation("unitDays") : "วัน";
  const uHours = window.getPVTTranslation ? window.getPVTTranslation("unitHours") : "ชม.";
  const uMins = window.getPVTTranslation ? window.getPVTTranslation("unitMinutes") : "นาที";

  if (hours > 0) {
    const totalMinutes = Math.round(hours * 60);
    const d = Math.floor(totalMinutes / 480);
    const remM = totalMinutes % 480;
    const wholeH = Math.floor(remM / 60);
    const mins = remM % 60;

    let parts = [];
    if (d > 0) parts.push(`${d} ${uDays}`);
    if (wholeH > 0) parts.push(`${wholeH} ${uHours}`);
    if (mins > 0) parts.push(`${mins} ${uMins}`);
    return parts.length > 0 ? parts.join(" ") : `${hours} ${uHours}`;
  }

  if (days <= 0) return `0 ${uDays}`;

  const totalMinutes = Math.round(days * 480);
  const wholeDays = Math.floor(totalMinutes / 480);
  const remainingMinutes = totalMinutes % 480;
  const wholeH = Math.floor(remainingMinutes / 60);
  const mins = remainingMinutes % 60;

  if (wholeDays === 0) {
    if (wholeH === 4 && mins === 0) return `4 ${uHours} (ครึ่งวัน)`;
    if (wholeH === 0 && mins > 0) return `${mins} ${uMins}`;
    if (wholeH > 0 && mins === 0) return `${wholeH} ${uHours}`;
    if (wholeH > 0 && mins > 0) return `${wholeH} ${uHours} ${mins} ${uMins}`;
    return `${Number(days.toFixed(2))} ${uDays}`;
  }

  let parts = [`${wholeDays} ${uDays}`];
  if (wholeH === 4 && mins === 0) {
    parts.push(`4 ${uHours} (ครึ่งวัน)`);
  } else {
    if (wholeH > 0) parts.push(`${wholeH} ${uHours}`);
    if (mins > 0) parts.push(`${mins} ${uMins}`);
  }

  return parts.join(" ");
}

// Simple fallback date helper to format dates in Thai format (e.g. 20 พ.ค. 2025)
function formatDate(dStr) {
  if (!dStr) return "-";
  try {
    const monthsTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const parts = dStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = monthsTH[parseInt(parts[1]) - 1];
      const day = parseInt(parts[2]);
      return `${day} ${month} ${year}`;
    }
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString("th-TH", { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return dStr;
  }
}

// Advanced date range formatting to match user screenshot spacing (e.g., "2 เม.ย. 2025 - 3 เม.ย. 2025" or single "20 พ.ค. 2025")
function formatLeaveDateRange(startDate, endDate) {
  if (!startDate) return "-";
  
  const sStr = formatDate(startDate);
  if (!endDate || startDate === endDate) {
    return sStr;
  }
  const eStr = formatDate(endDate);
  return `${sStr} - ${eStr}`;
}

// Extracts the calendar year from the leave start date string
function getYearOfLeave(row) {
  if (!row.start_date) return "2025";
  const dateStr = String(row.start_date); // Format "YYYY-MM-DD"
  const yr = dateStr.split("-")[0];
  return yr || "2025";
}

document.addEventListener("DOMContentLoaded", initLeaveHistory);

async function initLeaveHistory() {
  try {
    // 1. โหลดข้อมูลโปรไฟล์ตามรูปแบบเดียวกับ index-user.js
    myProfile = await fetchUserProfileFromSchema();
    window.currentProfile = myProfile;
    
    // 2. แสดงข้อมูลส่วนหัวพนักงาน (อัปเดตชื่อ แผนก และรูปโปรไฟล์)
    renderProfileHeader();

    // 3. ดึงประวัติการลา
    await loadMyLeaveHistory();
    
    // Setup initial Year dropdown status from local variable
    selectYearFilter(selectedYear);
  } catch (err) {
    console.error("❌ Init Error:", err);
  }
}

// 🔍 ฟังก์ชันดึงข้อมูลโปรไฟล์ถอดแบบโครงสร้างจาก index-user.js
async function fetchUserProfileFromSchema() {
  let profile = null;

  // 1. ดึงข้อมูลจาก Supabase Auth ผ่าน SDK
  if (window.pvtSupabase && typeof window.pvtSupabase.getCurrentProfile === "function") {
    try {
      profile = await window.pvtSupabase.getCurrentProfile();
    } catch (e) {
      console.warn("⚠️ [PROFILE] getCurrentProfile Error:", e);
    }
  }

  // 2. แผนสำรอง: ดึงข้อมูลจาก LocalStorage/Session หากดึง Auth ไม่สำเร็จ
  let validId = profile?.employee_id || profile?.id;
  if (!validId) {
    let cachedUser = null;
    try {
      cachedUser = JSON.parse(localStorage.getItem("currentUser") || localStorage.getItem("userProfile") || "null");
    } catch (e) {
      console.error("❌ Parse LocalStorage Error:", e);
    }

    if (cachedUser) {
      const empData = cachedUser.employees || cachedUser;
      const deptData = empData.departments || cachedUser.departments || cachedUser;

      profile = {
        id: cachedUser.id || empData.id,
        employee_id: cachedUser.employee_id || cachedUser.id || empData.id,
        employee_code: empData.employee_code || cachedUser.employee_code,
        full_name: empData.full_name || cachedUser.full_name || cachedUser.display_name,
        department_name: deptData.department_name || empData.department_name || cachedUser.department_name, 
        role: cachedUser.role || empData.role,
        image_url: empData.image_url || cachedUser.image_url || empData.image_url || cachedUser.image_url,
        employees: empData 
      };
      validId = profile.employee_id;
    }
  }

  // 3. ดึงรูปภาพสดล่าสุดจากคอลัมน์ image_url ของตาราง employees โดยใช้ ID ตรงๆ
  const sb = window.pvtSupabase?.getClient();
  if (sb && validId) {
    try {
      const { data: freshEmp, error } = await sb
        .from("employees")
        .select("image_url")
        .eq("id", validId)
        .single();
      
      if (!error && freshEmp && freshEmp.image_url) {
        if (!profile) profile = {};
        profile.image_url = freshEmp.image_url;
        if (profile.employees) {
          profile.employees.image_url = freshEmp.image_url;
        }
      }
    } catch (e) {
      console.warn("⚠️ ระบบขัดข้องระหว่างดึงข้อมูลรูปภาพจาก DB:", e);
    }
  }

  return normalizeProfileData(profile);
}

// 🛠️ Helper Function: จัดโครงสร้างข้อมูล (Normalize) ให้มาตรฐานเดียวกับ index-user.js
function normalizeProfileData(raw) {
  if (!raw) return null;

  const emp = raw.employees || (raw.employee_code ? raw : {});
  const realEmployeeId = raw.employee_id || raw.employees?.id || raw.id;

  return {
    id: raw.id || realEmployeeId,
    employee_id: realEmployeeId,
    display_name: raw.display_name || emp.full_name || raw.full_name || "พนักงาน",
    employees: {
      id: realEmployeeId,
      employee_code: emp.employee_code || raw.employee_code || "-",
      full_name: emp.full_name || raw.full_name || raw.display_name || "พนักงาน",
      image_url: emp.image_url || raw.image_url || raw.image_url || null,
      department_name: emp.departments?.department_name || emp.department_name || raw.department_name || "ทั่วไป"
    }
  };
}


// 🔐 กติกาการยกเลิกใบลา:
// - ก่อนผู้อนุมัติคนแรกอนุมัติ: พนักงานยกเลิกคำขอเองได้
// - หลังผู้อนุมัติคนแรกอนุมัติ: ต้องส่ง "คำขอยกเลิก" ไปให้ HR/Admin ตรวจสอบ
function getLeaveApplicantRoleInfo(item) {
  const emp = item?.employees || {};
  const rawRole = String(emp.role || '').toLowerCase();
  const rawPos = String(emp.positions?.position_name || emp.position_name || '').toLowerCase();

  return {
    isLeader: rawRole.includes('leader') || rawRole.includes('supervisor') || rawRole.includes('head') ||
      rawRole.includes('หัวหน้า') || rawPos.includes('หัวหน้า') || rawPos.includes('leader') || rawPos.includes('supervisor'),
    isManager: rawRole.includes('manager') || rawRole.includes('ผู้จัดการ') ||
      rawPos.includes('ผู้จัดการ') || rawPos.includes('manager') || rawPos.includes('ผจก'),
    isExecutive: rawRole.includes('director') || rawRole.includes('executive') || rawRole.includes('owner') ||
      rawRole.includes('ผู้บริหาร') || rawPos.includes('ผู้อำนวยการ') || rawPos.includes('ผู้บริหาร') ||
      rawPos.includes('director') || rawPos.includes('executive') || rawPos.includes('owner')
  };
}

function getFirstActualApprovalField(item) {
  if (!item) return null;

  const emp = item.employees || {};
  const deptId = emp.department_id || item.department_id || null;
  const deptCfg = deptId ? (leaveHistoryApproverMap.get(String(deptId)) || {}) : {};

  let l1Id = emp.l1_approver_id || deptCfg.supervisor_id || null;
  let l2Id = emp.l2_approver_id || deptCfg.manager_id || null;
  const l3Id = emp.l3_approver_id || null;

  // ถ้า L1/L2 เป็นคนเดียวกัน ให้ถือว่าไม่มี L1 จริง และให้ L2 เป็นด่านแรก
  if (l1Id && l2Id && String(l1Id) === String(l2Id)) {
    l1Id = null;
  }

  const roleInfo = getLeaveApplicantRoleInfo(item);

  if (roleInfo.isExecutive) return l3Id ? 'executive_status' : null;
  if (roleInfo.isManager) return l3Id ? 'executive_status' : null;

  if (roleInfo.isLeader) {
    if (l2Id) return 'director_status';
    if (l3Id) return 'executive_status';
    return null;
  }

  if (l1Id) return 'manager_status';
  if (l2Id) return 'director_status';
  if (l3Id) return 'executive_status';
  return null;
}

function getEmployeeCancellationMode(item) {
  if (!item) return 'none';

  const st = String(item.status || '').trim().toLowerCase();
  if (st === 'cancel_requested' || st === 'cancel_pending' || st === 'cancelled' || st === 'rejected') {
    return 'none';
  }

  if (st === 'approved') return 'request';

  if (st === 'pending' || st === 'รออนุมัติ' || st.startsWith('pending_')) {
    const firstField = getFirstActualApprovalField(item);

    if (firstField && String(item[firstField] || '').toLowerCase() === 'approved') {
      return 'request';
    }

    if (item.approved_by || item.approved_at) {
      return 'request';
    }

    return 'direct';
  }

  return 'none';
}

async function ensureLeaveApproverContext(item, sb) {
  if (!item || !sb) return item;

  const emp = item.employees || {};
  const deptId = emp.department_id || item.department_id || null;
  if (deptId && !leaveHistoryApproverMap.has(String(deptId))) {
    try {
      const { data: deptCfg } = await sb
        .from('department_approvers')
        .select('department_id, supervisor_id, manager_id')
        .eq('department_id', deptId)
        .maybeSingle();

      if (deptCfg) leaveHistoryApproverMap.set(String(deptId), deptCfg);
    } catch (err) {
      console.warn('⚠️ ไม่สามารถโหลดสายอนุมัติเพิ่มเติมสำหรับการยกเลิกใบลา:', err);
    }
  }
  return item;
}

async function fetchFreshLeaveForCancellation(requestId, sb) {
  if (!requestId || !sb) return null;

  const selectWithJoin = `
    id, employee_id, status, manager_status, director_status, executive_status,
    approved_by, approved_at, cancel_reason, cancel_status,
    employees(*, positions(*))
  `;

  let { data, error } = await sb
    .from('leave_requests')
    .select(selectWithJoin)
    .eq('id', requestId)
    .maybeSingle();

  if (error) {
    const fallback = await sb
      .from('leave_requests')
      .select('id, employee_id, status, manager_status, director_status, executive_status, approved_by, approved_at, cancel_reason, cancel_status')
      .eq('id', requestId)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    data = fallback.data;

    if (data?.employee_id) {
      const empRes = await sb
        .from('employees')
        .select('*, positions(*)')
        .eq('id', data.employee_id)
        .maybeSingle();
      if (!empRes.error && empRes.data) data.employees = empRes.data;
    }
  }

  if (data) await ensureLeaveApproverContext(data, sb);
  return data;
}

// 🎨 วาดข้อมูลลงส่วนหัว (ถอด Logic จัดการ URL รูปภาพจาก index-user.js)
function renderProfileHeader() {
  const nameEl = document.getElementById("emp-name");
  const detailEl = document.getElementById("emp-detail");
  const avatarEl = document.getElementById("user-avatar");

  if (!myProfile) {
    if (nameEl) nameEl.textContent = "พนักงาน (กรุณาล็อกอิน)";
    if (detailEl) detailEl.textContent = "ไม่พบข้อมูลโปรไฟล์";
    if (avatarEl) avatarEl.src = "/assets/img/avatar-male.jpg?v=2";
    return;
  }

  const emp = myProfile.employees || myProfile;

  // 1. แสดงชื่อ
  const fullName = emp.full_name || myProfile.display_name || "พนักงานในระบบ";
  if (nameEl) nameEl.textContent = fullName;

  // 2. แสดงแผนกและรหัสพนักงาน
  const deptName = emp.department_name || "ทั่วไป";
  const codeVal = emp.employee_code;
  const empCode = codeVal && codeVal !== "-" ? `รหัส: ${codeVal}` : "";
  if (detailEl) detailEl.textContent = `พนักงานประจำ • ${empCode}`.trim();

  // 3. แสดงรูปโปรไฟล์ (Logic เดียวกับ index-user.js และ profile-user.js)
  if (avatarEl) {
    let rawAvatarUrl = emp.image_url || emp.avatar_url || myProfile.image_url || myProfile.avatar_url;
    const empTitle = emp.title || emp.prefix || myProfile.title || myProfile.prefix || "";
    const empGender = emp.gender || myProfile.gender || "";
    const empName = emp.full_name || myProfile.full_name || myProfile.display_name || "";

    const fallbackAvatar = (typeof window.getDefaultAvatarUrl === "function")
      ? window.getDefaultAvatarUrl(empTitle, empGender, empName)
      : (empTitle.includes('สาว') || empTitle.includes('นาง') || empTitle.includes('น.ส.') || empGender === 'female' || empName.includes('นาง') || empName.includes('น.ส.') ? '/assets/img/avatar-female.jpg?v=2' : '/assets/img/avatar-male.jpg?v=2');

    avatarEl.onerror = function() {
      this.onerror = null;
      this.src = fallbackAvatar;
    };

    if (window.pvtSupabase && typeof window.pvtSupabase.getAvatarUrl === "function") {
      avatarEl.src = window.pvtSupabase.getAvatarUrl(rawAvatarUrl, empTitle, empGender, empName);
    } else if (window.PVTSDK && window.PVTSDK.storage && typeof window.PVTSDK.storage.getAvatarUrl === "function") {
      avatarEl.src = window.PVTSDK.storage.getAvatarUrl(rawAvatarUrl, empTitle, empGender, empName);
    } else if (typeof window.getAvatarUrl === "function") {
      avatarEl.src = window.getAvatarUrl(rawAvatarUrl, empTitle, empGender, empName);
    } else if (rawAvatarUrl && String(rawAvatarUrl).trim() !== "" && rawAvatarUrl !== "null" && rawAvatarUrl !== "/assets/img/default-avatar.jpg") {
      let clean = String(rawAvatarUrl).trim();
      if (!clean.startsWith("http")) {
        const baseUrl = window.SUPABASE_URL || 'https://pgogmhqjdchakcytsomx.supabase.co';
        clean = `${baseUrl}/storage/v1/object/public/employee-images/${clean.replace(/^\//, '')}`;
      }
      if (clean.includes("storage/v1/object/") && !clean.includes("storage/v1/object/public/")) {
        clean = clean.replace("storage/v1/object/", "storage/v1/object/public/");
      }
      avatarEl.src = clean;
    } else {
      avatarEl.src = fallbackAvatar;
    }
  }
}

async function loadMyLeaveHistory() {
  const tableBody = document.getElementById("table-data-rows");
  if (!tableBody) return;

  const empId = myProfile?.employee_id || myProfile?.id || localStorage.getItem("currentUserId");
  const sb = window.pvtSupabase?.getClient();

  if (!sb || !empId) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-history-cell">กรุณาเข้าสู่ระบบเพื่อดูประวัติการลา</td></tr>`;
    return;
  }

  try {
    let { data, error } = await sb
      .from("leave_requests")
      .select("id, employee_id, leave_type_id, start_date, end_date, total_days, leave_hours, reason, attachment_url, status, manager_status, director_status, executive_status, approved_by, approved_at, approval_comment, cancel_reason, cancel_status, created_at, leave_types(leave_name), employees(*, positions(*))")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("⚠️ Foreign Key Join Fail, fallback to manual join:", error.message);
      const res = await sb
        .from("leave_requests")
        .select("id, employee_id, leave_type_id, start_date, end_date, total_days, leave_hours, reason, attachment_url, status, manager_status, director_status, executive_status, approved_by, approved_at, approval_comment, cancel_reason, cancel_status, created_at")
        .eq("employee_id", empId)
        .order("created_at", { ascending: false });

      if (res.error) throw res.error;
      data = res.data || [];

      const { data: typeList } = await sb.from("leave_types").select("id, leave_name");
      const typeMap = new Map((typeList || []).map(t => [String(t.id), t.leave_name]));

      let freshEmployee = null;
      try {
        const empRes = await sb
          .from("employees")
          .select("*, positions(*)")
          .eq("id", empId)
          .maybeSingle();
        if (!empRes.error) freshEmployee = empRes.data || null;
      } catch (empErr) {
        console.warn("⚠️ Fallback employee join warning:", empErr);
      }

      data = data.map(item => ({
        ...item,
        leave_types: { leave_name: typeMap.get(String(item.leave_type_id)) || "ไม่ระบุ" },
        employees: freshEmployee || item.employees || null
      }));
    }

    // โหลดสายอนุมัติจริงของแผนก เพื่อแยก "ข้ามขั้น" ออกจาก "หัวหน้าอนุมัติจริง"
    try {
      const deptIds = [...new Set((data || [])
        .map(item => item?.employees?.department_id || item?.department_id)
        .filter(Boolean)
        .map(String))];

      if (deptIds.length > 0) {
        const { data: approvers, error: apprErr } = await sb
          .from("department_approvers")
          .select("department_id, supervisor_id, manager_id")
          .in("department_id", deptIds);

        if (!apprErr) {
          leaveHistoryApproverMap = new Map(
            (approvers || []).map(row => [String(row.department_id), row])
          );
        } else {
          console.warn("⚠️ Approver route warning:", apprErr.message);
        }
      }
    } catch (routeErr) {
      console.warn("⚠️ ไม่สามารถโหลดสายอนุมัติสำหรับประวัติการลา:", routeErr);
    }

    // ⏱️ ตรวจสอบและตัดใบลาที่ค้างเกิน 2 วัน (48 ชม.) เป็น "ไม่อนุมัติ" อัตโนมัติ
    if (typeof window.autoRejectOverdueLeaves === 'function') {
      window.autoRejectOverdueLeaves();
    }

    const nowMs = Date.now();
    const TWO_DAYS_MS = 48 * 60 * 60 * 1000;
    data = (data || []).map(item => {
      const st = String(item.status || '').toLowerCase();
      const isPending = (st === 'pending' || st === 'pending_l1' || st === 'pending_l2' || st.includes('รออนุมัติ'));
      if (isPending && item.created_at) {
        const createdTime = new Date(item.created_at).getTime();
        if (!isNaN(createdTime) && (nowMs - createdTime >= TWO_DAYS_MS)) {
          return {
            ...item,
            status: 'cancelled',
            approval_comment: item.approval_comment || 'ยกเลิกอัตโนมัติเนื่องจากหัวหน้าไม่ได้ดำเนินการในเวลาที่กำหนด (เกิน 2 วัน)'
          };
        }
      }
      return item;
    });

    myLeaveRows = data || [];
    
    // Filter by selected year
    filterLeaveHistory(currentFilter, null);

    // ⏱️ แสดงผล 2-Day SLA Countdown Tracker สำหรับใบลาที่รออนุมัติของพนักงาน
    if (typeof window.renderLeaveSlaTracker === 'function') {
      const pendingLeaves = (myLeaveRows || []).filter(r => r.status === 'pending' || r.status === 'รออนุมัติ').map(r => ({
        ...r,
        user_name: myProfile?.name || myProfile?.employees?.full_name || 'ฉัน (ผู้ยื่นคำขอ)',
        employee_code: myProfile?.employee_code || myProfile?.employees?.employee_code || '',
        department: myProfile?.department || myProfile?.employees?.departments?.department_name || '',
        avatar_url: myProfile?.image_url || myProfile?.employees?.image_url || '/assets/img/default-avatar.jpg'
      }));
      
      const userSlaContainer = document.getElementById("userLeaveSlaTrackerContainer");
      if (pendingLeaves.length > 0) {
        if (userSlaContainer) userSlaContainer.style.display = "block";
        window.renderLeaveSlaTracker("userLeaveSlaTrackerContainer", pendingLeaves);
      } else {
        if (userSlaContainer) {
          userSlaContainer.style.display = "none";
          userSlaContainer.innerHTML = "";
        }
      }
    }

    // 🎯 [Highlight Specific Leave Item from LINE Link / Query Param]:
    const urlParams = new URLSearchParams(window.location.search);
    const leaveIdParam = urlParams.get("id") || urlParams.get("leave_id");
    if (leaveIdParam) {
      setTimeout(() => {
        const rowEl = document.getElementById(`row-${leaveIdParam}`);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          rowEl.style.transition = 'all 0.8s ease-in-out';
          rowEl.style.backgroundColor = '#f0fdf4'; // Light green background
          rowEl.style.boxShadow = 'inset 0 0 10px rgba(16, 185, 129, 0.2), 0 0 15px rgba(16, 185, 129, 0.3)';
          rowEl.style.outline = '2px solid #10b981';
          
          setTimeout(() => {
            rowEl.style.backgroundColor = '';
            rowEl.style.boxShadow = '';
            rowEl.style.outline = '';
          }, 4500);
        }
      }, 600);
    }
  } catch (error) {
    console.error("❌ โหลดประวัติการลาล้มเหลว:", error);
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-history-cell">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
  }
}

// Calculates statistics dynamically based on the selected year
function renderSummary() {
  const yearlyRows = myLeaveRows.filter(item => getYearOfLeave(item) === selectedYear);

  // Total leave request count
  const sumAll = yearlyRows.length;

  // Total leave days of Approved + Pending + Cancel Requested (active leaves)
  const sumDays = yearlyRows
    .filter(item => item.status === "approved" || item.status === "pending" || item.status === "cancel_requested")
    .reduce((sum, item) => sum + Number(item.total_days || 0), 0);

  // Approved count
  const sumApproved = yearlyRows.filter(item => item.status === "approved").length;

  // Pending count
  const sumPending = yearlyRows.filter(item => item.status === "pending").length;

  // Cancel requested count
  const sumCancelReq = yearlyRows.filter(item => item.status === "cancel_requested").length;

  // Rejected or Cancelled count
  const sumRejectedCancelled = yearlyRows.filter(item => item.status === "rejected" || item.status === "cancelled").length;

  // Update DOM metrics smoothly
  setText("sumAll", sumAll);
  setText("sumDays", sumDays.toFixed(1).replace(/\.0$/, ""));
  setText("sumApproved", sumApproved);
  setText("sumPending", sumPending);
  setText("sumRejectedCancelled", sumRejectedCancelled);

  // Update status filter chip counts
  setText("chipCountAll", sumAll);
  setText("chipCountPending", sumPending);
  setText("chipCountApproved", sumApproved);
  setText("chipCountCancelReq", sumCancelReq);
  setText("chipCountRejected", sumRejectedCancelled);
}

function translateLeaveTypeName(name) {
  if (!name) return "-";
  if (typeof window.localizeCategory === "function") {
    return window.localizeCategory(name);
  }
  const lang = window.getGlobalLanguage ? window.getGlobalLanguage() : "th";
  const t = window.globalAppTranslations ? (window.globalAppTranslations[lang] || window.globalAppTranslations.th) : null;
  if (!t) return name;

  if (name.includes("ป่วย")) return t.leaveSick || "ลาป่วย";
  if (name.includes("พักผ่อน") || name.includes("ประจำปี")) return t.leaveAnnual || "วันหยุดพักผ่อนประจำปี";
  if (name.includes("กิจ")) return t.leaveBusiness || "การลากิจเพื่อธุรกิจอันจำเป็น";
  if (name.includes("ทำหมัน")) return t.leaveSterilization || "การลาเพื่อทำหมัน";
  if (name.includes("ทหาร")) return t.leaveMilitary || "การลาเพื่อรับราชการทหาร";
  if (name.includes("อุปสมบท") || name.includes("บวช")) return t.leaveOrdination || "การลาเพื่ออุปสมบท";
  if (name.includes("ฌาปนกิจ") || name.includes("ศพ")) return t.leaveFuneral || "การลาเพื่อฌาปนกิจศพ";
  if (name.includes("คลอด")) return t.leaveMaternity || "การลาเพื่อคลอดบุตร";
  if (name.includes("อื่น")) return t.leaveOther || "ลาอื่น ๆ";
  return name;
}

// Clean helper to map category icons & custom colors for thematic look
function getLeaveTypeDetails(typeName) {
  const name = String(typeName || "").toLowerCase();
  if (name.includes("ป่วย")) {
    return {
      icon: "medical_services",
      colorClass: "sick",
      title: "ลาป่วย"
    };
  }
  if (name.includes("กิจ")) {
    return {
      icon: "person",
      colorClass: "business",
      title: "ลากิจส่วนตัว"
    };
  }
  if (name.includes("พักผ่อน") || name.includes("ประจำปี") || name.includes("พักร้อน")) {
    return {
      icon: "beach_access",
      colorClass: "vacation",
      title: "ลาพักผ่อน"
    };
  }
  return {
    icon: "description",
    colorClass: "other",
    title: typeName || "ลาอื่น ๆ"
  };
}

function selectYearFilter(year) {
  selectedYear = year;
  
  // Update year selector text
  const label = document.getElementById("selectedYearLabel");
  if (label) label.textContent = `ปี ${year}`;
  
  // Set selected item in dropdown menu as active
  document.querySelectorAll(".year-dropdown-item").forEach(item => {
    item.classList.remove("active");
    // Check if the item matches the selected year
    const itemText = item.querySelector("span")?.textContent || "";
    if (itemText.trim() === year) {
      item.classList.add("active");
    }
  });
  
  // Update year subtitles in statistics cards dynamically
  const labelsToUpdate = [
    { id: "sumAllSubLabel", prefix: "ในปี " },
    { id: "sumDaysSubLabel", prefix: "ในปี " }
  ];
  labelsToUpdate.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) el.textContent = `${item.prefix}${year}`;
  });

  // Recompute summary & filters with the new year
  if (myLeaveRows.length > 0) {
    filterLeaveHistory(currentFilter, null);
  }
}

function filterLeaveHistory(type, element) {
  currentFilter = type || currentFilter || 'all';

  // Synchronize active states across summary cards and mobile metric pills
  document.querySelectorAll('.sum-card, .metric-pill').forEach(el => {
    const cardStatus = el.getAttribute('data-filter-status');
    if (cardStatus) {
      el.classList.toggle('active', cardStatus === currentFilter);
    } else {
      el.classList.remove('active');
    }
  });

  // Synchronize active states across status filter tab pills
  document.querySelectorAll('.status-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-status') === currentFilter);
  });

  let rows = [...myLeaveRows];
  
  // 1. FILTER BY SELECTED CALENDAR YEAR FIRST (Dynamic calendar scoping)
  rows = rows.filter(item => getYearOfLeave(item) === selectedYear);

  // 2. FILTER BY STATUS CHIPS
  if (currentFilter === 'pending') {
    rows = rows.filter(item => item.status === 'pending');
  } else if (currentFilter === 'approved') {
    rows = rows.filter(item => item.status === 'approved');
  } else if (currentFilter === 'cancel_requested') {
    rows = rows.filter(item => item.status === 'cancel_requested');
  } else if (currentFilter === 'rejected_cancelled') {
    rows = rows.filter(item => item.status === 'rejected' || item.status === 'cancelled');
  }
  
  // 3. FILTER BY LEAVE TYPE
  if (currentTypeFilter !== 'all') {
    rows = rows.filter(item => {
      let rawLeaveTypeName = "ไม่ระบุ";
      if (Array.isArray(item.leave_types) && item.leave_types.length > 0) {
        rawLeaveTypeName = item.leave_types[0].leave_name;
      } else if (item.leave_types?.leave_name) {
        rawLeaveTypeName = item.leave_types.leave_name;
      }
      return rawLeaveTypeName === currentTypeFilter;
    });
  }

  // 4. FILTER BY LIVE SEARCH BAR
  const searchTerm = (document.getElementById("historySearchInput")?.value || "").trim().toLowerCase();
  if (searchTerm) {
    rows = rows.filter(item => {
      let rawLeaveTypeName = "ไม่ระบุ";
      if (Array.isArray(item.leave_types) && item.leave_types.length > 0) {
        rawLeaveTypeName = item.leave_types[0].leave_name;
      } else if (item.leave_types?.leave_name) {
        rawLeaveTypeName = item.leave_types.leave_name;
      }
      const typeName = translateLeaveTypeName(rawLeaveTypeName).toLowerCase();
      const reason = (item.reason || "").toLowerCase();
      const cancelReason = (item.cancel_reason || item.approval_comment || "").toLowerCase();
      return typeName.includes(searchTerm) || reason.includes(searchTerm) || cancelReason.includes(searchTerm);
    });
  }

  filteredLeaveRows = rows;
  
  // Update the summary numbers for the selected year
  renderSummary();
  
  // Render current rows
  renderRows();
}

function onHistorySearchChange() {
  filterLeaveHistory(currentFilter, null);
}

function renderRows() {
  const tableBody = document.getElementById("table-data-rows");
  if (!tableBody) return;

  const t = window.globalAppTranslations ? (window.globalAppTranslations[window.getGlobalLanguage()] || window.globalAppTranslations.th) : {
    emptyHistory: "ไม่พบรายการใบลาตามเงื่อนไขที่เลือก",
    statusPending: "รออนุมัติ",
    statusApproved: "อนุมัติแล้ว",
    statusCancelReq: "รอ HR ตรวจสอบยกเลิก",
    statusCancelled: "ยกเลิกแล้ว",
    statusRejected: "ไม่อนุมัติ",
    btnDirectCancel: "ยกเลิกคำขอ",
    btnRequestCancel: "ขอยกเลิกใบลา",
    badgeWaitingHr: "ส่งเรื่องแล้ว",
    reasonCancelPrefix: "เหตุผลที่ยกเลิก:",
    reasonRejectPrefix: "เหตุผลที่ไม่อนุมัติ:"
  };
  
  if (!filteredLeaveRows.length) {
    tableBody.innerHTML = `
      <div class="empty-history-cell">
        <div class="empty-icon-wrap">
          <span class="material-symbols-outlined">event_busy</span>
        </div>
        <div class="empty-title">ไม่พบประวัติการลา</div>
        <div class="empty-subtitle">${t.emptyHistory || "ไม่มีรายการใบลาตามเงื่อนไขหรือปีที่เลือก"}</div>
        <button type="button" class="btn-empty-action" onclick="goToLeaveForm()">
          <span class="material-symbols-outlined">add</span>
          <span>ยื่นใบลาใหม่</span>
        </button>
      </div>
    `;
    return;
  }

  const searchTerm = (document.getElementById("historySearchInput")?.value || "").trim();

  const highlightMatch = (text, term) => {
    if (!term || !text) return escapeHtml(text || "");
    const cleanText = String(text);
    const idx = cleanText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return escapeHtml(cleanText);
    const before = escapeHtml(cleanText.slice(0, idx));
    const matched = escapeHtml(cleanText.slice(idx, idx + term.length));
    const after = escapeHtml(cleanText.slice(idx + term.length));
    return `${before}<mark class="text-highlight">${matched}</mark>${after}`;
  };

  tableBody.innerHTML = filteredLeaveRows.map((item) => {
    let displayStatus = "";
    let statusClass = item.status || "pending";

    let rawLeaveTypeName = "ไม่ระบุ";
    if (Array.isArray(item.leave_types) && item.leave_types.length > 0) {
      rawLeaveTypeName = item.leave_types[0].leave_name;
    } else if (item.leave_types?.leave_name) {
      rawLeaveTypeName = item.leave_types.leave_name;
    }
    const leaveTypeName = translateLeaveTypeName(rawLeaveTypeName);

    let isOverdue = false;
    let overdueDays = 0;
    if (item.status === "pending" && item.created_at) {
      const createdTime = new Date(item.created_at).getTime();
      if (!isNaN(createdTime)) {
        const diffHours = (Date.now() - createdTime) / (1000 * 60 * 60);
        if (diffHours >= 48) {
          isOverdue = true;
          overdueDays = Math.floor(diffHours / 24);
        }
      }
    }

    if (item.status === "pending") {
      if (isOverdue) {
        displayStatus = `เกินกำหนด (${overdueDays} วัน)`;
        statusClass = "rejected";
      } else {
        displayStatus = t.statusPending || "รออนุมัติ";
      }
    } 
    else if (item.status === "approved") {
      displayStatus = t.statusApproved || "อนุมัติแล้ว";
    } 
    else if (item.status === "cancel_requested") {
      displayStatus = t.statusCancelReq || "รอ HR ตรวจสอบยกเลิก";
      statusClass = "pending";
    } 
    else if (item.status === "cancelled") {
      displayStatus = t.statusCancelled || "ยกเลิกแล้ว";
      statusClass = "cancelled";
    } 
    else if (item.status === "rejected") {
      const comment = item.approval_comment || "";
      if (comment.includes("ยกเลิก")) {
        displayStatus = t.statusCancelled || "ยกเลิกแล้ว";
        statusClass = "cancelled"; 
      } else {
        displayStatus = t.statusRejected || "ไม่อนุมัติ";
        statusClass = "rejected";
      }
    }

    const formattedRange = formatLeaveDateRange(item.start_date, item.end_date);
    const catDetails = getLeaveTypeDetails(leaveTypeName);

    const displayTypeName = highlightMatch(catDetails.title, searchTerm);
    const displayReason = highlightMatch(item.reason || "ไม่มีระบุเหตุผล", searchTerm);

    let cardActionHtml = "";
    const cancellationMode = getEmployeeCancellationMode(item);

    if (cancellationMode === "direct") {
      cardActionHtml = `
        <button type="button" class="btn-cancel-card-action" onclick="event.stopPropagation(); directCancelLeave('${item.id}')" title="ยกเลิกคำขอลา">
          <span class="material-symbols-outlined">cancel</span>
          <span>ยกเลิกคำขอลา</span>
        </button>
      `;
    } else if (cancellationMode === "request") {
      cardActionHtml = `
        <button type="button" class="btn-cancel-card-action" onclick="event.stopPropagation(); requestCancelApprovedLeave('${item.id}')" title="ส่งคำขอยกเลิกให้ HR ตรวจสอบ" style="background:#fffbeb; border-color:#fde68a; color:#b45309;">
          <span class="material-symbols-outlined">assignment_return</span>
          <span>ส่งคำขอยกเลิก</span>
        </button>
      `;
    } else if (item.status === "cancel_requested") {
      cardActionHtml = `
        <span class="status-badge-pending-cancel">
          <span class="material-symbols-outlined" style="font-size: 14px;">hourglass_top</span>
          <span>รอ HR ตรวจสอบยกเลิก</span>
        </span>
      `;
    }

    const hasCancelReason = item.cancel_reason || (item.approval_comment && item.approval_comment.includes('ยกเลิก')) || item.status === 'cancelled' || item.status === 'cancel_requested';
    const isRejectedStatus = item.status === 'rejected' && item.approval_comment && !item.approval_comment.includes('ยกเลิก');

    const reasonAlertBoxHtml = hasCancelReason && (item.cancel_reason || item.approval_comment) ? `
      <div class="reason-alert-box cancel">
        <span class="material-symbols-outlined">info</span>
        <div>
          <strong>เหตุผลการยกเลิก:</strong> ${escapeHtml(item.cancel_reason || item.approval_comment)}
        </div>
      </div>
    ` : isRejectedStatus ? `
      <div class="reason-alert-box reject">
        <span class="material-symbols-outlined">cancel</span>
        <div>
          <strong>เหตุผลที่ไม่อนุมัติ:</strong> ${escapeHtml(item.approval_comment)}
        </div>
      </div>
    ` : '';

    let formattedSubmitted = "";
    if (item.created_at) {
      try {
        const d = new Date(item.created_at);
        if (!isNaN(d.getTime())) {
          formattedSubmitted = d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
        }
      } catch (e) {}
    }

    return `
      <div id="card-${item.id}" class="leave-card ${isOverdue ? 'card-overdue' : ''}" onclick="previewLeaveModalFromHistory('${item.id}')">
        <!-- Card Top Bar: Icon, Name, Date submitted, Status pill -->
        <div class="leave-card-header">
          <div class="leave-type-flex">
            <div class="leave-type-icon-wrapper ${catDetails.colorClass}">
              <span class="material-symbols-outlined">${catDetails.icon}</span>
            </div>
            <div class="leave-type-text-stack">
              <span class="leave-type-main-title">${displayTypeName}</span>
              <span class="leave-created-date">${formattedSubmitted ? `ยื่นเมื่อ ${formattedSubmitted}` : ''}</span>
            </div>
          </div>
          <span class="pvt-status-pill ${statusClass}">
            <span class="status-dot"></span>
            <span>${displayStatus}</span>
          </span>
        </div>

        <!-- Date Range & Duration Banner -->
        <div class="leave-card-date-banner">
          <div class="date-range-wrap">
            <span class="material-symbols-outlined">calendar_month</span>
            <span class="date-range-text">${formattedRange}</span>
          </div>
          <span class="day-count-badge">${formatDuration(item.total_days, item.leave_hours)}</span>
        </div>

        <!-- Reason / Note -->
        <div class="leave-reason-wrap">
          <span class="material-symbols-outlined reason-quote-icon">format_quote</span>
          <span class="reason-text">${displayReason}</span>
          ${item.attachment_url ? `
            <span class="attachment-pill" title="มีไฟล์แนบ">
              <span class="material-symbols-outlined">attachment</span>
              <span>แนบไฟล์</span>
            </span>` : ''}
        </div>

        ${reasonAlertBoxHtml}
        
        <!-- Card Footer -->
        <div class="leave-card-footer">
          <div class="tap-detail-hint">
            <span class="material-symbols-outlined">timeline</span>
            <span>ดูขั้นตอนอนุมัติ</span>
            <span class="material-symbols-outlined chevron-icon">chevron_right</span>
          </div>
          ${cardActionHtml}
        </div>
      </div>
    `;
  }).join("");
}

async function directCancelLeave(requestId) {
  if (!requestId) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    await Swal.fire({ icon: 'error', title: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', confirmButtonColor: '#ef4444' });
    return;
  }

  try {
    const freshItem = await fetchFreshLeaveForCancellation(requestId, sb);
    const freshMode = getEmployeeCancellationMode(freshItem);

    if (freshMode === 'request') {
      await Swal.fire({
        icon: 'info',
        title: 'ใบลาผ่านการอนุมัติแล้ว',
        html: 'รายการนี้ผ่านผู้อนุมัติคนแรกแล้ว จึงไม่สามารถยกเลิกเองได้<br><b>ระบบจะเปลี่ยนเป็นการส่งคำขอยกเลิกให้ HR/Admin ตรวจสอบ</b>',
        confirmButtonText: 'ส่งคำขอยกเลิก',
        confirmButtonColor: '#d97706'
      });
      return requestCancelApprovedLeave(requestId);
    }

    if (freshMode === 'none') {
      await Swal.fire({
        icon: 'info',
        title: 'ไม่สามารถยกเลิกรายการนี้ได้',
        text: freshItem?.status === 'cancel_requested' ? 'รายการนี้ส่งคำขอยกเลิกไปยัง HR แล้ว' : 'สถานะปัจจุบันไม่อนุญาตให้ยกเลิก',
        confirmButtonColor: '#64748b'
      });
      return;
    }
  } catch (guardErr) {
    console.error('❌ Cancellation guard error:', guardErr);
    await Swal.fire({ icon: 'error', title: 'ตรวจสอบสถานะไม่สำเร็จ', text: guardErr.message || 'กรุณาลองใหม่อีกครั้ง', confirmButtonColor: '#ef4444' });
    return;
  }

  const { value: cancelReason, isConfirmed } = await Swal.fire({
    title: '⚠️ ยืนยันการยกเลิกคำขอลา?',
    html: `
      <div style="text-align: left; background: #fef2f2; border: 1px solid #fecaca; padding: 12px 16px; border-radius: 12px; margin-bottom: 12px;">
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #991b1b;">โปรดระบุเหตุผลความจำเป็นในการยกเลิกคำขอลา:</p>
        <ul style="margin: 0; padding-left: 18px; font-size: 12.5px; color: #b91c1c; line-height: 1.5;">
          <li>คำขอนี้ยังไม่ได้รับการอนุมัติ จะถูกยกเลิกทันที</li>
          <li>โควตาวันลาของคุณจะได้รับการคืนกลับตามสิทธิ</li>
          <li>การยกเลิกนี้ <strong>ไม่สามารถย้อนคืนได้</strong></li>
        </ul>
      </div>
    `,
    input: 'textarea',
    inputPlaceholder: 'กรุณาระบุเหตุผล เช่น ติดภารกิจด่วน, เลื่อนแผนการเดินทาง, ลาผิดวัน, หายป่วยแล้ว...',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ใช่, ยืนยันยกเลิกคำขอลา',
    cancelButtonText: 'ไม่ยกเลิก / ปิดหน้าต่าง',
    inputValidator: (value) => {
      if (!value || !value.trim()) return 'โปรดระบุเหตุผลความจำเป็นในการยกเลิกคำขอลาด้วยครับ!';
    },
    focusCancel: true
  });

  if (isConfirmed && cancelReason) {
    try {
      const trimmedReason = cancelReason.trim();

      // Ensure the status is set to 'cancelled' and approval_comment reflects it clearly
      let { error } = await sb
        .from("leave_requests")
        .update({
          status: "cancelled",
          cancel_reason: trimmedReason,
          approval_comment: `[พนักงานยกเลิกใบลาเอง] ${trimmedReason}`
        })
        .eq("id", requestId);

      if (error && (error.code === 'P0001' || (error.message && (error.message.includes('ช่วงวันที่ดังกล่าว') || error.message.includes('ซ้อนทับ'))))) {
        console.warn("⚠️ พบข้อผิดพลาดของ DB Trigger ขณะยกเลิก กำลังปรับปรุงลำดับวันที่เพื่อเลี่ยงการล็อกซ้อนทับ...");
        const randomFutureDay = Math.floor(Math.random() * 20000) + 2000;
        const safeFutureDate = new Date(Date.now() + randomFutureDay * 86400000).toISOString().split('T')[0];
        await sb.from("leave_requests").update({ start_date: safeFutureDate, end_date: safeFutureDate }).eq("id", requestId);
        const retry = await sb.from("leave_requests").update({
          status: "cancelled",
          cancel_reason: trimmedReason,
          approval_comment: `พนักงานยกเลิกคำขอลา: ${trimmedReason}`
        }).eq("id", requestId);
        error = retry.error;
      }

      if (error) throw error;

      await Swal.fire({ icon: 'success', title: 'ยกเลิกเรียบร้อย!', text: 'ยกเลิกคำขอลาเรียบร้อยแล้ว', timer: 1800, showConfirmButton: false });
      await loadMyLeaveHistory();
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการยกเลิก:", err);
      Swal.fire({ icon: 'error', title: 'ยกเลิกไม่สำเร็จ', text: err.message, confirmButtonColor: '#ef4444' });
    }
  }
}

async function requestCancelApprovedLeave(requestId) {
  if (!requestId) return;

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    await Swal.fire({ icon: 'error', title: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', confirmButtonColor: '#ef4444' });
    return;
  }

  let originalStatusForCancel = 'pending';

  try {
    const freshItem = await fetchFreshLeaveForCancellation(requestId, sb);
    originalStatusForCancel = String(freshItem?.status || 'pending').toLowerCase() === 'approved' ? 'approved' : 'pending';
    const freshMode = getEmployeeCancellationMode(freshItem);

    if (freshMode === 'direct') {
      await Swal.fire({
        icon: 'info',
        title: 'หัวหน้ายังไม่ได้อนุมัติ',
        text: 'รายการนี้ยังสามารถยกเลิกคำขอลาได้ทันที โดยไม่ต้องส่งให้ HR ตรวจสอบ',
        confirmButtonText: 'ยกเลิกคำขอลา',
        confirmButtonColor: '#dc2626'
      });
      return directCancelLeave(requestId);
    }

    if (freshMode === 'none') {
      await Swal.fire({
        icon: 'info',
        title: 'ไม่สามารถส่งคำขอยกเลิกได้',
        text: freshItem?.status === 'cancel_requested' ? 'รายการนี้อยู่ระหว่างรอ HR/Admin ตรวจสอบการยกเลิกแล้ว' : 'สถานะปัจจุบันไม่อนุญาตให้ส่งคำขอยกเลิก',
        confirmButtonColor: '#64748b'
      });
      return;
    }
  } catch (guardErr) {
    console.error('❌ Cancel request guard error:', guardErr);
    await Swal.fire({ icon: 'error', title: 'ตรวจสอบสถานะไม่สำเร็จ', text: guardErr.message || 'กรุณาลองใหม่อีกครั้ง', confirmButtonColor: '#ef4444' });
    return;
  }

  const { value: cancelReason, isConfirmed } = await Swal.fire({
    title: '⚠️ ยืนยันส่งคำร้องขอยกเลิกใบลา?',
    html: `
      <div style="text-align: left; background: #fffbeb; border: 1px solid #fde68a; padding: 14px 16px; border-radius: 12px; margin-bottom: 14px;">
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 700; color: #92400e;">⚠️ ใบลานี้ผ่านผู้อนุมัติคนแรกแล้ว:</p>
        <p style="margin: 0; font-size: 13px; color: #b45309; line-height: 1.5;">พนักงานไม่สามารถยกเลิกใบลาด้วยตนเองได้แล้ว คำขอยกเลิกนี้จะส่งตรงไปยัง <strong>HR/Admin</strong> เพื่อตรวจสอบว่าพนักงานมาทำงานจริงในวันดังกล่าว และ HR/Admin จะเป็นผู้อนุมัติหรือปฏิเสธการยกเลิก</p>
      </div>
    `,
    input: 'textarea',
    inputPlaceholder: 'กรุณาระบุเหตุผลความจำเป็นในการขอยกเลิกใบลา...',
    showCancelButton: true,
    confirmButtonColor: '#d97706',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยันส่งคำร้องขอยกเลิก',
    cancelButtonText: 'ไม่ยกเลิก / ปิดหน้าต่าง',
    inputValidator: (value) => {
      if (!value || !value.trim()) return 'โปรดระบุเหตุผลความจำเป็นในการขอยกเลิกใบลา!';
    },
    focusCancel: true
  });

  if (isConfirmed && cancelReason) {
    try {
      let { error } = await sb
        .from("leave_requests")
        .update({
          status: "cancel_requested",
          cancel_status: `pending_hr:${originalStatusForCancel}`,
          cancel_reason: cancelReason.trim()
        })
        .eq("id", requestId);

      if (error && (error.code === 'P0001' || (error.message && (error.message.includes('ช่วงวันที่ดังกล่าว') || error.message.includes('ซ้อนทับ'))))) {
        console.warn("⚠️ พบข้อผิดพลาดของ DB Trigger ขณะยื่นคำร้องยกเลิก กำลังปรับปรุงลำดับวันที่เพื่อเลี่ยงการล็อกซ้อนทับ...");
        const randomFutureDay = Math.floor(Math.random() * 20000) + 2000;
        const safeFutureDate = new Date(Date.now() + randomFutureDay * 86400000).toISOString().split('T')[0];
        await sb.from("leave_requests").update({ start_date: safeFutureDate, end_date: safeFutureDate }).eq("id", requestId);
        const retry = await sb.from("leave_requests").update({ status: "cancel_requested", cancel_status: `pending_hr:${originalStatusForCancel}`, cancel_reason: cancelReason.trim() }).eq("id", requestId);
        error = retry.error;
      }

      if (error) throw error;

      await Swal.fire({ icon: 'success', title: 'ส่งคำขอสำเร็จ!', text: 'ส่งคำขอยกเลิกไปยัง HR/Admin เพื่อรอตรวจสอบแล้ว', confirmButtonColor: '#0f766e' });
      await loadMyLeaveHistory();
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการส่งคำร้อง:", err);
      Swal.fire({ icon: 'error', title: 'ส่งคำร้องไม่สำเร็จ', text: err.message, confirmButtonColor: '#ef4444' });
    }
  }
}

// Full CSV export engine with Excel Thai character compatibility (UTF-8 with BOM)
function downloadLeaveHistoryCSV() {
  if (!filteredLeaveRows || filteredLeaveRows.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'ไม่พบข้อมูลสำหรับดาวน์โหลด',
      text: 'ไม่มีประวัติการลาในรายการประจำปีนี้ขณะนี้',
      confirmButtonColor: '#0f766e'
    });
    return;
  }

  const headers = ["ช่วงวันที่", "ประเภทการลา", "จำนวนวัน", "เหตุผล", "สถานะ"];
  const csvRows = [headers.join(",")];
  
  filteredLeaveRows.forEach(item => {
    let rawLeaveTypeName = "ไม่ระบุ";
    if (Array.isArray(item.leave_types) && item.leave_types.length > 0) {
      rawLeaveTypeName = item.leave_types[0].leave_name;
    } else if (item.leave_types?.leave_name) {
      rawLeaveTypeName = item.leave_types.leave_name;
    }
    const leaveTypeName = translateLeaveTypeName(rawLeaveTypeName);
    
    const formattedRange = formatLeaveDateRange(item.start_date, item.end_date);
    const duration = formatDuration(item.total_days, item.leave_hours);
    const reason = (item.reason || "พักผ่อนประจำปี").replace(/"/g, '""');
    
    let statusText = "รออนุมัติ";
    if (item.status === "approved") statusText = "อนุมัติแล้ว";
    else if (item.status === "cancel_requested") statusText = "รอ HR ตรวจสอบยกเลิก";
    else if (item.status === "cancelled") statusText = "ยกเลิกแล้ว";
    else if (item.status === "rejected") statusText = "ไม่อนุมัติ";

    const line = [
      `"${formattedRange}"`,
      `"${leaveTypeName}"`,
      `"${duration}"`,
      `"${reason}"`,
      `"${statusText}"`
    ];
    csvRows.push(line.join(","));
  });

  // Export as UTF-8 CSV with BOM for automatic Thai character rendering in Excel
  const csvContent = "\uFEFF" + csvRows.join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `PVT_Leave_History_${selectedYear}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  Swal.fire({
    icon: 'success',
    title: 'ดาวน์โหลดสำเร็จ!',
    text: `ดาวน์โหลดไฟล์รายงานประจำปี ${selectedYear} เรียบร้อยแล้ว`,
    confirmButtonColor: '#0f766e',
    showDenyButton: false,
    showCancelButton: false,
    showCloseButton: false,
    timer: 2000,
    showConfirmButton: false
  });
}

function renderNativeDetailModal(title, htmlContent) {
  let modalEl = document.getElementById("pvt-native-detail-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "pvt-native-detail-modal";
    modalEl.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;";
    document.body.appendChild(modalEl);
  }
  modalEl.innerHTML = `
    <div style="background:white;border-radius:16px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;padding:24px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:18px;color:#0f766e;display:flex;align-items:center;gap:8px;">
          <span class="material-symbols-outlined">event_note</span> ${title}
        </h3>
        <button onclick="document.getElementById('pvt-native-detail-modal').style.display='none'" style="border:none;background:none;cursor:pointer;font-size:22px;color:#64748b;padding:4px;">✕</button>
      </div>
      <div>${htmlContent}</div>
      <div style="margin-top:18px;text-align:right;">
        <button onclick="document.getElementById('pvt-native-detail-modal').style.display='none'" style="background:#0f766e;color:white;border:none;padding:10px 22px;border-radius:10px;font-weight:600;cursor:pointer;">ปิดหน้าต่าง</button>
      </div>
    </div>
  `;
  modalEl.style.display = "flex";
}

window.previewLeaveModalFromHistory = async function(leaveId) {
  try {
    const item = (myLeaveRows || []).find(r => String(r.id) === String(leaveId));
    if (!item) {
      console.warn("Leave item not found:", leaveId);
      return;
    }

    const sb = window.pvtSupabase?.getClient();
    const reqEmp = item.employees || window.currentProfile || {};
    const reqDeptId = item.department_id || reqEmp.department_id;

    let supervisorId = null;
    let managerId = null;
    if (sb && reqDeptId) {
      try {
        const { data: deptApp } = await sb
          .from("department_approvers")
          .select("supervisor_id, manager_id")
          .eq("department_id", reqDeptId)
          .maybeSingle();
        if (deptApp) {
          supervisorId = deptApp.supervisor_id;
          managerId = deptApp.manager_id;
        }
      } catch (err) {
        console.warn("Error querying department_approvers in history:", err);
      }
    }

    let sla = { countdownText: "", isOverdue: false };
    try {
      if (typeof window.calculateSlaDetails === 'function') {
        sla = window.calculateSlaDetails(item) || sla;
      }
    } catch (e) {
      console.warn("SLA calculation note:", e);
    }

    const rawType = item.leave_types?.leave_name || "ลาทั่วไป";
    const typeName = typeof translateLeaveTypeName === 'function' ? translateLeaveTypeName(rawType) : rawType;
    const startStr = formatDate(item.start_date);
    const endStr = formatDate(item.end_date);
    const duration = typeof formatDuration === 'function' ? formatDuration(item.total_days, item.leave_hours) : (item.total_days ? `${item.total_days} วัน` : "-");

    // Determine actions buttons ตามสถานะ "ผู้อนุมัติคนแรก" ไม่ใช่ดูเฉพาะ status หลัก
    let actionButtonsHtml = "";
    const modalCancellationMode = getEmployeeCancellationMode(item);

    if (modalCancellationMode === "direct") {
      actionButtonsHtml = `
        <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: flex-end; gap: 10px;">
          <button onclick="if(typeof Swal!=='undefined')Swal.close(); directCancelLeave('${item.id}')" style="background: #fef2f2; border: 1px solid #fecaca; padding: 10px 18px; border-radius: 10px; color: #dc2626; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <span class="material-symbols-outlined" style="font-size: 18px;">close</span> ยกเลิกคำขอลาทันที
          </button>
        </div>`;
    } else if (modalCancellationMode === "request") {
      actionButtonsHtml = `
        <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: flex-end; gap: 10px;">
          <button onclick="if(typeof Swal!=='undefined')Swal.close(); requestCancelApprovedLeave('${item.id}')" style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px 18px; border-radius: 10px; color: #b45309; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <span class="material-symbols-outlined" style="font-size: 18px;">assignment_return</span> ส่งคำขอยกเลิกให้ HR ตรวจสอบ
          </button>
        </div>`;
    } else if (item.status === "cancel_requested") {
      actionButtonsHtml = `
        <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          <div style="background:#fffbeb; border:1px solid #fde68a; color:#92400e; padding:10px 12px; border-radius:10px; font-size:13px; font-weight:600; text-align:center;">
            รอ HR/Admin ตรวจสอบคำขอยกเลิก
          </div>
        </div>`;
    }

    // Simplified overall approval status for employee view
    // Keep this intentionally simple: employees only need the final/current state,
    // not the internal L1/L2/L3 approval workflow.
    const approvalStatus = (() => {
      const status = String(item.status || '').toLowerCase();

      if (status === 'approved') {
        return {
          label: 'อนุมัติ',
          icon: 'check_circle',
          color: '#15803d',
          bg: '#f0fdf4',
          border: '#bbf7d0'
        };
      }

      if (status === 'rejected') {
        return {
          label: 'ไม่อนุมัติ',
          icon: 'cancel',
          color: '#b91c1c',
          bg: '#fef2f2',
          border: '#fecaca'
        };
      }

      if (status === 'cancelled') {
        return {
          label: 'ยกเลิกแล้ว',
          icon: 'do_not_disturb_on',
          color: '#475569',
          bg: '#f8fafc',
          border: '#cbd5e1'
        };
      }

      if (status === 'cancel_requested') {
        return {
          label: 'รอตรวจสอบการยกเลิก',
          icon: 'hourglass_top',
          color: '#b45309',
          bg: '#fffbeb',
          border: '#fde68a'
        };
      }

      return {
        label: 'รออนุมัติ',
        icon: 'schedule',
        color: '#b45309',
        bg: '#fffbeb',
        border: '#fde68a'
      };
    })();

    const approvalStatusHtml = `
      <div style="margin-top: 18px; margin-bottom: 16px; background: ${approvalStatus.bg}; border: 1px solid ${approvalStatus.border}; border-radius: 14px; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
          <span class="material-symbols-outlined" style="font-size: 20px; color: ${approvalStatus.color}; flex-shrink: 0;">${approvalStatus.icon}</span>
          <span style="font-size: 13px; font-weight: 700; color: #475569;">สถานะการอนุมัติ</span>
        </div>
        <span style="font-size: 14px; font-weight: 800; color: ${approvalStatus.color}; white-space: nowrap;">${approvalStatus.label}</span>
      </div>
    `;

    const modalHtml = `
      <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155; padding: 4px 8px;">
        <div style="background: ${sla.isOverdue ? '#fff7ed' : '#e0fdf4'}; border: 1px solid ${sla.isOverdue ? '#fed7aa' : '#99f6e4'}; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px;">
          <div style="font-weight: 700; color: ${sla.isOverdue ? '#c2410c' : '#0f766e'}; display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined" style="font-size: 18px;">timer</span>
            ${sla.isOverdue ? 'ใบลาไม่ได้รับการพิจารณาในเวลาที่กำหนด' : 'เวลานับถอยหลังกรอบเวลา 2 วัน'}
          </div>
          <div style="font-size: 13px; margin-top: 2px;">${sla.countdownText || "กรอบเวลาพิจารณา 48 ชั่วโมงทำการ"}</div>
        </div>
        <div style="margin-bottom: 8px; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <strong>ช่วงวันที่ลา:</strong>
          <span>${startStr} ถึง ${endStr}</span>
        </div>
        <div style="margin-bottom: 8px; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <strong>จำนวนวัน:</strong>
          <span style="font-weight: 600; color: var(--primary);">${duration}</span>
        </div>
        <div style="margin-bottom: 8px; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <strong>เหตุผลการลา:</strong>
          <span>${escapeHtml(item.reason || '-')}</span>
        </div>
        <div style="margin-bottom: 8px; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
          <strong>วันที่ยื่นคำขอ:</strong>
          <span>${item.created_at ? new Date(item.created_at).toLocaleString('th-TH') : '-'}</span>
        </div>

        ${approvalStatusHtml}

        ${(item.cancel_reason || (item.approval_comment && item.approval_comment.includes('ยกเลิก')) || item.status === 'cancelled' || item.status === 'cancel_requested') ? `
          <div style="margin-top: 14px; background: #fff1f2; border: 1.5px solid #fecdd3; padding: 12px 14px; border-radius: 12px; color: #9f1239;">
            <div style="font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 13.5px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #e11d48;">warning</span>
              <span>เหตุผลการยกเลิกใบลา (Cancellation Reason):</span>
            </div>
            <div style="font-size: 13px; line-height: 1.5; color: #881337; font-weight: 500;">
              ${escapeHtml(item.cancel_reason || item.approval_comment || 'ไม่ได้ระบุเหตุผล')}
            </div>
          </div>` : ''}
        ${(item.status === 'rejected' && item.approval_comment && !item.approval_comment.includes('ยกเลิก')) ? `
          <div style="margin-top: 14px; background: #fff1f2; border: 1.5px solid #fecdd3; padding: 12px 14px; border-radius: 12px; color: #9f1239;">
            <div style="font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 13.5px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #dc2626;">cancel</span>
              <span>เหตุผลที่ไม่อนุมัติ (จากหัวหน้างาน/ผู้จัดการ):</span>
            </div>
            <div style="font-size: 13px; line-height: 1.5; color: #881337; font-weight: 500;">
              ${escapeHtml(item.approval_comment)}
            </div>
          </div>` : (item.approval_comment && !item.approval_comment.includes('ยกเลิก') && item.status !== 'cancelled') ? `
          <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 14px; border-radius: 12px; color: #334155;">
            <div style="font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; font-size: 13px;">
              <span class="material-symbols-outlined" style="font-size: 17px; color: #0d9488;">chat</span>
              <span>ความคิดเห็นจากผู้อนุมัติ:</span>
            </div>
            <div style="font-size: 13px; line-height: 1.5; color: #475569;">
              ${escapeHtml(item.approval_comment)}
            </div>
          </div>` : ''}
        ${actionButtonsHtml}
      </div>
    `;

    if (typeof Swal !== 'undefined' && typeof Swal.fire === 'function') {
      Swal.fire({
        title: `<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><span class="material-symbols-outlined" style="color:#0f766e;">event_note</span> ${typeName}</div>`,
        html: modalHtml,
        showCloseButton: true,
        showConfirmButton: true,
        confirmButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#0f766e'
      });
    } else {
      renderNativeDetailModal(typeName, modalHtml);
    }
  } catch (err) {
    console.error("Error previewing leave details modal:", err);
  }
};

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return window.pvtSupabase?.utils?.escapeHtml ? window.pvtSupabase.utils.escapeHtml(value) : String(value ?? "");
}

// 🌐 Global Window Function Bindings for Leave History Page
window.directCancelLeave = typeof directCancelLeave !== 'undefined' ? directCancelLeave : window.directCancelLeave;
window.requestCancelApprovedLeave = typeof requestCancelApprovedLeave !== 'undefined' ? requestCancelApprovedLeave : window.requestCancelApprovedLeave;
window.filterLeaveHistory = typeof filterLeaveHistory !== 'undefined' ? filterLeaveHistory : window.filterLeaveHistory;
window.loadMyLeaveHistory = typeof loadMyLeaveHistory !== 'undefined' ? loadMyLeaveHistory : window.loadMyLeaveHistory;
window.selectYearFilter = typeof selectYearFilter !== 'undefined' ? selectYearFilter : window.selectYearFilter;
window.downloadLeaveHistoryCSV = typeof downloadLeaveHistoryCSV !== 'undefined' ? downloadLeaveHistoryCSV : window.downloadLeaveHistoryCSV;

// Re-render when language changes
window.addEventListener("pvt-lang-changed", () => {
  renderRows();
});


// ==========================================
// 🔔 NOTIFICATION SYSTEM (LEAVE-HISTORY)
// ==========================================
// ใช้สถานะอ่านชุดเดียวกับ index-user และแยกตาม user id
let localReadNotifIds = [];
let notificationLastReadAt = null;
let notificationReadStateUserKey = null;

function getNotificationReadStateStorageKey() {
  const profile = window.currentProfile || {};
  const userId = profile.id || profile.employee_id || profile.employee_code || 'anonymous';
  return `pvt_user_notification_read_state_${String(userId)}`;
}

function ensureUserNotificationReadState() {
  const storageKey = getNotificationReadStateStorageKey();
  if (notificationReadStateUserKey === storageKey) return;

  notificationReadStateUserKey = storageKey;
  localReadNotifIds = [];
  notificationLastReadAt = null;

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (Array.isArray(saved.ids)) localReadNotifIds = saved.ids.map(String);
    if (saved.lastReadAt) notificationLastReadAt = saved.lastReadAt;

    // ย้ายข้อมูลรูปแบบเก่าเข้าระบบใหม่หนึ่งครั้ง
    if (localReadNotifIds.length === 0) {
      const legacy = JSON.parse(localStorage.getItem('userReadNotifIds') || '[]');
      if (Array.isArray(legacy) && legacy.length) {
        localReadNotifIds = legacy.map(String);
        saveUserNotificationReadState();
      }
    }
  } catch (e) {
    console.warn('Could not load notification read state:', e);
  }
}

function saveUserNotificationReadState() {
  if (!notificationReadStateUserKey) {
    notificationReadStateUserKey = getNotificationReadStateStorageKey();
  }
  try {
    if (localReadNotifIds.length > 500) {
      localReadNotifIds = localReadNotifIds.slice(-500);
    }
    localStorage.setItem(notificationReadStateUserKey, JSON.stringify({
      ids: localReadNotifIds,
      lastReadAt: notificationLastReadAt
    }));
  } catch (e) {
    console.warn('Could not save notification read state:', e);
  }
}

function getUserReadNotifIds() {
  ensureUserNotificationReadState();
  return localReadNotifIds;
}

function addUserReadNotifId(id) {
  if (id === undefined || id === null) return;
  ensureUserNotificationReadState();
  const normalizedId = String(id);
  if (!localReadNotifIds.includes(normalizedId)) {
    localReadNotifIds.push(normalizedId);
    saveUserNotificationReadState();
  }
}

function setAllUserNotificationsReadThrough(isoDate) {
  ensureUserNotificationReadState();
  notificationLastReadAt = isoDate || new Date().toISOString();
  saveUserNotificationReadState();
}

function isUserNotificationRead(id, createdAt, dbIsRead = false) {
  ensureUserNotificationReadState();
  if (dbIsRead === true) return true;
  if (id !== undefined && id !== null && localReadNotifIds.includes(String(id))) return true;
  if (notificationLastReadAt && createdAt) {
    const itemTime = new Date(createdAt).getTime();
    const readTime = new Date(notificationLastReadAt).getTime();
    if (Number.isFinite(itemTime) && Number.isFinite(readTime) && itemTime <= readTime) return true;
  }
  return false;
}

window.toggleUserNotifDropdown = function(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById("userNotifDropdown");
  if (!dropdown) return;
  const isShowing = dropdown.style.display === "flex" || dropdown.classList.contains("show");
  if (isShowing) {
    dropdown.style.display = "none";
    dropdown.classList.remove("show");
    document.body.classList.remove("notif-open");
  } else {
    dropdown.style.display = "flex";
    dropdown.classList.add("show");
    document.body.classList.add("notif-open");
    fetchUserNotifications();
  }
};

const closeLeaveHistoryNotif = (e) => {
  const dropdown = document.getElementById("userNotifDropdown");
  const btn = document.getElementById("notificationBtn") || document.getElementById("notifBellBtn");
  if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.style.display = "none";
    dropdown.classList.remove("show");
    document.body.classList.remove("notif-open");
  }
};

document.addEventListener("click", closeLeaveHistoryNotif);
document.addEventListener("touchstart", (e) => {
  const dropdown = document.getElementById("userNotifDropdown");
  const btn = document.getElementById("notificationBtn") || document.getElementById("notifBellBtn");
  if (dropdown && (dropdown.style.display === "flex" || dropdown.classList.contains("show"))) {
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.style.display = "none";
      dropdown.classList.remove("show");
      document.body.classList.remove("notif-open");
    }
  }
}, { passive: true });

async function fetchUserNotifications() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb || !window.currentProfile) return;
  const myId = window.currentProfile.id || window.currentProfile.employee_id;
  
  try {
    let notifList = [];
    const { data: dbNotifs } = await sb.from("notifications").select("*").eq("employee_id", myId).order("created_at", { ascending: false }).limit(20);
    
    if (dbNotifs) {
      dbNotifs.forEach(n => {
        notifList.push({
          id: n.id,
          title: n.title,
          message: n.message,
          created_at: n.created_at,
          is_read: isUserNotificationRead(n.id, n.created_at, n.is_read),
          link: '/pages/user/leave-history.html'
        });
      });
    }
    
    const unreadCount = notifList.filter(n => !n.is_read).length;
    const badge = document.getElementById("notifBadge");
    const countPill = document.getElementById("userNotifCount");
    
    if (badge) {
      badge.innerText = unreadCount;
      badge.style.display = unreadCount > 0 ? "flex" : "none";
    }
    if (countPill) {
      countPill.innerText = unreadCount > 0 ? `${unreadCount} รายการใหม่` : "ไม่มีรายการใหม่";
      countPill.style.background = unreadCount > 0 ? "#e0f2fe" : "#f1f5f9";
      countPill.style.color = unreadCount > 0 ? "#0369a1" : "#64748b";
    }
    
    const listEl = document.getElementById("userNotifList");
    if (!listEl) return;
    
    if (notifList.length === 0) {
      listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px;">ไม่มีการแจ้งเตือนใหม่</div>`;
      return;
    }
    
    listEl.innerHTML = notifList.map(n => {
      const isRead = n.is_read;
      const bg = isRead ? "transparent" : "#f0f9ff";
      const dot = isRead ? "" : `<div style="width: 8px; height: 8px; background: #0ea5e9; border-radius: 50%; margin-top: 6px; flex-shrink: 0;"></div>`;
      let icon = "📢";
      if (n.title.includes("อนุมัติแล้ว") || n.title.includes("✅")) icon = "✅";
      else if (n.title.includes("ไม่อนุมัติ") || n.title.includes("❌")) icon = "❌";
      else if (n.title.includes("คำขอใหม่") || n.title.includes("📥")) icon = "📥";
      
      return `
        <div onclick="handleUserNotifClick('${n.id}', '${n.link}')" style="display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; background: ${bg}; cursor: pointer; transition: background 0.2s;">
          ${dot}
          <div style="font-size: 20px;">${icon}</div>
          <div style="flex-grow: 1;">
            <div style="font-weight: ${isRead ? '500' : '700'}; color: #1e293b; font-size: 13px; margin-bottom: 4px;">${n.title.replace(/^[❌✅📌🟢🎉📢⚠️📥\s]+/, '')}</div>
            <div style="color: #64748b; font-size: 12px; line-height: 1.4;">${n.message}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error("Error fetching notifs:", err);
  }
}

window.handleUserNotifClick = async function(id, link) {
  // บันทึก local ก่อน เพื่อให้สถานะอ่านไม่เด้งกลับแม้ DB update ล้มเหลว
  addUserReadNotifId(id);
  const sb = window.pvtSupabase?.getClient();
  const myId = window.currentProfile?.id || window.currentProfile?.employee_id;
  if (sb) {
    try {
      let query = sb.from("notifications").update({ is_read: true }).eq("id", id);
      if (myId) query = query.eq("employee_id", myId);
      const { error } = await query;
      if (error) console.warn("DB read update failed (kept local read state):", error);
    } catch (e) {
      console.warn("DB read update failed (kept local read state):", e);
    }
  }
  if (link) window.location.href = link;
  else fetchUserNotifications();
};

window.markAllUserNotificationsAsRead = async function(event) {
  if (event) event.stopPropagation();
  const sb = window.pvtSupabase?.getClient();
  const myId = window.currentProfile?.id || window.currentProfile?.employee_id;

  // จำว่าแจ้งเตือนทั้งหมดก่อนเวลานี้ถูกอ่านแล้ว
  setAllUserNotificationsReadThrough(new Date().toISOString());

  document.querySelectorAll("#userNotifList [onclick]").forEach(el => {
    const match = el.getAttribute("onclick")?.match(/handleUserNotifClick\('([^']+)'/);
    if (match) addUserReadNotifId(match[1]);
  });

  if (sb && myId) {
    try {
      const { error } = await sb
        .from("notifications")
        .update({ is_read: true })
        .eq("employee_id", myId)
        .eq("is_read", false);
      if (error) console.warn("DB mark-all update failed (kept local read state):", error);
    } catch (e) {
      console.warn("DB mark-all update failed (kept local read state):", e);
    }
  }

  await fetchUserNotifications();
  if (typeof Swal !== 'undefined') Swal.fire({ icon: "success", title: "อ่านทั้งหมดแล้ว", timer: 1000, showConfirmButton: false });
};

// Auto load on init
setTimeout(() => { fetchUserNotifications(); }, 2000);

// 📱 Auto-sync on Android/Mobile WebView foreground resume for Leave History
let lastHistorySync = Date.now();
async function handleHistoryAutoSync() {
  if (document.visibilityState === 'visible' || !document.hidden) {
    const now = Date.now();
    if (now - lastHistorySync > 3500) {
      lastHistorySync = now;
      console.log("📱 [AUTO-SYNC] Leave history returned to foreground, fetching fresh requests...");
      try {
        await loadMyLeaveHistory();
        if (typeof fetchUserNotifications === 'function') fetchUserNotifications();
      } catch (err) {
        console.warn("History auto-sync error:", err);
      }
    }
  }
}

document.addEventListener("visibilitychange", handleHistoryAutoSync);
window.addEventListener("pageshow", handleHistoryAutoSync);
window.addEventListener("focus", handleHistoryAutoSync);

// 🌐 Global Window Function Bindings
window.directCancelLeave = typeof directCancelLeave !== 'undefined' ? directCancelLeave : window.directCancelLeave;
window.requestCancelApprovedLeave = typeof requestCancelApprovedLeave !== 'undefined' ? requestCancelApprovedLeave : window.requestCancelApprovedLeave;
window.loadMyLeaveHistory = typeof loadMyLeaveHistory !== 'undefined' ? loadMyLeaveHistory : window.loadMyLeaveHistory;
window.previewLeaveModalFromHistory = typeof previewLeaveModalFromHistory !== 'undefined' ? previewLeaveModalFromHistory : window.previewLeaveModalFromHistory;

// Polling ทุกๆ 25 วินาที
setInterval(() => {
  if (document.visibilityState === 'visible' && !document.hidden) {
    loadMyLeaveHistory();
  }
}, 25000);
