let employees = [];
let leaveTypes = [];
let currentProfile = null;

document.addEventListener("DOMContentLoaded", initLeaveForm);
document.getElementById("leaveForm")?.addEventListener("submit", saveLeave);

async function initLeaveForm() {
  currentProfile = await window.pvtSupabase?.getCurrentProfile();
  await Promise.all([loadEmployees(), loadLeaveTypes()]);
  fillCurrentEmployee();
  addLeaveRow();
}

// 🤖 อัตโนมัติ: ดึงรายชื่อพนักงานที่อัปโหลดจาก CSV มาทำ Auto-complete ในฟอร์ม
async function loadEmployees() {
  const sb = window.pvtSupabase?.getClient();
  const options = document.getElementById("employeeOptions");
  if (!sb || !options) return;

  try {
    const { data, error } = await sb
      .from("employees")
      .select("id, employee_code, full_name, status")
      .eq("status", "active")
      .order("employee_code", { ascending: true });

    if (error) throw error;
    employees = data || [];
    
    // ทำตัวเลือกให้พนักงานพิมพ์ค้นหาได้ทั้ง รหัส หรือ ชื่อ-นามสกุล
    options.innerHTML = employees.map((employee) => `
      <option value="${window.pvtSupabase.escapeHtml(employee.full_name)}" label="${window.pvtSupabase.escapeHtml(employee.employee_code)}"></option>\n      <option value="${window.pvtSupabase.escapeHtml(employee.employee_code)}" label="${window.pvtSupabase.escapeHtml(employee.full_name)}"></option>
    `).join("");
  } catch (error) {
    console.warn(error);
    setStatus(`โหลดรายชื่อพนักงานไม่สำเร็จ: ${error.message}`, "error");
  }
}

// โดนโหลดประเภทการลาทั้งหมดจากตาราง leave_types
async function loadLeaveTypes() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from("leave_types")
      .select("id, leave_code, leave_name")
      .eq("status", "active");
    if (error) throw error;
    leaveTypes = data || [];
  } catch (error) {
    console.warn(error);
  }
}

// 🤖 อัตโนมัติ: ล็อกชื่อพนักงานตามบัญชีผู้ใช้ที่ล็อกอินอยู่ทันที ไม่ต้องพิมพ์เอง
function fillCurrentEmployee() {
  const employee = currentProfile?.employees;
  const input = document.getElementById("employeeInput"); // ช่องใส่ชื่อในฟอร์ม HTML ของพี่
  if (input && employee) {
    input.value = employee.full_name;
    // ล็อกช่องไว้ไม่ให้แก้กรณีเป็นพนักงานทั่วไป แต่ถ้าเป็น HR/Admin จะเปิดให้พิมพ์เปลี่ยนชื่อแทนคนอื่นได้
    if (currentProfile.role === "employee") {
      input.readOnly = true;
    }
  }
}

// ฟังก์ชันเพิ่มแถวการลาในตารางใบลา (Dynamic Row)
function addLeaveRow() {
  const tbody = document.getElementById("leaveTableBody");
  if (!tbody) return;

  const rowId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const tr = document.createElement("tr");
  tr.id = rowId;

  // สร้าง Option ประเภทการลา
  const typeOptions = leaveTypes.map(t => `<option value="${t.id}">${t.leave_name}</option>`).join("");
  const today = new Date().toISOString().split('T')[0];

  tr.innerHTML = `
    <td><input type="date" class="write-date" value="${today}" required /></td>
    <td><input type="date" class="start-date" onchange="calculateRowDays('${rowId}')" required /></td>
    <td><input type="date" class="end-date" onchange="calculateRowDays('${rowId}')" required /></td>
    <td><input type="number" class="start-ampm" min="0" max="4" value="0" step="0.5" onchange="calculateRowDays('${rowId}')" placeholder="ชม." /></td>
    <td><input type="number" class="end-ampm" min="0" max="4" value="0" step="0.5" onchange="calculateRowDays('${rowId}')" placeholder="ชม." /></td>
    <td><input type="number" class="total-days" min="0.5" step="0.5" readonly required value="0" /></td>
    <td><select class="leave-type-id" required>${typeOptions}</select></td>
    <td><input type="text" class="leave-reason" placeholder="ระบุเหตุผล" required /></td>
    <td><input type="file" class="leave-attachment" accept="image/*,application/pdf" /></td>
    <td>👤</td>
    <td>-</td>
    <td>-</td>
    <td>-</td>
    <td class="no-print"><button type="button" class="remove-btn" onclick="removeLeaveRow('${rowId}')">❌</button></td>
  `;
  tbody.appendChild(tr);
}

function removeLeaveRow(rowId) {
  const row = document.getElementById(rowId);
  const tbody = document.getElementById("leaveTableBody");
  if (row && tbody && tbody.children.length > 1) {
    row.remove();
  } else {
    alert("ต้องมีรายการลาอย่างน้อย 1 รายการครับ");
  }
}

// ฟังก์ชันคำนวณจำนวนวันลาอัตโนมัติในแถว
function calculateRowDays(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const startVal = row.querySelector(".start-date").value;
  const endVal = row.querySelector(".end-date").value;
  const startHrs = parseFloat(row.querySelector(".start-ampm").value || 0);
  const endHrs = parseFloat(row.querySelector(".end-ampm").value || 0);
  const totalInput = row.querySelector(".total-days");

  if (!startVal || !endVal) return;

  const start = new Date(startVal);
  const end = new Date(endVal);

  if (end < start) {
    totalInput.value = "0";
    return;
  }

  // คำนวณจำนวนวันต่าง
  const diffTime = Math.abs(end - start);
  let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // หักลบตามจำนวนชั่วโมงที่ลาเพิ่ม (แปลงชั่วโมงเป็นทศนิยมของวัน เช่น ลา 4 ชม. = 0.5 วัน)
  let hourDeduction = (startHrs + endHrs) / 8; 
  let finalDays = days - hourDeduction;

  totalInput.value = finalDays > 0 ? finalDays : 0;
}

// 💾 ฟังก์ชันบันทึกข้อมูลใบลาลง Supabase 
async function saveLeave(event) {
  event.preventDefault();
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  const employeeInput = document.getElementById("employeeInput").value.trim();
  
  // ค้นหาวัตถุพนักงานจริงเพื่อเอา ID
  const matchedEmp = employees.find(e => e.full_name === employeeInput || e.employee_code === employeeInput);
  const employeeId = matchedEmp ? matchedEmp.id : currentProfile?.employee_id;

  if (!employeeId) {
    setStatus("❌ ไม่พบข้อมูลพนักงานในระบบ กรุณาเลือกจากรายชื่อที่ถูกต้อง", "error");
    return;
  }

  const rows = Array.from(document.querySelectorAll("#leaveTableBody tr"));
  const payload = rows.map((row) => {
    return {
      employee_id: employeeId,
      leave_type_id: row.querySelector(".leave-type-id").value,
      start_date: row.querySelector(".start-date").value,
      end_date: row.querySelector(".end-date").value,
      total_days: Number(row.querySelector(".total-days").value || 0),
      reason: row.querySelector(".leave-reason").value.trim(),
      status: "pending"
    };
  });

  setStatus("⏳ กำลังส่งใบลาเข้าสู่ระบบ...", "info");

  try {
    const { error } = await sb.from("leave_requests").insert(payload);
    if (error) throw error;

    setStatus("✅ บันทึกคำขอลาและส่งสัญญานไปที่หัวหน้าเรียบร้อยแล้ว!", "success");
    setTimeout(() => {
  window.location.href = "/pages/user/leave-history.html";
}, 900);
  } catch (error) {
    console.error(error);
    setStatus(`❌ เกิดข้อผิดพลาด: ${error.message}`, "error");
  }
}

function setStatus(message, type) {
  const el = document.getElementById("formStatus");
  if (!el) return;
  el.textContent = message;
  el.className = `form-status ${type}`;
}

// ฟังก์ชันเสริมสำหรับดักจับการกรอกวันที่ย้อนศรหน้าบ้าน
// อัปเกรดฟังก์ชัน validateRow ใน leave-user.js เพื่อป้องกันการใส่วันที่สลับกัน
function validateRow(row, isSubmitting = false) {
  const errors = [];
  const startEl = row.querySelector(".start-date");
  const endEl = row.querySelector(".end-date");
  const typeEl = row.querySelector(".leave-type-select");
  const totalEl = row.querySelector(".total-days");

  if (!startEl?.value) errors.push("กรุณาระบุวันเริ่มต้น");
  if (!endEl?.value) errors.push("กรุณาระบุวันสิ้นสุด");
  if (!typeEl?.value) errors.push("กรุณาเลือกประเภทการลา");
  if (isSubmitting && (!totalEl?.value || Number(totalEl.value) <= 0)) {
    errors.push("จำนวนวันลาต้องมากกว่า 0 วัน");
  }

  // 💡 จุดอัปเกรด: ตรวจสอบความสมเหตุสมผลของวันที่ (Logical Date Check)
  if (startEl?.value && endEl?.value) {
    const startDate = new Date(startEl.value);
    const endDate = new Date(endEl.value);

    if (startDate > endDate) {
      errors.push("❌ วันเริ่มต้นลา ห้ามอยู่หลัง วันสิ้นสุดลาเด็ดขาด");
      row.style.border = "2px solid #ef4444"; // ไฮไลท์กรอบแดงที่แถวที่มีปัญหา
    } else {
      row.style.border = ""; // เคลียร์สีกรอบถ้าแก้ไขถูกต้องแล้ว
    }
  }

  return errors;
}