/**
 * leave-user.js — ใบลาออนไลน์ PVT HR
 * ✅ Auto-fill ข้อมูลพนักงานจาก Supabase session
 * ✅ ค้นหาชื่อ / รหัสพนักงาน (สำหรับ HR)
 * ✅ คำนวณวันลาอัตโนมัติ
 * ✅ ระบบลายเซ็นดิจิทัล (E-Signature) รองรับมือถือและคอมพิวเตอร์
 * ✅ Validate ก่อนบันทึก และส่งภาพลายเซ็นเข้าฐานข้อมูล
 * ✅ Toast feedback แทน alert
 */

let employees = [];
let leaveTypes = [];
let currentProfile = null;
let isHRRole = false;

// ─── INIT ─────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initLeaveForm);

// ค้นหาฟังก์ชัน initLeaveForm() ใน leave-user.js แล้วปรับให้เช็ค URL Parameter
async function initLeaveForm() {
  try {
    currentProfile = await window.pvtSupabase?.getCurrentProfile();
    isHRRole = ["admin", "hr", "manager", "supervisor"].includes(currentProfile?.role);

    await Promise.all([loadEmployees(), loadLeaveTypes()]);
    
    // 💡 1. ตรวจสอบว่าเป็นการกดลิ้งก์มาจากหน้าอนุมัติของ HR หรือไม่
    const urlParams = new URLSearchParams(window.location.search);
    const leaveId = urlParams.get('id');
    const viewOnly = urlParams.get('viewOnly');

    if (leaveId) {
      // ดึงข้อมูลคำขอลาตัวนี้มาใส่ในฟอร์มใบลานี้โดยอัตโนมัติ
      await loadSpecificLeaveToForm(leaveId, viewOnly);
    } else {
      // ถ้าเป็นการเข้าปกติ ให้พนักงานใช้งานฟอร์มว่างตามปกติ
      autoFillCurrentEmployee();
      addLeaveRow();
    }

    document.getElementById("employeeName")?.addEventListener("input", onEmployeeNameInput);
  } catch (err) {
    console.error(err);
    showToast("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรช", "error");
  } finally {
    const badge = document.getElementById("loadingBadge");
    if (badge) badge.style.display = "none";
  }
}

// 💡 2. เพิ่มฟังก์ชันสำหรับดึงข้อมูลคำขอลาเฉพาะรายการมาหยอดใส่หน้าใบลา
async function loadSpecificLeaveToForm(leaveId, viewOnly) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  const { data, error } = await sb
    .from("leave_requests")
    .select("*, employees(*)")
    .eq("id", leaveId)
    .single();

  if (error || !data) {
    showToast("ไม่พบข้อมูลใบลารายการนี้", "error");
    return;
  }

  // หยอดข้อมูลพนักงานผู้ลาลงบนหัวฟอร์มหน้าใบลา
  const emp = data.employees || {};
  setVal("employeeName", emp.full_name);
  setVal("employeeCode", emp.employee_code);
  
  // เพิ่มแถวรายการที่ดึงมาจากฐานข้อมูลลงในตารางหน้าใบลา
  const tbody = document.getElementById("leaveTableBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr class="leave-row">
        <td><input type="date" class="start-date" value="${data.start_date}" ${viewOnly ? 'disabled' : ''}></td>
        <td><input type="date" class="end-date" value="${data.end_date}" ${viewOnly ? 'disabled' : ''}></td>
        <td><input type="number" class="total-days" value="${data.total_days}" ${viewOnly ? 'disabled' : ''}></td>
        <td>
          <select class="leave-type-id" ${viewOnly ? 'disabled' : ''}>
            ${leaveTypes.map(t => `<option value="${t.id}" ${t.id === data.leave_type_id ? 'selected' : ''}>${t.leave_name}</option>`).join('')}
          </select>
        </td>
        <td><textarea class="leave-reason" ${viewOnly ? 'disabled' : ''}>${data.reason || ''}</textarea></td>
      </tr>
    `;
  }

  // หาก HR มาดูอย่างเดียว (viewOnly=true) ให้ซ่อนปุ่ม บันทึก หรือ เพิ่มรายการ เพื่อป้องกันการกดซ้ำ
  if (viewOnly) {
    const actions = document.querySelector(".bottom-actions");
    if (actions) {
      actions.innerHTML = `<button class="btn btn-ghost" onclick="window.close()">❌ ปิดหน้าต่างนี้</button>`;
    }
  }
}

// ─── LOAD EMPLOYEES ───────────────────────────────────────────────────
async function loadEmployees() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  const { data, error } = await sb
    .from("employees")
    .select(`
      id, employee_code, full_name, start_date, status,
      departments ( department_name ),
      positions ( position_name )
    `)
    .eq("status", "active")
    .order("employee_code", { ascending: true });

  if (error) throw error;
  employees = data || [];

  const opts = document.getElementById("employeeOptions");
  if (!opts) return;
  opts.innerHTML = employees.flatMap(e => [
    `<option value="${esc(e.full_name)}" data-id="${e.id}">รหัส: ${esc(e.employee_code)}</option>`,
    `<option value="${esc(e.employee_code)}" data-id="${e.id}">${esc(e.full_name)}</option>`,
  ]).join("");
}

// ─── LOAD LEAVE TYPES ─────────────────────────────────────────────────
async function loadLeaveTypes() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  const { data, error } = await sb
    .from("leave_types")
    .select("id, leave_code, leave_name")
    .eq("status", "active");

  if (error) throw error;
  leaveTypes = data || [];
}

// ─── AUTO-FILL ────────────────────────────────────────────────────────
function autoFillCurrentEmployee() {
  const emp = currentProfile?.employees;
  if (!emp) return;

  fillEmployeeFields(emp);

  const nameInput = document.getElementById("employeeName");
  if (nameInput && !isHRRole) {
    nameInput.readOnly = true;
  }

  loadLeaveBalance(emp.id);
}

function fillEmployeeFields(emp) {
  setVal("employeeName", emp.full_name);
  setVal("employeeCode", emp.employee_code);
  setVal("position", emp.positions?.position_name || "–");
  setVal("department", emp.departments?.department_name || "–");
  setVal("startWorkDate", window.pvtSupabase.formatThaiDate(emp.start_date));
  document.getElementById("employeeId").value = emp.id;
}

async function loadLeaveBalance(employeeId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb || !employeeId) return;

  const currentYear = new Date().getFullYear() + 543;
  const { data } = await sb
    .from("leave_balances")
    .select("remaining_days")
    .eq("employee_id", employeeId)
    .eq("year", currentYear)
    .maybeSingle();

  const remaining = data?.remaining_days ?? "–";
  setVal("vacationRemain", remaining !== "–" ? `${remaining} วัน` : "–");
}

// ─── EMPLOYEE SEARCH (สำหรับ HR) ──────────────────────────────────────
function onEmployeeNameInput(e) {
  if (!isHRRole) return;
  const val = e.target.value.trim();
  const found = employees.find(
    emp => emp.full_name === val || emp.employee_code === val
  );
  if (found) {
    fillEmployeeFields(found);
    loadLeaveBalance(found.id);
  }
}

// ─── ADD ROW ──────────────────────────────────────────────────────────
function addLeaveRow() {
  const tbody = document.getElementById("leaveTableBody");
  if (!tbody) return;

  const rowId = `row_${Date.now()}`;
  const today = new Date().toISOString().split("T")[0];
  const typeOpts = leaveTypes
    .map(t => `<option value="${t.id}">${esc(t.leave_name)}</option>`)
    .join("");

  const tr = document.createElement("tr");
  tr.id = rowId;
  tr.innerHTML = `
    <td><input type="date" class="write-date" value="${today}" /></td>
    <td><input type="date" class="start-date" onchange="calcDays('${rowId}')" /></td>
    <td><input type="date" class="end-date"   onchange="calcDays('${rowId}')" /></td>
    <td><input type="number" class="am-hrs" min="0" max="4" step="0.5" value="0" onchange="calcDays('${rowId}')" style="width:55px" /></td>
    <td><input type="number" class="pm-hrs" min="0" max="4" step="0.5" value="0" onchange="calcDays('${rowId}')" style="width:55px" /></td>
    <td><input type="number" class="total-days days-input" step="0.5" readonly value="0" style="width:55px" /></td>
    <td><select class="leave-type-id" style="width:110px">${typeOpts}</select></td>
    <td><textarea class="leave-reason" placeholder="ระบุเหตุผล..." rows="2" style="width:130px"></textarea></td>
    <td><input type="file" class="leave-attachment" accept="image/*,application/pdf" style="font-size:11px; width:120px;" /></td>
    
    <!-- ✍️ ช่องเซ็นชื่อพนักงานผู้ลา -->
    <td style="text-align: center; vertical-align: middle;">
      <canvas class="signature-pad" width="150" height="65" style="border:1px dashed #cbd5e1; background:#f8fafc; border-radius:4px; display:block; margin:0 auto;"></canvas>
      <button type="button" class="btn btn-secondary" onclick="clearSignature(this)" style="font-size:10px; padding:2px 6px; margin-top:3px;">ล้างลายเซ็น</button>
    </td>
    
    <!-- 🏢 ช่องสถานะลายเซ็นของผู้อนุมัติหน่วยงานต่าง ๆ (จะเซ็นเมื่อผ่านหน้าจออนุมัติของหัวหน้า) -->
    <td style="text-align:center; color:#64748b; font-size:12px; vertical-align:middle; min-width:90px;">
      <span class="badge badge-warning">รอตรวจสอบ</span><br><small>หน.แผนก</small>
    </td>
    <td style="text-align:center; color:#64748b; font-size:12px; vertical-align:middle; min-width:90px;">
      <span class="badge badge-warning">รอตรวจสอบ</span><br><small>ผจก.ฝ่าย</small>
    </td>
    <td style="text-align:center; color:#64748b; font-size:12px; vertical-align:middle; min-width:90px;">
      <span class="badge badge-warning">รออนุมัติ</span><br><small>ฝ่ายบุคคล</small>
    </td>

    <td class="no-print" style="vertical-align:middle;">
      <button type="button" class="btn btn-danger btn-sm" onclick="removeRow('${rowId}')">✕</button>
    </td>
  `;
  tbody.appendChild(tr);

  // สั่งเปิดระบบวาดรูปให้กล่อง Canvas ในแถวนี้ทันที
  const canvas = tr.querySelector(".signature-pad");
  if (canvas) initSignaturePad(canvas);
}

function removeRow(rowId) {
  const tbody = document.getElementById("leaveTableBody");
  if (!tbody) return;
  if (tbody.children.length <= 1) {
    showToast("ต้องมีรายการอย่างน้อย 1 รายการ", "error");
    return;
  }
  document.getElementById(rowId)?.remove();
}

// ─── CALCULATE DAYS ───────────────────────────────────────────────────
function calcDays(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;

  const startVal = row.querySelector(".start-date").value;
  const endVal   = row.querySelector(".end-date").value;
  const amHrs    = parseFloat(row.querySelector(".am-hrs").value || 0);
  const pmHrs    = parseFloat(row.querySelector(".pm-hrs").value || 0);
  const totalEl  = row.querySelector(".total-days");

  if (!startVal || !endVal) return;

  const start = new Date(startVal);
  const end   = new Date(endVal);

  if (end < start) {
    totalEl.value = "0";
    showToast("วันเริ่มต้นต้องไม่อยู่หลังวันสิ้นสุด", "error");
    row.style.outline = "2px solid #ef4444";
    return;
  }
  row.style.outline = "";

  const diffDays = Math.round((end - start) / 86400000) + 1;
  const hourDeduct = (amHrs + pmHrs) / 8;
  const result = Math.max(0, diffDays - hourDeduct);
  totalEl.value = result % 1 === 0 ? result : result.toFixed(1);
}

// ─── SAVE ─────────────────────────────────────────────────────────────
async function saveLeave() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) { showToast("ไม่สามารถเชื่อมต่อ Supabase", "error"); return; }

  const employeeId = document.getElementById("employeeId").value;
  if (!employeeId) {
    showToast("กรุณาเลือกพนักงานก่อนบันทึก", "error");
    return;
  }

  const rows = Array.from(document.querySelectorAll("#leaveTableBody tr"));
  if (!rows.length) {
    showToast("กรุณาเพิ่มรายการลาอย่างน้อย 1 รายการ", "error");
    return;
  }

  // Validate ข้อมูลและการเซ็นชื่อ
  const errors = [];
  rows.forEach((row, i) => {
    const start = row.querySelector(".start-date").value;
    const end   = row.querySelector(".end-date").value;
    const days  = Number(row.querySelector(".total-days").value || 0);
    const reason = row.querySelector(".leave-reason").value.trim();
    const canvas = row.querySelector(".signature-pad");

    if (!start) errors.push(`แถว ${i+1}: ยังไม่ได้ระบุวันเริ่มต้นลา`);
    if (!end)   errors.push(`แถว ${i+1}: ยังไม่ได้ระบุวันสิ้นสุดลา`);
    if (days <= 0) errors.push(`แถว ${i+1}: จำนวนวันลาต้องมากกว่า 0`);
    if (!reason) errors.push(`แถว ${i+1}: กรุณาระบุเหตุผลการลา`);
    if (start && end && new Date(end) < new Date(start)) {
      errors.push(`แถว ${i+1}: วันเริ่มต้นอยู่หลังวันสิ้นสุด`);
    }
    
    // ตรวจสอบว่าพนักงานเซ็นชื่อในช่องหรือยัง
    if (canvas && isCanvasBlank(canvas)) {
      errors.push(`แถว ${i+1}: กรุณาเซ็นชื่อรับรองผู้ลาในช่องลายเซ็น`);
    }
  });

  if (errors.length) {
    showToast(errors[0], "error");
    return;
  }

  showToast("⏳ กำลังส่งคำขอลาพร้อมลายเซ็น...", "info");

  // จัดเตรียมชุดข้อมูล Payload
  const payload = rows.map(row => {
    const canvas = row.querySelector(".signature-pad");
    // แปลงภาพลายเซ็นพนักงานเป็นรูปแบบ Base64 Text String
    const signatureBase64 = canvas ? canvas.toDataURL("image/png") : null;

    return {
      employee_id:   employeeId,
      leave_type_id: row.querySelector(".leave-type-id").value,
      start_date:    row.querySelector(".start-date").value,
      end_date:      row.querySelector(".end-date").value,
      total_days:    Number(row.querySelector(".total-days").value),
      reason:        row.querySelector(".leave-reason").value.trim(),
      status:        "pending",
      // ฝากส่ง Text ลายเซ็นดิจิทัลไปบันทึกที่ช่องโน้ตหรือตามโครงสร้างฐานข้อมูลของพี่
      note:          signatureBase64 ? `SIGNATURE_DATA:${signatureBase64}` : null
    };
  });

  try {
    const { error } = await sb.from("leave_requests").insert(payload);
    if (error) throw error;
    showToast("✅ ส่งคำขอลาพร้อมบันทึกลายเซ็นเรียบร้อย!", "success");
    setTimeout(() => { window.location.href = "/pages/user/leave-history.html"; }, 1200);
  } catch (err) {
    console.error(err);
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, "error");
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? "";
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

let toastTimer = null;
function showToast(msg, type = "") {
  const el = document.getElementById("statusToast");
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove("show"); }, 3500);
}

// ─── SIGNATURE PAD LOGIC ──────────────────────────────────────────────
function initSignaturePad(canvas) {
  const ctx = canvas.getContext("2d");
  let drawing = false;

  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#1e3a8a"; // ใช้สีน้ำเงินเข้มฟีลปากกาเซ็นเอกสารจริง

  // สำหรับการใช้งานผ่านเมาส์ (Desktop)
  canvas.addEventListener("mousedown", (e) => {
    drawing = true;
    const pos = getCanvasPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  });
  
  canvas.addEventListener("mousemove", (e) => {
    if (!drawing) return;
    const pos = getCanvasPos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  });
  
  canvas.addEventListener("mouseup", () => drawing = false);
  canvas.addEventListener("mouseleave", () => drawing = false);

  // สำหรับการใช้งานผ่านสัมผัสหน้าจอ (Mobile / Tablet)
  canvas.addEventListener("touchstart", (e) => {
    drawing = true;
    const pos = getCanvasTouchPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    if (!drawing) return;
    const pos = getCanvasTouchPos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", () => drawing = false);
}

function getCanvasPos(canvas, mouseEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: mouseEvent.clientX - rect.left,
    y: mouseEvent.clientY - rect.top
  };
}

function getCanvasTouchPos(canvas, touchEvent) {
  const rect = canvas.getBoundingClientRect();
  const touch = touchEvent.touches[0];
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

function clearSignature(btn) {
  const canvas = btn.previousElementSibling;
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// เช็คว่ากล่องวาดลายเซ็นว่างเปล่าหรือไม่ (กันคนเนียนส่งใบลาโดยไม่เซ็นชื่อ)
function isCanvasBlank(canvas) {
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}