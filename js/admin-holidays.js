/**
 * ============================================================================
 * PVT WORKFORCE HUB — จัดการปฏิทินวันหยุด (admin-holidays.js)
 * ใช้กับ /pages/hr/holidays.html
 * ----------------------------------------------------------------------------
 * สารบัญ
 *   01. ค่าคงที่ + สถานะของหน้า
 *   02. ตัวช่วย (escape / วันที่ / Supabase)
 *   03. ตรวจสิทธิ์ (เฉพาะ HR / Admin)
 *   04. โหลดข้อมูลวันหยุด
 *   05. การ์ดตัวเลข (KPI)
 *   06. กรอง + เลือกมุมมอง
 *   07. มุมมองตาราง
 *   08. มุมมองการ์ด
 *   09. มุมมองปฏิทิน
 *   10. หน้าต่างเพิ่ม/แก้ไข
 *   11. บันทึก / ลบ / นำเข้าวันหยุดมาตรฐาน
 *   12. ตัวกรอง + สลับมุมมอง (เรียกจาก HTML)
 *   13. เริ่มทำงาน
 *
 * หมายเหตุ
 * - ไฟล์นี้เป็น module → ฟังก์ชันที่ HTML เรียกผ่าน onclick ต้องผูกกับ window
 * - HTML ที่สร้างไม่มี inline style หน้าตาทั้งหมดอยู่ใน hr-holidays.css (คลาส hh-*)
 * - ปุ่มในตาราง/การ์ด/ปฏิทินใช้ data-action + data-id แล้วดักที่กรอบนอกครั้งเดียว
 * ============================================================================
 */


/* ==========================================================================
   01. ค่าคงที่ + สถานะของหน้า
   ========================================================================== */

// วันหยุดมาตรฐาน 18 วัน (MM-DD) ใช้กับปุ่ม "นำเข้า"
const STANDARD_THAI_HOLIDAYS_TEMPLATE = [
  { date: '01-01', name: 'วันขึ้นปีใหม่', type: 'official', desc: 'วันหยุดต้อนรับปีใหม่' },
  { date: '03-03', name: 'วันมาฆบูชา', type: 'official', desc: 'วันสำคัญทางศาสนาพุทธ' },
  { date: '04-06', name: 'วันจักรี', type: 'official', desc: 'วันระลึกมหาจักรีบรมราชวงศ์' },
  { date: '04-13', name: 'วันสงกรานต์', type: 'official', desc: 'วันขึ้นปีใหม่ไทย' },
  { date: '04-14', name: 'วันสงกรานต์ (วันครอบครัว)', type: 'official', desc: 'วันครอบครัว' },
  { date: '04-15', name: 'วันสงกรานต์ (วันผู้สูงอายุ)', type: 'official', desc: 'วันผู้สูงอายุแห่งชาติ' },
  { date: '05-01', name: 'วันแรงงานแห่งชาติ', type: 'company', desc: 'วันหยุดพิเศษสำหรับพนักงาน' },
  { date: '05-04', name: 'วันฉัตรมงคล', type: 'official', desc: 'วันพระราชพิธีบรมราชาภิเษก' },
  { date: '05-31', name: 'วันวิสาขบูชา', type: 'official', desc: 'วันสำคัญทางพุทธศาสนาสากล' },
  { date: '06-03', name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชินี', type: 'official', desc: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี' },
  { date: '07-28', name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', type: 'official', desc: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระวชิรเกล้าเจ้าอยู่หัว' },
  { date: '07-29', name: 'วันอาสาฬหบูชา', type: 'official', desc: 'วันสำคัญทางพุทธศาสนา' },
  { date: '08-12', name: 'วันแม่แห่งชาติ', type: 'official', desc: 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชชนนีพันปีหลวง' },
  { date: '10-13', name: 'วันนวมินทรมหาราช', type: 'official', desc: 'วันคล้ายวันสวรรคต รัชกาลที่ 9' },
  { date: '10-23', name: 'วันปิยมหาราช', type: 'official', desc: 'วันคล้ายวันสวรรคต รัชกาลที่ 5' },
  { date: '12-05', name: 'วันพ่อแห่งชาติ', type: 'official', desc: 'วันคล้ายวันพระบรมราชสมภพ รัชกาลที่ 9' },
  { date: '12-10', name: 'วันรัฐธรรมนูญ', type: 'official', desc: 'วันระลึกการมีรัฐธรรมนูญแห่งราชอาณาจักรไทย' },
  { date: '12-31', name: 'วันสิ้นปี', type: 'official', desc: 'วันหยุดส่งท้ายปีเก่า' }
];

const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_DAYS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

// ประเภทวันหยุด: ชื่อที่แสดง + ค่าที่บันทึกลงคอลัมน์ holiday_type (สีอยู่ใน CSS: --official / --company / --substitution)
const HOLIDAY_TYPES = {
  official:     { label: 'วันหยุดนักขัตฤกษ์', dbType: 'public_holiday' },
  company:      { label: 'วันหยุดพิเศษบริษัท', dbType: 'company_holiday' },
  substitution: { label: 'วันหยุดชดเชย',      dbType: 'tradition_holiday' }
};

const ADMIN_ROLES = ['admin', 'superadmin', 'hr', 'hr_manager'];
const USER_HOLIDAY_PAGE = '/pages/user/holidays.html';

// สถานะของหน้า
const state = {
  holidays: [],                        // วันหยุดของปีที่เลือก (หลัง normalize)
  year: new Date().getFullYear(),      // ปีที่เลือก (เดิมตายตัว 2026)
  month: 'all',                        // 'all' หรือ 0-11
  category: 'all',                     // 'all' | 'official' | 'company' | 'substitution'
  view: 'table',                       // 'table' | 'grid' | 'calendar'
  calMonth: new Date().getMonth(),     // เดือนที่แสดงในมุมมองปฏิทิน
  loadError: null                      // ข้อความ error ล่าสุดตอนโหลด
};


/* ==========================================================================
   02. ตัวช่วย
   ========================================================================== */
const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ไฮไลต์คำค้น (escape ทุกส่วนก่อนใส่ <mark>)
function highlightMatch(text, term) {
  const clean = String(text || '');
  if (!clean) return '-';
  if (!term) return escapeHtml(clean);
  const idx = clean.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return escapeHtml(clean);
  return escapeHtml(clean.slice(0, idx)) +
    `<mark class="hh-highlight">${escapeHtml(clean.slice(idx, idx + term.length))}</mark>` +
    escapeHtml(clean.slice(idx + term.length));
}

// แปลง 'YYYY-MM-DD' เป็น Date เวลาท้องถิ่น (เลี่ยงปัญหา timezone ของ new Date('YYYY-MM-DD'))
function parseLocalDate(dateStr) {
  const [y, m, d] = String(dateStr || '').slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function todayStart() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function toIsoDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// เช่น 13 เม.ย. 2569
function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const d = parseLocalDate(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// นับถอยหลัง → { text, mod } ใช้ทั้งตาราง การ์ด และ KPI
function getCountdown(dateStr) {
  const diff = Math.round((parseLocalDate(dateStr) - todayStart()) / 86400000);
  if (diff === 0) return { text: 'วันนี้', mod: 'today', diff };
  if (diff === 1) return { text: 'พรุ่งนี้', mod: 'tomorrow', diff };
  if (diff < 0) return { text: 'ผ่านมาแล้ว', mod: 'past', diff };
  return { text: `อีก ${diff} วัน`, mod: 'soon', diff };
}

function normalizeHolidayType(typeStr) {
  const t = String(typeStr || '').toLowerCase();
  if (t === 'company_holiday' || t === 'company') return 'company';
  if (t === 'tradition_holiday' || t === 'substitution' || t.includes('ชดเชย')) return 'substitution';
  return 'official';
}

function getSupabase() {
  if (typeof window.pvtSupabase?.getClient === 'function') return window.pvtSupabase.getClient();
  return window.supabaseClient || window.supabase || null;
}

// แจ้งเตือนแบบปลอดภัย (ถ้า SweetAlert ยังไม่โหลดก็ใช้ alert แทน)
function notify(options) {
  if (typeof Swal !== 'undefined') return Swal.fire(options);
  alert([options.title, options.text].filter(Boolean).join('\n'));
  return Promise.resolve({ isConfirmed: true });
}

async function confirmDialog(options) {
  if (typeof Swal !== 'undefined') {
    const res = await Swal.fire({ showCancelButton: true, cancelButtonText: 'ยกเลิก', cancelButtonColor: '#64748b', ...options });
    return res.isConfirmed;
  }
  return confirm(options.title);
}

function showLoading(title) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({ title, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  }
}

const typeBadge = (type) =>
  `<span class="hh-type-badge hh-type-badge--${type}">${HOLIDAY_TYPES[type].label}</span>`;


/* ==========================================================================
   03. ตรวจสิทธิ์ (เฉพาะ HR / Admin)
   ========================================================================== */
function verifyAdminAccess() {
  try {
    const raw = localStorage.getItem('currentUser');
    if (!raw) {
      window.location.replace('/index.html?redirect=' + encodeURIComponent(window.location.pathname));
      return false;
    }

    const session = JSON.parse(raw);
    const userStatus = typeof window.getUserRoleCategory === 'function'
      ? window.getUserRoleCategory(session)
      : { category: 'employee' };

    const empObj = session.employees || session;
    const role = String(session.role || empObj.role || userStatus.role || '').toLowerCase().trim();
    const isHolidayAdmin = userStatus.category === 'hr_exec' ||
      ADMIN_ROLES.includes(role) ||
      Boolean(session.is_admin) ||
      Boolean(session.is_hr) ||
      session.employee_code === 'HR-001' ||
      empObj.employee_code === 'HR-001';

    if (!isHolidayAdmin) {
      notify({
        icon: 'error',
        title: 'จำกัดสิทธิ์เฉพาะผู้ดูแลระบบ',
        text: 'หน้านี้สำหรับ HR / Admin เท่านั้น กำลังพาไปหน้าปฏิทินวันหยุดของพนักงาน',
        timer: 2500,
        showConfirmButton: false
      }).then(() => window.location.replace(USER_HOLIDAY_PAGE));
      return false;
    }

    // ชื่อบนแถบหัว (id สำรองเดิม)
    if ($('adminUserName')) $('adminUserName').textContent = session.full_name || 'ผู้ดูแลระบบ';
    if ($('adminUserRole')) $('adminUserRole').textContent = (role || 'admin').toUpperCase();
    return true;
  } catch (err) {
    console.error('Auth verify error:', err);
    window.location.replace(USER_HOLIDAY_PAGE);
    return false;
  }
}


/* ==========================================================================
   04. โหลดข้อมูลวันหยุด
   ========================================================================== */
async function fetchAdminHolidays() {
  state.loadError = null;
  const sb = getSupabase();

  try {
    if (!sb) throw new Error('ยังเชื่อมต่อฐานข้อมูลไม่ได้');

    const { data, error } = await sb
      .from('holidays')
      .select('*')
      .gte('holiday_date', `${state.year}-01-01`)
      .lte('holiday_date', `${state.year}-12-31`)
      .order('holiday_date', { ascending: true });
    if (error) throw error;

    // ทำให้ทุกแถวมีรูปแบบเดียวกัน (วันที่ตัดเหลือ YYYY-MM-DD เผื่อฐานข้อมูลส่ง timestamp มา)
    state.holidays = (data || [])
      .map(h => ({
        id: h.id,
        holiday_date: String(h.holiday_date || '').slice(0, 10),
        holiday_name: h.holiday_name || h.name || '',
        holiday_type: normalizeHolidayType(h.category || h.holiday_type),
        description: h.description || h.note || '',
        is_paid: h.is_paid !== false
      }))
      .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
  } catch (err) {
    console.error('Error loading holidays:', err);
    state.holidays = [];
    state.loadError = err.message || 'โหลดข้อมูลไม่สำเร็จ';
  }

  updateKpiCards();
  renderFilteredHolidays();
}


/* ==========================================================================
   05. การ์ดตัวเลข (KPI)
   ========================================================================== */
function updateKpiCards() {
  const list = state.holidays;
  const today = todayStart();
  const upcoming = list.filter(h => parseLocalDate(h.holiday_date) >= today);

  // นักขัตฤกษ์ = นักขัตฤกษ์ + ชดเชย (เหมือนเดิม)
  const officialCount = list.filter(h => h.holiday_type !== 'company').length;
  const companyCount = list.length - officialCount;

  $('kpiTotalHolidays').textContent = `${list.length} วัน`;
  $('kpiRemainHolidays').textContent = `${upcoming.length} วัน`;
  // เดิมเขียนทับเหลือแค่ "17 วัน" ทำให้ไม่รู้ว่าเป็นประเภทไหน → ใส่ชื่อประเภทไว้ด้วย
  $('kpiOfficialCount').textContent = `นักขัตฤกษ์: ${officialCount}`;
  $('kpiCompanyCount').textContent = `บริษัท: ${companyCount}`;

  const next = upcoming[0];
  if (next) {
    $('kpiNextHolidayName').textContent = next.holiday_name;
    $('kpiNextHolidayDate').textContent = `${formatThaiDate(next.holiday_date)} · ${getCountdown(next.holiday_date).text}`;
  } else {
    $('kpiNextHolidayName').textContent = 'ไม่มีวันหยุดถัดไปในปีนี้';
    $('kpiNextHolidayDate').textContent = list.length ? 'ผ่านพ้นวันหยุดทั้งหมดแล้ว' : '-';
  }
}


/* ==========================================================================
   06. กรอง + เลือกมุมมอง
   ========================================================================== */
function getSearchTerm() {
  return ($('adminSearchInput')?.value || '').trim();
}

function getFilteredHolidays() {
  const query = getSearchTerm().toLowerCase();

  return state.holidays.filter(item => {
    const d = parseLocalDate(item.holiday_date);
    if (state.month !== 'all' && d.getMonth() !== Number(state.month)) return false;
    if (state.category !== 'all' && item.holiday_type !== state.category) return false;
    if (!query) return true;
    return item.holiday_name.toLowerCase().includes(query) ||
      item.holiday_date.includes(query) ||
      formatThaiDate(item.holiday_date).includes(query) ||
      item.description.toLowerCase().includes(query);
  });
}

// แสดงเฉพาะกรอบของมุมมองที่เลือก + สลับกล่อง "ไม่พบข้อมูล"
function showView(view, isEmpty) {
  $('adminTableContainer').style.display = view === 'table' && !isEmpty ? 'block' : 'none';
  $('adminCardsGrid').style.display = view === 'grid' && !isEmpty ? 'grid' : 'none';
  $('adminCalendarContainer').style.display = view === 'calendar' ? 'block' : 'none';

  const emptyBox = $('adminEmptyState');
  const showEmpty = isEmpty && view !== 'calendar';
  emptyBox.style.display = showEmpty ? 'block' : 'none';
  if (!showEmpty) return;

  // โหลดไม่สำเร็จ ≠ ไม่มีข้อมูล → บอกให้ชัด
  emptyBox.classList.toggle('is-error', Boolean(state.loadError));
  emptyBox.querySelector('h3').textContent = state.loadError ? 'โหลดข้อมูลวันหยุดไม่สำเร็จ' : 'ไม่พบข้อมูลวันหยุด';
  emptyBox.querySelector('p').textContent = state.loadError
    ? `${state.loadError} — กรุณารีเฟรชหน้านี้อีกครั้ง`
    : 'ไม่พบรายการที่ตรงกับเงื่อนไขการค้นหา หรือยังไม่ได้เพิ่มวันหยุดในปีนี้';
}

function renderFilteredHolidays() {
  const list = getFilteredHolidays();
  const term = getSearchTerm();
  showView(state.view, list.length === 0);

  if (state.view === 'table') renderTable(list, term);
  else if (state.view === 'grid') renderCards(list, term);
  else renderCalendar(list);
}


/* ==========================================================================
   07. มุมมองตาราง
   ========================================================================== */
function renderTable(list, term) {
  const tbody = $('adminHolidayTableBody');
  if (!tbody) return;

  tbody.innerHTML = list.map((item, idx) => {
    const d = parseLocalDate(item.holiday_date);
    const cd = getCountdown(item.holiday_date);
    const id = escapeHtml(item.id);

    return `
      <tr class="${cd.mod === 'past' ? 'is-past' : ''}">
        <td class="col-no">${idx + 1}</td>
        <td class="cell-date">${highlightMatch(formatThaiDate(item.holiday_date), term)}</td>
        <td class="cell-day">${THAI_DAYS[d.getDay()]}</td>
        <td class="cell-name">${highlightMatch(item.holiday_name, term)}</td>
        <td>${typeBadge(item.holiday_type)}</td>
        <td class="col-paid">
          <span class="hh-paid-badge ${item.is_paid ? 'hh-paid-badge--yes' : 'hh-paid-badge--no'}">
            ${item.is_paid ? 'ได้รับค่าจ้าง' : 'ไม่ได้รับค่าจ้าง'}
          </span>
        </td>
        <td><span class="hh-countdown hh-countdown--${cd.mod}">${cd.text}</span></td>
        <td class="cell-desc">${highlightMatch(item.description || '-', term)}</td>
        <td class="col-actions">
          <div class="hh-row-actions">
            <button type="button" class="hh-act-btn hh-act-btn--edit" data-action="edit" data-id="${id}" title="แก้ไขวันหยุด">
              <span class="material-symbols-outlined">edit</span><span>แก้ไข</span>
            </button>
            <button type="button" class="hh-act-btn hh-act-btn--delete" data-action="delete" data-id="${id}" title="ลบวันหยุด">
              <span class="material-symbols-outlined">delete</span><span>ลบ</span>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}


/* ==========================================================================
   08. มุมมองการ์ด
   ========================================================================== */
function renderCards(list, term) {
  const grid = $('adminCardsGrid');
  if (!grid) return;

  grid.innerHTML = list.map(item => {
    const d = parseLocalDate(item.holiday_date);
    const cd = getCountdown(item.holiday_date);
    const id = escapeHtml(item.id);

    return `
      <article class="hh-card hh-card--${item.holiday_type} ${cd.mod === 'past' ? 'is-past' : ''}">
        <div class="hh-card-head">
          <div class="hh-date-badge">
            <span class="hh-date-badge-day">${d.getDate()}</span>
            <span class="hh-date-badge-month">${THAI_MONTHS_SHORT[d.getMonth()]}</span>
          </div>
          ${typeBadge(item.holiday_type)}
        </div>

        <div class="hh-card-body">
          <div class="hh-card-weekday">${THAI_DAYS[d.getDay()]} · ${formatThaiDate(item.holiday_date)}</div>
          <h3 class="hh-card-title">${highlightMatch(item.holiday_name, term)}</h3>
          <p class="hh-card-desc">${highlightMatch(item.description || 'ไม่มีรายละเอียดเพิ่มเติม', term)}</p>
        </div>

        <div class="hh-card-foot">
          <span class="hh-countdown hh-countdown--${cd.mod}">${cd.text}</span>
          <div class="hh-row-actions">
            <button type="button" class="hh-act-btn hh-act-btn--edit" data-action="edit" data-id="${id}" title="แก้ไข">
              <span class="material-symbols-outlined">edit</span><span>แก้ไข</span>
            </button>
            <button type="button" class="hh-act-btn hh-act-btn--delete" data-action="delete" data-id="${id}" title="ลบ">
              <span class="material-symbols-outlined">delete</span><span>ลบ</span>
            </button>
          </div>
        </div>
      </article>`;
  }).join('');
}


/* ==========================================================================
   09. มุมมองปฏิทิน
   ========================================================================== */
function renderCalendar(list) {
  const { year, calMonth } = state;
  $('adminCalMonthYear').textContent = `${THAI_MONTHS_FULL[calMonth]} ${year + 543}`;

  const gridEl = $('adminCalGrid');
  if (!gridEl) return;

  const firstWeekday = new Date(year, calMonth, 1).getDay();
  const totalDays = new Date(year, calMonth + 1, 0).getDate();
  const todayIso = toIsoDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  // จัดกลุ่มวันหยุดตามวันที่ ครั้งเดียว
  const byDate = {};
  list.forEach(h => { (byDate[h.holiday_date] = byDate[h.holiday_date] || []).push(h); });

  let html = '<div class="hh-cal-cell is-blank"></div>'.repeat(firstWeekday);

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = toIsoDate(year, calMonth, day);
    const items = byDate[dateStr] || [];
    const weekday = (firstWeekday + day - 1) % 7;

    const classes = ['hh-cal-cell'];
    if (items.length) classes.push('has-holiday', `hh-cal-cell--${items[0].holiday_type}`);
    if (dateStr === todayIso) classes.push('is-today');
    if (weekday === 0 || weekday === 6) classes.push('is-weekend');

    const events = items.map(h => `
      <button type="button" class="hh-cal-event hh-cal-event--${h.holiday_type}" data-action="edit" data-id="${escapeHtml(h.id)}" title="${escapeHtml(h.holiday_name)} (คลิกเพื่อแก้ไข)">
        ${escapeHtml(h.holiday_name)}
      </button>`).join('');

    html += `
      <div class="${classes.join(' ')}" data-action="add" data-date="${dateStr}">
        <div class="hh-cal-cell-top">
          <span class="hh-cal-day">${day}</span>
          <button type="button" class="hh-cal-add" data-action="add" data-date="${dateStr}" title="เพิ่มวันหยุดวันนี้" aria-label="เพิ่มวันหยุดวันที่ ${day}">
            <span class="material-symbols-outlined">add</span>
          </button>
        </div>
        <div class="hh-cal-events">${events}</div>
      </div>`;
  }

  gridEl.innerHTML = html;
}

// เลื่อนเดือน: ข้ามปีแล้วโหลดข้อมูลปีใหม่
function shiftCalendarMonth(step) {
  const next = state.calMonth + step;
  if (next < 0 || next > 11) {
    state.calMonth = (next + 12) % 12;
    state.year += step;
    syncYearSelect();
    fetchAdminHolidays();
  } else {
    state.calMonth = next;
    renderFilteredHolidays();
  }
}

window.adminCalPrevMonth = () => shiftCalendarMonth(-1);
window.adminCalNextMonth = () => shiftCalendarMonth(1);
window.handleCalendarDateClick = (dateStr) => window.openAddHolidayModal(dateStr);


/* ==========================================================================
   10. หน้าต่างเพิ่ม/แก้ไข
   ========================================================================== */
function openModal(titleText) {
  $('adminModalTitle').textContent = titleText;
  $('adminHolidayModal').style.display = 'flex';
  setTimeout(() => $('holidayFormName')?.focus(), 50);
}

window.openAddHolidayModal = function (defaultDate = '') {
  $('adminHolidayForm').reset();
  $('holidayFormId').value = '';
  $('holidayFormPaid').checked = true;

  // ค่าเริ่มต้น: วันที่ที่คลิกในปฏิทิน หรือวันนี้ในปีที่เลือก
  const now = new Date();
  $('holidayFormDate').value = defaultDate || toIsoDate(state.year, now.getMonth(), now.getDate());

  openModal('เพิ่มวันหยุดใหม่');
};

window.openEditHolidayModal = function (holidayId) {
  const item = state.holidays.find(h => String(h.id) === String(holidayId));
  if (!item) {
    notify({ icon: 'error', title: 'ไม่พบข้อมูล', text: 'ไม่พบรายการวันหยุดที่ต้องการแก้ไข' });
    return;
  }

  $('holidayFormId').value = item.id;
  $('holidayFormDate').value = item.holiday_date;
  $('holidayFormName').value = item.holiday_name;
  $('holidayFormType').value = item.holiday_type;
  $('holidayFormPaid').checked = item.is_paid !== false;
  $('holidayFormDesc').value = item.description || '';

  openModal('แก้ไขข้อมูลวันหยุด');
};

window.closeAdminHolidayModal = function () {
  $('adminHolidayModal').style.display = 'none';
};


/* ==========================================================================
   11. บันทึก / ลบ / นำเข้าวันหยุดมาตรฐาน
   ========================================================================== */
window.handleSaveAdminHoliday = async function (event) {
  event.preventDefault();

  const id = $('holidayFormId').value.trim();
  const date = $('holidayFormDate').value;
  const name = $('holidayFormName').value.trim();
  const type = $('holidayFormType').value;

  if (!date || !name) {
    notify({ icon: 'warning', title: 'กรุณากรอกข้อมูลให้ครบ', text: 'ต้องระบุวันที่และชื่อวันหยุด' });
    return;
  }

  const sb = getSupabase();
  if (!sb) {
    notify({ icon: 'error', title: 'เชื่อมต่อฐานข้อมูลไม่ได้', text: 'กรุณารีเฟรชหน้านี้แล้วลองใหม่' });
    return;
  }

  const now = new Date().toISOString();
  const payload = {
    holiday_date: date,
    holiday_name: name,
    holiday_type: HOLIDAY_TYPES[type].dbType,
    category: type,
    description: $('holidayFormDesc').value.trim(),
    is_paid: $('holidayFormPaid').checked,
    updated_at: now
  };

  showLoading('กำลังบันทึกข้อมูล...');
  try {
    const isUpdate = id && !id.startsWith('def-') && !id.startsWith('temp-');
    const { error } = isUpdate
      ? await sb.from('holidays').update(payload).eq('id', id)
      : await sb.from('holidays').insert([{ ...payload, created_at: now }]);
    if (error) throw error;

    window.closeAdminHolidayModal();

    // ถ้าบันทึกวันหยุดของปีอื่น → สลับไปปีนั้นให้เห็นรายการที่เพิ่งบันทึก
    const savedYear = Number(date.slice(0, 4));
    if (savedYear !== state.year) {
      state.year = savedYear;
      syncYearSelect();
    }

    await fetchAdminHolidays();
    notify({ icon: 'success', title: 'บันทึกวันหยุดสำเร็จ', timer: 1500, showConfirmButton: false });
  } catch (err) {
    console.error('Save holiday error:', err);
    notify({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.message || 'โปรดตรวจสอบข้อมูลอีกครั้ง' });
  }
};

window.handleDeleteHoliday = async function (id) {
  const item = state.holidays.find(h => String(h.id) === String(id));
  const name = item ? item.holiday_name : 'รายการนี้';

  const ok = await confirmDialog({
    title: 'ยืนยันการลบวันหยุด?',
    html: `ต้องการลบ <strong>"${escapeHtml(name)}"</strong> ใช่หรือไม่?<br><small class="hh-swal-warn">ปฏิทินของพนักงานทั้งบริษัทจะเปลี่ยนตาม</small>`,
    icon: 'warning',
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบวันหยุด'
  });
  if (!ok) return;

  const sb = getSupabase();
  if (!sb) {
    notify({ icon: 'error', title: 'เชื่อมต่อฐานข้อมูลไม่ได้' });
    return;
  }

  showLoading('กำลังลบข้อมูล...');
  try {
    const { error } = await sb.from('holidays').delete().eq('id', id);
    if (error) throw error;
    await fetchAdminHolidays();
    notify({ icon: 'success', title: 'ลบวันหยุดเรียบร้อยแล้ว', timer: 1400, showConfirmButton: false });
  } catch (err) {
    console.error('Delete holiday error:', err);
    notify({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.message || 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
};

window.handleBatchSeedHolidays = async function () {
  const year = state.year;
  const ok = await confirmDialog({
    title: 'นำเข้าวันหยุดมาตรฐาน?',
    html: `นำเข้า <strong>วันหยุดมาตรฐาน 18 วัน</strong> ของปี ${year} (พ.ศ. ${year + 543})<br><small>วันที่มีวันหยุดอยู่แล้วจะข้าม ไม่บันทึกซ้ำ</small>`,
    icon: 'question',
    confirmButtonColor: '#0d9488',
    confirmButtonText: 'นำเข้า'
  });
  if (!ok) return;

  const sb = getSupabase();
  if (!sb) {
    notify({ icon: 'error', title: 'เชื่อมต่อฐานข้อมูลไม่ได้' });
    return;
  }

  const existingDates = new Set(state.holidays.map(h => h.holiday_date));
  const now = new Date().toISOString();
  const toInsert = STANDARD_THAI_HOLIDAYS_TEMPLATE
    .map(t => ({ ...t, fullDate: `${year}-${t.date}` }))
    .filter(t => !existingDates.has(t.fullDate))
    .map(t => ({
      holiday_date: t.fullDate,
      holiday_name: t.name,
      holiday_type: HOLIDAY_TYPES[t.type].dbType,
      category: t.type,
      description: t.desc,
      is_paid: true,
      created_at: now,
      updated_at: now
    }));

  if (toInsert.length === 0) {
    notify({ icon: 'info', title: 'มีข้อมูลครบแล้ว', text: `วันหยุดมาตรฐานของปี ${year} มีอยู่ในระบบครบแล้ว` });
    return;
  }

  showLoading('กำลังนำเข้าวันหยุดมาตรฐาน...');
  try {
    const { error } = await sb.from('holidays').insert(toInsert);
    if (error) throw error;
    await fetchAdminHolidays();
    notify({ icon: 'success', title: `นำเข้าสำเร็จ ${toInsert.length} รายการ`, timer: 2000, showConfirmButton: false });
  } catch (err) {
    console.error('Batch seed error:', err);
    notify({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
  }
};


/* ==========================================================================
   12. ตัวกรอง + สลับมุมมอง (เรียกจาก HTML)
   ========================================================================== */
window.switchAdminView = function (view) {
  state.view = view;
  ['Table', 'Grid', 'Calendar'].forEach(name => {
    $(`adminBtnView${name}`)?.classList.toggle('active', name.toLowerCase() === (view === 'grid' ? 'grid' : view));
  });
  renderFilteredHolidays();
};

window.handleAdminYearChange = function () {
  state.year = Number($('adminYearSelect').value);
  state.calMonth = state.month === 'all' ? 0 : Number(state.month);
  fetchAdminHolidays();
};

window.handleAdminMonthChange = function () {
  state.month = $('adminMonthSelect').value;
  if (state.month !== 'all') state.calMonth = Number(state.month);
  renderFilteredHolidays();
};

window.handleAdminCategoryChange = function () {
  state.category = $('adminCategorySelect').value;
  renderFilteredHolidays();
};

window.handleAdminSearch = renderFilteredHolidays;

window.refreshAdminHolidays = fetchAdminHolidays;

// ตัวเลือกปี: ปีก่อน → อีก 2 ปีข้างหน้า (สร้างจากปีปัจจุบัน ไม่ต้องแก้ HTML ทุกปี)
function buildYearOptions() {
  const select = $('adminYearSelect');
  if (!select) return;
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear - 1; y <= thisYear + 2; y++) years.push(y);
  if (!years.includes(state.year)) years.push(state.year);
  select.innerHTML = years.sort().map(y => `<option value="${y}">ปี ${y} (${y + 543})</option>`).join('');
  syncYearSelect();
}

function syncYearSelect() {
  const select = $('adminYearSelect');
  if (!select) return;
  if (![...select.options].some(o => Number(o.value) === state.year)) {
    select.insertAdjacentHTML('beforeend', `<option value="${state.year}">ปี ${state.year} (${state.year + 543})</option>`);
  }
  select.value = String(state.year);
}

// ปุ่มในตาราง / การ์ด / ปฏิทิน: ดักคลิกที่กรอบนอกครั้งเดียว
function bindDelegatedActions() {
  const handler = (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    e.stopPropagation();
    const { action, id, date } = el.dataset;
    if (action === 'edit') window.openEditHolidayModal(id);
    else if (action === 'delete') window.handleDeleteHoliday(id);
    else if (action === 'add') window.openAddHolidayModal(date);
  };
  ['adminHolidayTableBody', 'adminCardsGrid', 'adminCalGrid'].forEach(id => $(id)?.addEventListener('click', handler));
}

// ปิดหน้าต่าง: กด Esc หรือคลิกพื้นหลังมืด
function bindModalClose() {
  const modal = $('adminHolidayModal');
  modal?.addEventListener('click', (e) => { if (e.target === modal) window.closeAdminHolidayModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.style.display === 'flex') window.closeAdminHolidayModal();
  });
}


/* ==========================================================================
   13. เริ่มทำงาน
   (module โหลดแบบ defer → DOM พร้อมแล้ว แต่ใช้ DOMContentLoaded กันไว้เผื่อ)
   ========================================================================== */
async function init() {
  if (!verifyAdminAccess()) return;
  buildYearOptions();
  bindDelegatedActions();
  bindModalClose();
  await fetchAdminHolidays();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}