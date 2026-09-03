// ============================================================
// PVT Workforce Hub - ตั้งค่าสายอนุมัติใบลา
// ใช้ตาราง: departments, employees, department_approvers
// ============================================================

let sb = null;
let departments = [];
let employees = [];
let approverMap = new Map();
let executiveSetting = null;

document.addEventListener("DOMContentLoaded", async () => {
  const session = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const userStatus = typeof window.getUserRoleCategory === "function" 
    ? window.getUserRoleCategory(session) 
    : { category: "guest" };

  if (userStatus.category !== "hr_exec") {
    console.warn("🚫 [Approval Settings]: ไม่มีสิทธิ์เข้าถึงหน้านี้");
    window.location.replace("/pages/hr/home.html");
    return;
  }

  sb = window.pvtSupabase?.getClient?.() || window.supabaseClient || null;

  if (!sb) {
    Swal.fire("เชื่อมต่อไม่ได้", "ไม่พบ Supabase Client", "error");
    return;
  }

  bindEvents();
  await loadAllData();
});

function bindEvents() {
  document.getElementById("departmentSelect")?.addEventListener("change", handleDepartmentChange);
  document.getElementById("supervisorSelect")?.addEventListener("change", () => updateLineStatus("supervisor"));
  document.getElementById("managerSelect")?.addEventListener("change", () => updateLineStatus("manager"));
  document.getElementById("saveApproverBtn")?.addEventListener("click", saveApprover);
  document.getElementById("executiveSelect")?.addEventListener("change", updateExecutiveLineStatus);
  document.getElementById("saveExecutiveBtn")?.addEventListener("click", saveExecutiveSetting);
  document.getElementById("saveLineNotifSettingsBtn")?.addEventListener("click", saveLineNotificationSettings);
  
  // New: Individual Approver Events
  document.getElementById("individualEmployeeSelect")?.addEventListener("change", handleIndividualEmployeeChange);
  document.getElementById("btnSaveIndividual")?.addEventListener("click", saveIndividualApprover);
}

window.focusSection = function(sectionId, focusElementId) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('highlight-pulse');
    void el.offsetWidth;
    el.classList.add('highlight-pulse');
  }
  if (focusElementId) {
    setTimeout(() => {
      const focusEl = document.getElementById(focusElementId);
      if (focusEl && !focusEl.disabled) {
        focusEl.focus();
      }
    }, 400);
  }
};

async function loadAllData() {
  try {
    const [deptRes, empRes, mapRes, executiveRes] = await Promise.all([
      sb.from("departments").select("id, department_name").order("department_name"),
      sb.from("employees")
        .select("id, employee_code, full_name, nickname, department_id, role, line_id, status, image_url, l1_approver_id, l2_approver_id, positions(position_name), departments!department_id(department_name)")
        .order("full_name"),
      sb.from("department_approvers").select("id, department_id, supervisor_id, manager_id"),
      sb.from("system_settings").select("setting_key, employee_id").eq("setting_key", "leave_executive_approver").maybeSingle()
    ]);

    if (deptRes.error) throw deptRes.error;
    if (empRes.error) throw empRes.error;
    if (mapRes.error) throw mapRes.error;
    if (executiveRes.error) throw executiveRes.error;

    departments = deptRes.data || [];
    employees = empRes.data || [];
    approverMap = new Map((mapRes.data || []).map(x => [String(x.department_id), x]));
    executiveSetting = executiveRes.data || null;

    renderExecutiveOptions();
    renderDepartmentOptions();
    renderIndividualEmployeeOptions(); // New
    
    // Initialize Tom Select for searchable dropdowns
    setTimeout(() => {
      initTomSelect();
    }, 500);
    
    renderApproverTable();
    renderEmployeeLineTable();
    await loadLineNotificationSettings();
  } catch (err) {
    console.error("loadAllData:", err);
    Swal.fire("โหลดข้อมูลไม่สำเร็จ", err.message || "กรุณาลองใหม่", "error");
  }
}

// ============================================================
// 🏢 1. จัดการรายชื่อแผนก (CRUD)
// ============================================================
window.manageDepartmentsModal = async function() {
  const { value: formValues } = await Swal.fire({
    title: '🏢 จัดการรายชื่อแผนก',
    html: `
      <div style="text-align: left; margin-bottom: 15px;">
        <button class="btn btn-primary btn-sm" onclick="addNewDepartmentPrompt()" style="margin-bottom: 15px;">
          <span class="material-symbols-outlined" style="font-size: 18px;">add</span> เพิ่มแผนกใหม่
        </button>
        <div id="modalDeptList" style="max-height: 300px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="padding: 20px; text-align: center; color: #94a3b8;">กำลังโหลด...</div>
        </div>
      </div>
    `,
    showConfirmButton: false,
    showCloseButton: true,
    didOpen: () => {
      renderModalDeptList();
    }
  });
};

async function renderModalDeptList() {
  const container = document.getElementById('modalDeptList');
  if (!container) return;

  try {
    const { data, error } = await sb.from('departments').select('*').order('department_name');
    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">ไม่มีข้อมูลแผนก</div>';
      return;
    }

    container.innerHTML = data.map(d => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
        <span style="font-weight: 600; color: #1e293b;">${escapeHtml(d.department_name)}</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-sm btn-edit" onclick="editDeptNamePrompt('${d.id}', '${escapeAttr(d.department_name)}')">
            <span class="material-symbols-outlined" style="font-size: 16px;">edit</span>
          </button>
          <button class="btn btn-sm btn-delete" onclick="deleteDeptPrompt('${d.id}', '${escapeAttr(d.department_name)}')">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div style="padding: 20px; color: #ef4444;">ข้อผิดพลาด: ${err.message}</div>`;
  }
}

window.addNewDepartmentPrompt = async function() {
  const { value: name } = await Swal.fire({
    title: 'เพิ่มแผนกใหม่',
    input: 'text',
    inputLabel: 'ชื่อแผนก',
    inputPlaceholder: 'เช่น ฝ่ายผลิต, ฝ่ายขาย',
    showCancelButton: true,
    confirmButtonColor: '#0d9488',
    inputValidator: (value) => {
      if (!value) return 'กรุณาระบุชื่อแผนก';
    }
  });

  if (name) {
    try {
      const { error } = await sb.from('departments').insert({ department_name: name });
      if (error) throw error;
      await loadAllData();
      renderModalDeptList();
      Swal.fire('สำเร็จ', 'เพิ่มแผนกเรียบร้อย', 'success');
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
};

window.editDeptNamePrompt = async function(id, currentName) {
  const { value: name } = await Swal.fire({
    title: 'แก้ไขชื่อแผนก',
    input: 'text',
    inputLabel: 'ชื่อแผนกใหม่',
    inputValue: currentName,
    showCancelButton: true,
    confirmButtonColor: '#0d9488',
    inputValidator: (value) => {
      if (!value) return 'กรุณาระบุชื่อแผนก';
    }
  });

  if (name) {
    try {
      const { error } = await sb.from('departments').update({ department_name: name }).eq('id', id);
      if (error) throw error;
      await loadAllData();
      renderModalDeptList();
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
};

window.deleteDeptPrompt = async function(id, name) {
  const result = await Swal.fire({
    title: 'ยืนยันการลบ?',
    text: `คุณกำลังลบแผนก "${name}" ซึ่งอาจมีผลต่อพนักงานในแผนกนี้`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'ลบข้อมูล',
    cancelButtonText: 'ยกเลิก'
  });

  if (result.isConfirmed) {
    try {
      const { error } = await sb.from('departments').delete().eq('id', id);
      if (error) throw error;
      await loadAllData();
      renderModalDeptList();
      Swal.fire('ลบแล้ว', 'ลบแผนกเรียบร้อย', 'success');
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.message, 'error');
    }
  }
};

// ============================================================
// Helper คัดกรองพนักงานตามแผนกและตำแหน่งอย่างเคร่งครัด (Strict Department & Role Filtering)
// ============================================================

function isLeaderCandidate(emp) {
  if (!emp) return false;
  if (emp.status === 'resigned' || emp.status === 'inactive') return false;
  const role = (emp.role || "").toLowerCase();
  const pos = (emp.positions?.position_name || emp.position_name || emp.position || "").toLowerCase();
  const duty = (emp.positions?.duty_name || emp.duty_name || "").toLowerCase();

  // 1. role เป็น leader หรือ supervisor
  if (['leader', 'supervisor'].includes(role)) return true;

  // 2. ชื่อตำแหน่ง/หน้าที่ มีคำว่า หัวหน้า, leader, supervisor, lead
  const hasLeaderKeyword = (
    pos.includes('หัวหน้า') ||
    pos.includes('leader') ||
    pos.includes('supervisor') ||
    pos.includes('ผช.หัวหน้า') ||
    pos.includes('ผู้ช่วยหัวหน้า') ||
    pos.includes('รองหัวหน้า') ||
    pos.includes('lead') ||
    duty.includes('หัวหน้า') ||
    duty.includes('leader') ||
    duty.includes('supervisor')
  );

  if (hasLeaderKeyword) {
    // ยกเว้นผู้จัดการ/ผู้บริหาร เว้นแต่จะระบุ role เป็น leader
    if ((pos.includes('ผู้จัดการ') || pos.includes('manager') || pos.includes('director') || pos.includes('ผู้บริหาร')) && role !== 'leader') {
      return false;
    }
    return true;
  }

  return false;
}

function isManagerCandidate(emp) {
  if (!emp) return false;
  if (emp.status === 'resigned' || emp.status === 'inactive') return false;
  const role = (emp.role || "").toLowerCase();
  const pos = (emp.positions?.position_name || emp.position_name || emp.position || "").toLowerCase();
  const duty = (emp.positions?.duty_name || emp.duty_name || "").toLowerCase();

  // 1. role เป็น manager, hr_manager, executive, admin, director
  if (['manager', 'hr_manager', 'executive', 'admin', 'director', 'owner'].includes(role)) return true;

  // 2. ชื่อตำแหน่ง/หน้าที่ มีคำว่า ผู้จัดการ, manager, ผจก, director, ผู้อำนวยการ, ผู้บริหาร
  return (
    pos.includes('ผู้จัดการ') ||
    pos.includes('manager') ||
    pos.includes('ผจก') ||
    pos.includes('ผู้อำนวยการ') ||
    pos.includes('director') ||
    pos.includes('head') ||
    pos.includes('chief') ||
    pos.includes('gm') ||
    pos.includes('รองผู้จัดการ') ||
    pos.includes('ผู้ช่วยผู้จัดการ') ||
    pos.includes('บริหาร') ||
    duty.includes('ผู้จัดการ') ||
    duty.includes('manager')
  );
}

function isExecutiveCandidate(emp) {
  if (!emp) return false;
  if (emp.status === 'resigned' || emp.status === 'inactive') return false;
  const role = (emp.role || "").toLowerCase();
  const pos = (emp.positions?.position_name || "").toLowerCase();

  if (['executive', 'director'].includes(role)) return true;

  if (
    pos.includes('ผู้บริหาร') ||
    pos.includes('executive') ||
    pos.includes('director') ||
    pos.includes('ผู้อำนวยการ') ||
    pos.includes('กรรมการ') ||
    pos.includes('managing') ||
    pos.includes('ceo') ||
    pos.includes('coo') ||
    pos.includes('cfo') ||
    pos.includes('cto') ||
    pos.includes('ประธาน') ||
    pos.includes('รองกรรมการ') ||
    pos.includes('chief') ||
    pos.includes('ผู้จัดการทั่วไป') ||
    pos.includes('gm')
  ) {
    return true;
  }

  return false;
}

function buildSupervisorOptions(departmentId, selectedId) {
  const targetId = String(departmentId || "");
  const dept = departments.find(d => String(d.id) === targetId);
  const deptName = dept?.department_name || "แผนก";

  // 1. คัดกรองเฉพาะพนักงานในแผนกนี้ที่เป็นระดับหัวหน้า (Leader) เพื่อยกไว้ด้านบน
  const inDeptEmployees = employees.filter(e => String(e.department_id) === targetId);
  const inDeptLeaders = inDeptEmployees.filter(isLeaderCandidate);

  // 2. ดึงหัวหน้าจากทุกแผนกทั้งหมด
  const allLeaders = employees.filter(isLeaderCandidate);

  let html = "";
  html += `<option value="">-- ไม่กำหนด / ข้ามขั้นตอน L1 (ส่งไป L2 หรือ HR) --</option>`;

  // แสดงกลุ่มหัวหน้าในแผนกตนเองก่อน
  if (inDeptLeaders.length > 0) {
    html += `<optgroup label="หัวหน้าสังกัดแผนก ${escapeHtml(deptName)}">`;
    inDeptLeaders.forEach(e => {
      const pos = e.positions?.position_name || e.role || "หัวหน้างาน";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos)}</option>`;
    });
    html += `</optgroup>`;
  }

  // 3. แสดงกลุ่มหัวหน้าจากแผนกอื่น
  const otherLeaders = allLeaders.filter(e => !inDeptLeaders.includes(e));
  if (otherLeaders.length > 0) {
    html += `<optgroup label="หัวหน้าจากแผนกอื่น">`;
    otherLeaders.forEach(e => {
      const pos = e.positions?.position_name || e.role || "หัวหน้างาน";
      const empDept = departments.find(d => String(d.id) === String(e.department_id));
      const deptLabel = empDept ? ` [แผนก ${empDept.department_name}]` : "";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos + deptLabel)}</option>`;
    });
    html += `</optgroup>`;
  }

  // กรณีมีหัวหน้าเดิมที่เคยผูกไว้ (ถ้าไม่ติดอยู่ในกลุ่มข้างต้น)
  if (selectedId && !allLeaders.some(e => String(e.id) === String(selectedId))) {
    const e = employees.find(x => String(x.id) === String(selectedId));
    if (e) {
      const pos = e.positions?.position_name || e.role || "หัวหน้างาน";
      const empDept = departments.find(d => String(d.id) === String(e.department_id));
      const deptLabel = empDept ? ` [แผนก ${empDept.department_name}]` : "";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}" selected>${escapeHtml(code + (e.full_name || "-") + " — " + pos + deptLabel + " (หัวหน้าเดิม)")}</option>`;
    }
  }

  return html;
}

function buildManagerOptions(departmentId, selectedId) {
  const targetId = String(departmentId || "");
  const dept = departments.find(d => String(d.id) === targetId);
  const deptName = dept?.department_name || "แผนก";

  // 1. คัดกรองเฉพาะพนักงานในแผนกนี้ที่เป็นระดับผู้จัดการ (Manager) เพื่อยกไว้ด้านบน
  const inDeptEmployees = employees.filter(e => String(e.department_id) === targetId);
  const inDeptManagers = inDeptEmployees.filter(isManagerCandidate);

  // 2. ดึงผู้จัดการจากทุกแผนกทั้งหมด
  const allManagers = employees.filter(isManagerCandidate);

  let html = "";
  html += `<option value="">-- ไม่มีผู้จัดการ (ส่งใบลาหาผู้บริหารโดยตรง) --</option>`;

  // แสดงกลุ่มผู้จัดการในแผนกตนเองก่อน
  if (inDeptManagers.length > 0) {
    html += `<optgroup label="ผู้จัดการสังกัดแผนก ${escapeHtml(deptName)}">`;
    inDeptManagers.forEach(e => {
      const pos = e.positions?.position_name || e.role || "ผู้จัดการ";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos)}</option>`;
    });
    html += `</optgroup>`;
  }

  // แสดงผู้จัดการจากแผนกอื่นๆ ทั้งหมด
  const otherManagers = allManagers.filter(e => String(e.department_id) !== targetId);
  if (otherManagers.length > 0) {
    html += `<optgroup label="ผู้จัดการแผนกอื่นๆ (สำหรับผู้จัดการที่คุมหลายแผนก)">`;
    otherManagers.forEach(e => {
      const pos = e.positions?.position_name || e.role || "ผู้จัดการ";
      const empDept = departments.find(d => String(d.id) === String(e.department_id));
      const deptLabel = empDept ? ` [แผนก ${empDept.department_name}]` : "";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos + deptLabel)}</option>`;
    });
    html += `</optgroup>`;
  }

  // กรณีมีผู้จัดการเดิมที่เคยผูกไว้ แต่หาไม่เจอในตัวเลือกด้านบน
  if (selectedId && !allManagers.some(e => String(e.id) === String(selectedId))) {
    const e = employees.find(x => String(x.id) === String(selectedId));
    if (e) {
      const pos = e.positions?.position_name || e.role || "ผู้จัดการ";
      const empDept = departments.find(d => String(d.id) === String(e.department_id));
      const deptLabel = empDept ? ` [แผนก ${empDept.department_name}]` : "";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos + deptLabel + " (ผู้จัดการเดิม)")}</option>`;
    }
  }

  return html;
}

function renderExecutiveOptions() {
  const el = document.getElementById("executiveSelect");
  if (!el) return;

  // คัดเฉพาะผู้บริหารระดับสูงเท่านั้น (Strict Executive Filtering)
  let candidates = employees.filter(isExecutiveCandidate);
  if (candidates.length === 0) {
    candidates = employees.filter(isManagerCandidate);
  }

  const options = candidates.map(e => {
    const position = e.positions?.position_name || e.role || "ผู้บริหาร";
    const code = e.employee_code ? `#${e.employee_code} · ` : "";
    return `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + position)}</option>`;
  }).join("");

  el.innerHTML = `<option value="">-- เลือกผู้บริหาร L3 (${candidates.length} ท่าน) --</option>${options}`;

  if (executiveSetting?.employee_id) {
    if (!candidates.some(e => String(e.id) === String(executiveSetting.employee_id))) {
      const selectedEmp = employees.find(e => String(e.id) === String(executiveSetting.employee_id));
      if (selectedEmp) {
        const position = selectedEmp.positions?.position_name || selectedEmp.role || "ผู้บริหาร";
        const code = selectedEmp.employee_code ? `#${selectedEmp.employee_code} · ` : "";
        el.insertAdjacentHTML('beforeend', `<option value="${escapeAttr(selectedEmp.id)}">${escapeHtml(code + (selectedEmp.full_name || "-") + " — " + position + " (เดิม)")}</option>`);
      }
    }
    el.value = executiveSetting.employee_id;
  }

  updateExecutiveLineStatus();
}

function updateExecutiveLineStatus() {
  const employeeId = document.getElementById("executiveSelect")?.value;
  const el = document.getElementById("executiveLine");
  if (!el) return;

  const emp = employees.find(e => String(e.id) === String(employeeId));

  if (!emp) {
    el.className = "hint";
    el.textContent = "LINE: -";
    return;
  }

  if (emp.line_id) {
    el.className = "hint line-ok";
    el.textContent = "● LINE User ID พร้อมใช้งาน";
  } else {
    el.className = "hint line-no";
    el.textContent = "● ยังไม่มี LINE User ID";
  }
}

async function saveExecutiveSetting() {
  const employeeId = document.getElementById("executiveSelect")?.value || null;

  if (!employeeId) {
    Swal.fire("ข้อมูลยังไม่ครบ", "กรุณาเลือกผู้บริหาร L3", "warning");
    return;
  }

  const btn = document.getElementById("saveExecutiveBtn");
  btn.disabled = true;
  btn.textContent = "กำลังบันทึก...";

  try {
    const { data, error } = await sb
      .from("system_settings")
      .upsert({
        setting_key: "leave_executive_approver",
        employee_id: employeeId,
        updated_at: new Date().toISOString()
      }, { onConflict: "setting_key" })
      .select()
      .single();

    if (error) throw error;

    // 🔄 ซิงค์ Role ในตาราง employees เพื่อสิทธิ์ผู้บริหาร
    if (employeeId) {
      sb.from("employees").update({ role: "executive" }).eq("id", employeeId).in("role", ["user", "leader", "manager"]).then(()=>{});
    }

    executiveSetting = data;
    updateExecutiveLineStatus();

    Swal.fire({
      icon: "success",
      title: "บันทึกแล้ว",
      text: "กำหนดผู้บริหารอนุมัติหลัก L3 เรียบร้อย",
      timer: 1600,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("saveExecutiveSetting:", err);
    Swal.fire("บันทึกไม่สำเร็จ", err.message || "กรุณาตรวจสอบสิทธิ์ RLS", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "บันทึกผู้บริหาร L3";
  }
}

function renderDepartmentOptions() {
  const el = document.getElementById("departmentSelect");
  el.innerHTML = `<option value="">-- เลือกแผนก --</option>` +
    departments.map(d => `<option value="${escapeAttr(d.id)}">${escapeHtml(d.department_name || "-")}</option>`).join("");
}

function handleDepartmentChange() {
  try {
    const deptSelect = document.getElementById("departmentSelect");
    if (!deptSelect) return;
    
    const departmentId = deptSelect.value;
    const sup = document.getElementById("supervisorSelect");
    const mgr = document.getElementById("managerSelect");
    const save = document.getElementById("saveApproverBtn");

    if (!departmentId) {
      if (sup) {
        sup.disabled = true;
        sup.innerHTML = `<option value="">-- กรุณาเลือกแผนกก่อน --</option>`;
      }
      if (mgr) {
        mgr.disabled = true;
        mgr.innerHTML = `<option value="">-- ไม่มี / ข้ามขั้นตอน L2 --</option>`;
      }
      if (save) save.disabled = true;
      updateLineStatus("supervisor");
      updateLineStatus("manager");
      return;
    }

    const current = approverMap.get(String(departmentId));
    const currentSupId = current?.supervisor_id || "";
    const currentMgrId = current?.manager_id || "";

    if (sup) {
      sup.innerHTML = buildSupervisorOptions(departmentId, currentSupId);
      if (currentSupId) sup.value = currentSupId;
      sup.disabled = false;
    }
    
    if (mgr) {
      mgr.innerHTML = buildManagerOptions(departmentId, currentMgrId);
      if (currentMgrId) mgr.value = currentMgrId;
      mgr.disabled = false;
    }

    if (save) save.disabled = false;
    updateLineStatus("supervisor");
    updateLineStatus("manager");
  } catch (err) {
    console.error("handleDepartmentChange Error:", err);
  }
}

function updateLineStatus(type) {
  const selectId = type === "supervisor" ? "supervisorSelect" : "managerSelect";
  const statusId = type === "supervisor" ? "supervisorLine" : "managerLine";
  const employeeId = document.getElementById(selectId)?.value;
  const el = document.getElementById(statusId);
  if (!el) return;

  const emp = employees.find(e => String(e.id) === String(employeeId));

  if (!emp) {
    el.className = "line-badge line-no";
    el.textContent = "ยังไม่มี LINE User ID";
    return;
  }

  if (emp.line_id) {
    el.className = "line-badge line-ok";
    el.textContent = "● LINE User ID พร้อมใช้งาน";
  } else {
    el.className = "line-badge line-no";
    el.textContent = "● ยังไม่มี LINE User ID";
  }
}

async function saveApprover() {
  const departmentId = document.getElementById("departmentSelect").value;
  const supervisorId = document.getElementById("supervisorSelect").value || null;
  const managerId = document.getElementById("managerSelect").value || null;

  if (!departmentId) return;
  if (!supervisorId && !managerId) {
    const confirmClear = await Swal.fire({
      title: "ข้ามทั้ง L1 และ L2?",
      text: "คุณไม่ได้เลือกทั้งหัวหน้า L1 และผู้จัดการ L2 คำขอใบลาของแผนกนี้จะถูกส่งไปที่ HR/ผู้บริหาร โดยตรง ต้องการบันทึกหรือไม่?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันบันทึก",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmClear.isConfirmed) return;
  }

  const btn = document.getElementById("saveApproverBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined">sync</span> กำลังบันทึก...';

  try {
    const { data, error } = await sb
      .from("department_approvers")
      .upsert({
        department_id: departmentId,
        supervisor_id: supervisorId,
        manager_id: managerId,
        updated_at: new Date().toISOString()
      }, { onConflict: "department_id" })
      .select()
      .single();

    if (error) throw error;

    // 🔄 ซิงค์ Role ในตาราง employees เพื่อความแม่นยำของสิทธิ์ระบบ
    if (supervisorId) {
      sb.from("employees").update({ role: "leader" }).eq("id", supervisorId).eq("role", "user").then(()=>{});
    }
    if (managerId) {
      sb.from("employees").update({ role: "manager" }).eq("id", managerId).in("role", ["user", "leader"]).then(()=>{});
    }

    approverMap.set(String(departmentId), data);
    await loadAllData();
    Swal.fire({ icon:"success", title:"บันทึกแล้ว", text:"ตั้งค่าสายอนุมัติของแผนกเรียบร้อย", timer:1600, showConfirmButton:false });
  } catch (err) {
    console.error("saveApprover:", err);
    Swal.fire("บันทึกไม่สำเร็จ", err.message || "กรุณาลองใหม่", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined">save</span> บันทึกสายอนุมัติแผนก';
  }
}

let currentSearchQuery = "";
let currentLineFilter = "all";

window.setLineStatusFilter = function(filter) {
  currentLineFilter = filter;
  document.querySelectorAll("#approverFilterTabs .filter-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-filter") === filter);
  });
  renderApproverTable();
};

window.filterApproverTable = function() {
  currentSearchQuery = (document.getElementById("deptSearchInput")?.value || "").trim().toLowerCase();
  renderApproverTable();
};

function updateLineSummaryStats() {
  const uniqueApproverIds = new Set();
  departments.forEach(dept => {
    const map = approverMap.get(String(dept.id));
    if (map?.supervisor_id) uniqueApproverIds.add(String(map.supervisor_id));
    if (map?.manager_id) uniqueApproverIds.add(String(map.manager_id));
  });
  if (executiveSetting?.employee_id) {
    uniqueApproverIds.add(String(executiveSetting.employee_id));
  }

  let connectedCount = 0;
  let notConnectedCount = 0;

  uniqueApproverIds.forEach(id => {
    const emp = employees.find(e => String(e.id) === String(id));
    if (emp && emp.line_id) {
      connectedCount++;
    } else {
      notConnectedCount++;
    }
  });

  const configuredDeptCount = Array.from(approverMap.values()).filter(m => m.supervisor_id || m.manager_id).length;

  const statConnected = document.getElementById("statConnectedCount");
  const statNotConnected = document.getElementById("statNotConnectedCount");
  const statConfiguredDept = document.getElementById("statConfiguredDeptCount");
  const statExecLine = document.getElementById("statExecutiveLineStatus");

  if (statConnected) statConnected.textContent = `${connectedCount} ท่าน`;
  if (statNotConnected) statNotConnected.textContent = `${notConnectedCount} ท่าน`;
  if (statConfiguredDept) statConfiguredDept.textContent = `${configuredDeptCount} / ${departments.length} แผนก`;

  if (statExecLine) {
    if (!executiveSetting?.employee_id) {
      statExecLine.innerHTML = '<span style="color:#94a3b8; font-size:16px;">ยังไม่ระบุ</span>';
    } else {
      const execEmp = employees.find(e => String(e.id) === String(executiveSetting.employee_id));
      if (execEmp?.line_id) {
        statExecLine.innerHTML = '<span style="color:#16a34a; font-size:16px; font-weight:700;">● เชื่อมต่อแล้ว</span>';
      } else {
        statExecLine.innerHTML = '<span style="color:#ea580c; font-size:16px; font-weight:700;">○ ยังไม่ผูก LINE</span>';
      }
    }
  }

  // ตัวนับสถานะของแต่ละตัวกรอง
  let countFull = 0;
  let countMissing = 0;
  let countNoApp = 0;

  departments.forEach(dept => {
    const map = approverMap.get(String(dept.id));
    const sup = employees.find(e => String(e.id) === String(map?.supervisor_id));
    const mgr = employees.find(e => String(e.id) === String(map?.manager_id));

    if (!sup && !mgr) {
      countNoApp++;
    } else {
      const supOk = sup ? Boolean(sup.line_id) : true;
      const mgrOk = mgr ? Boolean(mgr.line_id) : true;
      if (supOk && mgrOk && (sup || mgr)) {
        countFull++;
      } else {
        countMissing++;
      }
    }
  });

  const countAllEl = document.getElementById("countAllFilter");
  const countFullEl = document.getElementById("countLineFull");
  const countMissingEl = document.getElementById("countLineMissing");
  const countNoAppEl = document.getElementById("countNoApprover");

  if (countAllEl) countAllEl.textContent = departments.length;
  if (countFullEl) countFullEl.textContent = countFull;
  if (countMissingEl) countMissingEl.textContent = countMissing;
  if (countNoAppEl) countNoAppEl.textContent = countNoApp;
}

function renderApproverTable() {
  updateLineSummaryStats();

  const body = document.getElementById("approverTableBody");
  const countBadge = document.getElementById("tableCountBadge");
  if (!body) return;

  const validDepts = departments.filter(dept => {
    const map = approverMap.get(String(dept.id));
    const sup = employees.find(e => String(e.id) === String(map?.supervisor_id));
    const mgr = employees.find(e => String(e.id) === String(map?.manager_id));

    // ตรวจสอบตัวกรองสถานะ LINE
    if (currentLineFilter === "line_all_connected") {
      if (!sup && !mgr) return false;
      const supOk = sup ? Boolean(sup.line_id) : true;
      const mgrOk = mgr ? Boolean(mgr.line_id) : true;
      if (!(supOk && mgrOk)) return false;
    } else if (currentLineFilter === "line_missing") {
      if (!sup && !mgr) return false;
      const hasUnlinked = (sup && !sup.line_id) || (mgr && !mgr.line_id);
      if (!hasUnlinked) return false;
    } else if (currentLineFilter === "no_approver") {
      if (sup || mgr) return false;
    }

    // ตรวจสอบค้นหาข้อความ
    if (!currentSearchQuery) return true;
    const searchTarget = `${dept.department_name || ''} ${sup?.full_name || ''} ${mgr?.full_name || ''}`.toLowerCase();
    return searchTarget.includes(currentSearchQuery);
  });

  if (countBadge) {
    countBadge.textContent = `${validDepts.length} แผนก`;
  }

  const highlightMatch = (text, term) => {
    if (!term || !text) return escapeHtml(text || "");
    const cleanText = String(text);
    const idx = cleanText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return escapeHtml(cleanText);
    const before = escapeHtml(cleanText.slice(0, idx));
    const matched = escapeHtml(cleanText.slice(idx, idx + term.length));
    const after = escapeHtml(cleanText.slice(idx + term.length));
    return `${before}<mark class="text-highlight">${matched}</mark>${after}`;
  };

  const rows = validDepts.map(dept => {
    const map = approverMap.get(String(dept.id));
    const sup = employees.find(e => String(e.id) === String(map?.supervisor_id));
    const mgr = employees.find(e => String(e.id) === String(map?.manager_id));

    const supNameHtml = sup ? highlightMatch(sup.full_name, currentSearchQuery) : '';
    const mgrNameHtml = mgr ? highlightMatch(mgr.full_name, currentSearchQuery) : '';
    const deptNameHtml = highlightMatch(dept.department_name || "-", currentSearchQuery);

    const l1Display = sup 
      ? `<div class="approver-name">🎖️ ${supNameHtml}</div><div class="approver-pos">${escapeHtml(sup.positions?.position_name || 'หัวหน้างาน')}</div>` 
      : '<span style="color:#64748b; font-style:italic; font-size:13px;">⚡ ข้ามขั้นตอน L1 (ส่งไป L2 / HR)</span>';
    
    const l1Line = sup 
      ? (sup.line_id 
          ? `<span class="table-line-tag active" title="LINE ID: ${escapeAttr(sup.line_id)}">● LINE เชื่อมแล้ว</span>` 
          : `<span class="table-line-tag inactive" style="cursor:pointer;" onclick="createLineLinkCode('${escapeAttr(sup.id)}')" title="คลิกเพื่อสร้างรหัสผูก LINE">○ ยังไม่ผูก LINE <span class="material-symbols-outlined" style="font-size:12px;">link</span></span>`) 
      : '';
    
    const l2Display = mgr 
      ? `<div class="approver-name">👔 ${mgrNameHtml}</div><div class="approver-pos">${escapeHtml(mgr.positions?.position_name || 'ผู้จัดการฝ่าย')}</div>` 
      : '<span style="color:#64748b; font-style:italic; font-size:13px;">⚡ ข้ามขั้นตอน L2 (มีเฉพาะ L1)</span>';
    
    const l2Line = mgr 
      ? (mgr.line_id 
          ? `<span class="table-line-tag active" title="LINE ID: ${escapeAttr(mgr.line_id)}">● LINE เชื่อมแล้ว</span>` 
          : `<span class="table-line-tag inactive" style="cursor:pointer;" onclick="createLineLinkCode('${escapeAttr(mgr.id)}')" title="คลิกเพื่อสร้างรหัสผูก LINE">○ ยังไม่ผูก LINE <span class="material-symbols-outlined" style="font-size:12px;">link</span></span>`) 
      : '';

    return `<tr>
      <td>
        <div class="dept-title">
          <span class="dept-badge"><span class="material-symbols-outlined" style="font-size:16px;">domain</span></span>
          <span>${deptNameHtml}</span>
        </div>
      </td>
      <td>
        <div class="approver-cell">
          ${l1Display}
          ${l1Line}
        </div>
      </td>
      <td>
        <div class="approver-cell">
          ${l2Display}
          ${l2Line}
        </div>
      </td>
      <td style="text-align: center;">
        <div class="btn-action-group" style="justify-content: center;">
          <button type="button" class="btn-table-edit" onclick="editApprover('${escapeAttr(dept.id)}')">
            <span class="material-symbols-outlined" style="font-size:15px;">edit</span> ตั้งค่า
          </button>
          ${map ? `
            <button type="button" class="btn-table-delete" onclick="deleteApprover('${escapeAttr(dept.id)}')">
              <span class="material-symbols-outlined" style="font-size:15px;">delete</span> ล้าง
            </button>
          ` : ''}
        </div>
      </td>
    </tr>`;
  });

  body.innerHTML = rows.length ? rows.join("") :
    `<tr><td colspan="4" class="empty-state">
      <span class="material-symbols-outlined" style="font-size: 48px; color: #cbd5e1; margin-bottom: 8px;">search_off</span>
      <p style="margin:0; font-weight:600; font-size: 14.5px; color: #64748b;">ไม่พบข้อมูลสายอนุมัติที่ตรงกับการค้นหาหรือตัวกรอง</p>
    </td></tr>`;
}

window.editApprover = function(departmentId) {
  console.log("editApprover clicked for:", departmentId);
  try {
    const dept = departments.find(d => String(d.id) === String(departmentId));
    if (!dept) {
      console.warn("Department not found", departmentId);
      return;
    }

    // ตั้งค่าใน Form บนหน้าจอหลักด้วย
    const deptSelect = document.getElementById("departmentSelect");
    if (deptSelect) {
      deptSelect.value = departmentId;
      if (typeof handleDepartmentChange === "function") {
        handleDepartmentChange();
      }
    }

    // เปิด Modal เพื่อให้แก้ไขได้ทันทีโดยตรง
    openApproverModal(departmentId);
  } catch (err) {
    console.error("editApprover Error:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire("ข้อผิดพลาด", "ไม่สามารถเปิดหน้าต่างตั้งค่าได้", "error");
    }
  }
};

window.openApproverModal = function(departmentId) {
  // Logic from function openApproverModal moved directly here
  try {
    const dept = departments.find(d => String(d.id) === String(departmentId));
    if (!dept) return;

    const modal = document.getElementById("approverModalBackdrop");
    const modalDeptId = document.getElementById("modalDeptId");
    const modalDeptTitle = document.getElementById("modalDeptTitle");
    const supSelect = document.getElementById("modalSupervisorSelect");
    const mgrSelect = document.getElementById("modalManagerSelect");

    if (!modal || !supSelect || !mgrSelect || !modalDeptId || !modalDeptTitle) {
      console.warn("Modal elements missing", { modal, supSelect, mgrSelect, modalDeptId, modalDeptTitle });
      return;
    }

    modalDeptId.value = departmentId;
    modalDeptTitle.textContent = `ตั้งค่าสายอนุมัติ: ${dept.department_name || "แผนก"}`;

    const current = approverMap.get(String(departmentId));
    const currentSupId = current?.supervisor_id || "";
    const currentMgrId = current?.manager_id || "";

    // ใช้ตัวสร้าง Option คัดกรองตรงตามแผนก
    supSelect.innerHTML = buildSupervisorOptions(departmentId, currentSupId);
    mgrSelect.innerHTML = buildManagerOptions(departmentId, currentMgrId);

    if (currentSupId) supSelect.value = currentSupId;
    if (currentMgrId) mgrSelect.value = currentMgrId;

    if (typeof updateModalLineStatus === "function") {
      updateModalLineStatus("supervisor");
      updateModalLineStatus("manager");
    }

    modal.classList.add("show");
    
    // Re-init Tom Select for modal selects
    setTimeout(() => {
      initTomSelect();
    }, 100);
  } catch (err) {
    console.error("openApproverModal Error:", err);
  }
}

window.closeApproverModal = function(e) {
  if (e && e.target && e.target.id !== "approverModalBackdrop") return;
  const modal = document.getElementById("approverModalBackdrop");
  if (modal) modal.classList.remove("show");
};

window.updateModalLineStatus = function(type) {
  const selectId = type === "supervisor" ? "modalSupervisorSelect" : "modalManagerSelect";
  const statusId = type === "supervisor" ? "modalSupervisorLine" : "modalManagerLine";
  const employeeId = document.getElementById(selectId)?.value;
  const el = document.getElementById(statusId);
  if (!el) return;

  const emp = employees.find(e => String(e.id) === String(employeeId));
  if (!emp) {
    el.className = "line-badge line-no";
    el.textContent = "ยังไม่มี LINE User ID";
    return;
  }

  if (emp.line_id) {
    el.className = "line-badge line-ok";
    el.textContent = "● LINE User ID พร้อมใช้งาน";
  } else {
    el.className = "line-badge line-no";
    el.textContent = "● ยังไม่มี LINE User ID";
  }
};

window.saveApproverFromModal = async function() {
  const departmentId = document.getElementById("modalDeptId")?.value;
  const supervisorId = document.getElementById("modalSupervisorSelect")?.value || null;
  const managerId = document.getElementById("modalManagerSelect")?.value || null;

  if (!departmentId) {
    Swal.fire("ข้อผิดพลาด", "ไม่พบข้อมูลแผนก", "error");
    return;
  }

  if (!supervisorId && !managerId) {
    const confirmClear = await Swal.fire({
      title: "ข้ามทั้ง L1 และ L2?",
      text: "คุณไม่ได้เลือกทั้งหัวหน้า L1 และผู้จัดการ L2 คำขอใบลาของแผนกนี้จะถูกส่งไปที่ HR/ผู้บริหาร โดยตรง ต้องการบันทึกหรือไม่?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ยืนยันบันทึก",
      cancelButtonText: "ยกเลิก"
    });
    if (!confirmClear.isConfirmed) return;
  }

  const btn = document.getElementById("modalSaveBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined spinning-icon" style="font-size:18px;">sync</span> กำลังบันทึก...';

  try {
    const { data, error } = await sb
      .from("department_approvers")
      .upsert({
        department_id: departmentId,
        supervisor_id: supervisorId,
        manager_id: managerId,
        updated_at: new Date().toISOString()
      }, { onConflict: "department_id" })
      .select()
      .single();

    if (error) throw error;

    // ซิงค์ Role ใน employees เพื่อความถูกต้อง
    if (supervisorId) {
      sb.from("employees").update({ role: "leader" }).eq("id", supervisorId).eq("role", "user").then(()=>{});
    }
    if (managerId) {
      sb.from("employees").update({ role: "manager" }).eq("id", managerId).in("role", ["user", "leader"]).then(()=>{});
    }

    approverMap.set(String(departmentId), data);
    renderApproverTable();

    // ซิงค์ฟอร์มหลักถ้ากำลังเปิดแผนกเดียวกัน
    const mainDeptSelect = document.getElementById("departmentSelect");
    if (String(mainDeptSelect?.value) === String(departmentId)) {
      handleDepartmentChange();
    }

    const modal = document.getElementById("approverModalBackdrop");
    if (modal) modal.classList.remove("show");

    Swal.fire({
      icon: "success",
      title: "บันทึกเรียบร้อย",
      text: "บันทึกสายอนุมัติของแผนกสำเร็จ",
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("saveApproverFromModal:", err);
    Swal.fire("บันทึกไม่สำเร็จ", err.message || "กรุณาลองใหม่อีกครั้ง", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;">save</span> บันทึกการตั้งค่า';
  }
};

window.deleteApprover = async function(departmentId) {
  const dept = departments.find(d => String(d.id) === String(departmentId));
  const deptName = dept?.department_name || "แผนกนี้";
  const map = approverMap.get(String(departmentId));
  const supId = map?.supervisor_id;
  const mgrId = map?.manager_id;
  const sup = employees.find(e => String(e.id) === String(supId));
  const mgr = employees.find(e => String(e.id) === String(mgrId));

  let approverDetailsHtml = "";
  if (sup || mgr) {
    approverDetailsHtml = `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 12px 0; text-align: left; font-size: 13.5px; line-height: 1.6;">
        <div style="font-weight: 700; color: #b91c1c; margin-bottom: 4px;">
          ⚠️ รายการที่จะถูกล้างสายอนุมัติและปลดการผูก LINE ID:
        </div>
        ${sup ? `<div>• หัวหน้างาน L1: <b>${escapeHtml(sup.full_name)}</b> ${sup.line_id ? '<span style="color:#059669; font-weight:600;">(มี LINE ID ผูกอยู่ ➔ จะถูกล้างออก)</span>' : '<span style="color:#94a3b8;">(ยังไม่ได้ผูก LINE)</span>'}</div>` : ''}
        ${mgr ? `<div>• ผู้จัดการฝ่าย L2: <b>${escapeHtml(mgr.full_name)}</b> ${mgr.line_id ? '<span style="color:#059669; font-weight:600;">(มี LINE ID ผูกอยู่ ➔ จะถูกล้างออก)</span>' : '<span style="color:#94a3b8;">(ยังไม่ได้ผูก LINE)</span>'}</div>` : ''}
        <div style="margin-top: 6px; font-size: 12px; color: #7f1d1d; border-top: 1px dashed #fca5a5; padding-top: 4px;">
          📌 ระบบจะลบการตั้งค่าสายอนุมัติของแผนก และ<b>ล้างค่า LINE User ID ของหัวหน้างาน/ผู้จัดการฝ่าย</b>ออกจากระบบทันที
        </div>
      </div>
    `;
  }

  const result = await Swal.fire({
    title: "ล้างสายอนุมัติและ LINE ID?",
    html: `
      <div>ต้องการล้างสายอนุมัติของแผนก <b>${escapeHtml(deptName)}</b> ใช่หรือไม่?</div>
      ${approverDetailsHtml}
    `,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
    confirmButtonText: "🗑️ ยืนยันล้างข้อมูลและ LINE ID",
    cancelButtonText: "ยกเลิก"
  });

  if (!result.isConfirmed) return;

  const empIdsToClear = [supId, mgrId].filter(Boolean);

  try {
    // 1. เรียกผ่าน Server API (/api/clear-approver-line) เพื่อหลีกเลี่ยง RLS limitation
    let apiSuccess = false;
    try {
      const apiRes = await fetch("/api/clear-approver-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id: departmentId,
          employee_ids: empIdsToClear
        })
      });
      if (apiRes.ok) {
        apiSuccess = true;
      }
    } catch (apiErr) {
      console.warn("API /api/clear-approver-line warning:", apiErr);
    }

    // 2. ลบผ่าน Supabase Client Direct Fallback
    if (!apiSuccess && sb) {
      const { error: delErr } = await sb
        .from("department_approvers")
        .delete()
        .eq("department_id", departmentId);

      if (delErr) throw delErr;

      for (const empId of empIdsToClear) {
        await sb
          .from("employees")
          .update({ line_id: null })
          .eq("id", empId);

        try {
          await sb.from("line_link_tokens").delete().eq("employee_id", empId);
        } catch (tokErr) {}
      }
    }

    // 3. ปรับปรุง Local in-memory state
    approverMap.delete(String(departmentId));
    empIdsToClear.forEach(empId => {
      const emp = employees.find(e => String(e.id) === String(empId));
      if (emp) {
        emp.line_id = null;
      }
    });

    // 4. Render UI ใหม่
    renderApproverTable();
    renderEmployeeLineTable();
    updateLineSummaryStats();

    const deptSelect = document.getElementById("departmentSelect");
    if (String(deptSelect?.value) === String(departmentId)) {
      deptSelect.value = "";
      if (typeof handleDepartmentChange === "function") {
        handleDepartmentChange();
      }
    }

    Swal.fire({
      icon: "success",
      title: "ล้างข้อมูลสำเร็จ",
      html: `ล้างสายอนุมัติและ LINE ID ของ <b>${escapeHtml(deptName)}</b> เรียบร้อยแล้ว`,
      timer: 1800,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("deleteApprover error:", err);
    Swal.fire("ล้างข้อมูลไม่สำเร็จ", err.message || "เกิดข้อผิดพลาดในการล้างข้อมูล", "error");
  }
};


// ============================================================
// 🔗 LINE OA - สร้างรหัสเชื่อมบัญชี 6 หลัก
// ============================================================

window.createLineLinkCode = async function(employeeId) {
  try {
    const emp = employees.find(
      e => String(e.id) === String(employeeId)
    );

    if (!emp) {
      Swal.fire(
        "ไม่พบข้อมูล",
        "ไม่พบพนักงานที่ต้องการเชื่อม LINE",
        "warning"
      );
      return;
    }

    // ถ้ามี LINE ID อยู่แล้ว ให้ถามก่อนสร้างรหัสใหม่
    if (emp.line_id) {
      const confirm = await Swal.fire({
        icon: "question",
        title: "มี LINE เชื่อมอยู่แล้ว",
        html: `
          <b>${escapeHtml(emp.full_name || "-")}</b><br>
          มี LINE User ID อยู่ในระบบแล้ว<br><br>
          ต้องการสร้างรหัสเพื่อเชื่อม LINE ใหม่หรือไม่?
        `,
        showCancelButton: true,
        confirmButtonText: "สร้างรหัสใหม่",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#0f766e"
      });

      if (!confirm.isConfirmed) return;
    }

    let linkCode = "";
    let created = false;

    // 1. เรียกผ่าทาง Server API (/api/create-line-link) เพื่อหลีกเลี่ยง RLS Block
    try {
      const apiRes = await fetch("/api/create-line-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId })
      });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.success && apiData.token) {
          linkCode = apiData.token;
          created = true;
        }
      }
    } catch (apiErr) {
      console.warn("API /api/create-line-link error:", apiErr);
    }

    // 2. Fallback สุ่มรหัส 6 หลักหาก API ตอบกลับช้า
    if (!linkCode) {
      linkCode = String(Math.floor(100000 + Math.random() * 900000));
    }

    // ลองบันทึกลง DB เผื่อ DB RLS อนุญาต
    if (!created && sb) {
      try {
        await sb.from("line_link_tokens").delete().eq("employee_id", employeeId);
        await sb.from("line_link_tokens").insert({
          employee_id: employeeId,
          token: linkCode,
          link_code: linkCode,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        });
      } catch (dbErr) {
        // ละเว้น RLS error เพื่อไม่ให้การแสดงรหัสขัดข้อง
      }
    }

    // --------------------------------------------------------
    // แสดงรหัสให้ Admin พร้อมตัวเลือกระบุ LINE User ID โดยตรง
    // --------------------------------------------------------
    const resModal = await Swal.fire({
      icon: "success",
      title: "รหัสเชื่อม LINE",
      html: `
        <div style="font-size:14px;color:#64748b;">
          สำหรับพนักงาน
        </div>

        <div style="
          font-size:17px;
          font-weight:700;
          margin:5px 0 15px;
          color:#0f172a;
        ">
          ${escapeHtml(emp.full_name || "-")}
        </div>

        <div style="
          font-size:34px;
          font-weight:800;
          letter-spacing:8px;
          color:#0f766e;
          background:#f0fdfa;
          border:1px dashed #5eead4;
          border-radius:12px;
          padding:15px;
          margin:10px 0;
        ">
          ${linkCode}
        </div>

        <div style="
          margin-top:12px;
          font-size:13px;
          color:#64748b;
          line-height:1.7;
        ">
          ให้เจ้าของบัญชี Add LINE OA
          <b>ระบบใบลาออนไลน์</b><br>
          แล้วส่งรหัส <b>${linkCode}</b>
          ในแชต<br><br>

          ⏱ รหัสมีอายุ <b>15 นาที</b>
        </div>
      `,
      showDenyButton: true,
      denyButtonText: "✏️ กรอก LINE ID โดยตรง",
      denyButtonColor: "#475569",
      confirmButtonText: "เสร็จสิ้น",
      confirmButtonColor: "#0f766e"
    });

    if (resModal.isDenied) {
      const { value: inputLineId } = await Swal.fire({
        title: "ระบุ LINE User ID",
        input: "text",
        inputLabel: `สำหรับ ${emp.full_name}`,
        inputValue: emp.line_id || "",
        inputPlaceholder: "เช่น U1234567890abcdef...",
        showCancelButton: true,
        confirmButtonText: "บันทึก",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#0f766e"
      });

      if (inputLineId !== undefined) {
        const cleanId = inputLineId.trim();
        const { error: updErr } = await sb
          .from("employees")
          .update({ line_id: cleanId || null })
          .eq("id", employeeId);

        if (updErr) {
          Swal.fire("เกิดข้อผิดพลาด", updErr.message, "error");
        } else {
          emp.line_id = cleanId || null;
          Swal.fire({
            icon: "success",
            title: "บันทึก LINE ID สำเร็จ",
            text: `อัปเดต LINE ID ของ ${emp.full_name} เรียบร้อยแล้ว`,
            timer: 2000,
            showConfirmButton: false
          });
          if (typeof loadAllData === "function") loadAllData();
        }
      }
    }

  } catch (err) {

    console.error(
      "createLineLinkCode:",
      err
    );

    Swal.fire(
      "สร้างรหัสไม่สำเร็จ",
      err.message || "กรุณาลองใหม่",
      "error"
    );
  }
};







function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(value) { return escapeHtml(value); }

// ============================================================
// 🎛️ 3. ตั้งค่าการเปิด/ปิดแจ้งเตือน LINE รายขั้นตอน (Notification Steps)
// ============================================================

window.handleSwitchVisualChange = function(checkboxId) {
  const checkbox = document.getElementById(checkboxId);
  const row = document.getElementById(`row-${checkboxId}`);
  const tag = document.getElementById(`tag-${checkboxId}`);
  if (!checkbox) return;

  const isChecked = checkbox.checked;
  if (row) {
    if (isChecked) {
      row.classList.add("is-active");
      row.classList.remove("is-inactive");
    } else {
      row.classList.remove("is-active");
      row.classList.add("is-inactive");
    }
  }

  if (tag) {
    if (isChecked) {
      tag.textContent = "เปิด";
      tag.className = "switch-status-tag on";
    } else {
      tag.textContent = "ปิด";
      tag.className = "switch-status-tag off";
    }
  }
};

window.toggleAllLineNotifs = function(enable) {
  const ids = [
    "notif-new-request",
    "notif-new-request-l2",
    "notif-leader-approved",
    "notif-manager-approved",
    "notif-final-approved",
    "notif-rejected",
    "notif-cancellation"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.checked = Boolean(enable);
      handleSwitchVisualChange(id);
    }
  });
};

async function loadLineNotificationSettings() {
  try {
    const { data, error } = await sb
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "line_notification_settings")
      .maybeSingle();

    if (error) throw error;

    // Default values if no settings found
    const settings = data?.setting_value || {
      new_request: true,
      new_request_l2: true,
      leader_approved: true,
      manager_approved: true,
      final_approved: true,
      rejected: true,
      cancellation: true
    };

    // Set DOM checkbox states & visual classes
    const mapList = [
      { id: "notif-new-request", val: settings.new_request !== false },
      { id: "notif-new-request-l2", val: settings.new_request_l2 !== false },
      { id: "notif-leader-approved", val: settings.leader_approved !== false },
      { id: "notif-manager-approved", val: settings.manager_approved !== false },
      { id: "notif-final-approved", val: settings.final_approved !== false },
      { id: "notif-rejected", val: settings.rejected !== false },
      { id: "notif-cancellation", val: settings.cancellation !== false }
    ];

    mapList.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.checked = item.val;
        handleSwitchVisualChange(item.id);
      }
    });

  } catch (err) {
    console.error("loadLineNotificationSettings Error:", err);
  }
}

async function saveLineNotificationSettings() {
  const btn = document.getElementById("saveLineNotifSettingsBtn");
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined spinning-icon" style="font-size:18px;">sync</span> กำลังบันทึก...';
  }

  const settings = {
    new_request: document.getElementById("notif-new-request")?.checked ?? true,
    new_request_l2: document.getElementById("notif-new-request-l2")?.checked ?? true,
    leader_approved: document.getElementById("notif-leader-approved")?.checked ?? true,
    manager_approved: document.getElementById("notif-manager-approved")?.checked ?? true,
    final_approved: document.getElementById("notif-final-approved")?.checked ?? true,
    rejected: document.getElementById("notif-rejected")?.checked ?? true,
    cancellation: document.getElementById("notif-cancellation")?.checked ?? true,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await sb
      .from("system_settings")
      .upsert({
        setting_key: "line_notification_settings",
        setting_value: settings,
        updated_at: new Date().toISOString()
      }, { onConflict: "setting_key" });

    if (error) throw error;

    Swal.fire({
      icon: "success",
      title: "บันทึกเรียบร้อย",
      text: "อัปเดตสิทธิ์การแจ้งเตือน LINE รายขั้นตอนเรียบร้อยแล้ว",
      timer: 1600,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("saveLineNotificationSettings Error:", err);
    Swal.fire("ผิดพลาด", "ไม่สามารถบันทึกการตั้งค่าได้: " + err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml || '<span class="material-symbols-outlined" style="font-size: 18px;">save</span> บันทึกการตั้งค่าแจ้งเตือน LINE';
    }
  }
}

// ============================================================
// 📱 4. จัดการรายชื่อพนักงาน & ผู้บริหารที่ผูก LINE (สำหรับพนักงานลาออก / เปลี่ยนตำแหน่ง)
// ============================================================

let currentEmpLineFilter = "all"; // "all", "connected", "unconnected", "approvers"
let currentEmpLineSearch = "";

window.setEmpLineFilter = function(filterType) {
  currentEmpLineFilter = filterType;
  document.querySelectorAll("#empLineFilterTabs .filter-tab-btn").forEach(btn => {
    if (btn.dataset.empfilter === filterType) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  renderEmployeeLineTable();
};

window.filterEmployeeLineTable = function() {
  const input = document.getElementById("empLineSearchInput");
  currentEmpLineSearch = (input?.value || "").trim().toLowerCase();
  renderEmployeeLineTable();
};

window.copyLineId = function(lineId) {
  if (!lineId) return;
  navigator.clipboard.writeText(lineId).then(() => {
    if (typeof Swal !== "undefined") {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: false
      });
      Toast.fire({
        icon: 'success',
        title: 'คัดลอก LINE User ID แล้ว'
      });
    }
  }).catch(err => {
    console.error("Copy LINE ID failed:", err);
  });
};

function renderEmployeeLineTable() {
  const body = document.getElementById("employeeLineTableBody");
  const countBadge = document.getElementById("empLineCountBadge");
  const countAll = document.getElementById("empCountAll");
  const countConnected = document.getElementById("empCountConnected");
  const countUnconnected = document.getElementById("empCountUnconnected");
  const countApprovers = document.getElementById("empCountApprovers");

  // รวบรวม ID ของผู้ที่เป็นผู้อนุมัติในสายปัจจุบัน
  const activeApproverIds = new Set();
  departments.forEach(dept => {
    const map = approverMap.get(String(dept.id));
    if (map?.supervisor_id) activeApproverIds.add(String(map.supervisor_id));
    if (map?.manager_id) activeApproverIds.add(String(map.manager_id));
  });
  if (executiveSetting?.employee_id) {
    activeApproverIds.add(String(executiveSetting.employee_id));
  }

  // คำนวณตัวเลขสถิติบน Tabs
  const totalAll = employees.length;
  let totalConnected = 0;
  let totalUnconnected = 0;
  let totalApprovers = 0;

  employees.forEach(emp => {
    const hasLine = Boolean(emp.line_id && String(emp.line_id).trim() !== "");
    if (hasLine) totalConnected++;
    else totalUnconnected++;

    const isApp = activeApproverIds.has(String(emp.id)) || 
      ['executive', 'director', 'manager', 'leader', 'hr', 'admin'].includes((emp.role || '').toLowerCase()) ||
      isLeaderCandidate(emp) || isManagerCandidate(emp) || isExecutiveCandidate(emp);
    if (isApp) totalApprovers++;
  });

  if (countAll) countAll.textContent = totalAll;
  if (countConnected) countConnected.textContent = totalConnected;
  if (countUnconnected) countUnconnected.textContent = totalUnconnected;
  if (countApprovers) countApprovers.textContent = totalApprovers;

  if (!body) return;

  // กรองรายชื่อตาม Tab และคำค้นหา
  const filtered = employees.filter(emp => {
    const hasLine = Boolean(emp.line_id && String(emp.line_id).trim() !== "");
    const isApp = activeApproverIds.has(String(emp.id)) || 
      ['executive', 'director', 'manager', 'leader', 'hr', 'admin'].includes((emp.role || '').toLowerCase()) ||
      isLeaderCandidate(emp) || isManagerCandidate(emp) || isExecutiveCandidate(emp);

    // ตัวกรองแท็บ
    if (currentEmpLineFilter === "connected" && !hasLine) return false;
    if (currentEmpLineFilter === "unconnected" && hasLine) return false;
    if (currentEmpLineFilter === "approvers" && !isApp) return false;

    // คำค้นหา
    if (currentEmpLineSearch) {
      const dept = departments.find(d => String(d.id) === String(emp.department_id));
      const deptName = dept?.department_name || emp.departments?.department_name || "";
      const posName = emp.positions?.position_name || "";
      const searchTarget = `${emp.full_name || ''} ${emp.nickname || ''} ${emp.employee_code || ''} ${deptName} ${posName} ${emp.line_id || ''} ${emp.role || ''}`.toLowerCase();
      if (!searchTarget.includes(currentEmpLineSearch)) return false;
    }

    return true;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} คน`;
  }

  if (filtered.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <span class="material-symbols-outlined" style="font-size: 48px; color: #cbd5e1; margin-bottom: 8px;">person_search</span>
          <p style="margin:0; font-weight:600; font-size: 14.5px; color: #64748b;">ไม่พบรายชื่อพนักงานที่ตรงกับเงื่อนไขการค้นหาหรือตัวกรอง</p>
        </td>
      </tr>
    `;
    return;
  }

  const highlightMatch = (text, term) => {
    if (!term || !text) return escapeHtml(text || "");
    const cleanText = String(text);
    const idx = cleanText.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return escapeHtml(cleanText);
    const before = escapeHtml(cleanText.slice(0, idx));
    const matched = escapeHtml(cleanText.slice(idx, idx + term.length));
    const after = escapeHtml(cleanText.slice(idx + term.length));
    return `${before}<mark class="text-highlight">${matched}</mark>${after}`;
  };

  const rows = filtered.map(emp => {
    const dept = departments.find(d => String(d.id) === String(emp.department_id));
    const deptName = dept?.department_name || emp.departments?.department_name || "ไม่ระบุแผนก";
    const posName = emp.positions?.position_name || "พนักงาน";
    const hasLine = Boolean(emp.line_id && String(emp.line_id).trim() !== "");
    const isResigned = emp.status === "resigned" || emp.status === "inactive";

    const empNameHtml = highlightMatch(emp.full_name || "-", currentEmpLineSearch);
    const empNicknameHtml = emp.nickname ? highlightMatch(emp.nickname, currentEmpLineSearch) : '';
    const empCodeHtml = highlightMatch(emp.employee_code || '-', currentEmpLineSearch);
    const deptNameHtml = highlightMatch(deptName, currentEmpLineSearch);
    const posNameHtml = highlightMatch(posName, currentEmpLineSearch);

    // อวาตาร์
    let avatarContent = "";
    if (emp.image_url) {
      avatarContent = `<img src="${escapeAttr(emp.image_url)}" class="emp-avatar-img" alt="${escapeAttr(emp.full_name)}" onerror="this.parentElement.innerHTML='${escapeHtml(emp.full_name?.substring(0,2) || 'EM')}'">`;
    } else {
      const initials = (emp.full_name || "EM").substring(0, 2).toUpperCase();
      avatarContent = escapeHtml(initials);
    }

    // บทบาทหลักในระบบ (Role)
    const role = (emp.role || "user").toLowerCase();
    let roleBadgeHtml = "";
    if (role === "executive" || role === "director") {
      roleBadgeHtml = `<span class="role-badge-tag exec">👑 ผู้บริหารระดับสูง</span>`;
    } else if (role === "manager") {
      roleBadgeHtml = `<span class="role-badge-tag mgr">👔 ผู้จัดการฝ่าย</span>`;
    } else if (role === "leader") {
      roleBadgeHtml = `<span class="role-badge-tag sup">🎖️ หัวหน้างาน</span>`;
    } else if (role === "hr" || role === "admin") {
      roleBadgeHtml = `<span class="role-badge-tag hr">🛡️ HR / ผู้ดูแลระบบ</span>`;
    } else {
      roleBadgeHtml = `<span class="role-badge-tag staff">👤 พนักงานทั่วไป</span>`;
    }

    // บทบาทในสายอนุมัติจริง (Workflow Assignments)
    const assignedDeptsL1 = [];
    const assignedDeptsL2 = [];
    departments.forEach(d => {
      const map = approverMap.get(String(d.id));
      if (String(map?.supervisor_id) === String(emp.id)) assignedDeptsL1.push(d.department_name);
      if (String(map?.manager_id) === String(emp.id)) assignedDeptsL2.push(d.department_name);
    });
    const isExecL3 = executiveSetting?.employee_id && String(executiveSetting.employee_id) === String(emp.id);

    let workflowTags = "";
    if (isExecL3) {
      workflowTags += `<div style="margin-top:3px;"><span style="font-size:10.5px; background:#fef3c7; color:#92400e; padding:1px 6px; border-radius:4px; font-weight:700; border:1px solid #fde68a;">👑 ผู้อนุมัติ L3 (ผู้บริหาร)</span></div>`;
    }
    if (assignedDeptsL1.length > 0) {
      workflowTags += `<div style="margin-top:2px;"><span style="font-size:10.5px; background:#ccfbf1; color:#0f766e; padding:1px 6px; border-radius:4px; font-weight:700; border:1px solid #99f6e4;" title="${escapeAttr(assignedDeptsL1.join(', '))}">🎖️ ผู้อนุมัติ L1 (${escapeHtml(assignedDeptsL1[0])}${assignedDeptsL1.length > 1 ? ` +${assignedDeptsL1.length - 1}` : ''})</span></div>`;
    }
    if (assignedDeptsL2.length > 0) {
      workflowTags += `<div style="margin-top:2px;"><span style="font-size:10.5px; background:#e0e7ff; color:#4338ca; padding:1px 6px; border-radius:4px; font-weight:700; border:1px solid #c7d2fe;" title="${escapeAttr(assignedDeptsL2.join(', '))}">👔 ผู้อนุมัติ L2 (${escapeHtml(assignedDeptsL2[0])}${assignedDeptsL2.length > 1 ? ` +${assignedDeptsL2.length - 1}` : ''})</span></div>`;
    }

    // สถานะ LINE & รหัส User ID
    let lineDisplayHtml = "";
    if (hasLine) {
      lineDisplayHtml = `
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <span class="line-status-chip connected">
            <span style="font-size: 8px;">●</span> เชื่อมต่อ LINE แล้ว
          </span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="line-id-val" title="${escapeAttr(emp.line_id)}">${escapeHtml(emp.line_id.length > 16 ? emp.line_id.substring(0, 15) + '...' : emp.line_id)}</span>
            <button type="button" onclick="copyLineId('${escapeAttr(emp.line_id)}')" title="คัดลอก LINE User ID" style="background:none; border:none; cursor:pointer; color:#64748b; padding:2px; display:inline-flex; align-items:center;">
              <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>
            </button>
          </div>
        </div>
      `;
    } else {
      lineDisplayHtml = `
        <span class="line-status-chip unconnected">
          <span style="font-size: 8px;">○</span> ยังไม่เชื่อมต่อ
        </span>
      `;
    }

    // ปุ่มการจัดการ LINE ID
    let actionButtonsHtml = "";
    if (hasLine) {
      actionButtonsHtml = `
        <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
          <button type="button" class="btn-unlink-line" onclick="unlinkEmployeeLine('${escapeAttr(emp.id)}', '${escapeAttr(emp.full_name)}')" title="ลบช่อง line_id ใน employees (สำหรับคนลาออก หรือเปลี่ยนตำแหน่ง)">
            <span class="material-symbols-outlined" style="font-size: 14px;">link_off</span> ล้าง LINE ID
          </button>
          <button type="button" class="btn-link-line" onclick="createLineLinkCode('${escapeAttr(emp.id)}')" title="สร้างรหัสผูกบัญชีใหม่" style="font-size:11px; padding:3px 8px;">
            <span class="material-symbols-outlined" style="font-size: 13px;">sync</span> สร้างรหัสใหม่
          </button>
        </div>
      `;
    } else {
      actionButtonsHtml = `
        <div style="display:flex; justify-content:center;">
          <button type="button" class="btn-link-line" onclick="createLineLinkCode('${escapeAttr(emp.id)}')" title="สร้างรหัส 6 หลักเพื่อส่งให้พนักงานผูก LINE">
            <span class="material-symbols-outlined" style="font-size: 14px;">link</span> สร้างรหัสผูก LINE
          </button>
        </div>
      `;
    }

    return `
      <tr style="${isResigned ? 'background: #fff8f8;' : ''}">
        <td>
          <div class="emp-cell-user">
            <div class="emp-avatar-badge" style="${isResigned ? 'background:#fee2e2; color:#b91c1c; border-color:#fca5a5;' : ''}">
              ${avatarContent}
            </div>
            <div class="emp-detail-col">
              <div class="emp-name-text">
                ${empNameHtml}
                ${emp.nickname ? `<span style="font-weight:400; color:#64748b; font-size:12px;">(${empNicknameHtml})</span>` : ''}
              </div>
              <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                <span class="emp-code-badge">#${empCodeHtml}</span>
                ${isResigned 
                  ? `<span style="background:#fee2e2; color:#b91c1c; font-size:10.5px; font-weight:700; padding:1px 6px; border-radius:4px; border:1px solid #fca5a5;">⚠️ ลาออกแล้ว</span>` 
                  : `<span style="background:#f0fdf4; color:#15803d; font-size:10.5px; font-weight:600; padding:1px 6px; border-radius:4px;">ปกติ</span>`
                }
              </div>
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="font-weight:600; color:#1e293b; font-size:13px; display:flex; align-items:center; gap:4px;">
              <span class="material-symbols-outlined" style="font-size:14px; color:#64748b;">domain</span>
              <span>${deptNameHtml}</span>
            </div>
            <div style="font-size:12px; color:#64748b; margin-left:18px;">
              ${posNameHtml}
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:2px;">
            ${roleBadgeHtml}
            ${workflowTags}
          </div>
        </td>
        <td>
          ${lineDisplayHtml}
        </td>
        <td style="text-align: center;">
          ${actionButtonsHtml}
        </td>
      </tr>
    `;
  });

  body.innerHTML = rows.join("");
}

window.unlinkEmployeeLine = async function(employeeId, employeeName) {
  const emp = employees.find(e => String(e.id) === String(employeeId));
  const name = employeeName || emp?.full_name || "พนักงานท่านนี้";
  const code = emp?.employee_code ? `(#${emp.employee_code})` : "";
  const isResigned = emp?.status === "resigned" || emp?.status === "inactive";

  const result = await Swal.fire({
    title: "ยืนยันล้าง LINE ID?",
    html: `
      <div style="text-align: center; margin-bottom: 12px;">
        คุณต้องการลบและยกเลิกการเชื่อมต่อ LINE ของ<br>
        <b style="font-size: 16px; color: #0f172a;">${escapeHtml(name)} ${escapeHtml(code)}</b> ใช่หรือไม่?
      </div>
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; font-size: 13px; color: #991b1b; text-align: left; line-height: 1.6;">
        <div style="font-weight: 700; margin-bottom: 4px;">📌 ผลของการล้าง LINE ID:</div>
        <div>• ระบบจะลบค่าในช่อง <b>line_id</b> ของตาราง <code>employees</code> เป็นค่าว่าง (null) ทันที</div>
        <div>• พนักงานจะไม่ได้รับการแจ้งเตือนใบลาผ่าน LINE อีกต่อไป (เหมาะสำหรับ<b>พนักงานที่ลาออก หรือเปลี่ยนตำแหน่งงาน</b>)</div>
        ${isResigned ? '<div style="color: #b91c1c; font-weight: 700; margin-top: 4px;">⚠️ พนักงานท่านนี้มีสถานะลาออกแล้ว การล้าง LINE ID จะช่วยป้องกันไม่ให้ระบบส่งข้อมูลของบริษัทไปยัง LINE ส่วนตัว</div>' : ''}
      </div>
    `,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
    confirmButtonText: "🗑️ ยืนยันลบช่อง LINE ID",
    cancelButtonText: "ยกเลิก"
  });

  if (!result.isConfirmed) return;

  // Show loading dialog
  Swal.fire({
    title: "กำลังล้าง LINE ID...",
    text: "กำลังอัปเดตฐานข้อมูล employees...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    // 1. เรียกผ่าน Server API /api/clear-approver-line
    let apiSuccess = false;
    try {
      const res = await fetch("/api/clear-approver-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_ids: [employeeId] })
      });
      if (res.ok) {
        apiSuccess = true;
      }
    } catch (apiErr) {
      console.warn("API /api/clear-approver-line warning:", apiErr);
    }

    // 2. Direct Supabase Fallback เพื่อให้แน่ใจว่า line_id = null 100%
    if (sb) {
      const { error: updErr } = await sb
        .from("employees")
        .update({ line_id: null })
        .eq("id", employeeId);

      if (updErr && !apiSuccess) throw updErr;

      try {
        await sb.from("line_link_tokens").delete().eq("employee_id", employeeId);
      } catch (tokErr) {}
    }

    // 3. ปรับปรุง local in-memory state
    if (emp) {
      emp.line_id = null;
    }

    // 4. Re-render UI ทุกส่วนที่เกี่ยวข้อง
    renderEmployeeLineTable();
    renderApproverTable();
    updateLineSummaryStats();
    updateExecutiveLineStatus();
    updateLineStatus("supervisor");
    updateLineStatus("manager");

    Swal.fire({
      icon: "success",
      title: "ล้าง LINE ID สำเร็จ",
      html: `ลบช่อง <b>line_id</b> ใน employees ของ <b>${escapeHtml(name)}</b> เรียบร้อยแล้ว`,
      timer: 2000,
      showConfirmButton: false
    });

  } catch (err) {
    console.error("unlinkEmployeeLine error:", err);
    Swal.fire("ไม่สำเร็จ", err.message || "เกิดข้อผิดพลาดในการล้าง LINE ID", "error");
  }
};

// ============================================================
// 🎯 3. ตั้งค่าสายอนุมัติรายบุคคล (Individual Override Logic)
// ============================================================

function renderIndividualEmployeeOptions() {
  const el = document.getElementById("individualEmployeeSelect");
  if (!el) return;

  const options = employees
    .filter(e => e.status !== "resigned")
    .map(e => {
      const dept = e.departments?.department_name || "ไม่ระบุแผนก";
      const pos = e.positions?.position_name || e.role || "พนักงาน";
      const code = e.employee_code ? `#${e.employee_code} ` : "";
      return `<option value="${escapeAttr(e.id)}">${escapeHtml(code + e.full_name + " (" + pos + " - " + dept + ")")}</option>`;
    }).join("");

  el.innerHTML = `<option value="">-- ค้นหา/เลือกพนักงาน --</option>${options}`;

  // Populate Approver Selects (Reuse logic)
  const l1El = document.getElementById("individualL1Select");
  const l2El = document.getElementById("individualL2Select");

  if (l1El) l1El.innerHTML = buildSupervisorOptions(null, null); // Load all possible leaders
  if (l2El) l2El.innerHTML = buildManagerOptions(null, null);    // Load all possible managers
}

function handleIndividualEmployeeChange() {
  const employeeId = document.getElementById("individualEmployeeSelect")?.value;
  const statusEl = document.getElementById("individualCurrentStatus");
  const l1Select = document.getElementById("individualL1Select");
  const l2Select = document.getElementById("individualL2Select");

  if (!employeeId || !statusEl) {
    if (statusEl) statusEl.textContent = "กรุณาเลือกพนักงานเพื่อดูสายอนุมัติปัจจุบัน";
    return;
  }

  const emp = employees.find(e => String(e.id) === String(employeeId));
  if (!emp) return;

  // 1. Get Department Default Approvers
  const deptMap = approverMap.get(String(emp.department_id));
  const deptL1 = employees.find(e => String(e.id) === String(deptMap?.supervisor_id));
  const deptL2 = employees.find(e => String(e.id) === String(deptMap?.manager_id));

  // 2. Build Status Text
  let statusHtml = `<div style="line-height: 1.6;">`;
  statusHtml += `<b>🏢 แผนกหลัก:</b> ${escapeHtml(emp.departments?.department_name || "ไม่ระบุ")}<br>`;
  
  if (emp.l1_approver_id || emp.l2_approver_id) {
    statusHtml += `<span style="color: var(--accent-purple); font-weight: 700;">✨ มีการตั้งค่ารายบุคคล (Override)</span><br>`;
  } else {
    statusHtml += `<span style="color: #64748b;">📂 ใช้ตามสายอนุมัติแผนก</span><br>`;
  }

  statusHtml += `<b>L1:</b> ${escapeHtml(deptL1?.full_name || "ไม่มี")} (ตามแผนก)<br>`;
  statusHtml += `<b>L2:</b> ${escapeHtml(deptL2?.full_name || "ไม่มี")} (ตามแผนก)`;
  statusHtml += `</div>`;
  
  statusEl.innerHTML = statusHtml;

  // 3. Set Values in Selects
  if (l1Select) l1Select.value = emp.l1_approver_id || "";
  if (l2Select) l2Select.value = emp.l2_approver_id || "";
}

async function saveIndividualApprover() {
  const employeeId = document.getElementById("individualEmployeeSelect")?.value;
  const l1Id = document.getElementById("individualL1Select")?.value || null;
  const l2Id = document.getElementById("individualL2Select")?.value || null;

  if (!employeeId) {
    Swal.fire("แจ้งเตือน", "กรุณาเลือกพนักงานที่ต้องการตั้งค่า", "warning");
    return;
  }

  const btn = document.getElementById("btnSaveIndividual");
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="material-symbols-outlined spinning-icon">sync</span> กำลังบันทึก...';

  try {
    const { error } = await sb
      .from("employees")
      .update({
        l1_approver_id: l1Id,
        l2_approver_id: l2Id,
        updated_at: new Date().toISOString()
      })
      .eq("id", employeeId);

    if (error) throw error;

    // Update local state
    const empIdx = employees.findIndex(e => String(e.id) === String(employeeId));
    if (empIdx !== -1) {
      employees[empIdx].l1_approver_id = l1Id;
      employees[empIdx].l2_approver_id = l2Id;
    }

    Swal.fire({
      icon: "success",
      title: "บันทึกสำเร็จ",
      text: "ตั้งค่าสายอนุมัติรายบุคคลเรียบร้อยแล้ว",
      timer: 2000,
      showConfirmButton: false
    });
    
    handleIndividualEmployeeChange(); // Refresh status text
  } catch (err) {
    console.error("saveIndividualApprover Error:", err);
    Swal.fire("เกิดข้อผิดพลาด", "ไม่สามารถบันทึกได้: " + err.message + "\n\n(หากเกิดข้อผิดพลาดเกี่ยวกับ Column กรุณารัน SQL ตามคู่มือ)", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

/**
 * 🔍 Initialize Tom Select for all searchable dropdowns
 * Allows searching by Code, Name, Position, Department
 */
function initTomSelect() {
  if (typeof TomSelect === "undefined") {
    console.warn("TomSelect library not loaded");
    return;
  }

  const selects = [
    '#departmentSelect',
    '#individualEmployeeSelect',
    '#individualL1Select',
    '#individualL2Select',
    '#modalSupervisorSelect',
    '#modalManagerSelect',
    '#executiveSelect'
  ];

  selects.forEach(id => {
    const el = document.querySelector(id);
    if (el) {
      // Destroy existing instance if any
      if (el.tomselect) {
        el.tomselect.destroy();
      }
      
      // Initialize new instance
      try {
        new TomSelect(id, {
          create: false,
          sortField: {
            field: "text",
            direction: "asc"
          },
          placeholder: el.getAttribute('placeholder') || 'พิมพ์เพื่อค้นหา...',
          allowEmptyOption: true,
          maxOptions: 2000, // Show more options for large employee lists
          plugins: ['dropdown_input'], // Better mobile search experience
          onInitialize: function() {
            // Optional: fine-tune styling after initialization
          }
        });
      } catch (err) {
        console.error(`Error initializing Tom Select for ${id}:`, err);
      }
    }
  });
}
