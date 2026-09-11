const fs = require('fs');

// Fix index-user.js toggle logic
let js1 = fs.readFileSync('js/index-user.js', 'utf8');
js1 = js1.replace(
  `  const iconEl = btnElement?.querySelector('.material-symbols-outlined');
  if (iconEl) {
    iconEl.textContent = isHidden ? 'visibility_off' : 'visibility';
  }`,
  `  // เปลี่ยนไอคอนและสไตล์ปุ่ม
  const iconSpan = btnElement?.querySelector('.material-symbols-outlined');
  if (iconSpan) {
    iconSpan.textContent = isHidden ? 'visibility_off' : 'visibility';
  }
  
  const iconImg = btnElement?.querySelector('.toggle-eye-icon');
  if (iconImg) {
    iconImg.src = isHidden ? '/assets/icons/eye-closed.svg' : '/assets/icons/eye-open.svg';
  }`
);
fs.writeFileSync('js/index-user.js', js1);

// Fix home.js toggle logic
let js2 = fs.readFileSync('js/home.js', 'utf8');
js2 = js2.replace(
  `  const icon = btn?.querySelector('.material-symbols-outlined');
  if (icon) {
    icon.textContent = isHidden ? 'visibility_off' : 'visibility';
  }`,
  `  const iconSpan = btn?.querySelector('.material-symbols-outlined');
  if (iconSpan) {
    iconSpan.textContent = isHidden ? 'visibility_off' : 'visibility';
  }
  
  const iconImg = btn?.querySelector('.toggle-eye-icon');
  if (iconImg) {
    iconImg.src = isHidden ? '/assets/icons/eye-closed.svg' : '/assets/icons/eye-open.svg';
  }`
);
fs.writeFileSync('js/home.js', js2);

console.log("Updated toggle JS.");
