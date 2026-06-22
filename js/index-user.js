let currentProfile = null;

document.addEventListener("DOMContentLoaded", initUserHome);

async function initUserHome() {
  currentProfile = await window.pvtSupabase?.getCurrentProfile();
  renderUserInfo(currentProfile);
  await loadRecentLeaves(currentProfile);
}

// อัปเดตเพื่อแสดงข้อมูลและฝ่ายพนักงานอัตโนมัติบนหน้าแรก
function renderUserInfo(profile) {
  const employee = profile?.employees;
  
  // 🤖 แสดงชื่อ-สกุลอัตโนมัติ
  document.getElementById("userName").textContent =
    employee?.full_name || profile?.display_name || "พนักงาน";
    
  // 🤖 ดึงชื่อฝ่าย/แผนกมาแสดงอัตโนมัติ
  const deptName = employee?.departments?.department_name || "ทั่วไป";
  const empCode = employee?.employee_code ? `รหัส: ${employee.employee_code}` : "";
  document.getElementById("userDepartment").textContent = `${deptName} ${empCode}`;
}

// ดึงยอดคำขอลาและค้นหายอดคงเหลือพักผ่อนจากตาราง leave_balances
// อัปเดตฟังก์ชันนี้ในไฟล์ index-user.js เพื่อดึงยอดโควตาลาจริงมาแสดง
// 📌 ฟังก์ชันเวอร์ชันสมบูรณ์ มัดรวมระบบดึงค่าคงเหลือ (remaining_days) และใช้ไปแล้ว (used_days)
async function loadRecentLeaves(profile) {
  // 1. ชี้เป้าไปที่ ID ของกล่องต่าง ๆ ในหน้า HTML
  const recentList = document.getElementById("recentList");
  const pendingCount = document.getElementById("pendingCount");
  const leaveBalance = document.getElementById("leaveBalance"); // แมตช์กับกล่องวันลาคงเหลือ
  const usedBalance = document.getElementById("usedBalance");   // แมตช์กับกล่องใช้ไปแล้วที่เพิ่มใหม่
  
  const sb = window.pvtSupabase?.getClient();
  const employeeId = profile?.employee_id;

  if (!sb || !employeeId) {
    if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลผู้ใช้ หรือยังไม่ได้เข้าสู่ระบบ</div>`;
    return;
  }

  try {
    // คำนวณปี พ.ศ. ปัจจุบัน (ปี ค.ศ. + 543)
    const currentYear = new Date().getFullYear() + 543;

    // 2. ยิงไปดึงข้อมูลจาก Supabase พร้อมกันทีเดียว
    const [requestsRes, pendingRes, balanceRes] = await Promise.all([
      sb.from("leave_requests").select("id, start_date, end_date, total_days, status, leave_types(leave_name)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(5),
      sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "pending"),
      sb.from("leave_balances").select("remaining_days, used_days").eq("employee_id", employeeId).eq("year", currentYear).maybeSingle()
    ]);

    if (requestsRes.error) throw requestsRes.error;

    // 3. โซนพ่นตัวเลขลงกล่อง HTML (ใส่ดักไว้ให้ครบถ้วนแล้วครับพี่)
    
    // พ่นตัวเลขรายการรออนุมัติ
    if (pendingCount) {
      pendingCount.textContent = pendingRes.count ?? 0;
    }

    // พ่นตัวเลขวันลาคงเหลือ (remaining_days)
    if (leaveBalance) {
      leaveBalance.textContent = balanceRes.data ? balanceRes.data.remaining_days : 0;
    }

    // พ่นตัวเลขวันลาที่ใช้ไปแล้ว (used_days) -> ตัวนี้จะวิ่งเข้ากล่องสีแดงที่พี่เพิ่งเพิ่มใน Grid ครับ!
    if (usedBalance) {
      usedBalance.textContent = balanceRes.data ? balanceRes.data.used_days : 0;
    }

    // 4. แสดงรายการคำขอลาล่าสุด 5 รายการด้านล่างแดชบอร์ด
    const rows = requestsRes.data || [];
    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการลา</div>`;
      return;
    }

    if (recentList) {
      recentList.innerHTML = rows.map((item) => `
        <article class="recent-item">
          <strong>${window.pvtSupabase.escapeHtml(item.leave_types?.leave_name || "การลา")}</strong>
          <p>${window.pvtSupabase.formatThaiDate(item.start_date)} - ${window.pvtSupabase.formatThaiDate(item.end_date)} · ${item.total_days} วัน</p>
          <span class="status ${item.status}">${window.pvtSupabase.statusLabel(item.status)}</span>
        </article>
      `).join("");
    }
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    if (recentList) recentList.innerHTML = `<div class="empty-state">โหลดข้อมูลไม่สำเร็จ: ${window.pvtSupabase.escapeHtml(error.message)}</div>`;
  }
}
function goToLeaveForm() {
  window.location.href = "/pages/user/leave-user.html";
}

function goToRules() {
  window.location.href = "/pages/user/leave-rules.html";
}

function goToLeaveHistory() {
  window.location.href = "/pages/user/leave-history.html";
}

function goToProfile() {
  window.location.href = "/pages/user/profile-user.html";
}

function goToContactHR() {
  window.location.href = "/pages/user/contact-hr.html";
}

async function logoutUser() {
  const confirmLogout = confirm("ต้องการออกจากระบบใช่ไหม?");
  if (!confirmLogout) return;
  const sb = window.pvtSupabase?.getClient();
  await sb?.auth.signOut();
  window.location.href = "/login.html";
}
