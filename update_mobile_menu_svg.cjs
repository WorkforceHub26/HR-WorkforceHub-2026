const fs = require('fs');

const files = [
  'pages/user/index-user.html',
  'pages/user/profile-user.html',
  'pages/user/leave-history.html',
  'pages/user/holidays.html',
  'pages/user/news.html',
  'pages/user/leave-rules.html',
  'pages/user/leave-user.html',
  'pages/user/leave-stats.html',
  'pages/hr/home.html',
  'pages/hr/management.html',
  'pages/hr/news-management.html',
  'pages/hr/leave-stats.html',
  'pages/hr/hr.html'
];

const svgHamburger = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block; width: 22px; height: 22px;"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');

  // Replace <span class="material-symbols-outlined">menu</span> inside mobileMenuBtn
  html = html.replace(
    /(<button[^>]*class="[^"]*mobile-menu-btn[^"]*"[^>]*>)[\s\S]*?(<\/button>)/gi,
    (match, p1, p2) => {
      // Keep the button tag and insert SVG hamburger
      return `${p1}\n            ${svgHamburger}\n          ${p2}`;
    }
  );

  fs.writeFileSync(filePath, html);
});

console.log("Updated mobileMenuBtn icons across all pages.");
