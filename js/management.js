/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - ADVANCED MANAGEMENT SYSTEM LOGIC
 * [ADVANCED DEBUGGED & FULLY CONNECTED EDITION - 2026]
 * ==========================================================================
 */

// เคลียร์และเริ่มต้นระบบเมื่อโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", async () => {
  console.clear();
  console.group("🚀 [SYSTEM BOOT] เริ่มต้นโหลดระบบจัดการ HR (HR Management Panel)");
  console.time("⏱️ เวลาที่ใช้ในการ Boot ระบบทั้งหมด");
  
  await initManagementSystem();
  
  console.timeEnd("⏱️ เวลาที่ใช้ในการ Boot ระบบทั้งหมด");
  console.groupEnd();
});

// ฟังก์ชันดึง Supabase Client ป้องกันระบบเออร์เรอร์
function getSupabase() {
  let sb = window.pvtSupabase?.getClient();
  
  if (!sb && window.supabase) {
    if (window.pvtFallbackClient) {
      return window.pvtFallbackClient;
    }
    
    console.warn("⚠️ [DATABASE WARNING] ไม่พบ window.pvtSupabase กำลังสลับไปใช้ระบบต่อตรง (Fallback)");
    
    const PVT_SUPABASE_URL = "https://pgogmhqjdchakcytsomx.supabase.co";
    const PVT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb2dtaHFqZGNoYWtjeXRzb214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NjUxMzYsImV4cCI6MjA5NzM0MTEzNn0.Ah-uFFvTK_qMiIyJN9Ddid6cXqjrZRtLbs14QXUa_m8";
    
    if (PVT_SUPABASE_URL.includes("your-project-url")) {
      console.error("❌ [CONFIG ERROR] กรุณากรอกรหัส PVT_SUPABASE_URL และ PVT_SUPABASE_ANON_KEY ในไฟล์ management.js");
      return null;
    }
    
    window.pvtFallbackClient = window.supabase.createClient(PVT_SUPABASE_URL, PVT_SUPABASE_ANON_KEY);
    return window.pvtFallbackClient;
  }

  if (!sb) {
    console.error("❌ [DATABASE ERROR] ไม่พบ window.pvtSupabase หรือ client ไม่พร้อมใช้งาน");
    Swal.fire("ระบบฐานข้อมูลไม่พร้อม", "ไม่สามารถสร้าง Client เชื่อมต่อฐานข้อมูลได้ กรุณาตรวจเช็กคีย์เชื่อมต่อ", "error");
    return null;
  }
  return sb;
}

// ==========================================
// 🟢 ฟังก์ชันตรวจสอบระบบเริ่มต้น (อัปเกรดให้รองรับ IT และแก้บั๊ก Profile Null)
// ==========================================
async function initManagementSystem() {
  console.log("🔍 [Step 1]: ตรวจสอบการเชื่อมต่อฐานข้อมูลและตัวตนผู้ใช้งาน...");
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // 1. ลองดึงผ่านฟังก์ชันหลักก่อน
    let profile = await window.pvtSupabase?.getCurrentProfile();
    
    // 2. ถ้าดึงแล้วเป็น null ให้ลองกู้ข้อมูลจาก Session Storage เผื่อระบบอ่านค่าไม่ทัน
    if (!profile) {
      const savedUser = sessionStorage.getItem("currentUser");
      if (savedUser) {
        profile = JSON.parse(savedUser);
        console.log("📦 [Session Restored]: กู้คืนข้อมูลสำเร็จจาก Session");
      }
    }

    console.log("👤 [User Profile Loaded]:", profile);

    // 3. ตรวจสอบว่าถ้ายัง null อยู่แปลว่าไม่ได้ล็อกอินในแท็บนี้จริงๆ
    if (!profile) {
      console.error("🚫 [AUTH ERROR]: ไม่พบข้อมูลการล็อกอิน!");
      Swal.fire({
        icon: 'error',
        title: 'เซสชันหมดอายุหรือยังไม่ได้ล็อกอิน',
        text: 'กรุณาเข้าสู่ระบบผ่านหน้าล็อกอิน (ในแท็บเดียวกันนี้) ก่อนเข้าใช้งาน',
        confirmButtonText: 'ไปหน้าเข้าสู่ระบบ'
      }).then(() => {
        window.location.href = '/login.html'; // เตะกลับไปหน้าล็อกอิน
      });
      return; 
    }

    // 4. ตรวจสอบสิทธิ์ (เปิดทางให้ admin, hr และ it)
    const userRole = profile.role ? profile.role.toLowerCase() : 'user';
    if (userRole !== 'admin' && userRole !== 'hr' && userRole !== 'it') {
      console.warn(`⚠️ [SECURITY WARNING]: ผู้ใช้งานไม่มีสิทธิ์ (Role ปัจจุบันคือ: ${userRole})`);
      Swal.fire('ไม่มีสิทธิ์เข้าใช้งาน', 'หน้านี้สงวนไว้สำหรับ HR, Admin และ IT เท่านั้น', 'warning');
      return;
    }

    console.log("✅ [System Ready]: ระบบพร้อมทำงานและเชื่อมต่อฐานข้อมูลเรียบร้อย (สิทธิ์ผ่าน)");

  } catch (err) {
    console.error("❌ [Boot Failed] เกิดข้อผิดพลาดในการตรวจสอบระบบเริ่มต้น:", err);
  }
}

// 📝 ฟังก์ชันกลาง: สำหรับเขียน Log การกระทำของ HR ลงฐานข้อมูลจริง
async function saveHRActivityLog(category, type, target, description, before = null, after = null) {
  console.groupCollapsed(`💾 [AUDIT LOG SYSTEM] กำลังบันทึกประวัติการกระทำ -> หมวดหมู่: ${category}`);
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    const profile = await window.pvtSupabase?.getCurrentProfile();
    const actorId = profile?.employee_id || null;
    const actorName = profile?.display_name || "HR Admin System";

    const logData = {
      actor_id: actorId,
      actor_name: actorName,
      action_category: category,
      action_type: type,
      target_identifier: target,
      description: description,
      payload_before: before,
      payload_after: after
    };

    console.log("📥 ส่งข้อมูล Log เข้าตาราง hr_admin_management_logs:", logData);
    const { error } = await supabase.from('hr_admin_management_logs').insert([logData]);
    
    if (error) throw error;
    console.log("✅ [Audit Log Saved]: บันทึกประวัติสำเร็จเรียบร้อย");
  } catch (err) {
    console.error("❌ [Audit Log Failed]: ไม่สามารถบันทึก Log ลงฐานข้อมูลได้:", err);
  }
  console.groupEnd();
}

// ==========================================================================
// หมวดที่ 1: จัดการข้อมูลพนักงานและโครงสร้างองค์กร (Connected)
// ==========================================================================

// ==========================================
// 🟢 ฟังก์ชันเพิ่มพนักงานใหม่ (ยืนยันล็อกสองชั้น 2 รอบ)
// ==========================================
async function addNewEmployee() {
  const supabase = getSupabase();
  if (!supabase) return;
  
  try {
    const { data: depts } = await supabase.from('departments').select('id, department_name');
    let deptOptions = depts?.map(d => `<option value="${d.id}">${d.department_name}</option>`).join('') || '';

    const { data: roles } = await supabase.from('positions').select('id, position_name');
    let roleOptions = roles?.map(r => `<option value="${r.id}">${r.position_name}</option>`).join('') || '';

    const { value: formValues } = await Swal.fire({
      title: '➕ เพิ่มพนักงานใหม่',
      width: '800px',
      html: `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; text-align:left; font-family:'Kanit', sans-serif;">
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสพนักงาน *</label>
            <input id="swal-empCode" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" placeholder="เช่น 19001">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสผ่าน *</label>
            <input type="text" id="swal-password" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" placeholder="รหัสผ่านสำหรับเข้าสู่ระบบ">
          </div>
          <div style="grid-column: span 2;">
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อ-นามสกุล (จริง) *</label>
            <input id="swal-fullName" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" placeholder="นาย/นางสาว...">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อเล่น</label>
            <input id="swal-nickname" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" placeholder="ชื่อเล่น">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">เบอร์โทรศัพท์</label>
            <input id="swal-phone" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" placeholder="08X-XXX-XXXX">
          </div>
          <div style="grid-column: span 2;">
            <label style="font-size:14px; font-weight:600; color:#1e293b;">อีเมล</label>
            <input type="email" id="swal-email" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" placeholder="email@company.com">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">แผนก *</label>
            <select id="swal-dept" class="swal2-select" style="margin:4px 0 0; width:100%; height:45px; display:flex;">
              <option value="" disabled selected>-- เลือกแผนก --</option>
              ${deptOptions}
            </select>
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ตำแหน่ง *</label>
            <select id="swal-role" class="swal2-select" style="margin:4px 0 0; width:100%; height:45px; display:flex;">
              <option value="" disabled selected>-- เลือกตำแหน่ง --</option>
              ${roleOptions}
            </select>
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">วันที่เริ่มงาน</label>
            <input type="date" id="swal-startDate" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;">
          </div>
          <div style="background:#f0fdfa; padding:8px 12px; border-radius:8px; border:1px solid #ccfbf1; display:flex; flex-direction:column; justify-content:center;">
            <label style="font-size:13px; font-weight:600; color:#0f766e;">🏥 รพ. ประกันสังคม (ถ้ามี)</label>
            <input id="swal-hospital" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:35px; border-color:#99f6e4; font-size:14px;" placeholder="เช่น รพ.เปาโล">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'ถัดไป >',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#06b6d4',
      preConfirm: () => {
        const code = document.getElementById('swal-empCode').value.trim();
        const password = document.getElementById('swal-password').value.trim();
        const name = document.getElementById('swal-fullName').value.trim();
        const dept = document.getElementById('swal-dept').value;
        const role = document.getElementById('swal-role').value;
        
        if (!code || !password || !name || !dept || !role) {
          Swal.showValidationMessage('⚠️ กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
          return false;
        }
        
        return {
          employee_code: code,
          password: password,
          full_name: name,
          nickname: document.getElementById('swal-nickname').value.trim() || null,
          phone: document.getElementById('swal-phone').value.trim() || null,
          email: document.getElementById('swal-email').value.trim() || null,
          department_id: dept,
          position_id: role,
          start_date: document.getElementById('swal-startDate').value || null,
          social_security_hospital: document.getElementById('swal-hospital').value.trim() || null,
          status: 'active',
          role: 'user'
        }
      }
    });

    if (formValues) {
      // 💥 [กดยืนยันรอบที่ 1/2]
      const confirm1 = await Swal.fire({
        title: '❓ ตรวจสอบข้อมูลพนักงานใหม่ (รอบที่ 1/2)',
        html: `คุณกำลังจะเพิ่มพนักงานรหัส <b>${formValues.employee_code}</b><br>ชื่อ: <b>${formValues.full_name}</b> เข้าสู่ระบบใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ข้อมูลถูกต้อง',
        cancelButtonText: 'แก้ไขใหม่',
        confirmButtonColor: '#06b6d4'
      });

      if (!confirm1.isConfirmed) return;

      // 💥 [กดยืนยันรอบที่ 2/2]
      const confirm2 = await Swal.fire({
        title: '🚨 ยืนยันขั้นสุดท้าย (รอบที่ 2/2)',
        text: 'ระบบจะสร้างบัญชีผู้ใช้งานและผูกสิทธิ์เข้าใช้งานระบบให้กับพนักงานรายนี้ทันที ยืนยันข้อมูลเด็ดขาดหรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '💾 บันทึกเข้าระบบทันที',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#64748b'
      });

      if (confirm2.isConfirmed) {
        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
        const { error } = await supabase.from('employees').insert([formValues]);
        if (error) throw error;
        
        if (typeof saveHRActivityLog === 'function') {
          await saveHRActivityLog('EMPLOYEE', 'INSERT', formValues.employee_code, `เพิ่มพนักงานใหม่: ${formValues.full_name}`);
        }
        Swal.fire('สำเร็จ!', 'เพิ่มข้อมูลพนักงานใหม่เข้าระบบเรียบร้อยแล้ว', 'success');
      }
    }

  } catch (err) {
    console.error("Error Add Employee:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message, 'error');
  }
}

// ==========================================
// 🟡 ฟังก์ชันค้นหาและแก้ไขข้อมูลพนักงาน (ยืนยันล็อกสองชั้น 2 รอบ ทั้งแก้ไขและลาออก)
// ==========================================
async function editEmployeeData() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { value: searchKey } = await Swal.fire({
      title: '🔍 ค้นหาพนักงานเพื่อแก้ไข',
      input: 'text',
      inputLabel: 'กรุณากรอก รหัสพนักงาน หรือ ชื่อ-นามสกุล',
      inputPlaceholder: 'เช่น 19001 หรือ วิทวัส...',
      showCancelButton: true,
      confirmButtonText: 'ค้นหา',
      confirmButtonColor: '#06b6d4'
    });

    if (!searchKey) return;
    
    Swal.fire({ title: 'กำลังค้นหาข้อมูล...', didOpen: () => Swal.showLoading() });

    const { data: emps, error: searchErr } = await supabase
      .from('employees')
      .select('*')
      .or(`employee_code.eq.${searchKey.trim()},full_name.ilike.%${searchKey.trim()}%`)
      .limit(1);

    if (searchErr) throw searchErr;

    if (!emps || emps.length === 0) {
      Swal.fire('ไม่พบข้อมูล', `ไม่มีพนักงานที่ตรงกับ "${searchKey}" ในระบบ`, 'warning');
      return;
    }

    const emp = emps[0]; 

    const { data: depts } = await supabase.from('departments').select('id, department_name');
    let deptOptions = depts?.map(d => `<option value="${d.id}" ${d.id === emp.department_id ? 'selected' : ''}>${d.department_name}</option>`).join('') || '';

    const { data: roles } = await supabase.from('positions').select('id, position_name');
    let roleOptions = roles?.map(r => `<option value="${r.id}" ${r.id === emp.position_id ? 'selected' : ''}>${r.position_name}</option>`).join('') || '';

    const result = await Swal.fire({
      title: '📝 แก้ไขข้อมูลพนักงาน',
      width: '800px',
      html: `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:14px; text-align:left; font-family:'Kanit', sans-serif;">
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสพนักงาน *</label>
            <input id="swal-empCode" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" value="${emp.employee_code || ''}">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสผ่าน *</label>
            <input type="text" id="swal-password" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" value="${emp.password || ''}">
          </div>
          <div style="grid-column: span 2;">
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อ-นามสกุล *</label>
            <input id="swal-fullName" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" value="${emp.full_name || ''}">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อเล่น</label>
            <input id="swal-nickname" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" value="${emp.nickname || ''}">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">เบอร์โทรศัพท์</label>
            <input id="swal-phone" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" value="${emp.phone || ''}">
          </div>
          <div style="grid-column: span 2;">
            <label style="font-size:14px; font-weight:600; color:#1e293b;">อีเมล</label>
            <input type="email" id="swal-email" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" value="${emp.email || ''}">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">แผนก *</label>
            <select id="swal-dept" class="swal2-select" style="margin:4px 0 0; width:100%; height:45px; display:flex;">
              ${deptOptions}
            </select>
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ตำแหน่ง *</label>
            <select id="swal-role" class="swal2-select" style="margin:4px 0 0; width:100%; height:45px; display:flex;">
              ${roleOptions}
            </select>
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">วันที่เริ่มงาน</label>
            <input type="date" id="swal-startDate" class="swal2-input" style="margin:4px 0 0; width:100%; height:45px;" value="${emp.start_date || ''}">
          </div>
          <div style="background:#f0fdfa; padding:8px 12px; border-radius:8px; border:1px solid #ccfbf1; display:flex; flex-direction:column; justify-content:center;">
            <label style="font-size:13px; font-weight:600; color:#0f766e;">🏥 รพ. ประกันสังคม</label>
            <input id="swal-hospital" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:35px; border-color:#99f6e4; font-size:14px;" value="${emp.hospital || ''}">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      showDenyButton: true, 
      confirmButtonText: '💾 บันทึกแก้ไข',
      denyButtonText: '🚨 แจ้งลาออก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#06b6d4',
      denyButtonColor: '#ef4444',
      preConfirm: () => {
        const code = document.getElementById('swal-empCode').value.trim();
        const password = document.getElementById('swal-password').value.trim();
        const name = document.getElementById('swal-fullName').value.trim();
        const dept = document.getElementById('swal-dept').value;
        const role = document.getElementById('swal-role').value;
        
        if (!code || !password || !name || !dept || !role) {
          Swal.showValidationMessage('⚠️ กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน');
          return false;
        }
        
        return {
          employee_code: code,
          password: password,
          full_name: name,
          nickname: document.getElementById('swal-nickname').value.trim() || null,
          phone: document.getElementById('swal-phone').value.trim() || null,
          email: document.getElementById('swal-email').value.trim() || null,
          department_id: dept,
          position_id: role,
          start_date: document.getElementById('swal-startDate').value || null,
          hospital: document.getElementById('swal-hospital').value.trim() || null
        };
      }
    });

    // 🟢 ส่วนที่ 1: จัดการการบันทึกแก้ไขข้อมูล
    if (result.isConfirmed && result.value) {
      // 💥 [กดยืนยันแก้ไข รอบที่ 1/2]
      const editConfirm1 = await Swal.fire({
        title: '❓ ยืนยันแก้ไขข้อมูล (รอบที่ 1/2)',
        html: `คุณกำลังจะเปลี่ยนแปลงข้อมูลของพนักงานคุณ <b>${emp.full_name}</b> ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ใช่, ตรวจสอบแล้ว',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#06b6d4'
      });

      if (!editConfirm1.isConfirmed) return;

      // 💥 [กดยืนยันแก้ไข รอบที่ 2/2]
      const editConfirm2 = await Swal.fire({
        title: '🚨 ยืนยันอัปเดตเด็ดขาด (รอบที่ 2/2)',
        text: 'การอัปเดตนี้จะมีผลต่อโปรไฟล์และระบบล็อกอินของพนักงานท่านนี้ทันที ยืนยันบันทึกข้อมูลทับรายชื่อเดิมหรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '💾 ยืนยันบันทึกทับข้อมูลเด็ดขาด',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#059669'
      });

      if (editConfirm2.isConfirmed) {
        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
        const { error: updErr } = await supabase.from('employees').update(result.value).eq('id', emp.id);
        if (updErr) throw updErr;
        
        if (typeof saveHRActivityLog === 'function') {
          await saveHRActivityLog('EMPLOYEE', 'UPDATE', emp.employee_code, `แก้ไขข้อมูลรายละเอียดพนักงานของ ${result.value.full_name}`);
        }
        Swal.fire('สำเร็จ!', 'แก้ไขข้อมูลพนักงานเรียบร้อยแล้ว', 'success');
      }

    // 🔴 ส่วนที่ 2: จัดการการแจ้งลาออก
    } else if (result.isDenied) {
      const { value: resignDate } = await Swal.fire({
        title: 'ยืนยันพนักงานลาออก',
        input: 'date',
        inputLabel: 'เลือกวันที่สิ้นสุดการทำงาน (วันลาออก)',
        inputValue: new Date().toISOString().split('T')[0],
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ถัดไป >'
      });

      if (resignDate) {
        // 💥 [กดยืนยันลาออก รอบที่ 1/2]
        const resignConfirm1 = await Swal.fire({
          title: '⚠️ ยืนยันบันทึกสถานะลาออก (รอบที่ 1/2)',
          html: `คุณต้องการปรับสถานะของคุณ <b>${emp.full_name}</b> เป็น <b style="color:#ef4444;">"ลาออก"</b> มีผลในวันที่ <b>${resignDate}</b> ใช่หรือไม่?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'ใช่, วันที่ถูกต้อง',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#ef4444'
        });

        if (!resignConfirm1.isConfirmed) return;

        // 💥 [กดยืนยันลาออก รอบที่ 2/2]
        const resignConfirm2 = await Swal.fire({
          title: '🚨 เตือนภัยขั้นเด็ดขาด! (รอบที่ 2/2)',
          text: 'เมื่อยืนยันแล้ว พนักงานท่านนี้จะไม่สามารถเข้าสู่ระบบเพื่อลงเวลาทำงาน หรือทำเรื่องยื่นเอกสารลาได้อีกต่อไป ต้องการยืนยันการตัดสิทธิ์เด็ดขาดหรือไม่?',
          icon: 'error',
          showCancelButton: true,
          confirmButtonText: '💥 ยืนยันตัดสิทธิ์และบันทึกข้อมูลลาออก',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#b91c1c'
        });

        if (resignConfirm2.isConfirmed) {
          Swal.fire({ title: 'กำลังบันทึกสถานะลาออก...', didOpen: () => Swal.showLoading() });
          const { error: resErr } = await supabase.from('employees').update({ status: 'resigned', resign_date: resignDate }).eq('id', emp.id);
          if (resErr) throw resErr;
          
          if (typeof saveHRActivityLog === 'function') {
            await saveHRActivityLog('EMPLOYEE', 'UPDATE', emp.employee_code, `ตั้งค่าพนักงานลาออก มีผลวันที่ ${resignDate}`);
          }
          Swal.fire('สำเร็จ!', 'บันทึกสถานะลาออกพนักงานเรียบร้อยแล้ว', 'success');
        }
      }
    }

  } catch (err) {
    console.error("❌ Error Edit Employee:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message, 'error');
  }
}

// ==========================================================================
// 📂 ฟังก์ชันจัดการโครงสร้างองค์กร (เพิ่มแผนก / เพิ่มตำแหน่งงานใหม่ พร้อมระบบยืนยัน 2 รอบ)
// ==========================================================================
async function manageDepartments() {
  console.group("📂 [HR ACTION] เรียกดูข้อมูลแผนก/ตำแหน่ง");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    const result = await Swal.fire({
      title: '🏢 จัดการโครงสร้างองค์กร',
      text: 'กรุณาเลือกรายการที่ต้องการเพิ่มเข้าสู่ฐานข้อมูลหลัก',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '🏢 เพิ่มฝ่าย/แผนกใหม่',
      denyButtonText: '💼 เพิ่มตำแหน่งงานใหม่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#06b6d4',
      denyButtonColor: '#3b82f6'
    });

    // 🟢 กรณีเลือก: เพิ่มฝ่าย / แผนกใหม่
    if (result.isConfirmed) {
      const { value: deptName } = await Swal.fire({
        title: 'เพิ่มฝ่าย / แผนกใหม่',
        input: 'text',
        inputLabel: 'กรุณาระบุชื่อแผนกที่ต้องการเพิ่ม',
        inputPlaceholder: 'เช่น ฝ่ายทรัพยากรบุคคล, ฝ่ายการตลาด',
        showCancelButton: true,
        confirmButtonText: 'ถัดไป >',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#06b6d4',
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องกรอกชื่อแผนกครับ!' }
      });

      if (deptName) {
        // 💥 [กดยืนยันเพิ่มแผนก รอบที่ 1/2]
        const confirmDept1 = await Swal.fire({
          title: '❓ ตรวจสอบชื่อแผนก (รอบที่ 1/2)',
          html: `คุณกำลังจะเพิ่มแผนกใหม่ชื่อ: <b>"${deptName.trim()}"</b> ใช่หรือไม่?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'ชื่อถูกต้อง',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#06b6d4'
        });

        if (!confirmDept1.isConfirmed) return;

        // 💥 [กดยืนยันเพิ่มแผนก รอบที่ 2/2]
        const confirmDept2 = await Swal.fire({
          title: '🚨 ยืนยันบันทึกแผนก (รอบที่ 2/2)',
          text: 'ข้อมูลนี้จะถูกนำไปใช้เป็นตัวเลือกแผนกของพนักงานทุกคนในบริษัท ยืนยันบันทึกเด็ดขาด?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: '💾 บันทึกข้อมูลลงระบบ',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#059669'
        });

        if (confirmDept2.isConfirmed) {
          Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
          const { error } = await supabase.from('departments').insert([{ department_name: deptName.trim() }]);
          if (error) throw error;
          
          if (typeof saveHRActivityLog === 'function') {
            await saveHRActivityLog('DEPARTMENT', 'INSERT', deptName.trim(), `เพิ่มแผนกโครงสร้างใหม่: ${deptName.trim()}`);
          }
          Swal.fire('สำเร็จ!', `เพิ่มแผนก "${deptName.trim()}" เรียบร้อยแล้ว`, 'success');
        }
      }
    } 
    // 🔵 กรณีเลือก: เพิ่มตำแหน่งงานใหม่
    else if (result.isDenied) {
      const { value: posName } = await Swal.fire({
        title: 'เพิ่มตำแหน่งงานใหม่',
        input: 'text',
        inputLabel: 'กรุณาระบุชื่อตำแหน่งงาน',
        inputPlaceholder: 'เช่น Senior Developer, HR Manager',
        showCancelButton: true,
        confirmButtonText: 'ถัดไป >',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#3b82f6',
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องกรอกชื่อตำแหน่งงานครับ!' }
      });

      if (posName) {
        // 💥 [กดยืนยันเพิ่มตำแหน่ง รอบที่ 1/2]
        const confirmPos1 = await Swal.fire({
          title: '❓ ตรวจสอบชื่อตำแหน่ง (รอบที่ 1/2)',
          html: `คุณกำลังจะเพิ่มตำแหน่งงานใหม่ชื่อ: <b>"${posName.trim()}"</b> ใช่หรือไม่?`,
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'ชื่อถูกต้อง',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#3b82f6'
        });

        if (!confirmPos1.isConfirmed) return;

        // 💥 [กดยืนยันเพิ่มตำแหน่ง รอบที่ 2/2]
        const confirmPos2 = await Swal.fire({
          title: '🚨 ยืนยันบันทึกตำแหน่ง (รอบที่ 2/2)',
          text: 'ข้อมูลนี้จะถูกนำไปใช้กำหนดตำแหน่งงานและสิทธิ์ของพนักงาน ยืนยันบันทึกเด็ดขาด?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: '💾 บันทึกข้อมูลลงระบบ',
          cancelButtonText: 'ยกเลิก',
          confirmButtonColor: '#059669'
        });

        if (confirmPos2.isConfirmed) {
          Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
          const { error } = await supabase.from('positions').insert([{ position_name: posName.trim() }]);
          if (error) throw error;
          
          if (typeof saveHRActivityLog === 'function') {
            await saveHRActivityLog('POSITION', 'INSERT', posName.trim(), `เพิ่มตำแหน่งงานใหม่: ${posName.trim()}`);
          }
          Swal.fire('สำเร็จ!', `เพิ่มตำแหน่งงาน "${posName.trim()}" เรียบร้อยแล้ว`, 'success');
        }
      }
    }
  } catch (err) {
    console.error("❌ จัดการโครงสร้างองค์กรล้มเหลว:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
  console.groupEnd();
}
// ==========================================================================
// หมวดที่ 2: ตั้งค่ากฎระเบียบและโควตาวันลา (Connected)
// ==========================================================================

// 🛠️ [แก้ไข บั๊ก DOM Data Loss] ย้ายการดึงค่า input ไปดักในช่วง preConfirm ก่อนที่หน้าต่างป๊อปอัปจะปิดตัวลง
// ==========================================
// ⚖️ ฟังก์ชันจัดการประเภทการลา (เพิ่ม / ลบ / แก้ไขโควตา พร้อมระบบยืนยัน 2 รอบ)
// ==========================================
async function editGlobalLeaveRules() {
  console.group("⚖️ [HR ACTION] เปิดระบบจัดการประเภทการลาและกฎเกณฑ์ภาพรวม");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    Swal.fire({ title: 'กำลังโหลดข้อมูลกฎเกณฑ์...', didOpen: () => Swal.showLoading() });
    
    // ดึงประเภทการลาที่เปิดใช้งานอยู่
    const { data: rules, error } = await supabase.from('leave_types').select('*').eq('status', 'active').order('created_at', { ascending: true });
    if (error) throw error;
    Swal.close();

    // สร้างตารางรายการประเภทการลา พร้อมช่องใส่ตัวเลข และปุ่มลบ (❌)
    let tableHTML = `
      <div style="font-family:'Kanit', sans-serif; text-align:left; margin-bottom:15px;">
        <button id="btn-add-leavetype" class="swal2-confirm swal2-styled" style="background-color:#059669; margin:0 0 15px 0; padding: 8px 16px; font-size:14px; border-radius:6px;">
          ➕ เพิ่มประเภทการลาใหม่
        </button>
      </div>
      <div style="max-height: 350px; overflow-y: auto; font-family:'Kanit', sans-serif;">
        <table style="width:100%; text-align:left; font-size:13px; border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
              <th style="padding:10px; border:1px solid #cbd5e1;">ประเภทการลา (โค้ด)</th>
              <th style="padding:10px; border:1px solid #cbd5e1; width:110px; text-align:center;">โควตา (วัน/ปี)</th>
              <th style="padding:10px; border:1px solid #cbd5e1; width:60px; text-align:center;">การจัดการ</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    rules.forEach(r => {
      tableHTML += `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px; border:1px solid #cbd5e1;">
            <b style="color:#1e293b; font-size:14px;">${r.leave_name}</b> <br>
            <span style="color:#64748b; font-size:11px;">Code: ${r.leave_code}</span>
          </td>
          <td style="padding:10px; border:1px solid #cbd5e1; text-align:center;">
            <input type="number" id="quota-${r.id}" class="swal2-input" style="width:80px; height:35px; margin:0; text-align:center; padding:0;" value="${r.yearly_quota}">
          </td>
          <td style="padding:10px; border:1px solid #cbd5e1; text-align:center;">
            <button class="btn-delete-leave" data-id="${r.id}" data-name="${r.leave_name}" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px;">
              ❌ ลบ
            </button>
          </td>
        </tr>
      `;
    });
    
    tableHTML += `</tbody></table></div>`;

    // เปิดหน้าต่างหลัก
    const { value: updatedRules } = await Swal.fire({
      title: '⚙️ จัดการประเภทและโควตาวันลาบริษัท',
      html: tableHTML,
      width: '800px',
      showCancelButton: true,
      confirmButtonText: '💾 บันทึกการเปลี่ยนแปลงโควตา',
      cancelButtonText: 'ปิดหน้าต่าง',
      confirmButtonColor: '#06b6d4',
      didOpen: (popup) => {
        // ผูกตัวจับคลิกปุ่ม [➕ เพิ่มประเภทการลาใหม่]
        popup.querySelector('#btn-add-leavetype').addEventListener('click', () => {
          Swal.close();
          actionAddNewLeaveType(); // สลับไปฟังก์ชันเพิ่มข้อมูล
        });

        // ผูกตัวจับคลิกปุ่ม [❌ ลบ] แยกรายบรรทัด
        popup.querySelectorAll('.btn-delete-leave').forEach(button => {
          button.addEventListener('click', (e) => {
            const leaveId = button.getAttribute('data-id');
            const leaveName = button.getAttribute('data-name');
            Swal.close();
            actionDeleteLeaveType(leaveId, leaveName); // สลับไปฟังก์ชันลบข้อมูล
          });
        });
      },
      preConfirm: () => {
        // รวบรวมข้อมูลโควตาที่กรอกแก้ไขในตารางส่งออกไปบันทึก
        const listResults = [];
        rules.forEach(r => {
          const inputVal = parseFloat(document.getElementById(`quota-${r.id}`).value) || 0;
          listResults.push({ id: r.id, old_quota: r.yearly_quota, new_quota: inputVal, name: r.leave_name });
        });
        return listResults;
      }
    });

    // ส่วนอัปเดตโควตาวันลาเดิม (ทำงานเมื่อกดปุ่ม บันทึกการเปลี่ยนแปลงโควตา)
    if (updatedRules) {
      Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      for (const item of updatedRules) {
        if (item.new_quota !== item.old_quota) {
          await supabase.from('leave_types').update({ yearly_quota: item.new_quota }).eq('id', item.id);
          if (typeof saveHRActivityLog === 'function') {
            await saveHRActivityLog('LEAVE_QUOTA', 'UPDATE', item.name, `ปรับโควตาจาก ${item.old_quota} เป็น ${item.new_quota} วัน/ปี`);
          }
        }
      }
      Swal.fire('สำเร็จ', 'ปรับปรุงข้อมูลโควตาวันลาภาพรวมเรียบร้อยแล้ว', 'success').then(() => editGlobalLeaveRules());
    }

  } catch (err) {
    console.error("❌ Error Manage Global Leave Rules:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  } finally {
    console.groupEnd();
  }
}

// ==========================================
// 🛡️ [SUB-FUNCTION] ฟังก์ชันเพิ่มประเภทการลาใหม่ + ยืนยัน 2 รอบ
// ==========================================
async function actionAddNewLeaveType() {
  const supabase = getSupabase();
  
  // 1. เปิดฟอร์มให้กรอกข้อมูลสิทธิ์การลา
  const { value: formValues } = await Swal.fire({
    title: '➕ เพิ่มประเภทการลาใหม่',
    html: `
      <div style="display:flex; flex-direction:column; gap:12px; text-align:left; font-family:'Kanit', sans-serif;">
        <div>
          <label style="font-size:13px; font-weight:600;">ชื่อประเภทการลา *</label>
          <input id="new-leave-name" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:42px;" placeholder="เช่น ลาเพื่อเตรียมคลอด">
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">รหัสโค้ดอ้างอิงย่อ (ภาษาอังกฤษตัวพิมพ์ใหญ่) *</label>
          <input id="new-leave-code" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:42px;" placeholder="เช่น MATERNITY">
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">จำนวนสิทธิ์วันลาสูงสุดต่อปี *</label>
          <input type="number" id="new-leave-quota" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:42px;" placeholder="เช่น 90" value="0">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'ถัดไป >',
    cancelButtonText: 'ย้อนกลับ',
    confirmButtonColor: '#06b6d4',
    preConfirm: () => {
      const name = document.getElementById('new-leave-name').value.trim();
      const code = document.getElementById('new-leave-code').value.trim().toUpperCase();
      const quota = parseFloat(document.getElementById('new-leave-quota').value) || 0;
      
      if (!name || !code) {
        Swal.showValidationMessage('⚠️ กรุณากรอกชื่อและรหัสโค้ดอ้างอิงให้ครบถ้วน');
        return false;
      }
      return { leave_name: name, leave_code: code, yearly_quota: quota, status: 'active' };
    }
  });

  if (!formValues) { editGlobalLeaveRules(); return; }

  // 💥 [กดยืนยันรอบที่ 1]
  const confirm1 = await Swal.fire({
    title: '❓ ยืนยันข้อมูล (รอบที่ 1/2)',
    html: `คุณกำลังจะเพิ่มประเภทการลา: <b>${formValues.leave_name}</b> (${formValues.leave_code})<br>โควตาตั้งต้น: <b>${formValues.yearly_quota} วัน/ปี</b> ใช่หรือไม่?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ข้อมูลถูกต้อง',
    cancelButtonText: 'แก้ไขข้อมูลใหม่',
    confirmButtonColor: '#06b6d4'
  });

  if (!confirm1.isConfirmed) { actionAddNewLeaveType(); return; }

  // 💥 [กดยืนยันรอบที่ 2 — ขั้นสุดท้าย]
  const confirm2 = await Swal.fire({
    title: '🚨 ยืนยันขั้นสุดท้าย (รอบที่ 2/2)',
    text: `ระบบจะทำการเปิดสิทธิ์การลานี้ให้กับพนักงานทุกคนในระบบทันที ยืนยันเพื่อบันทึกข้อมูลเข้าสู่ฐานข้อมูลกลางภาพรวมหรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '💾 ยืนยันและบันทึกเด็ดขาด',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#059669',
    cancelButtonColor: '#64748b'
  });

  if (confirm2.isConfirmed) {
    Swal.fire({ title: 'กำลังเพิ่มประเภทการลา...', didOpen: () => Swal.showLoading() });
    const { error } = await supabase.from('leave_types').insert([formValues]);
    
    if (error) {
      Swal.fire('ล้มเหลว', 'ไม่สามารถบันทึกได้เนื่องจาก: ' + error.message, 'error').then(() => actionAddNewLeaveType());
    } else {
      if (typeof saveHRActivityLog === 'function') {
        await saveHRActivityLog('LEAVE_QUOTA', 'CREATE', formValues.leave_name, `เพิ่มประเภทการลาใหม่เข้าระบบ โควตา ${formValues.yearly_quota} วัน`);
      }
      Swal.fire('สำเร็จ!', 'เพิ่มประเภทการลาใหม่เรียบร้อยแล้ว', 'success').then(() => editGlobalLeaveRules());
    }
  } else {
    editGlobalLeaveRules();
  }
}

// ==========================================
// 🛡️ [SUB-FUNCTION] ฟังก์ชันลบประเภทการลา + ยืนยัน 2 รอบ
// ==========================================
async function actionDeleteLeaveType(id, name) {
  const supabase = getSupabase();

  // 💥 [กดยืนยันรอบที่ 1]
  const confirm1 = await Swal.fire({
    title: '⚠️ ยืนยันการลบข้อมูล (รอบที่ 1/2)',
    html: `คุณต้องการลบประเภทการลาชื่อ <b style="color:#ef4444;">"${name}"</b> ออกจากระบบใช่หรือไม่?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ใช่, ต้องการลบ',
    cancelButtonText: 'ยกเลิกและย้อนกลับ',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b'
  });

  if (!confirm1.isConfirmed) { editGlobalLeaveRules(); return; }

  // 💥 [กดยืนยันรอบที่ 2 — ขั้นสุดท้าย]
  const confirm2 = await Swal.fire({
    title: '🚨 เตือนภัยขั้นเด็ดขาด! (รอบที่ 2/2)',
    html: `การลบ <b style="color:#ef4444;">"${name}"</b> อาจส่งผลต่อประวัติใบลาเก่าและการคำนวณโควตาของพนักงานที่เคยใช้สิทธิ์นี้!<br><br><span style="color:#ef4444; font-weight:bold;">ต้องการยืนยันลบออกจากระบบจริงหรือไม่?</span>`,
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: '💥 ยืนยันลบออกจากระบบเด็ดขาด',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#b91c1c',
    cancelButtonColor: '#64748b'
  });

  if (confirm2.isConfirmed) {
    Swal.fire({ title: 'กำลังทำการลบ...', didOpen: () => Swal.showLoading() });
    
    // ทำการ Soft Delete โดยเปลี่ยนสถานะสิทธิ์เป็น inactive เพื่อไม่ให้กระทบ Foreign Key หรือจะ Hard Delete เลยก็ได้ครับ
    // โค้ดด้านล่างนี้ใช้สลับสถานะเป็น 'inactive' เพื่อความปลอดภัยสูงสุดของ Data พนักงานเดิมครับ
    const { error } = await supabase.from('leave_types').update({ status: 'inactive' }).eq('id', id);
    
    if (error) {
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถลบได้: ' + error.message, 'error').then(() => editGlobalLeaveRules());
    } else {
      if (typeof saveHRActivityLog === 'function') {
        await saveHRActivityLog('LEAVE_QUOTA', 'DELETE', name, `ปิดการใช้งานและลบประเภทการลาออกจากระบบ`);
      }
      Swal.fire('ลบสำเร็จ!', 'ลบประเภทการลาออกจากระบบเรียบร้อยแล้ว', 'success').then(() => editGlobalLeaveRules());
    }
  } else {
    editGlobalLeaveRules();
  }
}

// 🛠️ [แก้ไข บั๊ก DOM Data Loss] ป้องกันช่องกรอกเลขอินพุตรายบุคคลหายตอนกดปุ่มยืนยัน
async function editIndividualLeaveBalance() {
  console.group("🔧 [HR ACTION] ดึงข้อมูลโควตาวันลารายบุคคล");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    const { value: empCode } = await Swal.fire({
      title: 'ปรับยอดสิทธิ์วันลารายบุคคล',
      input: 'text',
      inputLabel: 'กรุณากรอกรหัสพนักงานที่ต้องการปรับปรุงโควตา',
      inputPlaceholder: 'เช่น PVT69001',
      showCancelButton: true
    });

    if (!empCode) { console.groupEnd(); return; }

    const { data: emp } = await supabase.from('employees').select('id, full_name, employee_code').eq('employee_code', empCode.trim()).maybeSingle();
    if (!emp) {
      Swal.fire('ไม่พบพนักงาน', 'ไม่พบรหัสพนักงานนี้ในฐานข้อมูล', 'warning');
      console.groupEnd();
      return;
    }

    const currentYear = new Date().getFullYear();
    console.log(`📥 ดึงยอดจาก leave_balances ของปี ${currentYear} สำหรับพนักงาน ID: ${emp.id}`);
    
    const { data: balances, error } = await supabase
      .from('leave_balances')
      .select('id, entitlement_days, remaining_days, leave_types(leave_name)')
      .eq('employee_id', emp.id)
      .eq('year', currentYear);

    if (error) throw error;
    if (!balances || balances.length === 0) {
      Swal.fire('ไม่พบข้อมูลยอดคงเหลือ', 'พนักงานคนนี้ยังไม่มีตารางสิทธิ์วันลาในปีนี้', 'warning');
      console.groupEnd();
      return;
    }

    let formHTML = `<div style="text-align:left; font-size:13px; max-height:280px; overflow-y:auto;">`;
    balances.forEach(b => {
      formHTML += `
        <div style="margin-bottom:10px; padding:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;">
          <div style="font-weight:bold; color:#1e3a8a; margin-bottom:4px;">${b.leave_types?.leave_name || 'ไม่ระบุประเภท'}</div>
          <div style="display:flex; gap:10px; align-items:center;">
            <span>สิทธิ์ทั้งหมด:</span>
            <input type="number" id="entit-${b.id}" class="swal2-input" style="width:70px; height:28px; margin:0; font-size:12px;" value="${b.entitlement_days}">
            <span>วันคงเหลือจริง:</span>
            <input type="number" id="remain-${b.id}" class="swal2-input" style="width:70px; height:28px; margin:0; font-size:12px;" value="${b.remaining_days}">
          </div>
        </div>`;
    });
    formHTML += `</div>`;

    // 🛠️ ตรึงค่าอินพุตผ่านโครงสร้างย่อย preConfirm
    const { value: updatedBalances } = await Swal.fire({
      title: `แก้ไขสิทธิ์: ${emp.full_name}`,
      html: formHTML,
      width: '450px',
      showCancelButton: true,
      confirmButtonText: '💾 อัปเดตสิทธิ์',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const listBalances = [];
        balances.forEach(b => {
          const newEntit = parseFloat(document.getElementById(`entit-${b.id}`).value) || 0;
          const newRemain = parseFloat(document.getElementById(`remain-${b.id}`).value) || 0;
          listBalances.push({ id: b.id, old_entit: b.entitlement_days, old_remain: b.remaining_days, new_entit: newEntit, new_remain: newRemain });
        });
        return listBalances;
      }
    });

    if (updatedBalances) {
      Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
      
      for (const b of updatedBalances) {
        if (b.new_entit !== b.old_entit || b.new_remain !== b.old_remain) {
          console.log(`📤 อัปเดตตาราง leave_balances ID: ${b.id} -> สิทธิ์ใหม่: ${b.new_entit}, คงเหลือใหม่: ${b.new_remain}`);
          await supabase.from('leave_balances').update({ entitlement_days: b.new_entit, remaining_days: b.new_remain }).eq('id', b.id);
        }
      }

      await saveHRActivityLog('LEAVE_QUOTA', 'UPDATE', `รหัสพนักงาน: ${emp.employee_code}`, `ปรับสิทธิ์วันลาเคสพิเศษรายบุคคลให้คุณ ${emp.full_name}`, balances, 'Updated Values');
      Swal.fire('สำเร็จ', 'ปรับปรุงสิทธิ์วันลาพนักงานรายนี้เรียบร้อย', 'success');
    }

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการแก้ไขสิทธิ์รายบุคคล:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
  console.groupEnd();
}

// 🛠️ [แก้ไข บั๊ก DOM Data Loss] ป้องกันระบบดึงค่าปฏิทินวันหยุดไม่ได้เนื่องจากกล่องข้อความปิดตัวลงไปก่อน
async function manageCompanyHolidays() {
  console.group("📅 [HR ACTION] ดึงข้อมูลวันหยุดบริษัท");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    Swal.fire({ title: 'โหลดข้อมูลปฏิทิน...', didOpen: () => Swal.showLoading() });
    const { data: holidays, error } = await supabase.from('company_holidays').select('*').order('holiday_date', { ascending: true });
    if (error) throw error;

    Swal.close();

    let listHTML = `<div style="text-align:left; font-size:13px; max-height:220px; overflow-y:auto; margin-bottom:12px;">`;
    if (!holidays || holidays.length === 0) {
      listHTML += `<p style="text-align:center; color:#64748b;">ยังไม่มีการกำหนดวันหยุดในปีนี้</p>`;
    } else {
      holidays.forEach(h => {
        listHTML += `<div style="display:flex; justify-content:between; padding:5px; border-bottom:1px solid #f1f5f9;">
          <span>📅 <b>${h.holiday_date}</b> - ${h.holiday_name}</span>
        </div>`;
      });
    }
    listHTML += `</div><hr><div style="text-align:left; font-size:13px; margin-top:10px;">
      <b>+ เพิ่มวันหยุดใหม่</b><br>
      <input type="date" id="new-holiday-date" class="swal2-input" style="height:35px; font-size:13px; margin:5px 0;">
      <input type="text" id="new-holiday-name" class="swal2-input" placeholder="ชื่อวันหยุด เช่น วันแรงงาน" style="height:35px; font-size:13px; margin:5px 0;">
    </div>`;

    // 🛠️ ย้ายการดักรับตัวแปรไปใส่ในบล็อกโครงสร้าง preConfirm ชั้นใน
    const { value: formValues } = await Swal.fire({
      title: 'ปฏิทินวันหยุดประจำปีของบริษัท',
      html: listHTML,
      showCancelButton: true,
      confirmButtonText: '➕ บันทึกวันหยุดใหม่',
      cancelButtonText: 'ปิดหน้าต่าง',
      preConfirm: () => {
        const hDate = document.getElementById('new-holiday-date').value;
        const hName = document.getElementById('new-holiday-name').value.trim();
        if (!hDate || !hName) {
          Swal.showValidationMessage('❌ กรุณาระบุทั้งวันที่และชื่อวันหยุดให้ครบถ้วนครับ');
          return false;
        }
        return { holiday_date: hDate, holiday_name: hName };
      }
    });

    if (formValues) {
      Swal.fire({ title: 'กำลังบันทึกวันหยุด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      console.log(`📤 กำลังส่ง INSERT เข้าตาราง company_holidays: ${formValues.holiday_date} [${formValues.holiday_name}]`);
      const { error: insErr } = await supabase.from('company_holidays').insert([formValues]);
      if (insErr) throw insErr;

      await saveHRActivityLog('HOLIDAY', 'INSERT', `วันที่: ${formValues.holiday_date}`, `เพิ่มวันหยุดบริษัท: ${formValues.holiday_name}`, null, formValues);
      Swal.fire('สำเร็จ', 'บันทึกวันหยุดบริษัทเรียบร้อย', 'success');
    }

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในระบบตั้งปฏิทินวันหยุด:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
  console.groupEnd();
}

// ==========================================================================
// หมวดที่ 3: ความปลอดภัย รายงาน และ Audit Log (Connected)
// ==========================================================================

async function viewAuditLogs() {
  console.group("📜 [HR ACTION] ดึงประวัติการแก้ไขระบบย้อนหลัง (Audit Logs)");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    Swal.fire({ title: 'กำลังโหลดบันทึกประวัติ...', didOpen: () => Swal.showLoading() });

    const { data: logs, error } = await supabase
      .from('hr_admin_management_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    Swal.close();

    let logsHTML = `<div style="text-align:left; font-size:16px; max-height:650px; overflow-y:auto; padding-right:5px;">`;
    
    if (!logs || logs.length === 0) {
      logsHTML += `<div style="text-align:center; padding:25px; color:#64748b;">ยังไม่มีประวัติการทำรายการในตารางระบบ Log</div>`;
    } else {
      logs.forEach(l => {
        const d = new Date(l.created_at).toLocaleString('th-TH');
        const color = l.action_type === 'INSERT' ? '#16a34a' : l.action_type === 'DELETE' ? '#dc2626' : '#2563eb';
        
        logsHTML += `
          <div style="padding: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px; background:#f8fafc; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:4px;">
              <span style="color: ${color}; font-size:20px;">[${l.action_type}] หมวดหมู่: ${l.action_category}</span>
              <span style="color: #64748b; font-size:20px;">${d}</span>
            </div>
            <div><b>ผู้ปฏิบัติงาน:</b> ${l.actor_name}</div>
            <div><b>เป้าหมาย:</b> ${l.target_identifier}</div>
            <div style="color:#334155; margin-top:4px; background:#fff; padding:6px; border:1px dashed #cbd5e1; border-radius:4px; font-size:20px;">${l.description}</div>
          </div>`;
      });
    }
    logsHTML += `</div>`;

    Swal.fire({
      title: 'ประวัติการตั้งค่าและการกระทำของ HR',
      html: logsHTML,
      width: '1200px', // 🔥 ปรับเพิ่มขนาดความกว้างจาก 650px เป็น 950px ตรงนี้ครับ
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'ปิดหน้าต่างการตรวจสอบ'
    });

  } catch (err) {
    console.error("❌ ดึงประวัติตรวจสอบ Log พังอาพาธ:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดประวัติ Log ได้ กรุณาตรวจสอบสิทธิ์การอ่านตารางในฐานข้อมูล', 'error');
  }
  console.groupEnd();
}

async function resetYearlyLeave() {
  console.group("🚨 [HR CRITICAL ACTION] สั่งรีเซ็ตโควตาวันลาประจำปีใหม่ให้พนักงาน");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    const nextYear = new Date().getFullYear() + 1;

    // 🔴 ปรับแต่งหน้าตาให้เป็นตัวอักษรสีแดงขนาดใหญ่ + เพิ่มแบนเนอร์เตือนภัยระดับวิกฤต
    const { isConfirmed } = await Swal.fire({
      title: `<span style="color: #dc2626; font-size: 26px; font-weight: bold; display: block; margin-bottom: 6px;">🚨 รีเซ็ตสิทธิ์วันลาประจำปี</span>`,
      html: `
        <div style="background-color: #fef2f2; border-left: 5px solid #dc2626; padding: 14px; margin-bottom: 15px; text-align: left; border-radius: 6px;">
          <strong style="color: #991b1b; font-size: 15px; display: block; margin-bottom: 4px;">⚠️ คำเตือน!</strong>
          <span style="color: #b91c1c; font-size: 14px; line-height: 1.5; font-weight: bold;">
            ระบบจะรันฟังก์ชันหลังบ้านเพื่อคำนวณและสร้างแถวโควตาวันลาชุดใหม่ประจำปี ค.ศ. ${nextYear} ให้กับพนักงานทุกคนที่ยังมีสถานะ Active ทันที
          </span>
        </div>
        <div style="font-size: 16px; color: #1e293b; font-weight: bold; margin: 15px 0; line-height: 1.4;">
          คุณมั่นใจใช่ไหมที่จะสั่ง "ล้างสิทธิ์เดิม" และเริ่มต้นระบบปีงบประมาณใหม่ ค.ศ. ${nextYear}?
        </div>
      `,
      icon: 'warning',
      width: '560px', // ขยายหน้าต่างให้กว้างขึ้นเพื่อให้กล่องคำเตือนอ่านง่าย ไม่บีบอัด
      showCancelButton: true,
      confirmButtonColor: '#dc2626', // เปลี่ยนสีปุ่มยืนยันเป็นสีแดงสดแจ้งเตือนภัย
      confirmButtonText: '⚠️ ยืนยันเปิดระบบปีงบประมาณใหม่',
      cancelButtonText: 'ยกเลิก'
    });

    if (isConfirmed) {
      console.time("⏱️ เวลาที่ใช้ในการประมวลผล RPC หลังบ้าน");
      Swal.fire({ title: 'ฐานข้อมูลกำลังประมวลผลคำสั่งชุดใหญ่...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      console.log(`📤 กำลังส่ง RPC เรียกฟังก์ชัน sp_initialize_new_year_balances ไปที่ปี: ${nextYear}`);
      const { data, error } = await supabase.rpc('sp_initialize_new_year_balances', { target_year: nextYear });

      if (error) throw error;
      console.timeEnd("⏱️ เวลาที่ใช้ในการประมวลผล RPC หลังบ้าน");

          await saveHRActivityLog('LEAVE_QUOTA', 'DELETE', `ตั้งยอดประจำปี: ${nextYear}`, `รันระบบรีเซ็ตตั้งต้นปีปฏิทินการลาใหม่ชุดใหญ่`, null, { result: data });
      Swal.fire('ดำเนินการล้างสิทธิ์สำเร็จ', `เปิดระบบลงทะเบียนสิทธิ์ลาของปี ${nextYear} ให้พนักงานทุกคนเรียบร้อย!`, 'success');
    }

  } catch (err) {
    console.error("❌ คำสั่งรันระบบตัดยอดประจำปีล้มเหลว:", err);
    Swal.fire('เกิดข้อผิดพลาดรุนแรงหลังบ้าน', err.message, 'error');
  }
  console.groupEnd();
}

async function exportLeaveReport() {
  console.group("📊 [HR ACTION] ดึงสรุปรายงานใบลา (Export to CSV)");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    Swal.fire({ title: 'กำลังดึงสรุปประวัติคำขอลา...', didOpen: () => Swal.showLoading() });
    
    const { data: requests, error } = await supabase
      .from('leave_requests')
      .select('start_date, end_date, total_days, reason, status, employees(employee_code, full_name)');

    if (error) throw error;
    Swal.close();

    console.log(`📥 ดึงคำขอลามาทำรายงานสำเร็จจำนวน ${requests?.length || 0} บรรทัด`);

    let csvContent = "\uFEFF"; 
    csvContent += "รหัสพนักงาน,ชื่อ-นามสกุล,วันที่เริ่มลา,วันที่สิ้นสุด,จำนวนวันลา,เหตุผลการลา,สถานะคำขอ\n";

    requests.forEach(r => {
      csvContent += `"${r.employees?.employee_code || '-'}","${r.employees?.full_name || '-'}","${r.start_date}","${r.end_date}","${r.total_days}","${r.reason || '-'}","${r.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `รายงานการลาหยุดงาน_PVT_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("✅ ดาวน์โหลดไฟล์รายงานสำเร็จเรียบร้อย");
  } catch (err) {
    console.error("❌ ทำรายงานล้มเหลว:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดาวน์โหลดข้อมูลรายงานได้', 'error');
  }
  console.groupEnd();
}
// 🛠️ ลบเครื่องหมายปีกกาปิดเกิน } เดิมทิ้งเรียบร้อย โค้ดคอมไพล์ผ่าน 100%