/**
 * index-user.js — (ฉบับสมบูรณ์ + ล็อกปุ่มกดลาถ้าว้นลาเหลือ 0 วัน + ระบบ Log ครบถ้วน)
 */

console.log("📢 [SYSTEM] เริ่มต้นโหลดสคริปต์หน้าจอพนักงาน (พร้อมระบบตรวจสอบโควตาวันลาหมด)...");

// 🛠️ 1. สคริปต์พิเศษ: บังคับล้างแคชและดึงไฟล์ CSS ใหม่ล่าสุดเสมอ
(function forceLoadNewCSS() {
  console.log("🔍 [DEBUG-CSS] กำลังค้นหาไฟล์ CSS ในหน้าเว็บเพื่อบังคับอัปเดตดีไซน์...");
  const links = document.getElementsByTagName('link');
  let found = false;
  
  for (let i = 0; i < links.length; i++) {
    if (links[i].rel === 'stylesheet' && links[i].href.includes('index-user.css')) {
      const oldHref = links[i].href.split('?')[0]; 
      const newHref = `${oldHref}?v=${new Date().getTime()}`; 
      links[i].href = newHref;
      console.log(`✅ [DEBUG-CSS] เจอไฟล์แล้ว! สั่งบังคับโหลดดีไซน์ใหม่ที่: ${newHref}`);
      found = true;
    }
  }
  if (!found) console.warn("⚠️ [DEBUG-CSS] หาแท็ก link index-user.css ไม่เจอใน HTML!");
})();

// 🟢 ประกาศตัวแปร Global ไว้อย่างปลอดภัย
if (typeof window.currentProfile === 'undefined') {
  window.currentProfile = null;
}
// ตัวแปรสำหรับเก็บโควตาวันลาคงเหลือ เอาไว้เช็กตอนกดปุ่มลา
if (typeof window.remainingDays === 'undefined') {
  window.remainingDays = 0; 
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("📌 [LIFECYCLE] โครงสร้าง HTML โหลดเสร็จแล้ว กำลังเรียกฟังก์ชัน initUserHome()");
  initUserHome();
});





/* ==========================================================================
   📥 1. ฟังก์ชันโหลดโฮมเพจ (ดึงข้อมูลพนักงานตอนเข้าหน้าเว็บ)
   ========================================================================== */
async function initUserHome() {
  try {
    console.log("🔄 [INIT] เริ่มกระบวนการดึงข้อมูลโปรไฟล์พนักงาน...");

    // 1. ดึงข้อมูล Profile จาก Supabase
    if (window.pvtSupabase && typeof window.pvtSupabase.getCurrentProfile === "function") {
      window.currentProfile = await window.pvtSupabase.getCurrentProfile();
      console.log("👤 [PROFILE] ข้อมูลที่ดึงได้จากระบบล็อกอิน (Auth):", window.currentProfile);
    }
    
    // 2. ตรวจสอบว่าได้ ID พนักงานมาหรือไม่
    const validId = window.currentProfile?.employee_id || window.currentProfile?.id;
    
    // 3. ถ้าไม่ได้ ID มา ให้ไปค้นหาใน Session Storage แทน
    if (!validId) {
      console.warn("⚠️ [DASHBOARD] ไม่พบโปรไฟล์หลักจาก Auth, กำลังพยายามกู้คืนจาก Session...");
      let cachedUser = null;
      try {
        cachedUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
        console.log("📦 [SESSION] ข้อมูลที่เจอใน Session Storage:", cachedUser);
      } catch (e) {
        console.error("❌ [ERROR] อ่านค่า sessionStorage ล้มเหลว:", e);
      }

      if (cachedUser && (cachedUser.id || cachedUser.employee_id)) {
        window.currentProfile = {
          id: cachedUser.id,
          employee_id: cachedUser.id || cachedUser.employee_id,
          employee_code: cachedUser.employee_code,
          full_name: cachedUser.full_name,
          role: cachedUser.role
        };
        console.log("✅ [RECOVERY] กู้คืนโปรไฟล์จาก Session สำเร็จ:", window.currentProfile);
      } else {
        console.error("❌ [CRITICAL] ไม่พบข้อมูลทั้งใน Auth และ Session! (พนักงานอาจจะยังไม่ได้ล็อกอิน)");
      }
    }

    // 4. สั่งให้วาดข้อมูลพนักงานลงหน้าจอ
    if (typeof window.renderUserInfo === "function") {
      window.renderUserInfo(window.currentProfile);
    }
    // 5. สั่งให้ดึงประวัติการลา
    if (typeof window.loadRecentLeaves === "function") {
      window.loadRecentLeaves(window.currentProfile);
    }

  } catch (err) {
    console.error("🚨 [SAFE GUARD ERROR] ดักจับข้อผิดพลาดหน้าโฮม:", err);
  }
}

/* ==========================================================================
   🖥️ 2. ฟังก์ชันวาดชื่อพนักงาน และแผนก ลงบนแถบด้านบน
   ========================================================================== */
window.renderUserInfo = function(profile) {
  console.log("🎨 [RENDER] กำลังวาดข้อมูลพนักงานลงหน้าจอ...");
  const employee = profile?.employees;
  
  const nameEl = document.getElementById("userName");
  if (nameEl) {
    nameEl.textContent = employee?.full_name || profile?.display_name || "พนักงานในระบบ";
  } else {
    console.warn("⚠️ [RENDER] หา HTML element id='userName' ไม่เจอ");
  }
    
  const deptName = employee?.departments?.department_name || employee?.department_name || "ทั่วไป";
  const empCode = employee?.employee_code ? `รหัส: ${employee.employee_code}` : "";
  
  const deptEl = document.getElementById("userDepartment");
  if (deptEl) {
    deptEl.textContent = `${deptName} ${empCode}`;
  } else {
    console.warn("⚠️ [RENDER] หา HTML element id='userDepartment' ไม่เจอ");
  }
};

/* ==========================================================================
   📥 3. ฟังก์ชันโหลดสถิติตัวเลข และประวัติการลา
   ========================================================================== */
window.loadRecentLeaves = async function(profile) {
  const recentList = document.getElementById("recentList");
  const pendingCount = document.getElementById("pendingCount");
  const leaveBalance = document.getElementById("leaveBalance"); 
  const usedBalance = document.getElementById("usedBalance");  
  
  const sb = window.pvtSupabase?.getClient();
  const employeeId = profile?.employee_id || profile?.id;

  if (!sb || !employeeId) {
    console.warn("⚠️ [FETCH] ยกเลิกการดึงประวัติ: ไม่พบ Supabase Client หรือ Employee ID");
    if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่ได้เข้าสู่ระบบ หรือไม่พบไอดีพนักงาน</div>`;
    return;
  }

  try {
    console.log(`⏳ [FETCH DATA] กำลังดึงสถิติและโควตาของไอดี: ${employeeId}`);

    const [requestsRes, pendingRes, balanceRes] = await Promise.all([
      sb.from("leave_requests").select("id, start_date, end_date, total_days, status, leave_types(leave_name)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(50), 
      sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "pending"),
      sb.from("leave_balances").select("remaining_days, used_days, year").eq("employee_id", employeeId).order("year", { ascending: false }).maybeSingle()
    ]);

    if (requestsRes.error) {
      console.error("❌ [DB ERROR] ดึงประวัติลาล้มเหลว:", requestsRes.error);
      throw requestsRes.error;
    }
    
    if (balanceRes.error) {
      console.warn("⚠️ [DB WARNING] ดึงข้อมูลโควตาล้มเหลว (อาจไม่มีข้อมูลในตาราง):", balanceRes.error);
    } else {
      console.log("📊 [DATA] ข้อมูลโควตาวันลาที่ได้จาก DB:", balanceRes.data);
    }

    if (pendingCount) pendingCount.innerHTML = `${pendingRes.count ?? 0} <small>รายการ</small>`;

    let balanceData = balanceRes.data;
    if (Array.isArray(balanceData)) balanceData = balanceData[0];

    // 🔒 [GUARD] บันทึกวันลาคงเหลือเก็บไว้ในระบบเพื่อใช้ล็อกปุ่มกด
    window.remainingDays = (balanceData && balanceData.remaining_days != null) ? Number(balanceData.remaining_days) : 0;
    console.log(`🔒 [GUARD SYSTEM] บันทึกสิทธิ์วันลาคงเหลือลงหน่วยความจำชั่วคราว: ${window.remainingDays} วัน`);

    if (leaveBalance) {
      leaveBalance.innerHTML = `${window.remainingDays} <small>วัน</small>`;
    }
    
    if (usedBalance) {
      const usedVal = (balanceData && balanceData.used_days != null) ? balanceData.used_days : "0";
      usedBalance.innerHTML = `${usedVal} <small>วัน</small>`;
    }

    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => str ? String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : "");
    const labelFn = window.pvtSupabase?.statusLabel || ((status) => ({ pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" }[status] || status));
    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => {
      if (!dateStr) return "-";
      try { return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { return dateStr; }
    });

    const rows = requestsRes.data || [];
    console.log(`📋 [DATA] ดึงประวัติการลาสำเร็จ จำนวน ${rows.length} รายการ`);

    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการยื่นใบลาในระบบ</div>`;
      return;
    }

    if (recentList) {
      const listHtml = rows.map((item) => {
        const leaveName = item.leave_types?.leave_name || "การลา";
        let badgeStyle = "background:#fff3cd; color:#854d0e; border:1px solid #fde047;"; 
        if (item.status === "approved") badgeStyle = "background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;";
        else if (item.status === "rejected") badgeStyle = "background:#f8d7da; color:#842029; border:1px solid #f5c2c7;";

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
      recentList.innerHTML = `<div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">${listHtml}</div>`;
    }

    console.log("✅ [SUCCESS] วาด UI กล่องตัวเลขและประวัติเสร็จสมบูรณ์!");

  } catch (error) {
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
    window.handleSystemError(error, "ไม่สามารถโหลดข้อมูลยอดสถิติตัวเลขวันลาได้");
  }
};

/* ==========================================================================
   🖥️ 4. ฟังก์ชันเปิดบัตรพนักงานดิจิทัล
   ========================================================================== */
window.viewMyDigitalCard = function() {
  console.log("💳 [CARD] กำลังเปิดป๊อปอัปบัตรพนักงาน...");
  const sessionUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
  const profile = window.currentProfile || {};
  const employee = profile.employees || profile;
  
  const currentCode = sessionUser?.employee_code || employee?.employee_code;
  
  if (!currentCode) {
    Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูลเซสชัน', text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' });
    return;
  }

  try {
    const fullName = employee?.full_name || profile?.display_name || sessionUser?.full_name || "พนักงานในระบบ";
    const myDept = employee?.departments?.department_name || employee?.department_name || sessionUser?.department_name || "ทั่วไป";
    const myRole = employee?.positions?.position_name || employee?.position_name || sessionUser?.position_name || profile?.role || "พนักงาน";

    const secureData = encodeURIComponent(`${currentCode}|PVT_SECURE_BYPASS`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${secureData}`;

    Swal.fire({
      title: '💳 บัตรประจำตัวพนักงานดิจิทัล', width: '380px',
      html: `
        <div id="pvt-employee-id-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); width: 280px; margin: 15px auto; border-radius: 20px; padding: 24px; color: white; box-shadow: 0 15px 30px rgba(30,58,138,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; font-family: 'Sarabun', sans-serif;">
          <div style="font-weight: 700; font-size: 13px; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 20px; text-transform: uppercase;">PVT WORKFORCE HUB</div>
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 6px;">${fullName}</div>
          <div style="font-size: 13px; color: #38bdf8; font-weight: 600; margin-bottom: 2px;">ตำแหน่ง: ${myRole}</div>
          <div style="font-size: 12px; color: #94a3b8; font-weight: 500; margin-bottom: 20px;">แผนก: ${myDept}</div>
          <div style="background: white; padding: 10px; border-radius: 14px; display: inline-block; margin-bottom: 16px;">
            <img src="${qrUrl}" alt="QR" style="width: 140px; height: 140px; display: block;" />
          </div>
          <div><span style="font-size: 15px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 4px 16px; border-radius: 30px;">${currentCode}</span></div>
        </div>
      `,
      confirmButtonText: '✅ ปิดหน้าต่างบัตร', confirmButtonColor: '#0fa472'
    });
  } catch (err) {
    console.error("❌ [CARD ERROR]:", err);
    Swal.fire({ icon: 'error', title: 'ไม่สามารถเปิดบัตรได้', text: err.message });
  }
};

/* ==========================================================================
   🚨 5. ฟังก์ชันแจ้งเตือน Error
   ========================================================================== 
  const actualErrorLog = error?.message || error?.hint || JSON.stringify(error) || "Unknown System Error";
  console.error(`🚨 [CRITICAL ERROR]: ${customMessage} ->`, error);

  if (typeof Swal !== "undefined") {
    Swal.fire({
      icon: "error", title: "ระบบขัดข้องชั่วคราว",
      html: `
        <div style="text-align: left; font-family: 'Kanit', sans-serif;">
          <p style="margin-bottom: 8px; color: #334155;"><b>รายละเอียด:</b> ${customMessage}</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; font-size: 12px; color: #ef4444; overflow-x: auto; max-height: 100px;">
            Code: ${actualErrorLog}
          </div>
        </div>
      `,
      confirmButtonText: "รับทราบ", confirmButtonColor: "#dc2626", borderRadius: "16px"
    });
  } else { alert(`❌ ${customMessage}\n(${actualErrorLog})`); }
};*/

/* ==========================================================================
   🔗 6. โซนผูกปุ่มกดเข้ากับหน้าเว็บ (Routing + มีตัวบล็อกวันลาหมด)
   ========================================================================== */
window.goToLeaveForm = function() { 
  console.log(`🔍 [ACTION] ผู้ใช้กดปุ่ม 'ยื่นใบลา' -> ตรวจสอบวันลาคงเหลือล่าสุด: ${window.remainingDays} วัน`);
  
  // 🚫 เงื่อนไขบล็อก: ถ้าวันลาคงเหลือ น้อยกว่าหรือเท่ากับ 0 วัน ห้ามกดเด็ดขาด!
  /*if (window.remainingDays <= 0) {
    console.warn("🚫 [BLOCKED] บล็อกการเปลี่ยนหน้าสำเร็จ: วันลาคงเหลือไม่เพียงพอ");
    
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: 'error',
        title: 'สิทธิ์วันลาหมดแล้ว 🚫',
        text: 'คุณไม่สามารถยื่นแบบฟอร์มการลาได้ เนื่องจากสิทธิ์วันลาคงเหลือของคุณคือ 0 วัน กรุณาติดต่อฝ่ายบุคคล (HR)',
        confirmButtonText: 'รับทราบ',
        confirmButtonColor: '#ef4444'
      });
    } else {
      alert("🚫 สิทธิ์วันลาของคุณหมดแล้ว (0 วัน) ไม่สามารถยื่นใบลาได้ครับ");
    }
    return; // 🛑 หยุดการทำงานตรงนี้ ไม่ยอมให้ลิงก์ไปหน้ากรอกใบลา
  }*/

  // ✅ ถวันลาเหลือมากกว่า 0 วัน ยอมให้ไปหน้าแบบฟอร์มได้ตามปกติ
  window.location.href = "/pages/user/leave-user.html"; 
};

window.goToRules = function() { window.location.href = "/pages/user/leave-rules.html"; };
window.goToLeaveHistory = function() { window.location.href = "/pages/user/leave-history.html"; };
window.goToProfile = function() { window.location.href = "/pages/user/profile-user.html"; };
window.goToContactHR = function() { window.location.href = "/pages/user/contact-hr.html"; };

window.logout = function() { 
  console.log("👋 [LOGOUT] กำลังออกจากระบบและล้าง Session...");
  sessionStorage.removeItem("currentUser"); 
  window.location.href = "/login.html"; 
};