/**
 * ==========================================================================
 * ⚙️ PVT WORKFORCE HUB - SYSTEM SETTINGS CONTROLLER (การตั้งค่าระบบ)
 * ==========================================================================
 * รองรับ:
 * 1. ขยาย/ปรับขนาดข้อความ (Font Scaling) - ปกติ, ปานกลาง, ใหญ่พิเศษ
 * 2. เปลี่ยนโทนสีธีมระบบ (Color Themes) - มินต์, โอเชียน, อินดิโก้, เอเมอรัลด์, ซันเซ็ท
 * 3. เชื่อมต่อ LINE แจ้งเตือน (LINE Link Token / LINE ID)
 * 4. บันทึกค่าลง localStorage เพื่อคงสภาพการตั้งค่าทุกหน้าอัตโนมัติ
 */

(function() {
  const THEMES = {
    teal: {
      name: "มินต์เทอร์ควอยซ์",
      desc: "สดใส คลาสสิก",
      primary: "#0d9488",
      primaryDark: "#0f766e",
      primaryHover: "#0f766e",
      primarySoft: "#f0fdfa",
      primaryLight: "#ccfbf1",
      gradient: "linear-gradient(135deg, #0d9488, #0891b2)",
      color: "#0d9488"
    },
    blue: {
      name: "น้ำเงินโอเชียน",
      desc: "สุภาพ มั่นคง",
      primary: "#0284c7",
      primaryDark: "#0369a1",
      primaryHover: "#0369a1",
      primarySoft: "#f0f9ff",
      primaryLight: "#bae6fd",
      gradient: "linear-gradient(135deg, #0284c7, #2563eb)",
      color: "#0284c7"
    },
    indigo: {
      name: "ม่วงรอยัล",
      desc: "ทันสมัย พรีเมียม",
      primary: "#6366f1",
      primaryDark: "#4f46e5",
      primaryHover: "#4f46e5",
      primarySoft: "#eef2ff",
      primaryLight: "#c7d2fe",
      gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
      color: "#6366f1"
    },
    emerald: {
      name: "เขียวฟอเรสต์",
      desc: "ธรรมชาติ สบายตา",
      primary: "#059669",
      primaryDark: "#047857",
      primaryHover: "#047857",
      primarySoft: "#ecfdf5",
      primaryLight: "#a7f3d0",
      gradient: "linear-gradient(135deg, #059669, #10b981)",
      color: "#059669"
    },
    coral: {
      name: "ส้มซันเซ็ท",
      desc: "อบอุ่น มีพลัง",
      primary: "#ea580c",
      primaryDark: "#c2410c",
      primaryHover: "#c2410c",
      primarySoft: "#fff7ed",
      primaryLight: "#fed7aa",
      gradient: "linear-gradient(135deg, #ea580c, #e11d48)",
      color: "#ea580c"
    }
  };

  // 🚀 1. Immediate Application on script execution
  const NATIVE_LANGUAGE_NAMES = {
    'th': 'ไทย (Thai)',
    'en': 'English',
    'lo': 'ພາສາລາວ (Lao)',
    'my': 'မြန်မာစာ (Burmese)',
    'ja': '日本語 (Japanese)',
    'zh-CN': '简体中文 (Chinese)',
    'ko': '한국어 (Korean)'
  };

  function startNativeLanguageObserver() {
    if (window.nativeLanguageObserverStarted) return;
    window.nativeLanguageObserverStarted = true;

    setInterval(() => {
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        // Change default option text (usually "เลือกภาษา" or "Select Language")
        const firstOption = combo.options[0];
        if (firstOption && firstOption.value === "" && firstOption.textContent !== "เลือกภาษา / Select Language") {
          firstOption.textContent = "เลือกภาษา / Select Language";
        }

        const options = combo.querySelectorAll('option');
        options.forEach(option => {
          const val = option.value;
          if (NATIVE_LANGUAGE_NAMES[val] && option.textContent !== NATIVE_LANGUAGE_NAMES[val]) {
            option.textContent = NATIVE_LANGUAGE_NAMES[val];
          }
        });
      }
    }, 300);
  }

  function startGoogleBannerKiller() {
    if (window.googleBannerKillerStarted) return;
    window.googleBannerKillerStarted = true;

    const selectors = [
      'body > .skiptranslate',
      'body > div.skiptranslate',
      'body > iframe.skiptranslate',
      'iframe.goog-te-banner-frame',
      'iframe.goog-te-banner-frame-escaped',
      'iframe[src*="translate.google.com"]',
      'iframe[id*="google_translate"]',
      'iframe[id*=":1.container"]',
      'iframe[id*=":2.container"]',
      'iframe[id*=":0.container"]',
      'iframe[class*="goog-te-banner-frame"]',
      '.goog-te-banner-frame',
      '.goog-te-banner',
      '#goog-gt-tt',
      '.goog-te-balloon-frame',
      '.goog-te-banner-frame-escaped',
      '.VIpgJd-ZVi9od-ORHb-OEVmcd',
      '.VIpgJd-ZVi9od-aZ2wEe-wOHMyf',
      '.VIpgJd-ZVi9od-xl07Ob-OEVmcd',
      '.goog-te-menu-frame',
      'iframe.goog-te-menu-frame',
      'div[id*="goog-gt-"]'
    ];

    const killBanners = () => {
      try {
        selectors.forEach(sel => {
          const els = document.querySelectorAll(sel);
          els.forEach(el => {
            // Keep the clean widget inside settings modal visible
            if (el.closest && (el.closest('#google_translate_element_visible') || el.closest('#systemSettingsModal') || el.closest('#google_translate_element_hidden'))) {
              return;
            }
            if (el.style.display !== 'none' || el.style.visibility !== 'hidden' || el.style.height !== '0px') {
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
              el.style.setProperty('opacity', '0', 'important');
              el.style.setProperty('height', '0px', 'important');
              el.style.setProperty('width', '0px', 'important');
              el.style.setProperty('max-height', '0px', 'important');
              el.style.setProperty('pointer-events', 'none', 'important');
              el.style.setProperty('position', 'absolute', 'important');
              el.style.setProperty('top', '-99999px', 'important');
              el.style.setProperty('left', '-99999px', 'important');
            }
          });
        });

        if (typeof window.protectIconsFromTranslation === 'function') {
          window.protectIconsFromTranslation(document.body);
        }

        if (document.body) {
          if (document.body.style.top && document.body.style.top !== '0px') {
            document.body.style.setProperty('top', '0px', 'important');
          }
          if (document.body.style.marginTop && document.body.style.marginTop !== '0px') {
            document.body.style.setProperty('margin-top', '0px', 'important');
          }
        }
        if (document.documentElement) {
          if (document.documentElement.style.top && document.documentElement.style.top !== '0px') {
            document.documentElement.style.setProperty('top', '0px', 'important');
          }
          if (document.documentElement.style.marginTop && document.documentElement.style.marginTop !== '0px') {
            document.documentElement.style.setProperty('margin-top', '0px', 'important');
          }
        }
      } catch (e) {
        // silent
      }
    };

    // Run immediately
    killBanners();

    // Fast polling
    setInterval(killBanners, 150);

    // Instant DOM observer
    if (window.MutationObserver) {
      const observer = new MutationObserver(() => {
        killBanners();
      });
      if (document.documentElement) {
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }
    }
  }

  function applySavedPreferences() {
    startGoogleBannerKiller();
    // Google Translate: โหลดเฉพาะเมื่อผู้ใช้เคยเลือกแปลภาษา (มีคุกกี้ googtrans)
    // ถ้ายังไม่เคยใช้ จะโหลดตอนเปิดหน้าต่างตั้งค่า (ensureGoogleTranslateLoaded) — เดิมโหลดทุกหน้า ทำให้หน้าช้า
    if (/(^|;\s*)googtrans=/.test(document.cookie)) ensureGoogleTranslateLoaded();

    startNativeLanguageObserver();

    applyAllSavedSettings();
  }

  function ensureGoogleTranslateLoaded() {
    if (!document.getElementById('google_translate_element_hidden') && document.body) {
      const div = document.createElement('div');
      div.id = 'google_translate_element_hidden';
      div.style.display = 'none';
      document.body.appendChild(div);
      
      window.googleTranslateElementInit = function() {
        new google.translate.TranslateElement({
          pageLanguage: 'th',
          includedLanguages: 'en,lo,my,th,zh-CN,ja,ko',
          autoDisplay: false
        }, 'google_translate_element_hidden');
        // ถ้าหน้าต่างตั้งค่าเปิดอยู่ ย้ายตัวเลือกภาษาไปแสดงในหน้าต่างทันที
        setTimeout(moveTranslateWidgetIntoModal, 200);
      };
      
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      document.head.appendChild(script);
    }
  }

  // ให้ auth-guard.js (ปุ่ม TH/EN ในหน้าอื่น) สั่งโหลดตัวแปลภาษาได้เมื่อผู้ใช้เลือกภาษาอื่น
  window.pvtEnsureGoogleTranslate = ensureGoogleTranslateLoaded;

  function moveTranslateWidgetIntoModal() {
    const source = document.getElementById('google_translate_element_hidden');
    const target = document.getElementById('google_translate_element_visible');
    const modal = document.getElementById('systemSettingsModal');
    if (!source || !target || !modal || !modal.classList.contains('active')) return;
    const widget = source.querySelector('.skiptranslate');
    if (widget) target.appendChild(widget);
  }

  function applyAllSavedSettings() {
    const savedFontSize = localStorage.getItem("pvt_user_font_size") || "normal";
    const savedTheme = localStorage.getItem("pvt_user_theme") || "teal";
    const savedCompact = localStorage.getItem("pvt_compact_mode") === "true";
    const savedEyeCare = localStorage.getItem("pvt_eyecare_mode") === "true";
    const savedPrivacy = localStorage.getItem("pvt_privacy_shield") === "true";
    const savedMotion = localStorage.getItem("pvt_reduced_motion") === "true";
    const savedContrast = localStorage.getItem("pvt_high_contrast") === "true";

    applyFontSizeToDoc(savedFontSize);
    applyThemeToDoc(savedTheme);
    applyCompactModeToDoc(savedCompact);
    applyEyeCareToDoc(savedEyeCare);
    applyPrivacyShieldToDoc(savedPrivacy);
    applyReducedMotionToDoc(savedMotion);
    applyHighContrastToDoc(savedContrast);
    initAutoRefreshTimer();
  }

  function applyCompactModeToDoc(enabled) {
    const root = document.documentElement;
    if (enabled) {
      root.setAttribute("data-compact-mode", "true");
      document.body?.classList?.add("compact-mode");
    } else {
      root.removeAttribute("data-compact-mode");
      document.body?.classList?.remove("compact-mode");
    }
  }

  function applyEyeCareToDoc(enabled) {
    const root = document.documentElement;
    if (enabled) {
      root.setAttribute("data-eyecare-mode", "true");
    } else {
      root.removeAttribute("data-eyecare-mode");
    }
  }

  function applyPrivacyShieldToDoc(enabled) {
    const root = document.documentElement;
    if (enabled) {
      root.setAttribute("data-privacy-shield", "true");
    } else {
      root.removeAttribute("data-privacy-shield");
    }
  }

  function applyReducedMotionToDoc(enabled) {
    const root = document.documentElement;
    if (enabled) {
      root.setAttribute("data-reduced-motion", "true");
    } else {
      root.removeAttribute("data-reduced-motion");
    }
  }

  function applyHighContrastToDoc(enabled) {
    const root = document.documentElement;
    if (enabled) {
      root.setAttribute("data-high-contrast", "true");
    } else {
      root.removeAttribute("data-high-contrast");
    }
  }

  // Auto-refresh interval initialization
  let globalRefreshIntervalId = null;
  function initAutoRefreshTimer() {
    if (globalRefreshIntervalId) {
      clearInterval(globalRefreshIntervalId);
      globalRefreshIntervalId = null;
    }
    const val = localStorage.getItem("pvt_auto_refresh") || "off";
    if (val === "off") return;
    
    const seconds = parseInt(val, 10);
    if (isNaN(seconds)) return;

    globalRefreshIntervalId = setInterval(() => {
      // ไม่รีเฟรชตอนแอปอยู่เบื้องหลัง / มีหน้าต่างหรือป๊อปอัปเปิดอยู่ / กำลังพิมพ์ในช่องกรอก
      if (document.hidden) return;
      if (document.querySelector('#systemSettingsModal.active, .pvt-modal-overlay.active, #pvtDrawer.is-open')) return;
      if (window.Swal && typeof window.Swal.isVisible === 'function' && window.Swal.isVisible()) return;
      const ae = document.activeElement;
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;

      // เดิมเรียกฟังก์ชันที่ไม่มีอยู่จริง (reloadLeavesTable / loadLeaveHistory / fetchPendingRequests / loadPendingLeaves)
      // → ระบบอัปเดตอัตโนมัติไม่เคยทำงาน ตอนนี้ใช้ฟังก์ชันโหลดข้อมูลแบบเงียบของแต่ละหน้า
      if (typeof window.loadMyLeaveHistory === "function") {          // ประวัติการลา
        window.loadMyLeaveHistory();
      } else if (typeof window.loadPendingLeavesHR === "function") {  // อนุมัติใบลา (หัวหน้า / HR)
        window.loadPendingLeavesHR();
      } else if (typeof window.loadRecentLeaves === "function" && window.currentProfile) { // หน้าหลักพนักงาน
        window.loadRecentLeaves(window.currentProfile);
      }
    }, seconds * 1000);
  }

  // 🔔 Web Audio Synthesized Sound Effects (100% Real client-side audio!)
  window.playSystemChime = function(type = "click") {
    const savedSound = localStorage.getItem("pvt_sound_enabled") !== "false";
    if (!savedSound) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      if (type === "success") {
        // High-quality bright triple-tone confirmation chord
        const playTone = (freq, start, duration) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.06, start);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + duration);
        };
        playTone(523.25, ctx.currentTime, 0.4); // C5
        playTone(659.25, ctx.currentTime + 0.1, 0.4); // E5
        playTone(783.99, ctx.currentTime + 0.2, 0.5); // G5
      } else if (type === "toggle_on") {
        // Soft positive high blip
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "toggle_off") {
        // Gentle descending click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else {
        // Modern UI bubble click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (err) {
      console.warn("Audio not initialized or allowed", err);
    }
  };

  function applyFontSizeToDoc(sizeKey) {
    const root = document.documentElement;
    root.setAttribute("data-font-size", sizeKey);

    // ขนาดจริงคุมด้วย CSS (zoom ที่เนื้อหา ใน system-settings.css)
    // เดิมตั้ง font-size ที่ <html> ด้วย ทำให้ขยายซ้อนกับ CSS
    root.style.removeProperty("font-size");
  }

  function applyThemeToDoc(themeKey) {
    const theme = THEMES[themeKey] || THEMES.teal;
    const root = document.documentElement;

    // ชุดสีทั้งระบบ (--th-p/s/b/k-*) มาจาก /js/theme-boot.js
    if (window.PVTTheme && typeof window.PVTTheme.apply === "function") {
      window.PVTTheme.apply(themeKey);
    } else {
      root.style.setProperty("--primary", theme.primary);
      root.style.setProperty("--primary-dark", theme.primaryDark);
      root.style.setProperty("--primary-hover", theme.primaryHover);
      root.style.setProperty("--primary-soft", theme.primarySoft);
      root.style.setProperty("--primary-light", theme.primaryLight);
      root.style.setProperty("--primary-gradient", theme.gradient);
      root.setAttribute("data-theme", THEMES[themeKey] ? themeKey : "teal");
      // หน้าที่ยังไม่มี theme-boot.js → โหลดเพิ่มเพื่อให้สีทั้งหน้าเปลี่ยนตาม
      if (!document.getElementById("pvt-theme-boot")) {
        const sc = document.createElement("script");
        sc.id = "pvt-theme-boot";
        sc.src = "/js/theme-boot.js";
        document.head.appendChild(sc);
      }
    }

    // Update dynamically styled elements if present
    document.querySelectorAll(".sidebar-cta-btn").forEach(el => {
      el.style.background = "var(--primary-gradient)";
    });
  }

  // Execute immediately
  applySavedPreferences();

  // Re-check after DOM is ready to ensure components pick it up
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applySavedPreferences);
  }

  // หน้า HR บางหน้า / สถิติวันลา ไม่ได้โหลด system-settings.css → หน้าต่างตั้งค่าไม่มีสไตล์
  function hasSettingsStyles() {
    const scan = (sheet, depth) => {
      if (!sheet || depth > 3) return false;
      let rules;
      try { rules = sheet.cssRules; } catch (e) { return false; }
      if (!rules) return false;
      for (let i = 0; i < rules.length; i++) {
        const r = rules[i];
        if (r.styleSheet && scan(r.styleSheet, depth + 1)) return true;           // @import
        if (r.selectorText && r.selectorText.indexOf('.settings-modal-backdrop') !== -1) return true;
      }
      return false;
    };
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (scan(document.styleSheets[i], 0)) return true;
    }
    return false;
  }

  function ensureSettingsStyles() {
    if (document.getElementById('pvt-settings-css') || hasSettingsStyles()) return;
    const link = document.createElement('link');
    link.id = 'pvt-settings-css';
    link.rel = 'stylesheet';
    link.href = '/css/system-settings.css';
    document.head.appendChild(link);
  }

  // 🪟 2. Modal HTML Builder & Injector
  function ensureSettingsModalInDom() {
    let backdrop = document.getElementById("systemSettingsModal");
    if (backdrop) return backdrop;

    backdrop = document.createElement("div");
    backdrop.id = "systemSettingsModal";
    backdrop.className = "settings-modal-backdrop";
    backdrop.innerHTML = `
      <div class="settings-modal-box" role="dialog" aria-modal="true" aria-labelledby="settingsModalTitle">

        <!-- Header -->
        <div class="settings-modal-header">
          <div class="settings-header-title-wrap">
            <div class="settings-header-icon">
              <span class="material-symbols-outlined">settings</span>
            </div>
            <div>
              <h3 class="settings-modal-title" id="settingsModalTitle">ตั้งค่า</h3>
              <p class="settings-modal-subtitle">เปลี่ยนแล้วมีผลทันที · บันทึกไว้ในเครื่องนี้</p>
            </div>
          </div>
          <button type="button" class="settings-modal-close-btn" onclick="closeSystemSettingsModal()" title="ปิดหน้าต่าง" aria-label="ปิด">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Body: เมนูหมวด (ซ้าย) + เนื้อหา (ขวา) -->
        <div class="settings-modal-body">

          <nav class="settings-nav" role="tablist" aria-label="หมวดการตั้งค่า">
            <button type="button" class="settings-nav-btn" role="tab" data-tab="display" onclick="switchSettingsTab('display')">
              <span class="material-symbols-outlined">palette</span><span>การแสดงผล</span>
            </button>
            <button type="button" class="settings-nav-btn" role="tab" data-tab="language" onclick="switchSettingsTab('language')">
              <span class="material-symbols-outlined">language</span><span>ภาษา</span>
            </button>
            <button type="button" class="settings-nav-btn" role="tab" data-tab="notify" onclick="switchSettingsTab('notify')">
              <span class="material-symbols-outlined">notifications</span><span>การแจ้งเตือน</span>
            </button>
            <button type="button" class="settings-nav-btn" role="tab" data-tab="privacy" onclick="switchSettingsTab('privacy')">
              <span class="material-symbols-outlined">shield_person</span><span>ความเป็นส่วนตัว</span>
            </button>
            <!-- แสดงเฉพาะ Admin (ควบคุมใน openSystemSettingsModal) -->
            <a href="/pages/hr/admin-dashboard.html" class="settings-nav-btn settings-nav-admin" id="settingsAdminCard" style="display: none;">
              <span class="material-symbols-outlined">admin_panel_settings</span><span>คอนโซลผู้ดูแล</span>
              <span class="material-symbols-outlined settings-nav-ext">open_in_new</span>
            </a>
          </nav>

          <div class="settings-panels">

            <!-- ========== หมวด: การแสดงผล ========== -->
            <section class="settings-panel" data-panel="display" role="tabpanel">
              <h3 class="settings-panel-title">การแสดงผล</h3>

              <div class="setting-card-item">
                <div class="setting-section-head">
                  <h4>ขนาดตัวอักษร</h4>
                  <p>ขยายข้อความทั้งหน้าให้อ่านง่ายขึ้น</p>
                </div>
                <div class="font-size-options-grid">
                  <button type="button" class="font-size-btn" id="fontBtnNormal" onclick="changeSystemFontSize('normal')">
                    <span class="font-size-sample" style="font-size: 16px;">ก</span>
                    <span class="font-size-label">ปกติ</span>
                  </button>
                  <button type="button" class="font-size-btn" id="fontBtnMedium" onclick="changeSystemFontSize('medium')">
                    <span class="font-size-sample" style="font-size: 20px;">ก</span>
                    <span class="font-size-label">ใหญ่</span>
                  </button>
                  <button type="button" class="font-size-btn" id="fontBtnLarge" onclick="changeSystemFontSize('large')">
                    <span class="font-size-sample" style="font-size: 24px;">ก</span>
                    <span class="font-size-label">ใหญ่มาก</span>
                  </button>
                </div>
              </div>

              <div class="setting-card-item">
                <div class="setting-section-head">
                  <h4>แบบอักษร</h4>
                  <p>เลือกแบบตัวหนังสือที่อ่านสบายตา</p>
                </div>
                <div id="fontFamilyOptions" class="font-family-list"></div>
                <div id="fontFamilyPreview" class="font-preview-box">
                  <span class="font-preview-label">ตัวอย่าง</span>
                  ใบลาพักร้อน 2 วัน (28–29 ธ.ค. 2569) · คงเหลือ 4 วัน · อนุมัติแล้ว
                </div>
              </div>

              <div class="setting-card-item">
                <div class="setting-section-head">
                  <h4>สีของระบบ</h4>
                  <p>สีหลักของปุ่มและเมนู</p>
                </div>
                <div class="theme-options-grid" id="themeOptionsGrid"></div>
              </div>

              <div class="setting-card-item setting-list">
                <label class="setting-toggle-row" for="settingsEyeCareToggle">
                  <div class="setting-toggle-info">
                    <h5>ถนอมสายตา</h5>
                    <p>ปรับหน้าจอให้โทนอุ่นขึ้นเล็กน้อย เหมาะกับการใช้ตอนกลางคืน</p>
                  </div>
                  <span class="setting-switch">
                    <input type="checkbox" id="settingsEyeCareToggle" onchange="toggleSystemEyeCare(this.checked)">
                    <span class="setting-slider"></span>
                  </span>
                </label>
                <label class="setting-toggle-row" for="settingsHighContrastToggle">
                  <div class="setting-toggle-info">
                    <h5>ตัวหนังสือเข้มชัด</h5>
                    <p>ทำตัวอักษรหนาและเข้มขึ้น เส้นขอบชัดขึ้น</p>
                  </div>
                  <span class="setting-switch">
                    <input type="checkbox" id="settingsHighContrastToggle" onchange="toggleSystemHighContrast(this.checked)">
                    <span class="setting-slider"></span>
                  </span>
                </label>
                <label class="setting-toggle-row" for="settingsCompactToggle">
                  <div class="setting-toggle-info">
                    <h5>ตารางแบบกระชับ</h5>
                    <p>ลดช่องว่างในตาราง เพื่อเห็นข้อมูลได้มากขึ้นในหน้าเดียว</p>
                  </div>
                  <span class="setting-switch">
                    <input type="checkbox" id="settingsCompactToggle" onchange="toggleSystemCompactMode(this.checked)">
                    <span class="setting-slider"></span>
                  </span>
                </label>
              </div>
            </section>

            <!-- ========== หมวด: ภาษา ========== -->
            <section class="settings-panel" data-panel="language" role="tabpanel">
              <h3 class="settings-panel-title">ภาษา</h3>

              <div class="setting-card-item">
                <div class="setting-section-head">
                  <h4>ภาษาของระบบ</h4>
                  <p>ใช้กับเมนูและแบบฟอร์มทั้งหมด</p>
                </div>
                <div class="lang-options-grid lang-main-grid">
                  <button type="button" class="lang-pills-btn" id="langBtnTh" onclick="changeSystemLanguage('th')">
                    <span class="lang-code">TH</span><span>ภาษาไทย</span>
                  </button>
                  <button type="button" class="lang-pills-btn" id="langBtnLo" onclick="changeSystemLanguage('lo')">
                    <span class="lang-code">LA</span><span>ພາສາລາວ</span>
                  </button>
                  <button type="button" class="lang-pills-btn" id="langBtnMy" onclick="changeSystemLanguage('my')">
                    <span class="lang-code">MM</span><span>မြန်မာစာ</span>
                  </button>
                  <button type="button" class="lang-pills-btn" id="langBtnEn" onclick="changeSystemLanguage('en')">
                    <span class="lang-code">EN</span><span>English</span>
                  </button>
                </div>
              </div>

              <div class="setting-card-item magic-translate-card">
                <div class="setting-section-head">
                  <h4>ภาษาอื่น ๆ (แปลด้วย Google)</h4>
                  <p>ถ้าไม่มีภาษาที่ต้องการด้านบน ให้เลือกจากรายการนี้ ระบบจะแปลหน้าจอให้อัตโนมัติ</p>
                </div>
                <div id="google_translate_element_visible" class="translate-slot"></div>
                <p class="setting-hint">
                  <span class="material-symbols-outlined">info</span>
                  แนะนำให้ตั้ง "ภาษาของระบบ" เป็นภาษาไทยก่อนใช้ตัวแปลนี้
                </p>
              </div>
            </section>

            <!-- ========== หมวด: การแจ้งเตือน ========== -->
            <section class="settings-panel" data-panel="notify" role="tabpanel">
              <h3 class="settings-panel-title">การแจ้งเตือน</h3>

              <!-- LINE (แสดงเฉพาะผู้มีสิทธิ์ — ดู PVTLine ใน auth-guard.js) -->
              <div class="setting-card-item" data-line-entry>
                <div class="setting-section-head">
                  <h4>แจ้งเตือนผ่าน LINE</h4>
                  <p>รับผลการอนุมัติใบลาเข้า LINE บนมือถือ</p>
                </div>
                <div class="line-status-banner">
                  <div class="line-status-left">
                    <img src="/assets/icons/line.svg" alt="LINE" />
                    <div class="line-status-text">
                      <h5 id="lineStatusTitle">กำลังตรวจสอบ...</h5>
                      <p id="lineStatusDesc">ผูกบัญชีเพื่อรับการแจ้งเตือนทันที</p>
                    </div>
                  </div>
                  <button type="button" class="btn-line-cta" onclick="requestLineTokenFromSettings()">
                    <span class="material-symbols-outlined" style="font-size: 18px;">link</span>
                    เชื่อมต่อ LINE
                  </button>
                </div>
                <details class="line-advanced">
                  <summary>ใส่ LINE User ID เอง (สำหรับผู้ที่มีรหัสอยู่แล้ว)</summary>
                  <div class="line-manual-box">
                    <input type="text" id="settingsLineIdInput" class="line-manual-input" placeholder="เช่น U1234567890abcdef..." aria-label="LINE User ID" />
                    <button type="button" class="line-manual-save-btn" onclick="saveLineIdFromSettings()">บันทึก</button>
                  </div>
                </details>
              </div>

              <div class="setting-card-item setting-list">
                <label class="setting-toggle-row" for="settingsSoundToggle">
                  <div class="setting-toggle-info">
                    <h5>เสียงเมื่อกดปุ่ม</h5>
                    <p>มีเสียงสั้น ๆ เมื่อกดปุ่มหรือบันทึกสำเร็จ</p>
                  </div>
                  <span class="setting-switch">
                    <input type="checkbox" id="settingsSoundToggle" onchange="toggleSystemSound(this.checked)">
                    <span class="setting-slider"></span>
                  </span>
                </label>
              </div>

              <div class="setting-card-item">
                <div class="setting-section-head">
                  <h4>อัปเดตข้อมูลอัตโนมัติ</h4>
                  <p>ดึงคำขอและสถิติล่าสุดเองโดยไม่ต้องรีเฟรชหน้า</p>
                </div>
                <div class="lang-options-grid segmented">
                  <button type="button" class="lang-pills-btn" id="refreshBtnOff" onclick="changeAutoRefresh('off')">
                    <span>ปิด</span>
                  </button>
                  <button type="button" class="lang-pills-btn" id="refreshBtn30" onclick="changeAutoRefresh('30')">
                    <span>ทุก 30 วินาที</span>
                  </button>
                  <button type="button" class="lang-pills-btn" id="refreshBtn60" onclick="changeAutoRefresh('60')">
                    <span>ทุก 1 นาที</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- ========== หมวด: ความเป็นส่วนตัว ========== -->
            <section class="settings-panel" data-panel="privacy" role="tabpanel">
              <h3 class="settings-panel-title">ความเป็นส่วนตัวและการใช้งาน</h3>

              <div class="setting-card-item setting-list">
                <label class="setting-toggle-row" for="settingsPrivacyToggle">
                  <div class="setting-toggle-info">
                    <h5>ซ่อนตัวเลขสำคัญ</h5>
                    <p>เบลอจำนวนวันลาและข้อมูลส่วนตัว ชี้เมาส์หรือแตะค้างเพื่อดู</p>
                  </div>
                  <span class="setting-switch">
                    <input type="checkbox" id="settingsPrivacyToggle" onchange="toggleSystemPrivacyShield(this.checked)">
                    <span class="setting-slider"></span>
                  </span>
                </label>
                <label class="setting-toggle-row" for="settingsMotionToggle">
                  <div class="setting-toggle-info">
                    <h5>ลดภาพเคลื่อนไหว</h5>
                    <p>ปิดแอนิเมชัน ช่วยให้เครื่องเร็วขึ้นและประหยัดแบตเตอรี่</p>
                  </div>
                  <span class="setting-switch">
                    <input type="checkbox" id="settingsMotionToggle" onchange="toggleSystemReducedMotion(this.checked)">
                    <span class="setting-slider"></span>
                  </span>
                </label>
                <label class="setting-toggle-row" for="settingsConfirmToggle">
                  <div class="setting-toggle-info">
                    <h5>อนุมัติทันทีไม่ต้องยืนยัน <span class="setting-tag">สำหรับหัวหน้างาน</span></h5>
                    <p>กดอนุมัติแล้วบันทึกเลย ไม่มีหน้าต่างถามซ้ำ (ระวังกดพลาด)</p>
                  </div>
                  <span class="setting-switch">
                    <input type="checkbox" id="settingsConfirmToggle" onchange="toggleSystemDoubleConfirm(this.checked)">
                    <span class="setting-slider"></span>
                  </span>
                </label>
              </div>

              <div class="setting-card-item">
                <div class="setting-toggle-info">
                  <h5>ประกาศความเป็นส่วนตัว (PDPA)</h5>
                  <p>ระบบเก็บข้อมูลอะไร ใช้ทำอะไร ใครเห็นบ้าง และสิทธิ์ของคุณ · ดูวันที่คุณกดยอมรับ</p>
                </div>
                <button type="button" class="btn-settings-reset" style="margin-top:10px;" onclick="window.PVTPrivacy ? window.PVTPrivacy.view() : alert('ยังไม่มีประกาศความเป็นส่วนตัวในระบบ')">
                  <span class="material-symbols-outlined" aria-hidden="true">policy</span> อ่านประกาศความเป็นส่วนตัว
                </button>
              </div>
            </section>

          </div>
        </div>

        <!-- Footer -->
        <div class="settings-modal-footer">
          <button type="button" class="btn-settings-reset" onclick="resetSystemSettingsToDefault()">
            <span class="material-symbols-outlined">restart_alt</span>
            คืนค่าเริ่มต้น
          </button>
          <button type="button" class="btn-settings-done" onclick="closeSystemSettingsModal()">
            <span class="material-symbols-outlined">check</span>
            เสร็จสิ้น
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(backdrop);

    // Close on backdrop click
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        closeSystemSettingsModal();
      }
    });

    // Close on Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && backdrop.classList.contains("active")) {
        closeSystemSettingsModal();
      }
    });

    return backdrop;
  }

  // 🛠️ 3. Open Modal Handler
  window.openSystemSettingsModal = function() {
    ensureSettingsStyles();
    ensureGoogleTranslateLoaded();
    const backdrop = ensureSettingsModalInDom();
    populateThemeButtons();
    updateFontSizeButtonsUI();
    renderFontFamilyOptions();
    updateLineStatusUI();
    refreshLineIdFromDb();
    updateSoundSwitchUI();
    updateCompactSwitchUI();
    updateLanguageButtonsUI();
    updateEyeCareSwitchUI();
    updateAutoRefreshButtonsUI();
    updatePrivacySwitchUI();
    updateMotionSwitchUI();
    updateConfirmSwitchUI();
    updateHighContrastSwitchUI();

    // แสดงปุ่มคอนโซลผู้ดูแลระบบเฉพาะ Admin (ไม่แสดงเมื่ออยู่หน้าคอนโซลอยู่แล้ว)
    const adminCard = document.getElementById("settingsAdminCard");
    if (adminCard) {
      let isAdmin = false;
      try {
        const sess = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const emp = sess.employees || sess;
        const role = String(sess.role || emp.role || '').toLowerCase().trim();
        isAdmin = role === 'admin' || role === 'superadmin';
      } catch (e) {}
      adminCard.style.display = isAdmin && !location.pathname.includes('admin-dashboard') ? '' : 'none';
    }

    let lastTab = "display";
    try { lastTab = localStorage.getItem("pvt_settings_tab") || "display"; } catch (e) {}
    window.switchSettingsTab(lastTab, true);

    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    
    // Auto-close sidebar on mobile/desktop if it is open
    if (typeof window.closeMobileSidebar === 'function') {
      window.closeMobileSidebar();
    }
    
    // ย้ายตัวเลือกภาษาของ Google มาแสดงในหน้าต่าง (ถ้ายังโหลดไม่เสร็จ googleTranslateElementInit จะย้ายให้เอง)
    setTimeout(moveTranslateWidgetIntoModal, 300);

    if (window.playSystemChime) {
      window.playSystemChime("click");
    }
  };

  // 🗂️ 3.1 สลับหมวดการตั้งค่า (เมนูด้านซ้าย / แถบบนมือถือ)
  window.switchSettingsTab = function(key, silent) {
    const modal = document.getElementById("systemSettingsModal");
    if (!modal) return;
    if (!modal.querySelector(`.settings-panel[data-panel="${key}"]`)) key = "display";
    modal.querySelectorAll(".settings-nav-btn[data-tab]").forEach((btn) => {
      const on = btn.dataset.tab === key;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      if (on && btn.scrollIntoView) btn.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    modal.querySelectorAll(".settings-panel").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== key;
    });
    const panels = modal.querySelector(".settings-panels");
    if (panels) panels.scrollTop = 0;
    try { localStorage.setItem("pvt_settings_tab", key); } catch (e) {}
    if (key === "language") setTimeout(moveTranslateWidgetIntoModal, 50);
    if (!silent && window.playSystemChime) window.playSystemChime("click");
  };

  // ❌ 4. Close Modal Handler
  window.closeSystemSettingsModal = function() {
    const backdrop = document.getElementById("systemSettingsModal");
    if (backdrop) {
      backdrop.classList.remove("active");
    }
    document.body.style.overflow = "";
    if (window.playSystemChime) {
      window.playSystemChime("click");
    }
  };

  // 🔤 5. Font Size Functions
  window.changeSystemFontSize = function(sizeKey) {
    localStorage.setItem("pvt_user_font_size", sizeKey);
    applyFontSizeToDoc(sizeKey);
    updateFontSizeButtonsUI();

    // Visual feedback
    const preview = document.getElementById("fontPreviewBox");
    if (preview) {
      if (sizeKey === "large") {
        preview.style.fontSize = "17px";
      } else if (sizeKey === "medium") {
        preview.style.fontSize = "15px";
      } else {
        preview.style.fontSize = "13px";
      }
    }
    if (window.playSystemChime) {
      window.playSystemChime("click");
    }
  };

  // 🔤 5.1 แบบอักษร (js/theme-boot.js → window.PVTFont)
  const FONT_CHOICES = [
    { key: 'sarabun',  label: 'Sarabun',               desc: 'มีหัว · ค่าเริ่มต้น' },
    { key: 'notoloop', label: 'Noto Sans Thai Looped', desc: 'มีหัว · กลม ชัด ช่องไฟกว้าง' },
    { key: 'ibmloop',  label: 'IBM Plex Thai Looped',  desc: 'มีหัว · ทางการ ตัวเลขชัด' },
    { key: 'noto',     label: 'Noto Sans Thai',        desc: 'ไม่มีหัว · เรียบ อ่านง่าย' },
    { key: 'anuphan',  label: 'Anuphan',               desc: 'ไม่มีหัว · โปร่ง ทันสมัย' }
  ];
  function renderFontFamilyOptions() {
    const box = document.getElementById('fontFamilyOptions');
    if (!box) return;
    if (window.PVTFont && window.PVTFont.preload) window.PVTFont.preload();
    const current = localStorage.getItem('pvt_user_font') || 'sarabun';
    const famOf = (k) => (window.PVTFont && window.PVTFont.fonts[k] ? window.PVTFont.fonts[k].name : 'Sarabun');
    box.innerHTML = FONT_CHOICES.map((f) => {
      const on = f.key === current;
      return `<button type="button" class="font-family-btn${on ? ' active' : ''}" onclick="changeSystemFontFamily('${f.key}')" aria-pressed="${on}">
        <span class="font-family-sample" style="font-family:'${famOf(f.key)}', sans-serif !important;">กขค ใบลา 2569</span>
        <span class="font-family-name">${f.label}</span>
        <span class="font-family-desc">${f.desc}</span>
        ${on ? '<span class="material-symbols-outlined font-family-check">check_circle</span>' : ''}
      </button>`;
    }).join('');
    const prev = document.getElementById('fontFamilyPreview');
    if (prev) prev.style.setProperty('font-family', `'${famOf(current)}', sans-serif`, 'important');
  }
  window.changeSystemFontFamily = function (key) {
    localStorage.setItem('pvt_user_font', key);
    if (window.PVTFont) window.PVTFont.apply(key);
    renderFontFamilyOptions();
    if (window.playSystemChime) window.playSystemChime('click');
  };

  function updateFontSizeButtonsUI() {
    const current = localStorage.getItem("pvt_user_font_size") || "normal";
    ["normal", "medium", "large"].forEach(s => {
      const btn = document.getElementById(`fontBtn${s.charAt(0).toUpperCase() + s.slice(1)}`);
      if (btn) {
        if (s === current) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });
  }

  // 🎨 6. Theme Functions
  function populateThemeButtons() {
    const container = document.getElementById("themeOptionsGrid");
    if (!container) return;

    const currentTheme = localStorage.getItem("pvt_user_theme") || "teal";

    container.innerHTML = Object.entries(THEMES).map(([key, t]) => `
      <button type="button" class="theme-color-btn ${key === currentTheme ? 'active' : ''}" onclick="changeSystemTheme('${key}')">
        <span class="theme-swatch-circle" style="background: ${t.color};"></span>
        <div class="theme-info-wrap">
          <span class="theme-name">${t.name}</span>
          <span class="theme-desc">${t.desc}</span>
        </div>
      </button>
    `).join("");
  }

  window.changeSystemTheme = function(themeKey) {
    localStorage.setItem("pvt_user_theme", themeKey);
    applyThemeToDoc(themeKey);
    populateThemeButtons();
    if (window.playSystemChime) {
      window.playSystemChime("click");
    }
  };

  // 🌐 6.5. System Language Functions
  window.changeSystemLanguage = function(langKey) {
    const isNative = ['th', 'lo', 'my', 'en'].includes((langKey || "").toLowerCase());
    if (isNative && typeof window.purgeGoogleTranslate === "function") {
      window.purgeGoogleTranslate();
    }
    if (typeof window.setGlobalLanguage === "function") {
      window.setGlobalLanguage(langKey, false, { forceBroadcast: true });
      updateLanguageButtonsUI();
      if (window.playSystemChime) {
        window.playSystemChime("success");
      }
    } else {
      console.warn("setGlobalLanguage not found");
    }
  };

  function updateLanguageButtonsUI() {
    const currentLang = localStorage.getItem("pvt_login_lang") || localStorage.getItem("pvt_language") || "th";
    ["Th", "Lo", "My", "En"].forEach(l => {
      const btn = document.getElementById(`langBtn${l}`);
      if (btn) {
        if (l.toLowerCase() === currentLang.toLowerCase()) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });
  }

  // 🔔 6.6. Sound Settings Functions
  window.toggleSystemSound = function(enabled) {
    localStorage.setItem("pvt_sound_enabled", enabled ? "true" : "false");
    updateSoundSwitchUI();
    if (enabled && window.playSystemChime) {
      window.playSystemChime("toggle_on");
    } else if (window.playSystemChime) {
      // Just a small click before turning off completely
      window.playSystemChime("toggle_off");
    }
  };

  function updateSoundSwitchUI() {
    const isSoundEnabled = localStorage.getItem("pvt_sound_enabled") !== "false";
    const toggle = document.getElementById("settingsSoundToggle");
    if (toggle) {
      toggle.checked = isSoundEnabled;
    }
  }

  // 📐 6.7. Compact Table Layout Functions
  window.toggleSystemCompactMode = function(enabled) {
    localStorage.setItem("pvt_compact_mode", enabled ? "true" : "false");
    applyCompactModeToDoc(enabled);
    updateCompactSwitchUI();
    if (window.playSystemChime) {
      window.playSystemChime(enabled ? "toggle_on" : "toggle_off");
    }
  };

  function updateCompactSwitchUI() {
    const isCompactEnabled = localStorage.getItem("pvt_compact_mode") === "true";
    const toggle = document.getElementById("settingsCompactToggle");
    if (toggle) {
      toggle.checked = isCompactEnabled;
    }
  }

  // 👁️ 6.8. Eye-Care Filter Functions
  window.toggleSystemEyeCare = function(enabled) {
    localStorage.setItem("pvt_eyecare_mode", enabled ? "true" : "false");
    applyEyeCareToDoc(enabled);
    updateEyeCareSwitchUI();
    if (window.playSystemChime) {
      window.playSystemChime(enabled ? "toggle_on" : "toggle_off");
    }
  };

  window.updateEyeCareSwitchUI = function() {
    const isEyeCareEnabled = localStorage.getItem("pvt_eyecare_mode") === "true";
    const toggle = document.getElementById("settingsEyeCareToggle");
    if (toggle) {
      toggle.checked = isEyeCareEnabled;
    }
  };

  // 🔄 6.9. Auto-Refresh Functions
  window.changeAutoRefresh = function(val) {
    localStorage.setItem("pvt_auto_refresh", val);
    initAutoRefreshTimer();
    updateAutoRefreshButtonsUI();
    if (window.playSystemChime) {
      window.playSystemChime("success");
    }
  };

  window.updateAutoRefreshButtonsUI = function() {
    const currentVal = localStorage.getItem("pvt_auto_refresh") || "off";
    ["off", "30", "60"].forEach(v => {
      const id = v === "off" ? "refreshBtnOff" : `refreshBtn${v}`;
      const btn = document.getElementById(id);
      if (btn) {
        if (v === currentVal) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      }
    });
  };

  // 🛡️ 6.10. Privacy Shield Functions
  window.toggleSystemPrivacyShield = function(enabled) {
    localStorage.setItem("pvt_privacy_shield", enabled ? "true" : "false");
    applyPrivacyShieldToDoc(enabled);
    updatePrivacySwitchUI();
    if (window.playSystemChime) {
      window.playSystemChime(enabled ? "toggle_on" : "toggle_off");
    }
  };

  window.updatePrivacySwitchUI = function() {
    const isPrivacyEnabled = localStorage.getItem("pvt_privacy_shield") === "true";
    const toggle = document.getElementById("settingsPrivacyToggle");
    if (toggle) {
      toggle.checked = isPrivacyEnabled;
    }
  };

  // ⚡ 6.11. Reduced Motion Functions
  window.toggleSystemReducedMotion = function(enabled) {
    localStorage.setItem("pvt_reduced_motion", enabled ? "true" : "false");
    applyReducedMotionToDoc(enabled);
    updateMotionSwitchUI();
    if (window.playSystemChime) {
      window.playSystemChime(enabled ? "toggle_on" : "toggle_off");
    }
  };

  window.updateMotionSwitchUI = function() {
    const isMotionEnabled = localStorage.getItem("pvt_reduced_motion") === "true";
    const toggle = document.getElementById("settingsMotionToggle");
    if (toggle) {
      toggle.checked = isMotionEnabled;
    }
  };

  // 🤝 6.12. Double Confirm (Skip confirmation dialog if false, default to true)
  window.toggleSystemDoubleConfirm = function(enabled) {
    // Note: enabled means ONE-CLICK QUICK mode is ON, so double confirm is FALSE!
    localStorage.setItem("pvt_double_confirm", enabled ? "false" : "true");
    updateConfirmSwitchUI();
    if (window.playSystemChime) {
      window.playSystemChime(enabled ? "toggle_on" : "toggle_off");
    }
  };

  window.updateConfirmSwitchUI = function() {
    // checked = is One-click Quick Mode active (which is pvt_double_confirm === "false")
    const isQuickModeActive = localStorage.getItem("pvt_double_confirm") === "false";
    const toggle = document.getElementById("settingsConfirmToggle");
    if (toggle) {
      toggle.checked = isQuickModeActive;
    }
  };

  // 🌓 6.13. High Contrast Functions
  window.toggleSystemHighContrast = function(enabled) {
    localStorage.setItem("pvt_high_contrast", enabled ? "true" : "false");
    applyHighContrastToDoc(enabled);
    updateHighContrastSwitchUI();
    if (window.playSystemChime) {
      window.playSystemChime(enabled ? "toggle_on" : "toggle_off");
    }
  };

  window.updateHighContrastSwitchUI = function() {
    const isContrastEnabled = localStorage.getItem("pvt_high_contrast") === "true";
    const toggle = document.getElementById("settingsHighContrastToggle");
    if (toggle) {
      toggle.checked = isContrastEnabled;
    }
  };

  // 💬 7. LINE Notification Status & Actions
  // ผู้ใช้ปัจจุบัน: เดิมใช้ได้เฉพาะหน้าที่ตั้ง window.currentProfile ไว้ (หน้าอื่นบันทึก LINE ID ไม่ได้)
  function getSettingsEmployee() {
    const emp = window.currentProfile || window.currentEmpProfile;
    if (emp && emp.id) return emp;
    try {
      const u = JSON.parse(localStorage.getItem("currentUser") || "null");
      if (u && (u.id || u.employee_id)) {
        if (!window.__pvtSettingsEmp || window.__pvtSettingsEmp.id !== (u.id || u.employee_id)) {
          window.__pvtSettingsEmp = { ...u, id: u.id || u.employee_id };
        }
        return window.__pvtSettingsEmp;
      }
    } catch (e) {}
    return null;
  }

  // ดึงสถานะ LINE ล่าสุดจากฐานข้อมูล (ข้อมูลใน session อาจเก่า หรือไม่มี line_id)
  async function refreshLineIdFromDb() {
    const emp = getSettingsEmployee();
    const client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : null;
    if (!emp || !emp.id || !client) return;
    try {
      const { data, error } = await client.from("employees").select("line_id").eq("id", emp.id).maybeSingle();
      if (!error && data) {
        emp.line_id = data.line_id || "";
        updateLineStatusUI();
      }
    } catch (e) {}
  }

  function updateLineStatusUI() {
    const titleEl = document.getElementById("lineStatusTitle");
    const descEl = document.getElementById("lineStatusDesc");
    const inputEl = document.getElementById("settingsLineIdInput");

    const emp = getSettingsEmployee();
    const lineId = emp?.line_id || "";

    if (inputEl) inputEl.value = lineId;
    const bannerEl = document.querySelector("#systemSettingsModal .line-status-banner");
    if (bannerEl) bannerEl.classList.toggle("is-linked", !!lineId);

    if (lineId) {
      if (titleEl) {
        titleEl.textContent = "เชื่อมต่อ LINE แล้ว";
        titleEl.style.color = "#15803d";
      }
      if (descEl) {
        descEl.textContent = `User ID: ${lineId.substring(0, 8)}... (รับแจ้งเตือนปกติ)`;
        descEl.style.color = "#166534";
      }
    } else {
      if (titleEl) {
        titleEl.textContent = "ยังไม่ได้เชื่อมต่อ LINE";
        titleEl.style.color = "#d97706";
      }
      if (descEl) {
        descEl.textContent = "กด \"เชื่อมต่อ LINE\" เพื่อเริ่มรับแจ้งเตือน";
        descEl.style.color = "#b45309";
      }
    }
  }

  window.requestLineTokenFromSettings = async function() {
  if (window.PVTLine && !(await window.PVTLine.guard())) return;
    if (typeof window.generateLineLinkToken === "function") {
      closeSystemSettingsModal();
      window.generateLineLinkToken();
    } else {
      window.location.href = "/pages/user/index-user.html?action=line_link";
    }
  };

  window.saveLineIdFromSettings = async function() {
  if (window.PVTLine && !(await window.PVTLine.guard())) return;
    const inputEl = document.getElementById("settingsLineIdInput");
    const newLineId = inputEl ? inputEl.value.trim() : "";
    const emp = getSettingsEmployee();

    if (!emp || !emp.id) {
      if (window.Swal) {
        Swal.fire("แจ้งเตือน", "กรุณาเข้าสู่ระบบก่อนบันทึก LINE ID", "warning");
      } else {
        alert("กรุณาเข้าสู่ระบบก่อนบันทึก LINE ID");
      }
      return;
    }

    try {
      const client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabase || window.sb);
      if (!client) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");

      const { error } = await client
        .from("employees")
        .update({ line_id: newLineId || null })
        .eq("id", emp.id);

      if (error) throw error;

      emp.line_id = newLineId;
      updateLineStatusUI();

      if (window.Swal) {
        Swal.fire({
          icon: "success",
          title: "บันทึก LINE ID สำเร็จ!",
          text: newLineId ? "ระบบจะส่งข้อความแจ้งเตือนสถานะใบลาไปยัง LINE ของคุณ" : "ลบการเชื่อมต่อ LINE เรียบร้อย",
          confirmButtonColor: "var(--primary, #0d9488)"
        });
      } else {
        alert("บันทึก LINE ID สำเร็จ!");
      }
    } catch (err) {
      console.error("❌ Save LINE ID error:", err);
      if (window.Swal) {
        Swal.fire("เกิดข้อผิดพลาด", err.message || "ไม่สามารถบันทึกได้", "error");
      } else {
        alert("เกิดข้อผิดพลาดในการบันทึก LINE ID");
      }
    }
  };

  // 🔄 8. Reset Settings
  window.resetSystemSettingsToDefault = function() {
    localStorage.removeItem("pvt_user_font_size");
    localStorage.removeItem("pvt_user_font");
    if (window.PVTFont) window.PVTFont.apply('sarabun');
    localStorage.removeItem("pvt_user_theme");
    localStorage.removeItem("pvt_sound_enabled");
    localStorage.removeItem("pvt_compact_mode");
    localStorage.removeItem("pvt_eyecare_mode");
    localStorage.removeItem("pvt_auto_refresh");
    localStorage.removeItem("pvt_privacy_shield");
    localStorage.removeItem("pvt_reduced_motion");
    localStorage.removeItem("pvt_double_confirm");
    localStorage.removeItem("pvt_high_contrast");
    localStorage.setItem("pvt_login_lang", "th");
    localStorage.setItem("pvt_language", "th");

    applyFontSizeToDoc("normal");
    applyThemeToDoc("teal");
    applyCompactModeToDoc(false);
    applyEyeCareToDoc(false);
    applyPrivacyShieldToDoc(false);
    applyReducedMotionToDoc(false);
    applyHighContrastToDoc(false);
    initAutoRefreshTimer();
    if (typeof window.setGlobalLanguage === "function") {
      window.setGlobalLanguage("th", false, { forceBroadcast: true });
    }

    updateFontSizeButtonsUI();
    renderFontFamilyOptions();
    populateThemeButtons();
    updateSoundSwitchUI();
    updateCompactSwitchUI();
    updateLanguageButtonsUI();
    updateEyeCareSwitchUI();
    updateAutoRefreshButtonsUI();
    updatePrivacySwitchUI();
    updateMotionSwitchUI();
    updateConfirmSwitchUI();
    updateHighContrastSwitchUI();

    const preview = document.getElementById("fontPreviewBox");
    if (preview) preview.style.fontSize = "13px";

    if (window.playSystemChime) {
      window.playSystemChime("success");
    }

    if (window.Swal) {
      Swal.fire({
        icon: "info",
        title: "รีเซ็ตค่าเริ่มต้นเรียบร้อย",
        text: "คืนค่าขนาดตัวอักษร ธีมสี ภาษา ความเป็นส่วนตัว และโหมดการเข้าถึงทั้งหมดกลับเป็นค่ามาตรฐานแล้ว",
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  // 🌟 9. Open Admin Dashboard Modal
  window.openAdminDashboardModal = function() {
    const sessionStr = localStorage.getItem('currentUser');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const empObj = session?.employees || session || {};
    const rawRole = String(session?.role || empObj.role || '').toLowerCase().trim();
    const isTrueAdmin = rawRole === 'admin' || rawRole === 'superadmin' || session?.employee_code === 'HR-001' || empObj.employee_code === 'HR-001';

    if (!isTrueAdmin) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'ไม่มีสิทธิ์เข้าถึง',
          text: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าใช้งานหน้าคอนโซลแอดมินได้',
          confirmButtonColor: '#ef4444'
        });
      } else {
        alert('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถเข้าใช้งานหน้าคอนโซลแอดมินได้');
      }
      return;
    }

    let overlay = document.getElementById("adminDashboardModalOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "adminDashboardModalOverlay";
      overlay.className = "admin-modal-overlay";
      overlay.innerHTML = `
        <div class="admin-modal-content">
          <div class="admin-modal-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="brand-icon" style="width: 28px; height: 28px; min-width: 28px; min-height: 28px;">
                <span class="material-symbols-outlined" style="font-size: 18px;">analytics</span>
              </div>
              <div>
                <strong style="font-size: 14px; color: #0f172a;">PVT คอนโซลแอดมิน & แดชบอร์ดสถิติ</strong>
                <span style="font-size: 12px; color: #64748b; margin-left: 8px;">(โหมดป๊อปอัปสำหรับผู้ดูแลระบบ)</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <a href="/pages/hr/admin-dashboard.html" target="_blank" class="action-btn" style="padding: 6px 12px; font-size: 12px; text-decoration: none; border-radius: 8px; background: #f1f5f9; color: #334155; display: inline-flex; align-items: center; gap: 4px;" title="เปิดในแท็บใหม่">
                <span class="material-symbols-outlined" style="font-size: 16px;">open_in_new</span>
                <span>เปิดแท็บใหม่</span>
              </a>
              <button type="button" onclick="closeAdminDashboardModal()" style="background: #fee2e2; border: none; color: #ef4444; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;" title="ปิดหน้าต่าง">
                <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
              </button>
            </div>
          </div>
          <iframe src="/pages/hr/admin-dashboard.html" class="admin-modal-iframe" title="Admin Dashboard"></iframe>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    setTimeout(() => {
      overlay.classList.add("active");
    }, 10);
  };

  window.closeAdminDashboardModal = function() {
    const overlay = document.getElementById("adminDashboardModalOverlay");
    if (overlay) {
      overlay.classList.remove("active");
    }
  };

})();
