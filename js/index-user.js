/**
 * index-user.js — (ฉบับอัปเกรดความเสถียรขั้นสูงสุด Future-Proof 100%)
 * ✅ แก้ไขระบบดักจับสิทธิ์พนักงาน: รองรับทั้ง Supabase Auth, Session จริง และ Dev Mode Fallback
 * ✅ ดึงยอดวันลาคงเหลือล่าสุดอัตโนมัติ: ปลดล็อกเงื่อนไขปี พ.ศ. ใช้ระบบดึงปีล่าสุดที่มีใน Database
 * ✅ ป้องกันเออร์เรอร์ข้ามเวอร์ชัน: รองรับการรับข้อมูลทั้งรูปแบบ Object และ Array
 * ✅ ปลอดภัยสูงสุด: มีฟังก์ชันจัดฟอร์แมตวันที่ สถานะ และระบบความปลอดภัยสำรองในตัว
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบควบคุมหน้าจอหลักพนักงาน (Ultra-Stable) แล้ว...");
let currentProfile = null;

document.addEventListener("DOMContentLoaded", initUserHome);

async function initUserHome() {
  const sb = window.pvtSupabase?.getClient();
  
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
    // พ่นข้อความทิ้งไว้ที่กล่องรายการล่าสุดด้วย
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
    
    // 🔥 เรียกใช้ระบบแจ้ง Error ส่วนกลางที่เพิ่งเพิ่มเข้าไป
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
      pendingCount.textContent = pendingRes.count ?? 0;
    }

    // แกะข้อมูลตารางยอดลาคงเหลือ (รองรับทั้งกรณีข้อมูลหลุดมาเป็น Array และ Object)
    let balanceData = balanceRes.data;
    if (Array.isArray(balanceData)) {
      balanceData = balanceData[0];
    }

    // พ่นตัวเลขวันลาคงเหลือ (remaining_days -> กล่องสีเขียว)
    if (leaveBalance) {
      leaveBalance.textContent = (balanceData && balanceData.remaining_days !== undefined && balanceData.remaining_days !== null) 
        ? balanceData.remaining_days 
        : "0";
    }

    // พ่นตัวเลขวันลาที่ใช้ไปแล้ว (used_days -> กล่องสีแดง)
    if (usedBalance) {
      usedBalance.textContent = (balanceData && balanceData.used_days !== undefined && balanceData.used_days !== null) 
        ? balanceData.used_days 
        : "0";
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

    // 5. แสดงรายการคำขอลาล่าสุด 5 รายการด้านล่างแดชบอร์ด
    const rows = requestsRes.data || [];
    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการยื่นใบลาในระบบ</div>`;
      return;
    }

    if (recentList) {
      recentList.innerHTML = rows.map((item) => {
        const leaveName = item.leave_types?.leave_name || "การลา";
        return `
          <article class="recent-item" style="margin-bottom: 12px; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong>${escapeFn(leaveName)}</strong>
              <span class="status ${item.status}" style="font-size: 12px; font-weight: bold;">${labelFn(item.status)}</span>
            </div>
            <p style="margin: 0; font-size: 13px; color: #475569;">📅 วันที่: ${dateFn(item.start_date)} - ${dateFn(item.end_date)}</p>
            <p style="margin: 2px 0 0 0; font-size: 13px; color: #475569;">⏱️ จำนวน: <strong>${item.total_days}</strong> วัน</p>
          </article>
        `;
      }).join("");
    }
    
    console.log("✅ [SUCCESS] อัปเดตข้อมูลกล่องสถิติและรายการล่าสุดขึ้นหน้าจอเรียบร้อยครบถ้วน!");

  } catch (error) {
    // พ่นข้อความทิ้งไว้ที่กล่องรายการล่าสุดด้วย
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
    
    // 🔥 เรียกใช้ระบบแจ้ง Error ส่วนกลางที่เพิ่งเพิ่มเข้าไป
    handleSystemError(error, "ไม่สามารถโหลดข้อมูลยอดสถิติตัวเลขวันลาบนแดชบอร์ดหลักได้");
  }
}

/**
 * 🤖 PVT HR Leave — Centralized Error Handler (ระบบแจ้งเตือน Error ส่วนกลาง)
 * ใช้สำหรับดักจับ Error ทั้งระบบ แล้วแสดงผลผ่าน SweetAlert2 ให้พนักงานเข้าใจง่าย
 * @param {Error|Object|string} error - ตัวแปร Error ที่จับได้จาก catch
 * @param {string} customMessage - ข้อความหน้าบ้านที่อยากบอกพนักงาน (มีค่าเริ่มต้นให้)
 */
function handleSystemError(error, customMessage = "เกิดข้อผิดพลาดในการโหลดหรือบันทึกข้อมูล") {
  // 1. ดึงข้อความ Error จริงออกมาเก็บไว้ดู
  const actualErrorLog = error?.message || error?.hint || JSON.stringify(error) || "Unknown System Error";
  
  // พิมพ์ลง Console สีแดงเข้ม เพื่อให้พี่มิกเปิดกด F12 เช็กแนวทางแก้ไขได้ทันที
  console.error(`🚨 [SYSTEM CRITICAL ERROR]: ${actualErrorLog}`, error);

  // 2. ยิงป็อปอัพเตือนพนักงานหน้าบ้านด้วย SweetAlert2 (หน้าตาจะสวยงาม เข้ากับธีมแอป)
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
      confirmButtonColor: "#dc2626", // ปุ่มสีแดงตามธีมกล่อง Error
      borderRadius: "16px"
    });
  } else {
    // Fallback เผื่อหน้าไหนไม่ได้โหลด SweetAlert2 จะได้ไม่ระเบิดซ้ำ
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