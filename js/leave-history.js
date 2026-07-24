document.addEventListener("DOMContentLoaded", async () => {
  await loadRealUserData();
  await loadRealLeaveHistory();
});

// 1. ดึงข้อมูล Session พนักงานที่ล็อกอินอยู่
async function loadRealUserData() {
  try {
    const userSession = JSON.parse(sessionStorage.getItem("currentUser")) || null;

    if (userSession) {
      document.getElementById("emp-name").textContent = userSession.full_name || "ไม่ระบุชื่อ";
      document.getElementById("emp-detail").textContent = `รหัสพนักงาน: ${userSession.employee_code || '-'} | สิทธิ์: ${userSession.role || 'พนักงาน'}`;
    } else {
      document.getElementById("emp-name").textContent = "ผู้ใช้งานระบบ (ไม่ได้เข้าสู่ระบบ)";
      document.getElementById("emp-detail").textContent = "กรุณาเข้าสู่ระบบใหม่อีกครั้ง";
    }
  } catch (error) {
    console.error("Error loading user session:", error);
  }
}

// 2. ดึงข้อมูลประวัติการลาจริงจาก Supabase
async function loadRealLeaveHistory() {
  const tableBody = document.getElementById("table-data-rows");
  
  try {
    const userSession = JSON.parse(sessionStorage.getItem("currentUser"));
    const userId = userSession ? userSession.id : null;

    if (!userId) {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">🔒 กรุณาล็อกอินก่อนเพื่อดูประวัติการลา</td></tr>`;
      return;
    }

    const sb = window.pvtSupabase?.getClient();
    if (!sb) throw new Error("ไม่สามารถเชื่อมต่อ Supabase ได้");

    // ดึงข้อมูลการลาจากตารางใน Supabase
    const { data: leaveData, error } = await sb
      .from("leave_requests") // 💡 ปรับเปลี่ยนชื่อตารางให้ตรงกับใน Supabase ของคุณ
      .select("*, leave_types(leave_name)")
      .eq("employee_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!leaveData || leaveData.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">🔒 ไม่พบประวัติการลาในระบบ</td></tr>`;
      return;
    }

    tableBody.innerHTML = "";
    
    leaveData.forEach(item => {
      const tr = document.createElement("tr");
      
      const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
      };

      let statusClass = "pending";
      let statusText = "⏳ รอพิจารณา";
      if (item.status === "approved" || item.status === "อนุมัติ") { statusClass = "approved"; statusText = "✓ อนุมัติแล้ว"; }
      if (item.status === "rejected" || item.status === "ปฏิเสธ") { statusClass = "rejected"; statusText = "❌ ปฏิเสธ"; }

      // 💡 ใส่ data-label เพื่อให้ CSS ดึงชื่อหัวข้อไปใช้ในโหมดการ์ดมือถือ
      tr.innerHTML = `
        <td data-label="ประเภทการลา"><strong class="leave-type-title">${item.leave_types?.leave_name || item.leave_type || "ไม่ระบุประเภท"}</strong></td>
        <td data-label="วันที่เริ่มต้น - สิ้นสุด">${formatDate(item.start_date)} - ${formatDate(item.end_date)}</td>
        <td data-label="จำนวนวัน"><span style="font-weight:700; color:var(--primary);">${item.total_days || 0}</span> วัน</td>
        <td data-label="เหตุผลการลา" class="td-reason">${item.reason || "-"}</td>
        <td data-label="สถานะอนุมัติ"><span class="status-badge ${statusClass}">${statusText}</span></td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error("Fetch Error:", error);
    tableBody.innerHTML = `<tr><td colspan="5" class="error-state">⚠ เชื่อมต่อฐานข้อมูลล้มเหลว: ${error.message}</td></tr>`;
  }
}

