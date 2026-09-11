const fs = require('fs');
let code = fs.readFileSync('js/auth-guard.js', 'utf8');

const oldLogic = `  let targetPath = "/pages/user/index-user.html";
  if (userStatus.category === 'hr_exec' || userStatus.category === 'leader_manager') {
    targetPath = "/pages/hr/home.html";
  } else {
    const adminRoles = ['executive', 'director', 'owner', 'hr', 'admin', 'superadmin', 'manager', 'leader', 'supervisor', 'head', 'ผู้บริหาร', 'ผู้อำนวยการ', 'เจ้าของ', 'หัวหน้า', 'ผู้จัดการ'];
    const isAdminRole = adminRoles.some(r => cleanRole.includes(r));
    if (isAdminRole) {
      targetPath = "/pages/hr/home.html";
    }
  }`;

const newLogic = `  let targetPath = "/pages/user/index-user.html";
  
  const empCode = String(userObj?.employee_code || userObj?.employees?.employee_code || '').trim();
  
  // บังคับทุกคนให้เริ่มที่หน้าพนักงานทั่วไปก่อน
  // ยกเว้นไอดีสำหรับ HR โดยตรง (HR-XXX) ให้ตรงไปหน้าบริหารทันที
  if (empCode.startsWith('HR-')) {
    targetPath = "/pages/hr/home.html";
  }`;

code = code.replace(oldLogic, newLogic);
fs.writeFileSync('js/auth-guard.js', code);
