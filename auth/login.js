document.addEventListener("DOMContentLoaded", () => {

  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const statusEl = document.getElementById("loginStatus");

  function setStatus(message, type = "") {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
    statusEl.style.opacity = "1";
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const loginInput = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!loginInput || !password) {
      setStatus("❌ กรุณากรอกข้อมูลให้ครบ", "error");
      return;
    }

    const sb = window.pvtSupabase?.getClient();
    if (!sb) {
      setStatus("❌ ไม่สามารถเชื่อมต่อฐานข้อมูลได้", "error");
      return;
    }

    try {
      setStatus("⏳ กำลังตรวจสอบข้อมูล...", "info");
      let result;

      // กรณีเป็นรหัสพนักงาน
      if (/^\d+$/.test(loginInput)) {
        result = await sb
          .from("employees")
          .select(`
            id,
            employee_code,
            full_name,
            role,
            status,
            password,
            departments ( department_name ),
            positions ( position_name )
          `) // ดึงข้อมูลแผนกและตำแหน่งมาพร้อมกัน
          .eq("employee_code", loginInput);

      } else {
        // กรณีเป็นชื่อ
        result = await sb
          .from("employees")
          .select(`
            id,
            employee_code,
            full_name,
            role,
            status,
            password,
            departments ( department_name ),
            positions ( position_name )
          `) // ดึงข้อมูลแผนกและตำแหน่งมาพร้อมกัน
          .eq("full_name", loginInput);
      }

      const { data, error } = result;
      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("ไม่พบข้อมูลพนักงาน");
      }

      if (data.length > 1) {
        throw new Error("พบชื่อซ้ำ กรุณาเข้าสู่ระบบด้วยรหัสพนักงาน");
      }

      const user = data[0];

      if (user.status !== "active") {
        throw new Error("บัญชีถูกปิดใช้งาน");
      }

      if ((user.password || "").trim() !== password) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }

      // 💡 เอาโค้ด Supabase Auth ที่มีปัญหาออกแล้ว เพื่อให้พี่ล็อกอินได้ทันทีโดยตรงผ่านตาราง
      
      // บันทึกข้อมูลพนักงานพร้อมโครงสร้างแผนกที่ดึงมาลง Session สำหรับไปใช้แสดงผลหน้าอื่น ๆ
      sessionStorage.setItem("currentUser", JSON.stringify(user));

      if (window.PVTLogger) {
        window.PVTLogger.info(
          "LOGIN_SUCCESS",
          `${user.full_name} เข้าสู่ระบบสำเร็จ`
        );
      }

      setStatus(`✅ ยินดีต้อนรับ ${user.full_name}`, "success");

      setTimeout(() => {
        if (user.role === "hr" || user.role === "admin") {
          if (window.location.origin) {
            fetch("/index.html", { method: "HEAD" })
            .then(() => {
              window.location.href = "/index.html";
            })
            .catch(() => {
              window.location.href = "/";
            });
          }
        } else {
          window.location.href = "/pages/user/index-user.html";
        }
      }, 1000);

    } catch (err) {
      console.error("[LOGIN ERROR]", err);
      if (window.PVTLogger) {
        window.PVTLogger.error("LOGIN_FAILED", err.message);
      }
      setStatus(err.message || "เกิดข้อผิดพลาด", "error");
    }
  });
});

// ฟังก์ชันแสดง/ซ่อนรหัสผ่าน
window.togglePassword = function () {
  const input = document.getElementById("password");
  const eyeBtn = document.querySelector(".eye-btn");
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    if (eyeBtn) eyeBtn.textContent = "🙈";
  } else {
    input.type = "password";
    if (eyeBtn) eyeBtn.textContent = "👁";
  }
};

// Logout ใช้ทุกหน้า
window.logout = function () {
  sessionStorage.removeItem("currentUser");
  window.location.href = "/";
};

