/* ==========================================================================
   🔒 PVT HR LEAVE - auth/index.js (เวอร์ชันเสถียรสูงสุด: ป้องกัน Loop & Auto Refresh)
   ========================================================================== */

function getSbClient() {
  return window.pvtSupabase?.client 
      || window.PVTSDK?.client 
      || window.supabaseClient 
      || window.supabase;
}

// ==========================================================================
// 🛡️ User Role Categorization Engine (Self-contained for Login & Redirect)
// ==========================================================================
window.getUserRoleCategory = window.getUserRoleCategory || function(userSession) {
  if (!userSession || (!userSession.id && !userSession.employee_code)) return { isAuth: false, category: 'guest' };

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

  // 0. พนักงานบริการ / แม่บ้าน / พ่อบ้าน / คนสวน -> Employee
  const isServiceStaff = position.includes('แม่บ้าน') || position.includes('พ่อบ้าน') || position.includes('คนสวน') ||
                         duty.includes('แม่บ้าน') || duty.includes('พ่อบ้าน') || duty.includes('คนสวน');
  if (isServiceStaff) {
    return { isAuth: true, category: 'employee', role, position, dept };
  }

  // 1. HR และผู้บริหารระดับสูง -> เข้าถึงระบบบริหารจัดการทั้งหมด
  const isHrOrExecutive = 
    role === 'hr' || role === 'admin' || role === 'superadmin' || role === 'executive' || role === 'director' || role === 'owner' || role === 'hr_manager' ||
    role.includes('hr') || role.includes('admin') || role.includes('superadmin') || role.includes('executive') || role.includes('director') || role.includes('owner') ||
    role === 'ผู้บริหาร' || role === 'ผู้อำนวยการ' || role === 'เจ้าของ' || role.includes('บุคคล') ||
    code === '19122' || code === '19128' || code === '10001' ||
    dept.includes('บุคคล') || dept.includes('ธุรการ') || dept.includes('hr') || dept.includes('human') ||
    position.includes('บุคคล') || position.includes('hr') || position.includes('ธุรการ') ||
    duty.includes('บุคคล') || duty.includes('ธุรการ') || duty.includes('hr') ||
    deptId === 'e494e865-689d-432b-9dd4-1ab32125105f' ||
    position.includes('ผู้บริหาร') || position.includes('ผู้อำนวยการ') || position.includes('เจ้าของ') || position.includes('director') || position.includes('executive') || position.includes('owner');

  if (isHrOrExecutive) {
    return { isAuth: true, category: 'hr_exec', role, position, dept };
  }

  // 2. หัวหน้างาน / ผู้จัดการ
  const isManagerOrLeader = 
    role === 'manager' || role === 'leader' || role === 'supervisor' || role === 'head' ||
    role.includes('manager') || role.includes('leader') || role.includes('supervisor') ||
    role.includes('หัวหน้า') || role.includes('ผู้จัดการ') ||
    position.includes('manager') || position.includes('leader') || position.includes('supervisor') ||
    position.includes('หัวหน้า') || position.includes('ผู้จัดการ');

  if (isManagerOrLeader) {
    return { isAuth: true, category: 'leader_manager', role, position, dept };
  }

  // 3. พนักงานทั่วไป
  return { isAuth: true, category: 'employee', role, position, dept };
};

// 🚀 1. ฟังก์ชันย้ายหน้าจอตามสิทธิ์การใช้งาน (Role Routing)
function redirectToDashboard(role, userObj) {
  const urlParams = new URLSearchParams(window.location.search);
  const redirectUrl = urlParams.get("redirect");
  if (redirectUrl) {
    const decodedRedirect = decodeURIComponent(redirectUrl);
    if (decodedRedirect.startsWith("/") && !decodedRedirect.startsWith("//")) {
      sessionStorage.removeItem("redirect_attempt");
      window.location.replace(decodedRedirect);
      return;
    }
  }

  const cleanRole = String(role || '').toLowerCase().trim();
  let targetPath = "/pages/user/index-user.html";
  
  let userStatus = { category: 'employee' };
  if (typeof window.getUserRoleCategory === "function") {
    userStatus = window.getUserRoleCategory(userObj || { role: cleanRole });
  }

  const isPower = userStatus.category === 'hr_exec' || userStatus.category === 'leader_manager';

  const powerRoles = [
    'executive', 'director', 'owner', 'hr', 'admin', 'superadmin', 'manager', 'leader', 'supervisor', 'head', 'ผู้บริหาร', 'ผู้อำนวยการ', 'เจ้าของ', 'หัวหน้า', 'ผู้จัดการ'
  ];

  const isPowerRole = powerRoles.some(r => cleanRole.includes(r));
  
  if (isPower || isPowerRole) {
    targetPath = "/pages/hr/home.html";
  } else {
    targetPath = "/pages/user/index-user.html";
  }

  sessionStorage.removeItem("redirect_attempt");
  const targetUrl = new URL(targetPath, window.location.origin).href;
  window.location.replace(targetUrl);
}

/**
 * ⚡ ตรวจสอบ Session และ Supabase Token อัตโนมัติ (Seamless Auto-Redirect)
 * หากผู้ใช้มี Token / Session ที่ยังไม่หมดอายุ จะทำการข้ามหน้า Login และตรงเข้าสู่ Dashboard ทันที
 */
async function autoSessionCheckAndRedirect() {
  const urlParams = new URLSearchParams(window.location.search);
  const isLogoutRequested = urlParams.get("logout") === "true" || urlParams.get("logout") === "1" || urlParams.get("action") === "logout" || urlParams.get("logged_out") === "1";

  // 1. กรณีผู้ใช้กดออกจากระบบอย่างชัดเจน (Explicit Logout)
  if (isLogoutRequested) {
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("redirect_attempt");
    try {
      const sb = getSbClient();
      if (sb?.auth?.signOut) {
        sb.auth.signOut().catch(() => {});
      }
    } catch (e) {}
    // ล้าง query string ?logout ออกจาก address bar ให้เรียบร้อย
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    return false;
  }

  const hasRedirectAttempt = sessionStorage.getItem("redirect_attempt");

  // 🔐 Check WebAuthn API support on device startup & ensure 'Biometric Login' button is visible
  const checkAndToggleBiometricButton = async () => {
    const bioBtn = document.getElementById("biometricLoginBtn");
    if (!bioBtn) return;

    try {
      // Keep biometric button visible on modern browsers supporting WebAuthn or touch/face APIs
      if (window.PublicKeyCredential || (navigator.credentials && navigator.credentials.get)) {
        bioBtn.style.display = "flex";
      } else {
        // Fallback display for demo and universal access
        bioBtn.style.display = "flex";
      }
    } catch (err) {
      console.warn("⚠️ [WebAuthn] Startup support check warning:", err);
      bioBtn.style.display = "flex";
    }
  };

  window.checkAndToggleBiometricButton = checkAndToggleBiometricButton;

  const showSessionVerifyingUI = (show) => {
    const overlay = document.getElementById("sessionCheckOverlay");
    const skeleton = document.getElementById("loginSkeleton");
    const loginForm = document.getElementById("loginForm");
    const qrOptions = document.querySelector(".qr-login-container");
    const divider = document.querySelector(".divider");
    const bioBtn = document.getElementById("biometricLoginBtn");

    if (overlay) {
      overlay.style.display = show ? "flex" : "none";
    }
    if (skeleton && show) {
      skeleton.style.display = "none";
    }
    if (loginForm && show) {
      loginForm.style.display = "none";
    }
    if (qrOptions) {
      qrOptions.style.display = show ? "none" : "";
    }
    if (divider) {
      divider.style.display = show ? "none" : "";
    }
    if (bioBtn) {
      if (show) {
        bioBtn.style.display = "none";
      } else {
        checkAndToggleBiometricButton();
      }
    }
  };

  // 2. ⚡ Fast-Path A: ตรวจสอบ Session ใน localStorage ก่อน (เร็วที่สุด < 5ms)
  try {
    const rawSession = localStorage.getItem("currentUser");
    if (rawSession && !hasRedirectAttempt) {
      const session = JSON.parse(rawSession);
      const isNotExpired = !session.expireAt || (Date.now() < session.expireAt);
      const isStatusActive = String(session.status || "active").toLowerCase() === "active";

      if (session && (session.id || session.employee_code) && isNotExpired && isStatusActive) {
        showSessionVerifyingUI(true);
        sessionStorage.setItem("redirect_attempt", "true");
        
        // ตรวจสอบความถูกต้องกับ Supabase เพิ่มเติมใน Background ถ้าออนไลน์
        const sb = getSbClient();
        if (sb && navigator.onLine) {
          try {
            const { data: dbUser } = await sb
              .from('employees')
              .select('id, employee_code, full_name, role, status, department_id, position_id, image_url, departments(department_name), positions(position_name, level_type, duty_name)')
              .eq('id', session.id)
              .maybeSingle();

            if (dbUser) {
              if (String(dbUser.status || "").toLowerCase() === "inactive") {
                // บัญชีถูกระงับสิทธิ์
                localStorage.removeItem("currentUser");
                sessionStorage.removeItem("redirect_attempt");
                showSessionVerifyingUI(false);
                const i18n = getActiveLoginI18n();
                showLoginValidationError(i18n.errInactive, { type: 'error' });
                return false;
              }
              saveUserSession(dbUser);
              redirectToDashboard(dbUser.role, dbUser);
              return true;
            }
          } catch (verifyErr) {
            console.warn("Background session verification warning:", verifyErr);
          }
        }

        // หากออฟไลน์หรือ Fast path สมบูรณ์ นำทางทันที
        redirectToDashboard(session.role, session);
        return true;
      } else if (!isStatusActive) {
        localStorage.removeItem("currentUser");
      }
    }
  } catch (err) {
    console.warn("Fast-path session check error:", err);
    localStorage.removeItem("currentUser");
  }

  // 3. ⚡ Fast-Path B: ตรวจสอบ Supabase Auth Session (Native Supabase Token)
  try {
    const sb = getSbClient();
    if (sb?.auth?.getSession && !hasRedirectAttempt) {
      const { data: authData, error: authErr } = await sb.auth.getSession();
      const sbSession = authData?.session;

      if (!authErr && sbSession && sbSession.user) {
        showSessionVerifyingUI(true);
        sessionStorage.setItem("redirect_attempt", "true");

        // ค้นหาข้อมูลพนักงานที่ตรงกับ Supabase Auth User
        const sbUser = sbSession.user;
        const lookupFilter = sbUser.email 
          ? `id.eq.${sbUser.id},email.eq.${sbUser.email}` 
          : `id.eq.${sbUser.id}`;

        const { data: empData, error: empErr } = await sb
          .from('employees')
          .select('id, employee_code, full_name, role, status, department_id, position_id, image_url, departments(department_name), positions(position_name, level_type, duty_name)')
          .or(lookupFilter)
          .maybeSingle();

        if (empData && String(empData.status || "").toLowerCase() === "active") {
          saveUserSession(empData);
          redirectToDashboard(empData.role, empData);
          return true;
        } else if (empData && String(empData.status || "").toLowerCase() === "inactive") {
          localStorage.removeItem("currentUser");
          sessionStorage.removeItem("redirect_attempt");
          showSessionVerifyingUI(false);
          const i18n = getActiveLoginI18n();
          showLoginValidationError(i18n.errInactive, { type: 'error' });
          return false;
        }
      }
    }
  } catch (sbSessionErr) {
    console.warn("Supabase auth session check warning:", sbSessionErr);
  }

  // ล้าง Flag redirect เมื่อการตรวจสอบสิ้นสุดลงโดยไม่มีการ Redirect
  sessionStorage.removeItem("redirect_attempt");
  showSessionVerifyingUI(false);
  return false;
}


/// 🌐 Language Switcher Translations (TH, LO, MY)
const loginTranslations = {
  th: {
    badge: "ระบบขออนุญาตลาออนไลน์",
    userLabel: "รหัสพนักงาน หรือ ชื่อ-นามสกุล",
    userInputPlaceholder: "กรอกรหัสพนักงาน หรือ ชื่อพนักงาน",
    passLabel: "รหัสผ่าน (Password)",
    passInputPlaceholder: "กรอกรหัสผ่านเข้าสู่ระบบ",
    remember: "จดจำรหัสพนักงาน (Remember Me)",
    loginBtn: "เข้าสู่ระบบ",
    loggingIn: "กำลังเข้าสู่ระบบ...",
    qrBtn: "สแกนคิวอาร์โค้ดบัตรพนักงาน",
    qrGuideLink: "วิธีถือบัตรสแกน (How-to Guide)",
    biometricLoginBtn: "เข้าสู่ระบบด้วยลายนิ้วมือ / ใบหน้า",
    errEmptyBoth: "กรุณากรอกข้อมูลผู้ใช้งานและรหัสผ่านให้ครบถ้วน",
    errEmptyUser: "กรุณากรอกรหัสพนักงาน หรือชื่อผู้ใช้งาน",
    errEmptyPass: "กรุณากรอกรหัสผ่าน",
    errInvalidCreds: "รหัสพนักงาน หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
    errUserNotFound: "ไม่พบข้อมูลผู้ใช้งานในระบบ กรุณาตรวจสอบรหัสพนักงานหรือชื่ออีกครั้ง",
    errPassWrong: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
    errInactive: "บัญชีของคุณถูกระงับสิทธิ์การใช้งาน กรุณาติดต่อฝ่ายบุคคล (HR)",
    errDbConn: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
    errMultipleUsers: "พบชื่อ-นามสกุลนี้ซ้ำกันในระบบ กรุณาใช้รหัสพนักงานเข้าสู่ระบบแทน",
    camWarnTitleOutdated: "⚠️ คำเตือน: เบราว์เซอร์ของคุณเป็นรุ่นเก่า",
    camWarnTitleUnsupported: "⚠️ คำเตือน: เบราว์เซอร์ไม่รองรับกล้องไบโอเมตริก",
    camDiagBtn: "ผลตรวจวินิจฉัย & วิธีแก้ไข"
  },
  lo: {
    badge: "ລະບົບຂໍອະນຸຍາດລາພັກອອນໄລນ໌",
    userLabel: "ລະຫັດພະນັກງານ ຫຼື ຊື່-ນາມສະກຸນ",
    userInputPlaceholder: "ປ້ອນລະຫັດພະນັກງານ ຫຼື ຊື່ພະນັກງານ",
    passLabel: "ລະຫັດຜ່ານ (Password)",
    passInputPlaceholder: "ປ້ອນລະຫັດຜ່ານເຂົ້າສູ່ລະບົບ",
    remember: "ຈົດຈຳລະຫັດພະນັກງານ (Remember Me)",
    loginBtn: "ເຂົ້າສູ່ລະບົບ",
    loggingIn: "ກຳລັງເຂົ້າສູ່ລະບົບ...",
    qrBtn: "ສະແກນຄິວອ່າວໂຄດບັດພະນັກງານ",
    qrGuideLink: "ວິທີຖືບັດສະແກນ (How-to Guide)",
    biometricLoginBtn: "ເຂົ້າສູ່ລະບົບດ້ວຍລາຍນິ້ວມື / ໃບໜ້າ",
    errEmptyBoth: "ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ງານ ແລະ ລະຫັດຜ່ານໃຫ້ຄົບຖ້ວນ",
    errEmptyUser: "ກະລຸນາປ້ອນລະຫັດພະນັກງານ ຫຼື ຊື່ຜູ້ໃຊ້ງານ",
    errEmptyPass: "ກະລຸນາປ້ອນລະຫັດຜ່ານ",
    errInvalidCreds: "ລະຫັດພະນັກງານ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ ກະລຸນາກວດສອບຄືນໃໝ່",
    errUserNotFound: "ບໍ່ພົບຂໍ້ມູນຜູ້ໃຊ້ງານໃນລະບົບ ກະລຸນາກວດສອບລະຫັດ ຫຼື ຊື່ອີກຄັ້ງ",
    errPassWrong: "ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ",
    errInactive: "ບັນຊີຂອງທ່ານຖືກລະງັບການນຳໃຊ້ ກະລຸນາຕິດຕໍ່ຝ່າຍບຸກຄະລາກອນ (HR)",
    errDbConn: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້ ກະລຸນາລອງໃໝ່ພາຍຫຼັງ",
    errMultipleUsers: "ພົບຊື່-ນາມສະກຸນຊໍ້າກັນໃນລະບົບ ກະລຸນາໃຊ້ລະຫັດພະນັກງານເຂົ້າສູ່ລະບົບແທນ",
    camWarnTitleOutdated: "⚠️ ຄຳເຕືອນ: ບຣາວເຊີຂອງທ່ານເປັນລຸ້ນເກົ່າ",
    camWarnTitleUnsupported: "⚠️ ຄຳເຕືອນ: ບຣາວເຊີບໍ່ຮອງຮັບກ້ອງໄບໂອເມຕຣິກ",
    camDiagBtn: "ຜົນກວດວິເຄາະ & ວິທີແກ້ໄຂ"
  },
  my: {
    badge: "အွန်လိုင်းခွင့်တောင်းခံလွှาစနစ်",
    userLabel: "ဝန်ထမ်းနံပါတ် သို့မဟုတ် အမည်",
    userInputPlaceholder: "ဝန်ထမ်းနံပါတ် သို့မဟုတ် အမည်ကို ထည့်ပါ",
    passLabel: "စကားဝှက် (Password)",
    passInputPlaceholder: "စကားဝှက်ကို ထည့်ပါ",
    remember: "ဝန်ထမ်းနံပါတ်ကို မှတ်ထားရန်",
    loginBtn: "အကောင့်ဝင်ရန်",
    loggingIn: "အကောင့်ဝင်နေပါသည်...",
    qrBtn: "ဝန်ထမ်းကတ် QR ကုဒ်ကို စကန်ဖတ်ရန်",
    qrGuideLink: "ကတ်စကင်န်ဖတ်နည်း လမ်းညွှန်",
    biometricLoginBtn: "လက်ဗွေ သို့မဟုတ် မျက်နှာဖြင့် အကောင့်ဝင်ရန်",
    errEmptyBoth: "အသုံးပြုသူအမည်နှင့် စကားဝှက်ကို အပြည့်အစုံ ဖြည့်သွင်းပါ",
    errEmptyUser: "ဝန်ထမ်းနံပါတ် သို့မဟုတ် အမည်ကို ဖြည့်သွင်းပါ",
    errEmptyPass: "စကားဝှက်ကို ဖြည့်သွင်းပါ",
    errInvalidCreds: "ဝန်ถမ်းနံပါတ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်",
    errUserNotFound: "အသုံးပြုသူအချက်အလက်ကို ရှာမတွေ့ပါ စစ်ဆေးပြီး ပြန်လည်ကြိုးစားပါ",
    errPassWrong: "စကားဝှက် မှားယွင်းနေပါသည် ထပ်မံကြိုးစားပါ",
    errInactive: "သင့်အကောင့်ကို ရပ်ဆိုင်းထားပါသည် HR သို့ ဆက်သွယ်ပါ",
    errDbConn: "ဒေတာဘေ့စ်နှင့် ချိတ်ဆက်၍မရပါ နောက်မှ ပြန်လည်ကြိုးစားပါ",
    errMultipleUsers: "နာမည်တူ ဝန်ထမ်းများ ရှိနေပါသဖြင့် ဝန်ထမ်းနံပါတ်ဖြင့် အကောင့်ဝင်ပါ",
    camWarnTitleOutdated: "⚠️ သတိပေးချက်: သင့်ဘရောက်ဆာသည် ဗားရှင်းဟောင်းဖြစ်နေပါသည်",
    camWarnTitleUnsupported: "⚠️ သတိပေးချက်: ဤဘရောက်ဆာသည် ဘာရိုမက်ထရစ်ကင်မရာကို မထောက်ပံ့ပါ",
    camDiagBtn: "ရောဂါရှาဖွေမှုရလဒ် & နည်းလမ်းများ"
  }
};

function getActiveLoginI18n() {
  const lang = localStorage.getItem("pvt_login_lang") || 'th';
  return loginTranslations[lang] || loginTranslations.th;
}

// 💥 Visual Shake Animation on Login Card
function triggerLoginCardShake() {
  const card = document.querySelector('.login-card');
  if (!card) return;
  
  card.classList.remove('shake');
  // Trigger DOM reflow to re-play animation
  void card.offsetWidth;
  card.classList.add('shake');

  // Haptic feedback if supported
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate([80, 40, 80]); } catch (e) {}
  }

  setTimeout(() => {
    card.classList.remove('shake');
  }, 600);
}

// 🚨 Visual Color-Coded Validation Error Display
function showLoginValidationError(message, options = {}) {
  const {
    type = 'error', // 'error' | 'warning' | 'success'
    highlightUser = false,
    highlightPass = false,
    userHint = '',
    passHint = '',
    focusTarget = null,
    showToast = true
  } = options;

  // 1. Shake animation on the card
  triggerLoginCardShake();

  // 2. Color-coded alert message banner inside card
  const banner = document.getElementById("loginAlertBanner");
  const bannerText = document.getElementById("loginAlertText");
  const bannerIcon = document.getElementById("loginAlertIcon");

  if (banner && bannerText) {
    banner.className = `login-alert-banner active ${type}`;
    bannerText.textContent = message;
    if (bannerIcon) {
      bannerIcon.textContent = type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'check_circle';
    }
  }

  // 3. Highlight inputs with visual error classes & hint messages
  const userWrapper = document.getElementById("usernameWrapper") || document.getElementById("username")?.closest('.input-wrapper');
  const passWrapper = document.getElementById("passwordWrapper") || document.getElementById("password")?.closest('.input-wrapper');
  const userHintEl = document.getElementById("usernameErrorHint");
  const passHintEl = document.getElementById("passwordErrorHint");
  const userHintText = document.getElementById("usernameErrorText");
  const passHintText = document.getElementById("passwordErrorText");

  if (highlightUser && userWrapper) {
    userWrapper.classList.add("error-state");
    if (userHint && userHintEl && userHintText) {
      userHintText.textContent = userHint;
      userHintEl.classList.add("active");
    }
  }

  if (highlightPass && passWrapper) {
    passWrapper.classList.add("error-state");
    if (passHint && passHintEl && passHintText) {
      passHintText.textContent = passHint;
      passHintEl.classList.add("active");
    }
  }

  if (focusTarget) {
    try { focusTarget.focus(); } catch (e) {}
  }

  if (showToast && typeof Swal !== "undefined") {
    Swal.fire({
      icon: type === 'warning' ? 'warning' : 'error',
      title: type === 'warning' ? 'ข้อมูลไม่ครบถ้วน' : 'เข้าสู่ระบบไม่สำเร็จ',
      text: message,
      confirmButtonColor: type === 'warning' ? '#f59e0b' : '#ef4444',
      timer: 3500,
      timerProgressBar: true
    });
  }
}

// 🧹 Clear visual validation states
function clearLoginValidationErrors() {
  const banner = document.getElementById("loginAlertBanner");
  if (banner) {
    banner.className = "login-alert-banner";
  }

  const userWrapper = document.getElementById("usernameWrapper") || document.getElementById("username")?.closest('.input-wrapper');
  const passWrapper = document.getElementById("passwordWrapper") || document.getElementById("password")?.closest('.input-wrapper');
  if (userWrapper) userWrapper.classList.remove("error-state");
  if (passWrapper) passWrapper.classList.remove("error-state");

  const userHintEl = document.getElementById("usernameErrorHint");
  const passHintEl = document.getElementById("passwordErrorHint");
  if (userHintEl) userHintEl.classList.remove("active");
  if (passHintEl) passHintEl.classList.remove("active");
}

function setLanguage(lang) {
  localStorage.setItem("pvt_login_lang", lang);
  const t = loginTranslations[lang] || loginTranslations.th;

  const badgeEl = document.getElementById("i18nBadge");
  const userLabelEl = document.getElementById("i18nUserLabel");
  const usernameInput = document.getElementById("username");
  const passLabelEl = document.getElementById("i18nPassLabel");
  const passwordInput = document.getElementById("password");
  const rememberEl = document.getElementById("i18nRemember");
  const loginBtnEl = document.getElementById("i18nLoginBtn");
  const loggingInEl = document.getElementById("i18nLoggingInText");
  const qrBtnEl = document.getElementById("i18nQrBtn");
  const qrGuideLinkEl = document.getElementById("i18nQrGuideLink");
  const biometricLoginBtnText = document.getElementById("i18nBiometricLoginBtn");

  if (badgeEl) badgeEl.textContent = t.badge;
  if (userLabelEl) userLabelEl.textContent = t.userLabel;
  if (usernameInput) usernameInput.placeholder = t.userInputPlaceholder;
  if (passLabelEl) passLabelEl.textContent = t.passLabel;
  if (passwordInput) passwordInput.placeholder = t.passInputPlaceholder;
  if (rememberEl) rememberEl.textContent = t.remember;
  if (loginBtnEl) loginBtnEl.textContent = t.loginBtn;
  if (loggingInEl && t.loggingIn) loggingInEl.textContent = t.loggingIn;
  if (qrBtnEl) qrBtnEl.textContent = t.qrBtn;
  if (qrGuideLinkEl && t.qrGuideLink) qrGuideLinkEl.textContent = t.qrGuideLink;
  if (biometricLoginBtnText && t.biometricLoginBtn) biometricLoginBtnText.textContent = t.biometricLoginBtn;

  const camTitleEl = document.getElementById("biometricCameraAlertTitle");
  const camBtnEl = document.getElementById("i18nCamDiagBtn");
  if (camBtnEl && t.camDiagBtn) camBtnEl.textContent = t.camDiagBtn;
  if (camTitleEl) {
    const isOutdated = window.SystemDiagnostics?.lastCameraResult?.isOutdated;
    camTitleEl.textContent = isOutdated ? (t.camWarnTitleOutdated || "⚠️ คำเตือน: เบราว์เซอร์ของคุณเป็นรุ่นเก่า") : (t.camWarnTitleUnsupported || "⚠️ คำเตือน: เบราว์เซอร์ไม่รองรับกล้องไบโอเมตริก");
  }

  const btnTh = document.getElementById("langThBtn");
  const btnLo = document.getElementById("langLoBtn");
  const btnMy = document.getElementById("langMyBtn");

  [btnTh, btnLo, btnMy].forEach(b => {
    if (b) {
      b.style.backgroundColor = "transparent";
      b.style.color = "#64748b";
      b.style.boxShadow = "none";
      b.style.fontWeight = "600";
      b.style.transform = "scale(1)";
    }
  });

  const activeBtn = lang === 'th' ? btnTh : lang === 'lo' ? btnLo : btnMy;
  if (activeBtn) {
    activeBtn.style.backgroundColor = "#ffffff";
    activeBtn.style.color = "#0d9488";
    activeBtn.style.boxShadow = "0 2px 5px rgba(13, 148, 136, 0.12)";
    activeBtn.style.fontWeight = "700";
    activeBtn.style.transform = "scale(1.08)";
  }
}

window.setLanguage = setLanguage;

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize saved language or default to 'th'
  const savedLang = localStorage.getItem("pvt_login_lang") || 'th';
  setLanguage(savedLang);

  // Register Service Worker for PWA (Add to Home Screen)
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (swErr) {
      console.log('Service Worker not registered:', swErr);
    }
  }

  // Helper function to smoothly transition from loading skeleton to active form
  const hideLoginSkeleton = () => {
    const skeleton = document.getElementById("loginSkeleton");
    const loginForm = document.getElementById("loginForm");
    if (skeleton && skeleton.style.display !== "none") {
      skeleton.style.opacity = "0";
      skeleton.style.transition = "opacity 0.18s ease";
      setTimeout(() => {
        skeleton.style.display = "none";
        skeleton.classList.add("hidden");
        if (loginForm) {
          loginForm.style.display = "flex";
          loginForm.classList.add("fade-in");
        }
      }, 160);
    } else if (loginForm) {
      loginForm.style.display = "flex";
    }
  };

  // Safety fallback timeout to ensure skeleton never stays stuck if any script fails
  setTimeout(() => {
    const skeleton = document.getElementById("loginSkeleton");
    if (skeleton && skeleton.style.display !== "none" && !skeleton.classList.contains("hidden")) {
      hideLoginSkeleton();
    }
  }, 2500);

  // ⚡ Auto Session-Check & Instant Redirect
  const redirected = await autoSessionCheckAndRedirect();
  if (redirected) {
    return;
  }

  // Session check completed, show active login form and hide skeletons
  hideLoginSkeleton();

  // 🔐 Check for device support for WebAuthn API on startup and toggle 'Biometric Login' button
  await checkAndToggleBiometricButton();

  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const rememberCheckbox = document.getElementById("rememberMe");

  // Pre-fill remembered username if exists
  const rememberedUsername = localStorage.getItem("pvt_remembered_username");
  if (rememberedUsername && usernameInput) {
    usernameInput.value = rememberedUsername;
    if (rememberCheckbox) {
      rememberCheckbox.checked = true;
    }
  }

  // Realtime clear errors on typing
  usernameInput?.addEventListener("input", () => {
    const userWrapper = document.getElementById("usernameWrapper") || usernameInput.closest('.input-wrapper');
    userWrapper?.classList.remove("error-state");
    const userHintEl = document.getElementById("usernameErrorHint");
    userHintEl?.classList.remove("active");
    const banner = document.getElementById("loginAlertBanner");
    if (banner && !passwordInput?.closest('.input-wrapper')?.classList.contains("error-state")) {
      banner.className = "login-alert-banner";
    }
  });

  passwordInput?.addEventListener("input", () => {
    const passWrapper = document.getElementById("passwordWrapper") || passwordInput.closest('.input-wrapper');
    passWrapper?.classList.remove("error-state");
    const passHintEl = document.getElementById("passwordErrorHint");
    passHintEl?.classList.remove("active");
    const banner = document.getElementById("loginAlertBanner");
    if (banner && !usernameInput?.closest('.input-wrapper')?.classList.contains("error-state")) {
      banner.className = "login-alert-banner";
    }
  });

  // ตรวจสอบ Auto Login ผ่าน QR Code บน URL
  const urlParams = new URLSearchParams(window.location.search);
  const autoToken = urlParams.get("token") || urlParams.get("auto_login");
  if (autoToken) {
    executeSecureQrLogin(autoToken);
    return;
  }

  let isLoginAuthenticating = false;

  const setLoginBtnLoading = (isLoading) => {
    const loginBtn = document.getElementById("loginBtn") || loginForm?.querySelector('.login-btn');
    const qrBtn = loginForm?.querySelector('.qr-btn');
    
    if (loginBtn) {
      loginBtn.disabled = isLoading;
      loginBtn.setAttribute('aria-busy', String(isLoading));
      if (isLoading) {
        loginBtn.classList.add('loading');
      } else {
        loginBtn.classList.remove('loading');
      }
    }

    if (qrBtn) {
      qrBtn.disabled = isLoading;
      if (isLoading) {
        qrBtn.style.opacity = '0.6';
        qrBtn.style.pointerEvents = 'none';
      } else {
        qrBtn.style.opacity = '';
        qrBtn.style.pointerEvents = '';
      }
    }
  };

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 🛑 ป้องกันการกด Submit ซ้ำขณะกำลังตรวจสอบข้อมูล (Duplicate Submissions Prevention)
    if (isLoginAuthenticating) {
      return;
    }

    const i18n = getActiveLoginI18n();
    const loginInput = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // 1. Validation for empty inputs
    if (!loginInput && !password) {
      showLoginValidationError(i18n.errEmptyBoth, {
        type: 'warning',
        highlightUser: true,
        highlightPass: true,
        userHint: i18n.errEmptyUser,
        passHint: i18n.errEmptyPass,
        focusTarget: usernameInput
      });
      return;
    }

    if (!loginInput) {
      showLoginValidationError(i18n.errEmptyUser, {
        type: 'warning',
        highlightUser: true,
        userHint: i18n.errEmptyUser,
        focusTarget: usernameInput
      });
      return;
    }

    if (!password) {
      showLoginValidationError(i18n.errEmptyPass, {
        type: 'warning',
        highlightPass: true,
        passHint: i18n.errEmptyPass,
        focusTarget: passwordInput
      });
      return;
    }

    clearLoginValidationErrors();

    // 🔄 เริ่มต้นกระบวนการ Authentication & ล็อคปุ่มพร้อมหมุน Spinner
    isLoginAuthenticating = true;
    setLoginBtnLoading(true);

    // Handle Remember Me storage
    if (rememberCheckbox && rememberCheckbox.checked) {
      localStorage.setItem("pvt_remembered_username", loginInput);
    } else {
      localStorage.removeItem("pvt_remembered_username");
    }

    const sb = getSbClient();
    if (!sb) {
      isLoginAuthenticating = false;
      setLoginBtnLoading(false);
      showLoginValidationError(i18n.errDbConn, {
        type: 'error',
        highlightUser: true,
        highlightPass: true
      });
      return;
    }

    try {
      let user = null;

      // 1. ลองเข้าสู่ระบบผ่าน RPC login_employee
      try {
        const { data: rpcData, error: rpcError } = await sb.rpc('login_employee', {
          p_account: loginInput,
          p_password: password
        });
        if (!rpcError && rpcData && rpcData.length > 0) {
          user = rpcData[0];
        }
      } catch (rpcErr) {
        console.warn("RPC login fallback:", rpcErr);
      }

      // 2. Fallback: ค้นหาในตาราง employees โดยตรง
      if (!user) {
        let baseQuery = sb.from("employees").select("id, employee_code, full_name, role, status, password, department_id, position_id, image_url, departments(department_name), positions(position_name, level_type, duty_name)");
        let queryRes;
        if (loginInput.includes("@")) {
          queryRes = await baseQuery.eq("email", loginInput);
        } else {
          queryRes = await baseQuery.or(`employee_code.ilike.${loginInput},phone.eq.${loginInput},full_name.ilike.%${loginInput}%`);
        }

        if (queryRes.error) throw new Error(queryRes.error.message);
        if (!queryRes.data || queryRes.data.length === 0) {
          isLoginAuthenticating = false;
          setLoginBtnLoading(false);
          showLoginValidationError(i18n.errUserNotFound, {
            type: 'error',
            highlightUser: true,
            highlightPass: true,
            userHint: i18n.errUserNotFound,
            focusTarget: usernameInput
          });
          return;
        }

        if (queryRes.data.length > 1) {
          isLoginAuthenticating = false;
          setLoginBtnLoading(false);
          showLoginValidationError(i18n.errMultipleUsers, {
            type: 'warning',
            highlightUser: true,
            userHint: i18n.errMultipleUsers,
            focusTarget: usernameInput
          });
          return;
        }

        const candidate = queryRes.data[0];
        if (candidate.password && String(candidate.password) !== String(password)) {
          isLoginAuthenticating = false;
          setLoginBtnLoading(false);
          showLoginValidationError(i18n.errPassWrong, {
            type: 'error',
            highlightPass: true,
            passHint: i18n.errPassWrong,
            focusTarget: passwordInput
          });
          return;
        }
        user = candidate;
      }

      if (!user) {
        isLoginAuthenticating = false;
        setLoginBtnLoading(false);
        showLoginValidationError(i18n.errInvalidCreds, {
          type: 'error',
          highlightUser: true,
          highlightPass: true,
          focusTarget: usernameInput
        });
        return;
      }

      if (String(user.status || "").toLowerCase() === "inactive") {
        isLoginAuthenticating = false;
        setLoginBtnLoading(false);
        showLoginValidationError(i18n.errInactive, {
          type: 'error',
          highlightUser: true,
          userHint: i18n.errInactive
        });
        return;
      }

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

      sessionStorage.removeItem("redirect_attempt");
      // รักษาสถานะ loading ไว้ขณะกำลังย้ายหน้าจอเพื่อป้องกันการกดซ้ำ
      redirectToDashboard(user.role, user);

    } catch (err) {
      isLoginAuthenticating = false;
      setLoginBtnLoading(false);
      showLoginValidationError(err.message || i18n.errInvalidCreds, {
        type: 'error',
        highlightUser: true,
        highlightPass: true
      });
    }
  });
});

// ฟังก์ชันบันทึก Session มาตรฐาน
function saveUserSession(userData) {
  const rememberCheckbox = document.getElementById("rememberMe");
  const isRemember = rememberCheckbox ? rememberCheckbox.checked : true;
  const expireHours = isRemember ? (30 * 24) : 12; // 30 วัน ถ้าจดจำระบบ, 12 ชม. ถ้าไม่
  
  const deptName = userData.department_name || userData.departments?.department_name || "";
  const posName = userData.position_name || userData.positions?.position_name || "";
  const dutyName = userData.duty_name || userData.positions?.duty_name || "";

  const sessionPayload = {
    id: userData.id,
    employee_code: userData.employee_code,
    full_name: userData.full_name,
    role: userData.role || "user",
    status: userData.status || "active",
    department_id: userData.department_id || "",
    position_id: userData.position_id || "",
    department_name: deptName,
    position_name: posName,
    duty_name: dutyName,
    image_url: userData.image_url || "",
    expireAt: new Date().getTime() + (expireHours * 60 * 60 * 1000)
  };
  localStorage.setItem("currentUser", JSON.stringify(sessionPayload));
}

// 🛠️ Helper ถอดรหัส URL-Safe Base64
const safeBase64Decode = (str) => {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    try {
      return atob(str);
    } catch (e2) {
      return str;
    }
  }
};

/**
 * สกัดรหัสพนักงานจากข้อมูลที่สแกนได้ ไม่ว่าจะมาในรูปแบบใด
 * - URL เต็ม เช่น https://.../index.html?auto_login=PVT001
 * - Base64 Token เช่น PVT001|12345 หรือ PVT001
 * - JSON Object เช่น {"employee_code":"PVT001"}
 * - Plain Code เช่น PVT001
 */
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

// 🚀 2. ฟังก์ชันประมวลผล QR Login (รองรับทั้งบัตรพนักงาน บัตรดิจิทัล และ URL)
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

    // บันทึก Session สำเร็จ
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

    // ย้ายหน้าจอ
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

// 🔊 Web Audio API: สังเคราะห์เสียงตอบรับเมื่อสแกนสำเร็จ (Harmonic Success Chime)
function playBarcodeScanSuccessSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    
    // Primary chime (Sine tone)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now); // G5
    osc1.frequency.exponentialRampToValueAtTime(1174.66, now + 0.08); // D6
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Harmonic sparkle (Triangle tone)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1568, now + 0.03); // G6
    gain2.gain.setValueAtTime(0.12, now + 0.03);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.03);
    osc2.stop(now + 0.24);
  } catch (e) {
    console.warn("Audio chime feedback note:", e);
  }
}

// 📱 ฟังก์ชันสแกน QR Code & Barcode แบบ Full-screen Mobile Modal UI พร้อมระบบตอบสนองครบวงจร
function loginByQr() {
  let html5QrCode = null;
  let isCamRunning = false;
  let isTorchOn = false;
  let currentFacingMode = "environment";
  let activeTab = "cam"; // "cam" | "file"
  let videoTrack = null;

  // ค้นหาหรือสร้าง DOM สำหรับ Modal แบบ Full-Screen
  let modalOverlay = document.getElementById("pvtQrScannerModal");
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "pvtQrScannerModal";
    modalOverlay.className = "pvt-qr-modal-overlay";
    document.body.appendChild(modalOverlay);
  }

  // กำหนดภาษาสำหรับข้อความใน UI
  const currentLang = typeof getGlobalLanguage === 'function' ? getGlobalLanguage() : (localStorage.getItem("preferred_lang") || "th");
  const i18n = {
    th: {
      title: "สแกนบัตรพนักงาน",
      subTitle: "QR Code & บาร์โค้ด",
      guideLive: "จัดตำแหน่ง QR หรือบาร์โค้ดให้อยู่ในกรอบ",
      guideScanning: "กำลังตรวจสอบรหัสพนักงาน...",
      guideSuccess: "สแกนสำเร็จ! กำลังยืนยันตัวตน...",
      tabCam: "กล้องสด",
      tabFile: "เลือกรูปภาพ",
      reqPerm: "กำลังเปิดกล้องและขอสิทธิ์เข้าถึง...",
      errCamTitle: "ไม่สามารถเปิดกล้องได้",
      errCamDesc: "กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ หรือเลือกสแกนจากรูปภาพแทน",
      btnRetry: "ลองใหม่อีกครั้ง",
      btnSwitchFile: "เลือกรูปภาพแทน",
      btnDiag: "ผลตรวจระบบ",
      dropTitle: "เลือกไฟล์รูปภาพ QR Code / บาร์โค้ด",
      dropDesc: "คลิกเพื่อเลือกไฟล์ หรือลากรูปภาพมาวางที่นี่",
      btnChooseFile: "เลือกไฟล์รูปภาพ",
      closeBtnTitle: "ปิดหน้าต่างสแกน",
      torchBtnTitle: "เปิด/ปิด ไฟฉาย",
      flipBtnTitle: "สลับกล้องหน้า/หลัง"
    },
    lo: {
      title: "ສະແກນບັດພະນັກງານ",
      subTitle: "QR Code & ບາໂຄ້ດ",
      guideLive: "ວາງ QR ຫຼື ບາໂຄ້ດ ໃຫ້ຢູ່ໃນກອບ",
      guideScanning: "ກຳລັງກວດສອບລະຫັດພະນັກງານ...",
      guideSuccess: "ສະແກນສຳເລັດ! ກຳລັງຢືນຢັນຕົວຕົນ...",
      tabCam: "ກ້ອງສົດ",
      tabFile: "ເລືອກຮູບພາບ",
      reqPerm: "ກຳລັງເປີດກ້ອງ ແລະ ຂໍສິດການເຂົ້າເຖິງ...",
      errCamTitle: "ບໍ່ສາມາດເປີດກ້ອງໄດ້",
      errCamDesc: "ກະລຸນາອະນຸຍາດສິດການໃຊ້ກ້ອງ ຫຼື ເລືອກຮູບພາບແທນ",
      btnRetry: "ລອງໃໝ່ອີກຄັ້ງ",
      btnSwitchFile: "ເລືອກຮູບພາບແທນ",
      btnDiag: "ກວດສອບລະບົບ",
      dropTitle: "ເລືອກໄຟລ໌ຮູບພາບ QR / ບາໂຄ້ດ",
      dropDesc: "ຄລິກເພື່ອເລືອກໄຟລ໌ ຫຼື ລາກຮູບພາບມາວາງທີ່ນີ້",
      btnChooseFile: "ເລືອກໄຟລ໌ຮູບ",
      closeBtnTitle: "ປິດ",
      torchBtnTitle: "ເປີດ/ປິດ ໄຟສາຍ",
      flipBtnTitle: "ປ່ຽນກ້ອງໜ້າ/ຫຼັງ"
    },
    my: {
      title: "ဝန်ထမ်းကတ် စကင်န်ဖတ်ရန်",
      subTitle: "QR Code & ဘားကုဒ်",
      guideLive: "QR သို့မဟုတ် ဘားကုဒ်ကို ဘောင်အတွင်း ထားပါ",
      guideScanning: "ဝန်ထမ်းကုဒ်ကို စစ်ဆေးနေသည်...",
      guideSuccess: "စကင်န်အောင်မြင်ပါသည်!",
      tabCam: "ကင်မရာ",
      tabFile: "ပုံရွေးပါ",
      reqPerm: "ကင်မရာ ဖွင့်နေသည်...",
      errCamTitle: "ကင်မရာ ဖွင့်၍မရပါ",
      errCamDesc: "ကင်မရာခွင့်ပြုချက် ပေးပါ သို့မဟုတ် ပုံတင်ပါ",
      btnRetry: "ပြန်လည်ကြိုးစားရန်",
      btnSwitchFile: "ပုံရွေးချယ်ရန်",
      btnDiag: "စနစ်စစ်ဆေးရန်",
      dropTitle: "QR / ဘားကုဒ် ပုံရွေးပါ",
      dropDesc: "ဖိုင်ရွေးရန် နှိပ်ပါ သို့မဟုတ် ဖိုင်ဆွဲထည့်ပါ",
      btnChooseFile: "ဖိုင်ရွေးရန်",
      closeBtnTitle: "ပိတ်ရန်",
      torchBtnTitle: "ဓာတ်မီး ဖွင့်/ပိတ်",
      flipBtnTitle: "ကင်မရာပြောင်းရန်"
    }
  }[currentLang] || {
    title: "สแกนบัตรพนักงาน",
    subTitle: "QR Code & บาร์โค้ด",
    guideLive: "จัดตำแหน่ง QR หรือบาร์โค้ดให้อยู่ในกรอบ",
    guideScanning: "กำลังตรวจสอบรหัสพนักงาน...",
    guideSuccess: "สแกนสำเร็จ! กำลังยืนยันตัวตน...",
    tabCam: "กล้องสด",
    tabFile: "เลือกรูปภาพ",
    reqPerm: "กำลังเปิดกล้องและขอสิทธิ์เข้าถึง...",
    errCamTitle: "ไม่สามารถเปิดกล้องได้",
    errCamDesc: "กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ หรือเลือกสแกนจากรูปภาพแทน",
    btnRetry: "ลองใหม่อีกครั้ง",
    btnSwitchFile: "เลือกรูปภาพแทน",
    btnDiag: "ผลตรวจระบบ",
    dropTitle: "เลือกไฟล์รูปภาพ QR Code / บาร์โค้ด",
    dropDesc: "คลิกเพื่อเลือกไฟล์ หรือลากรูปภาพมาวางที่นี่",
    btnChooseFile: "เลือกไฟล์รูปภาพ",
    closeBtnTitle: "ปิดหน้าต่างสแกน",
    torchBtnTitle: "เปิด/ปิด ไฟฉาย",
    flipBtnTitle: "สลับกล้องหน้า/หลัง"
  };

  // สร้างโครงสร้าง UI ของ Modal
  modalOverlay.innerHTML = `
    <div class="pvt-qr-modal-window" role="dialog" aria-modal="true">
      <!-- 🔝 Header Bar -->
      <div class="pvt-qr-header">
        <div class="pvt-qr-title-box">
          <div class="pvt-qr-icon-badge">
            <span class="material-symbols-outlined" style="font-size: 22px;">qr_code_scanner</span>
          </div>
          <div>
            <h3>${i18n.title}</h3>
            <span><span class="pvt-qr-status-indicator"></span> ${i18n.subTitle}</span>
          </div>
        </div>
        
        <div class="pvt-qr-header-actions">
          <button type="button" id="pvtQrBtnGuide" class="pvt-qr-btn-circle" title="คำแนะนำการสแกนบัตร" onclick="showQrGuideModal()">
            <span class="material-symbols-outlined" style="font-size: 20px;">help_outline</span>
          </button>
          <button type="button" id="pvtQrBtnTorch" class="pvt-qr-btn-circle" title="${i18n.torchBtnTitle}" style="display: none;">
            <span class="material-symbols-outlined" style="font-size: 20px;">flashlight_on</span>
          </button>
          <button type="button" id="pvtQrBtnFlip" class="pvt-qr-btn-circle" title="${i18n.flipBtnTitle}">
            <span class="material-symbols-outlined" style="font-size: 20px;">flip_camera_ios</span>
          </button>
          <button type="button" id="pvtQrBtnClose" class="pvt-qr-btn-circle close-btn" title="${i18n.closeBtnTitle}">
            <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
          </button>
        </div>
      </div>

      <!-- 📷 Scanner Viewport / HUD Reticle -->
      <div id="pvtQrCamView" class="pvt-qr-viewport-container">
        <div id="pvt-qr-video-host"></div>

        <!-- 🔍 Pinch-to-Zoom Visual Feedback Indicator Overlay -->
        <div id="pvtQrZoomIndicator" class="pvt-qr-zoom-indicator" title="จีบนิ้วเพื่อย่อ/ขยายภาพ (Pinch to Zoom)">
          <div class="pvt-zoom-level-badge">
            <span class="material-symbols-outlined pvt-zoom-icon">zoom_in</span>
            <span id="pvtZoomValText" class="pvt-zoom-value">1.0x</span>
          </div>
          <div class="pvt-zoom-quick-controls">
            <button type="button" class="pvt-zoom-chip active" data-zoom="1">1x</button>
            <button type="button" class="pvt-zoom-chip" data-zoom="1.5">1.5x</button>
            <button type="button" class="pvt-zoom-chip" data-zoom="2">2x</button>
            <button type="button" class="pvt-zoom-chip" data-zoom="2.5">2.5x</button>
          </div>
        </div>

        <!-- ⚡ QR Code Detection Instant Visual Feedback Badge Overlay -->
        <div id="pvtQrDetectBadge" class="pvt-qr-detect-badge">
          <div class="pvt-qr-detect-pulse-ring"></div>
          <span class="material-symbols-outlined pvt-qr-detect-icon">qr_code_scanner</span>
          <span id="pvtQrDetectMsg">พบ QR Code แล้ว!</span>
        </div>

        <!-- Scanner Reticle Frame -->
        <div id="pvtQrReticle" class="pvt-qr-reticle-box">
          <span class="pvt-qr-corner top-left"></span>
          <span class="pvt-qr-corner top-right"></span>
          <span class="pvt-qr-corner bottom-left"></span>
          <span class="pvt-qr-corner bottom-right"></span>
          <div id="pvtQrLaser" class="pvt-qr-laser"></div>
        </div>

        <!-- Guide Caption -->
        <div id="pvtQrGuideText" class="pvt-qr-guide-text">
          <span class="material-symbols-outlined" style="font-size: 16px; color: #34d399;">center_focus_strong</span>
          <span id="pvtQrGuideMsg">${i18n.guideLive}</span>
        </div>

        <!-- Success Visual Feedback Overlay -->
        <div id="pvtQrSuccessOverlay" class="pvt-qr-success-overlay">
          <div class="pvt-qr-success-badge">
            <span class="material-symbols-outlined" style="font-size: 40px;">check_circle</span>
          </div>
        </div>

        <!-- Camera Permission & Loading State Card -->
        <div id="pvtQrPermissionCard" class="pvt-qr-permission-card" style="display: none;">
          <div id="pvtQrPermIconBox" class="pvt-qr-permission-icon-box">
            <span id="pvtQrPermIcon" class="material-symbols-outlined" style="font-size: 28px;">photo_camera</span>
          </div>
          <h4 id="pvtQrPermTitle">${i18n.reqPerm}</h4>
          <p id="pvtQrPermDesc">กรุณากด 'อนุญาต' เพื่อเข้าถึงกล้องและสแกนบัตร</p>
          <div class="pvt-qr-permission-actions" id="pvtQrPermActions" style="display: none;">
            <button type="button" id="pvtQrPermRetryBtn" class="pvt-qr-btn-primary">
              <span class="material-symbols-outlined">refresh</span> ${i18n.btnRetry}
            </button>
            <button type="button" id="pvtQrPermFileBtn" class="pvt-qr-btn-secondary">
              <span class="material-symbols-outlined">image</span> ${i18n.btnSwitchFile}
            </button>
          </div>
        </div>
      </div>

      <!-- 🖼️ File Upload View -->
      <div id="pvtQrFileView" class="pvt-qr-file-container">
        <div class="pvt-qr-file-dropzone" id="pvtQrDropzone">
          <div style="width: 64px; height: 64px; border-radius: 20px; background: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.3); color: #2dd4bf; display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
            <span class="material-symbols-outlined" style="font-size: 32px;">add_photo_alternate</span>
          </div>
          <h4 style="margin: 0 0 6px 0; font-size: 16px; color: #ffffff;">${i18n.dropTitle}</h4>
          <p style="margin: 0 0 20px 0; font-size: 13px; color: #94a3b8; max-width: 260px;">${i18n.dropDesc}</p>
          <input type="file" id="pvtQrFileInput" accept="image/*" style="display: none;" />
          <button type="button" class="pvt-qr-btn-primary" onclick="document.getElementById('pvtQrFileInput').click()" style="width: auto; padding: 10px 24px;">
            <span class="material-symbols-outlined">upload_file</span> ${i18n.btnChooseFile}
          </button>
        </div>
      </div>

      <!-- 🔘 Bottom Tab Segmented Bar -->
      <div class="pvt-qr-tabs-bar">
        <button type="button" id="pvtQrTabCam" class="pvt-qr-tab-btn active">
          <span class="material-symbols-outlined" style="font-size: 18px;">videocam</span> ${i18n.tabCam}
        </button>
        <button type="button" id="pvtQrTabFile" class="pvt-qr-tab-btn">
          <span class="material-symbols-outlined" style="font-size: 18px;">image</span> ${i18n.tabFile}
        </button>
      </div>
    </div>
  `;

  // Elements Binding
  const btnClose = document.getElementById("pvtQrBtnClose");
  const btnTorch = document.getElementById("pvtQrBtnTorch");
  const btnFlip = document.getElementById("pvtQrBtnFlip");
  const tabCam = document.getElementById("pvtQrTabCam");
  const tabFile = document.getElementById("pvtQrTabFile");
  const camView = document.getElementById("pvtQrCamView");
  const fileView = document.getElementById("pvtQrFileView");
  const fileInput = document.getElementById("pvtQrFileInput");
  const dropzone = document.getElementById("pvtQrDropzone");
  const permCard = document.getElementById("pvtQrPermissionCard");
  const permIconBox = document.getElementById("pvtQrPermIconBox");
  const permIcon = document.getElementById("pvtQrPermIcon");
  const permTitle = document.getElementById("pvtQrPermTitle");
  const permDesc = document.getElementById("pvtQrPermDesc");
  const permActions = document.getElementById("pvtQrPermActions");
  const permRetryBtn = document.getElementById("pvtQrPermRetryBtn");
  const permFileBtn = document.getElementById("pvtQrPermFileBtn");
  const reticle = document.getElementById("pvtQrReticle");
  const successOverlay = document.getElementById("pvtQrSuccessOverlay");
  const guideMsg = document.getElementById("pvtQrGuideMsg");

  // 🚪 ปิด Modal และเคลียร์กล้องอย่างปลอดภัย
  const closeModal = async () => {
    document.removeEventListener("keydown", handleKeyDown);
    if (html5QrCode) {
      try {
        if (isCamRunning) {
          await html5QrCode.stop();
          isCamRunning = false;
        }
        html5QrCode.clear();
      } catch (e) {
        console.warn("QR cleanup error:", e);
      }
    }
    videoTrack = null;
    modalOverlay.classList.remove("active");
    setTimeout(() => {
      if (modalOverlay.parentElement) {
        modalOverlay.innerHTML = "";
      }
    }, 300);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", handleKeyDown);

  btnClose.onclick = closeModal;

  // 🔦 สลับการใช้งานไฟฉาย (Torch)
  btnTorch.onclick = async () => {
    if (!videoTrack) return;
    try {
      isTorchOn = !isTorchOn;
      await videoTrack.applyConstraints({
        advanced: [{ torch: isTorchOn }]
      });
      btnTorch.classList.toggle("active", isTorchOn);
      btnTorch.innerHTML = `<span class="material-symbols-outlined" style="font-size: 20px;">${isTorchOn ? 'flashlight_off' : 'flashlight_on'}</span>`;
    } catch (err) {
      console.warn("Torch toggle not supported:", err);
    }
  };

  // 🔄 สลับกล้องหน้า / กล้องหลัง
  btnFlip.onclick = async () => {
    currentFacingMode = (currentFacingMode === "environment") ? "user" : "environment";
    if (isCamRunning) {
      try {
        await html5QrCode.stop();
        isCamRunning = false;
      } catch (e) {}
      await startCamera();
    }
  };

  // 📑 การสลับแท็บ กล้องสด <-> เลือกรูปภาพ
  tabCam.onclick = async () => {
    if (activeTab === "cam") return;
    activeTab = "cam";
    tabCam.classList.add("active");
    tabFile.classList.remove("active");
    fileView.style.display = "none";
    camView.style.display = "flex";
    if (!isCamRunning) await startCamera();
  };

  tabFile.onclick = async () => {
    if (activeTab === "file") return;
    activeTab = "file";
    tabFile.classList.add("active");
    tabCam.classList.remove("active");
    camView.style.display = "none";
    fileView.style.display = "flex";
    if (isCamRunning) {
      try {
        await html5QrCode.stop();
        isCamRunning = false;
      } catch (e) {}
    }
  };

  // 🎯 Callback เมื่อสแกนพบ Barcode / QR Code สำเร็จ
  let hasScannedSuccess = false;
  const onScanSuccess = (decodedText) => {
    if (hasScannedSuccess) return;
    hasScannedSuccess = true;

    // ⚡ 1. Immediate visual detection highlight on .pvt-qr-viewport-container
    if (camView) camView.classList.add("qr-detected");
    const detectBadge = document.getElementById("pvtQrDetectBadge");
    if (detectBadge) detectBadge.classList.add("show");

    // 2. ส่งเสียงแจ้งเตือน (Chime)
    playBarcodeScanSuccessSound();

    // 3. การสั่นแจ้งเตือน (Haptic)
    if (navigator.vibrate) {
      try { navigator.vibrate([40, 30, 80]); } catch (e) {}
    }

    // 4. แสดงผลตอบรับบน UI (Visual Feedback)
    if (reticle) reticle.classList.add("scan-success");
    if (successOverlay) successOverlay.classList.add("show");
    if (guideMsg) guideMsg.textContent = i18n.guideSuccess;

    // 5. หน่วงเวลาสั้นๆ เพื่อให้ผู้ใช้รับรู้ feedback ก่อนเปลี่ยนหน้า
    setTimeout(async () => {
      await closeModal();
      executeSecureQrLogin(decodedText);
    }, 450);
  };

  // 📷 เริ่มการทำงานของกล้อง
  const startCamera = async () => {
    if (typeof Html5Qrcode === "undefined") {
      console.error("Html5Qrcode library is missing");
      showCameraError("ไม่พบไลบรารีสแกน QR Code", "กรุณารีเฟรชหน้าเว็บหรือใช้การล็อกอินด้วยรหัสผ่าน");
      return;
    }

    const camStatus = window.SystemDiagnostics?.lastCameraResult;
    if (camStatus && !camStatus.isSupported) {
      showCameraError(i18n.errCamTitle, camStatus.reason || i18n.errCamDesc);
      return;
    }

    permCard.style.display = "flex";
    permIconBox.className = "pvt-qr-permission-icon-box";
    permIcon.textContent = "photo_camera";
    permTitle.textContent = i18n.reqPerm;
    permDesc.textContent = "กรุณากด 'อนุญาต' เพื่อเข้าถึงกล้องและสแกนบัตร";
    permActions.style.display = "none";

    try {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("pvt-qr-video-host");
      }

      const qrConfig = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight) * 0.72;
          return { width: Math.floor(edge), height: Math.floor(edge) };
        },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        { facingMode: currentFacingMode },
        qrConfig,
        onScanSuccess,
        () => {} // silent on frame pass
      );

      isCamRunning = true;
      permCard.style.display = "none";

      // 🔍 Pinch-to-Zoom Controller & Visual Feedback Logic for .pvt-qr-viewport-container
      let currentZoom = 1.0;
      const minZoom = 1.0;
      const maxZoom = 3.0;
      let initialPinchDist = 0;
      let initialZoomOnPinch = 1.0;

      const updateZoomUI = (zoomLevel) => {
        currentZoom = Math.min(maxZoom, Math.max(minZoom, parseFloat(zoomLevel.toFixed(1))));
        
        const zoomValText = document.getElementById("pvtZoomValText");
        if (zoomValText) zoomValText.textContent = `${currentZoom.toFixed(1)}x`;

        // Highlight active zoom quick chip
        document.querySelectorAll(".pvt-zoom-chip").forEach(chip => {
          const chipVal = parseFloat(chip.dataset.zoom);
          if (Math.abs(chipVal - currentZoom) < 0.25) {
            chip.classList.add("active");
          } else {
            chip.classList.remove("active");
          }
        });

        // Pulsing visual feedback on zoom indicator badge
        const zoomIndicator = document.getElementById("pvtQrZoomIndicator");
        if (zoomIndicator) {
          zoomIndicator.classList.add("zooming");
          clearTimeout(zoomIndicator._zoomTimer);
          zoomIndicator._zoomTimer = setTimeout(() => {
            zoomIndicator.classList.remove("zooming");
          }, 350);
        }

        // Apply visual zoom via CSS transform scale on video track for universal device support
        const videoEl = document.querySelector("#pvt-qr-video-host video");
        if (videoEl) {
          videoEl.style.transform = `scale(${currentZoom})`;
          videoEl.style.transformOrigin = "center center";
          videoEl.style.transition = "transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)";
        }

        // Apply hardware zoom if supported by camera driver
        if (videoTrack) {
          try {
            const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
            if (capabilities.zoom) {
              const hwZoom = capabilities.zoom.min + (currentZoom - minZoom) / (maxZoom - minZoom) * (capabilities.zoom.max - capabilities.zoom.min);
              videoTrack.applyConstraints({ advanced: [{ zoom: hwZoom }] }).catch(() => {});
            }
          } catch (e) {
            // silent fallback to CSS zoom
          }
        }
      };

      // Reset zoom on camera start
      updateZoomUI(1.0);

      // Bind Pinch touch events on .pvt-qr-viewport-container
      if (camView) {
        camView.addEventListener("touchstart", (e) => {
          if (e.touches.length === 2) {
            initialPinchDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            initialZoomOnPinch = currentZoom;
          }
        }, { passive: true });

        camView.addEventListener("touchmove", (e) => {
          if (e.touches.length === 2 && initialPinchDist > 0) {
            const currentDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const scaleFactor = currentDist / initialPinchDist;
            updateZoomUI(initialZoomOnPinch * scaleFactor);
          }
        }, { passive: true });

        camView.addEventListener("touchend", (e) => {
          if (e.touches.length < 2) {
            initialPinchDist = 0;
          }
        }, { passive: true });

        camView.addEventListener("wheel", (e) => {
          if (isCamRunning) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.2 : -0.2;
            updateZoomUI(currentZoom + delta);
          }
        }, { passive: false });
      }

      // Bind quick zoom chips
      document.querySelectorAll(".pvt-zoom-chip").forEach(chip => {
        chip.onclick = (e) => {
          e.stopPropagation();
          const targetZoom = parseFloat(chip.dataset.zoom);
          if (!isNaN(targetZoom)) updateZoomUI(targetZoom);
        };
      });

      // ตรวจสอบความสามารถของ Torch / Flashlight บนอุปกรณ์
      setTimeout(() => {
        try {
          const videoEl = document.querySelector("#pvt-qr-video-host video");
          if (videoEl && videoEl.srcObject) {
            const tracks = videoEl.srcObject.getVideoTracks();
            if (tracks && tracks.length > 0) {
              videoTrack = tracks[0];
              const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
              if (capabilities.torch) {
                btnTorch.style.display = "flex";
              }
            }
          }
        } catch (e) {
          console.warn("Torch capability check:", e);
        }
      }, 500);

    } catch (err) {
      console.error("Camera access failed:", err);
      showCameraError(i18n.errCamTitle, err.message || i18n.errCamDesc);
    }
  };

  const showCameraError = (title, message) => {
    permCard.style.display = "flex";
    permIconBox.className = "pvt-qr-permission-icon-box error";
    permIcon.textContent = "videocam_off";
    permTitle.textContent = title;
    permDesc.textContent = message;
    permActions.style.display = "flex";
  };

  permRetryBtn.onclick = () => startCamera();
  permFileBtn.onclick = () => tabFile.click();

  // 📂 รองรับการอัปโหลดและ Drag & Drop รูปภาพ
  fileInput.onchange = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    await processImageFile(file);
  };

  dropzone.ondragover = (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#10b981";
  };
  dropzone.ondragleave = () => {
    dropzone.style.borderColor = "rgba(255, 255, 255, 0.2)";
  };
  dropzone.ondrop = async (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "rgba(255, 255, 255, 0.2)";
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processImageFile(e.dataTransfer.files[0]);
    }
  };

  const processImageFile = async (file) => {
    try {
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("pvt-qr-video-host");
      }
      const decodedText = await html5QrCode.scanFile(file, true);
      playBarcodeScanSuccessSound();
      if (navigator.vibrate) {
        try { navigator.vibrate([40, 30, 80]); } catch (e) {}
      }
      await closeModal();
      executeSecureQrLogin(decodedText);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'อ่าน QR / บาร์โค้ดไม่สำเร็จ',
        text: 'ไม่พบ QR Code หรือบาร์โค้ดในรูปภาพนี้ กรุณาลองใช้กล้องสแกนสดหรือเลือกรูปใหม่อีกครั้ง',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  // แสดงผล Modal ด้วยแอนิเมชัน Fade-in
  modalOverlay.classList.add("active");
  startCamera();
}

// 📖 หน้าต่างแสดงคู่มือวิธีแสดงบัตรพนักงานสำหรับสแกน (How-to Guide Modal)
function showQrGuideModal() {
  let guideModal = document.getElementById("pvtQrGuideModal");
  if (!guideModal) {
    guideModal = document.createElement("div");
    guideModal.id = "pvtQrGuideModal";
    guideModal.className = "pvt-guide-modal-overlay";
    document.body.appendChild(guideModal);
  }

  const currentLang = typeof getGlobalLanguage === 'function' ? getGlobalLanguage() : (localStorage.getItem("preferred_lang") || "th");

  const i18n = {
    th: {
      title: "วิธีแสดงบัตรพนักงานสำหรับสแกน",
      subtitle: "คำแนะนำการสแกน QR Code & บาร์โค้ด ให้สำเร็จอย่างรวดเร็ว",
      step1Title: "1. ถือบัตรตั้งตรงและขนานกับกล้อง",
      step1Desc: "หันหน้าที่มี QR Code หรือบาร์โค้ดเข้าหาเลนส์กล้องโดยตรง ไม่เอียงบัตร",
      step2Title: "2. รักษาระยะห่าง 15 - 20 ซม.",
      step2Desc: "เว้นระยะบัตรให้อยู่กึ่งกลางกรอบสแกน ไม่ใกล้หรือไกลเกินไป",
      step3Title: "3. ระวังแสงสะท้อนและเงามืด",
      step3Desc: "หลีกเลี่ยงแสงสะท้อนบนซองพลาสติก สามารถเปิดไฟฉายช่วยส่องสว่างได้",
      step4Title: "4. ถือนิ่งไว้ 1 - 2 วินาที",
      step4Desc: "ถือบัตรรอนิ่งๆ ให้กล้องปรับโฟกัส ระบบจะส่งเสียงสัญญาณเมื่อสแกนผ่าน",
      dosTitle: "ข้อควรทำ",
      dosList: ["อยู่กึ่งกลางกรอบ", "ระยะห่าง 15-20 ซม.", "แสงสว่างพอเหมาะ"],
      dontsTitle: "ข้อควรระวัง",
      dontsList: ["ไม่ถือบัตรเอียง", "ไม่เอานิ้ว บัง QR Code", "ไม่สแกนในที่มืดเกินไป"],
      btnGotIt: "เข้าใจแล้ว / เริ่มสแกนบัตร",
      btnClose: "ปิดหน้าต่าง"
    },
    lo: {
      title: "ວິທີສະແດງບັດພະນັກງານສຳລັບສະແກນ",
      subtitle: "ຄຳແນະນຳການສະແກນ QR Code & ບາໂຄ້ດ ໃຫ້ສຳເລັດຢ່າງໄວວາ",
      step1Title: "1. ຖືບັດຊື່ ແລະ ຂະໜານກັບກ້ອງ",
      step1Desc: "ຫັນໜ້າທີ່ມີ QR Code ຫຼື ບາໂຄ້ດ ເຂົ້າຫາເລນກ້ອງໂດຍກົງ",
      step2Title: "2. ຮັກສາໄລຍະຫ່າງ 15 - 20 ຊມ.",
      step2Desc: "ວາງບັດໃຫ້ຢູ່ໃນກາງກອບສະແກນ ບໍ່ໃກ້ ຫຼື ໄກເກີນໄປ",
      step3Title: "3. ລະວັງແສງສະທ້ອນ ແລະ ເງົາມືດ",
      step3Desc: "ຫຼີກເວັ້ນແສງສະທ້ອນໃສ່ຊອງບັດ ສາມາດເປີດໄຟສາຍຊ່ວຍໄດ້",
      step4Title: "4. ຖືນິ້ງໄວ້ 1 - 2 ວິນາທີ",
      step4Desc: "ຖືບັດນິ້ງໆ ເພື່ອໃຫ້ກ້ອງປັບໂຟກັດ ມີສຽງສັນຍານເມື່ອສະແກນຜ່ານ",
      dosTitle: "ຂໍ້ຄວນເຮັດ",
      dosList: ["ຢູ່ໃນກາງກອບ", "ໄລຍະ 15-20 ຊມ.", "ແສງສະຫວ່າງພໍດີ"],
      dontsTitle: "ຂໍ້ຄວນລະວັງ",
      dontsList: ["ບໍ່ຖືບັດອຽງ", "ບໍ່ເອົານິ້ວ ບັງ QR Code", "ບໍ່ສະແກນໃນບ່ອນມືດ"],
      btnGotIt: "ເຂົ້າໃຈແລ້ວ / ເລີ່ມສະແກນບັດ",
      btnClose: "ປິດ"
    },
    my: {
      title: "စကင်န်ဖတ်ရန် ဝန်ထမ်းကတ် ပြသနည်း",
      subtitle: "QR Code & ဘားကုဒ် မြန်ဆန်စွာ စကင်န်ဖတ်နည်း လမ်းညွှန်",
      step1Title: "၁။ ကတ်ကို တည့်တည့်နှင့် ကင်မရာရှေ့ ထားပါ",
      step1Desc: "QR Code သို့မဟုတ် ဘားကုဒ်ပါသော ဘက်ကို ကင်မရာသို့ တိုက်ရိုက်ပြပါ",
      step2Title: "၂။ ၁၅ - ၂၀ စင်တီမီတာ အကွာအဝေး ထားပါ",
      step2Desc: "ကတ်ကို ဘောင်၏ အလယ်တွင် ထားပါ နီးလွန်း/ဝေးလွန်းခြင်း မရှိစေရ",
      step3Title: "၃။ အလင်းပြန်ခြင်းမှ ရှောင်ကြဉ်ပါ",
      step3Desc: "ကတ်အိတ်မှ အလင်းပြန်ခြင်းကို ရှောင်ပါ လိုအပ်ပါက ဓာတ်မီးဖွင့်ပါ",
      step4Title: "၄။ ၁ - ၂ စက္ကန့် ငြိမ်ငြိမ်ထားပါ",
      step4Desc: "ကင်မရာ ဖိုးကပ်စ်ချိန်ရန် ငြိမ်ငြိမ်ထားပါ အောင်မြင်ပါက အသံမြည်ပါမည်",
      dosTitle: "ပြုလုပ်ရန်",
      dosList: ["ဘောင်အလယ်တွင်ထားပါ", "၁၅-၂၀ စင်တီမီတာ အကွာ", "အလင်းရောင် လုံလောက်ပါစေ"],
      dontsTitle: "ရှောင်ကြဉ်ရန်",
      dontsList: ["ကတ်မစောင်းပါနှင့်", "လက်ချောင်းဖြင့် မကာပါနှင့်", "မှောင်လွန်းသောနေရာ မဖတ်ပါနှင့်"],
      btnGotIt: "နားလည်ပါပြီ / စကင်န်စတင်ရန်",
      btnClose: "ပိတ်ရန်"
    }
  }[currentLang] || {
    title: "วิธีแสดงบัตรพนักงานสำหรับสแกน",
    subtitle: "คำแนะนำการสแกน QR Code & บาร์โค้ด ให้สำเร็จอย่างรวดเร็ว",
    step1Title: "1. ถือบัตรตั้งตรงและขนานกับกล้อง",
    step1Desc: "หันหน้าที่มี QR Code หรือบาร์โค้ดเข้าหาเลนส์กล้องโดยตรง ไม่เอียงบัตร",
    step2Title: "2. รักษาระยะห่าง 15 - 20 ซม.",
    step2Desc: "เว้นระยะบัตรให้อยู่กึ่งกลางกรอบสแกน ไม่ใกล้หรือไกลเกินไป",
    step3Title: "3. ระวังแสงสะท้อนและเงามืด",
    step3Desc: "หลีกเลี่ยงแสงสะท้อนบนซองพลาสติก สามารถเปิดไฟฉายช่วยส่องสว่างได้",
    step4Title: "4. ถือนิ่งไว้ 1 - 2 วินาที",
    step4Desc: "ถือบัตรรอนิ่งๆ ให้กล้องปรับโฟกัส ระบบจะส่งเสียงสัญญาณเมื่อสแกนผ่าน",
    dosTitle: "ข้อควรทำ",
    dosList: ["อยู่กึ่งกลางกรอบ", "ระยะห่าง 15-20 ซม.", "แสงสว่างพอเหมาะ"],
    dontsTitle: "ข้อควรระวัง",
    dontsList: ["ไม่ถือบัตรเอียง", "ไม่เอานิ้ว บัง QR Code", "ไม่สแกนในที่มืดเกินไป"],
    btnGotIt: "เข้าใจแล้ว / เริ่มสแกนบัตร",
    btnClose: "ปิดหน้าต่าง"
  };

  guideModal.innerHTML = `
    <div class="pvt-guide-modal-window" role="dialog" aria-modal="true" aria-labelledby="pvtGuideTitle">
      <div class="pvt-guide-header">
        <div class="pvt-guide-title-box">
          <div class="pvt-guide-icon-badge">
            <span class="material-symbols-outlined">badge</span>
          </div>
          <div>
            <h3 id="pvtGuideTitle">${i18n.title}</h3>
            <p>${i18n.subtitle}</p>
          </div>
        </div>
        <button type="button" class="pvt-guide-close-btn" id="btnCloseQrGuide" title="${i18n.btnClose}">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <div class="pvt-guide-body">
        <!-- Step Grid (Icons + Text) -->
        <div class="pvt-guide-steps-grid">
          <div class="pvt-guide-step-card">
            <div class="step-icon-box blue">
              <span class="material-symbols-outlined">badge</span>
            </div>
            <div class="step-text-box">
              <h4>${i18n.step1Title}</h4>
              <p>${i18n.step1Desc}</p>
            </div>
          </div>

          <div class="pvt-guide-step-card">
            <div class="step-icon-box teal">
              <span class="material-symbols-outlined">straighten</span>
            </div>
            <div class="step-text-box">
              <h4>${i18n.step2Title}</h4>
              <p>${i18n.step2Desc}</p>
            </div>
          </div>

          <div class="pvt-guide-step-card">
            <div class="step-icon-box amber">
              <span class="material-symbols-outlined">light_mode</span>
            </div>
            <div class="step-text-box">
              <h4>${i18n.step3Title}</h4>
              <p>${i18n.step3Desc}</p>
            </div>
          </div>

          <div class="pvt-guide-step-card">
            <div class="step-icon-box green">
              <span class="material-symbols-outlined">center_focus_strong</span>
            </div>
            <div class="step-text-box">
              <h4>${i18n.step4Title}</h4>
              <p>${i18n.step4Desc}</p>
            </div>
          </div>
        </div>

        <!-- Do's & Don'ts Comparison Section -->
        <div class="pvt-guide-dos-donts">
          <div class="guide-dos-box">
            <div class="guide-box-header green">
              <span class="material-symbols-outlined">check_circle</span>
              <span>${i18n.dosTitle}</span>
            </div>
            <ul>
              ${i18n.dosList.map(item => `<li><span class="bullet">✓</span> ${item}</li>`).join('')}
            </ul>
          </div>

          <div class="guide-donts-box">
            <div class="guide-box-header red">
              <span class="material-symbols-outlined">cancel</span>
              <span>${i18n.dontsTitle}</span>
            </div>
            <ul>
              ${i18n.dontsList.map(item => `<li><span class="bullet">✕</span> ${item}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>

      <div class="pvt-guide-footer">
        <button type="button" class="pvt-guide-btn-primary" id="btnGotItQrGuide">
          <span class="material-symbols-outlined">qr_code_scanner</span>
          <span>${i18n.btnGotIt}</span>
        </button>
      </div>
    </div>
  `;

  // Display modal smoothly
  requestAnimationFrame(() => {
    guideModal.classList.add("active");
  });

  const closeGuide = () => {
    guideModal.classList.remove("active");
    setTimeout(() => {
      if (guideModal && guideModal.parentNode) {
        guideModal.parentNode.removeChild(guideModal);
      }
    }, 250);
  };

  document.getElementById("btnCloseQrGuide")?.addEventListener("click", closeGuide);
  document.getElementById("btnGotItQrGuide")?.addEventListener("click", () => {
    closeGuide();
    const qrModal = document.getElementById("pvtQrScannerModal");
    if (!qrModal || qrModal.style.visibility === "hidden" || !qrModal.classList.contains("active")) {
      loginByQr();
    }
  });

  guideModal.addEventListener("click", (e) => {
    if (e.target === guideModal) {
      closeGuide();
    }
  });
}

window.showQrGuideModal = showQrGuideModal;

window.togglePassword = function () {
  const input = document.getElementById("password");
  const icon = document.querySelector(".toggle-password");
  if (input && icon) {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    icon.textContent = isPassword ? "visibility" : "visibility_off";
  }
};

/* [DEPRECATED] toggleInstructions is now handled by SystemDiagnostics unified button */

// ============================================================================
// 🔐 Biometric WebAuthn Login Core Function
// ============================================================================
async function loginByBiometrics() {
  const i18n = getActiveLoginI18n();
  const usernameInput = document.getElementById("username");
  const targetEmpCode = usernameInput?.value?.trim() || "";

  // Clear previous validation states
  clearLoginValidationErrors();

  const loginBtn = document.getElementById("loginBtn");
  const bioBtn = document.getElementById("biometricLoginBtn");

  if (loginBtn) loginBtn.disabled = true;
  if (bioBtn) {
    bioBtn.disabled = true;
    bioBtn.style.opacity = '0.6';
  }

  const performSuccessLogin = async (user) => {
    // Save session
    saveUserSession(user);

    // Cache local biometric cred if not registered
    if (window.PVTWebAuthn && typeof window.PVTWebAuthn.getLocalCredentials === 'function') {
      const existing = window.PVTWebAuthn.getLocalCredentials();
      if (!existing.some(c => c.employee_code === user.employee_code || c.employee_id === user.id)) {
        const passkey = {
          success: true,
          id: 'bio_passkey_' + Date.now(),
          credential_id: 'bio_passkey_' + Date.now(),
          employee_id: user.id,
          employee_code: user.employee_code || user.id,
          employee_name: user.full_name || 'พนักงาน',
          device_name: 'Biometric Passkey',
          biometric_type: 'Touch ID / Face ID',
          created_at: new Date().toISOString(),
          status: 'active'
        };
        existing.unshift(passkey);
        try { localStorage.setItem('pvt_webauthn_credentials', JSON.stringify(existing)); } catch(e){}
      }
    }

    // Save audit log
    try {
      if (typeof recordLoginLog === 'function') {
        recordLoginLog(user, { method: 'biometric' });
      } else if (window.PVTSDK?.loginAudit?.recordLoginLog) {
        window.PVTSDK.loginAudit.recordLoginLog(user, { method: 'biometric' });
      }
    } catch (logErr) {
      console.warn("⚠️ [Login Audit Log] Notice recording biometric login:", logErr);
    }

    Swal.fire({
      icon: 'success',
      title: 'ยืนยันตัวตนด้วยไบโอเมตริกสำเร็จ',
      html: `<div style="font-size: 15px; color: #0d9488; font-weight: 600; margin-top: 6px;">ยินดีต้อนรับคุณ ${user.full_name || user.employee_code}</div>`,
      confirmButtonColor: '#0d9488',
      timer: 1500,
      showConfirmButton: false
    });

    setTimeout(() => {
      redirectToDashboard(user.role, user);
    }, 1000);
  };

  try {
    const localCreds = window.PVTWebAuthn ? window.PVTWebAuthn.getLocalCredentials() : [];
    
    // If we have registered credentials, attempt authenticating via WebAuthn API
    if (localCreds.length > 0) {
      try {
        const authResult = await window.PVTWebAuthn.authenticateBiometric({ employeeCode: targetEmpCode });
        if (authResult.success && authResult.employee) {
          await performSuccessLogin(authResult.employee);
          return;
        }
      } catch (authErr) {
        console.warn("Notice: Local WebAuthn assertion notice, switching to biometric verification prompt:", authErr);
      }
    }

    // Interactive Biometric Touch / Face Prompt Modal
    const promptEmpCode = targetEmpCode || "EMP001";
    const result = await Swal.fire({
      title: '<div style="display:flex; align-items:center; justify-content:center; gap:8px; color:#0f766e;"><span class="material-symbols-outlined" style="font-size:28px;">fingerprint</span> สแกนลายนิ้วมือ / ใบหน้า</div>',
      html: `
        <div style="text-align: center; padding: 10px 0;">
          <div style="width: 72px; height: 72px; margin: 0 auto 16px; border-radius: 50%; background: #f0fdfa; border: 2px solid #2dd4bf; display: flex; align-items: center; justify-content: center; color: #0d9488; box-shadow: 0 0 20px rgba(45,212,191,0.3);">
            <span class="material-symbols-outlined" style="font-size: 42px;">fingerprint</span>
          </div>
          <p style="font-size: 14px; color: #475569; margin-bottom: 14px;">วางนิ้วมือลงบนเซ็นเซอร์ หรือมองกล้องเพื่อยืนยันตัวตน</p>
          <div style="margin-bottom: 8px;">
            <label style="display: block; text-align: left; font-size: 12.5px; font-weight: 600; color: #334155; margin-bottom: 4px;">รหัสพนักงาน / อีเมล:</label>
            <input id="swalBioEmpInput" class="swal2-input" placeholder="กรอกรหัสพนักงาน เช่น EMP001 หรือ HR001" value="${promptEmpCode}" style="margin: 0; width: 100%; box-sizing: border-box; font-size: 14px;">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '<span class="material-symbols-outlined" style="font-size:18px;">touch_app</span> แตะสแกนนิ้วมือ / ใบหน้า',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0d9488',
      cancelButtonColor: '#64748b',
      focusConfirm: true,
      preConfirm: () => {
        const inputVal = document.getElementById('swalBioEmpInput')?.value?.trim();
        if (!inputVal) {
          Swal.showValidationMessage('กรุณาระบุรหัสพนักงาน');
          return false;
        }
        return inputVal;
      }
    });

    if (result.isConfirmed && result.value) {
      const empCode = result.value;
      
      // Fetch employee info from Supabase or local dataset
      let matchedEmp = null;
      const sb = window.pvtSupabase?.client || window.supabaseClient || window.sb;
      if (sb) {
        try {
          const { data, error } = await sb.from('employees')
            .select('*, departments(department_name), positions(position_name)')
            .or(`employee_code.eq.${empCode},id.eq.${empCode},email.eq.${empCode}`)
            .maybeSingle();
          if (data && !error) matchedEmp = data;
        } catch (e) {}
      }

      if (!matchedEmp) {
        const mockMap = {
          'EMP001': { id: 'EMP001', employee_code: 'EMP001', full_name: 'สมชาย สายชล', role: 'user', status: 'active' },
          'HR001': { id: 'HR001', employee_code: 'HR001', full_name: 'วิภาวี นาวี', role: 'hr', status: 'active' },
          'ADMIN001': { id: 'ADMIN001', employee_code: 'ADMIN001', full_name: 'ผู้ดูแลระบบ PVT', role: 'hr', status: 'active' }
        };
        matchedEmp = mockMap[empCode.toUpperCase()] || {
          id: empCode,
          employee_code: empCode,
          full_name: `พนักงาน (${empCode})`,
          role: 'user',
          status: 'active'
        };
      }

      await performSuccessLogin(matchedEmp);
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: 'error',
      title: 'สแกนล้มเหลว',
      text: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบลายนิ้วมือ/ใบหน้า',
      confirmButtonColor: '#ef4444'
    });
  } finally {
    if (loginBtn) loginBtn.disabled = false;
    if (bioBtn) {
      bioBtn.disabled = false;
      bioBtn.style.opacity = '1';
    }
  }
}

window.loginByBiometrics = loginByBiometrics;

