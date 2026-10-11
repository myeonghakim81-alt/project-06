/* 행운볼 레이스 — 엔진 (코스 생성 · 물리 · 연출 감독)
 * DOM을 쓰지 않는 순수 로직입니다. 브라우저와 Node 양쪽에서 실행됩니다.
 * 같은 시드 + 같은 참가자 + 같은 설정이면 같은 코스와 같은 결과가 나옵니다.
 */
(function (root) {
  'use strict';

  const DEG = Math.PI / 180;
  const FPS = 60;
  const DT = 1 / FPS;
  const SUBSTEPS = 2;
  const STEP = 6;            // 중심선 샘플 간격(px)
  const SETTLE = 1.0;        // 출발 전 공이 자리 잡는 시간(초)
  const RING = 720;          // 기록해 두는 프레임 수(12초)

  // 물리 상수
  const G = 1500;            // 중력(px/s²)
  const DRAG = 2.0;          // 공기 저항(1/s)
  const E_WALL = 0.32;
  const E_BALL = 0.5;
  const E_OBS = 0.55;
  const BUMPER_KICK = 260;
  const WANDER = 170;        // 공마다 좌우로 살짝 흔들리는 힘(시드로 정해짐)

  // 선두가 1초에 트랙을 따라 내려가는 평균 거리(px). sim 테스트로 보정한 값.
  const VLEN = { exciting: 480, dramatic: 510 };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function strHash(str) {
    let h = 2166136261 >>> 0;
    for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
    return h;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // 인원에 따른 공 크기(r)와 코스 폭 배율(k)
  function sizing(n) {
    const r = n <= 20 ? 12 : n <= 50 ? 10.5 : n <= 120 ? 9 : n <= 250 ? 7.5 : 6.5;
    const k = clamp(Math.pow(n / 24, 0.42), 1, 3.4);
    return { r, k };
  }

  const PIECES = {
    start:      { name: '출발 구간',       zone: 'wide' },
    wide:       { name: '넓은 직선 내리막', zone: 'wide' },
    chute:      { name: '좁은 협곡',       zone: 'narrow' },
    scurve:     { name: 'S자 연속 곡선',   zone: 'curve' },
    longcurve:  { name: '롱 커브',         zone: 'curve' },
    switchback: { name: '지그재그 내리막', zone: 'curve' },
    island:     { name: '광장 · 갈림길',   zone: 'wide' },
    rotor:      { name: '회전 바 광장',    zone: 'wide' },
    bumper:     { name: '범퍼 분지',       zone: 'wide' },
    posts:      { name: '기둥 숲',         zone: 'wide' },
    lanes:      { name: '3갈래 레인',      zone: 'narrow' },
    baffles:    { name: '계단 턱',         zone: 'narrow' },
    wave:       { name: '물결 협로',       zone: 'narrow' },
    braid:      { name: '갈래길 · 합류',   zone: 'narrow' },
    vortex:     { name: '소용돌이 접시',   zone: 'wide' },
    shortcut:   { name: '지름길 · 타이밍 문', zone: 'wide' },
    swamp:      { name: '감속 늪',         zone: 'narrow' },
    boost:      { name: '가속 패드',       zone: 'narrow' },
    final:      { name: '마지막 깔때기',   zone: 'narrow' },
    runoff:     { name: '결승',            zone: 'wide' },
  };
  const ZONES = ['wide', 'narrow', 'curve'];

  const STYLE_WEIGHTS = {
    exciting: { wide: 0.8, chute: 0.8, scurve: 1.1, longcurve: 0.6, switchback: 0.8, island: 0.8, rotor: 2.2, bumper: 2.2, posts: 1.4, lanes: 0.8, baffles: 1.4, wave: 0.9, braid: 2.4, vortex: 1.5, shortcut: 1.5, swamp: 1.1, boost: 2.0 },
    dramatic: { wide: 0.7, chute: 1.2, scurve: 2.0, longcurve: 1.8, switchback: 1.8, island: 1.0, rotor: 1.0, bumper: 0.9, posts: 0.6, lanes: 0.6, baffles: 0.8, wave: 1.3, braid: 2.6, vortex: 2.0, shortcut: 2.2, swamp: 1.5, boost: 1.4 },
  };
  const DIFF = {
    easy:   { obs: 0.6, spin: 0.7, narrow: 1.15, speed: 1.04 },
    normal: { obs: 1.0, spin: 1.0, narrow: 1.0, speed: 1.0 },
    hard:   { obs: 1.4, spin: 1.35, narrow: 0.88, speed: 0.86 },
  };

  /* ---------------- 코스 생성 ---------------- */

  class Builder {
    constructor(k) {
      this.k = k; this.x = 0; this.y = 0; this.th = 90; this.w = 100; this.s = 0;
      this.X = []; this.Y = []; this.TX = []; this.TY = []; this.W = []; this.S = []; this.Z = []; this.P = [];
      this.pieces = []; this.obstacles = []; this.cur = -1;
    }
    begin(type) {
      const info = PIECES[type];
      this.pieces.push({ type, name: info.name, zone: info.zone, s0: this.s, s1: this.s, i0: this.X.length, i1: this.X.length });
      this.cur = this.pieces.length - 1;
    }
    end() { const p = this.pieces[this.cur]; p.s1 = this.s; p.i1 = this.X.length; }
    push(x, y, th, w) {
      const n = this.X.length;
      if (n) this.s += Math.hypot(x - this.X[n - 1], y - this.Y[n - 1]);
      this.X.push(x); this.Y.push(y);
      this.TX.push(Math.cos(th * DEG)); this.TY.push(Math.sin(th * DEG));
      this.W.push(w); this.S.push(this.s);
      this.Z.push(ZONES.indexOf(this.pieces[this.cur].zone)); this.P.push(this.cur);
    }
    first(w) { this.w = w; this.push(this.x, this.y, this.th, w); }
    straight(len, w1 = this.w, wfn = null) {
      const w0 = this.w;
      const n = Math.max(1, Math.ceil(len / STEP));
      const c = Math.cos(this.th * DEG), s = Math.sin(this.th * DEG);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        this.push(this.x + c * len * t, this.y + s * len * t, this.th, wfn ? wfn(t) : w0 + (w1 - w0) * t);
      }
      this.x += c * len; this.y += s * len; this.w = wfn ? wfn(1) : w1;
    }
    arc(R, turn, w1 = this.w) {
      if (Math.abs(turn) < 0.5) return;
      const w0 = this.w;
      R = Math.max(R, Math.max(w0, w1) / 2 + 34 * this.k);
      const sg = Math.sign(turn);
      const cx = this.x + Math.cos((this.th + 90 * sg) * DEG) * R;
      const cy = this.y + Math.sin((this.th + 90 * sg) * DEG) * R;
      const a0 = this.th - 90 * sg;
      const n = Math.max(2, Math.ceil(Math.abs(turn * DEG) * R / STEP));
      for (let i = 1; i <= n; i++) {
        const t = i / n, a = (a0 + turn * t) * DEG;
        this.push(cx + Math.cos(a) * R, cy + Math.sin(a) * R, this.th + turn * t, w0 + (w1 - w0) * t);
      }
      const a = (a0 + turn) * DEG;
      this.x = cx + Math.cos(a) * R; this.y = cy + Math.sin(a) * R; this.th += turn; this.w = w1;
    }
    steer(target, R) { target = clamp(target, 38, 142); this.arc(R, target - this.th); }
    taper(w, len) { if (Math.abs(w - this.w) < 2) return; this.straight(len, w); }
    // 현재 위치·방향 기준으로 앞쪽 along, 옆쪽 lat 지점
    local(along, lat) {
      const c = Math.cos(this.th * DEG), s = Math.sin(this.th * DEG);
      return [this.x + c * along - s * lat, this.y + s * along + c * lat];
    }
    frame() { return { x: this.x, y: this.y, th: this.th }; }
    // 이미 만든 중심선에서 거리 s 지점의 옆으로 lat 떨어진 점
    pointAt(s, lat) {
      let i = this.S.length - 1;
      while (i > 0 && this.S[i] > s) i--;
      return [this.X[i] - this.TY[i] * lat, this.Y[i] + this.TX[i] * lat];
    }
  }
  function atFrame(f, along, lat) {
    const c = Math.cos(f.th * DEG), s = Math.sin(f.th * DEG);
    return [f.x + c * along - s * lat, f.y + s * along + c * lat];
  }

  function generateCourse(opts) {
    const { count, duration, style, difficulty, seed } = opts;
    const rng = mulberry32(seed ^ 0x9E3779B9);
    const { r, k } = sizing(count);
    const d = DIFF[difficulty] || DIFF.normal;
    const b = new Builder(k);
    const WIDE = 400 * k, MID = 250 * k, CURVE = 150 * k;
    const NARROW = Math.max(88 * k * d.narrow, r * 2 * 4.2);
    const XMAX = 650 * k;
    const sk = Math.sqrt(k);
    const obs = b.obstacles;
    const toCenter = () => (b.x > 0 ? 1 : -1); // +1 = 왼쪽 아래(θ>90)
    // 풍차: 날개 4개(막대 2개가 십자로 겹침)
    const mill = (p, len) => obs.push({ type: 'rotor', blades: 2, x: p[0], y: p[1], len, thick: 6 * sk, omega: (0.9 + rng() * 1.1) * d.spin * (rng() < 0.5 ? -1 : 1), phase: rng() * Math.PI });

    // 출발 구간: 공이 들어갈 상자 + 게이트 + 짧은 직선
    b.begin('start');
    const boxW = WIDE;
    const gap = r * 2.35;
    const perRow = Math.max(4, Math.floor((boxW - r * 3) / gap));
    const rows = Math.ceil(count / perRow);
    const boxH = rows * gap + r * 3;
    b.first(boxW);
    b.straight(boxH);
    const gateS = b.s;
    const gateIdx = b.X.length - 1;
    b.straight(160);
    b.end();
    const startLen = b.s;

    const pieceFns = {
      wide() {
        b.steer(90 + (rng() - 0.5) * 30, 320 * k);
        b.taper(WIDE * (0.88 + rng() * 0.14), 150);
        const L = 320 + rng() * 220, W = b.w, f = b.frame();
        b.straight(L);
        mill(atFrame(f, L * 0.55, (rng() - 0.5) * 0.2 * W), 0.28 * W);
      },
      chute() {
        b.steer(90 + toCenter() * rng() * 18, 300 * k);
        b.taper(NARROW, 160);
        b.straight(120 + rng() * 80);
        const t = (rng() < 0.5 ? -1 : 1) * (8 + rng() * 10);
        b.arc(900 * k, t);
        b.straight(80 + rng() * 80);
        b.arc(900 * k, -t);
        b.straight(60);
      },
      scurve() {
        b.taper(CURVE, 110);
        let dir = toCenter();
        const m = 3 + Math.floor(rng() * 2);
        for (let i = 0; i < m; i++) {
          const target = 90 + dir * (38 + rng() * 14);
          b.arc((170 + rng() * 70) * k, clamp(target, 38, 142) - b.th);
          b.straight(30 + rng() * 40);
          dir = -dir;
        }
        b.steer(90, 200 * k);
      },
      longcurve() {
        b.taper(MID, 130);
        const dir = toCenter();
        const R = (520 + rng() * 220) * k;
        b.arc(R, (90 + dir * (30 + rng() * 15)) - b.th);
        const s0 = b.s, Ls = 120 + rng() * 120;
        b.straight(Ls);
        mill(b.pointAt(s0 + Ls * 0.5, 0), 0.3 * b.w);
        b.arc(R, (90 - dir * (8 + rng() * 10)) - b.th);
        b.straight(60);
      },
      switchback() {
        b.taper(CURVE, 110);
        const legs = 2 + Math.floor(rng() * 2);
        let dir = toCenter();
        for (let i = 0; i < legs; i++) {
          b.arc(CURVE / 2 + (60 + rng() * 40) * k, (90 + dir * (46 + rng() * 6)) - b.th);
          const s0 = b.s, Ls = (170 + rng() * 140) * sk;
          b.straight(Ls);
          mill(b.pointAt(s0 + Ls * 0.5, 0), 0.27 * CURVE);
          dir = -dir;
        }
        b.steer(90, CURVE / 2 + 80 * k);
      },
      island() {
        b.steer(90, 320 * k);
        b.taper(WIDE, 160);
        const L = 380 + rng() * 120;
        const f = b.frame();
        b.straight(L);
        const lat = (rng() - 0.5) * 0.2 * WIDE;
        const half = (60 + rng() * 30) * k, rad = 30 * k;
        const [ax, ay] = atFrame(f, L * 0.55 - half, lat), [bx, by] = atFrame(f, L * 0.55 + half, lat);
        obs.push({ type: 'island', ax, ay, bx, by, r: rad });
        if (d.obs > 1 || rng() < 0.4) {
          for (const sgn of [-1, 1]) {
            const [px, py] = atFrame(f, L * 0.18, sgn * WIDE * 0.25);
            obs.push({ type: 'post', x: px, y: py, r: 8 * sk });
          }
        }
      },
      rotor() {
        b.steer(90, 320 * k);
        b.taper(WIDE, 160);
        const L = 400 + rng() * 140;
        const f = b.frame();
        b.straight(L);
        const cnt = clamp(Math.round((2 + rng() * 1.5) * d.obs), 2, 4);
        for (let i = 0; i < cnt; i++) {
          const along = L * (0.16 + 0.68 * i / (cnt - 1));
          const lat = (i % 2 ? 1 : -1) * 0.21 * WIDE;
          mill(atFrame(f, along, lat), 0.22 * WIDE);
        }
      },
      bumper() {
        b.steer(90, 320 * k);
        b.taper(WIDE * 0.95, 160);
        const L = 340 + rng() * 140;
        const W = b.w;
        const f = b.frame();
        b.straight(L);
        const cnt = Math.round((4 + rng() * 3) * d.obs);
        const millAt = [L * 0.5, (rng() < 0.5 ? -1 : 1) * 0.22 * W];
        mill(atFrame(f, millAt[0], millAt[1]), 0.2 * W);
        const pts = [millAt];
        for (let tries = 0; pts.length < cnt && tries < 200; tries++) {
          const along = L * (0.15 + rng() * 0.7), lat = (rng() - 0.5) * 0.72 * W;
          if (pts.every(p => Math.hypot(p[0] - along, p[1] - lat) > 85 * k)) pts.push([along, lat]);
        }
        for (const [along, lat] of pts.slice(1)) {
          const [x, y] = atFrame(f, along, lat);
          obs.push({ type: 'bumper', x, y, r: 16 * sk });
        }
      },
      posts() {
        b.taper(MID * 1.1, 140);
        const L = 360 + rng() * 140;
        const W = b.w;
        const f = b.frame();
        b.straight(L);
        const rowsN = Math.floor(L / 80);
        for (let i = 0; i < rowsN; i++) {
          const per = clamp(Math.round((2 + (i % 2)) * Math.min(1.3, d.obs)), 1, 4);
          for (let j = 0; j < per; j++) {
            const lat = (per === 1 ? 0 : -0.33 + 0.66 * j / (per - 1)) * W + (i % 2 ? 0.06 : -0.06) * W;
            const [x, y] = atFrame(f, 50 + i * 80, lat);
            obs.push({ type: 'post', x, y, r: 7 * sk });
          }
        }
      },
      lanes() {
        b.steer(90, 320 * k);
        b.taper(MID * 1.15, 130);
        const L = 400 + rng() * 140;
        const W = b.w;
        const f = b.frame();
        b.straight(L);
        for (const sgn of [-1, 1]) {
          const [ax, ay] = atFrame(f, L * 0.14, sgn * W / 6), [bx, by] = atFrame(f, L * 0.88, sgn * W / 6);
          obs.push({ type: 'divider', ax, ay, bx, by, r: 5 * sk });
        }
        const lanesLat = [-W / 3, 0, W / 3];
        const a = Math.floor(rng() * 3);
        const [px, py] = atFrame(f, L * 0.5, lanesLat[a]);
        obs.push({ type: 'post', x: px, y: py, r: 9 * sk });
        const c2 = (a + 1 + Math.floor(rng() * 2)) % 3;
        const [qx, qy] = atFrame(f, L * 0.38, lanesLat[c2]);
        obs.push({ type: 'bumper', x: qx, y: qy, r: 11 * sk });
      },
      baffles() {
        b.steer(90, 320 * k);
        b.taper(MID * 0.95, 130);
        const L = 440 + rng() * 140;
        const W = b.w;
        const f = b.frame();
        b.straight(L);
        const m = Math.round((4 + rng() * 2) * Math.min(1.2, d.obs));
        const first = rng() < 0.5 ? 1 : -1;
        for (let i = 0; i < m; i++) {
          const along = L * (0.1 + 0.72 * i / Math.max(1, m - 1));
          const side = (i % 2 ? -1 : 1) * first;
          const [ax, ay] = atFrame(f, along, side * W / 2);
          const [bx, by] = atFrame(f, along + 0.2 * W, side * (W / 2 - 0.46 * W));
          obs.push({ type: 'ledge', ax, ay, bx, by, r: 6 * sk });
        }
      },
      // 여러 갈래로 나뉘었다가 다시 모이는 길
      braid() {
        b.steer(90, 320 * k);
        b.taper(WIDE * 1.05, 160);
        const L = 540 + rng() * 180, W = b.w, f = b.frame();
        b.straight(L);
        b.straight(120);
        // 레인 하나에 공이 넉넉히 지나가도록(벽 흔들림·장애물 포함) 레인 수를 정함
        const lanes = (rng() < 0.5 && W / 4 >= r * 2 * 6.5) ? 4 : 3, laneW = W / lanes;
        for (let j = 1; j < lanes; j++) {
          const base = -W / 2 + j * laneW, amp = laneW * 0.12, ph = rng() * Math.PI * 2, cyc = 0.8 + rng() * 1.2;
          let prev = null;
          for (let q = 0; q <= 12; q++) {
            const t = 0.1 + 0.76 * q / 12;
            const p = atFrame(f, L * t, base + amp * Math.sin(ph + cyc * 2 * Math.PI * q / 12));
            if (prev) obs.push({ type: 'divider', ax: prev[0], ay: prev[1], bx: p[0], by: p[1], r: 5 * sk });
            prev = p;
          }
        }
        const kinds = ['mill', 'posts', 'bumper', 'clear'];
        for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
        for (let j = 0; j < lanes; j++) {
          const c = -W / 2 + (j + 0.5) * laneW, kind = kinds[j % kinds.length];
          if (kind === 'mill') mill(atFrame(f, L * 0.5, c), laneW * 0.3);
          else if (kind === 'posts') [0.3, 0.48, 0.66].forEach(t => { const p = atFrame(f, L * t, c); obs.push({ type: 'post', x: p[0], y: p[1], r: Math.min(6 * sk, laneW * 0.06) }); });
          else if (kind === 'bumper') [0.36, 0.62].forEach(t => { const p = atFrame(f, L * t, c); obs.push({ type: 'bumper', x: p[0], y: p[1], r: Math.min(12 * sk, laneW * 0.1) }); });
        }
      },
      // 둥근 접시 안에서 빙글빙글 돌다가 빠져나감
      vortex() {
        b.steer(90, 320 * k);
        b.taper(CURVE * 1.1, 110);
        const w0 = b.w, D = WIDE * 1.1, L = D * 1.05, f = b.frame();
        b.straight(L, w0, t => w0 + (D - w0) * Math.pow(Math.sin(Math.PI * t), 0.6));
        const [x, y] = atFrame(f, L * 0.5, 0);
        obs.push({ type: 'vortex', field: true, x, y, R: D * 0.47, power: 1900, dir: rng() < 0.5 ? 1 : -1 });
        obs.push({ type: 'post', x, y, r: 16 * sk });
      },
      // 짧은 길(타이밍 문) / 긴 길(턱이 있는 길)
      shortcut() {
        b.steer(90, 320 * k);
        b.taper(WIDE, 160);
        const L = 460 + rng() * 120, W = b.w, f = b.frame();
        b.straight(L);
        const side = rng() < 0.5 ? -1 : 1, fastW = W * 0.36, slowW = W - fastW;
        const dl = side * (W / 2 - fastW);
        let p = atFrame(f, L * 0.08, dl), q = atFrame(f, L * 0.9, dl);
        obs.push({ type: 'divider', ax: p[0], ay: p[1], bx: q[0], by: q[1], r: 7 * sk });
        p = atFrame(f, L * 0.42, side * W / 2); q = atFrame(f, L * 0.42, dl);
        obs.push({ type: 'gate', ax: p[0], ay: p[1], bx: q[0], by: q[1], r: 6 * sk, period: 2.6, open: 1.0, phase: rng() * 2.6 });
        // 긴 길: 엇갈린 기둥이 있어 조금 느림
        const slowC = (dl - side * W / 2) / 2;
        for (let i = 0; i < 5; i++) {
          p = atFrame(f, L * (0.18 + 0.15 * i), slowC + (i % 2 ? 1 : -1) * slowW * 0.2);
          obs.push({ type: 'post', x: p[0], y: p[1], r: 7 * sk });
        }
      },
      // 지나가면 느려지는 늪
      swamp() {
        b.steer(90, 320 * k);
        b.taper(MID * 1.05, 130);
        const L = 400 + rng() * 140, W = b.w, f = b.frame();
        b.straight(L);
        const side = rng() < 0.5 ? -1 : 1;
        const [x, y] = atFrame(f, L * 0.5, side * W * 0.17);
        obs.push({ type: 'swamp', field: true, x, y, rx: W * 0.36, ry: L * 0.36, th: f.th, drag: 4.5 });
        [0.25, 0.75].forEach(t => { const p = atFrame(f, L * t, -side * W * 0.3); obs.push({ type: 'post', x: p[0], y: p[1], r: 7 * sk }); });
      },
      // 밟으면 빨라지는 패드
      boost() {
        b.steer(90, 320 * k);
        b.taper(MID * 0.9, 130);
        const L = 400 + rng() * 140, W = b.w, f = b.frame();
        b.straight(L);
        const m = 2 + Math.floor(rng() * 2), first = rng() < 0.5 ? 1 : -1;
        for (let i = 0; i < m; i++) {
          const [x, y] = atFrame(f, L * (0.2 + 0.6 * i / (m - 1)), (i % 2 ? -1 : 1) * first * W * 0.22);
          obs.push({ type: 'boost', field: true, x, y, hl: 42 * sk, hw: W * 0.24, th: f.th, power: 2600 });
        }
      },
      wave() {
        b.taper(MID * 0.9, 120);
        const L = 460 + rng() * 160;
        const cycles = 2 + Math.floor(rng() * 2);
        const base = MID * 0.68, amp = MID * 0.22;
        const w0 = b.w;
        b.straight(L, w0, t => {
          const w = base + amp * Math.cos(2 * Math.PI * cycles * t);
          const e = Math.min(1, t * 6);           // 앞쪽은 기존 폭에서 부드럽게 연결
          return Math.max(NARROW, w0 + (w - w0) * e);
        });
      },
    };

    const weights = STYLE_WEIGHTS[style] || STYLE_WEIGHTS.exciting;
    const FINAL_LEN = 900;
    const targetLen = duration * (VLEN[style] || 480) * d.speed * (1 + 0.08 * (k - 1));
    let prev = 'start', prevZone = 'wide';
    while (b.s - startLen < targetLen - FINAL_LEN) {
      const entries = Object.keys(pieceFns).map(t => {
        let w = weights[t] || 0;
        if (t === prev) w = 0;
        if (PIECES[t].zone === prevZone) w *= 0.35;
        return [t, w];
      });
      const tot = entries.reduce((a, e) => a + e[1], 0);
      let pick = rng() * tot, type = entries[0][0];
      for (const [t, w] of entries) { if ((pick -= w) <= 0) { type = t; break; } }
      // 옆으로 너무 멀리 흘러가면 가운데로 돌려놓기
      if (Math.abs(b.x) > XMAX) { b.begin('wide'); b.steer(90 + toCenter() * 40, 360 * k); b.straight(200); b.steer(90, 360 * k); b.end(); }
      b.begin(type);
      pieceFns[type]();
      b.end();
      prev = type; prevZone = PIECES[type].zone;
    }
    // 마지막 깔때기 → 결승선 → 결승 후 공간
    b.begin('final');
    b.steer(90, 360 * k);
    b.taper(MID * 0.9, 120);
    b.straight(160);
    b.taper(Math.max(NARROW * 1.5, 140 * k), 200);
    const fm = b.frame(), fw = b.w;
    b.straight(260);
    mill(atFrame(fm, 110, 0), 0.3 * fw);
    const finishS = b.s, finishIdx = b.X.length - 1;
    b.end();
    b.begin('runoff');
    b.taper(MID, 90);
    b.straight(220);
    b.end();

    return finalizeCourse(b, { r, k, gateS, gateIdx, finishS, finishIdx, startLen, count, perRow, gap, boxH, seed, duration, style, difficulty });
  }

  function finalizeCourse(b, meta) {
    const n = b.X.length;
    const f32 = a => Float32Array.from(a);
    const c = {
      n, x: f32(b.X), y: f32(b.Y), tx: f32(b.TX), ty: f32(b.TY), w: f32(b.W), s: Float64Array.from(b.S),
      zone: Uint8Array.from(b.Z), piece: Uint16Array.from(b.P),
      pieces: b.pieces, obstacles: b.obstacles, ...meta,
      length: b.S[n - 1],
    };
    // 가장자리
    c.lx = new Float32Array(n); c.ly = new Float32Array(n); c.rx = new Float32Array(n); c.ry = new Float32Array(n);
    let minX = 1e9, maxX = -1e9;
    for (let i = 0; i < n; i++) {
      const px = -c.ty[i], py = c.tx[i], h = c.w[i] / 2;
      c.lx[i] = c.x[i] + px * h; c.ly[i] = c.y[i] + py * h;
      c.rx[i] = c.x[i] - px * h; c.ry[i] = c.y[i] - py * h;
      minX = Math.min(minX, c.lx[i], c.rx[i]); maxX = Math.max(maxX, c.lx[i], c.rx[i]);
    }
    c.bounds = { minX, maxX, minY: c.y[0], maxY: c.y[n - 1] };

    // 벽: 안쪽 방향 법선을 가진 한쪽 면 선분
    const walls = [];
    const addWall = (ax, ay, bx, by, cx, cy, kind) => {
      const ex = bx - ax, ey = by - ay, L = Math.hypot(ex, ey);
      if (L < 0.01) return;
      let nx = -ey / L, ny = ex / L;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
      walls.push({ ax, ay, bx, by, nx, ny, kind: kind || 0 });
    };
    const STRIDE = 2;
    for (let i = 0; i < n - 1; i += STRIDE) {
      const j = Math.min(n - 1, i + STRIDE);
      const cx = (c.x[i] + c.x[j]) / 2, cy = (c.y[i] + c.y[j]) / 2;
      addWall(c.lx[i], c.ly[i], c.lx[j], c.ly[j], cx, cy);
      addWall(c.rx[i], c.ry[i], c.rx[j], c.ry[j], cx, cy);
    }
    // 위쪽 뒷벽, 아래쪽 막힘
    addWall(c.lx[0], c.ly[0], c.rx[0], c.ry[0], c.x[0] + c.tx[0] * 10, c.y[0] + c.ty[0] * 10);
    addWall(c.lx[n - 1], c.ly[n - 1], c.rx[n - 1], c.ry[n - 1], c.x[n - 1] - c.tx[n - 1] * 10, c.y[n - 1] - c.ty[n - 1] * 10);
    // 출발 게이트(시작 시 사라짐)
    const g = c.gateIdx;
    addWall(c.lx[g], c.ly[g], c.rx[g], c.ry[g], c.x[g] - c.tx[g] * 10, c.y[g] - c.ty[g] * 10, 1);
    c.walls = walls;
    c.gate = { ax: c.lx[g], ay: c.ly[g], bx: c.rx[g], by: c.ry[g] };
    c.finish = { ax: c.lx[c.finishIdx], ay: c.ly[c.finishIdx], bx: c.rx[c.finishIdx], by: c.ry[c.finishIdx] };
    return c;
  }

  // y 좌표로 샘플 인덱스 찾기(코스는 항상 아래로 내려가므로 y가 단조 증가)
  function indexAtY(c, y) {
    let lo = 0, hi = c.n - 1;
    if (y <= c.y[0]) return 0;
    if (y >= c.y[hi]) return hi;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.y[m] < y) lo = m; else hi = m; }
    return lo;
  }
  function indexAtS(c, s) {
    let lo = 0, hi = c.n - 1;
    if (s <= 0) return 0;
    if (s >= c.s[hi]) return hi;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c.s[m] < s) lo = m; else hi = m; }
    return lo;
  }

  // 타이밍 문: 열림(open초) → 닫힘 반복. 출발 전에는 닫혀 있음
  function gateClosed(o, t) {
    if (t < 0) return true;
    const m = ((t + o.phase) % o.period + o.period) % o.period;
    return m >= o.open;
  }

  /* ---------------- 공간 격자 ---------------- */
  class StaticGrid {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    key(cx, cy) { return (cy + 1000) * 65536 + (cx + 32768); }
    insertBox(id, x0, y0, x1, y1) {
      const C = this.cell;
      const cx0 = Math.floor(x0 / C), cx1 = Math.floor(x1 / C), cy0 = Math.floor(y0 / C), cy1 = Math.floor(y1 / C);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const k = this.key(cx, cy);
        let a = this.map.get(k);
        if (!a) { a = []; this.map.set(k, a); }
        a.push(id);
      }
    }
    query(x, y) { return this.map.get(this.key(Math.floor(x / this.cell), Math.floor(y / this.cell))); }
  }

  /* ---------------- 물리 세계 ---------------- */
  class World {
    constructor(course, balls, seed) {
      this.c = course;
      const n = balls.length;
      this.n = n;
      this.r = course.r;
      this.rng = mulberry32(seed ^ 0x51ED270B);
      this.x = new Float64Array(n); this.y = new Float64Array(n);
      this.vx = new Float64Array(n); this.vy = new Float64Array(n);
      this.ang = new Float64Array(n);
      this.prog = new Float64Array(n);
      this.idx = new Int32Array(n);
      this.state = new Uint8Array(n);       // 0 달리는 중, 1 결승 통과, 2 코스에서 빠짐, 3 당첨 지점에서 뽑힘, 4 같은 사람의 다른 공(제외)
      this.capT = new Float64Array(n).fill(Infinity);
      this.capX = new Float64Array(n); this.capY = new Float64Array(n);
      this.capStation = new Int16Array(n).fill(-1);
      this.vtime = new Float64Array(n); this.vlimit = new Float64Array(n);
      this.stations = [];
      this.finT = new Float64Array(n).fill(Infinity);
      this.lastProg = new Float64Array(n);
      this.stuckT = new Float64Array(n);
      this.stuckN = new Uint8Array(n);
      this.ghostT = new Float64Array(n);     // 오래 끼었을 때 잠깐 다른 공·장애물을 통과
      this.wander = new Float64Array(n);
      this.order = [];                       // 결승 통과 순서(공 번호)
      this.time = -SETTLE;
      this.frame = 0;
      this.gateOpen = false;
      this.leader = -1;
      this.impacts = 0;
      this.bumperHits = [];                   // [obsIndex, time]

      // 출발 배치: 출발 상자 안에 무작위 순서로
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const c = course;
      const perRow = c.perRow, gap = c.gap;
      for (let q = 0; q < n; q++) {
        const i = order[q];
        const row = Math.floor(q / perRow), col = q % perRow;
        const inRow = Math.min(perRow, n - row * perRow);
        const lat = (col - (inRow - 1) / 2) * gap + (this.rng() - 0.5) * 2;
        const along = c.boxH - c.r * 1.6 - row * gap;
        const si = indexAtS(c, Math.max(c.r * 1.5, along));
        this.x[i] = c.x[si] - c.ty[si] * lat;
        this.y[i] = c.y[si] + c.tx[si] * lat;
        this.idx[i] = si;
        this.prog[i] = c.s[si];
        this.lastProg[i] = this.prog[i];
      }
      this.startOrder = order;

      // 벽/장애물 격자
      const pad = this.r * 3 + 4;
      this.wallGrid = new StaticGrid(64);
      c.walls.forEach((w, id) => this.wallGrid.insertBox(id, Math.min(w.ax, w.bx) - pad, Math.min(w.ay, w.by) - pad, Math.max(w.ax, w.bx) + pad, Math.max(w.ay, w.by) + pad));
      this.obsGrid = new StaticGrid(64);
      c.obstacles.forEach((o, id) => {
        let x0, y0, x1, y1;
        if (o.type === 'rotor') { x0 = o.x - o.len; x1 = o.x + o.len; y0 = o.y - o.len; y1 = o.y + o.len; }
        else if (o.field) { const e = o.R || Math.max(o.rx || 0, o.ry || 0) || Math.hypot(o.hl, o.hw); x0 = o.x - e; x1 = o.x + e; y0 = o.y - e; y1 = o.y + e; }
        else if (o.ax !== undefined) { x0 = Math.min(o.ax, o.bx); x1 = Math.max(o.ax, o.bx); y0 = Math.min(o.ay, o.by); y1 = Math.max(o.ay, o.by); }
        else { x0 = x1 = o.x; y0 = y1 = o.y; }
        const p = (o.r || o.thick || 0) + this.r + 4;
        this.obsGrid.insertBox(id, x0 - p, y0 - p, x1 + p, y1 + p);
      });
      this.wallStamp = new Int32Array(c.walls.length);
      this.obsStamp = new Int32Array(c.obstacles.length);
      this.stamp = 0;
      // 공끼리 충돌용 해시
      this.HT = 8192;
      this.head = new Int32Array(this.HT);
      this.next = new Int32Array(n);

      this.frames = new Array(RING);
      this.lastFrameIdx = -1;
      this.record();
    }

    get done() { for (let i = 0; i < this.n; i++) if (this.state[i] === 0) return false; return true; }
    // 단계별 당첨 지점 설정: [{ s, count, tier }]
    setStations(stations, personOf) {
      this.stations = stations.map(st => Object.assign({ balls: [], times: [] }, st));
      this.personOf = personOf;
      this.wonPersons = new Set();
    }

    stepFrame() {
      const h = DT / SUBSTEPS;
      if (!this.gateOpen && this.time >= 0) this.gateOpen = true;
      this.impacts = 0;
      for (let k = 0; k < SUBSTEPS; k++) this.substep(h);
      this.time += DT;
      this.frame++;
      this.afterFrame();
      this.record();
    }

    substep(h) {
      const n = this.n, r = this.r, c = this.c;
      const vmax = Math.min(950, 1.15 * r / h);
      const drag = 1 - DRAG * h;
      const t = this.time;
      const wf = t > 0 ? WANDER * Math.pow(c.k, 0.3) * h : 0;
      for (let i = 0; i < n; i++) {
        if (this.state[i] >= 2) continue;
        const q = this.idx[i], wv = this.wander[i] * wf;
        let vx = (this.vx[i] - c.ty[q] * wv) * drag, vy = (this.vy[i] + G * h + c.tx[q] * wv) * drag;
        const sp = Math.hypot(vx, vy);
        if (sp > vmax) { vx *= vmax / sp; vy *= vmax / sp; }
        this.vx[i] = vx; this.vy[i] = vy;
        this.x[i] += vx * h; this.y[i] += vy * h;
        this.ang[i] += (vx * 0.8 + vy * 0.2) / r * h;
      }
      // 벽과 장애물
      const walls = c.walls, obs = c.obstacles;
      const band = r * 2.6;
      for (let i = 0; i < n; i++) {
        if (this.state[i] >= 2) continue;
        this.stamp++;
        const st = this.stamp;
        let px = this.x[i], py = this.y[i];
        const wl = this.wallGrid.query(px, py);
        if (wl) {
          for (let q = 0; q < wl.length; q++) {
            const id = wl[q];
            if (this.wallStamp[id] === st) continue;
            this.wallStamp[id] = st;
            const w = walls[id];
            if (w.kind === 1 && this.gateOpen) continue;
            const ex = w.bx - w.ax, ey = w.by - w.ay;
            const L2 = ex * ex + ey * ey;
            const u = ((px - w.ax) * ex + (py - w.ay) * ey) / L2;
            if (u >= 0 && u <= 1) {
              const dd = (px - w.ax) * w.nx + (py - w.ay) * w.ny;
              if (dd < r && dd > -band) {
                px += w.nx * (r - dd); py += w.ny * (r - dd);
                const vn = this.vx[i] * w.nx + this.vy[i] * w.ny;
                if (vn < 0) {
                  if (vn < -260) this.impacts++;
                  this.vx[i] -= (1 + E_WALL) * vn * w.nx; this.vy[i] -= (1 + E_WALL) * vn * w.ny;
                  this.vx[i] *= 0.997; this.vy[i] *= 0.997;
                }
              }
            } else {
              const qx = u < 0 ? w.ax : w.bx, qy = u < 0 ? w.ay : w.by;
              const dx = px - qx, dy = py - qy, d2 = dx * dx + dy * dy;
              if (d2 < r * r && d2 > 1e-9) {
                const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
                if (nx * w.nx + ny * w.ny > -0.2) {
                  px = qx + nx * r; py = qy + ny * r;
                  const vn = this.vx[i] * nx + this.vy[i] * ny;
                  if (vn < 0) { this.vx[i] -= (1 + E_WALL) * vn * nx; this.vy[i] -= (1 + E_WALL) * vn * ny; }
                }
              }
            }
          }
        }
        const ol = this.ghostT[i] > 0 ? null : this.obsGrid.query(px, py);
        if (ol) {
          for (let q = 0; q < ol.length; q++) {
            const id = ol[q];
            if (this.obsStamp[id] === st) continue;
            this.obsStamp[id] = st;
            const o = obs[id];
            if (o.field) { this.applyField(i, o, px, py, h, t); continue; }
            if (o.type === 'gate' && !gateClosed(o, t)) continue;
            const blades = o.type === 'rotor' ? (o.blades || 1) : 1;
            for (let bl = 0; bl < blades; bl++) {
              let qx, qy, rad, bvx = 0, bvy = 0;
              if (o.type === 'rotor') {
                const a = o.phase + o.omega * t + bl * Math.PI / 2;
                const cx = Math.cos(a) * o.len, cy = Math.sin(a) * o.len;
                const ax = o.x - cx, ay = o.y - cy, ex = 2 * cx, ey = 2 * cy;
                const u = clamp(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey), 0, 1);
                qx = ax + ex * u; qy = ay + ey * u; rad = o.thick;
                bvx = -o.omega * (qy - o.y); bvy = o.omega * (qx - o.x);
              } else if (o.ax !== undefined) {
                const ex = o.bx - o.ax, ey = o.by - o.ay;
                const u = clamp(((px - o.ax) * ex + (py - o.ay) * ey) / (ex * ex + ey * ey), 0, 1);
                qx = o.ax + ex * u; qy = o.ay + ey * u; rad = o.r;
              } else { qx = o.x; qy = o.y; rad = o.r; }
              const dx = px - qx, dy = py - qy, d2 = dx * dx + dy * dy, R = rad + r;
              if (d2 < R * R) {
                const d = Math.sqrt(d2) || 1e-6, nx = d2 > 1e-12 ? dx / d : 0, ny = d2 > 1e-12 ? dy / d : -1;
                px = qx + nx * R; py = qy + ny * R;
                const rvx = this.vx[i] - bvx, rvy = this.vy[i] - bvy;
                const vn = rvx * nx + rvy * ny;
                if (vn < 0) {
                  this.vx[i] -= (1 + E_OBS) * vn * nx; this.vy[i] -= (1 + E_OBS) * vn * ny;
                  if (o.type === 'bumper') {
                    this.vx[i] += nx * BUMPER_KICK; this.vy[i] += ny * BUMPER_KICK;
                    if (this.bumperHits.length < 4000) this.bumperHits.push(id, t);
                    this.impacts++;
                  } else if (vn < -260) this.impacts++;
                }
              }
            }
          }
        }
        this.x[i] = px; this.y[i] = py;
      }
      // 공끼리
      const HT = this.HT, head = this.head, next = this.next, cell = r * 2;
      head.fill(-1);
      const hash = (cx, cy) => (((cx * 73856093) ^ (cy * 19349663)) >>> 0) & (HT - 1);
      for (let i = 0; i < n; i++) {
        if (this.state[i] >= 2) continue;
        const hh = hash(Math.floor(this.x[i] / cell), Math.floor(this.y[i] / cell));
        next[i] = head[hh]; head[hh] = i;
      }
      const D = 2 * r, D2 = D * D;
      for (let i = 0; i < n; i++) {
        if (this.state[i] >= 2) continue;
        const cx = Math.floor(this.x[i] / cell), cy = Math.floor(this.y[i] / cell);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          let j = head[hash(cx + ox, cy + oy)];
          while (j !== -1) {
            if (j > i && !(this.ghostT[i] > 0 || this.ghostT[j] > 0)) {
              const dx = this.x[j] - this.x[i], dy = this.y[j] - this.y[i], d2 = dx * dx + dy * dy;
              if (d2 < D2) {
                const d = Math.sqrt(d2) || 1e-6;
                const nx = d2 > 1e-12 ? dx / d : 1, ny = d2 > 1e-12 ? dy / d : 0;
                const push = (D - d) * 0.5;
                this.x[i] -= nx * push; this.y[i] -= ny * push;
                this.x[j] += nx * push; this.y[j] += ny * push;
                const vrel = (this.vx[j] - this.vx[i]) * nx + (this.vy[j] - this.vy[i]) * ny;
                if (vrel < 0) {
                  const jj = -(1 + E_BALL) * vrel * 0.5;
                  this.vx[i] -= jj * nx; this.vy[i] -= jj * ny;
                  this.vx[j] += jj * nx; this.vy[j] += jj * ny;
                  if (vrel < -320) this.impacts++;
                }
              }
            }
            j = next[j];
          }
        }
      }
    }

    // 힘만 주는 장치(가속 패드, 늪, 소용돌이)
    applyField(i, o, px, py, h, t) {
      const dx = px - o.x, dy = py - o.y;
      if (o.type === 'boost' || o.type === 'swamp') {
        const c = Math.cos(o.th * DEG), s = Math.sin(o.th * DEG);
        const u = dx * c + dy * s, v = -dx * s + dy * c;
        if (o.type === 'boost') {
          if (Math.abs(u) < o.hl && Math.abs(v) < o.hw) { this.vx[i] += c * o.power * h; this.vy[i] += s * o.power * h; }
        } else if ((u / o.ry) * (u / o.ry) + (v / o.rx) * (v / o.rx) < 1) {
          const f = 1 - o.drag * h; this.vx[i] *= f; this.vy[i] *= f;
        }
        return;
      }
      if (o.type === 'vortex') {
        const d = Math.hypot(dx, dy);
        if (d > o.R || d < 1) return;
        if (this.vlimit[i] <= 0 || this.vtime[i] > this.vlimit[i] + 3) { this.vtime[i] = 0; this.vlimit[i] = 0.8 + this.rng() * 2.6; }
        this.vtime[i] += h;
        if (this.vtime[i] > this.vlimit[i]) return;     // 정해진 시간이 지나면 풀려나서 아래로 빠짐
        const a = o.power * (0.35 + 0.65 * d / o.R) * h;
        this.vx[i] += (-dy / d) * o.dir * a - (dx / d) * a * 0.15;
        this.vy[i] += (dx / d) * o.dir * a - (dy / d) * a * 0.15 - G * h * 0.55;
      }
    }

    afterFrame() {
      const c = this.c, n = this.n, t = this.time;
      let best = -1, bestS = -1;
      for (let i = 0; i < n; i++) {
        if (this.state[i] >= 2) continue;
        // 진행도: 가까운 중심선 샘플을 앞뒤로 조금씩만 탐색
        let bi = this.idx[i], bd = Infinity;
        const x = this.x[i], y = this.y[i];
        const lo = Math.max(0, bi - 6), hi = Math.min(c.n - 1, bi + 24);
        for (let q = lo; q <= hi; q++) {
          const dx = x - c.x[q], dy = y - c.y[q], d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; bi = q; }
        }
        this.idx[i] = bi;
        if (this.ghostT[i] > 0) { this.ghostT[i] -= DT; this.vx[i] += c.tx[bi] * 40; this.vy[i] += c.ty[bi] * 40; }
        if ((this.frame + i) % 24 === 0) this.wander[i] = this.rng() * 2 - 1;
        const sPrev = this.prog[i];
        const s = c.s[bi] + (x - c.x[bi]) * c.tx[bi] + (y - c.y[bi]) * c.ty[bi];
        this.prog[i] = s;
        if (this.state[i] === 0) {
          if (this.stations.length) {
            for (let k = 0; k < this.stations.length; k++) {
              const st = this.stations[k];
              if (sPrev < st.s && s >= st.s && st.balls.length < st.count) {
                const f = s > sPrev ? clamp((st.s - sPrev) / (s - sPrev), 0, 1) : 1;
                (this._cross || (this._cross = [])).push([t - DT + DT * f, i, k]);
              }
            }
          }
          if (s >= c.finishS) {
            const f = s > sPrev ? clamp((c.finishS - sPrev) / (s - sPrev), 0, 1) : 1;
            this.finT[i] = t - DT + DT * f;
            this.state[i] = 1;
            this.order.push(i);
          } else if (s > bestS) { bestS = s; best = i; }
          // 끼임 방지
          if (t > 0) {
            this.stuckT[i] += DT;
            if (this.stuckT[i] >= 1.5) {
              if (s - this.lastProg[i] < 8 * c.k) {
                // 끼었으면 앞으로 밀고, 그래도 안 되면 뒤로 살짝 튕겨서 다시 굴러가게
                const tx = c.tx[bi], ty = c.ty[bi];
                const back = this.stuckN[i] % 2 === 1;
                const fw = back ? -380 : 300, lat = (this.rng() - 0.5) * (back ? 520 : 260);
                this.vx[i] += tx * fw - ty * lat; this.vy[i] += ty * fw + tx * lat;
                if (this.stuckN[i] < 250) this.stuckN[i]++;
                if (this.stuckN[i] >= 3) this.ghostT[i] = 0.6;
              } else this.stuckN[i] = 0;
              this.stuckT[i] = 0; this.lastProg[i] = s;
            }
          }
        } else if (this.state[i] === 1 && s >= c.finishS + 70 * c.k) {
          this.state[i] = 2;
        }
      }
      if (this._cross && this._cross.length) this.resolveCaptures();
      if (this.order.length) this.leader = this.order[0];
      else this.leader = best;
    }

    // 당첨 지점을 먼저 통과한 공부터 정해진 인원만큼 옆 칸으로 뺌
    resolveCaptures() {
      const list = this._cross.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      this._cross = [];
      for (const [tc, i, k] of list) {
        const st = this.stations[k];
        if (this.state[i] !== 0 || st.balls.length >= st.count) continue;
        const p = this.personOf[i];
        if (this.wonPersons.has(p)) continue;
        this.wonPersons.add(p);
        this.state[i] = 3; this.capT[i] = tc; this.capX[i] = this.x[i]; this.capY[i] = this.y[i]; this.capStation[i] = k;
        st.balls.push(i); st.times.push(tc);
        for (let j = 0; j < this.n; j++) if (j !== i && this.personOf[j] === p && this.state[j] === 0) { this.state[j] = 4; this.capT[j] = tc; this.capX[j] = this.x[j]; this.capY[j] = this.y[j]; }
      }
    }

    // 강제 종료: 아직 도착 못한 공을 진행도 순으로 순위 확정
    forceFinish() {
      const rest = [];
      for (let i = 0; i < this.n; i++) if (this.state[i] === 0) rest.push(i);
      rest.sort((a, b) => this.prog[b] - this.prog[a] || a - b);
      for (const i of rest) { this.state[i] = 1; this.finT[i] = this.time + 0.001 * this.order.length; this.order.push(i); }
    }

    record() {
      const f = this.frame;
      const n = this.n;
      let fr = this.frames[f % RING];
      if (!fr) fr = this.frames[f % RING] = { pos: new Float32Array(n * 3), prog: new Float32Array(n), t: 0, impacts: 0, f: -1 };
      fr.f = f; fr.t = this.time; fr.impacts = this.impacts; fr.leader = this.leader;
      for (let i = 0; i < n; i++) {
        fr.pos[i * 3] = this.state[i] >= 2 ? NaN : this.x[i];
        fr.pos[i * 3 + 1] = this.y[i];
        fr.pos[i * 3 + 2] = this.ang[i];
        fr.prog[i] = this.prog[i];
      }
      this.lastFrameIdx = f;
    }
    getFrame(f) {
      const fr = this.frames[((f % RING) + RING) % RING];
      return fr && fr.f === f ? fr : null;
    }
    frameAtTime(t) { return (t + SETTLE) * FPS; }
  }

  /* ---------------- 당첨 판정 ---------------- */
  // win: { type: 'first'|'nth'|'top'|'bottom'|'last'|'full'|'blind', n }
  function scanUnique(list, personOf, limit) {
    const seen = new Set(), out = [];
    for (const b of list) {
      const p = personOf[b];
      if (seen.has(p)) continue;
      seen.add(p); out.push(b);
      if (out.length >= limit) break;
    }
    return out;
  }
  function winSpecOf(win, persons) {
    switch (win.type) {
      case 'first': return { dir: 'top', count: 1, pick: 'all' };
      case 'nth': return { dir: 'top', count: win.n, pick: 'last' };
      case 'blind': return { dir: 'top', count: win.secret, pick: 'last', blind: true };
      case 'top': return { dir: 'top', count: win.n, pick: 'all' };
      case 'bottom': return { dir: 'bottom', count: win.n, pick: 'all' };
      case 'tiers': return { dir: 'tiers', count: win.tiers[0], pick: 'all' };
      case 'last': return { dir: 'bottom', count: 1, pick: 'all' };
      default: return { dir: 'full', count: persons, pick: 'none' };
    }
  }
  // 현재 결승 통과 순서로 당첨이 확정되었는지
  function checkDetermined(world, personOf, spec) {
    const order = world.order;
    if (world.done) return true;
    if (spec.blind) return false;
    if (spec.dir === 'top' || spec.dir === 'tiers') {
      const seen = new Set();
      for (const b of order) { seen.add(personOf[b]); if (seen.size >= spec.count) return true; }
      return false;
    }
    if (spec.dir === 'bottom') {
      const rest = new Set();
      for (let i = 0; i < world.n; i++) if (world.state[i] === 0) rest.add(personOf[i]);
      return rest.size <= spec.count;
    }
    return false;
  }
  // 전체 순위(공 번호 배열): 도착 순 + 미도착은 진행도 순
  function fullOrder(world) {
    const rest = [];
    for (let i = 0; i < world.n; i++) if (world.state[i] === 0) rest.push(i);
    rest.sort((a, b) => world.prog[b] - world.prog[a] || a - b);
    return world.order.concat(rest);
  }
  // 당첨 공 목록(사람 기준으로 중복 제거)
  function computeWinners(order, personOf, spec) {
    if (spec.dir === 'full') return [];
    const list = spec.dir === 'bottom' ? order.slice().reverse() : order;
    const u = scanUnique(list, personOf, spec.count);
    return spec.pick === 'last' ? u.slice(-1) : u;
  }

  /* ---------------- 연출 감독(슬로모션 일정) ---------------- */
  // level: 0 끔, 1 적게, 2 보통, 3 많이
  class Director {
    constructor(world, personOf, spec, level) {
      this.w = world; this.personOf = personOf; this.spec = spec; this.level = level;
      this.windows = [];        // { t0, t1, factor, focus:[], label, kind }
      this.toasts = [];         // { t, text }
      this.detT = null; this.detBall = -1; this.detOrderLen = 0;
      this.detPending = false;
      this.leadCand = -1; this.leadCandT = 0; this.curLeader = -1;
      this.lastWinT = -99;
      this.c = world.c;
    }
    addWindow(win) {
      if (this.level === 0) return;
      for (const o of this.windows) if (win.t0 < o.t1 + 0.3 && win.t1 > o.t0 - 0.3) {
        if (win.kind === 'decision') { o.t0 = Math.min(o.t0, win.t0); o.t1 = Math.max(o.t1, win.t1); o.factor = Math.min(o.factor, win.factor); o.label = win.label; o.focus = win.focus; o.kind = win.kind; }
        return;
      }
      this.windows.push(win);
      this.lastWinT = win.t0;
    }
    update() {
      const w = this.w, t = w.time;
      // 당첨 확정 시점
      if (this.detT === null && checkDetermined(w, this.personOf, this.spec)) {
        this.detT = w.order.length ? w.finT[w.order[w.order.length - 1]] : t;
        this.detBall = w.order.length ? w.order[w.order.length - 1] : -1;
        this.detOrderLen = w.order.length;
        this.detPending = true;
      }
      if (this.detPending) {
        const nextBall = w.order.length > this.detOrderLen ? w.order[this.detOrderLen] : -1;
        if (nextBall >= 0 || t >= this.detT + 0.5 || w.done) {
          this.detPending = false;
          if (this.spec.dir !== 'full' && !this.spec.blind && this.detBall >= 0) {
            const gap = nextBall >= 0 ? w.finT[nextBall] - this.detT : 9;
            const close = gap < 0.3;
            let label;
            if (this.spec.dir === 'bottom') label = close ? '아슬아슬한 탈출!' : '당첨 확정!';
            else if (this.spec.dir === 'tiers') label = close ? '1등 접전!' : '1등 확정!';
            else label = close ? '결승 접전!' : '당첨 확정!';
            let focus = [this.detBall];
            if (nextBall >= 0) focus.push(nextBall);
            else {
              // 가장 가까운 추격자
              let bb = -1, bs = -1;
              for (let i = 0; i < w.n; i++) if (w.state[i] === 0 && w.prog[i] > bs) { bs = w.prog[i]; bb = i; }
              if (bb >= 0) focus.push(bb);
            }
            this.addWindow({ t0: this.detT - (close ? 1.6 : 1.1), t1: this.detT + 0.6, factor: close ? 0.2 : 0.35, focus, label, kind: 'decision' });
            this.toasts.push({ t: this.detT, text: label });
          }
        }
      }
      // 단계별 당첨 지점이 다 찼을 때
      const sts = w.stations;
      if (sts.length) {
        if (!this.stSeen) this.stSeen = sts.map(() => 0);
        sts.forEach((st, k) => {
          if (st.balls.length <= this.stSeen[k]) return;
          this.stSeen[k] = st.balls.length;
          if (st.balls.length < st.count) return;
          const tc = st.times[st.times.length - 1], last = st.balls[st.balls.length - 1];
          let bb = -1, bs = -1;
          for (let i = 0; i < w.n; i++) if (w.state[i] === 0 && w.prog[i] > bs) { bs = w.prog[i]; bb = i; }
          this.addWindow({ t0: tc - 1.0, t1: tc + 0.4, factor: 0.4, focus: bb >= 0 ? [last, bb] : [last], label: `${st.tier}등 마감!`, kind: 'decision' });
          this.toasts.push({ t: tc, text: `${st.tier}등 ${st.count}명 확정!` });
        });
      }
      // 선두 역전
      if (!w.order.length && t > 0 && w.leader >= 0) {
        if (this.curLeader < 0 || w.state[this.curLeader] !== 0) { this.curLeader = w.leader; this.leadCand = -1; }
        if (w.leader !== this.curLeader) {
          if (w.leader !== this.leadCand) { this.leadCand = w.leader; this.leadCandT = t; }
          else if (t - this.leadCandT > 0.35) {
            const frac = (w.prog[w.leader] - this.c.startLen) / (this.c.finishS - this.c.startLen);
            const minFrac = this.level >= 3 ? 0.2 : 0.55;
            const ct = this.leadCandT;
            if (this.level >= 2 && frac > minFrac && ct - this.lastWinT > 5 && (this.detT === null || ct < this.detT - 3)) {
              this.addWindow({ t0: ct - 0.7, t1: ct + 0.5, factor: 0.45, focus: [w.leader, this.curLeader], label: '선두 역전!', kind: 'lead' });
            }
            if (frac > 0.15) this.toasts.push({ t: ct, text: '선두 역전!' });
            this.curLeader = w.leader;
          }
        } else this.leadCand = -1;
      }
    }
  }

  /* ---------------- 레이스 묶음 ---------------- */
  function createRace(cfg) {
    // cfg: { balls:[{personId,...}], persons, duration, style, difficulty, seed, win, slow }
    const course = generateCourse({ count: cfg.balls.length, duration: cfg.duration, style: cfg.style, difficulty: cfg.difficulty, seed: cfg.seed });
    const world = new World(course, cfg.balls, cfg.seed);
    const personOf = cfg.balls.map(b => b.personId);
    const win = Object.assign({}, cfg.win);
    if (win.type === 'blind') win.secret = 1 + Math.floor(mulberry32(cfg.seed ^ 0xB11D)() * cfg.persons);
    const spec = winSpecOf(win, cfg.persons);
    if (win.type === 'tiers') {
      // tiers[0] = 1등 인원 … tiers[T-1] = T등 인원. T등은 1/T 지점, … 2등은 (T-1)/T 지점, 1등은 결승선
      const T = win.tiers.length, span = course.finishS - course.startLen;
      const stations = [];
      for (let q = 1; q < T; q++) {
        const tier = T - q + 1;
        stations.push({ tier, count: win.tiers[tier - 1], s: course.startLen + span * q / T });
      }
      world.setStations(stations, personOf);
    }
    const director = new Director(world, personOf, spec, cfg.slow);
    return { course, world, director, personOf, spec, win };
  }

  // 같은 코스에 공 몇 개만 먼저 굴려 선두 도착 시간을 추정(재생 속도 맞추기용, 결과와 무관)
  function estimateLeaderTime(race, ghostCount = 16) {
    const n = Math.min(race.world.n, ghostCount);
    const ghost = new World(race.course, Array.from({ length: n }, (_, i) => ({ personId: i })), race.course.seed ^ 0x6057);
    const cap = race.course.length / 120 + 30;
    while (!ghost.order.length && ghost.time < cap) ghost.stepFrame();
    return ghost.order.length ? ghost.finT[ghost.order[0]] * 0.98 : ghost.time;
  }

  const api = { _World: World, createRace, estimateLeaderTime, generateCourse, sizing, mulberry32, strHash, indexAtY, indexAtS, fullOrder, computeWinners, checkDetermined, winSpecOf, PIECES, ZONES, FPS, DT, SETTLE, RING, VLEN };
  root.LBREngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
