const fs = require('fs');
let html = fs.readFileSync('pages/user/leave-history.html', 'utf8');

html = html.replace(/<link rel="stylesheet" href="\/css\/leave-sla-tracker.css" \/>/g, '');
html = html.replace(/<script src="\/js\/components\/leave-sla-tracker.js"><\/script>/g, '');
html = html.replace(/<!-- ⏱️ SLA COUNTDOWN TRACKER \(IF PENDING LEAVES EXIST\) -->\s*<div id="userLeaveSlaTrackerContainer"><\/div>/g, '');

fs.writeFileSync('pages/user/leave-history.html', html);
console.log("HTML updated.");

let js = fs.readFileSync('js/leave-history.js', 'utf8');

const jsTarget = `    // ⏱️ แสดงผล 2-Day SLA Countdown Tracker สำหรับใบลาที่รออนุมัติของพนักงาน
    if (typeof window.renderLeaveSlaTracker === 'function') {
      const pendingLeaves = (myLeaveRows || []).filter(r => r.status === 'pending' || r.status === 'รออนุมัติ').map(r => ({
        ...r,
        user_name: myProfile?.name || myProfile?.employees?.full_name || 'ฉัน (ผู้ยื่นคำขอ)',
        employee_code: myProfile?.employee_code || myProfile?.employees?.employee_code || '',
        department: myProfile?.department || myProfile?.employees?.departments?.department_name || '',
        avatar_url: myProfile?.image_url || myProfile?.employees?.image_url || '/assets/img/default-avatar.jpg'
      }));
      window.renderLeaveSlaTracker('userLeaveSlaTrackerContainer', pendingLeaves, myProfile?.employee_code);
    }`;

js = js.replace(jsTarget, '');
fs.writeFileSync('js/leave-history.js', js);
console.log("JS updated.");
