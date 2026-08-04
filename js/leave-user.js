/**
 * leave-user.js — ใบลาออนไลน์ PVT HR (เวอร์ชันแก้ไขระบบเซฟใหม่ 100%)
 * ✅ Fix Selector Mismatch (จับคู่กล่อง .leave-box-item และ name attributes ตรงจุด)
 * ✅ Auto-fill ข้อมูลพนักงานและสั่งผูกตัวแปร Global Profile ป้องกันข้อมูลหลุด
 * ✅ ตรวจสอบความถูกต้องรายกล่องใบลาและแมปโครงสร้างข้อมูลเข้า Supabase สมบูรณ์แบบ
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบติดตามข้อมูลใบลาเวอร์ชันเสถียรแล้ว...");

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

// ประกาศตัวแปร Global ไว้บนสุดของไฟล์ เพื่อเก็บตะกร้ายอดวันลาทุกประเภท
window.employeeLeaveBalances = []; 

// ==========================================
// 1. ฟังก์ชันดึงข้อมูลพนักงาน
// ==========================================
async function fetchCurrentUserData() {
  console.log("🌊 [SYSTEM] กำลังดึงข้อมูลพนักงานและยอดวันลา...");
  
  try {
    const supabase = window.pvtSupabase?.getClient();
    if (!supabase) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูล Supabase ได้");

    let currentUserId = null;
    const sessionStr = sessionStorage.getItem("currentUser");
    if (sessionStr) {
      try { currentUserId = JSON.parse(sessionStr).id; } catch(e){}
    }
    if (!currentUserId) currentUserId = sessionStorage.getItem("currentUserId");

    if (!currentUserId) {
      Swal.fire('แจ้งเตือน', 'ไม่พบเซสชัน กรุณาล็อกอินใหม่ครับ', 'warning');
      return; 
    }

    // 1.1 ดึงข้อมูล Profile พนักงาน
    const { data: empData, error: empError } = await supabase
      .from('employees')
      .select(`*, departments ( department_name ), positions ( position_name )`)
      .eq('id', currentUserId)
      .single();

    if (empError) throw empError;

    // 1.2 ดึงยอดวันลาคงเหลือปีปัจจุบัน
    const currentYear = new Date().getFullYear();
    const { data: leaveData } = await supabase
      .from('leave_balances')
      .select('leave_type_id, remaining_days') 
      .eq('employee_id', currentUserId)
      .eq('year', currentYear);

    // 1.3 ดึงชื่อประเภทการลาทั้งหมด (แยกดึงเพื่อป้องกัน Error การทำ Join)
    const { data: typeData } = await supabase
      .from('leave_types')
      .select('id, leave_name');

    // เก็บใส่ตัวแปรส่วนกลาง
    window.employeeLeaveBalances = leaveData || [];
    window.systemLeaveTypes = typeData || [];

    // 🚀 สั่งวาดกล่องทันทีหลังจากดึงข้อมูลเสร็จ!
    if (typeof window.renderAllLeaveBalances === 'function') {
      window.renderAllLeaveBalances();
    } else {
      console.error("❌ หาฟังก์ชัน renderAllLeaveBalances ไม่เจอ!");
    }

// 1.4 จัดเตรียมข้อมูลแสดงผลส่วนตัว
    const realUser = {
      id: empData.id,
      employee_code: empData.employee_code || "-",
      full_name: empData.full_name || "-",
      role: empData.role || empData.position_name || "employee", // 👈 เพิ่มบรรทัดนี้เข้ามาครับ!
      department_name: empData.departments?.department_name || empData.department_id || "ไม่ได้ระบุแผนก", 
      position_name: empData.positions?.position_name || empData.position_id || "ไม่ได้ระบุตำแหน่ง",
      start_date: empData.start_date || "-"
    };

    currentProfile = realUser;
    sessionStorage.setItem("currentUser", JSON.stringify(realUser));

    // 🎨 ใส่ข้อมูลลงช่อง HTML ข้อมูลส่วนตัว
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
    // ถ้ามี Error ให้ลบข้อความโหลด และแสดง Error แทน
    const container = document.getElementById("leaveBalancesContainer");
    if(container) container.innerHTML = `<p style="color:red; font-size:14px; margin:0;">เกิดข้อผิดพลาดในการโหลดข้อมูลวันลา</p>`;
  }
}

// ==========================================
// 🎨 ฟังก์ชันวาดกล่องโควตาวันลาแยกประเภท (เวอร์ชันเรียกใช้งานคลาส CSS)
// ==========================================
window.renderAllLeaveBalances = function() {
  const container = document.getElementById("leaveBalancesContainer");
  if (!container) return;

  container.innerHTML = ""; // ล้างข้อความโหลดออก

  const leaveBalances = window.employeeLeaveBalances || [];
  const systemLeaveTypes = window.systemLeaveTypes || [];

  // กรณีไม่มีข้อมูลประเภทการลาและยอดวันลาเลย
  if (leaveBalances.length === 0 && systemLeaveTypes.length === 0) {
    container.innerHTML = "<p style='color:#ef4444; font-size:14px; margin: 0;'>❌ ยังไม่มีข้อมูลโควตาวันลาในปีนี้</p>";
    return;
  }

  // 🎯 1. ตั้งต้นรายการที่จะแสดงผลโดยใช้ systemLeaveTypes เป็นหลัก
  let displayItems = [];

  if (systemLeaveTypes.length > 0) {
    displayItems = systemLeaveTypes.map(type => {
      // ค้นหายอดวันลาคงเหลือที่ leave_type_id ตรงกัน
      const matchedBal = leaveBalances.find(b => String(b.leave_type_id) === String(type.id));
      
      return {
        typeName: type.leave_name || "สิทธิ์การลา",
        remaining: matchedBal ? (parseFloat(matchedBal.remaining_days) || 0) : 0
      };
    });
  } else {
    // Fallback กรณีไม่ได้ดึง systemLeaveTypes มา ให้ดึงจาก leaveBalances โดยตรง
    displayItems = leaveBalances.map(balance => {
      return {
        typeName: balance.leave_types?.leave_name || "สิทธิ์การลา",
        remaining: parseFloat(balance.remaining_days) || 0
      };
    });
  }

  // 🎯 2. วนลูปวาดกล่องแสดงผลสิทธิ์วันลา
  displayItems.forEach(item => {
    const typeName = item.typeName;
    const remaining = item.remaining;

    // เลือกคลาสสีตามประเภทวันลา
    let colorClass = ""; 
    if (typeName.includes("ป่วย")) colorClass = "sick";
    else if (typeName.includes("กิจ")) colorClass = "personal";
    else if (typeName.includes("พักผ่อน") || typeName.includes("พักร้อน")) colorClass = "vacation";

    // สร้างกล่ององค์ประกอบ HTML
    const box = document.createElement("div");
    box.className = `leave-quota-box ${colorClass}`;
    box.innerHTML = `
      <div class="leave-quota-name">${typeName}</div>
      <div class="leave-quota-days">${remaining} <span class="unit">วัน</span></div>
    `;
    container.appendChild(box);
  });
};


// =========================================
// 🎯 ระบบอัปเดตยอดวันลาอัตโนมัติเมื่อพนักงานเลือกประเภทใน Dropdown (เวอร์ชันแก้บั๊ก)
// ==========================================
function updateLeaveBalanceDisplay(leaveTypeId) {
  if (!leaveTypeId) return;

  // ดึงข้อมูลโควตาคงเหลือจากส่วนกลาง
  const balances = window.employeeLeaveBalances || [];
  
  // แปลงค่าเป็น String เพื่อป้องกัน Bug ชนิดข้อมูลไม่ตรงกัน (String vs Number)
  const matchedBalance = balances.find(b => String(b.leave_type_id) === String(leaveTypeId));
  const remainingDays = matchedBalance ? parseFloat(matchedBalance.remaining_days) : 0;

  console.log(`ℹ️ [LEAVE BALANCE] เลือกประเภทวันลา ID: ${leaveTypeId} | สิทธิ์คงเหลือ: ${remainingDays} วัน`);

  // แจ้งเตือนพนักงานเบื้องต้นหากสิทธิ์การลาประเภทที่เลือกหมดแล้ว
  if (remainingDays <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'แจ้งเตือนโควตาวันลา',
      html: `คุณไม่มีสิทธิ์วันลาคงเหลือสำหรับประเภทนี้แล้ว<br><span style="color:#ef4444; font-size:13px;">(หากยื่นคำขอ ระบบจะมาร์คสถานะ [เกินโควตา] ส่งให้ HR พิจารณา)</span>`,
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'รับทราบ'
    });
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

  // ดึงประเภทการลาดีดใส่ Dropdown
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
// 🧮 4. ฟังก์ชันคำนวณจำนวนวันลาอัตโนมัติรายกล่อง
// ==========================================================================
// ==========================================================================
// 🧮 4. ฟังก์ชันคำนวณจำนวนวันลาอัตโนมัติรายกล่อง (เวอร์ชันข้ามเสาร์-อาทิตย์)
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

  // 📍 ส่วนที่เพิ่มเข้ามา: ลูปนับเฉพาะวันทำงาน (ข้ามเสาร์-อาทิตย์)
  let totalWorkDays = 0;
  let currentDate = new Date(start);

  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    // 0 = วันอาทิตย์, 6 = วันเสาร์
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      totalWorkDays++;
    }
    // เลื่อนไปวันถัดไป
    currentDate.setDate(currentDate.getDate() + 1);
  }

  let totalDays = totalWorkDays;

  // จัดการเศษชั่วโมง
  const extraDays = (hrMorning + hrAfternoon) / 8;
  if (startDateInput === endDateInput && (hrMorning > 0 || hrAfternoon > 0)) {
    totalDays = extraDays;
  } else if (hrMorning > 0 || hrAfternoon > 0) {
    // กรณีลาหลายวันแต่มีระบุชั่วโมง ให้หักวันเต็มออก 1 วัน แล้วบวกเศษชั่วโมงเข้าไปแทน
    totalDays = (totalDays > 0 ? totalDays - 1 : 0) + extraDays;
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

// ==========================================
// 🎯 ระบบอัปเดตยอดวันลาอัตโนมัติเมื่อพนักงานเลือกประเภทใน Dropdown (เวอร์ชันแก้บั๊ก)
// ==========================================
function updateLeaveBalanceDisplay(leaveTypeId) {
  if (!leaveTypeId) return;

  // ดึงข้อมูลโควตาคงเหลือจากส่วนกลาง
  const balances = window.employeeLeaveBalances || [];
  
  // แปลงค่าเป็น String เพื่อป้องกัน Bug ชนิดข้อมูลไม่ตรงกัน (String vs Number)
  const matchedBalance = balances.find(b => String(b.leave_type_id) === String(leaveTypeId));
  const remainingDays = matchedBalance ? parseFloat(matchedBalance.remaining_days) : 0;

  console.log(`ℹ️ [LEAVE BALANCE] เลือกประเภทวันลา ID: ${leaveTypeId} | สิทธิ์คงเหลือ: ${remainingDays} วัน`);

  // แจ้งเตือนพนักงานเบื้องต้นหากสิทธิ์การลาประเภทที่เลือกหมดแล้ว
  if (remainingDays <= 0) {
    Swal.fire({
      icon: 'warning',
      title: 'แจ้งเตือนโควตาวันลา',
      html: `คุณไม่มีสิทธิ์วันลาคงเหลือสำหรับประเภทนี้แล้ว<br><span style="color:#ef4444; font-size:13px;">(หากยื่นคำขอ ระบบจะมาร์คสถานะ [เกินโควตา] ส่งให้ HR พิจารณา)</span>`,
      confirmButtonColor: '#f59e0b',
      confirmButtonText: 'รับทราบ'
    });
  }
}


// ==========================================
// 🔔 1. ฟังก์ชันส่งการแจ้งเตือน (Notification Helper)
// ==========================================
async function sendNotification(title, message, type = 'leave', targetUrl = '/pages/leave-requests.html') {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    console.warn("⚠️ ไม่พบ Supabase Client ไม่สามารถส่งแจ้งเตือนได้");
    return;
  }

  try {
    // บันทึกข้อมูลการแจ้งเตือนลงตาราง `notifications` ในฐานข้อมูล
    const { error } = await sb.from("notifications").insert([{
      title: title,
      message: message,
      type: type,
      target_url: targetUrl,
      created_at: new Date().toISOString(),
      is_read: false
    }]);

    if (error) {
      console.warn("⚠️ บันทึกแจ้งเตือนลง DB ไม่สำเร็จ:", error.message);
    } else {
      console.log("✅ [NOTIFICATION] ส่งการแจ้งเตือนเรียบร้อยแล้ว");
    }
  } catch (err) {
    console.error("❌ Notification Error:", err);
  }
}

// ==========================================
// 💾 2. ฟังก์ชันบันทึกคำขอใบลา (Save Leave)
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

  // 1. ตรวจสอบโปรไฟล์พนักงาน
  if (!currentProfile) {
    const savedUser = sessionStorage.getItem("currentUser");
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

  // 2. ตรวจสอบฟอร์มใบลา
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

  // 🎯 3. ดึงและตรวจสอบ Role ของผู้ยื่นใบลาจากทุกช่องทางที่เป็นไปได้
  const rawRole = currentProfile.role || 
                  currentProfile.position_name || 
                  sessionStorage.getItem("userRole") || 
                  "";
  
  const userRole = String(rawRole).toLowerCase().trim();
  console.log("🔍 [DEBUG ROLE] ตรวจพบตำแหน่ง/สิทธิ์ของผู้ยื่น:", rawRole, "->", userRole);

  let defaultManagerStatus = "pending";
  let defaultDirectorStatus = "pending";

  // ⚡ เช็กเงื่อนไขการอนุมัติอัตโนมัติ (Auto-approve)
  if (
    userRole.includes("leader") || 
    userRole.includes("supervisor") || 
    userRole.includes("head") || 
    userRole.includes("หัวหน้า")
  ) {
    // หัวหน้ายื่นลา -> อนุมัติด่าน Manager/Leader ให้อัตโนมัติ
    defaultManagerStatus = "approved";
    console.log("⚡ [AUTO APPROVED] ระดับหัวหน้างาน -> กำหนด manager_status = 'approved'");
  } else if (
    userRole.includes("manager") || 
    userRole.includes("director") || 
    userRole.includes("ผู้จัดการ") || 
    userRole.includes("บริหาร") ||
    userRole.includes("admin")
  ) {
    // ผู้จัดการ/ผู้บริหารยื่นลา -> อนุมัติทั้งด่าน Manager และ Director ให้อัตโนมัติ
    defaultManagerStatus = "approved";
    defaultDirectorStatus = "approved";
    console.log("⚡ [AUTO APPROVED] ระดับผู้จัดการ/ผู้บริหาร -> กำหนด manager_status & director_status = 'approved'");
  } else {
    console.log("ℹ️ [REGULAR USER] พนักงานทั่วไป -> ต้องผ่านการอนุมัติตามขั้นตอนปกติ (pending)");
  }

  const payload = [];
  let hasError = false;
  let hasWarning = false;

  // 4. วนลูปเช็คข้อมูลแต่ละกล่องใบลา
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
    if (isNaN(totalDays) || totalDays <= 0) {
      totalDays = 1; 
    }

    // 🔴 [เงื่อนไขที่ 1] ตรวจสอบการกรอกวันที่และประเภทการลา
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

    // 🔴 [เงื่อนไขที่ 2] บังคับระบุเหตุผลการลาทุกกรณี
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

    // ดึงชื่อประเภทการลามาตรวจสอบเงื่อนไขพิเศษ
    const leaveTypeObj = (leaveTypes || []).find(t => String(t.id) === String(leaveTypeId));
    const leaveName = leaveTypeObj ? leaveTypeObj.leave_name : "";

    // 🔴 [เงื่อนไขที่ 3] ตรวจสอบการลาป่วยตั้งแต่ 3 วันขึ้นไป ต้องแนบรูปภาพหลักฐาน
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

    // 🛡️ [เงื่อนไขที่ 4] ห้ามลาพักร้อน/พักผ่อนเกิน 3 วัน
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

    // 🎯 [เงื่อนไขที่ 5] ตรวจสอบโควตาคงเหลือ
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

    // 🎯 บันทึกลง Payload พร้อมสถานะที่ผ่านการอนุมัติอัตโนมัติตาม Role
    payload.push({
      employee_id:     currentProfile.id || currentProfile.employee_id, 
      leave_type_id:   leaveTypeId,
      start_date:      startDate,
      end_date:        endDate,
      total_days:      totalDays,
      reason:          reason.trim(),  
      status:          "pending",          
      manager_status:  defaultManagerStatus,   // 👈 ปรับอัตโนมัติ
      director_status: defaultDirectorStatus,  // 👈 ปรับอัตโนมัติ
      leave_hours:     totalHours,
      start_period:    startPeriod,
      end_period:      endPeriod
    });
  }

  // หากพบข้อผิดพลาด ให้หยุดทำงานทันที
  if (hasError) return;

  // 5. ล็อคปุ่มป้องกันการกดซ้ำ
  const saveBtn = document.getElementById("btnSaveLeave");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ <span style='opacity:0.8;'>กำลังส่งคำขอ...</span>";
  }

  // 6. บันทึกข้อมูลขึ้น Supabase
  try {
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

    // 🔔 สั่งส่งการแจ้งเตือน
    const empName = currentProfile.full_name || currentProfile.first_name || 'พนักงาน';
    await sendNotification(
      'คำขอลาใหม่', 
      `${empName} ได้ยื่นคำขอลาใหม่จำนวน ${payload.length} รายการ`, 
      'leave', 
      '/pages/leave-requests.html'
    );

    // 7. แจ้งเตือนสถานะสำเร็จ
    if (hasWarning) {
      setTimeout(() => {
        window.location.href = "/pages/user/index-user.html";
      }, 3000);
    } else {
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
    }

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
// ฟังก์ชันแสดง Toast แจ้งเตือนสถานะ
let toastTimer = null;
function showToast(msg, type = "") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3500);
}

// ─── 7. INITIALIZATION (เรียงลำดับการโหลดระบบ) ───
document.addEventListener("DOMContentLoaded", async () => {
  await loadLeaveTypes();   // 1. ดึงประเภทใบลาจริงจาก Supabase
  await fetchCurrentUserData(); // 2. โหลดข้อมูลผู้ใช้งาน (และสั่งปิดสัญลักษณ์โหลด ⏳)
  addLeaveRow();            // 3. ปล่อยการ์ดคำขอใบแรกเริ่มต้นขึ้นจอบนหน้าเว็บ
});

// ==========================================================================
// 🛡️ ระบบล็อกปุ่มและตรวจสอบเงื่อนไขการลาขั้นสูง (Quota & Vacation Rules)
// ==========================================================================
function validateLeaveRulesAndQuota() {
  const saveBtn = document.getElementById("saveLeaveBtn");
  const leaveTypeSelect = document.getElementById("leaveType");
  const totalDaysInput = document.getElementById("totalDays");

  if (!leaveTypeSelect || !totalDaysInput) return true;

  const selectedType = leaveTypeSelect.value; // จะได้ค่าเป็น ID หรือ Code เช่น LV_PERSONAL, VACATION
  const requestedDays = parseFloat(totalDaysInput.value) || 0;

  // คืนค่าปุ่มบันทึกให้กลับมาปกติก่อนตรวจทุกครั้ง
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.style.backgroundColor = "";
    saveBtn.style.cursor = "pointer";
    saveBtn.textContent = "💾 บันทึกคำขอลา";
  }

  if (requestedDays <= 0) return true;

  // ─── เงื่อนไขที่ 1: ตรวจสอบการลาพักร้อนรวดเดียวเกิน 3 วัน ───
  // (ระบบตรวจสอบจากคำว่า VACATION หรือ พักร้อน)
  if (selectedType.includes("VACATION") || selectedType.includes("vacation") || selectedType.includes("7e6bea12")) {
    if (requestedDays > 3) {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.style.backgroundColor = "#64748b"; // เปลี่ยนเป็นสีเทาซอฟต์ล็อกไว้
        saveBtn.style.cursor = "not-allowed";
        saveBtn.textContent = "🔒 ลาพักร้อนเกิน 3 วันติดต่อกันไม่ได้";
      }

      Swal.fire({
        icon: "warning",
        title: "เงื่อนไขการลาพักร้อนผันผ่อน",
        html: `ไม่สามารถใช้สิทธิ์ลาพักร้อนทีเดียว <b>${requestedDays} วัน</b> ได้ค่ะ<br><br>
               <span style="color: #ea580c; font-weight: 600;">💡 แนวทางปฏิบัติ:</span><br>
               ต้องแบ่งเขียนคำขอแยกเป็น 2 ใบ คือ:<br>
               1. ใบที่หนึ่ง: <b>ลากิจจำเป็น 3 วัน</b><br>
               2. ใบที่สอง: <b>ลาพักร้อนผันผ่อน 3 วัน</b><br><br>
               *ส่งเอกสารแยกกัน 2 ใบ แต่ HR จะพิจารณาอนุมัติรวมให้ในรอบเดียวค่ะ*`,
        confirmButtonText: "รับทราบและแก้ไขจำนวนวัน",
        confirmButtonColor: "#ea580c"
      });
      return false;
    }
  }

  // ─── เงื่อนไขที่ 2: ตรวจสอบโควตาคงเหลือของพนักงาน (ถ้าลาเกินสิทธิ์) ───
  let remainingQuota = 999;
  let leaveTypeNameText = "ประเภทการลานนี้";

  // ดึงข้อมูลสิทธิ์คงเหลือจากตัวแปรสิทธิ์ในระบบ (แมปตาม Database จริงของคุณ)
  if (window.currentLeaveBalance || currentProfile) {
    const balance = window.currentLeaveBalance;
    if (selectedType.includes("SICK") || selectedType.includes("sick")) {
      remainingQuota = balance?.sick_remaining ?? 30;
      leaveTypeNameText = "ลาป่วย";
    } else if (selectedType.includes("PERSONAL") || selectedType.includes("personal") || selectedType.includes("41a854f4")) {
      remainingQuota = balance?.personal_remaining ?? 6;
      leaveTypeNameText = "ลากิจจำเป็น";
    } else if (selectedType.includes("VACATION") || selectedType.includes("vacation") || selectedType.includes("7e6bea12")) {
      remainingQuota = balance?.vacation_remaining ?? 6;
      leaveTypeNameText = "ลาพักร้อน";
    }
  }

  // หากจำนวนวันลาที่กรอก เกินสิทธิ์คงเหลือจริงที่มีอยู่
  if (requestedDays > remainingQuota) {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.backgroundColor = "#ef4444"; // ปุ่มเปลี่ยนสีแดงเตือนภัย
      saveBtn.style.cursor = "not-allowed";
      saveBtn.textContent = "❌ ลาเกินกำหนดโปรดติดต่อ HR";
    }

    Swal.fire({
      icon: "error",
      title: "สิทธิ์วันลาของคุณไม่เพียงพอ",
      html: `คุณระบุจำนวนวันลา <b>${requestedDays} วัน</b><br>
             แต่สิทธิ์คงเหลือของ${leaveTypeNameText}คงเหลือเพียง <b>${remainingQuota} วัน</b><br><br>
             <span style="color: #ef4444; font-weight: bold; font-size: 16px;">🛑 ลาเกินกำหนดโปรดติดต่อ HR</span>`,
      confirmButtonText: "รับทราบ",
      confirmButtonColor: "#ef4444"
    });
    return false;
  }

  return true;
}

// ==========================================
// 🎯 ระบบอัปเดตยอดวันลาอัตโนมัติเมื่อพนักงานเลือกประเภทใน Dropdown
// ==========================================
// ==========================================
// 🎯 ระบบอัปเดตยอดวันลาอัตโนมัติเมื่อพนักงานเลือกประเภทใน Dropdown (เวอร์ชันแก้บั๊ก)
// ==========================================
window.updateLeaveBalanceDisplay = function(selectedTypeId) {
  console.log("🔍 [DEBUG] เลือกประเภทการลา ID:", selectedTypeId);
  
  const balanceInput = document.getElementById("leaveBalance");
  if (!balanceInput) {
    console.error("❌ [DEBUG] หาช่อง ID 'leaveBalance' ไม่เจอในหน้าเว็บ");
    return;
  }

  if (!selectedTypeId) {
    balanceInput.value = "- โปรดเลือกประเภทการลา -";
    balanceInput.style.color = "#64748b";
    balanceInput.style.border = "1px dashed #94a3b8";
    balanceInput.style.background = "rgba(240, 253, 250, 0.8)";
    return;
  }

  // ป้องกัน Error กรณีตะกร้าวันลายังไม่ถูกโหลด
  if (!window.employeeLeaveBalances) {
    console.warn("⚠️ ตะกร้าวันลายังไม่ถูกโหลด ระบบกำลังเซ็ตค่าว่างให้...");
    window.employeeLeaveBalances = [];
  }

  console.log("🧺 [DEBUG] ข้อมูลวันลาทั้งหมดของคนนี้:", window.employeeLeaveBalances);

  // 🎯 แปลงค่าเป็น String ทั้งคู่เพื่อบังคับให้มันเทียบค่ากันได้ตรงเป๊ะๆ
  const matchedBalance = window.employeeLeaveBalances.find(b => String(b.leave_type_id) === String(selectedTypeId));
  
  console.log("🎯 [DEBUG] ข้อมูลที่ค้นเจอตรงกัน:", matchedBalance);

  const remaining = matchedBalance ? parseFloat(matchedBalance.remaining_days) : 0;

  // แสดงผล
  balanceInput.value = `${remaining} วัน`;
  balanceInput.style.fontWeight = "700";
  balanceInput.style.fontSize = "16px";
  balanceInput.style.border = "1px solid #2dd4bf";

  if (remaining <= 0) {
    balanceInput.style.color = "#ef4444"; 
    balanceInput.style.background = "#fef2f2"; 
  } else {
    balanceInput.style.color = "#0d9488"; 
    balanceInput.style.background = "rgba(240, 253, 250, 0.8)";
  }
};

/* ==========================================================================
   🔮 ระบบควบคุมหน้าต่างคู่มืออธิบายการกรอกฟอร์มใบลา (Form Leave Guide)
   ========================================================================== */
function toggleFormLeaveGuide() {
  const card = document.getElementById("form-leave-guide-card");
  const icon = document.getElementById("form-leave-guide-icon");
  const btn = document.getElementById("form-leave-guide-fab");
  
  if (!card) return;

  const isHidden = card.style.display === "none" || card.style.display === "";

  if (isHidden) {
    card.style.display = "block";
    if (icon) icon.innerText = "close"; // เปลี่ยนไอคอนเป็นรูปกากบาท X
    if (btn) {
      btn.style.background = "#ef4444"; // เปลี่ยนสีปุ่มเป็นสีแดงเมื่อเปิดใช้งานอยู่
      btn.style.color = "#ffffff";
      btn.style.borderColor = "#fecaca";
    }
  } else {
    card.style.display = "none";
    if (icon) icon.innerText = "help"; // เปลี่ยนกลับเป็นไอคอนเครื่องหมายคำถาม ?
    if (btn) {
      btn.style.background = "rgba(255, 255, 255, 0.9)";
      btn.style.color = "#0891b2";
      btn.style.borderColor = "rgba(6, 182, 212, 0.4)";
    }
  }
}

