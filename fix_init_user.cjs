const fs = require('fs');
let code = fs.readFileSync('js/index-user.js', 'utf8');

const targetStr = `  console.log("📌 [LIFECYCLE] โครงสร้าง HTML โหลดเสร็จสิ้น เริ่มต้นดึงข้อมูล...");
  await initUserHome();`;

const injectStr = `  console.log("📌 [LIFECYCLE] โครงสร้าง HTML โหลดเสร็จสิ้น เริ่มต้นดึงข้อมูล...");
  await initUserHome();
  
  // เปิดระบบ Realtime Notification 
  if (window.currentProfile && window.currentProfile.id) {
    setupRealtimeNotifications(window.currentProfile.id);
  }`;

code = code.replace(targetStr, injectStr);
fs.writeFileSync('js/index-user.js', code);
