const PVT_SUPABASE_URL = "https://pgogmhqjdchakcytsomx.supabase.co";
const PVT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

window.PVT_SUPABASE_URL = PVT_SUPABASE_URL;
window.PVT_SUPABASE_ANON_KEY = PVT_SUPABASE_ANON_KEY;

window.pvtSupabase = (() => {
  let client = null;

  function getClient() {
    if (client) return client;
    if (window.supabaseClient) {
      client = window.supabaseClient;
      return client;
    }
    if (!window.supabase?.createClient) {
      console.warn("Supabase SDK is not loaded.");
      return null;
    }
    client = window.supabase.createClient(PVT_SUPABASE_URL, PVT_SUPABASE_ANON_KEY);
    window.supabaseClient = client;
    return client;
  }

  async function getSession() {
    const sb = getClient();
    if (!sb?.auth) return null;
    const { data } = await sb.auth.getSession();
    return data?.session || null;
  }

  function getCachedUser() {
    try {
      return JSON.parse(sessionStorage.getItem("currentUser") || "null");
    } catch {
      return null;
    }
  }

  async function getCurrentProfile() {
    const sb = getClient();
    if (!sb) return null;

    const cached = getCachedUser();
    if (cached?.id || cached?.employee_code) {
      const query = sb
        .from("employees")
        .select(`
          id, employee_code, full_name, nickname, phone, email, hospital,
          bank_account, line_id, image_url, start_date, status, role,
          employment_type, department_id, position_id,
          departments(department_name),
          positions(position_name)
        `);

      const { data: employee } = cached.id
        ? await query.eq("id", cached.id).maybeSingle()
        : await query.eq("employee_code", cached.employee_code).maybeSingle();

      const emp = employee || cached;
      return {
        id: cached.auth_id || cached.profile_id || emp.id,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        display_name: emp.full_name,
        role: emp.role || cached.role || "employee",
        status: emp.status || "active",
        employees: emp,
      };
    }

    const session = await getSession();
    if (!session?.user) return null;

    const { data: profile, error } = await sb
      .from("profiles")
      .select("id, employee_id, email, username, display_name, role, status")
      .eq("id", session.user.id)
      .maybeSingle();

    if (error || !profile) return null;
    if (!profile.employee_id) return profile;

    const { data: employee } = await sb
      .from("employees")
      .select(`
        id, employee_code, full_name, nickname, phone, email, hospital,
        bank_account, line_id, image_url, start_date, status, role,
        employment_type, department_id, position_id,
        departments(department_name),
        positions(position_name)
      `)
      .eq("id", profile.employee_id)
      .maybeSingle();

    return { ...profile, employees: employee };
  }

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

  function statusLabel(status) {
    return {
      pending: "รออนุมัติ",
      approved: "อนุมัติแล้ว",
      rejected: "ไม่อนุมัติ",
      cancelled: "ยกเลิก",
    }[status] || status || "-";
  }

  function getAvatarUrl(imageUrl) {
    if (!imageUrl) return "/assets/img/default-avatar.jpg";
    let url = String(imageUrl).trim();
    if (!url) return "/assets/img/default-avatar.jpg";
    if (!url.startsWith("http")) {
      url = `${PVT_SUPABASE_URL}/storage/v1/object/public/employee-images/${url}`;
    }
    return url.replace("storage/v1/object/", "storage/v1/object/public/");
  }

  function downloadBlob(filename, content, mimeType = "text/plain;charset=utf-8") {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return {
    getClient,
    getSession,
    getCachedUser,
    getCurrentProfile,
    toISODate,
    formatThaiDate,
    escapeHtml,
    statusLabel,
    getAvatarUrl,
    downloadBlob,
  };
})();

window.pvtSupabase.getClient();
