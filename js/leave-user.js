/**
 * leave-user.js — ใบลาออนไลน์ PVT HR (เวอร์ชันแก้ไขระบบเช็กวันหยุดและจัดโครงสร้างสมบูรณ์)
 * ✅ ป้องกันการเลือก/ยื่นลาในวันอาทิตย์และวันหยุดบริษัท
 * ✅ หักวันหยุดประจำปีและวันเสาร์-อาทิตย์ออกจากจำนวนวันลาอัตโนมัติ
 * ✅ คงชื่อตาราง Supabase เดิมครบถ้วน 100% (leave_types, employees, leave_balances, holidays, notifications, leave_requests)
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบติดตามข้อมูลใบลาเวอร์ชันเสถียรแล้ว...");

// ==========================================
// 📦 GLOBAL VARIABLES
// ==========================================
let employees = [];
let leaveTypes = [];          // ประเภทการลาจากฐานข้อมูล leave_types
let cachedHolidays = [];      // วันหยุดบริษัทจากตาราง holidays (YYYY-MM-DD)
let currentProfile = null;
let isHRRole = false;

window.employeeLeaveBalances = []; 
window.systemLeaveTypes = [];

// ==========================================
// 🗓️ 1. ระบบดึงและจัดการวันหยุดบริษัท (holidays)
// ==========================================

// ดึงรายการวันหยุดทั้งหมดของปีปัจจุบันจากตาราง holidays
async function loadCompanyHolidays() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return [];

  const currentYear = new Date().getFullYear();
  try {
    const { data: holidays, error } = await sb
      .from('holidays')
      .select('holiday_date')
      .gte('holiday_date', `${currentYear}-01-01`)
      .lte('holiday_date', `${currentYear}-12-31`);

    if (error) {
      console.warn('⚠️ ไม่สามารถดึงวันหยุดบริษัทได้:', error.message);
      return [];
    }

    cachedHolidays = (holidays || []).map(h => h.holiday_date);
    console.log(`✅ [HOLIDAYS SUCCESS] โหลดวันหยุดบริษัทสำเร็จ ${cachedHolidays.length} รายการ:`, cachedHolidays);
    return cachedHolidays;
  } catch (err) {
    console.error('❌ ดึงวันหยุดล้มเหลว:', err);
    return [];
  }
}

// ฟังก์ชันตรวจสอบความถูกต้องของวันที่เลือกลา
async function validateLeaveDate(selectedDateStr) {
  if (!selectedDateStr) return true;

  const selectedDate = new Date(selectedDateStr);
  
  // 1. เช็กว่าเป็นวันอาทิตย์หรือไม่ (0 = วันอาทิตย์)
  if (selectedDate.getDay() === 0) {
    await Swal.fire({
      icon: 'warning',
      title: '⚠️ วันที่เลือกไม่ถูกต้อง',
      text: 'ไม่สามารถเลือกยื่นลาในวันอาทิตย์ได้ครับ',
      confirmButtonColor: '#f59e0b'
    });
    return false;
  }

  // 2. เช็กว่าตรงกับวันหยุดบริษัทหรือไม่
  if (cachedHolidays.length === 0) {
    await loadCompanyHolidays();
  }

  if (cachedHolidays.includes(selectedDateStr)) {
    await Swal.fire({
      icon: 'warning',
      title: '⚠️ วันที่เลือกตรงกับวันหยุด',
      text: 'วันที่เลือกตรงกับวันหยุดประจำปีของบริษัท ไม่จำเป็นต้องยื่นลาครับ',
      confirmButtonColor: '#f59e0b'
    });
    return false;
  }

  return true;
}

// ฟังก์ชันจัดการ Event เมื่อผู้ใช้เปลี่ยนวันที่ในช่อง Input
async function handleDateChange(inputElement) {
  const selectedDateStr = inputElement.value;
  if (!selectedDateStr) return;

  const isValid = await validateLeaveDate(selectedDateStr);
  if (!isValid) {
    inputElement.value = ""; // ล้างค่าออกหากเลือกวันอาทิตย์หรือวันหยุด
  }
  
  // คำนวณวันลาใหม่เสมอ
  calculateLeaveDays(inputElement);
}

// ==========================================
// 📦 2. โหลดข้อมูลประเภทการลา (leave_types)
// ==========================================
async function loadLeaveTypes() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    console.error("❌ [CONFIG ERROR] ไม่พบ Supabase Client");
    return;
  }

  console.log("⏳ [FETCHING] กำลังดึงประเภทการลาจากตาราง leave_types...");
  try {
    const { data, error, status } = await sb
      .from("leave_types")
      .select("id, leave_name")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      console.warn("⚠️ [WARN] ไม่พบข้อมูลประเภทการลา ใช้ค่าสำรอง");
      leaveTypes = [];
    } else {
      leaveTypes = data;
      console.log(`✅ [LEAVE TYPES SUCCESS] พบข้อมูลทั้งหมด ${leaveTypes.length} รายการ:`, leaveTypes);
    }
  } catch (err) {
    console.error("❌ [CRITICAL] ระบบล้มเหลวในการดึงข้อมูลประเภทการลา:", err.message);
  }
}

// ==========================================
// 👤 3. ฟังก์ชันดึงข้อมูลพนักงานและยอดวันลา (employees, leave_balances)
// ==========================================
async function fetchCurrentUserData() {
  console.log("🌊 [SYSTEM] กำลังดึงข้อมูลพนักงานและยอดวันลา...");
  
  try {
    const supabase = window.pvtSupabase?.getClient();
    if (!supabase) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูล Supabase ได้");

    let currentUserId = null;
    const sessionStr = localStorage.getItem("currentUser");
    if (sessionStr) {
      try { currentUserId = JSON.parse(sessionStr).id; } catch(e){}
    }
    if (!currentUserId) currentUserId = localStorage.getItem("currentUserId");

    if (!currentUserId) {
      Swal.fire('แจ้งเตือน', 'ไม่พบเซสชัน กรุณาล็อกอินใหม่ครับ', 'warning');
      return; 
    }

    // 3.1 ดึงข้อมูล Profile พนักงานจากตาราง employees
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select(`*, departments ( department_name ), positions ( position_name )`)
      .eq('id', currentUserId)
      .single();

    if (empError) throw empError;

    // 3.2 ดึงยอดวันลาคงเหลือปีปัจจุบันจากตาราง leave_balances
    const currentYear = new Date().getFullYear();
    const { data: leaveData } = await supabase
      .from('leave_balances')
      .select('leave_type_id, remaining_days') 
      .eq('employee_id', currentUserId)
      .eq('year', currentYear);

    // 3.3 ดึงชื่อประเภทการลาทั้งหมดจากตาราง leave_types
    const { data: typeData } = await supabase
      .from('leave_types')
      .select('id, leave_name');

    window.employeeLeaveBalances = leaveData || [];
    window.systemLeaveTypes = typeData || [];

    if (typeof window.renderAllLeaveBalances === 'function') {
      window.renderAllLeaveBalances();
    }

    const realUser = {
      id: empData.id,
      employee_code: empData.employee_code || "-",
      full_name: empData.full_name || "-",
      role: empData.role || empData.position_name || "employee",
      department_name: empData.departments?.department_name || empData.department_id || "ไม่ได้ระบุแผนก", 
      position_name: empData.positions?.position_name || empData.position_id || "ไม่ได้ระบุตำแหน่ง",
      start_date: empData.start_date || "-"
    };

    currentProfile = realUser;
    localStorage.setItem("currentUser", JSON.stringify(realUser));

    // ตกแต่ง Input บนหน้าเว็บ
    const setTealInputStyle = (elementId, value) => {
      const el = document.getElementById(elementId);
      if (el) {
        el.value = value;
        el.style.fontSize = "15px";
        el.style.fontWeight = "500";
        el.style.color = "#0f766e"; 
        el.style.background = "rgba(255, 255, 255, 0.7)";
        el.style.border = "1px solid rgba(13, 148, 136, 0.2)";
        el.style.borderRadius = "8px";
        el.style.padding = "8px 12px";
      }
    };

    setTealInputStyle("employeeCode", realUser.employee_code);
    setTealInputStyle("employeeName", realUser.full_name);
    setTealInputStyle("employeePosition", realUser.position_name);
    setTealInputStyle("employeeDepartment", realUser.department_name);
    setTealInputStyle("employeeStartDate", realUser.start_date);

    const loadingBadge = document.getElementById('loadingBadge');
    if (loadingBadge) loadingBadge.style.display = 'none';

  } catch (error) {
    console.error("❌ ERROR ดึงข้อมูล:", error);
    const container = document.getElementById("leaveBalancesContainer");
    if(container) container.innerHTML = `<p style="color:red; font-size:14px; margin:0;">เกิดข้อผิดพลาดในการโหลดข้อมูลวันลา</p>`;
  }
}

// ==========================================
// 🎨 4. วาดกล่องโควตาวันลาคงเหลือ
// ==========================================
window.renderAllLeaveBalances = function() {
  const container = document.getElementById("leaveBalancesContainer");
  if (!container) return;

  container.innerHTML = "";

  const leaveBalances = window.employeeLeaveBalances || [];
  const systemLeaveTypes = window.systemLeaveTypes || [];

  if (leaveBalances.length === 0 && systemLeaveTypes.length === 0) {
    container.innerHTML = "<p style='color:#ef4444; font-size:14px; margin: 0;'>❌ ยังไม่มีข้อมูลโควตาวันลาในปีนี้</p>";
    return;
  }

  let displayItems = [];

  if (systemLeaveTypes.length > 0) {
    displayItems = systemLeaveTypes.map(type => {
      const matchedBal = leaveBalances.find(b => String(b.leave_type_id) === String(type.id));
      return {
        typeName: type.leave_name || "สิทธิ์การลา",
        remaining: matchedBal ? (parseFloat(matchedBal.remaining_days) || 0) : 0
      };
    });
  } else {
    displayItems = leaveBalances.map(balance => {
      return {
        typeName: balance.leave_types?.leave_name || "สิทธิ์การลา",
        remaining: parseFloat(balance.remaining_days) || 0
      };
    });
  }

  displayItems.forEach(item => {
    const typeName = item.typeName;
    const remaining = item.remaining;

    let colorClass = ""; 
    if (typeName.includes("ป่วย")) colorClass = "sick";
    else if (typeName.includes("กิจ")) colorClass = "personal";
    else if (typeName.includes("พักผ่อน") || typeName.includes("พักร้อน")) colorClass = "vacation";

    const box = document.createElement("div");
    box.className = `leave-quota-box ${colorClass}`;
    box.innerHTML = `
      <div class="leave-quota-name">${typeName}</div>
      <div class="leave-quota-days">${remaining} <span class="unit">วัน</span></div>
    `;
    container.appendChild(box);
  });
};

// ==========================================
// 🎯 5. อัปเดตยอดคงเหลือเมื่อเลือกประเภทวันลา
// ==========================================
window.updateLeaveBalanceDisplay = function(selectedTypeId) {
  console.log("🔍 [DEBUG] เลือกประเภทการลา ID:", selectedTypeId);

  const balances = window.employeeLeaveBalances || [];
  const matchedBalance = balances.find(b => String(b.leave_type_id) === String(selectedTypeId));
  const remainingDays = matchedBalance ? parseFloat(matchedBalance.remaining_days) : 0;

  console.log(`ℹ️ [LEAVE BALANCE] สิทธิ์คงเหลือ: ${remainingDays} วัน`);

  const balanceInput = document.getElementById("leaveBalance");
  if (balanceInput) {
    balanceInput.value = `${remainingDays} วัน`;
    balanceInput.style.fontWeight = "700";
    balanceInput.style.fontSize = "16px";
    balanceInput.style.border = "1px solid #2dd4bf";

    if (remainingDays <= 0) {
      balanceInput.style.color = "#ef4444"; 
      balanceInput.style.background = "#fef2f2"; 
    } else {
      balanceInput.style.color = "#0d9488"; 
      balanceInput.style.background = "rgba(240, 253, 250, 0.8)";
    }
  }

  if (remainingDays <= 0 && selectedTypeId) {
    Swal.fire({
      icon: 'warning',
      title: 'แจ้งเตือนโควตาวันลา',
      html: `คุณไม่มีสิทธิ์วันลาคงเหลือสำหรับประเภทนี้แล้ว<br><span style="color:#ef4444; font-size:13px;">(หากยื่นคำขอ ระบบจะส่งให้ HR พิจารณาเป็นกรณีพิเศษ)</span>`,
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'รับทราบ'
    });
  }
};

// ==========================================
// 🚀 6. ฟังก์ชันเพิ่มกล่องรายการลาใหม่ 
// ==========================================
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
        <input type="date" name="start_date" onchange="handleDateChange(this)">
      </div>
      <div class="input-group">
        <label>ถึงวันที่ลา</label>
        <input type="date" name="end_date" onchange="handleDateChange(this)">
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
        <select name="leave_type_id" class="form-select" onchange="updateLeaveBalanceDisplay(this.value)" required>
          <option value="" disabled selected>-- เลือกประเภทการลา --</option>
        </select>
      </div>
      <div class="input-group">
        <label>สาเหตุ / เหตุผลการลา</label>
        <input type="text" placeholder="ระบุเหตุผลความจำเป็น..." name="reason" required>
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

  // ดึงประเภทการลาใส่ Dropdown
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
// 🧮 7. ฟังก์ชันคำนวณจำนวนวันลาอัตโนมัติ (หักวันอาทิตย์ วันเสาร์ และวันหยุดบริษัท)
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

  // 📍 นับเฉพาะวันทำงาน (ข้ามเสาร์-อาทิตย์ และวันหยุดบริษัท)
  let totalWorkDays = 0;
  let currentDate = new Date(start);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay(); // 0 = วันอาทิตย์, 6 = วันเสาร์
    const dateFormatted = currentDate.toISOString().split('T')[0];

    const isSunday = (dayOfWeek === 0);
    const isSaturday = (dayOfWeek === 6);
    const isCompanyHoliday = cachedHolidays.includes(dateFormatted);

    // คำนวณเฉพาะวันที่ไม่อยู่ในวันหยุด
    if (!isSunday && !isSaturday && !isCompanyHoliday) {
      totalWorkDays++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  let totalDays = totalWorkDays;

  // จัดการเศษชั่วโมง
  const extraDays = (hrMorning + hrAfternoon) / 8;
  if (startDateInput === endDateInput && (hrMorning > 0 || hrAfternoon > 0)) {
    totalDays = extraDays;
  } else if (hrMorning > 0 || hrAfternoon > 0) {
    totalDays = (totalDays > 0 ? totalDays - 1 : 0) + extraDays;
  }

  resultInput.value = totalDays % 1 === 0 ? totalDays : totalDays.toFixed(1);
}

// ==========================================
// 📸 8. ฟังก์ชันเปลี่ยนชื่อปุ่มเมื่อแนบรูป
// ==========================================
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

// ==========================================
// 🔔 9. ฟังก์ชันส่งการแจ้งเตือน (notifications)
// ==========================================
async function sendNotification(title, message, type = 'leave', targetUrl = '/pages/hr/pages/hr/hr.html') {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { error } = await sb.from("notifications").insert([{
      title: title,
      message: message,
      type: type,
      target_url: targetUrl,
      created_at: new Date().toISOString(),
      is_read: false
    }]);

    if (error) console.warn("⚠️ บันทึกแจ้งเตือนลง DB ไม่สำเร็จ:", error.message);
  } catch (err) {
    console.error("❌ Notification Error:", err);
  }
}

// ==========================================
// 💾 10. ฟังก์ชันบันทึกคำขอใบลา (leave_requests)
// ==========================================
async function saveLeave() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    Swal.fire({ 
      icon: 'error', 
      title: 'การเชื่อมต่อขัดข้อง', 
      text: 'ไม่พบการเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง', 
      confirmButtonColor: '#ef4444' 
    });
    return;
  }

  if (!currentProfile) {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try { currentProfile = JSON.parse(savedUser); } catch(e){}
    }
  }

  if (!currentProfile) {
    Swal.fire({ 
      icon: 'error', 
      title: 'ไม่พบข้อมูลผู้ใช้งาน', 
      text: 'กรุณารีเฟรชหน้าเว็บ หรือเข้าสู่ระบบใหม่อีกครั้ง', 
      confirmButtonColor: '#ef4444' 
    });
    return;
  }

  const cards = document.querySelectorAll("#leaveCardsList .leave-box-item");
  if (cards.length === 0) {
    Swal.fire({ 
      icon: 'warning', 
      title: 'ข้อมูลไม่ครบถ้วน', 
      text: 'กรุณาเพิ่มรายการลาอย่างน้อย 1 รายการครับ', 
      confirmButtonColor: '#f59e0b' 
    });
    return;
  }

  const rawRole = currentProfile.role || 
                  currentProfile.position_name || 
                  localStorage.getItem("userRole") || 
                  "";
  
  const userRole = String(rawRole).toLowerCase().trim();

  let defaultManagerStatus = "pending";
  let defaultDirectorStatus = "pending";

  if (
    userRole.includes("leader") || 
    userRole.includes("supervisor") || 
    userRole.includes("head") || 
    userRole.includes("หัวหน้า")
  ) {
    defaultManagerStatus = "approved";
  } else if (
    userRole.includes("manager") || 
    userRole.includes("director") || 
    userRole.includes("ผู้จัดการ") || 
    userRole.includes("บริหาร") ||
    userRole.includes("admin")
  ) {
    defaultManagerStatus = "approved";
    defaultDirectorStatus = "approved";
  }

  const payload = [];
  let hasError = false;
  let hasWarning = false;

  for (let index = 0; index < cards.length; index++) {
    const card = cards[index];

    const leaveTypeId = card.querySelector('select[name="leave_type_id"]')?.value;
    const startDate = card.querySelector('input[name="start_date"]')?.value;
    const endDate = card.querySelector('input[name="end_date"]')?.value;
    let reason = card.querySelector('input[name="reason"]')?.value || ""; 
    const hoursMorning = parseFloat(card.querySelector('input[name="hours_morning"]')?.value) || 0;
    const hoursAfternoon = parseFloat(card.querySelector('input[name="hours_afternoon"]')?.value) || 0;
    const fileInput = card.querySelector('input[type="file"]');
    
    let totalDays = parseFloat(card.querySelector('input[name="leave_days"]')?.value);
    if (isNaN(totalDays)) totalDays = 0;

    // 🔴 [เงื่อนไขที่ 1] ตรวจสอบการกรอกวันที่
    if (!leaveTypeId || !startDate || !endDate) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'ข้อมูลไม่สมบูรณ์', 
        text: `กรุณากรอกวันที่และประเภทการลาให้ครบในรายการที่ ${index + 1}`, 
        confirmButtonColor: '#f59e0b' 
      });
      hasError = true;
      break; 
    }

    // 🔴 [เงื่อนไขที่ 2] ตรวจสอบวันอาทิตย์และวันหยุดอีกครั้งก่อนเซฟ
    const isStartValid = await validateLeaveDate(startDate);
    const isEndValid = await validateLeaveDate(endDate);
    if (!isStartValid || !isEndValid) {
      hasError = true;
      break;
    }

    // 🔴 [เงื่อนไขที่ 3] ตรวจสอบว่าจำนวนวันลาต้องมากกว่า 0
    if (totalDays <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'จำนวนวันลาไม่ถูกต้อง',
        text: `รายการที่ ${index + 1} วันที่เลือกตรงกับวันหยุดทั้งหมด ทำให้ไม่มีวันลาจริง`,
        confirmButtonColor: '#f59e0b'
      });
      hasError = true;
      break;
    }

    // 🔴 [เงื่อนไขที่ 4] บังคับระบุเหตุผลการลา
    if (!reason.trim()) {
      Swal.fire({ 
        icon: 'warning', 
        title: 'กรุณาระบุเหตุผล', 
        text: `กรุณากรอก "สาเหตุ / เหตุผลการลา" ในรายการที่ ${index + 1}`, 
        confirmButtonColor: '#f59e0b' 
      });
      hasError = true;
      break;
    }

    const leaveTypeObj = (leaveTypes || []).find(t => String(t.id) === String(leaveTypeId));
    const leaveName = leaveTypeObj ? leaveTypeObj.leave_name : "";

    // 🔴 [เงื่อนไขที่ 5] ลาป่วยตั้งแต่ 3 วันขึ้นไป ต้องแนบรูป
    const isSickLeave = leaveName.includes("ป่วย") || leaveName.toLowerCase().includes("sick");
    if (isSickLeave && totalDays >= 3) {
      const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;
      if (!hasFile) {
        Swal.fire({
          icon: 'warning',
          title: 'ต้องแนบใบรับรองแพทย์',
          html: `รายการที่ ${index + 1} เป็นการลาป่วยตั้งแต่ 3 วันขึ้นไป (จำนวน ${totalDays} วัน)<br><span style="color: #ef4444; font-weight: 500;">ต้องแนบรูปภาพใบรับรองแพทย์ตามที่กฎหมายกำหนดครับ</span>`,
          confirmButtonColor: '#ea580c'
        });
        hasError = true;
        break;
      }
    }

    // 🛡️ [เงื่อนไขที่ 6] ลาพักร้อนเกิน 3 วัน
    if (leaveName.includes("พักผ่อน") || leaveName.includes("พักร้อน") || leaveName.toLowerCase().includes("vacation")) {
      if (totalDays > 3) {
        Swal.fire({
          icon: 'warning',
          title: 'เงื่อนไขการลาพักผ่อนประจำปี',
          html: `ไม่สามารถลาพักร้อนรวดเดียวเกิน <b>3 วัน</b> ได้ค่ะ<br><br>
                 <span style="color: #ea580c; font-weight: 600;">💡 แนวทางปฏิบัติ:</span><br>
                 หากต้องการลาหลายวันต่อเนื่อง ต้องแบ่งเพิ่มรายการลาแยกกัน`,
          confirmButtonColor: '#ea580c'
        });
        hasError = true;
        break; 
      }
    }

    // 🎯 [เงื่อนไขที่ 7] ตรวจสอบโควตาคงเหลือ
    if (window.employeeLeaveBalances) {
      const matchedBalance = window.employeeLeaveBalances.find(b => String(b.leave_type_id) === String(leaveTypeId));
      const remainingDays = matchedBalance ? parseFloat(matchedBalance.remaining_days) : 0;

      if (totalDays > remainingDays) {
        Swal.fire({
          icon: 'warning',
          title: 'ยื่นลาเกินโควตา',
          text: `รายการที่ ${index + 1} คุณเหลือสิทธิอีกเพียง ${remainingDays} วัน ระบบจะส่งคำขอนี้ให้ HR พิจารณาเป็นกรณีพิเศษ`,
          confirmButtonColor: '#f59e0b'
        });
        hasWarning = true; 
      }
    }

    const totalHours = hoursMorning + hoursAfternoon;
    const startPeriod = hoursMorning > 0 ? "half_day" : "full_day";
    const endPeriod = hoursAfternoon > 0 ? "half_day" : "full_day";

    payload.push({
      employee_id:     currentProfile.id || currentProfile.employee_id, 
      leave_type_id:   leaveTypeId,
      start_date:      startDate,
      end_date:        endDate,
      total_days:      totalDays,
      reason:          reason.trim(),  
      status:          "pending",          
      manager_status:  defaultManagerStatus,
      director_status: defaultDirectorStatus,
      leave_hours:     totalHours,
      start_period:    startPeriod,
      end_period:      endPeriod
    });
  }

  if (hasError) return;

  const saveBtn = document.getElementById("btnSaveLeave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ <span style='opacity:0.8;'>กำลังส่งคำขอ...</span>";
  }

  try {
    // บันทึกลงตาราง leave_requests
    const { data, error } = await sb.from("leave_requests").insert(payload).select();

    if (error) {
      console.error("❌ บันทึกผิดพลาด:", error);
      Swal.fire({
        icon: 'warning',
        title: 'ไม่สามารถยื่นใบลาได้',
        text: error.message || "เกิดข้อผิดพลาดบางอย่าง กรุณาตรวจสอบข้อมูล",
        confirmButtonColor: '#f59e0b'
      });
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = "💾 บันทึกคำขอลา";
      }
      return; 
    }

    const empName = currentProfile.full_name || 'พนักงาน';
    await sendNotification(
      'คำขอลาใหม่', 
      `${empName} ได้ยื่นคำขอลาใหม่จำนวน ${payload.length} รายการ`, 
      'leave', 
      '/pages/hr/pages/hr/hr.html'
    );

    Swal.fire({
      title: 'ส่งคำขอลาสำเร็จ!',
      text: 'ระบบได้ส่งใบลาของคุณไปให้ผู้อนุมัติพิจารณาเรียบร้อยแล้ว',
      icon: 'success',
      confirmButtonColor: '#0f766e',
      timer: 2000,
      showConfirmButton: false
    }).then(() => {
      window.location.href = "/pages/user/index-user.html";
    });

  } catch (err) {
    console.error("❌ System Error:", err);
    Swal.fire({
      icon: 'error',
      title: 'ระบบขัดข้อง',
      text: err.message || "เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง",
      confirmButtonColor: '#ef4444'
    });
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = "💾 บันทึกคำขอลา";
    }
  }
}

// ==========================================
// 🔮 11. เมนูคู่มือและการทำงานเริ่มต้น (Initialization)
// ==========================================
function toggleFormLeaveGuide() {
  const card = document.getElementById("form-leave-guide-card");
  const icon = document.getElementById("form-leave-guide-icon");
  const btn = document.getElementById("form-leave-guide-fab");
  
  if (!card) return;

  const isHidden = card.style.display === "none" || card.style.display === "";

  if (isHidden) {
    card.style.display = "block";
    if (icon) icon.innerText = "close";
    if (btn) {
      btn.style.background = "#ef4444";
      btn.style.color = "#ffffff";
      btn.style.borderColor = "#fecaca";
    }
  } else {
    card.style.display = "none";
    if (icon) icon.innerText = "help";
    if (btn) {
      btn.style.background = "rgba(255, 255, 255, 0.9)";
      btn.style.color = "#0891b2";
      btn.style.borderColor = "rgba(6, 182, 212, 0.4)";
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadCompanyHolidays(); // 1. โหลดตารางวันหยุดประจำปี (holidays)
  await loadLeaveTypes();      // 2. โหลดประเภทการลา (leave_types)
  await fetchCurrentUserData(); // 3. โหลดข้อมูลพนักงานและยอดคงเหลือ
  addLeaveRow();               // 4. เพิ่มการ์ดใบแรกตั้งต้น
});