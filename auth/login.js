/**
 * 🔒 PVT HR LEAVE - PREMIUM AUTHENTICATION LOGIC (SUPABASE CONNECTED)
 * รวม Logic ตรวจสอบสิทธิ์ของพี่ เข้ากับอนิเมชันสไตล์ Mobile App พรีเมียม
 */

const loginForm = document.getElementById("loginForm");
const statusEl = document.getElementById("loginStatus");

// 1. ระบบจดจำผู้ใช้งาน (Remember Me) เมื่อโหลดหน้าจอเสร็จ
document.addEventListener("DOMContentLoaded", () => {
  const savedUsername = localStorage.getItem("pvt_remember_username");
  const rememberCheckbox = document.getElementById("rememberMe");
  const usernameInput = document.getElementById("username");

  if (savedUsername && usernameInput && rememberCheckbox) {
    usernameInput.value = savedUsername;
    rememberCheckbox.checked = true;
  }
});

// 2. ฟังก์ชันส่งข้อมูลเข้าสู่ระบบ (อัปเกรดเอฟเฟกต์ปุ่มและอนิเมชันการ์ดสั่น)
loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("กำลังตรวจสอบบัญชี...", "info");

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const rememberCheckbox = document.getElementById("rememberMe");
  const email = username.includes("@") ? username : `${username}@pvt.local`;
  const sb = window.pvtSupabase?.getClient();

  // ดึงปุ่มล็อกอินเพื่อทำสถานะ Loading
  const loginBtn = document.querySelector(".login-btn");
  const originalBtnText = loginBtn ? loginBtn.textContent : "เข้าสู่ระบบ";

  if (!sb) {
    setStatus("ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจสอบอินเทอร์เน็ต", "error");
    triggerShakeAnimation(); // สั่นเตือน
    return;
  }

  // ✨ Animation: เปลี่ยนปุ่มเป็นสถานะกำลังโหลด ป้องกันการกดซ้ำ
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = "กำลังเข้าสู่ระบบ...";
    loginBtn.style.opacity = "0.85";
  }

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const { data: profile, error: profileError } = await sb
      .from("profiles")
      .select("role, status")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (profile?.status && profile.status !== "active") {
      throw new Error("บัญชีนี้ถูกปิดใช้งาน");
    }

    // จัดการระบบ Remember Me ตามสถานะ Checkbox
    if (rememberCheckbox && rememberCheckbox.checked) {
      localStorage.setItem("pvt_remember_username", username);
    } else {
      localStorage.removeItem("pvt_remember_username");
    }

    setStatus("เข้าสู่ระบบสำเร็จ กำลังนำคุณไปยังหน้าหลัก...", "success");

    const role = profile?.role || "employee";
    const adminRoles = ["admin", "hr", "manager", "supervisor"];
    
    // ดีเลย์นิดนึงให้อ่านข้อความ success ทันอย่างสมูท
    setTimeout(() => {
      window.location.href = adminRoles.includes(role) ? "/admin.html" : "/pages/user/index-user.html";
    }, 800);

  } catch (error) {
    console.error(error);
    
    // แปลข้อความข้อผิดพลาดเบื้องต้นให้พนักงานเข้าใจง่ายขึ้น
    let errorMsg = error.message;
    if (errorMsg === "Invalid login credentials") {
      errorMsg = "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง";
    }

    setStatus(errorMsg || "รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง", "error");
    triggerShakeAnimation(); // ✨ Animation: สั่งการ์ดสั่นดึ๋งเมื่อล็อกอินผิดพลาด

    // คืนค่าปุ่มให้กลับมาใช้งานได้ปกติ
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = originalBtnText;
      loginBtn.style.opacity = "1";
    }
  }
});

// 3. ฟังก์ชันจัดแต่งข้อความแจ้งเตือน (เพิ่มเอฟเฟกต์ Fade)
function setStatus(message, type) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `form-status ${type || ""}`;
  
  // เพิ่มลูกเล่นให้ข้อความค่อย ๆ ปรากฏขึ้นแบบไม่ทื่อ
  statusEl.style.opacity = "0";
  setTimeout(() => { statusEl.style.opacity = "1"; }, 10);
}

// 4. ฟังก์ชันเปิด-ปิดตา (เพิ่มการเปลี่ยนไอคอน 👁️/🙈 ให้นุ่มนวลขึ้น)
function togglePassword() {
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
}

// 5. ฟังก์ชันแสดงข้อความแนะนำลืมรหัสผ่าน (เปลี่ยนจาก alert น่ารำคาญ มาโชว์บนหน้าจอพรีเมียมแทน)
function showResetHint() {
  setStatus("💡 กรุณาติดต่อฝ่ายบุคคล (HR) ประจำสาขาเพื่อรีเซ็ตรหัสผ่าน", "info");
}

// 6. ฟังก์ชันปุ่มสแกน QR Code (แจ้งเตือนแบบพรีเมียมบนหน้าการ์ด)
function loginByQr() {
  setStatus("🔒 ฟังก์ชัน QR Login ยังไม่เปิดใช้งาน กรุณาใช้รหัสพนักงานก่อน", "info");
}

// 7. ฟังก์ชันเสริม: สั่งการ์ดสั่นสะบัดเบา ๆ เมื่อมีข้อผิดพลาด
function triggerShakeAnimation() {
  if (!loginForm) return;
  loginForm.style.animation = "none";
  setTimeout(() => {
    loginForm.style.animation = "shakeError 0.4s ease-in-out";
  }, 10);
}