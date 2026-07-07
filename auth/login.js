/* ==========================================================================
   🔒 PVT HR LEAVE - login.js (ฉบับ Pop-up เด้งกลางจอ + ระบบย้ายหน้าดั้งเดิมที่เสถียรที่สุด)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const loginInput = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // 1. เช็คว่ากรอกครบไหม
    if (!loginInput || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    const sb = window.pvtSupabase?.getClient();
    if (!sb) {
      Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
      return;
    }

    try {
      let result;
      
      // 🌟 ใช้โค้ดดึงข้อมูลแบบดั้งเดิมที่เวิร์คและเสถียรที่สุด
      if (/^\d+$/.test(loginInput)) {
        result = await sb.from("employees")
          .select(`id, employee_code, full_name, role, status, password`)
          .eq("employee_code", loginInput)
          .single();
      } else {
        result = await sb.from("employees")
          .select(`id, employee_code, full_name, role, status, password`)
          .eq("full_name", loginInput)
          .single();
      }

      if (result.error || !result.data) {
        throw new Error("ไม่พบข้อมูลพนักงานนี้ในระบบ");
      }
      const user = result.data;
      // 1. ด่านรหัสผ่าน (พี่มิกผ่านด่านนี้แล้ว)
      const dbPassword = String(user.password).trim();
      const inputPassword = String(password).trim();
      
      console.log("👉 รหัสผ่านตรงกันไหม?:", dbPassword === inputPassword ? "✅ ตรงเป๊ะ!" : "❌ ไม่ตรง");
      console.log("👉 สถานะบัญชีจาก DB:", user.status);

      if (dbPassword !== inputPassword) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }

      // 🌟 2. ด่านสถานะบัญชี (แก้บั๊กพิมพ์เล็ก/พิมพ์ใหญ่)
      const currentStatus = String(user.status || "").trim().toLowerCase();
      if (currentStatus !== "active") {
        throw new Error(`บัญชีของคุณถูกระงับ (สถานะในฐานข้อมูลคือ: ${user.status})`);
      }

      // 🌟 3. บันทึก Session แบบดั้งเดิมเป๊ะๆ (เพื่อให้เข้ากับ auth-guard)
      sessionStorage.setItem("currentUser", JSON.stringify({
        id: user.id,
        employee_code: user.employee_code,
        full_name: user.full_name,
        role: user.role
      }));

      // เก็บประวัติ Logger (ถ้ามี)
      if (window.PVTLogger) {
        window.PVTLogger.info("LOGIN_SUCCESS", `${user.full_name} เข้าสู่ระบบสำเร็จ`);
      }

      // 🌟 4. โค้ดย้ายหน้าเว็บแบบ "ดั้งเดิม" (ช่วยป้องกันหาหน้าเว็บไม่เจอ)
      if (user.role === "hr" || user.role === "admin") {
        if (window.location.origin) {
          fetch("/index.html", { method: "HEAD" })
          .then(() => {
            window.location.href = "/index.html"; // ไปหน้า Admin
          })
          .catch(() => {
            window.location.href = "/"; // สลับไป root ถ้าหน้า index แจ้งเตือน
          });
        } else {
          window.location.href = "/index.html";
        }
      } else {
        window.location.href = "/pages/user/index-user.html"; // ไปหน้าพนักงาน
      }

    } catch (err) {
      // ❌ ถ้าพลาดให้เด้ง Pop-up สวยๆ กลางจอ
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: err.message,
        confirmButtonColor: '#ef4444',
        timer: 2500 // หายไปเองใน 2.5 วินาที
      });
    }
  });
});

/* ==========================================================================
   👁️ ฟังก์ชันเปิด-ปิด ดวงตาดูรหัสผ่าน
   ========================================================================== */
window.togglePassword = function () {
  const input = document.getElementById("password");
  const icon = document.querySelector(".toggle-password");
  
  if (input && icon) {
    if (input.type === "password") {
      input.type = "text";
      icon.textContent = "visibility";
    } else {
      input.type = "password";
      icon.textContent = "visibility_off";
    }
  }
};

