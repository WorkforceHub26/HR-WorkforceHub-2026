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
  initQuotaSystem(); // 👈 เพิ่มบรรทัดนี้เพื่อสร้างรายการปีตอนโหลดหน้าเว็บ
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
        cachedUser = JSON.parse(localStorage.getItem("currentUser") || "null");
        console.log("📦 [SESSION] ข้อมูลที่เจอใน Session Storage:", cachedUser);
      } catch (e) {
        console.error("❌ [ERROR] อ่านค่า localStorage ล้มเหลว:", e);
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

    // 📍 1. [แก้ไขแล้ว] เพิ่ม approval_comment เข้าไปใน .select()
    const [requestsRes, pendingRes, balanceRes] = await Promise.all([
      sb.from("leave_requests").select("id, start_date, end_date, total_days, status, approval_comment, leave_types(leave_name)").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(50), 
      sb.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", employeeId).eq("status", "pending"),
      sb.from("leave_balances").select("leave_type_id, remaining_days, used_days, year, leave_types(leave_name)").eq("employee_id", employeeId).eq("year", currentYear)
    ]);

    // 🛠️ เพิ่มการตรวจสอบ balanceRes.error ตรงนี้
    if (balanceRes.error) {
      console.error("❌ [BALANCE ERROR] ดึงโควตาวันลาไม่สำเร็จ:", balanceRes.error.message);
    } else {
      console.log("✅ [BALANCE DATA] ดึงโควตาวันลาสำเร็จ:", balanceRes.data);
    }

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
        
        // 📍 2. [แก้ไขแล้ว] ตรวจสอบสถานะและคอมเมนต์เพื่อแยก "ไม่อนุมัติ" กับ "ยกเลิก"
        let displayStatus = labelFn(item.status);
        let badgeStyle = "background:#fff3cd; color:#854d0e; border:1px solid #fde047;"; 
                
          // ปรับเงื่อนไขการแสดงผล Status Badge หน้าแรก
          if (item.status === "approved") {
            displayStatus = "อนุมัติ";
            badgeStyle = "background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;";
          } else if (item.status === "cancelled" || item.status === "cancelled_by_user" || item.cancel_status === "approved") {
            displayStatus = "ยกเลิกโดยคำร้อง";
            badgeStyle = "background:#f1f5f9; color:#475569; border:1px solid #cbd5e1;";
          } else if (item.status === "cancel_pending" || item.status === "cancel_requested" || item.cancel_status === "pending") {
            displayStatus = "รอ HR อนุมัติยกเลิก";
            badgeStyle = "background:#ffedd5; color:#c2410c; border:1px solid #fed7aa;";
          } else if (item.status === "rejected") {
            displayStatus = "ไม่อนุมัติ";
            badgeStyle = "background:#f8d7da; color:#842029; border:1px solid #f5c2c7;";
          }

        return `
          <article class="recent-item" style="margin-bottom: 12px; padding: 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.01);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="font-size: 15px; color: #0f172a;">${escapeFn(leaveName)}</strong>
              <span class="status ${item.status}" style="font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; ${badgeStyle}">${displayStatus}</span>
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

  // 1. ตรวจสอบว่าตัวแปรมีข้อมูลอยู่จริงและเป็น Array หรือไม่
  if (!window.employeeLeaveBalances || !Array.isArray(window.employeeLeaveBalances) || window.employeeLeaveBalances.length === 0) {
    container.innerHTML = "<p style='color:var(--muted); font-size:14px; font-style:italic; margin:0;'>❌ ยังไม่มีข้อมูลโควตาวันลาในปีนี้</p>";
    return;
  }

  window.employeeLeaveBalances.forEach(balance => {
    // 2. ดึงชื่อประเภทการลา (รองรับทั้ง Object, Array และ Flat Field)
    let typeName = "สิทธิ์การลา";
    if (Array.isArray(balance.leave_types) && balance.leave_types.length > 0) {
      typeName = balance.leave_types[0].leave_name || typeName;
    } else if (balance.leave_types && typeof balance.leave_types === 'object') {
      typeName = balance.leave_types.leave_name || typeName;
    } else if (balance.leave_name) {
      typeName = balance.leave_name;
    }

    // 3. ดึงจำนวนวันคงเหลือ (รองรับกรณีใช้ชื่อ field ต่างกัน)
    const rawRemaining = balance.remaining_days ?? balance.remaining ?? balance.quota_remaining ?? 0;
    const remaining = parseFloat(rawRemaining) || 0;

    // 4. แยกคลาสสีตามประเภทวันลา
    let colorClass = ""; 
    if (typeName.includes("ป่วย")) colorClass = "sick";
    else if (typeName.includes("กิจ")) colorClass = "personal";
    else if (typeName.includes("พักผ่อน") || typeName.includes("พักร้อน")) colorClass = "vacation";

    // 5. สร้างการ์ดแสดงผล
    const box = document.createElement("div");
    box.className = `leave-quota-card ${colorClass}`.trim();
    
    box.innerHTML = `
      <span class="leave-quota-name">${typeName}</span>
      <div class="leave-quota-days">${remaining} <small>วัน</small></div>
    `;
    container.appendChild(box);
  });
};

/* ==========================================================================
   🖥️ 5. ฟังก์ชันเปิดบัตรพนักงานดิจิทัล (เพิ่มปุ่มดาวน์โหลดบัตรเป็นรูปภาพ)
   ========================================================================== */
window.viewMyDigitalCard = function() {
  const sessionUser = JSON.parse(localStorage.getItem("currentUser") || "null");
  const profile = window.currentProfile || {};
  const employee = profile.employees || profile;
  const currentCode = sessionUser?.employee_code || employee?.employee_code;
  
  if (!currentCode) return;

  const fullName = employee?.full_name || profile?.display_name || sessionUser?.full_name || "พนักงานในระบบ";
  const myDept = employee?.departments?.department_name || employee?.department_name || sessionUser?.department_name || "ทั่วไป";
  const myRole = employee?.positions?.position_name || employee?.position_name || sessionUser?.position_name || profile?.role || "พนักงาน";

  // 🚀 ลิงก์ URL Auto-Login
  const baseUrl = window.location.origin;
  const targetUrl = `${baseUrl}/?auto_login=${currentCode}&token=PVT_SECURE_BYPASS`; 
  
  const secureData = encodeURIComponent(targetUrl);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${secureData}`;

  Swal.fire({
    title: '💳 บัตรประจำตัวพนักงานดิจิทัล', 
    width: '380px',
    html: `
      <div id="pvt-employee-id-card" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); width: 280px; margin: 15px auto; border-radius: 20px; padding: 24px; color: white; box-shadow: 0 15px 30px rgba(30,58,138,0.3); text-align: center; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden; font-family: 'Sarabun', sans-serif;">
        <div style="font-weight: 700; font-size: 13px; letter-spacing: 1.5px; color: #38bdf8; margin-bottom: 20px; text-transform: uppercase;">PVT WORKFORCE HUB</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 6px;">${fullName}</div>
        <div style="font-size: 13px; color: #38bdf8; font-weight: 600; margin-bottom: 2px;">ตำแหน่ง: ${myRole}</div>
        <div style="font-size: 12px; color: #94a3b8; font-weight: 500; margin-bottom: 20px;">แผนก: ${myDept}</div>
        <div style="background: white; padding: 10px; border-radius: 14px; display: inline-block; margin-bottom: 16px;">
          <img id="cardQrImage" src="${qrUrl}" alt="QR" style="width: 140px; height: 140px; display: block;" crossorigin="anonymous" />
        </div>
        <div><span style="font-size: 15px; font-weight: 700; background: rgba(255,255,255,0.1); padding: 4px 16px; border-radius: 30px;">${currentCode}</span></div>
      </div>
    `,
    showCancelButton: true,
    cancelButtonText: '📥 ดาวน์โหลดบัตร',
    cancelButtonColor: '#2563eb',
    confirmButtonText: '✅ ปิด', 
    confirmButtonColor: '#64748b',
    reverseButtons: true
  }).then((result) => {
    // พอกดปุ่มดาวน์โหลดบัตร
    if (result.dismiss === Swal.DismissReason.cancel) {
      downloadEmployeeCard(currentCode, fullName);
    }
  });
};

/* ==========================================================================
   🛠️ ฟังก์ชันเสริม: จับภาพบัตรพนักงาน แล้วแปลงเป็นไฟล์รูปภาพดาวน์โหลดลงเครื่อง
   ========================================================================== */
async function downloadEmployeeCard(empCode, empName) {
  // 1. โหลดสคริปต์ html2canvas อัตโนมัติ (กรณีที่หน้าเว็บยังไม่มี)
  if (typeof html2canvas === "undefined") {
    await new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }

  const cardElement = document.getElementById("pvt-employee-id-card");
  if (!cardElement) return;

  // 2. แสดงป็อปอัปกำลังโหลด
  Swal.fire({
    title: '⏳ กำลังบันทึกรูปภาพ...',
    text: 'กรุณารอสักครู่ระบบกำลังสร้างรูปภาพบัตร',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    // 3. แปลงองค์ประกอบ HTML เป็นภาพ Canvas ความละเอียดคมชัดสูง (Scale 3x)
    const canvas = await html2canvas(cardElement, {
      scale: 3,
      useCORS: true,
      backgroundColor: null
    });

    // 4. สั่งดาวน์โหลดเป็นไฟล์ .png
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    link.download = `Employee_Card_${empCode}.png`;
    link.click();

    // 5. แจ้งเตือนเมื่อดาวน์โหลดสำเร็จ
    Swal.fire({
      icon: 'success',
      title: '🎉 ดาวน์โหลดสำเร็จ!',
      text: 'บันทึกรูปภาพบัตรพนักงานลงเครื่องเรียบร้อยแล้ว',
      confirmButtonColor: '#0fa472'
    });
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการดาวน์โหลดบัตร:", err);
    Swal.fire({
      icon: 'error',
      title: 'ดาวน์โหลดไม่สำเร็จ',
      text: 'เกิดข้อผิดพลาดในการสร้างรูปภาพ กรุณาลองใหม่อีกครั้ง',
      confirmButtonColor: '#ef4444'
    });
  }
}

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
  localStorage.removeItem("currentUser"); 
  window.location.href = "index.html"; 
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


// ฟังก์ชันเปิด Modal
function openHolidayModal() {
  const modal = document.getElementById('holidayModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

// ฟังก์ชันปิด Modal
function closeHolidayModal() {
  const modal = document.getElementById('holidayModal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('holidayForm')?.reset(); // ล้างค่าฟอร์มเมื่อปิด
  }
}

// ฟังก์ชันบันทึกข้อมูลวันหยุด
async function handleSaveHoliday(event) {
  event.preventDefault();
  
  const holidayDate = document.getElementById('holidayDate').value;
  const holidayName = document.getElementById('holidayName').value;
  const holidayType = document.getElementById('holidayType').value;

  try {
    // ตัวอย่างการส่งข้อมูลไปยัง Supabase
    const { data, error } = await pvtSupabase.getClient()
      .from('holidays')
      .insert([
        { holiday_date: holidayDate, holiday_name: holidayName, type: holidayType }
      ]);

    if (error) throw error;

    Swal.fire('สำเร็จ!', 'เพิ่มวันหยุดเรียบร้อยแล้ว', 'success');
    closeHolidayModal();
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด!', err.message || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
  }
}

/* ==========================================================================
   🔔 ระบบแจ้งเตือน & ติดตามสถานะใบลา (ฝั่งพนักงาน)
   ========================================================================== */

/** 1. ตรวจสอบสิทธิ์ผู้ใช้ และเปิดใช้งานปุ่มแจ้งเตือน */
function checkApproverPermission(profileData) {
  try {
    if (!profileData) return;

    const userRole = (profileData.role || "").toLowerCase();
    const approverRoles = ["leader", "manager", "director", "hr"];
    const isApprover = approverRoles.includes(userRole);

    const notifBtn = document.getElementById("notificationBtn");
    if (notifBtn) {
      notifBtn.style.setProperty("display", "inline-flex", "important");
    }

    const switchBtn = document.getElementById("approverModeBtn");
    if (switchBtn) {
      switchBtn.style.setProperty("display", isApprover ? "flex" : "none", "important");
    }

    if (isApprover) {
      fetchPendingApprovalsCount();
    } else {
      fetchEmployeeLeaveStatusCount(profileData);
    }
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์:", err);
  }
}

/** 2. ดึงจำนวนรายการที่อยู่ระหว่างดำเนินการ */
async function fetchEmployeeLeaveStatusCount(profile) {
  const sb = window.pvtSupabase?.getClient();
  const empId = profile?.employee_id || profile?.id;
  if (!sb || !empId) return;

  try {
    const { count, error } = await sb
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", empId)
      .in("status", ["pending", "approved", "rejected", "cancel_pending", "cancelled", "cancel_requested"]);

    if (!error) {
      const badge = document.getElementById("notifBadge");
      if (badge) {
        badge.innerText = count || 0;
        badge.style.display = count > 0 ? "flex" : "none";
      }
    }
  } catch (e) {
    console.warn("⚠️ ไม่สามารถดึงจำนวนการแจ้งเตือนพนักงานได้:", e);
  }
}

/** 3. เปิด Modal ติดตามสถานะใบลา */
async function openEmployeeStatusTrackerModal() {
  const sb = window.pvtSupabase?.getClient();
  const empId = window.currentProfile?.employee_id || window.currentProfile?.id;

  if (!sb || !empId) return;

  Swal.fire({
    title: '⏳ กำลังโหลดสถานะ...',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const { data: requests, error } = await sb
      .from("leave_requests")
      .select("*, leave_types(leave_name)")
      .eq("employee_id", empId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error || !requests || requests.length === 0) {
      Swal.fire({
        title: '🔔 ติดตามสถานะใบลา',
        text: 'คุณยังไม่มีรายการยื่นใบลาในระบบ',
        icon: 'info',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    const dateFn = window.pvtSupabase?.formatThaiDate || ((d) => d);

    const cardsHtml = requests.map((item) => {
      const leaveName = item.leave_types?.leave_name || "ใบลา";
      const days = item.total_days || 1;

      // 🟢 1. กำหนดป้ายสถานะรวม (Overall Badge)
      let overallBadge = `<span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">⏳ อยู่ระหว่างพิจารณา</span>`;
      
      if (item.status === "approved") {
        overallBadge = `<span style="background:#d1e7dd; color:#0f5132; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">✅ อนุมัติเรียบร้อย</span>`;
      } else if (item.status === "rejected") {
        overallBadge = `<span style="background:#f8d7da; color:#842029; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">❌ ไม่อนุมัติ</span>`;
      } else if (item.status === "cancel_pending" || item.status === "cancel_requested" || item.cancel_status === "pending") {
        overallBadge = `<span style="background:#ffedd5; color:#c2410c; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">⏳ รอ HR อนุมัติยกเลิก</span>`;
      } else if (item.status === "cancelled" || item.status === "cancelled_by_user" || item.cancel_status === "approved") {
        overallBadge = `<span style="background:#e2e8f0; color:#475569; padding:4px 10px; border-radius:20px; font-size:11px; font-weight:700;">🚫 ยกเลิกโดยคำร้อง</span>`;
      }

      // 🟢 2. Timeline การอนุมัติปกติ
      const leaderStep = renderStepStatus(item.leader_status || (item.status === 'pending' ? 'pending' : 'approved'));
      const managerStep = renderStepStatus(item.manager_status || (item.status === 'approved' ? 'approved' : 'pending'));
      const hrStep = renderStepStatus(item.hr_status || (item.status === 'approved' ? 'approved' : 'pending'));

      // 🟢 3. ตรวจสอบการยกเลิก
      const isCancellationFlow = item.status === "cancel_pending" || item.status === "cancel_requested" || item.status === "cancelled" || item.cancel_status;
      const hrCancelStep = renderCancelStepStatus(item.cancel_status || (item.status === 'cancelled' ? 'approved' : 'pending'));

      return `
        <div style="background: rgba(255, 255, 255, 0.85); border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 16px; padding: 16px; margin-bottom: 12px; text-align: left; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="font-size: 15px; color: #0f172a;">📝 ${leaveName} (${days} วัน)</strong>
            ${overallBadge}
          </div>
          
          <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
            <span>📅 ${dateFn(item.start_date)} - ${dateFn(item.end_date)}</span>
          </div>

          <!-- Timeline ลาปกติ -->
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

          <!-- แถบแสดงเฉพาะเมื่อมีการขอยกเลิก -->
          ${isCancellationFlow ? `
            <div style="margin-top: 8px; background: #fff7ed; padding: 8px 12px; border-radius: 10px; border: 1px solid #ffedd5; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #c2410c; font-weight: 600;">🔄 คำร้องขอยกเลิก (HR อนุมัติ):</span>
              ${hrCancelStep}
            </div>
          ` : ''}

          ${item.cancel_reason ? `
            <div style="margin-top: 8px; font-size: 11px; color: #9a3412; background: #fff7ed; border: 1px solid #ffedd5; padding: 6px 10px; border-radius: 6px;">
              <b>เหตุผลที่ขอยกเลิก:</b> ${item.cancel_reason}
            </div>
          ` : ''}

          ${item.approval_comment ? `
            <div style="margin-top: 8px; font-size: 11px; color: #475569; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px;">
              <b>💬 หมายเหตุผู้อนุมัติ:</b> ${item.approval_comment}
            </div>
          ` : ''}
        </div>
      `;
    }).join("");

    Swal.fire({
      title: '🔔 ติดตามสถานะการอนุมัติ',
      html: `<div style="max-height: 420px; overflow-y: auto; padding-right: 4px; font-family:'Sarabun', sans-serif;">${cardsHtml}</div>`,
      width: '480px',
      confirmButtonText: 'ตกลง',
      confirmButtonColor: '#06b6d4',
      customClass: { popup: 'pvt-glass-card' }
    });

  } catch (err) {
    console.error("❌ ดึงข้อมูลติดตามสถานะล้มเหลว:", err);
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลสถานะได้', 'error');
  }
}

/** 4. ฟังก์ชันคลิกปุ่มแจ้งเตือน */
function openNotificationModal() {
  const userRole = (window.currentProfile?.role || "").toLowerCase();
  const approverRoles = ["leader", "manager", "director", "hr"];

  if (approverRoles.includes(userRole)) {
    openApproverNotificationModal();
  } else {
    openEmployeeStatusTrackerModal();
  }
}

/** 5. แปลงสถานะขั้นตอนการลาปกติ */
function renderStepStatus(status) {
  if (status === 'approved' || status === 'pass') {
    return `<span style="color:#10b981; font-weight:700; font-size:11px;">✅ อนุมัติ</span>`;
  } else if (status === 'rejected' || status === 'fail') {
    return `<span style="color:#ef4444; font-weight:700; font-size:11px;">❌ ไม่ผ่าน</span>`;
  } else {
    return `<span style="color:#d97706; font-weight:600; font-size:11px;">⏳ รอพิจารณา</span>`;
  }
}

/** 6. แปลงสถานะขั้นตอนการยกเลิก */
function renderCancelStepStatus(cancelStatus) {
  if (cancelStatus === 'approved' || cancelStatus === 'cancelled') {
    return `<span style="color:#475569; font-weight:700; font-size:11px;">🚫 ยกเลิกสำเร็จ</span>`;
  } else if (cancelStatus === 'rejected') {
    return `<span style="color:#ef4444; font-weight:700; font-size:11px;">❌ ปฏิเสธการยกเลิก</span>`;
  } else {
    return `<span style="color:#ea580c; font-weight:600; font-size:11px;">⏳ รอ HR อนุมัติยกเลิก</span>`;
  }
}

/** 7. Modal แจ้งเตือนฝั่ง HR / หัวหน้างาน */
function openApproverNotificationModal() {
  const pendingCount = document.getElementById("notifBadge")?.innerText || "0";

  Swal.fire({
    title: '🔔 รายการแจ้งเตือนการอนุมัติ',
    html: `
      <div style="font-family:'Sarabun', sans-serif; text-align:center; padding: 10px 0;">
        <p style="font-size:16px; color:#1e293b; margin-bottom:12px;">
          มีใบลาที่รอการอนุมัติอยู่ทั้งหมด <b style="color:#eab308; font-size:20px;">${pendingCount}</b> รายการ
        </p>
        <p style="font-size:13px; color:#64748b;">
          คลิกปุ่มด้านล่างเพื่อไปยังหน้าระบบอนุมัติใบลา
        </p>
      </div>
    `,
    icon: 'info',
    showCancelButton: true,
    confirmButtonText: '🔎 ไปยังระบบอนุมัติ',
    cancelButtonText: 'ปิด',
    confirmButtonColor: '#3b82f6',
    cancelButtonColor: '#64748b'
  }).then((result) => {
    if (result.isConfirmed) {
      window.location.href = '/pages/hr/hr.html';
    }
  });
}

/* ==========================================================================
   🔄 9. ฟังก์ชันรีเฟรชดึงข้อมูลหน้าพนักงานใหม่ทันที (Re-fetch Data)
   ========================================================================== */
window.refreshUserData = async function() {
  const refreshIcons = document.querySelectorAll('.material-symbols-outlined');
  
  // 1. หมุนไอคอนหมุนโหลด (Animation)
  refreshIcons.forEach(icon => {
    if (icon.innerText === 'refresh') {
      icon.style.transition = 'transform 0.5s ease';
      icon.style.transform = 'rotate(360deg)';
    }
  });

  // 2. แสดง Toast แจ้งเตือนกำลังโหลด
  const toastLoading = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timerProgressBar: true
  });
  
  toastLoading.fire({
    icon: 'info',
    title: '⏳ กำลังอัปเดตข้อมูลล่าสุด...'
  });

  try {
    // 3. สั่งรันฟังก์ชันดึงข้อมูลโปรไฟล์ วันลา และประวัติใหม่
    await initUserHome();

    // 4. แสดง Toast แจ้งเตือนเมื่อสำเร็จ
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: '✅ อัปเดตข้อมูลล่าสุดเรียบร้อย',
      showConfirmButton: false,
      timer: 2000
    });
  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการรีเฟรชข้อมูล:", err);
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'ไม่สามารถอัปเดตข้อมูลได้',
      showConfirmButton: false,
      timer: 2000
    });
  } finally {
    // ล้างค่า rotation ให้กดซ้ำได้
    setTimeout(() => {
      refreshIcons.forEach(icon => {
        if (icon.innerText === 'refresh') {
          icon.style.transform = 'rotate(0deg)';
        }
      });
    }, 500);
  }
};

// ฟังก์ชันเช็กแจ้งเตือน Pop-up เมื่อพนักงานเข้าสู่ระบบ
function checkUserNotifications() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1; // 12 คือ ธันวาคม
  const currentDate = today.getDate();

  // 1. ตรวจสอบการแจ้งเตือนสิทธิ์ใหม่ประจำปี (1 ธันวาคม)
  if (currentMonth === 12 && currentDate === 1) {
    Swal.fire({
      icon: 'info',
      title: '🎉 สิทธิ์วันลาประจำปีใหม่ได้รับการปรับปรุงแล้ว!',
      text: 'ระบบได้ทำการรีเซ็ตและปรับปรุงโควตาวันลาประจำรอบปีใหม่ (1 ธ.ค. - 30 พ.ย.) เรียบร้อยแล้ว',
      confirmButtonText: 'รับทราบ',
      confirmButtonColor: '#0d9488'
    });
  }
}

// 🟢 1. สร้างรายการปีใน Dropdown และเริ่มโหลดข้อมูล
function initQuotaSystem() {
  const yearSelect = document.getElementById('yearFilter');
  if (!yearSelect) return;

  const now = new Date().getFullYear();
  
  yearSelect.innerHTML = `
    <option value="${now}">ปี ${now + 543} (ปัจจุบัน)</option>
    <option value="${now + 1}">ปี ${now + 1 + 543} (ล่วงหน้า)</option>
  `;
  
  // ใช้ตัวแปร currentSelectedYear ที่ประกาศไว้ส่วนบนของไฟล์ได้ทันที
  loadQuotaData(typeof currentSelectedYear !== 'undefined' ? currentSelectedYear : now);
}

// 🟢 2. ฟังก์ชันทำงานเมื่อมีการเปลี่ยนปีที่เลือก
async function handleYearChange(year) {
  currentSelectedYear = parseInt(year, 10); // กำหนดค่าใหม่โดยไม่ต้องใช้คำว่า let ด้านหน้า
  await loadQuotaData(currentSelectedYear);
}

// 🟢 3. ดึงข้อมูลโควตาวันลาจาก Supabase ตามปีที่เลือก
async function loadQuotaData(targetYear) {
  const sb = window.pvtSupabase?.getClient();
  const employeeId = window.currentProfile?.employee_id || window.currentProfile?.id;

  if (!sb || !employeeId) {
    console.warn("⚠️ [QUOTA] ไม่พบ Supabase Client หรือ Employee ID");
    return;
  }

  try {
    const { data: quotas, error } = await sb
      .from('leave_balances')
      .select('*, leave_types(leave_name)')
      .eq('employee_id', employeeId)
      .eq('year', targetYear);

    if (error) {
      console.error('❌ ดึงข้อมูลโควตาล้มเหลว:', error.message);
      return;
    }

    renderQuotaCards(quotas || []);
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาดใน loadQuotaData:', err);
  }
}

// 🟢 4. วาดการ์ดโควตาวันลาลงหน้าจอ
function renderQuotaCards(quotas) {
  const container = document.getElementById('leaveBalancesContainer');
  if (!container) return;
  
  if (!quotas || quotas.length === 0) {
    container.innerHTML = `<span class="empty-state" style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 20px 0;">ไม่พบข้อมูลสิทธิ์วันลาสำหรับปีนี้</span>`;
    return;
  }

  container.innerHTML = quotas.map(item => {
    const typeName = item.leave_types?.leave_name || item.leave_type_name || "สิทธิ์การลา";
    const total = parseFloat(item.total_days) || parseFloat(item.quota_days) || 0;
    const used = parseFloat(item.used_days) || 0;
    const pending = parseFloat(item.pending_days) || 0;
    const remaining = parseFloat(item.remaining_days) ?? (total - used);
    const usedPercent = total > 0 ? Math.min((used / total) * 100, 100) : 0;

    let colorClass = "";
    if (typeName.includes("ป่วย")) colorClass = "sick";
    else if (typeName.includes("กิจ")) colorClass = "personal";
    else if (typeName.includes("พักผ่อน") || typeName.includes("พักร้อน")) colorClass = "vacation";

    return `
      <div class="leave-quota-card ${colorClass}">
        <span class="leave-quota-name">${typeName}</span>
        <div class="leave-quota-days">
          ${remaining} <small>/ ${total} วัน</small>
        </div>

        ${pending > 0 ? `<span class="quota-pending-tag">⏳ รออนุมัติ ${pending} วัน</span>` : ''}

        <div class="quota-progress-bg">
          <div class="quota-progress-fill" style="width: ${usedPercent}%"></div>
        </div>
        <div class="quota-info-footer">
          <span>ใช้ไป ${used} วัน</span>
          <span>${Math.round(usedPercent)}%</span>
        </div>
      </div>
    `;
  }).join('');
}