document.addEventListener("DOMContentLoaded", () => {
  setTodayText();
  loadDashboardCounts();
});

function setTodayText() {
  const todayText = document.getElementById("todayText");
  if (!todayText) return;

  todayText.textContent = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

async function loadDashboardCounts() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const [{ count: employees }, { count: pending }, { count: approved }] = await Promise.all([
      sb.from("employees").select("*", { count: "exact", head: true }),
      sb.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "approved"),
    ]);

    setText("employeeCount", employees ?? "-");
    setText("pendingLeaveCount", pending ?? "-");
    setText("approvedLeaveCount", approved ?? "-");
  } catch (error) {
    console.warn("Dashboard counts unavailable", error);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

