// ===================================================================
// 🚨 1. EMERGENCY CRASH CATCHER
// ===================================================================
window.onerror = function (message, source, lineno, colno, error) {
  const terminal = document.getElementById("debugLogContainer");
  if (terminal) {
    terminal.innerHTML = `<div style="background:#7f1d1d; color:#fca5a5; padding:16px; border-radius:8px; margin-bottom:12px; font-family:monospace; border:2px solid #f43f5e;">
      <strong>🚨 [CRITICAL SYSTEM CRASH]:</strong> ${message} (Line: ${lineno})
    </div>` + terminal.innerHTML;
  }
  return false;
};

// ===================================================================
// 📡 2. CONFIGURATION & INITIALIZATION
// ===================================================================
const SUPABASE_URL = "https://pgogmhqjdchakcytsomx.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";

// ฟังก์ชันดึง Supabase Client ที่ปลอดภัย ป้องกัน ReferenceError และการสร้าง Instance ซ้ำ
function getSupabaseClient() {
  if (window.pvtSupabase?.getClient) {
    return window.pvtSupabase.getClient();
  }
  if (window.supabase?.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  }
  return null;
}

const sbTelemetryClient = getSupabaseClient();
let globalSystemLogs = [];
let searchTerm = "";

function pushLog(message, level = "info") {
  const container = document.getElementById("debugLogContainer");
  const timestamp = new Date().toLocaleTimeString();
  globalSystemLogs.push({ timestamp, message, level });
  
  if (!container) return;
  
  if (searchTerm === "" || message.toLowerCase().includes(searchTerm.toLowerCase())) {
    let cssClass = level === "error" ? "log-error" : level === "success" ? "log-success" : level === "warn" ? "log-warn" : "log-info";
    container.innerHTML += `<span class="log-row ${cssClass}">[${timestamp}] [${level.toUpperCase()}]: ${message}</span>`;
    container.scrollTop = container.scrollHeight;
  }
}

// ===================================================================
// 🟢 3. REALTIME AUDIT LOGS ENGINE
// ===================================================================
function setupRealtimeAuditStream() {
  pushLog("กำลังเปิดโครงข่ายท่อ WebSocket เชื่อมตรงตารางประวัติพฤติกรรม...", "info");
  const client = getSupabaseClient();
  if (!client) {
    pushLog("⚠️ ไม่สามารถเริ่มต้น Realtime Audit Stream: ไม่พบ Supabase Client", "warn");
    return;
  }

  client
    .channel('public:user_activity_logs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity_logs' }, (payload) => {
      const newLog = payload.new || {};
      pushLog(`🚨 มีกิจกรรมใหม่จากผู้ใช้: ${newLog.user_name || 'Guest'} -> ${newLog.description || '-'}`, "success");
      insertRowToAuditTable(newLog, true); 
    })
    .subscribe((status) => {
      const rtEl = document.getElementById("realtimeStatus");
      if (status === 'SUBSCRIBED') {
        if (rtEl) { rtEl.className = "metric-value text-success"; rtEl.innerText = "LIVE STREAM"; }
        pushLog("🌐 เชื่อมต่อท่อ Realtime WebSocket สำเร็จ!", "success");
        fetchInitialAuditLogs();
      } else {
        if (rtEl) { rtEl.className = "metric-value text-error"; rtEl.innerText = "DISCONNECTED"; }
      }
    });
}

async function fetchInitialAuditLogs() {
  try {
    const client = getSupabaseClient();
    if (!client) return;

    const { data, error } = await client.from("user_activity_logs").select("*").order("created_at", { ascending: false }).limit(15);
    if (error) throw error;
    const tbody = document.getElementById("auditLogsTableBody");
    if (!tbody) return;
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">📭 ยังไม่มีข้อมูลประวัติผู้ใช้งาน</td></tr>`;
      return;
    }
    tbody.innerHTML = ""; 
    data.forEach(log => insertRowToAuditTable(log, false));
    pushLog("โหลดประวัติการใช้งานในอดีตขึ้นตารางหลักเรียบร้อย", "info");
  } catch (err) {
    pushLog(`ไม่สามารถโหลดประวัติผู้ใช้ได้: ${err.message}`, "error");
  }
}

function insertRowToAuditTable(log, isNewArrival = false) {
  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;
  
  const timeStr = log.created_at ? new Date(log.created_at).toLocaleTimeString() : new Date().toLocaleTimeString();
  let actionBadgeColor = "#4b5563"; 
  if (log.action_type === "INSERT" || log.action_type === "VISIT") actionBadgeColor = "#16a34a"; 
  if (log.action_type === "UPDATE") actionBadgeColor = "#ca8a04"; 
  if (log.action_type === "DELETE") actionBadgeColor = "#dc2626"; 
  
  const userName = log.user_name || 'Guest/Admin';
  const pageUrl = log.page_url || '-';
  const actionType = log.action_type || 'INFO';
  const description = log.description || '-';

  const rowHtml = `
    <tr style="${isNewArrival ? 'background: #064e3b; transition: background 1s ease;' : ''}">
      <td style="font-family: 'JetBrains Mono', monospace; color: #9ca3af;">${timeStr}</td>
      <td><strong>👤 ${userName}</strong></td>
      <td><span class="table-code" style="color: #a7f3d0; background:#1f2937;">${pageUrl}</span></td>
      <td><span style="background: ${actionBadgeColor}; color:#fff; padding: 2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${actionType}</span></td>
      <td style="color: #e5e7eb;">${description}</td>
    </tr>
  `;
  if (isNewArrival) {
    tbody.innerHTML = rowHtml + tbody.innerHTML; 
    setTimeout(() => {
      const firstRow = tbody.querySelector("tr");
      if (firstRow) firstRow.style.background = "transparent";
    }, 2000);
  } else {
    tbody.innerHTML += rowHtml; 
  }
}

// ===================================================================
// 📊 4. CORE SYSTEM HEALTH TELEMETRY 
// ===================================================================
async function executeTelemetryCycle() {
  const startTime = Date.now();
  const refreshTimeEl = document.getElementById("lastRefreshTime");
  if (refreshTimeEl) refreshTimeEl.innerText = `REFRESH: ${new Date().toLocaleTimeString()}`;
  
  try {
    const client = getSupabaseClient();
    if (!client) return;

    const { error: pErr } = await client.from("leave_types").select("id").limit(1);
    const latency = Date.now() - startTime;
    const pingEl = document.getElementById("pingStatus");
    if (pErr) {
      if(pingEl) { pingEl.className = "metric-value text-error"; pingEl.innerText = "CRASH / DOWN"; }
    } else {
      if(pingEl) { pingEl.className = "metric-value text-success"; pingEl.innerText = `${latency} ms`; }
    }
    
    const tablesToScan = ["employees", "leave_types", "leave_balances", "leave_requests", "user_activity_logs", "pvt_system_logs"];
    let combinedTotalRows = 0;
    for (const tableName of tablesToScan) {
      const { count } = await client.from(tableName).select("*", { count: "exact", head: true });
      combinedTotalRows += (count || 0);
    }
    const dbSizeEl = document.getElementById("dbSizeStatus");
    if (dbSizeEl) dbSizeEl.innerText = `${combinedTotalRows} ROWS`;

    const rlsEl = document.getElementById("rlsStatus");
    const { error: rlsErr } = await client.from("leave_balances").select("id").limit(1);
    if (rlsEl) {
      rlsEl.className = rlsErr && rlsErr.message?.includes("policy") ? "metric-value text-error" : "metric-value text-success";
      rlsEl.innerText = rlsErr && rlsErr.message?.includes("policy") ? "SECURE 🔐" : "OPEN 🔓";
    }
  } catch (err) {
    pushLog(`ลูปสแกนระบบหลักมีอาการรวน: ${err.message}`, "error");
  }
}

function handleLogSearch() {
  const input = document.getElementById("logSearchInput");
  searchTerm = input ? input.value : "";
  const container = document.getElementById("debugLogContainer");
  if (!container) return;
  container.innerHTML = "";
  globalSystemLogs.forEach(log => {
    if (searchTerm === "" || log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      let cssClass = log.level === "error" ? "log-error" : log.level === "success" ? "log-success" : log.level === "warn" ? "log-warn" : "log-info";
      container.innerHTML += `<span class="log-row ${cssClass}">[${log.timestamp}] [${log.level.toUpperCase()}]: ${log.message}</span>`;
    }
  });
}

function clearConsoleLog() { 
  globalSystemLogs = []; 
  const container = document.getElementById("debugLogContainer");
  if (container) container.innerHTML = ""; 
}

// ===================================================================
// 🛠️ 5. ADVANCED ENTERPRISE TOOLS
// ===================================================================
function filterAuditLogs() {
  const filterEl = document.getElementById("actionFilter");
  if (!filterEl) return;
  const filterValue = filterEl.value;
  const tableBody = document.getElementById("auditLogsTableBody");
  if (!tableBody) return;
  const rows = tableBody.querySelectorAll("tr");
  rows.forEach(row => {
    if (row.cells.length < 5) return; 
    const actionCellText = row.cells[3].innerText.trim();
    if (filterValue === "ALL" || actionCellText.includes(filterValue)) {
      row.style.display = ""; 
    } else {
      row.style.display = "none"; 
    }
  });
  pushLog(`🔍 กรองข้อมูลด้วยเงื่อนไข: ${filterValue}`, "info");
}

function exportLogsToCSV() {
  const rows = document.querySelectorAll("#auditLogsTableBody tr");
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
  csvContent += "Time,User,Page URL,Action,Description\n";
  let exportedRowCount = 0;
  rows.forEach(row => {
    if (row.cells.length < 5 || row.style.display === "none") return;
    const rowData = Array.from(row.cells).map(cell => `"${cell.innerText.replace(/[\n\r]+/g, ' ').trim().replace(/"/g, '""')}"`);
    csvContent += rowData.join(",") + "\n";
    exportedRowCount++;
  });
  if (exportedRowCount === 0) return alert("ไม่มีข้อมูลสำหรับ Export!");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  pushLog(`📥 Export CSV สำเร็จ`, "success");
}

// สร้าง Alias ให้เรียกใช้ได้สอดคล้องกับ HTML
function exportToCSV() {
  exportLogsToCSV();
}

function deleteSelectedRecords() {
  alert("⚠️ ฟังก์ชันลบแบบกลุ่มยังอยู่ในระหว่างการพัฒนา");
}

// ===================================================================
// ➕ ระบบเพิ่มข้อมูลพนักงาน (ปรับเพิ่มรหัสผ่าน & โปรไฟล์วางทับ)
// ===================================================================
async function openInsertModal() {
  const tableSelectEl = document.getElementById("manageTableSelect");
  if (!tableSelectEl) return alert("ระบบผิดพลาด: ไม่พบตัวเลือกตาราง");

  const table = tableSelectEl.value;
  const modal = document.getElementById("dataModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");

  if (!modal || !modalBody || !modalTitle) return;

  modalTitle.innerHTML = `⏳ กำลังเตรียมแบบฟอร์ม...`;
  modalBody.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">กำลังดึงข้อมูล...</div>`;
  modal.style.display = "flex";
  modal.classList.add("active");

  let html = '';
  const client = getSupabaseClient();

  if (table === "employees") {
    modalTitle.innerHTML = `<span class="material-symbols-outlined text-success" style="vertical-align: middle;">person_add</span> เพิ่มข้อมูลพนักงานใหม่`;
    try {
      let depts = [], positions = [];
      if (client) {
        const { data: dData, error: dErr } = await client.from('departments').select('id, department_name');
        const { data: pData, error: pErr } = await client.from('positions').select('id, position_name');
        if (dErr || pErr) throw new Error(dErr?.message || pErr?.message);
        depts = dData || [];
        positions = pData || [];
      }

      let deptOptions = `<option value="">-- เลือกฝ่าย/แผนก * --</option>`;
      depts.forEach(d => { deptOptions += `<option value="${d.id}">${d.department_name}</option>`; });

      let posOptions = `<option value="">-- เลือกตำแหน่งงาน * --</option>`;
      positions.forEach(p => { posOptions += `<option value="${p.id}">${p.position_name}</option>`; });

      html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">รหัสพนักงาน <span style="color:#ef4444;">*</span></label>
            <input type="text" id="add_field_employee_code" placeholder="เช่น 19083" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
          </div>
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">สิทธิ์การเข้าถึงเว็บ (Role)</label>
            <select id="add_field_role" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
              <option value="user">User (พนักงานทั่วไป)</option>
              <option value="manager">Manager (ผู้จัดการ)</option>
              <option value="hr">HR (ฝ่ายบุคคล)</option>
              <option value="director">Director (ผู้บริหาร)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">รหัสผ่าน (Password) <span style="color:#ef4444;">*</span></label>
            <input type="text" id="add_field_password" placeholder="ตั้งรหัสผ่าน (เว้นว่างเพื่อใช้รหัสพนักงาน)" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
          </div>
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">รูปโปรไฟล์ (URL)</label>
            <input type="text" id="add_field_profile_url" placeholder="วางลิงก์รูปภาพโปรไฟล์" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 3fr; gap: 16px; margin-top: 12px;">
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">คำนำหน้า</label>
            <select id="add_field_prefix" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
              <option value="นาย">นาย</option>
              <option value="น.ส.">น.ส.</option>
              <option value="นาง">นาง</option>
            </select>
          </div>
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ชื่อ - นามสกุลจริง <span style="color:#ef4444;">*</span></label>
            <input type="text" id="add_field_full_name" placeholder="ไม่ต้องพิมพ์คำนำหน้าซ้ำ" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ชื่อเล่น</label>
            <input type="text" id="add_field_nickname" placeholder="เช่น ต้น" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
          </div>
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">เบอร์โทรศัพท์</label>
            <input type="text" id="add_field_phone" placeholder="เช่น 0812345678" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ฝ่าย / แผนก <span style="color:#ef4444;">*</span></label>
            <select id="add_field_department_id" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">${deptOptions}</select>
          </div>
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ตำแหน่งงาน <span style="color:#ef4444;">*</span></label>
            <select id="add_field_position_id" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">${posOptions}</select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ประเภทการจ้างงาน <span style="color:#ef4444;">*</span></label>
            <select id="add_field_employment_type" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
              <option value="">-- เลือกประเภท --</option>
              <option value="monthly">พนักงานเงินเดือน (Monthly)</option>
              <option value="parttime">พาร์ททาม (Part-time)</option>
            </select>
          </div>
          <div class="form-group">
            <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">วันเริ่มงาน <span style="color:#ef4444;">*</span></label>
            <input type="date" id="add_field_start_date" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px; color-scheme: dark;">
          </div>
        </div>
      `;
    } catch (err) {
      modalBody.innerHTML = `<div style="color:#ef4444; text-align:center;">เกิดข้อผิดพลาด: ${err.message}</div>`;
      return;
    }
  } else if (table === "leave_types") {
    modalTitle.innerHTML = `<span class="material-symbols-outlined text-success" style="vertical-align: middle;">playlist_add</span> เพิ่มประเภทการลาใหม่`;
    html = `
      <div class="form-group" style="margin-bottom: 16px;">
        <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ชื่อประเภทการลา</label>
        <input type="text" id="add_field_leave_name" placeholder="เช่น ลาพักร้อน" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
      </div>
      <div class="form-group" style="margin-bottom: 16px;">
        <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">จำนวนวันลาเริ่มต้น (Default Days)</label>
        <input type="number" id="add_field_default_days" value="10" min="0" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
      </div>
    `;
  }

  modalBody.innerHTML = html;
  const footer = document.querySelector(".modal-footer");
  if (footer) {
    footer.innerHTML = `
      <button class="action-btn btn-outline" style="padding:8px 16px; cursor:pointer;" onclick="closeDataModal()">ยกเลิก</button>
      <button class="action-btn" style="padding:8px 16px; background: #10b981; color: #fff; border: none; font-weight:bold; cursor:pointer;" onclick="saveDynamicInsert('${table}')">
        <span class="material-symbols-outlined icon-sm">cloud_upload</span> บันทึกข้อมูล
      </button>
    `;
  }
}

async function saveDynamicInsert(table) {
  let insertData = {};
  const client = getSupabaseClient();
  if (!client) return alert("❌ ไม่พบการเชื่อมต่อ Supabase Client");

  try {
    if (table === "employees") {
      const empCode = document.getElementById("add_field_employee_code")?.value.trim();
      const role = document.getElementById("add_field_role")?.value;
      const prefix = document.getElementById("add_field_prefix")?.value;
      const nameInput = document.getElementById("add_field_full_name")?.value.trim();
      const deptId = document.getElementById("add_field_department_id")?.value;
      const posId = document.getElementById("add_field_position_id")?.value;
      const empType = document.getElementById("add_field_employment_type")?.value;
      const startDate = document.getElementById("add_field_start_date")?.value;
      
      const pwdInput = document.getElementById("add_field_password")?.value.trim();
      const profileUrl = document.getElementById("add_field_profile_url")?.value.trim() || null;
      
      if (!nameInput || !empCode || !startDate || !deptId || !posId || !empType) {
        alert("❌ กรุณากรอกข้อมูลที่จำเป็น (*) ให้ครบถ้วน");
        return;
      }
      insertData = {
        employee_code: parseInt(empCode),
        full_name: `${prefix}${nameInput}`,
        nickname: document.getElementById("add_field_nickname")?.value.trim() || null,
        phone: document.getElementById("add_field_phone")?.value.trim() || null,
        department_id: deptId || null,
        position_id: posId || null,
        employment_type: empType,
        start_date: startDate || null,
        status: "active",
        password: pwdInput || empCode, 
        role: role,
        profile_image_url: profileUrl
      };
    } else if (table === "leave_types") {
      insertData = { 
        leave_name: document.getElementById("add_field_leave_name")?.value.trim(), 
        default_days: parseInt(document.getElementById("add_field_default_days")?.value) || 0 
      };
    }

    pushLog(`⏳ กำลังทำการเพิ่มข้อมูลใหม่...`, "warn");
    const { error } = await client.from(table).insert([insertData]);
    if (error) throw error;

    pushLog(`✅ บันทึกข้อมูลเรียบร้อยแล้ว!`, "success");
    alert("🎉 บันทึกข้อมูลเรียบร้อยแล้ว!");
    closeDataModal();
    if (typeof loadTableData === "function") loadTableData();

  } catch (err) {
    pushLog(`❌ เกิดข้อผิดพลาด: ${err.message}`, "error");
    alert(`ไม่สามารถบันทึกข้อมูลได้: ${err.message}`);
  }
}

let isKillSwitchActive = false;
function toggleKillSwitch() {
  isKillSwitchActive = !isKillSwitchActive;
  if (isKillSwitchActive) {
    pushLog("🚨 [CRITICAL ALERT] เปิดใช้งาน KILL SWITCH!", "error");
    document.body.style.border = "5px solid #f43f5e";
  } else {
    pushLog("✅ ยกเลิก KILL SWITCH ระบบกลับมาทำงานปกติ", "success");
    document.body.style.border = "none";
  }
}

function copyConsoleLog() {
  const logsText = globalSystemLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}]: ${l.message}`).join("\n");
  navigator.clipboard.writeText(logsText).then(() => alert("📋 คัดลอก System Logs เรียบร้อยแล้ว!"));
}

function downloadLogs() {
  if (globalSystemLogs.length === 0) return alert("ไม่มี Logs ให้ดาวน์โหลด!");
  const logsText = globalSystemLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}]: ${l.message}`).join("\n");
  const blob = new Blob([logsText], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `devops_system_logs_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
}

// ===================================================================
// 🗄️ 6. DATABASE EXPLORER (ระบบจัดการ อ่าน/กรอง/แก้ไข/ลบ)
// ===================================================================
var currentTableData = []; 
let currentPage = 1;       
const itemsPerPage = 10;   

async function loadTableData() {
  const tableSelect = document.getElementById("manageTableSelect");
  if (!tableSelect) return;
  
  const table = tableSelect.value;
  const tbody = document.getElementById("managementTableBody");
  const thead = document.getElementById("managementTableHead");
  if (tbody) tbody.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 30px; color:#94a3b8;">⏳ กำลังดึงข้อมูล...</div>';
  
  try {
    const client = getSupabaseClient();
    if (!client) throw new Error("ไม่พบ Supabase Client");

    let querySelect = '*';
    if (table === 'employees') querySelect = '*, departments(department_name), positions(position_name)';
    else if (table === 'leave_requests' || table === 'leave_balances') querySelect = '*, employees(full_name), leave_types(leave_name)';

    const { data, error } = await client.from(table).select(querySelect).order('id', { ascending: false });
    if (error) throw error;
    
    currentTableData = data || []; 
    currentPage = 1; 
    if (thead) thead.innerHTML = '';
    filterAndRenderCards();
  } catch (err) {
    if (tbody) tbody.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; color: #ef4444;">เกิดข้อผิดพลาด: ${err.message}</div>`;
  }
}

function filterAndRenderCards() {
  const tbody = document.getElementById("managementTableBody");
  if (!tbody) return;
  const keyword = document.getElementById("searchInput")?.value.toLowerCase() || "";
  
  if (!currentTableData || currentTableData.length === 0) {
    tbody.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 30px;">📭 ไม่มีข้อมูล</div>';
    updatePaginationUI(0);
    return;
  }
  
  let filteredData = currentTableData.filter(row => Object.values(row).some(val => val !== null && typeof val !== 'object' && String(val).toLowerCase().includes(keyword)));
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedData = filteredData.slice(startIndex, endIndex);

  updatePaginationUI(totalItems, startIndex, endIndex, totalPages);
  if (paginatedData.length === 0) return tbody.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; padding: 30px;">🔍 ไม่พบข้อมูล</div>';

  const tableSelect = document.getElementById("manageTableSelect");
  const table = tableSelect ? tableSelect.value : "";
  let bodyHTML = '';
  paginatedData.forEach((row) => {
    const globalIndex = currentTableData.findIndex(r => r.id === row.id);
    bodyHTML += `<div class="db-card">`;
    const keys = Object.keys(row).filter(k => typeof row[k] !== 'object' || row[k] === null);
    keys.forEach(k => {
      let val = row[k] !== null ? row[k] : '-';
      let displayVal = val;
      if (k === 'position_id' && row.positions) displayVal = row.positions.position_name;
      else if (k === 'department_id' && row.departments) displayVal = row.departments.department_name;
      else if (k === 'employee_id' && row.employees) displayVal = row.employees.full_name;
      bodyHTML += `<div class="card-item"><span class="card-label">${k.toUpperCase()}</span><span class="card-value">${displayVal}</span></div>`;
    });
    bodyHTML += `<div class="card-actions">
      <button class="action-btn btn-outline" style="flex:1; justify-content:center;" onclick="openDynamicEditModal('${table}', ${globalIndex})"><span class="material-symbols-outlined icon-sm">edit</span> แก้ไข</button>
      <button class="action-btn btn-danger" style="flex:1; justify-content:center;" onclick="deleteRecord('${table}', ${globalIndex})"><span class="material-symbols-outlined icon-sm">delete</span> ลบ</button>
    </div></div>`;
  });
  tbody.innerHTML = bodyHTML;
}

function updatePaginationUI(totalItems, startIndex = 0, endIndex = 0, totalPages = 1) {
  const counterEl = document.getElementById("recordCounter");
  const pageInfoEl = document.getElementById("pageInfo");
  if (counterEl) counterEl.innerText = totalItems > 0 ? `แสดง ${startIndex + 1}-${endIndex} จากทั้งหมด ${totalItems} รายการ` : `แสดง 0 รายการ`;
  if (pageInfoEl) pageInfoEl.innerText = `หน้า ${currentPage} / ${totalPages}`;
  if (document.getElementById("btnPrevPage")) document.getElementById("btnPrevPage").disabled = (currentPage === 1);
  if (document.getElementById("btnNextPage")) document.getElementById("btnNextPage").disabled = (currentPage === totalPages);
}

function changePage(direction) { currentPage += direction; filterAndRenderCards(); }
function searchTableData() { currentPage = 1; filterAndRenderCards(); }

async function deleteRecord(table, index) {
  const rowData = currentTableData[index];
  if (!rowData || !confirm(`⚠️ ยืนยันการลบข้อมูล ID: ${rowData.id} ?`)) return;
  try {
    const client = getSupabaseClient();
    if (!client) throw new Error("ไม่พบ Supabase Client");
    const { error } = await client.from(table).delete().eq('id', rowData.id);
    if (error) throw error;
    alert(`✅ ลบสำเร็จ!`);
    loadTableData(); 
  } catch (err) { alert(`❌ ไม่สามารถลบได้: ${err.message}`); }
}

async function openDynamicEditModal(table, index) {
  const rowData = currentTableData[index];
  if (!rowData) return;
  const modalBody = document.getElementById("modalBody");
  const modalTitle = document.getElementById("modalTitle");
  const modal = document.getElementById("dataModal");
  if(!modal || !modalBody || !modalTitle) return;

  modalTitle.innerHTML = `<span class="material-symbols-outlined text-warn">edit_square</span> แก้ไขข้อมูล (ID: ${String(rowData.id).substring(0,8)}...)`;
  
  if (table === "employees") {
    modalBody.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8;">⏳ กำลังเตรียมแบบฟอร์ม...</div>`;
    modal.style.display = "flex";
    modal.classList.add("active");

    const client = getSupabaseClient();
    let depts = [], positions = [];
    if (client) {
      const { data: dData } = await client.from('departments').select('id, department_name');
      const { data: pData } = await client.from('positions').select('id, position_name');
      depts = dData || [];
      positions = pData || [];
    }

    let deptOptions = `<option value="">-- เลือกฝ่าย/แผนก --</option>`;
    depts.forEach(d => { deptOptions += `<option value="${d.id}" ${d.id === rowData.department_id ? 'selected' : ''}>${d.department_name}</option>`; });
    let posOptions = `<option value="">-- เลือกตำแหน่งงาน --</option>`;
    positions.forEach(p => { posOptions += `<option value="${p.id}" ${p.id === rowData.position_id ? 'selected' : ''}>${p.position_name}</option>`; });

    let fName = rowData.full_name || "";
    let prefix = "นาย";
    if(fName.startsWith("นาย")) { prefix = "นาย"; fName = fName.substring(3).trim(); }
    else if(fName.startsWith("น.ส.")) { prefix = "น.ส."; fName = fName.substring(4).trim(); }
    else if(fName.startsWith("นาง")) { prefix = "นาง"; fName = fName.substring(3).trim(); }

    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">รหัสพนักงาน (ล็อค)</label>
          <input type="text" value="${rowData.employee_code || ''}" disabled style="width:100%; padding:10px; background:#27272a; border:1px solid #3f3f46; color:#fff; border-radius:6px; opacity:0.6; cursor:not-allowed;">
        </div>
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">สิทธิ์การเข้าถึง (Role)</label>
          <select id="edit_field_role" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
            <option value="user" ${rowData.role === 'user' ? 'selected' : ''}>User (พนักงานทั่วไป)</option>
            <option value="manager" ${rowData.role === 'manager' ? 'selected' : ''}>Manager (ผู้จัดการ)</option>
            <option value="hr" ${rowData.role === 'hr' ? 'selected' : ''}>HR (ฝ่ายบุคคล)</option>
            <option value="director" ${rowData.role === 'director' ? 'selected' : ''}>Director (ผู้บริหาร)</option>
          </select>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">รีเซ็ตรหัสผ่าน (ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)</label>
          <input type="text" id="edit_field_password" placeholder="ตั้งรหัสใหม่ที่นี่" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
        </div>
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">รููปโปรไฟล์ (URL สำหรับวางทับรูปเดิม)</label>
          <input type="text" id="edit_field_profile_url" value="${rowData.profile_image_url || ''}" placeholder="ใส่ลิงก์รูปใหม่ที่นี่" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 3fr; gap: 16px; margin-top: 12px;">
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">คำนำหน้า</label>
          <select id="edit_field_prefix" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
            <option value="นาย" ${prefix==='นาย'?'selected':''}>นาย</option>
            <option value="น.ส." ${prefix==='น.ส.'?'selected':''}>น.ส.</option>
            <option value="นาง" ${prefix==='นาง'?'selected':''}>นาง</option>
          </select>
        </div>
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ชื่อ - นามสกุลจริง</label>
          <input type="text" id="edit_field_full_name" value="${fName}" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px;">
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ฝ่าย / แผนก</label>
          <select id="edit_field_department_id" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">${deptOptions}</select>
        </div>
        <div class="form-group">
          <label style="display:block; margin-bottom:6px; color:#94a3b8; font-size:13px;">ตำแหน่งงาน</label>
          <select id="edit_field_position_id" style="width:100%; padding:10px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:6px;">${posOptions}</select>
        </div>
      </div>
    `;
  } else {
    let html = '';
    for (const key in rowData) {
      if (typeof rowData[key] === 'object' && rowData[key] !== null) continue;
      const val = rowData[key] !== null ? rowData[key] : '';
      if (key === 'id' || key === 'created_at') {
        html += `<div class="form-group" style="margin-bottom: 12px;"><label style="display:block; margin-bottom:4px;">${key.toUpperCase()} <span style="color:#ef4444;">(ล็อค)</span></label>
          <input type="text" value="${val}" disabled style="width:100%; padding:8px; opacity:0.6; cursor:not-allowed; background:#27272a; border:1px solid #3f3f46; color:#fff; border-radius:4px;"></div>`;
      } else {
        html += `<div class="form-group" style="margin-bottom: 12px;"><label style="display:block; margin-bottom:4px;">${key.toUpperCase()}</label>
          <input type="text" id="edit_field_${key}" value="${val}" style="width:100%; padding:8px; background:#18181b; border:1px solid #3f3f46; color:#fff; border-radius:4px;"></div>`;
      }
    }
    modalBody.innerHTML = html;
  }
  
  const footer = document.querySelector(".modal-footer");
  if (footer) {
    footer.innerHTML = `
      <button class="action-btn btn-outline" style="padding:8px 16px; cursor:pointer;" onclick="closeDataModal()">ยกเลิก</button>
      <button class="action-btn" style="padding:8px 16px; background: var(--color-warn, #fbbf24); color: #000; border: none; font-weight:bold; cursor:pointer;" onclick="saveDynamicEdit('${table}', ${index})">
        <span class="material-symbols-outlined icon-sm">save</span> บันทึกการแก้ไข
      </button>
    `;
  }
  
  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("active"), 10);
}

async function saveDynamicEdit(table, index) {
  const oldData = currentTableData[index];
  if (!oldData) return;
  const updatePayload = {};
  
  if (table === "employees" && document.getElementById("edit_field_full_name")) {
    const prefix = document.getElementById("edit_field_prefix")?.value || "";
    const fName = document.getElementById("edit_field_full_name")?.value.trim() || "";
    updatePayload.full_name = `${prefix}${fName}`;
    updatePayload.role = document.getElementById("edit_field_role")?.value;
    updatePayload.department_id = document.getElementById("edit_field_department_id")?.value || null;
    updatePayload.position_id = document.getElementById("edit_field_position_id")?.value || null;
    
    const newPass = document.getElementById("edit_field_password")?.value.trim();
    if (newPass) updatePayload.password = newPass;

    const newProfile = document.getElementById("edit_field_profile_url")?.value.trim();
    if (newProfile !== undefined) updatePayload.profile_image_url = newProfile;
  } else {
    for (const key in oldData) {
      if (key !== 'id' && key !== 'created_at' && typeof oldData[key] !== 'object') {
        const inputEl = document.getElementById(`edit_field_${key}`);
        if (inputEl) {
          let newVal = inputEl.value;
          if (newVal === "" && oldData[key] === null) continue;
          if (typeof oldData[key] === 'number') newVal = newVal === "" ? null : Number(newVal);
          else if (typeof oldData[key] === 'boolean') newVal = (newVal.toLowerCase() === 'true');
          updatePayload[key] = newVal;
        }
      }
    }
  }

  try {
    const client = getSupabaseClient();
    if (!client) throw new Error("ไม่พบ Supabase Client");

    const { error } = await client.from(table).update(updatePayload).eq('id', oldData.id);
    if (error) throw error;
    alert(`✅ อัปเดตข้อมูลเรียบร้อย!`);
    closeDataModal();
    loadTableData(); 
  } catch (err) {
    alert(`❌ ไม่สามารถแก้ไขได้: ${err.message}`);
  }
}

function closeDataModal() {
  const modal = document.getElementById("dataModal");
  if (modal) {
    modal.classList.remove("active");
    setTimeout(() => modal.style.display = "none", 200);
  }
}

// ===================================================================
// 🔐 7. SYSTEM RESET & VERIFICATION SYSTEM
// ===================================================================
let currentStep = 1;

function openResetModal() {
  currentStep = 1;
  const modal = document.getElementById('crypto-reset-modal');
  if (modal) modal.style.display = 'flex';
  resetModalState();
}

function closeResetModal() {
  const modal = document.getElementById('crypto-reset-modal');
  if (modal) modal.style.display = 'none';
  console.warn("⚠️ [SYSTEM LOG]: รีเซ็ตโควต้าถูกยกเลิกโดยผู้ดูแลระบบ (Abort Command)");
}



function resetModalState() {
  document.querySelectorAll('.verification-step').forEach(el => el.classList.remove('active'));
  const step1 = document.getElementById('step-1-content');
  if (step1) step1.classList.add('active');
  const chk = document.getElementById('chk-understand');
  if (chk) chk.checked = false;
  const txt = document.getElementById('txt-final-verify');
  if (txt) txt.value = '';
}

function nextVerificationStep(step) {
  if (step === 1) {
    document.getElementById('step-1-content')?.classList.remove('active');
    document.getElementById('step-2-content')?.classList.add('active');
  } else if (step === 2) {
    const chk = document.getElementById('chk-understand');
    if (!chk || !chk.checked) {
      alert("❌ กรุณาติ๊กเลือกช่องยอมรับความเสี่ยงเพื่อดำเนินการต่อ!");
      return;
    }
    document.getElementById('step-2-content')?.classList.remove('active');
    document.getElementById('step-3-content')?.classList.add('active');
  }
}

// 💡 ฟังก์ชันปิด Modal ทุกตัวในหน้าเพื่อแก้ปัญหา Pop-up ซ้อน
function closeAllResetModals() {
  const modalIds = ["destructiveModal", "step2Modal", "finalConfirmModal", "resetModal"];
  modalIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  
  // ลบ class หรือ style ที่อาจค้างบังหน้าจอ
  document.body.classList.remove("modal-open");
}

// 🚀 ฟังก์ชันรีเซ็ตระบบใบลาทั้งหมด (ทั้งประวัติใบลา และ โควตาวันลา)
async function executeFinalReset() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) {
    if (typeof Swal !== "undefined") {
      Swal.fire("ข้อผิดพลาด", "ไม่พบการเชื่อมต่อ Supabase", "error");
    } else {
      alert("ไม่พบการเชื่อมต่อ Supabase");
    }
    return;
  }

  // 1. ปิด Modal ที่เปิดค้างไว้ทันทีเพื่อไม่ให้บัง SweetAlert
  closeAllResetModals();

  // 2. แสดงสถานะกำลังทำงาน
  if (typeof Swal !== "undefined") {
    Swal.fire({
      title: "🔥 กำลังล้างระบบใบลาทั้งหมด...",
      text: "ระบบกำลังลบประวัติการลาและคืนค่าโควตาวันลา กรุณารอซักครู่",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
  }

  try {
    // ------------------------------------------------------------------
    // STEP 1: ลบรายการใบลาทั้งหมดในตาราง `leave_requests`
    // ------------------------------------------------------------------
    console.log("🧹 กำลังลบประวัติใบลาใน leave_requests...");
    const { error: deleteReqError } = await sb
      .from("leave_requests")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // เงื่อนไขลบทุกแถวที่มีในระบบ

    if (deleteReqError) {
      console.error("❌ เกิดข้อผิดพลาดขณะลบ leave_requests:", deleteReqError);
      throw new Error(`ไม่สามารถลบประวัติใบลาได้: ${deleteReqError.message}`);
    }

    // ------------------------------------------------------------------
    // STEP 2: รีเซ็ตโควตาวันลาในตาราง `leave_balances`
    // ------------------------------------------------------------------
    console.log("🔄 กำลังรีเซ็ตโควตาใน leave_balances...");
    
    // ดึงโควตาวันลาทั้งหมดเพื่อเอาสิทธิ์ตั้งต้น (entitlement_days)
    const { data: balances, error: fetchBalError } = await sb
      .from("leave_balances")
      .select("id, entitlement_days");

    if (fetchBalError) throw fetchBalError;

    // อัปเดต used_days = 0 และ remaining_days = entitlement_days
    if (balances && balances.length > 0) {
      for (const item of balances) {
        const { error: updateError } = await sb
          .from("leave_balances")
          .update({
            used_days: 0,
            remaining_days: item.entitlement_days || 0
          })
          .eq("id", item.id);

        if (updateError) throw updateError;
      }
    }

    // ------------------------------------------------------------------
    // STEP 3: แจ้งเตือนเมื่อทำงานเสร็จสมบูรณ์
    // ------------------------------------------------------------------
    console.log("✅ ล้างระบบสำเร็จเรียบร้อย!");

    if (typeof Swal !== "undefined") {
      await Swal.fire({
        icon: "success",
        title: "ล้างระบบสำเร็จ!",
        text: "ลบประวัติการลาทั้งหมด และรีเซ็ตโควตาวันลาพนักงานทุกคนเรียบร้อยแล้ว",
        confirmButtonText: "ตกลง"
      });
    } else {
      alert("ล้างระบบสำเร็จ! ลบประวัติการลาและรีเซ็ตโควตาเรียบร้อยแล้ว");
    }

    // รีโหลดหน้าเว็บเพื่อให้ตารางอัปเดตข้อมูลใหม่
    location.reload();

  } catch (err) {
    console.error("🚨 Critical Error executing reset:", err);
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาดในการรีเซ็ต",
        text: err.message
      });
    } else {
      alert(`เกิดข้อผิดพลาด: ${err.message}`);
    }
  }
}
// ===================================================================
// 📌 8. USER VISIT & REALTIME LOGGER (ส่วนที่แก้ไขหลัก)
// ===================================================================
async function logUserVisit() {
  try {
    const client = getSupabaseClient();
    if (!client) return;

    let userName = "Guest/Admin";
    if (window.pvtSupabase?.getCurrentProfile) {
      const profile = await window.pvtSupabase.getCurrentProfile();
      if (profile) {
        userName = profile.display_name || profile.full_name || profile.email || "Admin User";
      }
    }

    await client.from("user_activity_logs").insert([
      {
        user_name: userName,
        page_url: window.location.pathname || "admin.html",
        action_type: "VISIT",
        description: "เข้าสู่หน้าจอ Admin Control Console"
      }
    ]);
    pushLog(`บันทึกการเข้าชมหน้าเว็บของผู้ใช้ (${userName}) เรียบร้อย`, "info");
  } catch (err) {
    console.warn("⚠️ ไม่สามารถบันทึกประวัติการเข้าชมได้:", err.message);
  }
}

function initAdminRealtimeLogger() {
  const client = getSupabaseClient();
  if (!client) {
    console.warn("⚠️ ไม่พบ Supabase Client สำหรับ Realtime Logger");
    return;
  }

  client
    .channel('admin-live-logs')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'user_activity_logs' },
      (payload) => {
        const newLog = payload.new || {};

        if (typeof Swal !== 'undefined') {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: '🔔 ผู้ใช้งานเข้าสู่ระบบ/เปิดหน้าเว็บ',
            html: `<b>${newLog.user_name || 'User'}</b> กำลังเปิดหน้า: <code>${newLog.page_url || ''}</code>`,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true
          });
        }

        const logTableBody = document.getElementById('auditLogsTableBody');
        if (logTableBody) {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${newLog.created_at ? new Date(newLog.created_at).toLocaleTimeString('th-TH') : new Date().toLocaleTimeString('th-TH')}</td>
            <td>👤 ${newLog.user_name || '-'}</td>
            <td><span class="table-code">${newLog.page_url || '-'}</span></td>
            <td><span class="badge">${newLog.action_type || 'VISIT'}</span></td>
            <td>${newLog.description || '-'}</td>
          `;
          logTableBody.insertBefore(row, logTableBody.firstChild);
        }
      }
    )
    .subscribe();
}

// ===================================================================
// 🚀 9. MASTER INITIALIZER (รวมเหตุการณ์ DOMReady ทั้งหมดให้เสถียร)
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  pushLog("กำลังเริ่มต้นเชื่อมต่อสารบบเซิร์ฟเวอร์หลังบ้าน...", "info");
  
  // 1. ตรวจสอบสถานะ Server และ WebSocket
  executeTelemetryCycle();
  setupRealtimeAuditStream();
  initAdminRealtimeLogger();
  
  // 2. บันทึกและดึงข้อมูลพื้นฐาน
  logUserVisit();
  setTimeout(loadTableData, 500); 

  // 3. ลูปทำงานเบื้องหลังอัตโนมัติ
  setInterval(executeTelemetryCycle, 30000); 
});