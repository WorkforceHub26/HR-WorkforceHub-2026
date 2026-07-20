/* ==========================================================================
   🔒 PVT HR LEAVE - index.js (เวอร์ชันปรับปรุง: ทุกคนไปหน้า User ก่อนเพื่อเช็คตัวเอง)
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const loginInput = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!loginInput || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณากรอกข้อมูลผู้ใช้งานและรหัสผ่านให้ครบถ้วน',
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
      let baseQuery = sb.from("employees").select(`id, employee_code, full_name, role, status, password`);
      
      // 🧠 ระบบอัจฉริยะ Smart Detect คัดกรองประเภทข้อมูลนำเข้า
      if (loginInput.includes("@")) {
        result = await baseQuery.eq("email", loginInput).single();
      } else if (/^\d+$/.test(loginInput)) {
        result = await baseQuery.or(`employee_code.eq."${loginInput}",phone.eq."${loginInput}"`).single();
      } else {
        result = await baseQuery.eq("full_name", loginInput).single();
      }

      if (result.error || !result.data) {
        throw new Error("ไม่พบข้อมูลพนักงานในระบบ (โปรดตรวจสอบ รหัส/ชื่อ/อีเมล/เบอร์โทร อีกครั้ง)");
      }
      
      const user = result.data;
      const dbPassword = String(user.password).trim();
      const inputPassword = String(password).trim();
      
      if (dbPassword !== inputPassword) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }

      const currentStatus = String(user.status || "").trim().toLowerCase();
      if (currentStatus !== "active") {
        throw new Error(`บัญชีของคุณถูกระงับ (สถานะในฐานข้อมูลคือ: ${user.status})`);
      }

      // บันทึก Session การเข้าสู่ระบบ
      sessionStorage.setItem("currentUser", JSON.stringify({
        id: user.id,
        employee_code: user.employee_code,
        full_name: user.full_name,
        role: user.role
      }));

      if (window.PVTLogger) {
        window.PVTLogger.info("LOGIN_SUCCESS", `${user.full_name} เข้าสู่ระบบสำเร็จ`);
      }

      // 🚀 [ปรับเส้นทางตามเงื่อนไขใหม่] HR/Admin ไปหลังบ้าน / พนักงานและหัวหน้าทุกระดับ ไปหน้าเช็คตัวเองก่อน
      if (user.role === "hr" || user.role === "admin") {
        if (window.location.origin) {
          fetch("/home.html", { method: "HEAD" })
          .then(() => { window.location.href = "/home.html"; })
          .catch(() => { window.location.href = "/"; });
        } else {
          window.location.href = "/home.html";
        }
      } else {
        // 🧑‍💼 หัวหน้าแผนก, ผู้จัดการ, พนักงานทั่วไป วิ่งมาตรวจเช็คตัวเองที่หน้านี้ก่อนทั้งหมด
        window.location.href = "/pages/user/index-user.html";
      }

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: err.message,
        confirmButtonColor: '#ef4444',
        timer: 2500
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

/* ==========================================================================
   📸 ระบบเปิดกล้องสแกน QR Code และล็อกอินอัตโนมัติ
   ========================================================================== */
window.loginByQr = function () {
  if (typeof Html5QrcodeScanner === 'undefined') {
    Swal.fire('ข้อผิดพลาด', 'ไม่พบระบบสแกน QR Code กรุณารีเฟรชหน้าเว็บหรือตรวจสอบเครือข่าย', 'error');
    return;
  }

  Swal.fire({
    title: '📷 สแกนบัตรประจำตัวพนักงาน',
    html: `
      <p style="font-size:13px; color:#64748b; margin-bottom:12px;">กรุณาส่อง QR Code บนบัตรพนักงานเข้าหาหน้ากล้อง</p>
      <div id="pvt-reader" style="width: 100%; max-width: 320px; margin: 0 auto; border-radius: 12px; overflow: hidden; border: 2px dashed var(--primary, #0fa472);"></div>
    `,
    showCancelButton: true,
    cancelButtonText: '❌ ปิดหน้ากล้อง',
    showConfirmButton: false,
    allowOutsideClick: false,
    willOpen: () => {
      setTimeout(() => {
        try {
          window.pvtHtml5QrcodeScanner = new Html5QrcodeScanner("pvt-reader", { 
            fps: 15, 
            qrbox: { width: 180, height: 180 } 
          });
          
          window.pvtHtml5QrcodeScanner.render((decodedText) => {
            window.pvtHtml5QrcodeScanner.clear().then(() => {
              executeSecureQrLogin(decodedText);
            }).catch(e => console.error(e));
          }, (err) => {});
          
        } catch(e) {
          console.error("สแกนเนอร์ทำงานขัดข้อง:", e);
        }
      }, 300);
    },
    willClose: () => {
      if (window.pvtHtml5QrcodeScanner) {
        window.pvtHtml5QrcodeScanner.clear().catch(e => console.error(e));
      }
    }
  });
};

// 🔒 ฟังก์ชันประมวลผลการเข้าสู่ระบบผ่านคิวอาร์โค้ด
async function executeSecureQrLogin(scannedData) {
  Swal.fire({
    title: '🔒 กำลังถอดรหัสความปลอดภัย...',
    html: '<div style="margin-top:10px;" class="pvt-spinner">ระบบกำลังเชื่อมต่อข้อมูลพนักงาน...</div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    return;
  }

  try {
    const decodedStr = decodeURIComponent(scannedData);
    const fragments = decodedStr.split('|');
    const empCode = fragments[0]?.trim();
    const tokenSecret = fragments[1]?.trim();

    if (tokenSecret !== 'PVT_SECURE_BYPASS' || !empCode) {
      throw new Error('QR Code ไม่ถูกต้อง หรือไม่ใช่บัตรที่ออกโดยฝ่าย HR');
    }

    const { data: user, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .eq('employee_code', empCode)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      throw new Error('ไม่พบข้อมูลพนักงานท่านนี้ หรือบัญชีถูกระงับสิทธิ์');
    }

    sessionStorage.setItem("currentUser", JSON.stringify({
      id: user.id,
      employee_code: user.employee_code,
      full_name: user.full_name,
      role: user.role
    }));

    Swal.fire({
      icon: 'success',
      title: `ยินดีต้อนรับคุณ ${user.full_name}`,
      text: 'ถอดรหัสเข้าสู่ระบบสำเร็จผ่านการสแกนบัตร ⚡',
      timer: 1500,
      showConfirmButton: false
    });

    // 🚀 ย้ายเส้นทางระบบสแกน QR ให้ล้อไปกับระบบพิมพ์มือด้านบนเป๊ะๆ
    setTimeout(() => {
      if (user.role === "hr" || user.role === "admin") {
        if (window.location.origin) {
          fetch("/home.html", { method: "HEAD" })
          .then(() => { window.location.href = "/home.html"; })
          .catch(() => { window.location.href = "/"; });
        } else {
          window.location.href = "/home.html";
        }
      } else {
        // หัวหน้าก็ส่งมาหน้าตรวจเช็คตัวเองก่อนเช่นกันครับพี่
        window.location.href = "/pages/user/index-user.html";
      }
    }, 1500);

  } catch (err) {
    console.error("QR Auth Interface Failure:", err);
    Swal.fire({
      icon: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      text: err.message,
      confirmButtonColor: '#ef4444'
    });
  }
}

/* ==========================================================================
   📘 ฟังก์ชันเปิด-ปิด กล่องอธิบายการใช้งาน (Smooth Toggle)
   ========================================================================== */
window.toggleInstructions = function () {
  const content = document.getElementById("instructionsContent");
  const arrow = document.getElementById("instructionArrow");
  
  if (content && arrow) {
    // ใช้คลาส "active" ในการสั่งเปิด-ปิดเอฟเฟกต์ CSS
    content.classList.toggle("active");
    
    // เปลี่ยนสัญลักษณ์ลูกศรหมุนขึ้นหรือลงตามการใช้งาน
    if (content.classList.contains("active")) {
      arrow.textContent = "expand_less";
    } else {
      arrow.textContent = "expand_more";
    }
  }
};