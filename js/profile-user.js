document.addEventListener("DOMContentLoaded", loadProfile);

async function loadProfile() {
  const box = document.getElementById("profileBox");
  const profile = await window.pvtSupabase?.getCurrentProfile();
  const employee = profile?.employees;

  if (!profile) {
    box.innerHTML = `<div class="empty-state">กรุณาเข้าสู่ระบบเพื่อดูข้อมูลพนักงาน</div>`;
    return;
  }

  // 🤖 ดึงข้อมูลแผนกและตำแหน่งงานที่ผูกเชื่อมโยงกันมาจากตารางอื่นอัตโนมัติ
  const deptName = employee?.departments?.department_name || "ทั่วไป";
  const posName = employee?.positions?.position_name || "ทั่วไป";

  box.innerHTML = `
    <div class="profile-row"><span>ชื่อ-นามสกุล</span><strong>${window.pvtSupabase.escapeHtml(employee?.full_name || profile.display_name || "-")}</strong></div>
    <div class="profile-row"><span>รหัสพนักงาน</span><strong>${window.pvtSupabase.escapeHtml(employee?.employee_code || "-")}</strong></div>
    <div class="profile-row"><span>ฝ่าย / แผนก</span><strong>${window.pvtSupabase.escapeHtml(deptName)}</strong></div>
    <div class="profile-row"><span>ตำแหน่งงาน</span><strong>${window.pvtSupabase.escapeHtml(posName)}</strong></div>
    <div class="profile-row"><span>อีเมล / บัญชี</span><strong>${window.pvtSupabase.escapeHtml(profile.email || profile.username || "-")}</strong></div>
    <div class="profile-row"><span>สิทธิ์การใช้งาน</span><strong>${window.pvtSupabase.escapeHtml(profile.role || "employee")}</strong></div>
    <div class="profile-row"><span>วันเริ่มงาน</span><strong>${window.pvtSupabase.formatThaiDate(employee?.start_date)}</strong></div>
  `;
}