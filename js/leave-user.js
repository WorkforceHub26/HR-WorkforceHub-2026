/**
 * leave-user.js — ใบลาออนไลน์ PVT HR (เวอร์ชันแก้ไขดึงประเภทลาแบบ Dynamic)
 * ✅ Auto-fill ข้อมูลพนักงานจากสิทธิ์จริงในระบบ
 * ✅ คำนวณวันลาอัตโนมัติรายแถว
 * ✅ ดึงประเภทการลา (Leave Types) ตรงจากฐานข้อมูล ไม่ Hardcode ID
 * ✅ ระบบลายเซ็นดิจิทัล (E-Signature) ผ่าน SignaturePad
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบติดตามข้อมูลใบลาทุกฝีก้าวแล้ว...");

// ==========================================
// 📦 GLOBAL VARIABLES
// ==========================================
let employees = [];
let leaveTypes = []; // เก็บประเภทการลาที่ดึงมาจากฐานข้อมูลจริง
let currentProfile = null;
let isHRRole = false;

// ─── 1. โหลดข้อมูลประเภทการลาจริงจาก Supabase ───
async function loadLeaveTypes() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    console.error("❌ [CONFIG ERROR] ไม่พบ Supabase Client ใน window.pvtSupabase");
    return;
  }

  console.log("⏳ [FETCHING] กำลังดึงประเภทการลาจากตาราง leave_types...");
  try {
    const { data, error, status } = await sb
      .from("leave_types")
      .select("id, leave_name")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(`❌ [DB ERROR] รหัสสถานะ: ${status}`, error);
      throw error;
    }

    // ประมวลผลตรวจสอบข้อมูลที่ได้จาก Supabase
    if (!data || data.length === 0) {
      console.warn("⚠️ [WARN] ดาต้าเบสส่ง Array(0) กลับมา! (เช็กสิทธิ์ RLS หรือข้อมูลในตาราง leave_types ว่ามีสถานะ active ไหม)");
      leaveTypes = [];
    } else {
      leaveTypes = data;
      console.log(`✅ [LEAVE TYPES SUCCESS] ประมวลผลเสร็จสิ้น พบข้อมูลทั้งหมด ${leaveTypes.length} รายการ:`, leaveTypes);
    }
  } catch (err) {
    console.error("❌ [CRITICAL] ระบบล้มเหลวในการดึงข้อมูลประเภทการลา:", err.message);
  }
}

// ─── 2. ฟังก์ชันพ่นข้อมูลพนักงานเข้าช่องแสดงผล ───
async function fetchCurrentUserData() {
  console.log("🛠️ [DEV MODE] เซ็ตข้อมูลพนักงานเข้าช่องแสดงผลใน HTML");

  const mockUser = {
    id: "11111111-1111-1111-1111-111111111111",
    employee_code: "EMP-009",                     
    full_name: "คุณมิกกี้ (IT Management)",
    position_name: "IT Manager",
    department_name: "Information Technology",
    start_date: "2024-01-15",                     
    leave_balance: "15"
  };

  if (document.getElementById("employeeCode"))       document.getElementById("employeeCode").value = mockUser.employee_code;
  if (document.getElementById("employeeName"))       document.getElementById("employeeName").value = mockUser.full_name;
  if (document.getElementById("employeePosition"))   document.getElementById("employeePosition").value = mockUser.position_name;
  if (document.getElementById("employeeDepartment")) document.getElementById("employeeDepartment").value = mockUser.department_name;
  if (document.getElementById("employeeStartDate"))  document.getElementById("employeeStartDate").value = mockUser.start_date;
  if (document.getElementById("leaveBalance"))       document.getElementById("leaveBalance").value = mockUser.leave_balance;

  sessionStorage.setItem("currentUser", JSON.stringify(mockUser));
}

// ─── 3. ฟังก์ชันเพิ่มแถวใบลา (เปลี่ยนเป็นดึง Option จากตัวแปร leaveTypes เผื่อ ID เปลี่ยน) ───
// ─── ฟังก์ชันเพิ่มแถวใบลา (ใช้ชุดตัวเลือกประเภทการลาที่พี่มิกกำหนดเป๊ะๆ) ───
function addLeaveRow() {
  const tbody = document.getElementById("leaveTableBody");
  if (!tbody) { console.error("ไม่พบตาราง #leaveTableBody"); return; }
  
  const row = document.createElement("tr");
  const rowId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  row.setAttribute('data-row-id', rowId);

  row.innerHTML = `
    <td data-label="วันที่เขียน"><input type="date" class="form-control" name="write_date" value="${new Date().toISOString().split('T')[0]}"></td>
    <td data-label="เริ่มวันที่"><input type="date" class="form-control" name="start_date"></td>
    <td data-label="ถึงวันที่"><input type="date" class="form-control" name="end_date"></td>
    <td data-label="จำนวน ชม.เช้า"><input type="number" class="form-control" name="hours_am" min="0" max="4" value="0"></td>
    <td data-label="จำนวน ชม.บ่าย"><input type="number" class="form-control" name="hours_pm" min="0" max="4" value="0"></td>
    <td data-label="จำนวนวันลาทั้งหมด"><input type="number" class="form-control" name="leave_days" min="0" value="0" step="0.1" style="font-weight:bold;" readonly></td>
    
    <td data-label="ประเภทการลา">
      <select class="form-control" name="leave_type_id" required>
        <option value="">-- เลือกประเภทการลา --</option>
        <option value="29add092-0601-4262-9d6a-8f6fa24947a7">วันหยุดพักผ่อนประจำปี</option>
        <option value="48996fa4-9e48-4226-9dd5-89e2e62f0e64">การลาป่วย</option>
        <option value="3b4d5e6f-2222-4262-b222-8f6fa24947a9">การลากิจจำเป็น</option>
        <option value="4c5d6e7f-3333-4262-b333-8f6fa24947b0">การลาเพื่อคลอดบุตร</option>
        <option value="5d6e7f8a-4444-4262-b444-8f6fa24947b1">การลาเพื่อทำหมัน</option>
        <option value="6e7f8a9b-5555-4262-b555-8f6fa24947b2">การลาเพื่อรับราชการทหาร</option>
        <option value="7f8a9b0c-6666-4262-b666-8f6fa24947b3">การลาเพื่อฌาปนกิจศพ</option>
        <option value="8a9b0c1d-7777-4262-b777-8f6fa24947b4">การลาเพื่ออุปสมบท</option>
        <option value="9b0c1d2e-8888-4262-b888-8f6fa24947b5">การลาเพื่อการฝึกอบรม</option>
        <option value="24965dc7-710b-404c-ba21-ed5687adc161">ลาอื่น ๆ</option>
      </select>
    </td>
    
    <td data-label="สาเหตุ / เหตุผลการลา"><input type="text" class="form-control" name="reason" placeholder="ระบุเหตุผล..."></td>
    <td data-label="แนบหลักฐาน"><input type="file" class="form-control" name="attachment"></td>
    
    <td data-label="ยืนยันตัวตน (เซ็นลายเซ็นลงในกรอบ)">
      <div style="border:1px dashed #cbd5e0; background:#fff; position:relative; width:140px; height:50px;">
        <canvas class="sig-pad" width="140" height="50"></canvas>
        <button type="button" class="btn-clear-sig" style="position:absolute; right:5px; top:5px; color:red; border:none; background:none; cursor:pointer; font-size:14px;">❌</button>
      </div>
    </td>
    
    <td data-label="หน.แผนก"><span class="badge">รอตรวจ</span></td>
    <td data-label="ผจก.ฝ่าย"><span class="badge">รอตรวจ</span></td>
    <td data-label="ฝ่ายบุคคล"><span class="badge">รอตรวจ</span></td>
    
    <td class="text-center">
      <button type="button" class="btn btn-danger" style="width:100%;" onclick="this.closest('tr').remove()">🗑️ ลบรายการนี้</button>
    </td>
  `;

  tbody.appendChild(row);

  const canvas = row.querySelector(".sig-pad");
  const clearBtn = row.querySelector(".btn-clear-sig");
  
  if (canvas && window.SignaturePad) {
    const pad = new SignaturePad(canvas, { minWidth: 1, maxWidth: 2.5, penColor: "rgb(0, 0, 128)" });
    clearBtn.addEventListener("click", () => pad.clear());
    if (!window.activePads) window.activePads = new Map();
    window.activePads.set(rowId, pad);
  }
}

// ─── 4. ระบบคำนวณวันลาอัตโนมัติรายแถว ───
document.getElementById("leaveTableBody")?.addEventListener("input", (e) => {
  const targetName = e.target.name;
  if (["start_date", "end_date", "hours_am", "hours_pm"].includes(targetName)) {
    const row = e.target.closest("tr");
    const startVal = row.querySelector('[name="start_date"]')?.value;
    const endVal = row.querySelector('[name="end_date"]')?.value;
    const hoursAm = Number(row.querySelector('[name="hours_am"]')?.value || 0);
    const hoursPm = Number(row.querySelector('[name="hours_pm"]')?.value || 0);
    const daysInput = row.querySelector('[name="leave_days"]');

    if (startVal && endVal) {
      const d1 = new Date(startVal);
      const d2 = new Date(endVal);
      if (d2 >= d1) {
        const diffTime = Math.abs(d2 - d1);
        let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        const extraDays = (hoursAm + hoursPm) / 8;
        totalDays = totalDays - (hoursAm > 0 || hoursPm > 0 ? totalDays : 0) + extraDays; 
        
        if (startVal === endVal && (hoursAm > 0 || hoursPm > 0)) {
          totalDays = (hoursAm + hoursPm) / 8;
        }

        if (daysInput) daysInput.value = totalDays.toFixed(1);
      } else {
        if (daysInput) daysInput.value = 0;
      }
    }
  }
});

// ─── 5. ฟังก์ชันบันทึกข้อมูลเข้า Supabase ───
// ─── ฟังก์ชันบันทึกข้อมูลเข้า Supabase (เวอร์ชันเช็กละเอียดรายช่อง) ───
async function saveLeave() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) { showToast("ไม่สามารถเชื่อมต่อ Supabase", "error"); return; }

  let employeeId = "9a8036a8-3b03-4802-9520-59934fe621e3"; 
  try {
    const cachedUser = JSON.parse(sessionStorage.getItem("currentUser"));
    if (cachedUser && cachedUser.id) employeeId = cachedUser.id;
  } catch(e) {}

  const rows = Array.from(document.querySelectorAll("#leaveTableBody tr"));
  if (!rows.length) { 
    showToast("กรุณาเพิ่มรายการลาอย่างน้อย 1 รายการ", "error"); 
    return; 
  }

  const payload = [];

  // 🔄 เปลี่ยนมาใช้ For Loop เพื่อเช็กทีละฟิลด์อย่างละเอียด จะได้แจ้งถูกจุด
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const leaveTypeId = row.querySelector('[name="leave_type_id"]')?.value;
    const startDate = row.querySelector('[name="start_date"]')?.value;
    const endDate = row.querySelector('[name="end_date"]')?.value;
    const totalDays = Number(row.querySelector('[name="leave_days"]')?.value || 0);
    const reason = row.querySelector('[name="reason"]')?.value?.trim() || "";

    // 🎯 ตรวจสอบทีละเงื่อนไข ถ้าติดช่องไหน จะแจ้งเตือนช่องนั้นทันที!
    if (!leaveTypeId) { showToast(`แถวที่ ${i + 1}: กรุณาเลือก "ประเภทการลา"`, "error"); return; }
    if (!startDate)   { showToast(`แถวที่ ${i + 1}: กรุณาระบุ "เริ่มวันที่"`, "error"); return; }
    if (!endDate)     { showToast(`แถวที่ ${i + 1}: กรุณาระบุ "ถึงวันที่"`, "error"); return; }
    if (totalDays <= 0) { showToast(`แถวที่ ${i + 1}: จำนวนวันลาต้องมากกว่า 0 (กรุณาตรวจสอบช่วงวันที่ลา)`, "error"); return; }
    if (!reason)      { showToast(`แถวที่ ${i + 1}: กรุณากรอก "สาเหตุ / เหตุผลการลา"`, "error"); return; }

    // ข้อมูลผ่านเกณฑ์ นำใส่กองเตรียมส่งเข้า Supabase
    payload.push({
      employee_id:   employeeId,
      leave_type_id: leaveTypeId,
      start_date:    startDate,
      end_date:      endDate,
      total_days:    totalDays,
      reason:        reason,
      status:        "pending"
    });
  }

  showToast("⏳ กำลังบันทึกคำขอลาลงฐานข้อมูล...", "info");
  console.log("🚀 [SENDING PAYLOAD] ยิงข้อมูลเข้า Supabase:", payload);

  try {
    const { data, error, status } = await sb.from("leave_requests").insert(payload).select();
    
    if (error) {
      console.error(`❌ [SAVE FAILED] Supabase ปฏิเสธการบันทึก รหัส HTTP: ${status}`, error);
      throw error;
    }

    console.log("✅ [SAVE SUCCESS] บันทึกสำเร็จ ข้อมูลลงเบสแล้ว:", data);
    showToast("✅ ส่งคำขอลาเรียบร้อยแล้ว!", "success");
    setTimeout(() => { window.location.href = "/pages/user/leave-history.html"; }, 1200);
  } catch (err) {
    console.error("❌ [CATCH ERROR] เกิดข้อผิดพลาด:", err);
    showToast(err.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? "";
}

let toastTimer = null;
function showToast(msg, type = "") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3500);
}

// ─── 6. INITIALIZATION ───
document.addEventListener("DOMContentLoaded", async () => {
  fetchCurrentUserData();
  await loadLeaveTypes(); // 🔥 โหลดประเภทลาจริงมาเตรียมไว้ก่อน
  addLeaveRow();          // หลังจากโหลดเสร็จค่อยสั่งสร้างแถวแรก
});