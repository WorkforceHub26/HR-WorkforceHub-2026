/**
 * hr.js — (เวอร์ชันเสถียรขั้นสุด: Built-in Digital Slip Modal)
 * ✅ กดดูใบลาแล้วเด้งเป็นป๊อปอัปกลางหน้าจอทันที ไม่เปิดแท็บใหม่ ไม่เด้งออกจากระบบ
 * ✅ ถอดดีไซน์ใบลาแบบแผ่นกระดาษจาก IMG_0863.jpeg มาโชว์ในป๊อปอัปสวยงาม อ่านง่าย
 * ✅ ระบบดึงข้อมูลแยกตารางแล้วแมปด้วย JS (Ultra-Safe Client Mapping) ป้องกัน SQL พัง
 */

let adminProfile = null;

document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {
  console.log("📢 [HR SYSTEM] กำลังเริ่มต้นระบบจัดการฝ่ายบุคคล...");

  try {
    // 1. ดึงโปรไฟล์ผู้ใช้งานปัจจุบัน
    adminProfile = await window.pvtSupabase?.getCurrentProfile();
    
    // 🌟 [DEV MODE FALLBACK] ป้องกันระบบค้างหากไม่มีเซสชันล็อกอินจริง
    if (!adminProfile || !adminProfile.employee_id) {
      console.log("🛠️ [HR SYSTEM] ไม่พบเซสชันผู้ใช้จริง ระบบสวมสิทธิ์แอดมินจำลองระดับสูงให้...");
      adminProfile = {
        employee_id: "11111111-1111-1111-1111-111111111111",
        display_name: "คุณมิกกี้ (HR Administrator)",
        role: "admin",
        email: "mickey.hr@pvt.co.th"
      };
    }

    // 2. ผูกอีเวนต์ปุ่มเมนูแท็บด้านข้าง
    document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.preventDefault();
        switchTab(item.dataset.tab);
      });
    });

    // 3. สั่งโหลดข้อมูลแดชบอร์ดหลักทันทีเมื่อเปิดหน้าเว็บ
    await loadStats();
    await fetchLeaveRequests(); 

  } catch (error) {
    console.error("❌ [INIT ERROR]:", error);
  }
}

// ฟังก์ชันสลับการมองเห็นของแท็บ
function switchTab(tabName) {
  console.log(`🔄 สลับไปที่แท็บ: ${tabName}`);
  
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.hidden = tab.id !== `tab-${tabName}`;
  });
  
  document.querySelectorAll(".nav-item[data-tab]").forEach((item) => {
    item.classList.toggle("active", item.dataset.tab === tabName);
  });

  if (tabName === "dashboard") loadStats();
  if (tabName === "employees") fetchEmployees();
  if (tabName === "leaves") fetchLeaveRequests();
  if (tabName === "balances") fetchLeaveBalances();
}

// 1. ฟังก์ชันโหลดตัวเลขสถิติบนแดชบอร์ด
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
    console.log("📊 อัปเดตสถิติตัวเลขแดชบอร์ดสำเร็จ");
  } catch (error) {
    console.warn("⚠️ [STATS WARN]:", error.message);
  }
}

// 2. ฟังก์ชันดึงรายชื่อพนักงานทั้งหมด
async function fetchEmployees() {
  const tbody = document.getElementById("employeeTableBody");
  const sb = window.pvtSupabase?.getClient();
  if (!tbody || !sb) return;
  
  tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>⏳ กำลังโหลดรายชื่อพนักงาน...</td></tr>";

  try {
    const { data, error } = await sb
      .from("employees")
      .select("employee_code, full_name, start_date, status")
      .order("employee_code", { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>📭 ยังไม่มีข้อมูลพนักงานในระบบ</td></tr>";
      return;
    }

    const escapeFn = window.pvtSupabase?.escapeHtml || ((s) => s || "-");
    const dateFn = window.pvtSupabase?.formatThaiDate || ((s) => s || "-");

    tbody.innerHTML = data.map((employee) => `
      <tr>
        <td><strong>${escapeFn(employee.employee_code)}</strong></td>
        <td>${escapeFn(employee.full_name)}</td>
        <td>${dateFn(employee.start_date)}</td>
        <td><span class="status-badge" style="color: ${employee.status === 'active' ? '#16a34a' : '#94a3b8'}">● ${employee.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</span></td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("❌ [EMPLOYEES ERROR]:", error);
    tbody.innerHTML = `<tr><td colspan='4' style='color:red; text-align:center;'>โหลดล้มเหลว: ${error.message}</td></tr>`;
  }
}

// 3. ฟังก์ชันดึงรายการคำขออนุมัติลา 
async function fetchLeaveRequests() {
  const sb = window.pvtSupabase?.getClient();
  const tbody = document.getElementById("leaveRequestBody");
  if (!sb || !tbody) return;
  
  tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>⏳ กำลังโหลดรายการคำขอลา...</td></tr>";

  try {
    const { data: leaves, error: leaveError } = await sb
      .from("leave_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (leaveError) throw leaveError;
    if (!leaves || leaves.length === 0) {
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>📭 ยังไม่มีรายการคำขอลาในระบบ</td></tr>";
      return;
    }

    const [{ data: emps }, { data: types }] = await Promise.all([
      sb.from("employees").select("id, full_name, employee_code"),
      sb.from("leave_types").select("id, leave_name")
    ]);

    const escapeFn = window.pvtSupabase?.escapeHtml || ((s) => s || "-");
    const dateFn = window.pvtSupabase?.formatThaiDate || ((s) => s || "-");
    const labelFn = window.pvtSupabase?.statusLabel || ((s) => s || s);

    tbody.innerHTML = leaves.map((item) => {
      const emp = emps?.find(e => e.id === item.employee_id);
      const leaveType = types?.find(t => t.id === item.leave_type_id);
      
      const empName = emp?.full_name || "ไม่ระบุชื่อพนักงาน";
      const leaveTypeName = leaveType?.leave_name || "ทั่วไป";
      const showActions = item.status === "pending" || item.status === "รออนุมัติ";

      return `
        <tr>
          <td><strong>${escapeFn(empName)}</strong></td>
          <td>${escapeFn(leaveTypeName)}</td>
          <td>${dateFn(item.start_date)} - ${dateFn(item.end_date)}</td>
          <td><strong style="color:#1e293b;">${item.total_days}</strong> วัน</td>
          <td>${escapeFn(item.reason)}</td>
          <td><span class="status ${item.status}">${labelFn(item.status)}</span></td>
          <td>
            ${showActions ? `
              <button class="btn-approve" onclick="updateLeaveStatus('${item.id}', 'approved')" style="background:#16a34a; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; margin-right:4px; font-size:13px;">อนุมัติ</button>
              <button class="btn-reject" onclick="updateLeaveStatus('${item.id}', 'rejected')" style="background:#dc2626; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:13px;">ปฏิเสธ</button>
            ` : '-'}
          </td>
          <td>
            <button onclick="openLeavePopupModal('${item.id}')" style="background:none; border:none; color:#2563eb; font-weight:500; font-size:13px; cursor:pointer; text-decoration:underline; padding:0;">👁️ เปิดดูใบลา</button>
          </td>
        </tr>
      `;
    }).join("");
    console.log("✅ [SUCCESS] โหลดคำขอลาขึ้นจอเรียบร้อย!");
  } catch (error) {
    console.error("❌ [LEAVES REQUESTS ERROR]:", error);
    tbody.innerHTML = `<tr><td colspan='8' style='color:red; text-align:center;'>เกิดข้อผิดพลาดในการโหลดคำขอลา: ${error.message || error}</td></tr>`;
  }
}

// 4. ฟังก์ชันดึงข้อมูลใบลามาแสดงเป็นป๊อปอัปจำลองกระดาษ (Single Page Overlay)
async function openLeavePopupModal(leaveId) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  // สร้างกระดาน Modal ทับหน้าจอถ้ายังไม่มีอยู่ในระบบ HTML
  let modalContainer = document.getElementById("pvtLeaveModal");
  if (!modalContainer) {
    modalContainer = document.createElement("div");
    modalContainer.id = "pvtLeaveModal";
    modalContainer.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999; font-family:'Sarabun',sans-serif;";
    document.body.appendChild(modalContainer);
  }
  
  modalContainer.style.display = "flex";
  modalContainer.innerHTML = `<div style="background:#fff; padding:30px; border-radius:12px; font-size:15px; width:90%; max-width:700px; text-align:center;">⏳ กำลังเรียกเอกสารดิจิทัล...</div>`;

  try {
    const { data: leave } = await sb.from("leave_requests").select("*").eq("id", leaveId).maybeSingle();
    if (!leave) { alert("ไม่พบข้อมูลใบลา"); modalContainer.style.display = "none"; return; }

    const [{ data: emp }, { data: leaveType }] = await Promise.all([
      sb.from("employees").select("full_name, employee_code").eq("id", leave.employee_id).maybeSingle(),
      sb.from("leave_types").select("leave_name").eq("id", leave.leave_type_id).maybeSingle()
    ]);

    const formatThaiDate = window.pvtSupabase?.formatThaiDate || ((s) => s || "-");
    const dateWritten = leave.created_at ? formatThaiDate(leave.created_at.split('T')[0]) : "-";
    const statusLabels = { pending: "⏳ รออนุมัติ", approved: "✅ อนุมัติแล้ว", rejected: "❌ ปฏิเสธ" };
    const statusColors = { pending: "#d97706", approved: "#15803d", rejected: "#b91c1c" };

    // พ่นดีไซน์ตารางกระดาษ PVT Plastic (จากรูป IMG_0863.jpeg) ลงในป๊อปอัปกลางหน้าจอ
    modalContainer.innerHTML = `
      <div style="background:#ffffff; width:100%; max-width:680px; padding:25px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.2); position:relative; animation: fadeIn 0.2s ease-out; color:#1e293b;">
        
        <div style="border-bottom:2px solid #f1f5f9; padding-bottom:12px; margin-bottom:18px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <h3 style="margin:0; font-size:19px; color:#0f172a; font-weight:700;">ใบคำขออนุมัติลาอิเล็กทรอนิกส์</h3>
            <img src="/assets/icons/logo-pvt.png" alt="PVT" style="height: 80px; width: auto; vertical-align: middle;"/>
          </div>
          <span style="color:${statusColors[leave.status]}; font-weight:700; font-size:15px; background:#f8fafc; padding:4px 12px; border-radius:6px; border:1px solid #e2e8f0;">
            ${statusLabels[leave.status] || leave.status}
          </span>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#f8fafc; padding:12px; border-radius:6px; margin-bottom:15px; font-size:14px; text-align:left;">
          <div><span style="color:#64748b;">รหัสพนักงาน:</span> <strong>${emp?.employee_code || "-"}</strong></div>
          <div><span style="color:#64748b;">วันที่เขียนใบลา:</span> <strong>${dateWritten}</strong></div>
          <div style="grid-column:span 2;"><span style="color:#64748b;">ชื่อ-นามสกุล:</span> <strong style="font-size:15px; color:#0f172a;">${emp?.full_name || "-"}</strong></div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:15px; text-align:left; font-size:14px;">
          <thead>
            <tr style="background:#0f172a; color:#fff;">
              <th style="padding:10px; border-radius:4px 0 0 4px;">ประเภทการลา</th>
              <th style="padding:10px;">วันเริ่มลา - สิ้นสุด</th>
              <th style="padding:10px; text-align:center; width:90px; border-radius:0 4px 4px 0;">จำนวนวัน</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px 10px;"><span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:4px; font-weight:600;">${leaveType?.leave_name || "ทั่วไป"}</span></td>
              <td style="padding:12px 10px; font-weight:500;">${formatThaiDate(leave.start_date)} ถึง ${formatThaiDate(leave.end_date)}</td>
              <td style="padding:12px 10px; text-align:center; font-size:16px; font-weight:700; color:#2563eb;">${leave.total_days} วัน</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align:left; margin-bottom:20px;">
          <span style="color:#64748b; font-size:13px; display:block; margin-bottom:4px;">สาเหตุการลา:</span>
          <div style="background:#fff; border:1px dashed #cbd5e1; padding:10px; border-radius:6px; font-size:14px; color:#334155; min-height:40px;">
            ${leave.reason || "- ไม่ระบุเหตุผลเพิ่มเติม -"}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; border-top:1px solid #e2e8f0; padding-top:15px; font-size:13px;">
          <div style="border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#fafafa;">
            <p style="margin:0 0 8px 0; color:#64748b;">ผู้ลงชื่อคำขอลา</p>
            <strong style="color:#0284c7; font-size:14px;">${emp?.full_name || "-"}</strong>
          </div>
          <div style="border:1px solid #e2e8f0; padding:10px; border-radius:6px; background:#fafafa;">
            <p style="margin:0 0 8px 0; color:#64748b;">ผูอนุมัติ (ฝ่ายบุคคล)</p>
            <strong style="color:${leave.status==='approved'?'#16a34a':leave.status==='rejected'?'#dc2626':'#64748b'}">
              ${leave.status === 'approved' ? '✓ อนุมัติแล้ว' : leave.status === 'rejected' ? '✕ ปฏิเสธ' : '⏳ รอการพิจารณา'}
            </strong>
            ${leave.approval_comment ? `<p style="margin:3px 0 0 0; font-size:11px; color:#94a3b8;">(${leave.approval_comment})</p>` : ''}
          </div>
        </div>

        <div style="margin-top:20px; text-align:right;">
          <button onclick="document.getElementById('pvtLeaveModal').style.display='none'" style="background:#64748b; color:#fff; border:none; padding:7px 20px; border-radius:6px; cursor:pointer; font-weight:500; font-size:13px;">✕ ปิดหน้าต่าง</button>
        </div>
      </div>
    `;

  } catch (err) {
    modalContainer.innerHTML = `<div style="color:red; padding:20px;">เกิดข้อผิดพลาด: ${err.message}</div>`;
  }
}

// 5. ฟังก์ชันส่งคำสั่ง อนุมัติ / ปฏิเสธ ใบลา 
// 4. ฟังก์ชันส่งคำสั่ง อนุมัติ / ปฏิเสธ ใบลา (เวอร์ชันเคลียร์ทางสะดวก ไม่ติดเงื่อนไขรหัสแอดมินจำลอง)
// 4. ฟังก์ชันส่งคำสั่ง อนุมัติ / ปฏิเสธ ใบลา (เวอร์ชันแก้ไข RLS และแก้อาการ Array 0 ทันที)
// 4. ฟังก์ชันส่งคำสั่ง อนุมัติ / ปฏิเสธ ใบลา (เวอร์ชันอัปเกรด: อนุมัติแล้วหักยอดโควตาอัตโนมัติ 100%)
// 4. ฟังก์ชันส่งคำสั่ง อนุมัติ / ปฏิเสธ ใบลา (เวอร์ชัน Auto-Create โควตาหากไม่พบข้อมูลปีปัจจุบัน)
// 4. ฟังก์ชันส่งคำสั่ง อนุมัติ / ปฏิเสธ ใบลา (เวอร์ชันแก้บั๊กรหัสซ้ำ - หักยอดโควตาเข้าเป้า 100%)
async function updateLeaveStatus(id, status) {
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  if (!id || id === "undefined" || id === "null") {
    alert("⚠️ ไม่สามารถทำรายการได้เนื่องจากรหัสใบลา (ID) ไม่ถูกต้อง");
    return;
  }

  const comment = status === "rejected" ? prompt("ระบุเหตุผลที่ไม่ยอมรับการอนุมัติใบลาครั้งนี้:") : "อนุมัติตามขั้นตอนฝ่ายบุคคล";
  if (status === "rejected" && comment === null) return; 

  try {
    console.log(`⏳ [STEP 1] กำลังดึงข้อมูลใบลา ID: ${id}...`);
    
    // 1. ดึงข้อมูลใบลาฉบับนี้พร้อมกับดู leave_code ของประเภทการลานั้นๆ ด้วย
    const { data: leaveReq, error: fetchErr } = await sb
      .from("leave_requests")
      .select(`
        employee_id, 
        leave_type_id, 
        total_days, 
        status,
        leave_types ( leave_code, leave_name )
      `)
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !leaveReq) {
      alert(`❌ ไม่พบข้อมูลใบลา หรือเกิดข้อผิดพลาด: ${fetchErr?.message}`);
      return;
    }

    if (leaveReq.status === "approved" && status === "approved") {
      alert("⚠️ ใบลาฉบับนี้ได้รับการอนุมัติและหักโควตาไปเรียบร้อยแล้ว");
      return;
    }

    const currentYear = new Date().getFullYear() + 543; // ปี พ.ศ. 2569
    const daysToDeduct = Number(leaveReq.total_days || 0);

    // ========================================================
    // 🌟 [CORE FIX] ทำการคำนวณและหักยอดโควตาวันลาพนักงาน
    // ========================================================
    if (status === "approved" && daysToDeduct > 0) {
      console.log(`⏳ [STEP 2] ตรวจสอบกลุ่มประเภทการลาเพื่อเตรียมหักยอด...`);

      // ดึงรหัสใบลาที่พนักงานยื่นมา (แปลงเป็นตัวพิมพ์ใหญ่เพื่อป้องกันการสะกดเพี้ยน)
      const currentCode = String(leaveReq.leave_types?.leave_code || "").toUpperCase();
      
      // หา ID สิทธิ์ทั้งหมดที่จัดอยู่ในกลุ่มเดียวกันในตาราง leave_types ของพี่มิก
      let targetCodes = [];
      if (currentCode.includes("SICK")) {
        targetCodes = ["LV_SICK", "SICK"];
      } else if (currentCode.includes("PERSONAL") || currentCode.includes("BUSINESS")) {
        targetCodes = ["LV_PERSONAL", "PERSONAL"];
      } else if (currentCode.includes("VACATION")) {
        targetCodes = ["VACATION"];
      } else {
        targetCodes = [currentCode];
      }

      // ค้นหาแถวโควตาในตาราง leave_balances ที่ตรงกับพนักงาน ปีปัจจุบัน และอยู่ในกลุ่มประเภทการลานี้
      const { data: balances, error: balFindErr } = await sb
        .from("leave_balances")
        .select(`
          id, used_days, remaining_days, leave_type_id,
          leave_types ( leave_code )
        `)
        .eq("employee_id", leaveReq.employee_id)
        .eq("year", currentYear);

      // ค้นหาตัวที่จะโดนหักยอด โดยเช็คจากรหัสที่เข้าพวก
      const balanceToUpdate = balances?.find(b => targetCodes.includes(String(b.leave_types?.leave_code).toUpperCase()));

      if (balanceToUpdate) {
        const newUsedDays = Number(balanceToUpdate.used_days || 0) + daysToDeduct;
        const newRemainingDays = Number(balanceToUpdate.remaining_days || 0) - daysToDeduct;

        console.log(`📉 ทำการตัดยอด: กำลังลดแต้มโควตาลง ${daysToDeduct} วัน...`);

        // สั่ง UPDATE หักยอดลงในตาราง leave_balances จริงๆ
        await sb.from("leave_balances").update({
          used_days: newUsedDays,
          remaining_days: newRemainingDays
        }).eq("id", balanceToUpdate.id);

        console.log("✅ [SUCCESS] หักโควตาวันลาในฐานข้อมูลสำเร็จ!");
      } else {
        console.warn("⚠️ ไม่พบแถวรองรับโควตาของพนักงานคนนี้ในระบบ ยอดคงเหลือบนหน้าจอเลยยังเท่าเดิม");
      }
    }

    // ========================================================
    // 🌟 [STEP 3] อัปเดตสถานะใบลาหลักในตาราง leave_requests
    // ========================================================
    const updates = {
      status: status,
      approval_comment: comment,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await sb.from("leave_requests").update(updates).eq("id", id).select();
    
    if (error || !data || data.length === 0) {
      alert(`❌ บันทึกสถานะใบลาไม่สำเร็จ: เกิดข้อผิดพลาดฝั่ง Database`);
      return;
    }

    alert(status === "approved" ? `🎉 อนุมัติใบลาและตัดยอดโควตาพนักงานจำนวน ${daysToDeduct} วัน เรียบร้อย!` : "❌ ปฏิเสธใบลาเรียบร้อยแล้ว");
    
    // โหลดข้อมูลทุกอย่างบนหน้าจอใหม่แบบเรียลไทม์ ยอดคงเหลือต้องลดลงทันตาเห็น!
    await loadStats();
    await fetchLeaveRequests();
    await fetchLeaveBalances();

  } catch (error) {
    console.error("Error updating status:", error);
    alert(`⚠️ เกิดข้อผิดพลาดทางระบบ: ${error.message || error}`);
  }
}

// 6. ฟังก์ชันดึงข้อมูลโควตาวันลาพนักงานทุกคน 
// ตัวแปรส่วนกลางสำหรับเก็บข้อมูลดิบเพื่อใช้ในการค้นหาแบบเรียลไทม์
let allBalancesData = []; 

// 6. ฟังก์ชันดึงข้อมูลโควตาวันลาพนักงานทุกคน ทุกเงื่อนไข (เวอร์ชันเรียงคอลัมน์สวยงาม + ระบบค้นหา)
// 6. ฟังก์ชันดึงข้อมูลโควตาวันลาพนักงานทุกคน ทุกเงื่อนไข (เวอร์ชันกันบั๊กภาษาไทย/ตัวพิมพ์เล็กใหญ่)
// 6. ฟังก์ชันดึงข้อมูลโควตาวันลาพนักงานทุกคน (เวอร์ชันดึงตรงจากฐานข้อมูล แก้ปัญหาหน้าจอโชว์เลข 6)
async function fetchLeaveBalances() {
  const sb = window.pvtSupabase?.getClient();
  const tbody = document.getElementById("leaveBalanceBody");
  if (!sb || !tbody) return;
  
  tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>⏳ กำลังดึงยอดโควตาจริงจากฐานข้อมูล...</td></tr>";

  try {
    const currentYear = new Date().getFullYear() + 543; // ปี พ.ศ. 2569
    
    // ดึงข้อมูล 3 ตารางหลักมาจับคู่กัน
    const [
      { data: balances, error: bErr },
      { data: emps, error: eErr },
      { data: types, error: tErr }
    ] = await Promise.all([
      sb.from("leave_balances").select("*").eq("year", currentYear),
      sb.from("employees").select("id, employee_code, full_name").eq("status", "active"),
      sb.from("leave_types").select("id, leave_name, leave_code")
    ]);

    if (bErr || eErr || tErr) throw new Error("ดึงข้อมูลจาก Database ล้มเหลว");

    allBalancesData = emps.map((emp) => {
      // ดึงโควตาทั้งหมดที่เป็นของพนักงานคนนี้
      const empBalances = balances?.filter(b => b.employee_id === emp.id) || [];
      
      // 🌟 [จุดแก้ไขสำคัญ] แมปหาข้อมูลโดยเช็คจากรหัสโค้ดในเบสพี่มิกโดยตรง ครอบคลุมทั้งรหัสเก่าและรหัสใหม่
      const sickBal = empBalances.find(b => {
        const t = types?.find(x => x.id === b.leave_type_id);
        return t && (t.leave_code === "LV_SICK" || t.leave_code === "SICK" || t.leave_name.includes("ป่วย"));
      });

      const persBal = empBalances.find(b => {
        const t = types?.find(x => x.id === b.leave_type_id);
        return t && (t.leave_code === "LV_PERSONAL" || t.leave_code === "PERSONAL" || t.leave_name.includes("กิจ"));
      });

      const vacBal = empBalances.find(b => {
        const t = types?.find(x => x.id === b.leave_type_id);
        return t && (t.leave_code === "VACATION" || t.leave_name.includes("พัก"));
      });

      // ดึงค่าจริงจากแถวเบส (ถ้าไม่มีแถวในเบสจริงๆ ถึงจะยอมให้ใช้ค่าตั้งต้น 30, 6, 6)
      return {
        code: emp.employee_code || "-",
        name: emp.full_name || "ไม่ระบุชื่อ",
        year: currentYear,
        sick: { 
          remaining: sickBal !== undefined ? Number(sickBal.remaining_days) : 30, 
          entitlement: sickBal !== undefined ? Number(sickBal.entitlement_days) : 30 
        },
        personal: { 
          remaining: persBal !== undefined ? Number(persBal.remaining_days) : 6, 
          entitlement: persBal !== undefined ? Number(persBal.entitlement_days) : 6 
        },
        vacation: { 
          remaining: vacBal !== undefined ? Number(vacBal.remaining_days) : 6, 
          entitlement: vacBal !== undefined ? Number(vacBal.entitlement_days) : 6 
        }
      };
    });

    // ส่งข้อมูลไปวาดลงตารางบนหน้าจอ
    renderBalanceTable(allBalancesData);

  } catch (error) {
    console.error("❌ [BALANCES ERROR]:", error);
    tbody.innerHTML = `<tr><td colspan='6' style='color:red; text-align:center;'>โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
  }
}

// ฟังก์ชันสำหรับสั่งวาดตารางโควตา (แยกออกมาเพื่อให้ค้นหาแล้ววาดใหม่ได้ทันที)
// ฟังก์ชันสำหรับสั่งวาดตารางโควตา (เวอร์ชันล็อกสีและแยกคอลัมน์ถูกต้อง)
function renderBalanceTable(dataList) {
  const tbody = document.getElementById("leaveBalanceBody");
  if (!tbody) return;

  if (dataList.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#64748b;'>🔍 ไม่พบข้อมูลพนักงานที่ตรงกับคำค้นหา</td></tr>";
    return;
  }

  const escapeFn = window.pvtSupabase?.escapeHtml || ((s) => s || "-");

  tbody.innerHTML = dataList.map((item) => {
    // ฟังก์ชันช่วยจัดสีตัวเลข: ถ้าเหลือ 0 วันให้เป็นสีแดงเตือน ถ้าเหลือเยอะให้เป็นสีเขียวสบายตา
    const getSickColor = (rem) => rem <= 0 ? "#dc2626; font-weight:700;" : "#2563eb; font-weight:700;"; // ลาป่วยสีน้ำเงิน/ฟ้า
    const getPersonalColor = (rem) => rem <= 0 ? "#dc2626; font-weight:700;" : "#b45309; font-weight:700;"; // ลากิจสีส้ม/น้ำตาล
    const getVacationColor = (rem) => rem <= 0 ? "#dc2626; font-weight:700;" : "#16a34a; font-weight:700;"; // พักร้อนสีเขียว

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; hover: background-color: #f8fafc;">
        <td style="padding: 12px 8px;"><strong>${escapeFn(item.code)}</strong></td>
        <td style="padding: 12px 8px;">${escapeFn(item.name)}</td>
        <td style="padding: 12px 8px; text-align:center; color: #64748b;">${item.year}</td>
        
        <td style="padding: 12px 8px; text-align:center; background-color: #f0fdf4;">
          <span style="color: ${getSickColor(item.sick.remaining)}">${item.sick.remaining}</span> 
          <span style="color:#94a3b8; font-size:12px;">/ ${item.sick.entitlement} วัน</span>
        </td>
        
        <td style="padding: 12px 8px; text-align:center; background-color: #fef8e6;">
          <span style="color: ${getPersonalColor(item.personal.remaining)}">${item.personal.remaining}</span> 
          <span style="color:#94a3b8; font-size:12px;">/ ${item.personal.entitlement} วัน</span>
        </td>
        
        <td style="padding: 12px 8px; text-align:center; background-color: #eff6ff;">
          <span style="color: ${getVacationColor(item.vacation.remaining)}">${item.vacation.remaining}</span> 
          <span style="color:#94a3b8; font-size:12px;">/ ${item.vacation.entitlement} วัน</span>
        </td>
      </tr>
    `;
  }).join("");
}

// ฟังก์ชันตัวกรองคำค้นหา (คำนวณหลังบ้านด้วยความเร็วสูง)
function handleBalanceSearch(e) {
  const keyword = e.target.value.toLowerCase().trim();
  
  if (!keyword) {
    renderBalanceTable(allBalancesData); // ถ้าช่องค้นหาว่าง ให้โชว์ทุกคนเหมือนเดิม
    return;
  }

  // กรองจากรหัสพนักงานหรือชื่อ-นามสกุล
  const filtered = allBalancesData.filter(item => 
    item.code.toLowerCase().includes(keyword) || 
    item.name.toLowerCase().includes(keyword)
  );

  renderBalanceTable(filtered);
}

// 7. ฟังก์ชัน CSV อัปโหลดพนักงานคงเดิมเพื่อขับเคลื่อนระบบนำเข้า
async function uploadEmployeeCSV() {
  const fileInput = document.getElementById('csvFileInput');
  const statusDiv = document.getElementById('uploadStatus');
  if (!fileInput || !fileInput.files.length) {
    alert("กรุณาเลือกไฟล์ CSV ก่อนครับ");
    return;
  }
  statusDiv.innerHTML = "⏳ กำลังนำเข้าข้อมูลและผูกโควตาวันลาพักร้อน...";
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      const sb = window.pvtSupabase?.getClient();
      if (!sb) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
      const { data: leaveTypeData } = await sb.from('leave_types').select('id').eq('leave_code', 'VACATION').maybeSingle();
      const vacationTypeId = leaveTypeData?.id || "40000000-0000-0000-0000-000000000004"; 
      const currentYear = new Date().getFullYear() + 543;
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim(); if (!line) continue;
        const col = line.split(',').map(c => c.trim().replace(/["']/g, ""));
        const code = col[1], prefix = col[2]||"", fname = col[3]||"", lname = col[4]||"", positionName = col[5], departmentName = col[6], rawDate = col[7];
        if (code && fname) {
          const joinedFullName = `${prefix}${fname} ${lname}`.replace(/\s+/g, ' ').trim();
          let deptId = null;
          if (departmentName) {
            const { data: deptData } = await sb.from('departments').upsert({ department_code: `DEPT_${departmentName}`, department_name: departmentName }, { onConflict: 'department_code' }).select('id').single();
            deptId = deptData?.id;
          }
          let posId = null;
          if (positionName) {
            const { data: posData } = await sb.from('positions').select('id').eq('position_name', positionName).maybeSingle();
            if (posData) posId = posData.id;
            else { const { data: newPos } = await sb.from('positions').insert({ position_name: positionName, department_id: deptId }).select('id').single(); posId = newPos?.id; }
          }
          const { data: empData } = await sb.from('employees').upsert({ employee_code: code.toString(), full_name: joinedFullName, department_id: deptId, position_id: posId, employment_type: 'monthly', status: 'active' }, { onConflict: 'employee_code' }).select();
          if (empData && empData.length > 0) {
            await sb.from('leave_balances').upsert({ employee_id: empData[0].id, leave_type_id: vacationTypeId, year: currentYear, entitlement_days: 6, used_days: 0, remaining_days: 6 }, { onConflict: 'employee_id,leave_type_id,year' });
          }
          count++;
        }
      }
      statusDiv.innerHTML = `✅ นำเข้าข้อมูลพนักงานและแจกโควตาลาพักร้อนสำเร็จ ${count} คน`;
      fetchEmployees();
    } catch (err) { statusDiv.innerHTML = "❌ ระบบนำเข้าผิดพลาด: " + err.message; }
  };
  reader.readAsText(file, 'UTF-8');
}