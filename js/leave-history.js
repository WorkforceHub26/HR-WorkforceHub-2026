let myLeaveRows = [];
let filteredLeaveRows = [];
let myProfile = null;
let currentFilter = 'all';

function formatDuration(totalDays, leaveHours = null) {
  const days = parseFloat(totalDays) || 0;
  const hours = parseFloat(leaveHours) || 0;
  const uDays = window.getPVTTranslation ? window.getPVTTranslation("unitDays") : "วัน";
  const uHours = window.getPVTTranslation ? window.getPVTTranslation("unitHours") : "ชม.";
  const uMins = window.getPVTTranslation ? window.getPVTTranslation("unitMinutes") : "นาที";

  if (hours > 0) {
    const d = Math.floor(hours / 8);
    const remH = hours % 8;
    const wholeH = Math.floor(remH);
    const mins = Math.round((remH - wholeH) * 60);

    let parts = [];
    if (d > 0) parts.push(`${d} ${uDays}`);
    if (wholeH > 0) parts.push(`${wholeH} ${uHours}`);
    if (mins > 0) parts.push(`${mins} ${uMins}`);
    return parts.length > 0 ? parts.join(" ") : `${hours} ${uHours}`;
  }

  if (days <= 0) return `0 ${uDays}`;

  const wholeDays = Math.floor(days);
  const fracDay = days - wholeDays;
  const totalH = fracDay * 8;
  const wholeH = Math.floor(totalH);
  const mins = Math.round((totalH - wholeH) * 60);

  let parts = [];
  if (wholeDays > 0) parts.push(`${wholeDays} ${uDays}`);
  if (wholeH > 0) parts.push(`${wholeH} ${uHours}`);
  if (mins > 0) parts.push(`${mins} ${uMins}`);

  return parts.length > 0 ? parts.join(" ") : `${days} ${uDays}`;
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
  if (detailEl) detailEl.textContent = `${deptName} ${empCode}`.trim();

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
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">กรุณาเข้าสู่ระบบเพื่อดูประวัติการลา</td></tr>`;
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
    filteredLeaveRows = [...myLeaveRows];
    
    renderSummary();
    renderRows();

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
    tableBody.innerHTML = `<tr><td colspan="6" class="error-state">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderSummary() {
  const totalDays = myLeaveRows
    .filter(item => item.status === "approved")
    .reduce((sum, item) => sum + Number(item.total_days || 0), 0);

  setText("sumAll", myLeaveRows.length);
  setText("sumPending", myLeaveRows.filter((item) => item.status === "pending").length);
  setText("sumApproved", myLeaveRows.filter((item) => item.status === "approved").length);
  setText("sumCancelReq", myLeaveRows.filter((item) => item.status === "cancel_requested").length);
  setText("sumDays", totalDays.toFixed(1).replace(/\.0$/, ""));
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

function filterLeaveHistory(type, element) {
  currentFilter = type || currentFilter || 'all';

  if (element) {
    document.querySelectorAll('.filter-chips .chip, .history-summary .summary-card').forEach(el => {
      el.classList.remove('active');
    });
    element.classList.add('active');
  }

  let rows = [...myLeaveRows];
  if (currentFilter === 'pending') {
    rows = rows.filter(item => item.status === 'pending');
  } else if (currentFilter === 'approved') {
    rows = rows.filter(item => item.status === 'approved');
  } else if (currentFilter === 'cancel_requested') {
    rows = rows.filter(item => item.status === 'cancel_requested');
  } else if (currentFilter === 'rejected_cancelled') {
    rows = rows.filter(item => item.status === 'rejected' || item.status === 'cancelled');
  }

  const searchTerm = (document.getElementById("historySearchInput")?.value || "").trim().toLowerCase();
  if (searchTerm) {
    rows = rows.filter(item => {
      const typeName = translateLeaveTypeName(item.leave_types?.leave_name || "").toLowerCase();
      const reason = (item.reason || "").toLowerCase();
      const cancelReason = (item.cancel_reason || item.approval_comment || "").toLowerCase();
      return typeName.includes(searchTerm) || reason.includes(searchTerm) || cancelReason.includes(searchTerm);
    });
  }

  filteredLeaveRows = rows;
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
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">${t.emptyHistory || "ไม่พบรายการใบลาตามเงื่อนไขที่เลือก"}</td></tr>`;
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
    let actionBtnHtml = `<span class="action-disabled">-</span>`;

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
        displayStatus = `<span class="material-symbols-outlined" style="font-size:13px; vertical-align:middle; margin-right:2px;">timer_off</span> เกินกำหนด (${overdueDays} วัน)`;
        statusClass = "overdue";
      } else {
        displayStatus = t.statusPending || "รออนุมัติ";
      }
      actionBtnHtml = `
        <button class="btn-cancel-direct" onclick="directCancelLeave('${item.id}')" title="${t.btnDirectCancel}">
          <span class="material-symbols-outlined">close</span> ${t.btnDirectCancel}
        </button>`;
    } 
    else if (item.status === "approved") {
      displayStatus = t.statusApproved || "อนุมัติแล้ว";
      actionBtnHtml = `
        <button class="btn-request-cancel" onclick="requestCancelApprovedLeave('${item.id}')" title="${t.btnRequestCancel}">
          <span class="material-symbols-outlined">assignment_return</span> ${t.btnRequestCancel}
        </button>`;
    } 
    else if (item.status === "cancel_requested") {
      displayStatus = t.statusCancelReq || "รอ HR อนุมัติยกเลิก";
      statusClass = "cancel_requested";
      actionBtnHtml = `<span class="badge-waiting-hr"><span class="material-symbols-outlined">hourglass_empty</span> ${t.badgeWaitingHr || "ส่งเรื่องแล้ว"}</span>`;
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

    const startDateStr = window.pvtSupabase?.utils?.formatThaiDate ? window.pvtSupabase.utils.formatThaiDate(item.start_date) : item.start_date;
    const endDateStr = window.pvtSupabase?.utils?.formatThaiDate ? window.pvtSupabase.utils.formatThaiDate(item.end_date) : item.end_date;

    const cancelOrRejectReason = item.cancel_reason || item.approval_comment;
    const isCancelled = item.status === "cancelled" || (item.approval_comment && item.approval_comment.includes("ยกเลิก"));
    const isRejected = item.status === "rejected" && !isCancelled;

    const displayTypeName = highlightMatch(leaveTypeName, searchTerm);
    const displayReason = highlightMatch(item.reason || "-", searchTerm);
    const displayCancelReason = highlightMatch(cancelOrRejectReason || "", searchTerm);

    return `
      <tr id="row-${item.id}" class="${isOverdue ? 'row-overdue' : ''}">
        <td data-label="${t.thLeaveType || "ประเภทการลา"}"><strong class="leave-type-title" data-raw-cat="${escapeHtml(rawLeaveTypeName)}">${displayTypeName}</strong></td>
        <td data-label="${t.thDateRange || "ช่วงวันที่"}">${startDateStr} - ${endDateStr}</td>
        <td data-label="${t.thDays || "จำนวนวัน"}"><span class="day-count-badge">${formatDuration(item.total_days, item.leave_hours)}</span></td>
        <td data-label="${t.thReason || "เหตุผล"}" class="td-reason">
          <div>${displayReason}</div>
          ${isOverdue ? `
            <div class="history-overdue-alert" style="margin-top:4px; font-size:11.5px; color:#c2410c; background:#fff7ed; padding:4px 8px; border-radius:6px; border:1px solid #fed7aa; display:inline-flex; align-items:center; gap:4px; max-width:100%; text-align:left;">
              <span class="material-symbols-outlined" style="font-size:14px; color:#ea580c; flex-shrink:0;">timer_off</span>
              <span><strong>ใบลาไม่ได้รับการพิจารณาในเวลาที่กำหนด:</strong> หัวหน้าและผู้จัดการยังไม่ได้อนุมัติภายในกำหนด 2 วัน (ค้างมาแล้ว ${overdueDays} วัน)</span>
            </div>
          ` : ''}
          ${isCancelled && cancelOrRejectReason ? `
            <div style="margin-top:4px; font-size:11.5px; color:#be123c; background:#fff1f2; padding:3px 6px; border-radius:6px; border:1px solid #fecdd3; display:inline-block; max-width:100%; text-align:left;">
              <strong>${t.reasonCancelPrefix || "เหตุผลที่ยกเลิก:"}</strong> ${displayCancelReason}
            </div>
          ` : isRejected && item.approval_comment ? `
            <div style="margin-top:4px; font-size:11.5px; color:#be123c; background:#fff1f2; padding:3px 6px; border-radius:6px; border:1px solid #fecdd3; display:inline-block; max-width:100%; text-align:left;">
              <strong>${t.reasonRejectPrefix || "เหตุผลที่ไม่อนุมัติ:"}</strong> ${displayCancelReason}
            </div>
          ` : ''}
        </td>
        <td data-label="${t.thStatus || "สถานะ"}"><span class="status-badge ${statusClass}" data-raw-status="${item.status}">${displayStatus}</span></td>
        <td data-label="${t.thAction || "จัดการคำขอ"}" class="td-action">${actionBtnHtml}</td>
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

      await Swal.fire({ icon: 'success', title: 'ส่งคำร้องสำเร็จ!', text: 'ส่งคำร้องขอยกเลิกให้ HR เรียบร้อยแล้ว', confirmButtonColor: '#0fa472' });
      await loadMyLeaveHistory();
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการส่งคำร้อง:", err);
      Swal.fire({ icon: 'error', title: 'ส่งคำร้องไม่สำเร็จ', text: err.message, confirmButtonColor: '#ef4444' });
    }
  }
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

  Swal.fire({
    title: `<div style="display:flex;align-items:center;justify-content:center;gap:8px;"><span class="material-symbols-outlined" style="color:#0d9488;">event_note</span> ${typeName}</div>`,
    html: `
      <div style="text-align: left; font-size: 14px; line-height: 1.6; color: #334155; padding: 4px 8px;">
        <div style="background: ${sla.isOverdue ? '#fff7ed' : '#f0fdf4'}; border: 1px solid ${sla.isOverdue ? '#fed7aa' : '#bbf7d0'}; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px;">
          <div style="font-weight: 700; color: ${sla.isOverdue ? '#c2410c' : '#15803d'}; display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined" style="font-size: 18px;">timer</span>
            ${sla.isOverdue ? 'ใบลาไม่ได้รับการพิจารณาในเวลาที่กำหนด' : 'เวลานับถอยหลังกรอบเวลา 2 วัน'}
          </div>
          <div style="font-size: 13px; margin-top: 2px;">${sla.countdownText}</div>
          <div style="font-size: 12px; font-weight: 600; color: #c2410c; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
            <span>⚠️ กำหนดกรอบเวลาพิจารณาอนุมัติภายใน 2 วันทำการ</span>
          </div>
        </div>
        <div style="margin-bottom: 8px;"><strong>ช่วงวันที่ลา:</strong> ${startStr} ถึง ${endStr}</div>
        <div style="margin-bottom: 8px;"><strong>จำนวนวัน:</strong> ${duration}</div>
        <div style="margin-bottom: 8px;"><strong>เหตุผลการลา:</strong> ${escapeHtml(item.reason || '-')}</div>
        <div style="margin-bottom: 8px;"><strong>วันที่ยื่นคำขอ:</strong> ${item.created_at ? new Date(item.created_at).toLocaleString('th-TH') : '-'}</div>
      </div>
    `,
    showCloseButton: true,
    showConfirmButton: true,
    confirmButtonText: 'ปิดหน้าต่าง',
    confirmButtonColor: '#0d9488'
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

// Re-render when language changes
window.addEventListener("pvt-lang-changed", () => {
  renderRows();
});