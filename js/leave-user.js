/**
 * leave-user.js — (เพิ่มสถานะพนักงาน, ชื่อเล่น, รพ. และระบบลาครึ่งวัน)
 */

console.log("📢 [SYSTEM] เปิดใช้งานระบบฟอร์มใบลา...");

const LEAVE_TYPES_CONFIG = [
  { id: "personal", leave_name: "ลากิจ", max: 6, used: 1 },         
  { id: "sick", leave_name: "ลาป่วย", max: 30, used: 2 },           
  { id: "vacation", leave_name: "ลาพักผ่อน", max: 6, used: 0 },
  { id: "funeral", leave_name: "ลางานศพ", max: 7, used: 0 },
  { id: "maternity", leave_name: "ลาคลอด", max: 120, used: 0 },
  { id: "ordination", leave_name: "ลาบวช", max: 30, used: 0 }
];

let currentProfile = null;
let cardCounter = 0; 

document.addEventListener("DOMContentLoaded", initLeaveFormPage);

async function initLeaveFormPage() {
  try {
    currentProfile = await window.pvtSupabase?.getCurrentProfile();
    
    if (!currentProfile || !currentProfile.employee_id) {
      console.log("🛠️ [DEV MODE] ใช้ Profile ทดสอบ...");
      currentProfile = {
        employee_id: "9a8036a8-3b03-4802-9520-59934fe621e3",
        display_name: "คุณมิกกี้ (IT Management)",
        employees: {
          employee_code: "EMP-009",
          full_name: "คุณมิกกี้ (IT Management)",
          nickname: "มิกกี้",                      // 🔥 ข้อมูลจำลองชื่อเล่น
          employee_type: "พนักงานประจำ",           // 🔥 ข้อมูลจำลองสถานะพนักงาน
          department_name: "Information Technology",
          position_name: "IT Infrastructure Manager",
          start_date: "2024-01-15",
          social_security_hospital: "รพ. มหาชัย"   // 🔥 ข้อมูลจำลอง รพ.
        }
      };
    }

    renderEmployeeHeader(currentProfile);
    addLeaveRow(); 
    
    const balEl = document.getElementById("leaveBalance");
    if (balEl) balEl.value = "กรุณาเลือกประเภทการลา";

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดตั้งค่าหน้าจอ:", error);
  }
}

// 🌟 ฟังก์ชันดึงข้อมูลพนักงานมาพ่นลงกล่องด้านบน (เพิ่มชื่อเล่น และสถานะ)
function renderEmployeeHeader(profile) {
  const emp = profile?.employees;
  
  const nameEl = document.getElementById("employeeName");
  const codeEl = document.getElementById("employeeCode");
  const deptEl = document.getElementById("employeeDepartment");
  const posEl = document.getElementById("employeePosition");
  const startEl = document.getElementById("employeeStartDate");
  const hospEl = document.getElementById("employeeHospital"); 
  const nickEl = document.getElementById("employeeNickname"); // 🌟 ดึงช่องชื่อเล่น
  const typeEl = document.getElementById("employeeType");     // 🌟 ดึงช่องสถานะพนักงาน

  if (nameEl) nameEl.textContent = emp?.full_name || profile?.display_name || "ไม่ระบุชื่อพนักงาน";
  if (codeEl) codeEl.value = emp?.employee_code || "-";
  if (deptEl) deptEl.value = emp?.department_name || "-";
  if (posEl) posEl.value = emp?.position_name || "-";
  
  if (nickEl) nickEl.value = emp?.nickname || "-";
  if (typeEl) typeEl.value = emp?.employee_type || "พนักงานประจำ"; // ตั้งค่า Default ให้ถ้าไม่มี
  if (hospEl) hospEl.value = emp?.social_security_hospital || "ไม่ระบุข้อมูล";
  
  if (startEl) {
    if (emp?.start_date) {
      const d = new Date(emp.start_date);
      startEl.value = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    } else {
      startEl.value = "-";
    }
  }
}

function addLeaveRow() {
  cardCounter++;
  const container = document.getElementById("leaveCardsList");
  if (!container) return;

  const cardHtml = document.createElement("div");
  cardHtml.className = "leave-box-item";
  cardHtml.id = `leaveCard_${cardCounter}`;
  cardHtml.style.cssText = "background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:20px; margin-bottom:18px; box-shadow:0 2px 4px rgba(0,0,0,0.02); transition: all 0.2s;";

  const optionsHtml = LEAVE_TYPES_CONFIG.map(t => `<option value="${t.id}">${t.leave_name}</option>`).join("");
  const todayDate = new Date().toISOString().split('T')[0];

  cardHtml.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:6px; color:var(--text); font-weight:600;">
        <span class="material-symbols-outlined" style="color:var(--primary); font-size:20px;">edit_document</span>
        <span>แบบฟอร์มคำขอลา #${cardCounter}</span>
      </div>
      <button type="button" class="btn-delete-card" onclick="removeLeaveRow(${cardCounter})" style="background:none; border:none; color:#ef4444; display:flex; align-items:center; gap:4px; font-size:13.5px; cursor:pointer; font-weight:500;">
        <span class="material-symbols-outlined" style="font-size:18px;">delete</span> ลบใบนี้
      </button>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px; margin-bottom:16px;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label style="font-weight:500; font-size:13.5px; color:var(--muted); margin:0;">ประเภทการลา <span style="color:red;">*</span></label>
          <span id="quotaBadge_${cardCounter}" style="display:none; font-size:12px; font-weight:600; color:#059669; background:#d1fae5; padding:2px 8px; border-radius:8px;">✅ คงเหลือ: - วัน</span>
        </div>
        <select name="leave_type_id" onchange="handleTypeSelection(this, ${cardCounter})" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-family:inherit; outline:none; background:#ffffff;" required>
          <option value="">-- กรุณาเลือกประเภท --</option>
          ${optionsHtml}
        </select>
      </div>
      <div>
        <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">วันที่เขียนใบลา</label>
        <input type="date" name="request_date" value="${todayDate}" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:8px; font-family:inherit; outline:none; background:#f8fafc; color:#64748b;" readonly>
      </div>
    </div>

    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:16px;">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:16px;">
        <div>
          <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">ตั้งแต่วันที่ <span style="color:red;">*</span></label>
          <input type="date" name="start_date" onchange="calculateDaysForCard(${cardCounter})" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:8px; font-family:inherit; outline:none;" required>
        </div>
        <div>
          <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">ถึงวันที่ <span style="color:red;">*</span></label>
          <input type="date" name="end_date" onchange="calculateDaysForCard(${cardCounter})" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:8px; font-family:inherit; outline:none;" required>
        </div>
      </div>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:12px; align-items: end;">
        <div>
          <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">มีกำหนด (วัน)</label>
          <input type="number" name="total_days" placeholder="0" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:8px; font-weight:bold; color:var(--primary); font-family:inherit; outline:none;" required>
        </div>
        <div>
          <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">จำนวน (ชั่วโมง)</label>
          <input type="number" name="leave_hours" placeholder="0" style="width:100%; padding:9px; border:1px solid var(--border); border-radius:8px; font-family:inherit; outline:none;">
        </div>
        <div>
          <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">ช่วงเวลา</label>
          <select name="leave_period" style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-family:inherit; outline:none; background:#ffffff;">
            <option value="full_day">เต็มวัน</option>
            <option value="morning">ครึ่งเช้า</option>
            <option value="afternoon">ครึ่งบ่าย</option>
          </select>
        </div>
      </div>
    </div>

    <div style="margin-bottom:16px;">
      <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">เนื่องจาก (เหตุผล) <span style="color:red;">*</span></label>
      <textarea name="reason" rows="2" placeholder="ระบุเหตุผลความจำเป็นในการลา..." style="width:100%; padding:10px; border:1px solid var(--border); border-radius:8px; font-family:inherit; resize:vertical; outline:none;" required></textarea>
    </div>
    
    <div style="margin-top:16px;">
       <label style="display:block; margin-bottom:6px; font-weight:500; font-size:13.5px; color:var(--muted);">แนบเอกสาร (เช่น ใบรับรองแพทย์)</label>
       <div style="border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px 16px; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s;" 
            onmouseover="this.style.borderColor='#2563eb'; this.style.background='#eff6ff';" 
            onmouseout="this.style.borderColor='#cbd5e1'; this.style.background='#f8fafc';" 
            onclick="document.getElementById('attach_${cardCounter}').click()">
            
          <span class="material-symbols-outlined" style="font-size:36px; color:#3b82f6; margin-bottom:8px;">cloud_upload</span>
          <div style="font-weight:600; font-size:14.5px; color:#1e293b;">คลิกเพื่อแนบไฟล์เอกสาร / รูปภาพ</div>
          <div style="font-size:12px; color:#64748b; margin-top:4px;">รองรับไฟล์ JPG, PNG, PDF ขนาดไม่เกิน 5MB</div>
          
          <input type="file" id="attach_${cardCounter}" name="attachment" accept="image/*,.pdf" style="display:none;" 
                 onchange="document.getElementById('fileName_${cardCounter}').innerHTML = '✅ เลือกไฟล์แล้ว: <b>' + this.files[0].name + '</b>'">
          
          <div id="fileName_${cardCounter}" style="font-size:13.5px; color:#059669; font-weight:500; margin-top:12px;"></div>
       </div>
    </div>
  `;

  container.appendChild(cardHtml);
  toggleDeleteButtonsVisibility();
}

function handleTypeSelection(selectElement, idNum) {
  const selectedId = selectElement.value;
  const typeConfig = LEAVE_TYPES_CONFIG.find(t => t.id === selectedId);
  const badge = document.getElementById(`quotaBadge_${idNum}`);
  const globalBalanceInput = document.getElementById("leaveBalance");
  
  if (typeConfig) {
    const remain = typeConfig.max - typeConfig.used; 
    if(badge) {
      badge.style.display = "inline-block";
      badge.innerHTML = `✅ คงเหลือ: <b>${remain}</b> วัน`;
    }
    if(globalBalanceInput) {
      globalBalanceInput.value = `${remain} วัน (${typeConfig.leave_name})`;
    }
  } else {
    if(badge) badge.style.display = "none";
    if(globalBalanceInput) globalBalanceInput.value = "กรุณาเลือกประเภทการลา";
  }
}

function removeLeaveRow(idNum) {
  const targetCard = document.getElementById(`leaveCard_${idNum}`);
  if (targetCard) targetCard.remove();
  toggleDeleteButtonsVisibility();
}

function toggleDeleteButtonsVisibility() {
  const allCards = document.querySelectorAll(".leave-box-item");
  allCards.forEach(card => {
    const deleteBtn = card.querySelector(".btn-delete-card");
    if (deleteBtn) deleteBtn.style.display = allCards.length <= 1 ? "none" : "flex";
  });
}

function calculateDaysForCard(idNum) {
  const card = document.getElementById(`leaveCard_${idNum}`);
  if (!card) return;
  const startInput = card.querySelector('input[name="start_date"]').value;
  const endInput = card.querySelector('input[name="end_date"]').value;
  const totalInput = card.querySelector('input[name="total_days"]');

  if (!startInput || !endInput) return;
  const d1 = new Date(startInput);
  const d2 = new Date(endInput);
  if (d2 < d1) { totalInput.value = "0"; return; }
  
  totalInput.value = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24)) + 1;
}

// 🌟 บันทึกคำขอลา ส่งเข้า DB
async function saveAllLeavesAtOnce() {
  const saveBtn = document.getElementById("btnSaveLeave");
  const sb = window.pvtSupabase?.getClient();
  if (!sb) return;

  const allCardElements = document.querySelectorAll(".leave-box-item");
  const payloadBatch = []; 
  let validationPass = true;

  allCardElements.forEach((card) => {
    const leaveTypeId = card.querySelector('select[name="leave_type_id"]').value;
    const requestDate = card.querySelector('input[name="request_date"]').value;
    const startDate = card.querySelector('input[name="start_date"]').value;
    const endDate = card.querySelector('input[name="end_date"]').value;
    const totalDays = card.querySelector('input[name="total_days"]').value;
    const leaveHours = card.querySelector('input[name="leave_hours"]').value;
    const leavePeriod = card.querySelector('select[name="leave_period"]').value;
    const reason = card.querySelector('textarea[name="reason"]').value.trim();

    // เช็ก Require
    if (!leaveTypeId || !startDate || !endDate || !totalDays || !reason) {
      validationPass = false;
      card.style.borderColor = "#ef4444"; 
    } else {
      card.style.borderColor = "#e2e8f0";
    }

    payloadBatch.push({
      employee_id: currentProfile.employee_id,
      leave_type_id: leaveTypeId,
      request_date: requestDate,          
      start_date: startDate,
      end_date: endDate,
      total_days: Number(totalDays || 0),
      leave_hours: Number(leaveHours || 0), 
      leave_period: leavePeriod,          
      reason: reason,
      status: "pending", 
      created_at: new Date().toISOString()
    });
  });

  if (!validationPass) {
    Swal.fire({ icon: 'warning', title: 'ข้อมูลไม่ครบถ้วน', text: 'กรุณากรอกข้อมูลให้ครบถ้วนก่อนส่งครับ' });
    return;
  }

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `⏳ กำลังบันทึกคำขอลา (${payloadBatch.length} ใบ)...`;
    }

    const { error } = await sb.from("leave_requests").insert(payloadBatch);
    if (error) throw error;

    Swal.fire({
      icon: 'success',
      title: 'ส่งใบลาสำเร็จ!',
      text: 'ระบบบันทึกเข้าระบบเรียบร้อยแล้ว',
      confirmButtonColor: '#10b981'
    }).then(() => {
      window.location.href = "/pages/user/leave-history.html";
    });

  } catch (err) {
    Swal.fire({ icon: 'error', title: 'บันทึกล้มเหลว', text: err.message });
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px;">save</span> บันทึกคำขอลา`;
    }
  }
}