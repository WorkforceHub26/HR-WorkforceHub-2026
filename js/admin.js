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

const sbTelemetryClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let globalSystemLogs = [];
let searchTerm = "";

function pushLog(message, level = "info") {
  const container = document.getElementById("debugLogContainer");
  if (!container) return;
  const timestamp = new Date().toLocaleTimeString();
  globalSystemLogs.push({ timestamp, message, level });
  
  if (searchTerm === "" || message.toLowerCase().includes(searchTerm.toLowerCase())) {
    let cssClass = level === "error" ? "log-error" : level === "success" ? "log-success" : level === "warn" ? "log-warn" : "log-info";
    container.innerHTML += `<span class="log-row ${cssClass}">[${timestamp}] [${level.toUpperCase()}]: ${message}</span>`;
    container.scrollTop = container.scrollHeight;
  }
}

// ===================================================================
// 🟢 3. REALTIME AUDIT LOGS ENGINE (ระบบฟังเสียงความเคลื่อนไหวพนักงาน)
// ===================================================================
document.addEventListener("DOMContentLoaded", () => {
  pushLog("กำลังเริ่มต้นเชื่อมต่อสารบบเซิร์ฟเวอร์หลังบ้าน...", "info");
  executeTelemetryCycle();
  setupRealtimeAuditStream();
  setInterval(executeTelemetryCycle, 30000); // เช็คสุขภาพเซิร์ฟเวอร์ทุกๆ 30 วิ
});

// ฟังก์ชันเปิดท่อ WebSocket เรียลไทม์
function setupRealtimeAuditStream() {
  pushLog("กำลังเปิดโครงข่ายท่อ WebSocket เชื่อมตรงตารางประวัติพฤติกรรม...", "info");

  const channel = sbTelemetryClient
    .channel('public:user_activity_logs')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity_logs' }, (payload) => {
      pushLog(`🚨 มีกิจกรรมใหม่จากผู้ใช้: ${payload.new.user_name} -> ${payload.new.description}`, "success");
      insertRowToAuditTable(payload.new, true); // แทรกแถวใหม่แบบไฮไลท์สีเขียวแวบๆ ทันทีบนจอ
    })
    .subscribe((status) => {
      const rtEl = document.getElementById("realtimeStatus");
      if (status === 'SUBSCRIBED') {
        if (rtEl) { rtEl.className = "metric-value text-success"; rtEl.innerText = "LIVE STREAM"; }
        pushLog("🌐 เชื่อมต่อท่อ Realtime WebSocket สำเร็จ! สแตนด์บายดักฟังคนกดปุ่มแก้ไขระบบแล้วครับ", "success");
        fetchInitialAuditLogs(); // ดึงอดีตที่เคยบันทึกมาโชว์รอก่อน
      } else {
        if (rtEl) { rtEl.className = "metric-value text-error"; rtEl.innerText = "DISCONNECTED"; }
      }
    });
}

// ฟังก์ชันดึงข้อมูลล็อกในอดีตมาแสดงขึ้นตารางเป็นฐานข้อมูลเบื้องต้น
async function fetchInitialAuditLogs() {
  try {
    const { data, error } = await sbTelemetryClient
      .from("user_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15); // ดึงล่าสุดมา 15 รายการ

    if (error) throw error;

    const tbody = document.getElementById("auditLogsTableBody");
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b;">📭 ยังไม่มีข้อมูลประวัติผู้ใช้งานในฐานข้อมูล (รอการเขียนมาจากฝั่งผู้ใช้)</td></tr>`;
      return;
    }

    tbody.innerHTML = ""; // ล้างแถวรอโหลด
    data.forEach(log => insertRowToAuditTable(log, false));
    pushLog("โหลดประวัติการใช้งานในอดีตขึ้นตารางหลักเรียบร้อย", "info");

  } catch (err) {
    pushLog(`ไม่สามารถโหลดประวัติผู้ใช้ได้: ${err.message}`, "error");
  }
}

// ฟังก์ชันแทรกข้อมูลลงตารางหน้าเว็บ HTML
function insertRowToAuditTable(log, isNewArrival = false) {
  const tbody = document.getElementById("auditLogsTableBody");
  if (!tbody) return;

  const timeStr = new Date(log.created_at).toLocaleTimeString();
  
  // ตกแต่งสีสันตามประเภทพฤติกรรม
  let actionBadgeColor = "#4b5563"; 
  if (log.action_type === "INSERT") actionBadgeColor = "#16a34a"; // เพิ่มข้อมูล = เขียว
  if (log.action_type === "UPDATE") actionBadgeColor = "#ca8a04"; // แก้ไข = ส้ม
  if (log.action_type === "DELETE") actionBadgeColor = "#dc2626"; // ลบ = แดง

  const rowHtml = `
    <tr style="${isNewArrival ? 'background: #064e3b; transition: background 1s ease;' : ''}">
      <td style="font-family: 'JetBrains Mono', monospace; color: #9ca3af;">${timeStr}</td>
      <td><strong>👤 ${log.user_name}</strong></td>
      <td><span class="table-code" style="color: #a7f3d0; background:#1f2937;">${log.page_url}</span></td>
      <td><span style="background: ${actionBadgeColor}; color:#fff; padding: 2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${log.action_type}</span></td>
      <td style="color: #e5e7eb;">${log.description}</td>
    </tr>
  `;

  if (isNewArrival) {
    tbody.innerHTML = rowHtml + tbody.innerHTML; // แทรกบนสุด
    // ทำเอฟเฟกต์สีเขียววาบจางลงหลัง 2 วินาทีเพื่อให้รู้ว่ามีคนกดสดๆ
    setTimeout(() => {
      const firstRow = tbody.querySelector("tr");
      if (firstRow) firstRow.style.background = "transparent";
    }, 2000);
  } else {
    tbody.innerHTML += rowHtml; // ต่อท้ายตอนโหลดอดีต
  }
}

// ===================================================================
// 📊 4. CORE SYSTEM HEALTH TELEMETRY (ตรวจสุขภาพฐานข้อมูลทั่วไป)
// ===================================================================
async function executeTelemetryCycle() {
  const startTime = Date.now();
  const refreshTimeEl = document.getElementById("lastRefreshTime");
  if (refreshTimeEl) refreshTimeEl.innerText = `REFRESH: ${new Date().toLocaleTimeString()}`;

  try {
    const { error: pErr } = await sbTelemetryClient.from("leave_types").select("id").limit(1);
    const latency = Date.now() - startTime;
    const pingEl = document.getElementById("pingStatus");
    
    if (pErr) {
      if(pingEl) { pingEl.className = "metric-value text-error"; pingEl.innerText = "CRASH / DOWN"; }
    } else {
      if(pingEl) { pingEl.className = "metric-value text-success"; pingEl.innerText = `${latency} ms`; }
    }

    // นับจำนวนแถวสะสมรวมในฐานข้อมูลหลัก
    const tablesToScan = ["employees", "leave_types", "leave_balances", "leave_requests", "user_activity_logs"];
    let combinedTotalRows = 0;
    for (const tableName of tablesToScan) {
      const { count } = await sbTelemetryClient.from(tableName).select("*", { count: "exact", head: true });
      combinedTotalRows += (count || 0);
    }
    const dbSizeEl = document.getElementById("dbSizeStatus");
    if (dbSizeEl) dbSizeEl.innerText = `${combinedTotalRows} ROWS`;

    // เช็คสิทธิ์ RLS
    const rlsEl = document.getElementById("rlsStatus");
    const { error: rlsErr } = await sbTelemetryClient.from("leave_balances").select("id").limit(1);
    if (rlsEl) {
      rlsEl.className = rlsErr && rlsErr.message.includes("policy") ? "metric-value text-error" : "metric-value text-success";
      rlsEl.innerText = rlsErr && rlsErr.message.includes("policy") ? "SECURE 🔐" : "OPEN 🔓";
    }
  } catch (err) {
    pushLog(`ลูปสแกนระบบหลักมีอาการรวน: ${err.message}`, "error");
  }
}

// ค้นหา Log ทั่วไป
function handleLogSearch() {
  const input = document.getElementById("logSearchInput");
  searchTerm = input ? input.value : "";
  const container = document.getElementById("debugLogContainer");
  if (!container) return;
  container.innerHTML = "";
  globalSystemLogs.forEach(log => {
    if (searchTerm === "" || log.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      let cssClass = log.level === "error" ? "log-error" : log.level === "success" ? "log-success" : "log-info";
      container.innerHTML += `<span class="log-row ${cssClass}">[${log.timestamp}] [${log.level.toUpperCase()}]: ${log.message}</span>`;
    }
  });
}
function clearConsoleLog() { globalSystemLogs = []; document.getElementById("debugLogContainer").innerHTML = ""; }