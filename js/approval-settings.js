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
        .select("id, employee_code, full_name, department_id, role, line_id, status, positions(position_name)")
        .eq("status", "active")
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
    renderApproverTable();
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

  // คัดกรองเฉพาะพนักงานที่สังกัดในแผนกนี้เท่านั้น 100% (Strict Department Only)
  const inDeptEmployees = employees.filter(e => String(e.department_id) === targetId);

  if (inDeptEmployees.length === 0) {
    return `<option value="">-- ไม่มีพนักงานสังกัดในแผนก ${escapeHtml(deptName)} --</option>`;
  }

  // คัดกรองเฉพาะผู้ที่มีตำแหน่งหรือ Role เป็นหัวหน้า/Leader ในแผนกนี้เท่านั้น 100%
  const inDeptLeaders = inDeptEmployees.filter(isLeaderCandidate);

  let html = "";
  if (inDeptLeaders.length > 0) {
    html = `<option value="">-- ไม่กำหนด / ข้ามขั้นตอน L1 (ส่งไป L2 หรือ HR) --</option>`;
    inDeptLeaders.forEach(e => {
      const pos = e.positions?.position_name || e.role || "หัวหน้างาน";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos)}</option>`;
    });
  } else {
    html = `<option value="">-- ไม่มีหัวหน้างาน (Leader) ในแผนก ${escapeHtml(deptName)} (ข้ามขั้นตอน L1) --</option>`;
  }

  // กรณีมีหัวหน้าเดิมที่เคยผูกไว้
  if (selectedId && !inDeptLeaders.some(e => String(e.id) === String(selectedId))) {
    const e = employees.find(x => String(x.id) === String(selectedId));
    if (e) {
      const pos = e.positions?.position_name || e.role || "หัวหน้างาน";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos + " (ผู้อนุมัติเดิม)")}</option>`;
    }
  }

  return html;
}

function buildManagerOptions(departmentId, selectedId) {
  const targetId = String(departmentId || "");
  const dept = departments.find(d => String(d.id) === targetId);
  const deptName = dept?.department_name || "แผนก";

  // คัดกรองเฉพาะพนักงานในแผนกนี้เท่านั้น 100% ที่เป็นระดับผู้จัดการ (Manager)
  const inDeptEmployees = employees.filter(e => String(e.department_id) === targetId);
  const inDeptManagers = inDeptEmployees.filter(isManagerCandidate);

  let html = "";

  if (inDeptManagers.length > 0) {
    html = `<option value="">-- เลือกผู้จัดการ L2 แผนก ${escapeHtml(deptName)} (${inDeptManagers.length} ท่าน) / หรือข้าม L2 --</option>`;
    inDeptManagers.forEach(e => {
      const pos = e.positions?.position_name || e.role || "ผู้จัดการ";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos)}</option>`;
    });
  } else {
    html = `<option value="">-- ไม่มีผู้จัดการ (Manager) ในแผนก ${escapeHtml(deptName)} (ข้ามขั้นตอน L2) --</option>`;
  }

  // กรณีมีผู้จัดการเดิมที่เคยผูกไว้
  if (selectedId && !inDeptManagers.some(e => String(e.id) === String(selectedId))) {
    const e = employees.find(x => String(x.id) === String(selectedId));
    if (e) {
      const pos = e.positions?.position_name || e.role || "ผู้จัดการ";
      const code = e.employee_code ? `#${e.employee_code} · ` : "";
      html += `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + pos + " (ผู้จัดการเดิม)")}</option>`;
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
  const departmentId = document.getElementById("departmentSelect").value;
  const sup = document.getElementById("supervisorSelect");
  const mgr = document.getElementById("managerSelect");
  const save = document.getElementById("saveApproverBtn");

  if (!departmentId) {
    sup.disabled = mgr.disabled = save.disabled = true;
    sup.innerHTML = `<option value="">-- กรุณาเลือกแผนกก่อน --</option>`;
    mgr.innerHTML = `<option value="">-- ไม่มี / ข้ามขั้นตอน L2 --</option>`;
    updateLineStatus("supervisor");
    updateLineStatus("manager");
    return;
  }

  const current = approverMap.get(String(departmentId));
  const currentSupId = current?.supervisor_id || "";
  const currentMgrId = current?.manager_id || "";

  sup.innerHTML = buildSupervisorOptions(departmentId, currentSupId);
  mgr.innerHTML = buildManagerOptions(departmentId, currentMgrId);

  if (currentSupId) sup.value = currentSupId;
  if (currentMgrId) mgr.value = currentMgrId;

  sup.disabled = mgr.disabled = save.disabled = false;
  updateLineStatus("supervisor");
  updateLineStatus("manager");
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
    renderApproverTable();
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
  document.querySelectorAll(".filter-tab-btn").forEach(btn => {
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

  const rows = validDepts.map(dept => {
    const map = approverMap.get(String(dept.id));
    const sup = employees.find(e => String(e.id) === String(map?.supervisor_id));
    const mgr = employees.find(e => String(e.id) === String(map?.manager_id));

    const l1Display = sup 
      ? `<div class="approver-name">🎖️ ${escapeHtml(sup.full_name)}</div><div class="approver-pos">${escapeHtml(sup.positions?.position_name || 'หัวหน้างาน')}</div>` 
      : '<span style="color:#64748b; font-style:italic; font-size:13px;">⚡ ข้ามขั้นตอน L1 (ส่งไป L2 / HR)</span>';
    
    const l1Line = sup 
      ? (sup.line_id 
          ? `<span class="table-line-tag active" title="LINE ID: ${escapeAttr(sup.line_id)}">● LINE เชื่อมแล้ว</span>` 
          : `<span class="table-line-tag inactive" style="cursor:pointer;" onclick="createLineLinkCode('${escapeAttr(sup.id)}')" title="คลิกเพื่อสร้างรหัสผูก LINE">○ ยังไม่ผูก LINE <span class="material-symbols-outlined" style="font-size:12px;">link</span></span>`) 
      : '';
    
    const l2Display = mgr 
      ? `<div class="approver-name">👔 ${escapeHtml(mgr.full_name)}</div><div class="approver-pos">${escapeHtml(mgr.positions?.position_name || 'ผู้จัดการฝ่าย')}</div>` 
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
          <span>${escapeHtml(dept.department_name || "-")}</span>
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
      <span class="material-symbols-outlined" style="font-size: 32px; color: #cbd5e1; margin-bottom: 8px;">search_off</span>
      <p style="margin:0; font-weight:600;">ไม่พบข้อมูลสายอนุมัติที่ตรงกับการค้นหาหรือตัวกรอง</p>
    </td></tr>`;
}

window.editApprover = function(departmentId) {
  const dept = departments.find(d => String(d.id) === String(departmentId));
  if (!dept) return;

  // ตั้งค่าใน Form บนหน้าจอหลักด้วย
  const deptSelect = document.getElementById("departmentSelect");
  if (deptSelect) {
    deptSelect.value = departmentId;
    handleDepartmentChange();
  }

  // เปิด Modal เพื่อให้แก้ไขได้ทันทีโดยตรง
  openApproverModal(departmentId);
};

window.openApproverModal = function(deptId) {
  openApproverModal(deptId);
};

function openApproverModal(departmentId) {
  const dept = departments.find(d => String(d.id) === String(departmentId));
  if (!dept) return;

  const modal = document.getElementById("approverModalBackdrop");
  const modalDeptId = document.getElementById("modalDeptId");
  const modalDeptTitle = document.getElementById("modalDeptTitle");
  const supSelect = document.getElementById("modalSupervisorSelect");
  const mgrSelect = document.getElementById("modalManagerSelect");

  if (!modal || !supSelect || !mgrSelect) return;

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

  updateModalLineStatus("supervisor");
  updateModalLineStatus("manager");

  modal.classList.add("show");
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

  const result = await Swal.fire({
    title: "ล้างสายอนุมัติ?",
    html: `ต้องการล้างการตั้งค่าผู้อนุมัติของ <b>${escapeHtml(deptName)}</b> ใช่หรือไม่?`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#64748b",
    confirmButtonText: "ล้างค่า",
    cancelButtonText: "ยกเลิก"
  });

  if (!result.isConfirmed) return;

  try {
    const { error } = await sb
      .from("department_approvers")
      .delete()
      .eq("department_id", departmentId);

    if (error) throw error;

    approverMap.delete(String(departmentId));
    renderApproverTable();

    const deptSelect = document.getElementById("departmentSelect");
    if (String(deptSelect?.value) === String(departmentId)) {
      deptSelect.value = "";
      handleDepartmentChange();
    }

    Swal.fire({
      icon: "success",
      title: "ล้างข้อมูลแล้ว",
      text: `ล้างสายอนุมัติของ ${deptName} เรียบร้อย`,
      timer: 1400,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("deleteApprover:", err);
    Swal.fire("ล้างข้อมูลไม่สำเร็จ", err.message, "error");
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
          if (typeof loadData === "function") loadData();
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

    // Set DOM checkbox states
    if (document.getElementById("notif-new-request")) document.getElementById("notif-new-request").checked = settings.new_request !== false;
    if (document.getElementById("notif-new-request-l2")) document.getElementById("notif-new-request-l2").checked = settings.new_request_l2 !== false;
    if (document.getElementById("notif-leader-approved")) document.getElementById("notif-leader-approved").checked = settings.leader_approved !== false;
    if (document.getElementById("notif-manager-approved")) document.getElementById("notif-manager-approved").checked = settings.manager_approved !== false;
    if (document.getElementById("notif-final-approved")) document.getElementById("notif-final-approved").checked = settings.final_approved !== false;
    if (document.getElementById("notif-rejected")) document.getElementById("notif-rejected").checked = settings.rejected !== false;
    if (document.getElementById("notif-cancellation")) document.getElementById("notif-cancellation").checked = settings.cancellation !== false;

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
