/**
 * PVT HR SYSTEM - leave-history.js
 * จัดการดึงข้อมูลโปรไฟล์ผู้ใช้งาน และประวัติการลาจริงจาก Database
 */

document.addEventListener("DOMContentLoaded", async () => {
  await loadRealUserData();
  await loadRealLeaveHistory();
});

// 1. ดึงข้อมูล Session พนักงานจริงที่ล็อกอินอยู่
async function loadRealUserData() {
  try {
    const userSession = JSON.parse(localStorage.getItem("pvt_user_session")) || null;

    if (userSession) {
      document.getElementById("emp-name").textContent = userSession.full_name || "ไม่ระบุชื่อ";
      document.getElementById("emp-detail").textContent = `${userSession.department || 'ไม่ระบุฝ่าย'} | ตำแหน่ง ${userSession.role || 'พนักงาน'}`;
      if (userSession.avatar_url) {
        document.getElementById("user-avatar").src = userSession.avatar_url;
      }
    } else {
      document.getElementById("emp-name").textContent = "ผู้ใช้งานระบบ (ไม่ได้เข้าสู่ระบบ)";
      document.getElementById("emp-detail").textContent = "กรุณาเข้าสู่ระบบใหม่อีกครั้ง";
    }
  } catch (error) {
    console.error("Error loading user session:", error);
  }
}

// 2. ดึงข้อมูลประวัติการลาจริงจาก Server
async function loadRealLeaveHistory() {
  const tableBody = document.getElementById("table-data-rows");
  
  try {
    const userSession = JSON.parse(localStorage.getItem("pvt_user_session"));
    const userId = userSession ? userSession.id : null;

    // ยิง Request ไปยัง Server API จริงของคุณ (แก้ไข Endpoint URL ให้ถูกต้องตาม Backend ของคุณ)
    const response = await fetch(`/api/leaves?userId=${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) throw new Error("ไม่สามารถเรียกข้อมูลจาก Server ได้");
    
    const leaveData = await response.json(); 

    // กรณีไม่มีข้อมูลประวัติการลา
    if (!leaveData || leaveData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">🔒 ไม่พบประวัติการลาในระบบ</td></tr>`;
      return;
    }

    // เคลียร์ Loader และเริ่ม Loop ข้อมูลจริงลงตาราง
    tableBody.innerHTML = "";
    
    leaveData.forEach(item => {
      const tr = document.createElement("tr");
      
      // ฟังก์ชันจัดฟอร์แมตวันที่แบบไทยอ่านง่าย
      const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
      };

      // แมตช์สถานะใบลา
      let statusClass = "pending";
      let statusText = "⏳ รอพิจารณา";
      if (item.status === "approved" || item.status === "อนุมัติ") { statusClass = "approved"; statusText = "✓ อนุมัติแล้ว"; }
      if (item.status === "rejected" || item.status === "ปฏิเสธ") { statusClass = "rejected"; statusText = "❌ ปฏิเสธ"; }

      tr.innerHTML = `
        <td><strong>${item.leave_types?.leave_name || "ไม่ระบุประเภท"}</strong></td>
        <td>${formatDate(item.start_date)} - ${formatDate(item.end_date)}</td>
        <td><span style="font-weight:600; color:var(--primary);">${item.total_days || 0}</span> วัน</td>
        <td style="color: var(--text-soft); font-size: 13.5px;">${item.reason || "-"}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error("Fetch Error:", error);
    tableBody.innerHTML = `<tr><td colspan="5" class="error-state">⚠ เชื่อมต่อฐานข้อมูลล้มเหลว: ${error.message}</td></tr>`;
  }
}