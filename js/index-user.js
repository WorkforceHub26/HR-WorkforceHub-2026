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
    initUserNotifications(window.currentProfile);

    // 🔗 Auto-trigger sidebar actions from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const targetAction = urlParams.get("action");
    if (targetAction === "digital_card" || targetAction === "card") {
      setTimeout(() => {
        if (typeof window.viewMyDigitalCard === "function") window.viewMyDigitalCard();
      }, 500);
    } else if (targetAction === "line_link" || targetAction === "line") {
      setTimeout(() => {
        if (typeof window.generateLineLinkToken === "function") window.generateLineLinkToken();
      }, 500);
    }

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
    const [requestsRes, pendingRes, typesRes] = await Promise.all([
      sb.from("leave_requests")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(20), 
      sb.from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employeeId)
        .eq("status", "pending"),
      sb.from("leave_types")
        .select("id, leave_name")
    ]);

    const typeMap = {};
    (typesRes?.data || []).forEach(t => {
      typeMap[t.id] = t.leave_name;
    });

    // ดึงวันลาคงเหลือโดยใช้ helper
    let userBalances = [];
    if (window.PVTSDK?.user?.getLeaveBalances) {
      userBalances = await window.PVTSDK.user.getLeaveBalances(employeeId, currentYear);
    }

    let totalRemaining = 0;
    let totalUsed = 0;
    
    (userBalances || []).forEach(b => {
      totalRemaining += parseFloat(b.remaining_days) || 0;
      totalUsed += parseFloat(b.used_days) || 0;
    });

    window.remainingDays = totalRemaining;

    const lang = window.getGlobalLanguage ? window.getGlobalLanguage() : "th";
    const unitDays = window.getPVTTranslation ? window.getPVTTranslation("unitDays") : "วัน";
    const unitItems = lang === 'lo' ? "ລາຍການ" : (lang === 'my' ? "ခု" : "รายการ");
    const labelDates = lang === 'lo' ? "ວັນທີ:" : (lang === 'my' ? "ရက်စွဲ:" : "วันที่:");
    const labelDuration = lang === 'lo' ? "ຈຳນວນ:" : (lang === 'my' ? "အရေအတွက်:" : "จำนวน:");
    const emptyMsg = window.getPVTTranslation ? window.getPVTTranslation("statAll") : "ยังไม่มีรายการยื่นใบลาในระบบ";

    if (leaveBalance) leaveBalance.innerHTML = `${window.remainingDays} <small>${unitDays}</small>`;
    if (usedBalance) usedBalance.innerHTML = `${totalUsed} <small>${unitDays}</small>`;
    if (pendingCount) pendingCount.innerHTML = `${pendingRes.count ?? 0} <small>${unitItems}</small>`;

    // แสดงผลรายการลาล่าสุด
    const rows = requestsRes.data || [];
    if (!rows.length) {
      if (recentList) recentList.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
      return;
    }

    if (recentList) {
      window.recentLeaveRequestsCache = rows;
      const listHtml = rows.map((item) => {
        const rawName = typeMap[item.leave_type_id] || item.leave_types?.leave_name || "การลา";
        let leaveName = safeEscapeHtml(rawName);
        if (typeof window.localizeCategory === "function") {
          leaveName = window.localizeCategory(rawName, lang);
        } else if (window.getPVTTranslation) {
          if (rawName.includes("ป่วย") || rawName.includes("Sick")) leaveName = window.getPVTTranslation("leaveSick");
          else if (rawName.includes("พักผ่อน") || rawName.includes("พักร้อน") || rawName.includes("Annual")) leaveName = window.getPVTTranslation("leaveAnnual");
          else if (rawName.includes("กิจ") || rawName.includes("Business")) leaveName = window.getPVTTranslation("leaveBusiness");
          else if (rawName.includes("หมัน") || rawName.includes("Steril")) leaveName = window.getPVTTranslation("leaveSterilization");
          else if (rawName.includes("ทหาร") || rawName.includes("Military")) leaveName = window.getPVTTranslation("leaveMilitary");
          else if (rawName.includes("บวช") || rawName.includes("อุปสมบท") || rawName.includes("Ordina")) leaveName = window.getPVTTranslation("leaveOrdination");
          else if (rawName.includes("ฌาปนกิจ") || rawName.includes("Funeral")) leaveName = window.getPVTTranslation("leaveFuneral");
          else if (rawName.includes("คลอด") || rawName.includes("Matern")) leaveName = window.getPVTTranslation("leaveMaternity");
        }

        let displayStatus = item.status;
        let badgeStyle = "background:#fff3cd; color:#854d0e; border:1px solid #fde047;"; 
                
        if (item.status === "approved") {
          displayStatus = window.getPVTTranslation ? window.getPVTTranslation("statusApproved") : "อนุมัติ";
          badgeStyle = "background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;";
        } else if (item.status === "cancelled" || item.status === "cancelled_by_user" || item.cancel_status === "approved") {
          displayStatus = window.getPVTTranslation ? window.getPVTTranslation("statusCancelled") : "ยกเลิกแล้ว";
          badgeStyle = "background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;";
        } else if (item.status === "cancel_pending" || item.cancel_status === "pending") {
          displayStatus = window.getPVTTranslation ? window.getPVTTranslation("statusCancelReq") : "รอ HR อนุมัติยกเลิก";
          badgeStyle = "background:#ffedd5; color:#c2410c; border:1px solid #fed7aa;";
        } else if (item.status === "rejected") {
          displayStatus = window.getPVTTranslation ? window.getPVTTranslation("statusRejected") : "ไม่อนุมัติ";
          badgeStyle = "background:#f8d7da; color:#842029; border:1px solid #f5c2c7;";
        } else if (item.status === "pending") {
          displayStatus = window.getPVTTranslation ? window.getPVTTranslation("statusPending") : "รออนุมัติ";
        }

        return `
          <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong class="leave-type-title" data-raw-cat="${safeEscapeHtml(rawName)}" style="font-size: 15px; color: #0f172a;">${leaveName}</strong>
              <span class="status ${item.status}" data-raw-status="${item.status}" style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; ${badgeStyle}">${displayStatus}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: #64748b;">
              <div>📅 ${labelDates} <span style="color: #334155; font-weight: 500;">${formatThaiDate(item.start_date)} - ${formatThaiDate(item.end_date)}</span></div>
              <div>⏱️ ${labelDuration} <span style="color: #0fa472; font-weight: 600;">${item.total_days} ${unitDays}</span></div>
            </div>
            <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
              <button type="button" class="btn-timeline-stepper" onclick="openVisualTimelineModal('${item.id}')" style="padding: 5px 12px; background: #f0fdfa; border: 1px solid #99f6e4; color: #0d9488; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;">
                <span class="material-symbols-outlined" style="font-size: 16px;">timeline</span>
                ติดตามขั้นตอน (Stepper)
              </button>
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

window.addEventListener("pvt-lang-changed", () => {
  if (typeof loadRecentLeaves === "function") {
    loadRecentLeaves();
  }
});

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

  // 🔒 QR Code ถาวรประจำตัวพนักงาน
  const targetUrl = `${window.location.origin}/index.html?auto_login=${encodeURIComponent(currentCode)}`;
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
            <span>🛡️ QR Code ถาวรประจำตัวพนักงาน</span>
          </div>
          <ul style="margin: 0; padding-left: 18px; line-height: 1.6;">
            <li><b>Permanent QR:</b> QR Code ถาวรประจำตัวพนักงาน ใช้สแกนเข้าสู่ระบบได้ตลอดเวลา</li>
            <li><b>Single Account:</b> บัตรผูกกับรหัสพนักงาน ${currentCode}</li>
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
  if (!switchBtn) return;

  const userRole = (profileData?.role || "").toLowerCase();
  const positionName = (profileData?.position_name || profileData?.positions?.position_name || "").toLowerCase();

  const approverRoles = ["leader", "manager", "director", "executive", "owner", "hr", "admin"];
  const isApprover = approverRoles.includes(userRole) || 
                     positionName.includes("ผู้จัดการ") || 
                     positionName.includes("ผู้อำนวยการ") || 
                     positionName.includes("หัวหน้า");

  switchBtn.style.setProperty("display", isApprover ? "flex" : "none", "important");
}

/* ==========================================================================
   👥 ระบบแสดงผลสมาชิกพนักงานในแผนกสำหรับหัวหน้า/ผู้จัดการ
   ========================================================================== */
async function loadDepartmentTeam(profileData) {
  const teamSection = document.getElementById("departmentTeamSection");
  const teamGrid = document.getElementById("teamMembersContainer");
  const teamTitle = document.getElementById("teamSectionTitle");
  const teamSubtitle = document.getElementById("teamSectionSubtitle");
  const teamBadge = document.getElementById("teamCountBadge");

  if (!teamSection || !teamGrid) return;

  const employee = profileData?.employees || profileData;
  const deptId = employee?.department_id || profileData?.department_id;
  const deptName = employee?.departments?.department_name || employee?.department_name || profileData?.department_name || "แผนกของคุณ";
  const userRole = (profileData?.role || employee?.role || "").toLowerCase();
  const positionName = (employee?.positions?.position_name || "").toLowerCase();

  const isLeaderOrHigher = ["leader", "manager", "director", "executive", "owner", "hr", "admin"].includes(userRole) ||
                           positionName.includes("หัวหน้า") || positionName.includes("ผู้จัดการ") || positionName.includes("บริหาร");

  teamSection.style.display = "block";
  if (teamTitle) teamTitle.textContent = `สมาชิกพนักงานในแผนก (${deptName})`;
  if (teamSubtitle) teamSubtitle.textContent = isLeaderOrHigher 
    ? `คุณมีสิทธิ์บริหารและดูรายชื่อสมาชิกในทีมสังกัด ${deptName}` 
    : `รายชื่อเพื่อนร่วมงานในสังกัด ${deptName}`;

  const sb = getSafeSupabaseClient();
  if (!sb || !deptId) {
    teamGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">ไม่พบข้อมูลแผนกสังกัด</div>`;
    return;
  }

  try {
    const { data: team, error } = await sb
      .from('employees')
      .select('id, full_name, nickname, employee_code, image_url, line_id, role, positions(position_name), departments!department_id(department_name)')
      .eq('department_id', deptId)
      .order('full_name', { ascending: true });

    if (error || !team || team.length === 0) {
      teamGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 16px; text-align: center; color: #94a3b8; font-size: 13px;">ไม่พบสมาชิกพนักงานในแผนกนี้</div>`;
      if (teamBadge) teamBadge.textContent = "0 คน";
      return;
    }

    if (teamBadge) teamBadge.textContent = `${team.length} คน`;

    teamGrid.innerHTML = team.map(emp => {
      const avatar = window.PVTSDK?.storage?.getAvatarUrl(emp.image_url) || "/assets/img/default-avatar.jpg";
      const pos = emp.positions?.position_name || "พนักงาน";
      const empCode = emp.employee_code ? `รหัส: ${emp.employee_code}` : "";
      const nick = emp.nickname ? `(${emp.nickname})` : "";
      const roleLower = (emp.role || "").toLowerCase();

      let roleBadge = '<span style="font-size: 10px; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 6px; font-weight: 600;">พนักงาน</span>';
      if (roleLower === "leader" || roleLower.includes("leader")) {
        roleBadge = '<span style="font-size: 10px; background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 6px; font-weight: 700;">👑 หัวหน้างาน (L1)</span>';
      } else if (roleLower === "manager" || roleLower.includes("manager")) {
        roleBadge = '<span style="font-size: 10px; background: #dbeafe; color: #1d4ed8; padding: 2px 6px; border-radius: 6px; font-weight: 700;">💼 ผู้จัดการ (L2)</span>';
      } else if (["hr", "admin", "superadmin"].includes(roleLower)) {
        roleBadge = '<span style="font-size: 10px; background: #f3e8ff; color: #6b21a8; padding: 2px 6px; border-radius: 6px; font-weight: 700;">⚙️ ฝ่ายบุคคล</span>';
      }

      const lineBadge = emp.line_id 
        ? '<span style="color: #16a34a; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 2px;">● LINE แล้ว</span>'
        : '<span style="color: #94a3b8; font-size: 11px;">○ ยังไม่ผูก LINE</span>';

      return `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
          <img src="${avatar}" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid #cbd5e1; flex-shrink: 0;" onerror="this.src='/assets/img/default-avatar.jpg';">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
              <strong style="font-size: 13px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${safeEscapeHtml(emp.full_name)} ${nick}</strong>
            </div>
            <div style="font-size: 12px; color: #0284c7; font-weight: 600; margin-bottom: 4px;">💼 ${safeEscapeHtml(pos)}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
              <span>${empCode}</span>
              ${lineBadge}
            </div>
            <div style="margin-top: 4px;">${roleBadge}</div>
          </div>
        </div>
      `;
    }).join("");

  } catch (e) {
    console.error("loadDepartmentTeam error:", e);
    teamGrid.innerHTML = `<div style="grid-column: 1/-1; padding: 16px; text-align: center; color: #ef4444; font-size: 13px;">เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิก</div>`;
  }
}

// --- UNIFIED USER NOTIFICATION DROPDOWN SYSTEM ---
let localReadNotifIds = [];
try {
  localReadNotifIds = JSON.parse(localStorage.getItem("userReadNotifIds") || "[]");
} catch(e) {}

function getUserReadNotifIds() {
  return localReadNotifIds;
}

function addUserReadNotifId(id) {
  if (!localReadNotifIds.includes(id)) {
    localReadNotifIds.push(id);
    localStorage.setItem("userReadNotifIds", JSON.stringify(localReadNotifIds));
  }
}

async function initUserNotifications(profile) {
  if (!profile) return;
  setupUserNotifClickOutside();
  await fetchUserNotifications();
}

function setupUserNotifClickOutside() {
  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("userNotifDropdown");
    const btn = document.getElementById("notificationBtn");
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });
}

function toggleUserNotifDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById("userNotifDropdown");
  if (!dropdown) return;
  if (dropdown.style.display === "flex") {
    dropdown.style.display = "none";
  } else {
    dropdown.style.display = "flex";
    fetchUserNotifications();
  }
}

async function fetchUserNotifications() {
  const sb = getSafeSupabaseClient();
  const profile = window.currentProfile;
  if (!sb || !profile) return;

  const myId = profile.id || profile.employee_id;
  const myRole = (profile.role || "user").toLowerCase();
  const myDeptName = profile.departments?.department_name || profile.department_name || "";
  const myDeptId = profile.department_id || "";

  try {
    let notificationsList = [];

    // 1. ดึงข้อความแจ้งเตือนจากตาราง notifications
    const { data: dbNotifs } = await sb
      .from("notifications")
      .select("*")
      .or(`employee_id.eq.${myId},user_id.eq.${myId}`) // 👈 ดึงแจ้งเตือนส่วนบุคคลตาม employee_id
      .order("created_at", { ascending: false })
      .limit(50);

    let filteredDbNotifs = [];
    if (dbNotifs) {
      filteredDbNotifs = dbNotifs.filter(n => {
        const notifRecipient = n.employee_id || n.user_id;
        if (notifRecipient) {
          return String(notifRecipient) === String(myId);
        }
        const titleLower = String(n.title).toLowerCase();
        const msgLower = String(n.message).toLowerCase();

        if (myRole === "user") {
          const myName = profile.full_name || "";
          return myName && (msgLower.includes(myName.toLowerCase()) || titleLower.includes(myName.toLowerCase()));
        }

        if (myRole === "leader" || myRole === "manager") {
          const myDeptKeyword = String(myDeptName || "").toLowerCase();
          // ถ้ามีชื่อแผนกในข้อความ หรือเป็นคำขอที่เกี่ยวกับ "อนุมัติ" ในแผนกตัวเอง
          if (myDeptKeyword && (msgLower.includes(myDeptKeyword) || titleLower.includes(myDeptKeyword))) {
            return true;
          }
          // ถ้าไม่มีข้อมูลแผนก แต่อย่างน้อยต้องเป็นคำขออนุมัติ และไม่ใช่ของพนักงานทั่วไปคนอื่น (กรณีไม่มี user_id)
          // แต่ทางที่ดีควรระบุ user_id ตอนสร้างแจ้งเตือน
          return false; // ปิดการมองเห็นแบบเหมาเข่ง เพื่อความเป็นส่วนตัว
        }
        return true; // HR / Admin see all
      });
    }

    // แปลง db notifications เป็นรูปแบบมาตรฐาน
    filteredDbNotifs.forEach(n => {
      notificationsList.push({
        id: n.id,
        title: n.title,
        message: n.message,
        created_at: n.created_at,
        is_read: n.is_read || getUserReadNotifIds().includes(n.id),
        type: 'general',
        link: myRole === 'user' ? '/pages/user/leave-history.html' : '/pages/hr/hr.html'
      });
    });

    // 2. ดึงใบลาค้างอนุมัติ หากเป็นสายอนุมัติ (เพื่อเพิ่มปุ่มกระดิ่ง Zero-Inbox)
    const approverRoles = ["leader", "manager", "director", "executive", "owner", "hr", "admin"];
    if (approverRoles.includes(myRole)) {
      const { data: leaveRequests } = await sb
        .from("leave_requests")
        .select("id, created_at, status, start_date, end_date, total_days, leave_types(leave_name), employees(full_name, role, department_id, departments!department_id(department_name))")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (leaveRequests) {
        let filteredLeaves = leaveRequests;

        // กรองใบลาตามลดับขั้นสายงาน (เหมือนระบบ hr.js)
        filteredLeaves = leaveRequests.filter(req => {
          const reqEmp = req.employees;
          if (!reqEmp) return false;

          const reqDeptId = reqEmp.department_id;
          const reqDeptName = reqEmp.departments?.department_name;
          const reqEmpId = req.employee_id;
          const reqEmpRole = String(reqEmp.role || "user").toLowerCase();

          // ป้องกันหัวหน้าเห็นใบลาตัวเอง
          if (myId && String(reqEmpId) === String(myId)) return false;

          if (myRole === "leader") {
            const isSameDept = (myDeptId || myDeptName)
              ? (String(reqDeptId) === String(myDeptId) || String(reqDeptName).toLowerCase() === String(myDeptName).toLowerCase())
              : true;
            return isSameDept && reqEmpRole === "user";
          }

          if (myRole === "manager") {
            const isSameDept = (myDeptId || myDeptName)
              ? (String(reqDeptId) === String(myDeptId) || String(reqDeptName).toLowerCase() === String(myDeptName).toLowerCase())
              : true;
            return isSameDept && reqEmpRole === "leader";
          }

          if (myRole === "director" || myRole === "executive" || myRole === "owner") {
            return reqEmpRole === "leader" || reqEmpRole === "manager";
          }

          return true; // HR / Admin
        });

        filteredLeaves.forEach(req => {
          const leaveName = req.leave_types?.leave_name || "ใบลา";
          const empName = req.employees?.full_name || "พนักงาน";
          notificationsList.push({
            id: `pending-${req.id}`,
            title: `📥 คำขอใหม่: ${empName}`,
            message: `ขอลา ${leaveName} จำนวน ${req.total_days} วัน (${formatThaiDate(req.start_date)} - ${formatThaiDate(req.end_date)})`,
            created_at: req.created_at,
            is_read: getUserReadNotifIds().includes(`pending-${req.id}`),
            type: 'pending_leave',
            link: '/pages/hr/hr.html'
          });
        });
      }
    } else {
      // สำหรับพนักงานทั่วไป ดึงข้อมูลความคืบหน้าคำขอล่าสุดมาแสดงด้วย
      const { data: myLeaves } = await sb
        .from("leave_requests")
        .select("id, updated_at, status, start_date, end_date, leave_types(leave_name)")
        .eq("employee_id", myId)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (myLeaves) {
        myLeaves.forEach(req => {
          if (req.status !== "pending") {
            const statusThai = req.status === "approved" ? "✅ อนุมัติแล้ว" : "❌ ปฏิเสธแล้ว";
            notificationsList.push({
              id: `status-${req.id}-${req.status}`,
              title: `📢 สถานะใบลา: ${statusThai}`,
              message: `ใบลา ${req.leave_types?.leave_name} ของคุณได้รับการพิจารณาเรียบร้อยแล้ว`,
              created_at: req.updated_at,
              is_read: getUserReadNotifIds().includes(`status-${req.id}-${req.status}`),
              type: 'leave_status',
              link: '/pages/user/leave-history.html'
            });
          }
        });
      }
    }

    // เรียงตามเวลาล่าสุด
    notificationsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // กรองแสดงเฉพาะ "ยังไม่ได้อ่าน" สำหรับกล่อง Dropdown
    const unreadNotifications = notificationsList.filter(n => !n.is_read);

    // อัปเดตตัวเลขแจ้งเตือน (Badge)
    const badge = document.getElementById("notifBadge");
    const countPill = document.getElementById("userUnifNotifCount") || document.getElementById("userNotifCount");
    const totalUnread = unreadNotifications.length;

    if (badge) {
      badge.innerText = totalUnread;
      badge.style.display = totalUnread > 0 ? "flex" : "none";
    }

    if (countPill) {
      countPill.innerText = `${totalUnread} รายการใหม่`;
    }

    // วาดรายการแจ้งเตือนลงใน dropdown
    const container = document.getElementById("userNotifList");
    if (!container) return;

    if (unreadNotifications.length === 0) {
      container.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; color: #64748b; font-size: 13px;">
          <span class="material-symbols-outlined" style="font-size: 32px; color: #cbd5e1; margin-bottom: 8px;">check_circle</span>
          <p style="margin: 0; font-weight: 500;">คุณเคลียร์แจ้งเตือนครบหมดแล้ว!</p>
          <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8;">ไม่มีรายการค้างอ่านใหม่</p>
        </div>
      `;
      return;
    }

// 🛠️ Helper function จัดแต่งข้อความแจ้งเตือนให้อ่านง่าย สะอาดตา และไม่ซ้ำซ้อน
function formatCleanNotification(title, rawMessage) {
  if (!rawMessage) return { title: title || '', bodyHtml: '' };
  
  let cleanTitle = String(title || '').trim();
  let msg = String(rawMessage).replace(/\*\*/g, '').trim();

  // ตัดบรรทัดแรกที่ซ้ำซ้อนกับ Title ออก
  const lines = msg.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const rawFirst = lines[0].replace(/^[❌✅📌🟢🎉📢⚠️\s]+/, '').trim();
    const rawTitle = cleanTitle.replace(/^[❌✅📌🟢🎉📢⚠️\s]+/, '').trim();
    if (rawFirst.includes(rawTitle) || rawTitle.includes(rawFirst) || rawFirst.startsWith("คำขอลา") || rawFirst.startsWith("ใบลาได้รับการอนุมัติ")) {
      lines.shift();
    }
  }

  if (lines.length === 0) {
    return {
      title: cleanTitle,
      bodyHtml: ''
    };
  }

  // แปลงแต่ละบรรทัดให้เป็น Tag ชัดเจนสวยงาม
  const formattedLines = lines.map(line => {
    if (line.includes('เหตุผลที่ไม่ผ่าน') || line.includes('เหตุผลที่ยกเลิก') || line.includes('⚠️')) {
      return `<div style="background: #fff1f2; color: #be123c; padding: 3px 8px; border-radius: 6px; border: 1px solid #fecdd3; font-weight: 600; font-size: 11.5px; margin-top: 2px;">${line}</div>`;
    }
    if (line.includes('ความเห็นหัวหน้า') || line.includes('ความเห็นผู้จัดการ')) {
      return `<div style="background: #f0fdf4; color: #166534; padding: 3px 8px; border-radius: 6px; border: 1px solid #bbf7d0; font-size: 11.5px; margin-top: 2px;">${line}</div>`;
    }
    if (line.startsWith('👉')) {
      return `<div style="color: #0d9488; font-weight: 600; font-size: 11.5px; margin-top: 2px;">${line}</div>`;
    }
    return `<div style="line-height: 1.45;">${line}</div>`;
  });

  return {
    title: cleanTitle,
    bodyHtml: `<div class="notif-parsed-list" style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #475569; margin-top: 4px;">${formattedLines.join('')}</div>`
  };
}

    let html = "";
    unreadNotifications.forEach(n => {
      let iconColor = "#0284c7";
      let iconBg = "#f0fdfa";
      let iconName = "notifications";

      if (n.type === 'pending_leave') {
        iconColor = "#ca8a04";
        iconBg = "#fef9c3";
        iconName = "hourglass_top";
      } else if (n.title.includes("อนุมัติ") || n.title.includes("✅")) {
        iconColor = "#16a34a";
        iconBg = "#d1e7dd";
        iconName = "check_circle";
      } else if (n.title.includes("ปฏิเสธ") || n.title.includes("❌") || n.title.includes("ไม่อนุมัติ")) {
        iconColor = "#dc2626";
        iconBg = "#f8d7da";
        iconName = "cancel";
      }

      const thaiTime = formatThaiDate(n.created_at);
      const formatted = formatCleanNotification(n.title, n.message);

      html += `
        <div class="notif-item unread" onclick="handleUserNotifClick('${n.id}', '${n.link}')" style="display: flex; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; background: #ffffff; text-align: left; align-items: flex-start;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span class="material-symbols-outlined" style="font-size: 20px; color: ${iconColor};">${iconName}</span>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.35; margin-bottom: 2px;">${formatted.title}</div>
            ${formatted.bodyHtml}
            <span style="font-size: 10.5px; color: #94a3b8; display: block; margin-top: 5px;">🕒 ${thaiTime}</span>
          </div>
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #0ea5e9; flex-shrink: 0; margin-top: 6px;"></div>
        </div>
      `;
    });

    container.innerHTML = html;

  } catch (err) {
    console.error("❌ Error fetching notifications on user-home:", err);
  }
}

async function handleUserNotifClick(notifId, redirectUrl) {
  addUserReadNotifId(notifId);

  // อัปเดตในตาราง Supabase (ถ้าไม่ใช่รหัสชั่วคราว)
  const sb = getSafeSupabaseClient();
  if (sb && notifId && !String(notifId).startsWith("pending-") && !String(notifId).startsWith("status-")) {
    try {
      await sb.from("notifications").update({ is_read: true }).eq("id", notifId);
    } catch (e) {
      console.warn("❌ DB read update failed:", e);
    }
  }

  // ซ่อน dropdown
  const dropdown = document.getElementById("userNotifDropdown");
  if (dropdown) dropdown.style.display = "none";

  // วาร์ปหนี
  if (redirectUrl && redirectUrl !== "#") {
    window.location.href = redirectUrl;
  } else {
    fetchUserNotifications();
  }
}

async function markAllUserNotificationsAsRead(event) {
  if (event) event.stopPropagation();
  const sb = getSafeSupabaseClient();
  const profile = window.currentProfile;
  if (!profile) return;

  const myId = profile.id || profile.employee_id;

  try {
    // โหลดแจ้งเตือนทั้งหมดเพื่อกวาด ID
    const { data: dbNotifs } = await sb
      .from("notifications")
      .select("id")
      .eq("user_id", myId)
      .eq("is_read", false);

    if (dbNotifs) {
      dbNotifs.forEach(n => addUserReadNotifId(n.id));
    }

    // มาร์กใน DB
    if (sb) {
      await sb.from("notifications").update({ is_read: true }).or(`employee_id.eq.${myId},user_id.eq.${myId}`);
    }

    // กวาดรายการค้างอ่านที่ปรากฏทั้งหมด
    const allPendingItems = document.querySelectorAll("#userNotifList [onclick]");
    allPendingItems.forEach(el => {
      const onclickText = el.getAttribute("onclick");
      const match = onclickText?.match(/handleUserNotifClick\('([^']+)'/);
      if (match && match[1]) {
        addUserReadNotifId(match[1]);
      }
    });

    await fetchUserNotifications();
    Swal.fire({
      icon: "success",
      title: "อ่านแจ้งเตือนทั้งหมดแล้ว",
      timer: 1500,
      showConfirmButton: false
    });
  } catch (err) {
    console.error("❌ markAllUserNotificationsAsRead failed:", err);
  }
}

async function openAllUserNotificationsModal(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById("userNotifDropdown");
  if (dropdown) dropdown.style.display = "none";
  openNotificationModal();
}

// ผูกเข้ากับระบบ global window ให้เรียกใช้ได้สะดวก
window.toggleUserNotifDropdown = toggleUserNotifDropdown;
window.handleUserNotifClick = handleUserNotifClick;
window.markAllUserNotificationsAsRead = markAllUserNotificationsAsRead;
window.openAllUserNotificationsModal = openAllUserNotificationsModal;

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

    const profile = window.currentProfile || {};
    const deptId = profile.department_id;
    let hasLeader = Boolean(profile.l1_approver_id);
    let hasManager = Boolean(profile.l2_approver_id);

    if (deptId && (!hasLeader || !hasManager)) {
      try {
        const [apprvRes, deptEmpsRes] = await Promise.all([
          sb.from("department_approvers").select("supervisor_id, manager_id").eq("department_id", deptId).maybeSingle(),
          sb.from("employees").select("id, role, positions!position_id(position_name), status").eq("department_id", deptId)
        ]);
        const apprv = apprvRes.data;
        const emps = (deptEmpsRes.data || []).filter(e => e.status === 'active' || !e.status);

        if (!hasLeader) {
          hasLeader = Boolean(
            apprv?.supervisor_id ||
            emps.some(e => {
              const r = String(e.role || '').toLowerCase();
              const p = String(e.positions?.position_name || '').toLowerCase();
              return r === 'leader' || r.includes('leader') || r.includes('supervisor') || p.includes('หัวหน้า');
            })
          );
        }

        if (!hasManager) {
          hasManager = Boolean(
            apprv?.manager_id ||
            emps.some(e => {
              const r = String(e.role || '').toLowerCase();
              const p = String(e.positions?.position_name || '').toLowerCase();
              return r === 'manager' || r.includes('manager') || p.includes('ผู้จัดการ');
            })
          );
        }
      } catch (err) {
        console.warn("Could not check department leaders:", err);
      }
    }

    const userRole = String(profile.role || '').toLowerCase();
    if (userRole === 'leader') hasLeader = false;
    if (userRole === 'manager' || userRole === 'hr' || userRole === 'admin') {
      hasLeader = false;
      hasManager = false;
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

      const isCancellationFlow = item.status === "cancel_pending" || item.status === "cancelled" || item.cancel_status;
      const hrCancelStep = renderCancelStepStatus(item.cancel_status || (item.status === 'cancelled' ? 'approved' : 'pending'));

      // สรุปขั้นตอนตามจริงของแผนก (ซ่อนขั้นตอนที่ไม่มีหัวหน้าหรือผู้จัดการ)
      const steps = [];
      if (hasLeader) {
        steps.push({
          title: 'หัวหน้าแผนก',
          status: item.manager_status || (item.status === 'pending' ? 'pending' : 'approved')
        });
      }
      if (hasManager) {
        steps.push({
          title: 'ผู้จัดการ',
          status: item.director_status || (item.status === 'approved' ? 'approved' : 'pending')
        });
      }
      steps.push({
        title: 'HR อนุมัติ',
        status: item.status === 'approved' ? 'approved' : (item.status === 'rejected' ? 'rejected' : 'pending')
      });

      return `
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; margin-bottom: 12px; text-align: left; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 15px; color: #0f172a;">📝 ${leaveName} (${days} วัน)</strong>
            ${overallBadge}
          </div>
          
          <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
            <span>📅 ${formatThaiDate(item.start_date)} - ${formatThaiDate(item.end_date)}</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(${steps.length}, 1fr); gap: 6px; background: #f8fafc; padding: 10px; border-radius: 12px; border: 1px solid #f1f5f9; text-align: center;">
            ${steps.map((step, sIdx) => `
              <div style="${sIdx < steps.length - 1 ? 'border-right: 1px solid #e2e8f0; padding-right: 4px;' : ''}">
                <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">${sIdx + 1}. ${step.title}</div>
                ${renderStepStatus(step.status)}
              </div>
            `).join('')}
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

  const now = typeof window.getCurrentLeaveYear === 'function' ? window.getCurrentLeaveYear() : new Date().getFullYear();
  
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
   📊 9. ระบบจัดการโควตาประจำปี (รวมข้อมูลไม่ให้ซ้ำซ้อน และนับจำนวนครั้งเฉพาะที่อนุมัติแล้ว)
   ========================================================================== */
async function loadQuotaData(targetYear) {
  const sb = getSafeSupabaseClient();
  const employeeId = window.currentProfile?.id || window.currentProfile?.employee_id;

  if (!sb || !employeeId) return;

  try {
    let yearNum = parseInt(targetYear, 10) || new Date().getFullYear();
    const targetYearAD = yearNum > 2400 ? yearNum - 543 : yearNum;
    const thaiYear = targetYearAD + 543;

    // 1. ดึงโควตาประจำปี (ใช้ getLeaveBalances จาก SDK หรือดึงจากทั้งสองตาราง)
    let quotas = [];
    if (window.PVTSDK?.user?.getLeaveBalances) {
      quotas = await window.PVTSDK.user.getLeaveBalances(employeeId, targetYearAD);
    }
    if (!quotas || quotas.length === 0) {
      const { data: qData } = await sb
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .in('year', [targetYearAD, thaiYear]);
      quotas = qData || [];
    }

    // 2. ดึงประเภทการลาทั้งหมดที่เปิดใช้งาน
    const { data: types } = await sb
      .from("leave_types")
      .select("id, leave_name, yearly_quota, default_days")
      .order("created_at", { ascending: true });

    // 3. ดึงรายการยื่นลาทั้งหมดเพื่อคำนวณนับจำนวนครั้งและวันลาที่ "อนุมัติแล้ว" (approved) ในปีนี้
    const { data: requests } = await sb
      .from("leave_requests")
      .select("leave_type_id, status, total_days, start_date")
      .eq("employee_id", employeeId);

    const approvedTimesMap = {};
    const approvedDaysMap = {};

    (requests || []).forEach(r => {
      const typeIdStr = String(r.leave_type_id);
      if (r.status === 'approved') {
        const reqYear = r.start_date ? (typeof window.getADYear === 'function' ? window.getADYear(r.start_date) : new Date(r.start_date).getFullYear()) : targetYearAD;
        if (reqYear === targetYearAD) {
          approvedTimesMap[typeIdStr] = (approvedTimesMap[typeIdStr] || 0) + 1;
          approvedDaysMap[typeIdStr] = (approvedDaysMap[typeIdStr] || 0) + (parseFloat(r.total_days) || 0);
        }
      }
    });

    // 🎯 รวมข้อมูลแบบ Deduplication โดยยึด leave_type_id เป็นหลัก (1 ประเภทลา = 1 การ์ดเท่านั้น)
    const quotaMap = new Map();
    (quotas || []).forEach(q => {
      const typeId = String(q.leave_type_id);
      if (!quotaMap.has(typeId)) {
        quotaMap.set(typeId, q);
      } else {
        // หากมีทั้งปี ค.ศ. และ พ.ศ. ให้เก็บรายการ ค.ศ. หรือรายการที่มีข้อมูลใหม่กว่า
        const existing = quotaMap.get(typeId);
        if (Number(existing.year) > 2400 && Number(q.year) < 2400) {
          quotaMap.set(typeId, q);
        }
      }
    });

    // Map ข้อมูลประเภทและสีการ์ด
    const typeMap = {};
    (types || []).forEach((t, index) => {
      typeMap[String(t.id)] = {
        name: t.leave_name,
        color: getLeaveTypeColor(t.leave_name, index),
        defaultQuota: parseFloat(t.yearly_quota || t.default_days || 0)
      };
    });

    const empStartStr = window.currentProfile?.start_date || window.currentProfile?.join_date || window.currentProfile?.created_at;
    let isEmpUnder1Year = false;
    if (empStartStr) {
      const empStart = new Date(empStartStr);
      const now = new Date();
      const diffMs = now.getTime() - empStart.getTime();
      const diffDays = diffMs / (1000 * 3600 * 24);
      if (diffDays < 365) {
        isEmpUnder1Year = true;
      }
    }

    const deduplicatedQuotas = [];
    if (types && types.length > 0) {
      types.forEach((t, idx) => {
        const typeIdStr = String(t.id);
        const q = quotaMap.get(typeIdStr);
        const typeInfo = typeMap[typeIdStr] || {};
        const leaveName = typeInfo.name || t.leave_name || "สิทธิ์การลา";
        const isVacation = leaveName.includes("พักผ่อน") || leaveName.includes("พักร้อน") || String(t.leave_code || '').toUpperCase() === 'VACATION';

        let totalEntitlement = q ? (parseFloat(q.entitlement_days) || parseFloat(q.quota) || typeInfo.defaultQuota || 0) : (typeInfo.defaultQuota || 0);
        let usedDays = q ? (parseFloat(q.used_days) || 0) : (approvedDaysMap[typeIdStr] || 0);
        let remainingDays = q && q.remaining_days !== null && q.remaining_days !== undefined
          ? parseFloat(q.remaining_days)
          : Math.max(0, totalEntitlement - usedDays);

        if (isVacation && isEmpUnder1Year) {
          totalEntitlement = 0;
          remainingDays = 0;
        }

        deduplicatedQuotas.push({
          ...(q || {}),
          leave_type_id: t.id,
          leave_type_name: leaveName,
          entitlement_days: totalEntitlement,
          used_days: usedDays,
          remaining_days: remainingDays,
          card_color: typeInfo.color || getLeaveTypeColor(leaveName, idx),
          approved_times: approvedTimesMap[typeIdStr] || 0,
          is_under_1_year: isVacation && isEmpUnder1Year
        });
      });
    }

    // 🎯 Fallback: ถ้าไม่มี types หรือ deduplicatedQuotas ยังว่างเปล่า แต่มี quotas
    if (deduplicatedQuotas.length === 0 && quotas && quotas.length > 0) {
      quotas.forEach((q, idx) => {
        const leaveName = q.leave_types?.leave_name || q.leave_type_name || q.leave_name || "สิทธิ์การลา";
        const typeId = q.leave_type_id || q.id || `type_${idx}`;
        const typeIdStr = String(typeId);
        const totalEntitlement = parseFloat(q.entitlement_days) || parseFloat(q.quota) || 0;
        const usedDays = parseFloat(q.used_days) || 0;
        const remainingDays = parseFloat(q.remaining_days) ?? Math.max(0, totalEntitlement - usedDays);

        deduplicatedQuotas.push({
          ...q,
          leave_type_id: typeId,
          leave_type_name: leaveName,
          entitlement_days: totalEntitlement,
          used_days: usedDays,
          remaining_days: remainingDays,
          card_color: getLeaveTypeColor(leaveName, idx),
          approved_times: approvedTimesMap[typeIdStr] || 0
        });
      });
    }

    renderQuotaCards(deduplicatedQuotas);
    if (typeof initQuickForm === 'function') {
      initQuickForm(window.currentProfile, deduplicatedQuotas);
    }
    if (typeof checkSmartNudges === 'function') {
      checkSmartNudges(window.currentProfile, deduplicatedQuotas);
    }
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดใน loadQuotaData:', err);
  }
}

/* ==========================================================================
   🔄 9.1 ฟังก์ชันรีเซ็ตและคำนวณโควต้าใหม่ (ระบบยืนยัน 2 ชั้น ป้องกันข้อผิดพลาด)
   ========================================================================== */
window.resetLeaveQuotaWithDoubleConfirm = async function() {
  const sb = getSafeSupabaseClient();
  const employeeId = window.currentProfile?.id || window.currentProfile?.employee_id;
  const currentYear = typeof window.getCurrentLeaveYear === 'function' ? window.getCurrentLeaveYear() : new Date().getFullYear();
  const thaiYear = currentYear + 543;

  if (!sb || !employeeId) {
    if (typeof Swal !== 'undefined') {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้งานในระบบ', 'error');
    }
    return;
  }

  // 🛡️ ขั้นตอนที่ 1 (Step 1: First Confirmation)
  const step1 = await Swal.fire({
    title: '🔄 รีเซ็ตและคำนวณโควต้าใหม่?',
    html: `
      <div style="text-align: left; font-size: 13.5px; color: #334155; line-height: 1.6;">
        <p style="margin-bottom: 8px;">ระบบจะทำการประมวลผลดังนี้:</p>
        <ul style="padding-left: 20px; margin-bottom: 12px;">
          <li><b>รวมข้อมูลโควต้าที่ซ้ำซ้อน</b> ให้เป็นมาตรฐานปี ค.ศ. ${currentYear} (พ.ศ. ${thaiYear}) เดียวกัน</li>
          <li><b>คำนวณวันลาที่ใช้ไปใหม่</b> ตามใบลาที่ได้รับอนุมัติจริงทั้งหมดในปี ${currentYear}</li>
          <li><b>ปรับยอดคงเหลือให้ถูกต้องแม่นยำ</b> ตามสิทธิ์ประจำปีลบด้วยวันที่ลาจริง</li>
        </ul>
        <div style="background: #fef3c7; color: #92400e; padding: 10px 12px; border-radius: 8px; font-size: 12px; border: 1px solid #fde68a;">
          ⚠️ <b>หมายเหตุ:</b> การคำนวณใหม่จะอิงจากประวัติใบลาในระบบ เหมาะสำหรับการแก้ปัญหาโควต้าซ้ำหรือยอดไม่ตรง
        </div>
      </div>
    `,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ถัดไป (ยืนยันขั้นที่ 2) ➡️',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#0d9488',
    cancelButtonColor: '#94a3b8'
  });

  if (!step1.isConfirmed) return;

  // 🛡️ ขั้นตอนที่ 2 (Step 2: Second Confirmation - Strict Double Confirmation)
  const step2 = await Swal.fire({
    title: '🔐 ยืนยันการรีเซ็ตโควต้า (ขั้นที่ 2/2)',
    html: `
      <div style="font-size: 13px; color: #475569; margin-bottom: 14px;">
        กรุณาพิมพ์คำว่า <b style="color:#0d9488; font-size: 16px; letter-spacing: 1px;">CONFIRM</b> ในช่องด้านล่างเพื่อยืนยัน
      </div>
    `,
    input: 'text',
    inputPlaceholder: 'พิมพ์ CONFIRM เพื่อยืนยัน',
    showCancelButton: true,
    confirmButtonText: '🚀 ยืนยันและรีเซ็ตทันที',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#94a3b8',
    inputValidator: (value) => {
      if (!value || value.trim().toUpperCase() !== 'CONFIRM') {
        return '❌ กรุณาพิมพ์คำว่า CONFIRM ให้ถูกต้อง';
      }
    }
  });

  if (!step2.isConfirmed) return;

  Swal.fire({
    title: 'กำลังรีเซ็ตและคำนวณโควต้าใหม่...',
    text: 'ระบบกำลังรวมแถวซ้ำและคำนวณวันลาจริง กรุณารอสักครู่',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    // 1. ดึงประเภทการลาทั้งหมด
    const { data: leaveTypes, error: ltErr } = await sb
      .from('leave_types')
      .select('id, leave_name, yearly_quota, default_days');
    if (ltErr) throw ltErr;

    // 2. ดึงใบลาที่อนุมัติแล้วในปีนี้
    const { data: approvedLeaves, error: reqErr } = await sb
      .from('leave_requests')
      .select('id, leave_type_id, total_days, start_date, status')
      .eq('employee_id', employeeId)
      .eq('status', 'approved');
    if (reqErr) throw reqErr;

    // รวมยอดวันลาที่ใช้ไปจริงแยกตามประเภทในปีนี้
    const usedMap = {};
    (approvedLeaves || []).forEach(r => {
      const reqYear = r.start_date ? (typeof window.getADYear === 'function' ? window.getADYear(r.start_date) : new Date(r.start_date).getFullYear()) : currentYear;
      if (reqYear === currentYear) {
        const typeIdStr = String(r.leave_type_id);
        usedMap[typeIdStr] = (usedMap[typeIdStr] || 0) + (parseFloat(r.total_days) || 0);
      }
    });

    // 3. ปรับปรุงยอดวันลาที่ใช้ไปจริงใน employee_leave_balances
    if (window.PVTSDK?.user?.ensureLeaveBalances) {
      await window.PVTSDK.user.ensureLeaveBalances(employeeId, currentYear);
    }

    for (const lt of (leaveTypes || [])) {
      const typeIdStr = String(lt.id);
      const actualUsed = usedMap[typeIdStr] || 0;
      if (window.PVTSDK?.user?.updateLeaveBalance) {
        await window.PVTSDK.user.updateLeaveBalance(employeeId, lt.id, lt.leave_code, currentYear, 0, actualUsed);
      }
    }

    // โหลดข้อมูลขึ้นหน้าจอใหม่ทันที
    if (typeof loadQuotaData === 'function') {
      await loadQuotaData(currentYear);
    }
    if (typeof loadRecentLeaves === 'function' && window.currentProfile) {
      await loadRecentLeaves(window.currentProfile);
    }

    Swal.fire({
      icon: 'success',
      title: '✅ รีเซ็ตโควต้าสำเร็จ!',
      html: `
        <div style="font-size: 13.5px; color: #334155; line-height: 1.5;">
          ระบบได้รวมข้อมูลที่ซ้ำซ้อน และคำนวณสิทธิ์วันลาคงเหลือประจำปี <b>${currentYear} (พ.ศ. ${thaiYear})</b> เรียบร้อยแล้ว
        </div>
      `,
      confirmButtonColor: '#0d9488'
    });
  } catch (err) {
    console.error('❌ Reset quota error:', err);
    Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถรีเซ็ตโควต้าได้', 'error');
  }
};

/* ==========================================================================
   🔗 10. ระบบเชื่อมต่อ LINE Notification
   ========================================================================== */
window.generateLineLinkToken = async function() {
  const sb = getSafeSupabaseClient();
  const employeeId = window.currentProfile?.id || window.currentProfile?.employee_id;

  if (!sb || !employeeId) {
    Swal.fire('แจ้งเตือน', 'กรุณาล็อกอินใหม่อีกครั้งเพื่อเชื่อมต่อ LINE', 'warning');
    return;
  }

  try {
    let token = "";
    let created = false;

    // 1. ลองเรียกผ่าน Server API (/api/create-line-link) เพื่อหลีกเลี่ยง RLS
    try {
      const apiRes = await fetch("/api/create-line-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId })
      });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.success && apiData.token) {
          token = apiData.token;
          created = true;
        }
      }
    } catch (e) {}

    // 2. Fallback บันทึกลง DB
    if (!created && sb) {
      token = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      const { error } = await sb.from('line_link_tokens').insert({
        employee_id: employeeId,
        token: token,
        link_code: token,
        expires_at: expiresAt
      });
      if (!error) created = true;
    }

    if (!token) {
      throw new Error("ไม่สามารถสร้างรหัสเชื่อมต่อ LINE ได้");
    }

    // 3. แสดงรหัสให้ผู้ใช้
    Swal.fire({
      title: '🔗 เชื่อมต่อ LINE แจ้งเตือน',
      html: `
        <div style="text-align: center; padding: 10px;">
          <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">
            กรุณาส่งรหัส 6 หลักนี้ไปยัง <b>LINE Official Account</b> ของบริษัท
          </p>
          <div style="font-size: 42px; font-weight: 800; color: #166534; letter-spacing: 8px; background: #f0fdf4; padding: 20px; border-radius: 16px; border: 2px dashed #22c55e;">
            ${token}
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
            * รหัสมีอายุการใช้งาน 10 นาที
          </p>
        </div>
      `,
      confirmButtonText: 'รับทราบ',
      confirmButtonColor: '#166534',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg',
      imageWidth: 60,
      imageHeight: 60,
    });

  } catch (err) {
    console.error('❌ Generate LINE token error:', err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างรหัสเชื่อมต่อได้ กรุณาลองใหม่ครับ', 'error');
  }
};

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

    const isUnder1Year = Boolean(item.is_under_1_year);
    const tenureBadge = isUnder1Year ? `<span title="รอบปีการลาบริษัท: 1 ธ.ค. - 30 พ.ย." style="font-size: 11px; color: #e11d48; font-weight: 600; background: #fff1f2; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecdd3; margin-left: 6px;">อายุงานไม่ถึง 1 ปี (รอบ 1 ธ.ค. - 30 พ.ย.)</span>` : '';

    return `
      <div class="quota-card" 
           onclick="showLeaveTypeHistory('${leaveTypeId}', '${typeName}')"
           style="border-top: 4px solid ${cardColor}; cursor: pointer; transition: transform 0.15s ease;"
           title="คลิกเพื่อดูประวัติ ${typeName}">
        <div class="quota-header-row" style="flex-wrap: wrap; gap: 4px; align-items: center;">
          <div class="quota-type-title">${typeName} ${tenureBadge}</div>
          <span class="quota-approved-badge" style="background: ${cardColor}15; color: ${cardColor}; border: 1px solid ${cardColor}30; margin-left: auto;">
            อนุมัติ ${approvedTimes} ครั้ง
          </span>
        </div>
        
        <div class="quota-days">
          <span class="num-highlight" style="color: ${cardColor};">${remaining}</span>
          <span class="num-total">/ ${total} วัน</span>
        </div>
        
        <div class="quota-progress-track">
          <div class="quota-progress-bar" style="width: ${usedPercent}%; background-color: ${cardColor};"></div>
        </div>

        <div class="quota-footer">
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

    if (typeof Swal !== 'undefined') {
      const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      Swal.fire({
        title: `<div style="display:flex; align-items:center; justify-content:center; gap:8px; font-size:17px; font-weight:700; color:#0f766e;">
          <span class="material-symbols-outlined" style="font-size:24px; color:#0d9488;">cloud_done</span>
          อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว
        </div>`,
        html: `
          <div style="font-size:13px; color:#475569; margin-top:8px;">
            ซิงค์ยอดวันลาคงเหลือและสถิติข้อมูลส่วนบุคคลล่าสุดเรียบร้อย (${timeStr} น.)
          </div>
        `,
        showConfirmButton: true,
        confirmButtonText: '<span style="display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;font-size:13.5px;font-weight:700;"><span class="material-symbols-outlined" style="font-size:18px;">check_circle</span> ตกลง</span>',
        confirmButtonColor: '#0d9488',
        showDenyButton: false,
        showCancelButton: false,
        timer: 15000,
        timerProgressBar: true,
        showCloseButton: true,
        allowOutsideClick: true,
        allowEscapeKey: true,
        didOpen: (popup) => {
          const container = popup.closest('.swal2-container') || document.querySelector('.swal2-container');
          if (container) {
            container.style.zIndex = '2147483647';
            container.style.pointerEvents = 'auto';
          }
        }
      });
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

/* [DEPRECATED] toggleUserGuide is now handled by SystemDiagnostics unified button */

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

// 🌐 Global Window Function Bindings for User Dashboard Page
window.loadRecentLeaves = typeof loadRecentLeaves !== 'undefined' ? loadRecentLeaves : window.loadRecentLeaves;
window.viewMyDigitalCard = typeof viewMyDigitalCard !== 'undefined' ? viewMyDigitalCard : window.viewMyDigitalCard;
window.showLeaveTypeHistory = typeof showLeaveTypeHistory !== 'undefined' ? showLeaveTypeHistory : window.showLeaveTypeHistory;
window.openEmployeeStatusTrackerModal = typeof openEmployeeStatusTrackerModal !== 'undefined' ? openEmployeeStatusTrackerModal : window.openEmployeeStatusTrackerModal;
window.refreshUserData = typeof refreshUserData !== 'undefined' ? refreshUserData : window.refreshUserData;
window.goToLeaveForm = typeof goToLeaveForm !== 'undefined' ? goToLeaveForm : window.goToLeaveForm;
window.goToLeaveHistory = typeof goToLeaveHistory !== 'undefined' ? goToLeaveHistory : window.goToLeaveHistory;
window.goToRules = typeof goToRules !== 'undefined' ? goToRules : window.goToRules;
window.goToProfile = typeof goToProfile !== 'undefined' ? goToProfile : window.goToProfile;
window.goToHolidays = typeof goToHolidays !== 'undefined' ? goToHolidays : window.goToHolidays;
window.logout = typeof logout !== 'undefined' ? logout : window.logout;
window.resetLeaveQuotaWithDoubleConfirm = typeof resetLeaveQuotaWithDoubleConfirm !== 'undefined' ? resetLeaveQuotaWithDoubleConfirm : window.resetLeaveQuotaWithDoubleConfirm;

/* ==========================================================================
   ⚡ 15. Quick Form (1-Click Request) Functionality
   ========================================================================== */
window.selectedQuickLeaveTypeId = null;

window.toggleQuickForm = function() {
  const body = document.getElementById('quickFormBody');
  const arrow = document.getElementById('quickFormArrow');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    if (arrow) arrow.style.transform = 'rotate(180deg)';
    
    // Set default dates to today
    const today = new Date().toLocaleDateString('en-CA');
    const startInput = document.getElementById('qStartDate');
    const endInput = document.getElementById('qEndDate');
    if (startInput) startInput.value = today;
    if (endInput) endInput.value = today;
  } else {
    body.style.display = 'none';
    if (arrow) arrow.style.transform = 'rotate(0deg)';
  }
};

window.selectedQuickFile = null;

// 📎 จัดการการเลือกไฟล์แนบใน Quick Form
window.handleQuickFileSelect = function(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  
  // ตรวจสอบขนาดไฟล์ (สูงสุด 10MB)
  if (file.size > 10 * 1024 * 1024) {
    Swal.fire({
      icon: 'warning',
      title: 'ขนาดไฟล์เกินกำหนด',
      text: 'กรุณาเลือกไฟล์ขนาดไม่เกิน 10 MB ครับ',
      confirmButtonColor: '#0d9488'
    });
    input.value = '';
    return;
  }

  window.selectedQuickFile = file;

  const uploadPrompt = document.getElementById('qUploadPrompt');
  const filePreview = document.getElementById('qFilePreview');
  const fileNameEl = document.getElementById('qFileName');
  const fileSizeEl = document.getElementById('qFileSize');
  const fileIconEl = document.getElementById('qFileIcon');
  const fileThumbEl = document.getElementById('qFileThumb');

  if (uploadPrompt) uploadPrompt.style.display = 'none';
  if (filePreview) filePreview.style.display = 'flex';

  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) {
    const sizeKB = (file.size / 1024).toFixed(1);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(2)} MB` : `${sizeKB} KB`;
    fileSizeEl.textContent = `${sizeStr} • พร้อมแนบส่ง`;
  }

  const isImage = file.type.startsWith('image/');
  if (isImage && fileThumbEl) {
    const reader = new FileReader();
    reader.onload = (e) => {
      fileThumbEl.src = e.target.result;
      fileThumbEl.style.display = 'block';
      if (fileIconEl) fileIconEl.style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    if (fileThumbEl) fileThumbEl.style.display = 'none';
    if (fileIconEl) {
      fileIconEl.style.display = 'block';
      fileIconEl.textContent = file.type.includes('pdf') ? 'picture_as_pdf' : 'description';
    }
  }
};

window.clearQuickFile = function() {
  window.selectedQuickFile = null;
  const input = document.getElementById('qAttachmentInput');
  if (input) input.value = '';

  const uploadPrompt = document.getElementById('qUploadPrompt');
  const filePreview = document.getElementById('qFilePreview');
  const fileThumbEl = document.getElementById('qFileThumb');
  const fileIconEl = document.getElementById('qFileIcon');

  if (uploadPrompt) uploadPrompt.style.display = 'block';
  if (filePreview) filePreview.style.display = 'none';
  if (fileThumbEl) {
    fileThumbEl.src = '';
    fileThumbEl.style.display = 'none';
  }
  if (fileIconEl) {
    fileIconEl.style.display = 'block';
    fileIconEl.textContent = 'description';
  }
};

// ⚡ ฟังก์ชันอัปโหลดเอกสารแนบขึ้น Supabase Storage (leave-attachments)
async function uploadQuickAttachment(file, employeeId, sb) {
  if (!file || !sb) return null;
  try {
    let fileToUpload = file;
    // บีบอัดภาพหากขนาดเกิน 500KB เพื่อประหยัดพื้นที่และส่งเร็ว
    if (file.type.startsWith('image/') && file.size > 500 * 1024) {
      try {
        fileToUpload = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxDim = 1600;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
              } else {
                resolve(file);
              }
            }, 'image/jpeg', 0.82);
          };
          img.onerror = () => resolve(file);
          img.src = URL.createObjectURL(file);
        });
      } catch (cErr) {
        console.warn("Could not compress image:", cErr);
        fileToUpload = file;
      }
    }

    const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
    const fileName = `${employeeId}/quick_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

    const { error } = await sb.storage
      .from('leave-attachments')
      .upload(fileName, fileToUpload, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data: pubData } = sb.storage
      .from('leave-attachments')
      .getPublicUrl(fileName);

    return pubData?.publicUrl || null;
  } catch (err) {
    console.error("Upload quick attachment error:", err);
    throw err;
  }
}

window.initQuickForm = async function(profile, quotas) {
  if (!profile) return;
  
  // Populate Position and department
  const employee = profile.employees || profile;
  const deptName = employee?.departments?.department_name || employee?.department_name || "ทั่วไป";
  const posName = employee?.positions?.position_name || employee?.position_name || "พนักงาน";
  const posInput = document.getElementById('qPosition');
  if (posInput) {
    posInput.value = `${posName} / ฝ่าย ${deptName}`;
  }
  
  // ⚡ ตรวจสอบหาหัวหน้างาน (L1) หากไม่มีหัวหน้ากะ/หัวหน้าธรรมดา ให้ค้นหาผู้จัดการ (Manager) เลยทันที
  let approverText = "กำลังค้นหาผู้อนุมัติ...";
  let approverNote = "";
  let resolvedApprover = {
    id: null,
    name: "",
    role: "leader",
    hasLeader: false,
    hasManager: false
  };

  const sb = getSafeSupabaseClient();
  if (sb) {
    try {
      const deptId = employee?.department_id || null;
      let approverEmpId = employee?.l1_approver_id || null;
      let isLeaderFound = false;

      // 1. ตรวจสอบหัวหน้างาน / หัวหน้ากะ (L1) ประจำตัวหรือของแผนก
      if (!approverEmpId && deptId) {
        const { data: deptApprover } = await sb
          .from('department_approvers')
          .select('supervisor_id, manager_id')
          .eq('department_id', deptId)
          .maybeSingle();
        approverEmpId = deptApprover?.supervisor_id || null;
      }

      // ถ้ายังไม่พบ ตรวจสอบพนักงานในแผนกที่มี role leader/supervisor หรือตำแหน่งหัวหน้า/กะ
      if (!approverEmpId && deptId) {
        const { data: deptEmps } = await sb
          .from('employees')
          .select('id, full_name, role, positions!position_id(position_name), status')
          .eq('department_id', deptId)
          .neq('id', employee.id);

        const leader = (deptEmps || []).find(e => {
          if (e.status && e.status !== 'active') return false;
          const r = String(e.role || '').toLowerCase();
          const p = String(e.positions?.position_name || '').toLowerCase();
          return r.includes('leader') || r.includes('supervisor') || p.includes('หัวหน้า') || p.includes('กะ');
        });
        if (leader) approverEmpId = leader.id;
      }

      if (approverEmpId) {
        const { data: appEmp } = await sb
          .from('employees')
          .select('id, full_name, role, positions!position_id(position_name)')
          .eq('id', approverEmpId)
          .maybeSingle();
        if (appEmp) {
          const pName = appEmp.positions?.position_name || 'หัวหน้างาน/หัวหน้ากะ';
          approverText = `${appEmp.full_name} (${pName})`;
          approverNote = '✓ สายอนุมัติ: ส่งคำขอให้หัวหน้างาน/หัวหน้ากะพิจารณา (L1)';
          resolvedApprover = {
            id: appEmp.id,
            name: appEmp.full_name,
            role: 'leader',
            hasLeader: true,
            hasManager: false
          };
          isLeaderFound = true;
        }
      }

      // 2. ⚡ เงื่อนไขเพิ่ม: ถ้าไม่มีหัวหน้ากะ หรือหัวหน้าธรรมดา -> ให้หาผู้จัดการ (Manager) เลย!
      if (!isLeaderFound) {
        let managerEmpId = employee?.l2_approver_id || null;

        if (!managerEmpId && deptId) {
          const { data: deptApprover } = await sb
            .from('department_approvers')
            .select('manager_id')
            .eq('department_id', deptId)
            .maybeSingle();
          managerEmpId = deptApprover?.manager_id || null;
        }

        if (!managerEmpId && deptId) {
          const { data: deptData } = await sb
            .from('departments')
            .select('approver_id')
            .eq('id', deptId)
            .maybeSingle();
          managerEmpId = deptData?.approver_id || null;
        }

        if (!managerEmpId && deptId) {
          const { data: deptEmps } = await sb
            .from('employees')
            .select('id, full_name, role, positions!position_id(position_name), status')
            .eq('department_id', deptId)
            .neq('id', employee.id);

          const mgr = (deptEmps || []).find(e => {
            if (e.status && e.status !== 'active') return false;
            const r = String(e.role || '').toLowerCase();
            const p = String(e.positions?.position_name || '').toLowerCase();
            return r.includes('manager') || p.includes('ผู้จัดการ');
          });
          if (mgr) managerEmpId = mgr.id;
        }

        // ค้นหาผู้จัดการระดับองค์กร/ผู้บริหารส่วนกลาง
        if (!managerEmpId) {
          const { data: anyMgr } = await sb
            .from('employees')
            .select('id, full_name, role, positions!position_id(position_name)')
            .in('role', ['manager', 'director', 'executive', 'owner'])
            .limit(1)
            .maybeSingle();
          if (anyMgr) managerEmpId = anyMgr.id;
        }

        if (managerEmpId) {
          const { data: mgrEmp } = await sb
            .from('employees')
            .select('id, full_name, role, positions!position_id(position_name)')
            .eq('id', managerEmpId)
            .maybeSingle();
          if (mgrEmp) {
            const mPos = mgrEmp.positions?.position_name || 'ผู้จัดการฝ่าย';
            approverText = `${mgrEmp.full_name} (${mPos})`;
            approverNote = '⚡ ไม่มีหัวหน้ากะ/หัวหน้างานประจำแผนก: ระบบส่งต่อให้ผู้จัดการฝ่ายพิจารณาอนุมัติโดยตรง';
            resolvedApprover = {
              id: mgrEmp.id,
              name: mgrEmp.full_name,
              role: 'manager',
              hasLeader: false,
              hasManager: true
            };
          }
        } else {
          // หากไม่มีทั้งหัวหน้าและผู้จัดการ ส่งต่อ HR
          const { data: hrEmp } = await sb
            .from('employees')
            .select('id, full_name, role')
            .in('role', ['hr', 'admin'])
            .limit(1)
            .maybeSingle();
          approverText = hrEmp ? `${hrEmp.full_name} (ฝ่ายบุคคล HR)` : 'ฝ่ายบุคคล (HR)';
          approverNote = '⚡ ส่งต่อฝ่ายบุคคล (HR) พิจารณาอนุมัติโดยตรง';
          resolvedApprover = {
            id: hrEmp?.id || null,
            name: hrEmp?.full_name || 'HR',
            role: 'hr',
            hasLeader: false,
            hasManager: false
          };
        }
      }
    } catch (e) {
      console.error("Error loading quick form approver:", e);
      approverText = "ส่งต่อฝ่ายบุคคล (HR)";
      approverNote = "ส่งคำขอไปยังฝ่ายทรัพยากรบุคคล";
    }
  }

  window.quickFormApproverInfo = resolvedApprover;

  const approverInput = document.getElementById('qApprover');
  if (approverInput) {
    approverInput.value = approverText;
  }
  const noteEl = document.getElementById('qApproverNote');
  if (noteEl) {
    noteEl.textContent = approverNote;
    noteEl.style.display = 'block';
    if (!resolvedApprover.hasLeader && resolvedApprover.hasManager) {
      noteEl.style.color = '#d97706';
      noteEl.style.fontWeight = '600';
    } else {
      noteEl.style.color = '#0d9488';
      noteEl.style.fontWeight = '500';
    }
  }

  // Generate Leave type buttons from quotas
  const grid = document.getElementById('qLeaveTypesGrid');
  if (grid) {
    if (quotas && quotas.length > 0) {
      grid.innerHTML = quotas.map((item, idx) => {
        const name = item.leave_type_name || "วันลา";
        const remaining = item.remaining_days ?? 0;
        const cardColor = item.card_color || "#0d9488";
        
        return `
          <button type="button" 
                  class="q-leave-btn" 
                  data-id="${item.leave_type_id}"
                  onclick="selectQuickLeaveType('${item.leave_type_id}', this)"
                  style="border: 1.5px solid ${cardColor}40; background: #ffffff; border-radius: 8px; padding: 10px; text-align: left; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 4px; outline: none;">
            <span style="font-size: 13px; font-weight: 600; color: #1e293b;">${name}</span>
            <span style="font-size: 11px; color: ${cardColor}; font-weight: 700;">เหลือ ${remaining} วัน</span>
          </button>
        `;
      }).join('');
    } else {
      grid.innerHTML = `<span style="font-size: 12px; color: #64748b; font-style: italic;">ไม่พบประเภทการลาของคุณ</span>`;
    }
  }
};

window.selectQuickLeaveType = function(leaveTypeId, element) {
  window.selectedQuickLeaveTypeId = leaveTypeId;
  
  // Clear other active buttons
  const btns = document.querySelectorAll('.q-leave-btn');
  btns.forEach(btn => {
    btn.style.background = '#ffffff';
    btn.style.borderColor = '#cbd5e1';
    btn.style.boxShadow = 'none';
  });
  
  // Highlight selected button
  element.style.background = '#f0fdfa';
  element.style.borderColor = '#0d9488';
  element.style.boxShadow = '0 0 0 2px rgba(13, 148, 136, 0.15)';
};

window.submitQuickLeave = async function() {
  const sb = getSafeSupabaseClient();
  if (!sb) return;
  
  const leaveTypeId = window.selectedQuickLeaveTypeId;
  const startDate = document.getElementById('qStartDate')?.value;
  const endDate = document.getElementById('qEndDate')?.value;
  const reason = document.getElementById('qReason')?.value?.trim();
  const file = window.selectedQuickFile;
  
  if (!leaveTypeId) {
    return Swal.fire({ icon: 'warning', title: 'กรุณาเลือกประเภทการลา', text: 'เลือกประเภทการลาโดยคลิกที่ปุ่มตัวเลือกสิทธิ์วันลาคงเหลือด้านบนครับ', confirmButtonColor: '#0d9488' });
  }
  if (!startDate || !endDate) {
    return Swal.fire({ icon: 'warning', title: 'ระบุวันที่ลาให้ครบถ้วน', text: 'กรุณากรอกวันที่เริ่มและสิ้นสุดการลาด้วยครับ', confirmButtonColor: '#0d9488' });
  }
  if (!reason) {
    return Swal.fire({ icon: 'warning', title: 'ระบุเหตุผลการลา', text: 'กรุณาระบุเหตุผลในการลาพักในช่องข้อความด้วยครับ', confirmButtonColor: '#0d9488' });
  }
  
  // Check date order
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  if (startD > endD) {
    return Swal.fire({ icon: 'warning', title: 'วันที่เริ่มต้นผิดพลาด', text: 'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุดการลาครับ', confirmButtonColor: '#0d9488' });
  }

  // Calculate total days
  const diffTime = Math.abs(endD - startD);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  Swal.fire({
    title: 'กำลังส่งคำขอลาของคุณ...',
    text: file ? 'กำลังอัปโหลดเอกสารแนบและบันทึกข้อมูลเข้าระบบ...' : 'ระบบกำลังดึงสิทธิ์ คงเหลือ และตรวจสอบลำดับการอนุมัติโปรดรอสักครู่...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const employeeId = window.currentProfile?.id || window.currentProfile?.employee_id;
    const todayStr = new Date().toLocaleDateString('en-CA');

    // 📎 อัปโหลดไฟล์เอกสารแนบ (ถ้ามี)
    let attachmentUrl = null;
    if (file) {
      attachmentUrl = await uploadQuickAttachment(file, employeeId, sb);
    }

    const hasLeader = window.quickFormApproverInfo?.hasLeader ?? true;
    const hasManager = window.quickFormApproverInfo?.hasManager ?? false;

    // Create the leave request object
    // ถ้าไม่มีหัวหน้ากะ/หัวหน้างาน ให้ข้าม L1 (manager_status = 'approved') และส่งให้ผู้จัดการฝ่าย (director_status = 'pending') พิจารณา
    const leaveRequest = {
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      total_days: diffDays,
      reason: reason,
      attachment_url: attachmentUrl,
      status: 'pending',
      manager_status: hasLeader ? 'pending' : 'approved',
      director_status: 'pending',
      write_date: todayStr
    };

    const { data: insertedData, error } = await sb
      .from('leave_requests')
      .insert([leaveRequest])
      .select();

    if (error) throw error;

    // 🔔 บันทึกการแจ้งเตือนลงตาราง notifications ให้ผู้อนุมัติ
    try {
      const approverId = window.quickFormApproverInfo?.id;
      const approverRole = window.quickFormApproverInfo?.role || 'leader';
      const applicantName = window.currentProfile?.full_name || 'พนักงาน';

      if (approverId) {
        const notifTitle = hasLeader 
          ? '📌 มีคำขอลาใหม่แบบเร่งด่วน (รอหัวหน้างานอนุมัติ)'
          : '⚡ มีคำขอลาใหม่แบบเร่งด่วน (ส่งถึงผู้จัดการโดยตรง)';
        const notifMsg = hasLeader
          ? `${applicantName} ได้ยื่นคำขอลาแบบด่วน วันที่ ${startDate} ถึง ${endDate} กรุณาตรวจสอบ`
          : `${applicantName} ได้ยื่นคำขอลาแบบด่วน (ไม่มีหัวหน้างานประจำแผนก) ส่งตรงให้ผู้จัดการพิจารณา วันที่ ${startDate} ถึง ${endDate}`;
        
        await sb.from('notifications').insert([{
          employee_id: approverId,
          title: notifTitle,
          message: notifMsg,
          type: 'leave',
          link_url: approverRole === 'manager' ? '/pages/management/management.html' : '/pages/hr/hr.html',
          is_read: false
        }]);
      }
    } catch (notifErr) {
      console.warn("Could not insert notification:", notifErr);
    }

    // Trigger Line notification if PVTSDK is configured
    try {
      if (window.PVTSDK?.line?.notifyLeaveRequest) {
        await window.PVTSDK.line.notifyLeaveRequest({
          ...leaveRequest,
          approver_name: window.quickFormApproverInfo?.name,
          approver_role: window.quickFormApproverInfo?.role
        });
      }
    } catch (lineErr) {
      console.warn("Line notify warning:", lineErr);
    }

    let successHtml = 'คำขอลาแบบด่วน (1-Click) ถูกส่งไปยังหัวหน้างานและฝ่าย HR เพื่อตรวจสอบเรียบร้อยแล้ว';
    if (!hasLeader && hasManager) {
      successHtml = `แผนกของคุณไม่มีหัวหน้างาน/หัวหน้ากะ ระบบจึงได้ส่งคำขอตรงถึง <b>คุณ${window.quickFormApproverInfo?.name} (ผู้จัดการฝ่าย)</b> เพื่อพิจารณาอนุมัติเรียบร้อยแล้ว${attachmentUrl ? '<br><span style="color:#0d9488; font-size:13px; font-weight:600; display:inline-block; margin-top:6px;">✓ แนบไฟล์เอกสารเรียบร้อย</span>' : ''}`;
    } else if (attachmentUrl) {
      successHtml += '<br><span style="color:#0d9488; font-size:13px; font-weight:600; display:inline-block; margin-top:6px;">✓ แนบไฟล์เอกสารเรียบร้อย</span>';
    }

    Swal.fire({
      icon: 'success',
      title: '⚡ ยื่นคำขอลาสำเร็จ!',
      html: successHtml,
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#0d9488'
    }).then(() => {
      // Refresh page data
      location.reload();
    });

  } catch (err) {
    console.error("Quick Leave submission failed:", err);
    Swal.fire({
      icon: 'error',
      title: 'เกิดข้อผิดพลาด',
      text: err.message || 'ไม่สามารถบันทึกข้อมูลได้',
      confirmButtonColor: '#ef4444'
    });
  }
};

/* ==========================================================================
   🔔 16. Smart Proactive Nudges (การเตือนเชิงรุก)
   ========================================================================== */
window.checkSmartNudges = async function(profile, quotas) {
  const container = document.getElementById('smartNudgeContainer');
  if (!container) return;

  let nudges = [];

  // 1. Nudge for Annual Leave Planning (เตือนใช้วันลาพักร้อนก่อนหมดปีงบประมาณ)
  if (quotas && quotas.length > 0) {
    const annualLeave = quotas.find(q => {
      const name = (q.leave_type_name || '').toLowerCase();
      return name.includes('พักร้อน') || name.includes('พักผ่อน') || name.includes('annual');
    });

    if (annualLeave && annualLeave.remaining_days > 0) {
      nudges.push(`
        <div class="smart-nudge-card" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1.5px solid #fde68a; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.08); margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: #fbbf24; color: #78350f; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <span class="material-symbols-outlined" style="font-size: 24px;">beach_access</span>
            </div>
            <div>
              <strong style="color: #92400e; font-size: 14px; display: block;">🏖️ วางแผนใช้วันหยุดพักร้อนประจำปี</strong>
              <span style="font-size: 12px; color: #b45309;">
                คุณมีสิทธิ์ลาพักร้อนคงเหลือ <strong>${annualLeave.remaining_days} วัน</strong> อย่าลืมวางแผนใช้วันหยุดก่อนสิ้นรอบปีงบประมาณ (30 พ.ย.) เพื่อรักษาสิทธิ์ของท่าน
              </span>
            </div>
          </div>
          <button type="button" onclick="toggleQuickForm()" style="background: #d97706; color: #ffffff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
            <span class="material-symbols-outlined" style="font-size: 16px;">bolt</span> ยื่นคำขอด่วน
          </button>
        </div>
      `);
    }
  }

  // 2. Nudge for Approvers (เตือนหัวหน้างานเรื่อง SLA 48 ชั่วโมง)
  const role = (profile?.role || profile?.employees?.role || '').toLowerCase();
  const isApproverRole = ['leader', 'manager', 'director', 'executive', 'hr', 'admin'].includes(role);

  if (isApproverRole) {
    const sb = getSafeSupabaseClient();
    if (sb) {
      try {
        const { count } = await sb
          .from('leave_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');

        if (count && count > 0) {
          nudges.push(`
            <div class="smart-nudge-card" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 1.5px solid #bfdbfe; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 14px; box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08); margin-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 42px; height: 42px; border-radius: 12px; background: #3b82f6; color: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span class="material-symbols-outlined" style="font-size: 24px;">alarm_on</span>
                </div>
                <div>
                  <strong style="color: #1e40af; font-size: 14px; display: block;">⚡ การเตือนความเร็ว SLA (48 ชม.)</strong>
                  <span style="font-size: 12px; color: #1d4ed8;">
                    มีคำขอลาที่รอการพิจารณาในระบบ <strong>${count} รายการ</strong> โปรดพิจารณาอนุมัติให้เสร็จสิ้นภายใน 48 ชม. เพื่อไม่ให้หลุดกรอบเวลา
                  </span>
                </div>
              </div>
              <a href="/pages/hr/home.html" style="text-decoration: none; background: #2563eb; color: #ffffff; border: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
                <span class="material-symbols-outlined" style="font-size: 16px;">checklist</span> ตรวจสอบทันที
              </a>
            </div>
          `);
        }
      } catch (err) {
        console.warn("Approver nudge check err:", err);
      }
    }
  }

  if (nudges.length > 0) {
    container.innerHTML = nudges.join('');
    container.style.display = 'block';
  } else {
    container.style.display = 'none';
  }
};

/* ==========================================================================
   📍 17. Visual Progress Tracker Modal (Timeline Stepper)
   ========================================================================== */
window.openVisualTimelineModal = async function(leaveId) {
  const modal = document.getElementById('visualTimelineModal');
  const body = document.getElementById('visualTimelineBody');
  if (!modal || !body) return;

  modal.style.display = 'flex';
  body.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #64748b;">
      <span class="material-symbols-outlined" style="font-size: 36px; animation: spin 1s linear infinite;">sync</span>
      <p style="margin-top: 8px;">กำลังโหลดข้อมูลขั้นตอนการอนุมัติ...</p>
    </div>
  `;

  let req = (window.recentLeaveRequestsCache || []).find(r => String(r.id) === String(leaveId));

  if (!req) {
    const sb = getSafeSupabaseClient();
    if (sb) {
      try {
        const { data } = await sb
          .from('leave_requests')
          .select('*, leave_types(leave_name), employees(full_name, employee_code, role, department_id, departments(department_name), positions(position_name))')
          .eq('id', leaveId)
          .single();
        req = data;
      } catch (e) {
        console.error("Fetch leave detail failed:", e);
      }
    }
  }

  if (!req) {
    body.innerHTML = `<div style="padding: 30px; text-align: center; color: #ef4444;">ไม่พบข้อมูลใบลาที่ต้องการตรวจสอบ</div>`;
    return;
  }

  const leaveName = req.leave_types?.leave_name || "วันลา";
  const startDate = formatThaiDate(req.start_date);
  const endDate = formatThaiDate(req.end_date);
  const days = req.total_days || 0;
  const reason = req.reason || "-";

  // Step calculations
  // Step 1: Submission (Always complete)
  // Step 2: L1 (Manager/Leader)
  const l1Status = req.manager_status || 'pending';
  // Step 3: L2 (Director)
  const l2Status = req.director_status || 'pending';
  // Step 4: Final HR
  const finalStatus = req.status || 'pending';

  const getStepBadge = (status) => {
    if (status === 'approved') return `<span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 2px;"><span class="material-symbols-outlined" style="font-size: 13px;">check_circle</span> อนุมัติแล้ว</span>`;
    if (status === 'rejected') return `<span style="background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 2px;"><span class="material-symbols-outlined" style="font-size: 13px;">cancel</span> ไม่อนุมัติ</span>`;
    return `<span style="background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 2px;"><span class="material-symbols-outlined" style="font-size: 13px;">hourglass_top</span> กำลังรอพิจารณา</span>`;
  };

  const getCircleIcon = (status) => {
    if (status === 'approved') return { bg: '#10b981', color: '#fff', icon: 'check' };
    if (status === 'rejected') return { bg: '#ef4444', color: '#fff', icon: 'close' };
    return { bg: '#f59e0b', color: '#fff', icon: 'hourglass_empty' };
  };

  const c1 = { bg: '#10b981', color: '#fff', icon: 'check' };
  const c2 = getCircleIcon(l1Status);
  const c3 = (l1Status === 'approved') ? getCircleIcon(l2Status) : { bg: '#e2e8f0', color: '#94a3b8', icon: 'schedule' };
  const c4 = (finalStatus === 'approved') ? { bg: '#10b981', color: '#fff', icon: 'check_circle' } : (finalStatus === 'rejected') ? { bg: '#ef4444', color: '#fff', icon: 'cancel' } : { bg: '#e2e8f0', color: '#94a3b8', icon: 'verified' };

  body.innerHTML = `
    <!-- Card Summary Header -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 18px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="font-size: 16px; color: #0f172a;">${leaveName} (${days} วัน)</strong>
        <span style="font-size: 12px; color: #0d9488; font-weight: 600; background: #f0fdfa; padding: 3px 10px; border-radius: 12px; border: 1px solid #99f6e4;">
          ${startDate} ถึง ${endDate}
        </span>
      </div>
      <div style="font-size: 13px; color: #475569; display: flex; gap: 6px;">
        <span style="color: #64748b;">เหตุผล:</span>
        <span style="color: #1e293b; font-weight: 500;">${reason}</span>
      </div>
    </div>

    <!-- Stepper Vertical Timeline -->
    <div style="position: relative; padding-left: 36px; display: flex; flex-direction: column; gap: 24px;">
      <!-- Vertical connecting line -->
      <div style="position: absolute; left: 15px; top: 12px; bottom: 20px; width: 2px; background: #e2e8f0; z-index: 1;"></div>

      <!-- Step 1: Submit -->
      <div style="position: relative; z-index: 2;">
        <div style="position: absolute; left: -36px; width: 30px; height: 30px; border-radius: 50%; background: ${c1.bg}; color: ${c1.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px #ffffff;">
          <span class="material-symbols-outlined" style="font-size: 18px;">${c1.icon}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 14px; color: #0f172a;">1. ยื่นคำขอลาสำเร็จ</strong>
          <span style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px;">สำเร็จแล้ว</span>
        </div>
        <div style="font-size: 12px; color: #64748b;">คำขอลาถูกส่งเข้าระบบ PVT Workforce Hub เรียบร้อยแล้ว</div>
      </div>

      <!-- Step 2: L1 Leader -->
      <div style="position: relative; z-index: 2;">
        <div style="position: absolute; left: -36px; width: 30px; height: 30px; border-radius: 50%; background: ${c2.bg}; color: ${c2.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px #ffffff;">
          <span class="material-symbols-outlined" style="font-size: 18px;">${c2.icon}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 14px; color: #0f172a;">2. หัวหน้างานชั้นต้น (L1: Leader / Supervisor)</strong>
          ${getStepBadge(l1Status)}
        </div>
        <div style="font-size: 12px; color: #64748b;">
          ${l1Status === 'approved' ? 'หัวหน้างานอนุมัติแล้ว และส่งต่อไปยังลำดับถัดไป' : l1Status === 'rejected' ? 'หัวหน้างานไม่อนุมัติคำขอนี้' : 'กำลังรอหัวหน้างานตรวจสอบและอนุมัติ (กรอบเวลา 48 ชม.)'}
        </div>
      </div>

      <!-- Step 3: L2 Director -->
      <div style="position: relative; z-index: 2;">
        <div style="position: absolute; left: -36px; width: 30px; height: 30px; border-radius: 50%; background: ${c3.bg}; color: ${c3.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px #ffffff;">
          <span class="material-symbols-outlined" style="font-size: 18px;">${c3.icon}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 14px; color: #0f172a;">3. ผู้จัดการฝ่าย (L2: Director / Manager)</strong>
          ${(l1Status === 'approved') ? getStepBadge(l2Status) : '<span style="color: #94a3b8; font-size: 11px;">รอดำเนินการ</span>'}
        </div>
        <div style="font-size: 12px; color: #64748b;">
          ${l2Status === 'approved' ? 'ผู้จัดการฝ่ายลงนามอนุมัติเรียบร้อยแล้ว' : l2Status === 'rejected' ? 'ผู้จัดการฝ่ายไม่อนุมัติ' : 'รอการพิจารณาจากผู้จัดการฝ่าย'}
        </div>
      </div>

      <!-- Step 4: HR Final -->
      <div style="position: relative; z-index: 2;">
        <div style="position: absolute; left: -36px; width: 30px; height: 30px; border-radius: 50%; background: ${c4.bg}; color: ${c4.color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px #ffffff;">
          <span class="material-symbols-outlined" style="font-size: 18px;">${c4.icon}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <strong style="font-size: 14px; color: #0f172a;">4. ฝ่ายทรัพยากรบุคคล (HR Final & ตัดยอดสิทธิ์)</strong>
          ${finalStatus === 'approved' ? getStepBadge('approved') : finalStatus === 'rejected' ? getStepBadge('rejected') : '<span style="color: #94a3b8; font-size: 11px;">รอดำเนินการ</span>'}
        </div>
        <div style="font-size: 12px; color: #64748b;">
          ${finalStatus === 'approved' ? 'อนุมัติสมบูรณ์ ตัดยอดวันลาในระบบ และบันทึกประวัติเรียบร้อย' : 'ตรวจสอบสิทธิ์คงเหลือและความถูกต้องขั้นสุดท้าย'}
        </div>
      </div>
    </div>

    <!-- Helpful reassurance note -->
    <div style="margin-top: 24px; padding: 12px 16px; background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; font-size: 12px; color: #0f766e; display: flex; gap: 8px; align-items: flex-start;">
      <span class="material-symbols-outlined" style="font-size: 18px; color: #0d9488; flex-shrink: 0; margin-top: 1px;">info</span>
      <span>
        <strong>คำแนะนำ:</strong> พนักงานสามารถเปิดดูสถานะและขั้นตอนแบบ Stepper จากหน้านี้ได้ตลอดเวลา โดยระบบจะอัปเดตแบบเรียลไทม์ทันทีที่ผู้มีอำนาจกดอนุมัติ จึงไม่ต้องทักข้อความติดตามเป็นการส่วนตัวครับ
      </span>
    </div>
  `;
};

window.closeVisualTimelineModal = function() {
  const modal = document.getElementById('visualTimelineModal');
  if (modal) modal.style.display = 'none';
};

/* ==========================================================================
   🤖 18. HR AI Chatbot (Policy Q&A 24 Hours)
   ========================================================================== */
window.toggleHrChatbot = function() {
  const modal = document.getElementById('hrChatbotModal');
  if (!modal) return;
  const isHidden = modal.style.display === 'none' || modal.style.display === '';
  modal.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    const input = document.getElementById('hrChatInput');
    if (input) input.focus();
  }
};

window.askHrQuestion = function(questionText) {
  const input = document.getElementById('hrChatInput');
  if (input) {
    input.value = questionText;
    sendHrChatMessage();
  }
};

window.sendHrChatMessage = async function() {
  const input = document.getElementById('hrChatInput');
  const chatContainer = document.getElementById('hrChatMessages');
  if (!input || !chatContainer) return;

  const text = input.value.trim();
  if (!text) return;

  // Append user bubble
  chatContainer.innerHTML += `
    <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
      <div style="background: #0d9488; color: #ffffff; border-radius: 14px 14px 0 14px; padding: 10px 14px; font-size: 13px; max-width: 85%; line-height: 1.4; box-shadow: 0 1px 3px rgba(13,148,136,0.2);">
        ${safeEscapeHtml(text)}
      </div>
    </div>
  `;
  input.value = '';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Append loading bubble
  const loadingId = `bot-loading-${Date.now()}`;
  chatContainer.innerHTML += `
    <div id="${loadingId}" style="display: flex; gap: 10px; align-items: flex-start;">
      <div style="width: 32px; height: 32px; border-radius: 8px; background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span class="material-symbols-outlined" style="font-size: 18px;">smart_toy</span>
      </div>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0 14px 14px 14px; padding: 12px 14px; font-size: 13px; color: #64748b; display: flex; align-items: center; gap: 6px;">
        <span class="material-symbols-outlined" style="font-size: 16px; animation: spin 1s linear infinite;">sync</span>
        กำลังค้นหานโยบายและประมวลผลคำตอบ...
      </div>
    </div>
  `;
  chatContainer.scrollTop = chatContainer.scrollHeight;

  try {
    const res = await fetch('/api/hr-chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    const loadingElem = document.getElementById(loadingId);
    if (loadingElem) loadingElem.remove();

    if (data.success && data.reply) {
      // Format reply with line breaks and markdown boldness
      const formattedReply = data.reply
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

      chatContainer.innerHTML += `
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: #e0f2fe; color: #0369a1; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span class="material-symbols-outlined" style="font-size: 18px;">smart_toy</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0 14px 14px 14px; padding: 12px 14px; font-size: 13px; color: #1e293b; line-height: 1.5; max-width: 85%; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            ${formattedReply}
          </div>
        </div>
      `;
    } else {
      chatContainer.innerHTML += `
        <div style="display: flex; gap: 10px; align-items: flex-start;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span class="material-symbols-outlined" style="font-size: 18px;">error</span>
          </div>
          <div style="background: #ffffff; border: 1px solid #fee2e2; border-radius: 0 14px 14px 14px; padding: 12px 14px; font-size: 13px; color: #b91c1c; line-height: 1.5; max-width: 85%;">
            ${data.error || 'ขออภัยครับ ไม่สามารถค้นหาข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้งครับ'}
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error("Chatbot request failed:", err);
    const loadingElem = document.getElementById(loadingId);
    if (loadingElem) loadingElem.remove();
    chatContainer.innerHTML += `
      <div style="display: flex; gap: 10px; align-items: flex-start;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <span class="material-symbols-outlined" style="font-size: 18px;">wifi_off</span>
        </div>
        <div style="background: #ffffff; border: 1px solid #fee2e2; border-radius: 0 14px 14px 14px; padding: 12px 14px; font-size: 13px; color: #b91c1c; line-height: 1.5; max-width: 85%;">
          เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง หรือสอบถามฝ่าย HR โดยตรงครับ
        </div>
      </div>
    `;
  }

  chatContainer.scrollTop = chatContainer.scrollHeight;
};