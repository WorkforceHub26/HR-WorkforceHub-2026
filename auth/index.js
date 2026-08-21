/* ==========================================================================
   🔒 PVT HR LEAVE - auth/index.js (เวอร์ชันปรับปรุงแก้ไข Supabase SDK Client)
   ========================================================================== */

// 🟢 Helper สำหรับดึง Supabase Client จาก SDK v3.0 Ultra
function getSbClient() {
  return window.pvtSupabase?.client 
      || window.PVTSDK?.client 
      || window.supabaseClient 
      || window.supabase;
}

document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  // =========================================================================
  // ⚡ [ระบบ AUTO-LOGIN]: ตรวจสอบว่าเปิดเว็บมาจาก QR Code หรือไม่
  // =========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const autoEmpCode = urlParams.get("auto_login");
  const autoToken = urlParams.get("token");

  if (autoEmpCode && autoToken) {
    executeSecureQrLogin(`${autoEmpCode}|${autoToken}`);
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
        text: 'กรุณากรอกข้อมูลผู้ใช้งานและรหัสผ่านให้ครบถ้วน',
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
      let result;
      let baseQuery = sb.from("employees").select("id, employee_code, full_name, role, status, password");

      // 🧠 Smart Detect คัดกรองประเภทข้อมูลนำเข้า (อีเมล / เบอร์โทร-รหัสพนักงาน / ชื่อ-สกุล)
      if (loginInput.includes("@")) {
        result = await baseQuery.eq("email", loginInput).maybeSingle();
      } else if (/^\d+$/.test(loginInput)) {
        result = await baseQuery.or(`employee_code.eq."${loginInput}",phone.eq."${loginInput}"`).maybeSingle();
      } else {
        result = await baseQuery.eq("full_name", loginInput).maybeSingle();
      }

      if (result.error || !result.data) {
        throw new Error("ไม่พบข้อมูลพนักงานในระบบ (โปรดตรวจสอบ รหัส/ชื่อ/อีเมล/เบอร์โทร อีกครั้ง)");
      }

      const user = result.data;

      // 1. ตรวจสอบรหัสผ่าน
      if (String(user.password || "").trim() !== String(password).trim()) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }

      // 2. ตรวจสอบสถานะบัญชี
      if (String(user.status || "").trim().toLowerCase() !== "active") {
        throw new Error(`บัญชีของคุณถูกระงับ (สถานะในฐานข้อมูลคือ: ${user.status})`);
      }

      // =========================================================================
      // 🚨 ตรวจสอบว่าพนักงานยังใช้ "รหัสพนักงาน" เป็นรหัสผ่านอยู่หรือไม่
      // =========================================================================
      const isUsingDefaultPassword = (String(user.password).trim() === String(user.employee_code).trim());

      if (isUsingDefaultPassword) {
        const riskChoice = await Swal.fire({
          icon: 'warning',
          title: '⚠️ แจ้งเตือนความปลอดภัยบัญชี',
          html: `
            <div style="text-align: left; font-size: 13.5px; color: #475569; line-height: 1.6; padding: 4px 8px;">
              ระบบพบว่าคุณกำลังใช้ <b>รหัสพนักงาน (${user.employee_code})</b> เป็นรหัสผ่านล็อกอินเข้าใช้งาน<br><br>
              <span style="color: #ef4444; font-weight: 600;">🚨 ความเสี่ยงด้านความปลอดภัย:</span><br>
              ผู้อื่นที่ทราบรหัสพนักงานของคุณ อาจแอบสวมรอยเข้าสู่ระบบเพื่อยื่นใบลา หรือเข้าถึงข้อมูลส่วนตัวแทนท่านได้<br><br>
              <i>หากท่านประสงค์จะใช้รหัสผ่านนี้ต่อ กรุณากดยืนยันเพื่อรับทราบความเสี่ยง</i>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: 'ยอมรับความเสี่ยง & เข้าใช้งาน',
          cancelButtonText: 'เปลี่ยนรหัสผ่านทันที',
          confirmButtonColor: '#3b82f6',
          cancelButtonColor: '#10b981',
          allowOutsideClick: false
        });

        if (riskChoice.dismiss === Swal.DismissReason.cancel) {
          if (typeof openChangePasswordModal === "function") {
            openChangePasswordModal(user);
          } else {
            const { value: newPassword } = await Swal.fire({
              title: 'ตั้งรหัสผ่านใหม่',
              input: 'password',
              inputLabel: 'กรอกรหัสผ่านใหม่ที่ต้องการใช้งาน',
              inputPlaceholder: 'อย่างน้อย 6 ตัวอักษร',
              showCancelButton: true,
              confirmButtonText: 'บันทึกรหัสผ่าน',
              cancelButtonText: 'ยกเลิก',
              inputValidator: (value) => {
                if (!value || value.length < 6) {
                  return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร!';
                }
                if (value.trim() === String(user.employee_code).trim()) {
                  return 'รหัสผ่านใหม่ต้องไม่ตรงกับรหัสพนักงาน!';
                }
              }
            });

            if (newPassword) {
              const { error } = await sb
                .from('employees')
                .update({ password: newPassword.trim() })
                .eq('id', user.id);

              if (!error) {
                await Swal.fire('สำเร็จ!', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาล็อกอินใหม่อีกครั้ง', 'success');
              } else {
                await Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + error.message, 'error');
              }
            }
          }
          return;
        }
      }

      // 3. บันทึก Session พร้อมกำหนดเวลาหมดอายุ
      saveUserSession(user);

      if (window.PVTLogger) {
        window.PVTLogger.info("LOGIN_SUCCESS", `${user.full_name} เข้าสู่ระบบสำเร็จ ${isUsingDefaultPassword ? '(ยอมรับความเสี่ยงรหัสผ่านเริ่มต้น)' : ''}`);
      }

      redirectToDashboard(user.role);

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

function redirectToDashboard(role) {
  if (role === "hr" || role === "admin") {
    window.location.href = "/pages/user/index-user.html";
  } else {
    window.location.href = "/pages/user/index-user.html";
  }
}

function isSessionValid() {
  const rawSession = localStorage.getItem("currentUser");

  if (!rawSession) {
    return false;
  }

  try {
    const sessionData = JSON.parse(rawSession);

    if (!sessionData || typeof sessionData !== "object" || !sessionData.id || !sessionData.role) {
      console.warn("isSessionValid Warning: โครงสร้าง Session ไม่ถูกต้อง ทำการล้างข้อมูล");
      localStorage.removeItem("currentUser");
      return false;
    }

    const currentTime = new Date().getTime();
    if (sessionData.expireAt && currentTime > sessionData.expireAt) {
      console.warn("isSessionValid Warning: Session หมดอายุแล้ว ทำการล้างข้อมูล");
      localStorage.removeItem("currentUser");
      return false;
    }

    return true;
  } catch (err) {
    console.error("isSessionValid Error: ไม่สามารถอ่าน Session จาก localStorage ได้", err);
    localStorage.removeItem("currentUser");
    return false;
  }
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

function loginByQr() {
  let html5QrCode = null;

  Swal.fire({
    title: '📱 สแกน QR Code เข้าสู่ระบบ',
    html: `
      <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 15px;">
        <button id="btn-tab-cam" type="button" class="swal2-styled" style="background:#2563eb; margin:0; padding:8px 16px; border-radius:8px; font-size:14px; transition:0.2s;">
          📷 เปิดกล้อง
        </button>
        <button id="btn-tab-file" type="button" class="swal2-styled" style="background:#4b5563; margin:0; padding:8px 16px; border-radius:8px; font-size:14px; transition:0.2s;">
          🖼️ เลือกรูปภาพ
        </button>
      </div>

      <div id="qr-cam-box" style="width: 100%; max-width: 320px; height: 260px; margin: 0 auto; border-radius: 12px; overflow: hidden; background: #111827; position: relative;">
        <div id="qr-reader" style="width:100%; height:100%;"></div>
      </div>

      <div id="qr-file-box" style="display:none; width: 100%; max-width: 320px; margin: 0 auto; padding: 25px 15px; border: 2px dashed #9ca3af; border-radius: 12px; background: #f9fafb; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">📁</div>
        <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 13px;">เลือกรูปภาพ QR Code จากคลังภาพในเครื่องของคุณ</p>
        <input type="file" id="qr-file-input" accept="image/*" style="display:none;" />
        <button type="button" onclick="document.getElementById('qr-file-input').click()" class="swal2-styled" style="background:#059669; color:#fff; margin:0; padding:8px 18px; border-radius:8px;">
          อัปโหลดรูปภาพ
        </button>
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
              stopCamera().then(() => {
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

      const stopCamera = async () => {
        if (isCamRunning) {
          await html5QrCode.stop();
          isCamRunning = false;
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
        await stopCamera();
      });

      const fileInput = document.getElementById('qr-file-input');
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        const imageFile = e.target.files[0];

        try {
          const decodedText = await html5QrCode.scanFile(imageFile, true);
          Swal.close();
          executeSecureQrLogin(decodedText);
        } catch (err) {
          Swal.fire({
            icon: 'error',
            title: 'อ่าน QR Code ไม่สำเร็จ',
            text: 'ไม่พบ QR Code ในรูปภาพนี้ กรุณาลองใชักล้องสแกนหรือเปลี่ยนรูปใหม่',
            confirmButtonColor: '#ef4444'
          });
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

async function executeSecureQrLogin(scannedData) {
  Swal.fire({
    title: '🔒 กำลังตรวจสอบข้อมูล...',
    html: '<div style="margin-top:10px;" class="pvt-spinner">ระบบกำลังเชื่อมต่อข้อมูลพนักงาน...</div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });

  const sb = getSbClient();
  if (!sb) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    return;
  }

  try {
    const decodedStr = decodeURIComponent(scannedData);
    let empCode = '';
    let tokenSecret = '';

    if (decodedStr.includes('auto_login=') && decodedStr.includes('token=')) {
      const searchStr = decodedStr.includes('?') ? decodedStr.split('?')[1] : decodedStr;
      const urlParams = new URLSearchParams(searchStr);
      empCode = urlParams.get('auto_login')?.trim();
      tokenSecret = urlParams.get('token')?.trim();
    } else {
      const fragments = decodedStr.split('|');
      empCode = fragments[0]?.trim();
      tokenSecret = fragments[1]?.trim();
    }

    if (tokenSecret !== 'PVT_SECURE_BYPASS' || !empCode) {
      throw new Error('QR Code ไม่ถูกต้อง หรือไม่ใช่บัตรที่ออกโดยฝ่าย HR');
    }

    const { data: user, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .eq('employee_code', empCode)
      .maybeSingle();

    if (error || !user) {
      throw new Error('ไม่พบข้อมูลพนักงานท่านนี้ในระบบ');
    }

    if (String(user.status || "").trim().toLowerCase() !== "active") {
      throw new Error(`บัญชีของคุณถูกระงับสิทธิ์ (สถานะในระบบ: ${user.status})`);
    }

    saveUserSession(user);

    Swal.fire({
      icon: 'success',
      title: `ยินดีต้อนรับคุณ ${user.full_name}`,
      text: 'เข้าสู่ระบบสำเร็จผ่านการสแกนบัตร ⚡',
      timer: 1500,
      showConfirmButton: false
    });

    setTimeout(() => {
      redirectToDashboard(user.role);
    }, 1500);

  } catch (err) {
    console.error("QR Auth Error:", err);
    Swal.fire({
      icon: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      text: err.message,
      confirmButtonColor: '#ef4444'
    });
  }
}

function saveUserSession(userData, expireInHours = 8) {
  if (!userData || typeof userData !== "object") {
    console.error("saveUserSession Error: ข้อมูลผู้ใช้งานไม่ถูกต้อง");
    return false;
  }

  const cleanUser = { ...userData };
  delete cleanUser.password;

  const currentTime = new Date().getTime();
  const expireAt = currentTime + (expireInHours * 60 * 60 * 1000);

  const sessionPayload = {
    id: cleanUser.id || "",
    employee_code: cleanUser.employee_code || "",
    full_name: cleanUser.full_name || "",
    role: cleanUser.role || "user",
    status: cleanUser.status || "active",
    createdAt: currentTime,
    expireAt: expireAt
  };

  try {
    localStorage.setItem("currentUser", JSON.stringify(sessionPayload));
    return true;
  } catch (err) {
    console.error("saveUserSession Error: ไม่สามารถบันทึกลง localStorage ได้", err);
    return false;
  }
}

window.toggleInstructions = function () {
  const content = document.getElementById("instructionsContent");
  const arrow = document.getElementById("instructionArrow");

  if (content && arrow) {
    content.classList.toggle("active");
    arrow.textContent = content.classList.contains("active") ? "expand_less" : "expand_more";
  }
};

async function openChangePasswordModal(user) {
  const { value: formValues } = await Swal.fire({
    title: 'เปลี่ยนรหัสผ่านเพื่อความปลอดภัย',
    html: `
      <p class="text-sm text-gray-600 mb-4">เนื่องจากรหัสผ่านปัจจุบันเป็นรหัสผ่านเริ่มต้น กรุณากำหนดรหัสผ่านใหม่ก่อนเข้าใช้งาน</p>
      <div class="text-left space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่</label>
          <input id="swal-new-password" type="password" class="swal2-input w-full m-0" placeholder="อย่างน้อย 6 ตัวอักษร">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
          <input id="swal-confirm-password" type="password" class="swal2-input w-full m-0" placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง">
        </div>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'บันทึกรหัสผ่านใหม่',
    cancelButtonText: 'ข้ามไปก่อน',
    confirmButtonColor: '#2563eb',
    preConfirm: () => {
      const newPassword = document.getElementById('swal-new-password').value;
      const confirmPassword = document.getElementById('swal-confirm-password').value;

      if (!newPassword || !confirmPassword) {
        Swal.showValidationMessage('กรุณากรอกรหัสผ่านให้ครบถ้วน');
        return false;
      }
      if (newPassword.length < 6) {
        Swal.showValidationMessage('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
        return false;
      }
      if (newPassword !== confirmPassword) {
        Swal.showValidationMessage('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
        return false;
      }
      return { newPassword };
    }
  });

  if (formValues) {
    try {
      Swal.showLoading();
      const sb = getSbClient();
      if (!sb) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");

      const { error } = await sb
        .from('employees')
        .update({ password: formValues.newPassword.trim() })
        .eq('id', user.id);

      if (error) throw error;

      await Swal.fire({
        icon: 'success',
        title: 'เปลี่ยนรหัสผ่านเรียบร้อย',
        text: 'ระบบทำการอัปเดตรหัสผ่านใหม่เรียบร้อยแล้ว',
        confirmButtonColor: '#2563eb'
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: err.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง',
        confirmButtonColor: '#ef4444'
      });
    }
  }
}