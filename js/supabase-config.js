const PVT_SUPABASE_URL = "https://pgogmhqjdchakcytsomx.supabase.co";
const PVT_SUPABASE_ANON_KEY = "sb_publishable_iA8FjvM0C-6A24AjaanOKw_FG30LtE6";

window.pvtSupabase = (() => {
  let client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase) {
      console.warn("Supabase library is not loaded.");
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

  aasync function getCurrentProfile() {
    const sb = getClient();
    const session = await getSession();
    if (!sb || !session) return null;

    // ดึงโปรไฟล์พนักงานพร้อมข้อมูลแผนกและตำแหน่งพนักงานแบบอัตโนมัติในคำสั่งเดียว
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

    if (error) {
      console.warn("Profile lookup failed", error);
      return null;
    }
    return data;
  }

  function toISODate(input) {
    if (!input) return null;
    const value = String(input).trim();
    if (!value) return null;

    if (value.includes("/")) {
      const [rawDay, rawMonth, rawYear] = value.split("/");
      if (!rawDay || !rawMonth || !rawYear) return null;
      const day = rawDay.padStart(2, "0");
      const month = rawMonth.padStart(2, "0");
      let year = Number(rawYear);
      if (year > 2400) year -= 543;
      return `${year}-${month}-${day}`;
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

  function statusLabel(status) {
    return {
      pending: "รออนุมัติ",
      approved: "อนุมัติแล้ว",
      rejected: "ไม่อนุมัติ",
      cancelled: "ยกเลิก",
    }[status] || status || "-";
  }

  return {
    getClient,
    getSession,
    getCurrentProfile,
    toISODate,
    formatThaiDate,
    escapeHtml,
    statusLabel,
  };
})();
