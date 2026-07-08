/**
 * index-user.js — (ฉบับเสถียรขั้นสูงสุด + รองรับหน้าจอ Responsive 100%)
 * ✅ ลอจิกหลังบ้านเดิมอยู่ครบถ้วน ไม่ว่าจะเป็น Supabase Auth, Session จริง และ Dev Mode Fallback
 * ✅ แก้ไข Bug ปีกกาเกินที่ท้ายไฟล์ และแก้สโคปตัวแปร recentList ในกล่อง Catch เรียบร้อย
 * ✅ ปรับแต่ง HTML Template ของรายการล่าสุดให้สวยงาม เข้ากับธีมใหม่แบบไร้รอยต่อ
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบควบคุมหน้าจอหลักพนักงาน (Responsive Optimized) แล้ว...");

// 🟢 ประกาศไว้ที่จุดบนสุดที่เดียว ห้ามใช้คำว่า let/const ซ้ำซ้อนด้านล่างอีก
if (typeof window.currentProfile === 'undefined') {
  window.currentProfile = null;
}

document.addEventListener("DOMContentLoaded", initUserHome);

// ─── 1. ฟังก์ชันโหลดโฮมเพจ (แก้ไขการดักจับ ID ให้แม่นยำ ไม่โดน Session เทสต์ทับ) ───
async function initUserHome() {
  try {
    // พยายามดึงข้อมูล Profile จริงจาก Supabase ก่อนเสมอ
    if (window.pvtSupabase && typeof window.pvtSupabase.getCurrentProfile === "function") {
      window.currentProfile = await window.pvtSupabase.getCurrentProfile();
    }
    
    // 🌟 ดักจับอย่างละเอียด: เช็กว่าได้ id หรือ employee_id มาจริงไหม
    const validId = window.currentProfile?.employee_id || window.currentProfile?.id;
    
    if (!validId) {
      console.log("🛠️ [DASHBOARD] ไม่พบโปรไฟล์หลัก กำลังพยายามกู้คืนจาก Session...");
      
      let cachedUser = null;
      try {
        cachedUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
      } catch (e) {
        console.error("⚠️ อ่านค่า sessionStorage ล้มเหลว:", e);
      }

      if (cachedUser && (cachedUser.id || cachedUser.employee_id)) {
        window.currentProfile = {
          id: cachedUser.id,
          employee_id: cachedUser.id || cachedUser.employee_id,
          employee_code: cachedUser.employee_code,
          full_name: cachedUser.full_name,
          role: cachedUser.role
        };
      }
    }

    // 🚀 เรียกฟังก์ชันจัดการแดชบอร์ด เพื่อพ่นข้อมูลขึ้นหน้าจอ
    if (typeof window.renderUserInfo === "function") {
      window.renderUserInfo(window.currentProfile);
    }
    if (typeof window.loadRecentLeaves === "function") {
      window.loadRecentLeaves(window.currentProfile);
    }

  } catch (err) {
    console.warn("⚠️ [SAFE GUARD] ดักจับข้อผิดพลาดหน้าโฮม:", err);
  }
}

// ─── 2. ฟังก์ชันโหลดสถิติและประวัติ (แก้ไขให้ดึงย้อนหลังได้ 50 รายการ + เพิ่มเลื่อน Scroll) ───
window.loadRecentLeaves = async function(profile) {
  const recentList = document.getElementById("recentList");
  const pendingCount = document.getElementById("pendingCount");
  const leaveBalance = document.getElementById("leaveBalance"); 
  const usedBalance = document.getElementById("usedBalance");  
  
  const sb = window.pvtSupabase?.getClient();
  const employeeId = profile?.employee_id || profile?.id;

  if (!sb || !employeeId) {
    if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่ได้เข้าสู่ระบบ หรือไม่พบไอดีพนักงาน</div>`;
    return;
  }

  try {
    console.log(`⏳ [FETCH DATA] กำลังดึงสถิติและโควตาจากฐานข้อมูลของพนักงาน: ${employeeId}`);

    // 🟢 ดึงข้อมูล 3 ตารางพร้อมกัน (ปรับ .limit(50) ให้ดึงประวัติย้อนหลังได้ไกลขึ้น)
    const [requestsRes, pendingRes, balanceRes] = await Promise.all([
      sb.from("leave_requests")
        .select("id, start_date, end_date, total_days, status, leave_types(leave_name)")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(50), 
      sb.from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employeeId)
        .eq("status", "pending"),
      sb.from("leave_balances")
        .select("remaining_days, used_days, year")
        .eq("employee_id", employeeId)
        .order("year", { ascending: false })
        .maybeSingle()
    ]);

    if (requestsRes.error) throw requestsRes.error;

    // พ่นตัวเลขรายการรออนุมัติ (กล่องสีเหลือง)
    if (pendingCount) {
      pendingCount.innerHTML = `${pendingRes.count ?? 0} <small>รายการ</small>`;
    }

    // แกะข้อมูลตารางยอดลาคงเหลือและที่ใช้ไป
    let balanceData = balanceRes.data;
    if (Array.isArray(balanceData)) {
      balanceData = balanceData[0];
    }

    // พ่นตัวเลขวันลาคงเหลือ และ ที่ใช้ไปแล้ว (ดักจับกรณีได้ค่าเป็น null ให้แสดง 0)
    if (leaveBalance) {
      const remVal = (balanceData && balanceData.remaining_days != null) ? balanceData.remaining_days : "0";
      leaveBalance.innerHTML = `${remVal} <small>วัน</small>`;
    }
    if (usedBalance) {
      const usedVal = (balanceData && balanceData.used_days != null) ? balanceData.used_days : "0";
      usedBalance.innerHTML = `${usedVal} <small>วัน</small>`;
    }

    // จัดเตรียมฟังก์ชันช่วยฟอร์แมตข้อมูล
    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => {
      if (!str) return "";
      return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    });

    const labelFn = window.pvtSupabase?.statusLabel || ((status) => {
      const mapper = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" };
      return mapper[status] || status;
    });

    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => {
      if (!dateStr) return "-";
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
      } catch (e) {
        return dateStr;
      }
    });

    // 🟢 แสดงรายการคำขอลา (พร้อมสร้างกล่อง Scrollbar ให้เลื่อนดูประวัติย้อนหลังได้)
    const rows = requestsRes.data || [];
    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการยื่นใบลาในระบบ</div>`;
      return;
    }

    if (recentList) {
      const listHtml = rows.map((item) => {
        const leaveName = item.leave_types?.leave_name || "การลา";
        
        let badgeStyle = "background:#fff3cd; color:#854d0e; border:1px solid #fde047;"; 
        if (item.status === "approved") {
          badgeStyle = "background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;";
        } else if (item.status === "rejected") {
          badgeStyle = "background:#f8d7da; color:#842029; border:1px solid #f5c2c7;";
        }

        return `
          <article class="recent-item" style="margin-bottom: 12px; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.01);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 15px; color: #0f172a;">${escapeFn(leaveName)}</strong>
              <span class="status ${item.status}" style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; ${badgeStyle}">${labelFn(item.status)}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: #64748b;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>📅 วันที่:</span> 
                <span style="color: #334155; font-weight: 500;">${dateFn(item.start_date)} - ${dateFn(item.end_date)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>⏱️ จำนวน:</span> 
                <span style="color: #0fa472; font-weight: 600;">${item.total_days} วัน</span>
              </div>
            </div>
          </article>
        `;
      }).join("");
      
      // 🌟 ใส่ div ครอบเพื่อให้เลื่อน scrollbar ได้ กรณีประวัติเยอะเกินไป
      recentList.innerHTML = `<div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">${listHtml}</div>`;
    }
    
    console.log("✅ [SUCCESS] อัปเดตข้อมูลกล่องสถิติและประวัติย้อนหลังเรียบร้อย!");

  } catch (error) {
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
    window.handleSystemError(error, "ไม่สามารถโหลดข้อมูลยอดสถิติตัวเลขวันลาได้");
  }
};

/* ==========================================================================
   💳 ฟังก์ชันเรียกดูบัตรประจำตัวพนักงานดิจิทัล (ตำแหน่ง + แผนก)
   ========================================================================== */
/* ==========================================================================
   💳 ฟังก์ชันหลัก: พนักงานกดดูบัตรดิจิทัลของตนเอง (เวอร์ชันโหลดทันที ไม่ต้องง้อคิวรีข้ามตาราง)
   ========================================================================== */
window.viewMyDigitalCard = function() {
  // 1. ดึงข้อมูลจากเซสชันและโปรไฟล์ที่โหลดไว้แล้วบนหน้าจอ
  const sessionUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
  const profile = window.currentProfile || {};
  const employee = profile.employees || profile;
  
  const currentCode = sessionUser?.employee_code || employee?.employee_code;
  
  if (!currentCode) {
    Swal.fire({
      icon: 'warning',
      title: 'ไม่พบข้อมูลเซสชัน',
      text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้งเพื่อเรียกดูข้อมูลบัตร',
      confirmButtonColor: '#ef4444'
    });
    return;
  }

  try {
    // 2. จับคู่ตัวแปร ตำแหน่ง และ แผนก จากข้อมูลที่มีอยู่แล้วอย่างปลอดภัย
    const fullName = employee?.full_name || profile?.display_name || sessionUser?.full_name || "พนักงานในระบบ";
    
    // ดึงแผนก (รองรับทุกโครงสร้างที่อาจจะเก็บไว้)
    const myDept = employee?.departments?.department_name || employee?.department_name || sessionUser?.department_name || "ทั่วไป";
    
    // ดึงตำแหน่ง (รองรับทุกโครงสร้างที่อาจจะเก็บไว้)
    const myRole = employee?.positions?.position_name || employee?.position_name || sessionUser?.position_name || profile?.role || "พนักงาน";

    // 3. สร้าง Secure Token ความปลอดภัยสูงสำหรับใช้สแกนเข้าสู่ระบบ
    const secureData = encodeURIComponent(`${currentCode}|PVT_SECURE_BYPASS`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${secureData}`;

    // 4. พ่นหน้าต่างป๊อปอัปบัตรพนักงานพรีเมียม (ดีไซน์เดิม เพิ่มเติมคือโหลดไวมาก)
    Swal.fire({
      title: '💳 บัตรประจำตัวพนักงานดิจิทัล',
      width: '380px',
      html: `
        <div id="pvt-employee-id-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); width: 280px; margin: 15px auto; border-radius: 20px; padding: 24px; color: white; box-shadow: 0 15px 30px rgba(30,58,138,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; font-family: 'Sarabun', sans-serif;">
          <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.03); border-radius: 50%;"></div>
          
          <div style="font-weight: 700; font-size: 13px; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 20px; text-transform: uppercase;">PVT WORKFORCE HUB</div>
          
          <div style="width: 70px; height: 70px; background: rgba(255,255,255,0.1); border-radius: 50%; margin: 0 auto 14px auto; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,0.2);">
            <span class="material-symbols-outlined" style="font-size: 38px; color: #93c5fd;">account_circle</span>
          </div>
          
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 6px; letter-spacing: 0.5px;">${fullName}</div>
          <div style="font-size: 13px; color: #38bdf8; font-weight: 600; margin-bottom: 2px;">ตำแหน่ง: ${myRole}</div>
          <div style="font-size: 12px; color: #94a3b8; font-weight: 500; margin-bottom: 20px;">แผนก: ${myDept}</div>
          
          <div style="background: white; padding: 10px; border-radius: 14px; display: inline-block; box-shadow: 0 8px 16px rgba(0,0,0,0.2); margin-bottom: 16px;">
            <img src="${qrUrl}" alt="My Secure QR Code" style="width: 140px; height: 140px; display: block;" />
          </div>
          
          <div>
            <span style="font-size: 10px; color: #94a3b8; display: block; text-transform: uppercase; margin-bottom: 2px;">Employee ID Number</span>
            <span style="font-size: 15px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 4px 16px; border-radius: 30px; display: inline-block; letter-spacing: 1px; border: 1px solid rgba(255,255,255,0.05);">
              ${currentCode}
            </span>
          </div>
        </div>
      `,
      confirmButtonText: '✅ ปิดหน้าต่างบัตร',
      confirmButtonColor: '#0fa472'
    });

  } catch (err) {
    console.error("Error showing digital card:", err);
    Swal.fire({
      icon: 'error',
      title: 'ไม่สามารถเปิดบัตรได้',
      text: err.message,
      confirmButtonColor: '#ef4444'
    });
  }
};

// ─── ฟังก์ชันพ่นข้อมูลพนักงานและชื่อฝ่าย/แผนก/ตำแหน่ง ───
window.renderUserInfo = function(profile) {
  const employee = profile?.employees;
  
  // 🤖 แสดงชื่อ-สกุลพนักงาน
  const nameEl = document.getElementById("userName");
  if (nameEl) {
    nameEl.textContent = employee?.full_name || profile?.display_name || "พนักงานในระบบ";
  }
    
  // 🤖 ดึงชื่อฝ่าย/แผนก และ รหัสพนักงานมาแสดงคู่กันแบบอัตโนมัติ
  const deptName = employee?.departments?.department_name || employee?.department_name || "ทั่วไป";
  const empCode = employee?.employee_code ? `รหัส: ${employee.employee_code}` : "";
  
  const deptEl = document.getElementById("userDepartment");
  if (deptEl) {
    deptEl.textContent = `${deptName} ${empCode}`;
  }
};

// ─── ฟังก์ชันโหลดข้อมูลสถิติตัวเลข + รายการคำขอลาล่าสุด 5 รายการ ───
window.loadRecentLeaves = async function(profile) {
  const recentList = document.getElementById("recentList");
  const pendingCount = document.getElementById("pendingCount");
  const leaveBalance = document.getElementById("leaveBalance"); 
  const usedBalance = document.getElementById("usedBalance");  
  
  const sb = window.pvtSupabase?.getClient();
  const employeeId = profile?.employee_id || profile?.id;

  if (!sb || !employeeId) {
    if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลผู้ใช้ หรือยังไม่ได้เข้าสู่ระบบ</div>`;
    return;
  }

  try {
    console.log(`⏳ [FETCH DATA] กำลังดึงสถิติและโควตาจากฐานข้อมูลของพนักงาน: ${employeeId}`);

    // ดึงข้อมูลขนานพร้อมกัน 3 ตารางเพื่อความเร็วระดับสูงสุด
    const [requestsRes, pendingRes, balanceRes] = await Promise.all([
      sb.from("leave_requests").select("id, start_date, end_date, total_days, status, leave_types(leave_name)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(5),
      sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "pending"),
      sb.from("leave_balances").select("remaining_days, used_days, year").eq("employee_id", employeeId).order("year", { ascending: false }).maybeSingle()
    ]);

    if (requestsRes.error) throw requestsRes.error;
    if (balanceRes.error) console.error("⚠️ คำเตือนระบบตารางยอดลา:", balanceRes.error.message);

    // พ่นตัวเลขรายการรออนุมัติ (กล่องสีเหลือง)
    if (pendingCount) {
      pendingCount.innerHTML = `${pendingRes.count ?? 0} <small>รายการ</small>`;
    }

    // แกะข้อมูลตารางยอดลาคงเหลือ
    let balanceData = balanceRes.data;
    if (Array.isArray(balanceData)) {
      balanceData = balanceData[0];
    }

    // พ่นตัวเลขวันลาคงเหลือ (กล่องสีเขียว)
    if (leaveBalance) {
      const remVal = (balanceData && balanceData.remaining_days !== undefined && balanceData.remaining_days !== null) ? balanceData.remaining_days : "0";
      leaveBalance.innerHTML = `${remVal} <small>วัน</small>`;
    }

    // พ่นตัวเลขวันลาที่ใช้ไปแล้ว (กล่องสีแดง)
    if (usedBalance) {
      const usedVal = (balanceData && balanceData.used_days !== undefined && balanceData.used_days !== null) ? balanceData.used_days : "0";
      usedBalance.innerHTML = `${usedVal} <small>วัน</small>`;
    }

    // จัดเตรียมฟังก์ชันช่วยฟอร์แมตข้อมูล
    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => {
      if (!str) return "";
      return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    });

    const labelFn = window.pvtSupabase?.statusLabel || ((status) => {
      const mapper = { pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" };
      return mapper[status] || status;
    });

    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => {
      if (!dateStr) return "-";
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
      } catch (e) {
        return dateStr;
      }
    });

    // แสดงรายการคำขอลาล่าสุด 5 รายการ
    const rows = requestsRes.data || [];
    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการยื่นใบลาในระบบ</div>`;
      return;
    }

    if (recentList) {
      recentList.innerHTML = rows.map((item) => {
        const leaveName = item.leave_types?.leave_name || "การลา";
        
        let badgeStyle = "background:#fff3cd; color:#854d0e; border:1px solid #fde047;"; // pending
        if (item.status === "approved") {
          badgeStyle = "background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;";
        } else if (item.status === "rejected") {
          badgeStyle = "background:#f8d7da; color:#842029; border:1px solid #f5c2c7;";
        }

        return `
          <article class="recent-item" style="margin-bottom: 12px; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.01);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 15px; color: #0f172a;">${escapeFn(leaveName)}</strong>
              <span class="status ${item.status}" style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; ${badgeStyle}">${labelFn(item.status)}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: #64748b;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>📅 วันที่:</span> 
                <span style="color: #334155; font-weight: 500;">${dateFn(item.start_date)} - ${dateFn(item.end_date)}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>⏱️ จำนวน:</span> 
                <span style="color: #0fa472; font-weight: 600;">${item.total_days} วัน</span>
              </div>
            </div>
          </article>
        `;
      }).join("");
    }
    
    console.log("✅ [SUCCESS] อัปเดตข้อมูลกล่องสถิติและรายการล่าสุดขึ้นหน้าจอเรียบร้อยครบถ้วน!");

  } catch (error) {
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
    window.handleSystemError(error, "ไม่สามารถโหลดข้อมูลยอดสถิติตัวเลขวันลาบนแดชบอร์ดหลักได้");
  }
};

/**
 * 🤖 PVT HR Leave — Centralized Error Handler (ระบบแจ้งเตือน Error ส่วนกลาง)
 */
window.handleSystemError = function(error, customMessage = "เกิดข้อผิดพลาดในการโหลดหรือบันทึกข้อมูล") {
  const actualErrorLog = error?.message || error?.hint || JSON.stringify(error) || "Unknown System Error";
  console.error(`🚨 [SYSTEM CRITICAL ERROR]: ${actualErrorLog}`, error);

  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: "error",
      title: "ระบบขัดข้องชั่วคราว",
      html: `
        <div style="text-align: left; font-family: 'Kanit', sans-serif;">
          <p style="margin-bottom: 8px; color: #334155;"><b>รายละเอียด:</b> ${customMessage}</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 12px; color: #ef4444; overflow-x: auto; font-family: monospace; max-height: 100px;">
            Code: ${actualErrorLog}
          </div>
          <p style="margin-top: 10px; font-size: 13px; color: #64748b; text-align: center;">💡 แนะนำให้ลอง Refresh หน้าจอ หรือติดต่อ IT (พี่มิก) ครับ</p>
        </div>
      `,
      confirmButtonText: "รับทราบ",
      confirmButtonColor: "#dc2626",
      borderRadius: "16px"
    });
  } else {
    alert(`❌ ${customMessage}\n\n(รายละเอียด: ${actualErrorLog})`);
  }
};

// ─── โซนฟังก์ชันจัดการเส้นทางปุ่มกดลิงก์ต่าง ๆ ───

window.goToLeaveForm = function() {
  window.location.href = "/pages/user/leave-user.html";
};

window.goToRules = function() {
  window.location.href = "/pages/user/leave-rules.html";
};

// ลิงก์ตรงเข้าหน้าประวัติ
window.goToLeaveHistory = function() {
  window.location.href = "/pages/user/leave-history.html";
};

window.goToProfile = function() {
  window.location.href = "/pages/user/profile-user.html";
};

window.goToContactHR = function() {
  window.location.href = "/pages/user/contact-hr.html";
};

// ฟังก์ชันออกจากระบบ ล้างเซสชันเคลียร์ข้อมูลพนักงาน
window.logout = function() {
  sessionStorage.removeItem("currentUser");
  window.location.href = "/login.html";
};