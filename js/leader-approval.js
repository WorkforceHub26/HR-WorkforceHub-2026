/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - LEADER & MANAGER APPROVAL ENGINE
 * ==========================================================================
 */

let sb = null;
let rawRequests = [];
let currentRoleState = "manager"; // 'manager' = หัวหน้าแผนก, 'director' = ผู้จัดการฝ่าย
let toastTimer = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 [System]: เริ่มต้นระบบพิจารณาใบลา");
  
  setupSidebarToggle();
  initializeSupabaseConnection();
  setupBellNotificationToggle();
  
  await fetchLeaveRequestsData();
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
  // ดึงท่อเชื่อมต่อหลักที่สร้างเสร็จแล้วจากโครงสร้างระบบมาใช้งานโดยตรง
  if (window.supabaseClient) {
    sb = window.supabaseClient;
    console.log("🔌 เชื่อมต่อ Supabase ผ่าน window.supabaseClient สำเร็จ");
  } else if (typeof supabase !== "undefined" && typeof SUPABASE_URL !== "undefined") {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("🔌 สร้าง Instance ของ Supabase ใหม่สำเร็จ");
  } else {
    console.warn("⚠️ ไม่พบระบบฐานข้อมูล เข้าสู่โหมดจำลอง");
  }
}

function setupBellNotificationToggle() {
  const bellTrigger = document.getElementById("bellTrigger");
  const bellDropdown = document.getElementById("bellDropdown");
  const bellBadge = document.getElementById("bellBadge");

  if (bellBadge) bellBadge.style.display = "none"; // ซ่อนตัวเลขแจ้งเตือนตามบรีฟ

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

// 📡 ฟังก์ชันดึงข้อมูลใบลาพ่วงชื่อพนักงาน (Relation Join)
async function fetchLeaveRequestsData() {
  try {
    const tableBody = document.getElementById("tableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-soft);">กำลังโหลดข้อมูลใบลาจากระบบ...</td></tr>`;
    }
    
    if (!sb) {
      generateMockData();
      return;
    }

    // สั่งดึงข้อมูลใบลาพ่วงกับชื่อพนักงานจากตาราง employees ผ่านความสัมพันธ์ของ employee_id
    let query = sb.from('leave_requests').select(`
      *,
      employees:employee_id (
        full_name
      )
    `);

    // 🔀 คัดกรองแยกสถานะตามสิทธิ์ด่านการทำงานจริงบนหน้าจอ
    if (currentRoleState === "manager") {
      // หัวหน้าแผนก: ดึงใบลาที่รอการตรวจ และตัวหัวหน้าเองยังค้างพิจารณา
      query = query.eq('status', 'pending').eq('manager_status', 'pending');
    } else {
      // ผู้จัดการฝ่าย: ดึงใบลาที่ส่งต่อมาจากการอนุมัติด่านแรก และผู้จัดการยังไม่ได้ตรวจ
      query = query.eq('status', 'pending_director').eq('director_status', 'pending');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    
    rawRequests = data || [];
    renderApprovalTable();
    updateCounterCards();
    renderBellNotifications(rawRequests);
    
  } catch (err) {
    console.error("❌ ข้อผิดพลาดในการดาวน์โหลดข้อมูลแบบละเอียด:", err);
    showToast("❌ ไม่สามารถโหลดข้อมูลใบลาได้", "danger");
  }
}
// 🔄 ฟังก์ชันสลับมุมมองสิทธิ์ที่แก้ไขแก้ไขบั๊กแท็ก <a> เรียบร้อยแล้ว
function switchRoleView(role) {
  currentRoleState = role;
  
  const pageHeading = document.getElementById("pageMainHeading");
  if (pageHeading) {
    pageHeading.textContent = role === 'manager' 
      ? "ระบบอนุมัติใบลา (ระดับหัวหน้าแผนก)" 
      : "ระบบอนุมัติใบลา (ระดับผู้จัดการฝ่าย)";
  }

  // ✨ เจาะจงดึงเฉพาะแท็ก button ที่มีคลาส .nav-item เท่านั้น (ไม่ยุ่งกับแท็ก <a> ปุ่มย้อนกลับ)
  const navButtons = document.querySelectorAll('button.nav-item');
  
  navButtons.forEach(btn => {
    // ถอดสีเขียวไฮไลท์ออกจากปุ่มอื่นก่อน
    btn.classList.remove('active');
    
    // ตรวจสอบความปลอดภัย: ป้องกันค่า null/undefined ของ attribute 'onclick'
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes(role)) {
      btn.classList.add('active');
    }
  });

  console.log(`🔄 สลับโหมดการทำงานและเคลียร์คิวเป็น: ${role}`);
  
  // เรียกโหลดข้อมูลตารางใหม่ให้สัมพันธ์กับสิทธิ์ที่เลือก
  fetchLeaveRequestsData();
}
// 📝 ฟังก์ชันเรนเดอร์ข้อมูลลงตาราง (อัปเดตดึงชื่อพนักงานจริงเรียบร้อย)
function renderApprovalTable() {
  const tBody = document.getElementById("tableBody");
  const tTitle = document.getElementById("tableTitle");
  if (!tBody) return;

  tBody.innerHTML = "";
  
  if (currentRoleState === "manager") {
    tTitle.textContent = "รายการใบลาที่รอหัวหน้าแผนกตรวจสอบ (ด่านที่ 1)";
  } else {
    tTitle.textContent = "รายการใบลาที่รอผู้จัดการฝ่ายตรวจสอบ (ด่านที่ 2)";
  }

  if (!rawRequests || rawRequests.length === 0) {
    tBody.innerHTML = `<tr><td colspan="6" style="padding: 40px; text-align: center; color: var(--text-soft); font-style: italic;">ไม่มีรายการคำขอลาค้างพิจารณาในระบบ ✨</td></tr>`;
    return;
  }

  rawRequests.forEach(item => {
    const tr = document.createElement("tr");
    
    // ✨ แมปชื่อจริงของพนักงานมาใช้งาน ถ้าไม่มีให้ใช้รหัสย่อป้องกันระบบค้าง
    const name = item.employees?.full_name || `พนักงานรหัส (${item.employee_id?.substring(0,8)})`;
    const dept = "แผนกในสังกัด"; 
    const type = "ใบลาหยุดงาน";
    const days = item.total_days || 0;
    const reason = item.reason || "ไม่ระบุเหตุผล";

    tr.innerHTML = `
      <td style="font-weight:600;">${name}</td>
      <td>${dept}</td>
      <td><span style="background:#f1f5f9; padding:4px 10px; border-radius:6px; font-size:13px;">${type}</span></td>
      <td style="font-weight:700; color:var(--primary);">${days} วัน</td>
      <td style="max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reason}">${reason}</td>
      <td>
        <div class="btn-action-group">
          <button class="btn-approve" onclick="processLeaveAction('${item.id}', 'approved', '${name}')">
            <span class="material-symbols-outlined" style="font-size:16px;">check_circle</span>อนุมัติ
          </button>
          <button class="btn-reject" onclick="processLeaveAction('${item.id}', 'rejected', '${name}')">
            <span class="material-symbols-outlined" style="font-size:16px;">cancel</span>ปฏิเสธ
          </button>
        </div>
      </td>
    `;
    tBody.appendChild(tr);
  });
}

// 💾 ฟังก์ชันส่งผลพิจารณากลับฐานข้อมูล (แก้บั๊กโคลสลูปเรียบร้อย)
async function processLeaveAction(id, actionResult, empName = "พนักงาน") {
  const isApprove = actionResult === "approved";
  const actionText = isApprove ? "อนุมัติ" : "ปฏิเสธคำขอ";
  
  Swal.fire({
    title: `ยืนยันการ${actionText}?`,
    text: `คุณกำลังทำรายการพิจารณาใบลาของ: ${empName}`, 
    icon: isApprove ? "question" : "warning",
    showCancelButton: true,
    confirmButtonColor: isApprove ? "#0fa472" : "#ef4444",
    cancelButtonText: "ยกเลิก",
    confirmButtonText: `ยืนยัน`
  }).then(async (result) => {
    if (result.isConfirmed) {
      showToast("💾 กำลังบันทึกข้อมูล...", "info");
      
      let updateFields = {};
      
      if (currentRoleState === "manager") {
        updateFields = isApprove 
          ? { manager_status: 'approved', status: 'pending_director' }
          : { manager_status: 'rejected', status: 'rejected' };
      } else {
        updateFields = isApprove 
          ? { director_status: 'approved', status: 'approved_by_leaders' }
          : { director_status: 'rejected', status: 'rejected' };
      }

      try {
        const { error } = await sb.from("leave_requests").update(updateFields).eq("id", id);
        if (error) throw error;
        
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ!',
          text: 'ระบบได้อัปเดตข้อมูลและปรับคิวรายการเรียบร้อยแล้ว',
          confirmButtonColor: '#0fa472'
        });
        
        // โหลดข้อมูลบนหน้าจอใหม่ทันทีแบบปลอดภัย 100%
        await fetchLeaveRequestsData();
        
      } catch (dbErr) {
        console.error("❌ บันทึกไม่สำเร็จ:", dbErr);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้', 'error');
      }
    }
  });
}

function updateCounterCards() {
  let count = Array.isArray(rawRequests) ? rawRequests.length : 0;
  const pendingEl = document.getElementById("countPending");
  if (pendingEl) {
    pendingEl.innerHTML = `${count} <small>รายการ</small>`;
  }
}

function renderBellNotifications(requests) {
  const bellDropdown = document.getElementById("bellDropdown");
  if (!bellDropdown) return;
  const count = Array.isArray(requests) ? requests.length : 0;
  bellDropdown.innerHTML = `
    <div class="bell-panel-header" style="padding:15px;">
      <h4 style="margin:0; font-size:14px;">🔔 คำขอค้างพิจารณา (${count})</h4>
    </div>
  `;
}

function generateMockData() {
  rawRequests = [];
  renderApprovalTable();
  updateCounterCards();
}

function showToast(msg, type = "") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3000);
}