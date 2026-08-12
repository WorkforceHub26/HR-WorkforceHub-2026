/**
 * profile-user.js — (ดึงข้อมูลจริงจาก Supabase สำหรับ HR / Employee)
 */

document.addEventListener("DOMContentLoaded", loadProfile);

async function loadProfile() {
  const box = document.getElementById("profileBox");
  if (!box) return;

  try {
    let currentUserData = null;
    const client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabase || window.sb);

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
        const raw = localStorage.getItem(key) || localStorage.getItem(key);
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

    // ⛔ หากค้นหาจากทุกจุดแล้วไม่พบข้อมูลจริงใดๆ
    if (!currentUserData) {
      console.warn("🔒 ไม่พบข้อมูลการเข้าสู่ระบบในเครื่อง");
      box.innerHTML = `
        <div style="padding: 32px 16px; text-align: center; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="font-size: 40px; margin-bottom: 12px;">🔒</div>
          <h3 style="font-size: 16px; color: #1e293b; margin-bottom: 8px; font-weight: 600;">ยังไม่ได้เข้าสู่ระบบ</h3>
          <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>
          <a href="/pages/index.html" style="display: inline-block; padding: 10px 20px; background: #10b981; color: #ffffff; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
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
      let query = client.from('employees').select('*, departments(department_name), positions(position_name)');

      if (targetId) query = query.eq('id', targetId);
      else if (targetCode) query = query.eq('employee_code', targetCode);
      else if (targetEmail) query = query.eq('email', targetEmail);

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        realProfile = data;
      }
    }

    // รวมข้อมูลที่ดึงจาก DB หรือจาก Session
    const emp = realProfile || currentUserData.employees || currentUserData;
    const deptName = emp?.departments?.department_name || emp?.department_name || "-";
    const posName = emp?.positions?.position_name || emp?.position_name || "-";
    const rawStartDate = emp?.start_date || emp?.join_date || emp?.created_at || currentUserData?.created_at;

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

    // 🌟 พ่น HTML แสดงผลข้อมูลโปรไฟล์จริง
    box.innerHTML = `
      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">ชื่อ-นามสกุล</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(emp?.full_name || currentUserData?.display_name || currentUserData?.full_name)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">รหัสพนักงาน</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(emp?.employee_code || currentUserData?.employee_code)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">ฝ่าย / แผนก</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(deptName)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">ตำแหน่งงาน</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(posName)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">อีเมล / บัญชี</span>
        <strong style="color: #1e293b; font-size: 15px;">${escapeFn(emp?.email || currentUserData?.email)}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">สิทธิ์การใช้งาน</span>
        <strong style="color: #1e293b; font-size: 15px; text-transform: uppercase;">${escapeFn(emp?.role || currentUserData?.role || "HR")}</strong>
      </article>

      <article class="recent-item" style="margin-bottom: 12px; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #64748b; font-size: 14px;">วันเริ่มงาน</span>
        <strong style="color: #1e293b; font-size: 15px;">${dateFn(rawStartDate)}</strong>
      </article>
    `;

    console.log("✅ [SUCCESS] โหลดข้อมูลโปรไฟล์จริงของ HR/User สำเร็จ!");

  } catch (error) {
    console.error("❌ Error loading profile page:", error);
    box.innerHTML = `<div class="empty-state" style="color: #ef4444; text-align: center; padding: 20px;">เกิดข้อผิดพลาดในการโหลดข้อมูลโปรไฟล์</div>`;
  }
}

