let myLeaveRows = [];
let filteredLeaveRows = [];
let myProfile = null;
let currentFilter = 'all';

document.addEventListener("DOMContentLoaded", initLeaveHistory);

async function initLeaveHistory() {
  myProfile = await window.pvtSupabase?.getCurrentProfile();
  renderProfileHeader();
  await loadMyLeaveHistory();
}

function renderProfileHeader() {
  const employee = myProfile?.employees || {};
  document.getElementById("emp-name").textContent = employee.full_name || myProfile?.display_name || "พนักงาน";
  document.getElementById("emp-detail").textContent =
    `รหัส ${employee.employee_code || "-"} · ${employee.departments?.department_name || "ไม่ระบุแผนก"}`;
  const avatar = document.getElementById("user-avatar");
  if (avatar && window.pvtSupabase?.getAvatarUrl) {
    avatar.src = window.pvtSupabase.getAvatarUrl(employee.image_url);
  }
}

async function loadMyLeaveHistory() {
  const tableBody = document.getElementById("table-data-rows");
  const employeeId = myProfile?.employee_id || myProfile?.employees?.id;
  const sb = window.pvtSupabase?.getClient();

  if (!sb || !employeeId) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">กรุณาเข้าสู่ระบบเพื่อดูประวัติการลา</td></tr>`;
    return;
  }

  try {
    const { data, error } = await sb
      .from("leave_requests")
      .select("id, leave_type_id, start_date, end_date, total_days, reason, status, approval_comment, cancel_reason, created_at, leave_types(leave_name)")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    myLeaveRows = data || [];
    filteredLeaveRows = [...myLeaveRows];
    
    renderSummary();
    renderRows();
  } catch (error) {
    console.error("❌ โหลดข้อมูลล้มเหลว:", error);
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
  
  if (!filteredLeaveRows.length) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">ไม่พบรายการใบลาตามเงื่อนไขที่เลือก</td></tr>`;
    return;
  }

  tableBody.innerHTML = filteredLeaveRows.map((item) => {
    let displayStatus = "";
    let statusClass = item.status || "pending";
    let actionBtnHtml = `<span class="action-disabled">-</span>`;

    // 🔄 จัดการสถานะและปุ่มกดตาม Hybrid Workflow
    if (item.status === "pending") {
      displayStatus = "รออนุมัติ";
      // กรณีลารออนุมัติ -> ยกเลิกได้ทันที
      actionBtnHtml = `
        <button class="btn-cancel-direct" onclick="directCancelLeave('${item.id}')" title="ยกเลิกคำขอนี้ทันที">
          <span class="material-symbols-outlined">close</span> ยกเลิกคำขอ
        </button>`;
    } 
    else if (item.status === "approved") {
      displayStatus = "อนุมัติแล้ว";
      // กรณีอนุมัติแล้ว -> ส่งคำร้องขอยกเลิกไปให้ HR
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

    const startDateStr = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(item.start_date) : item.start_date;
    const endDateStr = window.pvtSupabase?.formatThaiDate ? window.pvtSupabase.formatThaiDate(item.end_date) : item.end_date;

    return `
      <tr>
        <td data-label="ประเภทการลา"><strong class="leave-type-title">${escapeHtml(item.leave_types?.leave_name || "ไม่ระบุ")}</strong></td>
        <td data-label="ช่วงวันที่">${startDateStr} - ${endDateStr}</td>
        <td data-label="จำนวนวัน"><span class="day-count-badge">${item.total_days || 0}</span> วัน</td>
        <td data-label="เหตุผล" class="td-reason">${escapeHtml(item.reason || "-")}</td>
        <td data-label="สถานะ"><span class="status-badge ${statusClass}">${displayStatus}</span></td>
        <td data-label="จัดการคำขอ" class="td-action">${actionBtnHtml}</td>
      </tr>
    `;
  }).join("");
}

// 🔴 1. ยกเลิกทันที (สำหรับใบลาที่ "รออนุมัติ")
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
    cancelButtonText: 'ย้อนกลับ',
    customClass: { popup: 'swal2-rounded-popup' }
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

// 🔄 2. ส่งคำร้องขอยกเลิกไปหา HR (สำหรับใบลาที่ "อนุมัติแล้ว")
async function requestCancelApprovedLeave(requestId) {
  if (!requestId) return;

  const { value: cancelReason, isConfirmed } = await Swal.fire({
    title: 'ส่งคำร้องขอยกเลิกใบลา',
    text: 'ใบลานี้ได้รับการอนุมัติแล้ว การยกเลิกต้องรอให้ HR ตรวจสอบและอนุมัติคืนโควต้าวันลา',
    input: 'textarea',
    inputPlaceholder: 'กรุณาระบุเหตุผลในการขอยกเลิกใบลา...',
    inputAttributes: { 'aria-label': 'ระบุเหตุผลในการขอยกเลิกใบลา' },
    showCancelButton: true,
    confirmButtonColor: '#f59e0b',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ส่งคำร้องหา HR',
    cancelButtonText: 'ยกเลิก',
    customClass: { popup: 'swal2-rounded-popup' },
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'โปรดระบุเหตุผลการขอยกเลิกใบลา!';
      }
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

      await Swal.fire({ 
        icon: 'success', 
        title: 'ส่งคำร้องสำเร็จ!', 
        text: 'ส่งคำร้องขอยกเลิกให้ HR เรียบร้อยแล้ว โปรดรอ HR ดำเนินการ', 
        confirmButtonColor: '#0fa472' 
      });
      
      await loadMyLeaveHistory();

    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการส่งคำร้อง:", err);
      Swal.fire({ icon: 'error', title: 'ส่งคำร้องไม่สำเร็จ', text: err.message, confirmButtonColor: '#ef4444' });
    }
  }
}

// 🎯 ฟังก์ชันกรองประวัติการลา
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
  return window.pvtSupabase?.escapeHtml ? window.pvtSupabase.escapeHtml(value) : String(value ?? "");
}

// ฟังก์ชันบันทึกข้อมูลพนักงานแบบ Inline พร้อมรองรับฟิลด์เพิ่มเติม (FB / IG / เบอร์สำรอง)[cite: 24]
async function saveEmployeeInlineEdit(employeeId) {
  const emp = employees.find(e => String(e.id) === String(employeeId)); //[cite: 24]
  if (!emp) return; //[cite: 24]

  const code = document.getElementById('inline-edit-code')?.value.trim(); //[cite: 24]
  const name = document.getElementById('inline-edit-fullName')?.value.trim(); //[cite: 24]

  const updateData = {
    employee_code: code, //[cite: 24]
    full_name: name, //[cite: 24]
    phone: document.getElementById('inline-edit-phone')?.value.trim() || null, //[cite: 24]
    secondary_phone: document.getElementById('inline-edit-secPhone')?.value.trim() || null, // ฟิลด์เบอร์สำรอง
    facebook: document.getElementById('inline-edit-facebook')?.value.trim() || null,       // ฟิลด์ Facebook
    instagram: document.getElementById('inline-edit-instagram')?.value.trim() || null,     // ฟิลด์ IG
    line_id: document.getElementById('inline-edit-lineId')?.value.trim() || null, //[cite: 24]
    email: document.getElementById('inline-edit-email')?.value.trim() || null, //[cite: 24]
  };

  try {
    const supabase = getSupabase(); //[cite: 24]
    const { error } = await supabase.from('employees').update(updateData).eq('id', emp.id); //[cite: 24]
    if (error) throw error; //[cite: 24]

    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', text: 'อัปเดตข้อมูลพนักงานเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false }); //[cite: 24]
    await refreshDashboard(); //[cite: 24]
  } catch (err) {
    showAppError("ไม่สามารถบันทึกข้อมูลได้", err.message); //[cite: 24]
  }
}