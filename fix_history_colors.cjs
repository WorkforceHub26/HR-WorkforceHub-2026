const fs = require('fs');
let css = fs.readFileSync('css/leave-history.css', 'utf8');

// Change app background to slate-100 instead of #f3fafb
css = css.replace(/--bg-app:\s*#[a-fA-F0-9]+;/g, '--bg-app: #f1f5f9;'); // Slate 100

// Make content cards stand out more
css = css.replace(/\.content-card-box {[\s\S]*?}/, (match) => {
    return match.replace(/box-shadow:[^;]+;/, 'box-shadow: 0 4px 15px -3px rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.04);')
                .replace(/border:[^;]+;/, 'border: 1px solid var(--border-color);');
});

// If content-card-box doesn't have border defined, let's just replace the whole class roughly or do it manually
fs.writeFileSync('css/leave-history.css', css);
