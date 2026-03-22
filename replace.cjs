const fs = require('fs');
const content = fs.readFileSync('components/Settings.tsx', 'utf8');
const newContent = content.replace(/bg-slate-800\/40 p-6 rounded-xl border border-slate-700\/50 shadow-sm/g, 'glass-panel p-6 rounded-2xl');
fs.writeFileSync('components/Settings.tsx', newContent);
