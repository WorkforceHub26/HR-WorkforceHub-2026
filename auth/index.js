/* ==========================================================================
   🔒 PVT HR LEAVE - auth/index.js (เวอร์ชันเสถียรสูงสุด: ป้องกัน Loop & Auto Refresh)
   ========================================================================== */

function getSbClient() {
  return window.pvtSupabase?.client 
      || window.PVTSDK?.client 
      || window.supabaseClient 
      || window.supabase;
}

// 🚀 1. ฟังก์ชันย้ายหน้าจอตามสิทธิ์การใช้งาน (Role Routing)
function redirectToDashboard(role, userObj) {
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

// 🌐 Language Switcher Translations (TH, LO, MY)
const loginTranslations = {
  th: {
    badge: "ระบบขออนุญาตลาออนไลน์",
    userLabel: "รหัสพนักงาน หรือ ชื่อ-นามสกุล",
    userInputPlaceholder: "กรอกรหัสพนักงาน หรือ ชื่อพนักงาน",
    passLabel: "รหัสผ่าน (Password)",
    passInputPlaceholder: "กรอกรหัสผ่านเข้าสู่ระบบ",
    remember: "จดจำรหัสพนักงาน (Remember Me)",
    loginBtn: "เข้าสู่ระบบ",
    qrBtn: "สแกนคิวอาร์โค้ดบัตรพนักงาน",
    errEmptyBoth: "กรุณากรอกข้อมูลผู้ใช้งานและรหัสผ่านให้ครบถ้วน",
    errEmptyUser: "กรุณากรอกรหัสพนักงาน หรือชื่อผู้ใช้งาน",
    errEmptyPass: "กรุณากรอกรหัสผ่าน",
    errInvalidCreds: "รหัสพนักงาน หรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง",
    errUserNotFound: "ไม่พบข้อมูลผู้ใช้งานในระบบ กรุณาตรวจสอบรหัสพนักงานหรือชื่ออีกครั้ง",
    errPassWrong: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
    errInactive: "บัญชีของคุณถูกระงับสิทธิ์การใช้งาน กรุณาติดต่อฝ่ายบุคคล (HR)",
    errDbConn: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
    errMultipleUsers: "พบชื่อ-นามสกุลนี้ซ้ำกันในระบบ กรุณาใช้รหัสพนักงานเข้าสู่ระบบแทน"
  },
  lo: {
    badge: "ລະບົບຂໍອະນຸຍາດລາພັກອອນໄລນ໌",
    userLabel: "ລະຫັດພະນັກງານ ຫຼື ຊື່-ນາມສະກຸນ",
    userInputPlaceholder: "ປ້ອນລະຫັດພະນັກງານ ຫຼື ຊື່ພະນັກງານ",
    passLabel: "ລະຫັດຜ່ານ (Password)",
    passInputPlaceholder: "ປ້ອນລະຫັດຜ່ານເຂົ້າສູ່ລະບົບ",
    remember: "ຈົດຈຳລະຫັດພະນັກງານ (Remember Me)",
    loginBtn: "ເຂົ້າສູ່ລະບົບ",
    qrBtn: "ສະແກນຄິວອ່າວໂຄດບັດພະນັກງານ",
    errEmptyBoth: "ກະລຸນາປ້ອນຊື່ຜູ້ໃຊ້ງານ ແລະ ລະຫັດຜ່ານໃຫ້ຄົບຖ້ວນ",
    errEmptyUser: "ກະລຸນາປ້ອນລະຫັດພະນັກງານ ຫຼື ຊື່ຜູ້ໃຊ້ງານ",
    errEmptyPass: "ກະລຸນາປ້ອນລະຫັດຜ່ານ",
    errInvalidCreds: "ລະຫັດພະນັກງານ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ ກະລຸນາກວດສອບຄືນໃໝ່",
    errUserNotFound: "ບໍ່ພົບຂໍ້ມູນຜູ້ໃຊ້ງານໃນລະບົບ ກະລຸນາກວດສອບລະຫັດ ຫຼື ຊື່ອີກຄັ້ງ",
    errPassWrong: "ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ ກະລຸນາລອງໃໝ່ອີກຄັ້ງ",
    errInactive: "ບັນຊີຂອງທ່ານຖືກລະງັບການນຳໃຊ້ ກະລຸນາຕິດຕໍ່ຝ່າຍບຸກຄະລາກອນ (HR)",
    errDbConn: "ບໍ່ສາມາດເຊື່ອມຕໍ່ຖານຂໍ້ມູນໄດ້ ກະລຸນາລອງໃໝ່ພາຍຫຼັງ",
    errMultipleUsers: "ພົບຊື່-ນາມສະກຸນຊໍ້າກັນໃນລະບົບ ກະລຸນາໃຊ້ລະຫັດພະນັກງານເຂົ້າສູ່ລະບົບແທນ"
  },
  my: {
    badge: "အွန်လိုင်းခွင့်တောင်းခံလွှာစနစ်",
    userLabel: "ဝန်ထမ်းနံပါတ် သို့မဟုတ် အမည်",
    userInputPlaceholder: "ဝန်ထမ်းနံပါတ် သို့မဟုတ် အမည်ကို ထည့်ပါ",
    passLabel: "စကားဝှက် (Password)",
    passInputPlaceholder: "စကားဝှက်ကို ထည့်ပါ",
    remember: "ဝန်ထမ်းနံပါတ်ကို မှတ်ထားရန်",
    loginBtn: "အကောင့်ဝင်ရန်",
    qrBtn: "ဝန်ထမ်းကတ် QR ကုဒ်ကို စကန်ဖတ်ရန်",
    errEmptyBoth: "အသုံးပြုသူအမည်နှင့် စကားဝှက်ကို အပြည့်အစုံ ဖြည့်သွင်းပါ",
    errEmptyUser: "ဝန်ထမ်းနံပါတ် သို့မဟုတ် အမည်ကို ဖြည့်သွင်းပါ",
    errEmptyPass: "စကားဝှက်ကို ဖြည့်သွင်းပါ",
    errInvalidCreds: "ဝန်ထမ်းနံပါတ် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်",
    errUserNotFound: "အသုံးပြုသူအချက်အလက်ကို ရှာမတွေ့ပါ စစ်ဆေးပြီး ပြန်လည်ကြိုးစားပါ",
    errPassWrong: "စကားဝှက် မှားယွင်းနေပါသည် ထပ်မံကြိုးစားပါ",
    errInactive: "သင့်အကောင့်ကို ရပ်ဆိုင်းထားပါသည် HR သို့ ဆက်သွယ်ပါ",
    errDbConn: "ဒေတာဘေ့စ်နှင့် ချိတ်ဆက်၍မရပါ နောက်မှ ပြန်လည်ကြိုးစားပါ",
    errMultipleUsers: "နာမည်တူ ဝန်ထမ်းများ ရှိနေပါသဖြင့် ဝန်ထမ်းနံပါတ်ဖြင့် အကောင့်ဝင်ပါ"
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
  const qrBtnEl = document.getElementById("i18nQrBtn");

  if (badgeEl) badgeEl.textContent = t.badge;
  if (userLabelEl) userLabelEl.textContent = t.userLabel;
  if (usernameInput) usernameInput.placeholder = t.userInputPlaceholder;
  if (passLabelEl) passLabelEl.textContent = t.passLabel;
  if (passwordInput) passwordInput.placeholder = t.passInputPlaceholder;
  if (rememberEl) rememberEl.textContent = t.remember;
  if (loginBtnEl) loginBtnEl.textContent = t.loginBtn;
  if (qrBtnEl) qrBtnEl.textContent = t.qrBtn;

  const btnTh = document.getElementById("langThBtn");
  const btnLo = document.getElementById("langLoBtn");
  const btnMy = document.getElementById("langMyBtn");

  [btnTh, btnLo, btnMy].forEach(b => {
    if (b) {
      b.style.backgroundColor = "transparent";
      b.style.color = "#64748b";
      b.style.boxShadow = "none";
      b.style.fontWeight = "600";
    }
  });

  const activeBtn = lang === 'th' ? btnTh : lang === 'lo' ? btnLo : btnMy;
  if (activeBtn) {
    activeBtn.style.backgroundColor = "#ffffff";
    activeBtn.style.color = "#0d9488";
    activeBtn.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
    activeBtn.style.fontWeight = "700";
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
  // เช็กว่ามาจาก Redirect ซ้ำหรือไม่ ป้องกัน Infinite Loop
  const hasRedirected = sessionStorage.getItem("redirect_attempt");
  
  try {
    const rawSession = localStorage.getItem("currentUser");
    if (rawSession && !hasRedirected) {
      const session = JSON.parse(rawSession);
      if (session.expireAt && Date.now() < session.expireAt) {
        sessionStorage.setItem("redirect_attempt", "true");
        redirectToDashboard(session.role);
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

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    const loginBtn = loginForm.querySelector('.login-btn');
    loginBtn?.classList.add('loading');

    // Handle Remember Me storage
    if (rememberCheckbox && rememberCheckbox.checked) {
      localStorage.setItem("pvt_remembered_username", loginInput);
    } else {
      localStorage.removeItem("pvt_remembered_username");
    }

    const sb = getSbClient();
    if (!sb) {
      loginBtn?.classList.remove('loading');
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
        showLoginValidationError(i18n.errInvalidCreds, {
          type: 'error',
          highlightUser: true,
          highlightPass: true,
          focusTarget: usernameInput
        });
        return;
      }

      if (String(user.status || "").toLowerCase() === "inactive") {
        showLoginValidationError(i18n.errInactive, {
          type: 'error',
          highlightUser: true,
          userHint: i18n.errInactive
        });
        return;
      }

      saveUserSession(user);
      sessionStorage.removeItem("redirect_attempt");
      redirectToDashboard(user.role, user);

    } catch (err) {
      loginBtn?.classList.remove('loading');
      showLoginValidationError(err.message || i18n.errInvalidCreds, {
        type: 'error',
        highlightUser: true,
        highlightPass: true
      });
    } finally {
      loginBtn?.classList.remove('loading');
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

// เปิดกล้อง / อัปโหลดรูปเพื่อสแกน QR
function loginByQr() {
  let html5QrCode = null;
  let isCamRunning = false;

  Swal.fire({
    title: '📱 สแกน QR Code เข้าสู่ระบบ',
    html: `
      <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 15px;">
        <button id="btn-tab-cam" type="button" class="swal2-styled" style="background:#2563eb; color:#fff; margin:0; padding:8px 16px; border-radius:8px; font-size:14px; cursor:pointer;">📷 เปิดกล้อง</button>
        <button id="btn-tab-file" type="button" class="swal2-styled" style="background:#4b5563; color:#fff; margin:0; padding:8px 16px; border-radius:8px; font-size:14px; cursor:pointer;">🖼️ เลือกรูปภาพ</button>
      </div>

      <div id="qr-cam-box" style="width: 100%; max-width: 320px; height: 260px; margin: 0 auto; border-radius: 12px; overflow: hidden; background: #0f172a; position: relative; display: flex; align-items: center; justify-content: center;">
        <div id="qr-reader" style="width:100%; height:100%;"></div>
        <div id="qr-cam-loading" style="position: absolute; color: #94a3b8; font-size: 13px; text-align: center; padding: 12px;">
          ⏳ กำลังเปิดกล้อง กรุณาอนุญาตการเข้าถึง...
        </div>
      </div>

      <div id="qr-file-box" style="display:none; width: 100%; max-width: 320px; margin: 0 auto; padding: 25px 15px; border: 2px dashed #9ca3af; border-radius: 12px; background: #f9fafb; text-align: center;">
        <div style="font-size: 36px; margin-bottom: 8px;">📸</div>
        <p style="margin: 0 0 12px 0; color: #4b5563; font-size: 13px;">เลือกหรืออัปโหลดรูปภาพบัตรพนักงาน / QR Code</p>
        <input type="file" id="qr-file-input" accept="image/*" style="display:none;" />
        <button type="button" onclick="document.getElementById('qr-file-input').click()" class="swal2-styled" style="background:#059669; color:#fff; margin:0; padding:8px 18px; border-radius:8px; cursor:pointer;">เลือกไฟล์รูปภาพ</button>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      const camLoading = document.getElementById('qr-cam-loading');
      html5QrCode = new Html5Qrcode("qr-reader");

      const btnCam = document.getElementById('btn-tab-cam');
      const btnFile = document.getElementById('btn-tab-file');
      const camBox = document.getElementById('qr-cam-box');
      const fileBox = document.getElementById('qr-file-box');

      const onScanSuccess = (decodedText) => {
        if (html5QrCode && isCamRunning) {
          html5QrCode.stop().then(() => {
            isCamRunning = false;
            Swal.close();
            executeSecureQrLogin(decodedText);
          }).catch(() => {
            Swal.close();
            executeSecureQrLogin(decodedText);
          });
        } else {
          Swal.close();
          executeSecureQrLogin(decodedText);
        }
      };

      const startCamera = async () => {
        try {
          if (camLoading) camLoading.style.display = "block";
          const config = { fps: 15, qrbox: { width: 220, height: 220 } };

          try {
            await html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
          } catch (e) {
            await html5QrCode.start({ facingMode: "user" }, config, onScanSuccess, () => {});
          }
          isCamRunning = true;
          if (camLoading) camLoading.style.display = "none";
        } catch (err) {
          console.error("Camera access error:", err);
          if (camLoading) {
            camLoading.innerHTML = `
              <span style="color:#ef4444; display:block; margin-bottom:4px;">⚠️ ไม่สามารถเปิดกล้องได้</span>
              <small style="color:#94a3b8;">โปรดอนุญาตสิทธิ์กล้อง หรือกดปุ่ม <b>"เลือกรูปภาพ"</b> ด้านบน</small>
            `;
          }
        }
      };

      startCamera();

      btnCam.addEventListener('click', async () => {
        btnCam.style.background = '#2563eb';
        btnFile.style.background = '#4b5563';
        fileBox.style.display = 'none';
        camBox.style.display = 'flex';
        if (!isCamRunning) await startCamera();
      });

      btnFile.addEventListener('click', async () => {
        btnFile.style.background = '#2563eb';
        btnCam.style.background = '#4b5563';
        camBox.style.display = 'none';
        fileBox.style.display = 'block';
        if (isCamRunning) {
          try {
            await html5QrCode.stop();
            isCamRunning = false;
          } catch (e) {}
        }
      });

      document.getElementById('qr-file-input')?.addEventListener('change', async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const imageFile = e.target.files[0];
        try {
          const decodedText = await html5QrCode.scanFile(imageFile, true);
          Swal.close();
          executeSecureQrLogin(decodedText);
        } catch (err) {
          Swal.fire({
            icon: 'error',
            title: 'อ่าน QR Code ไม่สำเร็จ',
            text: 'ไม่พบ QR Code ในรูปภาพนี้ กรุณาลองใช้กล้องสแกนหรือเลือกรูปใหม่',
            confirmButtonColor: '#ef4444'
          });
        }
      });
    },
    willClose: () => {
      if (html5QrCode) {
        try {
          if (html5QrCode.isScanning) {
            html5QrCode.stop().catch(err => console.error(err));
          }
          html5QrCode.clear();
        } catch (e) {}
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

/* [DEPRECATED] toggleInstructions is now handled by SystemDiagnostics unified button */
