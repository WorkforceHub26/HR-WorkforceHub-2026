/**
 * 🔒 PVT HR LEAVE - AUTHENTICATION SCRIPT (V.2.0 PRODUCTION)
 * 🛡️ อัปเกรดระบบป้องกัน Error 100% ตรวจสอบแน่นหนาทุกด่าน
 */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const statusEl = document.getElementById("loginStatus");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const rememberCheckbox = document.getElementById("rememberMe");
  const loginBtn = document.querySelector(".login-btn");

  // ==========================================
  // 1. ระบบจดจำผู้ใช้งาน (ดึงค่าตอนเปิดหน้าเว็บ)
  // ==========================================
  const savedUsername = localStorage.getItem("pvt_remember_username");
  if (savedUsername && usernameInput && rememberCheckbox) {
    usernameInput.value = savedUsername;
    rememberCheckbox.checked = true;
  }

  // ==========================================
  // 2. ฟังก์ชันแจ้งเตือนบนหน้าจอ (UI Feedback)
  // ==========================================
  const setStatus = (message, type) => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type || ""}`;
    statusEl.style.opacity = "1";
  };

  const setButtonState = (isLoading) => {
    if (!loginBtn) return;
    if (isLoading) {
      loginBtn.dataset.originalText = loginBtn.textContent;
      loginBtn.textContent = "กำลังตรวจสอบระบบ...";
      loginBtn.style.opacity = "0.7";
      loginBtn.disabled = true;
    } else {
      loginBtn.textContent = loginBtn.dataset.originalText || "เข้าสู่ระบบ";
      loginBtn.style.opacity = "1";
      loginBtn.disabled = false;
    }
  };

  // ==========================================
  // 3. กระบวนการล็อกอิน (Main Logic)
  // ==========================================
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault(); // หยุดการรีเฟรชหน้าเว็บ

    // 🛡️ ป้องกันบั๊กที่ 1: ตัดช่องว่าง (Spacebar) ที่พนักงานชอบเผลอพิมพ์เกินออกให้หมด
    const rawUsername = usernameInput.value.trim();
    const rawPassword = passwordInput.value.trim();

    if (!rawUsername || !rawPassword) {
      setStatus("❌ กรุณากรอกรหัสพนักงานและรหัสผ่านให้ครบถ้วน", "error");
      return;
    }

    // 🛡️ ป้องกันบั๊กที่ 2: เช็คว่าเชื่อมต่อฐานข้อมูลได้ชัวร์ๆ ก่อนเริ่มทำงาน
    const sb = window.pvtSupabase?.getClient();
    if (!sb) {
      setStatus("❌ ระบบขัดข้อง: ไม่สามารถเชื่อมต่อฐานข้อมูลได้ (window.pvtSupabase หายไป)", "error");
      return;
    }

    setStatus("⏳ กำลังตรวจสอบข้อมูลพนักงาน...", "info");
    setButtonState(true); // ล็อกปุ่มกันคนกดเบิ้ล

    try {
      let targetEmpCode = null;

      // 🔍 ด่านที่ 1: ตรวจสอบข้อมูลพนักงานจากตาราง employees
      // ลองหาจาก "รหัสพนักงาน" ก่อน (ใช้ ilike ตัดปัญหาพิมพ์เล็ก/ใหญ่)
      const { data: codeCheck, error: codeError } = await sb
        .from("employees")
        .select("employee_code")
        .ilike("employee_code", rawUsername)
        .eq("status", "active")
        .maybeSingle();

      if (codeError) throw new Error("เกิดข้อผิดพลาดในการดึงข้อมูลจากตารางพนักงาน");

      if (codeCheck) {
        targetEmpCode = codeCheck.employee_code;
      } else {
        // ถ้าหารหัสไม่เจอ ให้ลองหาจาก "ชื่อ-นามสกุล"
        const { data: nameCheck, error: nameError } = await sb
          .from("employees")
          .select("employee_code")
          .ilike("full_name", rawUsername)
          .eq("status", "active")
          .maybeSingle();

        if (nameError) throw new Error("เกิดข้อผิดพลาดในการค้นหาชื่อพนักงาน");
        if (nameCheck) targetEmpCode = nameCheck.employee_code;
      }

      // 🛑 ถ้าทะลุมาถึงตรงนี้แล้วยังไม่มี targetEmpCode แปลว่าหาไม่เจอจริงๆ
      if (!targetEmpCode) {
        throw new Error("❌ ไม่พบข้อมูลพนักงานรายนี้ (อาจสะกดผิด หรือพ้นสภาพพนักงานแล้ว)");
      }

      // 💾 จัดการระบบจดจำรหัส (Remember Me)
      if (rememberCheckbox?.checked) {
        localStorage.setItem("pvt_remember_username", rawUsername);
      } else {
        localStorage.removeItem("pvt_remember_username");
      }

      // 🔑 ด่านที่ 2: แปลงเป็นอีเมล และล็อกอินเข้า Supabase Auth ของจริง
      const virtualEmail = `${targetEmpCode.toLowerCase()}@pvt.com`;
      setStatus("🔐 กำลังยืนยันรหัสผ่าน...", "info");

      const { data: authData, error: authError } = await sb.auth.signInWithPassword({
        email: virtualEmail,
        password: rawPassword,
      });

      if (authError) {
        // ดัก Error เฉพาะเจาะจงเพื่อบอกผู้ใช้ให้เข้าใจง่ายๆ
        if (authError.message.includes("Invalid login credentials")) {
          throw new Error("❌ รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
        } else if (authError.message.includes("Email not confirmed")) {
          throw new Error("❌ บัญชีนี้ยังไม่ได้เปิดใช้งาน กรุณาติดต่อ HR");
        }
        throw new Error("❌ เกิดข้อผิดพลาดจากระบบรักษาความปลอดภัย: " + authError.message);
      }

      // 👑 ด่านที่ 3: ตรวจสอบสิทธิ์ (Role) เพื่อส่งไปหน้าเว็บที่ถูกต้อง
      const userId = authData.user?.id;
      const { data: profile, error: profileError } = await sb
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single(); // single() บังคับว่าต้องมีข้อมูลสิทธิ์ ถ้าไม่มีจะโดดเข้า Catch

      if (profileError || !profile) {
        await sb.auth.signOut(); // บังคับล็อกเอาท์ถ้าสิทธิ์มีปัญหา
        throw new Error("❌ ไม่พบข้อมูลสิทธิ์การเข้าถึง (Profile) กรุณาติดต่อ HR");
      }

      // 🎉 ด่านสุดท้าย: ผ่านทุกเงื่อนไข เตรียมส่งเปลี่ยนหน้า
      setStatus("✅ เข้าสู่ระบบสำเร็จ! กำลังพาท่านไป...", "success");

      setTimeout(() => {
        const userRole = (profile.role || "user").toLowerCase();
        // ถ้าเป็นแอดมินหรือหัวหน้า ส่งไปหน้า HR
        if (["admin", "hr", "manager", "supervisor"].includes(userRole)) {
          window.location.href = "/pages/hr/hr.html"; 
        } else {
          // ถ้าเป็นพนักงานทั่วไป ส่งไปหน้าลงวันลา
          window.location.href = "/pages/user/index-user.html"; 
        }
      }, 1000);

    } catch (err) {
      console.error("[Login Error]:", err);
      setStatus(err.message || "❌ เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ", "error");
      setButtonState(false); // ปลดล็อกปุ่มให้กดใหม่ได้
    }
  });
});

// ==========================================
// 4. ฟังก์ชันเสริม (รันผ่านปุ่ม HTML)
// ==========================================
window.togglePassword = function() {
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

window.showResetHint = function() {
  const statusEl = document.getElementById("loginStatus");
  if (statusEl) {
    statusEl.textContent = "💡 ลืมรหัสผ่าน? กรุณาติดต่อฝ่ายบุคคล (HR)";
    statusEl.className = "form-status info";
    statusEl.style.opacity = "1";
  }
};

window.loginByQr = function() {
  const statusEl = document.getElementById("loginStatus");
  if (statusEl) {
    statusEl.textContent = "📸 ระบบสแกน QR Code กำลังอยู่ในช่วงพัฒนา";
    statusEl.className = "form-status info";
    statusEl.style.opacity = "1";
  }
};