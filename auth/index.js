/* ==========================================================================
   🔒 PVT HR LEAVE - auth/index.js (เวอร์ชันเสถียรสูงสุด: ป้องกัน Loop & Auto Refresh)
   ========================================================================== */

function getSbClient() {
  return window.pvtSupabase?.client 
      || window.PVTSDK?.client 
      || window.supabaseClient 
      || window.supabase;
}

// 🚀 1. ฟังก์ชันย้ายหน้าจอ (ล้าง Cache และ URL Parameter ชัวร์ 100%)
function redirectToDashboard(role) {
  const cleanRole = String(role || "").toLowerCase();
  const targetPath = (cleanRole === "hr" || cleanRole === "admin") 
    ? "/pages/user/index-user.html" 
    : "/pages/user/index-user.html";
    
  // ใช้ location.replace เพื่อไม่ให้เก็บ History ของ URL ที่มี Token
  window.location.replace(window.location.origin + targetPath);
}

document.addEventListener("DOMContentLoaded", async () => {
  // เช็กว่ามาจาก Redirect ซ้ำหรือไม่ ป้องกัน Infinite Loop
  const hasRedirected = sessionStorage.getItem("redirect_attempt");
  
  try {
    const rawSession = localStorage.getItem("currentUser");
    if (rawSession && !hasRedirected) {
      const session = JSON.parse(rawSession);
      if (session.expireAt && Date.now() < session.expireAt) {
        sessionStorage.setItem("redirect_attempt", "true");
        window.location.replace("/pages/user/index-user.html");
        return;
      }
    }
  } catch (e) {
    localStorage.removeItem("currentUser");
  }

  // ล้าง Flag เมื่ออยู่หน้า Login สำเร็จ
  sessionStorage.removeItem("redirect_attempt");

  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  // ตรวจสอบ Auto Login ผ่าน QR Code บน URL
  const urlParams = new URLSearchParams(window.location.search);
  const autoToken = urlParams.get("token") || urlParams.get("auto_login");
  if (autoToken) {
    executeSecureQrLogin(autoToken);
    return;
  }

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const loginInput = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!loginInput || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณากรอกผู้ใช้งานและรหัสผ่านให้ครบถ้วน',
        confirmButtonColor: '#3b82f6'
      });
      return;
    }

    const sb = getSbClient();
    if (!sb) {
      Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
      return;
    }

    try {
      const { data, error } = await sb.rpc('login_employee', {
        p_account: loginInput,
        p_password: password
      });

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("การเข้าสู่ระบบล้มเหลว");

      const user = data[0];
      saveUserSession(user);
      
      sessionStorage.removeItem("redirect_attempt");
      redirectToDashboard(user.role); // ใช้งานฟังก์ชันที่รวมศูนย์ไว้

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: err.message,
        confirmButtonColor: '#ef4444'
      });
    }
  });
});

// ฟังก์ชันบันทึก Session มาตรฐาน
function saveUserSession(userData) {
  const sessionPayload = {
    id: userData.id,
    employee_code: userData.employee_code,
    full_name: userData.full_name,
    role: userData.role || "user",
    status: userData.status || "active",
    expireAt: new Date().getTime() + (12 * 60 * 60 * 1000) // อยู่ได้ 12 ชั่วโมง
  };
  localStorage.setItem("currentUser", JSON.stringify(sessionPayload));
}

// 🛠️ Helper ถอดรหัส URL-Safe Base64
const safeBase64Decode = (str) => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(atob(base64));
};

// 🚀 2. ฟังก์ชันประมวลผล QR Login (ใช้ .then() ควบคุมการย้ายหน้าอย่างเป็นลำดับ)
async function executeSecureQrLogin(scannedData) {
  Swal.fire({
    title: '🔒 กำลังตรวจสอบข้อมูล...',
    text: 'ระบบกำลังตรวจสอบความถูกต้องของ QR Code',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const sb = getSbClient();
  if (!sb) {
    Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
    return;
  }

  try {
    let rawPayload = String(scannedData).trim();

    // ดึงเฉพาะค่าพารามิเตอร์ auto_login
    if (rawPayload.includes("auto_login=")) {
      const match = rawPayload.match(/[?&]auto_login=([^&]+)/);
      if (match && match[1]) {
        rawPayload = match[1];
      }
    }

    let empCode = "";
    let timeBlock = null;

    // ถอดรหัส Payload
    try {
      const decodedStr = safeBase64Decode(decodeURIComponent(rawPayload));
      const parts = decodedStr.split('|');
      if (parts.length >= 2) {
        empCode = String(parts[0]).trim();
        timeBlock = String(parts[1]).trim();
      } else {
        throw new Error();
      }
    } catch (e) {
      throw new Error("⛔ รูปแบบ QR Code ไม่ถูกต้อง หรือถูกแก้ไข");
    }

    // ตรวจสอบเวลา Dynamic Block (1 นาที = 60000ms)
    const currentTimeBlock = Math.floor(Date.now() / 60000); 
    const timeDiff = Math.abs(currentTimeBlock - Number(timeBlock));

    // อนุโลมความต่างเวลาสูงสุด 1 บล็อก (ครอบคลุมการเหลื่อมเวลา)
    if (!timeBlock || isNaN(timeDiff) || timeDiff > 1) {
      throw new Error("⏰ QR Code นี้หมดอายุแล้ว กรุณาเปิด QR Code บนบัตรใหม่อีกครั้ง");
    }

    // ดึงข้อมูลพนักงานจาก Supabase
    const { data: user, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .ilike('employee_code', empCode) // ค้นหาแบบ Case-Insensitive
      .maybeSingle();

    if (error) {
      throw new Error("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: " + error.message);
    }

    if (!user) {
      throw new Error(`ไม่พบข้อมูลพนักงานรหัส "${empCode}" ในระบบ`);
    }

    if (String(user.status).toLowerCase() !== "active") {
      throw new Error("บัญชีของคุณถูกระงับสิทธิ์การใช้งาน");
    }

    // บันทึก Session สำเร็จ
    saveUserSession(user);

    // 🚀 ย้ายหน้าด้วย .then() ป้องกันบั๊กลูปค้าง
    Swal.fire({
      icon: 'success',
      title: `ยินดีต้อนรับ ${user.full_name}`,
      timer: 1000,
      showConfirmButton: false
    }).then(() => {
      redirectToDashboard(user.role);
    });

  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      text: err.message,
      confirmButtonColor: '#ef4444'
    });
  }
}

// เปิดกล้อง / อัปโหลดรูปเพื่อสแกน QR
function loginByQr() {
  let html5QrCode = null;

  Swal.fire({
    title: '📱 สแกน QR Code เข้าสู่ระบบ',
    html: `
      <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 15px;">
        <button id="btn-tab-cam" type="button" class="swal2-styled" style="background:#2563eb; margin:0; padding:8px 16px; border-radius:8px; font-size:14px;">📷 เปิดกล้อง</button>
        <button id="btn-tab-file" type="button" class="swal2-styled" style="background:#4b5563; margin:0; padding:8px 16px; border-radius:8px; font-size:14px;">🖼️ เลือกรูปภาพ</button>
      </div>

      <div id="qr-cam-box" style="width: 100%; max-width: 320px; height: 260px; margin: 0 auto; border-radius: 12px; overflow: hidden; background: #111827;">
        <div id="qr-reader" style="width:100%; height:100%;"></div>
      </div>

      <div id="qr-file-box" style="display:none; width: 100%; max-width: 320px; margin: 0 auto; padding: 25px 15px; border: 2px dashed #9ca3af; border-radius: 12px; background: #f9fafb; text-align: center;">
        <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 13px;">เลือกรูปภาพ QR Code จากคลังภาพ</p>
        <input type="file" id="qr-file-input" accept="image/*" style="display:none;" />
        <button type="button" onclick="document.getElementById('qr-file-input').click()" class="swal2-styled" style="background:#059669; color:#fff; margin:0; padding:8px 18px; border-radius:8px;">อัปโหลดรูปภาพ</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      html5QrCode = new Html5Qrcode("qr-reader");
      let isCamRunning = false;

      const btnCam = document.getElementById('btn-tab-cam');
      const btnFile = document.getElementById('btn-tab-file');
      const camBox = document.getElementById('qr-cam-box');
      const fileBox = document.getElementById('qr-file-box');

      const startCamera = async () => {
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 200, height: 200 } },
            (decodedText) => {
              html5QrCode.stop().then(() => {
                Swal.close();
                executeSecureQrLogin(decodedText);
              });
            },
            () => {}
          );
          isCamRunning = true;
        } catch (err) {
          console.error("Camera access error:", err);
        }
      };

      startCamera();

      btnCam.addEventListener('click', async () => {
        btnCam.style.background = '#2563eb';
        btnFile.style.background = '#4b5563';
        fileBox.style.display = 'none';
        camBox.style.display = 'block';
        if (!isCamRunning) await startCamera();
      });

      btnFile.addEventListener('click', async () => {
        btnFile.style.background = '#2563eb';
        btnCam.style.background = '#4b5563';
        camBox.style.display = 'none';
        fileBox.style.display = 'block';
        if (isCamRunning) {
          await html5QrCode.stop();
          isCamRunning = false;
        }
      });

      document.getElementById('qr-file-input').addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        try {
          const decodedText = await html5QrCode.scanFile(e.target.files[0], true);
          Swal.close();
          executeSecureQrLogin(decodedText);
        } catch (err) {
          Swal.fire({ icon: 'error', title: 'อ่าน QR ไม่สำเร็จ', text: 'ไม่พบ QR Code ในรูปภาพนี้' });
        }
      });
    },
    willClose: () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error(err));
      }
    }
  });
}

window.togglePassword = function () {
  const input = document.getElementById("password");
  const icon = document.querySelector(".toggle-password");
  if (input && icon) {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    icon.textContent = isPassword ? "visibility" : "visibility_off";
  }
};