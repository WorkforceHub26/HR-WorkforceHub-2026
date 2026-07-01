const PVT_SUPABASE_URL = "https://pgogmhqjdchakcytsomx.supabase.co";
const PVT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

console.log("%c[Timeline Step 1]: เริ่มต้นโหลดสคริปต์โครงสร้างหลักแบบอัจฉริยะ (Smart Config)...", "color: #9333ea; font-weight: bold;");

try {
  // สั่งสร้าง Client ประทับตราลงสู่เบราว์เซอร์
  window.supabaseClient = supabase.createClient(PVT_SUPABASE_URL, PVT_SUPABASE_ANON_KEY);
  console.log("%c[Timeline Step 2]: ท่อเชื่อมโยงฐานข้อมูลหลักถูกสร้างสำเร็จ! ✅", "color: #2563eb; font-weight: bold;");
} catch (err) {
  console.error("❌ เกิดข้อผิดพลาดในจังหวะสร้าง Client ต้นทาง:", err.message);
}

// ============================================================================
// 🧠 PVT SUPABASE - CORE ENGINE (ระบบปฏิบัติการหลัก)
// ============================================================================
window.pvtSupabase = (() => {
  let client = window.supabaseClient;

  function getClient() {
    if (client) return client;
    if (!window.supabase) {
      console.warn("❌ Supabase library is not loaded.");
      return null;
    }
    client = window.supabase.createClient(PVT_SUPABASE_URL, PVT_SUPABASE_ANON_KEY);
    return client;
  }

  async function getSession() {
    const sb = getClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }

  // 🌟 [SMART FEATURE 1] ดึงโปรไฟล์แบบทะลุปรุโปร่ง (รวมข้อมูลพนักงาน แผนก ตำแหน่ง และโควตาวันลา)
  async function getCurrentProfile() {
    const sb = getClient();
    const session = await getSession();
    if (!sb || !session) return null;

    try {
      const { data, error } = await sb
        .from("profiles")
        .select(`
          id, employee_id, email, username, display_name, role, status,
          employees!employee_id (
            id, employee_code, full_name, start_date, status,
            departments ( department_name ),
            positions ( position_name ),
            leave_balances ( leave_type_id, entitlement_days, used_days, remaining_days, year )
          )
        `)
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (err) {
      logDebugError("getCurrentProfile", err.message, { userId: session.user.id });
      return null;
    }
  }

  // 🌟 [SMART FEATURE 2] ระบบสอดแนม (Activity Log) - เก็บประวัติการใช้งาน
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
      console.error("❌ บันทึก Log กิจกรรมไม่สำเร็จ:", err);
    }
  }

  // 🌟 [SMART FEATURE 3] ระบบจับบั๊กอัตโนมัติ (Auto Debug Logger)
  async function logDebugError(functionName, errorMessage, contextData = {}) {
    const sb = getClient();
    if (!sb) return;
    try {
      await sb.from("pvt_debug_logs").insert({
        function_name: functionName,
        error_message: String(errorMessage),
        context_data: contextData
      });
      console.warn(`🚨 [SYSTEM WARNING] บันทึก Error จากฟังก์ชัน '${functionName}' ลงฐานข้อมูลแล้ว!`);
    } catch (err) {
      // เงียบไว้เพื่อไม่ให้เกิด Infinite Loop
    }
  }

  // 🌟 [SMART FEATURE 4] ฟังก์ชันตรวจสอบว่าวันที่เลือกเป็น "วันหยุดบริษัท" หรือไม่
  async function checkIsCompanyHoliday(dateString) {
    const sb = getClient();
    if (!sb || !dateString) return false;
    try {
      const { data } = await sb.from("company_holidays").select("holiday_name").eq("holiday_date", dateString).maybeSingle();
      return data ? data.holiday_name : false; // ถอยชื่อวันหยุดกลับไปให้ ถ้าไม่ใช่จะคืนค่า false
    } catch (err) {
      return false;
    }
  }

  // ==========================================
  // UTILITIES (ตัวช่วยแปลงข้อมูลต่างๆ)
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
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

// 🎯 Expose ฟังก์ชัน logUserAction ออกมาเป็น Global เผื่อให้หน้า HTML ตัวเก่าเรียกใช้ได้โดยไม่ Error
window.logUserAction = window.pvtSupabase.logUserAction;
window.logDebugError = window.pvtSupabase.logDebugError;

console.log("✅ [Supabase Config] อัปเกรดระบบอัจฉริยะเสร็จสมบูรณ์ พร้อมใช้งาน! 🚀");