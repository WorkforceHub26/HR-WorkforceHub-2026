/* ==========================================================================
   🔒 PVT HR LEAVE - auth/index.js (เวอร์ชันปรับปรุงระบบเตือนความเสี่ยงรหัสผ่าน)
   ========================================================================== */

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
    // ส่งข้อมูลเข้าระบบตรวจสอบเพื่อทำการ Auto Login ทันที
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

    const sb = window.pvtSupabase?.getClient();
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
          confirmButtonColor: '#3b82f6', // สีฟ้า
          cancelButtonColor: '#10b981',  // สีเขียว
          allowOutsideClick: false
        });

        // กรณีเลือก "เปลี่ยนรหัสผ่านทันที"
        if (riskChoice.dismiss === Swal.DismissReason.cancel) {
          if (typeof openChangePasswordModal === "function") {
            openChangePasswordModal(user);
          } else {
            // Prompt ให้กรอกรหัสผ่านใหม่ได้ทันที
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
          return; // หยุดกระบวนการล็อกอินชั่วคราว เพื่อให้เข้าด้วยรหัสผ่านใหม่
        }
      }
      // =========================================================================

      // 3. บันทึก Session
      sessionStorage.setItem("currentUser", JSON.stringify({
        id: user.id,
        employee_code: user.employee_code,
        full_name: user.full_name,
        role: user.role
      }));

      if (window.PVTLogger) {
        window.PVTLogger.info("LOGIN_SUCCESS", `${user.full_name} เข้าสู่ระบบสำเร็จ ${isUsingDefaultPassword ? '(ยอมรับความเสี่ยงรหัสผ่านเริ่มต้น)' : ''}`);
      }

      // 🚀 เส้นทางเปลี่ยนหน้าตาม Role
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

// ฟังก์ชันสำหรับย้ายหน้าตาม Role
function redirectToDashboard(role) {
  if (role === "hr" || role === "admin") {
    window.location.href = "/home.html";
  } else {
    window.location.href = "/pages/user/index-user.html";
  }
}

/* ==========================================================================
   👁️ ฟังก์ชันเปิด-ปิด ดวงตาดูรหัสผ่าน
   ========================================================================== */
window.togglePassword = function () {
  const input = document.getElementById("password");
  const icon = document.querySelector(".toggle-password");

  if (input && icon) {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    icon.textContent = isPassword ? "visibility" : "visibility_off";
  }
};

/* ==========================================================================
   📸 ระบบสแกน QR Code ล็อกอิน
   ========================================================================== */
window.loginByQr = function () {
  if (typeof Html5QrcodeScanner === 'undefined') {
    Swal.fire('ข้อผิดพลาด', 'ไม่พบระบบสแกน QR Code กรุณารีเฟรชหน้าเว็บอีกครั้ง', 'error');
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
            }).catch(console.error);
          }, () => {});

        } catch(e) {
          console.error("สแกนเนอร์ทำงานขัดข้อง:", e);
        }
      }, 300);
    },
    willClose: () => {
      if (window.pvtHtml5QrcodeScanner) {
        window.pvtHtml5QrcodeScanner.clear().catch(console.error);
      }
    }
  });
};

async function executeSecureQrLogin(scannedData) {
  Swal.fire({
    title: '🔒 กำลังตรวจสอบข้อมูล...',
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
      .maybeSingle();

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

/* ==========================================================================
   📘 ฟังก์ชันเปิด-ปิด กล่องคู่มือ
   ========================================================================== */
window.toggleInstructions = function () {
  const content = document.getElementById("instructionsContent");
  const arrow = document.getElementById("instructionArrow");

  if (content && arrow) {
    content.classList.toggle("active");
    arrow.textContent = content.classList.contains("active") ? "expand_less" : "expand_more";
  }
};

