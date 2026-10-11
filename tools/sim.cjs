// 화면 없이 레이스를 끝까지 돌려 시간·끼임·성능을 확인하는 도구
// 사용법: node tools/sim.cjs [인원] [시간] [스타일] [난이도] [시드 개수]
const E = require('../src/engine.js');

function run(count, duration, style, difficulty, seed) {
  const balls = Array.from({ length: count }, (_, i) => ({ personId: i }));
  const race = E.createRace({ balls, persons: count, duration, style, difficulty, seed, win: { type: 'bottom', n: Math.min(3, count - 1) }, slow: 3 });
  const { world, director, course } = race;
  const cap = duration * 4 + 30;
  const t0 = process.hrtime.bigint();
  let frames = 0;
  while (!world.done && world.time < cap) { world.stepFrame(); director.update(); frames++; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const unfinished = world.n - world.order.length;
  const first = world.order.length ? world.finT[world.order[0]] : NaN;
  const last = world.order.length === world.n ? world.finT[world.order[world.n - 1]] : NaN;
  return {
    count, duration, style, difficulty, seed,
    len: Math.round(course.finishS - course.startLen), width: Math.round(course.bounds.maxX - course.bounds.minX),
    pieces: course.pieces.map(p => p.type).join(','),
    first: first.toFixed(1), last: isNaN(last) ? '-' : last.toFixed(1), unfinished,
    det: director.detT === null ? '-' : director.detT.toFixed(1), slows: director.windows.length,
    msPerFrame: (ms / frames).toFixed(2),
  };
}

const [count = 12, duration = 60, style = 'exciting', difficulty = 'normal', seeds = 3] = process.argv.slice(2);
for (let s = 1; s <= +seeds; s++) {
  const r = run(+count, +duration, style, difficulty, 1000 + s * 7919);
  console.log(JSON.stringify(r));
}
