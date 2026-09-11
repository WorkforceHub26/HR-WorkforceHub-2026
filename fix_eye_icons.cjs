const fs = require('fs');

function replaceIconsInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let html = fs.readFileSync(filePath, 'utf8');
    
    // Replace <span class="material-symbols-outlined">visibility</span> with the SVG eye-open
    html = html.replace(/<span class="material-symbols-outlined">visibility<\/span>/g, '<img class="toggle-eye-icon" src="/assets/icons/eye-open.svg" style="width: 24px; height: 24px; color: currentColor;" />');
    
    fs.writeFileSync(filePath, html);
}

const files = [
    'pages/user/index-user.html',
    'pages/hr/home.html',
];

files.forEach(replaceIconsInFile);
console.log("Replaced visibility icons in HTML.");

// Also need to update the JS toggle functions to swap eye-open with eye-closed
