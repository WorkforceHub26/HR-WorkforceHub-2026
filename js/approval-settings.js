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
}

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

function renderExecutiveOptions() {
  const el = document.getElementById("executiveSelect");
  if (!el) return;

  const options = employees.map(e => {
    const position = e.positions?.position_name || e.role || "พนักงาน";
    const code = e.employee_code ? `#${e.employee_code} · ` : "";
    return `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + position)}</option>`;
  }).join("");

  el.innerHTML = `<option value="">-- เลือกผู้บริหาร L3 --</option>${options}`;

  if (executiveSetting?.employee_id) {
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
    sup.innerHTML = `<option value="">-- เลือกหัวหน้า --</option>`;
    mgr.innerHTML = `<option value="">-- ไม่มี / ข้าม L2 --</option>`;
    updateLineStatus("supervisor");
    updateLineStatus("manager");
    return;
  }

  // แสดงพนักงาน active ทั้งหมด
  const options = employees.map(e => {
    const position = e.positions?.position_name || e.role || "พนักงาน";
    const code = e.employee_code ? `#${e.employee_code} · ` : "";
    return `<option value="${escapeAttr(e.id)}">${escapeHtml(code + (e.full_name || "-") + " — " + position)}</option>`;
  }).join("");

  sup.innerHTML = `<option value="">-- เลือกหัวหน้า L1 --</option>${options}`;
  mgr.innerHTML = `<option value="">-- ไม่มี / ข้าม L2 --</option>${options}`;

  const current = approverMap.get(String(departmentId));
  if (current) {
    sup.value = current.supervisor_id || "";
    mgr.value = current.manager_id || "";
  }

  sup.disabled = mgr.disabled = save.disabled = false;
  updateLineStatus("supervisor");
  updateLineStatus("manager");
}

function updateLineStatus(type) {
  const selectId = type === "supervisor" ? "supervisorSelect" : "managerSelect";
  const statusId = type === "supervisor" ? "supervisorLine" : "managerLine";
  const employeeId = document.getElementById(selectId)?.value;
  const el = document.getElementById(statusId);
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

async function saveApprover() {
  const departmentId = document.getElementById("departmentSelect").value;
  const supervisorId = document.getElementById("supervisorSelect").value || null;
  const managerId = document.getElementById("managerSelect").value || null;

  if (!departmentId) return;
  if (!supervisorId) {
    Swal.fire("ข้อมูลยังไม่ครบ", "กรุณาเลือกหัวหน้า L1", "warning");
    return;
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

function renderApproverTable() {
  const body = document.getElementById("approverTableBody");
  if (!body) return;

  const rows = departments.map(dept => {
    const map = approverMap.get(String(dept.id));
    if (!map) return null;

    const sup = employees.find(e => String(e.id) === String(map.supervisor_id));
    const mgr = employees.find(e => String(e.id) === String(map.manager_id));

    const l1Display = sup ? escapeHtml(sup.full_name) : '<span style="color:#94a3b8">-- ยังไม่ตั้งค่า --</span>';
    const l1Line = sup && sup.line_id ? '<span class="line-ok">เชื่อมแล้ว</span>' : '<span class="line-no">ยังไม่เชื่อม</span>';
    
    const l2Display = mgr ? escapeHtml(mgr.full_name) : '<span style="color:#94a3b8">-- ไม่มี / ข้าม --</span>';
    const l2Line = mgr && mgr.line_id ? '<span class="line-ok">เชื่อมแล้ว</span>' : '<span class="line-no">ยังไม่เชื่อม</span>';

    return `<tr>
      <td><div style="font-weight:700; color:#0f172a;">${escapeHtml(dept.department_name || "-")}</div></td>
      <td>
        <div style="font-weight:600;">${l1Display}</div>
        <div style="font-size:11px;">LINE: ${l1Line}</div>
      </td>
      <td>
        <div style="font-weight:600;">${l2Display}</div>
        <div style="font-size:11px;">LINE: ${l2Line}</div>
      </td>
      <td>
        <div style="display:flex; gap:8px;">
          <button type="button" class="btn btn-sm btn-edit" onclick="editApprover('${escapeAttr(dept.id)}')">
            <span class="material-symbols-outlined" style="font-size:16px;">edit_note</span> ตั้งค่า
          </button>
          <button type="button" class="btn btn-sm btn-delete" onclick="deleteApprover('${escapeAttr(dept.id)}')">
             <span class="material-symbols-outlined" style="font-size:16px;">delete</span> ล้าง
          </button>
        </div>
      </td>
    </tr>`;
  }).filter(Boolean);

  body.innerHTML = rows.length ? rows.join("") :
    `<tr><td colspan="4" class="empty-state">ยังไม่ได้ตั้งค่าสายอนุมัติ</td></tr>`;
}

window.editApprover = function(departmentId) {
  const deptSelect = document.getElementById("departmentSelect");
  if (!deptSelect) return;

  deptSelect.value = departmentId;
  handleDepartmentChange();

  window.scrollTo({ top: 0, behavior: 'smooth' });

  const dept = departments.find(d => String(d.id) === String(departmentId));
  Swal.fire({
    icon: "info",
    title: "โหมดแก้ไข",
    text: `กำลังแก้ไขสายอนุมัติของ ${dept?.department_name || "แผนกที่เลือก"}`,
    timer: 1200,
    showConfirmButton: false
  });
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

    // --------------------------------------------------------
    // ยกเลิกรหัสเก่าที่ยังไม่ถูกใช้ของพนักงานคนนี้
    // --------------------------------------------------------
    const now = new Date().toISOString();

    const { error: expireError } = await sb
      .from("line_link_tokens")
      .update({
        used_at: now
      })
      .eq("employee_id", employeeId)
      .is("used_at", null);

    if (expireError) {
      console.warn(
        "ไม่สามารถปิดรหัสเก่าได้:",
        expireError
      );
    }

    // --------------------------------------------------------
    // สุ่มรหัส 6 หลัก
    // --------------------------------------------------------
    let linkCode = "";
    let created = false;

    // เผื่อรหัสชนกัน ลองใหม่ได้สูงสุด 5 ครั้ง
    for (let attempt = 0; attempt < 5; attempt++) {

      linkCode = String(
        Math.floor(100000 + Math.random() * 900000)
      );

      // รหัสมีอายุ 15 นาที
      const expiresAt = new Date(
        Date.now() + 15 * 60 * 1000
      ).toISOString();

      const { error } = await sb
        .from("line_link_tokens")
        .insert({
          employee_id: employeeId,
          token: linkCode,
          expires_at: expiresAt
        });

      if (!error) {
        created = true;
        break;
      }

      // ถ้าไม่ใช่ unique violation ให้หยุดทันที
      if (error.code !== "23505") {
        throw error;
      }
    }

    if (!created) {
      throw new Error(
        "ไม่สามารถสร้างรหัสที่ไม่ซ้ำกันได้ กรุณาลองใหม่"
      );
    }

    // --------------------------------------------------------
    // แสดงรหัสให้ Admin
    // --------------------------------------------------------
    await Swal.fire({
      icon: "success",
      title: "รหัสเชื่อม LINE",
      html: `
        <div style="font-size:14px;color:#64748b;">
          สำหรับ
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
          และใช้ได้เพียงครั้งเดียว
        </div>
      `,
      confirmButtonText: "เรียบร้อย",
      confirmButtonColor: "#0f766e"
    });

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
