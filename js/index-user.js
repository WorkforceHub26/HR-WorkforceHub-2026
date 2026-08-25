/* ==========================================================================
   📱 PVT WORKFORCE HUB - index-user.js (Full Specification & High Stability)
   ========================================================================== */

console.log("📢 [SYSTEM] เริ่มต้นโหลดสคริปต์หน้าจอพนักงาน (ฉบับสมบูรณ์)...");

/* ==========================================================================
   🔒 1. Safe Supabase Client & Helper Functions
   ========================================================================== */
function getSafeSupabaseClient() {
  return window.pvtSupabase?.getClient?.() 
      || window.pvtSupabase?.client 
      || window.PVTSDK?.client 
      || window.supabaseClient 
      || window.supabase 
      || null;
}

function safeEscapeHtml(str) {
  if (str === null || str === undefined) return "";
  return window.PVTSDK?.utils?.escapeHtml(str) ?? String(str).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function formatThaiDate(dateStr) {
  if (!dateStr) return "-";
  return window.PVTSDK?.utils?.formatThaiDate(dateStr, "short") ?? dateStr;
}

/* ==========================================================================
   🔗 2. Navigation & Logout Security
   ========================================================================== */
window.goToLeaveForm = () => window.location.href = "/pages/user/leave-user.html";
window.goToRules = () => window.location.href = "/pages/user/leave-rules.html";
window.goToLeaveHistory = () => window.location.href = "/pages/user/leave-history.html";
window.goToProfile = () => window.location.href = "/pages/user/profile-user.html";
window.goToContactHR = () => window.location.href = "/pages/user/contact-hr.html";
window.goToHolidays = () => window.location.href = "/pages/user/holidays.html";

window.logout = function() { 
  console.log("👋 [LOGOUT] กำลังออกจากระบบอย่างปลอดภัย...");
  try {
    const sb = getSafeSupabaseClient();
    if (sb?.auth) sb.auth.signOut();
  } catch (e) { 
    console.warn("Supabase signout failed", e); 
  }
  
  localStorage.removeItem("currentUser"); 
  localStorage.clear();
  sessionStorage.clear();
  window.location.replace("/index.html");
};

// 🛠️ บังคับอัปเดตไฟล์ CSS ใหม่ล่าสุดเสมอ
(function forceLoadNewCSS() {
  const links = document.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    if (links[i].rel === 'stylesheet' && links[i].href.includes('index-user.css')) {
      const oldHref = links[i].href.split('?')[0]; 
      links[i].href = `${oldHref}?v=${new Date().getTime()}`;
      break;
    }
  }
})();

// 🟢 ประกาศตัวแปร Global
window.currentProfile = window.currentProfile || null;
window.remainingDays = window.remainingDays || 0;
window.currentSelectedYear = window.currentSelectedYear || new Date().getFullYear();

/* ==========================================================================
   📌 3. Main Lifecycle Entrypoint (จุดรันหลักจุดเดียว)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  console.log("📌 [LIFECYCLE] โครงสร้าง HTML โหลดเสร็จสิ้น เริ่มต้นดึงข้อมูล...");
  await initUserHome();
  initQuotaSystem();
  checkUserNotifications();
});

/* ==========================================================================
   📥 4. ฟังก์ชันหลักสำหรับโหลดข้อมูลหน้าพนักงาน (แก้ไข Relational Embedding)
   ========================================================================== */
// ในไฟล์ index-user.js
async function initUserHome() {
  try {
    const profile = await window.PVTSDK.hr.getProfile();
    
    if (!profile) return handleUnauthorized("Session หรือ Profile ไม่ถูกต้อง");

    window.currentProfile = profile;
    renderUserInfo(window.currentProfile);
    await loadRecentLeaves(window.currentProfile);

    // ✅ เพิ่มบรรทัดนี้: สั่งให้ QR Code เริ่มทำงานเมื่อดึงข้อมูลพนักงานเรียบร้อยแล้ว
    const empCode = profile.employee_code || profile.employees?.employee_code;
    if (empCode && window.PVTSDK?.card) {
      window.PVTSDK.card.init(empCode, "qrcode", "qr-countdown");
    }
    
    checkApproverPermission(window.currentProfile);
    fetchEmployeeLeaveStatusCount(window.currentProfile);

  } catch (err) {
    console.error("❌ [SAFEGUARD] เกิดข้อผิดพลาดใน initUserHome:", err);
  }
}

function handleUnauthorized(reason) {
  console.error(`🔒 Access Denied [Reason: ${reason}] -> ส่งกลับหน้า Login`);
  localStorage.removeItem("currentUser");
  sessionStorage.clear();
  window.location.replace("/index.html");
}

/* ==========================================================================
   🖥️ 5. ฟังก์ชันวาดข้อมูลพนักงานลงหน้าจอ (ปรับปรุงการแสดงตำแหน่ง/แผนก & รูป)
   ========================================================================== */
window.renderUserInfo = function(profile) {
  if (!profile) return;

  const employee = profile?.employees || profile;
  
  // 1. จัดการชื่อพนักงาน
  const nameEl = document.getElementById("userName") || document.getElementById("empName");
  if (nameEl) {
    nameEl.textContent = safeEscapeHtml(employee?.full_name || profile?.full_name || profile?.display_name || "พนักงานในระบบ");
  }
    
  // 2. จัดการตำแหน่ง แผนก และรหัสพนักงาน
  const deptName = employee?.departments?.department_name || employee?.department_name || profile?.department_name || "ทั่วไป";
  const posName = employee?.positions?.position_name || employee?.position_name || profile?.position_name || "พนักงาน";
  const codeVal = employee?.employee_code || profile?.employee_code;
  const empCodeStr = codeVal ? ` (รหัส: ${codeVal})` : "";
  
  const deptEl = document.getElementById("userDepartment") || document.getElementById("empDept");
  if (deptEl) {
    deptEl.textContent = safeEscapeHtml(`${posName} - ${deptName}${empCodeStr}`);
  }

  // 3. จัดการรูปภาพโปรไฟล์ (ใช้ StorageEngine ของ SDK จัดการ URL อัตโนมัติ)
  const avatarEl = document.getElementById("userAvatar");
  if (avatarEl) {
    let rawAvatarUrl = profile?.image_url || employee?.image_url || profile?.avatar_url;
    
    avatarEl.onerror = function() {
      this.onerror = null;
      this.src = "/assets/img/default-avatar.jpg";
    };

    avatarEl.src = window.PVTSDK?.storage?.getAvatarUrl(rawAvatarUrl) || "/assets/img/default-avatar.jpg";
  }
};

/* ==========================================================================
   📥 6. ฟังก์ชันโหลดประวัติการลา (แก้ไขปัญหา Relationship Ambiguous)
   ========================================================================== */
window.loadRecentLeaves = async function(profile) {
  const recentList = document.getElementById("recentList");
  const leaveBalance = document.getElementById("leaveBalance"); 
  const usedBalance = document.getElementById("usedBalance");  
  const pendingCount = document.getElementById("pendingCount");
  
  const sb = getSafeSupabaseClient();
  const employeeId = profile?.id || profile?.employee_id;

  if (!sb || !employeeId) {
    if (recentList) recentList.innerHTML = `<div class="empty-state">ไม่พบไอดีผู้ใช้งานระบบ</div>`;
    return;
  }

  try {
    const currentYear = new Date().getFullYear();
    const thaiYear = currentYear + 543;

    // ดึงข้อมูลโดยไม่ใช้ Join แบบ Embed เพื่อป้องกัน Error Relationship
    const [requestsRes, pendingRes, balanceRes, typesRes] = await Promise.all([
      sb.from("leave_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(20), 
      sb.from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employeeId)
        .eq("status", "pending"),
      sb.from("leave_balances")
        .select("remaining_days, used_days, year")
        .eq("employee_id", employeeId)
        .in("year", [currentYear, thaiYear]),
      sb.from("leave_types").select("id, leave_name")
    ]);

    // สร้าง Map สำหรับแปลง ID เป็นชื่อประเภทการลา
    const typeMap = {};
    (typesRes.data || []).forEach(t => typeMap[t.id] = t.leave_name);

    // คำนวณโควตาวันลา
    const balanceRows = balanceRes.data || [];
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

    // แสดงผลรายการลาล่าสุด
    const rows = requestsRes.data || [];
    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">ยังไม่มีรายการยื่นใบลาในระบบ</div>`;
      return;
    }

    if (recentList) {
      const listHtml = rows.map((item) => {
        const leaveName = safeEscapeHtml(typeMap[item.leave_type_id] || item.leave_types?.leave_name || "การลา");
        let displayStatus = item.status;
        let badgeStyle = "background:#fff3cd; color:#854d0e; border:1px solid #fde047;"; 
                
        if (item.status === "approved") {
          displayStatus = "อนุมัติ";
          badgeStyle = "background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;";
        } else if (item.status === "cancelled" || item.status === "cancelled_by_user" || item.cancel_status === "approved") {
          displayStatus = "ยกเลิกแล้ว";
          badgeStyle = "background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;";
        } else if (item.status === "cancel_pending" || item.cancel_status === "pending") {
          displayStatus = "รอ HR อนุมัติยกเลิก";
          badgeStyle = "background:#ffedd5; color:#c2410c; border:1px solid #fed7aa;";
        } else if (item.status === "rejected") {
          displayStatus = "ไม่อนุมัติ";
          badgeStyle = "background:#f8d7da; color:#842029; border:1px solid #f5c2c7;";
        } else if (item.status === "pending") {
          displayStatus = "รออนุมัติ";
        }

        return `
          <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 15px; color: #0f172a;">${leaveName}</strong>
              <span class="status ${item.status}" style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; ${badgeStyle}">${displayStatus}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: #64748b;">
              <div>📅 วันที่: <span style="color: #334155; font-weight: 500;">${formatThaiDate(item.start_date)} - ${formatThaiDate(item.end_date)}</span></div>
              <div>⏱️ จำนวน: <span style="color: #0fa472; font-weight: 600;">${item.total_days} วัน</span></div>
            </div>
          </article>
        `;
      }).join(""); 
      recentList.innerHTML = `<div style="max-height: 400px; overflow-y: auto; padding-right: 5px;">${listHtml}</div>`;
    }
  } catch (error) {
    console.error("❌ loadRecentLeaves Error:", error);
    if (recentList) recentList.innerHTML = `<div class="empty-state" style="color:#ef4444;">⚠️ ดึงข้อมูลประวัติไม่สำเร็จ</div>`;
  }
};

/* ==========================================================================
   🎨 7. ระบบสร้างบัตรพนักงานดิจิทัล (HTML5 Canvas PNG Generator)
   ========================================================================== */
async function generateEmployeeCardPNG({ empCode, empName, myRole, myDept, avatarUrl, qrUrl }) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 920;
  const ctx = canvas.getContext("2d");

  const loadSafeImage = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = objUrl;
      });
    } catch (e) {
      return null;
    }
  };

  const [avatarImg, qrImg] = await Promise.all([
    loadSafeImage(avatarUrl),
    loadSafeImage(qrUrl)
  ]);

  const drawRoundedRect = (x, y, w, h, r, fillStyle) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  };

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, 920);
  bgGrad.addColorStop(0, '#0d1b3e');
  bgGrad.addColorStop(1, '#183370');
  drawRoundedRect(0, 0, 600, 920, 48, bgGrad);

  // Title Text
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 22px "Sarabun", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PVT WORKFORCE HUB', 300, 75);

  // Avatar Circle Clip
  const avatarX = 300, avatarY = 210, avatarRadius = 90;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarImg) {
    const aspect = avatarImg.width / avatarImg.height;
    let dw = avatarRadius * 2, dh = avatarRadius * 2;
    if (aspect > 1) dw = dh * aspect;
    else dh = dw / aspect;
    ctx.drawImage(avatarImg, avatarX - dw / 2, avatarY - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = '#1e293b';
    ctx.fill();
  }
  ctx.restore();

  // Avatar Border Ring
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Employee Details Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Sarabun", sans-serif';
  ctx.fillText(empName, 300, 355);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 24px "Sarabun", sans-serif';
  ctx.fillText(`ตำแหน่ง: ${myRole}`, 300, 400);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 22px "Sarabun", sans-serif';
  ctx.fillText(`แผนก: ${myDept}`, 300, 440);

  // QR Frame & Image
  drawRoundedRect(160, 480, 280, 280, 36, '#ffffff');
  if (qrImg) {
    ctx.drawImage(qrImg, 180, 500, 240, 240);
  }

  // Employee Code Badge
  drawRoundedRect(200, 800, 200, 56, 28, 'rgba(255, 255, 255, 0.15)');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Sarabun", sans-serif';
  ctx.fillText(empCode, 300, 838);

  return canvas.toDataURL('image/png');
}

// 🛠️ Helper แปลงข้อความให้ปลอดภัยสำหรับ URL Parameter
const safeBase64Encode = (str) => {
  return btoa(encodeURIComponent(str))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

window.viewMyDigitalCard = async function() {
  const sessionUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
  const profile = window.currentProfile || sessionUser;

  const currentCode = String(
    profile?.employee_code || 
    sessionUser?.employee_code || 
    profile?.emp_code || 
    sessionUser?.emp_code || ""
  ).trim();
  
  if (!currentCode) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'error', title: 'ไม่พบข้อมูล', text: 'ไม่พบรหัสพนักงานในระบบ กรุณาล็อกอินใหม่อีกครั้ง' });
    }
    return;
  }

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: '⏳ กำลังสร้างบัตรพนักงาน...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });
  }

  const fullName = profile?.full_name || sessionUser?.full_name || "พนักงานในระบบ";
  const myDept = profile?.department_name || profile?.departments?.department_name || "ทั่วไป";
  const myRole = profile?.position_name || profile?.positions?.position_name || "พนักงาน";

  let avatarUrl = window.PVTSDK?.storage?.getAvatarUrl(profile?.image_url || profile?.employees?.image_url);

  // 🔒 ปรับตั้งค่าเวลาเป็น 60,000 ms (1 นาที)
  const timeBlock = Math.floor(Date.now() / 60000);
  const safeBase64Encode = (str) => btoa(encodeURIComponent(str)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const securePayload = safeBase64Encode(`${currentCode}|${timeBlock}`);
  
  const targetUrl = `${window.location.origin}/?auto_login=${securePayload}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;

  const cardImageDataUrl = await generateEmployeeCardPNG({
    empCode: currentCode,
    empName: fullName,
    myRole: myRole,
    myDept: myDept,
    avatarUrl: avatarUrl,
    qrUrl: qrUrl
  });

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: '💳 บัตรประจำตัวพนักงานดิจิทัล', 
      width: '420px',
      html: `
        <div style="margin: 10px 0 14px 0;">
          <img src="${cardImageDataUrl}" alt="Employee Card" style="width: 260px; border-radius: 20px; box-shadow: 0 8px 22px rgba(0,0,0,0.25); display: block; margin: 0 auto;" />
        </div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; text-align: left; font-size: 12px; color: #475569;">
          <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <span>🛡️ เงื่อนไขความปลอดภัยและการใช้งาน</span>
          </div>
          <ul style="margin: 0; padding-left: 18px; line-height: 1.6;">
            <li><b>Dynamic Security:</b> QR Code มีอายุใช้งาน 1 นาที (ห้ามแคปหน้าจอส่งต่อ)</li>
            <li><b>Single Account:</b> บัตรผูกกับบัญชีพนักงานเครื่องนี้เท่านั้น</li>
          </ul>
        </div>
      `,
      showCancelButton: true,
      cancelButtonText: '📥 ดาวน์โหลดบัตร',
      cancelButtonColor: '#2563eb',
      confirmButtonText: '✅ ปิด', 
      confirmButtonColor: '#64748b',
      reverseButtons: true
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.cancel) {
        const link = document.createElement("a");
        link.href = cardImageDataUrl;
        link.download = `Employee_Card_${currentCode}.png`;
        link.click();
      }
    });
  }
};
/* ==========================================================================
   🔔 8. ระบบติดตามสถานะการอนุมัติ 3 ขั้นตอน (3-Step Approval Status Tracker)
   ========================================================================== */
function checkApproverPermission(profileData) {
  const switchBtn = document.getElementById("approverModeBtn");
  if (!switchBtn || !profileData?.role) return;

  const userRole = (profileData.role || "").toLowerCase();
  const approverRoles = ["leader", "manager", "director", "executive", "owner", "hr", "admin"];
  const isApprover = approverRoles.includes(userRole);

  switchBtn.style.setProperty("display", isApprover ? "flex" : "none", "important");
}

async function fetchEmployeeLeaveStatusCount(profile) {
  const sb = getSafeSupabaseClient();
  const empId = profile?.id || profile?.employee_id;
  const notifBtn = document.getElementById("notificationBtn");
  if (!sb || !empId) return;

  try {
    const { count } = await sb
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", empId)
      .in("status", ["pending", "approved", "rejected", "cancel_pending"]);

    if (notifBtn) {
      notifBtn.style.display = "inline-flex";
      const badge = document.getElementById("notifBadge");
      if (badge) {
        badge.innerText = count || 0;
        badge.style.display = count > 0 ? "flex" : "none";
      }
    }
  } catch (e) {
    console.warn("⚠️ ไม่สามารถดึงการแจ้งเตือนได้:", e);
  }
}

function openNotificationModal() {
  const userRole = (window.currentProfile?.role || "").toLowerCase();
  const approverRoles = ["leader", "manager", "director", "executive", "owner", "hr", "admin"];

  if (approverRoles.includes(userRole)) {
    openApproverNotificationModal();
  } else {
    openEmployeeStatusTrackerModal();
  }
}

function renderStepStatus(status) {
  if (status === 'approved' || status === 'pass') {
    return `<span style="color:#10b981; font-weight:700; font-size:11px;">✅ อนุมัติ</span>`;
  } else if (status === 'rejected' || status === 'fail') {
    return `<span style="color:#ef4444; font-weight:700; font-size:11px;">❌ ไม่ผ่าน</span>`;
  } else {
    return `<span style="color:#d97706; font-weight:600; font-size:11px;">⏳ รอพิจารณา</span>`;
  }
}

function renderCancelStepStatus(cancelStatus) {
  if (cancelStatus === 'approved' || cancelStatus === 'cancelled') {
    return `<span style="color:#475569; font-weight:700; font-size:11px;">🚫 ยกเลิกสำเร็จ</span>`;
  } else if (cancelStatus === 'rejected') {
    return `<span style="color:#ef4444; font-weight:700; font-size:11px;">❌ ปฏิเสธการยกเลิก</span>`;
  } else {
    return `<span style="color:#ea580c; font-weight:600; font-size:11px;">⏳ รอ HR อนุมัติยกเลิก</span>`;
  }
}

async function openEmployeeStatusTrackerModal() {
  const sb = getSafeSupabaseClient();
  const empId = window.currentProfile?.id || window.currentProfile?.employee_id;
  if (!sb || !empId) return;

  if (typeof Swal !== 'undefined') Swal.showLoading();

  try {
    const { data: requests } = await sb
      .from("leave_requests")
      .select("*, leave_types(leave_name)")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!requests || requests.length === 0) {
      if (typeof Swal !== 'undefined') Swal.fire('🔔 ติดตามสถานะใบลา', 'คุณยังไม่มีรายการยื่นใบลาในระบบ', 'info');
      return;
    }

    const cardsHtml = requests.map((item) => {
      const leaveName = safeEscapeHtml(item.leave_types?.leave_name || "ใบลา");
      const days = item.total_days || 1;

      let overallBadge = `<span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">⏳ อยู่ระหว่างพิจารณา</span>`;
      
      if (item.status === "approved") {
        overallBadge = `<span style="background:#d1e7dd; color:#0f5132; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">✅ อนุมัติเรียบร้อย</span>`;
      } else if (item.status === "rejected") {
        overallBadge = `<span style="background:#f8d7da; color:#842029; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">❌ ไม่อนุมัติ</span>`;
      } else if (item.status === "cancel_pending" || item.cancel_status === "pending") {
        overallBadge = `<span style="background:#ffedd5; color:#c2410c; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">⏳ รอ HR อนุมัติยกเลิก</span>`;
      } else if (item.status === "cancelled" || item.cancel_status === "approved") {
        overallBadge = `<span style="background:#e2e8f0; color:#475569; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">🚫 ยกเลิกแล้ว</span>`;
      }

      const leaderStep = renderStepStatus(item.leader_status || (item.status === 'pending' ? 'pending' : 'approved'));
      const managerStep = renderStepStatus(item.manager_status || (item.status === 'approved' ? 'approved' : 'pending'));
      const hrStep = renderStepStatus(item.hr_status || (item.status === 'approved' ? 'approved' : 'pending'));

      const isCancellationFlow = item.status === "cancel_pending" || item.status === "cancelled" || item.cancel_status;
      const hrCancelStep = renderCancelStepStatus(item.cancel_status || (item.status === 'cancelled' ? 'approved' : 'pending'));

      return `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-bottom: 12px; text-align: left; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 15px; color: #0f172a;">📝 ${leaveName} (${days} วัน)</strong>
            ${overallBadge}
          </div>
          
          <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
            <span>📅 ${formatThaiDate(item.start_date)} - ${formatThaiDate(item.end_date)}</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: #f8fafc; padding: 10px; border-radius: 12px; border: 1px solid #f1f5f9; text-align: center;">
            <div style="border-right: 1px solid #e2e8f0; padding-right: 4px;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">1. หัวหน้าแผนก</div>
              ${leaderStep}
            </div>
            <div style="border-right: 1px solid #e2e8f0; padding-right: 4px;">
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">2. ผู้จัดการ</div>
              ${managerStep}
            </div>
            <div>
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">3. HR อนุมัติ</div>
              ${hrStep}
            </div>
          </div>

          ${isCancellationFlow ? `
            <div style="margin-top: 8px; background: #fff7ed; padding: 8px 12px; border-radius: 10px; border: 1px solid #ffedd5; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #c2410c; font-weight: 600;">🔄 คำร้องขอยกเลิก (HR อนุมัติ):</span>
              ${hrCancelStep}
            </div>
          ` : ''}

          ${item.cancel_reason ? `
            <div style="margin-top: 8px; font-size: 11px; color: #9a3412; background: #fff7ed; border: 1px solid #ffedd5; padding: 6px 10px; border-radius: 6px;">
              <b>เหตุผลที่ขอยกเลิก:</b> ${safeEscapeHtml(item.cancel_reason)}
            </div>
          ` : ''}

          ${item.approval_comment ? `
            <div style="margin-top: 8px; font-size: 11px; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px;">
              <b>💬 หมายเหตุผู้อนุมัติ:</b> ${safeEscapeHtml(item.approval_comment)}
            </div>
          ` : ''}
        </div>
      `;
    }).join("");

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: '🔔 ติดตามสถานะการอนุมัติ',
        html: `<div style="max-height: 420px; overflow-y: auto; padding-right: 4px;">${cardsHtml}</div>`,
        width: '480px',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#06b6d4'
      });
    }

  } catch (err) {
    console.error("❌ ดึงข้อมูลติดตามสถานะล้มเหลว:", err);
    if (typeof Swal !== 'undefined') Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลสถานะได้', 'error');
  }
}

function openApproverNotificationModal() {
  const pendingCount = document.getElementById("notifBadge")?.innerText || "0";
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: '🔔 รายการแจ้งเตือนการอนุมัติ',
      html: `มีใบลาที่รอการอนุมัติอยู่ทั้งหมด <b style="color:#eab308; font-size:20px;">${pendingCount}</b> รายการ`,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '🔎 ไปยังระบบอนุมัติ',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#3b82f6'
    }).then((result) => {
      if (result.isConfirmed) window.location.href = '/pages/hr/hr.html';
    });
  }
}

/* ==========================================================================
   📊 9. ระบบจัดการโควตาประจำปี (แก้ไขการสลับปี ค.ศ./พ.ศ.)
   ========================================================================== */
function initQuotaSystem() {
  const yearSelect = document.getElementById('yearFilter');
  if (!yearSelect) return;

  const now = new Date().getFullYear();
  
  yearSelect.innerHTML = `
    <option value="${now}">ปี ${now + 543} (ปัจจุบัน)</option>
    <option value="${now + 1}">ปี ${now + 1 + 543} (ล่วงหน้า)</option>
  `;
  
  // ผูก Event Listener เมื่อมีการเปลี่ยนตัวเลือกปี
  yearSelect.addEventListener('change', (e) => {
    handleYearChange(e.target.value);
  });

  window.currentSelectedYear = now;
  loadQuotaData(window.currentSelectedYear);
}

async function handleYearChange(year) {
  window.currentSelectedYear = parseInt(year, 10);
  await loadQuotaData(window.currentSelectedYear);
}

/* ==========================================================================
   🎨 Palette ชุดสีสอดคล้องกับแต่ละประเภทวันลา (รับประกันสีไม่ซ้ำกัน)
   ========================================================================== */
const LEAVE_COLOR_PALETTE = [
  "#2563eb", // ฟ้าเข้ม (ลากิจ)
  "#f97316", // ส้ม (ลาป่วย)
  "#10b981", // เขียว (พักร้อน/พักผ่อน)
  "#ec4899", // ชมพู (ลาคลอด)
  "#8b5cf6", // ม่วง (ลาหมัน)
  "#f59e0b", // เหลืองทอง (ลาอุปสมบท)
  "#06b6d4", // ฟ้าสว่าง (ลาฝึกอบรม)
  "#e11d48", // แดง (ป่วยเนื่องจากการทำงาน)
  "#64748b", // เทาสโมค (รับราชการทหาร)
  "#84cc16"  // เขียวตอง (ประเภทอื่นๆ)
];

function getLeaveTypeColor(leaveName = "", index = 0) {
  const name = leaveName.toLowerCase();
  if (name.includes("กิจ")) return "#2563eb";
  if (name.includes("ป่วย")) return "#f97316";
  if (name.includes("พักผ่อน") || name.includes("พักร้อน")) return "#10b981";
  if (name.includes("คลอด")) return "#ec4899";
  if (name.includes("หมัน")) return "#8b5cf6";
  if (name.includes("ทหาร")) return "#64748b";
  if (name.includes("อุปสมบท")) return "#f59e0b";

  // หากไม่ตรงเงื่อนไขข้างต้น ให้ดึงสีถัดไปจาก Palette ลูปตาม Index ป้องกันสีซ้ำ
  return LEAVE_COLOR_PALETTE[index % LEAVE_COLOR_PALETTE.length];
}

/* ==========================================================================
   📊 9. ระบบจัดการโควตาประจำปี (นับจำนวนครั้งเฉพาะอนุมัติแล้ว)
   ========================================================================== */
async function loadQuotaData(targetYear) {
  const sb = getSafeSupabaseClient();
  const employeeId = window.currentProfile?.id || window.currentProfile?.employee_id;

  if (!sb || !employeeId) return;

  try {
    const thaiYear = targetYear + 543;

    // 1. ดึงโควตาประจำปี
    const { data: quotas, error } = await sb
      .from('leave_balances')
      .select('*')
      .eq('employee_id', employeeId)
      .in('year', [targetYear, thaiYear]);

    if (error) {
      console.error('❌ ดึงข้อมูลโควตาล้มเหลว:', error.message);
      return;
    }

    // 2. ดึงประเภทการลา
    const { data: types } = await sb.from("leave_types").select("id, leave_name");

    // 3. ดึงรายการยื่นลาทั้งหมดเพื่อ คำนวณนับจำนวนครั้งที่ "อนุมัติแล้ว" (approved) แยกตามประเภท
    const { data: requests } = await sb
      .from("leave_requests")
      .select("leave_type_id, status")
      .eq("employee_id", employeeId);

    const approvedTimesMap = {};

    (requests || []).forEach(r => {
      const typeIdStr = String(r.leave_type_id);
      // ✅ นับเฉพาะที่อนุมัติแล้วเท่านั้น
      if (r.status === 'approved') {
        approvedTimesMap[typeIdStr] = (approvedTimesMap[typeIdStr] || 0) + 1;
      }
    });

    // Map ข้อมูลประเภทและสีการ์ด
    const typeMap = {};
    (types || []).forEach((t, index) => {
      typeMap[String(t.id)] = {
        name: t.leave_name,
        color: getLeaveTypeColor(t.leave_name, index)
      };
    });

    const mappedQuotas = (quotas || []).map((q, idx) => {
      const typeIdStr = String(q.leave_type_id);
      const typeInfo = typeMap[typeIdStr] || {};
      const leaveName = typeInfo.name || "สิทธิ์การลา";
      return {
        ...q,
        leave_type_name: leaveName,
        card_color: typeInfo.color || getLeaveTypeColor(leaveName, idx),
        approved_times: approvedTimesMap[typeIdStr] || 0 // 👈 จำนวนครั้งที่อนุมัติแล้ว
      };
    });

    renderQuotaCards(mappedQuotas);
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดใน loadQuotaData:', err);
  }
}

/* ==========================================================================
   📊 ฟังก์ชันวาดการ์ดโควตาวันลา (แสดงจำนวนครั้งที่อนุมัติแล้ว)
   ========================================================================== */
function renderQuotaCards(quotas) {
  const container = document.getElementById('leaveBalancesContainer');
  if (!container) return;
  
  if (!quotas || quotas.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 24px 0;">ไม่พบข้อมูลสิทธิ์วันลาสำหรับปีนี้</div>`;
    return;
  }

  container.innerHTML = quotas.map(item => {
    const typeName = safeEscapeHtml(item.leave_type_name || "สิทธิ์การลา");
    const total = parseFloat(item.entitlement_days) || parseFloat(item.quota) || 0;
    const used = parseFloat(item.used_days) || 0;
    const remaining = parseFloat(item.remaining_days) ?? (total - used);
    const usedPercent = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
    const cardColor = item.card_color || "#2563eb";
    const leaveTypeId = item.leave_type_id || "";
    const approvedTimes = item.approved_times || 0;

    return `
      <div class="quota-card" 
           onclick="showLeaveTypeHistory('${leaveTypeId}', '${typeName}')"
           style="border-top: 4px solid ${cardColor}; cursor: pointer; transition: transform 0.15s ease;"
           title="คลิกเพื่อดูประวัติ ${typeName}">
        <div class="quota-title" style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #0f172a;">${typeName}</span>
          <!-- ✅ ป้ายบอกจำนวนครั้งที่อนุมัติแล้ว -->
          <span style="background: ${cardColor}15; color: ${cardColor}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; border: 1px solid ${cardColor}30;">
            อนุมัติ ${approvedTimes} ครั้ง
          </span>
        </div>
        
        <div class="quota-days" style="margin-top: 6px;">
          <span class="num-highlight" style="color: ${cardColor}; font-size: 24px; font-weight: 700;">${remaining}</span>
          <span class="num-total" style="color: #64748b;">/ ${total} วัน</span>
        </div>
        
        <div class="quota-progress-track" style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 10px 0 6px 0;">
          <div class="quota-progress-bar" style="width: ${usedPercent}%; height: 100%; background-color: ${cardColor}; transition: width 0.4s ease;"></div>
        </div>

        <div class="quota-footer" style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
          <span>ใช้ไป ${used} วัน (${approvedTimes} ครั้ง)</span>
          <span>${usedPercent}%</span>
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   🔍 ฟังก์ชัน Pop-up ประวัติการลา (กรองเฉพาะ leave_type_id ที่คลิกเลือก)
   ========================================================================== */
window.showLeaveTypeHistory = async function(leaveTypeId, leaveTypeName) {
  const sb = getSafeSupabaseClient();
  const empId = window.currentProfile?.id || window.currentProfile?.employee_id;
  if (!sb || !empId) return;

  if (typeof Swal !== 'undefined') Swal.showLoading();

  try {
    // 🎯 ดึงเฉพาะใบลาที่เป็นของ leave_type_id นี้เท่านั้น
    const { data: requests, error } = await sb
      .from("leave_requests")
      .select("*")
      .eq("employee_id", empId)
      .eq("leave_type_id", leaveTypeId) // 👈 กรองเฉพาะประเภทที่กดดู
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!requests || requests.length === 0) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: `📊 ประวัติ ${leaveTypeName}`,
          text: `คุณยังไม่มีประวัติการยื่น ${leaveTypeName}`,
          confirmButtonColor: '#3b82f6'
        });
      }
      return;
    }

    // คำนวณสรุปสถิติเฉพาะประเภทนี้
    const totalTimes = requests.length;
    const approvedCount = requests.filter(r => r.status === 'approved').length;
    const pendingCount = requests.filter(r => r.status === 'pending' || r.status === 'cancel_pending').length;

    // แสดงผลรายการเฉพาะประเภทที่เลือก
    const historyHtml = requests.map(item => {
      let badge = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">⏳ รออนุมัติ</span>`;
      if (item.status === 'approved') badge = `<span style="background:#d1e7dd; color:#0f5132; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">✅ อนุมัติ</span>`;
      else if (item.status === 'rejected') badge = `<span style="background:#f8d7da; color:#842029; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">❌ ไม่อนุมัติ</span>`;
      else if (item.status === 'cancelled' || item.status === 'cancelled_by_user') badge = `<span style="background:#e2e8f0; color:#475569; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600;">🚫 ยกเลิก</span>`;

      return `
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; margin-bottom:8px; text-align:left;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <span style="font-size:13px; font-weight:600; color:#0f172a;">📅 ${formatThaiDate(item.start_date)} - ${formatThaiDate(item.end_date)}</span>
            ${badge}
          </div>
          <div style="font-size:12px; color:#64748b; line-height: 1.5;">
            ⏱️ จำนวน: <strong style="color:#0f172a;">${item.total_days} วัน</strong>
            ${item.reason ? `<br>💬 เหตุผล: ${safeEscapeHtml(item.reason)}` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: `📊 ประวัติ ${safeEscapeHtml(leaveTypeName)}`,
        html: `
          <!-- สรุปสถิติจำนวนครั้งเฉพาะประเภทที่กดดู -->
          <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-around; font-size:12px;">
            <div>ยื่นทั้งหมด: <strong style="color:#2563eb;">${totalTimes} ครั้ง</strong></div>
            <div>อนุมัติแล้ว: <strong style="color:#16a34a;">${approvedCount} ครั้ง</strong></div>
            <div>รอพิจารณา: <strong style="color:#d97706;">${pendingCount} ครั้ง</strong></div>
          </div>

          <!-- รายการใบลาเฉพาะประเภทที่กดดู -->
          <div style="max-height: 300px; overflow-y: auto; padding-right: 4px;">${historyHtml}</div>
        `,
        width: '460px',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#64748b'
      });
    }

  } catch (err) {
    console.error("❌ ดึงประวัติประเภทการลาล้มเหลว:", err);
    if (typeof Swal !== 'undefined') Swal.fire('ข้อผิดพลาด', 'ไม่สามารถดึงประวัติการลาได้', 'error');
  }
};

/* ==========================================================================
   🔄 10. ระบบ Refresh Data (พร้อม Animation ปุ่มหมุน)
   ========================================================================== */
window.refreshUserData = async function() {
  const refreshIcons = document.querySelectorAll('.material-symbols-outlined');
  
  refreshIcons.forEach(icon => {
    if (icon.innerText === 'refresh') {
      icon.style.transition = 'transform 0.6s ease';
      icon.style.transform = 'rotate(360deg)';
    }
  });

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: '⏳ กำลังอัปเดตข้อมูลล่าสุด...',
      showConfirmButton: false,
      timer: 1500
    });
  }

  try {
    await initUserHome();
    if (typeof loadQuotaData === "function") {
      await loadQuotaData(window.currentSelectedYear);
    }
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการรีเฟรชข้อมูล:", err);
  } finally {
    setTimeout(() => {
      refreshIcons.forEach(icon => {
        if (icon.innerText === 'refresh') {
          icon.style.transform = 'rotate(0deg)';
        }
      });
    }, 600);
  }
};

function checkUserNotifications() {
  const today = new Date();
  if (today.getMonth() === 11 && today.getDate() === 1) { // 1 ธันวาคม
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'info',
        title: '🎉 สิทธิ์วันลาประจำปีใหม่ได้รับการปรับปรุงแล้ว!',
        text: 'ระบบได้ทำการรีเซ็ตโควตาวันลาเรียบร้อยแล้ว',
        confirmButtonText: 'รับทราบ'
      });
    }
  }
}

function toggleUserGuide() {
  const card = document.getElementById("user-guide-card");
  const icon = document.getElementById("user-guide-icon");
  const btn = document.getElementById("user-guide-fab");
  if (!card || !icon || !btn) return;

  const isHidden = card.style.display === "none" || card.style.display === "";
  card.style.display = isHidden ? "block" : "none";
  icon.innerText = isHidden ? "close" : "help";
  btn.classList.toggle("active", isHidden);
}

/* ==========================================================================
   👁️ ฟังก์ชันซ่อน/แสดง (ระบบ Toggle Class เสถียรสูง)
   ========================================================================== */
window.toggleSection = function(sectionId, btnElement) {
  const targetSection = document.getElementById(sectionId);
  
  if (!targetSection) {
    console.warn("⚠️ ไม่พบ Element ที่มี ID:", sectionId);
    return;
  }

  // สลับ Class hidden-section
  const isHidden = targetSection.classList.toggle('hidden-section');

  // เปลี่ยนไอคอนและสไตล์ปุ่ม
  const iconEl = btnElement?.querySelector('.material-symbols-outlined');
  if (iconEl) {
    iconEl.textContent = isHidden ? 'visibility_off' : 'visibility';
  }
  if (btnElement) {
    btnElement.classList.toggle('is-hidden', isHidden);
  }

  // กรณีเป็นส่วนสิทธิ์วันลา ให้ซ่อนตัวเลือกปี (yearFilter) ด้วย
  if (sectionId === 'leaveBalancesContainer' || sectionId === 'leaveBalancesSection') {
    const yearFilter = document.getElementById('yearFilter');
    if (yearFilter) yearFilter.classList.toggle('hidden-section', isHidden);
  }
};