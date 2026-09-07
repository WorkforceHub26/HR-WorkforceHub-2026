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
  function applySavedPreferences() {
    const savedFontSize = localStorage.getItem("pvt_user_font_size") || "normal";
    const savedTheme = localStorage.getItem("pvt_user_theme") || "teal";

    applyFontSizeToDoc(savedFontSize);
    applyThemeToDoc(savedTheme);
  }

  function applyFontSizeToDoc(sizeKey) {
    const root = document.documentElement;
    root.setAttribute("data-font-size", sizeKey);

    if (sizeKey === "large") {
      root.style.fontSize = "19px";
    } else if (sizeKey === "medium") {
      root.style.fontSize = "17.5px";
    } else {
      root.style.fontSize = "16px";
    }
  }

  function applyThemeToDoc(themeKey) {
    const theme = THEMES[themeKey] || THEMES.teal;
    const root = document.documentElement;

    root.style.setProperty("--primary", theme.primary);
    root.style.setProperty("--primary-dark", theme.primaryDark);
    root.style.setProperty("--primary-hover", theme.primaryHover);
    root.style.setProperty("--primary-soft", theme.primarySoft);
    root.style.setProperty("--primary-light", theme.primaryLight);
    root.style.setProperty("--primary-gradient", theme.gradient);
    root.setAttribute("data-theme", themeKey);

    // Update dynamically styled elements if present
    document.querySelectorAll(".sidebar-cta-btn").forEach(el => {
      el.style.background = theme.gradient;
    });
  }

  // Execute immediately
  applySavedPreferences();

  // Re-check after DOM is ready to ensure components pick it up
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applySavedPreferences);
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
              <h3 class="settings-modal-title" id="settingsModalTitle">การตั้งค่าระบบ (Settings)</h3>
              <p class="settings-modal-subtitle">ปรับแต่งขนาดตัวอักษร ธีมสี และการเชื่อมต่อ LINE</p>
            </div>
          </div>
          <button type="button" class="settings-modal-close-btn" onclick="closeSystemSettingsModal()" title="ปิดหน้าต่าง">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="settings-modal-body">
          
          <!-- Card 1: ขนาดตัวอักษร -->
          <div class="setting-card-item">
            <div class="setting-item-head">
              <span class="setting-item-icon">🔤</span>
              <div class="setting-item-info">
                <h4>ขนาดตัวอักษรและการแสดงผล (Font Size)</h4>
                <p>เลือกขนาดข้อความที่เหมาะกับสายตาของคุณ เพื่อการอ่านที่สะดวกสบาย</p>
              </div>
            </div>

            <div class="font-size-options-grid">
              <button type="button" class="font-size-btn" id="fontBtnNormal" onclick="changeSystemFontSize('normal')">
                <span class="font-size-sample" style="font-size: 15px;">กขค</span>
                <span class="font-size-label">มาตรฐาน (100%)</span>
              </button>
              <button type="button" class="font-size-btn" id="fontBtnMedium" onclick="changeSystemFontSize('medium')">
                <span class="font-size-sample" style="font-size: 18px;">กขค</span>
                <span class="font-size-label">ปานกลาง (+12%)</span>
              </button>
              <button type="button" class="font-size-btn" id="fontBtnLarge" onclick="changeSystemFontSize('large')">
                <span class="font-size-sample" style="font-size: 21px;">กขค</span>
                <span class="font-size-label">ใหญ่พิเศษ (+25%)</span>
              </button>
            </div>

            <div class="font-preview-box" id="fontPreviewBox">
              <strong>ตัวอย่างการแสดงผล:</strong> ระบบยื่นใบลาและตรวจสอบสิทธิ์คงเหลือ ประจำปี พ.ศ. 2569 (PVT Workforce Hub)
            </div>
          </div>

          <!-- Card 2: ธีมสีของระบบ -->
          <div class="setting-card-item">
            <div class="setting-item-head">
              <span class="setting-item-icon">🎨</span>
              <div class="setting-item-info">
                <h4>ธีมและโทนสีของระบบ (Color Themes)</h4>
                <p>เปลี่ยนเฉดสีหลักของแอปพลิเคชันตามความชอบ</p>
              </div>
            </div>

            <div class="theme-options-grid" id="themeOptionsGrid">
              <!-- Rendered via JS -->
            </div>
          </div>

          <!-- Card 3: เชื่อมต่อ LINE -->
          <div class="setting-card-item">
            <div class="setting-item-head">
              <span class="setting-item-icon">💬</span>
              <div class="setting-item-info">
                <h4>การแจ้งเตือนผ่าน LINE (LINE Notification)</h4>
                <p>รับข้อความแจ้งเตือนผลการอนุมัติใบลาและสถานะคำขอตรงสู่มือถือ</p>
              </div>
            </div>

            <div class="line-status-banner">
              <div class="line-status-left">
                <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" alt="LINE" />
                <div class="line-status-text">
                  <h5 id="lineStatusTitle">สถานะ: กำลังตรวจสอบ...</h5>
                  <p id="lineStatusDesc">ผูกบัญชีเพื่อรับการแจ้งเตือนทันที</p>
                </div>
              </div>
              <button type="button" class="btn-line-cta" onclick="requestLineTokenFromSettings()">
                <span class="material-symbols-outlined" style="font-size: 18px;">link</span>
                ขอรหัสผูก LINE
              </button>
            </div>

            <div style="margin-top: 4px;">
              <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">
                หรือระบุ LINE User ID โดยตรง:
              </label>
              <div class="line-manual-box">
                <input type="text" id="settingsLineIdInput" class="line-manual-input" placeholder="เช่น U1234567890abcdef..." />
                <button type="button" class="line-manual-save-btn" onclick="saveLineIdFromSettings()">
                  บันทึก ID
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="settings-modal-footer">
          <button type="button" class="btn-settings-reset" onclick="resetSystemSettingsToDefault()">
            <span class="material-symbols-outlined" style="font-size: 16px; vertical-align: middle;">restart_alt</span>
            รีเซ็ตเป็นค่าเริ่มต้น
          </button>
          <button type="button" class="btn-settings-done" onclick="closeSystemSettingsModal()">
            เรียบร้อย
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
    const backdrop = ensureSettingsModalInDom();
    populateThemeButtons();
    updateFontSizeButtonsUI();
    updateLineStatusUI();

    backdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  };

  // ❌ 4. Close Modal Handler
  window.closeSystemSettingsModal = function() {
    const backdrop = document.getElementById("systemSettingsModal");
    if (backdrop) {
      backdrop.classList.remove("active");
    }
    document.body.style.overflow = "";
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
  };

  // 💬 7. LINE Notification Status & Actions
  function updateLineStatusUI() {
    const titleEl = document.getElementById("lineStatusTitle");
    const descEl = document.getElementById("lineStatusDesc");
    const inputEl = document.getElementById("settingsLineIdInput");

    const emp = window.currentProfile || window.currentEmpProfile;
    const lineId = emp?.line_id || "";

    if (inputEl) inputEl.value = lineId;

    if (lineId) {
      if (titleEl) {
        titleEl.textContent = "● เชื่อมต่อ LINE แล้ว";
        titleEl.style.color = "#15803d";
      }
      if (descEl) {
        descEl.textContent = `User ID: ${lineId.substring(0, 8)}... (รับแจ้งเตือนปกติ)`;
        descEl.style.color = "#166534";
      }
    } else {
      if (titleEl) {
        titleEl.textContent = "○ ยังไม่ได้ผูกบัญชี LINE";
        titleEl.style.color = "#d97706";
      }
      if (descEl) {
        descEl.textContent = "คลิกเพื่อขอรหัสเชื่อมต่อรับแจ้งเตือนใบลา";
        descEl.style.color = "#b45309";
      }
    }
  }

  window.requestLineTokenFromSettings = function() {
    if (typeof window.generateLineLinkToken === "function") {
      closeSystemSettingsModal();
      window.generateLineLinkToken();
    } else {
      window.location.href = "/pages/user/index-user.html?action=line_link";
    }
  };

  window.saveLineIdFromSettings = async function() {
    const inputEl = document.getElementById("settingsLineIdInput");
    const newLineId = inputEl ? inputEl.value.trim() : "";
    const emp = window.currentProfile || window.currentEmpProfile;

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
    localStorage.removeItem("pvt_user_theme");

    applyFontSizeToDoc("normal");
    applyThemeToDoc("teal");

    updateFontSizeButtonsUI();
    populateThemeButtons();

    const preview = document.getElementById("fontPreviewBox");
    if (preview) preview.style.fontSize = "13px";

    if (window.Swal) {
      Swal.fire({
        icon: "info",
        title: "รีเซ็ตค่าเริ่มต้นเรียบร้อย",
        text: "ขนาดตัวอักษรและธีมสีกลับเป็นค่ามาตรฐานแล้ว",
        timer: 1500,
        showConfirmButton: false
      });
    }
  };

  // 🌟 9. Open Admin Dashboard Modal
  window.openAdminDashboardModal = function() {
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
