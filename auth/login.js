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

// สมมุติตอนที่เครื่องสแกนกล้องอ่านค่า QR Code สำเร็จแล้วได้ข้อความดิบมา (scannedRawData)
window.processQrLogin = async function (scannedRawData) {
  // 1. ขึ้นแจ้งเตือนกำลังตรวจสอบ Token ความปลอดภัยทันที
  Swal.fire({
    title: '🔒 ตรวจสอบ Token ความปลอดภัย...',
    html: '<div class="pvt-spinner"></div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    return;
  }

  try {
    // 2. แกะข้อความที่ได้แยกออกจากกันด้วยเครื่องหมาย |
    const decodedData = decodeURIComponent(scannedRawData);
    const dataParts = decodedData.split('|');
    
    const empCode = dataParts[0]; // จะได้ รหัสพนักงาน เช่น 100001
    const secureToken = dataParts[1]; // จะได้ตัวยืนยันสิทธิ์ เช่น PVT_SECURE_BYPASS

    // 🚨 ตรวจสอบความปลอดภัยเบื้องต้น: ถ้าไม่มี Token ลับกำกับอยู่ ปฏิเสธการเข้าสู่ระบบทันที
    if (secureToken !== 'PVT_SECURE_BYPASS' || !empCode) {
      throw new Error('QR Code ไม่ถูกต้อง หรือเป็น Token ปลอมที่หมดอายุแล้ว');
    }

    // 3. ยิงตรวจสอบบัญชีกับฐานข้อมูล Supabase ว่าพนักงานคนนี้ยังมีสถานะใช้งานอยู่ไหม
    const { data: user, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .eq('employee_code', empCode)
      .eq('status', 'active')
      .single();

    if (error || !user) {
      throw new Error('ไม่พบข้อมูลพนักงานในระบบ หรือสิทธิ์การใช้งานถูกระงับ');
    }

    // 4. ผ่านสิทธิ์ความปลอดภัย! ทำการจำลอง Session บันทึกลงระบบเหมือนการคีย์รหัสผ่านปกติ
    sessionStorage.setItem("currentUser", JSON.stringify({
      id: user.id,
      employee_code: user.employee_code,
      full_name: user.full_name,
      role: user.role
    }));

    // 5. แสดงผลความสำเร็จแบบพรีเมียม
    Swal.fire({
      icon: 'success',
      title: `ยินดีต้อนรับคุณ ${user.full_name}`,
      text: 'ถอดรหัสความปลอดภัยและเข้าสู่ระบบสำเร็จ ⚡',
      timer: 1500,
      showConfirmButton: false
    });

    // 6. ผลักหน้าจอแยกสิทธิ์ HR-Admin / พนักงานทั่วไป (ดึงมาจาก Logic เดิมของพี่)
    setTimeout(() => {
      if (user.role === "hr" || user.role === "admin") {
        window.location.href = "/index.html";
      } else {
        window.location.href = "/pages/user/index-user.html";
      }
    }, 1500);

  } catch (err) {
    console.error("QR Security Login Failed:", err);
    Swal.fire({
      icon: 'error',
      title: 'ความปลอดภัยปฏิเสธการเชื่อมต่อ',
      text: err.message,
      confirmButtonColor: '#ef4444'
    });
  }
};