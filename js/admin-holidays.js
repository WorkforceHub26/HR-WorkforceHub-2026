/**
 * ============================================================================
 * 🤍 PVT WORKFORCE HUB - Admin Holidays Management Controller
 * Handles Admin-Only Holiday CRUD, Seed Defaults, Calendar & Table Views
 * ============================================================================
 */

let holidaysList = [];
let currentYear = 2026;
let currentMonth = 'all'; // 'all' or 0-11
let currentCategory = 'all';
let currentView = 'table'; // 'table', 'grid', 'calendar'
let calMonth = new Date().getMonth(); // Active month in calendar view
let currentUserSession = null;

// 18 Standard Official Thai Holidays Template (Base 2026)
const STANDARD_THAI_HOLIDAYS_TEMPLATE = [
  { date: '01-01', name: 'วันขึ้นปีใหม่', type: 'official', desc: 'วันหยุดต้อนรับปีใหม่', is_paid: true },
  { date: '03-03', name: 'วันมาฆบูชา', type: 'official', desc: 'วันสำคัญทางศาสนาพุทธ', is_paid: true },
  { date: '04-06', name: 'วันจักรี', type: 'official', desc: 'วันระลึกมหาจักรีบรมราชวงศ์', is_paid: true },
  { date: '04-13', name: 'วันสงกรานต์', type: 'official', desc: 'วันขึ้นปีใหม่ไทย', is_paid: true },
  { date: '04-14', name: 'วันสงกรานต์ (วันครอบครัว)', type: 'official', desc: 'วันครอบครัว', is_paid: true },
  { date: '04-15', name: 'วันสงกรานต์ (วันผู้สูงอายุ)', type: 'official', desc: 'วันผู้สูงอายุแห่งชาติ', is_paid: true },
  { date: '05-01', name: 'วันแรงงานแห่งชาติ', type: 'company', desc: 'วันหยุดพิเศษสำหรับพนักงาน', is_paid: true },
  { date: '05-04', name: 'วันฉัตรมงคล', type: 'official', desc: 'วันพระราชพิธีบรมราชาภิเษก', is_paid: true },
  { date: '05-31', name: 'วันวิสาขบูชา', type: 'official', desc: 'วันสำคัญทางพุทธศาสนาสากล', is_paid: true },
  { date: '06-03', name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชินี', type: 'official', desc: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี', is_paid: true },
  { date: '07-28', name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', type: 'official', desc: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว', is_paid: true },
  { date: '07-29', name: 'วันอาสาฬหบูชา', type: 'official', desc: 'วันสำคัญทางพุทธศาสนา', is_paid: true },
  { date: '08-12', name: 'วันแม่แห่งชาติ', type: 'official', desc: 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง', is_paid: true },
  { date: '10-13', name: 'วันนวมินทรมหาราช', type: 'official', desc: 'วันคล้ายวันสวรรคต รัชกาลที่ 9', is_paid: true },
  { date: '10-23', name: 'วันปิยมหาราช', type: 'official', desc: 'วันคล้ายวันสวรรคต รัชกาลที่ 5', is_paid: true },
  { date: '12-05', name: 'วันพ่อแห่งชาติ', type: 'official', desc: 'วันคล้ายวันพระบรมราชสมภพ รัชกาลที่ 9', is_paid: true },
  { date: '12-10', name: 'วันรัฐธรรมนูญ', type: 'official', desc: 'วันระลึกการมีรัฐธรรมนูญแห่งราชอาณาจักรไทย', is_paid: true },
  { date: '12-31', name: 'วันสิ้นปี', type: 'official', desc: 'วันหยุดส่งท้ายปีเก่า', is_paid: true }
];

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_DAYS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

// 🔒 STRICT SECURITY CHECK: Admin / HR Only
function verifyAdminAccess() {
  try {
    const raw = localStorage.getItem("currentUser");
    if (!raw) {
      window.location.replace("/index.html?redirect=" + encodeURIComponent(window.location.pathname));
      return false;
    }
    const session = JSON.parse(raw);
    currentUserSession = session;

    let userStatus = { category: 'employee' };
    if (typeof window.getUserRoleCategory === "function") {
      userStatus = window.getUserRoleCategory(session);
    }

    const empObj = session.employees || session || {};
    const rawRole = String(session.role || empObj.role || userStatus.role || '').toLowerCase().trim();
    const isHolidayAdmin = userStatus.category === 'hr_exec' ||
                           ['admin', 'superadmin', 'hr', 'hr_manager'].includes(rawRole) ||
                           Boolean(session.is_admin) ||
                           Boolean(session.is_hr) ||
                           session.employee_code === 'HR-001' ||
                           empObj.employee_code === 'HR-001';

    if (!isHolidayAdmin) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ (Admin)',
          text: 'หน้านี้สำหรับแอดมินจัดการวันหยุดเท่านั้น ระบบกำลังนำท่านไปยังหน้าปฏิทินวันหยุดสำหรับพนักงาน',
          timer: 2500,
          showConfirmButton: false
        }).then(() => {
          window.location.replace("/pages/user/holidays.html");
        });
      } else {
        alert("จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น");
        window.location.replace("/pages/user/holidays.html");
      }
      return false;
    }

    // Populate user profile info on topbar
    const elName = document.getElementById('adminUserName');
    const elRole = document.getElementById('adminUserRole');
    const elAvatar = document.getElementById('adminUserAvatar');
    if (elName) elName.textContent = session.full_name || 'ผู้ดูแลระบบ';
    if (elRole) elRole.textContent = (rawRole || 'ADMIN').toUpperCase();
    if (elAvatar && session.profile_picture) {
      elAvatar.src = session.profile_picture;
    }

    return true;
  } catch (err) {
    console.error("Auth verify error:", err);
    window.location.replace("/pages/user/holidays.html");
    return false;
  }
}

// 📦 Get Supabase Client Helper
function getSupabase() {
  if (window.pvtSupabase && typeof window.pvtSupabase.getClient === 'function') {
    return window.pvtSupabase.getClient();
  }
  if (window.supabase) return window.supabase;
  return null;
}

// 📥 Load Holidays from Database
async function fetchAdminHolidays() {
  const sb = getSupabase();
  const yearSelect = document.getElementById('adminYearSelect');
  if (yearSelect) currentYear = parseInt(yearSelect.value);

  const startDate = `${currentYear}-01-01`;
  const endDate = `${currentYear}-12-31`;

  try {
    let data = [];
    if (sb) {
      const { data: dbData, error } = await sb
        .from('holidays')
        .select('*')
        .gte('holiday_date', startDate)
        .lte('holiday_date', endDate)
        .order('holiday_date', { ascending: true });

      if (!error && dbData) {
        data = dbData;
      }
    }

    // Normalization of fields
    holidaysList = data.map(h => ({
      id: h.id,
      holiday_date: h.holiday_date,
      holiday_name: h.holiday_name || h.name || '',
      holiday_type: normalizeHolidayType(h.holiday_type || h.category),
      description: h.description || h.note || '',
      is_paid: h.is_paid !== false
    }));

    // Sort by date ascending
    holidaysList.sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date));

    updateKpiCards();
    renderFilteredHolidays();
  } catch (err) {
    console.error("Error loading holidays:", err);
    holidaysList = [];
    renderFilteredHolidays();
  }
}

function normalizeHolidayType(typeStr) {
  if (!typeStr) return 'official';
  const t = String(typeStr).toLowerCase();
  if (t === 'company_holiday' || t === 'company') return 'company';
  if (t === 'tradition_holiday' || t === 'substitution' || t.includes('ชดเชย')) return 'substitution';
  return 'official';
}

function getCategoryLabel(type) {
  if (type === 'company') return { label: 'วันหยุดพิเศษบริษัท', cls: 'company' };
  if (type === 'substitution') return { label: 'วันหยุดชดเชย', cls: 'substitution' };
  return { label: 'วันหยุดนักขัตฤกษ์', cls: 'official' };
}

// 📊 Update KPI Stats
function updateKpiCards() {
  const totalEl = document.getElementById('kpiTotalHolidays');
  const nextNameEl = document.getElementById('kpiNextHolidayName');
  const nextDateEl = document.getElementById('kpiNextHolidayDate');
  const remainEl = document.getElementById('kpiRemainHolidays');
  const officialCountEl = document.getElementById('kpiOfficialCount');
  const companyCountEl = document.getElementById('kpiCompanyCount');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = holidaysList.length;
  if (totalEl) totalEl.textContent = `${total} วัน`;

  const officialCount = holidaysList.filter(h => h.holiday_type === 'official' || h.holiday_type === 'substitution').length;
  const companyCount = holidaysList.filter(h => h.holiday_type === 'company').length;

  if (officialCountEl) officialCountEl.textContent = `${officialCount} วัน`;
  if (companyCountEl) companyCountEl.textContent = `${companyCount} วัน`;

  // Next upcoming & Remaining
  const upcoming = holidaysList.filter(h => {
    const d = new Date(h.holiday_date);
    d.setHours(0, 0, 0, 0);
    return d >= today;
  });

  if (remainEl) remainEl.textContent = `${upcoming.length} วัน`;

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const nextD = new Date(next.holiday_date);
    const diffTime = nextD.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysLabel = diffDays === 0 ? '📌 วันนี้' : (diffDays === 1 ? '⏰ พรุ่งนี้' : `อีก ${diffDays} วัน`);

    if (nextNameEl) nextNameEl.textContent = next.holiday_name;
    if (nextDateEl) nextDateEl.textContent = `${formatThaiDate(next.holiday_date)} (${daysLabel})`;
  } else {
    if (nextNameEl) nextNameEl.textContent = 'ไม่มีวันหยุดถัดไปในปีนี้';
    if (nextDateEl) nextDateEl.textContent = 'ผ่านพ้นวันหยุดทั้งหมดแล้ว';
  }
}

// 🔍 Filter & Search Logic
function getFilteredHolidays() {
  const searchInput = document.getElementById('adminSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';

  return holidaysList.filter(item => {
    // Year filter
    const d = new Date(item.holiday_date);
    if (d.getFullYear() !== currentYear) return false;

    // Month filter
    if (currentMonth !== 'all' && d.getMonth() !== parseInt(currentMonth)) {
      return false;
    }

    // Category filter
    if (currentCategory !== 'all' && item.holiday_type !== currentCategory) {
      return false;
    }

    // Search query filter
    if (query) {
      const matchName = item.holiday_name.toLowerCase().includes(query);
      const matchDate = item.holiday_date.includes(query);
      const matchDesc = item.description.toLowerCase().includes(query);
      return matchName || matchDate || matchDesc;
    }

    return true;
  });
}

function renderFilteredHolidays() {
  const filtered = getFilteredHolidays();
  const searchInput = document.getElementById('adminSearchInput');
  const term = searchInput ? searchInput.value.trim() : '';

  if (currentView === 'table') {
    renderTable(filtered, term);
  } else if (currentView === 'grid') {
    renderCards(filtered, term);
  } else if (currentView === 'calendar') {
    renderCalendar(filtered);
  }
}

// 📋 RENDER TABLE VIEW
function renderTable(list, searchTerm) {
  const tbody = document.getElementById('adminHolidayTableBody');
  const emptyBox = document.getElementById('adminEmptyState');
  const tableContainer = document.getElementById('adminTableContainer');
  const gridContainer = document.getElementById('adminCardsGrid');
  const calContainer = document.getElementById('adminCalendarContainer');

  if (tableContainer) tableContainer.style.display = 'block';
  if (gridContainer) gridContainer.style.display = 'none';
  if (calContainer) calContainer.style.display = 'none';

  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '';
    if (emptyBox) emptyBox.style.display = 'block';
    return;
  }

  if (emptyBox) emptyBox.style.display = 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  tbody.innerHTML = list.map((item, idx) => {
    const d = new Date(item.holiday_date);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isPast = d < today;
    const isToday = diffDays === 0;

    let countdownBadge = '';
    if (isToday) {
      countdownBadge = '<span style="color:#0d9488; font-weight:700; background:#ccfbf1; padding:2px 8px; border-radius:6px; font-size:11.5px;">📌 วันนี้</span>';
    } else if (isPast) {
      countdownBadge = '<span style="color:#94a3b8; font-size:12px;">ผ่านมาแล้ว</span>';
    } else if (diffDays === 1) {
      countdownBadge = '<span style="color:#2563eb; font-weight:700; background:#eff6ff; padding:2px 8px; border-radius:6px; font-size:11.5px;">⏰ พรุ่งนี้</span>';
    } else {
      countdownBadge = `<span style="color:#0f766e; font-weight:600; font-size:12.5px;">อีก ${diffDays} วัน</span>`;
    }

    const typeInfo = getCategoryLabel(item.holiday_type);
    const weekday = THAI_DAYS[d.getDay()];

    return `
      <tr class="${isPast ? 'is-past-row' : ''}">
        <td style="text-align: center; color: #64748b; font-weight: 600;">${idx + 1}</td>
        <td style="font-weight: 700; color: #0f172a; white-space: nowrap;">
          ${highlightMatch(formatThaiDate(item.holiday_date), searchTerm)}
        </td>
        <td style="white-space: nowrap; color: #475569; font-weight: 500;">${weekday}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 14.5px;">
            ${highlightMatch(item.holiday_name, searchTerm)}
          </div>
        </td>
        <td>
          <span class="badge-category ${typeInfo.cls}">
            ${typeInfo.label}
          </span>
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <span class="${item.is_paid ? 'badge-paid' : 'badge-unpaid'}">
            ${item.is_paid ? 'ได้รับค่าจ้าง' : 'ไม่ได้รับค่าจ้าง'}
          </span>
        </td>
        <td style="white-space: nowrap;">
          ${countdownBadge}
        </td>
        <td style="color: #64748b; max-width: 260px; word-break: break-word;">
          ${highlightMatch(item.description || '-', searchTerm)}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <div class="table-action-btns">
            <button type="button" class="btn-action-edit" onclick="openEditHolidayModal('${item.id}')" title="แก้ไขข้อมูลวันหยุด">
              <span class="material-symbols-outlined" style="font-size: 15px;">edit</span>
              <span>แก้ไข</span>
            </button>
            <button type="button" class="btn-action-delete" onclick="handleDeleteHoliday('${item.id}')" title="ลบวันหยุดนี้">
              <span class="material-symbols-outlined" style="font-size: 15px;">delete</span>
              <span>ลบ</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 🔲 RENDER CARDS VIEW
function renderCards(list, searchTerm) {
  const tbody = document.getElementById('adminHolidayTableBody');
  const emptyBox = document.getElementById('adminEmptyState');
  const tableContainer = document.getElementById('adminTableContainer');
  const gridContainer = document.getElementById('adminCardsGrid');
  const calContainer = document.getElementById('adminCalendarContainer');

  if (tableContainer) tableContainer.style.display = 'none';
  if (gridContainer) gridContainer.style.display = 'grid';
  if (calContainer) calContainer.style.display = 'none';

  if (!gridContainer) return;

  if (list.length === 0) {
    gridContainer.innerHTML = '';
    if (emptyBox) emptyBox.style.display = 'block';
    return;
  }

  if (emptyBox) emptyBox.style.display = 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  gridContainer.innerHTML = list.map(item => {
    const d = new Date(item.holiday_date);
    d.setHours(0, 0, 0, 0);
    const dayNum = d.getDate();
    const monthShort = THAI_MONTHS_SHORT[d.getMonth()];
    const weekday = THAI_DAYS[d.getDay()];

    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isPast = d < today;
    const isToday = diffDays === 0;

    let countdownText = isToday ? '📌 วันนี้' : (isPast ? 'ผ่านมาแล้ว' : (diffDays === 1 ? '⏰ พรุ่งนี้' : `อีก ${diffDays} วัน`));
    const typeInfo = getCategoryLabel(item.holiday_type);

    return `
      <div class="admin-holiday-card ${isPast ? 'past-holiday' : ''}">
        <div>
          <div class="admin-card-header">
            <div class="admin-card-date-badge">
              <span class="admin-card-date-day">${dayNum}</span>
              <span class="admin-card-date-month">${monthShort}</span>
            </div>
            <span class="badge-category ${typeInfo.cls}">
              ${typeInfo.label}
            </span>
          </div>

          <div class="admin-card-body">
            <div class="admin-card-weekday">${weekday} • ${formatThaiDate(item.holiday_date)}</div>
            <h3 class="admin-card-title">${highlightMatch(item.holiday_name, searchTerm)}</h3>
            <p class="admin-card-desc">${highlightMatch(item.description || 'ไม่มีรายละเอียดเพิ่มเติม', searchTerm)}</p>
          </div>
        </div>

        <div class="admin-card-footer">
          <span class="admin-countdown-text ${isPast ? 'past' : ''}">${countdownText}</span>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-action-edit" onclick="openEditHolidayModal('${item.id}')" title="แก้ไข">
              <span class="material-symbols-outlined" style="font-size: 14px;">edit</span>
              <span>แก้ไข</span>
            </button>
            <button type="button" class="btn-action-delete" onclick="handleDeleteHoliday('${item.id}')" title="ลบ">
              <span class="material-symbols-outlined" style="font-size: 14px;">delete</span>
              <span>ลบ</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 📅 RENDER CALENDAR VIEW
function renderCalendar(list) {
  const tableContainer = document.getElementById('adminTableContainer');
  const gridContainer = document.getElementById('adminCardsGrid');
  const calContainer = document.getElementById('adminCalendarContainer');
  const emptyBox = document.getElementById('adminEmptyState');

  if (tableContainer) tableContainer.style.display = 'none';
  if (gridContainer) gridContainer.style.display = 'none';
  if (calContainer) calContainer.style.display = 'block';
  if (emptyBox) emptyBox.style.display = 'none';

  const headingEl = document.getElementById('adminCalMonthYear');
  if (headingEl) {
    headingEl.textContent = `${THAI_MONTHS_FULL[calMonth]} ${currentYear + 543}`;
  }

  const gridEl = document.getElementById('adminCalGrid');
  if (!gridEl) return;

  const firstDay = new Date(currentYear, calMonth, 1).getDay();
  const totalDays = new Date(currentYear, calMonth + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = '';

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += `<div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:10px; min-height:85px; opacity:0.4;"></div>`;
  }

  // Days in month
  for (let day = 1; day <= totalDays; day++) {
    const mStr = String(calMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${mStr}-${dStr}`;

    const cellDate = new Date(currentYear, calMonth, day);
    const isCurrentDay = cellDate.toDateString() === today.toDateString();

    const matchingHolidays = list.filter(h => h.holiday_date === dateStr);
    const hasHoliday = matchingHolidays.length > 0;

    let cellBg = '#ffffff';
    let borderColor = '#e2e8f0';

    if (hasHoliday) {
      const firstType = matchingHolidays[0].holiday_type;
      if (firstType === 'official') {
        cellBg = '#fef2f2';
        borderColor = '#fca5a5';
      } else if (firstType === 'company') {
        cellBg = '#eff6ff';
        borderColor = '#93c5fd';
      } else {
        cellBg = '#fffbeb';
        borderColor = '#fcd34d';
      }
    }

    html += `
      <div style="background:${cellBg}; border:1.5px solid ${borderColor}; border-radius:10px; min-height:90px; padding:6px 8px; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.15s ease; position:relative;" class="admin-cal-cell" onclick="handleCalendarDateClick('${dateStr}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:800; font-size:14px; color:${isCurrentDay ? '#0d9488' : '#0f172a'}; ${isCurrentDay ? 'background:#ccfbf1; border-radius:50%; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center;' : ''}">${day}</span>
          <button type="button" onclick="event.stopPropagation(); openAddHolidayModal('${dateStr}')" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; color:#0d9488; cursor:pointer;" title="เพิ่มวันหยุดในวันนี้">
            <span class="material-symbols-outlined" style="font-size:14px;">add</span>
          </button>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
          ${matchingHolidays.map(h => `
            <div onclick="event.stopPropagation(); openEditHolidayModal('${h.id}')" style="background:#ffffff; border-radius:6px; padding:3px 6px; font-size:11px; font-weight:700; color:#0f172a; box-shadow:0 1px 2px rgba(0,0,0,0.06); cursor:pointer; border-left:3px solid ${h.holiday_type === 'official' ? '#ef4444' : (h.holiday_type === 'company' ? '#2563eb' : '#d97706')}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${h.holiday_name} (คลิกเพื่อแก้ไข)">
              ${h.holiday_name}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  gridEl.innerHTML = html;
}

// 🗓️ Calendar Prev / Next
window.adminCalPrevMonth = function() {
  if (calMonth === 0) {
    calMonth = 11;
    currentYear -= 1;
    const yearSelect = document.getElementById('adminYearSelect');
    if (yearSelect) yearSelect.value = currentYear.toString();
    fetchAdminHolidays();
  } else {
    calMonth -= 1;
    renderFilteredHolidays();
  }
};

window.adminCalNextMonth = function() {
  if (calMonth === 11) {
    calMonth = 0;
    currentYear += 1;
    const yearSelect = document.getElementById('adminYearSelect');
    if (yearSelect) yearSelect.value = currentYear.toString();
    fetchAdminHolidays();
  } else {
    calMonth += 1;
    renderFilteredHolidays();
  }
};

window.handleCalendarDateClick = function(dateStr) {
  openAddHolidayModal(dateStr);
};

// 🪟 ADD / EDIT MODAL LOGIC
window.openAddHolidayModal = function(defaultDate = '') {
  const modal = document.getElementById('adminHolidayModal');
  const title = document.getElementById('adminModalTitle');
  const form = document.getElementById('adminHolidayForm');
  const idInput = document.getElementById('holidayFormId');
  const dateInput = document.getElementById('holidayFormDate');

  if (form) form.reset();
  if (idInput) idInput.value = '';
  if (title) title.textContent = 'เพิ่มวันหยุดใหม่';

  if (dateInput) {
    if (defaultDate) {
      dateInput.value = defaultDate;
    } else {
      const today = new Date();
      const mStr = String(today.getMonth() + 1).padStart(2, '0');
      const dStr = String(today.getDate()).padStart(2, '0');
      dateInput.value = `${currentYear}-${mStr}-${dStr}`;
    }
  }

  const paidCheckbox = document.getElementById('holidayFormPaid');
  if (paidCheckbox) paidCheckbox.checked = true;

  if (modal) modal.style.display = 'flex';
};

window.openEditHolidayModal = function(holidayId) {
  const item = holidaysList.find(h => String(h.id) === String(holidayId));
  if (!item) {
    Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: 'ไม่พบรายการวันหยุดที่ต้องการแก้ไข' });
    return;
  }

  const modal = document.getElementById('adminHolidayModal');
  const title = document.getElementById('adminModalTitle');
  const idInput = document.getElementById('holidayFormId');
  const dateInput = document.getElementById('holidayFormDate');
  const nameInput = document.getElementById('holidayFormName');
  const typeInput = document.getElementById('holidayFormType');
  const paidCheckbox = document.getElementById('holidayFormPaid');
  const descInput = document.getElementById('holidayFormDesc');

  if (title) title.textContent = 'แก้ไขข้อมูลวันหยุด';
  if (idInput) idInput.value = item.id;
  if (dateInput) dateInput.value = item.holiday_date;
  if (nameInput) nameInput.value = item.holiday_name;
  if (typeInput) typeInput.value = item.holiday_type;
  if (paidCheckbox) paidCheckbox.checked = item.is_paid !== false;
  if (descInput) descInput.value = item.description || '';

  if (modal) modal.style.display = 'flex';
};

window.closeAdminHolidayModal = function() {
  const modal = document.getElementById('adminHolidayModal');
  if (modal) modal.style.display = 'none';
};

// 💾 SAVE HOLIDAY (INSERT / UPDATE)
window.handleSaveAdminHoliday = async function(event) {
  event.preventDefault();

  const id = document.getElementById('holidayFormId').value.trim();
  const date = document.getElementById('holidayFormDate').value;
  const name = document.getElementById('holidayFormName').value.trim();
  const type = document.getElementById('holidayFormType').value;
  const isPaid = document.getElementById('holidayFormPaid').checked;
  const desc = document.getElementById('holidayFormDesc').value.trim();

  if (!date || !name) {
    Swal.fire({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบถ้วน', text: 'ต้องระบุวันที่หยุดและชื่อวันหยุด' });
    return;
  }

  const sb = getSupabase();
  if (!sb) {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
    return;
  }

  Swal.fire({
    title: 'กำลังบันทึกข้อมูล...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const payload = {
      holiday_date: date,
      holiday_name: name,
      holiday_type: type === 'official' ? 'public_holiday' : (type === 'company' ? 'company_holiday' : 'tradition_holiday'),
      category: type,
      description: desc,
      is_paid: isPaid,
      updated_at: new Date().toISOString()
    };

    if (id && !id.startsWith('def-') && !id.startsWith('temp-')) {
      // UPDATE
      const { error } = await sb.from('holidays').update(payload).eq('id', id);
      if (error) throw error;
    } else {
      // INSERT
      payload.created_at = new Date().toISOString();
      const { error } = await sb.from('holidays').insert([payload]);
      if (error) throw error;
    }

    closeAdminHolidayModal();
    await fetchAdminHolidays();

    Swal.fire({
      icon: 'success',
      title: 'บันทึกวันหยุดสำเร็จ!',
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("Save holiday error:", err);
    Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message || 'โปรดตรวจสอบข้อมูลอีกครั้ง' });
  }
};

// 🗑️ DELETE HOLIDAY
window.handleDeleteHoliday = async function(id) {
  const item = holidaysList.find(h => String(h.id) === String(id));
  const holidayName = item ? item.holiday_name : 'รายการนี้';

  const confirmRes = await Swal.fire({
    title: 'ยืนยันการลบวันหยุด?',
    html: `คุณต้องการลบวันหยุด <strong>"${holidayName}"</strong> ออกจากระบบใช่หรือไม่?<br><span style="color:#ef4444; font-size:12px;">การลบนี้จะส่งผลต่อปฏิทินของพนักงานทั้งบริษัท</span>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ลบวันหยุด',
    cancelButtonText: 'ยกเลิก'
  });

  if (!confirmRes.isConfirmed) return;

  const sb = getSupabase();
  if (!sb) {
    Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
    return;
  }

  Swal.fire({
    title: 'กำลังลบข้อมูล...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { error } = await sb.from('holidays').delete().eq('id', id);
    if (error) throw error;

    await fetchAdminHolidays();
    Swal.fire({
      icon: 'success',
      title: 'ลบวันหยุดเรียบร้อยแล้ว',
      timer: 1400,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("Delete holiday error:", err);
    Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.message || 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
};

// ⚡ BATCH SEED STANDARD 18 HOLIDAYS
window.handleBatchSeedHolidays = async function() {
  const confirmRes = await Swal.fire({
    title: 'นำเข้าวันหยุดมาตรฐาน?',
    html: `ระบบจะนำเข้า <strong>วันหยุดนักขัตฤกษ์และประเพณีมาตรฐาน 18 วัน</strong> ของปี ${currentYear} (${currentYear + 543}) เข้าสู่ฐานข้อมูล<br><small style="color:#64748b;">(รายการที่มีอยู่อยู่แล้วในวันเดียวกันจะไม่ถูกบันทึกซ้ำ)</small>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#0d9488',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'ยืนยันการนำเข้า',
    cancelButtonText: 'ยกเลิก'
  });

  if (!confirmRes.isConfirmed) return;

  const sb = getSupabase();
  if (!sb) {
    Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
    return;
  }

  Swal.fire({
    title: 'กำลังนำเข้าวันหยุดมาตรฐาน...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const existingDates = new Set(holidaysList.map(h => h.holiday_date));
    const toInsert = [];

    STANDARD_THAI_HOLIDAYS_TEMPLATE.forEach(t => {
      const fullDate = `${currentYear}-${t.date}`;
      if (!existingDates.has(fullDate)) {
        toInsert.push({
          holiday_date: fullDate,
          holiday_name: t.name,
          holiday_type: t.type === 'official' ? 'public_holiday' : 'company_holiday',
          category: t.type,
          description: t.desc,
          is_paid: t.is_paid,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    });

    if (toInsert.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'มีข้อมูลครบแล้ว',
        text: `วันหยุดมาตรฐานของปี ${currentYear} มีอยู่ในระบบครบถ้วนแล้ว ไม่มีการเพิ่มซ้ำ`
      });
      return;
    }

    const { error } = await sb.from('holidays').insert(toInsert);
    if (error) throw error;

    await fetchAdminHolidays();

    Swal.fire({
      icon: 'success',
      title: `นำเข้าสำเร็จ ${toInsert.length} รายการ!`,
      text: `เพิ่มวันหยุดมาตรฐานของปี ${currentYear} เข้าสู่ระบบเรียบร้อยแล้ว`,
      timer: 2000,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("Batch seed error:", err);
    Swal.fire({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
};

// 🔄 VIEW SWITCHER
window.switchAdminView = function(viewType) {
  currentView = viewType;

  const btnTable = document.getElementById('adminBtnViewTable');
  const btnGrid = document.getElementById('adminBtnViewGrid');
  const btnCal = document.getElementById('adminBtnViewCalendar');

  if (btnTable) btnTable.classList.toggle('active', viewType === 'table');
  if (btnGrid) btnGrid.classList.toggle('active', viewType === 'grid');
  if (btnCal) btnCal.classList.toggle('active', viewType === 'calendar');

  renderFilteredHolidays();
};

// 🔄 FILTER EVENT LISTENERS
window.handleAdminYearChange = function() {
  const select = document.getElementById('adminYearSelect');
  if (select) {
    currentYear = parseInt(select.value);
    calMonth = 0; // reset to January
    fetchAdminHolidays();
  }
};

window.handleAdminMonthChange = function() {
  const select = document.getElementById('adminMonthSelect');
  if (select) {
    currentMonth = select.value;
    if (currentMonth !== 'all') {
      calMonth = parseInt(currentMonth);
    }
    renderFilteredHolidays();
  }
};

window.handleAdminCategoryChange = function() {
  const select = document.getElementById('adminCategorySelect');
  if (select) {
    currentCategory = select.value;
    renderFilteredHolidays();
  }
};

window.handleAdminSearch = function() {
  renderFilteredHolidays();
};

window.refreshAdminHolidays = async function() {
  const btn = document.getElementById('btnRefreshHolidays');
  if (btn) btn.classList.add('animate-spin');
  await fetchAdminHolidays();
  if (btn) btn.classList.remove('animate-spin');
  Swal.fire({ icon: 'success', title: 'ซิงค์ข้อมูลสำเร็จ', timer: 1000, showConfirmButton: false });
};

// 📅 UTILITY: Format Thai Date (e.g. 13 เม.ย. 2569)
function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const year = parseInt(parts[0]) + 543;
  const month = THAI_MONTHS_SHORT[parseInt(parts[1], 10) - 1] || '';
  const day = parseInt(parts[2], 10);
  return `${day} ${month} ${year}`;
}

// 🔤 Search text highlight
function highlightMatch(text, term) {
  if (!term || !text) return text || '-';
  const clean = String(text);
  const idx = clean.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return clean;
  const before = clean.slice(0, idx);
  const match = clean.slice(idx, idx + term.length);
  const after = clean.slice(idx + term.length);
  return `${before}<mark class="text-highlight">${match}</mark>${after}`;
}

// 🚀 INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
  const isAllowed = verifyAdminAccess();
  if (!isAllowed) return;

  // Initialize Select Values
  const yearSelect = document.getElementById('adminYearSelect');
  if (yearSelect) yearSelect.value = currentYear.toString();

  await fetchAdminHolidays();
});
