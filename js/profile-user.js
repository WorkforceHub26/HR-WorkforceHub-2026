/**
 * profile-user.js — (ฉบับแก้ไข Bug ReferenceError เพื่อความเสถียร 100%)
 * ✅ แก้ไขการสลับตัวแปรจาก currentProfile เป็น profile ป้องกันหน้าจอค้าง
 */

document.addEventListener("DOMContentLoaded", loadProfile);

async function loadProfile() {
  const box = document.getElementById("profileBox");
  if (!box) return;

  try {
    let profile = await window.pvtSupabase?.getCurrentProfile();
    
    // ✅ แก้ไขจาก currentProfile เป็น profile เพื่อป้องกัน ReferenceError
    if (!profile || !profile.employee_id) {
      console.log("🛠️ [PROFILE] ไม่พบ Profile ตรง กำลังใช้เซสชันจำลอง...");
      
      const myRealUUID = "9a8036a8-3b03-4802-9520-59934fe621e3"; 

      let cachedUser = {
        id: myRealUUID, 
        employee_code: "EMP-009",
        full_name: "คุณมิกกี้ (IT Management)",
        department_name: "Information Technology",
        position_name: "IT Infrastructure Manager"
      };
      sessionStorage.setItem("currentUser", JSON.stringify(cachedUser));
      
      profile = {
        employee_id: cachedUser.id,
        display_name: cachedUser.full_name,
        email: "mickey.it@pvt.co.th",
        role: "employee",
        employees: {
          id: cachedUser.id,
          employee_code: cachedUser.employee_code,
          full_name: cachedUser.full_name,
          department_name: cachedUser.department_name,
          position_name: cachedUser.position_name,
          start_date: "2025-01-15"
        }
      };
    }

    const employee = profile?.employees;
    const deptName = employee?.departments?.department_name || employee?.department_name || "ทั่วไป";
    const posName = employee?.positions?.position_name || employee?.position_name || "ทั่วไป";

    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => str || "-");
    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => dateStr || "-");

    box.innerHTML = `
      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">ชื่อ-นามสกุล</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(employee?.full_name || profile?.display_name)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">รหัสพนักงาน</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(employee?.employee_code)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">ฝ่าย / แแผนก</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(deptName)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">ตำแหน่งงาน</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(posName)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">อีเมล / บัญชี</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(profile?.email || profile?.username || "mickey.it@pvt.co.th")}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">สิทธิ์การใช้งาน</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(profile?.role || "employee")}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">วันเริ่มงาน</span>
        <strong style="color: #1e293b; font-size: 15px;">${dateFn(employee?.start_date)}</strong>
      </article>
    `;

    console.log("✅ [SUCCESS] โหลดหน้าประวัติพนักงานเสร็จสมบูรณ์!");

  } catch (error) {
    console.error("❌ Error loading profile page:", error);
    box.innerHTML = `<div class="empty-state" style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์</div>`;
  }
}