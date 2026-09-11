const fs = require('fs');
let code = fs.readFileSync('js/index-user.js', 'utf8');

const targetFunc = `function parseNotificationMessage(title, msg) {`;

const newFunc = `function parseNotificationMessage(title, msg) {
  const cleanTitle = (title || 'แจ้งเตือนระบบ').trim();
  const rawMsg = (msg || '').trim();

  // ปรับ UI การแจ้งเตือนให้ดูง่ายและเหมาะกับมือถือ
  let badgeColor = "#0ea5e9";
  let bgColor = "#f0f9ff";
  let iconHtml = "📢";

  if (cleanTitle.includes("อนุมัติแล้ว") || cleanTitle.includes("✅")) {
    badgeColor = "#10b981";
    bgColor = "#ecfdf5";
    iconHtml = "✅";
  } else if (cleanTitle.includes("ไม่อนุมัติ") || cleanTitle.includes("ปฏิเสธ") || cleanTitle.includes("❌")) {
    badgeColor = "#ef4444";
    bgColor = "#fef2f2";
    iconHtml = "❌";
  } else if (cleanTitle.includes("คำขอใหม่") || cleanTitle.includes("📥")) {
    badgeColor = "#f59e0b";
    bgColor = "#fffbeb";
    iconHtml = "📥";
  }

  return {
    title: \`\${iconHtml} \${cleanTitle.replace(/^[❌✅📌🟢🎉📢⚠️📥\\s]+/, '').trim()}\`,
    bodyHtml: \`
      <div style="
        background: \${bgColor}; 
        border-left: 3px solid \${badgeColor}; 
        padding: 8px 12px; 
        border-radius: 4px; 
        margin-top: 4px; 
        font-size: 13px; 
        color: #334155; 
        line-height: 1.5;
      ">
        \${rawMsg.replace(/\\n/g, '<br>')}
      </div>
    \`
  };
}

// Old func replacement marker`;

code = code.replace(targetFunc, newFunc + "\n/* " + targetFunc);
fs.writeFileSync('js/index-user.js', code);
