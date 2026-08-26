let myLeaveRows = [];
let filteredLeaveRows = [];
let myProfile = null;
let currentFilter = 'all';

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

function renderRows() {
  const tableBody = document.getElementById("table-data-rows");
  if (!tableBody) return;
  
  if (!filteredLeaveRows.length) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">ไม่พบรายการใบลาตามเงื่อนไขที่เลือก</td></tr>`;
    return;
  }

  tableBody.innerHTML = filteredLeaveRows.map((item) => {
    let displayStatus = "";
    let statusClass = item.status || "pending";
    let actionBtnHtml = `<span class="action-disabled">-</span>`;

    let leaveTypeName = "ไม่ระบุ";
    if (Array.isArray(item.leave_types) && item.leave_types.length > 0) {
      leaveTypeName = item.leave_types[0].leave_name;
    } else if (item.leave_types?.leave_name) {
      leaveTypeName = item.leave_types.leave_name;
    }

    if (item.status === "pending") {
      displayStatus = "รออนุมัติ";
      actionBtnHtml = `
        <button class="btn-cancel-direct" onclick="directCancelLeave('${item.id}')" title="ยกเลิกคำขอนี้ทันที">
          <span class="material-symbols-outlined">close</span> ยกเลิกคำขอ
        </button>`;
    } 
    else if (item.status === "approved") {
      displayStatus = "อนุมัติแล้ว";
      actionBtnHtml = `
        <button class="btn-request-cancel" onclick="requestCancelApprovedLeave('${item.id}')" title="ส่งคำร้องขอยกเลิกใบลาให้ HR">
          <span class="material-symbols-outlined">assignment_return</span> ขอยกเลิกใบลา
        </button>`;
    } 
    else if (item.status === "cancel_requested") {
      displayStatus = "รอ HR อนุมัติยกเลิก";
      statusClass = "cancel_requested";
      actionBtnHtml = `<span class="badge-waiting-hr"><span class="material-symbols-outlined">hourglass_empty</span> ส่งเรื่องแล้ว</span>`;
    } 
    else if (item.status === "cancelled") {
      displayStatus = "ยกเลิกแล้ว";
      statusClass = "cancelled";
    } 
    else if (item.status === "rejected") {
      const comment = item.approval_comment || "";
      if (comment.includes("ยกเลิก")) {
        displayStatus = "ยกเลิกแล้ว";
        statusClass = "cancelled"; 
      } else {
        displayStatus = "ไม่อนุมัติ";
        statusClass = "rejected";
      }
    }

    const startDateStr = window.pvtSupabase?.utils?.formatThaiDate ? window.pvtSupabase.utils.formatThaiDate(item.start_date) : item.start_date;
    const endDateStr = window.pvtSupabase?.utils?.formatThaiDate ? window.pvtSupabase.utils.formatThaiDate(item.end_date) : item.end_date;

    const cancelOrRejectReason = item.cancel_reason || item.approval_comment;
    const isCancelled = item.status === "cancelled" || (item.approval_comment && item.approval_comment.includes("ยกเลิก"));
    const isRejected = item.status === "rejected" && !isCancelled;

    return `
      <tr>
        <td data-label="ประเภทการลา"><strong class="leave-type-title">${escapeHtml(leaveTypeName)}</strong></td>
        <td data-label="ช่วงวันที่">${startDateStr} - ${endDateStr}</td>
        <td data-label="จำนวนวัน"><span class="day-count-badge">${item.total_days || 0}</span> วัน</td>
        <td data-label="เหตุผล" class="td-reason">
          <div>${escapeHtml(item.reason || "-")}</div>
          ${isCancelled && cancelOrRejectReason ? `
            <div style="margin-top:4px; font-size:11.5px; color:#be123c; background:#fff1f2; padding:3px 6px; border-radius:6px; border:1px solid #fecdd3; display:inline-block; max-width:100%; text-align:left;">
              <strong>เหตุผลที่ยกเลิก:</strong> ${escapeHtml(cancelOrRejectReason)}
            </div>
          ` : isRejected && item.approval_comment ? `
            <div style="margin-top:4px; font-size:11.5px; color:#be123c; background:#fff1f2; padding:3px 6px; border-radius:6px; border:1px solid #fecdd3; display:inline-block; max-width:100%; text-align:left;">
              <strong>เหตุผลที่ไม่อนุมัติ:</strong> ${escapeHtml(item.approval_comment)}
            </div>
          ` : ''}
        </td>
        <td data-label="สถานะ"><span class="status-badge ${statusClass}">${displayStatus}</span></td>
        <td data-label="จัดการคำขอ" class="td-action">${actionBtnHtml}</td>
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

function filterLeaveHistory(type, element) {
  currentFilter = type;

  if (element) {
    document.querySelectorAll('.filter-chips .chip, .history-summary .summary-card').forEach(el => {
      el.classList.remove('active');
    });
    element.classList.add('active');
  }

  if (type === 'pending') {
    filteredLeaveRows = myLeaveRows.filter(item => item.status === 'pending');
  } else if (type === 'approved') {
    filteredLeaveRows = myLeaveRows.filter(item => item.status === 'approved');
  } else if (type === 'cancel_requested') {
    filteredLeaveRows = myLeaveRows.filter(item => item.status === 'cancel_requested');
  } else if (type === 'rejected_cancelled') {
    filteredLeaveRows = myLeaveRows.filter(item => item.status === 'rejected' || item.status === 'cancelled');
  } else {
    filteredLeaveRows = [...myLeaveRows];
  }

  renderRows();
}

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