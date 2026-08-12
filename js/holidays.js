/**
 * ==========================================================================
 * 🤍 PVT WORKFORCE HUB - Holidays Management Module (holidays.js)
 * ==========================================================================
 */

let currentYear = 2026;
let holidaysData = [];
let currentView = 'grid';
let currentUserProfile = null;

// ข้อมูลวันหยุดประจำปี 2026 (สำรองในกรณี DB ยังไม่ได้สร้างตาราง หรือโหลดไม่สำเร็จ)
const defaultHolidays2026 = [
  { id: 'def-1', holiday_date: '2026-01-01', holiday_name: 'วันขึ้นปีใหม่', holiday_type: 'official', description: 'วันหยุดต้อนรับปีใหม่ พ.ศ. 2569' },
  { id: 'def-2', holiday_date: '2026-03-03', holiday_name: 'วันมาฆบูชา', holiday_type: 'official', description: 'วันสำคัญทางศาสนาพุทธ' },
  { id: 'def-3', holiday_date: '2026-04-06', holiday_name: 'วันจักรี', holiday_type: 'official', description: 'วันระลึกมหาจักรีบรมราชวงศ์' },
  { id: 'def-4', holiday_date: '2026-04-13', holiday_name: 'วันสงกรานต์', holiday_type: 'official', description: 'วันขึ้นปีใหม่ไทย' },
  { id: 'def-5', holiday_date: '2026-04-14', holiday_name: 'วันสงกรานต์', holiday_type: 'official', description: 'วันครอบครัว' },
  { id: 'def-6', holiday_date: '2026-04-15', holiday_name: 'วันสงกรานต์', holiday_type: 'official', description: 'วันผู้สูงอายุแห่งชาติ' },
  { id: 'def-7', holiday_date: '2026-05-01', holiday_name: 'วันแรงงานแห่งชาติ', holiday_type: 'company', description: 'วันหยุดพิเศษประจำปีของพนักงาน' },
  { id: 'def-8', holiday_date: '2026-05-04', holiday_name: 'วันฉัตรมงคล', holiday_type: 'official', description: 'วันรอยพระบาทสมเด็จพระเจ้าอยู่หัวเสด็จบรมราชาภิเษก' },
  { id: 'def-9', holiday_date: '2026-05-31', holiday_name: 'วันวิสาขบูชา', holiday_type: 'official', description: 'วันสำคัญทางศาสนาพุทธ' },
  { id: 'def-10', holiday_date: '2026-06-03', holiday_name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี', holiday_type: 'official', description: 'วันเฉลิมพระชนมพรรษา' },
  { id: 'def-11', holiday_date: '2026-07-28', holiday_name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', holiday_type: 'official', description: 'วันเฉลิมพระชนมพรรษา ร.10' },
  { id: 'def-12', holiday_date: '2026-07-29', holiday_name: 'วันอาสาฬหบูชา', holiday_type: 'official', description: 'วันสำคัญทางศาสนาพุทธ' },
  { id: 'def-13', holiday_date: '2026-08-12', holiday_name: 'วันแม่แห่งชาติ', holiday_type: 'official', description: 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง' },
  { id: 'def-14', holiday_date: '2026-10-13', holiday_name: 'วันนวมินทรมหาราช', holiday_type: 'official', description: 'วันคล้ายวันสวรรคต ร.9' },
  { id: 'def-15', holiday_date: '2026-10-23', holiday_name: 'วันปิยมหาราช', holiday_type: 'official', description: 'วันคล้ายวันสวรรคต ร.5' },
  { id: 'def-16', holiday_date: '2026-12-05', holiday_name: 'วันพ่อแห่งชาติ', holiday_type: 'official', description: 'วันคล้ายวันพระบรมราชสมภพ ร.9' },
  { id: 'def-17', holiday_date: '2026-12-10', holiday_name: 'วันรัฐธรรมนูญ', holiday_type: 'official', description: 'วันระลึกการมีรัฐธรรมนูญฉบับแรก' },
  { id: 'def-18', holiday_date: '2026-12-31', holiday_name: 'วันสิ้นปี', holiday_type: 'official', description: 'วันหยุดส่งท้ายปีเก่า' }
];

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// 🚀 INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  initNotificationBell();
  await fetchHolidays();
});

// 🛠️ HELPER: แปลงสตริง วันที่ ป้องกัน Timezone Offset และรองรับ ISO String
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  
  // ตัดส่วนเวลา T... ออกถ้ามี (เช่น "2026-08-12T00:00:00.000Z" -> "2026-08-12")
  const cleanStr = dateStr.toString().split('T')[0];
  const parts = cleanStr.split('-').map(Number);
  
  if (parts.length < 3 || parts.some(isNaN)) {
    return new Date();
  }
  
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// 👤 ดึงข้อมูลโปรไฟล์ผู้ใช้ และตั้งค่าการแสดงผล UI ตามสิทธิ์ (Role)
async function loadUserProfile() {
  try {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        currentUserProfile = profile;
        
        const elName = document.getElementById('userName');
        const elRole = document.getElementById('userRole');
        const elAvatar = document.getElementById('userAvatar');
        const btnAdd = document.getElementById('btnAddHoliday');

        if (elName) elName.innerText = profile.display_name || profile.username || 'เจ้าหน้าที่';
        if (elRole) elRole.innerText = profile.role ? profile.role.toUpperCase() : 'PVT USER';
        if (elAvatar) elAvatar.innerText = (profile.display_name || 'HR').substring(0, 2).toUpperCase();

        const isPowerUser = ['admin', 'hr'].includes(profile.role ? profile.role.toLowerCase() : '');

        if (btnAdd) {
          btnAdd.style.display = isPowerUser ? 'inline-flex' : 'none';
        }

        document.querySelectorAll('.hr-only').forEach(el => {
          el.style.display = isPowerUser ? 'flex' : 'none';
        });
      }
    }
  } catch (err) {
    console.warn('Profile error:', err.message);
  }
}

// 📥 โหลดข้อมูลวันหยุดจาก Supabase
async function fetchHolidays() {
  const yearSelect = document.getElementById('yearSelect');
  currentYear = yearSelect ? parseInt(yearSelect.value) : 2026;

  try {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    let dataFromDb = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .gte('holiday_date', `${currentYear}-01-01`)
        .lte('holiday_date', `${currentYear}-12-31`)
        .order('holiday_date', { ascending: true });

      if (!error && data && data.length > 0) {
        dataFromDb = data;
      }
    }

    if (dataFromDb.length === 0) {
      holidaysData = defaultHolidays2026.map((item, idx) => ({
        ...item,
        id: `def-${currentYear}-${idx}`,
        holiday_date: item.holiday_date.replace('2026', currentYear.toString())
      }));
    } else {
      holidaysData = dataFromDb;
    }

    holidaysData.sort((a, b) => parseLocalDate(a.holiday_date) - parseLocalDate(b.holiday_date));
    updateStatsAndHero();
    filterHolidays();
  } catch (err) {
    console.error('Error fetching holidays:', err);
    holidaysData = defaultHolidays2026.map((item, idx) => ({
      ...item,
      id: `def-${currentYear}-${idx}`,
      holiday_date: item.holiday_date.replace('2026', currentYear.toString())
    }));
    updateStatsAndHero();
    filterHolidays();
  }
}

// 📊 อัปเดต Banner และ KPI Cards
function updateStatsAndHero() {
  const total = holidaysData.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // กรองเฉพาะวันหยุดที่ตั้งแต่วันนี้เป็นต้นไป
  let upcomingList = holidaysData.filter(h => {
    const hDate = parseLocalDate(h.holiday_date);
    hDate.setHours(0, 0, 0, 0);
    return hDate >= today;
  });

  // เรียงลำดับวันที่จากใกล้ไปไกล
  upcomingList.sort((a, b) => parseLocalDate(a.holiday_date) - parseLocalDate(b.holiday_date));

  const elStatTotal = document.getElementById('statTotalHolidays');
  const elStatRemaining = document.getElementById('statRemainingHolidays');
  if (elStatTotal) elStatTotal.innerText = `${total} วัน`;
  if (elStatRemaining) elStatRemaining.innerText = `${upcomingList.length} วัน`;

  const nextHoliday = upcomingList.length > 0 ? upcomingList[0] : null;

  const elNextName = document.getElementById('statNextHolidayName');
  const elNextDate = document.getElementById('statNextHolidayDate');
  const elHeroTitle = document.getElementById('heroHolidayTitle');
  const elHeroDetails = document.getElementById('heroHolidayDateDetails');
  const elHeroCountdown = document.getElementById('heroCountdownDays');

  if (nextHoliday) {
    const hDate = parseLocalDate(nextHoliday.holiday_date);
    hDate.setHours(0, 0, 0, 0);
    
    const diffTime = hDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (elNextName) elNextName.innerText = nextHoliday.holiday_name;
    if (elNextDate) elNextDate.innerText = formatThaiDateShort(nextHoliday.holiday_date);
    if (elHeroTitle) elHeroTitle.innerText = nextHoliday.holiday_name;
    if (elHeroDetails) elHeroDetails.innerText = `${formatThaiDateFull(nextHoliday.holiday_date)} (${nextHoliday.description || 'วันหยุดตามปฏิทิน'})`;
    if (elHeroCountdown) elHeroCountdown.innerText = diffDays === 0 ? 'วันนี้' : diffDays;
  } else {
    // Fallback กรณีไม่มีวันหยุดถัดไปในปีนี้แล้ว
    if (elNextName) elNextName.innerText = 'ไม่มีวันหยุดถัดไป';
    if (elNextDate) elNextDate.innerText = '-';
    if (elHeroTitle) elHeroTitle.innerText = 'ไม่มีวันหยุดถัดไปในปีนี้';
    if (elHeroDetails) elHeroDetails.innerText = 'ผ่านพ้นวันหยุดทั้งหมดของปีนี้เรียบร้อยแล้ว';
    if (elHeroCountdown) elHeroCountdown.innerText = '0';
  }
}

// 🔍 ระบบกรองและค้นหา
function filterHolidays() {
  const searchInput = document.getElementById('holidaySearchInput');
  const categorySelect = document.getElementById('categorySelect');

  const searchTxt = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const category = categorySelect ? categorySelect.value : 'all';

  const filtered = holidaysData.filter(h => {
    const matchCategory = category === 'all' || h.holiday_type === category;
    const matchSearch = h.holiday_name.toLowerCase().includes(searchTxt) ||
                        (h.description && h.description.toLowerCase().includes(searchTxt)) ||
                        h.holiday_date.includes(searchTxt);
    return matchCategory && matchSearch;
  });

  if (currentView === 'grid') {
    renderGrid(filtered);
  } else {
    renderTable(filtered);
  }
}

// 🎴 แสดงผลแบบ Card Grid
function renderGrid(list) {
  const container = document.getElementById('holidayGridContainer');
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state-box" style="grid-column: 1/-1; text-align: center; padding: 40px; color: #94a3b8;"><h3>ไม่พบข้อมูลวันหยุด</h3></div>`;
    return;
  }

  const isPowerUser = currentUserProfile ? ['admin', 'hr'].includes(currentUserProfile.role ? currentUserProfile.role.toLowerCase() : '') : false;

  container.innerHTML = list.map(item => {
    const hDate = parseLocalDate(item.holiday_date);
    const dayNum = hDate.getDate();
    const monthTxt = THAI_MONTHS_SHORT[hDate.getMonth()];
    const dayName = THAI_DAYS[hDate.getDay()];
    const isPast = hDate < today;

    let tagClass = item.holiday_type === 'company' ? 'company' : (item.holiday_type === 'substitution' ? 'substitution' : 'official');
    let tagText = item.holiday_type === 'company' ? 'วันหยุดบริษัท' : (item.holiday_type === 'substitution' ? 'หยุดชดเชย' : 'นักขัตฤกษ์');

    const diffDays = Math.ceil((hDate - today) / (1000 * 60 * 60 * 24));
    let countdownText = diffDays === 0 ? 'วันนี้' : (diffDays < 0 ? `ผ่านไปแล้ว` : `อีก ${diffDays} วัน`);

    const actionBtns = isPowerUser ? `
      <div class="card-action-btns">
        <button type="button" class="btn-icon-action" onclick="openEditHolidayModal('${item.id}')" title="แก้ไข">
          <span class="material-symbols-outlined">edit</span>
        </button>
        <button type="button" class="btn-icon-action delete" onclick="deleteHoliday('${item.id}')" title="ลบ">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>` : '';

    return `
      <div class="holiday-card ${isPast ? 'past-holiday' : ''}">
        <div>
          <div class="card-top">
            <div class="date-badge-box">
              <span class="date-badge-day">${dayNum}</span>
              <span class="date-badge-month">${monthTxt}</span>
            </div>
            <span class="tag-badge ${tagClass}">${tagText}</span>
          </div>
          <div class="card-body-content">
            <h3>${item.holiday_name}</h3>
            <div class="day-name">วัน${dayName}ที่ ${formatThaiDateShort(item.holiday_date)}</div>
            <p class="description-text">${item.description || '-'}</p>
          </div>
        </div>
        <div class="card-footer-action">
          <span class="days-left-text">${countdownText}</span>
          ${actionBtns}
        </div>
      </div>`;
  }).join('');
}

// 📋 แสดงผลแบบ Table
function renderTable(list) {
  const tbody = document.getElementById('holidayTableBody');
  if (!tbody) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty-state">ไม่พบข้อมูลวันหยุด</td></tr>`;
    return;
  }

  const isPowerUser = currentUserProfile ? ['admin', 'hr'].includes(currentUserProfile.role ? currentUserProfile.role.toLowerCase() : '') : false;

  tbody.innerHTML = list.map((item, index) => {
    const hDate = parseLocalDate(item.holiday_date);
    const dayName = THAI_DAYS[hDate.getDay()];
    const isPast = hDate < today;

    let tagText = item.holiday_type === 'company' ? 'วันหยุดบริษัท' : (item.holiday_type === 'substitution' ? 'หยุดชดเชย' : 'นักขัตฤกษ์');

    return `
      <tr style="${isPast ? 'opacity: 0.6; background: #f8fafc;' : ''}">
        <td style="text-align: center;">${index + 1}</td>
        <td><strong>${formatThaiDateShort(item.holiday_date)}</strong></td>
        <td>วัน${dayName}</td>
        <td><strong>${item.holiday_name}</strong></td>
        <td>${tagText}</td>
        <td>${isPast ? 'ผ่านมาแล้ว' : 'กำลังจะถึง'}</td>
        <td>${item.description || '-'}</td>
        <td style="text-align: center;">
          ${isPowerUser ? `
            <div class="table-action-btns">
              <button type="button" class="btn-table-edit" onclick="openEditHolidayModal('${item.id}')">แก้ไข</button>
              <button type="button" class="btn-table-delete" onclick="deleteHoliday('${item.id}')">ลบ</button>
            </div>
          ` : '-'}
        </td>
      </tr>`;
  }).join('');
}

// 👁️ สลับมุมมอง (Card Grid / Table)
function switchView(view) {
  currentView = view;
  const btnGrid = document.getElementById('btnViewGrid');
  const btnTable = document.getElementById('btnViewTable');
  const gridContainer = document.getElementById('holidayGridContainer');
  const tableContainer = document.getElementById('holidayTableContainer');

  if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
  if (btnTable) btnTable.classList.toggle('active', view === 'table');
  if (gridContainer) gridContainer.style.display = view === 'grid' ? 'grid' : 'none';
  if (tableContainer) tableContainer.style.display = view === 'table' ? 'block' : 'none';

  filterHolidays();
}

function changeYear() { fetchHolidays(); }

// 🪟 MODAL MANAGEMENT
function openHolidayModal() {
  const role = currentUserProfile?.role ? currentUserProfile.role.toLowerCase() : '';
  const isPowerUser = ['admin', 'hr'].includes(role);

  if (!isPowerUser) {
    Swal.fire({
      icon: 'error',
      title: 'ไม่มีสิทธิ์เข้าถึง',
      text: 'เฉพาะ HR และ Admin เท่านั้นที่สามารถเพิ่มวันหยุดได้'
    });
    return;
  }

  const overlay = document.getElementById('holidayModalOverlay');
  const form = document.getElementById('holidayForm');
  const titleText = document.getElementById('modalTitleText');
  const holidayIdInput = document.getElementById('holidayId');

  if (form) form.reset();
  if (holidayIdInput) holidayIdInput.value = '';
  if (titleText) titleText.innerText = 'เพิ่มวันหยุดใหม่';
  if (overlay) overlay.style.display = 'flex';
}

function openEditHolidayModal(id) {
  const item = holidaysData.find(h => h.id.toString() === id.toString());
  if (!item) return;

  const overlay = document.getElementById('holidayModalOverlay');
  const titleText = document.getElementById('modalTitleText');
  
  document.getElementById('holidayId').value = item.id;
  document.getElementById('holidayDate').value = item.holiday_date;
  document.getElementById('holidayName').value = item.holiday_name;
  document.getElementById('holidayCategory').value = item.holiday_type || 'official';
  document.getElementById('holidayDescription').value = item.description || '';

  if (titleText) titleText.innerText = 'แก้ไขข้อมูลวันหยุด';
  if (overlay) overlay.style.display = 'flex';
}

function closeHolidayModal() {
  const overlay = document.getElementById('holidayModalOverlay');
  if (overlay) overlay.style.display = 'none';
}

async function handleSaveHoliday(event) {
  event.preventDefault();

  const id = document.getElementById('holidayId').value;
  const holidayDate = document.getElementById('holidayDate').value;
  const holidayName = document.getElementById('holidayName').value.trim();
  const holidayType = document.getElementById('holidayCategory').value;
  const description = document.getElementById('holidayDescription').value.trim();

  const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;

  try {
    if (supabase) {
      if (id && !id.startsWith('def-') && !id.startsWith('local-')) {
        const { error } = await supabase
          .from('holidays')
          .update({
            holiday_name: holidayName,
            holiday_date: holidayDate,
            holiday_type: holidayType,
            description: description
          })
          .eq('id', id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('holidays')
          .insert([
            {
              holiday_name: holidayName,
              holiday_date: holidayDate,
              holiday_type: holidayType,
              description: description
            }
          ]);

        if (error) throw error;
      }
    } else {
      if (id) {
        const index = holidaysData.findIndex(h => h.id === id);
        if (index !== -1) {
          holidaysData[index] = { ...holidaysData[index], holiday_name: holidayName, holiday_date: holidayDate, holiday_type: holidayType, description: description };
        }
      } else {
        holidaysData.push({
          id: `local-${Date.now()}`,
          holiday_name: holidayName,
          holiday_date: holidayDate,
          holiday_type: holidayType,
          description: description
        });
      }
    }

    Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: id ? 'แก้ไขข้อมูลวันหยุดเรียบร้อยแล้ว' : 'เพิ่มข้อมูลวันหยุดเรียบร้อยแล้ว',
      timer: 1500,
      showConfirmButton: false
    });

    closeHolidayModal();
    await fetchHolidays();
  } catch (err) {
    console.error('Error saving holiday:', err);
    Swal.fire({
      icon: 'error',
      title: 'บันทึกไม่สำเร็จ',
      text: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล'
    });
  }
}

async function deleteHoliday(id) {
  const res = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: 'คุณต้องการลบรายการวันหยุดนี้ใช่หรือไม่',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบรายการ',
    cancelButtonText: 'ยกเลิก'
  });

  if (res.isConfirmed) {
    try {
      const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
      if (supabase && !id.startsWith('def-') && !id.startsWith('local-')) {
        const { error } = await supabase.from('holidays').delete().eq('id', id);
        if (error) throw error;
      } else {
        holidaysData = holidaysData.filter(h => h.id !== id);
      }

      Swal.fire({ icon: 'success', title: 'ลบข้อมูลเรียบร้อยแล้ว', timer: 1200, showConfirmButton: false });
      await fetchHolidays();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
    }
  }
}

// 🗓️ DATE FORMATTING UTILITIES
function formatThaiDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = parseLocalDate(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatThaiDateFull(dateStr) {
  if (!dateStr) return '-';
  const d = parseLocalDate(dateStr);
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
}

// 🔔 NOTIFICATION & NAVIGATION
function initNotificationBell() {
  const notifBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => { 
      e.stopPropagation(); 
      notifDropdown.classList.toggle('show'); 
    });
    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
        notifDropdown.classList.remove('show');
      }
    });
  }
}

function smartGoBack(defaultUrl = '/pages/user/index-user.html') {
  if (document.referrer && document.referrer.includes(window.location.host)) {
    history.back();
  } else {
    window.location.href = defaultUrl;
  }
}