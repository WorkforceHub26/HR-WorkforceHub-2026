let adminProfile = null;

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  adminProfile = await window.pvtSupabase?.getCurrentProfile();
  document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      switchTab(item.dataset.tab);
    });
  });

  await Promise.all([loadStats(), fetchEmployees(), fetchLeaveRequests()]);
}

function switchTab(tabName) {
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.hidden = tab.id !== `tab-${tabName}`;
  });
  document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });

  if (tabName === "employees") fetchEmployees();
  if (tabName === "leaves") fetchLeaveRequests();
  if (tabName === "balances") fetchLeaveBalances();
}

async function loadStats() {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  try {
    const [{ count: employees }, { count: pending }, { count: approved }] = await Promise.all([
      sb.from("employees").select("*", { count: "exact", head: true }),
      sb.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "approved"),
    ]);

    document.getElementById("statEmployees").textContent = employees ?? 0;
    document.getElementById("statPending").textContent = pending ?? 0;
    document.getElementById("statApproved").textContent = approved ?? 0;
  } catch (error) {
    console.warn(error);
  }
}

// โค้ดอัปโหลดพนักงานอัตโนมัติเต็มรูปแบบ (วางทับฟังก์ชันเดิมใน admin.js)
// โค้ดอัปโหลดพนักงานและคำนวณวันลาคงเหลือเริ่มต้นอัตโนมัติ
// ฟังก์ชันนำเข้าและประมวลผลข้อมูลพนักงานอัตโนมัติเต็มระบบ (อิงตามโครงสร้าง Supabase จริง)
async function uploadEmployeeCSV() {
  const fileInput = document.getElementById('csvFileInput');
  const statusDiv = document.getElementById('uploadStatus');
  
  if (!fileInput || !fileInput.files.length) {
    alert("กรุณาเลือกไฟล์ CSV ก่อนครับ");
    return;
  }

  statusDiv.innerHTML = "⏳ ระบบกำลังอ่านไฟล์ ตรวจสอบแผนก ตำแหน่ง และคำนวณวันลาคงเหลืออัตโนมัติ...";
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = async function (e) {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      const sb = window.pvtSupabase?.getClient();

      if (!sb) throw new Error("ไม่สามารถเชื่อมต่อ Supabase Config ได้");

      // 1. ค้นหาไอดีประเภทการลาพักผ่อนสะสม (VACATION) สแตนด์บายรอไว้
      const { data: leaveTypeData } = await sb
        .from('leave_types')
        .select('id')
        .eq('leave_code', 'VACATION') 
        .maybeSingle();
      
      const vacationTypeId = leaveTypeData?.id || "40000000-0000-0000-0000-000000000004"; 
      const currentYear = new Date().getFullYear() + 543; // ปี พ.ศ. ปัจจุบัน

      let successCount = 0;

      // 2. วนลูปอ่านข้อมูลทีละบรรทัด (ข้ามหัวตารางแถวที่ 1)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // แยกคอลัมน์ด้วย Comma
        const col = line.split(',').map(c => c.trim().replace(/["']/g, ""));
        
        const code = col[1];            // คอลัมน์ B: รหัสพนักงาน
        const prefix = col[2] || "";    // คอลัมน์ C: คำนำหน้าชื่อ
        const fname = col[3] || "";     // คอลัมน์ D: ชื่อจริง
        const lname = col[4] || "";     // คอลัมน์ E: นามสกุล
        const positionName = col[5];    // คอลัมน์ F: ชื่อตำแหน่งงาน
        const departmentName = col[6];  // คอลัมน์ G: ชื่อแผนก/ฝ่าย
        const rawDate = col[7];       // คอลัมน์ H: วันเริ่มงาน

        if (code && fname) {
          // 🤖 อัตโนมัติที่ 1: รวมช่องคำนำหน้า + ชื่อ + สกุล เป็นก้อนเดียวส่งเข้า full_name
          const joinedFullName = `${prefix}${fname} ${lname}`.replace(/\s+/g, ' ').trim();

          // 🤖 อัตโนมัติที่ 2: ตรวจสอบและแมป "ฝ่าย/แผนก" (Departments)
          let deptId = null;
          if (departmentName) {
            // สร้าง Code ย่ออัตโนมัติจากชื่อแผนก (เช่น ฝ่ายบุคคล -> DEPT_ฝ่ายบุคคล) หรือค้นหาจากชื่อ
            const deptCode = `DEPT_${departmentName}`;
            const { data: deptData } = await sb
              .from('departments')
              .upsert({ department_code: deptCode, department_name: departmentName }, { onConflict: 'department_code' })
              .select('id')
              .single();
            deptId = deptData?.id;
          }

          // 🤖 อัตโนมัติที่ 3: ตรวจสอบและแมป "ตำแหน่งงาน" (Positions)
          let posId = null;
          if (positionName) {
            // เช็กว่ามีชื่อตำแหน่งนี้จับคู่กับแผนกนี้อยู่แล้วไหม ถ้าไม่มีจะสร้างให้ใหม่อัตโนมัติ
            const { data: posData } = await sb
              .from('positions')
              .select('id')
              .eq('position_name', positionName)
              .maybeSingle();

            if (posData) {
              posId = posData.id;
            } else {
              const { data: newPos } = await sb
                .from('positions')
                .insert({ position_name: positionName, department_id: deptId })
                .select('id')
                .single();
              posId = newPos?.id;
            }
          }
          
          // 🤖 อัตโนมัติที่ 4: แกะและแปลงฟอร์แมตวันที่ (พ.ศ. / ค.ศ.) ให้เป็นสากล YYYY-MM-DD
          let formattedDate = null;
          if (rawDate && rawDate.includes('/')) {
            const parts = rawDate.split('/');
            if (parts.length === 3) {
              let p1 = parseInt(parts[0]);
              let p2 = parseInt(parts[1]);
              let p3 = parseInt(parts[2]);
              
              if (p3 > 2400) { // เป็นปี พ.ศ. ของไทย
                formattedDate = `${p3 - 543}-${p2.toString().padStart(2, '0')}-${p1.toString().padStart(2, '0')}`;
              } else { // เป็นรูปแบบ เดือน/วัน/ปี ค.ศ. สากล
                // ตรวจสอบความสมเหตุสมผล (ถ้าพาร์ทแรกเกิน 12 แสดงว่าเป็น วัน/เดือน/ปี ค.ศ.)
                if (p1 > 12) {
                  formattedDate = `${p3}-${p2.toString().padStart(2, '0')}-${p1.toString().padStart(2, '0')}`;
                } else {
                  formattedDate = `${p3}-${p1.toString().padStart(2, '0')}-${p2.toString().padStart(2, '0')}`;
                }
              }
            }
          }

          // 5. บันทึกข้อมูลพนักงานลงตาราง employees โดยใช้ตัวแปรที่ดึงมาอัตโนมัติทั้งหมด
          const { data: empData, error: empError } = await sb
            .from('employees')
            .upsert({
              employee_code: code.toString(),
              full_name: joinedFullName,
              department_id: deptId,
              position_id: posId,
              start_date: formattedDate,
              employment_type: 'monthly',
              status: 'active'
            }, { onConflict: 'employee_code' })
            .select();

          if (empError) {
            console.error(`❌ บันทึกรหัสพนักงาน ${code} ไม่สำเร็จ:`, empError.message);
            continue;
          }

          // 🤖 อัตโนมัติที่ 5: ตั้งค่าสิทธิ์และหยอดโควตาวันลาพักผ่อน (6 วัน) ลงตาราง leave_balances ทันที
          if (empData && empData.length > 0) {
            const newEmpId = empData[0].id;
            
            await sb.from('leave_balances').upsert({
              employee_id: newEmpId,
              leave_type_id: vacationTypeId,
              year: currentYear,
              entitlement_days: 6,
              used_days: 0,
              remaining_days: 6
            }, { onConflict: 'employee_id,leave_type_id,year' });
          }

          successCount++;
        }
      }

      statusDiv.innerHTML = `✅ อัปเดตข้อมูลพนักงาน แผนก ตำแหน่ง และโควตาวันลาเรียบร้อยแล้วจำนวน ${successCount} คน`;
      if (typeof fetchEmployees === 'function') fetchEmployees();

    } catch (err) {
      statusDiv.innerHTML = "❌ ระบบอัตโนมัติขัดข้อง: " + err.message;
      console.error(err);
      
    }
  };

  reader.readAsText(file, 'UTF-8');
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function setUploadStatus(message, type) {
  const statusDiv = document.getElementById("uploadStatus");
  statusDiv.textContent = message;
  statusDiv.className = `admin-status ${type || ""}`;
}

async function fetchEmployees() {
  const tbody = document.getElementById("employeeTableBody");
  const sb = window.pvtSupabase?.getClient();
  if (!tbody || !sb) return;
  tbody.innerHTML = "<tr><td colspan='4'>กำลังโหลดรายชื่อพนักงาน...</td></tr>";

  try {
    const { data, error } = await sb
      .from("employees")
      .select("employee_code, full_name, start_date, status")
      .order("employee_code", { ascending: true })
      .limit(300);

    if (error) throw error;
    if (!data?.length) {
      tbody.innerHTML = "<tr><td colspan='4'>ยังไม่มีข้อมูลพนักงาน</td></tr>";
      return;
    }

    tbody.innerHTML = data.map((employee) => `
      <tr>
        <td><strong>${window.pvtSupabase.escapeHtml(employee.employee_code)}</strong></td>
        <td>${window.pvtSupabase.escapeHtml(employee.full_name)}</td>
        <td>${window.pvtSupabase.formatThaiDate(employee.start_date)}</td>
        <td><span class="status-badge">● ${employee.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</span></td>
      </tr>
    `).join("");
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan='4' class='error-text'>โหลดข้อมูลไม่สำเร็จ: ${window.pvtSupabase.escapeHtml(error.message)}</td></tr>`;
  }
}

// อัปเดตฟังก์ชันใน admin.js เพื่อเชื่อมข้อมูลดึงชื่อพนักงานมาแสดงในหน้าอนุมัติ
async function fetchLeaveRequests() {
  const sb = window.pvtSupabase?.getClient();
  const tbody = document.getElementById("leaveRequestBody");
  if (!sb || !tbody) return;

  try {
    // 🤖 อัตโนมัติ: ดึงข้อมูลใบลา พร้อมจอย (Join) ชื่อพนักงานและชื่อประเภทการลามาพร้อมกัน
    const { data, error } = await sb
      .from("leave_requests")
      .select(`
        id, 
        start_date, 
        end_date, 
        total_days, 
        reason, 
        status, 
        employees (full_name, employee_code),
        leave_types (leave_name)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // ตัวอย่างการเพิ่มปุ่ม "เปิดดูหน้าใบลา" ในไฟล์ admin.js ตอนที่ render ตารางคำขอลา
tbody.innerHTML = data.map((item) => {
  const emp = item.employees || {};
  const leaveTypeName = item.leave_types?.leave_name || "ไม่ระบุประเภท";
  
  return `
    <tr>
      <td><strong>${window.pvtSupabase.escapeHtml(emp.full_name || "-")}</strong></td>
      <td>${window.pvtSupabase.escapeHtml(leaveTypeName)}</td>
      <td>${window.pvtSupabase.formatThaiDate(item.start_date)} - ${window.pvtSupabase.formatThaiDate(item.end_date)}</td>
      <td>${item.total_days} วัน</td>
      <td>${window.pvtSupabase.escapeHtml(item.reason || "-")}</td>
      <td><span class="status ${item.status}">${window.pvtSupabase.statusLabel(item.status)}</span></td>
      <td>
        <button class="btn-approve" onclick="approveLeave('${item.id}')">อนุมัติ</button>
        <button class="btn-reject" onclick="rejectLeave('${item.id}')">ปฏิเสธ</button>
      </td>
      <td>
        <a href="/pages/user/leave-user.html?id=${item.id}&viewOnly=true" class="btn-view-form" target="_blank" style="text-decoration: none; color: #2563eb;">👁️ ดูหน้าใบลา</a>
      </td>
    </tr>
  `;
}).join("");
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan='7' class='error-text'>โหลดคำขอไม่สำเร็จ: ${window.pvtSupabase.escapeHtml(error.message)}</td></tr>`;
  }
}

function renderLeaveActions(item) {
  if (item.status !== "pending") return "-";
  return `
    <button class="btn-mini approve" onclick="updateLeaveStatus('${item.id}', 'approved')">อนุมัติ</button>
    <button class="btn-mini reject" onclick="updateLeaveStatus('${item.id}', 'rejected')">ไม่อนุมัติ</button>
  `;
}

// อัปเดตฟังก์ชันใน admin.js ให้รองรับการแจ้งเตือนกรณีวันลาไม่พอจากระบบหลังบ้าน
async function updateLeaveStatus(id, status) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  // หากเป็นการปฏิเสธใบลา ให้ขึ้นแจ้งเตือนใส่เหตุผล
  const comment = status === "rejected" ? prompt("ระบุเหตุผลที่ไม่อนุมัติ:") : "อนุมัติตามขั้นตอน";
  if (status === "rejected" && comment === null) return; // กดยกเลิกใน prompt

  try {
    const updates = {
      status,
      approval_comment: comment,
      approved_at: new Date().toISOString(),
    };
    if (adminProfile?.employee_id) updates.approved_by = adminProfile.employee_id;

    // 🤖 ส่งคำสั่งไปอัปเดตที่ Supabase
    const { error } = await sb
      .from("leave_requests")
      .update(updates)
      .eq("id", id);

    // 🚨 จุดสำคัญ: ถ้าเกิด Exception เช่น วันลาไม่พอ หรือไม่พบโควตา จะเด้งเข้าก้อน catch ทันที
    if (error) throw error;

    alert(status === "approved" ? "🎉 อนุมัติใบลาเรียบร้อยแล้ว!" : "❌ ปฏิเสธใบลาเรียบร้อยแล้ว");
    
    // รีเฟรชสถิติและรายการใบลาบนหน้าจอใหม่ให้เป็นปัจจุบัน
    await Promise.all([loadStats(), fetchLeaveRequests()]);
    if (typeof fetchLeaveBalances === "function") fetchLeaveBalances(); // รีเฟรชยอดโควตาถ้าเปิดหน้านั้นอยู่

  } catch (error) {
    console.error("Error updating leave status:", error);
    // 💡 ดึงข้อความแจ้งเตือนภาษาไทยที่เราเขียนไว้ใน Postgres Trigger ออกมาแสดงให้แอดมินเห็นตรงๆ
    alert(`⚠️ ไม่สามารถดำเนินการได้:\n${error.message || error}`);
  }
}

// ฟังก์ชันใหม่ดึงยอดคงเหลือของทุกคนมาแสดงในหน้าแอดมิน
async function fetchLeaveBalances() {
  const sb = window.pvtSupabase?.getClient();
  const tbody = document.getElementById("leaveBalanceBody");
  if (!sb || !tbody) return;

  try {
    const currentYear = new Date().getFullYear() + 543;

    // ดึงยอดคงเหลือพร้อมจอย (Join) ข้อมูลรหัสและชื่อพนักงาน
    // โค้ดเก่าใน admin.js คาดหวังฟิลด์ total_days
       // ค้นหาโค้ดช่วงนี้ในฟังก์ชัน fetchLeaveBalances()
        const { data, error } = await sb
  .from("leave_balances")
  .select(`
    year,
    entitlement_days,
    remaining_days,
    employees (employee_code, full_name)
  `)
  .eq("year", currentYear);

    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">ยังไม่มีข้อมูลโควตาวันลาในระบบ</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map((item) => {
      const emp = item.employees || {};
      const isOut = item.remaining_days <= 0;
      return `
        <tr>
          <td><strong>${window.pvtSupabase.escapeHtml(emp.employee_code || "-")}</strong></td>
          <td>${window.pvtSupabase.escapeHtml(emp.full_name || "ไม่ระบุชื่อ")}</td>
          <td>ปี พ.ศ. ${item.year}</td>
          <td>${item.entitlement_days} วัน</td>
          <td>
            <strong style="font-size: 15px; color: ${isOut ? '#dc2626' : '#16a34a'};">
              ${item.remaining_days} วัน
            </strong>
          </td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    console.error(error);
    tbody.innerHTML = `<tr><td colspan="5" class="error-text" style="text-align: center;">โหลดข้อมูลไม่สำเร็จ: ${window.pvtSupabase.escapeHtml(error.message)}</td></tr>`;
  }
}


// ฟังก์ชันมาตรฐานสำหรับ HR สร้างบัญชีพนักงานใหม่
async function createNewEmployee(empCode, fullName, password, departmentId, positionId) {
  const sb = window.pvtSupabase.getClient();
  const email = `${empCode}@pvt.com`;

  try {
    // 1. สร้างบัญชีเข้า Auth ด้วย API (นี่คือวิธีที่ถูกต้อง พาสเวิร์ดจะไม่เพี้ยน)
    const { data: authData, error: authError } = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { full_name: fullName, role: 'user' } // ข้อมูลตรงนี้ Trigger จะดูดไปลง Profiles เอง
      }
    });

    if (authError) throw authError;

    // 2. เอา ID ที่ได้จากข้อ 1 มาสร้างประวัติพนักงานในตาราง Employees
    const newUserId = authData.user.id;
    const { error: empError } = await sb.from('employees').insert({
      id: newUserId,
      employee_code: empCode,
      full_name: fullName,
      email: email,
      department_id: departmentId,
      position_id: positionId,
      employment_type: 'monthly',
      start_date: new Date().toISOString().split('T')[0],
      status: 'active'
    });

    if (empError) throw empError;

    alert("✅ สร้างบัญชีพนักงานสมบูรณ์ 100% สามารถล็อกอินได้ทันที!");
  } catch (err) {
    alert("❌ เกิดข้อผิดพลาด: " + err.message);
  }
}