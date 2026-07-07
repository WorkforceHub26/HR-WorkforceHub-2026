/**
 * index-user.js — (ฉบับเสถียรขั้นสูงสุด + รองรับหน้าจอ Responsive 100%)
 * ✅ ลอจิกหลังบ้านเดิมอยู่ครบถ้วน ไม่ว่าจะเป็น Supabase Auth, Session จริง และ Dev Mode Fallback
 * ✅ แก้ไข Bug ปีกกาเกินที่ท้ายไฟล์ และแก้สโคปตัวแปร recentList ในกล่อง Catch เรียบร้อย
 * ✅ ปรับแต่ง HTML Template ของรายการล่าสุดให้สวยงาม เข้ากับธีมใหม่แบบไร้รอยต่อ
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบควบคุมหน้าจอหลักพนักงาน (Responsive Optimized) แล้ว...");
let currentProfile = null;

document.addEventListener("DOMContentLoaded", initUserHome);

async function initUserHome() {
  try {
    // 1. พยายามดึงข้อมูล Profile จริงจากระบบ Supabase เป็นอันดับแรก
    currentProfile = await window.pvtSupabase?.getCurrentProfile();
    
    // 🌟 [STRATEGIC FALLBACK] ถ้าสิทธิ์จากเบสยังไม่มา ให้ตรวจสอบและดึงเซสชันพนักงานมาใช้งาน
    if (!currentProfile || !currentProfile.employee_id) {
      console.log("🛠️ [DASHBOARD] ไม่พบ Profile ตรงจาก Auth กำลังเช็กระบบ Session สำรอง...");
      
      let cachedUser = null;
      try {
        cachedUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
      } catch (e) {
        console.error("⚠️ อ่านค่า sessionStorage ล้มเหลว:", e);
      }

      // ถ้าไม่มีข้อมูลใน Session เลย (เช่น เปิดคอมมาใหม่ในโหมด Dev) ให้เซ็ตค่าเริ่มต้นพนักงานทดสอบ
      if (!cachedUser || !cachedUser.id) {
        cachedUser = {
          id: "9a8036a8-3b03-4802-9520-59934fe621e3", // รหัส UUID ของพี่มิกในตาราง employees
          employee_code: "EMP-009",
          full_name: "คุณมิกกี้ (IT Management)",
          department_name: "Information Technology",
          position_name: "IT Infrastructure Manager"
        };
        sessionStorage.setItem("currentUser", JSON.stringify(cachedUser));
      }
      
      // แปลงโครงสร้างจำลองให้เข้าล็อกกับระบบประมวลผลของหน้าจอ Dashboard หลัก
      currentProfile = {
        employee_id: cachedUser.id,
        display_name: cachedUser.full_name,
        employees: {
          id: cachedUser.id,
          employee_code: cachedUser.employee_code,
          full_name: cachedUser.full_name,
          department_name: cachedUser.department_name,
          position_name: cachedUser.position_name
        }
      };
    }

    console.log("📋 ตรวจสอบข้อมูลสิทธิ์เข้าใช้งานสำเร็จ:", currentProfile);
    
    // 2. สั่งพ่นข้อมูลขึ้นจอภาพ และคำนวณสถิติใบลาทั้งหมดเข้ากล่อง Grid
    renderUserInfo(currentProfile);
    await loadRecentLeaves(currentProfile);

  } catch (error) {
    // ดึงตัวแปรมาพ่นข้อความกรณี Error เบื้องต้นก่อนเรียกใช้งานระบบส่วนกลาง
    const recentList = document.getElementById("recentList");
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
    
    // 🔥 เรียกใช้ระบบแจ้ง Error ส่วนกลาง
    handleSystemError(error, "ไม่สามารถโหลดข้อมูลยอดสถิติตัวเลขวันลาบนแดชบอร์ดหลักได้");
  }
}

// ─── ฟังก์ชันพ่นข้อมูลพนักงานและชื่อฝ่าย/แผนก/ตำแหน่ง ───
function renderUserInfo(profile) {
  const employee = profile?.employees;
  
  // 🤖 แสดงชื่อ-สกุลพนักงาน
  const nameEl = document.getElementById("userName");
  if (nameEl) {
    nameEl.textContent = employee?.full_name || profile?.display_name || "พนักงานในระบบ";
  }
    
  // 🤖 ดึงชื่อฝ่าย/แผนก และ รหัสพนักงานมาแสดงคู่กันแบบอัตโนมัติ
  const deptName = employee?.departments?.department_name || employee?.department_name || "ทั่วไป";
  const empCode = employee?.employee_code ? `รหัส: ${employee.employee_code}` : "";
  
  const deptEl = document.getElementById("userDepartment");
  if (deptEl) {
    deptEl.textContent = `${deptName} ${empCode}`;
  }
}

// ─── ฟังก์ชันโหลดข้อมูลสถิติตัวเลข + รายการคำขอลาล่าสุด 5 รายการ ───
async function loadRecentLeaves(profile) {
  const recentList = document.getElementById("recentList");
  const pendingCount = document.getElementById("pendingCount");
  const leaveBalance = document.getElementById("leaveBalance"); 
  const usedBalance = document.getElementById("usedBalance");  
  
  const sb = window.pvtSupabase?.getClient();
  const employeeId = profile?.employee_id;

  if (!sb || !employeeId) {
    if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลผู้ใช้ หรือยังไม่ได้เข้าสู่ระบบ</div>`;
    return;
  }

  try {
    console.log(`⏳ [FETCH DATA] กำลังดึงสถิติและโควตาจากฐานข้อมูลของพนักงาน: ${employeeId}`);

    // 2. ดึงข้อมูลขนานพร้อมกัน 3 ตารางเพื่อความเร็วระดับสูงสุด
    const [requestsRes, pendingRes, balanceRes] = await Promise.all([
      sb.from("leave_requests").select("id, start_date, end_date, total_days, status, leave_types(leave_name)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(5),
      sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "pending"),
      sb.from("leave_balances").select("remaining_days, used_days, year").eq("employee_id", employeeId).order("year", { ascending: false }).maybeSingle()
    ]);

    if (requestsRes.error) throw requestsRes.error;
    if (balanceRes.error) console.error("⚠️ คำเตือนระบบตารางยอดลา:", balanceRes.error.message);

    // 3. โซนพ่นตัวเลขลงกล่องสถิติ (พร้อมระบบตรวจสอบความปลอดภัยของโครงสร้างข้อมูล)
    
    // พ่นตัวเลขรายการรออนุมัติ (กล่องสีเหลือง)
    if (pendingCount) {
      pendingCount.innerHTML = `${pendingRes.count ?? 0} <small>รายการ</small>`;
    }

    // แกะข้อมูลตารางยอดลาคงเหลือ (รองรับทั้งกรณีข้อมูลหลุดมาเป็น Array และ Object)
    let balanceData = balanceRes.data;
    if (Array.isArray(balanceData)) {
      balanceData = balanceData[0];
    }

    // พ่นตัวเลขวันลาคงเหลือ (remaining_days -> กล่องสีเขียว)
    if (leaveBalance) {
      const remVal = (balanceData && balanceData.remaining_days !== undefined && balanceData.remaining_days !== null) ? balanceData.remaining_days : "0";
      leaveBalance.innerHTML = `${remVal} <small>วัน</small>`;
    }

    // พ่นตัวเลขวันลาที่ใช้ไปแล้ว (used_days -> กล่องสีแดง)
    if (usedBalance) {
      const usedVal = (balanceData && balanceData.used_days !== undefined && balanceData.used_days !== null) ? balanceData.used_days : "0";
      usedBalance.innerHTML = `${usedVal} <small>วัน</small>`;
    }

    // 4. จัดเตรียมฟังก์ชันช่วยฟอร์แมตข้อมูล (พร้อมระบบสำรองกรณีไฟล์แชร์ส่วนกลางไม่ทำงาน)
    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => {
      if (!str) return "";
      return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    });

    const labelFn = window.pvtSupabase?.statusLabel || ((status) => {
      const mapper = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" };
      return mapper[status] || status;
    });

    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => {
      if (!dateStr) return "-";
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
      } catch (e) {
        return dateStr;
      }
    });

    // 5. แสดงรายการคำขอลาล่าสุด 5 รายการด้านล่างแดชบอร์ด (ปรับดีไซน์ CSS Inline ให้โมเดิร์นรับกับหน้าจอ)
    const rows = requestsRes.data || [];
    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการยื่นใบลาในระบบ</div>`;
      return;
    }

    if (recentList) {
      recentList.innerHTML = rows.map((item) => {
        const leaveName = item.leave_types?.leave_name || "การลา";
        
        // จัดการสีป้ายสถานะให้สวยงามพรีเมียมตามธีมหลัก
        let badgeStyle = "background:#fff3cd; color:#854d0e; border:1px solid #fde047;"; // pending
        if (item.status === "approved") {
          badgeStyle = "background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;";
        } else if (item.status === "rejected") {
          badgeStyle = "background:#f8d7da; color:#842029; border:1px solid #f5c2c7;";
        }

        return `
          <article class="recent-item" style="margin-bottom: 12px; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.01);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 15px; color: #0f172a;">${escapeFn(leaveName)}</strong>
              <span class="status ${item.status}" style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; ${badgeStyle}">${labelFn(item.status)}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: #64748b;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>📅 วันที่:</span> 
                <span style="color: #334155; font-weight: 500;">${dateFn(item.start_date)} - ${dateFn(item.end_date)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>⏱️ จำนวน:</span> 
                <span style="color: #0fa472; font-weight: 600;">${item.total_days} วัน</span>
              </div>
            </div>
          </article>
        `;
      }).join("");
    }
    
    console.log("✅ [SUCCESS] อัปเดตข้อมูลกล่องสถิติและรายการล่าสุดขึ้นหน้าจอเรียบร้อยครบถ้วน!");

  } catch (error) {
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
    handleSystemError(error, "ไม่สามารถโหลดข้อมูลยอดสถิติตัวเลขวันลาบนแดชบอร์ดหลักได้");
  }
}

/**
 * 🤖 PVT HR Leave — Centralized Error Handler (ระบบแจ้งเตือน Error ส่วนกลาง)
 * ใช้สำหรับดักจับ Error ทั้งระบบ แล้วแสดงผลผ่าน SweetAlert2 ให้พนักงานเข้าใจง่าย
 */
function handleSystemError(error, customMessage = "เกิดข้อผิดพลาดในการโหลดหรือบันทึกข้อมูล") {
  const actualErrorLog = error?.message || error?.hint || JSON.stringify(error) || "Unknown System Error";
  console.error(`🚨 [SYSTEM CRITICAL ERROR]: ${actualErrorLog}`, error);

  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: "error",
      title: "ระบบขัดข้องชั่วคราว",
      html: `
        <div style="text-align: left; font-family: 'Kanit', sans-serif;">
          <p style="margin-bottom: 8px; color: #334155;"><b>รายละเอียด:</b> ${customMessage}</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 12px; color: #ef4444; overflow-x: auto; font-family: monospace; max-height: 100px;">
            Code: ${actualErrorLog}
          </div>
          <p style="margin-top: 10px; font-size: 13px; color: #64748b; text-align: center;">💡 แนะนำให้ลอง Refresh หน้าจอ หรือติดต่อ IT (พี่มิก) ครับ</p>
        </div>
      `,
      confirmButtonText: "รับทราบ",
      confirmButtonColor: "#dc2626",
      borderRadius: "16px"
    });
  } else {
    alert(`❌ ${customMessage}\n\n(รายละเอียด: ${actualErrorLog})`);
  }
}

// ─── โซนฟังก์ชันจัดการเส้นทางปุ่มกดลิงก์ต่าง ๆ ───
function goToLeaveForm() {
  window.location.href = "/pages/user/leave-user.html";
}

function goToRules() {
  window.location.href = "/pages/user/leave-rules.html";
}

// ลิงก์ตรงเข้าหน้าประวัติ
function goToLeaveHistory() {
  window.location.href = "/pages/user/leave-history.html";
}

function goToProfile() {
  window.location.href = "/pages/user/profile-user.html";
}

function goToContactHR() {
  window.location.href = "/pages/user/contact-hr.html";
}

// ฟังก์ชันออกจากระบบ ล้างเซสชันเคลียร์ข้อมูลพนักงาน
function logout() {
  sessionStorage.removeItem("currentUser");
  window.location.href = "/login.html";
}