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

// 🟢 ฟังก์ชันเริ่มต้นตรวจสอบสิทธิ์และการเชื่อมต่อ
async function initManagementSystem() {
  console.log("🔍 [Step 1]: ตรวจสอบการเชื่อมต่อฐานข้อมูลและตัวตนผู้ใช้งาน...");
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const profile = await window.pvtSupabase?.getCurrentProfile();
    console.log("👤 [User Profile Loaded]:", profile);

    if (!profile || (profile.role !== 'admin' && profile.role !== 'hr')) {
      console.warn("⚠️ [SECURITY WARNING]: ผู้ใช้งานไม่มีสิทธิ์เข้าถึงหน้านี้ (ไม่ใช่ Admin/HR)");
    }
    console.log("✅ [System Ready]: ระบบพร้อมทำงานและเชื่อมต่อฐานข้อมูลเรียบร้อย");
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

async function addNewEmployee() {
  console.group("➕ [HR ACTION] เริ่มกระบวนการเพิ่มพนักงานใหม่ (รายบุคคล)");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    Swal.fire({ title: 'กำลังดึงข้อมูลโครงสร้างองค์กร...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const { data: depts, error: deptErr } = await supabase.from('departments').select('id, department_name');
    const { data: positions, error: posErr } = await supabase.from('positions').select('id, position_name');

    if (deptErr) console.error("❌ [DB ERROR] แผนกพัง:", deptErr);
    if (posErr) console.error("❌ [DB ERROR] ตำแหน่งพัง:", posErr);

    let deptOptions = '';
    let posOptions = '';

    if (!depts || depts.length === 0) {
      deptOptions = `<option value="" disabled selected style="color:red;">❌ ไม่พบข้อมูลแผนก (ติดสิทธิ์ RLS / ตารางว่าง)</option>`;
    } else {
      deptOptions = depts.map(d => `<option value="${d.id}">${d.department_name}</option>`).join('');
    }

    if (!positions || positions.length === 0) {
      posOptions = `<option value="" disabled selected style="color:red;">❌ ไม่พบข้อมูลตำแหน่ง (ติดสิทธิ์ RLS / ตารางว่าง)</option>`;
    } else {
      posOptions = positions.map(p => `<option value="${p.id}">${p.position_name}</option>`).join('');
    }

    Swal.close();

    const { value: formValues } = await Swal.fire({
      title: 'เพิ่มพนักงานใหม่เข้าสู่ระบบ',
      html: `
        <div style="text-align:left; font-size:14px; display:flex; flex-direction:column; gap:10px;">
          <label><b>รหัสพนักงาน *</b></label>
          <input id="swal-emp-code" class="swal2-input" style="margin:0;" placeholder="เช่น PVT69001">
          
          <label><b>ชื่อ-นามสกุล *</b></label>
          <input id="swal-full-name" class="swal2-input" style="margin:0;" placeholder="นายสมชาย ใจดี">
          
          <label><b>ชื่อเล่น</b></label>
          <input id="swal-nickname" class="swal2-input" style="margin:0;" placeholder="ชาย">
          
          <label><b>เลือกฝ่าย/แผนก *</b></label>
          <select id="swal-dept-id" class="swal2-input" style="margin:0;">${deptOptions}</select>
          
          <label><b>เลือกตำแหน่งงาน *</b></label>
          <select id="swal-pos-id" class="swal2-input" style="margin:0;">${posOptions}</select>
          
          <label><b>ประเภทการจ้าง</b></label>
          <select id="swal-type" class="swal2-input" style="margin:0;">
            <option value="monthly">พนักงานรายเดือน</option>
            <option value="daily">พนักงานรายวัน</option>
          </select>
          
          <label><b>วันที่เริ่มงาน</b></label>
          <input id="swal-start-date" type="date" class="swal2-input" style="margin:0;" value="${new Date().toISOString().split('T')[0]}">
        </div>
      `,
      width: '450px',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: '💾 บันทึกพนักงาน',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const deptSelect = document.getElementById('swal-dept-id').value;
        const posSelect = document.getElementById('swal-pos-id').value;

        if (!deptSelect || !posSelect) {
          Swal.showValidationMessage('❌ กรุณาเลือกแผนกและตำแหน่งที่ถูกต้อง (โปรดปลดล็อก RLS ก่อน)');
          return false;
        }

        return {
          employee_code: document.getElementById('swal-emp-code').value.trim(),
          full_name: document.getElementById('swal-full-name').value.trim(),
          nickname: document.getElementById('swal-nickname').value.trim(),
          department_id: deptSelect,
          position_id: posSelect,
          employment_type: document.getElementById('swal-type').value,
          start_date: document.getElementById('swal-start-date').value,
          status: 'active'
        }
      }
    });

    if (!formValues) { console.log("❌ HR ยกเลิกการทำรายการ"); console.groupEnd(); return; }
    
    Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const { data: newEmp, error } = await supabase.from('employees').insert([formValues]).select().single();
    if (error) throw error;

    await saveHRActivityLog('EMPLOYEE', 'INSERT', `รหัสพนักงาน: ${formValues.employee_code}`, `เพิ่มพนักงานใหม่ชื่อ ${formValues.full_name}`, null, formValues);
    Swal.fire('สำเร็จ!', `เพิ่มพนักงาน ${formValues.full_name} เรียบร้อยแล้ว`, 'success');

  } catch (err) {
    console.error("❌ เกิดเออร์เรอร์ในการเพิ่มพนักงาน:", err.message);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
  console.groupEnd();
}

// 🛠️ [แก้ไข บั๊ก Swal.clickDeny] ให้สามารถทำงานแยกปุ่มแก้ไข และแจ้งลาออกได้สมบูรณ์จริง
async function editEmployeeData() {
  console.group("🔍 [HR ACTION] เริ่มการค้นหา/แก้ไขพนักงาน");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    const { value: searchCode } = await Swal.fire({
      title: 'ค้นหาพนักงานเพื่อทำการแก้ไข',
      input: 'text',
      inputLabel: 'กรุณากรอก รหัสพนักงาน (Employee Code)',
      inputPlaceholder: 'เช่น PVT69001',
      showCancelButton: true,
      confirmButtonText: '🔍 ค้นหา'
    });

    if (!searchCode) { console.groupEnd(); return; }

    console.log(`📥 ค้นหาข้อมูลพนักงานรหัส: ${searchCode}`);
    const { data: emp, error } = await supabase.from('employees').select('*').eq('employee_code', searchCode.trim()).maybeSingle();

    if (error) throw error;
    if (!emp) {
      console.warn(`❌ ไม่พบข้อมูลพนักงานรหัส: ${searchCode}`);
      Swal.fire('ไม่พบข้อมูล', 'ไม่มีรหัสพนักงานนี้อยู่ในระบบ', 'warning');
      console.groupEnd();
      return;
    }

    // 🛠️ ใช้โครงสร้างเช็ควัตถุรับค่าปุ่มกดของ Swal2 ที่ถูกต้องแทนตัวแปรลอย
    const result = await Swal.fire({
      title: `จัดการข้อมูล: ${emp.full_name}`,
      text: `สถานะปัจจุบัน: ${emp.status === 'active' ? 'กำลังทำงาน' : 'ลาออกแล้ว'}`,
      icon: 'info',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '📝 แก้ไขชื่อ/ชื่อเล่น',
      denyButtonText: '🚨 บันทึกสถานะลาออก',
      cancelButtonText: 'ปิดหน้าจอ'
    });

    if (result.isConfirmed) {
      const { value: updateValues } = await Swal.fire({
        title: 'แก้ไขข้อมูลพนักงาน',
        html: `
          <div style="text-align:left; font-size:14px; display:flex; flex-direction:column; gap:10px;">
            <label><b>ชื่อ-นามสกุล</b></label>
            <input id="edit-name" class="swal2-input" style="margin:0;" value="${emp.full_name}" placeholder="ชื่อ-นามสกุล">
            <label><b>ชื่อเล่น</b></label>
            <input id="edit-nick" class="swal2-input" style="margin:0;" value="${emp.nickname || ''}" placeholder="ชื่อเล่น">
          </div>
        `,
        preConfirm: () => {
          return {
            full_name: document.getElementById('edit-name').value.trim(),
            nickname: document.getElementById('edit-nick').value.trim()
          }
        }
      });

      if (updateValues) {
        console.log("📤 ทำการอัปเดตข้อมูลตาราง employees...");
        const { error: updErr } = await supabase.from('employees').update(updateValues).eq('id', emp.id);
        if (updErr) throw updErr;

        await saveHRActivityLog('EMPLOYEE', 'UPDATE', `รหัสพนักงาน: ${emp.employee_code}`, `แก้ไขชื่อพนักงานเป็น ${updateValues.full_name}`, emp, updateValues);
        Swal.fire('บันทึกสำเร็จ', 'แก้ไขข้อมูลเรียบร้อยแล้ว', 'success');
      }
    } 
    else if (result.isDenied) {
      const { value: resignDate } = await Swal.fire({
        title: 'ยืนยันพนักงานลาออก',
        input: 'date',
        inputLabel: 'เลือกวันที่สิ้นสุดการทำงาน (วันลาออก)',
        inputValue: new Date().toISOString().split('T')[0],
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'ยืนยันการบันทึกลาออก'
      });

      if (resignDate) {
        console.log(`📤 สั่งอัปเดตสถานะพนักงานเป็น resigned มีผลวันที่ ${resignDate}`);
        const { error: resErr } = await supabase.from('employees').update({ status: 'resigned', resign_date: resignDate }).eq('id', emp.id);
        if (resErr) throw resErr;

        await saveHRActivityLog('EMPLOYEE', 'UPDATE', `รหัสพนักงาน: ${emp.employee_code}`, `ตั้งค่าพนักงานลาออก มีผลวันที่ ${resignDate}`, emp, { status: 'resigned', resign_date: resignDate });
        Swal.fire('ดำเนินการเรียบร้อย', 'ปรับสถานะพนักงานเป็นลาออกสำเร็จ', 'success');
      }
    }

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการแก้ไขข้อมูลพนักงาน:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
  console.groupEnd();
}

// 🛠️ [เปิดระบบใช้งานจริง] ฟังก์ชันจัดการโครงสร้างองค์กร ให้สามารถกรอกบันทึกแผนกและตำแหน่งใหม่ลงระบบได้จริง
async function manageDepartments() {
  console.group("📂 [HR ACTION] เรียกดูข้อมูลแผนก/ตำแหน่ง");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    const result = await Swal.fire({
      title: 'จัดการโครงสร้างองค์กร',
      text: 'กรุณาเลือกรายการที่ต้องการเพิ่มเข้าสู่ฐานข้อมูลหลัก',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '🏢 เพิ่มฝ่าย/แผนกใหม่',
      denyButtonText: '💼 เพิ่มตำแหน่งงานใหม่',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      const { value: deptName } = await Swal.fire({
        title: 'เพิ่มฝ่าย / แผนกใหม่',
        input: 'text',
        inputLabel: 'กรุณาระบุชื่อแผนกที่ต้องการเพิ่ม',
        inputPlaceholder: 'เช่น ฝ่ายทรัพยากรบุคคล, ฝ่ายการตลาด',
        showCancelButton: true,
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องกรอกชื่อแผนกครับ!' }
      });

      if (deptName) {
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const { error } = await supabase.from('departments').insert([{ department_name: deptName.trim() }]);
        if (error) throw error;
        
        await saveHRActivityLog('DEPARTMENT', 'INSERT', deptName, `เพิ่มแผนกโครงสร้างใหม่: ${deptName}`);
        Swal.fire('สำเร็จ!', `เพิ่มแผนก "${deptName}" เรียบร้อยแล้ว`, 'success');
      }
    } 
    else if (result.isDenied) {
      const { value: posName } = await Swal.fire({
        title: 'เพิ่มตำแหน่งงานใหม่',
        input: 'text',
        inputLabel: 'กรุณาระบุชื่อตำแหน่งงาน',
        inputPlaceholder: 'เช่น Senior Developer, HR Manager',
        showCancelButton: true,
        inputValidator: (value) => { if (!value) return '❌ จำเป็นต้องกรอกชื่อตำแหน่งงานครับ!' }
      });

      if (posName) {
        Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const { error } = await supabase.from('positions').insert([{ position_name: posName.trim() }]);
        if (error) throw error;
        
        await saveHRActivityLog('POSITION', 'INSERT', posName, `เพิ่มตำแหน่งงานใหม่: ${posName}`);
        Swal.fire('สำเร็จ!', `เพิ่มตำแหน่งงาน "${posName}" เรียบร้อยแล้ว`, 'success');
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
async function editGlobalLeaveRules() {
  console.group("⚖️ [HR ACTION] ดึงกฎและประเภทการลาภาพรวม");
  const supabase = getSupabase();
  if (!supabase) { console.groupEnd(); return; }

  try {
    Swal.fire({ title: 'กำลังโหลดข้อมูลกฎเกณฑ์...', didOpen: () => Swal.showLoading() });
    
    const { data: rules, error } = await supabase.from('leave_types').select('*').eq('status', 'active');
    if (error) throw error;

    Swal.close();

    let tableHTML = `<div style="max-height: 300px; overflow-y: auto;"><table style="width:100%; text-align:left; font-size:13px; border-collapse:collapse;">
      <tr style="background:#f1f5f9;"><th style="padding:6px; border:1px solid #cbd5e1;">ประเภทการลา</th><th style="padding:6px; border:1px solid #cbd5e1;">โควตาเดิม (วัน/ปี)</th></tr>`;
    
    rules.forEach(r => {
      tableHTML += `<tr>
        <td style="padding:6px; border:1px solid #cbd5e1;"><b>${r.leave_name}</b> (${r.leave_code})</td>
        <td style="padding:6px; border:1px solid #cbd5e1;"><input type="number" id="quota-${r.id}" class="swal2-input" style="width:80px; height:30px; margin:0; font-size:13px;" value="${r.yearly_quota || 0}"></td>
      </tr>`;
    });
    tableHTML += '</table></div>';

    // 🛠️ ดึงค่าอาร์เรย์ผลลัพธ์ผ่านระบบ preConfirm ป้องกันข้อมูลหายตอนปิดกล่อง
    const { value: updatedRules } = await Swal.fire({
      title: 'ปรับปรุงโควตาวันลาพื้นฐานบริษัท',
      html: tableHTML,
      width: '500px',
      showCancelButton: true,
      confirmButtonText: '💾 บันทึกทั้งหมด',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const listResults = [];
        rules.forEach(r => {
          const inputVal = parseFloat(document.getElementById(`quota-${r.id}`).value) || 0;
          listResults.push({ id: r.id, old_quota: r.yearly_quota, new_quota: inputVal });
        });
        return listResults;
      }
    });

    if (updatedRules) {
      console.time("⏱️ เวลาที่ใช้อัปเดตข้อมูลกฎเกณฑ์");
      Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      for (const item of updatedRules) {
        if (item.new_quota !== item.old_quota) {
          console.log(`📤 อัปเดตตาราง leave_types ID: ${item.id} -> โควตาใหม่: ${item.new_quota}`);
          await supabase.from('leave_types').update({ yearly_quota: item.new_quota }).eq('id', item.id);
        }
      }

      await saveHRActivityLog('LEAVE_QUOTA', 'UPDATE', 'ภาพรวมบริษัท', 'แก้ไขเกณฑ์วันลามาตรฐานขององค์กร', null, null);
      console.timeEnd("⏱️ เวลาที่ใช้อัปเดตข้อมูลกฎเกณฑ์");
      Swal.fire('สำเร็จ', 'อัปเดตข้อกำหนดเรียบร้อยแล้ว', 'success');
    }

  } catch (err) {
    console.error("❌ เกิดข้อผิดพลาดในการตั้งค่ากฎการลา:", err);
    Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
  }
  console.groupEnd();
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

    let logsHTML = `<div style="text-align:left; font-size:12px; max-height:350px; overflow-y:auto; padding-right:5px;">`;
    
    if (!logs || logs.length === 0) {
      logsHTML += `<div style="text-align:center; padding:20px; color:#64748b;">ยังไม่มีประวัติการทำรายการในตารางระบบ Log</div>`;
    } else {
      logs.forEach(l => {
        const d = new Date(l.created_at).toLocaleString('th-TH');
        const color = l.action_type === 'INSERT' ? '#16a34a' : l.action_type === 'DELETE' ? '#dc2626' : '#2563eb';
        
        logsHTML += `
          <div style="padding: 10px; border-bottom: 1px solid #e2e8f0; margin-bottom: 6px; background:#f8fafc; border-radius:6px;">
            <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:2px;">
              <span style="color: ${color};">[${l.action_type}] หมวดหมู่: ${l.action_category}</span>
              <span style="color: #64748b; font-size:11px;">${d}</span>
            </div>
            <div><b>ผู้ปฏิบัติงาน:</b> ${l.actor_name}</div>
            <div><b>เป้าหมาย:</b> ${l.target_identifier}</div>
            <div style="color:#334155; margin-top:2px; background:#fff; padding:4px; border:1px dashed #cbd5e1; border-radius:4px;">${l.description}</div>
          </div>`;
      });
    }
    logsHTML += `</div>`;

    Swal.fire({
      title: 'ประวัติการตั้งค่าและการกระทำของ HR',
      html: logsHTML,
      width: '650px',
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

    const { isConfirmed } = await Swal.fire({
      title: `ล้างสิทธิ์และเริ่มปีใหม่ ${nextYear}?`,
      text: `คำเตือน: ระบบจะรันฟังก์ชันหลังบ้านสร้างแถวโควตาวันลาชุดใหม่ประจำปี ค.ศ. ${nextYear} ให้กับพนักงานทุกคนที่ยังมีสถานะ Active ทันที`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
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