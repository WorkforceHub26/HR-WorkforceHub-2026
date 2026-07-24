/**
 * ==========================================================================
 * 🤍 PVT WORKFORCE HUB - Holidays Management Module (holidays.js)
 * ==========================================================================
 */

let currentYear = 2026;
let holidaysData = [];
let currentView = 'grid';
let currentUserProfile = null;

// ข้อมูลวันหยุดประจำปี 2026 (สำรองในกรณี DB ยังไม่ได้สร้างตาราง)
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

document.addEventListener('DOMContentLoaded', async () => {
  await loadUserProfile();
  initNotificationBell();
  await fetchHolidays();
});

// ดึงข้อมูลโปรไฟล์ผู้ใช้
async function loadUserProfile() {
  try {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        currentUserProfile = profile;
        document.getElementById('userName').innerText = profile.display_name || profile.username || 'เจ้าหน้าที่';
        document.getElementById('userRole').innerText = profile.role ? profile.role.toUpperCase() : 'PVT USER';
        document.getElementById('userAvatar').innerText = (profile.display_name || 'HR').substring(0, 2).toUpperCase();

        const btnAdd = document.getElementById('btnAddHoliday');
        if (['admin', 'hr', 'manager'].includes(profile.role)) {
          if (btnAdd) btnAdd.style.display = 'inline-flex';
        } else {
          if (btnAdd) btnAdd.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.warn('Profile error:', err.message);
  }
}

// โหลดข้อมูลวันหยุดจาก Supabase หรือ Fallback
async function fetchHolidays() {
  const yearSelect = document.getElementById('yearSelect');
  currentYear = parseInt(yearSelect ? yearSelect.value : 2026);

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

    holidaysData.sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date));
    updateStatsAndHero();
    filterHolidays();
  } catch (err) {
    console.error('Error:', err);
    holidaysData = [...defaultHolidays2026];
    updateStatsAndHero();
    filterHolidays();
  }
}

// อัปเดตการ์ดสรุป สถิติ และแบนเนอร์นับถอยหลัง
function updateStatsAndHero() {
  const total = holidaysData.length;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let upcomingList = holidaysData.filter(h => new Date(h.holiday_date) >= today);

  document.getElementById('statTotalHolidays').innerText = `${total} วัน`;
  document.getElementById('statRemainingHolidays').innerText = `${upcomingList.length} วัน`;

  const nextHoliday = upcomingList.length > 0 ? upcomingList[0] : null;

  if (nextHoliday) {
    const hDate = new Date(nextHoliday.holiday_date);
    const diffDays = Math.ceil((hDate - today) / (1000 * 60 * 60 * 24));

    document.getElementById('statNextHolidayName').innerText = nextHoliday.holiday_name;
    document.getElementById('statNextHolidayDate').innerText = formatThaiDateShort(nextHoliday.holiday_date);

    document.getElementById('heroHolidayTitle').innerText = nextHoliday.holiday_name;
    document.getElementById('heroHolidayDateDetails').innerText = `${formatThaiDateFull(nextHoliday.holiday_date)} (${nextHoliday.description || 'วันหยุดตามปฏิทิน'})`;
    document.getElementById('heroCountdownDays').innerText = diffDays === 0 ? 'วันนี้' : diffDays;
  }
}

// ระบบกรองและค้นหา
function filterHolidays() {
  const searchTxt = document.getElementById('holidaySearchInput').value.toLowerCase().trim();
  const category = document.getElementById('categorySelect').value;

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

function renderGrid(list) {
  const container = document.getElementById('holidayGridContainer');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (list.length === 0) {
    container.innerHTML = `<div class="empty-state-box"><h3>ไม่พบข้อมูลวันหยุด</h3></div>`;
    return;
  }

  const isPowerUser = currentUserProfile && ['admin', 'hr'].includes(currentUserProfile.role);

  container.innerHTML = list.map(item => {
    const hDate = new Date(item.holiday_date);
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
        <button class="btn-icon-action" onclick="openEditHolidayModal('${item.id}')"><span class="material-symbols-outlined">edit</span></button>
        <button class="btn-icon-action delete" onclick="deleteHoliday('${item.id}')"><span class="material-symbols-outlined">delete</span></button>
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

function renderTable(list) {
  const tbody = document.getElementById('holidayTableBody');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty-state">ไม่พบข้อมูลวันหยุด</td></tr>`;
    return;
  }

  const isPowerUser = currentUserProfile && ['admin', 'hr'].includes(currentUserProfile.role);

  tbody.innerHTML = list.map((item, index) => {
    const hDate = new Date(item.holiday_date);
    const dayName = THAI_DAYS[hDate.getDay()];
    const isPast = hDate < today;

    return `
      <tr style="${isPast ? 'opacity: 0.6; background: #f8fafc;' : ''}">
        <td style="text-align: center;">${index + 1}</td>
        <td><strong>${formatThaiDateShort(item.holiday_date)}</strong></td>
        <td>วัน${dayName}</td>
        <td><strong>${item.holiday_name}</strong></td>
        <td>${item.holiday_type}</td>
        <td>${isPast ? 'ผ่านมาแล้ว' : 'กำลังจะถึง'}</td>
        <td>${item.description || '-'}</td>
        <td style="text-align: center;">
          ${isPowerUser ? `<button onclick="openEditHolidayModal('${item.id}')">แก้ไข</button>` : '-'}
        </td>
      </tr>`;
  }).join('');
}

// สลับมุมมอง (Card Grid / Table)
function switchView(view) {
  currentView = view;
  document.getElementById('btnViewGrid').classList.toggle('active', view === 'grid');
  document.getElementById('btnViewTable').classList.toggle('active', view === 'table');
  document.getElementById('holidayGridContainer').style.display = view === 'grid' ? 'grid' : 'none';
  document.getElementById('holidayTableContainer').style.display = view === 'table' ? 'block' : 'none';
  filterHolidays();
}

function changeYear() { fetchHolidays(); }

// Modal Control Functions
function openHolidayModal() {
  document.getElementById('modalTitleText').innerText = 'เพิ่มวันหยุดใหม่';
  document.getElementById('holidayId').value = '';
  document.getElementById('holidayName').value = '';
  document.getElementById('holidayDate').value = `${currentYear}-01-01`;
  document.getElementById('holidayModalOverlay').style.display = 'flex';
}

function openEditHolidayModal(id) {
  const item = holidaysData.find(h => h.id == id);
  if (!item) return;

  document.getElementById('modalTitleText').innerText = 'แก้ไขข้อมูลวันหยุด';
  document.getElementById('holidayId').value = item.id;
  document.getElementById('holidayName').value = item.holiday_name;
  document.getElementById('holidayDate').value = item.holiday_date;
  document.getElementById('holidayCategory').value = item.holiday_type || 'official';
  document.getElementById('holidayDescription').value = item.description || '';
  document.getElementById('holidayModalOverlay').style.display = 'flex';
}

function closeHolidayModal() {
  document.getElementById('holidayModalOverlay').style.display = 'none';
}

// บันทึกวันหยุด
async function handleSaveHoliday(event) {
  event.preventDefault();
  const id = document.getElementById('holidayId').value;
  const payload = {
    holiday_name: document.getElementById('holidayName').value.trim(),
    holiday_date: document.getElementById('holidayDate').value,
    holiday_type: document.getElementById('holidayCategory').value,
    description: document.getElementById('holidayDescription').value.trim()
  };

  try {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    if (supabase) {
      if (id && !id.startsWith('def-')) {
        await supabase.from('holidays').update(payload).eq('id', id);
      } else {
        await supabase.from('holidays').insert([payload]);
      }
    }
    Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ!', timer: 1500, showConfirmButton: false });
    closeHolidayModal();
    await fetchHolidays();
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.message });
  }
}

// ลบวันหยุด
async function deleteHoliday(id) {
  const res = await Swal.fire({
    title: 'ยืนยันการลบ?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบรายการ'
  });

  if (res.isConfirmed) {
    const supabase = window.pvtSupabase ? window.pvtSupabase.getClient() : null;
    if (supabase && !id.startsWith('def-')) {
      await supabase.from('holidays').delete().eq('id', id);
    }
    await fetchHolidays();
  }
}

// Helper Date Utilities
function formatThaiDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function formatThaiDateFull(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} พ.ศ. ${d.getFullYear() + 543}`;
}

function initNotificationBell() {
  const notifBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => { e.stopPropagation(); notifDropdown.classList.toggle('show'); });
    document.addEventListener('click', (e) => {
      if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) notifDropdown.classList.remove('show');
    });
  }
}

function handleLogout() {
  Swal.fire({
    title: 'ออกจากระบบ?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ออกจากระบบ'
  }).then(async (res) => {
    if (res.isConfirmed) {
      if (window.pvtSupabase && window.pvtSupabase.getClient()) {
        await window.pvtSupabase.getClient().auth.signOut();
      }
      window.location.href = '/index.html';
    }
  });
}