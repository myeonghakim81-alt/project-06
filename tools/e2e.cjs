// 브라우저에서 설정 → 레이스 → 결과까지 자동으로 돌려 보고 화면을 저장합니다.
// 사용법: node tools/e2e.cjs <저장 폴더> [인원] [당첨형태] [테마] [시간]
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2] || '.';
  const count = +(process.argv[3] || 12), win = process.argv[4] || 'bottom', theme = process.argv[5] || 'pastel', dur = process.argv[6] || '30';
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'lucky-ball-race.html'));
  await p.waitForTimeout(500);
  await p.fill('#inCount', String(count)); await p.dispatchEvent('#inCount', 'change');
  await p.click(`#segDuration [data-v="${dur}"]`);
  await p.click(`#segTheme [data-v="${theme}"]`);
  await p.selectOption('#selWin', win);
  await p.screenshot({ path: path.join(out, `setup-${theme}.png`) });
  await p.click('#btnStart');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(out, `race-start-${theme}.png`) });
  const fps = await p.evaluate(() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
  console.log('1배속 초당 프레임', fps);
  await p.click('#segSpeed [data-v="4"]');
  await p.waitForTimeout(4000);
  await p.screenshot({ path: path.join(out, `race-mid-${theme}.png`) });
  const t0 = Date.now();
  await p.waitForSelector('#result:not([hidden])', { timeout: 240000 });
  console.log('결과까지', ((Date.now() - t0) / 1000).toFixed(1), '초 (4배속)');
  await p.waitForTimeout(3500);
  await p.screenshot({ path: path.join(out, `result-${theme}.png`) });
  const info = await p.evaluate(() => { const r = window.__LBR.race; return { n: r.n, finished: r.world.order.length, det: r.director.detT, windows: r.director.windows.length, baseRate: r.baseRate, winners: [...r.winnerSet].map(i => r.cfg.balls[i].name) }; });
  console.log(JSON.stringify(info));
  console.log(errs.length ? errs.join('\n') : '오류 없음');
  await b.close();
})();
