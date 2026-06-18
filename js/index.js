document.addEventListener("DOMContentLoaded", () => {
  setTodayText();
});

/* ======================================================
   แสดงวันที่ปัจจุบันแบบภาษาไทย
====================================================== */
function setTodayText() {
  const todayText = document.getElementById("todayText");
  if (!todayText) return;

  const now = new Date();

  const formatter = new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  todayText.textContent = formatter.format(now);
}