/**
 * 🔒 PVT HR - Security Auth Guard (Enterprise Edition with Safety Fallback)
 * Features: Anti-Flicker, Auto Safety Restore, Glassmorphism UI, Navigation Guard
 */
(function () {
  const docEl = document.documentElement;

  // 1. ซ่อน DOM ทันทีเพื่อป้องกันภาพวูบ (Anti-Flicker)
  docEl.style.visibility = 'hidden';

  // 🛡️ Safety Fallback: รับประกันว่าหน้าจอจะถูกแสดงผลเสมอภายใน 1.5 วินาที แม้เกิด JS Error
  const safetyTimer = setTimeout(() => {
    if (docEl.style.visibility === 'hidden') {
      docEl.style.visibility = 'visible';
      console.warn("⚠️ [Auth Guard]: Safety fallback triggered - restored visibility.");
    }
  }, 1500);

  function revealPage() {
    clearTimeout(safetyTimer);
    docEl.style.visibility = 'visible';
  }

  /**
   * 🎨 ฉีด CSS สไตล์กระจกเบลอ (Glassmorphism) เข้าไปใน <head>
   */
  function injectGuardStyles() {
    if (document.getElementById('pvt-guard-auto-style')) return;

    const style = document.createElement('style');
    style.id = 'pvt-guard-auto-style';
    style.innerHTML = `
      .swal2-container {
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        background-color: rgba(15, 23, 42, 0.5) !important;
      }
      .pvt-guard-popup {
        border-radius: 24px !important;
        background: rgba(255, 255, 255, 0.88) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(255, 255, 255, 0.8) !important;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
        padding: 24px !important;
        font-family: 'Sarabun', sans-serif !important;
      }
      .pvt-guard-popup .swal2-confirm {
        border-radius: 12px !important;
        padding: 12px 24px !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        box-shadow: 0 4px 14px rgba(6, 182, 212, 0.4) !important;
      }
      body > *:not(.swal2-container) {
        filter: blur(16px) brightness(0.85) !important;
        pointer-events: none !important;
        user-select: none !important;
        transition: filter 0.3s ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  function getValidSession() {
    try {
      const rawData = localStorage.getItem("currentUser") || sessionStorage.getItem("currentUser");
      if (!rawData) return null;

      const parsed = JSON.parse(rawData);
      if (typeof parsed !== 'object' || parsed === null) return null;

      if (parsed.expireAt && Date.now() > parsed.expireAt) {
        console.warn("🔒 [Auth Guard]: เซสชันหมดอายุแล้ว");
        clearAllSession();
        return null;
      }
      return parsed;
    } catch (e) {
      console.error("🔒 [Auth Guard]: ข้อมูล Session เสียหาย ล้างค่าเพื่อความปลอดภัย", e);
      clearAllSession();
      return null;
    }
  }

  function clearAllSession() {
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("currentUser");
  }

  function isPublicPage() {
    const path = window.location.pathname.toLowerCase();
    const publicPages = ['/index.html', '/login.html', '/pages/index.html', '/pages/login.html'];
    return publicPages.some(page => path.endsWith(page)) || path === '/' || path === '';
  }

  // 2. ตรวจสอบสิทธิ์การเข้าใช้งาน
  const currentUser = getValidSession();
  const isPublic = isPublicPage();

  if (!currentUser && !isPublic) {
    const showAccessDeniedUI = () => {
      injectGuardStyles();
      revealPage();

      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: '<span style="color: #0f172a; font-size: 20px; font-weight: 700;">⛔ ปฏิเสธการเข้าถึง</span>',
          html: `
            <div style="font-family: 'Sarabun', sans-serif; text-align: center; color: #475569; padding: 10px 0;">
              <p style="font-size: 15px; margin-bottom: 6px; font-weight: 600; color: #1e293b;">กรุณาเข้าสู่ระบบก่อนใช้งานระบบ</p>
              <p style="font-size: 13px; color: #64748b; margin: 0;">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ หรือเซสชันการใช้งานของคุณหมดอายุ</p>
            </div>
          `,
          icon: 'error',
          iconColor: '#ef4444',
          confirmButtonText: '🔑 ไปหน้าเข้าสู่ระบบ',
          confirmButtonColor: '#06b6d4',
          allowOutsideClick: false,
          allowEscapeKey: false,
          customClass: { popup: 'pvt-guard-popup' }
        }).then(() => {
          window.location.href = "/pages/index.html";
        });
      } else {
        alert("⛔ กรุณาเข้าสู่ระบบก่อนใช้งานระบบ");
        window.location.href = "/pages/index.html";
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener("DOMContentLoaded", showAccessDeniedUI);
    } else {
      showAccessDeniedUI();
    }
  } else {
    revealPage();
  }
})();

// 🧭 Smart Navigation Guard
document.addEventListener("click", function (e) {
  const link = e.target.closest("a, button[data-nav-guard]");
  if (!link) return;

  const targetUrl = link.href || link.getAttribute("data-href");
  if (!targetUrl) return;

  const isSamePageAnchor = targetUrl.includes("#") || targetUrl.startsWith("javascript:");
  const isNewTab = link.target === "_blank";
  const isSamePath = link.pathname === window.location.pathname && link.search === window.location.search;

  if (isSamePageAnchor || isNewTab || isSamePath) return;

  if (link.hasAttribute("data-confirm-nav") || document.body.classList.contains("form-dirty")) {
    e.preventDefault();

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: '🔒 ยืนยันการออกจากหน้านี้?',
        text: 'ข้อมูลที่คุณกำลังทำอยู่อาจยังไม่ได้ถูกบันทึก ต้องการออกจากหน้านี้หรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'ออกจากหน้านี้',
        cancelButtonText: 'ทำงานต่อในหน้านี้',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        customClass: { popup: 'pvt-guard-popup' }
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = targetUrl;
        }
      });
    } else {
      if (confirm("คุณกำลังจะออกจากหน้านี้ ต้องการดำเนินการต่อหรือไม่?")) {
        window.location.href = targetUrl;
      }
    }
  }
});