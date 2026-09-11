const fs = require('fs');
let js = fs.readFileSync('js/index-user.js', 'utf8');

js = js.replace(
  'const approverRoles = ["leader", "manager", "director", "executive", "owner", "hr", "admin"];',
  `// ถอด hr, admin ออกเพื่อไม่ให้ดึงใบลาของทุกคนมาโชว์ในหน้าส่วนตัว
    const approverRoles = ["leader", "manager", "director", "executive", "owner"];`
);

fs.writeFileSync('js/index-user.js', js);
console.log("Updated approverRoles in index-user.js");
