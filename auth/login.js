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
   📸 ระบบล็อกอินอัจฉริยะผ่าน QR Code Token ปลอดภัยสูง (เพิ่มใน login.js)
   ========================================================================== */

/* ==========================================================================
   📸 ระบบเปิดกล้องสแกน QR Code และ ถอดรหัส Token ความปลอดภัย (แนวทางที่ 2)
   ========================================================================== */

// 1. ฟังก์ชันหลักเมื่อกดปุ่ม "สแกน QR Code" บนหน้าจอ Login
window.loginByQr = function () {
  // สร้างโครงสร้าง Popup สำหรับเปิดกล้องสแกนเนอร์
  Swal.fire({
    title: '📷 สแกนบัตรพนักงานประจำตัว',
    html: `
      <p style="font-size:13px; color:#64748b; margin-bottom:10px;">กรุณาส่อง QR Code บนบัตรพนักงานเข้ากับกล้อง</p>
      <div id="pvt-reader" style="width: 100%; max-width: 350px; margin: 0 auto; border-radius: 12px; overflow: hidden; border: 2px dashed #0fa472;"></div>
    `,
    showCancelButton: true,
    cancelButtonText: '❌ ปิดหน้าต่างกล้อง',
    confirmButtonButtonText: false,
    showConfirmButton: false,
    willOpen: () => {
      // ตรวจสอบว่ามีไลบรารีสแกนหรือยัง ถ้าไม่มีให้โหลดด่วนแบบ Dynamic
      if (typeof Html5QrcodeScanner === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = () => { startQrScanner(); };
        document.head.appendChild(script);
      } else {
        startQrScanner();
      }
    },
    willClose: () => {
      // เคลียร์กล้องเมื่อปิด Popup เพื่อไม่ให้เปิดค้างไว้
      if (window.pvtHtml5QrcodeScanner) {
        window.pvtHtml5QrcodeScanner.clear().catch(err => console.error(err));
      }
    }
  });
};

// 2. ฟังก์ชันสั่งสตาร์ทกล้องขึ้นมาจับภาพ QR Code
function startQrScanner() {
  window.pvtHtml5QrcodeScanner = new Html5QrcodeScanner("pvt-reader", { 
    fps: 10, 
    qrbox: { width: 200, height: 200 } 
  });
  
  // พลักค่าเข้าทำงานเมื่อสแกนเจอข้อความสำเร็จ
  window.pvtHtml5QrcodeScanner.render((decodedText) => {
    // สแกนติดปุ๊บ สั่งปิดกล้องทันทีเพื่อป้องการทำงานซ้ำซ้อน
    window.pvtHtml5QrcodeScanner.clear().then(() => {
      // ส่งค่าดิบที่สแกนได้ ไปเข้าสู่กระบวนการ Bypass ล็อกอินความปลอดภัยสูง
      processQrLoginToken(decodedText);
    }).catch(err => console.error(err));
  }, (errorMessage) => {
    // ปล่อยผ่านล็อก Log ตอนกำลังหา QR Code เพื่อไม่ให้รกหน้าจอ
  });
}

// 3. 🔒 ฟังก์ชันหัวใจสำคัญ: ถอดรหัส Token และทำสิทธิ์เข้าระบบอัตโนมัติ
async function processQrLoginToken(scannedRawData) {
  // แจ้งเตือนจังหวะตรวจสอบ Token ลับ
  Swal.fire({
    title: '🔒 ตรวจสอบสิทธิ์ความปลอดภัย...',
    html: '<div style="margin-top:10px;" class="pvt-spinner">กำลังถอดรหัส Token บัตรพนักงาน...</div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    return;
  }

  try {
    // 🧩 แปลงค่า URL Component กลับมาเป็นสตริงปกติ (เช่น จาก %7C กลับมาเป็น | )
    const decodedData = decodeURIComponent(scannedRawData);
    
    // แกะข้อความแยกออกจากกันด้วยเครื่องหมาย |
    const dataParts = decodedData.split('|');
    const empCode = dataParts[0]?.trim();      // ได้ รหัสพนักงาน เช่น "100001"
    const secureToken = dataParts[1]?.trim();  // ได้รหัสผ่านพิเศษ เช่น "PVT_SECURE_BYPASS"

    // 🚨 Check ขั้นที่ 1: ตรวจว่าพนักงานแอบเขียน QR Code ขึ้นมาเองไหม
    if (secureToken !== 'PVT_SECURE_BYPASS' || !empCode) {
      throw new Error('QR Code ใบนี้ไม่ถูกต้อง หรือไม่ใช่โครงสร้างบัตรที่ออกจากระบบ HR');
    }

    // 🔍 Check ขั้นที่ 2: ดึงข้อมูลพนักงานคนนี้ขึ้นมาจากตาราง employees ของ Supabase
    const { data: user, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .eq('employee_code', empCode)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      throw new Error('ไม่พบข้อมูลพนักงานท่านนี้ในระบบ หรือสถานะบัญชีถูกระงับการใช้งาน');
    }

    // 💾 ขั้นที่ 3: ผ่านสิทธิ์ความปลอดภัย! เขียนข้อมูลลง sessionStorage แกล้งทำเป็นล็อกอินปกติสำเร็จ
    sessionStorage.setItem("currentUser", JSON.stringify({
      id: user.id,
      employee_code: user.employee_code,
      full_name: user.full_name,
      role: user.role
    }));

    // 🎉 ขั้นที่ 4: แจ้งเตือนยินดีต้อนรับสวยๆ
    Swal.fire({
      icon: 'success',
      title: `ยินดีต้อนรับคุณ ${user.full_name}`,
      text: 'ถอดรหัสบัตรประจำตัว และเข้าสู่ระบบสำเร็จแล้ว ⚡',
      timer: 1500,
      showConfirmButton: false
    });

    // 🚀 ขั้นที่ 5: ผลักเปลี่ยนหน้าจอตามสิทธิ์ (ดึง Logic การย้ายหน้าแบบดั้งเดิมของพี่มาใช้)
    setTimeout(() => {
      if (user.role === "hr" || user.role === "admin") {
        window.location.href = "/index.html"; // ไปแดชบอร์ดหลังบ้าน
      } else {
        window.location.href = "/pages/user/index-user.html"; // ไปหน้าผู้ใช้ทั่วไป
      }
    }, 1500);

  } catch (err) {
    console.error("QR Login Failed:", err);
    Swal.fire({
      icon: 'error',
      title: 'ความปลอดภัยปฏิเสธการเข้าสู่ระบบ',
      text: err.message,
      confirmButtonColor: '#ef4444'
    });
  }
}