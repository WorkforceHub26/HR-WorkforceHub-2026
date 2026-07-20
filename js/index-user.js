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
   📥 1. ฟังก์ชันโหลดโฮมเพจ (เวอร์ชันดึงรูปภาพอัปเดตล่าสุดจากฐานข้อมูลจริง)
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
    let validId = window.currentProfile?.employee_id || window.currentProfile?.id;
    
    // 3. ถ้าไม่ได้ ID มา ให้ไปค้นหาใน Session Storage แทน (แผนสำรอง)
    if (!validId) {
      console.log("🔄 [DASHBOARD] ใช้แผนสำรอง: ดึงข้อมูลโปรไฟล์จากแคช (Session)");
      let cachedUser = null;
      try {
        cachedUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
        console.log("📦 [SESSION] ข้อมูลที่เจอใน Session Storage:", cachedUser);
      } catch (e) {
        console.error("❌ [ERROR] อ่านค่า sessionStorage ล้มเหลว:", e);
      }

      if (cachedUser) {
        const empData = cachedUser.employees || cachedUser;
        const deptData = empData.departments || cachedUser.departments || cachedUser;

        window.currentProfile = {
          id: cachedUser.id || empData.id,
          employee_id: cachedUser.employee_id || cachedUser.id || empData.id,
          employee_code: empData.employee_code || cachedUser.employee_code,
          full_name: empData.full_name || cachedUser.full_name || cachedUser.display_name,
          department_name: deptData.department_name || empData.department_name || cachedUser.department_name, 
          role: cachedUser.role || empData.role,
          avatar_url: empData.image_url || cachedUser.image_url || empData.avatar_url || cachedUser.avatar_url,
          employees: empData 
        };
        validId = window.currentProfile.employee_id;
        console.log("✅ [RECOVERY] กู้คืนโปรไฟล์จาก Session สำเร็จ:", window.currentProfile);
      } else {
        console.error("❌ [CRITICAL] ไม่พบข้อมูลทั้งใน Auth และ Session!");
      }
    }

    // 🔥 [แก้ไขตรงจุด 100%] วิ่งไปค้นหาผ่านคอลัมน์ id ด้วย UUID ตรงๆ และดึง image_url
    const sb = window.pvtSupabase?.getClient();
    if (sb && validId) {
      try {
        console.log(`🤖 [FETCH IMAGE] กำลังดึงข้อมูลภาพจาก employees.image_url โดยใช้ id: ${validId}`);
        
        const { data: freshEmp, error } = await sb
          .from("employees")
          .select("image_url")
          .eq("id", validId)
          .single();
        
        if (!error && freshEmp && freshEmp.image_url) {
          window.currentProfile.avatar_url = freshEmp.image_url;
          if (window.currentProfile.employees) {
            window.currentProfile.employees.avatar_url = freshEmp.image_url;
          }
          console.log("🔄 [FRESH IMAGE] ดึงรูปจากคอลัมน์ image_url สำเร็จ:", freshEmp.image_url);
        } else if (error) {
          console.warn("⚠️ ค้นหาไม่สำเร็จ หรือไม่มีข้อมูลในคอลัมน์ image_url:", error.message);
        }
      } catch (e) {
        console.warn("⚠️ ระบบขัดข้องระหว่างดึงข้อมูลรูปภาพจาก DB:", e);
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

    // 6. โยนโปรไฟล์ไปเช็คสิทธิ์ปุ่มหัวหน้างาน
    checkApproverPermission(window.currentProfile);

  } catch (err) {
    console.error("🚨 [SAFE GUARD ERROR] ดักจับข้อผิดพลาดหน้าโฮม:", err);
  }
}

/* ==========================================================================
   🖥️ 2. ฟังก์ชันวาดชื่อพนักงาน และประกอบโครงสร้างรูปภาพจริงลงหน้าจอ
   ========================================================================== */
window.renderUserInfo = function(profile) {
  console.log("🎨 [RENDER] กำลังวาดข้อมูลพนักงานลงหน้าจอ...", profile);
  if (!profile) return;

  const employee = profile?.employees || profile;
  
  // 1. จัดการชื่อ
  const nameEl = document.getElementById("userName");
  if (nameEl) {
    nameEl.textContent = employee?.full_name || profile?.full_name || profile?.display_name || "พนักงานในระบบ";
  }
    
  // 2. จัดการแผนกและรหัสพนักงาน
  const deptName = employee?.departments?.department_name || employee?.department_name || profile?.department_name || "ทั่วไป";
  const codeVal = employee?.employee_code || profile?.employee_code;
  const empCode = codeVal ? `รหัส: ${codeVal}` : "";
  
  const deptEl = document.getElementById("userDepartment");
  if (deptEl) {
    deptEl.textContent = `${deptName} ${empCode}`;
  }

  // ✨ 3. จัดการรูปโปรไฟล์พนักงาน (เวอร์ชันเปิดรูปภาพจริง 100%)
  const avatarEl = document.getElementById("userAvatar");
  if (avatarEl) {
    let avatarUrl = profile?.avatar_url || profile?.employees?.avatar_url || profile?.image_url || profile?.picture;
    
    if (avatarUrl && avatarUrl.trim() !== "") {
      
      // 🛠️ เคสที่ 1: ถ้าฐานข้อมูลเก็บเป็นก้อนพาร์ทสั้น (เช่น avatars/3512_xxx.jpg) ให้ต่อ URL เต็มให้ทันที
      if (!avatarUrl.startsWith("http")) {
        avatarUrl = `https://pgogmhqjdchakcytsomx.supabase.co/storage/v1/object/public/employee-images/${avatarUrl}`;
      }
      
      // 🛠️ เคสที่ 2: ดักจับ URL สกัด Error 400! ถ้าลิงก์ขาดคำว่า /public/ ให้แทรกเข้าไปตรงกลางโครงสร้างเซิร์ฟเวอร์
      if (avatarUrl.includes("storage/v1/object/") && !avatarUrl.includes("storage/v1/object/public/")) {
        avatarUrl = avatarUrl.replace("storage/v1/object/", "storage/v1/object/public/");
      }
      
      avatarEl.src = avatarUrl; 
      console.log("📸 [AVATAR EFFECTIVE] แสดงผลรูปภาพจริงสำเร็จที่ URL:", avatarUrl);
    } else {
      // แผนสำรองกรณีที่ไม่มีรูปภาพของพนักงานอยู่ในสารบบเลย
      avatarEl.src = "/assets/img/default-avatar.jpg"; 
      console.log("📸 [AVATAR] ไม่พบข้อมูลรูปภาพ ใช้ภาพโปรไฟล์เริ่มต้นในเครื่อง");
    }
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
    const currentYear = new Date().getFullYear();

    const [requestsRes, pendingRes, balanceRes] = await Promise.all([
      sb.from("leave_requests").select("id, start_date, end_date, total_days, status, leave_types(leave_name)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(50), 
      sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "pending"),
      sb.from("leave_balances").select("leave_type_id, remaining_days, used_days, year, leave_types(leave_name)").eq("employee_id", employeeId).eq("year", currentYear)
    ]);

    if (requestsRes.error) throw requestsRes.error;
    
    const balanceRows = balanceRes.data || [];
    window.employeeLeaveBalances = balanceRows;

    if (typeof window.renderAllLeaveBalances === 'function') {
      window.renderAllLeaveBalances();
    }

    let totalRemaining = 0;
    let totalUsed = 0;
    balanceRows.forEach(b => {
      totalRemaining += parseFloat(b.remaining_days) || 0;
      totalUsed += parseFloat(b.used_days) || 0;
    });

    window.remainingDays = totalRemaining;

    if (leaveBalance) leaveBalance.innerHTML = `${window.remainingDays} <small>วัน</small>`;
    if (usedBalance) usedBalance.innerHTML = `${totalUsed} <small>วัน</small>`;
    if (pendingCount) pendingCount.innerHTML = `${pendingRes.count ?? 0} <small>รายการ</small>`;

    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => str ? String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])) : "");
    const labelFn = window.pvtSupabase?.statusLabel || ((status) => ({ pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ปฏิเสธ" }[status] || status));
    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => {
      if (!dateStr) return "-";
      try { return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { return dateStr; }
    });

    const rows = requestsRes.data || [];
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
  } catch (error) {
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลล่าสุดไม่สำเร็จ</div>`;
  }
};

/* ==========================================================================
   🎨 4. ฟังก์ชันวาดกล่องโควตาวันลาแยกประเภท
   ========================================================================== */
window.renderAllLeaveBalances = function() {
  const container = document.getElementById("leaveBalancesContainer");
  if (!container) return;

  container.innerHTML = ""; 

  if (!window.employeeLeaveBalances || window.employeeLeaveBalances.length === 0) {
    container.innerHTML = "<p style='color:var(--muted); font-size:14px; font-style:italic; margin:0;'>❌ ยังไม่มีข้อมูลโควตาวันลาในปีนี้</p>";
    return;
  }

  window.employeeLeaveBalances.forEach(balance => {
    const typeName = balance.leave_types?.leave_name || "สิทธิ์การลา";
    const remaining = parseFloat(balance.remaining_days) || 0;

    let colorClass = ""; 
    if (typeName.includes("ป่วย")) colorClass = "sick";
    else if (typeName.includes("กิจ")) colorClass = "personal";
    else if (typeName.includes("พักผ่อน") || typeName.includes("พักร้อน")) colorClass = "vacation";

    const box = document.createElement("div");
    box.className = `leave-quota-card ${colorClass}`;
    
    box.innerHTML = `
      <span class="leave-quota-name">${typeName}</span>
      <div class="leave-quota-days">${remaining}<small>วัน</small></div>
    `;
    container.appendChild(box);
  });
};

/* ==========================================================================
   🖥️ 5. ฟังก์ชันเปิดบัตรพนักงานดิจิทัล
   ========================================================================== */
window.viewMyDigitalCard = function() {
  const sessionUser = JSON.parse(sessionStorage.getItem("currentUser") || "null");
  const profile = window.currentProfile || {};
  const employee = profile.employees || profile;
  const currentCode = sessionUser?.employee_code || employee?.employee_code;
  
  if (!currentCode) return;

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
};

/* ==========================================================================
   🔗 6. โซนผูกปุ่มกดเข้ากับหน้าเว็บ
   ========================================================================== */
window.goToLeaveForm = function() { window.location.href = "/pages/user/leave-user.html"; };
window.goToRules = function() { window.location.href = "/pages/user/leave-rules.html"; };
window.goToLeaveHistory = function() { window.location.href = "/pages/user/leave-history.html"; };
window.goToProfile = function() { window.location.href = "/pages/user/profile-user.html"; };
window.goToContactHR = function() { window.location.href = "/pages/user/contact-hr.html"; };

window.logout = function() { 
  console.log("👋 [LOGOUT] กำลังออกจากระบบและล้าง Session...");
  sessionStorage.removeItem("currentUser"); 
  window.location.href = "/index.html"; 
};

/* ==========================================================================
   🕵️‍♂️ 7. ฟังก์ชันตรวจสอบสิทธิ์และแสดงปุ่มสลับโหมดหัวหน้างาน
   ========================================================================== */
function checkApproverPermission(profileData) {
  console.log("🔍 [Debug] กำลังตรวจสอบสิทธิ์จาก Profile ที่ส่งมา:", profileData);
  try {
    if (!profileData) {
      console.warn("❌ [Debug] ไม่มีข้อมูล Profile ให้ตรวจสอบสิทธิ์");
      return;
    }

    const userRole = (profileData.role || "").toLowerCase();
    const approverRoles = ["leader", "manager", "director", "hr"];

    if (approverRoles.includes(userRole)) {
      console.log("✅ [Debug] สิทธิ์ผ่าน! แสดงปุ่มหัวหน้างาน");
      const switchBtn = document.getElementById("approverModeBtn");
      if (switchBtn) {
        switchBtn.style.setProperty("display", "flex", "important");
      }
    } else {
      console.log("⛔ [Debug] สิทธิ์ไม่ถึง ไม่แสดงปุ่ม");
    }
  } catch (err) {
    console.error("❌ [Debug] เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์หัวหน้างาน:", err);
  }
}

/* ==========================================================================
   🔮 8. USER INTERACTION GUIDE CONTROLLER (ระบบควบคุมคู่มือผู้ใช้งานพนักงาน)
   ========================================================================== */
function toggleUserGuide() {
  const card = document.getElementById("user-guide-card");
  const icon = document.getElementById("user-guide-icon");
  const btn = document.getElementById("user-guide-fab");
  
  if (!card || !icon || !btn) return;

  const isHidden = card.style.display === "none" || card.style.display === "";

  if (isHidden) {
    card.style.display = "block";
    icon.innerText = "close";
    icon.style.transform = "rotate(90deg)";
    btn.style.background = "#ef4444"; // เปลี่ยนเป็นสีแดงชั่วคราวเพื่อให้รู้ว่ากดปิดได้
    btn.style.color = "#ffffff";
    btn.style.borderColor = "#fecaca";
  } else {
    card.style.display = "none";
    icon.innerText = "help";
    icon.style.transform = "rotate(0deg)";
    btn.style.background = "rgba(255, 255, 255, 0.8)";
    btn.style.color = "var(--primary-dark, #0891b2)";
    btn.style.borderColor = "rgba(6, 182, 212, 0.3)";
  }
}