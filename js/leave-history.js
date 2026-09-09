let myLeaveRows = [];
let filteredLeaveRows = [];
let myProfile = null;
let currentFilter = 'all';
let selectedYear = "2025"; // Standard default year matching the user screenshot

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

// 🎨 วาดข้อมูลลงส่วนหัว (ถอด Logic จัดการ URL รูปภาพจาก index-user.js)
function renderProfileHeader() {
  const nameEl = document.getElementById("emp-name");
  const detailEl = document.getElementById("emp-detail");
  const avatarEl = document.getElementById("user-avatar");

  if (!myProfile) {
    if (nameEl) nameEl.textContent = "พนักงาน (กรุณาล็อกอิน)";
    if (detailEl) detailEl.textContent = "ไม่พบข้อมูลโปรไฟล์";
    if (avatarEl) avatarEl.src = "/assets/img/default-avatar.jpg";
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

  // 3. แสดงรูปโปรไฟล์ (Logic เดียวกับ index-user.js)
  if (avatarEl) {
    let avatarUrl = emp.image_url || myProfile.image_url || myProfile.image_url;
    
    if (avatarUrl && avatarUrl.trim() !== "") {
      // เคสที่ 1: กรณีเป็น Path สั้น ให้ต่อ Domain เต็ม
      if (!avatarUrl.startsWith("http")) {
        avatarUrl = `https://pgogmhqjdchakcytsomx.supabase.co/storage/v1/object/public/employee-images/${avatarUrl}`;
      }
      
      // เคสที่ 2: ป้องกัน Error 400 แทรก /public/ หากขาดหายไป
      if (avatarUrl.includes("storage/v1/object/") && !avatarUrl.includes("storage/v1/object/public/")) {
        avatarUrl = avatarUrl.replace("storage/v1/object/", "storage/v1/object/public/");
      }
      
      avatarEl.src = avatarUrl;
    } else {
      avatarEl.src = "/assets/img/default-avatar.jpg";
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
      .select("id, leave_type_id, start_date, end_date, total_days, reason, status, approval_comment, cancel_reason, created_at, leave_types(leave_name)")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("⚠️ Foreign Key Join Fail, fallback to manual join:", error.message);
      const res = await sb
        .from("leave_requests")
        .select("id, leave_type_id, start_date, end_date, total_days, reason, status, approval_comment, cancel_reason, created_at")
        .eq("employee_id", empId)
        .order("created_at", { ascending: false });

      if (res.error) throw res.error;
      data = res.data || [];

      const { data: typeList } = await sb.from("leave_types").select("id, leave_name");
      const typeMap = new Map((typeList || []).map(t => [String(t.id), t.leave_name]));

      data = data.map(item => ({
        ...item,
        leave_types: { leave_name: typeMap.get(String(item.leave_type_id)) || "ไม่ระบุ" }
      }));
    }

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

  // Update DOM metrics smoothly
  setText("sumAll", sumAll);
  setText("sumDays", sumDays.toFixed(1).replace(/\.0$/, ""));
  setText("sumApproved", sumApproved);
  setText("sumPending", sumPending);
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

  if (element) {
    document.querySelectorAll('.sum-card').forEach(el => {
      el.classList.remove('active');
    });
    element.classList.add('active');
  }

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

  // 3. FILTER BY LIVE SEARCH BAR
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
    statusCancelReq: "รอ HR อนุมัติยกเลิก",
    statusCancelled: "ยกเลิกแล้ว",
    statusRejected: "ไม่อนุมัติ",
    btnDirectCancel: "ยกเลิกคำขอ",
    btnRequestCancel: "ขอยกเลิกใบลา",
    badgeWaitingHr: "ส่งเรื่องแล้ว",
    reasonCancelPrefix: "เหตุผลที่ยกเลิก:",
    reasonRejectPrefix: "เหตุผลที่ไม่อนุมัติ:"
  };
  
  if (!filteredLeaveRows.length) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-history-cell">${t.emptyHistory || "ไม่พบรายการใบลาตามเงื่อนไขที่เลือก"}</td></tr>`;
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
      displayStatus = t.statusCancelReq || "รอ HR อนุมัติยกเลิก";
      statusClass = "pending";
    } 
    else if (item.status === "cancelled") {
      displayStatus = t.statusCancelled || "ยกเลิก";
      statusClass = "cancelled";
    } 
    else if (item.status === "rejected") {
      const comment = item.approval_comment || "";
      if (comment.includes("ยกเลิก")) {
        displayStatus = t.statusCancelled || "ยกเลิก";
        statusClass = "cancelled"; 
      } else {
        displayStatus = t.statusRejected || "ไม่อนุมัติ";
        statusClass = "rejected";
      }
    }

    const formattedRange = formatLeaveDateRange(item.start_date, item.end_date);
    const catDetails = getLeaveTypeDetails(leaveTypeName);

    const displayTypeName = highlightMatch(catDetails.title, searchTerm);
    const displayReason = highlightMatch(item.reason || "พักผ่อนประจำปี", searchTerm);

    return `
      <tr id="row-${item.id}" class="${isOverdue ? 'row-overdue' : ''}">
        <td data-label="วันที่ขอ"><strong>${formattedRange}</strong></td>
        <td data-label="ประเภทการลา">
          <div class="leave-type-flex">
            <div class="leave-type-icon-wrapper ${catDetails.colorClass}">
              <span class="material-symbols-outlined">${catDetails.icon}</span>
            </div>
            <div class="leave-type-text-stack">
              <span class="leave-type-main-title">${displayTypeName}</span>
              <span class="leave-type-reason-subtitle">${displayReason}</span>
            </div>
          </div>
        </td>
        <td data-label="จำนวนวัน"><span class="day-count-indicator">${formatDuration(item.total_days, item.leave_hours)}</span></td>
        <td data-label="สถานะ"><span class="pvt-status-pill ${statusClass}">${displayStatus}</span></td>
        <td data-label="รายละเอียด" style="text-align: center;">
          <button class="btn-view-details" onclick="previewLeaveModalFromHistory('${item.id}')" title="ดูรายละเอียดและจัดการคำขอ">
            <span class="material-symbols-outlined">visibility</span>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

async function directCancelLeave(requestId) {
  if (!requestId) return;

  const result = await Swal.fire({
    title: 'ยืนยันการยกเลิกใบลา?',
    text: 'รายการนี้ยังไม่อนุมัติ คุณสามารถยกเลิกได้ทันที',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ใช่, ยกเลิกเลย',
    cancelButtonText: 'ย้อนกลับ'
  });

  if (result.isConfirmed) {
    try {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");

      const { error } = await sb
        .from("leave_requests")
        .update({
          status: "cancelled",
          approval_comment: "พนักงานยกเลิกคำขอลา (ยกเลิกก่อนอนุมัติ)"
        })
        .eq("id", requestId);

      if (error) throw error;

      await Swal.fire({ icon: 'success', title: 'ยกเลิกเรียบร้อย!', timer: 1500, showConfirmButton: false });
      await loadMyLeaveHistory();
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการยกเลิก:", err);
      Swal.fire({ icon: 'error', title: 'ยกเลิกไม่สำเร็จ', text: err.message, confirmButtonColor: '#ef4444' });
    }
  }
}

async function requestCancelApprovedLeave(requestId) {
  if (!requestId) return;

  const { value: cancelReason, isConfirmed } = await Swal.fire({
    title: 'ส่งคำร้องขอยกเลิกใบลา',
    text: 'ใบลานี้ได้รับการอนุมัติแล้ว การยกเลิกต้องรอให้ HR ตรวจสอบและอนุมัติคืนโควต้าวันลา',
    input: 'textarea',
    inputPlaceholder: 'กรุณาระบุเหตุผลในการขอยกเลิกใบลา...',
    showCancelButton: true,
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ส่งคำร้องหา HR',
    cancelButtonText: 'ยกเลิก',
    inputValidator: (value) => {
      if (!value || !value.trim()) return 'โปรดระบุเหตุผลการขอยกเลิกใบลา!';
    }
  });

  if (isConfirmed && cancelReason) {
    try {
      const sb = window.pvtSupabase?.getClient();
      if (!sb) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");

      const { error } = await sb
        .from("leave_requests")
        .update({
          status: "cancel_requested",
          cancel_reason: cancelReason.trim()
        })
        .eq("id", requestId);

      if (error) throw error;

      await Swal.fire({ icon: 'success', title: 'ส่งคำร้องสำเร็จ!', text: 'ส่งคำร้องขอยกเลิกให้ HR เรียบร้อยแล้ว', confirmButtonColor: '#0f766e' });
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
    else if (item.status === "cancel_requested") statusText = "รอ HR อนุมัติยกเลิก";
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

window.previewLeaveModalFromHistory = function(leaveId) {
  const item = (myLeaveRows || []).find(r => String(r.id) === String(leaveId));
  if (!item) return;

  const sla = window.calculateSlaDetails ? window.calculateSlaDetails(item) : { countdownText: "", isOverdue: false };
  const rawType = item.leave_types?.leave_name || "ลาทั่วไป";
  const typeName = translateLeaveTypeName ? translateLeaveTypeName(rawType) : rawType;
  const startStr = formatDate(item.start_date);
  const endStr = formatDate(item.end_date);
  const duration = formatDuration(item.total_days, item.leave_hours);

  // Determine actions buttons
  let actionButtonsHtml = "";
  if (item.status === "pending") {
    actionButtonsHtml = `
      <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="Swal.close(); directCancelLeave('${item.id}')" style="background: #fef2f2; border: 1px solid #fecaca; padding: 10px 18px; border-radius: 10px; color: #dc2626; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
          <span class="material-symbols-outlined" style="font-size: 18px;">close</span> ยกเลิกคำขอลาทันที
        </button>
      </div>`;
  } else if (item.status === "approved") {
    actionButtonsHtml = `
      <div style="margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 16px; display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="Swal.close(); requestCancelApprovedLeave('${item.id}')" style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px 18px; border-radius: 10px; color: #b45309; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
          <span class="material-symbols-outlined" style="font-size: 18px;">assignment_return</span> ส่งคำร้องขอยกเลิกคำขอลาพนักงาน (คืนโควต้า)
        </button>
      </div>`;
  }

  Swal.fire({
    title: `<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><span class="material-symbols-outlined" style="color:#0f766e;">event_note</span> ${typeName}</div>`,
    html: `
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

        <!-- 📍 VISUAL PROGRESS TRACKER (STEPPER) -->
        <div style="margin-top: 18px; margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px;">
          <div style="font-weight: 700; color: #0f766e; font-size: 13px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined" style="font-size: 18px;">timeline</span> ขั้นตอนการอนุมัติ (Visual Stepper)
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="color: #10b981; font-size: 16px;">check_circle</span> 1. ยื่นคำขอลา
              </span>
              <span style="color: #15803d; font-weight: 600;">สำเร็จ</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="color: ${item.manager_status === 'approved' ? '#10b981' : item.manager_status === 'rejected' ? '#ef4444' : '#f59e0b'}; font-size: 16px;">
                  ${item.manager_status === 'approved' ? 'check_circle' : item.manager_status === 'rejected' ? 'cancel' : 'hourglass_top'}
                </span>
                2. หัวหน้างาน (L1)
              </span>
              <span style="font-weight: 600; color: ${item.manager_status === 'approved' ? '#15803d' : item.manager_status === 'rejected' ? '#b91c1c' : '#b45309'};">
                ${item.manager_status === 'approved' ? 'อนุมัติแล้ว' : item.manager_status === 'rejected' ? 'ไม่อนุมัติ' : 'รอพิจารณา (48 ชม.)'}
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="color: ${item.director_status === 'approved' ? '#10b981' : item.director_status === 'rejected' ? '#ef4444' : item.manager_status === 'approved' ? '#f59e0b' : '#94a3b8'}; font-size: 16px;">
                  ${item.director_status === 'approved' ? 'check_circle' : item.director_status === 'rejected' ? 'cancel' : item.manager_status === 'approved' ? 'hourglass_top' : 'schedule'}
                </span>
                3. ผู้จัดการฝ่าย (L2)
              </span>
              <span style="font-weight: 600; color: ${item.director_status === 'approved' ? '#15803d' : item.director_status === 'rejected' ? '#b91c1c' : '#94a3b8'};">
                ${item.director_status === 'approved' ? 'อนุมัติแล้ว' : item.director_status === 'rejected' ? 'ไม่อนุมัติ' : item.manager_status === 'approved' ? 'รอพิจารณา' : 'รอดำเนินการ'}
              </span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 6px;">
                <span class="material-symbols-outlined" style="color: ${item.status === 'approved' ? '#10b981' : item.status === 'rejected' ? '#ef4444' : '#94a3b8'}; font-size: 16px;">
                  ${item.status === 'approved' ? 'verified' : item.status === 'rejected' ? 'cancel' : 'pending'}
                </span>
                4. ฝ่ายบุคคล (HR Final)
              </span>
              <span style="font-weight: 600; color: ${item.status === 'approved' ? '#15803d' : item.status === 'rejected' ? '#b91c1c' : '#94a3b8'};">
                ${item.status === 'approved' ? 'อนุมัติสมบูรณ์' : item.status === 'rejected' ? 'ไม่อนุมัติ' : 'รอดำเนินการ'}
              </span>
            </div>
          </div>
          <div style="margin-top: 10px; font-size: 11px; color: #0f766e; background: #f0fdfa; padding: 6px 10px; border-radius: 8px;">
            💡 ติดตามสถานะผ่านระบบได้โดยตรง ไม่ต้องทักไลน์สอบถามหัวหน้างาน
          </div>
        </div>

        ${item.cancel_reason ? `
          <div style="margin-top: 12px; background: #fff1f2; border: 1px solid #fecdd3; padding: 10px; border-radius: 8px; color: #991b1b;">
            <strong>เหตุผลขอยกเลิก:</strong> ${escapeHtml(item.cancel_reason)}
          </div>` : ''}
        ${item.approval_comment ? `
          <div style="margin-top: 12px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; color: #475569;">
            <strong>ความคิดเห็นจากผู้อนุมัติ:</strong> ${escapeHtml(item.approval_comment)}
          </div>` : ''}
        ${actionButtonsHtml}
      </div>
    `,
    showCloseButton: true,
    showConfirmButton: true,
    confirmButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#0f766e'
  });
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
