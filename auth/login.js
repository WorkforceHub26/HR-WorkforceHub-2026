/* ==========================================================================
   🔒 PVT HR LEAVE - login.js (เวอร์ชันสแกน QR Code + ตัดโค้ดที่ไม่ได้ใช้ทิ้ง)
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
      
      // ดึงข้อมูลพนักงานจากระบบ
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

      // ตรวจสอบตำแหน่งเพื่อทำการย้ายหน้าเว็บให้เหมาะสม
      if (user.role === "hr" || user.role === "admin") {
        if (window.location.origin) {
          fetch("/index.html", { method: "HEAD" })
          .then(() => {
            window.location.href = "/index.html";
          })
          .catch(() => {
            window.location.href = "/";
          });
        } else {
          window.location.href = "/index.html";
        }
      } else {
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
   📷 ฟังก์ชันสแกน QR Code สำหรับเข้าสู่ระบบ (ทำงานร่วมกับ SweetAlert2)
   ========================================================================== */
window.loginByQr = function () {
  if (typeof Html5QrcodeScanner === 'undefined') {
    Swal.fire('ข้อผิดพลาด', 'ไม่พบระบบสแกน QR Code กรุณารีเฟรชหน้าเว็บหรือตรวจสอบเครือข่าย', 'error');
    return;
  }

  Swal.fire({
    title: '📷 สแกน QR Code พนักงาน',
    html: `
      <div style="font-size: 14px; color: var(--text-muted, #64748b); margin-bottom: 12px;">นำคิวอาร์โค้ดประจำตัวพนักงานมาสแกนในกรอบสี่เหลี่ยมด้านล่าง</div>
      <div id="qr-reader" style="width:100%; min-height: 250px; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; background: #fafafa;"></div>
    `,
    showCancelButton: true,
    cancelButtonText: 'ปิดกล้องถ่ายภาพ',
    showConfirmButton: false,
    allowOutsideClick: false,
    didOpen: () => {
      // เรียกใช้กล้องสแกน
      window.html5QrcodeScanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 220, height: 220 } },
        false
      );
      window.html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    },
    willClose: () => {
      // ปิดกล้องทันทีเมื่อมีการปิดหน้าต่าง
      if (window.html5QrcodeScanner) {
        window.html5QrcodeScanner.clear().catch(err => console.error("ปิดกล้องล้มเหลว", err));
      }
    }
  });
};

// เมื่อทำการตรวจจับและสแกนคิวอาร์สำเร็จ
function onScanSuccess(decodedText) {
  if (window.html5QrcodeScanner) {
    window.html5QrcodeScanner.clear();
  }
  Swal.close();

  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  
  if (usernameInput) {
    usernameInput.value = decodedText.trim(); 
    Swal.fire({
      icon: 'success',
      title: 'ถอดรหัสสำเร็จ!',
      text: `รหัสพนักงาน: ${decodedText}`,
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      if (passwordInput) {
        passwordInput.focus(); // เด้งไปรอพิมพ์รหัสผ่านทันที
      }
    });
  }
}

function onScanFailure(error) {
  // ทำงานในเบื้องหลังเงียบๆ ปล่อยให้ระบบค้นหาเฟรมถัดไป
}

/* ==========================================================================
   📸 ระบบเปิดกล้องสแกน QR Code และล็อกอินอัตโนมัติ (อิงตามเซสชันเดิมของระบบ)
   ========================================================================== */

window.loginByQr = function () {
  // เปิดหน้าต่าง Pop-up กล้องสแกนเนอร์ผ่าน SweetAlert2
  Swal.fire({
    title: '📷 สแกนบัตรประจำตัวพนักงาน',
    html: `
      <p style="font-size:13px; color:#64748b; margin-bottom:12px;">กรุณาส่อง QR Code บนบัตรพนักงานเข้าหาหน้ากล้อง</p>
      <div id="pvt-reader" style="width: 100%; max-width: 320px; margin: 0 auto; border-radius: 12px; overflow: hidden; border: 2px dashed var(--primary, #0fa472);"></div>
    `,
    showCancelButton: true,
    cancelButtonText: '❌ ปิดหน้ากล้อง',
    showConfirmButton: false,
    willOpen: () => {
      // สตาร์ทกล้องสแกนแบบ High-Performance
      setTimeout(() => {
        try {
          window.pvtHtml5QrcodeScanner = new Html5QrcodeScanner("pvt-reader", { 
            fps: 15, 
            qrbox: { width: 180, height: 180 } 
          });
          
          window.pvtHtml5QrcodeScanner.render((decodedText) => {
            // สแกนเจอปุ๊บ เคลียร์สิทธิ์กล้องทันทีเพื่อความปลอดภัย
            window.pvtHtml5QrcodeScanner.clear().then(() => {
              // ส่งค่าเข้าโรงงานตรวจสอบรหัสความปลอดภัย
              executeSecureQrLogin(decodedText);
            }).catch(e => console.error(e));
          }, (err) => { /* ค้นหาเฟรมถัดไป */ });
          
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

// 🔒 ฟังก์ชันประมวลผลการเข้าสู่ระบบแบบข้ามขั้นตอนรหัสผ่านผ่าน Token ลับ
async function executeSecureQrLogin(scannedData) {
  // โชว์แจ้งเตือนกำลังโหลดตรวจสอบสิทธิ์ความปลอดภัย
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
    // ถอดรหัสข้อความ %7C กลับมาเป็นเครื่องหมาย |
    const decodedStr = decodeURIComponent(scannedData);
    const fragments = decodedStr.split('|');
    const empCode = fragments[0]?.trim();
    const tokenSecret = fragments[1]?.trim();

    // 1. ดักการสร้างคิวอาร์โค้ดปลอมมาหลอกระบบ
    if (tokenSecret !== 'PVT_SECURE_BYPASS' || !empCode) {
      throw new Error('QR Code ไม่ถูกต้อง หรือไม่ใช่บัตรที่ออกโดยฝ่าย HR');
    }

    // 2. ดึงข้อมูลพนักงานจากฐานข้อมูล Supabase ตรวจดูสถานะ active
    const { data: user, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .eq('employee_code', empCode)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      throw new Error('ไม่พบข้อมูลพนักงานท่านนี้ หรือบัญชีถูกระงับสิทธิ์');
    }

    // 3. 💾 ถอดรหัสผ่านฉลุย! ยัดลง sessionStorage ลอกโมเดลล็อกอินหลักของพี่มาเลย
    sessionStorage.setItem("currentUser", JSON.stringify({
      id: user.id,
      employee_code: user.employee_code,
      full_name: user.full_name,
      role: user.role
    }));

    // 4. ขึ้นแจ้งเตือนล็อกอินผ่านฉลุยสำเร็จ
    Swal.fire({
      icon: 'success',
      title: `ยินดีต้อนรับคุณ ${user.full_name}`,
      text: 'ถอดรหัสเข้าสู่ระบบสำเร็จผ่านการสแกนบัตร ⚡',
      timer: 1500,
      showConfirmButton: false
    });

    // 5. 🚀 ย้ายหน้าตาม "ระบบดั้งเดิมที่เสถียรที่สุด" ของพี่แบบเป๊ะๆ 100%
    setTimeout(() => {
      if (user.role === "hr" || user.role === "admin") {
        if (window.location.origin) {
          fetch("/index.html", { method: "HEAD" })
          .then(() => { window.location.href = "/index.html"; })
          .catch(() => { window.location.href = "/"; });
        } else {
          window.location.href = "/index.html";
        }
      } else {
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