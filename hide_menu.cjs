const fs = require('fs');
let code = fs.readFileSync('js/auth-guard.js', 'utf8');

const targetStr = `  // 🟢 แสดงปุ่มสลับโหมด ถ้ามีสิทธิ์`;
const injectStr = `  // 🚫 ตัดหน้าพนักงานออกจากเมนูสำหรับไอดี HR อนุมัติโดยตรง (HR-XXX)
  if (profileData && profileData.employee_code && profileData.employee_code.startsWith('HR-')) {
    const userLinks = document.querySelectorAll('a[href*="/pages/user/index-user.html"], a[href="/pages/user/index-user.html"]');
    userLinks.forEach(link => {
      link.style.display = 'none';
    });
  }

  // 🟢 แสดงปุ่มสลับโหมด ถ้ามีสิทธิ์`;

code = code.replace(targetStr, injectStr);
fs.writeFileSync('js/auth-guard.js', code);
