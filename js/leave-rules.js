/**
 * 📜 PVT HR Hub — leave-rules.js
 * ระบบจัดการหลักเกณฑ์และเงื่อนไขการลา (เพิ่ม, แก้ไข, ลบรายข้อ และบันทึกอัตโนมัติ)
 */

const STORAGE_KEY = "pvt_leave_rules_data";

// 🌟 รายการหลักเกณฑ์เริ่มต้น 11 ข้อ
const DEFAULT_LEAVE_RULES = [
  {
    id: "rule-1",
    title: "1. การลาป่วย",
    icon: "medical_services",
    themeColor: "#3b82f6",
    themeBg: "#eff6ff",
    themeBorder: "#bfdbfe",
    items: [
      { text: "ลาได้เท่าที่ป่วยจริง โดยได้รับค่าจ้างตามปกติ <b>ไม่เกิน 30 วันทำงาน/ปี</b>", isCaution: false },
      { text: "การลาป่วยตั้งแต่ 1 วันทำงานขึ้นไป ต้องนำส่งใบรับรองแพทย์แผนปัจจุบัน", isCaution: true },
      { text: "กรณีลาป่วยเท็จ จะถูกพิจารณาเป็นความผิดทางวินัยร้ายแรง", isCaution: false }
    ]
  },
  {
    id: "rule-2",
    title: "2. การลากิจเพื่อธุรกิจอันจำเป็น",
    icon: "assignment_ind",
    themeColor: "#10b981",
    themeBg: "#ecfdf5",
    themeBorder: "#a7f3d0",
    items: [
      { text: "ได้รับอนุมัติสิทธิลากิจโดยได้รับค่าจ้าง <b>ไม่เกิน 3 วันทำงาน/ปี</b>", isCaution: false },
      { text: "ต้องเป็นกิจธุระที่ต้องจัดการด้วยตนเอง และไม่สามารถทำนอกเวลางานได้", isCaution: false },
      { text: "ต้องส่งใบลาล่วงหน้าอย่างน้อย 1 วันทำการ (ยกเว้นกรณีฉุกเฉิน)", isCaution: false }
    ]
  },
  {
    id: "rule-3",
    title: "3. วันหยุดพักผ่อนประจำปี (ลาพักร้อน)",
    icon: "flight_takeoff",
    themeColor: "#f59e0b",
    themeBg: "#fffbeb",
    themeBorder: "#fde68a",
    items: [
      { text: "พนักงานที่ทำงานครบ 1 ปี มีสิทธิลาพักร้อนได้ <b>ไม่น้อยกว่า 6 วันทำการ/ปี</b>", isCaution: false },
      { text: "ต้องส่งล่วงหน้าเพื่อให้หัวหน้างานจัดสรรกำลังพลและอนุมัติก่อนเสมอ", isCaution: false }
    ]
  },
  {
    id: "rule-4",
    title: "4. การลาเพื่อการคลอดบุตร",
    icon: "child_care",
    themeColor: "#8b5cf6",
    themeBg: "#f5f3ff",
    themeBorder: "#ddd6fe",
    items: [
      { text: "พนักงานลาเพื่อคลอดบุตรได้ <b>ไม่เกิน 120 วัน</b> (รวมวันหยุดประจำสัปดาห์)", isCaution: false },
      { text: "บริษัทจ่ายค่าจ้างให้ตามปกติ 60 วัน และรับเงินอุดหนุนจากประกันสังคมอีก 60 วัน", isCaution: false },
      { text: "สามารถยื่นขอลาก่อนกำหนดคลอดจริงได้ตามความเหมาะสม", isCaution: false }
    ]
  },
  {
    id: "rule-5",
    title: "5. การลาเพื่อทำหมัน",
    icon: "vaccines",
    themeColor: "#ec4899",
    themeBg: "#fdf2f8",
    themeBorder: "#fbcfe8",
    items: [
      { text: "มีสิทธิลาหยุดได้ตามระยะเวลาที่แพทย์แผนปัจจุบันกำหนด", isCaution: false },
      { text: "ได้รับค่าจ้างในวันลานั้นเต็มจำนวนตามที่ระบุในใบรับรองแพทย์", isCaution: false },
      { text: "ต้องแจ้งและส่งใบลาล่วงหน้าพร้อมเอกสารจองนัดหมายแพทย์", isCaution: false }
    ]
  },
  {
    id: "rule-6",
    title: "6. การลาเพื่อรับราชการทหาร",
    icon: "military_tech",
    themeColor: "#06b6d4",
    themeBg: "#ecfeff",
    themeBorder: "#a5f3fc",
    items: [
      { text: "ลาเพื่อเข้ารับการเรียกพล ตรวจสอบ หรือฝึกภาคสนามตามหมายเรียกของทางราชการ", isCaution: false },
      { text: "ได้รับค่าจ้างตามปกติในระหว่างลา <b>ไม่เกิน 60 วัน/ปี</b>", isCaution: false },
      { text: "ต้องแนบสำเนาหมายเรียกพลประกอบการยื่นใบลาทันทีที่ได้รับเอกสาร", isCaution: false }
    ]
  },
  {
    id: "rule-7",
    title: "7. การลาเพื่อฌาปนกิจศพ",
    icon: "heart_broken",
    themeColor: "#6366f1",
    themeBg: "#eef2ff",
    themeBorder: "#c7d2fe",
    items: [
      { text: "กรณีคู่สมรส บุตร บิดา หรือมารดาเสียชีวิต สามารถใช้สิทธิลาได้ตามความเหมาะสม", isCaution: false },
      { text: "บริษัทมอบสิทธิลาพิเศษโดยได้รับค่าจ้าง (จำนวนวันตามโครงสร้างสวัสดิการบริษัท)", isCaution: false },
      { text: "ยื่นหลักฐาน เช่น ใบมรณบัตร ย้อนหลังได้ภายใน 7 วันหลังกลับเข้าปฏิบัติงาน", isCaution: false }
    ]
  },
  {
    id: "rule-8",
    title: "8. การลาอุปสมบท",
    icon: "temple_buddhist",
    themeColor: "#eab308",
    themeBg: "#fefce8",
    themeBorder: "#fef08a",
    items: [
      { text: "ได้รับค่าจ้างตามความเป็นจริง <b>ไม่เกิน 15 วัน</b> (ตลอดอายุงานใช้สิทธิได้เพียง 1 ครั้ง)", isCaution: false },
      { text: "ต้องขออนุมัติล่วงหน้าไม่น้อยกว่า 15 วัน และกลับเข้าทำงานภายใน 3 วันหลังลาสิกขาบท", isCaution: false }
    ]
  },
  {
    id: "rule-9",
    title: "9. การลาเพื่อฝึกอบรมพัฒนาความรู้",
    icon: "school",
    themeColor: "#14b8a6",
    themeBg: "#f0fdfa",
    themeBorder: "#99f6e4",
    items: [
      { text: "ลาเพื่อประโยชน์ต่อการจ้างงาน/สวัสดิการ หรือเพิ่มทักษะความชำนาญในตำแหน่งหน้าที่", isCaution: false },
      { text: "การลาเพื่อการศึกษาต่อของพนักงานเอง ไม่สามารถใช้สิทธิการลาประเภทนี้ได้", isCaution: true },
      { text: "ต้องแจ้งล่วงหน้าไม่น้อยกว่า 7 วัน และต้องได้รับอนุมัติจากผู้บริหารก่อนทุกครั้ง", isCaution: false }
    ]
  },
  {
    id: "rule-10",
    title: "10. กรอบเวลาการพิจารณาอนุมัติใบลา (SLA 2 วัน)",
    icon: "schedule",
    themeColor: "#ea580c",
    themeBg: "#fff7ed",
    themeBorder: "#fed7aa",
    items: [
      { text: "หัวหน้างาน (L1) และ ผู้จัดการ (L2) ต้องพิจารณาอนุมัติใบลา <b>ภายใน 2 วันทำการ</b> นับจากวันที่ยื่นคำขอ", isCaution: false },
      { text: "หากเกิน 2 วัน ระบบจะขึ้นสถานะ <b>\"เกินกำหนด\"</b> และแสดงข้อความ <i>\"ใบลาไม่ได้รับการพิจารณาในเวลาที่กำหนด\"</i>", isCaution: true },
      { text: "พนักงานสามารถติดตามสถานะหรือประสานงานหัวหน้า/HR เพื่อเร่งรัดการพิจารณาได้", isCaution: false }
    ]
  },
  {
    id: "rule-11",
    title: "ข้อควรระวัง & บทลงโทษทางวินัย",
    icon: "warning",
    themeColor: "#ef4444",
    themeBg: "#fef2f2",
    themeBorder: "#fecaca",
    isFullWidth: true,
    items: [
      { text: "พนักงานที่มาสาย <b>3 ครั้งภายในรอบเดือน</b> จะได้รับหนังสือเตือนเป็นลายลักษณ์อักษร", isCaution: true },
      { text: "การหยุดงานโดยไม่ส่งใบลา หรือใบลาไม่ได้รับการอนุมัติ ถือเป็นการขาดงานโดยเจตนา", isCaution: true },
      { text: "ขาดงานติดต่อกัน <b>3 วันทำงาน</b> โดยไม่มีเหตุอันสมควร บริษัทมีสิทธิ์เลิกจ้างทันทีโดยไม่จ่ายค่าชดเชย", isCaution: true }
    ]
  }
];

// ชุดจานสีสำหรับเลือก
const COLOR_PRESETS = [
  { name: "ฟ้า (Blue)", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
  { name: "เขียว (Emerald)", color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
  { name: "ส้มอำพัน (Amber)", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
  { name: "ม่วง (Purple)", color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe" },
  { name: "ชมพู (Pink)", color: "#ec4899", bg: "#fdf2f8", border: "#fbcfe8" },
  { name: "ฟ้าคราม (Cyan)", color: "#06b6d4", bg: "#ecfeff", border: "#a5f3fc" },
  { name: "น้ำเงินคราม (Indigo)", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  { name: "เหลือง (Yellow)", color: "#eab308", bg: "#fefce8", border: "#fef08a" },
  { name: "เขียวหัวเป็ด (Teal)", color: "#14b8a6", bg: "#f0fdfa", border: "#99f6e4" },
  { name: "ส้มเข้ม (Orange)", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  { name: "แดง (Red)", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" }
];

// โหลดข้อมูลจาก LocalStorage
function getLeaveRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading leave rules from storage:", e);
  }
  // ถ้าไม่มี ให้บันทึกชุดเริ่มต้น
  saveLeaveRules(DEFAULT_LEAVE_RULES);
  return JSON.parse(JSON.stringify(DEFAULT_LEAVE_RULES));
}

// บันทึกข้อมูลลง LocalStorage
function saveLeaveRules(rules) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.error("Error saving leave rules to storage:", e);
  }
}

// ตรวจสอบสิทธิ์ผู้ใช้ว่าเป็น Admin / HR หรือไม่
function isUserAdminOrHr() {
  try {
    const raw = localStorage.getItem("pvt_user_session") || localStorage.getItem("pvt_employee_session");
    if (!raw) return false;
    const session = JSON.parse(raw);
    const empCode = String(session?.employee_code || session?.employees?.employee_code || '').toLowerCase().trim();
    const role = String(session?.role || session?.employees?.role || '').toLowerCase().trim();
    if (typeof window.getUserRoleCategory === "function") {
      const cat = window.getUserRoleCategory(session);
      if (cat?.category === 'hr_exec') return true;
    }
    return (
      empCode === 'admin' ||
      empCode.startsWith('hr-') ||
      ['admin', 'superadmin', 'hr', 'hr_manager', 'executive', 'director', 'owner'].includes(role)
    );
  } catch (e) {
    return false;
  }
}

// Render รายการหลักเกณฑ์ทั้งหมด
function renderLeaveRules(filterKeyword = "") {
  const container = document.getElementById("rulesGridLayout");
  if (!container) return;

  const isAdmin = isUserAdminOrHr();

  // ซ่อน/แสดง ปุ่มการจัดการส่วนบน (เพิ่มข้อกำหนดใหม่ / คืนค่าเริ่มต้น) ตามสิทธิ์
  const actionsRight = document.querySelector(".rules-actions-right");
  if (actionsRight) {
    actionsRight.style.display = isAdmin ? "flex" : "none";
  }

  const rules = getLeaveRules();
  const kw = (filterKeyword || "").trim().toLowerCase();

  const filteredRules = kw
    ? rules.filter(r => {
        const inTitle = (r.title || "").toLowerCase().includes(kw);
        const inItems = (r.items || []).some(it => (it.text || "").toLowerCase().includes(kw));
        return inTitle || inItems;
      })
    : rules;

  if (filteredRules.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; background: #ffffff; border-radius: 16px; padding: 48px 24px; text-align: center; border: 1px dashed #cbd5e1;">
        <span class="material-symbols-outlined" style="font-size: 48px; color: #94a3b8; display: block; margin-bottom: 12px;">search_off</span>
        <h3 style="margin: 0 0 6px 0; color: #334155; font-size: 18px;">ไม่พบข้อมูลหลักเกณฑ์ที่ตรงกับคำค้นหา</h3>
        <p style="margin: 0; color: #64748b; font-size: 14px;">ลองค้นหาด้วยคำอื่น หรือกดปุ่ม "ล้างการค้นหา"</p>
        <button type="button" onclick="clearSearchRules()" style="margin-top: 16px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; color: #334155;">ล้างการค้นหา</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredRules.map((rule, idx) => {
    // หา index จริงใน rules array
    const originalIndex = rules.findIndex(r => r.id === rule.id);
    const themeColor = rule.themeColor || "#3b82f6";
    const themeBg = rule.themeBg || "#eff6ff";
    const themeBorder = rule.themeBorder || "#bfdbfe";
    const isFullWidth = !!rule.isFullWidth;

    const itemsHtml = (rule.items || []).map(it => {
      const isCaution = !!it.isCaution;
      return `<li class="${isCaution ? 'rule-caution' : ''}">${it.text}</li>`;
    }).join("");

    // ปุ่มแก้ไข/ลบ จะแสดงเฉพาะผู้ใช้ระดับ Admin/HR เท่านั้น
    const actionsGroupHtml = isAdmin ? `
      <div class="card-actions-group">
        <button type="button" class="btn-rule-action btn-rule-edit" onclick="openEditRuleModal(${originalIndex})" title="แก้ไขข้อนี้">
          <span class="material-symbols-outlined">edit</span>
          <span>แก้ไข</span>
        </button>
        <button type="button" class="btn-rule-action btn-rule-delete" onclick="handleDeleteRule(${originalIndex})" title="ลบข้อนี้">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
    ` : '';

    return `
      <article class="rule-box-card ${isFullWidth ? 'caution-box-layout caution-box-fullwidth' : ''}" 
        style="--theme-color: ${themeColor}; --theme-bg: ${themeBg}; --theme-border: ${themeBorder}; border-color: ${themeBorder}; border-top-color: ${themeColor};">
        
        <div class="card-header-bar">
          <div class="card-header-tag" style="background: ${themeColor}; box-shadow: 0 4px 12px -3px ${themeColor};">
            <span class="material-symbols-outlined">${escapeHtml(rule.icon || 'description')}</span>
            <span class="rule-title-label">${escapeHtml(rule.title || '')}</span>
          </div>

          ${actionsGroupHtml}
        </div>

        <ul class="rule-list-item">
          ${itemsHtml}
        </ul>
      </article>
    `;
  }).join("");
}

// ฟังก์ชัน Escape HTML เพื่อความปลอดภัย
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 🟢 เพิ่มข้อกำหนดใหม่
function openAddRuleModal() {
  const rules = getLeaveRules();
  const nextNum = rules.length + 1;

  const colorOptionsHtml = COLOR_PRESETS.map((p, i) => `
    <option value="${i}">${p.name}</option>
  `).join("");

  Swal.fire({
    title: `<div style="display:flex; align-items:center; gap:8px; font-size:19px; color:#0f172a; font-weight:700;"><span class="material-symbols-outlined" style="color:#0d9488; font-size:24px;">add_circle</span> เพิ่มข้อกำหนด / กฎระเบียบใหม่</div>`,
    html: `
      <div style="text-align: left; display: flex; flex-direction: column; gap: 14px; font-family: 'Sarabun', sans-serif;">
        <div class="rule-form-group">
          <label class="rule-form-label">หัวข้อ / ชื่อข้อกำหนด <span style="color: #ef4444;">*</span></label>
          <input type="text" id="swalRuleTitle" class="rule-form-input" placeholder="เช่น ${nextNum}. การลาพิเศษ..." value="${nextNum}. " style="margin: 0; width: 100%; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 10px 14px !important; font-size: 14px !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="rule-form-group">
            <label class="rule-form-label">ไอคอน (Material Symbol)</label>
            <input type="text" id="swalRuleIcon" class="rule-form-input" placeholder="เช่น info, description" value="info" style="margin: 0; width: 100%; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 10px 14px !important; font-size: 13.5px !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important;" />
          </div>
          <div class="rule-form-group">
            <label class="rule-form-label">สีธีมการ์ด</label>
            <select id="swalRuleColor" class="rule-form-select" style="margin: 0; width: 100%; height: 44px; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 0 12px !important; font-size: 13.5px !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important;">
              ${colorOptionsHtml}
            </select>
          </div>
        </div>

        <div class="rule-form-group">
          <label class="rule-form-label" style="justify-content: space-between; flex-wrap: wrap;">
            <span>รายละเอียดเงื่อนไข / ข้อย่อย <span style="color: #ef4444;">*</span></span>
            <span style="font-size: 11.5px; font-weight: normal; color: #64748b;">(1 บรรทัด = 1 ข้อย่อย, ใส่ <b>[ระวัง]</b> เพื่อทำแถบแดง, ใส่ <b>**คำ**</b> เพื่อทำตัวหนา)</span>
          </label>
          <textarea id="swalRuleItems" class="rule-form-textarea" placeholder="พิมพ์ข้อความเงื่อนไขที่นี่...&#10;ข้อกำหนดบรรทัดที่ 1&#10;[ระวัง] ข้อควรระวังข้อความเตือน..." style="margin: 0; width: 100%; min-height: 140px; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 12px 14px !important; font-size: 13.5px !important; line-height: 1.6 !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important; resize: vertical !important;"></textarea>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <input type="checkbox" id="swalRuleFullWidth" style="width: 17px; height: 17px; cursor: pointer; accent-color: #0d9488;" />
          <label for="swalRuleFullWidth" style="font-size: 13.5px; color: #334155; cursor: pointer; user-select: none;">แสดงเป็นการ์ดยาวเต็มหน้า (Full width)</label>
        </div>
      </div>
    `,
    customClass: {
      popup: "rule-modal-popup"
    },
    width: "620px",
    showCancelButton: true,
    confirmButtonText: "บันทึกข้อกำหนด",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#0d9488",
    cancelButtonColor: "#94a3b8",
    focusConfirm: false,
    preConfirm: () => {
      const title = document.getElementById("swalRuleTitle").value.trim();
      const icon = document.getElementById("swalRuleIcon").value.trim() || "description";
      const colorIdx = parseInt(document.getElementById("swalRuleColor").value, 10) || 0;
      const rawItems = document.getElementById("swalRuleItems").value.trim();
      const isFullWidth = document.getElementById("swalRuleFullWidth").checked;

      if (!title) {
        Swal.showValidationMessage("กรุณาระบุหัวข้อข้อกำหนด");
        return false;
      }
      if (!rawItems) {
        Swal.showValidationMessage("กรุณาระบุรายละเอียดข้อกำหนดย่อยอย่างน้อย 1 ข้อ");
        return false;
      }

      const preset = COLOR_PRESETS[colorIdx] || COLOR_PRESETS[0];
      const lines = rawItems.split("\n").map(l => l.trim()).filter(Boolean);
      const items = lines.map(line => {
        let isCaution = false;
        let text = line;
        if (text.startsWith("[ระวัง]")) {
          isCaution = true;
          text = text.replace("[ระวัง]", "").trim();
        }
        text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        return { text, isCaution };
      });

      return {
        id: "rule-" + Date.now(),
        title,
        icon,
        themeColor: preset.color,
        themeBg: preset.bg,
        themeBorder: preset.border,
        isFullWidth,
        items
      };
    }
  }).then(res => {
    if (res.isConfirmed && res.value) {
      const currentRules = getLeaveRules();
      currentRules.push(res.value);
      saveLeaveRules(currentRules);
      refreshRulesUI();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "เพิ่มข้อกำหนดใหม่สำเร็จแล้ว",
        showConfirmButton: false,
        timer: 1800
      });
    }
  });
}

// ✏️ แก้ไขข้อกำหนด
function openEditRuleModal(index) {
  const rules = getLeaveRules();
  const rule = rules[index];
  if (!rule) return;

  // หา preset สีที่ตรงกัน
  let matchedColorIdx = COLOR_PRESETS.findIndex(p => p.color.toLowerCase() === (rule.themeColor || "").toLowerCase());
  if (matchedColorIdx === -1) matchedColorIdx = 0;

  const colorOptionsHtml = COLOR_PRESETS.map((p, i) => `
    <option value="${i}" ${i === matchedColorIdx ? "selected" : ""}>${p.name}</option>
  `).join("");

  // แปลง items กลับเป็นข้อความ textarea โดยแปลง <b>...</b> เป็น **...** เพื่อให้อ่านง่าย สะอาดตา
  const itemsText = (rule.items || []).map(it => {
    let clean = (it.text || "").replace(/<b>(.*?)<\/b>/gi, "**$1**").replace(/<\/?b>/gi, "");
    return (it.isCaution ? "[ระวัง] " : "") + clean;
  }).join("\n");

  Swal.fire({
    title: `<div style="display:flex; align-items:center; gap:8px; font-size:19px; color:#0f172a; font-weight:700;"><span class="material-symbols-outlined" style="color:#2563eb; font-size:24px;">edit_note</span> แก้ไขข้อกำหนด: ${escapeHtml(rule.title)}</div>`,
    html: `
      <div style="text-align: left; display: flex; flex-direction: column; gap: 14px; font-family: 'Sarabun', sans-serif;">
        <div class="rule-form-group">
          <label class="rule-form-label">หัวข้อ / ชื่อข้อกำหนด <span style="color: #ef4444;">*</span></label>
          <input type="text" id="swalEditTitle" class="rule-form-input" value="${escapeHtml(rule.title || '')}" style="margin: 0; width: 100%; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 10px 14px !important; font-size: 14px !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="rule-form-group">
            <label class="rule-form-label">ไอคอน (Material Symbol)</label>
            <input type="text" id="swalEditIcon" class="rule-form-input" value="${escapeHtml(rule.icon || 'description')}" style="margin: 0; width: 100%; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 10px 14px !important; font-size: 13.5px !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important;" />
          </div>
          <div class="rule-form-group">
            <label class="rule-form-label">สีธีมการ์ด</label>
            <select id="swalEditColor" class="rule-form-select" style="margin: 0; width: 100%; height: 44px; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 0 12px !important; font-size: 13.5px !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important;">
              ${colorOptionsHtml}
            </select>
          </div>
        </div>

        <div class="rule-form-group">
          <label class="rule-form-label" style="justify-content: space-between; flex-wrap: wrap;">
            <span>รายละเอียดเงื่อนไข / ข้อย่อย <span style="color: #ef4444;">*</span></span>
            <span style="font-size: 11.5px; font-weight: normal; color: #64748b;">(1 บรรทัด = 1 ข้อย่อย, ใส่ <b>[ระวัง]</b> เพื่อทำแถบแดง, ใส่ <b>**คำ**</b> เพื่อทำตัวหนา)</span>
          </label>
          <textarea id="swalEditItems" class="rule-form-textarea" style="margin: 0; width: 100%; min-height: 150px; border-radius: 8px !important; border: 1.5px solid #cbd5e1 !important; padding: 12px 14px !important; font-size: 13.5px !important; line-height: 1.6 !important; font-family: inherit !important; box-sizing: border-box !important; background: #ffffff !important; resize: vertical !important;">${escapeHtml(itemsText)}</textarea>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <input type="checkbox" id="swalEditFullWidth" ${rule.isFullWidth ? "checked" : ""} style="width: 17px; height: 17px; cursor: pointer; accent-color: #2563eb;" />
          <label for="swalEditFullWidth" style="font-size: 13.5px; color: #334155; cursor: pointer; user-select: none;">แสดงเป็นการ์ดยาวเต็มหน้า (Full width)</label>
        </div>
      </div>
    `,
    customClass: {
      popup: "rule-modal-popup"
    },
    width: "620px",
    showCancelButton: true,
    confirmButtonText: "บันทึกการแก้ไข",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#2563eb",
    cancelButtonColor: "#94a3b8",
    focusConfirm: false,
    preConfirm: () => {
      const title = document.getElementById("swalEditTitle").value.trim();
      const icon = document.getElementById("swalEditIcon").value.trim() || "description";
      const colorIdx = parseInt(document.getElementById("swalEditColor").value, 10) || 0;
      const rawItems = document.getElementById("swalEditItems").value.trim();
      const isFullWidth = document.getElementById("swalEditFullWidth").checked;

      if (!title) {
        Swal.showValidationMessage("กรุณาระบุหัวข้อข้อกำหนด");
        return false;
      }
      if (!rawItems) {
        Swal.showValidationMessage("กรุณาระบุรายละเอียดข้อกำหนดย่อยอย่างน้อย 1 ข้อ");
        return false;
      }

      const preset = COLOR_PRESETS[colorIdx] || COLOR_PRESETS[0];
      const lines = rawItems.split("\n").map(l => l.trim()).filter(Boolean);
      const items = lines.map(line => {
        let isCaution = false;
        let text = line;
        if (text.startsWith("[ระวัง]")) {
          isCaution = true;
          text = text.replace("[ระวัง]", "").trim();
        }
        text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        return { text, isCaution };
      });

      return {
        ...rule,
        title,
        icon,
        themeColor: preset.color,
        themeBg: preset.bg,
        themeBorder: preset.border,
        isFullWidth,
        items
      };
    }
  }).then(res => {
    if (res.isConfirmed && res.value) {
      rules[index] = res.value;
      saveLeaveRules(rules);
      refreshRulesUI();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "บันทึกการแก้ไขข้อกำหนดสำเร็จ",
        showConfirmButton: false,
        timer: 1800
      });
    }
  });
}

// 🗑️ ลบข้อกำหนด
function handleDeleteRule(index) {
  const rules = getLeaveRules();
  const rule = rules[index];
  if (!rule) return;

  Swal.fire({
    title: "ยืนยันการลบข้อกำหนด?",
    html: `คุณต้องการลบ <b>"${escapeHtml(rule.title)}"</b> ออกจากหน้านี้ใช่หรือไม่?<br><span style="color:#ef4444; font-size:13px;">การกระทำนี้จะลบรายการออกจากหน้าจอทันที</span>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ใช่, ลบข้อนี้",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#94a3b8"
  }).then(res => {
    if (res.isConfirmed) {
      rules.splice(index, 1);
      saveLeaveRules(rules);
      refreshRulesUI();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "ลบข้อกำหนดเรียบร้อยแล้ว",
        showConfirmButton: false,
        timer: 1800
      });
    }
  });
}

// 🔄 คืนค่าเริ่มต้นทั้งหมด
function resetLeaveRulesToDefault() {
  Swal.fire({
    title: "คืนค่าหลักเกณฑ์เริ่มต้น?",
    text: "ระบบจะรีเซ็ตข้อกำหนดทั้งหมดกลับเป็น 11 ข้อมาตรฐานดั้งเดิม คุณแน่ใจหรือไม่?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "ใช่, คืนค่าเริ่มต้น",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#0d9488",
    cancelButtonColor: "#94a3b8"
  }).then(res => {
    if (res.isConfirmed) {
      saveLeaveRules(DEFAULT_LEAVE_RULES);
      refreshRulesUI();

      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "คืนค่าหลักเกณฑ์เริ่มต้นสำเร็จ",
        showConfirmButton: false,
        timer: 1800
      });
    }
  });
}

// 🔄 อัปเดต UI หน้าจอหลังมีการเปลี่ยนแปลงข้อมูล
function refreshRulesUI() {
  if (document.getElementById("rulesGridLayout")) {
    renderLeaveRules();
  } else if (typeof window.openLeaveRulesManagerModal === "function") {
    openLeaveRulesManagerModal();
  }
}

// 🛠️ ป๊อปอัปสำหรับแอดมินจัดการเงื่อนไขการลาในหน้าส่วนกลาง HR (management.html)
function openLeaveRulesManagerModal() {
  const rules = getLeaveRules();

  const rulesListHtml = rules.map((r, idx) => {
    const itemCount = (r.items || []).length;
    const themeColor = r.themeColor || '#3b82f6';
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 10px; margin-bottom: 8px; gap: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); text-align: left;">
        <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
          <div style="width: 34px; height: 34px; border-radius: 8px; background: ${themeColor}15; color: ${themeColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <span class="material-symbols-outlined" style="font-size: 20px;">${escapeHtml(r.icon || 'description')}</span>
          </div>
          <div style="min-width: 0;">
            <div style="font-weight: 700; font-size: 13.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.title)}</div>
            <div style="font-size: 11.5px; color: #64748b;">${itemCount} ข้อเงื่อนไข ${r.isFullWidth ? '• (การ์ดยาวเต็มหน้า)' : ''}</div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
          <button type="button" onclick="openEditRuleModal(${idx})" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 6px; padding: 5px 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="แก้ไขข้อนี้">
            <span class="material-symbols-outlined" style="font-size: 16px;">edit</span> แก้ไข
          </button>
          <button type="button" onclick="handleDeleteRule(${idx})" style="background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 6px; padding: 5px 8px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center;" title="ลบข้อนี้">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  Swal.fire({
    title: `<div style="display:flex; align-items:center; gap:8px; font-size:18.5px; color:#0f172a; font-weight:700;"><span class="material-symbols-outlined" style="color:#0d9488; font-size:24px;">gavel</span> จัดการเงื่อนไขการลา (/pages/user/leave-rules.html)</div>`,
    html: `
      <div style="text-align: left; font-family: 'Sarabun', sans-serif;">
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #64748b;">เพิ่ม แก้ไข หรือลบข้อกำหนดการลา ข้อมูลจะถูกบันทึกและอัปเดตไปแสดงผลที่หน้า <b>"หลักเกณฑ์และเงื่อนไขการลา"</b> สำหรับพนักงานทันที</p>
        <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
          <button type="button" onclick="openAddRuleModal()" style="background: #0d9488; color: #ffffff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 6px rgba(13,148,136,0.3);">
            <span class="material-symbols-outlined" style="font-size: 18px;">add_circle</span> เพิ่มหัวข้อ/เงื่อนไขใหม่
          </button>
          <button type="button" onclick="resetLeaveRulesToDefault()" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <span class="material-symbols-outlined" style="font-size: 18px;">restart_alt</span> คืนค่าเริ่มต้น (11 ข้อ)
          </button>
          <a href="/pages/user/leave-rules.html" target="_blank" style="margin-left: auto; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; text-decoration: none;">
            <span class="material-symbols-outlined" style="font-size: 18px;">open_in_new</span> ดูหน้าแสดงผลจริง
          </a>
        </div>
        <div style="max-height: 380px; overflow-y: auto; padding-right: 4px;">
          ${rulesListHtml || '<div style="text-align:center; padding:24px; color:#94a3b8; font-size:14px;">ยังไม่มีข้อมูลข้อกำหนด</div>'}
        </div>
      </div>
    `,
    width: "700px",
    showConfirmButton: false,
    showCancelButton: true,
    cancelButtonText: "ปิดหน้าต่าง",
    cancelButtonColor: "#94a3b8"
  });
}

// ค้นหา
function filterRulesByInput() {
  const input = document.getElementById("searchRulesInput");
  const val = input ? input.value : "";
  renderLeaveRules(val);
}

function clearSearchRules() {
  const input = document.getElementById("searchRulesInput");
  if (input) input.value = "";
  renderLeaveRules("");
}

// ปรับเปลี่ยน Sidebar และการนำทางตามบทบาทผู้ใช้
function setupSidebarForUserRole() {
  const isAdmin = isUserAdminOrHr();
  const sidebarNav = document.querySelector(".sidebar-menu");
  
  if (isAdmin) {
    if (sidebarNav) {
      sidebarNav.innerHTML = `
        <a href="/pages/hr/home.html" class="menu-item">
          <img src="/assets/icons/home-dashboard.svg" alt="หน้าหลัก" class="nav-icon-custom" />
          <span>หน้าหลัก (Admin)</span>
        </a>
        <a href="/pages/hr/hr.html" class="menu-item">
          <img src="/assets/icons/leave-document.svg" alt="ตรวจใบลา" class="nav-icon-custom" />
          <span>ตรวจใบลา</span>
        </a>
        <a href="/pages/hr/management.html" class="menu-item">
          <img src="/assets/icons/management-gear.svg" alt="ส่วนกลาง" class="nav-icon-custom" />
          <span>จัดการส่วนกลาง</span>
        </a>
        <a href="/pages/user/leave-stats.html" class="menu-item">
          <img src="/assets/icons/analytics-dashboard.svg" alt="สถิติวันลา" class="nav-icon-custom" />
          <span>สถิติวันลา</span>
        </a>
        <a href="/pages/hr/holidays.html" class="menu-item">
          <img src="/assets/icons/calendar-event.svg" alt="ปฏิทิน" class="nav-icon-custom" />
          <span>จัดการวันหยุด</span>
        </a>
        <a href="/pages/user/leave-rules.html" class="menu-item active" title="เงื่อนไขการลา">
          <img src="/assets/icons/leave-policy.svg" alt="กฎระเบียบ" class="nav-icon-custom" />
          <span>เงื่อนไขการลา</span>
        </a>
        <a href="/pages/hr/news-management.html" class="menu-item">
          <img src="/assets/icons/news-announcement.svg" alt="ข่าวสาร" class="nav-icon-custom" />
          <span>ข่าวสาร</span>
        </a>
        <a href="/pages/hr/employee-cards.html" class="menu-item">
          <img src="/assets/icons/employee-card-badge.svg" alt="บัตรพนักงาน" class="nav-icon-custom" />
          <span>บัตรพนักงาน</span>
        </a>
      `;
    }

    // ซ่อน CTA ยื่นใบลาสำหรับแอดมิน
    const ctaWrap = document.querySelector(".sidebar-cta-wrap");
    if (ctaWrap) ctaWrap.style.display = "none";

    // ปรับปุ่ม ย้อนกลับ หน้า Header ให้พากลับ /pages/hr/home.html
    const backBtn = document.querySelector(".btn-header-back");
    if (backBtn) {
      backBtn.onclick = () => {
        if (window.history.length > 1 && document.referrer && !document.referrer.includes('/pages/user/')) {
          window.history.back();
        } else {
          window.location.href = '/pages/hr/home.html';
        }
      };
    }
  }
}

// ทำให้เข้าถึงฟังก์ชันได้ทั่วทั้งหน้าต่าง (Window Scope)
window.openAddRuleModal = openAddRuleModal;
window.openEditRuleModal = openEditRuleModal;
window.handleDeleteRule = handleDeleteRule;
window.resetLeaveRulesToDefault = resetLeaveRulesToDefault;
window.openLeaveRulesManagerModal = openLeaveRulesManagerModal;
window.filterRulesByInput = filterRulesByInput;
window.clearSearchRules = clearSearchRules;

// ทำงานทันทีเมื่อโหลดหน้าเสร็จ
document.addEventListener("DOMContentLoaded", () => {
  setupSidebarForUserRole();
  renderLeaveRules();
});
