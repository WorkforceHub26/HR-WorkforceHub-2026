/* ==========================================================================
   🔒 PVT HR LEAVE - auth-guard.js (เวอร์ชันแก้ไขสมบูรณ์ วางทับได้ทันที)
   ========================================================================== */

// 🟢 Helper สำหรับดึง Supabase Client จาก SDK ป้องกัน Error
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
  // ⚡ [ระบบ AUTO-LOGIN]: ตรวจสอบ URL Parameter จากการสแกน QR Code
  // =========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const autoPayload = urlParams.get("auto_login");

  if (autoPayload) {
    executeSecureQrLogin(autoPayload);
    return;
  }

  // =========================================================================
  // 🔑 [ระบบ LOGIN แบบกรอกข้อมูล]: Form Submit
  // =========================================================================
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
      let queryRes;
      let baseQuery = sb.from("employees").select("id, employee_code, full_name, role, status, password");

      // 🧠 Smart Detect คัดกรองประเภทข้อมูลนำเข้า (อีเมล / เบอร์โทร-รหัสพนักงาน / ชื่อ-สกุล)
      if (loginInput.includes("@")) {
        queryRes = await baseQuery.eq("email", loginInput);
      } else if (/^\d+$/.test(loginInput)) {
        queryRes = await baseQuery.or(`employee_code.eq.${loginInput},phone.eq.${loginInput}`);
      } else {
        queryRes = await baseQuery.eq("full_name", loginInput);
      }

      if (queryRes.error) {
        throw new Error("ไม่สามารถค้นหาข้อมูลได้: " + queryRes.error.message);
      }

      const users = queryRes.data || [];

      if (users.length === 0) {
        throw new Error("ไม่พบข้อมูลพนักงานในระบบ (โปรดตรวจสอบ รหัส/ชื่อ/อีเมล/เบอร์โทร อีกครั้ง)");
      }

      if (users.length > 1) {
        throw new Error("พบชื่อ-นามสกุลนี้ซ้ำกันในระบบหลายคน กรุณาใช้ 'รหัสพนักงาน' ในการเข้าสู่ระบบแทน");
      }

      const user = users[0];

      // 1. ตรวจสอบรหัสผ่าน
      if (String(user.password || "").trim() !== String(password).trim()) {
        throw new Error("รหัสผ่านไม่ถูกต้อง");
      }

      // 2. ตรวจสอบสถานะบัญชี
      if (String(user.status || "").trim().toLowerCase() !== "active") {
        throw new Error(`บัญชีของคุณถูกระงับ (สถานะในฐานข้อมูลคือ: ${user.status})`);
      }

      // 3. ตรวจสอบกรณีใช้งานรหัสผ่านเริ่มต้น (รหัสพนักงาน = รหัสผ่าน)
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
          openChangePasswordModal(user);
          return;
        }
      }

      // บันทึก Session และเปลี่ยนหน้า
      saveUserSession(user);

      if (window.PVTLogger) {
        window.PVTLogger.info("LOGIN_SUCCESS", `${user.full_name} เข้าสู่ระบบสำเร็จ`);
      }

      redirectToDashboard(user.role);

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: err.message,
        confirmButtonColor: '#ef4444',
        timer: 3000
      });
    }
  });
});

/* ==========================================================================
   🔗 Helper Functions & Navigation Security
   ========================================================================== */

function redirectToDashboard(role) {
  // ทุกบทบาท (รวมถึง HR และ Admin) ให้เข้าหน้าหลักพนักงาน (/pages/user/index-user.html) เหมือนพนักงานทั่วไป
  const targetPath = "/pages/user/index-user.html";

  // ⚡ ใช้ location.replace แบบกำหนด origin ครบถ้วน 
  // เพื่อล้างค่า ?auto_login=... ออกจาก URL และบังคับย้ายหน้าทันทีโดยไม่ต้องกด Refresh
  const targetUrl = new URL(targetPath, window.location.origin).href;

  if (window.location.href !== targetUrl) {
    window.location.replace(targetUrl);
  } else {
    // กรณีที่อยู่ที่หน้านั้นอยู่แล้ว ให้ล้าง Query String แล้วสั่ง Reload หน้า
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  }
}

function isSessionValid() {
  const rawSession = localStorage.getItem("currentUser");
  if (!rawSession) return false;

  try {
    const sessionData = JSON.parse(rawSession);
    if (!sessionData || typeof sessionData !== "object" || !sessionData.id || !sessionData.role) {
      localStorage.removeItem("currentUser");
      return false;
    }

    const currentTime = new Date().getTime();
    if (sessionData.expireAt && currentTime > sessionData.expireAt) {
      localStorage.removeItem("currentUser");
      return false;
    }

    return true;
  } catch (err) {
    console.error("isSessionValid Error:", err);
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

/* ==========================================================================
   📱 ⚡ Dynamic QR Login Process (สแกน / ถอดรหัส 30 วินาที)
   ========================================================================== */

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
    let rawPayload = decodeURIComponent(scannedData).trim();

    // กรณีสแกนได้ทั้ง URL ให้สกัดเอาเฉพาะพารามิเตอร์ auto_login
    if (rawPayload.includes("auto_login=")) {
      const urlObj = new URL(rawPayload);
      rawPayload = urlObj.searchParams.get("auto_login") || rawPayload;
    }

    let empCode = "";
    let timeBlock = null;

    // 1. ถอดรหัส Token จาก Base64 (โครงสร้าง empCode|timeBlock)
    try {
      const decodedStr = atob(rawPayload);
      const parts = decodedStr.split('|');
      if (parts.length >= 2) {
        empCode = parts[0];
        timeBlock = parts[1];
      } else {
        throw new Error();
      }
    } catch (e) {
      throw new Error("⛔ QR Code ไม่ถูกต้องหรือไม่อยู่ในรูปแบบความปลอดภัยที่กำหนด");
    }

    // 2. ตรวจสอบเวลา Dynamic Block (30 วินาที ยอมรับความต่างไม่เกิน 1 บล็อก)
    const currentTimeBlock = Math.floor(Date.now() / 30000);
    const timeDiff = Math.abs(currentTimeBlock - Number(timeBlock));

    if (!timeBlock || timeDiff > 1) { 
      throw new Error("⏰ QR Code นี้หมดอายุแล้ว กรุณาเปิด QR Code บนบัตรใหม่อีกครั้ง");
    }

    // 3. ดึงข้อมูลพนักงานจาก Supabase
    const { data: user, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .eq('employee_code', empCode)
      .maybeSingle();

    if (error || !user) throw new Error("ไม่พบข้อมูลพนักงานท่านนี้ในระบบ");
    if (user.status !== "active") throw new Error("บัญชีของคุณถูกระงับสิทธิ์การใช้งาน");

    // บันทึก Session และนำทางเข้าสู่ระบบ
    saveUserSession(user);

    Swal.fire({
      icon: 'success',
      title: `ยินดีต้อนรับ ${user.full_name}`,
      timer: 1200,
      showConfirmButton: false
    });

    setTimeout(() => redirectToDashboard(user.role), 1200);

  } catch (err) {
    Swal.fire({ 
      icon: 'error', 
      title: 'เข้าสู่ระบบไม่สำเร็จ', 
      text: err.message,
      confirmButtonColor: '#ef4444' 
    });
  }
}

// เปิดกล้อง / เลือกรูปเพื่อสแกน QR
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

/* ==========================================================================
   💾 Session & Utility Modals
   ========================================================================== */

function saveUserSession(userData, expireInHours = 12) {
  if (!userData || typeof userData !== "object") return false;

  const cleanUser = { ...userData };
  delete cleanUser.password;

  const currentTime = new Date().getTime();
  const sessionPayload = {
    id: cleanUser.id || "",
    employee_code: cleanUser.employee_code || "",
    full_name: cleanUser.full_name || "",
    role: cleanUser.role || "user",
    status: cleanUser.status || "active",
    createdAt: currentTime,
    expireAt: currentTime + (expireInHours * 60 * 60 * 1000)
  };

  try {
    localStorage.setItem("currentUser", JSON.stringify(sessionPayload));
    return true;
  } catch (err) {
    console.error("saveUserSession Error:", err);
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
      <p class="text-sm text-gray-600 mb-4" style="font-size:13px; color:#64748b;">เนื่องจากรหัสผ่านปัจจุบันเป็นรหัสผ่านเริ่มต้น กรุณากำหนดรหัสผ่านใหม่ก่อนเข้าใช้งาน</p>
      <div style="text-align:left;">
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">รหัสผ่านใหม่</label>
          <input id="swal-new-password" type="password" class="swal2-input" style="width:100%; margin:0; box-sizing:border-box;" placeholder="อย่างน้อย 6 ตัวอักษร">
        </div>
        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#374151; margin-bottom:4px;">ยืนยันรหัสผ่านใหม่</label>
          <input id="swal-confirm-password" type="password" class="swal2-input" style="width:100%; margin:0; box-sizing:border-box;" placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง">
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

// 📱 Global Mobile & Desktop Sidebar Navigation Helper
(function initGlobalSidebar() {
  function getBackdrop() {
    let backdrop = document.querySelector(".mobile-sidebar-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "mobile-sidebar-backdrop";
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", () => {
        window.toggleMobileSidebar(false);
      });
    }
    return backdrop;
  }

  window.toggleMobileSidebar = function(forceState) {
    const sidebar = document.querySelector(".sidebar-light") || document.querySelector(".sidebar") || document.querySelector("aside");
    const backdrop = getBackdrop();
    if (!sidebar) return;

    const shouldOpen = typeof forceState === "boolean" ? forceState : !sidebar.classList.contains("mobile-open");
    if (shouldOpen) {
      sidebar.classList.add("mobile-open");
      sidebar.classList.remove("collapsed");
      backdrop.classList.add("active");
      document.body.classList.add("sidebar-open");
    } else {
      sidebar.classList.remove("mobile-open");
      backdrop.classList.remove("active");
      document.body.classList.remove("sidebar-open");
    }
  };

  window.toggleSidebar = function() {
    if (window.innerWidth <= 1024) {
      window.toggleMobileSidebar();
    } else {
      const sidebar = document.querySelector(".sidebar-light") || document.querySelector(".sidebar") || document.querySelector("aside");
      const mainContent = document.querySelector(".main-content");
      if (sidebar) {
        sidebar.classList.toggle("collapsed");
      }
      if (mainContent) {
        mainContent.classList.toggle("expanded");
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    getBackdrop();

    document.querySelectorAll(".mobile-menu-btn, .btn-menu-toggle, #toggleSidebar").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.toggleSidebar();
      });
    });

    // Close mobile drawer when clicking navigation links on mobile
    document.querySelectorAll(".nav-menu .nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth <= 1024) {
          window.toggleMobileSidebar(false);
        }
      });
    });
  });
})();

// =========================================================================
// 🎨 [ระบบ Render Profile ส่วนกลาง]: สำหรับแสดงรูป โปรไฟล์ และตำแหน่งบน Topbar ของทุกหน้า
// =========================================================================

async function renderGlobalUserProfile() {
  const sessionUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  if (!sessionUser || !sessionUser.id) return;
  
  let profileData = window.currentProfile || window.currentUserProfile || sessionUser;
  
  // พยายามดึงข้อมูลฉบับเต็มจาก DB ถ้าขาดรูปหรือแผนก
  if (!profileData.image_url || !profileData.department_name) {
    const sb = getSbClient();
    if (sb) {
      try {
         const { data, error } = await sb.from('employees').select('*, departments(*), positions(*)').eq('id', sessionUser.id).single();
         if (data) {
           profileData = data;
           window.currentUserProfile = data; // Cache
           
           // อัปเดต localStorage ให้มีข้อมูลมากขึ้น
           const updatedSession = { ...sessionUser, image_url: data.image_url, department_name: data.departments?.department_name || data.department_name, position_name: data.positions?.position_name || data.position_name };
           localStorage.setItem("currentUser", JSON.stringify(updatedSession));
         }
      } catch (e) {}
    }
  }

  const fullName = profileData.full_name || sessionUser.full_name || "ผู้ใช้งาน";
  
  // ตำแหน่งและแผนก
  let rawRole = (profileData.role || sessionUser.role || "user").toLowerCase();
  let roleName = "พนักงาน";
  if (rawRole === "admin" || rawRole === "hr") roleName = "ผู้ดูแลระบบ";
  else if (rawRole === "manager") roleName = "ผู้จัดการฝ่าย";
  else if (rawRole === "leader") roleName = "หัวหน้างาน";
  else if (rawRole === "executive" || rawRole === "director" || rawRole === "owner") roleName = "ผู้บริหาร";

  let deptName = profileData.department_name || profileData.departments?.department_name || sessionUser.department_name || "PVT Group";
  if (profileData.position_name) roleName = profileData.position_name;
  else if (profileData.positions?.position_name) roleName = profileData.positions.position_name;
  
  // ดึงรูปโปรไฟล์ (ถ้ามี)
  let avatarUrl = profileData.image_url || profileData.avatar_url || profileData.employees?.image_url || sessionUser.image_url || null;
  if (avatarUrl && window.PVTSDK?.storage?.getAvatarUrl) {
    avatarUrl = window.PVTSDK.storage.getAvatarUrl(avatarUrl);
  } else if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
     const sb = getSbClient();
     if (sb) {
       const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(avatarUrl);
       if (publicUrl) avatarUrl = publicUrl;
     }
  }
  
  // จัดการ Avatar ทุกจุดบนหน้าเว็บ
  document.querySelectorAll('.user-profile').forEach(container => {
    let html = "";
    
    // รูปภาพ
    if (avatarUrl) {
      html += `<img src="${avatarUrl}" class="avatar" style="object-fit: cover;" onerror="this.onerror=null;this.src='/assets/img/default-avatar.jpg';this.outerHTML='<div class=\'avatar avatar-badge\'>${fullName.substring(0,2)}</div>';">`;
    } else {
      let initials = "U";
      if (rawRole === "admin" || rawRole === "hr") initials = "HR";
      else initials = fullName.substring(0, 2);
      html += `<div class="avatar avatar-badge">${initials}</div>`;
    }
    
    html += `
      <div class="info" style="display: flex; flex-direction: column; text-align: left; margin-left: 10px;">
        <strong style="font-size: 0.9rem; color: var(--text-main); white-space: nowrap;">${fullName}</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">${roleName} | ${deptName}</span>
      </div>
    `;
    
    container.innerHTML = html;
    container.style.display = "flex";
    container.style.alignItems = "center";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderGlobalUserProfile();
});
