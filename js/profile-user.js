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

    // Populate LINE User ID input
    const lineInput = document.getElementById("userLineIdInput");
    if (lineInput) {
      lineInput.value = emp?.line_id || "";
    }
    window.currentEmpProfile = emp;

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
    const client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabase || window.sb);
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

  const client = window.pvtSupabase?.getClient ? window.pvtSupabase.getClient() : (window.supabase || window.sb);
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

window.saveUserLineId = saveUserLineId;
window.testLineNotification = testLineNotification;
window.generateLineLinkCode = generateLineLinkCode;


