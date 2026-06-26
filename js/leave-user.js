/**
 * leave-user.js — ใบลาออนไลน์ PVT HR (เวอร์ชันแก้ไขผูกมัดกล่องเหลี่ยม 100%)
 * ✅ Auto-fill ข้อมูลพนักงานและสั่งซ่อนสถานะโหลดอัตโนมัติ
 * ✅ ดึงประเภทการลาจาก Supabase มาใส่ให้กล่องที่เพิ่มใหม่ทันที
 * ✅ บันทึกข้อมูลและตรวจทานความถูกต้องรายกล่องสมบูรณ์แบบ
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

    if (!data || data.length === 0) {
      console.warn("⚠️ [WARN] ดาต้าเบสส่ง Array(0) กลับมา! ใช้ค่าเริ่มต้นสำรอง");
      leaveTypes = [];
    } else {
      leaveTypes = data;
      console.log(`✅ [LEAVE TYPES SUCCESS] พบข้อมูลทั้งหมด ${leaveTypes.length} รายการ:`, leaveTypes);
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

  // ✨ ข้อมูลพนักงานและข้อมูลเบื้องต้นโหลดเสร็จสิ้น -> สั่งซ่อนสัญลักษณ์โหลดทันที!
  const loadingBadge = document.getElementById('loadingBadge');
  if (loadingBadge) {
    loadingBadge.style.display = 'none';
  }
}

// ==========================================================================
// 🚀 3. ฟังก์ชันเพิ่มกล่องรายการลาใหม่ 
// ==========================================================================
function addLeaveRow() {
  const container = document.getElementById('leaveCardsList');
  if (!container) return;

  const uniqueId = 'file_' + Math.random().toString(36).substr(2, 9);
  const boxItem = document.createElement('div');
  boxItem.className = 'leave-box-item';

  boxItem.innerHTML = `
    <div class="row-divider">หมวดหมู่ที่ 1: วันที่และกรอบเวลาการลา</div>
    <div class="grid-row-3">
      <div class="input-group">
        <label>วันที่เขียนคำขอ</label>
        <input type="date" name="write_date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="input-group">
        <label>เริ่มวันที่ลา</label>
        <input type="date" name="start_date" onchange="calculateLeaveDays(this)">
      </div>
      <div class="input-group">
        <label>ถึงวันที่ลา</label>
        <input type="date" name="end_date" onchange="calculateLeaveDays(this)">
      </div>
    </div>

    <div class="row-divider">หมวดหมู่ที่ 2: จำนวนเวลาและชั่วโมงที่ขอลา</div>
    <div class="grid-row-3">
      <div class="input-group">
        <label>จำนวนชั่วโมงเช้า (0-4)</label>
        <input type="number" placeholder="0" name="hours_morning" min="0" max="4" value="0" oninput="calculateLeaveDays(this)">
      </div>
      <div class="input-group">
        <label>จำนวนชั่วโมงบ่าย (0-4)</label>
        <input type="number" placeholder="0" name="hours_afternoon" min="0" max="4" value="0" oninput="calculateLeaveDays(this)">
      </div>
      <div class="input-group">
        <label>สรุปรวมจำนวนวัน</label>
        <input type="number" placeholder="0" readonly name="leave_days" class="readonly-highlight" value="0">
      </div>
    </div>

    <div class="row-divider">หมวดหมู่ที่ 3: รายละเอียดประเภทการลาและหลักฐาน</div>
    <div class="grid-row-3">
      <div class="input-group">
        <label>ประเภทการลา</label>
        <select name="leave_type_id">
          <option value="">-- เลือกประเภทการลา --</option>
        </select>
      </div>
      <div class="input-group">
        <label>สาเหตุ / เหตุผลการลา</label>
        <input type="text" placeholder="ระบุเหตุผลความจำเป็น..." name="reason">
      </div>
      <div class="input-group">
        <label>แนบหลักฐานรูปภาพ</label>
        <div class="custom-file-upload">
          <label class="file-upload-label" id="label_${uniqueId}" for="${uniqueId}">📁 เลือกรูปภาพหลักฐาน</label>
          <input type="file" id="${uniqueId}" accept="image/*" onchange="handleFileChange(this, 'label_${uniqueId}')">
        </div>
      </div>
    </div>

    <div class="row-divider">หมวดหมู่ที่ 4: สถานะผลการพิจารณาและอนุมัติ</div>
    <div class="grid-row-3">
      <div class="input-group">
        <label>หัวหน้าแผนก</label>
        <span class="badge-status">รอพิจารณา</span>
      </div>
      <div class="input-group">
        <label>ผู้จัดการฝ่าย</label>
        <span class="badge-status">รอพิจารณา</span>
      </div>
      <div class="input-group">
        <label>ฝ่ายบุคคล</label>
        <span class="badge-status">รอพิจารณา</span>
      </div>
    </div>

    <div class="box-item-footer no-print">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.leave-box-item').remove()">ลบรายการนี้</button>
    </div>
  `;

  container.appendChild(boxItem);

  // ✨ นำข้อมูลประเภทการลาดีดขึ้นจากตารางฐานข้อมูลจริง (Dynamic Dropdown) มาหยอดใส่กล่องใหม่ทันที
  const selectEl = boxItem.querySelector('select[name="leave_type_id"]');
  if (selectEl) {
    if (leaveTypes && leaveTypes.length > 0) {
      leaveTypes.forEach(type => {
        const opt = document.createElement("option");
        opt.value = type.id;
        opt.textContent = type.leave_name;
        selectEl.appendChild(opt);
      });
    } else {
      // ค่าสำรองกันฐานข้อมูลหลุด
      const backup = [{id:"1", name:"ลาป่วย"}, {id:"2", name:"ลากิจ"}, {id:"3", name:"ลาพักร้อน"}];
      backup.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.id; opt.textContent = b.name;
        selectEl.appendChild(opt);
      });
    }
  }
}

// ==========================================================================
// 🧮 4. ฟังก์ชันคำนวณจำนวนวันลาอัตโนมัติรายกล่อง
// ==========================================================================
function calculateLeaveDays(element) {
  const boxItem = element.closest('.leave-box-item');
  if (!boxItem) return;

  const startDateInput = boxItem.querySelector('input[name="start_date"]').value;
  const endDateInput = boxItem.querySelector('input[name="end_date"]').value;
  const hrMorning = parseFloat(boxItem.querySelector('input[name="hours_morning"]').value) || 0;
  const hrAfternoon = parseFloat(boxItem.querySelector('input[name="hours_afternoon"]').value) || 0;
  const resultInput = boxItem.querySelector('input[name="leave_days"]');

  if (!startDateInput || !endDateInput) {
    resultInput.value = 0;
    return;
  }

  const start = new Date(startDateInput);
  const end = new Date(endDateInput);
  
  if (end < start) {
    resultInput.value = 0;
    return;
  }

  const diffTime = Math.abs(end - start);
  let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // จัดการเศษชั่วโมง
  const extraDays = (hrMorning + hrAfternoon) / 8;
  if (startDateInput === endDateInput && (hrMorning > 0 || hrAfternoon > 0)) {
    totalDays = extraDays;
  } else {
    totalDays = totalDays - (hrMorning > 0 || hrAfternoon > 0 ? totalDays : 0) + extraDays;
  }

  resultInput.value = totalDays % 1 === 0 ? totalDays : totalDays.toFixed(1);
}

// ==========================================================================
// 📸 5. ฟังก์ชันเปลี่ยนชื่อปุ่มเมื่อเลือกรูปภาพเสร็จแล้ว
// ==========================================================================
function handleFileChange(input, labelId) {
  const label = document.getElementById(labelId);
  if (!label) return;
  
  if (input.files && input.files.length > 0) {
    label.innerText = '✅ ' + input.files[0].name;
    label.style.borderColor = 'var(--green)';
    label.style.color = 'var(--green-dark)';
  } else {
    label.innerText = '📁 เลือกรูปภาพหลักฐาน';
    label.style.borderColor = 'var(--border)';
    label.style.color = 'var(--muted)';
  }
}

// ==========================================================================
// 💾 6. ฟังก์ชันบันทึกข้อมูลเข้า Supabase (เวอร์ชันตรวจสอบรายกล่องใบลา)
// ==========================================================================
async function saveLeave() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) { showToast("ไม่สามารถเชื่อมต่อ Supabase", "error"); return; }

  let employeeId = "9a8036a8-3b03-4802-9520-59934fe621e3"; 
  try {
    const cachedUser = JSON.parse(sessionStorage.getItem("currentUser"));
    if (cachedUser && cachedUser.id) employeeId = cachedUser.id;
  } catch(e) {}

  const boxes = Array.from(document.querySelectorAll(".leave-box-item"));
  if (!boxes.length) { 
    showToast("กรุณาเพิ่มรายการลาอย่างน้อย 1 รายการ", "error"); 
    return; 
  }

  const payload = [];

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const leaveTypeId = box.querySelector('[name="leave_type_id"]')?.value;
    const startDate = box.querySelector('[name="start_date"]')?.value;
    const endDate = box.querySelector('[name="end_date"]')?.value;
    const totalDays = Number(box.querySelector('[name="leave_days"]')?.value || 0);
    const reason = box.querySelector('[name="reason"]')?.value?.trim() || "";

    if (!leaveTypeId) { showToast(`กล่องรายการที่ ${i + 1}: กรุณาเลือก "ประเภทการลา"`, "error"); return; }
    if (!startDate)   { showToast(`กล่องรายการที่ ${i + 1}: กรุณาระบุ "เริ่มวันที่"`, "error"); return; }
    if (!endDate)     { showToast(`กล่องรายการที่ ${i + 1}: กรุณาระบุ "ถึงวันที่"`, "error"); return; }
    if (totalDays <= 0) { showToast(`กล่องรายการที่ ${i + 1}: จำนวนวันลาต้องมากกว่า 0`, "error"); return; }
    if (!reason)      { showToast(`กล่องรายการที่ ${i + 1}: กรุณากรอก "สาเหตุ / เหตุผลการลา"`, "error"); return; }

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

    console.log("✅ [SAVE SUCCESS] บันทึกสำเร็จ:", data);
    showToast("✅ ส่งคำขอลาเรียบร้อยแล้ว!", "success");
    setTimeout(() => { window.location.href = "/pages/user/leave-history.html"; }, 1200);
  } catch (err) {
    console.error("❌ [CATCH ERROR] เกิดข้อผิดพลาด:", err);
    showToast(err.message || "เกิดข้อผิดพลาดในการบันทึก", "error");
  }
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

// ─── 7. INITIALIZATION (เรียงลำดับชีวิตการเปิดหน้าเว็บใหม่) ───
document.addEventListener("DOMContentLoaded", async () => {
  await loadLeaveTypes();   // 1. ดึงประเภทใบลาจริงจาก Supabase
  fetchCurrentUserData();   // 2. ดึงข้อมูลพนักงานตัวอย่าง (และซ่อนกล่องหมุนโหลด ⏳)
  addLeaveRow();            // 3. งอกกล่องแรกขึ้นมาทันทีอย่างสวยงาม
});

