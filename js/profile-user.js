/**
 * profile-user.js — (ฉบับแมตช์ธีม index-user 100%)
 */

document.addEventListener("DOMContentLoaded", loadProfile);

async function loadProfile() {
  const box = document.getElementById("profileBox");
  if (!box) return;

  try {
    let profile = await window.pvtSupabase?.getCurrentProfile();
    
    // [DEV MODE FALLBACK] ดักจับกรณีทดสอบเหมือนหน้าหลัก
    // 🌟 เปลี่ยนท่อนเช็กเซสชันจำลองใน index-user.js ให้บังคับใช้ไอดีจริงที่มีข้อมูลในตาราง leave_balances
if (!currentProfile || !currentProfile.employee_id) {
  console.log("🛠️ [DASHBOARD] ไม่พบ Profile ตรง กำลังใช้เซสชันจำลอง...");
  
  // 💡 เอาไอดีจริงจากตาราง employees/leave_balances ใน Supabase ของพี่มิกมาใส่ตรงนี้แทนเลข 1 ครับ
  const myRealUUID = "9a8036a8-3b03-4802-9520-59934fe621e3"; 

  let cachedUser = {
    id: myRealUUID, 
    employee_code: "EMP-009",
    full_name: "คุณมิกกี้ (IT Management)",
    department_name: "Information Technology",
    position_name: "IT Infrastructure Manager"
  };
  sessionStorage.setItem("currentUser", JSON.stringify(cachedUser));
  
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

    const employee = profile?.employees;
    const deptName = employee?.departments?.department_name || employee?.department_name || "ทั่วไป";
    const posName = employee?.positions?.position_name || employee?.position_name || "ทั่วไป";

    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => str || "-");
    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => dateStr || "-");

    // 🌟 พ่นโครงสร้าง HTML โดยเลียนแบบกล่อง recent-item จากหน้าหลัก
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

    console.log("✅ [SUCCESS] แปลงดีไซน์หน้าประวัติเข้าธีมหน้าหลักสำเร็จ!");

  } catch (error) {
    console.error("❌ Error loading profile page:", error);
    box.innerHTML = `<div class="empty-state" style="color: red;">เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์</div>`;
  }
}