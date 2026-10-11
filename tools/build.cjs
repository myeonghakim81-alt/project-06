// src/ 의 파일을 하나의 HTML(lucky-ball-race.html)로 묶습니다.
// 사용법: node tools/build.cjs
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, 'src', f), 'utf8');
let html = read('index.html');
const parts = { '/*@@STYLE@@*/': read('style.css'), '/*@@ENGINE@@*/': read('engine.js'), '/*@@APP@@*/': read('app.js') };
for (const [mark, body] of Object.entries(parts)) {
  if (!html.includes(mark)) throw new Error('표시를 찾지 못했습니다: ' + mark);
  if (/<\/script/i.test(body)) throw new Error('스크립트 안에 </script 가 있습니다');
  html = html.split(mark).join(body);
}
const out = path.join(root, 'lucky-ball-race.html');
fs.writeFileSync(out, html);
console.log('만들었습니다:', path.relative(root, out), (html.length / 1024).toFixed(1) + 'KB');
