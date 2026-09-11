const fs = require('fs');

const files = [
  'pages/user/index-user.html',
  'pages/user/profile-user.html',
  'pages/user/leave-history.html',
  'pages/user/holidays.html',
  'pages/user/news.html',
  'pages/user/leave-rules.html',
  'pages/user/leave-user.html',
  'pages/user/leave-stats.html'
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // Replace sidebar guide link
  html = html.replace(
    /<a href="\/pages\/user\/full-guide\.html" class="menu-item" title="[^"]*">[\s\S]*?<img src="\/assets\/icons\/user-guide\.svg" alt="[^"]*" class="nav-icon-custom" \/>[\s\S]*?<span>[^<]*<\/span>[\s\S]*?<\/a>/g,
    `<a href="/pages/user/full-guide.html" class="menu-item" title="แนะนำระบบการใช้งาน">
          <img src="/assets/icons/user-guide.svg" alt="แนะนำระบบ" class="nav-icon-custom" />
          <span>แนะนำระบบ</span>
        </a>`
  );

  fs.writeFileSync(filePath, html);
});

// For HR files, let's also add the "แนะนำระบบ" nav item before "ตั้งค่า" or in the sidebar if missing
const hrFiles = [
  'pages/hr/home.html',
  'pages/hr/hr.html',
  'pages/hr/management.html',
  'pages/hr/news-management.html',
  'pages/hr/admin-dashboard.html'
];

const hrGuideNavItem = `        <!-- 💡 ปุ่มแนะนำระบบ -->
        <a href="/pages/user/full-guide.html" class="nav-item" title="แนะนำระบบการใช้งาน">
          <img src="/assets/icons/user-guide.svg" alt="แนะนำระบบ" class="nav-icon-custom" />
          <span class="nav-label">แนะนำระบบ</span>
        </a>`;

hrFiles.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  if (!html.includes('/pages/user/full-guide.html')) {
    // Insert before settings or before sidebar-footer
    if (html.includes('title="การตั้งค่าระบบ"')) {
      html = html.replace(/<button type="button" class="nav-item"[^>]*title="การตั้งค่าระบบ"/, hrGuideNavItem + '\n        <button type="button" class="nav-item" title="การตั้งค่าระบบ"');
    } else if (html.includes('<div class="sidebar-footer">')) {
      html = html.replace('<div class="sidebar-footer">', hrGuideNavItem + '\n      </div>\n      <div class="sidebar-footer">');
    }
  }

  fs.writeFileSync(filePath, html);
});

console.log("Updated guide menu items across user and HR pages.");
