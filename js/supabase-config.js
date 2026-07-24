// ============================================================================
// 🧠 PVT SUPABASE - CORE CONFIG & ENGINE
// ============================================================================

const PVT_SUPABASE_URL = "https://pgogmhqjdchakcytsomx.supabase.co";
const PVT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

// ส่งออกตัวแปรไปที่ window เพื่อความปลอดภัย
window.PVT_SUPABASE_URL = PVT_SUPABASE_URL;
window.PVT_SUPABASE_ANON_KEY = PVT_SUPABASE_ANON_KEY;

console.log("%c[Timeline Step 1]: เริ่มต้นโหลดสคริปต์โครงสร้างหลักแบบอัจฉริยะ (Smart Config)...", "color: #9333ea; font-weight: bold;");

// ============================================================================
// 🧠 PVT SUPABASE ENGINE MODULE
// ============================================================================
window.pvtSupabase = (() => {
  let internalClient = null;

  function getClient() {
    if (internalClient) return internalClient;
    if (window.supabaseClient) {
      internalClient = window.supabaseClient;
      return internalClient;
    }
    
    if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
      console.warn("⚠️ Supabase JS SDK ยังไม่ได้โหลดเข้าสู่หน้าเว็บ");
      return null;
    }

    try {
      internalClient = window.supabase.createClient(PVT_SUPABASE_URL, PVT_SUPABASE_ANON_KEY);
      window.supabaseClient = internalClient;
      console.log("%c[Timeline Step 2]: ท่อเชื่อมโยงฐานข้อมูลหลักถูกสร้างสำเร็จ! ✅", "color: #2563eb; font-weight: bold;");
      return internalClient;
    } catch (err) {
      console.error("❌ เกิดข้อผิดพลาดในการสร้าง Supabase Client:", err.message);
      return null;
    }
  }

  async function getSession() {
    const sb = getClient();
    if (!sb) return null;
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      return data.session || null;
    } catch (err) {
      console.error("❌ ไม่สามารถดึงข้อมูล Session ได้:", err.message);
      return null;
    }
  }

  // 🌟 [SMART FEATURE 1] ดึงโปรไฟล์พนักงานแบบปลอดภัย
  async function getCurrentProfile() {
    const sb = getClient();
    if (!sb) return null;
    
    const session = await getSession();
    if (!session || !session.user) return null;

    try {
      const { data, error } = await sb
        .from("profiles")
        .select(`
          id, employee_id, email, username, display_name, role, status,
          employees (
            id, employee_code, full_name, start_date, status,
            departments ( department_name ),
            positions ( position_name )
          )
        `)
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      await logDebugError("getCurrentProfile", err.message, { userId: session?.user?.id });
      return null;
    }
  }

  // 🌟 [SMART FEATURE 2] ระบบ Activity Log
  async function logUserAction(userName, actionType, description) {
    const sb = getClient();
    if (!sb) return;
    try {
      await sb.from("user_activity_logs").insert({
        user_name: userName || "Unknown User",
        page_url: window.location.pathname,
        action_type: actionType,
        description: description,
        ip_address: "Client-Side"
      });
      console.log(`📝 [LOG RECORDED]: ${actionType} -> ${description}`);
    } catch (err) {
      console.warn("⚠️ บันทึก Activity Log ไม่สำเร็จ:", err.message || err);
    }
  }

  // 🌟 [SMART FEATURE 3] ระบบ Auto Debug Logger
  async function logDebugError(functionName, errorMessage, contextData = {}) {
    const sb = getClient();
    if (!sb) return;
    try {
      await sb.from("pvt_debug_logs").insert({
        function_name: functionName,
        error_message: String(errorMessage),
        context_data: contextData
      });
      console.warn(`🚨 [SYSTEM WARNING] บันทึก Error จากฟังก์ชัน '${functionName}' เรียบร้อยแล้ว`);
    } catch (err) {
      // เงียบไว้เพื่อไม่ให้เกิด Infinite Loop
    }
  }

  // 🌟 [SMART FEATURE 4] ฟังก์ชันตรวจสอบวันหยุดบริษัท
  async function checkIsCompanyHoliday(dateString) {
    const sb = getClient();
    if (!sb || !dateString) return false;
    try {
      const { data } = await sb
        .from("company_holidays")
        .select("holiday_name")
        .eq("holiday_date", dateString)
        .maybeSingle();
      return data ? data.holiday_name : false;
    } catch (err) {
      return false;
    }
  }

  // ==========================================
  // UTILITIES (ตัวช่วยแปลงข้อมูล)
  // ==========================================
  function toISODate(input) {
    if (!input) return null;
    const value = String(input).trim();
    if (!value) return null;

    if (value.includes("/")) {
      const [rawDay, rawMonth, rawYear] = value.split("/");
      if (!rawDay || !rawMonth || !rawYear) return null;
      let year = Number(rawYear);
      if (year > 2400) year -= 543;
      return `${year}-${rawMonth.padStart(2, "0")}-${rawDay.padStart(2, "0")}`;
    }

    if (value.includes("-")) {
      const parts = value.split("-");
      if (parts.length !== 3) return value;
      let year = Number(parts[0]);
      if (year > 2400) year -= 543;
      return `${year}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
    return null;
  }

  function formatThaiDate(dateValue) {
    if (!dateValue) return "-";
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return new Intl.DateTimeFormat("th-TH", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  return {
    getClient,
    getSession,
    getCurrentProfile,
    logUserAction,
    logDebugError,
    checkIsCompanyHoliday,
    toISODate,
    formatThaiDate,
    escapeHtml
  };
})();

// Initialize client ทันทีถ้า SDK พร้อม
window.pvtSupabase.getClient();

// Expose ฟังก์ชันให้ Global Scope สำหรับโค้ดรุ่นเก่า
window.logUserAction = (...args) => window.pvtSupabase.logUserAction(...args);
window.logDebugError = (...args) => window.pvtSupabase.logDebugError(...args);

console.log("✅ [Supabase Config] อัปเกรดระบบอัจฉริยะเสร็จสมบูรณ์ พร้อมใช้งาน! 🚀");