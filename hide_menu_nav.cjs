const fs = require('fs');
let code = fs.readFileSync('js/auth-guard.js', 'utf8');

const targetStr = `function applyNavPermissions() {
  try {
    const raw = localStorage.getItem("currentUser");
    const session = raw ? JSON.parse(raw) : null;
    const userStatus = window.getUserRoleCategory(session);`;

const injectStr = `function applyNavPermissions() {
  try {
    const raw = localStorage.getItem("currentUser");
    const session = raw ? JSON.parse(raw) : null;
    const userStatus = window.getUserRoleCategory(session);
    
    // ตัดหน้าพนักงานออกสำหรับบัญชี HR โดยตรง
    const empCode = String(session?.employee_code || session?.employees?.employee_code || '').trim();
    if (empCode.startsWith('HR-')) {
      document.querySelectorAll('a[href*="/pages/user/index-user.html"]').forEach(el => {
        el.style.setProperty("display", "none", "important");
      });
    }`;

code = code.replace(targetStr, injectStr);
fs.writeFileSync('js/auth-guard.js', code);
