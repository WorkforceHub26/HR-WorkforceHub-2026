/**
 * ============================================================================
 * 📋 LEAVE RULES LOGIC & CONTROLLERS - PVT WORKFORCE HUB
 * ============================================================================
 */
function toggleMobileSidebar() {
  const sidebar = document.getElementById("sidebarMenu");
  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}
window.toggleMobileSidebar = toggleMobileSidebar;

document.addEventListener("DOMContentLoaded", () => {
  // Check if we need to show the mobile menu button
  const mobileBtn = document.getElementById("mobileMenuBtn");
  if (mobileBtn && window.innerWidth <= 1024) {
    mobileBtn.style.display = "block";
  }
  
  window.addEventListener("resize", () => {
    if (mobileBtn) {
      mobileBtn.style.display = window.innerWidth <= 1024 ? "block" : "none";
    }
  });

  if (typeof window.renderLeaveRulesCards === "function") {
    const lang = window.getGlobalLanguage ? window.getGlobalLanguage() : "th";
    window.renderLeaveRulesCards(lang);
  }
});

window.addEventListener("pvt-lang-changed", (e) => {
  const lang = (e.detail && e.detail.lang) || (window.getGlobalLanguage ? window.getGlobalLanguage() : "th");
  if (typeof window.renderLeaveRulesCards === "function") {
    window.renderLeaveRulesCards(lang);
  }
});
