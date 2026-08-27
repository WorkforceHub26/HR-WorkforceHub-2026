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
    const rawSession = localStorage.getItem("currentUser");
    if (!rawSession) return;
    
    const sessionUser = JSON.parse(rawSession);
    currentUserProfile = sessionUser;
    
    const elName = document.getElementById('userName');
    const elRole = document.getElementById('userRole');
    const elAvatar = document.getElementById('userAvatar');
    const btnAdd = document.getElementById('btnAddHoliday');

    if (elName) elName.innerText = sessionUser.full_name || 'เจ้าหน้าที่';
    if (elRole) elRole.innerText = sessionUser.role ? sessionUser.role.toUpperCase() : 'PVT USER';
    if (elAvatar) elAvatar.innerText = (sessionUser.full_name || 'HR').substring(0, 2).toUpperCase();

    const role = sessionUser.role ? sessionUser.role.toLowerCase() : '';
    const isPowerUser = ['admin', 'hr', 'executive', 'director'].includes(role);
    
    // Show team leaves tab for non-normal users (leader, manager, hr, executive, admin, etc.)
    if (role !== 'user' && role !== '') {
      const tabTeamLeaves = document.getElementById('tabTeamLeaves');
      if (tabTeamLeaves) tabTeamLeaves.style.display = 'inline-block';
    }

    if (btnAdd) {
      btnAdd.style.display = isPowerUser ? 'inline-flex' : 'none';
    }

    document.querySelectorAll('.hr-only').forEach(el => {
      el.style.display = isPowerUser ? 'flex' : 'none';
    });
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
// 1. ฟังก์ชันกรองข้อมูลวันหยุดตามหมวดหมู่และคำค้นหา[cite: 23]
function filterHolidays() {
  const searchInput = document.getElementById('holidaySearchInput'); 
  const categorySelect = document.getElementById('categorySelect'); 
  const monthSelect = document.getElementById('monthSelect');
  const yearSelect = document.getElementById('yearSelect');

  const searchTxt = searchInput ? searchInput.value.toLowerCase().trim() : ''; 
  const category = categorySelect ? categorySelect.value : 'all'; 
  const selectedMonthVal = monthSelect ? monthSelect.value : 'all';

  const filtered = holidaysData.filter(h => { 
    const matchCategory = category === 'all' || h.holiday_type === category; 
    const matchSearch = h.holiday_name.toLowerCase().includes(searchTxt) ||
                        (h.description && h.description.toLowerCase().includes(searchTxt)) || 
                        h.holiday_date.includes(searchTxt); 
    return matchCategory && matchSearch; 
  });

  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const month = companyCalCurrentDate.getMonth();
  const year = companyCalCurrentDate.getFullYear();
  const titleEl = document.getElementById('companyCalMonthYear');

  if (yearSelect && yearSelect.value !== year.toString()) {
    yearSelect.value = year.toString();
  }

  if (selectedMonthVal === 'all') {
    if (titleEl) titleEl.innerText = `ปี ${year + 543} (สรุปวันหยุดทั้งปี)`;
    if (monthSelect) monthSelect.value = 'all';

    if (window.renderCompanyCalendarGrid) {
      window.renderCompanyCalendarGrid(year, month, filtered);
      window.renderCompanySummarySidebar(filtered, null, true);
    }
  } else {
    if (monthSelect && monthSelect.value !== month.toString()) {
      monthSelect.value = month.toString();
    }
    if (titleEl) titleEl.innerText = `${monthNames[month]} ${year + 543}`;

    if (window.renderCompanyCalendarGrid) {
      window.renderCompanyCalendarGrid(year, month, filtered);
      const monthHolidays = filtered.filter(h => h.holiday_date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`));
      window.renderCompanySummarySidebar(monthHolidays);
    }
  }
}

// 🎴 แสดงผลแบบ Card Grid
// 🎴 แสดงผลแบบ Card Grid
// แสดง: วันที่ / เดือน / วันในสัปดาห์ / ชื่อวันหยุด / ประเภท / รายละเอียด / สถานะ
function renderGrid(list) {
  const container = document.getElementById('holidayGridContainer');
  if (!container) return;

  // ไม่มีข้อมูล
  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="loading-state-box" style="grid-column: 1 / -1;">
        <span class="material-symbols-outlined" style="font-size:42px; color:#94a3b8;">
          event_busy
        </span>
        <p style="color:#64748b; margin-top:10px;">
          ไม่พบข้อมูลวันหยุด
        </p>
      </div>
    `;
    return;
  }

  // วันนี้
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ตรวจสอบสิทธิ์ HR / Admin
  const isPowerUser = currentUserProfile
    ? ['admin', 'hr'].includes(
        currentUserProfile.role
          ? currentUserProfile.role.toLowerCase()
          : ''
      )
    : false;

  container.innerHTML = list.map(item => {

    // ------------------------------------------
    // 📅 แปลงวันที่
    // ------------------------------------------
    const hDate = parseLocalDate(item.holiday_date);

    const dayNumber = hDate.getDate();
    const monthShort = THAI_MONTHS_SHORT[hDate.getMonth()];
    const dayName = THAI_DAYS[hDate.getDay()];

    // วันที่วันนี้ของรายการ
    const holidayDateOnly = new Date(hDate);
    holidayDateOnly.setHours(0, 0, 0, 0);

    const diffTime = holidayDateOnly.getTime() - today.getTime();
    const diffDays = Math.ceil(
      diffTime / (1000 * 60 * 60 * 24)
    );

    const isPast = holidayDateOnly < today;
    const isToday = diffDays === 0;

    // ------------------------------------------
    // 🏷️ ประเภทวันหยุด
    // ------------------------------------------
    let tagClass = 'official';
    let tagText = 'นักขัตฤกษ์';

    if (item.holiday_type === 'company') {
      tagClass = 'company';
      tagText = 'วันหยุดบริษัท';
    } else if (item.holiday_type === 'substitution') {
      tagClass = 'substitution';
      tagText = 'หยุดชดเชย';
    }

    // ------------------------------------------
    // ⏳ ข้อความสถานะ
    // ------------------------------------------
    let daysText = '';

    if (isToday) {
      daysText = '📌 วันนี้';
    } else if (isPast) {
      daysText = 'ผ่านมาแล้ว';
    } else if (diffDays === 1) {
      daysText = '⏰ พรุ่งนี้';
    } else {
      daysText = `อีก ${diffDays} วัน`;
    }

    // ------------------------------------------
    // 🔧 ปุ่มจัดการสำหรับ HR / Admin
    // ------------------------------------------
    const actionButtons = isPowerUser
      ? `
        <div class="card-action-btns">
          <button
            type="button"
            class="btn-icon-action"
            onclick="openEditHolidayModal('${item.id}')"
            title="แก้ไขวันหยุด"
          >
            <span class="material-symbols-outlined">edit</span>
          </button>

          <button
            type="button"
            class="btn-icon-action"
            onclick="deleteHoliday('${item.id}')"
            title="ลบวันหยุด"
          >
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      `
      : '';

    // ------------------------------------------
    // 🎨 Card
    // ------------------------------------------
    return `
      <div class="holiday-card ${isPast ? 'past-holiday' : ''}">

        <!-- ส่วนบน -->
        <div class="card-top">

          <!-- 📅 วันที่ -->
          <div class="date-badge-box">
            <span class="date-badge-day">
              ${dayNumber}
            </span>

            <span class="date-badge-month">
              ${monthShort}
            </span>
          </div>

          <!-- 🏷️ ประเภท -->
          <span class="tag-badge ${tagClass}">
            ${tagText}
          </span>

        </div>

        <!-- ส่วนข้อมูล -->
        <div class="card-body-content">

          <!-- วันในสัปดาห์ -->
          <div class="day-name">
            วัน${dayName}
          </div>

          <!-- ชื่อวันหยุด -->
          <h3>
            ${item.holiday_name || 'ไม่ระบุชื่อวันหยุด'}
          </h3>

          <!-- รายละเอียด -->
          <p class="description-text">
            ${item.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
          </p>

        </div>

        <!-- ส่วนล่าง -->
        <div class="card-footer-action">

          <!-- สถานะวันหยุด -->
          <span class="days-left-text">
            ${daysText}
          </span>

          <!-- ปุ่มจัดการ -->
          ${actionButtons}

        </div>

      </div>
    `;
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

function changeYearOrMonth() {
  const yearSelect = document.getElementById('yearSelect');
  const monthSelect = document.getElementById('monthSelect');
  const year = yearSelect ? parseInt(yearSelect.value, 10) : new Date().getFullYear();
  const monthVal = monthSelect ? monthSelect.value : 'all';
  
  if (window.companyCalCurrentDate) {
    companyCalCurrentDate.setFullYear(year);
    if (monthVal !== 'all') {
      const m = parseInt(monthVal, 10);
      if (!isNaN(m)) {
        companyCalCurrentDate.setMonth(m);
      }
    }
  }
  fetchHolidays();
}

window.showYearlySummary = function() {
  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) monthSelect.value = 'all';
  filterHolidays();
};

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
  event.preventDefault(); //[cite: 23]

  const id = document.getElementById('holidayId').value; //[cite: 23]
  const holidayDate = document.getElementById('holidayDate').value; //[cite: 23]
  const holidayName = document.getElementById('holidayName').value.trim(); //[cite: 23]
  const holidayType = document.getElementById('holidayCategory').value; //[cite: 23]
  const description = document.getElementById('holidayDescription').value.trim(); //[cite: 23]

  const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null; //[cite: 23]

  try {
    if (supabase) { //[cite: 23]
      const payload = {
        holiday_name: holidayName, //[cite: 23]
        holiday_date: holidayDate, //[cite: 23]
        holiday_type: holidayType, //[cite: 23]
        description: description  // บันทึกรายละเอียด/เหตุผลวันหยุด[cite: 23]
      };

      if (id && !id.startsWith('def-') && !id.startsWith('local-')) { //[cite: 23]
        await supabase.from('holidays').update(payload).eq('id', id); //[cite: 23]
      } else {
        await supabase.from('holidays').insert([payload]); //[cite: 23]
      }
    }

    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false }); //[cite: 23]
    closeHolidayModal(); //[cite: 23]
    await fetchHolidays(); //[cite: 23]
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message }); //[cite: 23]
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

// 🌐 Global Window Function Bindings for Holidays Page
window.openAddHolidayModal = typeof openAddHolidayModal !== 'undefined' ? openAddHolidayModal : window.openAddHolidayModal;
window.openEditHolidayModal = typeof openEditHolidayModal !== 'undefined' ? openEditHolidayModal : window.openEditHolidayModal;
window.deleteHoliday = typeof deleteHoliday !== 'undefined' ? deleteHoliday : window.deleteHoliday;
window.closeHolidayModal = typeof closeHolidayModal !== 'undefined' ? closeHolidayModal : window.closeHolidayModal;
window.handleSaveHoliday = typeof handleSaveHoliday !== 'undefined' ? handleSaveHoliday : window.handleSaveHoliday;

// ==========================================
// 👥 TEAM LEAVES TAB LOGIC
// ==========================================
let teamLeavesData = [];
let teamCalCurrentDate = new Date();

window.switchHolidayTab = function(tab) {
  const companyTab = document.getElementById('tabCompanyHolidays');
  const teamTab = document.getElementById('tabTeamLeaves');
  const companyWrapper = document.getElementById('companyHolidaysWrapper');
  const teamWrapper = document.getElementById('teamLeavesWrapper');

  if (tab === 'company') {
    companyTab.classList.add('active');
    teamTab.classList.remove('active');
    companyTab.style.borderBottomColor = 'var(--primary, #0fa472)';
    companyTab.style.color = 'var(--primary, #0fa472)';
    teamTab.style.borderBottomColor = 'transparent';
    teamTab.style.color = '#64748b';
    companyWrapper.style.display = 'block';
    teamWrapper.style.display = 'none';
  } else {
    teamTab.classList.add('active');
    companyTab.classList.remove('active');
    teamTab.style.borderBottomColor = 'var(--primary, #0fa472)';
    teamTab.style.color = 'var(--primary, #0fa472)';
    companyTab.style.borderBottomColor = 'transparent';
    companyTab.style.color = '#64748b';
    companyWrapper.style.display = 'none';
    teamWrapper.style.display = 'block';
    
    // Set to current month initially
    teamCalCurrentDate = new Date();
    loadTeamLeavesForCalendar(); // Load when clicked
  }
};

window.teamCalPrevMonth = function() {
  teamCalCurrentDate.setMonth(teamCalCurrentDate.getMonth() - 1);
  loadTeamLeavesForCalendar();
};

window.teamCalNextMonth = function() {
  teamCalCurrentDate.setMonth(teamCalCurrentDate.getMonth() + 1);
  loadTeamLeavesForCalendar();
};

window.toggleTeamSidebar = function() {
  const sidebar = document.getElementById('teamSummarySidebar');
  const icon = document.getElementById('teamSidebarIcon');
  
  if (window.innerWidth <= 1024) {
    // Mobile mode
    if (sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
      icon.innerText = 'chevron_left';
    } else {
      sidebar.classList.add('mobile-open');
      icon.innerText = 'chevron_right';
    }
  } else {
    // Desktop mode
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
      icon.innerText = 'chevron_right';
    } else {
      sidebar.classList.add('collapsed');
      icon.innerText = 'chevron_left';
    }
  }
};

// Also listen for resize to reset states if needed
window.addEventListener('resize', () => {
  const sidebar = document.getElementById('teamSummarySidebar');
  const icon = document.getElementById('teamSidebarIcon');
  if (window.innerWidth > 1024) {
    sidebar.classList.remove('mobile-open');
    if (!sidebar.classList.contains('collapsed')) {
      icon.innerText = 'chevron_right';
    } else {
      icon.innerText = 'chevron_left';
    }
  } else {
    sidebar.classList.remove('collapsed');
    if (!sidebar.classList.contains('mobile-open')) {
      icon.innerText = 'chevron_left';
    } else {
      icon.innerText = 'chevron_right';
    }
  }
});

window.loadTeamLeavesForCalendar = async function() {
  const grid = document.getElementById('teamCalGrid');
  const listContainer = document.getElementById('teamLeavesList');
  if (!currentUserProfile) return;
  
  const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const month = teamCalCurrentDate.getMonth();
  const year = teamCalCurrentDate.getFullYear();
  document.getElementById('teamCalMonthYear').innerText = `${monthNames[month]} ${year + 543}`;
  
  grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b;"><span class="material-symbols-outlined spinning-icon" style="font-size: 32px;">sync</span></div>`;
  listContainer.innerHTML = `<div class="loading-state-box" style="text-align: center; padding: 40px; color: #64748b;"><span class="material-symbols-outlined spinning-icon" style="font-size: 24px;">sync</span></div>`;

  try {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    if (!supabase) return;
    
    // Get start and end of the month buffer (to include crossing leaves)
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    let query = supabase
      .from('leave_requests')
      .select(`
        id, start_date, end_date, leave_type_id, total_days, reason, status,
        employees!inner (id, full_name, role, department_id, departments (department_name)),
        leave_types (leave_name)
      `)
      .in('status', ['approved', 'pending'])
      .lte('start_date', endStr)
      .gte('end_date', startStr);
      
    // Filter logic based on role
    const role = currentUserProfile.role.toLowerCase();
    const isExecutiveOrHr = ['hr', 'admin', 'executive', 'director', 'owner'].includes(role);
    
    if (!isExecutiveOrHr) {
       const deptId = currentUserProfile.department_id;
       if (deptId) query = query.eq('employees.department_id', deptId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    teamLeavesData = data || [];
    renderTeamCalendarGrid(year, month, teamLeavesData);
    renderTeamLeavesSidebar(teamLeavesData);
  } catch (err) {
    console.error('Error loading team leaves:', err);
    grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 20px; color: #ef4444; text-align: center; background: #fee2e2; border-radius: 8px;">ไม่สามารถโหลดข้อมูลได้</div>`;
  }
};

window.renderTeamCalendarGrid = function(year, month, leaves) {
  const grid = document.getElementById('teamCalGrid');
  grid.innerHTML = '';
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = lastDay.getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const today = new Date();
  const isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);
  const todayDate = today.getDate();
  
  // Previous month trailing days
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${dayNum}</span>`;
    grid.appendChild(cell);
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    if (isCurrentMonth && i === todayDate) cell.classList.add('today');
    
    const dayStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dayLeaves = leaves.filter(l => {
      return l.start_date <= dayStr && l.end_date >= dayStr;
    });
    
    let dotsHtml = '';
    if (dayLeaves.length > 0) {
      dotsHtml = `<div class="cal-leave-dots">`;
      // Show up to 3 dots
      for(let j=0; j<Math.min(dayLeaves.length, 3); j++) {
        const bg = dayLeaves[j].status === 'approved' ? '#0fa472' : '#f59e0b';
        dotsHtml += `<div class="cal-leave-dot" style="background:${bg};" title="${dayLeaves[j].employees?.full_name}"></div>`;
      }
      if(dayLeaves.length > 3) {
         dotsHtml += `<span style="font-size: 10px; color: #64748b; line-height: 8px;">+${dayLeaves.length - 3}</span>`;
      }
      dotsHtml += `</div>`;
    }
    
    cell.innerHTML = `<span class="cal-day-number">${i}</span>${dotsHtml}`;
    cell.onclick = () => {
      document.querySelectorAll('#teamCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
      cell.style.outline = '2px solid #0fa472';
      cell.style.outlineOffset = '-2px';
      
      document.getElementById('teamSearchInput').value = '';
      if(dayLeaves.length > 0) {
        renderTeamLeavesSidebar(dayLeaves, dayStr);
      } else {
        renderTeamLeavesSidebar([], dayStr);
      }
    };
    grid.appendChild(cell);
  }
  
  // Next month leading days (fill up to 42 cells = 6 rows)
  const totalCells = startOffset + daysInMonth;
  const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${i}</span>`;
    grid.appendChild(cell);
  }
};

window.filterTeamLeaves = function() {
  const keyword = (document.getElementById('teamSearchInput').value || '').toLowerCase();
  if (!keyword) {
    renderTeamLeavesSidebar(teamLeavesData);
    return;
  }
  
  const filtered = teamLeavesData.filter(leave => {
    const empName = (leave.employees?.full_name || '').toLowerCase();
    const reason = (leave.reason || '').toLowerCase();
    return empName.includes(keyword) || reason.includes(keyword);
  });
  renderTeamLeavesSidebar(filtered);
};

window.renderTeamLeavesSidebar = function(data, specificDay = null) {
  const container = document.getElementById('teamLeavesList');
  const title = document.getElementById('teamSummaryTitle');
  if (title) {
    if (specificDay) {
      title.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
          <span style="font-size: 15px;">วันที่ ${parseInt(specificDay.split('-')[2], 10)}</span>
          <button type="button" onclick="renderTeamLeavesSidebar(teamLeavesData)" style="background: #f1f5f9; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined" style="font-size: 14px;">calendar_month</span> ดูทั้งเดือน
          </button>
        </div>`;
    } else {
      const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
      const currentM = teamCalCurrentDate.getMonth();
      const currentY = teamCalCurrentDate.getFullYear() + 543;
      title.innerText = `ผู้ลาเดือน${monthNames[currentM]} ${currentY}`;
      document.querySelectorAll('#teamCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
    }
  }

  if (!data || data.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
        <span class="material-symbols-outlined" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">search_off</span>
        <p style="margin: 0; font-size: 13px;">ไม่มีรายการในส่วนนี้</p>
      </div>`;
    return;
  }
  
  let html = ``;
  
  data.forEach(leave => {
    const empName = leave.employees?.full_name || 'ไม่ทราบชื่อ';
    const deptName = leave.employees?.departments?.department_name || '-';
    const leaveName = leave.leave_types?.leave_name || 'การลา';
    const startDate = new Date(leave.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const endDate = new Date(leave.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const dateDisplay = (leave.start_date === leave.end_date) ? startDate : `${startDate}-${endDate}`;
    const statusBg = leave.status === 'approved' ? '#dcfce7' : '#fef08a';
    const statusColor = leave.status === 'approved' ? '#166534' : '#854d0e';
    const statusText = leave.status === 'approved' ? 'อนุมัติ' : 'รออนุมัติ';
    
    html += `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4 style="margin: 0; font-size: 14px; color: #0f172a; line-height: 1.4;">${empName}</h4>
          <span style="background: ${statusBg}; color: ${statusColor}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; margin-left: 8px;">${statusText}</span>
        </div>
        <div style="font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 4px;">
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">event</span>${dateDisplay} (${leave.total_days} วัน)</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">category</span>${leaveName}</span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
};
window.smartGoBack = smartGoBack;
window.changeYear = typeof changeYear !== 'undefined' ? changeYear : window.changeYear;
// ----------------------------------------------------
// 🏢 COMPANY HOLIDAY CALENDAR LOGIC
// ----------------------------------------------------
let companyCalCurrentDate = new Date();

window.companyCalPrevMonth = function() {
  const oldYear = companyCalCurrentDate.getFullYear();
  companyCalCurrentDate.setMonth(companyCalCurrentDate.getMonth() - 1);
  const newYear = companyCalCurrentDate.getFullYear();

  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    monthSelect.value = companyCalCurrentDate.getMonth().toString();
  }
  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    yearSelect.value = newYear.toString();
  }

  if (oldYear !== newYear) {
    fetchHolidays();
  } else {
    filterHolidays();
  }
};

window.companyCalNextMonth = function() {
  const oldYear = companyCalCurrentDate.getFullYear();
  companyCalCurrentDate.setMonth(companyCalCurrentDate.getMonth() + 1);
  const newYear = companyCalCurrentDate.getFullYear();

  const monthSelect = document.getElementById('monthSelect');
  if (monthSelect) {
    monthSelect.value = companyCalCurrentDate.getMonth().toString();
  }
  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    yearSelect.value = newYear.toString();
  }

  if (oldYear !== newYear) {
    fetchHolidays();
  } else {
    filterHolidays();
  }
};

window.toggleCompanySidebar = function() {
  const sidebar = document.getElementById('companySummarySidebar');
  const icon = document.getElementById('companySidebarIcon');
  if (window.innerWidth <= 1024) {
    sidebar.classList.toggle('mobile-open');
    icon.innerText = sidebar.classList.contains('mobile-open') ? 'chevron_right' : 'chevron_left';
  } else {
    sidebar.classList.toggle('collapsed');
    icon.innerText = sidebar.classList.contains('collapsed') ? 'chevron_left' : 'chevron_right';
  }
};

window.renderCompanyCalendarGrid = function(year, month, holidaysList) {
  const grid = document.getElementById('companyCalGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); 
  const daysInMonth = lastDay.getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  const today = new Date();
  const isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);
  const todayDate = today.getDate();
  
  // Previous month trailing days
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${dayNum}</span>`;
    grid.appendChild(cell);
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell';
    if (isCurrentMonth && i === todayDate) cell.classList.add('today');
    
    const dayStr = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dayHolidays = holidaysList.filter(h => h.holiday_date === dayStr);
    
    let dotsHtml = '';
    if (dayHolidays.length > 0) {
      dotsHtml = `<div class="cal-leave-dots">`;
      for(let j=0; j<Math.min(dayHolidays.length, 3); j++) {
        let bg = '#3b82f6'; // company
        if(dayHolidays[j].holiday_type === 'official') bg = '#ef4444';
        if(dayHolidays[j].holiday_type === 'substitution') bg = '#f59e0b';
        dotsHtml += `<div class="cal-leave-dot" style="background:${bg};" title="${dayHolidays[j].holiday_name}"></div>`;
      }
      dotsHtml += `</div>`;
      cell.style.background = '#f0f9ff';
      cell.style.borderColor = '#bae6fd';
    }
    
    cell.innerHTML = `<span class="cal-day-number">${i}</span>${dotsHtml}`;
    cell.onclick = () => {
      // Future: highlight cell
      document.querySelectorAll('#companyCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
      cell.style.outline = '2px solid #0ea5e9';
      cell.style.outlineOffset = '-2px';
      
      if(dayHolidays.length > 0) {
        renderCompanySummarySidebar(dayHolidays, dayStr);
      } else {
        renderCompanySummarySidebar([], dayStr);
      }
    };
    grid.appendChild(cell);
  }
  
  // Next month leading days
  const totalCells = startOffset + daysInMonth;
  const remainingCells = (Math.ceil(totalCells / 7) * 7) - totalCells;
  for (let i = 1; i <= remainingCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day-cell other-month';
    cell.innerHTML = `<span class="cal-day-number">${i}</span>`;
    grid.appendChild(cell);
  }
};

window.renderCompanySummarySidebar = function(list, specificDay = null, isYearly = false) {
  const container = document.getElementById('companySummaryList');
  const title = document.getElementById('companySummaryTitle');
  if (!container || !title) return;
  
  const monthSelect = document.getElementById('monthSelect');
  const selectedMonthVal = monthSelect ? monthSelect.value : 'all';

  if (specificDay) {
    title.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span style="font-size: 14px; font-weight: 600;">ประจำวันที่ ${parseInt(specificDay.split('-')[2], 10)}</span>
        <button type="button" onclick="filterHolidays()" style="background: #f1f5f9; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 4px;">
          <span class="material-symbols-outlined" style="font-size: 14px;">calendar_month</span> ย้อนกลับ
        </button>
      </div>`;
  } else if (isYearly || selectedMonthVal === 'all') {
    const currentY = companyCalCurrentDate.getFullYear() + 543;
    title.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span style="font-size: 15px; font-weight: 700; color: #0f172a;">สรุปวันหยุดปี ${currentY}</span>
        <span style="font-size: 11px; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-weight: 600;">รวม ${list ? list.length : 0} วัน</span>
      </div>`;
    document.querySelectorAll('#companyCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
  } else {
    const monthNames = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const currentM = companyCalCurrentDate.getMonth();
    const currentY = companyCalCurrentDate.getFullYear() + 543;
    title.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <span style="font-size: 14px; font-weight: 600; color: #0f172a;">วันหยุดเดือน${monthNames[currentM]} ${currentY}</span>
        <button type="button" onclick="showYearlySummary()" style="background: #f1f5f9; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 11px; color: #0284c7; font-weight: 500; display: flex; align-items: center; gap: 3px;" title="ดูสรุปวันหยุดตลอดทั้งปี">
          <span class="material-symbols-outlined" style="font-size: 13px;">calendar_today</span> ดูทั้งปี
        </button>
      </div>`;
    document.querySelectorAll('#companyCalGrid .cal-day-cell').forEach(c => c.style.outline = 'none');
  }
  
  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #94a3b8;">
        <span class="material-symbols-outlined" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">event_busy</span>
        <p style="margin: 0; font-size: 13px;">ไม่มีวันหยุดในส่วนนี้</p>
      </div>`;
    return;
  }
  
  const isPowerUser = currentUserProfile ? ['admin', 'hr'].includes(currentUserProfile.role ? currentUserProfile.role.toLowerCase() : '') : false;
  
  let html = ``;
  list.forEach(item => {
    let tagText = item.holiday_type === 'company' ? 'วันหยุดบริษัท' : (item.holiday_type === 'substitution' ? 'หยุดชดเชย' : 'นักขัตฤกษ์');
    let color = item.holiday_type === 'company' ? '#3b82f6' : (item.holiday_type === 'substitution' ? '#f59e0b' : '#ef4444');
    let bg = item.holiday_type === 'company' ? '#eff6ff' : (item.holiday_type === 'substitution' ? '#fef3c7' : '#fef2f2');
    
    html += `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid ${color}; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4 style="margin: 0; font-size: 14px; color: #0f172a; line-height: 1.4;">${item.holiday_name}</h4>
        </div>
        <div style="font-size: 12px; color: #64748b; display: flex; flex-direction: column; gap: 4px;">
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px; color: ${color}">event</span>${formatThaiDateShort(item.holiday_date)}</span>
          <span style="display: flex; align-items: center; gap: 4px;"><span class="material-symbols-outlined" style="font-size: 14px;">category</span>${tagText}</span>
        </div>
        ${isPowerUser ? `
        <div style="margin-top: 8px; display: flex; gap: 8px; justify-content: flex-end;">
          <button type="button" onclick="openEditHolidayModal('${item.id}')" style="background: none; border: none; cursor: pointer; color: #3b82f6; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">edit</span></button>
          <button type="button" onclick="deleteHoliday('${item.id}')" style="background: none; border: none; cursor: pointer; color: #ef4444; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px;"><span class="material-symbols-outlined" style="font-size: 16px;">delete</span></button>
        </div>` : ''}
      </div>
    `;
  });
  
  container.innerHTML = html;
};
