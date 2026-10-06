/* ==========================================================================
   📊 LEAVE STATISTICS & ANALYTICS DASHBOARD PAGE MODULE (ALL STATS)
   ========================================================================== */

window.leaveStatsState = {
  currentTab: 'dept', // 'dept' | 'ranking' | 'types' | 'monthly' | 'status'
  rankingScope: 'company', // 'company' | 'dept'
  searchQuery: '',
  deptFilter: 'all',
  statusFilter: 'approved', // 'approved' | 'pending' | 'rejected' | 'all'
  yearFilter: new Date().getFullYear().toString(),
  cachedRequests: [],
  userDeptName: '',
  allDepartments: []
};

document.addEventListener("DOMContentLoaded", async () => {
  await initLeaveStatsPage();
});

async function initLeaveStatsPage() {
  // ตัวเลือกปี: สร้างจากปีปัจจุบันย้อนหลัง 2 ปี (ไม่ต้องแก้ HTML ทุกปีใหม่)
  const yearSelect = document.getElementById("statsYearSelect");
  if (yearSelect) {
    const thisYear = new Date().getFullYear();
    let yearOptions = "";
    for (let y = thisYear; y >= thisYear - 2; y--) {
      yearOptions += `<option value="${y}">ปี ${y}</option>`;
    }
    yearOptions += `<option value="all">ทุกปีทั้งหมด</option>`;
    yearSelect.innerHTML = yearOptions;
    yearSelect.value = window.leaveStatsState.yearFilter;
  }

  const statusSelect = document.getElementById("statsStatusSelect");
  if (statusSelect) {
    statusSelect.value = window.leaveStatsState.statusFilter;
  }

  // Set event listener for search input
  const searchInput = document.getElementById("empSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      window.leaveStatsState.searchQuery = e.target.value.trim().toLowerCase();
      renderEmployeeRanking();
    });
  }

  await loadLeaveStatsData();
}

window.openSystemSettingsModal = window.openSystemSettingsModal || function() {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: 'info',
      title: 'การตั้งค่าระบบ',
      text: 'สามารถเข้าปรับแต่งขนาดตัวอักษร ธีมสี และการแจ้งเตือนได้จากหน้าหลักค่ะ',
      confirmButtonColor: 'var(--th-p-700, #0f766e)'
    });
  }
};

window.openEmployeeCardManagerPopup = window.openEmployeeCardManagerPopup || function() {
  window.location.href = '/pages/hr/home.html?action=employee_card';
};

window.handleLogout = function(event) {
  if (typeof window.executePvtLogout === 'function' && typeof Swal === 'undefined') {
    return window.executePvtLogout();
  }
  const performLogout = () => {
    if (typeof window.executePvtLogout === 'function') {
      window.executePvtLogout();
    } else {
      sessionStorage.setItem('pvt_explicit_logout', 'true');
      localStorage.removeItem('currentUser');
      localStorage.removeItem('userRole');
      localStorage.removeItem('supabase_session');
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/index.html?logout=true');
    }
  };

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: 'ยืนยันการออกจากระบบ',
      text: 'คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่?',
      icon: 'warning',
      showConfirmButton: true,
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ตกลง (ยืนยันการออก)',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: false,
      focusConfirm: true,
      customClass: {
        popup: 'pvt-logout-popup'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        performLogout();
      }
    });
  } else {
    if (confirm('คุณต้องการออกจากระบบ PVT Workforce Hub ใช่หรือไม่? (กด ตกลง / OK เพื่อยืนยันการออก)')) {
      performLogout();
    }
  }
};

window.goToLeaveForm = () => window.location.href = "/pages/approver/leave-approvals.html";
window.viewMyDigitalCard = () => window.location.href = "/pages/user/index-user.html?action=digital_card";
window.generateLineLinkToken = () => window.location.href = "/pages/user/index-user.html?action=line_link";
window.triggerBiometricHelp = () => window.location.href = "/pages/user/index-user.html?action=help";

function safeEscapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSafeSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  if (window.supabase) return window.supabase;
  return null;
}

// ผู้ใช้คนนี้ดูข้อมูลทั้งบริษัทได้ไหม (HR / Admin / ผู้บริหาร)
// เดิมเขียนซ้ำ 3 ที่ รวมไว้ที่เดียว
function canSeeAllCompanyData() {
  const localUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const userRole = String(localUser.role || 'user').toLowerCase();
  const empCode = String(localUser.employee_code || localUser?.employees?.employee_code || '').trim();

  const isHrOrAdmin = ["hr", "admin", "superadmin"].includes(userRole) || empCode === '19122';
  const isExecutive = ["director", "executive", "owner"].includes(userRole);
  return isHrOrAdmin || isExecutive;
}

// กล่องสถานะ: ว่าง / กำลังโหลด / ผิดพลาด (หน้าตามาจาก .ls-state ใน CSS)
function renderStateHtml(kind, icon, message) {
  return `<div class="ls-state ls-state--${kind}">
    <span class="material-symbols-outlined">${icon}</span>
    <div>${safeEscapeHtml(message)}</div>
  </div>`;
}

window.switchStatsTab = function(tabName) {
  window.leaveStatsState.currentTab = tabName;
  
  const tabs = ['dept', 'ranking', 'types', 'monthly', 'status'];
  tabs.forEach(t => {
    const btn = document.getElementById(`btnTab_${t}`);
    const view = document.getElementById(`viewTab_${t}`);
    
    // สีของแท็บมาจาก CSS (.stats-tab-btn.active) — สลับแค่ class
    if (btn) {
      btn.classList.toggle('active', t === tabName);
    }

    if (view) {
      view.style.display = t === tabName ? 'block' : 'none';
    }
  });

  if (window.leaveStatsState.cachedRequests.length > 0) {
    renderAllDashboardViews();
  }
};

window.switchRankingScope = function(scope) {
  window.leaveStatsState.rankingScope = scope;
  
  const btnCompany = document.getElementById("btnScopeCompany");
  const btnDept = document.getElementById("btnScopeDept");

  // สีของปุ่มมาจาก CSS (.btn-sub-rank.active) — สลับแค่ class
  if (btnCompany) btnCompany.classList.toggle('active', scope === 'company');
  if (btnDept) btnDept.classList.toggle('active', scope === 'dept');

  renderEmployeeRanking();
};

window.onYearOrDeptChange = function() {
  const yearSelect = document.getElementById("statsYearSelect");
  const deptSelect = document.getElementById("statsDeptSelect");
  const statusSelect = document.getElementById("statsStatusSelect");

  if (yearSelect) window.leaveStatsState.yearFilter = yearSelect.value;
  if (deptSelect) window.leaveStatsState.deptFilter = deptSelect.value;
  if (statusSelect) window.leaveStatsState.statusFilter = statusSelect.value;

  renderAllDashboardViews();
};

window.loadLeaveStatsData = async function() {
  const sb = getSafeSupabaseClient();
  if (!sb) {
    console.warn("Supabase client not ready for stats page");
    return;
  }

  const selectedYear = window.leaveStatsState.yearFilter;

  // Show loading indicators in all view containers
  const containers = ['deptStatsContainer', 'empRankingContainer', 'leaveTypesStatsContainer', 'monthlyChartContainer', 'statusBreakdownContainer'];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = renderStateHtml('loading', 'sync', `กำลังประมวลผลข้อมูลสถิติวันลา${selectedYear === 'all' ? 'ทุกปี' : ' ปี ' + selectedYear}...`);
    }
  });

  try {
    const localUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    window.leaveStatsState.userDeptName = localUser.department_name || localUser.departments?.department_name || "";
    const canSeeAllCompany = canSeeAllCompanyData();

    // 2. Fetch ALL data in parallel to avoid PGRST201 foreign-key ambiguity and column name variations
    const [lrRes, empRes, ltRes, deptRes] = await Promise.all([
      sb.from("leave_requests").select("id, employee_id, leave_type_id, total_days, status, start_date, end_date, created_at"),
      sb.from("employees").select("id, title, prefix, first_name, last_name, full_name, nickname, employee_code, department_id, image_url"),
      sb.from("leave_types").select("id, leave_name, leave_code"),
      sb.from("departments").select("id, department_name, department_code")
    ]);

    if (lrRes.error) console.warn("Fetch leave_requests warning:", lrRes.error);
    if (empRes.error) console.warn("Fetch employees warning:", empRes.error);
    if (ltRes.error) console.warn("Fetch leave_types warning:", ltRes.error);
    if (deptRes.error) console.warn("Fetch departments warning:", deptRes.error);

    const rawRequests = lrRes.data || [];
    const empList = empRes.data || [];
    const typeList = ltRes.data || [];
    const deptList = deptRes.data || [];

    const empMap = {};
    empList.forEach(e => { if (e && e.id) empMap[e.id] = e; });

    const typeLookup = {};
    typeList.forEach(t => { if (t && t.id) typeLookup[t.id] = t.leave_name || t.leave_code || 'วันลา'; });

    const deptLookup = {};
    deptList.forEach(d => { if (d && d.id) deptLookup[d.id] = d.department_name || 'ทั่วไป'; });

    const joinedRequests = rawRequests.map(r => {
      const emp = r.employee_id ? empMap[r.employee_id] : null;
      const deptName = emp && emp.department_id ? (deptLookup[emp.department_id] || 'ไม่ระบุแผนก') : 'ไม่ระบุแผนก';
      const typeName = (r.leave_type_id ? typeLookup[r.leave_type_id] : null) || r.leave_type_name || 'อื่นๆ';
      const days = parseFloat(r.days_requested != null ? r.days_requested : r.total_days) || 0;

      return {
        ...r,
        days_requested: days,
        leave_type_name: typeName,
        employees: emp ? {
          ...emp,
          first_name_th: emp.first_name || emp.first_name_th || '',
          last_name_th: emp.last_name || emp.last_name_th || '',
          avatar_url: emp.image_url || emp.avatar_url || '',
          profile_image_url: emp.image_url || emp.avatar_url || '',
          departments: {
            id: emp.department_id,
            department_name: deptName
          }
        } : null
      };
    });

    let finalRequests = joinedRequests;
    if (!canSeeAllCompany && window.leaveStatsState.userDeptName) {
      finalRequests = joinedRequests.filter(r => {
        const dName = r.employees?.departments?.department_name || "";
        return dName.toLowerCase() === window.leaveStatsState.userDeptName.toLowerCase();
      });
    }

    window.leaveStatsState.cachedRequests = finalRequests;

    // Populate Department Filter Dropdown
    populateDepartmentDropdown(finalRequests, deptList);

    // Render Dashboard
    renderAllDashboardViews();

    // Update Pending Badge in HR Sidebar
    const pendingBadge = document.getElementById("sidebarSlaPendingBadge");
    if (pendingBadge) {
      const pendingCount = joinedRequests.filter(r => r.status === 'pending').length;
      if (pendingCount > 0) {
        pendingBadge.textContent = pendingCount;
        pendingBadge.style.display = 'inline-flex';
      } else {
        pendingBadge.style.display = 'none';
      }
    }

    // Update last updated timestamp
    const timeEl = document.getElementById("lastUpdatedTime");
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `อัปเดตล่าสุด: ${now.toLocaleDateString('th-TH')} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
    }

  } catch (err) {
    console.error("loadLeaveStatsData error:", err);
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = renderStateHtml('error', 'error', 'เกิดข้อผิดพลาดในการโหลดข้อมูลสถิติ กรุณากดรีเฟรชอีกครั้ง');
    });
  }
};

function populateDepartmentDropdown(requests, deptList = []) {
  const deptSelect = document.getElementById("statsDeptSelect");
  if (!deptSelect) return;

  const canSeeAllCompany = canSeeAllCompanyData();
  const userDeptName = window.leaveStatsState.userDeptName || "";

  if (!canSeeAllCompany && userDeptName) {
    deptSelect.innerHTML = `<option value="${safeEscapeHtml(userDeptName)}">${safeEscapeHtml(userDeptName)} (แผนกของคุณ)</option>`;
    window.leaveStatsState.deptFilter = userDeptName;
    deptSelect.disabled = true; // Disable selecting other departments
    
    // Hide the company-wide vs department-only toggle for the ranking table to prevent leak/confusion
    const scopeBtnGroup = document.getElementById("btnScopeCompany")?.parentElement;
    if (scopeBtnGroup) {
      scopeBtnGroup.style.display = "none";
    }
    window.leaveStatsState.rankingScope = 'dept';
    return;
  }

  const deptsSet = new Set();
  (deptList || []).forEach(d => {
    const name = d.name || d.department_name;
    if (name) deptsSet.add(name);
  });
  requests.forEach(r => {
    const dName = r.employees?.departments?.department_name;
    if (dName) deptsSet.add(dName);
  });

  const currentVal = deptSelect.value;
  let optionsHtml = `<option value="all">ทุกแผนกองค์กร</option>`;
  Array.from(deptsSet).sort().forEach(d => {
    optionsHtml += `<option value="${safeEscapeHtml(d)}" ${currentVal === d ? 'selected' : ''}>${safeEscapeHtml(d)}</option>`;
  });

  deptSelect.innerHTML = optionsHtml;
}

function renderAllDashboardViews() {
  const allRequests = window.leaveStatsState.cachedRequests || [];
  const selectedYear = window.leaveStatsState.yearFilter;
  const selectedDept = window.leaveStatsState.deptFilter;
  const selectedStatus = window.leaveStatsState.statusFilter;
  const userDeptName = window.leaveStatsState.userDeptName || "";

  // Filter by year first
  const yearRequests = allRequests.filter(r => {
    const year = r.start_date ? new Date(r.start_date).getFullYear().toString() : (r.created_at ? new Date(r.created_at).getFullYear().toString() : '');
    return year === selectedYear || selectedYear === 'all';
  });

  // Filter by department
  const deptFiltered = selectedDept === 'all'
    ? yearRequests
    : yearRequests.filter(r => (r.employees?.departments?.department_name || '').toLowerCase() === selectedDept.toLowerCase());

  // Filter by status for detail views
  const activeRequests = selectedStatus === 'all'
    ? deptFiltered
    : deptFiltered.filter(r => {
        if (selectedStatus === 'approved') return r.status === 'approved';
        if (selectedStatus === 'pending') return r.status === 'pending' || r.status === 'pending_l1' || r.status === 'pending_l2';
        if (selectedStatus === 'rejected') return r.status === 'rejected' || r.status === 'cancelled';
        return true;
      });

  // Calculate status counters
  let countApproved = 0, daysApproved = 0;
  let countPending = 0, daysPending = 0;
  let countRejected = 0, daysRejected = 0;

  deptFiltered.forEach(req => {
    const days = parseFloat(req.days_requested) || 0;
    const st = req.status;
    if (st === 'approved') {
      countApproved++;
      daysApproved += days;
    } else if (st === 'pending' || st === 'pending_l1' || st === 'pending_l2') {
      countPending++;
      daysPending += days;
    } else if (st === 'rejected' || st === 'cancelled') {
      countRejected++;
      daysRejected += days;
    }
  });

  const totalReqCount = deptFiltered.length;
  const approvalRate = totalReqCount > 0 ? ((countApproved / totalReqCount) * 100).toFixed(1) : 0;

  // Department & Employee aggregation for activeRequests
  let totalDays = 0;
  const deptMap = {}; // { deptName: { days, count, empIds: Set } }
  const empMap = {};  // { empId: { name, deptName, avatar, empCode, days, count, leaveTypes: {} } }
  const typeMap = {}; // { typeName: { days, count } }
  const monthlyMap = Array(12).fill(0); // [Jan-Dec days]
  const dayOfWeekMap = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat

  activeRequests.forEach(req => {
    const days = parseFloat(req.days_requested) || 0;
    totalDays += days;

    const emp = req.employees;
    const empName = emp ? `${emp.first_name_th || ''} ${emp.last_name_th || ''}`.trim() || emp.nickname || 'พนักงาน' : 'ไม่ระบุชื่อ';
    const deptName = emp?.departments?.department_name || 'ไม่ระบุแผนก';
    const avatar = (typeof window.getAvatarUrl === 'function' ? window.getAvatarUrl(emp?.image_url || emp?.avatar_url || emp?.profile_image_url || '', emp?.title || emp?.prefix || '', emp?.gender || '', emp?.full_name || empName) : '/assets/img/avatar-male.jpg?v=2');
    const avTitle = emp?.title || emp?.prefix || '';
    const avName = emp?.full_name || empName;
    const empCode = emp?.employee_code || '';
    const leaveTypeName = req.leave_type_name || 'อื่นๆ';

    // Monthly & Day of week
    const startDate = req.start_date ? new Date(req.start_date) : (req.created_at ? new Date(req.created_at) : null);
    if (startDate && !isNaN(startDate.getTime())) {
      const monthIdx = startDate.getMonth(); // 0 - 11
      monthlyMap[monthIdx] += days;

      const dayIdx = startDate.getDay(); // 0 (Sun) - 6 (Sat)
      dayOfWeekMap[dayIdx] += days;
    }

    // Dept map
    if (!deptMap[deptName]) {
      deptMap[deptName] = { days: 0, count: 0, empIds: new Set() };
    }
    deptMap[deptName].days += days;
    deptMap[deptName].count += 1;
    if (emp?.id && !(window.isSystemOrAdminAccount && window.isSystemOrAdminAccount(emp))) deptMap[deptName].empIds.add(emp.id);

    // Emp map
    const empId = req.employee_id || empName;
    if (!empMap[empId]) {
      empMap[empId] = { id: empId, name: empName, deptName, avatar, empCode, days: 0, count: 0, leaveTypes: {} };
    }
    empMap[empId].days += days;
    empMap[empId].count += 1;
    empMap[empId].leaveTypes[leaveTypeName] = (empMap[empId].leaveTypes[leaveTypeName] || 0) + days;

    // Type map
    if (!typeMap[leaveTypeName]) {
      typeMap[leaveTypeName] = { days: 0, count: 0 };
    }
    typeMap[leaveTypeName].days += days;
    typeMap[leaveTypeName].count += 1;
  });

  // Calculate Top Highlights
  const deptList = Object.keys(deptMap).map(d => ({ name: d, days: deptMap[d].days, count: deptMap[d].count, empCount: deptMap[d].empIds.size }))
    .sort((a, b) => b.days - a.days);

  const empListAll = Object.values(empMap).sort((a, b) => b.days - a.days);
  const empListDept = empListAll.filter(e => e.deptName.toLowerCase() === userDeptName.toLowerCase());

  const topDept = deptList[0];
  const topEmpCompany = empListAll[0];
  const topEmpDept = empListDept[0];

  // Top Cards Elements
  const totalDaysEl = document.getElementById("statTotalApprovedDays");
  const totalReqsEl = document.getElementById("statTotalApprovedRequests");
  const pendingDaysEl = document.getElementById("statPendingDays");
  const pendingReqsEl = document.getElementById("statPendingRequests");
  const topDeptNameEl = document.getElementById("statTopDeptName");
  const topDeptDaysEl = document.getElementById("statTopDeptDays");
  const topEmpCompEl = document.getElementById("statTopEmpCompany");
  const topEmpCompDaysEl = document.getElementById("statTopEmpCompanyDays");

  if (totalDaysEl) totalDaysEl.textContent = `${daysApproved.toFixed(1)} วัน`;
  if (totalReqsEl) totalReqsEl.textContent = `${countApproved} คำขออนุมัติ (${approvalRate}%)`;

  if (pendingDaysEl) pendingDaysEl.textContent = `${countPending} คำขอ`;
  if (pendingReqsEl) pendingReqsEl.textContent = `รวม ${daysPending.toFixed(1)} วันรออนุมัติ`;

  if (topDeptNameEl) topDeptNameEl.textContent = topDept ? topDept.name : '-';
  if (topDeptDaysEl) topDeptDaysEl.textContent = topDept ? `${topDept.days.toFixed(1)} วัน (${topDept.count} ครั้ง)` : '0 วัน';

  if (topEmpCompEl) topEmpCompEl.textContent = topEmpCompany ? topEmpCompany.name : '-';
  if (topEmpCompDaysEl) topEmpCompDaysEl.textContent = topEmpCompany ? `${topEmpCompany.days.toFixed(1)} วัน (${topEmpCompany.deptName})` : '0 วัน';

  // Render individual views
  renderDepartmentStats(deptList, totalDays);
  renderEmployeeRanking();
  renderLeaveTypesStats(typeMap, totalDays);
  renderMonthlyTrends(monthlyMap);
  renderStatusBreakdown(countApproved, countPending, countRejected, totalReqCount, dayOfWeekMap);
}

function renderDepartmentStats(deptList, totalCompanyDays) {
  const container = document.getElementById("deptStatsContainer");
  if (!container) return;

  if (deptList.length === 0) {
    container.innerHTML = renderStateHtml('empty', 'inbox', 'ยังไม่มีข้อมูลใบลาตามเงื่อนไขที่เลือก');
    return;
  }

  const maxDeptDays = deptList[0]?.days || 1;
  const userDeptName = (window.leaveStatsState.userDeptName || "").toLowerCase();

  container.innerHTML = deptList.map((dept, index) => {
    const percentOfMax = Math.min(100, Math.round((dept.days / maxDeptDays) * 100));
    const percentOfTotal = totalCompanyDays > 0 ? ((dept.days / totalCompanyDays) * 100).toFixed(1) : 0;
    const isUserDept = userDeptName && dept.name.toLowerCase() === userDeptName;

    return `
      <article class="ls-dept ${isUserDept ? 'is-mine' : ''}">
        <div class="ls-dept-head">
          <div class="ls-dept-name">
            <span class="ls-rank-chip">#${index + 1}</span>
            <strong>${safeEscapeHtml(dept.name)}</strong>
            ${isUserDept ? '<span class="ls-mine-chip">แผนกของคุณ</span>' : ''}
          </div>
          <div class="ls-dept-value">
            <strong>${dept.days.toFixed(1)} วัน</strong>
            <span>${dept.count} คำขอ · ${dept.empCount} คน</span>
          </div>
        </div>
        <div class="ls-bar"><div class="ls-bar-fill" style="width: ${percentOfMax}%"></div></div>
        <div class="ls-dept-foot">
          <span>เทียบกับแผนกสูงสุด ${percentOfMax}%</span>
          <span>คิดเป็น ${percentOfTotal}% ของวันลาทั้งหมด</span>
        </div>
      </article>`;
  }).join('');
}

// คำนวณอันดับพนักงานตามตัวกรองปัจจุบัน (ใช้ทั้งตอนแสดงผลและตอนส่งออก Excel)
function getEmployeeRankingList() {
  const allRequests = window.leaveStatsState.cachedRequests || [];
  const selectedYear = window.leaveStatsState.yearFilter;
  const selectedDept = window.leaveStatsState.deptFilter;
  const selectedStatus = window.leaveStatsState.statusFilter;
  const scope = window.leaveStatsState.rankingScope || 'company';
  const query = window.leaveStatsState.searchQuery || '';
  const userDeptName = window.leaveStatsState.userDeptName || "";

  // Filter requests
  const yearRequests = allRequests.filter(r => {
    const year = r.start_date ? new Date(r.start_date).getFullYear().toString() : (r.created_at ? new Date(r.created_at).getFullYear().toString() : '');
    return year === selectedYear || selectedYear === 'all';
  });

  const requests = selectedStatus === 'all'
    ? yearRequests
    : yearRequests.filter(r => {
        if (selectedStatus === 'approved') return r.status === 'approved';
        if (selectedStatus === 'pending') return r.status === 'pending' || r.status === 'pending_l1' || r.status === 'pending_l2';
        if (selectedStatus === 'rejected') return r.status === 'rejected' || r.status === 'cancelled';
        return true;
      });

  // Group by Employee
  const empMap = {};
  requests.forEach(req => {
    const days = parseFloat(req.days_requested) || 0;
    const emp = req.employees;
    const empName = emp ? `${emp.first_name_th || ''} ${emp.last_name_th || ''}`.trim() || emp.nickname || 'พนักงาน' : 'ไม่ระบุชื่อ';
    const deptName = emp?.departments?.department_name || 'ไม่ระบุแผนก';
    const avatar = (typeof window.getAvatarUrl === 'function' ? window.getAvatarUrl(emp?.image_url || emp?.avatar_url || emp?.profile_image_url || '', emp?.title || emp?.prefix || '', emp?.gender || '', emp?.full_name || empName) : '/assets/img/avatar-male.jpg?v=2');
    const avTitle = emp?.title || emp?.prefix || '';
    const avName = emp?.full_name || empName;
    const empCode = emp?.employee_code || '';
    const leaveTypeName = req.leave_type_name || 'อื่นๆ';

    const key = emp?.id || empName;
    if (!empMap[key]) {
      empMap[key] = { id: key, name: empName, deptName, avatar, avTitle, avName, empCode, days: 0, count: 0, leaveTypes: {} };
    }
    empMap[key].days += days;
    empMap[key].count += 1;
    empMap[key].leaveTypes[leaveTypeName] = (empMap[key].leaveTypes[leaveTypeName] || 0) + days;
  });

  let list = Object.values(empMap).sort((a, b) => b.days - a.days);

  // For non-HR / non-executive roles, force see only their own department (strictly enforced)
  const canSeeAllCompany = canSeeAllCompanyData();

  if (!canSeeAllCompany && userDeptName) {
    list = list.filter(e => e.deptName.toLowerCase() === userDeptName.toLowerCase());
  } else {
    // Filter scope for admin / HR
    if (scope === 'dept' && userDeptName) {
      list = list.filter(e => e.deptName.toLowerCase() === userDeptName.toLowerCase());
    } else if (selectedDept !== 'all') {
      list = list.filter(e => e.deptName.toLowerCase() === selectedDept.toLowerCase());
    }
  }

  // Search filter
  if (query) {
    list = list.filter(e => 
      e.name.toLowerCase().includes(query) || 
      e.empCode.toLowerCase().includes(query) || 
      e.deptName.toLowerCase().includes(query)
    );
  }

  // ประเภทการลาที่ใช้มากที่สุดของแต่ละคน
  list.forEach(emp => {
    let topLeaveType = "-";
    let maxTypeDays = 0;
    Object.keys(emp.leaveTypes).forEach(t => {
      if (emp.leaveTypes[t] > maxTypeDays) {
        maxTypeDays = emp.leaveTypes[t];
        topLeaveType = t;
      }
    });
    emp.topLeaveType = topLeaveType;
  });

  return list;
}

function renderEmployeeRanking() {
  const container = document.getElementById("empRankingContainer");
  if (!container) return;

  const list = getEmployeeRankingList();

  if (list.length === 0) {
    container.innerHTML = renderStateHtml('empty', 'search_off', 'ไม่พบข้อมูลพนักงานตามเงื่อนไขที่ค้นหา');
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];

  container.innerHTML = list.map((emp, index) => {
    const isTop3 = index < 3;
    const rankHtml = isTop3
      ? `<span class="ls-emp-rank is-medal">${medals[index]}</span>`
      : `<span class="ls-emp-rank">#${index + 1}</span>`;

    return `
      <article class="ls-emp ${isTop3 ? `is-top-${index + 1}` : ''}">
        ${rankHtml}
        <img class="ls-emp-avatar" src="${safeEscapeHtml(emp.avatar)}" alt="" data-av-title="${safeEscapeHtml(emp.avTitle || '')}" data-av-name="${safeEscapeHtml(emp.avName || emp.name || '')}" onerror="pvtAvatarError(this)" />
        <div class="ls-emp-info">
          <div class="ls-emp-name">
            <strong>${safeEscapeHtml(emp.name)}</strong>
            ${emp.empCode ? `<span class="ls-code-chip">${safeEscapeHtml(emp.empCode)}</span>` : ''}
          </div>
          <div class="ls-emp-meta">
            <span>${safeEscapeHtml(emp.deptName)}</span>
            <span>ประเภทหลัก: <b>${safeEscapeHtml(emp.topLeaveType)}</b></span>
          </div>
        </div>
        <div class="ls-emp-total">
          <strong>${emp.days.toFixed(1)} วัน</strong>
          <span>${emp.count} คำขอ</span>
        </div>
      </article>`;
  }).join('');
}

function renderLeaveTypesStats(typeMap, totalCompanyDays) {
  const container = document.getElementById("leaveTypesStatsContainer");
  if (!container) return;

  const typeList = Object.keys(typeMap)
    .map(t => ({ name: t, days: typeMap[t].days, count: typeMap[t].count }))
    .sort((a, b) => b.days - a.days);

  if (typeList.length === 0) {
    container.innerHTML = renderStateHtml('empty', 'inbox', 'ไม่มีข้อมูลประเภทวันลาตามเงื่อนไขที่เลือก');
    return;
  }

  // สี/ไอคอนตามชื่อประเภท (สีจริงอยู่ใน CSS: .ls-type--sick / --vacation / --personal)
  const getTypeStyle = (name) => {
    if (name.includes("ป่วย")) return { mod: 'sick', icon: 'medical_services' };
    if (name.includes("พักร้อน")) return { mod: 'vacation', icon: 'beach_access' };
    if (name.includes("กิจ")) return { mod: 'personal', icon: 'assignment_ind' };
    return { mod: 'other', icon: 'event_available' };
  };

  container.innerHTML = typeList.map(t => {
    const percent = totalCompanyDays > 0 ? ((t.days / totalCompanyDays) * 100).toFixed(1) : 0;
    const style = getTypeStyle(t.name);

    return `
      <article class="ls-type ls-type--${style.mod}">
        <div class="ls-type-head">
          <span class="ls-type-icon material-symbols-outlined">${style.icon}</span>
          <span class="ls-type-pct">${percent}%</span>
        </div>
        <div class="ls-type-name">${safeEscapeHtml(t.name)}</div>
        <div class="ls-type-count">${t.count} คำขอ</div>
        <div class="ls-bar"><div class="ls-bar-fill" style="width: ${percent}%"></div></div>
        <div class="ls-type-total">${t.days.toFixed(1)}<small>วันรวม</small></div>
      </article>`;
  }).join('');
}

function renderMonthlyTrends(monthlyMap) {
  const container = document.getElementById("monthlyChartContainer");
  if (!container) return;

  const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const maxVal = Math.max(...monthlyMap, 0);

  if (maxVal === 0) {
    container.innerHTML = renderStateHtml('empty', 'bar_chart', 'ยังไม่มีวันลาในช่วงที่เลือก');
    return;
  }

  // แท่งต่ำสุด 3% เพื่อให้เห็นว่ามีเดือนนั้นอยู่
  const bars = monthlyMap.map((val, i) => {
    const heightPercent = val > 0 ? Math.max(3, Math.round((val / maxVal) * 100)) : 3;
    const classes = ['ls-month'];
    if (val === 0) classes.push('is-empty');
    if (val === maxVal) classes.push('is-peak');

    return `
      <div class="${classes.join(' ')}" title="${monthNames[i]}: ${val.toFixed(1)} วัน">
        <span class="ls-month-val">${val > 0 ? val.toFixed(1) : ''}</span>
        <div class="ls-month-bar" style="height: ${heightPercent}%"></div>
      </div>`;
  }).join('');

  const labels = monthNames.map(m => `<span>${m}</span>`).join('');

  container.innerHTML = `
    <div class="ls-month-scroll">
      <div class="ls-month-chart">${bars}</div>
      <div class="ls-month-labels">${labels}</div>
    </div>`;
}

function renderStatusBreakdown(approved, pending, rejected, total, dayOfWeekMap) {
  const container = document.getElementById("statusBreakdownContainer");
  if (!container) return;

  const rate = (n) => total > 0 ? Math.round((n / total) * 100) : 0;
  const appRate = rate(approved);

  const statusRows = [
    { mod: 'approved', label: 'อนุมัติแล้ว', count: approved, pct: appRate },
    { mod: 'pending', label: 'รอพิจารณา', count: pending, pct: rate(pending) },
    { mod: 'rejected', label: 'ไม่อนุมัติ / ยกเลิก', count: rejected, pct: rate(rejected) }
  ].map(r => `
    <div class="ls-status-row ls-status-row--${r.mod}">
      <div class="ls-status-label">
        <span>${r.label} (${r.count} รายการ)</span>
        <span>${r.pct}%</span>
      </div>
      <div class="ls-bar"><div class="ls-bar-fill" style="width: ${r.pct}%"></div></div>
    </div>`).join('');

  // วันในสัปดาห์: เริ่มวันจันทร์ (ข้อมูลเดิม index 0 = อาทิตย์)
  const daysTh = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const maxDayVal = Math.max(...dayOfWeekMap, 0);

  const weekdayRows = order.map(idx => {
    const val = dayOfWeekMap[idx];
    const pct = maxDayVal > 0 ? Math.round((val / maxDayVal) * 100) : 0;
    const classes = ['ls-weekday'];
    if (idx === 0 || idx === 6) classes.push('is-weekend');
    if (maxDayVal > 0 && val === maxDayVal) classes.push('is-peak');

    return `
      <div class="${classes.join(' ')}">
        <span class="ls-weekday-name">${daysTh[idx]}</span>
        <div class="ls-bar"><div class="ls-bar-fill" style="width: ${pct}%"></div></div>
        <span class="ls-weekday-val">${val.toFixed(1)} วัน</span>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="ls-split">
      <section class="ls-subcard">
        <h3><span class="material-symbols-outlined">task_alt</span> สัดส่วนสถานะคำขอ</h3>
        <div class="ls-rate">
          <strong>${appRate}%</strong>
          <span>อัตราอนุมัติ จาก ${total} คำขอ</span>
        </div>
        <div class="ls-status-rows">${statusRows}</div>
      </section>

      <section class="ls-subcard">
        <h3><span class="material-symbols-outlined">calendar_view_week</span> วันที่ลาบ่อยที่สุด</h3>
        ${weekdayRows}
      </section>
    </div>`;
}

window.printLeaveStatsReport = function() {
  window.print();
};

window.exportStatsToExcel = function() {
  try {
    const state = window.leaveStatsState;
    const year = state.yearFilter === 'all' ? 'ทุกปี' : state.yearFilter;
    const dept = state.deptFilter === 'all' ? 'ทุกแผนก' : state.deptFilter;
    const statusSelect = document.getElementById('statsStatusSelect');
    const statusLabel = statusSelect ? statusSelect.options[statusSelect.selectedIndex].text : state.statusFilter;

    // ช่อง CSV: ครอบด้วย "..." และ escape เครื่องหมาย " ข้างใน
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    // ข้อมูลจริงจากตัวกรองปัจจุบัน (เดิมไปอ่าน #topLeaveUsersTable ที่ไม่มีในหน้า ไฟล์จึงว่าง)
    const list = getEmployeeRankingList();

    // Build CSV Content compatible with Excel UTF-8 BOM
    let csvContent = "﻿";
    csvContent += `${csvCell(`รายงานสถิติการลา ปี ${year} (แผนก: ${dept} / สถานะ: ${statusLabel})`)}\n`;
    csvContent += `${csvCell(`สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}`)}\n\n`;
    csvContent += `อันดับ,รหัสพนักงาน,ชื่อพนักงาน,แผนก,ประเภทการลาหลัก,จำนวนคำขอ,จำนวนวันลารวม\n`;

    if (list.length === 0) {
      csvContent += `${csvCell('ไม่มีข้อมูลตามเงื่อนไขที่เลือก')}\n`;
    } else {
      list.forEach((emp, index) => {
        csvContent += [
          index + 1,
          csvCell(emp.empCode),
          csvCell(emp.name),
          csvCell(emp.deptName),
          csvCell(emp.topLeaveType),
          emp.count,
          emp.days.toFixed(1)
        ].join(',') + '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `รายงานสถิติวันลา_${year}_${dept}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: 'ส่งออกไฟล์ Excel สำเร็จ!',
        text: `ดาวน์โหลดไฟล์รายงานสถิติประจำปี ${year} เรียบร้อยแล้ว`,
        timer: 2000,
        showConfirmButton: false
      });
    }
  } catch (err) {
    console.error('Error exporting to Excel:', err);
    window.print();
  }
};