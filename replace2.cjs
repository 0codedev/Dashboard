const fs = require('fs');
const content = fs.readFileSync('components/GeminiShowcase.tsx', 'utf8');
const newContent = content.replace(/bg-slate-800 p-6 rounded-xl border border-slate-700/g, 'glass-panel p-6 rounded-2xl');
fs.writeFileSync('components/GeminiShowcase.tsx', newContent);
