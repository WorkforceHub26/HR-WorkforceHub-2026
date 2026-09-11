const fs = require('fs');

const files = [
  'pages/user/leave-rules.html',
  'pages/user/leave-user.html',
  'pages/user/index-user.html',
  'pages/user/leave-stats.html',
  'pages/user/holidays.html',
  'pages/user/profile-user.html',
  'pages/user/leave-history.html',
  'pages/user/news.html',
  'pages/hr/home.html',
  'pages/hr/management.html',
  'pages/hr/news-management.html',
  'pages/hr/leave-stats.html',
  'pages/hr/hr.html'
];

const svgSettingsImg = `<img src="/assets/icons/settings.svg" alt="ตั้งค่า" style="width: 18px; height: 18px; vertical-align: middle; margin-right: 4px; display: inline-block;" /> ตั้งค่า`;

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // Replace text like "️ ตั้งค่า" or "⚙️ ตั้งค่า"
  html = html.replace(/️\s*ตั้งค่า/g, svgSettingsImg);
  html = html.replace(/⚙️\s*ตั้งค่า/g, svgSettingsImg);

  fs.writeFileSync(filePath, html);
});

console.log("Updated settings buttons with SVG icons.");
