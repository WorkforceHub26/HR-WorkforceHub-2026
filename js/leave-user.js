/**
 * leave-user.js — ใบลาออนไลน์ PVT HR (รองรับ Cross-Platform 100%)
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

let userDisabledLeaveDates = [];

window.employeeLeaveBalances = []; 
window.systemLeaveTypes = [];

// ==========================================
// 🛠️ HELPER & COMPRESSION FUNCTIONS
// ==========================================

// ฟังก์ชันย่อขนาดรูปภาพฝั่ง Client ป้องกันภาพจากกล้อง iPhone/Android หน่วยความจำล้น
async function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) {
  if (!file || !file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(compressedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
      img.src = event.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const cleanStr = String(dateStr).split('T')[0];
  const [year, month, day] = cleanStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function countWorkDaysInRange(startDateStr, endDateStr) {
  let totalWorkDays = 0;
  let currentDate = parseLocalDate(startDateStr);
  const endDate = parseLocalDate(endDateStr);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay(); 
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

function getBalanceForYear(leaveTypeId, year) {
  const balances = window.employeeLeaveBalances || [];
  const matched = balances.find(b => String(b.leave_type_id) === String(leaveTypeId) && Number(b.year) === Number(year));
  return matched ? parseFloat(matched.remaining_days) : 0;
}

function formatHoursToThaiText(totalHours) {
  if (!totalHours || totalHours <= 0) return "";
  const days = Math.floor(totalHours / 8);
  const remainingHours = totalHours % 8;
  const wholeHours = Math.floor(remainingHours);
  const minutes = Math.round((remainingHours - wholeHours) * 60);

  let parts = [];
  if (days > 0) parts.push(`${days} วัน`);
  if (wholeHours > 0) parts.push(`${wholeHours} ชั่วโมง`);
  if (minutes > 0) parts.push(`${minutes} นาที`);

  return parts.length > 0 ? parts.join(" ") : `${totalHours} ชั่วโมง`;
}

function formatLeaveDurationText(totalDays, totalHours = 0) {
  const daysNum = parseFloat(totalDays) || 0;
  const hoursNum = parseFloat(totalHours) || 0;

  if (daysNum <= 0 && hoursNum <= 0) return "0 วัน";

  // กรณีมี totalHours ระบุชัดเจน
  if (hoursNum > 0) {
    const daysFromHours = Math.floor(hoursNum / 8);
    const remHours = hoursNum % 8;
    const wholeH = Math.floor(remHours);
    const mins = Math.round((remHours - wholeH) * 60);

    let parts = [];
    if (daysFromHours > 0) parts.push(`${daysFromHours} วัน`);
    if (wholeH > 0) parts.push(`${wholeH} ชั่วโมง`);
    if (mins > 0) parts.push(`${mins} นาที`);

    return parts.length > 0 ? parts.join(" ") : `${hoursNum} ชั่วโมง`;
  }

  // กรณีคำนวณจาก totalDays ที่เป็นทศนิยม
  const wholeDays = Math.floor(daysNum);
  const fracDay = daysNum - wholeDays;
  const totalH = fracDay * 8;
  const wholeH = Math.floor(totalH);
  const mins = Math.round((totalH - wholeH) * 60);

  let parts = [];
  if (wholeDays > 0) parts.push(`${wholeDays} วัน`);
  if (wholeH > 0) parts.push(`${wholeH} ชั่วโมง`);
  if (mins > 0) parts.push(`${mins} นาที`);

  return parts.length > 0 ? parts.join(" ") : `${daysNum} วัน`;
}

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

async function checkAllOverlaps(currentEmpId, startDateStr, endDateStr, currentBoxItem) {
  const allCards = document.querySelectorAll('#leaveCardsList .leave-box-item');
  for (const card of allCards) {
    if (card === currentBoxItem) continue;

    const otherStart = card.querySelector('input[name="start_date"]')?.value;
    const otherEnd = card.querySelector('input[name="end_date"]')?.value || otherStart;

    if (otherStart) {
      if (startDateStr <= otherEnd && endDateStr >= otherStart) {
        return { isOverlapped: true, source: 'form' };
      }
    }
  }

  if (currentEmpId) {
    const isDbOverlapped = await checkOverlappingLeave(currentEmpId, startDateStr, endDateStr);
    if (isDbOverlapped) {
      return { isOverlapped: true, source: 'db' };
    }
  }

  return { isOverlapped: false };
}

async function fetchUserExistingLeaveDates(employeeId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb || !employeeId) return [];

  try {
    const { data, error } = await sb
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('employee_id', employeeId)
      .in('status', ['pending', 'approved']);

    if (error) throw error;

    userDisabledLeaveDates = (data || []).map(item => ({
      from: item.start_date,
      to: item.end_date
    }));

    return userDisabledLeaveDates;
  } catch (err) {
    console.error("❌ ดึงวันลาเดิมใส่ปฏิทินล้มเหลว:", err);
    return [];
  }
}

// ==========================================
// 🗓️ 1. ระบบดึงและจัดการวันหยุดบริษัท
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
    return cachedHolidays;
  } catch (err) {
    console.error('❌ ดึงวันหยุดล้มเหลว:', err);
    return [];
  }
}

async function validateLeaveDate(selectedDateStr) {
  if (!selectedDateStr) return true;

  const selectedDate = parseLocalDate(selectedDateStr);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minAllowedDate = new Date(today);
  minAllowedDate.setDate(today.getDate() - 2);

  if (selectedDate < minAllowedDate) {
    await Swal.fire({
      icon: 'warning',
      title: '⚠️ วันที่เลือกย้อนหลังเกินกำหนด',
      text: 'สามารถเลือกยื่นลาย้อนหลังได้ไม่เกิน 2 วันครับ',
      confirmButtonColor: '#f59e0b'
    });
    return false;
  }

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

// ==========================================
// 🗓️ 2. จัดการการเปลี่ยนวันที่
// ==========================================
async function handleDateChange(inputElement) {
  const boxItem = inputElement.closest('.leave-box-item');
  const selectedDateStr = inputElement.value;

  const clearCalendarInput = (el) => {
    if (el._flatpickr) {
      el._flatpickr.clear();
    } else {
      el.value = "";
    }
  };

  if (selectedDateStr) {
    const isValid = await validateLeaveDate(selectedDateStr);
    if (!isValid) {
      clearCalendarInput(inputElement);
      if (boxItem) updateFormSequence(boxItem);
      calculateLeaveDays(inputElement);
      return;
    }
  }

  if (boxItem) {
    const startDateInput = boxItem.querySelector('input[name="start_date"]');
    const endDateInput = boxItem.querySelector('input[name="end_date"]');
    
    const startDateStr = startDateInput?.value;
    const endDateStr = endDateInput?.value;

    if (startDateStr && endDateStr) {
      const start = parseLocalDate(startDateStr);
      const end = parseLocalDate(endDateStr);

      if (end < start) {
        await Swal.fire({
          icon: 'warning',
          title: '⚠️ เลือกวันที่ไม่ถูกต้อง',
          text: 'ถึงวันที่ลา ต้องไม่น้อยกว่า เริ่มวันที่ลา ครับ',
          confirmButtonColor: '#f59e0b'
        });

        if (inputElement === endDateInput) clearCalendarInput(endDateInput);
        updateFormSequence(boxItem);
        calculateLeaveDays(inputElement);
        return;
      }
    }

    const checkStart = startDateStr;
    const checkEnd = endDateStr || startDateStr;

    if (checkStart) {
      const currentEmpId = currentProfile?.id || currentProfile?.employee_id;
      const overlapResult = await checkAllOverlaps(currentEmpId, checkStart, checkEnd, boxItem);

      if (overlapResult.isOverlapped) {
        const dateText = endDateStr ? `${startDateStr} ถึง ${endDateStr}` : `${startDateStr}`;
        const sourceText = overlapResult.source === 'form' 
          ? 'วันที่เลือกซ้ำกับรายการยื่นลาอีกรายการในหน้าจอนี้ครับ' 
          : `ช่วงวันที่ ${dateText} มีคำขอลาล่วงหน้าอยู่ในระบบแล้วครับ`;

        await Swal.fire({
          icon: 'warning',
          title: '⚠️ ยื่นวันลาซ้อนทับ / ชนใบลาล่วงหน้า',
          text: sourceText,
          confirmButtonColor: '#f59e0b'
        });

        clearCalendarInput(inputElement);
        updateFormSequence(boxItem);
        calculateLeaveDays(inputElement);
        return;
      }
    }
  }

  if (boxItem) updateFormSequence(boxItem);
  calculateLeaveDays(inputElement);
}

// ==========================================
// 📦 3. โหลดข้อมูลประเภทการลา
// ==========================================
function getTranslatedLeaveTypeName(rawName) {
  if (!rawName) return "";
  const lang = window.getGlobalLanguage ? window.getGlobalLanguage() : "th";
  const t = window.globalAppTranslations ? (window.globalAppTranslations[lang] || window.globalAppTranslations.th) : null;
  if (!t) return rawName;

  if (rawName.includes("ป่วย")) return t.leaveSick;
  if (rawName.includes("พักผ่อน") || rawName.includes("ประจำปี")) return t.leaveAnnual;
  if (rawName.includes("กิจ")) return t.leaveBusiness;
  if (rawName.includes("ทำหมัน")) return t.leaveSterilization;
  if (rawName.includes("ทหาร")) return t.leaveMilitary;
  if (rawName.includes("อุปสมบท") || rawName.includes("บวช")) return t.leaveOrdination;
  if (rawName.includes("ฌาปนกิจ") || rawName.includes("ศพ")) return t.leaveFuneral;
  if (rawName.includes("คลอด")) return t.leaveMaternity;
  if (rawName.includes("อื่น")) return t.leaveOther;
  return rawName;
}

function renderLeaveTypeOptions(selectEl) {
  if (!selectEl) return;
  const currentValue = selectEl.value;
  const placeholderText = window.getPVTTranslation ? window.getPVTTranslation("leaveTypePlaceholder") : "-- เลือกประเภทการลา --";
  selectEl.innerHTML = `<option value="" disabled ${!currentValue ? 'selected' : ''}>${placeholderText}</option>`;

  if (leaveTypes && leaveTypes.length > 0) {
    leaveTypes.forEach(type => {
      const opt = document.createElement("option");
      opt.value = type.id;
      opt.textContent = getTranslatedLeaveTypeName(type.leave_name);
      if (String(type.id) === String(currentValue)) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }
}

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
    window.systemLeaveTypes = leaveTypes;

    document.querySelectorAll('select[name="leave_type_id"]').forEach(selectEl => {
      renderLeaveTypeOptions(selectEl);
    });
  } catch (err) {
    console.error("❌ [CRITICAL] ดึงประเภทการลาล้มเหลว:", err.message);
  }
}

// ==========================================
// 👤 4. ดึงข้อมูลพนักงานและโควตาวันลา
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

    window.employeeLeaveBalances = leaveData || [];

    if (typeof window.renderAllLeaveBalances === 'function') {
      window.renderAllLeaveBalances();
    }

    const realUser = {
      id: empData.id,
      employee_code: empData.employee_code || "-",
      full_name: empData.full_name || "-",
      role: empData.role || empData.position_name || "employee",

      // ✅ สำคัญ: เก็บ department_id ไว้ใช้ Routing ผู้อนุมัติ
      department_id: empData.department_id || null,
      department_name: empData.departments?.department_name || "ไม่ได้ระบุแผนก",

      position_name: empData.positions?.position_name || empData.position_id || "ไม่ได้ระบุตำแหน่ง",
      start_date: empData.start_date || "-",
      social_security_rights: empData.hospital || "-"
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
    setTealInputStyle("employeeSocialSecurity", realUser.social_security_rights);

    const loadingBadge = document.getElementById('loadingBadge');
    if (loadingBadge) loadingBadge.style.display = 'none';

  } catch (error) {
    console.error("❌ ERROR ดึงข้อมูล:", error);
  }
}

// ==========================================
// 🔒 5. Flatpickr & Form Sequence Control
// ==========================================
function initDatePickerWithDisabledDates(container = document, disabledDates = []) {
  if (typeof flatpickr === "undefined") return;

  const currentYear = new Date().getFullYear();

  const formattedDisabled = disabledDates.map(item => {
    if (typeof item === 'object' && item.from && item.to) {
      return {
        from: String(item.from).split('T')[0],
        to: String(item.to).split('T')[0]
      };
    }
    return String(item).split('T')[0];
  });

  const baseConfig = {
    locale: "th",
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    disableMobile: true, // 👈 บังคับใช้ Flatpickr Calendar บน Android/iOS ป้องกัน Native Picker บล็อกการกด
    minDate: `${currentYear}-01-01`,
    maxDate: `${currentYear}-12-31`,
    disable: formattedDisabled,
    onChange: function (selectedDates, dateStr, instance) {
      instance.close();
      if (typeof handleDateChange === "function") {
        handleDateChange(instance.element);
      }
    }
  };

  const targetContainer = container instanceof HTMLElement ? container : document;
  const inputs = targetContainer.querySelectorAll('input[name="start_date"], input[name="end_date"], #startDate, #endDate');

  inputs.forEach(input => {
    if (input._flatpickr) {
      input._flatpickr.destroy();
    }
    flatpickr(input, baseConfig);
  });
}

function updateFormSequence(boxItem) {
  if (!boxItem) return;

  const startDateEl = boxItem.querySelector('input[name="start_date"]');
  const endDateEl = boxItem.querySelector('input[name="end_date"]');
  const leaveTypeEl = boxItem.querySelector('select[name="leave_type_id"]');
  const hoursMorningEl = boxItem.querySelector('input[name="hours_morning"]');
  const hoursAfternoonEl = boxItem.querySelector('input[name="hours_afternoon"]');
  const reasonEl = boxItem.querySelector('input[name="reason"]');
  const fileInputEl = boxItem.querySelector('input[type="file"]');
  const fileLabelEl = boxItem.querySelector('.file-upload-label');

  const hasStart = !!startDateEl?.value;

  if (endDateEl) {
    const fp = endDateEl._flatpickr;
    const targetAltInput = fp ? fp.altInput : null;

    if (hasStart) {
      endDateEl.removeAttribute('disabled');
      endDateEl.disabled = false;

      if (targetAltInput) {
        targetAltInput.removeAttribute('disabled');
        targetAltInput.disabled = false;
        targetAltInput.style.pointerEvents = 'auto';
        targetAltInput.style.backgroundColor = '#ffffff';
        targetAltInput.style.cursor = 'pointer';
      }
    } else {
      endDateEl.setAttribute('disabled', 'disabled');
      endDateEl.disabled = true;

      if (targetAltInput) {
        targetAltInput.setAttribute('disabled', 'disabled');
        targetAltInput.disabled = true;
        targetAltInput.style.pointerEvents = 'none';
        targetAltInput.style.backgroundColor = '#f1f5f9';
        targetAltInput.style.cursor = 'not-allowed';
      }

      if (endDateEl.value && fp) {
        fp.clear(false);
      }
    }
  }

  const hasEnd = hasStart && !!endDateEl?.value;
  if (leaveTypeEl) {
    leaveTypeEl.disabled = !hasEnd;
  }

  const hasType = hasEnd && !!leaveTypeEl?.value;
  if (hoursMorningEl) hoursMorningEl.disabled = !hasType;
  if (hoursAfternoonEl) hoursAfternoonEl.disabled = !hasType;

  if (reasonEl) reasonEl.disabled = !hasType;
  if (fileInputEl) fileInputEl.disabled = !hasType;
  if (fileLabelEl) {
    if (!hasType) {
      fileLabelEl.style.opacity = "0.5";
      fileLabelEl.style.pointerEvents = "none";
    } else {
      fileLabelEl.style.opacity = "1";
      fileLabelEl.style.pointerEvents = "auto";
    }
  }
}

// ==========================================
// 🎨 6. วาดและอัปเดตสิทธิ์วันลาคงเหลือ
// ==========================================
window.renderAllLeaveBalances = function() {
  const container = document.getElementById("leaveBalancesContainer");
  if (!container) return;

  container.innerHTML = "";

  const leaveBalances = window.employeeLeaveBalances || [];
  const systemLeaveTypes = window.systemLeaveTypes || [];
  const currentYear = new Date().getFullYear();
  const uDays = window.getPVTTranslation ? window.getPVTTranslation("unitDays") : "วัน";

  if (leaveBalances.length === 0 && systemLeaveTypes.length === 0) {
    const noQuotaText = window.getPVTTranslation ? window.getPVTTranslation("noQuotaData") : "❌ ยังไม่มีข้อมูลโควตาวันลาในปีนี้";
    container.innerHTML = `<p style='color:#ef4444; font-size:14px; margin: 0;'>${noQuotaText}</p>`;
    return;
  }

  let displayItems = systemLeaveTypes.map(type => {
    const matchedBal = leaveBalances.find(b => String(b.leave_type_id) === String(type.id) && Number(b.year) === currentYear);
    return {
      rawName: type.leave_name || "สิทธิ์การลา",
      typeName: getTranslatedLeaveTypeName(type.leave_name || "สิทธิ์การลา"),
      remaining: matchedBal ? (parseFloat(matchedBal.remaining_days) || 0) : 0
    };
  });

  displayItems.forEach(item => {
    const rawName = item.rawName;
    const typeName = item.typeName;
    const remaining = item.remaining;

    let colorClass = ""; 
    if (rawName.includes("ป่วย")) colorClass = "sick";
    else if (rawName.includes("กิจ")) colorClass = "personal";
    else if (rawName.includes("พักผ่อน") || rawName.includes("พักร้อน")) colorClass = "vacation";

    const box = document.createElement("div");
    box.className = `leave-quota-box ${colorClass}`;
    box.innerHTML = `
      <div class="leave-quota-name">${typeName}</div>
      <div class="leave-quota-days">${remaining} <span class="unit">${uDays}</span></div>
    `;
    container.appendChild(box);
  });
};

window.updateLeaveBalanceDisplay = function(selectEl) {
  const selectedTypeId = typeof selectEl === 'object' ? selectEl.value : selectEl;
  const balanceInput = document.getElementById("leaveBalance");

  if (!selectedTypeId) {
    if (balanceInput) {
      balanceInput.value = "กรุณาเลือกประเภทการลาก่อน";
      balanceInput.style.fontWeight = "400";
      balanceInput.style.color = "#94a3b8";
      balanceInput.style.background = "#f8fafc";
    }
    return;
  }

  const currentYear = new Date().getFullYear();
  const remainingDays = getBalanceForYear(selectedTypeId, currentYear);
  const leaveTypeObj = (leaveTypes || []).find(t => String(t.id) === String(selectedTypeId));
  const leaveName = leaveTypeObj ? leaveTypeObj.leave_name : "";

  if (typeof selectEl === 'object') {
    const card = selectEl.closest('.leave-box-item');
    if (card) {
      const morningInput = card.querySelector('input[name="hours_morning"]');
      const afternoonInput = card.querySelector('input[name="hours_afternoon"]');

      if (leaveName.includes("พักผ่อน") || leaveName.includes("พักร้อน")) {
        if (morningInput) morningInput.step = "4";
        if (afternoonInput) afternoonInput.step = "4";

        Swal.fire({
          icon: 'info',
          title: '📌 เงื่อนไขการลาพักผ่อน',
          html: '<b>บังคับขั้นต่ำ 0.5 วัน (4 ชั่วโมง)</b><br><small style="color:#64748b;">ระบบปรับช่องกรอกชั่วโมงเป็นครั้งละ 4 ชม. ให้อัตโนมัติครับ</small>',
          confirmButtonColor: '#0f766e',
          confirmButtonText: 'รับทราบ'
        });
      } else if (leaveName.includes("กิจ")) {
        if (morningInput) morningInput.step = "0.5";
        if (afternoonInput) afternoonInput.step = "0.5";

        Swal.fire({
          icon: 'info',
          title: '📌 เงื่อนไขการลากิจ',
          html: '<b>ขั้นต่ำ 0.5 ชั่วโมง (30 นาที)</b><br><small style="color:#64748b;">สามารถเลือกกรอกเป็น 0.5, 1, 1.5 ... ชั่วโมงได้ครับ</small>',
          confirmButtonColor: '#0f766e',
          confirmButtonText: 'รับทราบ'
        });
      } else {
        if (morningInput) morningInput.step = "0.5";
        if (afternoonInput) afternoonInput.step = "0.5";
      }

      calculateLeaveDays(selectEl);
    }
  }

  if (balanceInput) {
    balanceInput.value = `${remainingDays} วัน`;
    balanceInput.style.fontWeight = "700";
    balanceInput.style.color = remainingDays <= 0 ? "#ef4444" : "#0d9488";
    balanceInput.style.background = remainingDays <= 0 ? "#fef2f2" : "rgba(240, 253, 250, 0.8)";
  }
};

// ==========================================
// 🚀 7. เพิ่ม/ลบการ์ดรายการลา
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

// อัปเดต HTML เพิ่มปุ่ม + / - ครอบช่องชั่วโมง
async function addLeaveRow() {
  const container = document.getElementById('leaveCardsList');
  if (!container) return;

  const uniqueId = 'file_' + Math.random().toString(36).substr(2, 9);
  const boxItem = document.createElement('div');
  boxItem.className = 'leave-box-item';

  const todayThaiStr = new Date().toLocaleDateString('en-CA');

  boxItem.innerHTML = `
    <div class="row-divider">หมวดหมู่ที่ 1: วันที่และกรอบเวลาการลา</div>
    <div class="grid-row-3">
      <div class="input-group">
        <label>วันที่เขียนคำขอ</label>
        <input type="date" name="write_date" value="${todayThaiStr}" readonly tabindex="-1" class="readonly-highlight" style="background-color: #f1f5f9; color: #64748b; cursor: not-allowed;">
      </div>
      <div class="input-group">
        <label>เริ่มวันที่ลา <span style="color:#ef4444;">*</span></label>
        <input type="text" name="start_date" placeholder="คลิกเพื่อเลือกวันเริ่มลา" readonly style="background-color: #fff; cursor: pointer;">
      </div>
      <div class="input-group">
        <label>สิ้นสุดวันที่ลา <span style="color:#ef4444;">*</span></label>
        <input type="text" name="end_date" placeholder="คลิกเพื่อเลือกวันสิ้นสุด" readonly style="background-color: #fff; cursor: pointer;">
      </div>
    </div>

    <div class="row-divider">หมวดหมู่ที่ 2: รายละเอียดประเภทการลาและหลักฐาน</div>
    <div class="grid-row-3">
      <div class="input-group">
        <label>ประเภทการลา <span style="color:#ef4444;">*</span></label>
        <select name="leave_type_id" class="form-select" disabled onchange="updateLeaveBalanceDisplay(this)" required>
          <option value="" disabled selected>-- เลือกประเภทการลา --</option>
        </select>
      </div>
      <div class="input-group">
        <label>สาเหตุ / เหตุผลการลา <span style="color:#ef4444;">*</span></label>
        <input type="text" placeholder="ระบุเหตุผลความจำเป็น..." name="reason" disabled required>
      </div>
      <div class="input-group">
        <label>แนบหลักฐานรูปภาพ</label>
        <div class="custom-file-upload">
          <label class="file-upload-label" id="label_${uniqueId}" for="${uniqueId}" style="opacity:0.5; pointer-events:none;">📁 เลือกรูปภาพหลักฐาน</label>
          <input type="file" id="${uniqueId}" accept="image/*" disabled onchange="handleFileChange(this, 'label_${uniqueId}')">
        </div>
      </div>
    </div>

    <div class="row-divider">หมวดหมู่ที่ 3: จำนวนเวลาและชั่วโมงที่ขอลา</div>
    <div class="grid-row-3">
      <div class="input-group">
        <label>จำนวนชั่วโมงเช้า (0-4)</label>
        <div class="stepper-container">
          <button type="button" class="btn-stepper" onclick="stepHours(this, -1)">-</button>
          <input type="number" placeholder="0" name="hours_morning" min="0" max="4" value="0" step="0.5" disabled readonly oninput="calculateLeaveDays(this)">
          <button type="button" class="btn-stepper" onclick="stepHours(this, 1)">+</button>
        </div>
      </div>
      <div class="input-group">
        <label>จำนวนชั่วโมงบ่าย (0-4)</label>
        <div class="stepper-container">
          <button type="button" class="btn-stepper" onclick="stepHours(this, -1)">-</button>
          <input type="number" placeholder="0" name="hours_afternoon" min="0" max="4" value="0" step="0.5" disabled readonly oninput="calculateLeaveDays(this)">
          <button type="button" class="btn-stepper" onclick="stepHours(this, 1)">+</button>
        </div>
      </div>
      <div class="input-group">
        <label>สรุปรวมระยะเวลาที่ขอลา</label>
        <input type="text" placeholder="0 วัน" readonly name="leave_days_display" class="readonly-highlight" value="0 วัน" style="font-weight:700; color:#0f766e !important; background:#f0fdfa !important; border-color:#99f6e4 !important;">
        <input type="hidden" name="leave_days" value="0">
      </div>
    </div>

    <div class="split-preview-container" style="display:none; margin-top:15px;"></div>

    <div class="row-divider">หมวดหมู่ที่ 4: สถานะผลการพิจารณาและอนุมัติ</div>
    <div class="grid-row-3">
      <div class="input-group"><label>หัวหน้าแผนก</label><span class="badge-status">รอพิจารณา</span></div>
      <div class="input-group"><label>ผู้จัดการฝ่าย</label><span class="badge-status">รอพิจารณา</span></div>
      <div class="input-group"><label>ฝ่ายบุคคล</label><span class="badge-status">รอพิจารณา</span></div>
    </div>

    <div class="box-item-footer no-print">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeLeaveRow(this)">ลบรายการนี้</button>
    </div>
  `;

  container.appendChild(boxItem);

  const selectEl = boxItem.querySelector('select[name="leave_type_id"]');
  renderLeaveTypeOptions(selectEl);

  initDatePickerWithDisabledDates(boxItem, userDisabledLeaveDates);
  updateFormSequence(boxItem);
}

// ==========================================
// 🧮 8. คำนวณวันลา
// ==========================================
function calculateLeaveDays(element) {
  const boxItem = element.closest('.leave-box-item');
  if (!boxItem) return;

  updateFormSequence(boxItem);

  const startDateInput = boxItem.querySelector('input[name="start_date"]')?.value;
  const endDateInput = boxItem.querySelector('input[name="end_date"]')?.value;
  const morningInput = boxItem.querySelector('input[name="hours_morning"]');
  const afternoonInput = boxItem.querySelector('input[name="hours_afternoon"]');
  const resultInput = boxItem.querySelector('input[name="leave_days"]');
  const leaveTypeSelect = boxItem.querySelector('select[name="leave_type_id"]');
  
  let textDisplay = boxItem.querySelector('.hours-text-display');
  if (!textDisplay && resultInput) {
    textDisplay = document.createElement('small');
    textDisplay.className = 'hours-text-display';
    textDisplay.style.cssText = 'display:block; color:#0f766e; font-weight:600; margin-top:6px; font-size:13px;';
    resultInput.parentNode.appendChild(textDisplay);
  }

  let hrMorning = parseFloat(morningInput?.value) || 0;
  let hrAfternoon = parseFloat(afternoonInput?.value) || 0;

  const selectedTypeId = leaveTypeSelect?.value;
  const leaveTypeObj = (leaveTypes || []).find(t => String(t.id) === String(selectedTypeId));
  const leaveName = leaveTypeObj ? leaveTypeObj.leave_name : "";

  if (leaveName.includes("พักผ่อน") || leaveName.includes("พักร้อน")) {
    if (hrMorning > 0 && hrMorning < 4) { hrMorning = 4; if (morningInput) morningInput.value = 4; }
    if (hrAfternoon > 0 && hrAfternoon < 4) { hrAfternoon = 4; if (afternoonInput) afternoonInput.value = 4; }
  }

  const totalHours = hrMorning + hrAfternoon;

  if (totalHours > 0) {
    const thaiFormattedText = formatHoursToThaiText(totalHours);
    if (textDisplay) textDisplay.innerHTML = `⏱️ ลาจำนวน: <b>${thaiFormattedText}</b>`;
  } else if (textDisplay) {
    textDisplay.innerText = "";
  }

  if (!startDateInput || !endDateInput) {
    resultInput.value = 0;
    return;
  }

  const start = parseLocalDate(startDateInput);
  const end = parseLocalDate(endDateInput);
  if (end < start) {
    resultInput.value = 0;
    return;
  }

  let totalWorkDays = countWorkDaysInRange(startDateInput, endDateInput);
  let totalDays = totalWorkDays;

  const extraDays = totalHours / 8;
  if (startDateInput === endDateInput && totalHours > 0) {
    totalDays = extraDays;
  } else if (totalHours > 0) {
    totalDays = (totalDays > 0 ? totalDays - 1 : 0) + extraDays;
  }

  const cleanDays = Math.round(totalDays * 100) / 100;
  if (resultInput) {
    resultInput.value = cleanDays;
  }

  const displayInput = boxItem.querySelector('input[name="leave_days_display"]');
  if (displayInput) {
    displayInput.value = formatLeaveDurationText(cleanDays, (startDateInput === endDateInput && totalHours > 0) ? totalHours : 0);
  }
}

// ==========================================
// 📸 9. เปลี่ยนชื่อปุ่มเมื่อแนบรูป
// ==========================================
function handleFileChange(input, labelId) {
  const label = document.getElementById(labelId);
  if (!label) return;
  
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    const maxMB = 10;
    
    if (file.size > maxMB * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'ไฟล์มีขนาดใหญ่เกินไป',
        text: `กรุณาแนบรูปภาพที่มีขนาดไม่เกิน ${maxMB} MB ครับ`,
        confirmButtonColor: '#f59e0b'
      });
      input.value = "";
      label.innerText = '📁 เลือกรูปภาพหลักฐาน';
      label.style.borderColor = 'var(--border)';
      label.style.color = 'var(--muted)';
      return;
    }

    label.innerText = '✅ ' + file.name;
    label.style.borderColor = 'var(--green)';
    label.style.color = 'var(--green-dark)';
  } else {
    label.innerText = '📁 เลือกรูปภาพหลักฐาน';
    label.style.borderColor = 'var(--border)';
    label.style.color = 'var(--muted)';
  }
}

// ==========================================
// 🔔 10. ระบบแจ้งเตือน และ อัปโหลดไฟล์
// ==========================================
async function sendNotification(title, message, type = 'leave', targetUrl = '/pages/hr/hr.html', recipientId = null) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const payload = {
      title: title,
      message: message,
      type: 'leave',
      link_url: '/pages/hr/hr.html',
      is_read: false
    };
    
    if (recipientId) {
      payload.employee_id = recipientId;
    }

    const { error } = await sb.from("notifications").insert([payload]);

    if (error) console.warn("⚠️ บันทึกแจ้งเตือนลง DB ไม่สำเร็จ:", error.message);
  } catch (err) {
    console.error("❌ Notification Error:", err);
  }
}

async function uploadAttachment(file, employeeId) {
  if (!file) return null;
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return null;

  try {
    const compressedFile = await compressImage(file);

    const fileExt = compressedFile.name.split('.').pop();
    const fileName = `${employeeId}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { data, error } = await sb.storage
      .from('leave-attachments')
      .upload(fileName, compressedFile, { cacheControl: '3600', upsert: false });

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
// 💾 11. บันทึกคำขอใบลา (ปรับปรุงสายอนุมัติ 3 ระดับ)
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
  const deptId = currentProfile?.department_id || null;

  // 🔀 ดึงข้อมูลสายอนุมัติของแผนกเพื่อตรวจสอบความหยืดหยุ่น (มี L1/L2 หรือไม่)
  let approverConfig = null;
  if (deptId) {
    const { data } = await sb.from("department_approvers").select("supervisor_id, manager_id").eq("department_id", deptId).maybeSingle();
    approverConfig = data;
  }

  let defaultManagerStatus = "pending";
  let defaultDirectorStatus = "pending";

  // 🧠 Approval Routing ตาม Role ของผู้ยื่น
  if (
    userRole.includes("executive") || userRole.includes("owner") ||
    userRole.includes("director") || userRole.includes("ผู้บริหาร") ||
    userRole.includes("เจ้าของ")
  ) {
    defaultManagerStatus = "approved";
    defaultDirectorStatus = "approved";
  } else if (
    userRole.includes("manager") || userRole.includes("ผู้จัดการ")
  ) {
    defaultManagerStatus = "approved";
    defaultDirectorStatus = "approved";
  } else if (
    userRole.includes("leader") || userRole.includes("supervisor") ||
    userRole.includes("head") || userRole.includes("หัวหน้า")
  ) {
    defaultManagerStatus = "approved";
    // ถ้าแผนกไม่มีผู้จัดการ ให้ผู้บริหารอนุมัติแทน ดังนั้นห้ามข้ามขั้นตอน L2 (ให้คงสถานะ pending)
    defaultDirectorStatus = "pending";
  } else if (userRole.includes("hr") || userRole.includes("admin")) {
    defaultManagerStatus = "approved";
    defaultDirectorStatus = "approved";
  } else {
    // พนักงานทั่วไป:
    // ถ้าไม่มี L1 ในแผนก -> ข้าม L1
    if (!approverConfig?.supervisor_id) defaultManagerStatus = "approved";
    // ถ้าไม่มี L2 ในแผนก -> เดิมข้าม L2 แต่ใหม่: ให้ผู้บริหารอนุมัติแทน ดังนั้นห้ามข้ามขั้นตอน L2 (ให้คงสถานะ pending)
    if (!approverConfig?.manager_id) {
      defaultDirectorStatus = "pending";
    }
  }

  const payload = [];
  const uploadedPaths = []; 
  let hasError = false;
  const currentEmpId = currentProfile.id || currentProfile.employee_id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minAllowedDate = new Date(today);
  minAllowedDate.setDate(today.getDate() - 2);

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

    if (!leaveTypeId || !startDate || !endDate) {
      Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่สมบูรณ์', text: `กรุณากรอกวันที่และประเภทการลาให้ครบในรายการที่ ${index + 1}`, confirmButtonColor: '#f59e0b' });
      hasError = true; break; 
    }

    const isStartValid = await validateLeaveDate(startDate);
    const isEndValid = await validateLeaveDate(endDate);
    if (!isStartValid || !isEndValid) { hasError = true; break; }

    const startObj = parseLocalDate(startDate);
    if (startObj < minAllowedDate) {
      Swal.fire({
        icon: 'warning',
        title: 'ยื่นลาย้อนหลังเกินกำหนด',
        text: `รายการที่ ${index + 1} สามารถยื่นลาย้อนหลังได้ไม่เกิน 2 วันครับ`,
        confirmButtonColor: '#f59e0b'
      });
      hasError = true; break;
    }

    if (totalDays <= 0) {
      Swal.fire({ icon: 'warning', title: 'จำนวนวันลาไม่ถูกต้อง', text: `รายการที่ ${index + 1} วันที่เลือกตรงกับวันหยุดทั้งหมด`, confirmButtonColor: '#f59e0b' });
      hasError = true; break;
    }

    if (!reason.trim()) {
      Swal.fire({ icon: 'warning', title: 'กรุณาระบุเหตุผล', text: `กรุณากรอก "สาเหตุ / เหตุผลการลา" ในรายการที่ ${index + 1}`, confirmButtonColor: '#f59e0b' });
      hasError = true; break;
    }

    const leaveTypeObj = (leaveTypes || []).find(t => String(t.id) === String(leaveTypeId));
    const leaveName = leaveTypeObj ? leaveTypeObj.leave_name : "";

    const isPersonalLeave = leaveName.includes("กิจ");
    const isVacationLeave = leaveName.includes("พักผ่อน") || leaveName.includes("พักร้อน");

    if (isPersonalLeave && totalDays < 0.0625) {
      Swal.fire({
        icon: 'warning',
        title: 'เงื่อนไขการลากิจ',
        text: `รายการที่ ${index + 1} การลากิจสามารถลาขั้นต่ำได้น้อยสุด 0.5 ชั่วโมง (ครึ่งชั่วโมง) ครับ`,
        confirmButtonColor: '#f59e0b'
      });
      hasError = true; break;
    }

    if (isVacationLeave && totalDays < 0.5) {
      Swal.fire({
        icon: 'warning',
        title: 'เงื่อนไขการลาพักผ่อน',
        text: `รายการที่ ${index + 1} การลาพักผ่อนสามารถลาขั้นต่ำได้น้อยสุด 0.5 วัน (ครึ่งวัน) ครับ`,
        confirmButtonColor: '#f59e0b'
      });
      hasError = true; break;
    }

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

    const isSickLeave = leaveName.includes("ป่วย") || leaveName.toLowerCase().includes("sick");
    if (isSickLeave) {
      const confirmResult = await Swal.fire({
        icon: 'info',
        title: '📌 แจ้งเตือนการยื่นใบรับรองแพทย์',
        html: `รายการที่ ${index + 1} เป็นการ<b>ลาป่วย</b><br><br><span style="color:#0f766e; font-weight:600;">กรุณานำใบรับรองแพทย์ฉบับจริงมายื่นส่งให้ฝ่ายบุคคล (HR) หลังจากกลับมาทำงานครับ<br><small style="color:#e11d48;">(แม้ว่าจะทำการแนบไฟล์รูปภาพในระบบแล้วก็ตาม)</small></span>`,
        showCancelButton: true,
        confirmButtonColor: '#0f766e',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'รับทราบ และยื่นคำขอ',
        cancelButtonText: 'ยกเลิกเพื่อแก้ไข'
      });

      if (!confirmResult.isConfirmed) {
        hasError = true;
        break;
      }
    }

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

    const startObjDate = parseLocalDate(startDate);
    const endObjDate = parseLocalDate(endDate);
    const startYear = startObjDate.getFullYear();
    const cutoffDate = parseLocalDate(`${startYear}-11-30`);

    if (startObjDate <= cutoffDate && endObjDate > cutoffDate) {
      const splitGroupId = 'GRP_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const chunk1End = `${startYear}-11-30`;
      const chunk2Start = `${startYear}-12-01`;

      let days1 = countWorkDaysInRange(startDate, chunk1End);
      let days2 = countWorkDaysInRange(chunk2Start, endDate);

      if (hoursMorning > 0) days1 = Math.max(0, days1 - 1) + (hoursMorning / 8);
      if (hoursAfternoon > 0) days2 = Math.max(0, days2 - 1) + (hoursAfternoon / 8);

      payload.push({
        employee_id:            currentEmpId, 
        leave_type_id:          leaveTypeId,
        start_date:             startDate,
        end_date:               chunk1End,
        total_days:             days1,
        reason:                 `${reason.trim()} (ส่วนที่ 1: ตัดรอบปี ${startYear})`,
        attachment_url:         attachmentUrl,
        status:                 "pending", // รอ HR ปิดงานขั้นสุดท้าย
        manager_status:         defaultManagerStatus,
        director_status:        defaultDirectorStatus,
        leave_hours:            hoursMorning,
        start_period:           hoursMorning > 0 ? "half_day" : "full_day",
        end_period:             "full_day",
        split_group_id:         splitGroupId
      });

      payload.push({
        employee_id:            currentEmpId, 
        leave_type_id:          leaveTypeId,
        start_date:             chunk2Start,
        end_date:               endDate,
        total_days:             days2,
        reason:                 `${reason.trim()} (ส่วนที่ 2: ตัดรอบปี ${startYear + 1})`,
        attachment_url:         attachmentUrl,
        status:                 "pending", // รอ HR ปิดงานขั้นสุดท้าย
        manager_status:         defaultManagerStatus,
        director_status:        defaultDirectorStatus,
        leave_hours:            hoursAfternoon,
        start_period:           "full_day",
        end_period:             hoursAfternoon > 0 ? "half_day" : "full_day",
        split_group_id:         splitGroupId
      });

    } else {
      const totalHours = hoursMorning + hoursAfternoon;
      const startPeriod = hoursMorning > 0 ? "half_day" : "full_day";
      const endPeriod = hoursAfternoon > 0 ? "half_day" : "full_day";

      payload.push({
        employee_id:            currentEmpId, 
        leave_type_id:          leaveTypeId,
        start_date:             startDate,
        end_date:               endDate,
        total_days:             totalDays,
        reason:                 reason.trim(),
        attachment_url:         attachmentUrl,
        status:                 "pending", // รอ HR ปิดงานขั้นสุดท้าย
        manager_status:         defaultManagerStatus,
        director_status:        defaultDirectorStatus,
        leave_hours:            totalHours,
        start_period:           startPeriod,
        end_period:             endPeriod,
        split_group_id:         null
      });
    }
  }

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
    // 🔀 กรณีหัวหน้างานเป็นผู้ยื่นลา:
    // ถ้าแผนกไม่มี Manager L2 ให้ข้าม L2 และไปรอผู้บริหาร L3
    const isApplicantLeader = (
      userRole.includes("leader") || userRole.includes("supervisor") ||
      userRole.includes("head") || userRole.includes("หัวหน้า")
    );

    if (isApplicantLeader && currentProfile?.department_id) {
      const { data: routingConfig, error: routingError } = await sb
        .from("department_approvers")
        .select("manager_id")
        .eq("department_id", currentProfile.department_id)
        .maybeSingle();

      if (routingError) throw routingError;

      if (!routingConfig?.manager_id) {
        payload.forEach(item => {
          item.director_status = "pending";
        });
        console.log("ℹ️ [Leave Routing] หัวหน้ายื่นลา + ไม่มี L2 → ส่งไปผู้บริหาร L3 เพื่อรออนุมัติ");
      }
    }

    // 🛡️ ตรวจสอบและสร้างโควตาวันลาอัตโนมัติก่อนส่งคำขอลา
    if (window.PVTSDK?.user?.ensureLeaveBalances) {
      for (const item of payload) {
        await window.PVTSDK.user.ensureLeaveBalances(currentEmpId, item.start_date);
      }
    }

    const { data, error } = await sb.from("leave_requests").insert(payload).select();

    if (error) {
      console.error("❌ บันทึกผิดพลาด:", error);
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
    const deptId = currentProfile?.department_id || null;
    const deptName = currentProfile?.department_name || "";
    
    const isLeaderApplicant = (
      userRole.includes("leader") || userRole.includes("supervisor") ||
      userRole.includes("head") || userRole.includes("หัวหน้า")
    );
    const isManagerApplicant = (
      userRole.includes("manager") || userRole.includes("ผู้จัดการ")
    );
    const isExecutiveApplicant = (
      userRole.includes("executive") || userRole.includes("director") ||
      userRole.includes("owner") || userRole.includes("ผู้บริหาร")
    );

    let recipient = null;
    let recipientRole = "";
    let notificationType = "NEW_REQUEST";

    // Helper: หา Executive คนแรกที่ active
    async function findExecutiveRecipient() {
      const { data: setting } = await sb.from("system_settings").select("employee_id").eq("setting_key", "leave_executive_approver").maybeSingle();
      if (!setting?.employee_id) return null;
      const { data } = await sb.from("employees").select("id, full_name, line_id, role").eq("id", setting.employee_id).maybeSingle();
      return data || null;
    }

    // --- Logic หาผู้อนุมัติ ---
    if (isExecutiveApplicant) {
      console.log("ℹ️ [Workflow] ผู้บริหารยื่นลาเอง");
      // แจ้ง HR รับทราบ
      const { data: hrEmp } = await sb.from("employees").select("id, full_name, line_id, role").in("role", ["hr", "admin"]).limit(1).maybeSingle();
      if (hrEmp) {
        recipient = hrEmp;
        recipientRole = "hr";
      }
    } else if (isManagerApplicant) {
      recipient = await findExecutiveRecipient();
      recipientRole = "executive";
      if (!recipient) {
        const { data: hrEmp } = await sb.from("employees").select("id, full_name, line_id, role").in("role", ["hr", "admin"]).limit(1).maybeSingle();
        if (hrEmp) { recipient = hrEmp; recipientRole = "hr"; }
      }
    } else if (isLeaderApplicant) {
      if (deptId) {
        const { data: routing } = await sb.from("department_approvers").select("manager_id").eq("department_id", deptId).maybeSingle();
        if (routing?.manager_id) {
          const { data: mgr } = await sb.from("employees").select("id, full_name, line_id, role").eq("id", routing.manager_id).maybeSingle();
          recipient = mgr;
          recipientRole = "manager";
        }
      }
      if (!recipient) {
        recipient = await findExecutiveRecipient();
        recipientRole = "executive";
      }
      if (!recipient) {
        const { data: hrEmp } = await sb.from("employees").select("id, full_name, line_id, role").in("role", ["hr", "admin"]).limit(1).maybeSingle();
        if (hrEmp) { recipient = hrEmp; recipientRole = "hr"; }
      }
    } else {
      // พนักงานทั่วไป: ลำดับคือ หัวหน้างาน (L1) -> ผู้จัดการฝ่าย (L2) -> ผู้บริหาร (L3) -> HR
      if (deptId) {
        const { data: routing } = await sb.from("department_approvers").select("supervisor_id, manager_id").eq("department_id", deptId).maybeSingle();
        if (routing?.supervisor_id) {
          const { data: leaderEmp } = await sb.from("employees").select("id, full_name, line_id, role").eq("id", routing.supervisor_id).maybeSingle();
          recipient = leaderEmp;
          recipientRole = "leader";
        } else if (routing?.manager_id) {
          const { data: mgrEmp } = await sb.from("employees").select("id, full_name, line_id, role").eq("id", routing.manager_id).maybeSingle();
          recipient = mgrEmp;
          recipientRole = "manager";
        }
      }
      if (!recipient) {
        recipient = await findExecutiveRecipient();
        recipientRole = "executive";
      }
      if (!recipient) {
        const { data: hrEmp } = await sb.from("employees").select("id, full_name, line_id, role").in("role", ["hr", "admin"]).limit(1).maybeSingle();
        if (hrEmp) { recipient = hrEmp; recipientRole = "hr"; }
      }
    }

    // 💬 1. แจ้งเตือนในระบบและ LINE (ผ่าน Workflow กลาง)
    if (recipient && recipient.id) {
      try {
        payload.forEach((item, index) => {
          const insertedLeave = (data && data[index]) ? data[index] : null;
          const leaveId = insertedLeave ? insertedLeave.id : '';

          const leaveTypeObj = (leaveTypes || []).find(t => String(t.id) === String(item.leave_type_id));
          const leaveName = leaveTypeObj ? leaveTypeObj.leave_name : "ใบลา";
          
          const notificationTitle = `มีคำขอลาใหม่จาก ${empName}`;
          const notificationMessage = `พนักงาน: ${empName} (${currentProfile.employee_code || "-"})\nประเภท: ${leaveName}\nวันที่: ${item.start_date} ถึง ${item.end_date}\nเหตุผล: ${item.reason}`;

          // 🔔 บันทึกลงตาราง notifications (In-app)
          sb.from("notifications").insert({
            employee_id: recipient.id,
            title: notificationTitle,
            message: notificationMessage,
            type: 'leave',
            link_url: '/pages/hr/hr.html'
          });

          // โค้ดเดิม (Workflow SDK) - ส่ง Flex Message สวยงามพร้อมปุ่มกด
          window.PVTSDK.line.sendWorkflowNotification({
            type: notificationType,
            leaveId: leaveId,
            recipientId: recipient.id,
            recipientLineId: recipient.line_id || "",
            employeeName: empName,
            employeeCode: currentProfile.employee_code || "",
            departmentName: deptName,
            recipientRole: recipientRole,
            leaveType: leaveName,
            startDate: item.start_date,
            endDate: item.end_date,
            totalDays: item.total_days,
            reason: item.reason,
            attachmentUrl: item.attachment_url || ""
          });
        });
      } catch (err) {
        console.warn("⚠️ [Notification Trigger] Error:", err);
      }
    }

    Swal.fire({
      title: 'ส่งคำขอลาสำเร็จ!',
      html: `ระบบได้ทำการบันทึกข้อมูลเรียบร้อยแล้ว<br><br><span style="color:#0f766e; font-weight:600; font-size:14px;">📌 กรุณากลับเข้ามาติดตามผลการอนุมัติใบลาภายใน 3 วันนะครับ</span>`,
      icon: 'success',
      confirmButtonColor: '#0f766e',
      confirmButtonText: 'รับทราบ'
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
// 🔮 12. เมนูคู่มือและการทำงานเริ่มต้น
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

// ป้องกันปัญหา BFCache เวลาสลับหน้า/กด Back บน iOS Safari
window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadCompanyHolidays(); 
  await loadLeaveTypes();      
  await fetchCurrentUserData(); 
  
  const currentEmpId = currentProfile?.id || currentProfile?.employee_id;
  if (currentEmpId) {
    await fetchUserExistingLeaveDates(currentEmpId);
  }

  addLeaveRow(); 
});

// ฟังก์ชันคำนวณการกดปุ่ม + และ -
function stepHours(btn, direction) {
  const container = btn.closest('.stepper-container');
  if (!container) return;

  const input = container.querySelector('input[type="number"]');
  if (!input || input.disabled) return;

  let step = parseFloat(input.step) || 0.5;
  let min = parseFloat(input.min) || 0;
  let max = parseFloat(input.max) || 4;
  let val = parseFloat(input.value) || 0;

  let newVal = val + (direction * step);
  if (newVal < min) newVal = min;
  if (newVal > max) newVal = max;

  input.value = Math.round(newVal * 100) / 100; // ป้องกันปัญหา Floating point บน JS
  calculateLeaveDays(input);
}

// 🌐 Global Window Function Bindings for Leave Form Page
window.stepHours = typeof stepHours !== 'undefined' ? stepHours : window.stepHours;
window.removeLeaveRow = typeof removeLeaveRow !== 'undefined' ? removeLeaveRow : window.removeLeaveRow;
window.addLeaveRow = typeof addLeaveRow !== 'undefined' ? addLeaveRow : window.addLeaveRow;
window.calculateLeaveDays = typeof calculateLeaveDays !== 'undefined' ? calculateLeaveDays : window.calculateLeaveDays;
window.handleFileChange = typeof handleFileChange !== 'undefined' ? handleFileChange : window.handleFileChange;
window.updateLeaveBalanceDisplay = typeof updateLeaveBalanceDisplay !== 'undefined' ? updateLeaveBalanceDisplay : window.updateLeaveBalanceDisplay;

window.addEventListener("pvt-lang-changed", () => {
  if (typeof window.renderAllLeaveBalances === "function") {
    window.renderAllLeaveBalances();
  }
  document.querySelectorAll('select[name="leave_type_id"]').forEach(selectEl => {
    if (typeof renderLeaveTypeOptions === "function") {
      renderLeaveTypeOptions(selectEl);
    }
  });
});