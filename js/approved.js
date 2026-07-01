/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - APPROVED HISTORY LOGIC (EXTERNAL JAVASCRIPT)
 * ==========================================================================
 */

let db = null;
let currentRoleMode = "approver"; // 'approver' = หัวหน้าแผนก, 'hr' = ฝ่ายบุคคล

document.addEventListener("DOMContentLoaded", async () => {
  // เกาะท่อเชื่อมต่อฐานข้อมูลตัวกลางที่แชร์ไว้ของพี่
  if (window.supabaseClient) {
    db = window.supabaseClient;
  } else if (window.pvtSupabase) {
    db = window.pvtSupabase.getClient();
  } else if (typeof supabase !== 'undefined') {
    db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  }

  if (!db) {
    const tbody = document.getElementById("historyTableBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; padding:20px;">❌ เชื่อมต่อท่อฐานข้อมูลล้มเหลว</td></tr>`;
    }
    return;
  }

  // โหลดข้อมูลมุมมองหัวหน้าขึ้นมาเป็นอันดับแรก
  await loadApprovedHistoryData();
});

/**
 * 🔄 ฟังก์ชันสลับปุ่มมุมมองด้านบน (หัวหน้า / HR)
 */
async function switchHistoryRole(role) {
  currentRoleMode = role;
  
  const btnApprover = document.getElementById("btnRoleApprover");
  const btnHr = document.getElementById("btnRoleHr");
  const pageMainTitle = document.getElementById("pageMainTitle");
  const counterLabel = document.getElementById("counterLabel");

  if (role === 'approver') {
    btnApprover.classList.add("active");
    btnHr.classList.remove("active");
    pageMainTitle.textContent = "ประวัติรายการใบลาที่ผ่านการอนุมัติ (สิทธิ์หัวหน้า)";
    counterLabel.textContent = "รวมใบลาที่ท่านอนุมัติแล้ว";
  } else {
    btnHr.classList.add("active");
    btnApprover.classList.remove("active");
    pageMainTitle.textContent = "ศูนย์ตรวจสอบประวัติใบลาทั้งบริษัท (สิทธิ์ HR)";
    counterLabel.textContent = "ใบลาที่อนุมัติสมบูรณ์ทั้งบริษัท";
  }

  await loadApprovedHistoryData();
}

/**
 * 📥 ฟังก์ชันคิวรีข้อมูลตามเงื่อนไขสิทธิ์ที่เลือก (ไม่เหมือนกัน)
 */
async function loadApprovedHistoryData() {
  const theadRow = document.getElementById("tableHeaderRow");
  const tbody = document.getElementById("historyTableBody");
  const counterEl = document.getElementById("countTotalApproved");
  
  if (!theadRow || !tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" style="padding:40px; text-align:center; color:var(--text-soft);">กำลังคัดกรองประวัติข้อมูลตามสิทธิ์...</td></tr>`;

  // 🛑 วาดหัวตารางแยกออกจากกันให้เห็นต่างกันชัดเจน (HR จะโชว์ชื่อฝ่าย/แผนกแทนเหตุผลส่วนตัว)
  if (currentRoleMode === "approver") {
    theadRow.innerHTML = `
      <th style="padding:16px;">รหัสพนักงาน</th>
      <th style="padding:16px;">ชื่อ-นามสกุล</th>
      <th style="padding:16px;">ประเภทคำขอลา</th>
      <th style="padding:16px;">ช่วงวันที่ลา</th>
      <th style="padding:16px;">จำนวนวัน</th>
      <th style="padding:16px;">เหตุผลการลา</th>
      <th style="padding:16px;">สถานะของท่าน</th>
      <th style="padding:16px; text-align:center;">พิมพ์ฟอร์ม</th>
    `;
  } else {
    theadRow.innerHTML = `
      <th style="padding:16px;">รหัสพนักงาน</th>
      <th style="padding:16px;">ชื่อ-นามสกุล</th>
      <th style="padding:16px;">ฝ่าย / แผนก</th>
      <th style="padding:16px;">ประเภทคำขอลา</th>
      <th style="padding:16px;">ช่วงวันที่ลา</th>
      <th style="padding:16px;">จำนวนวัน</th>
      <th style="padding:16px;">สถานะภาพรวม</th>
      <th style="padding:16px; text-align:center;">พิมพ์เอกสาร</th>
    `;
  }

  try {
    let query = db.from("leave_requests").select(`
      *,
      employees!employee_id (
        full_name, employee_code,
        departments ( department_name )
      ),
      leave_types ( leave_name )
    `);

    // ⚡ เงื่อนไขการกรองที่ไม่เหมือนกัน: 
    // หัวหน้าเห็นงานที่เคยกดผ่านมา (approved_by_leaders, approved) / ส่วน HR เห็นเฉพาะงานที่จบสิ้นแล้วกระบวนการแล้ว (approved)
    if (currentRoleMode === "approver") {
      query = query.in("status", ["approved_by_leaders", "approved"]);
    } else {
      query = query.eq("status", "approved");
    }

    const { data: leaves, error } = await query.order("updated_at", { ascending: false });
    if (error) throw error;

    // เปลี่ยนตัวเลขสถิติบนการ์ด
    if (counterEl) counterEl.innerHTML = `${leaves ? leaves.length : 0} <small>รายการ</small>`;

    if (!leaves || leaves.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:#64748b;">ไม่มีประวัติใบลาในสิทธิ์มุมมองนี้</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    
    // 🎨 วาดข้อมูลลงแถวตารางแบบสลับหน้าตาโครงสร้างข้อมูลตามที่เลือก
    leaves.forEach(req => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid var(--border)";
      
      const empCode = req.employees?.employee_code || "-";
      const empName = req.employees?.full_name || "-";
      const deptName = req.employees?.departments?.department_name || "-";
      const leaveName = req.leave_types?.leave_name || "-";
      const reasonText = req.reason || "-";
      
      const formatDate = (dStr) => {
        if(!dStr) return "-";
        return new Date(dStr).toLocaleDateString('th-TH', {day:'2-digit', month:'short', year:'2-digit'});
      };
      const leavePeriod = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;

      if (currentRoleMode === "approver") {
        // แถวข้อมูลแบบ "หัวหน้าแผนก" (เห็นเหตุผลชัดเจน)
        tr.innerHTML = `
          <td style="padding:16px; font-weight:600; color:#475569;">${empCode}</td>
          <td style="padding:16px; font-weight:500; color:#0f172a;">${empName}</td>
          <td style="padding:16px;"><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px;">${leaveName}</span></td>
          <td style="padding:16px; color:#475569;">${leavePeriod}</td>
          <td style="padding:16px; font-weight:600; color:#0fa472;">${req.total_days || 0} วัน</td>
          <td style="padding:16px; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${reasonText}">${reasonText}</td>
          <td style="padding:16px;"><span class="badge-history-approver">✓ อนุมัติผ่านแล้ว</span></td>
          <td style="padding:16px; text-align:center;">
            <button style="background:#f1f5f9; color:#475569; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px;" onclick="callParentPrint('${req.id}')">พิมพ์ A4</button>
          </td>
        `;
      } else {
        // แถวข้อมูลแบบ "HR" (เน้นเห็น ฝ่าย/แผนก ของพนักงานทั้งบริษัทเพื่อคัดกรอง)
        tr.innerHTML = `
          <td style="padding:16px; font-weight:600; color:#475569;">${empCode}</td>
          <td style="padding:16px; font-weight:500; color:#0f172a;">${empName}</td>
          <td style="padding:16px; color:#1e40af; font-weight:600;">🏢 ${deptName}</td>
          <td style="padding:16px;"><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px;">${leaveName}</span></td>
          <td style="padding:16px; color:#475569;">${leavePeriod}</td>
          <td style="padding:16px; font-weight:600; color:#0fa472;">${req.total_days || 0} วัน</td>
          <td style="padding:16px;"><span class="badge-history-hr">🟢 อนุมัติสมบูรณ์ (HR รับรู้)</span></td>
          <td style="padding:16px; text-align:center;">
            <button style="background:#0fa472; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500;" onclick="callParentPrint('${req.id}')">พิมพ์ใบสรุป</button>
          </td>
        `;
      }
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px;">ระบบขัดข้องในการโหลดคลังข้อมูล</td></tr>`;
  }
}

/**
 * 🖨️ ส่งคำสั่งพิมพ์ใบลาไปยังฟังก์ชันปริ้นต์หลักของระบบพี่
 */
function callParentPrint(leaveId) {
  if (typeof window.printLeaveA4 === 'function') {
    window.printLeaveA4(leaveId);
  } else if (window.opener && typeof window.opener.printLeaveA4 === 'function') {
    window.opener.printLeaveA4(leaveId);
  } else {
    alert("ระบบเตรียมข้อมูลสั่งพิมพ์รหัสใบลา: " + leaveId + " สำเร็จแล้ว");
  }
}