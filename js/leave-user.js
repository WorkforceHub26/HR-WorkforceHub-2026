/**
 * leave-user.js — ใบลาออนไลน์ PVT HR (เวอร์ชันปรับปรุงความเสถียรสูงสุด + Auto-Split)
 * ✅ ป้องกันการเลือก/ยื่นลาในวันอาทิตย์และวันหยุดบริษัท
 * ✅ แก้ไข Timezone Offset ด้วย parseLocalDate (ป้องกันวันที่คลาดเคลื่อน)
 * ✅ ระบบตรวจจับและแยกใบลาข้ามรอบปีอัตโนมัติ (Auto-Split ณ 1 ธ.ค.)
 * ✅ ตรวจสอบวันลาซ้อนทับกับคำขอเดิมในฐานข้อมูล (Leave Overlap Validation)
 * ✅ ตรวจสอบโควตาแยกตามรอบปี (Cross-Year Quota Validation)
 * ✅ ป้องกันการลบการ์ดใบลาจนหมดหน้าจอ
 * ✅ ระบบ Rollback ลบรูปภาพออกจาก Supabase Storage อัตโนมัติหากบันทึก DB ล้มเหลว
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบติดตามข้อมูลใบลาเวอร์ชันเสถียรสูงสุดแล้ว...");

// ==========================================
// 📦 GLOBAL VARIABLES
// ==========================================
let employees = [];
let leaveTypes = [];          
let cachedHolidays = [];      
let currentProfile = null;
let isHRRole = false;

window.employeeLeaveBalances = []; 
window.systemLeaveTypes = [];

// ==========================================
// 🛠️ HELPER FUNCTIONS
// ==========================================

// แปลง String "YYYY-MM-DD" เป็น Date Object แบบ Local Time (ป้องกันปัญหา Timezone Offset)
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// คำนวณวันทำงานจริงในช่วงวันที่กำหนด (ไม่นับวันอาทิตย์และวันหยุดบริษัท)
function countWorkDaysInRange(startDateStr, endDateStr) {
  let totalWorkDays = 0;
  let currentDate = parseLocalDate(startDateStr);
  const endDate = parseLocalDate(endDateStr);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); // 0 = วันอาทิตย์
    const dateFormatted = currentDate.toISOString().split('T')[0];

    const isSunday = (dayOfWeek === 0);
    const isCompanyHoliday = cachedHolidays.includes(dateFormatted);

    if (!isSunday && !isCompanyHoliday) {
      totalWorkDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return totalWorkDays;
}

// ดึงโควตาวันลาคงเหลือตามประเภทและรอบปี
function getBalanceForYear(leaveTypeId, year) {
  const balances = window.employeeLeaveBalances || [];
  const matched = balances.find(b => String(b.leave_type_id) === String(leaveTypeId) && Number(b.year) === Number(year));
  return matched ? parseFloat(matched.remaining_days) : 0;
}

// ตรวจสอบวันลาซ้อนทับกับคำขอเดิมในฐานข้อมูล (Pending / Approved)
async function checkOverlappingLeave(employeeId, startDate, endDate) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return false;

  try {
    const { data, error } = await sb
      .from('leave_requests')
      .select('id, start_date, end_date, status')
      .eq('employee_id', employeeId)
      .in('status', ['pending', 'approved'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (error) {
      console.warn("⚠️ ไม่สามารถเช็กวันซ้อนทับได้:", error.message);
      return false;
    }

    return data && data.length > 0;
  } catch (err) {
    console.error("❌ Overlap Check Error:", err);
    return false;
  }
}

// ==========================================
// 🗓️ 1. ระบบดึงและจัดการวันหยุดบริษัท (holidays)
// ==========================================

async function loadCompanyHolidays() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return [];

  const currentYear = new Date().getFullYear();
  try {
    const { data: holidays, error } = await sb
      .from('holidays')
      .select('holiday_date')
      .gte('holiday_date', `${currentYear - 1}-01-01`)
      .lte('holiday_date', `${currentYear + 1}-12-31`);

    if (error) {
      console.warn('⚠️ ไม่สามารถดึงวันหยุดบริษัทได้:', error.message);
      return [];
    }

    cachedHolidays = (holidays || []).map(h => h.holiday_date);
    console.log(`✅ [HOLIDAYS SUCCESS] โหลดวันหยุดบริษัทสำเร็จ ${cachedHolidays.length} รายการ`);
    return cachedHolidays;
  } catch (err) {
    console.error('❌ ดึงวันหยุดล้มเหลว:', err);
    return [];
  }
}

async function validateLeaveDate(selectedDateStr) {
  if (!selectedDateStr) return true;

  const selectedDate = parseLocalDate(selectedDateStr);
  
  if (selectedDate.getDay() === 0) {
    await Swal.fire({
      icon: 'warning',
      title: '⚠️ วันที่เลือกไม่ถูกต้อง',
      text: 'ไม่สามารถเลือกยื่นลาในวันอาทิตย์ได้ครับ',
      confirmButtonColor: '#f59e0b'
    });
    return false;
  }

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

async function handleDateChange(inputElement) {
  const selectedDateStr = inputElement.value;
  if (!selectedDateStr) return;

  const isValid = await validateLeaveDate(selectedDateStr);
  if (!isValid) {
    inputElement.value = ""; 
  }
  
  calculateLeaveDays(inputElement);
}

// ==========================================
// 📦 2. โหลดข้อมูลประเภทการลา (leave_types)
// ==========================================
async function loadLeaveTypes() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const { data, error } = await sb
      .from("leave_types")
      .select("id, leave_name")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) throw error;
    leaveTypes = data || [];
  } catch (err) {
    console.error("❌ [CRITICAL] ดึงประเภทการลาล้มเหลว:", err.message);
  }
}

// ==========================================
// 👤 3. ฟังก์ชันดึงข้อมูลพนักงานและยอดวันลา (employees, leave_balances)
// ==========================================
async function fetchCurrentUserData() {
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

    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select(`*, departments ( department_name ), positions ( position_name )`)
      .eq('id', currentUserId)
      .single();

    if (empError) throw empError;

    const currentYear = new Date().getFullYear();
    const { data: leaveData } = await supabase
      .from('leave_balances')
      .select('leave_type_id, remaining_days, year') 
      .eq('employee_id', currentUserId)
      .gte('year', currentYear);

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
  const currentYear = new Date().getFullYear();

  if (leaveBalances.length === 0 && systemLeaveTypes.length === 0) {
    container.innerHTML = "<p style='color:#ef4444; font-size:14px; margin: 0;'>❌ ยังไม่มีข้อมูลโควตาวันลาในปีนี้</p>";
    return;
  }

  let displayItems = systemLeaveTypes.map(type => {
    const matchedBal = leaveBalances.find(b => String(b.leave_type_id) === String(type.id) && Number(b.year) === currentYear);
    return {
      typeName: type.leave_name || "สิทธิ์การลา",
      remaining: matchedBal ? (parseFloat(matchedBal.remaining_days) || 0) : 0
    };
  });

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
  const currentYear = new Date().getFullYear();
  const remainingDays = getBalanceForYear(selectedTypeId, currentYear);

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
      html: `คุณไม่มีสิทธิ์วันลาคงเหลือสำหรับประเภทนี้ในรอบปีปัจจุบัน<br><span style="color:#ef4444; font-size:13px;">(หากยื่นคำขอ ระบบจะส่งให้ HR พิจารณาเป็นกรณีพิเศษ)</span>`,
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'รับทราบ'
    });
  }
};

// ==========================================
// 🚀 6. ฟังก์ชันเพิ่ม/ลบกล่องรายการลา
// ==========================================
function removeLeaveRow(button) {
  const cards = document.querySelectorAll("#leaveCardsList .leave-box-item");
  if (cards.length > 1) {
    button.closest('.leave-box-item').remove();
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'ไม่สามารถลบได้',
      text: 'ต้องมีรายการยื่นลาอย่างน้อย 1 รายการในแบบฟอร์มครับ',
      confirmButtonColor: '#f59e0b'
    });
  }
}

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
        <!-- 🔒 ล็อควันที่เขียนคำขอเป็นวันปัจจุบัน ห้ามแก้ไข -->
        <input type="date" name="write_date" value="${new Date().toISOString().split('T')[0]}" readonly tabindex="-1" class="readonly-highlight" style="background-color: #f1f5f9; color: #64748b; cursor: not-allowed; pointer-events: none;">
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

    <div class="split-preview-container" style="display:none; margin-top:15px;"></div>

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
      <button type="button" class="btn btn-danger btn-sm" onclick="removeLeaveRow(this)">ลบรายการนี้</button>
    </div>
  `;

  container.appendChild(boxItem);

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
// 🧮 7. ฟังก์ชันคำนวณจำนวนวันลา + UI Preview แสดงการตัดรอบปี
// ==========================================================================
function calculateLeaveDays(element) {
  const boxItem = element.closest('.leave-box-item');
  if (!boxItem) return;

  const startDateInput = boxItem.querySelector('input[name="start_date"]').value;
  const endDateInput = boxItem.querySelector('input[name="end_date"]').value;
  const hrMorning = parseFloat(boxItem.querySelector('input[name="hours_morning"]').value) || 0;
  const hrAfternoon = parseFloat(boxItem.querySelector('input[name="hours_afternoon"]').value) || 0;
  const resultInput = boxItem.querySelector('input[name="leave_days"]');
  const previewContainer = boxItem.querySelector('.split-preview-container');

  if (!startDateInput || !endDateInput) {
    resultInput.value = 0;
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  const start = parseLocalDate(startDateInput);
  const end = parseLocalDate(endDateInput);
  
  if (end < start) {
    resultInput.value = 0;
    if (previewContainer) previewContainer.style.display = 'none';
    return;
  }

  const startYear = start.getFullYear();
  const cutoffDateStr = `${startYear}-11-30`;
  const cutoffDate = parseLocalDate(cutoffDateStr);

  const isCrossCycle = (start <= cutoffDate && end > cutoffDate);

  if (isCrossCycle) {
    const chunk1EndStr = `${startYear}-11-30`;
    const chunk2StartStr = `${startYear}-12-01`;

    let days1 = countWorkDaysInRange(startDateInput, chunk1EndStr);
    let days2 = countWorkDaysInRange(chunk2StartStr, endDateInput);

    if (hrMorning > 0) days1 = Math.max(0, days1 - 1) + (hrMorning / 8);
    if (hrAfternoon > 0) days2 = Math.max(0, days2 - 1) + (hrAfternoon / 8);

    const totalDays = days1 + days2;
    resultInput.value = totalDays % 1 === 0 ? totalDays : totalDays.toFixed(1);

    if (previewContainer) {
      previewContainer.style.display = 'block';
      previewContainer.innerHTML = `
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:12px; color:#166534; font-size:13.5px; line-height:1.6;">
          <div style="font-weight:700; font-size:14px; margin-bottom:4px; color:#15803d; display:flex; align-items:center; gap:6px;">
            <span>ℹ️</span> ระบบตรวจพบการลางานข้ามรอบปี (ตัดรอบ 1 ธ.ค.)
          </div>
          <div>รายการนี้จะถูกแยกบันทึกเป็น <b>2 คำขอ</b> ให้อัตโนมัติ:</div>
          <ul style="margin:6px 0 0 18px; padding:0;">
            <li><b>ใบที่ 1 (รอบปี ${startYear}):</b> ${startDateInput} ถึง ${chunk1EndStr} (ใช้ <b>${days1}</b> วัน)</li>
            <li><b>ใบที่ 2 (รอบปี ${startYear + 1}):</b> ${chunk2StartStr} ถึง ${endDateInput} (ใช้ <b>${days2}</b> วัน)</li>
          </ul>
        </div>
      `;
    }
  } else {
    if (previewContainer) previewContainer.style.display = 'none';

    let totalWorkDays = countWorkDaysInRange(startDateInput, endDateInput);
    let totalDays = totalWorkDays;

    const extraDays = (hrMorning + hrAfternoon) / 8;
    if (startDateInput === endDateInput && (hrMorning > 0 || hrAfternoon > 0)) {
      totalDays = extraDays;
    } else if (hrMorning > 0 || hrAfternoon > 0) {
      totalDays = (totalDays > 0 ? totalDays - 1 : 0) + extraDays;
    }

    resultInput.value = totalDays % 1 === 0 ? totalDays : totalDays.toFixed(1);
  }
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
// 📤 ฟังก์ชันอัปโหลดไฟล์หลักฐานขึ้น Supabase Storage (คืนค่าทั้ง URL และ Path)
// ==========================================
async function uploadAttachment(file, employeeId) {
  if (!file) return null;
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return null;

  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${employeeId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { data, error } = await sb.storage
      .from('leave-attachments')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: publicUrlData } = sb.storage
      .from('leave-attachments')
      .getPublicUrl(fileName);

    return {
      publicUrl: publicUrlData?.publicUrl || null,
      filePath: fileName
    };
  } catch (err) {
    console.error("❌ Upload Attachment Error:", err);
    throw err;
  }
}

// ==========================================
// 💾 10. ฟังก์ชันบันทึกคำขอใบลา (saveLeave)
// ==========================================
async function saveLeave() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    Swal.fire({ icon: 'error', title: 'การเชื่อมต่อขัดข้อง', text: 'ไม่พบการเชื่อมต่อฐานข้อมูล', confirmButtonColor: '#ef4444' });
    return;
  }

  if (!currentProfile) {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try { currentProfile = JSON.parse(savedUser); } catch(e){}
    }
  }

  if (!currentProfile) {
    Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูลผู้ใช้งาน', text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง', confirmButtonColor: '#ef4444' });
    return;
  }

  const cards = document.querySelectorAll("#leaveCardsList .leave-box-item");
  if (cards.length === 0) {
    Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', text: 'กรุณาเพิ่มรายการลาอย่างน้อย 1 รายการครับ', confirmButtonColor: '#f59e0b' });
    return;
  }

  const rawRole = currentProfile.role || currentProfile.position_name || localStorage.getItem("userRole") || "";
  const userRole = String(rawRole).toLowerCase().trim();

  let defaultManagerStatus = "pending";
  let defaultDirectorStatus = "pending";

  if (userRole.includes("leader") || userRole.includes("supervisor") || userRole.includes("head") || userRole.includes("หัวหน้า")) {
    defaultManagerStatus = "approved";
  } else if (userRole.includes("manager") || userRole.includes("director") || userRole.includes("ผู้จัดการ") || userRole.includes("บริหาร") || userRole.includes("admin")) {
    defaultManagerStatus = "approved";
    defaultDirectorStatus = "approved";
  }

  const payload = [];
  const uploadedPaths = []; // เก็บ Path รูปไว้สำหรับสั่ง Rollback หาก Save ล้มเหลว
  let hasError = false;
  const currentEmpId = currentProfile.id || currentProfile.employee_id;

  for (let index = 0; index < cards.length; index++) {
    const card = cards[index];

    const leaveTypeId = card.querySelector('select[name="leave_type_id"]')?.value;
    const startDate = card.querySelector('input[name="start_date"]')?.value;
    const endDate = card.querySelector('input[name="end_date"]')?.value;
    let reason = card.querySelector('input[name="reason"]')?.value || ""; 
    const hoursMorning = parseFloat(card.querySelector('input[name="hours_morning"]')?.value) || 0;
    const hoursAfternoon = parseFloat(card.querySelector('input[name="hours_afternoon"]')?.value) || 0;
    const fileInput = card.querySelector('input[type="file"]');
    const file = fileInput && fileInput.files && fileInput.files[0];
    
    let totalDays = parseFloat(card.querySelector('input[name="leave_days"]')?.value);
    if (isNaN(totalDays)) totalDays = 0;

    // 🔴 1. ตรวจสอบข้อมูลเบื้องต้น
    if (!leaveTypeId || !startDate || !endDate) {
      Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่สมบูรณ์', text: `กรุณากรอกวันที่และประเภทการลาให้ครบในรายการที่ ${index + 1}`, confirmButtonColor: '#f59e0b' });
      hasError = true; break; 
    }

    const isStartValid = await validateLeaveDate(startDate);
    const isEndValid = await validateLeaveDate(endDate);
    if (!isStartValid || !isEndValid) { hasError = true; break; }

    if (totalDays <= 0) {
      Swal.fire({ icon: 'warning', title: 'จำนวนวันลาไม่ถูกต้อง', text: `รายการที่ ${index + 1} วันที่เลือกตรงกับวันหยุดทั้งหมด`, confirmButtonColor: '#f59e0b' });
      hasError = true; break;
    }

    if (!reason.trim()) {
      Swal.fire({ icon: 'warning', title: 'กรุณาระบุเหตุผล', text: `กรุณากรอก "สาเหตุ / เหตุผลการลา" ในรายการที่ ${index + 1}`, confirmButtonColor: '#f59e0b' });
      hasError = true; break;
    }

    // 🔴 2. ตรวจสอบวันลาซ้อนทับกับคำขอเดิมในระบบ (Overlap Check)
    const isOverlapped = await checkOverlappingLeave(currentEmpId, startDate, endDate);
    if (isOverlapped) {
      Swal.fire({
        icon: 'warning',
        title: 'ยื่นวันลาซ้อนทับ',
        text: `รายการที่ ${index + 1} ช่วงวันที่ ${startDate} ถึง ${endDate} มีคำขอลาในระบบอยู่แล้ว`,
        confirmButtonColor: '#f59e0b'
      });
      hasError = true; break;
    }

    const leaveTypeObj = (leaveTypes || []).find(t => String(t.id) === String(leaveTypeId));
    const leaveName = leaveTypeObj ? leaveTypeObj.leave_name : "";

    // 🔴 3. ตรวจสอบแนบใบรับรองแพทย์ (ลาป่วย >= 3 วัน)
    const isSickLeave = leaveName.includes("ป่วย") || leaveName.toLowerCase().includes("sick");
    if (isSickLeave && totalDays >= 3 && !file) {
      Swal.fire({ icon: 'warning', title: 'ต้องแนบใบรับรองแพทย์', html: `รายการที่ ${index + 1} เป็นการลาป่วยตั้งแต่ 3 วันขึ้นไป ต้องแนบรูปภาพใบรับรองแพทย์`, confirmButtonColor: '#ea580c' });
      hasError = true; break;
    }

    // 🔴 4. อัปโหลดไฟล์หลักฐาน
    let attachmentUrl = null;
    if (file) {
      try {
        const uploadResult = await uploadAttachment(file, currentEmpId);
        if (uploadResult) {
          attachmentUrl = uploadResult.publicUrl;
          uploadedPaths.push(uploadResult.filePath);
        }
      } catch (uploadErr) {
        Swal.fire({ icon: 'error', title: 'อัปโหลดหลักฐานไม่สำเร็จ', text: `ไม่สามารถอัปโหลดรูปภาพของรายการที่ ${index + 1} ได้`, confirmButtonColor: '#ef4444' });
        hasError = true; break;
      }
    }

    // 🔴 5. Auto-Split & Cross-Year Quota Validation
    const startObj = parseLocalDate(startDate);
    const endObj = parseLocalDate(endDate);
    const startYear = startObj.getFullYear();
    const cutoffDate = parseLocalDate(`${startYear}-11-30`);

    if (startObj <= cutoffDate && endObj > cutoffDate) {
      const splitGroupId = 'GRP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const chunk1End = `${startYear}-11-30`;
      const chunk2Start = `${startYear}-12-01`;

      let days1 = countWorkDaysInRange(startDate, chunk1End);
      let days2 = countWorkDaysInRange(chunk2Start, endDate);

      if (hoursMorning > 0) days1 = Math.max(0, days1 - 1) + (hoursMorning / 8);
      if (hoursAfternoon > 0) days2 = Math.max(0, days2 - 1) + (hoursAfternoon / 8);

      // ตรวจสอบโควตาแยกแต่ละปี
      const quotaYear1 = getBalanceForYear(leaveTypeId, startYear);
      const quotaYear2 = getBalanceForYear(leaveTypeId, startYear + 1);

      if (days1 > quotaYear1 || days2 > quotaYear2) {
        console.warn(`⚠️ [QUOTA WARN] รายการข้ามรอบปีโควตาไม่พอ (ปี ${startYear}: เหลือ ${quotaYear1}, ปี ${startYear + 1}: เหลือ ${quotaYear2})`);
      }

      // ใบที่ 1 (ปีปัจจุบัน)
      payload.push({
        employee_id:     currentEmpId, 
        leave_type_id:   leaveTypeId,
        start_date:      startDate,
        end_date:        chunk1End,
        total_days:      days1,
        reason:          `${reason.trim()} (ส่วนที่ 1: ตัดรอบปี ${startYear})`,
        attachment_url:  attachmentUrl,
        status:          "pending",          
        manager_status:  defaultManagerStatus,
        director_status: defaultDirectorStatus,
        leave_hours:     hoursMorning,
        start_period:    hoursMorning > 0 ? "half_day" : "full_day",
        end_period:      "full_day",
        split_group_id:  splitGroupId
      });

      // ใบที่ 2 (ปีใหม่)
      payload.push({
        employee_id:     currentEmpId, 
        leave_type_id:   leaveTypeId,
        start_date:      chunk2Start,
        end_date:        endDate,
        total_days:      days2,
        reason:          `${reason.trim()} (ส่วนที่ 2: ตัดรอบปี ${startYear + 1})`,
        attachment_url:  attachmentUrl,
        status:          "pending",          
        manager_status:  defaultManagerStatus,
        director_status: defaultDirectorStatus,
        leave_hours:     hoursAfternoon,
        start_period:    "full_day",
        end_period:      hoursAfternoon > 0 ? "half_day" : "full_day",
        split_group_id:  splitGroupId
      });

    } else {
      // รายการปกติ
      const totalHours = hoursMorning + hoursAfternoon;
      const startPeriod = hoursMorning > 0 ? "half_day" : "full_day";
      const endPeriod = hoursAfternoon > 0 ? "half_day" : "full_day";

      payload.push({
        employee_id:     currentEmpId, 
        leave_type_id:   leaveTypeId,
        start_date:      startDate,
        end_date:        endDate,
        total_days:      totalDays,
        reason:          reason.trim(),
        attachment_url:  attachmentUrl,
        status:          "pending",          
        manager_status:  defaultManagerStatus,
        director_status: defaultDirectorStatus,
        leave_hours:     totalHours,
        start_period:    startPeriod,
        end_period:      endPeriod,
        split_group_id:  null
      });
    }
  }

  // 🧹 หากเกิด Error ให้ลบรูปภาพที่อัปโหลดไปแล้วทั้งหมดเพื่อล้าง Storage (Rollback Cleanup)
  if (hasError) {
    if (uploadedPaths.length > 0) {
      console.log("🧹 [ROLLBACK] กำลังลบรูปภาพหลักฐานออกจาก Storage...", uploadedPaths);
      await sb.storage.from('leave-attachments').remove(uploadedPaths);
    }
    return;
  }

  const saveBtn = document.getElementById("btnSaveLeave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ <span style='opacity:0.8;'>กำลังส่งคำขอ...</span>";
  }

  try {
    const { data, error } = await sb.from("leave_requests").insert(payload).select();

    if (error) {
      console.error("❌ บันทึกผิดพลาด:", error);
      // 🧹 Rollback รูปเมื่อ Insert ไม่สำเร็จ
      if (uploadedPaths.length > 0) {
        await sb.storage.from('leave-attachments').remove(uploadedPaths);
      }
      
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
      text: 'ระบบได้ทำการบันทึกข้อมูลเรียบร้อยแล้ว',
      icon: 'success',
      confirmButtonColor: '#0f766e',
      timer: 2000,
      showConfirmButton: false
    }).then(() => {
      window.location.href = "/pages/user/index-user.html";
    });

  } catch (err) {
    console.error("❌ System Error:", err);
    if (uploadedPaths.length > 0) {
      await sb.storage.from('leave-attachments').remove(uploadedPaths);
    }

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
  await loadCompanyHolidays(); 
  await loadLeaveTypes();      
  await fetchCurrentUserData(); 
  addLeaveRow();               
});