/* ==========================================================================
   🔒 PVT HR LEAVE - auth-guard.js (ระบบความปลอดภัยและการควบคุมสิทธิ์สูงสุด)
   ========================================================================== */

// 🟢 Helper สำหรับดึง Supabase Client จาก SDK ป้องกัน Error
function getSbClient() {
  return window.pvtSupabase?.client 
      || window.PVTSDK?.client 
      || window.supabaseClient 
      || window.supabase;
}

// 🟢 ตรวจสอบกลุ่มสิทธิ์ของผู้ใช้ (Role Classifier)
window.getUserRoleCategory = function(userSession) {
  if (!userSession || (!userSession.id && !userSession.employee_code)) return { isAuth: false, category: 'guest' };

  // ดึงข้อมูลพนักงานทั้งกรณี Flat และ Nested Object
  const emp = userSession.employees || userSession;
  const role = String(userSession.role || emp.role || '').toLowerCase().trim();
  const position = String(
    userSession.position_name || 
    userSession.position || 
    userSession.positions?.position_name || 
    emp.position_name || 
    emp.positions?.position_name || ''
  ).toLowerCase().trim();
  const dept = String(
    userSession.department_name || 
    userSession.departments?.department_name || 
    emp.department_name || 
    emp.departments?.department_name || ''
  ).toLowerCase().trim();
  const deptId = String(userSession.department_id || emp.department_id || '');
  const duty = String(userSession.duty_name || emp.duty_name || userSession.positions?.duty_name || emp.positions?.duty_name || '').toLowerCase().trim();
  const code = String(userSession.employee_code || emp.employee_code || '').trim();

  // 0. ตรวจสอบ แม่บ้าน / พ่อบ้าน / คนสวน -> บังคับเป็น employee (พนักงานทั่วไป) เสมอ
  const isServiceStaff = position.includes('แม่บ้าน') || position.includes('พ่อบ้าน') || position.includes('คนสวน') ||
                         duty.includes('แม่บ้าน') || duty.includes('พ่อบ้าน') || duty.includes('คนสวน');
  if (isServiceStaff) {
    return { isAuth: true, category: 'employee', role, position, dept };
  }

  // 1. HR และ ผู้บริหารระดับสูง (HR / Admin / Executive / Director / Owner / บุคคล-ธุรการ) -> สิทธิ์เข้าถึงทุกหน้า 100%
  const isHrOrExecutive = 
    role === 'hr' || role === 'admin' || role === 'superadmin' || role === 'executive' || role === 'director' || role === 'owner' || role === 'hr_manager' ||
    role.includes('hr') || role.includes('admin') || role.includes('superadmin') || role.includes('executive') || role.includes('director') || role.includes('owner') ||
    role === 'ผู้บริหาร' || role === 'ผู้อำนวยการ' || role === 'เจ้าของ' || role.includes('บุคคล') ||
    code === '19122' || code === '19128' || code === '10001' || // รหัส HR (ผู้จัดการ/เจ้าหน้าที่) และผู้บริหาร
    dept.includes('บุคคล') || dept.includes('ธุรการ') || dept.includes('hr') || dept.includes('human') ||
    position.includes('บุคคล') || position.includes('hr') || position.includes('ธุรการ') ||
    duty.includes('บุคคล') || duty.includes('ธุรการ') || duty.includes('hr') ||
    deptId === 'e494e865-689d-432b-9dd4-1ab32125105f' || // แผนก บุคคล-ธุรการ
    position.includes('ผู้บริหาร') || position.includes('ผู้อำนวยการ') || position.includes('เจ้าของ') || position.includes('director') || position.includes('executive') || position.includes('owner');

  if (isHrOrExecutive) {
    return { isAuth: true, category: 'hr_exec', role, position, dept };
  }

  // 2. หัวหน้างาน และ ผู้จัดการแผนก (Leader / Manager / Supervisor)
  const isManagerOrLeader = 
    role === 'manager' || role === 'leader' || role === 'supervisor' || role === 'head' ||
    role.includes('manager') || role.includes('leader') || role.includes('supervisor') ||
    role.includes('หัวหน้า') || role.includes('ผู้จัดการ') ||
    position.includes('manager') || position.includes('leader') || position.includes('supervisor') ||
    position.includes('หัวหน้า') || position.includes('ผู้จัดการ');

  if (isManagerOrLeader) {
    return { isAuth: true, category: 'leader_manager', role, position, dept };
  }

  // 3. พนักงานทั่วไป (Employee / Staff)
  return { isAuth: true, category: 'employee', role, position, dept };
};

// =========================================================================
// 🔒 [GLOBAL AUTH GUARD]: ตรวจสอบสิทธิ์ทันทีแบบ Synchronous
// =========================================================================
(function enforceSecurity() {
  let session = null;
  try {
    const raw = localStorage.getItem("currentUser");
    session = raw ? JSON.parse(raw) : null;
  } catch (e) {
    session = null;
  }

  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path === "/" || path === "/index.html" || (path.endsWith("/index.html") && !path.includes("/pages/"));
  const isHrArea = path.includes("/pages/hr/");
  const isManagementOrSettings = path.includes("management") || path.includes("approval-settings") || path.includes("test.html");

  const userStatus = window.getUserRoleCategory(session);

  // 1. กรณีไม่มี Session / ยังไม่ล็อกอิน
  if (!userStatus.isAuth) {
    if (!isLoginPage) {
      console.warn("🚫 [Auth Guard]: ยังไม่ได้เข้าสู่ระบบ -> เด้งไปหน้า Login");
      try { if (document.body) document.body.innerHTML = ''; } catch(e){}
      const currentSearch = window.location.search || "";
      const originalPage = encodeURIComponent(window.location.pathname + currentSearch);
      window.location.replace("/index.html?redirect=" + originalPage);
    }
    return;
  }

  // 2. กรณีล็อกอินแล้ว แต่อยู่หน้า Login -> ส่งไปหน้าแรกตามสิทธิ์
  if (isLoginPage) {
    console.log("✅ [Auth Guard]: ล็อกอินแล้ว -> นำทางไปหน้าแรกตามสิทธิ์");
    const urlParams = new URLSearchParams(window.location.search);
    const redirectUrl = urlParams.get("redirect");
    if (redirectUrl) {
      const decodedRedirect = decodeURIComponent(redirectUrl);
      if (decodedRedirect.startsWith("/") && !decodedRedirect.startsWith("//")) {
        window.location.replace(decodedRedirect);
        return;
      }
    }
    if (userStatus.category === 'hr_exec') {
      window.location.replace("/pages/hr/home.html");
    } else if (userStatus.category === 'leader_manager') {
      window.location.replace("/pages/hr/hr.html");
    } else {
      window.location.replace("/pages/user/index-user.html");
    }
    return;
  }

  // 🔒 ควบคุมการเข้าถึงหน้า home.html ให้เข้าได้เฉพาะ HR และ หัวหน้างาน / ผู้จัดการ
  const isHomeHtmlPage = path.includes("home.html");
  if (isHomeHtmlPage && userStatus.category !== 'hr_exec' && userStatus.category !== 'leader_manager') {
    console.warn("🚫 [Auth Guard]: เฉพาะสิทธิ์ HR และ หัวหน้างาน/ผู้จัดการเท่านั้นที่เข้าถึงหน้าหลัก Dashboard ได้");
    try { if (document.body) document.body.innerHTML = ''; } catch(e){}
    window.location.replace("/pages/user/index-user.html");
    return;
  }

  // 3. กรณีพนักงานธรรมดา (Employee)
  if (userStatus.category === 'employee') {
    if (isHrArea) {
      console.warn("🚫 [Auth Guard]: พนักงานทั่วไปไม่มีสิทธิ์เข้าโซน HR -> เด้งไปหน้าพนักงาน");
      try { if (document.body) document.body.innerHTML = ''; } catch(e){}
      window.location.replace("/pages/user/index-user.html");
      return;
    }
  }

  // 4. กรณีหัวหน้างาน / ผู้จัดการ (Leader / Manager)
  if (userStatus.category === 'leader_manager') {
    if (path.includes("management")) {
      console.warn("🚫 [Auth Guard]: หัวหน้า/ผู้จัดการไม่มีสิทธิ์เข้าหน้าจัดการประวัติพนักงาน -> เด้งไปหน้าตรวจใบลา");
      try { if (document.body) document.body.innerHTML = ''; } catch(e){}
      window.location.replace("/pages/hr/hr.html");
      return;
    }
  }
})();

// 🎨 ซ่อนเมนูที่ไม่มีสิทธิ์เข้าถึงออกจาก UI ทันที
function applyNavPermissions() {
  try {
    const raw = localStorage.getItem("currentUser");
    const session = raw ? JSON.parse(raw) : null;
    const userStatus = window.getUserRoleCategory(session);

    if (userStatus.category === 'employee') {
      // พนักงานทั่วไป: ซ่อนหลังบ้านทั้งหมด
      const selectors = [
        'a[href*="home.html"]',
        'a[href*="hr.html"]',
        'a[href*="management"]',
        'a[href*="approval-settings"]',
        '.btn-card-nav',
        '.hover-card-qr',
        '.quick-card[href*="management"]',
        '[data-role="hr-only"]'
      ];
      document.querySelectorAll(selectors.join(', ')).forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    } else if (userStatus.category === 'leader_manager') {
      // หัวหน้า/ผู้จัดการ: เข้าได้ทุกหน้า ยกเว้นแก้ไขประวัติพนักงาน (management) และ สิทธิ์เฉพาะ HR (hr-only)
      const selectors = [
        'a[href*="management"]',
        '.quick-card[href*="management"]',
        '[data-role="hr-only"]'
      ];
      document.querySelectorAll(selectors.join(', ')).forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    }
  } catch (err) {
    console.error("applyNavPermissions error:", err);
  }
}

document.addEventListener("DOMContentLoaded", applyNavPermissions);


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
      let baseQuery = sb.from("employees").select("id, employee_code, full_name, role, status, password, department_id, position_id, image_url, departments!department_id(department_name), positions(position_name, level_type, duty_name)");

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

      // 🔒 บันทึกประวัติการเข้าสู่ระบบไปยัง Supabase 'login_logs' สำหรับตรวจสอบ (Audit Purposes)
      try {
        if (typeof recordLoginLog === 'function') {
          recordLoginLog(user, { method: 'password' });
        } else if (window.PVTSDK?.loginAudit?.recordLoginLog) {
          window.PVTSDK.loginAudit.recordLoginLog(user, { method: 'password' });
        }
      } catch (logErr) {
        console.warn("⚠️ [Login Audit Log] Notice recording login:", logErr);
      }

      if (window.PVTLogger) {
        window.PVTLogger.info("LOGIN_SUCCESS", `${user.full_name} เข้าสู่ระบบสำเร็จ`);
      }

      redirectToDashboard(user.role, user);

    } catch (err) {
      const card = document.querySelector('.login-card');
      if (card) {
        card.classList.remove('shake');
        void card.offsetWidth;
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 600);
      }
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

function redirectToDashboard(role, userObj) {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get("redirect");
  if (redirectUrl) {
    const decodedRedirect = decodeURIComponent(redirectUrl);
    if (decodedRedirect.startsWith("/") && !decodedRedirect.startsWith("//")) {
      window.location.replace(decodedRedirect);
      return;
    }
  }

  const cleanRole = String(role || '').toLowerCase().trim();
  let userStatus = { category: 'employee' };
  if (typeof window.getUserRoleCategory === "function") {
    userStatus = window.getUserRoleCategory(userObj || { role: cleanRole });
  }

  let targetPath = "/pages/user/index-user.html";
  if (userStatus.category === 'hr_exec') {
    targetPath = "/pages/hr/home.html";
  } else if (userStatus.category === 'leader_manager') {
    targetPath = "/pages/hr/hr.html";
  } else {
    const adminRoles = ['executive', 'director', 'owner', 'hr', 'admin', 'superadmin', 'manager', 'leader', 'supervisor', 'head', 'ผู้บริหาร', 'ผู้อำนวยการ', 'เจ้าของ', 'หัวหน้า', 'ผู้จัดการ'];
    const isAdminRole = adminRoles.some(r => cleanRole.includes(r));
    if (isAdminRole) {
      targetPath = "/pages/hr/hr.html";
    }
  }
  
  const targetUrl = new URL(targetPath, window.location.origin).href;

  if (window.location.href !== targetUrl) {
    window.location.replace(targetUrl);
  } else {
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
   📱 ⚡ Dynamic QR Login Process (สแกน / ถอดรหัสยืดหยุ่นรองรับทุกรูปแบบ)
   ========================================================================== */

function extractEmployeeCodeFromScannedData(scannedData) {
  if (!scannedData) return "";
  let raw = String(scannedData).trim();

  // 1. ถอด URL Encoded ดั้งเดิม
  try {
    if (raw.includes("%")) {
      raw = decodeURIComponent(raw);
    }
  } catch (e) {}

  // 2. ถ้าเป็น URL สมบูรณ์ หรือมีพารามิเตอร์ auto_login, token, code ฯลฯ
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.includes("?") || raw.includes("&") || raw.includes("auto_login=") || raw.includes("token=")) {
    try {
      let searchStr = raw;
      if (raw.includes("?")) {
        searchStr = raw.substring(raw.indexOf("?"));
      } else if (!raw.startsWith("?")) {
        searchStr = "?" + raw;
      }
      const params = new URLSearchParams(searchStr);
      const keys = ["auto_login", "token", "code", "emp_code", "employee_code", "emp", "id", "user"];
      for (const k of keys) {
        const val = params.get(k);
        if (val && val.trim() !== "PVT_SECURE_BYPASS") {
          raw = val.trim();
          break;
        }
      }
    } catch (e) {
      const match = raw.match(/[?&](?:auto_login|token|code|emp_code|employee_code|emp)=([^&#]+)/i);
      if (match && match[1]) {
        raw = decodeURIComponent(match[1]).trim();
      }
    }
  }

  // 3. ถ้าเป็น JSON string
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw);
      const code = parsed.employee_code || parsed.empCode || parsed.code || parsed.emp_code || parsed.id;
      if (code) return String(code).trim();
    } catch (e) {}
  }

  // 4. ถ้าเป็น Base64 หรือโครงสร้าง code|timeBlock
  try {
    if (raw.includes("|")) {
      const parts = raw.split("|");
      if (parts[0] && parts[0].trim()) return String(parts[0]).trim();
    }
    if (raw.length > 20 || raw.includes("=") || raw.includes("-") || raw.includes("_")) {
      let base64 = raw.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      let decodedStr = atob(base64);
      if (decodedStr && decodedStr.includes("%")) {
        try { decodedStr = decodeURIComponent(decodedStr); } catch (e) {}
      }
      
      if (decodedStr && decodedStr.includes("|")) {
        const parts = decodedStr.split("|");
        if (parts[0] && parts[0].trim()) return String(parts[0]).trim();
      }
    }
  } catch (e) {}

  // 5. ลบอักขระตกค้าง
  raw = raw.replace(/^[?&=]+/, "").trim();

  return raw;
}

async function executeSecureQrLogin(scannedData) {
  if (!scannedData) return;

  Swal.fire({
    title: '🔒 กำลังตรวจสอบข้อมูล...',
    text: 'ระบบกำลังตรวจสอบความถูกต้องของ QR Code บนบัตร',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const sb = getSbClient();
  if (!sb) {
    Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
    return;
  }

  try {
    const empCode = extractEmployeeCodeFromScannedData(scannedData);

    if (!empCode) {
      throw new Error("ไม่พบรหัสพนักงานใน QR Code กรุณาลองใหม่อีกครั้ง");
    }

    // ค้นหาพนักงานในฐานข้อมูลด้วย employee_code (Case-Insensitive)
    let { data: users, error } = await sb
      .from('employees')
      .select('id, employee_code, full_name, role, status')
      .ilike('employee_code', empCode);

    if (error) throw new Error("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: " + error.message);

    // Fallback: ถ้าไม่พบ ลองค้นหาด้วยรหัสที่เติม 0 หรือเบอร์โทร
    if (!users || users.length === 0) {
      const { data: fallbackUsers } = await sb
        .from('employees')
        .select('id, employee_code, full_name, role, status')
        .or(`employee_code.eq.${empCode},employee_code.eq.${empCode.padStart(4, '0')},phone.eq.${empCode}`);
      
      if (fallbackUsers && fallbackUsers.length > 0) {
        users = fallbackUsers;
      }
    }

    if (!users || users.length === 0) {
      throw new Error(`ไม่พบข้อมูลพนักงานรหัส "${empCode}" ในระบบ`);
    }

    const user = users[0];

    if (String(user.status || "").toLowerCase() !== "active") {
      throw new Error("บัญชีของคุณถูกระงับสิทธิ์การใช้งาน (สถานะ: " + (user.status || "inactive") + ")");
    }

    // 📸 บันทึกประวัติการสแกน QR Code เข้าสู่ตาราง qr_attendance_logs สำหรับ Audit
    try {
      if (typeof window.recordQrAttendanceLog === 'function') {
        await window.recordQrAttendanceLog(user.id, {
          scanned_data: scannedData,
          scan_type: 'login_qr_scan',
          status: 'success',
          employee_code: user.employee_code
        });
      } else if (window.PVTSDK?.attendance?.recordQrAttendanceLog) {
        await window.PVTSDK.attendance.recordQrAttendanceLog(user.id, {
          scanned_data: scannedData,
          scan_type: 'login_qr_scan',
          status: 'success',
          employee_code: user.employee_code
        });
      }
    } catch (logErr) {
      console.warn("⚠️ [QR Audit Log] Warning logging QR attendance:", logErr);
    }

    // บันทึก Session และนำทางเข้าสู่ระบบ
    saveUserSession(user);

    // 🔒 บันทึกประวัติการเข้าสู่ระบบผ่าน QR Code ไปยัง Supabase 'login_logs' สำหรับตรวจสอบ (Audit Purposes)
    try {
      if (typeof recordLoginLog === 'function') {
        recordLoginLog(user, { method: 'qr_code', metadata: { scanned_data: scannedData } });
      } else if (window.PVTSDK?.loginAudit?.recordLoginLog) {
        window.PVTSDK.loginAudit.recordLoginLog(user, { method: 'qr_code', metadata: { scanned_data: scannedData } });
      }
    } catch (logErr) {
      console.warn("⚠️ [Login Audit Log] Notice recording QR login:", logErr);
    }

    Swal.fire({
      icon: 'success',
      title: 'ยินดีต้อนรับ',
      html: `
        <div style="font-size: 16px; font-weight: 600; color: #0f172a; margin-top: 4px;">${user.full_name}</div>
        <div style="font-size: 13px; color: #0fa472; margin-top: 2px;">รหัสพนักงาน: ${user.employee_code}</div>
      `,
      timer: 1200,
      showConfirmButton: false
    }).then(() => {
      redirectToDashboard(user.role);
    });

  } catch (err) {
    Swal.fire({ 
      icon: 'error', 
      title: 'เข้าสู่ระบบไม่สำเร็จ', 
      text: err.message || 'ไม่สามารถยืนยันข้อมูลจาก QR Code ได้',
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

      const camStatus = window.SystemDiagnostics?.lastCameraResult;

      const startCamera = async () => {
        if (camStatus && !camStatus.isSupported) {
          Swal.showValidationMessage ? Swal.showValidationMessage('⚠️ เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง โปรดใช้ปุ่มเลือกรูปภาพ') : null;
          return;
        }

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
          // If camera failed, advise switching to file upload
          if (btnFile) btnFile.click();
        }
      };

      const stopCamera = async () => {
        if (isCamRunning) {
          await html5QrCode.stop();
          isCamRunning = false;
        }
      };

      if (camStatus && !camStatus.isSupported) {
        btnFile.style.background = '#2563eb';
        btnCam.style.background = '#4b5563';
        camBox.style.display = 'none';
        fileBox.style.display = 'block';
      } else {
        startCamera();
      }

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

  const deptName = cleanUser.department_name || cleanUser.departments?.department_name || "";
  const posName = cleanUser.position_name || cleanUser.positions?.position_name || "";
  const dutyName = cleanUser.duty_name || cleanUser.positions?.duty_name || "";

  const currentTime = new Date().getTime();
  const sessionPayload = {
    id: cleanUser.id || "",
    employee_code: cleanUser.employee_code || "",
    full_name: cleanUser.full_name || "",
    role: cleanUser.role || "user",
    status: cleanUser.status || "active",
    department_id: cleanUser.department_id || "",
    position_id: cleanUser.position_id || "",
    department_name: deptName,
    position_name: posName,
    duty_name: dutyName,
    image_url: cleanUser.image_url || "",
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
  let lastToggleTime = 0;

  function getBackdrop() {
    let backdrop = document.querySelector(".mobile-sidebar-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "mobile-sidebar-backdrop";
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.toggleMobileSidebar(false);
      });
    }
    return backdrop;
  }

  function ensureSidebarCloseBtn() {
    const sidebar = document.querySelector(".sidebar-light") || document.querySelector(".sidebar") || document.querySelector("aside");
    if (!sidebar) return;
    const brandZone = sidebar.querySelector(".brand-zone");
    if (brandZone && !brandZone.querySelector(".btn-close-sidebar")) {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "btn-close-sidebar";
      closeBtn.setAttribute("aria-label", "ปิดเมนู");
      closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.toggleMobileSidebar(false);
      });
      brandZone.appendChild(closeBtn);
    }
  }

  window.toggleMobileSidebar = function(forceState) {
    const now = Date.now();
    if (typeof forceState !== "boolean" && now - lastToggleTime < 280) {
      return; // Ignore rapid colliding events within same click cycle
    }
    lastToggleTime = now;

    const sidebar = document.querySelector(".sidebar-light") || document.querySelector(".sidebar") || document.querySelector("aside");
    const backdrop = getBackdrop();
    ensureSidebarCloseBtn();
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
      if (typeof window.toggleDesktopSidebar === "function") {
        window.toggleDesktopSidebar();
      } else {
        document.body.classList.toggle('desktop-sidebar-collapsed');
        localStorage.setItem('sidebar-collapsed', document.body.classList.contains('desktop-sidebar-collapsed'));
      }
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    getBackdrop();
    ensureSidebarCloseBtn();

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

    // Close drawer on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        window.toggleMobileSidebar(false);
      }
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
         const { data, error } = await sb.from('employees').select('*, departments!department_id(*), positions(*)').eq('id', sessionUser.id).single();
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


/// =========================================================================
// 🌐 [Centralized Universal Translation Engine & JSON Dictionary] (TH, LO, MY)
// =========================================================================

window.globalAppTranslations = window.globalAppTranslations || {
  th: {
    // Navigation & App Shell
    home: "หน้าหลัก",
    leaveCheck: "ตรวจใบลา",
    employeeManagement: "ระบบจัดการส่วนกลาง & ประวัติพนักงาน",
    employees: "พนักงาน",
    userView: "หน้าพนักงาน",
    holidays: "วันหยุด",
    cardSystem: "ระบบบัตรพนักงาน & QR",
    logout: "ออกจากระบบ",
    logoutShort: "ออก",
    back: "ย้อนกลับ",
    backShort: "กลับ",
    save: "บันทึก",
    cancel: "ยกเลิก",
    confirm: "ยืนยัน",
    close: "ปิด",
    delete: "ลบ",
    edit: "แก้ไข",
    refresh: "รีเฟรชข้อมูลล่าสุด",
    loading: "กำลังโหลดข้อมูล...",
    all: "ทั้งหมด",
    
    // Notifications
    notifications: "การแจ้งเตือน",
    markAllRead: "อ่านทั้งหมด",
    unreadSuffix: "รายการใหม่",
    viewAllNotif: "ดูการแจ้งเตือนทั้งหมด",
    loadingNotif: "กำลังโหลดแจ้งเตือน...",
    
    // User Home Dashboard
    hello: "สวัสดีค่ะ",
    approverModeTitle: "ระบบหัวหน้างาน / HR",
    approverModeSub: "สลับไปหน้าอนุมัติใบลาและจัดการข้อมูล ➜",
    heroLeaveTitle: "ยื่นใบลาออนไลน์",
    heroLeaveSub: "กรอกฟอร์มขออนุญาตลา อนุมัติตามลำดับขั้นไว",
    leaveBalanceTitle: "สิทธิ์วันลาคงเหลือ",
    quickMenuTitle: "เลือกเมนูการใช้งาน",
    ruleTitle: "หลักเกณฑ์การลา",
    ruleSub: "เปิดอ่านเงื่อนไขบริษัท",
    historyTitle: "ประวัติการลา",
    historySub: "ตรวจสอบสถานะใบลา",
    profileTitle: "ข้อมูลพนักงาน",
    profileSub: "ตรวจสอบรหัส ชื่อ และวันเริ่มงาน",
    holidayTitle: "ปฏิทินวันหยุด",
    holidaySub: "วันหยุดประจำปีบริษัท",
    cardTitle: "บัตรพนักงานดิจิทัล",
    cardSub: "แสดง QR Code ประจำตัว",
    guideTitle: "คู่มือการใช้งาน",
    guideSub: "วิธีใช้งานระบบลาออนไลน์",
    lineConnect: "เชื่อมต่อ LINE",
    lineNotif: "รับแจ้งเตือนผ่านมือถือ",
    viewCard: "ดูบัตรพนักงาน",
    recentListHeading: "รายการล่าสุด",
    viewAll: "ดูทั้งหมด",
    loadingLeave: "กำลังโหลดรายการลา...",
    teamTitle: "สมาชิกพนักงานในแผนก",
    teamSub: "เพื่อนร่วมงานในแผนกของคุณ",
    
    // Leave Form (leave-user.html)
    leaveFormTitle: "ใบลาออนไลน์",
    companySubtitle: "บริษัท พี.วี.ที. แอนด์ ที.พลาส จำกัด · ปี 2569",
    periodSubtitle: "วันที่ 1 ธันวาคม – 30 พฤศจิกายน",
    ruleBtnText: "📘 หลักเกณฑ์",
    applicantInfoTitle: "ข้อมูลผู้ขออนุมัติลา",
    autofillBadge: "ระบบดึงข้อมูลอัตโนมัติ",
    empCodeLabel: "รหัสพนักงาน",
    empNameLabel: "ชื่อ-นามสกุล พนักงาน",
    empPosLabel: "ตำแหน่ง",
    empDeptLabel: "แผนก / ฝ่าย",
    empStartLabel: "วันเริ่มงาน",
    leaveBalanceLabel: "สิทธิคงเหลือ",
    leaveBalanceSelectFirst: "กรุณาเลือกประเภทการลาก่อน",
    socialSecurityLabel: "สิทธิประกันสังคม",
    socialSecurityNote: "(เปลี่ยนสิทธิกรุณาแจ้ง HR)",
    lineAlertNotice: "แจ้งเตือนผ่าน LINE: ระบบจะส่งแจ้งเตือนสถานะใบลานี้ไปยัง LINE ของท่านและหัวหน้างานทันทีที่กดส่งคำขอ และเมื่อได้รับการอนุมัติ/ปฏิเสธ",
    checkBeforeSaveNotice: "ตรวจสอบก่อนบันทึก: ลาพักผ่อนล่วงหน้าอย่างน้อย 3 วัน · ลากิจแจ้งล่วงหน้า 1 วัน · ลาป่วยแจ้งภายใน 4 ชั่วโมงแรก พร้อมใบรับรองแพทย์",
    leaveCardContainerTitle: "ใบขออนุญาติลา",
    btnAddLeaveItem: "＋ เพิ่มรายการลา",
    btnSaveLeave: "💾 บันทึกคำขอลา",
    sec1Divider: "หมวดหมู่ที่ 1: วันที่และกรอบเวลาการลา",
    sec2Divider: "หมวดหมู่ที่ 2: รายละเอียดประเภทการลาและหลักฐาน",
    sec3Divider: "หมวดหมู่ที่ 3: จำนวนเวลาและชั่วโมงที่ขอลา",
    sec4Divider: "หมวดหมู่ที่ 4: สถานะผลการพิจารณาและอนุมัติ",
    writeDateLabel: "วันที่เขียนคำขอ",
    startDateLabel: "เริ่มวันที่ลา",
    endDateLabel: "สิ้นสุดวันที่ลา",
    leaveTypeLabel: "ประเภทการลา",
    leaveTypePlaceholder: "-- เลือกประเภทการลา --",
    reasonLabel: "สาเหตุ / เหตุผลการลา",
    reasonPlaceholder: "ระบุเหตุผลความจำเป็น...",
    attachProofLabel: "แนบหลักฐานรูปภาพ",
    selectProofBtn: "📁 เลือกรูปภาพหลักฐาน",
    hoursMorningLabel: "จำนวนชั่วโมงเช้า (0-4)",
    hoursAfternoonLabel: "จำนวนชั่วโมงบ่าย (0-4)",
    totalDurationLabel: "สรุปรวมระยะเวลาที่ขอลา",
    deptHeadLabel: "หัวหน้าแผนก",
    deptManagerLabel: "ผู้จัดการฝ่าย",
    hrDeptLabel: "ฝ่ายบุคคล",
    btnRemoveItem: "ลบรายการนี้",
    formGuideTitle: "วิธีกรอกแบบฟอร์มใบลา",
    formGuideFab: "แนะนำการกรอกฟอร์ม",
    
    // Leave History (leave-history.html)
    historyPageTitle: "ประวัติการลาของฉัน",
    statAll: "ทั้งหมด",
    statPending: "รออนุมัติ",
    statApproved: "อนุมัติแล้ว",
    statCancelReq: "รอ HR ยกเลิก",
    statTotalDays: "วันลารวมที่ใช้",
    filterTitle: "กรองรายการ:",
    chipAll: "ทั้งหมด",
    chipPending: "รออนุมัติ",
    chipApproved: "อนุมัติแล้ว",
    chipCancelReq: "🔄 รอ HR ยกเลิก",
    chipRejectedCancelled: "❌ ไม่อนุมัติ / ยกเลิกแล้ว",
    thLeaveType: "ประเภทการลา",
    thDateRange: "ช่วงวันที่",
    thDays: "จำนวนวัน",
    thReason: "เหตุผลการลา",
    thStatus: "สถานะ",
    thAction: "จัดการคำขอ",
    btnDirectCancel: "ยกเลิกคำขอ",
    btnRequestCancel: "ขอยกเลิกใบลา",
    badgeWaitingHr: "ส่งเรื่องแล้ว",
    reasonCancelPrefix: "เหตุผลที่ยกเลิก:",
    reasonRejectPrefix: "เหตุผลที่ไม่อนุมัติ:",
    emptyHistory: "ไม่พบรายการใบลาตามเงื่อนไขที่เลือก",
    emptyHistoryLogin: "กรุณาเข้าสู่ระบบเพื่อดูประวัติการลา",
    
    // Profile Page (profile-user.html)
    profilePageTitle: "ข้อมูลพนักงาน",
    profilePageSub: "ตรวจสอบข้อมูลโปรไฟล์และการแจ้งเตือน LINE",
    profileDetailsHeading: "รายละเอียดโปรไฟล์",
    lblFullName: "ชื่อ-นามสกุล",
    lblEmpCode: "รหัสพนักงาน",
    lblDept: "ฝ่าย / แผนก",
    lblPos: "ตำแหน่งงาน",
    lblEmail: "อีเมล / บัญชี",
    lblRole: "สิทธิ์การใช้งาน",
    lblStartDate: "วันเริ่มงาน",
    lineSectionHeading: "การแจ้งเตือนใบลานี้ผ่าน LINE (LINE Notification)",
    lineAutoLinkTitle: "ผูกบัญชี LINE อัตโนมัติ (แนะนำ)",
    lineAutoLinkSub: "รับรหัสเชื่อมต่อและส่งไปที่ LINE OA เพื่อผูกบัญชีทันทีโดยไม่ต้องหา User ID เอง",
    btnGetLineCode: "ขอรหัสเชื่อมต่อ LINE",
    lineManualTitle: "หรือระบุ LINE User ID ด้วยตนเอง",
    btnSaveLine: "💾 บันทึก",
    
    // Holidays (holidays.html)
    holidayPageTitle: "ปฏิทินวันหยุดประจำปี",
    holidayPageSub: "PVT HR HOLIDAY MANAGEMENT SYSTEM",
    tabCompanyHolidays: "วันหยุดบริษัท",
    tabTeamLeaves: "วันลาของคนในแผนก",
    statTotalHolidays: "วันหยุดรวมทั้งหมด (ปีนี้)",
    statNextHoliday: "วันหยุดถัดไป",
    statRemainingHolidays: "วันหยุดคงเหลือปีนี้",
    heroNextHolidayTitle: "วันหยุดถัดไปที่กำลังจะถึง",
    heroDaysAhead: "วันข้างหน้า",
    heroNoUpcoming: "ไม่มีวันหยุดถัดไปในปีนี้",
    heroNoUpcomingDesc: "ผ่านพ้นวันหยุดทั้งหมดของปีนี้เรียบร้อยแล้ว",
    searchHolidayPlaceholder: "ค้นหาชื่อวันหยุด หรือวันที่...",
    btnAddHoliday: "เพิ่มวันหยุดใหม่",
    typeOfficial: "วันหยุดนักขัตฤกษ์",
    typeCompany: "วันหยุดประจำปีบริษัท",
    typeSubstitution: "วันหยุดชดเชย",
    optAllYear: "📅 แสดงทั้งปี (สรุปรายปี)",
    optAllCategories: "ทุกประเภทวันหยุด",
    optOfficial: "วันหยุดนักขัตฤกษ์ / ตามประเพณี",
    optCompany: "วันหยุดพิเศษบริษัท",
    optSubstitution: "วันหยุดชดเชย",
    calMonthlyTitle: "ปฏิทินวันหยุด (แบบรายเดือน)",
    teamCalTitle: "ปฏิทินวันลาของทีม",
    companySummaryMonth: "สรุปวันหยุดเดือนนี้",
    teamSummaryTitle: "สรุปรายชื่อผู้ลา",
    searchTeamPlaceholder: "ค้นหาชื่อ...",
    thNo: "ลำดับ",
    thDate: "วันที่หยุด",
    thDayOfWeek: "วันในสัปดาห์",
    thHolidayName: "ชื่อวันหยุด",
    thCategory: "ประเภทวันหยุด",
    thCountdown: "นับถอยหลัง",
    thDesc: "หมายเหตุ / รายละเอียด",
    thManage: "จัดการ",
    modalAddTitle: "เพิ่มวันหยุดใหม่",
    modalEditTitle: "แก้ไขข้อมูลวันหยุด",
    modalBtnSave: "บันทึกวันหยุด",
    
    // Leave Rules (leave-rules.html)
    rulesPageTitle: "หลักเกณฑ์และเงื่อนไขการลา",
    rulesPageSub: "สิทธิประโยชน์และข้อกำหนดทางวินัยพนักงาน PVT",
    
    // Guide Page (full-guide.html)
    guidePageTitle: "คู่มือการใช้งานระบบพนักงาน (ฉบับสมบูรณ์)",
    guideTopicHeading: "หัวข้อแนะนำ",
    
    // Units & Types
    unitDays: "วัน",
    unitHours: "ชม.",
    unitMinutes: "นาที",
    leaveSick: "ลาป่วย",
    leaveAnnual: "วันหยุดพักผ่อนประจำปี",
    leaveBusiness: "ลากิจ",
    leaveSterilization: "การลาเพื่อทำหมัน",
    leaveMilitary: "การลาเพื่อรับราชการทหาร",
    leaveOrdination: "การลาเพื่ออุปสมบท",
    leaveFuneral: "การลาเพื่อฌาปนกิจศพ",
    leaveOther: "ลาอื่น ๆ",
    leaveMaternity: "การลาเพื่อคลอดบุตร",
    
    // Statuses
    statusApproved: "อนุมัติแล้ว",
    statusPending: "รออนุมัติ",
    statusRejected: "ไม่อนุมัติ",
    statusCancelReq: "รอ HR อนุมัติยกเลิก",
    statusCancelled: "ยกเลิกแล้ว",
    statusWaitingReview: "รอพิจารณา"
  },
  lo: {
    // Navigation & App Shell
    home: "ໜ້າຫຼັກ",
    leaveCheck: "ກວດສອບໃບລາ",
    employeeManagement: "ລະບົບຈັດການສ່ວນກາງ & ປະຫວັດພະນັກງານ",
    employees: "ພະນັກງານ",
    userView: "ໜ້າພະນັກງານ",
    holidays: "ວັນພັກ",
    cardSystem: "ລະບົບັດພະນັກງານ & QR",
    logout: "ອອກຈາກລະບົບ",
    logoutShort: "ອອກ",
    back: "ກັບຄືນ",
    backShort: "ກັບ",
    save: "ບັນທຶກ",
    cancel: "ຍົກເລີກ",
    confirm: "ຢືນຢັນ",
    close: "ປິດ",
    delete: "ລຶບ",
    edit: "ແກ້ໄຂ",
    refresh: "ໂຫຼດຂໍ້ມູນໃໝ່",
    loading: "ກຳລັງໂຫຼດຂໍ້ມູນ...",
    all: "ທັງໝົດ",
    
    // Notifications
    notifications: "ການແຈ້ງເຕືອນ",
    markAllRead: "ອ່ານທັງໝົດ",
    unreadSuffix: "ລາຍການໃໝ່",
    viewAllNotif: "ເບິ່ງການແຈ້ງເຕືອນທັງໝົດ",
    loadingNotif: "ກຳລັງໂຫຼດການແຈ້ງເຕືອນ...",
    
    // User Home Dashboard
    hello: "ສະບາຍດີ",
    approverModeTitle: "ລະບົບຫົວໜ້າງານ / HR",
    approverModeSub: "ສະຫຼັບໄປໜ້າອະມຸມັດໃບລາ ແລະ ຈັດການຂໍ້ມູນ ➜",
    heroLeaveTitle: "ຍື່ນໃບລາອອນໄລນ໌",
    heroLeaveSub: "ປ້ອນແບບຟອມຂໍອະນຸຍາດລາ ອະນຸມັດຕາມລຳດັບໄວ",
    leaveBalanceTitle: "ສິດວັນລາຄົງເຫຼືອ",
    quickMenuTitle: "ເລືອກເມນູການນຳໃຊ້",
    ruleTitle: "ລະບຽບການລາ",
    ruleSub: "ເປີດອ່ານເງື່ອນໄຂບໍລິສັດ",
    historyTitle: "ປະຫວັດການລາ",
    historySub: "ກວດສອບສະຖານະໃບລາ",
    profileTitle: "ຂໍ້ມູນພະນັກງານ",
    profileSub: "ກວດສອບລະຫັດ ຊື່ ແລະ ວັນເລີ່ມງານ",
    holidayTitle: "ປະຕິທິນວັນພັກ",
    holidaySub: "ວັນພັກປະຈຳປີບໍລິສັດ",
    cardTitle: "ບັດພະນັກງານດິຈິຕອນ",
    cardSub: "ສະແດງ QR Code ປະຈຳຕົວ",
    guideTitle: "ຄູ່ມືການນຳໃຊ້",
    guideSub: "ວິທີໃຊ້ງານລະບົບລາອອນໄລນ໌",
    lineConnect: "ເຊື່ອມຕໍ່ LINE",
    lineNotif: "ຮັບການແຈ້ງເຕືອນຜ່ານມືຖື",
    viewCard: "ເບິ່ງບັດພະນັກງານ",
    recentListHeading: "ລາຍການຫຼ້າສຸດ",
    viewAll: "ເບິ່ງທັງໝົດ",
    loadingLeave: "ກຳລັງໂຫຼດລາຍການລາ...",
    teamTitle: "ສະມາຊິກພະນັກງານໃນພະແນກ",
    teamSub: "ເພື່ອນຮ່ວມງານໃນພະແນກຂອງທ່ານ",
    
    // Leave Form (leave-user.html)
    leaveFormTitle: "ໃບລາອອນໄລນ໌",
    companySubtitle: "ບໍລິສັດ ພີ.ວີ.ທີ. ແອນ ທິ.ພລາດ ຈຳກັດ · ປີ 2026",
    periodSubtitle: "ວັນທີ 1 ທັນວາ – 30 ພະຈິກ",
    ruleBtnText: "📘 ລະບຽບການ",
    applicantInfoTitle: "ຂໍ້ມູນຜູ້ຂໍອະນຸມັດລາ",
    autofillBadge: "ລະບົບດຶງຂໍ້ມູນອັດຕະໂນມັດ",
    empCodeLabel: "ລະຫັດພະນັກງານ",
    empNameLabel: "ຊື່ ແລະ ນາມສະກຸນ ພະນັກງານ",
    empPosLabel: "ຕຳແໜ່ງ",
    empDeptLabel: "ພະແນກ / ຝ່າຍ",
    empStartLabel: "ວັນເລີ່ມງານ",
    leaveBalanceLabel: "ສິດຄົງເຫຼືອ",
    leaveBalanceSelectFirst: "ກະລຸນາເລືອກປະເພດການລາກ່ອນ",
    socialSecurityLabel: "ສິດປະກັນສັງຄົມ",
    socialSecurityNote: "(ປ່ຽນສິດກະລຸນາແຈ້ງ HR)",
    lineAlertNotice: "ແຈ້ງເຕືອນຜ່ານ LINE: ລະບົບຈະສົ່ງການແຈ້ງເຕືອນສະຖານະໃບລານີ້ໄປຫາ LINE ຂອງທ່ານ ແລະ ຫົວໜ້າງານທັນທີເມື່ອກົດສົ່ງ ແລະ ເມື່ອໄດ້ຮັບການອະນຸມັດ/ປະຕິເສດ",
    checkBeforeSaveNotice: "ກວດສອບກ່ອນບັນທຶກ: ລາພັກຜ່ອນລ່ວງໜ້າຢ່າງໜ້ອຍ 3 ວັນ · ລາທຸລະກິດແຈ້ງລ່ວງໜ້າ 1 ວັນ · ລາປ່ວຍແຈ້ງພາຍໃນ 4 ຊົ່ວໂມງທຳອິດ ພ້ອມໃບຢັ້ງຢືນແພດ",
    leaveCardContainerTitle: "ໃບຂໍອະນຸຍາດລາ",
    btnAddLeaveItem: "＋ ເພີ່ມລາຍການລາ",
    btnSaveLeave: "💾 ບັນທຶກຄຳຂໍລາ",
    sec1Divider: "ໝວດທີ 1: ວັນທີ ແລະ ກຳນົດເວລາລາ",
    sec2Divider: "ໝວດທີ 2: ລາຍລະອຽດປະເພດການລາ ແລະ ຫຼັກຖານ",
    sec3Divider: "ໝວດທີ 3: ຈຳນວນເວລາ ແລະ ຊົ່ວໂມງທີ່ຂໍລາ",
    sec4Divider: "ໝວດທີ 4: ສະຖານະການພິຈາລະນາ ແລະ ອະນຸມັດ",
    writeDateLabel: "ວັນທີຂຽນຄຳຂໍ",
    startDateLabel: "ເລີ່ມວັນທີລາ",
    endDateLabel: "ສິ້ນສຸດວັນທີລາ",
    leaveTypeLabel: "ປະເພດການລາ",
    leaveTypePlaceholder: "-- ເລືອກປະເພດການລາ --",
    reasonLabel: "ສາເຫດ / ເຫດຜົນການລາ",
    reasonPlaceholder: "ລະບຸເຫດຜົນຄວາມຈຳເປັນ...",
    attachProofLabel: "ຄັດຕິດຮູບພາບຫຼັກຖານ",
    selectProofBtn: "📁 ເລືອກຮູບພາບຫຼັກຖານ",
    hoursMorningLabel: "ຈຳນວນຊົ່ວໂມງເຊົ້າ (0-4)",
    hoursAfternoonLabel: "ຈຳນວນຊົ່ວໂມງບ່າຍ (0-4)",
    totalDurationLabel: "ສະຫຼຸບລວມໄລຍະເວລາທີ່ຂໍລາ",
    deptHeadLabel: "ຫົວໜ້າພະແນກ",
    deptManagerLabel: "ຜູ້ຈັດການຝ່າຍ",
    hrDeptLabel: "ຝ່າຍບຸກຄະລາກອນ",
    btnRemoveItem: "ລຶບລາຍການນີ້",
    formGuideTitle: "ວິທີປ້ອນແບບຟອມໃບລາ",
    formGuideFab: "ແນະນຳການປ້ອນຟອມ",
    
    // Leave History (leave-history.html)
    historyPageTitle: "ປະຫວັດການລາຂອງຂ້ອຍ",
    statAll: "ທັງໝົດ",
    statPending: "ຖ້າອະນຸມັດ",
    statApproved: "ອະນຸມັດແລ້ວ",
    statCancelReq: "ຖ້າ HR ຍົກເລີກ",
    statTotalDays: "ວັນລາລວມທີ່ໃຊ້",
    filterTitle: "ກັ່ນຕອງລາຍການ:",
    chipAll: "ທັງໝົດ",
    chipPending: "ຖ້າອະນຸມັດ",
    chipApproved: "ອະນຸມັດແລ້ວ",
    chipCancelReq: "🔄 ຖ້າ HR ຍົກເລີກ",
    chipRejectedCancelled: "❌ ບໍ່ອະນຸມັດ / ຍົກເລີກແລ້ວ",
    thLeaveType: "ປະເພດການລາ",
    thDateRange: "ຊ່ວງວັນທີ",
    thDays: "ຈຳນວນວັນ",
    thReason: "ເຫດຜົນການລາ",
    thStatus: "ສະຖານະ",
    thAction: "ຈັດການຄຳຂໍ",
    btnDirectCancel: "ຍົກເລີກຄຳຂໍ",
    btnRequestCancel: "ຂໍຍົກເລີກໃບລາ",
    badgeWaitingHr: "ສົ່ງເລື່ອງແລ້ວ",
    reasonCancelPrefix: "ເຫດຜົນທີ່ຍົກເລີກ:",
    reasonRejectPrefix: "ເຫດຜົນທີ່ບໍ່ອະນຸມັດ:",
    emptyHistory: "ບໍ່ພົບລາຍການໃບລາຕາມເງື່ອນໄຂທີ່ເລືອກ",
    emptyHistoryLogin: "ກະລຸນາເຂົ້າສູ່ລະບົບເພື່ອເບິ່ງປະຫວັດການລາ",
    
    // Profile Page (profile-user.html)
    profilePageTitle: "ຂໍ້ມູນພະນັກງານ",
    profilePageSub: "ກວດສອບຂໍ້ມູນໂປຣໄຟລ໌ ແລະ ການແຈ້ງເຕືອນ LINE",
    profileDetailsHeading: "ລາຍລະອຽດໂປຣໄຟລ໌",
    lblFullName: "ຊື່ ແລະ ນາມສະກຸນ",
    lblEmpCode: "ລະຫັດພະນັກງານ",
    lblDept: "ຝ່າຍ / ພະແນກ",
    lblPos: "ຕຳແໜ່ງງານ",
    lblEmail: "ອີເມລ / ບັນຊີ",
    lblRole: "ສິດການນຳໃຊ້",
    lblStartDate: "ວັນເລີ່ມງານ",
    lineSectionHeading: "ການແຈ້ງເຕືອນໃບລາຜ່ານ LINE (LINE Notification)",
    lineAutoLinkTitle: "ເຊື່ອມຕໍ່ບັນຊີ LINE ອັດຕະໂນມັດ (ແນະນຳ)",
    lineAutoLinkSub: "ຮັບລະຫັດເຊື່ອມຕໍ່ ແລະ ສົ່ງໄປທີ່ LINE OA ເພື່ອຜູກບັນຊີທັນທີໂດຍບໍ່ຕ້ອງຊອກຫາ User ID ເອງ",
    btnGetLineCode: "ຂໍລະຫັດເຊື່ອມຕໍ່ LINE",
    lineManualTitle: "ຫຼື ລະບຸ LINE User ID ດ້ວຍຕົນເອງ",
    btnSaveLine: "💾 ບັນທຶກ",
    
    // Holidays (holidays.html)
    holidayPageTitle: "ປະຕິທິນວັນພັກປະຈຳປີ",
    holidayPageSub: "PVT HR HOLIDAY MANAGEMENT SYSTEM",
    tabCompanyHolidays: "ວັນພັກບໍລິສັດ",
    tabTeamLeaves: "ວັນລາຂອງຄົນໃນພະແນກ",
    statTotalHolidays: "ວັນພັກລວມທັງໝົດ (ປີນີ້)",
    statNextHoliday: "ວັນພັກຖັດໄປ",
    statRemainingHolidays: "ວັນພັກຄົງເຫຼືອປີນີ້",
    heroNextHolidayTitle: "ວັນພັກຖັດໄປທີ່ກຳລັງຈະມາຮອດ",
    heroDaysAhead: "ວັນຂ້າງໜ້າ",
    heroNoUpcoming: "ບໍ່ມີວັນພັກຖັດໄປໃນປີນີ້",
    heroNoUpcomingDesc: "ຜ່ານພົ້ນວັນພັກທັງໝົດຂອງປີນີ້ແລ້ວ",
    searchHolidayPlaceholder: "ຄົ້ນຫາຊື່ວັນພັກ ຫຼື ວັນທີ...",
    btnAddHoliday: "ເພີ່ມວັນພັກໃໝ່",
    typeOfficial: "ວັນພັກລັດຖະການ / ປະເພນີ",
    typeCompany: "ວັນພັກປະຈຳປີບໍລິສັດ",
    typeSubstitution: "ວັນພັກຊົດເຊີຍ",
    optAllYear: "📅 ສະແດງທັງປີ (ສະຫຼຸບລາຍປີ)",
    optAllCategories: "ທຸກປະເພດວັນພັກ",
    optOfficial: "ວັນພັກລັດຖະການ / ປະເພນີ",
    optCompany: "ວັນພັກພິເສດບໍລິສັດ",
    optSubstitution: "ວັນພັກຊົດເຊີຍ",
    calMonthlyTitle: "ປະຕິທິນວັນພັກ (ລາຍເດືອນ)",
    teamCalTitle: "ປະຕິທິນວັນລາຂອງທີມ",
    companySummaryMonth: "ສະຫຼຸບວັນພັກເດືອນນີ້",
    teamSummaryTitle: "ສະຫຼຸບລາຍຊື່ຜູ້ລາ",
    searchTeamPlaceholder: "ຄົ້ນຫາຊື່...",
    thNo: "ລຳດັບ",
    thDate: "ວັນທີພັກ",
    thDayOfWeek: "ວັນໃນອາທິດ",
    thHolidayName: "ຊື່ວັນພັກ",
    thCategory: "ປະເພດວັນພັກ",
    thCountdown: "ນັບຖອຍຫຼັງ",
    thDesc: "ໝາຍເຫດ / ລາຍລະອຽດ",
    thManage: "ຈັດການ",
    modalAddTitle: "ເພີ່ມວັນພັກໃໝ່",
    modalEditTitle: "ແກ້ໄຂຂໍ້ມູນວັນພັກ",
    modalBtnSave: "ບັນທຶກວັນພັກ",
    
    // Leave Rules (leave-rules.html)
    rulesPageTitle: "ລະບຽບ ແລະ ເງື່ອນໄຂການລາ",
    rulesPageSub: "ສິດທິປະໂຫຍດ ແລະ ຂໍ້ກຳນົດວິໄນພະນັກງານ PVT",
    
    // Guide Page (full-guide.html)
    guidePageTitle: "ຄູ່ມືການນຳໃຊ້ລະບົບພະນັກງານ (ສະບັບສົມບູນ)",
    guideTopicHeading: "ຫົວຂໍ້ແນະນຳ",
    
    // Units & Types
    unitDays: "ວັນ",
    unitHours: "ຊມ.",
    unitMinutes: "ນາທີ",
    leaveSick: "ລາປ່ວຍ",
    leaveAnnual: "ວັນພັກຜ່ອນປະຈຳປີ",
    leaveBusiness: "ລາທຸລະກິດ",
    leaveSterilization: "ລາເພື່ອທຳໝັນ",
    leaveMilitary: "ລາເພື່ອຮັບລາຊະການທະຫານ",
    leaveOrdination: "ລາເພື່ອບວດ",
    leaveFuneral: "ລາເພື່ອຊາປນາກິດສົບ",
    leaveOther: "ລາອື່ນໆ",
    leaveMaternity: "ລາເພື່ອຄອດບຸດ",
    
    // Statuses
    statusApproved: "ອະນຸມັດແລ້ວ",
    statusPending: "ຖ້າອະນຸມັດ",
    statusRejected: "ບໍ່ອະນຸມັດ",
    statusCancelReq: "ຖ້າ HR ອະນຸມັດຍົກເລີກ",
    statusCancelled: "ຍົກເລີກແລ້ວ",
    statusWaitingReview: "ຖ້າພິຈາລະນາ"
  },
  my: {
    // Navigation & App Shell
    home: "ပင်မစာမျက်နှာ",
    leaveCheck: "ခွင့်စစ်ဆေးရန်",
    employeeManagement: "ဗဟိုစီမံခန့်ခွဲမှု & ဝန်ထမ်းမှတ်တမ်း",
    employees: "ဝန်ထမ်းများ",
    userView: "ဝန်ထမ်းမြင်ကွင်း",
    holidays: "အားလပ်ရက်များ",
    cardSystem: "ဝန်ထမ်းကတ် & QR စနစ်",
    logout: "ထွက်ရန်",
    logoutShort: "ထွက်",
    back: "နောက်သို့",
    backShort: "ပြန်သွားရန်",
    save: "သိမ်းဆည်းရန်",
    cancel: "ပယ်ဖျက်ရန်",
    confirm: "အတည်ပြုရန်",
    close: "ပိတ်ရန်",
    delete: "ဖျက်ရန်",
    edit: "ပြင်ဆင်ရန်",
    refresh: "အချက်အလက် အသစ်ရယူရန်",
    loading: "အချက်အလက်များ တင်နေသည်...",
    all: "အားလုံး",
    
    // Notifications
    notifications: "အကြောင်းကြားချက်များ",
    markAllRead: "အားလုံးဖတ်ပြီး",
    unreadSuffix: "အသစ်",
    viewAllNotif: "အကြောင်းကြားချက်အားလုံး ကြည့်ရန်",
    loadingNotif: "အကြောင်းကြားချက်များ တင်နေသည်...",
    
    // User Home Dashboard
    hello: "မင်္ဂလာပါ",
    approverModeTitle: "ကြီးကြပ်ရေးမှူး / HR စနစ်",
    approverModeSub: "ခွင့်အတည်ပြုရန်နှင့် အချက်အလက်များ စီမံရန် သွားမည် ➜",
    heroLeaveTitle: "အွန်လိုင်းခွင့်တင်ရန်",
    heroLeaveSub: "ခွင့်တောင်းခံလွှာပုံစံဖြည့်ပါ၊ အဆင့်ဆင့် အမြန်အတည်ပြုသည်",
    leaveBalanceTitle: "ကျန်ရှိသော ခွင့်ရက်များ",
    quickMenuTitle: "အသုံးပြုရန် မီနူးကို ရွေးပါ",
    ruleTitle: "ခွင့်စည်းမျဉ်းများ",
    ruleSub: "ကုမ္ပဏီစည်းကမ်းများကို ဖတ်ရှုရန်",
    historyTitle: "ခွင့်မှတ်တမ်း",
    historySub: "ခွင့်တောင်းခံမှု အခြေအနေ စစ်ဆေးရန်",
    profileTitle: "ဝန်ထမ်းအချက်အလက်",
    profileSub: "ကုဒ်၊ အမည်နှင့် စတင်သည့်ရက် စစ်ဆေးရန်",
    holidayTitle: "အားလပ်ရက် ပြက္ခဒိန်",
    holidaySub: "ကုမ္ပဏီ နှစ်ပတ်လည် အားလပ်ရက်များ",
    cardTitle: "ဒစ်ဂျစ်တယ် ဝန်ထမ်းကတ်",
    cardSub: "ကိုယ်ပိုင် QR Code ကို ပြသရန်",
    guideTitle: "အသုံးပြုနည်းလမ်းညွှန်",
    guideSub: "အွန်လိုင်းခွင့်စနစ် အသုံးပြုပုံ",
    lineConnect: "LINE ချိတ်ဆက်ရန်",
    lineNotif: "မိုဘိုင်းလ်မှတဆင့် အကြောင်းကြားချက် လက်ခံရန်",
    viewCard: "ဝန်ထမ်းကတ် ကြည့်ရန်",
    recentListHeading: "နောက်ဆုံးစာရင်းများ",
    viewAll: "အားလုံးကြည့်ရန်",
    loadingLeave: "ခွင့်စာရင်းများကို တင်နေသည်...",
    teamTitle: "ဌာနတွင်း ဝန်ထမ်းစာရင်း",
    teamSub: "သင့်ဌာနမှ လုပ်ဖော်ကိုင်ဖက်များ",
    
    // Leave Form (leave-user.html)
    leaveFormTitle: "အွန်လိုင်းခွင့်တောင်းခံလွှာ",
    companySubtitle: "P.V.T. & T.PLAS CO., LTD. · ၂၀၂၆ ခုနှစ်",
    periodSubtitle: "ဒီဇင်ဘာ ၁ ရက် – နိုဝင်ဘာ ၃၀ ရက်",
    ruleBtnText: "📘 စည်းမျဉ်းများ",
    applicantInfoTitle: "ခွင့်တောင်းခံသူ အချက်အလက်",
    autofillBadge: "အလိုအလျောက် ရယူထားသည်",
    empCodeLabel: "ဝန်ထမ်းနံပါတ်",
    empNameLabel: "ဝန်ထမ်းအမည်",
    empPosLabel: "ရာထူး",
    empDeptLabel: "ဌာန",
    empStartLabel: "အလုပ်စတင်သည့်ရက်",
    leaveBalanceLabel: "ကျန်ရှိသောခွင့်",
    leaveBalanceSelectFirst: "ခွင့်အမျိုးအစားကို ဦးစွာရွေးပါ",
    socialSecurityLabel: "လူမှုဖူလုံရေးခွင့်",
    socialSecurityNote: "(ပြောင်းလဲလိုပါက HR သို့ အကြောင်းကြားပါ)",
    lineAlertNotice: "LINE မှ အကြောင်းကြားချက်- ခွင့်တင်ပြီးသည်နှင့် ခွင့်အတည်ပြု/ငြင်းပယ်ချိန်တွင် LINE သို့ အလိုအလျောက် ပေးပို့ပါမည်",
    checkBeforeSaveNotice: "မသိမ်းဆည်းမီ စစ်ဆေးရန်- နှစ်ပတ်လည်ခွင့် အနည်းဆုံး ၃ ရက် ကြိုတင်တင်ရန်၊ ကိုယ်ရေးကိုယ်တာခွင့် ၁ ရက် ကြိုတင်တင်ရန်၊ နာမကျန်းခွင့် ပထမ ၄ နာရီအတွင်း ဆေးလက်မှတ်နှင့်အတူ အကြောင်းကြားရန်",
    leaveCardContainerTitle: "ခွင့်တောင်းခံလွှာ",
    btnAddLeaveItem: "＋ ခွင့်စာရင်း ထည့်ရန်",
    btnSaveLeave: "💾 ခွင့်တောင်းခံလွှာ သိမ်းဆည်းရန်",
    sec1Divider: "အပိုင်း (၁) - ခွင့်ရက်စွဲနှင့် အချိန်ကာလ",
    sec2Divider: "အပိုင်း (၂) - ခွင့်အမျိုးအစားနှင့် အထောက်အထားများ",
    sec3Divider: "အပိုင်း (၃) - ခွင့်ယူမည့် အချိန်နှင့် နာရီ",
    sec4Divider: "အပိုင်း (၄) - စိစစ်အတည်ပြုမှု အခြေအနေ",
    writeDateLabel: "လျှောက်ထားသည့်ရက်စွဲ",
    startDateLabel: "ခွင့်စတင်သည့်ရက်",
    endDateLabel: "ခွင့်ကုန်ဆုံးသည့်ရက်",
    leaveTypeLabel: "ခွင့်အမျိုးအစား",
    leaveTypePlaceholder: "-- ခွင့်အမျိုးအစား ရွေးချယ်ပါ --",
    reasonLabel: "ခွင့်ယူရသည့် အကြောင်းအရင်း",
    reasonPlaceholder: "လိုအပ်သော အကြောင်းအရင်းကို ဖော်ပြပါ...",
    attachProofLabel: "အထောက်အထား ပုံတွဲရန်",
    selectProofBtn: "📁 အထောက်အထားပုံ ရွေးရန်",
    hoursMorningLabel: "မနက်ပိုင်း နာရီ (၀-၄)",
    hoursAfternoonLabel: "နေ့လယ်ပိုင်း နာရီ (၀-၄)",
    totalDurationLabel: "စုစုပေါင်း ခွင့်ယူသည့်ရက်",
    deptHeadLabel: "ဌာနမှူး",
    deptManagerLabel: "မန်နေဂျာ",
    hrDeptLabel: "HR ဌာန",
    btnRemoveItem: "ဤစာရင်းကို ဖျက်ရန်",
    formGuideTitle: "ခွင့်ဖောင် ဖြည့်သွင်းနည်း",
    formGuideFab: "ဖြည့်စွက်နည်း လမ်းညွှန်",
    
    // Leave History (leave-history.html)
    historyPageTitle: "ကျွန်ုပ်၏ ခွင့်မှတ်တမ်း",
    statAll: "အားလုံး",
    statPending: "စောင့်ဆိုင်းဆဲ",
    statApproved: "အတည်ပြုပြီး",
    statCancelReq: "HR ပယ်ဖျက်ရန် စောင့်ဆိုင်းဆဲ",
    statTotalDays: "စုစုပေါင်း အသုံးပြုပြီးခွင့်ရက်",
    filterTitle: "စစ်ထုတ်ရန်:",
    chipAll: "အားလုံး",
    chipPending: "စောင့်ဆိုင်းဆဲ",
    chipApproved: "အတည်ပြုပြီး",
    chipCancelReq: "🔄 HR ပယ်ဖျက်ရန် စောင့်ဆိုင်းဆဲ",
    chipRejectedCancelled: "❌ ငြင်းပယ် / ပယ်ဖျက်ပြီး",
    thLeaveType: "ခွင့်အမျိုးအစား",
    thDateRange: "ရက်စွဲအပိုင်းအခြား",
    thDays: "ရက်ပေါင်း",
    thReason: "ခွင့်ယူသည့် အကြောင်းရင်း",
    thStatus: "အခြေအနေ",
    thAction: "စီမံဆောင်ရွက်ရန်",
    btnDirectCancel: "တောင်းဆိုမှု ပယ်ဖျက်ရန်",
    btnRequestCancel: "ခွင့်ပယ်ဖျက်ရန် လျှောက်ထားရန်",
    badgeWaitingHr: "တင်ပြပြီး",
    reasonCancelPrefix: "ပယ်ဖျက်ရသည့် အကြောင်းရင်း:",
    reasonRejectPrefix: "ငြင်းပယ်ရသည့် အကြောင်းရင်း:",
    emptyHistory: "ရွေးချယ်ထားသော အခြေအနေနှင့် ကိုက်ညီသည့် ခွင့်စာရင်း မရှိပါ",
    emptyHistoryLogin: "ခွင့်မှတ်တမ်း ကြည့်ရန် အကောင့်ဝင်ပါ",
    
    // Profile Page (profile-user.html)
    profilePageTitle: "ဝန်ထမ်းအချက်အလက်",
    profilePageSub: "ပရိုဖိုင်နှင့် LINE အကြောင်းကြားချက်များကို စစ်ဆေးရန်",
    profileDetailsHeading: "ပရိုဖိုင် အသေးစိတ်",
    lblFullName: "အမည်",
    lblEmpCode: "ဝန်ထမ်းနံပါတ်",
    lblDept: "ဌာန",
    lblPos: "ရာထူး",
    lblEmail: "အီးမေးလ် / အကောင့်",
    lblRole: "အသုံးပြုခွင့် အဆင့်",
    lblStartDate: "အလုပ်စတင်သည့်ရက်",
    lineSectionHeading: "LINE မှတဆင့် ခွင့်အကြောင်းကြားချက် ရယူခြင်း (LINE Notification)",
    lineAutoLinkTitle: "LINE အကောင့် အလိုအလျောက် ချိတ်ဆက်ရန် (အကြံပြုသည်)",
    lineAutoLinkSub: "ချိတ်ဆက်ရန် ကုဒ်ရယူပြီး LINE OA သို့ ပေးပို့ကာ အလွယ်တကူ ချိတ်ဆက်ပါ",
    btnGetLineCode: "LINE ချိတ်ဆက်ရန် ကုဒ်ရယူပါ",
    lineManualTitle: "သို့မဟုတ် LINE User ID ကို ကိုယ်တိုင် ထည့်သွင်းပါ",
    btnSaveLine: "💾 သိမ်းဆည်းရန်",
    
    // Holidays (holidays.html)
    holidayPageTitle: "နှစ်ပတ်လည် အားလပ်ရက် ပြက္ခဒိန်",
    holidayPageSub: "PVT HR HOLIDAY MANAGEMENT SYSTEM",
    tabCompanyHolidays: "ကုမ္ပဏီ အားလပ်ရက်များ",
    tabTeamLeaves: "ဌာနတွင်း ဝန်ထမ်းများ၏ ခွင့်ရက်များ",
    statTotalHolidays: "စုစုပေါင်း အားလပ်ရက်များ (ယခုနှစ်)",
    statNextHoliday: "နောက်လာမည့် အားလပ်ရက်",
    statRemainingHolidays: "ကျန်ရှိသော အားလပ်ရက်များ",
    heroNextHolidayTitle: "မကြာမီ ရောက်ရှိလာမည့် အားလပ်ရက်",
    heroDaysAhead: "ရက်ကျန်",
    heroNoUpcoming: "ယခုနှစ်တွင် နောက်ထပ် အားလပ်ရက် မရှိတော့ပါ",
    heroNoUpcomingDesc: "ယခုနှစ်၏ အားလပ်ရက်အားလုံး ကုန်ဆုံးသွားပါပြီ",
    searchHolidayPlaceholder: "အားလပ်ရက် အမည် သို့မဟုတ် ရက်စွဲ ရှာဖွေရန်...",
    btnAddHoliday: "အားလပ်ရက် အသစ်ထည့်ရန်",
    typeOfficial: "ရုံးပိတ်ရက်",
    typeCompany: "ကုမ္ပဏီ အားလပ်ရက်",
    typeSubstitution: "အစားထိုး အားလပ်ရက်",
    optAllYear: "📅 တစ်နှစ်လုံးပြသရန် (နှစ်ပတ်လည် အကျဉ်းချုပ်)",
    optAllCategories: "အားလပ်ရက် အမျိုးအစားအားလုံး",
    optOfficial: "ရုံးပိတ်ရက် / ရိုးရာအားလပ်ရက်",
    optCompany: "ကုမ္ပဏီ အထူးအားလပ်ရက်",
    optSubstitution: "အစားထိုး အားလပ်ရက်",
    calMonthlyTitle: "အားလပ်ရက် ပြက္ခဒိန် (လစဉ်)",
    teamCalTitle: "အဖွဲ့ဝင်များ၏ ခွင့်ပြက္ခဒိန်",
    companySummaryMonth: "ယခုလ အားလပ်ရက် အကျဉ်းချုပ်",
    teamSummaryTitle: "ခွင့်ယူထားသူများ စာရင်း",
    searchTeamPlaceholder: "အမည်ရှာဖွေရန်...",
    thNo: "အမှတ်စဉ်",
    thDate: "အားလပ်ရက်",
    thDayOfWeek: "ရက်သတ္တပတ်နေ့",
    thHolidayName: "အားလပ်ရက် အမည်",
    thCategory: "အားလပ်ရက် အမျိုးအစား",
    thCountdown: "ရက်ရေတွက်မှု",
    thDesc: "မှတ်ချက် / အသေးစိတ်",
    thManage: "စီမံရန်",
    modalAddTitle: "အားလပ်ရက် အသစ်ထည့်ရန်",
    modalEditTitle: "အားလပ်ရက် အချက်အလက် ပြင်ဆင်ရန်",
    modalBtnSave: "အားလပ်ရက် သိမ်းဆည်းရန်",
    
    // Leave Rules (leave-rules.html)
    rulesPageTitle: "ခွင့်စည်းမျဉ်းနှင့် သတ်မှတ်ချက်များ",
    rulesPageSub: "PVT ဝန်ထမ်းများ၏ ခွင့်ခံစားခွင့်နှင့် စည်းကမ်းချက်များ",
    
    // Guide Page (full-guide.html)
    guidePageTitle: "ဝန်ထမ်းစနစ် အသုံးပြုနည်း လမ်းညွှန် (ပြည့်စုံသော)",
    guideTopicHeading: "အကြံပြုထားသော အကြောင်းအရာများ",
    
    // Units & Types
    unitDays: "ရက်",
    unitHours: "နာရီ",
    unitMinutes: "မိနစ်",
    leaveSick: "နာမကျန်းခွင့်",
    leaveAnnual: "နှစ်ပတ်လည် ခွင့်ရက်",
    leaveBusiness: "ကိုယ်ရေးကိုယ်တာ ခွင့်",
    leaveSterilization: "မျိုးအောင်ရန်ခွင့်",
    leaveMilitary: "စစ်မှုထမ်းခွင့်",
    leaveOrdination: "ရဟန်းဝတ်ခွင့်",
    leaveFuneral: "ဈာပနခွင့်",
    leaveOther: "အခြားခွင့်များ",
    leaveMaternity: "မီးဖွားခွင့်",
    
    // Statuses
    statusApproved: "အတည်ပြုပြီး",
    statusPending: "စောင့်ဆိုင်းဆဲ",
    statusRejected: "ငြင်းပယ်သည်",
    statusCancelReq: "HR ပယ်ဖျက်ရန် စောင့်ဆိုင်းဆဲ",
    statusCancelled: "ပယ်ဖျက်ပြီး",
    statusWaitingReview: "စိစစ်ဆဲ"
  }
};

window.leaveRulesData = {
  th: [
    {
      title: "1. การลาป่วย",
      icon: "medical_services",
      items: [
        { text: "ลาได้เท่าที่ป่วยจริง โดยได้รับค่าจ้างตามปกติ <b>ไม่เกิน 30 วันทำงาน/ปี</b>", isCaution: false },
        { text: "การลาป่วยตั้งแต่ 1 วันทำงานขึ้นไป ต้องนำส่งใบรับรองแพทย์แผนปัจจุบัน", isCaution: true },
        { text: "กรณีลาป่วยเท็จ จะถูกพิจารณาเป็นความผิดทางวินัยร้ายแรง", isCaution: false }
      ]
    },
    {
      title: "2. การลากิจเพื่อธุรกิจอันจำเป็น",
      icon: "assignment_ind",
      items: [
        { text: "ได้รับอนุมัติสิทธิลากิจโดยได้รับค่าจ้าง <b>ไม่เกิน 3 วันทำงาน/ปี</b>", isCaution: false },
        { text: "ต้องเป็นกิจธุระที่ต้องจัดการด้วยตนเอง และไม่สามารถทำนอกเวลางานได้", isCaution: false },
        { text: "ต้องส่งใบลาล่วงหน้าอย่างน้อย 1 วันทำการ (ยกเว้นกรณีฉุกเฉิน)", isCaution: false }
      ]
    },
    {
      title: "3. วันหยุดพักผ่อนประจำปี",
      icon: "flight_takeoff",
      items: [
        { text: "พนักงานที่ทำงานครบ 1 ปี มีสิทธิลาพักร้อนได้ <b>ไม่น้อยกว่า 6 วันทำการ/ปี</b>", isCaution: false },
        { text: "ต้องส่งล่วงหน้าเพื่อให้หัวหน้างานจัดสรรกำลังพลและอนุมัติก่อนเสมอ", isCaution: false }
      ]
    },
    {
      title: "4. การลาเพื่อการคลอดบุตร",
      icon: "child_care",
      items: [
        { text: "พนักงานลาเพื่อคลอดบุตรได้ <b>ไม่เกิน 120 วัน</b> (รวมวันหยุดประจำสัปดาห์)", isCaution: false },
        { text: "บริษัทจ่ายค่าจ้างให้ตามปกติ 60 วัน และรับเงินอุดหนุนจากประกันสังคมอีก 60 วัน", isCaution: false },
        { text: "สามารถยื่นขอลาก่อนกำหนดคลอดจริงได้ตามความเหมาะสม", isCaution: false }
      ]
    },
    {
      title: "5. การลาเพื่อทำหมัน",
      icon: "vaccines",
      items: [
        { text: "มีสิทธิลาหยุดได้ตามระยะเวลาที่แพทย์แผนปัจจุบันกำหนด", isCaution: false },
        { text: "ได้รับค่าจ้างในวันลานั้นเต็มจำนวนตามที่ระบุในใบรับรองแพทย์", isCaution: false },
        { text: "ต้องแจ้งและส่งใบลาล่วงหน้าพร้อมเอกสารจองนัดหมายแพทย์", isCaution: false }
      ]
    },
    {
      title: "6. การลาเพื่อรับราชการทหาร",
      icon: "military_tech",
      items: [
        { text: "ลาเพื่อเข้ารับการเรียกพล ตรวจสอบ หรือฝึกภาคสนามตามหมายเรียกของทางราชการ", isCaution: false },
        { text: "ได้รับค่าจ้างตามปกติในระหว่างลา <b>ไม่เกิน 60 วัน/ปี</b>", isCaution: false },
        { text: "ต้องแนบสำเนาหมายเรียกพลประกอบการยื่นใบลาทันทีที่ได้รับเอกสาร", isCaution: false }
      ]
    },
    {
      title: "7. การลาเพื่อฌาปนกิจศพ",
      icon: "heart_broken",
      items: [
        { text: "กรณีคู่สมรส บุตร บิดา หรือมารดาเสียชีวิต สามารถใช้สิทธิลาได้ตามความเหมาะสม", isCaution: false },
        { text: "บริษัทมอบสิทธิลาพิเศษโดยได้รับค่าจ้าง (จำนวนวันตามโครงสร้างสวัสดิการบริษัท)", isCaution: false },
        { text: "ยื่นหลักฐาน เช่น ใบมรณบัตร ย้อนหลังได้ภายใน 7 วันหลังกลับเข้าปฏิบัติงาน", isCaution: false }
      ]
    },
    {
      title: "8. การลาอุปสมบท",
      icon: "temple_buddhist",
      items: [
        { text: "ได้รับค่าจ้างตามความเป็นจริง <b>ไม่เกิน 15 วัน</b> (ตลอดอายุงานใช้สิทธิได้เพียง 1 ครั้ง)", isCaution: false },
        { text: "ต้องขออนุมัติล่วงหน้าไม่น้อยกว่า 15 วัน และกลับเข้าทำงานภายใน 3 วันหลังลาสิกขาบท", isCaution: false }
      ]
    },
    {
      title: "9. การลาเพื่อฝึกอบรมพัฒนาความรู้",
      icon: "school",
      items: [
        { text: "ลาเพื่อประโยชน์ต่อการจ้างงาน/สวัสดิการ หรือเพิ่มทักษะความชำนาญในตำแหน่งหน้าที่", isCaution: false },
        { text: "การลาเพื่อการศึกษาต่อของพนักงานเอง ไม่สามารถใช้สิทธิการลาประเภทนี้ได้", isCaution: true },
        { text: "ต้องแจ้งล่วงหน้าไม่น้อยกว่า 7 วัน และต้องได้รับอนุมัติจากผู้บริหารก่อนทุกครั้ง", isCaution: false }
      ]
    },
    {
      title: "ข้อควรระวัง & บทลงโทษทางวินัย",
      icon: "warning",
      isCautionBox: true,
      items: [
        { text: "พนักงานที่มาสาย <b>3 ครั้งภายในรอบเดือน</b> จะได้รับหนังสือเตือนเป็นลายลักษณ์อักษร", isCaution: true },
        { text: "การหยุดงานโดยไม่ส่งใบลา หรือใบลาไม่ได้รับการอนุมัติ ถือเป็นการขาดงานโดยเจตนา", isCaution: true },
        { text: "ขาดงานติดต่อกัน <b>3 วันทำงาน</b> โดยไม่มีเหตุอันสมควร บริษัทมีสิทธิ์เลิกจ้างทันทีโดยไม่จ่ายค่าชดเชย", isCaution: true }
      ]
    }
  ],
  lo: [
    {
      title: "1. ການລາປ່ວຍ",
      icon: "medical_services",
      items: [
        { text: "ລາໄດ້ເທົ່າທີ່ປ່ວຍຈິງ ໂດຍໄດ້ຮັບຄ່າຈ້າງຕາມປົກກະຕິ <b>ບໍ່ເກີນ 30 ວັນເຮັດວຽກ/ປີ</b>", isCaution: false },
        { text: "ການລາປ່ວຍຕັ້ງແຕ່ 1 ວັນເຮັດວຽກຂຶ້ນໄປ ຕ້ອງສົ່ງໃບຢັ້ງຢືນແພດແຜນປະຈຸບັນ", isCaution: true },
        { text: "ກໍລະນີລາປ່ວຍປອມ ຈະຖືກພິຈາລະນາເປັນຄວາມຜິດທາງວິໄນຮ້າຍແຮງ", isCaution: false }
      ]
    },
    {
      title: "2. ການລາທຸລະກິດທີ່ຈຳເປັນ",
      icon: "assignment_ind",
      items: [
        { text: "ໄດ້ຮັບອະນຸມັດສິດລາທຸລະກິດໂດຍໄດ້ຮັບຄ່າຈ້າງ <b>ບໍ່ເກີນ 3 ວັນເຮັດວຽກ/ປີ</b>", isCaution: false },
        { text: "ຕ້ອງເປັນທຸລະທີ່ຕ້ອງຈັດການດ້ວຍຕົນເອງ ແລະ ບໍ່ສາມາດເຮັດນອກເວລາວຽກໄດ້", isCaution: false },
        { text: "ຕ້ອງສົ່ງໃບລາລ່ວງໜ້າຢ່າງໜ້ອຍ 1 ວັນເຮັດວຽກ (ຍົກເວັ້ນກໍລະນີສຸກເສີນ)", isCaution: false }
      ]
    },
    {
      title: "3. ວັນພັກຜ່ອນປະຈຳປີ",
      icon: "flight_takeoff",
      items: [
        { text: "ພະນັກງານທີ່ເຮັດວຽກຄົບ 1 ປີ ມີສິດລາພັກຜ່ອນໄດ້ <b>ບໍ່ໜ້ອຍກວ່າ 6 ວັນເຮັດວຽກ/ປີ</b>", isCaution: false },
        { text: "ຕ້ອງສົ່ງລ່ວງໜ້າເພື່ອໃຫ້ຫົວໜ້າງານຈັດສັນກຳລັງຄົນ ແລະ ອະນຸມັດກ່ອນສະເໝີ", isCaution: false }
      ]
    },
    {
      title: "4. ການລາເພື່ອຄອດບຸດ",
      icon: "child_care",
      items: [
        { text: "ພະນັກງານລາເພື່ອຄອດບຸດໄດ້ <b>ບໍ່ເກີນ 120 ວັນ</b> (ລວມວັນພັກປະຈຳອາທິດ)", isCaution: false },
        { text: "ບໍລິສັດຈ່າຍຄ່າຈ້າງໃຫ້ຕາມປົກກະຕິ 60 ວັນ ແລະ ຮັບເງິນອຸດໜູນຈາກປະກັນສັງຄົມອີກ 60 ວັນ", isCaution: false },
        { text: "ສາມາດຍື່ນຂໍລາກ່ອນກຳນົດຄອດຈິງໄດ້ຕາມຄວາມເໝາະສົມ", isCaution: false }
      ]
    },
    {
      title: "5. ການລາເພື່ອທຳໝັນ",
      icon: "vaccines",
      items: [
        { text: "ມີສິດລາພັກໄດ້ຕາມໄລຍະເວລາທີ່ແພດແຜນປະຈຸບັນກຳນົດ", isCaution: false },
        { text: "ໄດ້ຮັບຄ່າຈ້າງໃນວັນລານັ້ນເຕັມຈຳນວນຕາມທີ່ລະບຸໃນໃບຢັ້ງຢືນແພດ", isCaution: false },
        { text: "ຕ້ອງແຈ້ງ ແລະ ສົ່ງໃບລາລ່ວງໜ້າພ້ອມເອກະສານນັດໝາຍແພດ", isCaution: false }
      ]
    },
    {
      title: "6. ການລາເພື່ອຮັບລາຊະການທະຫານ",
      icon: "military_tech",
      items: [
        { text: "ລາເພື່ອເຂົ້າຮັບການຮຽກພົນ, ກວດສອບ ຫຼື ຝຶກພາກສະໜາມຕາມໝາຍຮຽກຂອງທາງການ", isCaution: false },
        { text: "ໄດ້ຮັບຄ່າຈ້າງຕາມປົກກະຕິໃນລະຫວ່າງລາ <b>ບໍ່ເກີນ 60 ວັນ/ປີ</b>", isCaution: false },
        { text: "ຕ້ອງຄັດຕິດສຳເນົາໝາຍຮຽກພົນປະກອບການຍື່ນໃບລາທັນທີທີ່ໄດ້ຮັບເອກະສານ", isCaution: false }
      ]
    },
    {
      title: "7. ການລາເພື່ອຊາປນາກິດສົບ",
      icon: "heart_broken",
      items: [
        { text: "ກໍລະນີຄູ່ສົມລົດ, ບຸດ, ບິດາ ຫຼື ມານດາເສຍຊີວິດ ສາມາດໃຊ້ສິດລາໄດ້ຕາມຄວາມເໝາະສົມ", isCaution: false },
        { text: "ບໍລິສັດມອບສິດລາພິເສດໂດຍໄດ້ຮັບຄ່າຈ້າງ (ຈຳນວນວັນຕາມໂຄງສ້າງສະຫວັດດີການບໍລິສັດ)", isCaution: false },
        { text: "ຍື່ນຫຼັກຖານ ເຊັ່ນ ໃບມໍລະນະບັດ ຍ້ອນຫຼັງໄດ້ພາຍໃນ 7 ວັນຫຼັງກັບເຂົ້າເຮັດວຽກ", isCaution: false }
      ]
    },
    {
      title: "8. ການລາເພື່ອບວດ",
      icon: "temple_buddhist",
      items: [
        { text: "ໄດ້ຮັບຄ່າຈ້າງຕາມຄວາມເປັນຈິງ <b>ບໍ່ເກີນ 15 ວັນ</b> (ຕະຫຼອດອາຍຸງານໃຊ້ສິດໄດ້ພຽງ 1 ຄັ້ງ)", isCaution: false },
        { text: "ຕ້ອງຂໍອະນຸມັດລ່ວງໜ້າບໍ່ໜ້ອຍກວ່າ 15 ວັນ ແລະ ກັບເຂົ້າເຮັດວຽກພາຍໃນ 3 ວັນຫຼັງສິກຂາ", isCaution: false }
      ]
    },
    {
      title: "9. ການລາເພື່ອຝຶກອົບຮົມພັດທະນາຄວາມຮູ້",
      icon: "school",
      items: [
        { text: "ລາເພື່ອຜົນປະໂຫຍດຕໍ່ການຈ້າງງານ/ສະຫວັດດີການ ຫຼື ເພີ່ມທັກສະຄວາມຊຳນານໃນຕຳແໜ່ງໜ້າທີ່", isCaution: false },
        { text: "ການລາເພື່ອການສຶກສາຕໍ່ຂອງພະນັກງານເອງ ບໍ່ສາມາດໃຊ້ສິດການລາປະເພດນີ້ໄດ້", isCaution: true },
        { text: "ຕ້ອງແຈ້ງລ່ວງໜ້າບໍ່ໜ້ອຍກວ່າ 7 ວັນ ແລະ ຕ້ອງໄດ້ຮັບອະນຸມັດຈາກຜູ້ບໍລິຫານກ່ອນທຸກຄັ້ງ", isCaution: false }
      ]
    },
    {
      title: "ຂໍ້ຄວນລະວັງ & ບົດລົງໂທດທາງວິໄນ",
      icon: "warning",
      isCautionBox: true,
      items: [
        { text: "ພະນັກງານທີ່ມາຊ້າ <b>3 ຄັ້ງພາຍໃນຮອບເດືອນ</b> ຈະໄດ້ຮັບໜັງສືເຕືອນເປັນລາຍລັກອັກສອນ", isCaution: true },
        { text: "ການຢຸດວຽກໂດຍບໍ່ສົ່ງໃບລາ ຫຼື ໃບລາບໍ່ໄດ້ຮັບການອະນຸມັດ ຖືເປັນການຂາດວຽກໂດຍເຈດຕະນາ", isCaution: true },
        { text: "ຂາດວຽກຕິດຕໍ່ກັນ <b>3 ວັນເຮັດວຽກ</b> ໂດຍບໍ່ມີເຫດຜົນອັນສົມຄວນ ບໍລິສັດມີສິດເລີກຈ້າງທັນທີໂດຍບໍ່ຈ່າຍຄ່າຊົດເຊີຍ", isCaution: true }
      ]
    }
  ],
  my: [
    {
      title: "၁။ နာမကျန်းခွင့်",
      icon: "medical_services",
      items: [
        { text: "အမှန်တကယ် ဖျားနာသလောက် ခွင့်ယူနိုင်ပြီး ပုံမှန်လစာရရှိမည် <b>တစ်နှစ်လျှင် အလုပ်လုပ်ရက် ၃၀ ရက်ထက် မပိုစေရ</b>", isCaution: false },
        { text: "အလုပ်လုပ်ရက် ၁ ရက်နှင့်အထက် နာမကျန်းခွင့်ယူပါက လက်ရှိဆေးလက်မှတ် တင်ပြရမည်", isCaution: true },
        { text: "မမှန်မကန် နာမကျန်းခွင့်ယူပါက ကြီးလေးသော စည်းကမ်းဖောက်ဖျက်မှုအဖြစ် သတ်မှတ်မည်", isCaution: false }
      ]
    },
    {
      title: "၂။ အရေးကြီးကိစ္စအတွက် ကိုယ်ရေးကိုယ်တာခွင့်",
      icon: "assignment_ind",
      items: [
        { text: "လစာပြည့်ဖြင့် ကိုယ်ရေးကိုယ်တာခွင့် ခွင့်ပြုချက်ရရှိနိုင်သည် <b>တစ်နှစ်လျှင် အလုပ်လုပ်ရက် ၃ ရက်ထက် မပိုစေရ</b>", isCaution: false },
        { text: "ကိုယ်တိုင် ဆောင်ရွက်ရမည့် ကိစ္စဖြစ်ပြီး အလုပ်ချိန်ပြင်ပတွင် မလုပ်ဆောင်နိုင်သော ကိစ္စဖြစ်ရမည်", isCaution: false },
        { text: "အနည်းဆုံး အလုပ်လုပ်ရက် ၁ ရက် ကြိုတင်၍ ခွင့်တောင်းခံလွှာ တင်ရမည် (အရေးပေါ်ကိစ္စမှအပ)", isCaution: false }
      ]
    },
    {
      title: "၃။ နှစ်ပတ်လည် အားလပ်ရက် ခွင့်",
      icon: "flight_takeoff",
      items: [
        { text: "လုပ်သက် ၁ နှစ်ပြည့်သော ဝန်ထမ်းများသည် နှစ်ပတ်လည်ခွင့်ကို <b>တစ်နှစ်လျှင် အလုပ်လုပ်ရက် အနည်းဆုံး ၆ ရက်</b> ခံစားခွင့်ရှိသည်", isCaution: false },
        { text: "ဌာနမှူးမှ လုပ်သားအင်အား စီမံခန့်ခွဲနိုင်ရန်နှင့် ကြိုတင်အတည်ပြုချက် ရယူနိုင်ရန် အမြဲကြိုတင်တင်ရမည်", isCaution: false }
      ]
    },
    {
      title: "၄။ မီးဖွားခွင့်",
      icon: "child_care",
      items: [
        { text: "ဝန်ထမ်းများသည် မီးဖွားခွင့်ကို <b>ရက်ပေါင်း ၁၂၀ ထက် မပိုဘဲ</b> ယူနိုင်သည် (အပတ်စဉ် အားလပ်ရက်များ အပါအဝင်)", isCaution: false },
        { text: "ကုမ္ပဏီမှ ပုံမှန်လစာ ၆၀ ရက် ပေးချေမည်ဖြစ်ပြီး လူမှုဖူလုံရေးမှ ထောက်ပံ့ကြေး နောက်ထပ် ၆၀ ရက် ရရှိမည်", isCaution: false },
        { text: "မီးဖွားမည့်ရက် မတိုင်မီ သင့်လျော်သလို ကြိုတင်ခွင့်တောင်းခံနိုင်သည်", isCaution: false }
      ]
    },
    {
      title: "၅။ သားကြောဖြတ်/မျိုးအောင်ခြင်းတားဆီးခွင့်",
      icon: "vaccines",
      items: [
        { text: "လက်ရှိဆရာဝန် သတ်မှတ်ထားသော ကာလအတိုင်း ခွင့်ယူပိုင်ခွင့်ရှိသည်", isCaution: false },
        { text: "ဆေးလက်မှတ်တွင် ဖော်ပြထားသည့်အတိုင်း ခွင့်ရက်များအတွက် လစာပြည့် ရရှိမည်", isCaution: false },
        { text: "ဆရာဝန်ရက်ချိန်း စာရွက်စာတမ်းများနှင့်အတူ ကြိုတင်အကြောင်းကြား၍ ခွင့်တင်ရမည်", isCaution: false }
      ]
    },
    {
      title: "၆။ စစ်မှုထမ်းရန် ခွင့်",
      icon: "military_tech",
      items: [
        { text: "အစိုးရ၏ ဆင့်ခေါ်စာအရ စစ်မှုထမ်းခြင်း၊ စစ်ဆေးခြင်း သို့မဟုတ် စစ်ရေးလေ့ကျင့်ခြင်းအတွက် ခွင့်ယူနိုင်သည်", isCaution: false },
        { text: "ခွင့်ကာလအတွင်း ပုံမှန်လစာရရှိမည် <b>တစ်နှစ်လျှင် ရက်ပေါင်း ၆၀ ထက် မပိုစေရ</b>", isCaution: false },
        { text: "စာရွက်စာတမ်း ရရှိသည်နှင့် တပြိုင်နက် ဆင့်ခေါ်စာ မိတ္တူတွဲ၍ ခွင့်တင်ရမည်", isCaution: false }
      ]
    },
    {
      title: "၇။ ဈာပနကိစ္စအတွက် ခွင့်",
      icon: "heart_broken",
      items: [
        { text: "ဇနီး/ခင်ပွန်း၊ သားသမီး၊ မိဘ သေဆုံးပါက သင့်လျော်သလို ခွင့်ယူပိုင်ခွင့်ရှိသည်", isCaution: false },
        { text: "ကုမ္ပဏီမှ လစာပြည့် အထူးခွင့်ခံစားခွင့် ပေးသည် (ရက်အရေအတွက်မှာ ကုမ္ပဏီသက်သာချောင်ချိရေး မူဝါဒအတိုင်းဖြစ်သည်)", isCaution: false },
        { text: "သေစာရင်းကဲ့သို့သော အထောက်အထားများကို အလုပ်ပြန်လည်ဝင်ရောက်ပြီး ၇ ရက်အတွင်း နောက်ကြောင်းပြန် တင်ပြနိုင်သည်", isCaution: false }
      ]
    },
    {
      title: "၈။ ရဟန်း/သီလရှင် ဝတ်ရန် ခွင့်",
      icon: "temple_buddhist",
      items: [
        { text: "အမှန်တကယ် လစာရရှိမည် <b>၁၅ ရက်ထက် မပိုစေရ</b> (လုပ်သက်တစ်လျှောက် ၁ ကြိမ်သာ ခံစားခွင့်ရှိသည်)", isCaution: false },
        { text: "အနည်းဆုံး ၁၅ ရက် ကြိုတင်ခွင့်ပြုချက် ရယူရမည်ဖြစ်ပြီး သိက္ခာချပြီး ၃ ရက်အတွင်း အလုပ်ပြန်ဝင်ရမည်", isCaution: false }
      ]
    },
    {
      title: "၉။ အသိပညာတိုးပွားရေး သင်တန်းတက်ရောက်ရန် ခွင့်",
      icon: "school",
      items: [
        { text: "အလုပ်အကိုင်/သက်သာချောင်ချိရေးအတွက် သို့မဟုတ် လုပ်ငန်းကျွမ်းကျင်မှု တိုးတက်စေရန် ခွင့်ယူနိုင်သည်", isCaution: false },
        { text: "ဝန်ထမ်းကိုယ်တိုင် ပညာဆက်လက်သင်ကြားရန် ခွင့်ယူခြင်းသည် ဤခွင့်အမျိုးအစားတွင် မပါဝင်ပါ", isCaution: true },
        { text: "အနည်းဆုံး ၇ ရက် ကြိုတင်အကြောင်းကြားရမည်ဖြစ်ပြီး စီမံခန့်ခွဲသူထံမှ အမြဲတမ်း ကြိုတင်အတည်ပြုချက် ရယူရမည်", isCaution: false }
      ]
    },
    {
      title: "သတိပြုရန်နှင့် စည်းကမ်းပိုင်းဆိုင်ရာ ပြစ်ဒဏ်များ",
      icon: "warning",
      isCautionBox: true,
      items: [
        { text: "တစ်လအတွင်း <b>၃ ကြိမ် နောက်ကျသော</b> ဝန်ထမ်းသည် စာဖြင့် ရေးသားထားသော သတိပေးစာ ရရှိမည်", isCaution: true },
        { text: "ခွင့်မတင်ဘဲ သို့မဟုတ် ခွင့်မကျဘဲ အလုပ်ပျက်ကွက်ခြင်းသည် တမင်အလုပ်ပျက်ကွက်ခြင်းဟု သတ်မှတ်သည်", isCaution: true },
        { text: "ခိုင်လုံသော အကြောင်းပြချက်မရှိဘဲ အလုပ်လုပ်ရက် <b>၃ ရက် ဆက်တိုက်</b> အလုပ်ပျက်ကွက်ပါက ကုမ္ပဏီသည် လျော်ကြေးမပေးဘဲ ချက်ချင်း အလုပ်ထုတ်ပိုင်ခွင့်ရှိသည်", isCaution: true }
      ]
    }
  ]
};

window.renderLeaveRulesCards = function(lang) {
  const grid = document.querySelector(".rules-grid-layout");
  if (!grid) return;
  if (!window.leaveRulesData) return;

  const currentLang = (lang && window.leaveRulesData[lang]) ? lang : (window.getGlobalLanguage() || "th");
  const rules = window.leaveRulesData[currentLang] || window.leaveRulesData.th;
  if (!rules || !rules.length) return;

  const cards = grid.querySelectorAll(".rule-box-card");
  if (cards.length === rules.length) {
    rules.forEach((rule, idx) => {
      const card = cards[idx];
      if (!card) return;
      
      const headerTag = card.querySelector(".card-header-tag");
      if (headerTag) {
        headerTag.innerHTML = `<span class="material-symbols-outlined">${rule.icon}</span> ${rule.title}`;
      }
      
      const ul = card.querySelector(".rule-list-item");
      if (ul && rule.items) {
        ul.innerHTML = rule.items.map(item => {
          const cautionClass = item.isCaution ? ' class="rule-caution"' : '';
          return `<li${cautionClass}>${item.text}</li>`;
        }).join("");
      }
    });
  } else {
    grid.innerHTML = rules.map(rule => {
      const isFull = rule.isCautionBox ? " caution-box-layout caution-box-fullwidth" : "";
      const headerStyle = rule.isCautionBox ? ' style="background: #fef2f2; color: var(--danger, #ef4444); border-color: #fecaca;"' : "";
      const listItems = rule.items.map(item => {
        const cautionClass = item.isCaution ? ' class="rule-caution"' : '';
        return `<li${cautionClass}>${item.text}</li>`;
      }).join("");

      return `
        <article class="rule-box-card${isFull}">
          <div class="card-header-tag"${headerStyle}>
            <span class="material-symbols-outlined">${rule.icon}</span> ${rule.title}
          </div>
          <ul class="rule-list-item">
            ${listItems}
          </ul>
        </article>
      `;
    }).join("");
  }
};

window.getGlobalLanguage = function() {
  return localStorage.getItem("pvt_login_lang") || "th";
};

window.getPVTTranslation = function(key) {
  const lang = window.getGlobalLanguage();
  const dict = window.globalAppTranslations[lang] || window.globalAppTranslations.th;
  return dict[key] || window.globalAppTranslations.th[key] || key;
};

// Global translation lock to prevent MutationObserver storms & race conditions
window.__pvtIsTranslating = false;

// =========================================================================
// 🌐 Real-Time Database Category & Dynamic Data String Mapping Engine
// =========================================================================
window.PVT_DATABASE_CATEGORY_DICTIONARY = window.PVT_DATABASE_CATEGORY_DICTIONARY || {
  // 1. Leave Categories
  leaveSick: {
    keys: ["sick", "leave_sick", "sl", "ลาป่วย", "ລາປ່ວຍ", "နာမကျန်းခွင့်", "sick leave"],
    translations: { th: "ลาป่วย", lo: "ລາປ່ວຍ", my: "နာမကျန်းခွင့်" }
  },
  leaveAnnual: {
    keys: ["annual", "leave_annual", "al", "วันหยุดพักผ่อนประจำปี", "ลาพักร้อน", "ວັນພັກຜ່ອນປະຈຳປີ", "နှစ်ပတ်လည် ခွင့်ရက်", "annual leave", "annual vacation"],
    translations: { th: "วันหยุดพักผ่อนประจำปี", lo: "ວັນພັກຜ່ອນປະຈຳປີ", my: "နှစ်ပတ်လည် ခွင့်ရက်" }
  },
  leaveBusiness: {
    keys: ["business", "leave_business", "bl", "การลากิจเพื่อธุรกิจอันจำเป็น", "ลากิจ", "ลากิจธุระ", "ລາທຸລະກິດທີ່ຈຳເປັນ", "ລາທຸລະກິດ", "ကိုယ်ရေးကိုယ်တာ ခွင့်", "business leave", "personal leave"],
    translations: { th: "การลากิจเพื่อธุรกิจอันจำเป็น", lo: "ລາທຸລະກິດທີ່ຈຳເປັນ", my: "ကိုယ်ရေးကိုယ်တာ ခွင့်" }
  },
  leaveSterilization: {
    keys: ["sterilization", "leave_sterilization", "stl", "การลาเพื่อทำหมัน", "ลาทำหมัน", "ລາເພື່ອທຳໝັນ", "မျိုးအောင်ရန်ခွင့်", "sterilization leave"],
    translations: { th: "การลาเพื่อทำหมัน", lo: "ລາເພື່ອທຳໝັນ", my: "မျိုးအောင်ရန်ခွင့်" }
  },
  leaveMilitary: {
    keys: ["military", "leave_military", "ml", "การลาเพื่อรับราชการทหาร", "ลาทหาร", "ລາເພື່ອຮັບລາຊະການທະຫານ", "စစ်မှုထမ်းခွင့်", "military leave"],
    translations: { th: "การลาเพื่อรับราชการทหาร", lo: "ລາເພື່ອຮັບລາຊະການທະຫານ", my: "စစ်မှုထမ်းခွင့်" }
  },
  leaveOrdination: {
    keys: ["ordination", "leave_ordination", "ol", "การลาเพื่ออุปสมบท", "ลาบวช", "ລາເພື່ອບວດ", "ရဟန်းဝတ်ခွင့်", "ရဟန်း/သီလရှင် ဝတ်ရန် ခွင့်", "ordination leave"],
    translations: { th: "การลาเพื่ออุปสมบท", lo: "ລາເພື່ອບວດ", my: "ရဟန်း/သီလရှင် ဝတ်ရန် ခွင့်" }
  },
  leaveFuneral: {
    keys: ["funeral", "leave_funeral", "fl", "การลาเพื่อฌาปนกิจศพ", "ลาฌาปนกิจศพ", "ລາເພື່ອຊາປນາກິດສົບ", "ဈာပနခွင့်", "funeral leave"],
    translations: { th: "การลาเพื่อฌาปนกิจศพ", lo: "ລາເພື່ອຊາປນາກິດສົບ", my: "ဈာပနခွင့်" }
  },
  leaveMaternity: {
    keys: ["maternity", "leave_maternity", "mtl", "การลาเพื่อคลอดบุตร", "ลาคลอด", "ລາເພື່ອຄອດບຸດ", "မီးဖွားခွင့်", "maternity leave"],
    translations: { th: "การลาเพื่อคลอดบุตร", lo: "ລາເພື່ອຄອດບຸດ", my: "မီးဖွားခွင့်" }
  },
  leaveTraining: {
    keys: ["training", "leave_training", "tl", "การลาเพื่อฝึกอบรมพัฒนาความรู้", "ລາເພື່ອຝຶກອົບຮົມ", "လေ့ကျင့်ရေး ခွင့်", "training leave"],
    translations: { th: "การลาเพื่อฝึกอบรมพัฒนาความรู้", lo: "ການລາເພື່ອຝຶກອົບຮົມ", my: "လေ့ကျင့်ရေး ခွင့်" }
  },
  leaveOther: {
    keys: ["other", "leave_other", "ot", "ลาอื่น ๆ", "ลาอื่นๆ", "ລາອື່ນໆ", "အခြားခွင့်များ", "other leave"],
    translations: { th: "ลาอื่น ๆ", lo: "ລາອື່ນໆ", my: "အခြားခွင့်များ" }
  },

  // 2. Holiday Categories
  optOfficial: {
    keys: ["official", "วันหยุดตามประเพณี", "วันหยุดราชการ", "ວັນພັກລັດຖະການ", "ວັນພັກລັດຖະການ / ປະເພນີ", "အစိုးရရုံးပိတ်ရက်", "public holiday", "official holiday"],
    translations: { th: "วันหยุดตามประเพณี", lo: "ວັນພັກລັດຖະການ", my: "အစိုးရရုံးပိတ်ရက်" }
  },
  optCompany: {
    keys: ["company", "วันหยุดบริษัท", "วันหยุดพิเศษบริษัท", "ວັນພັກບໍລິສັດ", "ວັນພັກພິເສດບໍລິສັດ", "ကုမ္ပဏီပိတ်ရက်", "company holiday"],
    translations: { th: "วันหยุดบริษัท", lo: "ວັນພັກບໍລິສັດ", my: "ကုမ္ပဏီပိတ်ရက်" }
  },
  optSubstitution: {
    keys: ["substitution", "substitute", "วันหยุดชดเชย", "ວັນພັກຊົດເຊີຍ", "အစားထိုး ပိတ်ရက်", "substitution holiday"],
    translations: { th: "วันหยุดชดเชย", lo: "ວັນພັກຊົດເຊີຍ", my: "အစားထိုး ပိတ်ရက်" }
  },

  // 3. Approval & Request Statuses
  statusPending: {
    keys: ["pending", "waiting", "รออนุมัติ", "รอการอนุมัติ", "ຖ້າອະນຸມັດ", "စောင့်ဆိုင်းဆဲ", "pending approval"],
    translations: { th: "รออนุมัติ", lo: "ຖ້າອະນຸມັດ", my: "စောင့်ဆိုင်းဆဲ" }
  },
  statusApproved: {
    keys: ["approved", "อนุมัติ", "อนุมัติแล้ว", "ອະນຸມັດ", "ອະນຸມັດແລ້ວ", "အတည်ပြုပြီး", "approved"],
    translations: { th: "อนุมัติแล้ว", lo: "ອະນຸມັດແລ້ວ", my: "အတည်ပြုပြီး" }
  },
  statusRejected: {
    keys: ["rejected", "disapproved", "ไม่อนุมัติ", "ปฏิเสธ", "ບໍ່ອະນຸມັດ", "ငြင်းပယ်သည်", "rejected"],
    translations: { th: "ไม่อนุมัติ", lo: "ບໍ່ອະນຸມັດ", my: "ငြင်းပယ်သည်" }
  },
  statusCancelled: {
    keys: ["cancelled", "cancelled_by_user", "canceled", "ยกเลิกแล้ว", "ยกเลิก", "ຍົກເລີກແລ້ວ", "ຍົກເລີກ", "ပယ်ဖျက်ပြီး", "cancelled"],
    translations: { th: "ยกเลิกแล้ว", lo: "ຍົກເລີກແລ້ວ", my: "ပယ်ဖျက်ပြီး" }
  },
  statusCancelReq: {
    keys: ["cancel_requested", "cancel_pending", "รอ hr อนุมัติยกเลิก", "รอ hr ຍົກເລີກ", "ขอยกเลิก", "ຖ້າ hr ອະນຸມັດຍົກເລີກ", "hr ပယ်ဖျက်ရန် စောင့်ဆိုင်းဆဲ", "cancel requested"],
    translations: { th: "รอ HR อนุมัติยกเลิก", lo: "ຖ້າ HR ອະນຸມັດຍົກເລີກ", my: "HR ပယ်ဖျက်ရန် စောင့်ဆိုင်းဆဲ" }
  },
  statusWaitingReview: {
    keys: ["waiting_review", "under_review", "รอพิจารณา", "ຖ້າພິຈາລະນາ", "စိစစ်ဆဲ"],
    translations: { th: "รอพิจารณา", lo: "ຖ້າພິຈາລະນາ", my: "စိစစ်ဆဲ" }
  },
  badgeWaitingHr: {
    keys: ["submitted", "sending", "ส่งเรื่องแล้ว", "ສົ່ງເລື່ອງແລ້ວ", "တင်ပြပြီး"],
    translations: { th: "ส่งเรื่องแล้ว", lo: "ສົ່ງເລື່ອງແລ້ວ", my: "တင်ပြပြီး" }
  },

  // 4. Units & Shorthands
  unitDays: {
    keys: ["day", "days", "วัน", "ວັນ", "ရက်"],
    translations: { th: "วัน", lo: "ວັນ", my: "ရက်" }
  },
  unitHours: {
    keys: ["hour", "hours", "ชม.", "ชั่วโมง", "ຊມ.", "နာရီ"],
    translations: { th: "ชม.", lo: "ຊມ.", my: "နာရီ" }
  },
  unitMinutes: {
    keys: ["minute", "minutes", "นาที", "ນາທີ", "မိနစ်"],
    translations: { th: "นาที", lo: "ນາທີ", my: "မိနစ်" }
  },
  unitItems: {
    keys: ["item", "items", "รายการ", "ລາຍການ", "ခု"],
    translations: { th: "รายการ", lo: "ລາຍການ", my: "ခု" }
  }
};

/**
 * 🏷️ Real-time Category & Data String Mapping Function
 * Maps raw database-driven category strings, codes, or UI values into localized strings.
 */
window.localizeCategory = function(rawString, targetLang) {
  if (rawString === null || rawString === undefined) return "-";
  const str = String(rawString).trim();
  if (!str) return "-";

  const lang = targetLang || window.getGlobalLanguage() || "th";
  const normalized = str.toLowerCase();

  // 1. Direct Lookup in Database Category Dictionary
  for (const entry of Object.values(PVT_DATABASE_CATEGORY_DICTIONARY)) {
    if (entry.keys.some(k => k.toLowerCase() === normalized)) {
      return entry.translations[lang] || entry.translations.th || str;
    }
  }

  // 2. Fuzzy / Substring Matching for dynamic phrases
  if (normalized.includes("ป่วย") || normalized.includes("sick")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveSick.translations[lang];
  }
  if (normalized.includes("พักผ่อน") || normalized.includes("พักร้อน") || normalized.includes("annual")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveAnnual.translations[lang];
  }
  if (normalized.includes("กิจ") || normalized.includes("business")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveBusiness.translations[lang];
  }
  if (normalized.includes("ทำหมัน") || normalized.includes("หมัน") || normalized.includes("steril")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveSterilization.translations[lang];
  }
  if (normalized.includes("ทหาร") || normalized.includes("military")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveMilitary.translations[lang];
  }
  if (normalized.includes("อุปสมบท") || normalized.includes("บวช") || normalized.includes("ordina")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveOrdination.translations[lang];
  }
  if (normalized.includes("ฌาปนกิจ") || normalized.includes("ศพ") || normalized.includes("funeral")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveFuneral.translations[lang];
  }
  if (normalized.includes("คลอด") || normalized.includes("matern")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveMaternity.translations[lang];
  }
  if (normalized.includes("ฝึกอบรม") || normalized.includes("training")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveTraining.translations[lang];
  }
  if (normalized.includes("อื่น") || normalized.includes("other")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.leaveOther.translations[lang];
  }

  // Holiday fuzzy matching
  if (normalized.includes("ประเพณี") || normalized.includes("ราชการ") || normalized.includes("official")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.optOfficial.translations[lang];
  }
  if (normalized.includes("บริษัท") || normalized.includes("company")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.optCompany.translations[lang];
  }
  if (normalized.includes("ชดเชย") || normalized.includes("substitut")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.optSubstitution.translations[lang];
  }

  // Status fuzzy matching
  if (normalized.includes("รอ hr") || normalized.includes("ขอยกเลิก") || normalized.includes("cancel_req") || normalized.includes("cancel_pending")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.statusCancelReq.translations[lang];
  }
  if (normalized.includes("ยกเลิก") || normalized.includes("cancel")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.statusCancelled.translations[lang];
  }
  if (normalized.includes("ไม่อนุมัติ") || normalized.includes("ปฏิเสธ") || normalized.includes("reject")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.statusRejected.translations[lang];
  }
  if (normalized.includes("รออนุมัติ") || normalized.includes("รอ") || normalized.includes("pending")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.statusPending.translations[lang];
  }
  if (normalized.includes("อนุมัติ") || normalized.includes("approve")) {
    return PVT_DATABASE_CATEGORY_DICTIONARY.statusApproved.translations[lang];
  }

  return str;
};

window.translateDataCategory = window.localizeCategory;
window.translateDataString = window.localizeCategory;

/**
 * 🔬 Deep-Scanning Function for Dynamic Data-Driven Tables and Lists
 * Traverses DOM nodes in tables, lists, cards, and badges to localize database strings in real-time.
 */
window.deepScanTranslateDynamicContent = function(containerRoot, targetLang) {
  const root = containerRoot || document.body;
  if (!root) return;
  const lang = targetLang || window.getGlobalLanguage() || "th";
  const t = window.globalAppTranslations[lang] || window.globalAppTranslations.th;

  // 1. Scan and Localize Leave Category Titles in Tables & Lists
  root.querySelectorAll(".leave-type-title, strong.leave-title, .recent-item strong, [data-raw-cat], [data-category]").forEach(el => {
    if (el.classList.contains("pos-tab") || el.classList.contains("pos-modal-tab-btn") || el.closest(".pos-category-tabs") || el.closest(".pos-modal-tabs")) {
      return; // ข้ามปุ่มเลือกประเภทตำแหน่งงาน เพื่อคงโครงสร้างป้ายและตัวเลขจำนวนพนักงานไว้
    }
    if (!el.dataset.rawCat) {
      el.dataset.rawCat = el.getAttribute("data-category") || el.textContent.trim();
    }
    const localized = window.localizeCategory(el.dataset.rawCat, lang);
    if (localized && localized !== "-") {
      el.textContent = localized;
    }
  });

  // 2. Scan and Localize Status Badges & Action Badges
  root.querySelectorAll(".status-badge, .badge-status, .badge-waiting-hr, .status, [data-raw-status], [data-status]").forEach(el => {
    const iconEl = el.querySelector(".material-symbols-outlined");
    const iconHtml = iconEl ? iconEl.outerHTML : "";

    if (!el.dataset.rawStatus) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll(".material-symbols-outlined").forEach(i => i.remove());
      el.dataset.rawStatus = el.getAttribute("data-status") || clone.textContent.trim();
    }

    const locStatus = window.localizeCategory(el.dataset.rawStatus, lang);
    if (locStatus && locStatus !== "-") {
      if (iconHtml) {
        el.innerHTML = `${iconHtml} ${locStatus}`.trim();
      } else {
        el.textContent = locStatus;
      }
    }
  });

  // 3. Scan and Localize Day Count & Duration Badges
  root.querySelectorAll(".day-count-badge, .duration-badge").forEach(el => {
    let txt = el.textContent.trim();
    if (!txt) return;

    // Unit Replacements
    const uDays = t.unitDays || "วัน";
    const uHours = t.unitHours || "ชม.";
    const uMins = t.unitMinutes || "นาที";

    txt = txt.replace(/(วัน|ວັນ|ရက်|days|day)/gi, uDays)
             .replace(/(ชม\.|ຊມ\.|နာရီ|hours|hour|ชั่วโมง)/gi, uHours)
             .replace(/(นาที|ນາທີ|မိနစ်|minutes|mins|min)/gi, uMins);
    
    el.textContent = txt;
  });

  // 4. Scan and Localize Table Cell Responsive Data Labels (td[data-label])
  root.querySelectorAll("td[data-label]").forEach(td => {
    const rawLabel = td.getAttribute("data-label") || "";
    if (rawLabel.includes("ประเภท") || rawLabel.includes("ປະເພດ") || rawLabel.includes("ခွင့်အမျိုးအစား")) {
      td.setAttribute("data-label", t.thLeaveType || "ประเภทการลา");
    } else if (rawLabel.includes("ช่วง") || rawLabel.includes("ຊ່ວງ") || rawLabel.includes("အပိုင်းအခြား") || rawLabel.includes("วันที่")) {
      td.setAttribute("data-label", t.thDateRange || "ช่วงวันที่");
    } else if (rawLabel.includes("จำนวน") || rawLabel.includes("ຈຳນວນ") || rawLabel.includes("ရက်ပေါင်း")) {
      td.setAttribute("data-label", t.thDays || "จำนวนวัน");
    } else if (rawLabel.includes("เหตุผล") || rawLabel.includes("ເຫດຜົນ") || rawLabel.includes("အကြောင်း")) {
      td.setAttribute("data-label", t.thReason || "เหตุผล");
    } else if (rawLabel.includes("สถานะ") || rawLabel.includes("ສະຖານະ") || rawLabel.includes("အခြေအနေ")) {
      td.setAttribute("data-label", t.thStatus || "สถานะ");
    } else if (rawLabel.includes("จัดการ") || rawLabel.includes("ຈັດການ") || rawLabel.includes("စီမံ")) {
      td.setAttribute("data-label", t.thAction || "จัดการคำขอ");
    }
  });

  // 5. Scan and Localize Dynamic Table Action Buttons
  root.querySelectorAll(".btn-cancel-direct").forEach(btn => {
    const icon = btn.querySelector(".material-symbols-outlined");
    const iconHtml = icon ? icon.outerHTML : '<span class="material-symbols-outlined">close</span>';
    btn.innerHTML = `${iconHtml} ${t.btnDirectCancel || "ยกเลิกคำขอ"}`.trim();
    btn.setAttribute("title", t.btnDirectCancel || "ยกเลิกคำขอ");
  });

  root.querySelectorAll(".btn-request-cancel").forEach(btn => {
    const icon = btn.querySelector(".material-symbols-outlined");
    const iconHtml = icon ? icon.outerHTML : '<span class="material-symbols-outlined">assignment_return</span>';
    btn.innerHTML = `${iconHtml} ${t.btnRequestCancel || "ขอยกเลิกใบลา"}`.trim();
    btn.setAttribute("title", t.btnRequestCancel || "ขอยกเลิกใบลา");
  });

  // 6. Scan and Localize Reason Prefixes inside Tables & Lists
  root.querySelectorAll(".td-reason div strong, .recent-item div").forEach(div => {
    if (div.tagName === "STRONG") {
      const sText = div.textContent.trim();
      if (sText.includes("ยกเลิก") || sText.includes("ຍົກເລີກ") || sText.includes("Cancel") || sText.includes("ပယ်ဖျက်")) {
        div.textContent = t.reasonCancelPrefix || "เหตุผลที่ยกเลิก:";
      } else if (sText.includes("ไม่อนุมัติ") || sText.includes("ບໍ່ອະນຸມັດ") || sText.includes("Reject") || sText.includes("ငြင်းပယ်")) {
        div.textContent = t.reasonRejectPrefix || "เหตุผลที่ไม่อนุมัติ:";
      }
    } else {
      // For text inside recent lists (e.g. 📅 วันที่: ... ⏱️ จำนวน: ...)
      const inner = div.innerHTML;
      if (inner.includes("📅") && (inner.includes("วันที่:") || inner.includes("ວັນທີ:") || inner.includes("ရက်စွဲ:"))) {
        const labelDates = lang === 'lo' ? "ວັນທີ:" : (lang === 'my' ? "ရက်စွဲ:" : "วันที่:");
        div.innerHTML = inner.replace(/(📅\s*)(วันที่:|ວັນທີ:|ရက်စွဲ:)/g, `$1${labelDates}`);
      }
      if (inner.includes("⏱️") && (inner.includes("จำนวน:") || inner.includes("ຈຳນວນ:") || inner.includes("အရေအတွက်:"))) {
        const labelDuration = lang === 'lo' ? "ຈຳນວນ:" : (lang === 'my' ? "အရေအတွက်:" : "จำนวน:");
        div.innerHTML = inner.replace(/(⏱️\s*)(จำนวน:|ຈຳນວນ:|အရေအတွက်:)/g, `$1${labelDuration}`);
      }
    }
  });

  // 7. Scan Holiday Category Tags
  root.querySelectorAll(".cat-tag, .holiday-tag, [data-raw-holiday-type]").forEach(el => {
    if (!el.dataset.rawHolidayType) {
      el.dataset.rawHolidayType = el.textContent.trim();
    }
    const locTag = window.localizeCategory(el.dataset.rawHolidayType, lang);
    if (locTag && locTag !== "-") {
      el.textContent = locTag;
    }
  });

  // 8. Scan Empty State Messages
  root.querySelectorAll(".empty-state").forEach(el => {
    const txt = el.textContent.trim();
    if (txt.includes("ไม่พบรายการใบลา") || txt.includes("ບໍ່ພົບລາຍການໃບລາ") || txt.includes("ခွင့်စာရင်း မရှိပါ")) {
      el.textContent = t.emptyHistory || "ไม่พบรายการใบลาตามเงื่อนไขที่เลือก";
    } else if (txt.includes("ยังไม่มีรายการยื่นใบลา") || txt.includes("ຍັງບໍ່ມີລາຍການຍື່ນໃບລາ") || txt.includes("ခွင့်စာရင်း မရှိသေးပါ")) {
      el.textContent = t.statAll ? (lang === 'lo' ? "ຍັງບໍ່ມີລາຍການຍື່ນໃບລາໃນລະບົບ" : (lang === 'my' ? "ခွင့်စာရင်း မရှိသေးပါ" : "ยังไม่มีรายการยื่นใบลาในระบบ")) : "ยังไม่มีรายการยื่นใบลาในระบบ";
    } else if (txt.includes("ไม่พบข้อมูลวันหยุด") || txt.includes("ບໍ່ພົບຂໍ້ມູນວັນພັກ") || txt.includes("ပိတ်ရက် အချက်အလက် မရှိပါ")) {
      el.textContent = t.emptyHolidays || (lang === 'lo' ? "ບໍ່ພົບຂໍ້ມູນວັນພັກ" : (lang === 'my' ? "ပိတ်ရက် အချက်အလက် မရှိပါ" : "ไม่พบข้อมูลวันหยุด"));
    }
  });
};

// Universal canonical phrase mapping (Bidirectional translation support)
window.CANONICAL_PHRASE_MAP = window.CANONICAL_PHRASE_MAP || {
  // Leave Types
  "ลาป่วย": "leaveSick", "ລາປ່ວຍ": "leaveSick", "နာမကျန်းခွင့်": "leaveSick",
  "วันหยุดพักผ่อนประจำปี": "leaveAnnual", "ลาพักร้อน": "leaveAnnual", "ວັນພັກຜ່ອນປະຈຳປີ": "leaveAnnual", "နှစ်ပတ်လည် ခွင့်ရက်": "leaveAnnual",
  "ลากิจ": "leaveBusiness", "ลากิจธุระ": "leaveBusiness", "การลากิจเพื่อธุรกิจอันจำเป็น": "leaveBusiness", "ລາທຸລະກິດ": "leaveBusiness", "ລາທຸລະກິດທີ່ຈຳເປັນ": "leaveBusiness", "ကိုယ်ရေးကိုယ်တာ ခွင့်": "leaveBusiness",
  "การลาเพื่อทำหมัน": "leaveSterilization", "ลาทำหมัน": "leaveSterilization", "ລາເພື່ອທຳໝັນ": "leaveSterilization", "မျိုးအောင်ရန်ခွင့်": "leaveSterilization",
  "การลาเพื่อรับราชการทหาร": "leaveMilitary", "ลาทหาร": "leaveMilitary", "ລາເພື່ອຮັບລາຊະການທະຫານ": "leaveMilitary", "စစ်မှုထမ်းခွင့်": "leaveMilitary",
  "การลาเพื่ออุปสมบท": "leaveOrdination", "ลาบวช": "leaveOrdination", "ລາເພື່ອບວດ": "leaveOrdination", "ရဟန်းဝတ်ခွင့်": "leaveOrdination", "ရဟန်း/သီလရှင် ဝတ်ရန် ခွင့်": "leaveOrdination",
  "การลาเพื่อฌาปนกิจศพ": "leaveFuneral", "ลาฌาปนกิจศพ": "leaveFuneral", "ລາເພື່ອຊາປນາກິດສົບ": "leaveFuneral", "ဈာပနခွင့်": "leaveFuneral",
  "การลาเพื่อคลอดบุตร": "leaveMaternity", "ลาคลอด": "leaveMaternity", "ລາເພື່ອຄອດບຸດ": "leaveMaternity", "မီးဖွားခွင့်": "leaveMaternity",
  "ลาอื่น ๆ": "leaveOther", "ลาอื่นๆ": "leaveOther", "ລາອື່ນໆ": "leaveOther", "အခြားခွင့်များ": "leaveOther",
  "การลาเพื่อฝึกอบรมพัฒนาความรู้": "guideTitle",
  
  // Statuses
  "อนุมัติ": "statusApproved", "อนุมัติแล้ว": "statusApproved", "ອະນຸມັດ": "statusApproved", "ອະນຸມັດແລ້ວ": "statusApproved", "အတည်ပြုပြီး": "statusApproved",
  "รออนุมัติ": "statusPending", "ຖ້າອະນຸມັດ": "statusPending", "စောင့်ဆိုင်းဆဲ": "statusPending",
  "ไม่อนุมัติ": "statusRejected", "ບໍ່ອະນຸມັດ": "statusRejected", "ငြင်းပယ်သည်": "statusRejected",
  "ยกเลิกแล้ว": "statusCancelled", "ຍົກເລີກແລ້ວ": "statusCancelled", "ပယ်ဖျက်ပြီး": "statusCancelled",
  "รอ HR อนุมัติยกเลิก": "statusCancelReq", "ຖ້າ HR ອະນຸມັດຍົກເລີກ": "statusCancelReq", "HR ပယ်ဖျက်ရန် စောင့်ဆိုင်းဆဲ": "statusCancelReq",
  "รอพิจารณา": "statusWaitingReview", "ຖ້າພິຈາລະນາ": "statusWaitingReview", "စိစစ်ဆဲ": "statusWaitingReview",
  "ส่งเรื่องแล้ว": "badgeWaitingHr", "ສົ່ງເລື່ອງແລ້ວ": "badgeWaitingHr",
  
  // System messages & loadings
  "กำลังโหลดรายการลา...": "loadingLeave", "ກຳລັງໂຫຼດລາຍການລາ...": "loadingLeave", "ခွင့်စာရင်းများကို တင်နေသည်...": "loadingLeave",
  "กำลังโหลดข้อมูล...": "loading", "ກຳລັງໂຫຼດຂໍ້ມູນ...": "loading", "အချက်အလက်များ တင်နေသည်...": "loading",
  "ยังไม่มีรายการยื่นใบลาในระบบ": "statAll",
  
  // Units
  "วัน": "unitDays", "ວັນ": "unitDays", "ရက်": "unitDays",
  "ชม.": "unitHours", "ຊມ.": "unitHours", "နာရီ": "unitHours",
  "นาที": "unitMinutes", "ນາທີ": "unitMinutes", "မိနစ်": "unitMinutes"
};

window.setGlobalLanguage = function(lang, reload = false) {
  if (!window.globalAppTranslations[lang]) lang = "th";
  localStorage.setItem("pvt_login_lang", lang);
  localStorage.setItem("pvt_language", lang); // Keep in sync for compatibility
  
  window.__pvtIsTranslating = true;
  const t = window.globalAppTranslations[lang] || window.globalAppTranslations.th;

  try {
    // 1. Highlight active buttons across switchers
    const allLangBtns = document.querySelectorAll("#langThBtn, #globalLangTh, #langLoBtn, #globalLangLo, #langMyBtn, #globalLangMy");
    allLangBtns.forEach(b => {
      b.style.backgroundColor = "transparent";
      b.style.color = "#64748b";
      b.style.boxShadow = "none";
      b.style.fontWeight = "600";
    });

    const activeTh = document.querySelectorAll("#langThBtn, #globalLangTh");
    const activeLo = document.querySelectorAll("#langLoBtn, #globalLangLo");
    const activeMy = document.querySelectorAll("#langMyBtn, #globalLangMy");

    const targets = lang === 'th' ? activeTh : (lang === 'lo' ? activeLo : activeMy);
    targets.forEach(btn => {
      btn.style.backgroundColor = "#ffffff";
      btn.style.color = "#0d9488";
      btn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";
      btn.style.fontWeight = "700";
    });

    // 2. Translate Top Navigation & Back / Logout buttons
    document.querySelectorAll(".btn-back, .btn-back-home, .btn-header-back, .back-btn").forEach(btn => {
      const icon = btn.querySelector(".material-symbols-outlined");
      const iconHtml = icon ? icon.outerHTML : '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">arrow_back</span>';
      const img = btn.querySelector("img");
      const pipe = btn.querySelector("span[style*='margin: 0 2px;']");
      if (img && pipe) {
        btn.innerHTML = `${iconHtml} ${t.back} ${pipe.outerHTML} ${img.outerHTML}`;
      } else {
        btn.innerHTML = `${iconHtml} ${t.back}`.trim();
      }
    });

    document.querySelectorAll(".logout-btn, button[onclick*='logout']").forEach(btn => {
      if (btn.classList.contains("btn-back") || btn.classList.contains("btn-back-home")) return;
      btn.textContent = t.logoutShort || t.logout;
    });

    // 3. Translate Sidebar Menu Items deterministically by icon or href
    document.querySelectorAll(".nav-menu .nav-item").forEach(item => {
      const labelSpan = item.querySelector(".nav-label");
      if (!labelSpan) return;
      const iconSpan = item.querySelector(".material-symbols-outlined");
      const iconName = iconSpan ? iconSpan.textContent.trim().toLowerCase() : "";
      const href = (item.getAttribute("href") || "").toLowerCase();

      if (iconName.includes("home") || href.includes("home")) {
        labelSpan.textContent = t.home;
        item.setAttribute("title", t.home);
      } else if (iconName.includes("fact_check") || href.includes("approval") || href.includes("leave-check")) {
        labelSpan.textContent = t.leaveCheck;
        item.setAttribute("title", t.leaveCheck);
      } else if (iconName.includes("manage_accounts") || href.includes("management")) {
        labelSpan.textContent = t.employeeManagement || "ระบบจัดการส่วนกลาง & ประวัติพนักงาน";
        item.setAttribute("title", t.employeeManagement || "ระบบจัดการส่วนกลาง & ประวัติพนักงาน");
      } else if (href.includes("index-user") || (iconName === "person" && href.includes("/user/"))) {
        labelSpan.textContent = t.userView;
        item.setAttribute("title", t.userView);
      } else if (iconName.includes("group") || iconName.includes("people") || href.includes("employee")) {
        labelSpan.textContent = t.employees;
        item.setAttribute("title", t.employees);
      } else if (iconName.includes("event") || iconName.includes("calendar") || href.includes("holiday")) {
        labelSpan.textContent = t.holidays;
        item.setAttribute("title", t.holidays);
      } else if (iconName.includes("badge") || iconName.includes("card") || href.includes("card")) {
        labelSpan.textContent = t.cardSystem;
        item.setAttribute("title", t.cardSystem);
      }
    });

    // =========================================================================
    // 🌐 Context-Aware Page-Specific Translations (Isolated by Page Route)
    // =========================================================================
    const pathname = (window.location.pathname || "").toLowerCase();
    const isProfilePage = pathname.includes("profile-user");
    const isLeavePage = pathname.includes("leave-user");
    const isHistoryPage = pathname.includes("leave-history");
    const isRulesPage = pathname.includes("leave-rules");
    const isHolidaysPage = pathname.includes("holidays");
    const isIndexUserPage = pathname.endsWith("/index-user.html") || pathname.endsWith("/index-user") || (pathname.includes("/user/") && !isProfilePage && !isLeavePage && !isHistoryPage && !isRulesPage && !isHolidaysPage);

    // 4. Translate User View Dashboard (index-user.html ONLY)
    if (isIndexUserPage) {
      const helloEl = document.getElementById("userHelloText") || document.querySelector(".user-header .hello");
      if (helloEl) helloEl.textContent = t.hello;

      const approverModeBtn = document.getElementById("approverModeBtn");
      if (approverModeBtn) {
        const titleSpan = approverModeBtn.querySelector("span[style*='font-weight: 700']") || approverModeBtn.querySelector(".approver-title");
        const subSpan = approverModeBtn.querySelector("span[style*='color: #bfdbfe']") || approverModeBtn.querySelector(".approver-sub");
        if (titleSpan) titleSpan.textContent = t.approverModeTitle;
        if (subSpan) subSpan.textContent = t.approverModeSub;
      }

      const heroLeaveText = document.querySelector(".btn-hero-text strong");
      const heroLeaveSub = document.querySelector(".btn-hero-text span");
      if (heroLeaveText) heroLeaveText.textContent = t.heroLeaveTitle;
      if (heroLeaveSub) heroLeaveSub.textContent = t.heroLeaveSub;

      const leaveBalanceHeading = document.querySelector(".leave-section h2");
      if (leaveBalanceHeading) leaveBalanceHeading.textContent = " " + t.leaveBalanceTitle;

      const quickMenuHeading = document.querySelector(".section-header h2");
      if (quickMenuHeading) quickMenuHeading.textContent = t.quickMenuTitle;

      const recentHeadH2 = document.querySelector(".recent-card .section-head h2");
      const recentHeadBtn = document.querySelector(".recent-card .section-head button:not(.btn-toggle-icon)");
      if (recentHeadH2) recentHeadH2.textContent = t.recentListHeading;
      if (recentHeadBtn) recentHeadBtn.textContent = t.viewAll;

      const teamTitleEl = document.getElementById("teamSectionTitle");
      const teamSubEl = document.getElementById("teamSectionSubtitle");
      if (teamTitleEl) teamTitleEl.textContent = t.teamTitle;
      if (teamSubEl) teamSubEl.textContent = t.teamSub;

      const notifTitleEl = document.querySelector(".notif-title strong");
      const markAllReadBtn = document.querySelector(".btn-mark-read");
      const notifFooterLink = document.querySelector(".notif-footer a");
      if (notifTitleEl) notifTitleEl.textContent = t.notifications;
      if (markAllReadBtn) markAllReadBtn.textContent = t.markAllRead;
      if (notifFooterLink) notifFooterLink.textContent = t.viewAllNotif;

      // Quick Menu Cards - deterministic matching by icon / onclick / href
      document.querySelectorAll(".menu-card").forEach(card => {
        const titleEl = card.querySelector("h3");
        const descEl = card.querySelector("p");
        const iconSpan = card.querySelector(".material-symbols-outlined");
        const iconText = iconSpan ? iconSpan.textContent.trim().toLowerCase() : "";
        const onclickAttr = card.getAttribute("onclick") || "";
        const href = card.querySelector("a")?.getAttribute("href") || "";

        if (onclickAttr.includes("line") || href.includes("line") || iconText.includes("chat") || iconText.includes("forum")) {
          if (titleEl) titleEl.textContent = t.lineConnect;
          if (descEl) descEl.textContent = t.lineNotif;
        } else if (onclickAttr.includes("showStaffCard") || href.includes("card") || iconText.includes("credit_card") || iconText.includes("badge") || iconText.includes("qr_code")) {
          if (titleEl) titleEl.textContent = t.viewCard || t.cardTitle;
          if (descEl) descEl.textContent = t.cardSub;
        } else if (onclickAttr.includes("goToRules") || href.includes("rules") || iconText.includes("menu_book") || iconText.includes("rule")) {
          if (titleEl) titleEl.textContent = t.ruleTitle;
          if (descEl) descEl.textContent = t.ruleSub;
        } else if (onclickAttr.includes("goToLeaveHistory") || href.includes("history") || iconText.includes("history")) {
          if (titleEl) titleEl.textContent = t.historyTitle;
          if (descEl) descEl.textContent = t.historySub;
        } else if (onclickAttr.includes("goToProfile") || href.includes("profile") || iconText.includes("person") || iconText.includes("account")) {
          if (titleEl) titleEl.textContent = t.profileTitle;
          if (descEl) descEl.textContent = t.profileSub;
        } else if (onclickAttr.includes("goToHolidays") || href.includes("holidays") || iconText.includes("event") || iconText.includes("calendar")) {
          if (titleEl) titleEl.textContent = t.holidayTitle;
          if (descEl) descEl.textContent = t.holidaySub;
        } else if (onclickAttr.includes("guide") || href.includes("guide") || iconText.includes("help") || iconText.includes("school")) {
          if (titleEl) titleEl.textContent = t.guideTitle;
          if (descEl) descEl.textContent = t.guideSub;
        }
      });
    }

    // 5. Translate Leave Request Page Elements (leave-user.html ONLY)
    if (isLeavePage) {
      const topbarTitle = document.querySelector(".topbar-title");
      const topbarSubs = document.querySelectorAll(".topbar-subtitle");
      if (topbarTitle) topbarTitle.textContent = t.leaveFormTitle;
      if (topbarSubs.length >= 1) topbarSubs[0].textContent = t.companySubtitle;
      if (topbarSubs.length >= 2) topbarSubs[1].textContent = t.periodSubtitle;

      const btnRules = document.querySelector(".topbar-actions .btn-ghost, a[href*='leave-rules']");
      if (btnRules && !btnRules.classList.contains("btn-back")) btnRules.textContent = t.ruleBtnText;

      const infoCardHeadH2 = document.querySelector(".info-card-head h2");
      if (infoCardHeadH2) {
        infoCardHeadH2.innerHTML = `${t.applicantInfoTitle} <span class="badge-autofill">${t.autofillBadge}</span>`;
      }

      // Info card labels by selector
      const codeLbl = document.querySelector("#label-emp-code, label[for='input-emp-code']");
      const nameLbl = document.querySelector("#label-emp-name, label[for='input-emp-name']");
      const posLbl = document.querySelector("#label-emp-pos, label[for='input-emp-pos']");
      const deptLbl = document.querySelector("#label-emp-dept, label[for='input-emp-dept']");
      const startLbl = document.querySelector("#label-emp-start, label[for='input-emp-start']");
      const balLbl = document.querySelector("#label-leave-balance, label[for='input-leave-balance']");
      const ssLbl = document.querySelector("#label-social-security, label[for='input-social-security']");

      if (codeLbl) codeLbl.textContent = t.empCodeLabel;
      if (nameLbl) nameLbl.textContent = t.empNameLabel;
      if (posLbl) posLbl.textContent = t.empPosLabel;
      if (deptLbl) deptLbl.textContent = t.empDeptLabel;
      if (startLbl) startLbl.textContent = t.empStartLabel;
      if (balLbl) balLbl.textContent = t.leaveBalanceLabel;
      if (ssLbl) ssLbl.innerHTML = `${t.socialSecurityLabel} <small style="color:#e11d48; font-weight:normal;">${t.socialSecurityNote}</small>`;

      // Notice box
      const noticeBox = document.querySelector(".notice-box");
      if (noticeBox) {
        const lineT = t.lineNoticeTitle || "แจ้งเตือนผ่าน LINE";
        const lineM = t.lineNoticeText || t.lineAlertNotice;
        const checkT = t.checkNoticeTitle || "ข้อควรระวังก่อนบันทึก";
        const checkM = t.checkNoticeText || t.checkBeforeSaveNotice;
        noticeBox.innerHTML = `
          💬 <strong>${lineT}:</strong> ${lineM}<br/>
          ⚠️ <strong>${checkT}:</strong> ${checkM}
        `;
      }

      // Leave Cards Container Head
      const containerHeadH2 = document.querySelector(".leave-cards-container .container-head h2");
      if (containerHeadH2) containerHeadH2.textContent = t.leaveCardContainerTitle;

      const btnAddLeaveItem = document.getElementById("btnAddLeaveItem") || document.querySelector(".btn-green");
      if (btnAddLeaveItem) btnAddLeaveItem.textContent = t.btnAddLeaveItem;

      const btnSaveLeave = document.getElementById("btnSaveLeave") || document.querySelector(".btn-primary");
      if (btnSaveLeave) btnSaveLeave.textContent = t.btnSaveLeave;

      // Row Dividers in Leave cards
      const rowDividers = document.querySelectorAll(".row-divider");
      if (rowDividers.length >= 1) rowDividers[0].textContent = t.sec1Divider;
      if (rowDividers.length >= 2) rowDividers[1].textContent = t.sec2Divider;
      if (rowDividers.length >= 3) rowDividers[2].textContent = t.sec3Divider;
      if (rowDividers.length >= 4) rowDividers[3].textContent = t.sec4Divider;

      // Form inputs inside leave item boxes
      document.querySelectorAll(".leave-box-item").forEach(box => {
        box.querySelectorAll(".input-group label").forEach(lbl => {
          const forAttr = (lbl.getAttribute("for") || "").toLowerCase();
          const txt = lbl.textContent.trim();
          if (forAttr.includes("write") || txt.includes("เขียนคำขอ") || txt.includes("ຂຽນຄຳຂໍ") || txt.includes("လျှောက်ထားသည့်")) {
            lbl.textContent = t.writeDateLabel;
          } else if (forAttr.includes("start") || txt.includes("เริ่ม") || txt.includes("ເລີ່ມ") || txt.includes("စတင်သည့်")) {
            lbl.innerHTML = `${t.startDateLabel} <span style="color:#ef4444;">*</span>`;
          } else if (forAttr.includes("end") || txt.includes("สิ้นสุด") || txt.includes("ສິ້ນສຸດ") || txt.includes("ကုန်ဆုံးသည့်")) {
            lbl.innerHTML = `${t.endDateLabel} <span style="color:#ef4444;">*</span>`;
          } else if (forAttr.includes("type") || txt.includes("ประเภท") || txt.includes("ປະເພດ") || txt.includes("အမျိုးအစား")) {
            lbl.innerHTML = `${t.leaveTypeLabel} <span style="color:#ef4444;">*</span>`;
          } else if (forAttr.includes("reason") || txt.includes("สาเหตุ") || txt.includes("เเหตุผล") || txt.includes("ເຫດຜົນ") || txt.includes("အကြောင်းအရင်း")) {
            lbl.innerHTML = `${t.reasonLabel} <span style="color:#ef4444;">*</span>`;
          } else if (forAttr.includes("proof") || txt.includes("หลักฐาน") || txt.includes("ຫຼັກຖານ") || txt.includes("အထောက်အထား")) {
            lbl.textContent = t.attachProofLabel;
          } else if (forAttr.includes("morning") || txt.includes("เช้า") || txt.includes("ເຊົ້າ") || txt.includes("မနက်")) {
            lbl.textContent = t.hoursMorningLabel;
          } else if (forAttr.includes("afternoon") || txt.includes("บ่าย") || txt.includes("ບ່າຍ") || txt.includes("နေ့လယ်")) {
            lbl.textContent = t.hoursAfternoonLabel;
          } else if (forAttr.includes("total") || txt.includes("สรุปรวม") || txt.includes("ສະຫຼຸບລວມ") || txt.includes("စုစုပေါင်း")) {
            lbl.textContent = t.totalDurationLabel;
          } else if (forAttr.includes("head") || txt.includes("หัวหน้าแผนก") || txt.includes("ຫົວໜ້າພະແນກ") || txt.includes("ဌာနမှူး")) {
            lbl.textContent = t.deptHeadLabel;
          } else if (forAttr.includes("manager") || txt.includes("ผู้จัดการฝ่าย") || txt.includes("ຜູ້ຈັດການຝ່າຍ") || txt.includes("မန်နေဂျာ")) {
            lbl.textContent = t.deptManagerLabel;
          } else if (forAttr.includes("hr") || txt.includes("บุคคล") || txt.includes("ບຸກຄະລາກອນ") || txt.includes("HR")) {
            lbl.textContent = t.hrDeptLabel;
          }
        });

        box.querySelectorAll(".btn-danger, .box-item-footer button").forEach(b => {
          b.textContent = t.btnRemoveItem;
        });
        box.querySelectorAll(".file-upload-label").forEach(l => {
          l.textContent = t.selectProofBtn;
        });
        box.querySelectorAll(".badge-status").forEach(bs => {
          bs.textContent = t.statusWaitingReview;
        });
      });
    }

    // 6. Translate Leave History Page Elements (leave-history.html ONLY)
    if (isHistoryPage) {
      const historyTitleEl = document.querySelector(".page-title");
      if (historyTitleEl) historyTitleEl.textContent = t.historyPageTitle;

      const historySummarySpans = document.querySelectorAll(".history-summary .summary-info span");
      if (historySummarySpans.length >= 5) {
        historySummarySpans[0].textContent = t.statAll;
        historySummarySpans[1].textContent = t.statPending;
        historySummarySpans[2].textContent = t.statApproved;
        historySummarySpans[3].textContent = t.statCancelReq;
        historySummarySpans[4].textContent = t.statTotalDays;
      }

      const filterTitleSpan = document.querySelector(".filter-title span:last-child");
      if (filterTitleSpan) filterTitleSpan.textContent = t.filterTitle;

      const chips = document.querySelectorAll(".filter-chips .chip");
      if (chips.length >= 5) {
        chips[0].textContent = t.chipAll;
        chips[1].textContent = "  " + t.chipPending;
        chips[2].textContent = "  " + t.chipApproved;
        chips[3].textContent = t.chipCancelReq;
        chips[4].textContent = t.chipRejectedCancelled;
      }

      const tableThs = document.querySelectorAll(".table-responsive thead th");
      if (tableThs.length >= 6) {
        tableThs[0].textContent = t.thLeaveType;
        tableThs[1].textContent = t.thDateRange;
        tableThs[2].textContent = t.thDays;
        tableThs[3].textContent = t.thReason;
        tableThs[4].textContent = t.thStatus;
        tableThs[5].textContent = t.thAction;
      }
    }

    // 7. Translate Profile Page Elements (profile-user.html ONLY)
    if (isProfilePage) {
      const profileH1 = document.getElementById("profileHeaderTitle") || document.querySelector("#profileUserHeader h1");
      const profileSub = document.getElementById("profileHeaderSubtitle") || document.querySelector("#profileUserHeader span");
      const profileBrand = document.getElementById("profileBrandTitle");
      if (profileH1) profileH1.textContent = t.profilePageTitle;
      if (profileSub) profileSub.textContent = t.profilePageSub;
      if (profileBrand) profileBrand.textContent = "PVT HR Leave";

      const recentCards = document.querySelectorAll(".recent-card");
      if (recentCards.length >= 1) {
        const pHead = recentCards[0].querySelector(".section-head h2");
        if (pHead) pHead.textContent = t.profileDetailsHeading;
      }
      if (recentCards.length >= 2) {
        const lHead = recentCards[1].querySelector(".section-head h2");
        if (lHead) lHead.textContent = t.lineSectionHeading;
      }

      const lineAutoLabel = document.querySelector("#lineSettingBox label:first-of-type");
      if (lineAutoLabel) lineAutoLabel.textContent = t.lineAutoLinkTitle;

      const lineAutoP = document.querySelector("#lineSettingBox p:first-of-type");
      if (lineAutoP) lineAutoP.textContent = t.lineAutoLinkSub;

      const btnGetLineCode = document.querySelector("#lineSettingBox button[onclick*='generateLineLinkCode']");
      if (btnGetLineCode) {
        const img = btnGetLineCode.querySelector("img");
        btnGetLineCode.innerHTML = `${img ? img.outerHTML : ""} ${t.btnGetLineCode}`;
      }

      const lineManualLabel = document.querySelectorAll("#lineSettingBox label")[1];
      if (lineManualLabel) lineManualLabel.textContent = t.lineManualTitle;

      const btnSaveLine = document.querySelector("#lineSettingBox button[onclick*='saveUserLineId']");
      if (btnSaveLine) btnSaveLine.textContent = t.btnSaveLine;
    }

    // 8. Translate Holidays Page Elements (holidays.html ONLY)
    if (isHolidaysPage) {
      const tabCompany = document.getElementById("tabCompanyHolidays");
      const tabTeam = document.getElementById("tabTeamLeaves");
      if (tabCompany) tabCompany.innerHTML = `<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 6px;">event</span>${t.tabCompanyHolidays}`;
      if (tabTeam) tabTeam.innerHTML = `<span class="material-symbols-outlined" style="vertical-align: middle; margin-right: 6px;">groups</span>${t.tabTeamLeaves}`;

      const holidayTitleH1 = document.querySelector(".title-wrap h1");
      if (holidayTitleH1) holidayTitleH1.textContent = t.holidayPageTitle;
      const holidayTitleP = document.querySelector(".title-wrap p");
      if (holidayTitleP) holidayTitleP.textContent = t.holidayPageSub;

      const statLabels = document.querySelectorAll(".stats-grid .stat-info .label");
      if (statLabels.length >= 3) {
        statLabels[0].textContent = t.statTotalHolidays;
        statLabels[1].textContent = t.statNextHoliday;
        statLabels[2].textContent = t.statRemainingHolidays;
      }

      const heroBadge = document.querySelector(".hero-badge");
      if (heroBadge) heroBadge.innerHTML = `<span class="material-symbols-outlined">star</span><span>${t.heroNextHolidayTitle}</span>`;
      const countdownLabel = document.querySelector(".countdown-label");
      if (countdownLabel) countdownLabel.textContent = t.heroDaysAhead;

      const holidaySearchInput = document.getElementById("holidaySearchInput");
      if (holidaySearchInput) holidaySearchInput.placeholder = t.searchHolidayPlaceholder;

      const btnAddHoliday = document.getElementById("btnAddHoliday");
      if (btnAddHoliday) {
        const icon = btnAddHoliday.querySelector(".material-symbols-outlined");
        btnAddHoliday.innerHTML = `${icon ? icon.outerHTML : ""} <span>${t.btnAddHoliday}</span>`;
      }

      const btnViewGrid = document.getElementById("btnViewGrid");
      if (btnViewGrid) btnViewGrid.title = lang === 'lo' ? "ສະແດງແບບກາດ" : (lang === 'my' ? "ကတ်ပြသမှု ပုံစံ" : "แสดงแบบการ์ด");
      const btnViewTable = document.getElementById("btnViewTable");
      if (btnViewTable) btnViewTable.title = lang === 'lo' ? "ສະແດງແບບຕາຕະລາງ" : (lang === 'my' ? "ဇယားပြသမှု ပုံစံ" : "แสดงแบบตาราง");

      const yearSelect = document.getElementById("yearSelect");
      if (yearSelect && yearSelect.options) {
        Array.from(yearSelect.options).forEach(opt => {
          const val = opt.value;
          if (lang === 'lo') opt.textContent = `ປີ ${val}`;
          else if (lang === 'my') opt.textContent = `${val} ခုနှစ်`;
          else opt.textContent = `ปี ${val} (${parseInt(val) + 543})`;
        });
      }

      const monthSelect = document.getElementById("monthSelect");
      if (monthSelect && monthSelect.options) {
        const loMonths = ['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'];
        const myMonths = ['ဇန်နဝါရီ', 'ဖေဖော်ဝါရီ', 'မတ်', 'ဧပြီ', 'မေ', 'ဇွန်', 'ဇူလိုင်', 'သြဂုတ်', 'စက်တင်ဘာ', 'အောက်တိုဘာ', 'နိုဝင်ဘာ', 'ဒီဇင်ဘာ'];
        const thMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        
        Array.from(monthSelect.options).forEach(opt => {
          if (opt.value === 'all') {
            opt.textContent = t.optAllYear;
          } else {
            const mIdx = parseInt(opt.value, 10);
            if (!isNaN(mIdx) && mIdx >= 0 && mIdx < 12) {
              opt.textContent = lang === 'lo' ? loMonths[mIdx] : (lang === 'my' ? myMonths[mIdx] : thMonths[mIdx]);
            }
          }
        });
      }

      const categorySelect = document.getElementById("categorySelect");
      if (categorySelect && categorySelect.options) {
        Array.from(categorySelect.options).forEach(opt => {
          if (opt.value === 'all') opt.textContent = t.optAllCategories;
          else if (opt.value === 'official') opt.textContent = t.optOfficial;
          else if (opt.value === 'company') opt.textContent = t.optCompany;
          else if (opt.value === 'substitution') opt.textContent = t.optSubstitution;
        });
      }

      const companyCalH3 = document.querySelector("#companyCalendarLayout .team-calendar-main h3");
      if (companyCalH3) companyCalH3.textContent = t.calMonthlyTitle;
      const teamCalH3 = document.querySelector("#teamCalendarLayout .team-calendar-main h3");
      if (teamCalH3) teamCalH3.textContent = t.teamCalTitle;

      const dayHeaders = document.querySelectorAll(".calendar-days-header");
      dayHeaders.forEach(dh => {
        if (lang === 'lo') {
          dh.innerHTML = `<span style="color:#ef4444;">ອາ.</span><span>ຈ.</span><span>ອ.</span><span>ພ.</span><span>ພຫ.</span><span>ສຸ.</span><span>ສ.</span>`;
        } else if (lang === 'my') {
          dh.innerHTML = `<span style="color:#ef4444;">နွေ</span><span>လာ</span><span>ဂါ</span><span>ဟူး</span><span>တေး</span><span>ကြာ</span><span>နေ</span>`;
        } else {
          dh.innerHTML = `<span style="color:#ef4444;">อา.</span><span>จ.</span><span>อ.</span><span>พ.</span><span>พฤ.</span><span>ศ.</span><span>ส.</span>`;
        }
      });

      const holidayTableThs = document.querySelectorAll("#holidayTableContainer thead th");
      if (holidayTableThs.length >= 8) {
        holidayTableThs[0].textContent = t.thNo;
        holidayTableThs[1].textContent = t.thDate;
        holidayTableThs[2].textContent = t.thDayOfWeek;
        holidayTableThs[3].textContent = t.thHolidayName;
        holidayTableThs[4].textContent = t.thCategory;
        holidayTableThs[5].textContent = t.thCountdown;
        holidayTableThs[6].textContent = t.thDesc;
        holidayTableThs[7].textContent = t.thManage;
      }

      const teamSearchInput = document.getElementById("teamSearchInput");
      if (teamSearchInput) teamSearchInput.placeholder = t.searchTeamPlaceholder;
    }

    // 9. Translate Leave Rules Page (leave-rules.html ONLY)
    if (isRulesPage) {
      const rulesH1 = document.querySelector(".rules-title-section h1");
      const rulesP = document.querySelector(".rules-title-section p");
      if (rulesH1) rulesH1.textContent = t.rulesPageTitle;
      if (rulesP) rulesP.textContent = t.rulesPageSub;
      if (typeof window.renderLeaveRulesCards === "function") {
        window.renderLeaveRulesCards(lang);
      }
    }

    // 10. Canonical TreeWalker Phrase Substitution (with strict boundary safety)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
      const rawText = node.nodeValue;
      if (!rawText) continue;
      const trimmed = rawText.trim();
      if (!trimmed) continue;

      const parent = node.parentElement;
      if (!parent) continue;
      const parentTag = parent.tagName;
      if (parentTag === "SCRIPT" || parentTag === "STYLE" || parentTag === "TEXTAREA" || parentTag === "INPUT") continue;

      // 🔒 Protect dynamic user identity, name, code, dept, and custom inputs from accidental dictionary matching
      let isProtected = false;
      let curr = parent;
      while (curr && curr !== document.body) {
        if (
          curr.id === "userName" || 
          curr.id === "userDepartment" || 
          curr.id === "emp-name" || 
          curr.id === "emp-detail" || 
          curr.id === "empName" || 
          curr.id === "empDept" || 
          curr.id === "profileBox" || 
          curr.id === "recentList" || 
          curr.id === "userNotifList" ||
          curr.id === "userAvatar" ||
          curr.id === "user-avatar" ||
          curr.id === "globalLangSwitcherContainer" ||
          curr.id === "posCategoryTabs" ||
          curr.id === "posModalTabs" ||
          curr.classList.contains("user-profile") ||
          curr.classList.contains("avatar") ||
          curr.classList.contains("emp-meta") ||
          curr.classList.contains("pos-tab") ||
          curr.classList.contains("pos-category-tabs") ||
          curr.classList.contains("pos-modal-tabs") ||
          curr.classList.contains("pos-tab-count")
        ) {
          isProtected = true;
          break;
        }
        curr = curr.parentElement;
      }
      if (isProtected) continue;

      if (window.CANONICAL_PHRASE_MAP[trimmed]) {
        const transKey = window.CANONICAL_PHRASE_MAP[trimmed];
        if (t[transKey]) {
          node.nodeValue = rawText.replace(trimmed, t[transKey]);
        }
      }
    }

    // 11. Deep-Scan Real-Time Dynamic Content (Tables, Categories, Statuses, Badges, Reason Prefixes)
    if (typeof window.deepScanTranslateDynamicContent === "function") {
      window.deepScanTranslateDynamicContent(document.body, lang);
    }

    // 12. Broadcast event for custom JS controllers (holidays.js, leave-history.js, index-user.js, etc.)
    window.dispatchEvent(new CustomEvent("pvt-lang-changed", { detail: { lang, t } }));

    // Re-scan after listeners execute (in case components re-rendered synchronously)
    if (typeof window.deepScanTranslateDynamicContent === "function") {
      window.deepScanTranslateDynamicContent(document.body, lang);
    }

  } finally {
    setTimeout(() => {
      window.__pvtIsTranslating = false;
    }, 60);
  }
};

function injectGlobalLangSwitcher() {
  if (document.getElementById("globalLangSwitcherContainer")) return;
  
  const targetContainer = document.querySelector(".topbar-right") || 
                          document.querySelector(".topbar-actions") || 
                          document.querySelector(".user-header-actions") ||
                          document.querySelector(".history-actions") ||
                          document.querySelector(".rules-top-bar") ||
                          document.querySelector(".topbar") ||
                          document.querySelector("header");
  
  if (!targetContainer) {
    setTimeout(injectGlobalLangSwitcher, 200);
    return;
  }

  const container = document.createElement("div");
  container.id = "globalLangSwitcherContainer";
  container.style.cssText = "display: flex; align-items: center; margin-left: 8px; margin-right: 8px;";
  
  container.innerHTML = `
    <div class="lang-switcher" style="display: flex; gap: 2px; align-items: center; background: #f1f5f9; padding: 3px; border-radius: 9999px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.06); border: 1px solid #cbd5e1; z-index: 99; position: relative;">
      <button type="button" id="globalLangTh" onclick="window.setGlobalLanguage('th')" style="background: transparent; border: none; padding: 4px 8px; border-radius: 9999px; cursor: pointer; font-size: 11px; font-weight: 600; color: #64748b; transition: all 0.25s;">🇹🇭 TH</button>
      <button type="button" id="globalLangLo" onclick="window.setGlobalLanguage('lo')" style="background: transparent; border: none; padding: 4px 8px; border-radius: 9999px; cursor: pointer; font-size: 11px; font-weight: 600; color: #64748b; transition: all 0.25s;">🇱🇦 LO</button>
      <button type="button" id="globalLangMy" onclick="window.setGlobalLanguage('my')" style="background: transparent; border: none; padding: 4px 8px; border-radius: 9999px; cursor: pointer; font-size: 11px; font-weight: 600; color: #64748b; transition: all 0.25s;">🇲🇲 MY</button>
    </div>
  `;

  if (targetContainer.classList.contains("rules-top-bar")) {
    targetContainer.insertBefore(container, targetContainer.children[1] || null);
  } else if (targetContainer.classList.contains("topbar") || targetContainer.tagName === "HEADER" || targetContainer.classList.contains("user-header")) {
    const actionArea = targetContainer.querySelector(".topbar-right") || targetContainer.querySelector(".topbar-actions") || targetContainer.querySelector(".user-header-actions") || targetContainer.querySelector(".history-actions");
    if (actionArea) {
      actionArea.prepend(container);
    } else {
      targetContainer.appendChild(container);
    }
  } else {
    targetContainer.prepend(container);
  }
  
  const savedLang = localStorage.getItem("pvt_login_lang") || 'th';
  window.setGlobalLanguage(savedLang, false);
}

document.addEventListener("DOMContentLoaded", () => {
  renderGlobalUserProfile();
  setTimeout(injectGlobalLangSwitcher, 150);

  // Set up MutationObserver to automatically translate newly added DOM elements safely
  let mutationDebounceTimer = null;
  const observer = new MutationObserver((mutations) => {
    if (window.__pvtIsTranslating) return;
    let shouldTranslate = false;
    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.id === "globalLangSwitcherContainer" || node.classList.contains("lang-switcher")) continue;
            shouldTranslate = true;
            break;
          }
        }
      }
      if (shouldTranslate) break;
    }

    if (shouldTranslate) {
      clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = setTimeout(() => {
        if (!window.__pvtIsTranslating) {
          const currentLang = window.getGlobalLanguage();
          window.setGlobalLanguage(currentLang, false);
        }
      }, 150);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});

// =========================================================================
// 🌐 [ระบบตรวจจับสถานะเครือข่าย]: แจ้งเตือนเมื่อหลุดการเชื่อมต่ออินเทอร์เน็ต
// =========================================================================
(function initNetworkStatusMonitor() {
  const translations = {
    th: {
      offline: "⚠️ ขาดการเชื่อมต่ออินเทอร์เน็ต: การส่งใบลาและระบบประมวลผลจำเป็นต้องใช้อินเทอร์เน็ตที่ทำงานอยู่",
      online: "✅ เชื่อมต่ออินเทอร์เน็ตกลับมาเรียบร้อยแล้ว"
    },
    lo: {
      offline: "⚠️ ຂາດການເຊື່ອມຕໍ່ອິນເຕີເນັດ: ການສົ່ງໃບລາ ແລະ ລະບົບປະມວນຜົນຈຳເປັນຕ້ອງໃຊ້ອິນເຕີເນັດ",
      online: "✅ ເຊື່ອມຕໍ່ອິນເຕີເນັດຄືນໃຫມ່ສຳເລັດແລ້ວ"
    },
    my: {
      offline: "⚠️ အင်တာနက်လိုင်းပြတ်တောက်နေပါသည် - ခွင့်တောင်းခံလွှာတင်ရန် အင်တာနက်ချိတ်ဆက်မှု လိုအပ်ပါသည်",
      online: "✅ အင်တာနက်ပြန်လည်ချိတ်ဆက်မိပါပြီ"
    }
  };

  function getActiveLang() {
    return localStorage.getItem("pvt_login_lang") || "th";
  }

  function showBanner(type) {
    let banner = document.getElementById("pvtNetworkStatusBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pvtNetworkStatusBanner";
      banner.style.cssText = `
        position: fixed;
        top: -60px;
        left: 0;
        right: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 16px;
        font-family: 'Kanit', sans-serif;
        font-size: 13.5px;
        font-weight: 500;
        text-align: center;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
        transition: top 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease;
      `;
      document.body.appendChild(banner);
    }

    const lang = getActiveLang();
    const t = translations[lang] || translations.th;

    if (type === "offline") {
      banner.textContent = t.offline;
      banner.style.backgroundColor = "#fffbeb"; // Tailwind amber-50
      banner.style.color = "#b45309"; // Tailwind amber-700
      banner.style.borderBottom = "1.5px solid #f59e0b"; // Tailwind amber-500
      banner.style.top = "0";
    } else if (type === "online") {
      banner.textContent = t.online;
      banner.style.backgroundColor = "#f0fdf4"; // Tailwind green-50
      banner.style.color = "#15803d"; // Tailwind green-700
      banner.style.borderBottom = "1.5px solid #22c55e"; // Tailwind green-500
      banner.style.top = "0";

      // Hide the "back online" message after 3 seconds
      setTimeout(() => {
        if (navigator.onLine) {
          banner.style.top = "-60px";
        }
      }, 3000);
    }
  }

  window.addEventListener("offline", () => {
    showBanner("offline");
  });

  window.addEventListener("online", () => {
    showBanner("online");
  });

  // Check initial state on page load
  document.addEventListener("DOMContentLoaded", () => {
    if (!navigator.onLine) {
      setTimeout(() => {
        showBanner("offline");
      }, 500);
    }
  });
})();


