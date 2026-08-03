let myLeaveRows = [];
let myProfile = null;

document.addEventListener("DOMContentLoaded", initLeaveHistory);

async function initLeaveHistory() {
  myProfile = await window.pvtSupabase?.getCurrentProfile();
  renderProfileHeader();
  await loadMyLeaveHistory();
}

function renderProfileHeader() {
  const employee = myProfile?.employees || {};
  document.getElementById("emp-name").textContent = employee.full_name || myProfile?.display_name || "พนักงาน";
  document.getElementById("emp-detail").textContent =
    `รหัส ${employee.employee_code || "-"} · ${employee.departments?.department_name || "ไม่ระบุแผนก"}`;
  const avatar = document.getElementById("user-avatar");
  if (avatar) avatar.src = window.pvtSupabase.getAvatarUrl(employee.image_url);
}

async function loadMyLeaveHistory() {
  const tableBody = document.getElementById("table-data-rows");
  const employeeId = myProfile?.employee_id || myProfile?.employees?.id;
  const sb = window.pvtSupabase?.getClient();

  if (!sb || !employeeId) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">กรุณาเข้าสู่ระบบเพื่อดูประวัติการลา</td></tr>`;
    return;
  }

  try {
    // 📍 1. เพิ่ม approval_comment เข้าไปในคำสั่ง select
    const { data, error } = await sb
      .from("leave_requests")
      .select("id, leave_type_id, start_date, end_date, total_days, reason, status, approval_comment, created_at, leave_types(leave_name)")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    myLeaveRows = data || [];
    renderSummary();
    renderRows();
  } catch (error) {
    console.error(error);
    tableBody.innerHTML = `<tr><td colspan="5" class="error-state">โหลดข้อมูลไม่สำเร็จ: ${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderSummary() {
  // 📍 แก้ไข: คำนวณวันลารวม เฉพาะรายการที่มีสถานะเป็น "approved" (อนุมัติแล้ว) เท่านั้น
  const totalDays = myLeaveRows
    .filter(item => item.status === "approved")
    .reduce((sum, item) => sum + Number(item.total_days || 0), 0);

  setText("sumAll", myLeaveRows.length);
  setText("sumPending", myLeaveRows.filter((item) => item.status === "pending").length);
  setText("sumApproved", myLeaveRows.filter((item) => item.status === "approved").length);
  setText("sumDays", totalDays.toFixed(1).replace(/\.0$/, ""));
}

function renderRows() {
  const tableBody = document.getElementById("table-data-rows");
  if (!myLeaveRows.length) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">ยังไม่มีประวัติการลา</td></tr>`;
    return;
  }

  tableBody.innerHTML = myLeaveRows.map((item) => {
    // 📍 2. ดักจับสถานะและคอมเมนต์ เพื่อเปลี่ยนป้ายสถานะ
    let displayStatus = window.pvtSupabase.statusLabel(item.status);
    let statusClass = item.status || "pending";
    let badgeExtraStyle = ""; // เอาไว้ใส่สีเทากรณียกเลิก
    
    if (item.status === "rejected") {
      const comment = item.approval_comment || "";
      if (comment.includes("ยกเลิก")) {
        displayStatus = "ยกเลิก";
        statusClass = "cancelled"; 
        badgeExtraStyle = "background-color: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;";
      } else {
        displayStatus = "ไม่อนุมัติ";
      }
    }

    return `
      <tr>
        <td data-label="ประเภทการลา"><strong class="leave-type-title">${escapeHtml(item.leave_types?.leave_name || "ไม่ระบุ")}</strong></td>
        <td data-label="ช่วงวันที่">${window.pvtSupabase.formatThaiDate(item.start_date)} - ${window.pvtSupabase.formatThaiDate(item.end_date)}</td>
        <td data-label="จำนวน"><span style="font-weight:700; color:var(--primary);">${item.total_days || 0}</span> วัน</td>
        <td data-label="เหตุผล" class="td-reason">${escapeHtml(item.reason || "-")}</td>
        <td data-label="สถานะ"><span class="status-badge ${statusClass}" style="${badgeExtraStyle}">${displayStatus}</span></td>
      </tr>
    `;
  }).join("");
}

function exportMyLeaveHistoryExcel() {
  const employee = myProfile?.employees || {};
  
  // 📍 3. ดักจับการ Export เพื่อให้ในไฟล์ Excel โชว์คำว่า "ยกเลิก" ด้วย
  const rows = myLeaveRows.map((item) => {
    let displayStatus = window.pvtSupabase.statusLabel(item.status);
    if (item.status === "rejected") {
      const comment = item.approval_comment || "";
      if (comment.includes("ยกเลิก")) {
        displayStatus = "ยกเลิก";
      } else {
        displayStatus = "ไม่อนุมัติ";
      }
    }

    return {
      "รหัสพนักงาน": employee.employee_code || "",
      "ชื่อ-นามสกุล": employee.full_name || "",
      "ประเภทการลา": item.leave_types?.leave_name || "",
      "วันที่เริ่มลา": item.start_date || "",
      "วันที่สิ้นสุด": item.end_date || "",
      "จำนวนวัน": Number(item.total_days || 0),
      "เหตุผล": item.reason || "",
      "สถานะ": displayStatus,
      "วันที่ส่งคำขอ": item.created_at || "",
    };
  });

  if (!rows.length) {
    alert("ยังไม่มีข้อมูลสำหรับ export");
    return;
  }

  if (window.XLSX) {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "My Leave History");
    XLSX.writeFile(workbook, `my_leave_history_${employee.employee_code || "employee"}.xlsx`);
    return;
  }

  const headers = Object.keys(rows[0]);
  const csvRows = rows.map((row) => headers.map((header) => `"${String(row[header] ?? "").replaceAll('"', '""')}"`).join(","));
  window.pvtSupabase.downloadBlob(`my_leave_history_${employee.employee_code || "employee"}.csv`, `\uFEFF${headers.join(",")}\n${csvRows.join("\n")}`, "text/csv;charset=utf-8");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(value) {
  return window.pvtSupabase?.escapeHtml(value) || String(value ?? "");
}