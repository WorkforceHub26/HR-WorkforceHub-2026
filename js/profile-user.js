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
          <button type="button" id="btnTriggerAvatarUpload" onclick="document.getElementById('profileAvatarFileInput').click()" title="เปลี่ยนรูปโปรไฟล์" style="position: absolute; bottom: 2px; right: 2px; width: 36px; height: 36px; border-radius: 50%; background: #0284c7; color: #ffffff; border: 2.5px solid #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); transition: transform 0.2s;">
            <span class="material-symbols-outlined" style="font-size: 20px;">photo_camera</span>
          </button>
          <input type="file" id="profileAvatarFileInput" accept="image/*" style="display: none;" onchange="handleProfileAvatarUpload(this)" />
        </div>
        <h3 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${escapeFn(empName)}</h3>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
          <span style="background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 600;">รหัส: ${escapeFn(empCode)}</span>
          <span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 99px; font-size: 12.5px; font-weight: 600;">${escapeFn(deptName)}</span>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 10px 0 0 0;">แตะไอคอนกล้องถ่ายรูปเพื่ออัปโหลดหรือเปลี่ยนรูปโปรไฟล์</p>
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



    // Role-based visibility for LINE Notification Settings (เฉพาะหัวหน้างาน, ผู้จัดการ, ผู้บริหาร และ HR/Admin)
    const lineSection = document.getElementById("lineNotificationSection");
    if (lineSection) {
      const r = String(emp?.role || currentUserData?.role || '').toLowerCase();
      const p = String(emp?.position_name || emp?.positions?.position_name || '').toLowerCase();
      const l = String(emp?.positions?.level_type || emp?.level_type || '').toLowerCase();

      const isLeaderOrManager = 
        r.includes('manager') || r.includes('ผู้จัดการ') ||
        r.includes('leader') || r.includes('supervisor') || r.includes('หัวหน้า') ||
        r.includes('admin') || r.includes('hr') || r.includes('executive') || r.includes('director') || r.includes('owner') ||
        p.includes('ผู้จัดการ') || p.includes('manager') || p.includes('ผจก') ||
        p.includes('หัวหน้า') || p.includes('supervisor') || p.includes('head') ||
        p.includes('ผู้บริหาร') || p.includes('ผู้อำนวยการ') ||
        l.includes('ผู้จัดการ') || l.includes('manager') || l.includes('leader') || l.includes('supervisor');

      if (isLeaderOrManager) {
        lineSection.style.display = "block";
      } else {
        lineSection.style.display = "none";
      }
    }

    console.log("✅ [SUCCESS] โหลดข้อมูลโปรไฟล์จริงของ HR/User สำเร็จ!");

  } catch (error) {
    console.error("❌ Error loading profile page:", error);
    box.innerHTML = `<div class="empty-state" style="color: #ef4444; text-align: center; padding: 20px;">เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์</div>`;
  }
}

async function saveUserLineId() {
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
            confirmButtonColor: '#0284c7'
          });
        }
      } else {
        if (window.Swal) {
          Swal.fire({
            icon: 'info',
            title: 'บันทึกการส่งแล้ว',
            text: res?.message || 'ส่งแจ้งเตือนในระบบเรียบร้อย (หากยังไม่ได้รับใน LINE กรุณาตรวจสอบว่าบอท LINE OA เปิดทำงานและได้รับ LINE User ID ที่ถูกต้อง)',
            confirmButtonColor: '#0284c7'
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

async function handleProfileAvatarUpload(input) {
  if (!input || !input.files || !input.files[0]) return;
  const file = input.files[0];

  if (!file.type.startsWith("image/")) {
    if (window.Swal) Swal.fire("ไฟล์ไม่ถูกต้อง", "กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP) เท่านั้น", "warning");
    else alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    if (window.Swal) Swal.fire("ไฟล์มีขนาดใหญ่เกินไป", "ขนาดไฟล์ต้องไม่เกิน 10 MB", "warning");
    else alert("ขนาดไฟล์ต้องไม่เกิน 10 MB");
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

    const emp = window.currentEmpProfile || {};
    const empCode = emp.employee_code || emp.code || "EMP_" + (emp.id || Date.now());
    const empId = emp.id || emp.employee_id;

    let uploadedPublicUrl = null;
    let client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabaseClient || window.pvtSupabase?.client || window.supabase);

    if (window.pvtSupabase && typeof window.pvtSupabase.uploadEmployeeAvatar === "function" && empId) {
      try {
        uploadedPublicUrl = await window.pvtSupabase.uploadEmployeeAvatar(empId, file);
      } catch (err) {
        console.warn("pvtSupabase.uploadEmployeeAvatar error, using direct bucket upload:", err);
      }
    }

    if (!uploadedPublicUrl && client && client.storage) {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `avatars/${empCode}_${Date.now()}.${fileExt}`;

      const { data, error } = await client.storage
        .from('employee-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (error) throw error;

      const { data: publicUrlData } = client.storage
        .from('employee-images')
        .getPublicUrl(fileName);

      const baseUrl = window.SUPABASE_URL || 'https://pgogmhqjdchakcytsomx.supabase.co';
      uploadedPublicUrl = publicUrlData?.publicUrl || `${baseUrl}/storage/v1/object/public/employee-images/${fileName}`;

      if (empId) {
        await client.from('employees').update({ image_url: fileName }).eq('id', empId);
      } else if (empCode) {
        await client.from('employees').update({ image_url: fileName }).eq('employee_code', empCode);
      }
    }

    if (!uploadedPublicUrl) {
      throw new Error("ไม่สามารถรับ URL รูปภาพจากเซิร์ฟเวอร์ได้");
    }

    // Update Local Cache
    emp.image_url = uploadedPublicUrl;
    emp.avatar_url = uploadedPublicUrl;
    window.currentEmpProfile = emp;

    const possibleStorageKeys = ["currentUser", "pvt_user", "user", "profile", "employee_session", "hr_session", "loggedInUser"];
    for (const key of possibleStorageKeys) {
      const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed) {
            parsed.image_url = uploadedPublicUrl;
            parsed.avatar_url = uploadedPublicUrl;
            if (parsed.employees) {
              parsed.employees.image_url = uploadedPublicUrl;
              parsed.employees.avatar_url = uploadedPublicUrl;
            }
            if (localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(parsed));
            if (sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(parsed));
          }
        } catch (e) {}
      }
    }

    // Update DOM Images
    const avatarImgEl = document.getElementById("profileAvatarImg");
    if (avatarImgEl) avatarImgEl.src = uploadedPublicUrl;

    const userHeaderAvatarEl = document.getElementById("userAvatar");
    if (userHeaderAvatarEl) userHeaderAvatarEl.src = uploadedPublicUrl;

    if (window.Swal) {
      Swal.fire({
        icon: "success",
        title: "อัปโหลดรูปโปรไฟล์สำเร็จ! 🎉",
        text: "อัปเดตรูปภาพโปรไฟล์เรียบร้อยแล้ว",
        timer: 2000,
        showConfirmButton: false
      });
    } else {
      alert("อัปโหลดรูปโปรไฟล์สำเร็จแล้ว");
    }

  } catch (error) {
    console.error("❌ Error uploading profile avatar:", error);
    if (window.Swal) Swal.fire("อัปโหลดไม่สำเร็จ", error.message || "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ", "error");
    else alert("เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: " + (error.message || ""));
  }
}

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
