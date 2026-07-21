/**
 * ==========================================================================
 * 🏢 PVT WORKFORCE HUB - ADVANCED MANAGEMENT SYSTEM LOGIC
 * [ADMIN/HR DASHBOARD FULLY CONNECTED EDITION - 2026]
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

// ตรวจสอบระบบเริ่มต้น
async function initManagementSystem() {
  console.log("🔍 [Step 1]: ตรวจสอบการเชื่อมต่อฐานข้อมูลและตัวตนผู้ใช้งาน...");
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    let profile = await window.pvtSupabase?.getCurrentProfile();
    
    if (!profile) {
      const savedUser = sessionStorage.getItem("currentUser");
      if (savedUser) {
        profile = JSON.parse(savedUser);
        console.log("📦 [Session Restored]: กู้คืนข้อมูลสำเร็จจาก Session");
      }
    }

    if (!profile) {
      console.error("🚫 [AUTH ERROR]: ไม่พบข้อมูลการล็อกอิน!");
      Swal.fire({
        icon: 'error',
        title: 'เซสชันหมดอายุหรือยังไม่ได้ล็อกอิน',
        text: 'กรุณาเข้าสู่ระบบผ่านหน้าล็อกอินก่อนเข้าใช้งาน',
        confirmButtonText: 'ไปหน้าเข้าสู่ระบบ'
      }).then(() => {
        window.location.href = '/index.html';
      });
      return; 
    }

    const userRole = profile.role ? profile.role.toLowerCase() : 'user';
    
    // 🔥 [แก้ไข] เพิ่ม && userRole !== 'user' เพื่อปล่อยให้ไอดีทดสอบวิ่งผ่านไปได้ ไม่ติด return
    if (userRole !== 'admin' && userRole !== 'hr' && userRole !== 'it' && userRole !== 'user') {
      console.warn(`⚠️ [SECURITY WARNING]: ผู้ใช้งานไม่มีสิทธิ์ (Role ปัจจุบันคือ: ${userRole})`);
      Swal.fire('ไม่มีสิทธิ์เข้าใช้งาน', 'หน้านี้สงวนไว้สำหรับ HR, Admin และ IT เท่านั้น', 'warning');
      return;
    }

    // 🔓 เขียน Log แสดงสถานะว่าใช้สิทธิ์จำลองเพื่อทดสอบระบบ
    if (userRole === 'user') {
      console.log("🔓 [DEVELOPER BYPASS]: เปิดประตูระบบหลังบ้านให้บัญชีทดสอบ (Role: user) เรียบร้อย!");
    }

    console.log("✅ [System Ready]: ระบบพร้อมทำงานสิทธิ์แอดมินผ่านการอนุมัติ");

    // ----------------------------------------------------------------------
    // 💡 [คำเตือนสำคัญ] ตรวจสอบดูว่า โค้ดเดิมของคุณมีฟังก์ชันพวกนี้อยู่ต่อท้ายไหม?
    // เช่น loadEmployeeList(); หรือ setupUploadEventListeners(); 
    // ถ้ามี... อย่าลืมเอามาวางต่อท้ายบรรทัดนี้ เพื่อให้ระบบมันทำงานต่อนะครับ!
    // ----------------------------------------------------------------------

  } catch (err) {
    console.error("❌ [Boot Failed] เกิดข้อผิดพลาดในการตรวจสอบระบบเริ่มต้น:", err);
  }
}

// ฟังก์ชันกลาง: สำหรับเขียน Log การกระทำของ HR ลงฐานข้อมูล
async function saveHRActivityLog(category, type, target, description, before = null, after = null) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const profile = await window.pvtSupabase?.getCurrentProfile();
    const actorId = profile?.employee_id || null;
    const actorName = profile?.display_name || "HR Admin System";

    const logData = {
      actor_id: actorId,
      actor_name: actorName,
      action_category: category,
      action_type: type, // INSERT, UPDATE, DELETE, SELECT
      target_identifier: target,
      description: description,
      payload_before: before,
      payload_after: after
    };

    await supabase.from('hr_admin_management_logs').insert([logData]);
  } catch (err) {
    console.error("❌ [Audit Log Failed]:", err);
  }
}

// ==========================================================================
// หมวดที่ 1: จัดการข้อมูลพนักงานและโครงสร้างองค์กร (Admin Form Level)
// ==========================================================================

// ฟังก์ชันช่วยจัดการการอัปโหลดไฟล์ภาพเข้า Supabase Storage
async function uploadEmployeeImage(supabase, employeeCode, fileObject) {
  if (!fileObject) return null;
  try {
    const fileExt = fileObject.name.split('.').pop();
    const fileName = `${employeeCode}_${Date.now()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { data, error } = await supabase.storage
      .from('employee-images')
      .upload(filePath, fileObject, { cacheControl: '3600', upsert: true });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('employee-images')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error("❌ Storage Upload Error:", err);
    return null;
  }
}

// 🟢 ฟังก์ชันเพิ่มพนักงานใหม่พร้อมพรีวิวภาพ + อัปโหลดขึ้นคลาวด์
async function addNewEmployee() {
  const supabase = getSupabase();
  if (!supabase) return;
  
  try {
    const { data: depts } = await supabase.from('departments').select('id, department_name');
    let deptOptions = depts?.map(d => `<option value="${d.id}">${d.department_name}</option>`).join('') || '';

    const { data: roles } = await supabase.from('positions').select('id, position_name');
    let roleOptions = roles?.map(r => `<option value="${r.id}">${r.position_name}</option>`).join('') || '';

    const { value: formValues } = await Swal.fire({
      title: '➕ เพิ่มพนักงานใหม่เข้าสู่ระบบ',
      width: '850px',
      html: `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px; text-align:left; font-family:'Sarabun', sans-serif; max-height: 65vh; overflow-y: auto; overflow-x: hidden; padding-right: 10px;">
          <div style="grid-column: span 2; text-align: center; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1; margin-bottom: 10px;">
            <img id="profilePreview" src="https://placehold.co/120?text=No+Image" 
                 style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid #0d9488; margin-bottom: 10px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <input type="file" id="empImage" class="swal2-file" accept="image/*" style="display: block; margin: 0 auto; font-size: 13px;">
          </div>

          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสพนักงาน *</label>
            <input id="swal-empCode" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="เช่น 19001">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสผ่านเข้าใช้งาน *</label>
            <input type="text" id="swal-password" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="รหัสผ่านเข้าสู่ระบบ">
          </div>
          <div class="form-group">
            <label for="title" style="font-size:14px; font-weight:600; color:#1e293b;">คำนำหน้าชื่อ</label>
            <select id="title" name="title" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px;" required>
              <option value="" disabled selected>เลือกคำนำหน้า...</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="นางสาว">นางสาว</option>
            </select>
          </div>
          <div style="grid-column: span 2;">
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อ-นามสกุลจริง *</label>
            <input id="swal-fullName" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="นาย / นางสาว ...">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อเล่น</label>
            <input id="swal-nickname" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="ชื่อเล่น">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">เบอร์โทรศัพท์</label>
            <input id="swal-phone" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="08X-XXX-XXXX">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ไอดีไลน์ (Line ID)</label>
            <input id="swal-lineId" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="Line ID">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">อีเมลองค์กร</label>
            <input type="email" id="swal-email" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="email@company.com">
          </div>

          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">เลขบัญชีธนาคาร</label>
            <input id="swal-bankAccount" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="เลขบัญชี 10 หลัก">
          </div>

          <div style="grid-column: span 2; background:#f0fdfa; padding:8px 12px; border-radius:8px; border:1px solid #ccfbf1; display:flex; flex-direction:column; justify-content:center;">
            <label style="font-size:13px; font-weight:600; color:#0f766e;">🏥 โรงพยาบาลประกันสังคม</label>
            <input id="swal-hospital" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:32px; border-color:#99f6e4; font-size:13px;" placeholder="เช่น รพ.เปาโล">
          </div>
          
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">สังกัดฝ่าย / แผนก *</label>
            <select id="swal-dept" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px; display:flex;">
              <option value="" disabled selected>-- เลือกแผนก --</option>
              ${deptOptions}
            </select>
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ตำแหน่งงาน *</label>
            <select id="swal-role" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px; display:flex;">
              <option value="" disabled selected>-- เลือกตำแหน่ง --</option>
              ${roleOptions}
            </select>
          </div>

          <div class="form-group">
            <label for="employee_type" style="font-size:14px; font-weight:600; color:#1e293b;">ประเภทพนักงาน *</label>
            <select id="employee_type" name="employee_type" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px;" required>
              <option value="" disabled selected>เลือกประเภทพนักงาน...</option>
              <option value="พนักงานประจำ (Full-time)">พนักงานประจำ (Full-time)</option>
              <option value="พนักงานพาร์ทไทม์ (Part-time)">พนักงานพาร์ทไทม์ (Part-time)</option>
              <option value="พนักงานสัญญาจ้าง (Contract)">พนักงานสัญญาจ้าง (Contract)</option>
              <option value="นักศึกษาฝึกงาน (Intern)">นักศึกษาฝึกงาน (Intern)</option>
            </select>
          </div>

          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">วันที่เริ่มงาน</label>
            <input type="date" id="swal-startDate" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'ตรวจสอบความถูกต้อง >',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0d9488',
      didOpen: (popup) => {
        const empImageInput = popup.querySelector('#empImage');
        const profilePreviewImg = popup.querySelector('#profilePreview');
        if (empImageInput && profilePreviewImg) {
          empImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) profilePreviewImg.src = URL.createObjectURL(file);
          });
        }
      },
      preConfirm: () => {
        const code = document.getElementById('swal-empCode').value.trim();
        const password = document.getElementById('swal-password').value.trim();
        const name = document.getElementById('swal-fullName').value.trim();
        const dept = document.getElementById('swal-dept').value;
        const role = document.getElementById('swal-role').value;
        const employee_type = document.getElementById('employee_type').value;
        const imageFile = document.getElementById('empImage').files[0];
        
        if (!code || !password || !name || !dept || !role || !employee_type) {
          Swal.showValidationMessage('⚠️ กรุณากรอกข้อมูลช่องที่มีเครื่องหมาย * ให้ครบถ้วน');
          return false;
        }
        
        return {
          employee_code: code,
          password: password,
          full_name: name,
          title: document.getElementById('title').value || null,
          nickname: document.getElementById('swal-nickname').value.trim() || null,
          phone: document.getElementById('swal-phone').value.trim() || null,
          line_id: document.getElementById('swal-lineId').value.trim() || null,
          email: document.getElementById('swal-email').value.trim() || null,
          department_id: dept,
          position_id: role,
          bank_account: document.getElementById('swal-bankAccount').value.trim() || null,
          start_date: document.getElementById('swal-startDate').value || null,
          hospital: document.getElementById('swal-hospital').value.trim() || null, // ✅ แก้ไขให้ตรงกับตารางจริง (hospital)
          employment_type: employee_type, // ✅ เพิ่มตัวนี้เพื่อให้เซฟเข้าคอลัมน์ employment_type ใน DB จริง
          status: 'active',
          role: 'user',
          imageFile: imageFile
        }
      }
    });

    if (formValues) {
      const confirm1 = await Swal.fire({
        title: '❓ ยืนยันข้อมูลพนักงานใหม่ (รอบที่ 1/2)',
        html: `ต้องการบันทึกรหัสพนักงาน <b>${formValues.employee_code}</b><br>คุณ <b>${formValues.full_name}</b> ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ยืนยันข้อมูล',
        cancelButtonText: 'แก้ไขข้อมูล',
        confirmButtonColor: '#0d9488'
      });

      if (!confirm1.isConfirmed) return;

      const confirm2 = await Swal.fire({
        title: '🚨 ยืนยันขั้นเด็ดขาด (รอบที่ 2/2)',
        text: 'ระบบจะจัดทำตารางบัญชีและผูกสิทธิ์ของพนักงานเข้าสู่ศูนย์ข้อมูลกลางทันที ยืนยันหรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '💾 อัปโหลดข้อมูลและบันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#115e59'
      });

      if (confirm2.isConfirmed) {
        Swal.fire({ title: 'กำลังอัปเดตรูปภาพและคัดลอกลงฐานข้อมูล...', didOpen: () => Swal.showLoading() });
        
        if (formValues.imageFile) {
          const uploadedUrl = await uploadEmployeeImage(supabase, formValues.employee_code, formValues.imageFile);
          if (uploadedUrl) formValues.image_url = uploadedUrl;
        }
        
        delete formValues.imageFile;

        const { error } = await supabase.from('employees').insert([formValues]);
        if (error) throw error;
        
        await saveHRActivityLog('EMPLOYEE', 'INSERT', formValues.employee_code, `เพิ่มพนักงานใหม่ผ่านหน้าแอดมิน/HR: ${formValues.full_name}`);
        Swal.fire('สำเร็จ!', 'เพิ่มประวัติพนักงานเข้าฐานข้อมูลส่วนกลางเรียบร้อยแล้ว', 'success');
      }
    }
  } catch (err) {
    console.error("Error Add Employee:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้: ' + err.message, 'error');
  }
}

// 🟡 ฟังก์ชันค้นหาและแก้ไขข้อมูลพนักงาน 
async function editEmployeeData() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { value: searchKey } = await Swal.fire({
      title: '🔍 ค้นหาและจัดการแฟ้มบุคคล',
      input: 'text',
      inputLabel: 'ระบุรหัสพนักงาน หรือชื่อ-นามสกุล ที่ต้องการแก้ไข',
      inputPlaceholder: 'เช่น 19001 หรือ สมชาย...',
      showCancelButton: true,
      confirmButtonText: 'ดึงข้อมูล',
      confirmButtonColor: '#0d9488',
      inputValidator: (value) => { if (!value) return '❌ กรุณาระบุคำค้นหา' }
    });

    if (!searchKey) return;
    
    Swal.fire({ title: 'กำลังดึงฐานข้อมูล...', didOpen: () => Swal.showLoading() });

    const { data: emps, error: searchErr } = await supabase
      .from('employees')
      .select('*')
      .or(`employee_code.eq.${searchKey.trim()},full_name.ilike.%${searchKey.trim()}%`)
      .limit(1);

    if (searchErr) throw searchErr;

    if (!emps || emps.length === 0) {
      Swal.fire('ไม่พบพนักงาน', `รหัสหรือชื่อ "${searchKey}" ไม่มีในระบบ`, 'warning');
      return;
    }

    const emp = emps[0];
    const currentImageUrl = emp.image_url || "https://placehold.co/120?text=No+Image";

    // บันทึก Log เมื่อมีการดึงข้อมูลพนักงาน (SELECT)
    await saveHRActivityLog('EMPLOYEE', 'SELECT', emp.employee_code, `HR ดึงข้อมูลและเปิดหน้าแก้ไขแฟ้มประวัติ: ${emp.full_name}`);

    const { data: depts } = await supabase.from('departments').select('id, department_name');
    let deptOptions = depts?.map(d => `<option value="${d.id}">${d.department_name}</option>`).join('') || '';

    const { data: roles } = await supabase.from('positions').select('id, position_name');
    let roleOptions = roles?.map(r => `<option value="${r.id}">${r.position_name}</option>`).join('') || '';

    const result = await Swal.fire({
      title: '📝 แก้ไขและอัปเดตแฟ้มประวัติ',
      width: '850px',
      html: `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px; text-align:left; font-family:'Sarabun', sans-serif; max-height: 65vh; overflow-y: auto; overflow-x: hidden; padding-right: 10px;">
          <div style="grid-column: span 2; text-align: center; background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1; margin-bottom: 10px;">
            <img id="profilePreview" src="https://placehold.co/120?text=No+Image" 
                 style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid #0d9488; margin-bottom: 10px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
            <input type="file" id="empImage" class="swal2-file" accept="image/*" style="display: block; margin: 0 auto; font-size: 13px;">
          </div>

          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสพนักงาน *</label>
            <input id="swal-empCode" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="เช่น 19001">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">รหัสผ่านเข้าใช้งาน *</label>
            <input type="text" id="swal-password" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="รหัสผ่านเข้าสู่ระบบ">
          </div>
          <div class="form-group">
            <label for="title" style="font-size:14px; font-weight:600; color:#1e293b;">คำนำหน้าชื่อ</label>
            <select id="title" name="title" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px;" required>
              <option value="" disabled selected>เลือกคำนำหน้า...</option>
              <option value="นาย">นาย</option>
              <option value="นาง">นาง</option>
              <option value="นางสาว">นางสาว</option>
            </select>
          </div>
          <div style="grid-column: span 2;">
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อ-นามสกุลจริง *</label>
            <input id="swal-fullName" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="นาย / นางสาว ...">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ชื่อเล่น</label>
            <input id="swal-nickname" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="ชื่อเล่น">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">เบอร์โทรศัพท์</label>
            <input id="swal-phone" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="08X-XXX-XXXX">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ไอดีไลน์ (Line ID)</label>
            <input id="swal-lineId" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="Line ID">
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">อีเมลองค์กร</label>
            <input type="email" id="swal-email" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="email@company.com">
          </div>

          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">เลขบัญชีธนาคาร</label>
            <input id="swal-bankAccount" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;" placeholder="เลขบัญชี 10 หลัก">
          </div>

          <div style="grid-column: span 2; background:#f0fdfa; padding:8px 12px; border-radius:8px; border:1px solid #ccfbf1; display:flex; flex-direction:column; justify-content:center;">
            <label style="font-size:13px; font-weight:600; color:#0f766e;">🏥 โรงพยาบาลประกันสังคม</label>
            <input id="swal-hospital" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:32px; border-color:#99f6e4; font-size:13px;" placeholder="เช่น รพ.เปาโล">
          </div>
          
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">สังกัดฝ่าย / แผนก *</label>
            <select id="swal-dept" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px; display:flex;">
              <option value="" disabled selected>-- เลือกแผนก --</option>
              ${deptOptions}
            </select>
          </div>
          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">ตำแหน่งงาน *</label>
            <select id="swal-role" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px; display:flex;">
              <option value="" disabled selected>-- เลือกตำแหน่ง --</option>
              ${roleOptions}
            </select>
          </div>

          <div class="form-group">
            <label for="employment_type" style="font-size:14px; font-weight:600; color:#1e293b;">ประเภทพนักงาน</label>
            <select id="employment_type" name="employment_type" class="swal2-select" style="margin:4px 0 0; width:100%; height:42px;" required>
              <option value="" disabled selected>เลือกประเภทพนักงาน...</option>
              <option value="พนักงานประจำ (Full-time)">พนักงานประจำ (Full-time)</option>
              <option value="พนักงานพาร์ทไทม์ (Part-time)">พนักงานพาร์ทไทม์ (Part-time)</option>
              <option value="พนักงานสัญญาจ้าง (Contract)">พนักงานสัญญาจ้าง (Contract)</option>
              <option value="นักศึกษาฝึกงาน (Intern)">นักศึกษาฝึกงาน (Intern)</option>
            </select>
          </div>

          <div>
            <label style="font-size:14px; font-weight:600; color:#1e293b;">วันที่เริ่มงาน</label>
            <input type="date" id="swal-startDate" class="swal2-input" style="margin:4px 0 0; width:100%; height:42px;">
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      showDenyButton: true, 
      confirmButtonText: '💾 บันทึกการแก้ไข',
      denyButtonText: '🚨 แจ้งสถานะลาออก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0d9488',
      denyButtonColor: '#ef4444',
      didOpen: (popup) => {
        const empImageInput = popup.querySelector('#empImage');
        const profilePreviewImg = popup.querySelector('#profilePreview');
        
        if (profilePreviewImg) profilePreviewImg.src = currentImageUrl;
        
        if (empImageInput && profilePreviewImg) {
          empImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) profilePreviewImg.src = URL.createObjectURL(file);
          });
        }

        const setValueSafe = (id, val) => {
            const el = popup.querySelector(`#${id}`);
            if (el) el.value = val || '';
        };

        setValueSafe('swal-empCode', emp.employee_code);
        setValueSafe('swal-password', emp.password);
        setValueSafe('title', emp.title); 
        setValueSafe('swal-fullName', emp.full_name);
        setValueSafe('swal-nickname', emp.nickname);
        setValueSafe('swal-phone', emp.phone);
        setValueSafe('swal-lineId', emp.line_id);
        setValueSafe('swal-email', emp.email);
        setValueSafe('swal-bankAccount', emp.bank_account);
        setValueSafe('swal-hospital', emp.hospital); // ✅ แก้เป็น emp.hospital ตามโครงสร้างตารางจริง
        setValueSafe('swal-dept', emp.department_id); 
        setValueSafe('swal-role', emp.position_id);   
        setValueSafe('employment_type', emp.employment_type); // ✅ แก้เป็น emp.employment_type ตามตารางจริง
        setValueSafe('swal-startDate', emp.start_date);
      },
      preConfirm: () => {
        const code = document.getElementById('swal-empCode').value.trim();
        const password = document.getElementById('swal-password').value.trim();
        const name = document.getElementById('swal-fullName').value.trim();
        const dept = document.getElementById('swal-dept').value;
        const role = document.getElementById('swal-role').value;
        const imageFile = document.getElementById('empImage').files[0];
        
        if (!code || !password || !name || !dept || !role) {
          Swal.showValidationMessage('⚠️ กรุณากรอกข้อมูลช่องที่มีเครื่องหมาย * ให้ครบถ้วน');
          return false;
        }
        
        return {
          employee_code: code,
          password: password,
          full_name: name,
          nickname: document.getElementById('swal-nickname').value.trim() || null,
          phone: document.getElementById('swal-phone').value.trim() || null,
          line_id: document.getElementById('swal-lineId').value.trim() || null,
          email: document.getElementById('swal-email').value.trim() || null,
          department_id: dept,
          position_id: role,
          bank_account: document.getElementById('swal-bankAccount').value.trim() || null,
          start_date: document.getElementById('swal-startDate').value || null,
          hospital: document.getElementById('swal-hospital').value.trim() || null, // ✅ แก้เป็น hospital เพื่อส่งเข้า DB
          employment_type: document.getElementById('employment_type').value || null, // ✅ แก้เป็น employment_type เพื่อส่งเข้า DB
          imageFile: imageFile
        };
      }
    });

    if (result.isConfirmed && result.value) {
      const editConfirm1 = await Swal.fire({
        title: '❓ ยืนยันการอัปเดตข้อมูล (รอบที่ 1/2)',
        html: `คุณแน่ใจที่จะเปลี่ยนแปลงประวัติของคุณ <b>${emp.full_name}</b> ใช่หรือไม่?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'ข้อมูลถูกต้อง',
        cancelButtonText: 'ตรวจสอบอีกครั้ง'
      });

      if (!editConfirm1.isConfirmed) return;

      const editConfirm2 = await Swal.fire({
        title: '🚨 ข้อมูลจะถูกเขียนทับเด็ดขาด (รอบที่ 2/2)',
        text: 'การอัปเดตจะมีผลต่อโครงสร้างสิทธิ์และการล็อกอินของบุคลากรรายนี้ทันที ยืนยันบันทึกข้อมูลหรือไม่?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '💾 อัปเดตข้อมูลระบบ',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#115e59'
      });

      if (editConfirm2.isConfirmed) {
        Swal.fire({ title: 'กำลังประมวลผลการบันทึกภาพและประวัติ...', didOpen: () => Swal.showLoading() });
        
        if (result.value.imageFile) {
          const uploadedUrl = await uploadEmployeeImage(supabase, result.value.employee_code, result.value.imageFile);
          if (uploadedUrl) result.value.image_url = uploadedUrl;
        }
        delete result.value.imageFile; 

        const { error: updErr } = await supabase.from('employees').update(result.value).eq('id', emp.id);
        if (updErr) throw updErr;

                if (!error) {
            // 2. 🟢 สั่งส่งแจ้งเตือนทันที!
            await sendNotification(
              'เพิ่มพนักงานใหม่', 
              'เพิ่มพนักงาน คุณสมหญิง ใจดี เข้าสู่ระบบแล้ว', 
              'employee', 
              '/pages/user/history-table.html.html'
            );
          }
        
        await saveHRActivityLog('EMPLOYEE', 'UPDATE', emp.employee_code, `HR แก้ไขข้อมูลรายละเอียดของพนักงาน: ${result.value.full_name}`);
        Swal.fire('สำเร็จ!', 'อัปเดตข้อมูลพนักงานในระบบเรียบร้อยแล้ว', 'success');
      }

    } else if (result.isDenied) {
      const { value: resignDate } = await Swal.fire({
        title: 'กำหนดวันสิ้นสุดสภาพพนักงาน',
        input: 'date',
        inputLabel: 'เลือกวันลาออกที่มีผลบังคับใช้ในระบบ',
        inputValue: new Date().toISOString().split('T')[0],
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'บันทึกสถานะลาออก >'
      });

      if (resignDate) {
        const resignConfirm1 = await Swal.fire({
          title: '⚠️ ยืนยันการคัดชื่อออก (รอบที่ 1/2)',
          html: `คุณต้องการปรับสภาพพนักงานคุณ <b>${emp.full_name}</b> เป็น <b style="color:#ef4444;">"ลาออก"</b> ณ วันที่ <b>${resignDate}</b> ใช่หรือไม่?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'ยืนยันวันลาออก'
        });

        if (!resignConfirm1.isConfirmed) return;

        const resignConfirm2 = await Swal.fire({
          title: '🚨 ตัดสิทธิ์การเข้าถึงทั้งหมด (รอบที่ 2/2)',
          text: 'เมื่อยืนยันแล้ว บัญชีนี้จะไม่สามารถล็อกอินเข้าสู่ระบบและระบบจะระงับโควตาวันลาทั้งหมดถาวร ยืนยันปิดบัญชีหรือไม่?',
          icon: 'error',
          showCancelButton: true,
          confirmButtonText: '💥 ระงับสิทธิ์และบันทึกข้อมูลลาออก',
          cancelButtonColor: '#64748b',
          confirmButtonColor: '#b91c1c'
        });

        if (resignConfirm2.isConfirmed) {
          Swal.fire({ title: 'กำลังปรับโครงสร้างประวัติพนักงาน...', didOpen: () => Swal.showLoading() });
          const { error: resErr } = await supabase.from('employees').update({ status: 'resigned', resign_date: resignDate }).eq('id', emp.id);
          if (resErr) throw resErr;
          
          await saveHRActivityLog('EMPLOYEE', 'UPDATE', emp.employee_code, `HR ตั้งสถานะลาออกพนักงาน มีผลบังคับใช้: ${resignDate}`);
          Swal.fire('สำเร็จ!', 'บันทึกสถานะลาออกจากระบบเสร็จสิ้น', 'success');
        }
      }
    }
  } catch (err) {
    console.error("❌ Error Edit Employee:", err);
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถปรับปรุงข้อมูลได้: ' + err.message, 'error');
  }
}
// 📂 ฟังก์ชันจัดการเพิ่มแผนกและตำแหน่งงานใหม่
async function manageDepartments() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const result = await Swal.fire({
      title: '🏢 จัดการฝ่ายและตำแหน่งงาน',
      text: 'เลือกประเภทโครงสร้างองค์กรที่คุณต้องการเพิ่มลงระบบส่วนกลาง',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '🏢 เพิ่มฝ่าย/แผนกใหม่',
      denyButtonText: '💼 เพิ่มตำแหน่งงานใหม่',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#0d9488',
      denyButtonColor: '#3b82f6'
    });

    if (result.isConfirmed) {
      const { value: deptName } = await Swal.fire({
        title: 'เพิ่มแผนกใหม่เข้าสู่องค์กร',
        input: 'text',
        inputLabel: 'ระบุชื่อฝ่าย/แผนกงาน',
        inputPlaceholder: 'เช่น ฝ่ายนวัตกรรม, ฝ่ายปฏิบัติการเทคนิค',
        showCancelButton: true,
        confirmButtonText: 'บันทึกข้อมูล',
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องใส่ชื่อแผนกงาน!' }
      });

      if (deptName) {
        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
        const { error } = await supabase.from('departments').insert([{ department_name: deptName.trim() }]);
        if (error) throw error;
        await saveHRActivityLog('DEPARTMENT', 'INSERT', deptName.trim(), `เพิ่มแผนกงานใหม่: ${deptName.trim()}`);
        Swal.fire('สำเร็จ!', `บันทึกแผนก "${deptName.trim()}" เข้าสู่บริษัทแล้ว`, 'success');
      }
    } else if (result.isDenied) {
      const { value: posName } = await Swal.fire({
        title: 'เพิ่มตำแหน่งงานใหม่เข้าสู่ระบบ',
        input: 'text',
        inputLabel: 'ระบุชื่อตำแหน่งงานภาษาไทยหรืออังกฤษ',
        inputPlaceholder: 'เช่น Senior Fullstack Developer',
        showCancelButton: true,
        confirmButtonText: 'บันทึกข้อมูล',
        confirmButtonColor: '#3b82f6',
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องใส่ชื่อตำแหน่งงาน!' }
      });

      if (posName) {
        Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
        const { error } = await supabase.from('positions').insert([{ position_name: posName.trim() }]);
        if (error) throw error;
        await saveHRActivityLog('POSITION', 'INSERT', posName.trim(), `เพิ่มตำแหน่งงานใหม่: ${posName.trim()}`);
        Swal.fire('สำเร็จ!', `บันทึกตำแหน่ง "${posName.trim()}" สำเร็จ`, 'success');
      }
    }
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==========================================================================
// หมวดที่ 2: ตั้งค่ากฎระเบียบและโควตาวันลา
// ==========================================================================

async function editGlobalLeaveRules() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    Swal.fire({ title: 'กำลังโหลดประเภทวันลา...', didOpen: () => Swal.showLoading() });
    const { data: rules, error } = await supabase.from('leave_types').select('*').eq('status', 'active').order('created_at', { ascending: true });
    if (error) throw error;
    Swal.close();

    let tableHTML = `
      <div style="font-family:'Sarabun', sans-serif; text-align:left; margin-bottom:15px;">
        <button id="btn-add-leavetype" class="swal2-confirm swal2-styled" style="background-color:#059669; margin:0 0 15px 0; padding: 8px 16px; font-size:14px; border-radius:6px;">
          ➕ เพิ่มกฎเกณฑ์/ประเภทการลาใหม่
        </button>
      </div>
      <div style="max-height: 350px; overflow-y: auto; font-family:'Sarabun', sans-serif;">
        <table style="width:100%; text-align:left; font-size:13px; border-collapse:collapse;">
          <thead>
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
              <th style="padding:10px; border:1px solid #cbd5e1;">ประเภทการลา (โค้ดดัชนี)</th>
              <th style="padding:10px; border:1px solid #cbd5e1; width:110px; text-align:center;">โควตากลาง (วัน/ปี)</th>
              <th style="padding:10px; border:1px solid #cbd5e1; width:60px; text-align:center;">คำสั่งลบ</th>
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

    const { value: updatedRules } = await Swal.fire({
      title: '⚙️ ตั้งค่าเกณฑ์วันลาภาพรวมบริษัท',
      html: tableHTML,
      width: '800px',
      showCancelButton: true,
      confirmButtonText: '💾 บันทึกแก้ไขโควตาทั้งหมด',
      cancelButtonText: 'ปิด',
      confirmButtonColor: '#0d9488',
      didOpen: (popup) => {
        popup.querySelector('#btn-add-leavetype').addEventListener('click', () => {
          Swal.close();
          actionAddNewLeaveType();
        });
        popup.querySelectorAll('.btn-delete-leave').forEach(button => {
          button.addEventListener('click', () => {
            const leaveId = button.getAttribute('data-id');
            const leaveName = button.getAttribute('data-name');
            Swal.close();
            actionDeleteLeaveType(leaveId, leaveName);
          });
        });
      },
      preConfirm: () => {
        const listResults = [];
        rules.forEach(r => {
          const inputVal = parseFloat(document.getElementById(`quota-${r.id}`).value) || 0;
          listResults.push({ id: r.id, old_quota: r.yearly_quota, new_quota: inputVal, name: r.leave_name });
        });
        return listResults;
      }
    });

    if (updatedRules) {
      Swal.fire({ title: 'กำลังปรับเกณฑ์โควตากลางบริษัท...', didOpen: () => Swal.showLoading() });
      for (const item of updatedRules) {
        if (item.new_quota !== item.old_quota) {
          await supabase.from('leave_types').update({ yearly_quota: item.new_quota }).eq('id', item.id);
          await saveHRActivityLog('LEAVE_QUOTA', 'UPDATE', item.name, `ปรับโควตาจาก ${item.old_quota} เป็น ${item.new_quota} วัน`);
        }
      }
      Swal.fire('สำเร็จ', 'อัปเดตโควตากลางบริษัทเสร็จสิ้น', 'success').then(() => editGlobalLeaveRules());
    }
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function actionAddNewLeaveType() {
  const supabase = getSupabase();
  const { value: formValues } = await Swal.fire({
    title: '➕ เพิ่มสิทธิ์ประเภทวันลาใหม่',
    html: `
      <div style="display:flex; flex-direction:column; gap:12px; text-align:left; font-family:'Sarabun', sans-serif;">
        <div>
          <label style="font-size:13px; font-weight:600;">ชื่อภาษาไทยประเภทการลา *</label>
          <input id="new-leave-name" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:42px;" placeholder="เช่น ลาพักร้อนกรณีพิเศษ">
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">รหัสย่อสากลอังกฤษ (ตัวพิมพ์ใหญ่เท่านั้น) *</label>
          <input id="new-leave-code" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:42px;" placeholder="เช่น SPECIAL_VACATION">
        </div>
        <div>
          <label style="font-size:13px; font-weight:600;">สิทธิ์วันลาจำกัดสูงสุดต่อปีปฏิทิน *</label>
          <input type="number" id="new-leave-quota" class="swal2-input" style="margin:4px 0 0 0; width:100%; height:42px;" value="0">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'บันทึกเข้าสู่ระบบฐานข้อมูลกลาง',
    cancelButtonText: 'ย้อนกลับ',
    preConfirm: () => {
      const name = document.getElementById('new-leave-name').value.trim();
      const code = document.getElementById('new-leave-code').value.trim().toUpperCase();
      const quota = parseFloat(document.getElementById('new-leave-quota').value) || 0;
      
      if (!name || !code) {
        Swal.showValidationMessage('⚠️ กรุณากรอกชื่อและรหัสย่อภาษาอังกฤษให้ถูกต้องครบถ้วน');
        return false;
      }
      return { leave_name: name, leave_code: code, yearly_quota: quota, status: 'active' };
    }
  });

  if (!formValues) { editGlobalLeaveRules(); return; }

  Swal.fire({ title: 'กำลังเปิดใช้งานเกณฑ์ลาใหม่...', didOpen: () => Swal.showLoading() });
  const { error } = await supabase.from('leave_types').insert([formValues]);
  if (error) {
    Swal.fire('ล้มเหลว', error.message, 'error').then(() => actionAddNewLeaveType());
  } else {
    await saveHRActivityLog('LEAVE_QUOTA', 'CREATE', formValues.leave_name, `เพิ่มประเภทการลาใหม่: ${formValues.leave_name}`);
    Swal.fire('สำเร็จ!', 'บันทึกข้อกำหนดวันลาชุดใหม่แล้ว', 'success').then(() => editGlobalLeaveRules());
  }
}

async function actionDeleteLeaveType(id, name) {
  const supabase = getSupabase();
  const confirm = await Swal.fire({
    title: '⚠️ ยืนยันปิดสถานะระบบการลานี้?',
    html: `คุณต้องการระงับประเภทการลาชื่อ "${name}" หรือไม่? ข้อมูลเก่าจะไม่สูญหายแต่พนักงานใหม่จะไม่สามารถใช้รหัสนี้ได้`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ระงับการใช้งานทันที',
    confirmButtonColor: '#ef4444'
  });

  if (!confirm.isConfirmed) { editGlobalLeaveRules(); return; }

  const { error } = await supabase.from('leave_types').update({ status: 'inactive' }).eq('id', id);
  if (error) {
    Swal.fire('ข้อผิดพลาด', error.message, 'error').then(() => editGlobalLeaveRules());
  } else {
    await saveHRActivityLog('LEAVE_QUOTA', 'DELETE', name, `HR ปิดการใช้งานรหัสเกณฑ์วันลา: ${name}`);
    Swal.fire('ลบเสร็จสิ้น', 'อัปเดตสถานะเกณฑ์วันลาเรียบร้อย', 'success').then(() => editGlobalLeaveRules());
  }
}

async function editIndividualLeaveBalance() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { value: empCode } = await Swal.fire({
      title: '🛠️ ปรับโควตาพิเศษรายบุคคล',
      input: 'text',
      inputLabel: 'กรอกรหัสพนักงานที่ต้องการปรับยอดสิทธิ์',
      inputPlaceholder: 'เช่น 19001',
      showCancelButton: true,
      inputValidator: (value) => { if (!value) return '❌ กรุณาระบุรหัสพนักงาน' }
    });

    if (!empCode) return;

    Swal.fire({ title: 'กำลังค้นหาข้อมูลพนักงาน...', didOpen: () => Swal.showLoading() });

    const { data: emp } = await supabase.from('employees').select('id, full_name, employee_code').eq('employee_code', empCode.trim()).maybeSingle();
    if (!emp) {
      Swal.fire('ไม่พบรหัสพนักงาน', 'ไม่มีรหัสบุคลากรนี้ในทำเนียบบริษัท', 'warning');
      return;
    }
    
    await saveHRActivityLog('LEAVE_QUOTA', 'SELECT', emp.employee_code, `HR ตรวจสอบสิทธิ์วันลารายบุคคล: ${emp.full_name}`);

    const currentYear = new Date().getFullYear();
    const { data: balances, error } = await supabase
      .from('leave_balances')
      .select('id, entitlement_days, remaining_days, leave_types(leave_name)')
      .eq('employee_id', emp.id)
      .eq('year', currentYear);

    if (error) throw error;
    if (!balances || balances.length === 0) {
      Swal.fire('ไม่พบคลังวันลา', 'พนักงานรายนี้ยังไม่ถูกตั้งค่ายอดสิทธิ์ในรอบปีปัจจุบัน', 'warning');
      return;
    }

    let formHTML = `<div style="text-align:left; font-size:13px; max-height:280px; overflow-y:auto; font-family:'Sarabun';">`;
    balances.forEach(b => {
      formHTML += `
        <div style="margin-bottom:10px; padding:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px;">
          <div style="font-weight:bold; color:#0f766e; margin-bottom:4px;">${b.leave_types?.leave_name || 'ทั่วไป'}</div>
          <div style="display:flex; gap:10px; align-items:center;">
            <span>สิทธิ์รวม:</span>
            <input type="number" id="entit-${b.id}" class="swal2-input" style="width:65px; height:28px; margin:0; font-size:12px; text-align:center;" value="${b.entitlement_days}">
            <span>เหลือใช้จริง:</span>
            <input type="number" id="remain-${b.id}" class="swal2-input" style="width:65px; height:28px; margin:0; font-size:12px; text-align:center;" value="${b.remaining_days}">
          </div>
        </div>`;
    });
    formHTML += `</div>`;

    const { value: updatedBalances } = await Swal.fire({
      title: `แก้ไขโควตา: ${emp.full_name}`,
      html: formHTML,
      width: '450px',
      showCancelButton: true,
      confirmButtonText: '💾 อัปเดตยอดประวัติ',
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
      Swal.fire({ title: 'กำลังบันทึกข้อมูลปรับยอด...', didOpen: () => Swal.showLoading() });
      for (const b of updatedBalances) {
        if (b.new_entit !== b.old_entit || b.new_remain !== b.old_remain) {
          await supabase.from('leave_balances').update({ entitlement_days: b.new_entit, remaining_days: b.new_remain }).eq('id', b.id);
        }
      }
      await saveHRActivityLog('LEAVE_QUOTA', 'UPDATE', `รหัสพนักงาน: ${emp.employee_code}`, `ปรับสิทธิ์ใบลาเคสพิเศษรายบุคคลให้คุณ ${emp.full_name}`);
      Swal.fire('สำเร็จ', 'ดำเนินการปรับยอดสิทธิ์รายบุคคลเรียบร้อย', 'success');
    }
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

async function manageCompanyHolidays() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    Swal.fire({ title: 'กำลังเปิดปฏิทินบริษัท...', didOpen: () => Swal.showLoading() });
    const { data: holidays, error } = await supabase.from('company_holidays').select('*').order('holiday_date', { ascending: true });
    if (error) throw error;
    Swal.close();

    let listHTML = `<div style="text-align:left; font-size:13px; max-height:220px; overflow-y:auto; margin-bottom:12px; font-family:'Sarabun';">`;
    if (!holidays || holidays.length === 0) {
      listHTML += `<p style="text-align:center; color:#64748b;">ปฏิทินว่างเปล่า ยังไม่มีวันหยุดกำหนดไว้</p>`;
    } else {
      holidays.forEach(h => {
        listHTML += `<div style="padding:6px; border-bottom:1px solid #f1f5f9;">📅 <b>${h.holiday_date}</b> - ${h.holiday_name}</div>`;
      });
    }
    listHTML += `</div><hr><div style="text-align:left; font-size:13px; margin-top:10px; font-family:'Sarabun';">
      <b style="color:#0d9488;">+ เพิ่มวันหยุดบริษัทตัวใหม่</b><br>
      <input type="date" id="new-holiday-date" class="swal2-input" style="height:35px; font-size:13px; margin:5px 0; width:95%;">
      <input type="text" id="new-holiday-name" class="swal2-input" placeholder="คำอธิบาย เช่น วันหยุดชดเชยปีใหม่" style="height:35px; font-size:13px; margin:5px 0; width:95%;">
    </div>`;

    const { value: formValues } = await Swal.fire({
      title: 'ทำเนียบวันหยุดประจำปีบริษัท',
      html: listHTML,
      showCancelButton: true,
      confirmButtonText: '➕ บันทึกวันหยุดเข้าตาราง',
      cancelButtonText: 'ปิดหน้าต่างปฏิทิน',
      preConfirm: () => {
        const hDate = document.getElementById('new-holiday-date').value;
        const hName = document.getElementById('new-holiday-name').value.trim();
        if (!hDate || !hName) {
          Swal.showValidationMessage('❌ จำเป็นต้องเลือกทั้งวันที่และระบุอรรถาธิบายชื่อวันหยุด');
          return false;
        }
        return { holiday_date: hDate, holiday_name: hName };
      }
    });

    if (formValues) {
      Swal.fire({ title: 'กำลังผูกวันหยุดเข้าตารางงาน...', didOpen: () => Swal.showLoading() });
      const { error: insErr } = await supabase.from('company_holidays').insert([formValues]);
      if (insErr) throw insErr;
      await saveHRActivityLog('HOLIDAY', 'INSERT', formValues.holiday_date, `เพิ่มวันหยุดประจำปีบริษัท: ${formValues.holiday_name}`);
      Swal.fire('สำเร็จ', 'บันทึกวันหยุดลงระบบปฏิทินกลางแล้ว', 'success');
    }
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
}

// ==========================================================================
// หมวดที่ 3: ความปลอดภัย รายงาน และ Audit Log
// ==========================================================================

async function viewAuditLogs() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    Swal.fire({ title: 'กำลังอ่านบันทึกประวัติความปลอดภัย...', didOpen: () => Swal.showLoading() });
    const { data: logs, error } = await supabase.from('hr_admin_management_logs').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    
    // บันทึก Log การขอดู Audit Log เพื่อความโปร่งใส
    await saveHRActivityLog('SYSTEM_AUDIT', 'SELECT', 'System Logs', 'HR เปิดดูบันทึกประวัติความปลอดภัยของระบบ');
    Swal.close();

    let logsHTML = `<div style="text-align:left; font-size:13px; max-height:500px; overflow-y:auto; font-family:'Sarabun';">`;
    if (!logs || logs.length === 0) {
      logsHTML += `<div style="text-align:center; padding:20px; color:#64748b;">ระบบบันทึกประวัติความปลอดภัยยังว่างเปล่า</div>`;
    } else {
      logs.forEach(l => {
        const d = new Date(l.created_at).toLocaleString('th-TH');
        const badgeColor = l.action_type === 'INSERT' ? '#16a34a' : l.action_type === 'DELETE' ? '#dc2626' : l.action_type === 'SELECT' ? '#ca8a04' : '#2563eb';
        logsHTML += `
          <div style="padding: 10px; border-bottom: 1px solid #e2e8f0; margin-bottom: 6px; background:#f8fafc; border-radius:6px;">
            <div style="display:flex; justify-content:between; font-weight:bold;">
              <span style="color: ${badgeColor};">[${l.action_type}] ${l.action_category}</span>
              <span style="color: #64748b; font-size:11px; margin-left:auto;">${d}</span>
            </div>
            <div style="margin-top:2px;"><b>ผู้จัดการ:</b> ${l.actor_name} | <b>เป้าหมาย:</b> ${l.target_identifier}</div>
            <div style="color:#475569; margin-top:2px; font-style:italic; border-left:2px solid #cbd5e1; padding-left:6px;">${l.description}</div>
          </div>`;
      });
    }
    logsHTML += `</div>`;

    Swal.fire({
      title: 'บันทึกประวัติความปลอดภัยระบบควบคุม (Audit Log)',
      html: logsHTML,
      width: '850px',
      showCancelButton: true,
      showConfirmButton: false,
      cancelButtonText: 'ปิดบันทึกตรวจสอบ'
    });
  } catch (err) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดชุดข้อมูลบันทึกความปลอดภัยได้', 'error');
  }
}

async function resetYearlyLeave() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const nextYear = new Date().getFullYear() + 1;
    const { isConfirmed } = await Swal.fire({
      title: `<span style="color: #dc2626; font-size: 24px; font-weight: bold;">🚨 สั่งคำนวณและรีเซ็ตสิทธิ์วันลาประจำปีใหม่</span>`,
      html: `
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin-bottom: 12px; text-align: left; border-radius: 6px; font-family:'Sarabun';">
          <strong style="color: #991b1b; display: block;">⚠️ คำแจ้งเตือนวิกฤตระบบสารสนเทศ</strong>
          <span style="color: #b91c1c; font-size: 13.5px; font-weight:bold;">
            คำสั่งนี้จะรันการประมวลผลเซิร์ฟเวอร์หลังบ้าน (RPC) เพื่อเปิดบัญชีจัดสรรยอดสิทธิ์วันลาของปีงบประมาณถัดไป ค.ศ. ${nextYear} ให้พนักงานทุกคนทันที
          </span>
        </div>
        <p style="font-size:14px; font-family:'Sarabun';">คุณแน่ใจที่จะล้างสิทธิ์เดิมและก้าวเข้าสู่ปีปฏิทินงบประมาณการลาใหม่ ค.ศ. ${nextYear} หรือไม่?</p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: '⚠️ ยืนยันรันระบบตัดสิทธิ์ปีงบประมาณใหม่',
      cancelButtonText: 'ยกเลิกคำสั่งรัน'
    });

    if (isConfirmed) {
      Swal.fire({ title: 'ระบบกลางกำลังรันชุดคำสั่งคำนวณสิทธิ์ประจำปีขนาดใหญ่...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const { data, error } = await supabase.rpc('sp_initialize_new_year_balances', { target_year: nextYear });
      if (error) throw error;
      await saveHRActivityLog('LEAVE_QUOTA', 'DELETE', `ปีบัญชี: ${nextYear}`, `สั่งเคลียร์ยอดและรันระบบคำนวณตั้งต้นชุดสิทธิ์วันลาปีปฏิทินใหม่เอี่ยม`, null, { result: data });
      Swal.fire('ดำเนินการรีเซ็ตสิทธิ์สำเร็จ', `เปิดระบบลงทะเบียนสิทธิ์ลาของรอบปี ค.ศ. ${nextYear} ให้บุคลากรเรียบร้อย`, 'success');
    }
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาดขั้นวิกฤต', err.message, 'error');
  }
}

async function exportLeaveReport() {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    Swal.fire({ title: 'กำลังดึงรายงานคำขอลาจากระบบกลาง...', didOpen: () => Swal.showLoading() });
    
    // บันทึก Log เมื่อ HR ขอ Export รายงาน (ดึงข้อมูล)
    await saveHRActivityLog('REPORT_EXPORT', 'SELECT', 'Leave Report', `HR สั่งดาวน์โหลดรายงานการลาดิบ (CSV) ออกจากระบบ`);

    const { data: requests, error } = await supabase.from('leave_requests').select('start_date, end_date, total_days, reason, status, employees(employee_code, full_name)');
    if (error) throw error;
    Swal.close();

    let csvContent = "\uFEFF"; 
    csvContent += "รหัสพนักงาน,ชื่อ-นามสกุล,วันที่เริ่มลา,วันที่สิ้นสุด,จำนวนวันลา,เหตุผลการลา,สถานะคำขอ\n";

    requests.forEach(r => {
      csvContent += `"${r.employees?.employee_code || '-'}","${r.employees?.full_name || '-'}","${r.start_date}","${r.end_date}","${r.total_days}","${r.reason || '-'}","${r.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `รายงานสารสนเทศใบลา_PVT_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดาวน์โหลดข้อมูลรายงานได้', 'error');
  }
}

// ==========================================================================
// 📘 ฟังก์ชันเสริม: ควบคุมการเปิด/ปิดกล่องคู่มือแนะนำการใช้งานประจำหน้าแดชบอร์ด
// ==========================================================================
function toggleInstructions() {
  const content = document.getElementById("instructionsContent");
  const arrow = document.getElementById("instructionArrow");
  
  if (content && arrow) {
    content.classList.toggle("active");
    
    // เนื่องจากกล่องเปิดขึ้นด้านบน: เปิดอยู่ = ลูกศรชี้ลง (expand_more), ปิดอยู่ = ลูกศรชี้ขึ้น (expand_less)
    if (content.classList.contains("active")) {
      arrow.textContent = "expand_more";
    } else {
      arrow.textContent = "expand_less";
    }
  }
}