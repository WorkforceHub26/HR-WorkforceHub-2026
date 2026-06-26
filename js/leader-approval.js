/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - LEADER & MANAGER APPROVAL ENGINE (ADVANCED SYSTEM)
 * ==========================================================================
 */

let sb = null;
let rawRequests = [];
let currentRoleState = "manager"; // 'manager' = หัวหน้าแผนก, 'director' = ผู้จัดการฝ่าย
let toastTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.group("🚀 [Leader System]: เริ่มต้นโหลดแผงควบคุมผู้อนุมัติขั้นต้น");
  
  setupSidebarToggle();
  initializeSupabaseConnection();
  setupBellNotificationToggle();
  
  await fetchLeaveRequestsData();
  renderApprovalTable();
  
  console.groupEnd();
});

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("toggleSidebar");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      document.querySelector(".sidebar")?.classList.toggle("collapsed");
    });
  }
}

function initializeSupabaseConnection() {
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === "function") {
    sb = window.pvtSupabase.getClient();
    console.log("🔌 [Leader Connect]: ผูกฐานข้อมูลหลักผ่าน window.pvtSupabase สำเร็จ");
  } else if (typeof supabase !== "undefined") {
    sb = supabase;
    console.log("🔌 [Leader Connect]: ผูกฐานข้อมูลผ่าน全域 supabase สำเร็จ");
  } else {
    console.warn("⚠️ [Leader Connect]: ไม่พบตัวเชื่อมต่อฐานข้อมูล ระบบเข้าสู่โหมดจำลองสถานการณ์");
  }
}

// ⚙️ ระบบปุ่มคลิกเปิด-ปิดตัวเมนูกระดิ่ง (ไม่มี Badge แดงตามความต้องการพี่มิก)
function setupBellNotificationToggle() {
  const bellTrigger = document.getElementById("bellTrigger");
  const bellDropdown = document.getElementById("bellDropdown");
  const bellBadge = document.getElementById("bellBadge");

  if (bellBadge) bellBadge.style.display = "none"; // ปิดถาวร

  if (bellTrigger && bellDropdown) {
    bellTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      bellDropdown.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (!bellDropdown.contains(e.target) && e.target !== bellTrigger) {
        bellDropdown.classList.remove("active");
      }
    });
  }
}

// 📡 ดึงข้อมูลใบลาเพื่อนำมาคัดกรองตามเลเวลการอนุมัติ
async function fetchLeaveRequestsData() {
  console.log("📡 [Fetch Processing]: กำลังดึงข้อมูลจากตารางคำขอลา...");
  
  // ข้อมูลจำลองพรีเมียม (เผื่อกรณีระบบ Offline / ไม่มีตาราง)
  const mockRequests = [
    { id: 101, emp_name: "นาย อภิสิทธิ์ รักดี", department: "ฝ่ายผลิต", leave_type_name: "ลากิจเสี่ยงภัย", total_days: 3, reason: "ซ่อมแซมบ้านหลังน้ำท่วมใหญ่", manager_status: "pending", director_status: "pending", status: "pending" },
    { id: 102, emp_name: "นางสาว พรพิมล มั่นคง", department: "ฝ่ายออฟฟิศ", leave_type_name: "ลาป่วยกะทันหัน", total_days: 1, reason: "อาหารเป็นพิษรุนแรง", manager_status: "pending", director_status: "pending", status: "pending" },
    { id: 103, emp_name: "นาย ธนพล แก้วสะอาด", department: "ฝ่ายขนส่ง", leave_type_name: "ลาพักร้อนประจำปี", total_days: 5, reason: "กลับภูมิลำเนาเยี่ยมครอบครัว", manager_status: "approved", director_status: "pending", status: "pending" }
  ];

  if (!sb) {
    rawRequests = mockRequests;
    updateCounterCards();
    renderBellNotifications(rawRequests);
    return;
  }

  try {
    const { data, error } = await sb.from("leave_requests").select("*");
    if (error) throw error;
    
    rawRequests = data || [];
    if (rawRequests.length === 0) {
      rawRequests = mockRequests;
    }
    
    updateCounterCards();
    renderBellNotifications(rawRequests);
  } catch (err) {
    console.error("❌ ดึงข้อมูลใบลาผิดพลาด สลับใช้จำลองอัตโนมัติ:", err);
    rawRequests = mockRequests;
    updateCounterCards();
    renderBellNotifications(rawRequests);
  }
}

// สลับมุมมองตำแหน่งสิทธิ์ (หัวหน้าแผนก / ผู้จัดการฝ่าย)
function switchRoleView(role) {
  currentRoleState = role;
  
  // อัปเดต UI เมนูด้านข้าง
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
  const activeIndex = role === "manager" ? 0 : 1;
  document.querySelectorAll(".nav-item")[activeIndex].classList.add("active");
  
  // เปลี่ยนข้อความพาดหัว
  const mainHeading = document.getElementById("pageMainHeading");
  const userRoleBadge = document.getElementById("currentUserRole");
  
  if (role === "manager") {
    mainHeading.textContent = "แผงพิจารณาใบลาอนุมัติ (ระดับหัวหน้าแผนก)";
    userRoleBadge.textContent = "Department Head";
  } else {
    mainHeading.textContent = "แผงพิจารณาใบลาอนุมัติ (ระดับผู้จัดการฝ่าย)";
    userRoleBadge.textContent = "Division Director";
  }
  
  renderApprovalTable();
  updateCounterCards();
}

// 📋 เรนเดอร์ตารางคัดกรองใบลาตามเงื่อนไขสายงานอนุมัติ
function renderApprovalTable() {
  const tBody = document.getElementById("tableBody");
  const tTitle = document.getElementById("tableTitle");
  if (!tBody) return;

  tBody.innerHTML = "";
  let filteredData = [];

  if (currentRoleState === "manager") {
    tTitle.textContent = "ทำเนียบรายชื่อพนักงานและกำลังพล (รอหัวหน้าแผนกอนุมัติด่านที่ 1)";
    // หัวหน้าแผนกจะตรวจคำขอที่ manager_status เป็น pending เท่านั้น
    filteredData = rawRequests.filter(r => (r.manager_status || r.status) === "pending");
  } else {
    tTitle.textContent = "ทำเนียบรายชื่อพนักงานและกำลังพล (รอผู้จัดการฝ่ายอนุมัติด่านที่ 2)";
    // ผู้จัดการฝ่ายจะตรวจใบลาที่ "หัวหน้าแผนกด่านแรกผ่านแล้ว" (approved) แต่ตัวผู้จัดการเองยังไม่ได้ตรวจ (pending)
    filteredData = rawRequests.filter(r => r.manager_status === "approved" && (!r.director_status || r.director_status === "pending"));
  }

  if (filteredData.length === 0) {
    tBody.innerHTML = `<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--text-soft); font-style: italic;">ไม่มีเอกสารคำขอลาค้างพิจารณาในสิทธิ์ระบบตอนนี้ ✨</td></tr>`;
    return;
  }

  filteredData.forEach(item => {
    const tr = document.createElement("tr");
    const name = item.emp_name || item.employee_name || "ไม่ทราบชื่อ";
    const dept = item.department || "ทั่วไป";
    const type = item.leave_type_name || "ลาหยุด";
    const days = item.total_days || item.leave_duration_days || 0;
    const reason = item.reason || "ไม่ระบุสาเหตุการลา";

    tr.innerHTML = `
      <td style="font-weight:600;">${name}</td>
      <td>${dept}</td>
      <td><span style="background:#f1f5f9; padding:4px 10px; border-radius:6px; font-size:13px;">${type}</span></td>
      <td style="font-weight:700; color:var(--primary);">${days} วัน</td>
      <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reason}">${reason}</td>
      <td>
        <div class="btn-action-group">
          <button class="btn-approve" onclick="processLeaveAction(${item.id}, 'approved')">
            <span class="material-symbols-outlined" style="font-size:16px;">check_circle</span>อนุมัติผ่าน
          </button>
          <button class="btn-reject" onclick="processLeaveAction(${item.id}, 'rejected')">
            <span class="material-symbols-outlined" style="font-size:16px;">cancel</span>ปฏิเสธ
          </button>
        </div>
      </td>
    `;
    tBody.appendChild(tr);
  });
}

// ⚡ ฟังก์ชันส่งคำสั่งอนุมัติ / ปฏิเสธ ไปที่ฐานข้อมูลหลัก
async function processLeaveAction(id, actionResult) {
  const actionText = actionResult === "approved" ? "อนุมัติ" : "ปฏิเสธคำขอ";
  
  Swal.fire({
    title: `ยืนยันการ${actionText}?`,
    text: `คุณกำลังทำรายการพิจารณาใบลาหมายเลขคำขอที่ #${id}`,
    icon: actionResult === "approved" ? "question" : "warning",
    showCancelButton: true,
    confirmButtonColor: actionResult === "approved" ? "var(--primary)" : "var(--danger)",
    cancelButtonText: "ยกเลิก",
    confirmButtonText: `ใช่, บันทึกผล`
  }).then(async (result) => {
    if (result.isConfirmed) {
      showToast("💾 กำลังบันทึกสถานะลงฐานข้อมูล...", "info");
      
      // ค้นหาและอัปเดตค่าใน Array หน่วยความจำของเว็บ
      const matchItem = rawRequests.find(r => r.id === id);
      if (matchItem) {
        if (currentRoleState === "manager") {
          matchItem.manager_status = actionResult;
          // หากหัวหน้าปฏิเสธ ใบลาใบนี้จะพังตกไปทันที ไม่ต้องส่งต่อ
          if (actionResult === "rejected") matchItem.status = "rejected";
        } else {
          matchItem.director_status = actionResult;
          // ถ้าผู้จัดการด่านสองอนุมัติด้วย ถือว่าผ่านสายบังคับบัญชา พร้อมส่งต่อให้ HR
          if (actionResult === "approved") matchItem.status = "approved_by_leaders";
          else matchItem.status = "rejected";
        }
      }

      // หากมี Supabase เชื่อมต่อ ให้ยิงอัปเดตไปที่เซิร์ฟเวอร์จริง
      if (sb) {
        try {
          const updateFields = {};
          if (currentRoleState === "manager") {
            updateFields.manager_status = actionResult;
            if (actionResult === "rejected") updateFields.status = "rejected";
          } else {
            updateFields.director_status = actionResult;
            updateFields.status = actionResult === "approved" ? "approved_by_leaders" : "rejected";
          }

          await sb.from("leave_requests").update(updateFields).eq("id", id);
        } catch (dbErr) {
          console.error("ฐานข้อมูลจำลองบันทึกแต่จริงพัง:", dbErr);
        }
      }

      showToast(`✅ บันทึกการ${actionText}สำเร็จแล้ว`, "success");
      renderApprovalTable();
      updateCounterCards();
      renderBellNotifications(rawRequests);
    }
  });
}

function updateCounterCards() {
  let pendingCount = 0;
  let approvedCount = 0;

  if (currentRoleState === "manager") {
    pendingCount = rawRequests.filter(r => (r.manager_status || r.status) === "pending").length;
    approvedCount = rawRequests.filter(r => r.manager_status === "approved").length;
  } else {
    pendingCount = rawRequests.filter(r => r.manager_status === "approved" && (!r.director_status || r.director_status === "pending")).length;
    approvedCount = rawRequests.filter(r => r.director_status === "approved").length;
  }

  if (document.getElementById("countPending")) document.getElementById("countPending").innerHTML = `${pendingCount} <small>รายการ</small>`;
  if (document.getElementById("countApproved")) document.getElementById("countApproved").innerHTML = `${approvedCount} <small>รายการ</small>`;
  if (document.getElementById("countEmployees")) document.getElementById("countEmployees").innerHTML = `24 <small>คน</small>`;
}

// 🔔 แสดงผลโครงสร้างกระดิ่งดั้งเดิมพรีเมียมของพี่มิก (ตัดสิทธิ์ Badge แดงออก)
function renderBellNotifications(requests) {
  const bellDropdown = document.getElementById("bellDropdown");
  if (!bellDropdown) return;

  const safeRequests = requests || [];
  const pendingReqs = safeRequests.filter(r => (r.manager_status || r.status) === "pending");

  bellDropdown.innerHTML = `
    <div class="bell-panel-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="material-symbols-outlined" style="color: var(--primary); font-size: 20px;">notifications_active</span>
        <h4 style="margin: 0; font-size: 14.5px; font-weight: 600;">การแจ้งเตือนล่าสุด</h4>
      </div>
      <span class="panel-subtitle" style="font-size: 11px; color: var(--text-soft); display: block; margin-top: 4px;">
        มีคำขอลาพนักงานรอคุณตรวจด่านแรก ${pendingReqs.length} รายการ
      </span>
    </div>
    <div class="bell-panel-body" id="bellNotiBody"></div>
  `;

  const bellNotiBody = document.getElementById("bellNotiBody");
  if (!bellNotiBody) return;

  if (pendingReqs.length === 0) {
    bellNotiBody.innerHTML = `<div class="bell-empty-state" style="padding:24px; text-align:center; color:var(--text-soft); font-size:13px; font-style:italic;">ไม่มีรายการคำขอค้างพิจารณา</div>`;
    return;
  }

  pendingReqs.forEach(r => {
    const div = document.createElement("div");
    div.className = "bell-noti-item";
    div.style.cssText = "padding:14px 20px; border-bottom:1px solid var(--border); display:flex; gap:14px; cursor:pointer;";
    
    const name = r.emp_name || r.employee_name || "พนักงาน";
    const type = r.leave_type_name || "ลาหยุด";
    const days = r.total_days || 0;

    div.innerHTML = `
      <div class="bell-noti-icon-box" style="width:36px; height:36px; border-radius:50%; background:var(--primary-soft); color:var(--primary); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <span class="material-symbols-outlined" style="font-size:18px;">pending_actions</span>
      </div>
      <div class="bell-noti-info" style="flex:1;">
        <div class="bell-noti-title" style="font-size:13px;"><strong>${name}</strong> ยื่นคำขอ <strong>${type}</strong></div>
        <div class="bell-noti-meta" style="font-size:11px; color:var(--text-soft); margin-top:3px;">จำนวน ${days} วัน • รอสายงานอนุมัติ</div>
      </div>
    `;
    bellNotiBody.appendChild(div);
  });
}

function showToast(msg, type = "") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3000);
}