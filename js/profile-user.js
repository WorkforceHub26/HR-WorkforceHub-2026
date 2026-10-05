/**
 * profile-user.js — (ดึงข้อมูลจริงจาก Supabase สำหรับ HR / Employee)
 */

document.addEventListener("DOMContentLoaded", loadProfile);

async function loadProfile() {
  const box = document.getElementById("profileBox");
  if (!box) return;

  try {
    let currentUserData = null;
    let client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabaseClient || window.pvtSupabase?.client);
    if (!client || typeof client.from !== 'function') {
      if (window.supabase && typeof window.supabase.from === 'function') client = window.supabase;
    }

    // 1️⃣ ดึงข้อมูลผ่าน Helper Function pvtSupabase (ถ้ามี)
    if (window.pvtSupabase && typeof window.pvtSupabase.getCurrentProfile === "function") {
      try {
        currentUserData = await window.pvtSupabase.getCurrentProfile();
      } catch (e) {
        console.warn("⚠️ getCurrentProfile error:", e);
      }
    }

    // 2️⃣ ถ้าไม่มี ให้เช็กจาก Supabase Auth Session
    if (!currentUserData && client?.auth) {
      const { data } = await client.auth.getSession();
      if (data?.session?.user) {
        currentUserData = data.session.user;
      }
    }

    // 3️⃣ ถ้ายังไม่มี ให้กวาดหาจาก Storage ทุกชื่อที่เป็นไปได้ในระบบ
    if (!currentUserData) {
      const possibleKeys = [
        "currentUser", "pvt_user", "user", "profile", 
        "employee_session", "hr_session", "loggedInUser"
      ];

      for (const key of possibleKeys) {
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.id || parsed.employee_id || parsed.email || parsed.employee_code)) {
              currentUserData = parsed;
              break;
            }
          } catch (e) { /* ignore parse error */ }
        }
      }
    }

    if (currentUserData) {
      window.currentEmpProfile = currentUserData;
      window.currentUserProfile = currentUserData;
    }

    // ⛔ หากค้นหาจากทุกจุดแล้วไม่พบข้อมูลจริงใดๆ
    if (!currentUserData) {
      console.warn("🔒 ไม่พบข้อมูลการเข้าสู่ระบบในเครื่อง");
      box.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
          <h3 style="font-size: 16px; color: #1e293b; margin-bottom: 8px; font-weight: 600;">ยังไม่ได้เข้าสู่ระบบ</h3>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>
          <a href="/index.html" style="display: inline-block; padding: 10px 20px; background: #10b981; color: #ffffff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
            กลับหน้าเข้าสู่ระบบ
          </a>
        </div>`;
      return;
    }

    // -------------------------------------------------------------
    // 🔍 ดึงข้อมูลโปรไฟล์แบบ Real-time จากตาราง Supabase
    // -------------------------------------------------------------
    let realProfile = null;
    const targetId = currentUserData.employee_id || currentUserData.id;
    const targetEmail = currentUserData.email;
    const targetCode = currentUserData.employee_code;

    if (client) {
      let query = client.from('employees').select('*, departments!department_id(department_name), positions(position_name)');

      if (targetId) query = query.eq('id', targetId);
      else if (targetCode) query = query.eq('employee_code', targetCode);
      else if (targetEmail) query = query.eq('email', targetEmail);

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        realProfile = data;
      }
    }

    // -------------------------------------------------------------
    // 🎨 Helper Function: ดึง URL รูปโปรไฟล์พนักงานอย่างสมบูรณ์ตามระบบ
    // -------------------------------------------------------------
    function getProfileAvatarUrl(empData) {
      if (!empData) return "/assets/img/avatar-male.jpg?v=2";
      
      const rawUrl = empData.image_url || empData.avatar_url || empData.profile_image_url || empData.image;
      const title = empData.title || empData.prefix || "";
      const gender = empData.gender || "";
      const fullName = empData.full_name || empData.name || "";

      if (window.pvtSupabase && typeof window.pvtSupabase.getAvatarUrl === "function") {
        return window.pvtSupabase.getAvatarUrl(rawUrl, title, gender, fullName);
      }
      if (window.PVTSDK && window.PVTSDK.storage && typeof window.PVTSDK.storage.getAvatarUrl === "function") {
        return window.PVTSDK.storage.getAvatarUrl(rawUrl, title, gender, fullName);
      }
      if (typeof window.getAvatarUrl === "function") {
        return window.getAvatarUrl(rawUrl, title, gender, fullName);
      }

      if (rawUrl && String(rawUrl).trim() !== "" && rawUrl !== "null" && rawUrl !== "undefined" && rawUrl !== "/assets/img/default-avatar.jpg") {
        const clean = String(rawUrl).trim();
        if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("data:")) {
          return clean;
        }
        const baseUrl = window.SUPABASE_URL || 'https://pgogmhqjdchakcytsomx.supabase.co';
        return `${baseUrl}/storage/v1/object/public/employee-images/${clean.replace(/^\//, '')}`;
      }

      if (typeof window.getDefaultAvatarUrl === "function") {
        return window.getDefaultAvatarUrl(title, gender, fullName);
      }

      const cleanTitle = String(title).toLowerCase();
      const cleanGender = String(gender).toLowerCase();
      const cleanName = String(fullName).toLowerCase();
      const isFemale = ["นางสาว", "นาง", "น.ส.", "นส", "สาว", "female", "หญิง"].some(t => cleanTitle.includes(t) || cleanGender.includes(t) || cleanName.includes(t));

      return isFemale ? "/assets/img/avatar-female.jpg?v=2" : "/assets/img/avatar-male.jpg?v=2";
    }

    // รวมข้อมูลที่ดึงจาก DB หรือจาก Session
    const emp = realProfile || currentUserData.employees || currentUserData;
    const deptName = emp?.departments?.department_name || emp?.department_name || "-";
    const posName = emp?.positions?.position_name || emp?.position_name || "-";
    const rawStartDate = emp?.start_date || emp?.join_date || emp?.created_at || currentUserData?.created_at;

    const empTitle = emp?.title || emp?.prefix || "";
    const empGender = emp?.gender || "";
    const empName = emp?.full_name || currentUserData?.display_name || currentUserData?.full_name || "พนักงาน";
    const empCode = emp?.employee_code || currentUserData?.employee_code || "-";

    const resolvedAvatarUrl = getProfileAvatarUrl(emp);
    const fallbackAvatarUrl = (typeof window.getDefaultAvatarUrl === "function")
      ? window.getDefaultAvatarUrl(empTitle, empGender, empName)
      : (empTitle.includes('สาว') || empTitle.includes('นาง') || empTitle.includes('น.ส.') || empGender === 'female' || empName.includes('นาง') || empName.includes('น.ส.') ? '/assets/img/avatar-female.jpg?v=2' : '/assets/img/avatar-male.jpg?v=2');

    // 🔄 อัปเดตรูปโปรไฟล์ใน Header ด้านบน
    const userHeaderAvatarEl = document.getElementById("userAvatar");
    if (userHeaderAvatarEl) {
      userHeaderAvatarEl.src = resolvedAvatarUrl;
      userHeaderAvatarEl.onerror = function() {
        this.onerror = null;
        this.src = fallbackAvatarUrl;
      };
    }

    const escapeFn = window.pvtSupabase?.escapeHtml || ((str) => str || "-");
    const dateFn = window.pvtSupabase?.formatThaiDate || ((dateStr) => {
      if (!dateStr) return "-";
      try {
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      } catch (e) {
        return dateStr;
      }
    });

    const lang = window.getGlobalLanguage ? window.getGlobalLanguage() : "th";
    const t = window.globalAppTranslations ? (window.globalAppTranslations[lang] || window.globalAppTranslations.th) : {
      lblFullName: "ชื่อ-นามสกุล",
      lblEmpCode: "รหัสพนักงาน",
      lblDept: "ฝ่าย / แผนก",
      lblPos: "ตำแหน่งงาน",
      lblEmail: "อีเมล / บัญชี",
      lblRole: "สิทธิ์การใช้งาน",
      lblStartDate: "วันเริ่มงาน"
    };

    // 🌟 พ่น HTML แสดงผลข้อมูลโปรไฟล์จริงพร้อมการ์ดรูปโปรไฟล์และการอัปโหลด
    box.innerHTML = `
      <!-- 📸 การ์ดรูปโปรไฟล์พร้อมปุ่มอัปโหลดเปลี่ยนรูปภาพ -->
      <div class="profile-avatar-card" style="padding: 24px 16px; background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%); border: 1px solid #e2e8f0; border-radius: 16px; text-align: center; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
        <div style="position: relative; width: 110px; height: 110px; margin: 0 auto 14px auto;">
          <img id="profileAvatarImg" src="${resolvedAvatarUrl}" alt="${escapeFn(empName)}" style="width: 110px; height: 110px; border-radius: 50%; object-fit: cover; border: 4px solid #ffffff; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.15);" onerror="this.onerror=null; this.src='${fallbackAvatarUrl}';" />
          <button type="button" id="btnEditProfileAvatar" onclick="openProfileAvatarActions()" title="แก้ไขรูปโปรไฟล์" aria-label="แก้ไขรูปโปรไฟล์" style="position: absolute; bottom: 2px; right: 2px; width: 36px !important; height: 36px !important; min-width: 36px !important; min-height: 36px !important; max-width: 36px !important; max-height: 36px !important; aspect-ratio: 1 / 1; padding: 0 !important; border-radius: 50% !important; background: var(--th-k-600, #0284c7); color: #ffffff; border: 2.5px solid #ffffff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; line-height: 1; box-shadow: 0 2px 8px rgba(var(--th-k-600-rgb, 2, 132, 199), 0.4); transition: transform 0.2s; overflow: hidden; flex: 0 0 36px;">
            <span class="material-symbols-outlined" style="font-size: 20px;">edit</span>
          </button>
          <input type="file" id="profileAvatarFileInput" accept="image/*" style="display: none;" onchange="handleProfileAvatarUpload(this)" />
        </div>
        <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${escapeFn(empName)}</h3>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
          <span style="background: var(--th-k-100, #e0f2fe); color: var(--th-k-700, #0369a1); padding: 4px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 600;">รหัส: ${escapeFn(empCode)}</span>
          <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 600;">${escapeFn(deptName)}</span>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 10px 0 0 0;">แตะไอคอนปากกาเพื่อแก้ไขรูปโปรไฟล์</p>
      </div>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">${t.lblFullName || "ชื่อ-นามสกุล"}</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(empName)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">${t.lblEmpCode || "รหัสพนักงาน"}</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(empCode)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">${t.lblDept || "ฝ่าย / แผนก"}</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(deptName)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">${t.lblPos || "ตำแหน่งงาน"}</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(posName)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">${t.lblEmail || "อีเมล / บัญชี"}</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(emp?.email || currentUserData?.email)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">${t.lblRole || "สิทธิ์การใช้งาน"}</span>
        <strong style="color: #1e293b; font-size: 15px; text-transform: uppercase;">${escapeFn(emp?.role || currentUserData?.role || "HR")}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">${t.lblStartDate || "วันเริ่มงาน"}</span>
        <strong style="color: #1e293b; font-size: 15px;">${dateFn(rawStartDate)}</strong>
      </article>
    `;

    // Populate LINE User ID input
    const lineInput = document.getElementById("userLineIdInput");
    if (lineInput) {
      lineInput.value = emp?.line_id || "";
    }
    window.currentEmpProfile = emp;



    // แสดงส่วนตั้งค่า LINE เฉพาะผู้มีสิทธิ์ (ผู้อนุมัติที่ HR ตั้งไว้ / HR / เมื่อ HR เปิดให้ทุกคน)
    // การซ่อน/แสดงจริงคุมด้วย PVTLine (auth-guard.js) → class html.pvt-line-allowed
    const lineSection = document.getElementById("lineNotificationSection");
    if (lineSection) {
      lineSection.style.display = "block";
      if (window.PVTLine) window.PVTLine.check().catch(() => {});
    }

    console.log("✅ [SUCCESS] โหลดข้อมูลโปรไฟล์จริงของ HR/User สำเร็จ!");

  } catch (error) {
    console.error("❌ Error loading profile page:", error);
    box.innerHTML = `<div class="empty-state" style="color: #ef4444; text-align: center; padding: 20px;">เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์</div>`;
  }
}

async function saveUserLineId() {
  if (window.PVTLine && !(await window.PVTLine.guard())) return;
  const lineInput = document.getElementById("userLineIdInput");
  const newLineId = lineInput ? lineInput.value.trim() : "";
  const emp = window.currentEmpProfile;

  if (!emp || !emp.id) {
    if (window.Swal) {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลโปรไฟล์พนักงานสำหรับบันทึก', 'error');
    } else {
      alert('ไม่พบข้อมูลโปรไฟล์พนักงานสำหรับบันทึก');
    }
    return;
  }

  try {
    let client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabaseClient || window.pvtSupabase?.client);
    if (!client || typeof client.from !== 'function') {
      if (window.supabase && typeof window.supabase.from === 'function') client = window.supabase;
    }
    if (!client) throw new Error('ไม่สามารถเชื่อมต่อฐานข้อมูล Supabase ได้');

    const { error } = await client
      .from('employees')
      .update({ line_id: newLineId || null })
      .eq('id', emp.id);

    if (error) throw error;

    emp.line_id = newLineId;

    if (window.Swal) {
      Swal.fire({
        icon: 'success',
        title: 'บันทึก LINE User ID สำเร็จ!',
        text: 'ระบบได้อัปเดตข้อมูล LINE ID สำหรับรับแจ้งเตือนใบลาเรียบร้อยแล้ว',
        confirmButtonColor: '#059669'
      });
    } else {
      alert('บันทึก LINE User ID สำเร็จ!');
    }
  } catch (err) {
    console.error("❌ Save LINE ID error:", err);
    if (window.Swal) {
      Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึก LINE ID ได้', 'error');
    } else {
      alert('เกิดข้อผิดพลาดในการบันทึก LINE ID');
    }
  }
}

async function testLineNotification() {
  const lineInput = document.getElementById("userLineIdInput");
  const lineId = lineInput ? lineInput.value.trim() : "";
  const emp = window.currentEmpProfile;

  if (!lineId) {
    if (window.Swal) {
      Swal.fire('กรุณาระบุ LINE User ID', 'โปรดใส่ LINE User ID ก่อนทดสอบส่งข้อความ', 'warning');
    } else {
      alert('โปรดใส่ LINE User ID ก่อนทดสอบส่งข้อความ');
    }
    return;
  }

  if (window.Swal) {
    Swal.fire({
      title: 'กำลังส่งข้อความทดสอบ...',
      text: 'กรุณารอสักครู่ ระบบกำลังส่งข้อความไปยัง LINE',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });
  }

  try {
    if (window.PVTSDK?.line?.sendWorkflowNotification) {
      const res = await window.PVTSDK.line.sendWorkflowNotification({
        type: 'TEST',
        recipientId: emp?.id || '',
        recipientLineId: lineId,
        employeeName: emp?.full_name || 'พนักงาน',
        employeeCode: emp?.employee_code || '',
        leaveType: 'ทดสอบระบบแจ้งเตือน LINE',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        totalDays: 1,
        reason: 'ทดสอบการส่งข้อความแจ้งเตือนใบลาผ่าน LINE',
        attachmentUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80'
      });

      if (res && res.lineSent) {
        if (window.Swal) {
          Swal.fire({
            icon: 'success',
            title: 'ส่งข้อความทดสอบสำเร็จ! 🎉',
            text: 'ส่งข้อความไปยัง LINE เรียบร้อยแล้ว กรุณาเช็กข้อความในแอป LINE ของคุณ',
            confirmButtonColor: 'var(--th-k-600, #0284c7)'
          });
        }
      } else {
        if (window.Swal) {
          Swal.fire({
            icon: 'info',
            title: 'บันทึกการส่งแล้ว',
            text: res?.message || 'ส่งแจ้งเตือนในระบบเรียบร้อย (หากยังไม่ได้รับใน LINE กรุณาตรวจสอบว่าบอท LINE OA เปิดทำงานและได้รับ LINE User ID ที่ถูกต้อง)',
            confirmButtonColor: 'var(--th-k-600, #0284c7)'
          });
        }
      }
    } else {
      throw new Error('ไม่พบเอนจิน PVTSDK.line');
    }
  } catch (err) {
    console.error("❌ Test LINE Notification error:", err);
    if (window.Swal) {
      Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถส่งข้อความทดสอบได้', 'error');
    }
  }
}

async function generateLineLinkCode() {
  if (window.PVTLine && !(await window.PVTLine.guard())) return;
  const emp = window.currentEmpProfile;
  if (!emp || !emp.id) {
    Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลพนักงาน', 'error');
    return;
  }

  let client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabaseClient || window.pvtSupabase?.client);
  if (!client || typeof client.from !== 'function') {
    if (window.supabase && typeof window.supabase.from === 'function') client = window.supabase;
  }
  if (!client) return;

  try {
    let code = "";
    let created = false;

    // 1. Try server API (/api/create-line-link) first
    try {
      const apiRes = await fetch("/api/create-line-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: emp.id })
      });
      if (apiRes.status === 403) { if (window.PVTLine) { window.PVTLine.clearCache(); await window.PVTLine.guard(); } return; }
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.success && apiData.token) {
          code = apiData.token;
          created = true;
        }
      }
    } catch (e) {}

    // 2. Fallback to direct client insert if API is unavailable
    if (!created && client) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      try {
        await client.from('line_link_tokens').delete().eq('employee_id', emp.id);
      } catch (e) {}

      const { error } = await client
        .from('line_link_tokens')
        .insert([
          { 
            employee_id: emp.id, 
            token: code,
            link_code: code,
            expires_at: expiresAt 
          }
        ]);

      if (!error) created = true;
    }

    if (!code) {
      throw new Error("ไม่สามารถสร้างรหัสเชื่อมต่อ LINE ได้");
    }

    Swal.fire({
      title: 'รหัสเชื่อมต่อ LINE ของคุณ',
      html: `
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #059669; margin: 20px 0;">
          ${code}
        </div>
        <p style="font-size: 14px; color: #64748b;">
          กรุณาส่งรหัสนี้ไปยัง LINE Official Account ของบริษัท<br>
          รหัสมีอายุใช้งาน 10 นาที
        </p>
      `,
      icon: 'info',
      confirmButtonText: 'รับทราบ',
      confirmButtonColor: '#059669'
    });

  } catch (err) {
    console.error("Generate Token Error:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถสร้างรหัสได้: ' + err.message, 'error');
  }
}

function isSelfUploadedAvatar(rawUrl) {
  return String(rawUrl || "").includes("self-avatars/");
}

function employeeImageToPublicUrl(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabaseClient || window.pvtSupabase?.client || window.supabase);
  if (client?.storage) {
    return client.storage.from("employee-images").getPublicUrl(raw.replace(/^\//, "")).data?.publicUrl || "";
  }
  const baseUrl = window.SUPABASE_URL || "https://pgogmhqjdchakcytsomx.supabase.co";
  return `${baseUrl}/storage/v1/object/public/employee-images/${raw.replace(/^\//, "")}`;
}

function updateAvatarCaches(publicUrl, rawValue) {
  const emp = window.currentEmpProfile || {};
  emp.image_url = rawValue || null;
  emp.avatar_url = publicUrl || null;
  window.currentEmpProfile = emp;

  const possibleStorageKeys = ["currentUser", "pvt_user", "user", "profile", "employee_session", "hr_session", "loggedInUser"];
  for (const key of possibleStorageKeys) {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed) continue;
      parsed.image_url = rawValue || null;
      parsed.avatar_url = publicUrl || null;
      if (parsed.employees) {
        parsed.employees.image_url = rawValue || null;
        parsed.employees.avatar_url = publicUrl || null;
      }
      if (localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(parsed));
      if (sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(parsed));
    } catch (_) {}
  }

  const avatarImgEl = document.getElementById("profileAvatarImg");
  if (avatarImgEl && publicUrl) avatarImgEl.src = publicUrl + (publicUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
  const userHeaderAvatarEl = document.getElementById("userAvatar");
  if (userHeaderAvatarEl && publicUrl) userHeaderAvatarEl.src = publicUrl + (publicUrl.includes("?") ? "&" : "?") + "t=" + Date.now();
}

async function getCurrentEmployeeAvatarRecord() {
  const emp = window.currentEmpProfile || {};
  const empId = emp.id || emp.employee_id;
  const empCode = emp.employee_code || emp.code;
  const client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabaseClient || window.pvtSupabase?.client || window.supabase);
  if (!client) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");

  let query = client.from("employees").select("id, employee_code, full_name, image_url");
  if (empId) query = query.eq("id", empId);
  else if (empCode) query = query.eq("employee_code", empCode);
  else throw new Error("ไม่พบข้อมูลพนักงาน");

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("ไม่พบข้อมูลพนักงาน");
  return { client, employee: data };
}

async function openProfileAvatarActions() {
  try {
    const { employee } = await getCurrentEmployeeAvatarRecord();
    const canDelete = isSelfUploadedAvatar(employee.image_url);

    if (!window.Swal) {
      document.getElementById("profileAvatarFileInput")?.click();
      return;
    }

    await Swal.fire({
      title: "แก้ไขรูปโปรไฟล์",
      html: `
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
          <button type="button" id="pvtAvatarUploadAction" style="width:100%;border:0;border-radius:12px;padding:13px 16px;background:var(--th-k-600, #0284c7);color:#fff;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <span class="material-symbols-outlined" style="font-size:20px;">upload</span>
            อัปโหลดรูป
          </button>
          <button type="button" id="pvtAvatarDeleteAction" style="width:100%;border:0;border-radius:12px;padding:13px 16px;background:#fff1f2;color:#dc2626;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
            <span class="material-symbols-outlined" style="font-size:20px;">delete</span>
            ลบรูป
          </button>
          <button type="button" id="pvtAvatarCancelAction" style="width:100%;border:0;border-radius:12px;padding:12px 16px;background:#f1f5f9;color:#475569;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;">
            ยกเลิก
          </button>
          ${canDelete ? "" : '<div style="font-size:12px;color:#94a3b8;margin-top:2px;">หากเป็นรูปที่ผู้ดูแลระบบกำหนด ระบบจะไม่อนุญาตให้ลบ</div>'}
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: false,
      allowOutsideClick: true,
      didOpen: () => {
        const uploadBtn = document.getElementById("pvtAvatarUploadAction");
        const deleteBtn = document.getElementById("pvtAvatarDeleteAction");
        const cancelBtn = document.getElementById("pvtAvatarCancelAction");

        uploadBtn?.addEventListener("click", () => {
          Swal.close();
          setTimeout(() => document.getElementById("profileAvatarFileInput")?.click(), 50);
        });

        deleteBtn?.addEventListener("click", () => {
          Swal.close();
          setTimeout(() => deleteOwnProfileAvatar(), 50);
        });

        cancelBtn?.addEventListener("click", () => Swal.close());
      }
    });
  } catch (error) {
    console.error("openProfileAvatarActions:", error);
    if (window.Swal) Swal.fire("เกิดข้อผิดพลาด", error.message || "ไม่สามารถเปิดเมนูแก้ไขรูปได้", "error");
  }
}

async function handleProfileAvatarUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];

  if (!file.type.startsWith("image/")) {
    if (window.Swal) Swal.fire("ไฟล์ไม่ถูกต้อง", "กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP) เท่านั้น", "warning");
    else alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
    input.value = "";
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    if (window.Swal) Swal.fire("ไฟล์มีขนาดใหญ่เกินไป", "ขนาดไฟล์ต้องไม่เกิน 10 MB", "warning");
    else alert("ขนาดไฟล์ต้องไม่เกิน 10 MB");
    input.value = "";
    return;
  }

  try {
    if (window.Swal) {
      Swal.fire({
        title: "กำลังอัปโหลดรูปโปรไฟล์...",
        text: "กรุณารอสักครู่ ระบบกำลังประมวลผลและอัปเดตรูปภาพ",
        allowOutsideClick: false,
        didOpen: () => { if (Swal.showLoading) Swal.showLoading(); }
      });
    }

    const { client, employee } = await getCurrentEmployeeAvatarRecord();
    const empCode = employee.employee_code || "EMP_" + employee.id;
    const empId = employee.id;
    const oldRawAvatar = String(employee.image_url || "").trim();

    // เก็บรูปที่ Admin ตั้งไว้เป็น backup ก่อนที่พนักงานจะอัปโหลดรูปของตนเองครั้งแรก
    if (oldRawAvatar && !isSelfUploadedAvatar(oldRawAvatar)) {
      const settingKey = `employee_admin_avatar_backup_${empId}`;
      const { error: backupError } = await client.from("system_settings").upsert({
        setting_key: settingKey,
        employee_id: empId,
        setting_value: { image_url: oldRawAvatar },
        description: "รูปโปรไฟล์ต้นฉบับที่ผู้ดูแลระบบกำหนด ก่อนพนักงานเปลี่ยนรูปเอง"
      }, { onConflict: "setting_key" });
      if (backupError) console.warn("Avatar backup warning:", backupError);
    }

    // ถ้าเป็นรูปที่พนักงานเคยอัปเอง ให้ลบไฟล์เก่าของพนักงานก่อน
    if (isSelfUploadedAvatar(oldRawAvatar)) {
      try { await client.storage.from("employee-images").remove([oldRawAvatar]); } catch (_) {}
    }

    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `self-avatars/${empCode}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await client.storage
      .from('employee-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });
    if (uploadError) throw uploadError;

    const publicUrl = client.storage.from('employee-images').getPublicUrl(fileName).data?.publicUrl;
    if (!publicUrl) throw new Error("ไม่สามารถรับ URL รูปภาพจากเซิร์ฟเวอร์ได้");

    const { error: updateError } = await client.from('employees').update({ image_url: fileName }).eq('id', empId);
    if (updateError) throw updateError;

    updateAvatarCaches(publicUrl, fileName);

    if (window.Swal) {
      Swal.fire({ icon: "success", title: "อัปโหลดรูปโปรไฟล์สำเร็จ", text: "รูปนี้เป็นรูปที่คุณอัปโหลดเอง และสามารถลบได้จากปุ่มปากกา", timer: 1900, showConfirmButton: false });
    }
  } catch (error) {
    console.error("❌ Error uploading profile avatar:", error);
    if (window.Swal) Swal.fire("อัปโหลดไม่สำเร็จ", error.message || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ", "error");
    else alert("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: " + (error.message || ""));
  } finally {
    input.value = "";
  }
}

async function deleteOwnProfileAvatar() {
  try {
    const { client, employee } = await getCurrentEmployeeAvatarRecord();
    const currentRaw = String(employee.image_url || "").trim();

    // Security guard: ลบได้เฉพาะรูปใน self-avatars เท่านั้น
    if (!isSelfUploadedAvatar(currentRaw)) {
      if (window.Swal) Swal.fire("ไม่สามารถลบรูปได้", "รูปนี้ถูกกำหนดโดยผู้ดูแลระบบ พนักงานไม่มีสิทธิ์ลบค่ะ", "warning");
      return;
    }

    if (window.Swal) {
      const confirmResult = await Swal.fire({
        title: "ลบรูปโปรไฟล์ที่อัปโหลดเอง?",
        text: "เมื่อลบแล้ว ระบบจะกลับไปใช้รูปที่ผู้ดูแลระบบตั้งไว้ (ถ้ามี)",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ลบรูป",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#ef4444"
      });
      if (!confirmResult.isConfirmed) return;
    }

    const settingKey = `employee_admin_avatar_backup_${employee.id}`;
    const { data: backupSetting } = await client.from("system_settings")
      .select("setting_value")
      .eq("setting_key", settingKey)
      .maybeSingle();

    let backupRaw = null;
    const settingValue = backupSetting?.setting_value;
    if (settingValue && typeof settingValue === "object") backupRaw = settingValue.image_url || null;
    else if (typeof settingValue === "string") {
      try { backupRaw = JSON.parse(settingValue)?.image_url || settingValue; } catch (_) { backupRaw = settingValue; }
    }

    const { error: updateError } = await client.from("employees").update({ image_url: backupRaw || null }).eq("id", employee.id);
    if (updateError) throw updateError;

    // ลบเฉพาะไฟล์ที่พนักงานอัปเอง หลังจากคืน pointer ใน DB สำเร็จแล้ว
    const { error: removeError } = await client.storage.from("employee-images").remove([currentRaw]);
    if (removeError) console.warn("Remove self avatar warning:", removeError);

    if (backupSetting) {
      await client.from("system_settings").delete().eq("setting_key", settingKey);
    }

    let displayUrl = employeeImageToPublicUrl(backupRaw);
    if (!displayUrl) {
      const emp = window.currentEmpProfile || employee;
      displayUrl = typeof window.getDefaultAvatarUrl === "function"
        ? window.getDefaultAvatarUrl(emp.title || emp.prefix || "", emp.gender || "", emp.full_name || "")
        : "/assets/img/avatar-male.jpg?v=2";
    }
    updateAvatarCaches(displayUrl, backupRaw);

    if (window.Swal) Swal.fire({ icon: "success", title: "ลบรูปแล้ว", text: backupRaw ? "กลับไปใช้รูปที่ผู้ดูแลระบบกำหนดไว้แล้ว" : "กลับไปใช้รูปเริ่มต้นแล้ว", timer: 1800, showConfirmButton: false });
  } catch (error) {
    console.error("deleteOwnProfileAvatar:", error);
    if (window.Swal) Swal.fire("ลบรูปไม่สำเร็จ", error.message || "เกิดข้อผิดพลาดในการลบรูป", "error");
  }
}

window.openProfileAvatarActions = openProfileAvatarActions;
window.deleteOwnProfileAvatar = deleteOwnProfileAvatar;
window.handleProfileAvatarUpload = handleProfileAvatarUpload;

window.saveUserLineId = saveUserLineId;
window.testLineNotification = testLineNotification;
window.generateLineLinkCode = generateLineLinkCode;
window.handleProfileAvatarUpload = handleProfileAvatarUpload;

window.addEventListener("pvt-lang-changed", () => {
  if (typeof loadProfile === "function") {
    loadProfile();
  }
});


// Sidebar Helper Actions
window.goToLeaveForm = function() { window.location.href = "/pages/user/leave-user.html"; };
window.viewMyDigitalCard = function() { window.location.href = "/pages/user/index-user.html?action=digital_card"; };
window.generateLineLinkToken = function() { window.location.href = "/pages/user/index-user.html?action=line_link"; };
