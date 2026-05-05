import fs from 'fs';
const b64 = fs.readFileSync('./fonts/Inter-Regular.ttf').toString('base64');
fs.writeFileSync('./lib/fontBase64.js', `export const FONT_BASE64 = "${b64}";`);
console.log('Done! Font written to lib/fontBase64.js');