/* 행운볼 레이스 — 화면 · 연출 · 입력 */
(function () {
  'use strict';
  const E = window.LBREngine;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ================= 상수 ================= */
  const PALETTE = ['#E5484D', '#2F7BE0', '#E9A90F', '#2F9E6E', '#8E5BD8', '#EC6FA9', '#13A3B5', '#F07F2E', '#6B7A2E', '#C2410C', '#0F766E', '#9D174D',
    '#4F46E5', '#65A30D', '#DB2777', '#0891B2', '#CA8A04', '#7C3AED', '#DC2626', '#059669', '#EA580C', '#2563EB', '#A21CAF', '#16A34A'];
  function paletteColor(i) {
    if (i < PALETTE.length) return PALETTE[i];
    const h = (i * 137.508) % 360;
    return hslToHex(h, 62 + (i % 3) * 6, 46 + (i % 4) * 4);
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
  }
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mix(hex, target, t) {
    const a = hexToRgb(hex), b = target === 'white' ? [255, 255, 255] : [0, 0, 0];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  }

  const THEMES = {
    pastel: { name: '캐주얼 파스텔', bg: '#FDF1F5', bg2: '#F6DCE6', pattern: 'dots', zone: ['#DCE8FF', '#FFD9E1', '#FFEBC9'], wall: '#5B4B57', wallHi: '#F6B6CB', flow: 'rgba(91,75,87,.10)', shadow: 'rgba(91,75,87,.12)', obs: '#5B4B57', obsHi: '#F6B6CB', bumper: '#F27BA0', bumperCore: '#FFFFFF', rotor: '#7A5C8E', post: '#8FB9A8', text: '#5B4B57', label: 'rgba(255,255,255,.92)', labelText: '#3D2F3A', ball: 'gloss', finish: ['#5B4B57', '#FFFFFF'], sound: 'sine' },
    neon: { name: '네온 아케이드', bg: '#0E0A24', bg2: '#16113A', pattern: 'grid', zone: ['#1B1650', '#2C1046', '#0F2747'], wall: '#3CF2E0', wallHi: '#E9FFFC', glow: true, flow: 'rgba(60,242,224,.13)', shadow: 'rgba(0,0,0,.45)', obs: '#FF4FD8', obsHi: '#FFD0F5', bumper: '#FF4FD8', bumperCore: '#FFE3F8', rotor: '#F7F06D', post: '#3CF2E0', text: '#E9E6FF', label: 'rgba(14,10,36,.88)', labelText: '#E9E6FF', ball: 'neon', finish: ['#3CF2E0', '#0E0A24'], sound: 'square' },
    minimal: { name: '심플 미니멀', bg: '#F4F4F2', bg2: '#E9E9E5', pattern: 'none', zone: ['#FFFFFF', '#EDEDE9', '#F8F8F5'], wall: '#1F1F1F', wallHi: '#1F1F1F', flow: 'rgba(0,0,0,.06)', shadow: 'rgba(0,0,0,.07)', obs: '#1F1F1F', obsHi: '#5A5A5A', bumper: '#E5484D', bumperCore: '#FFFFFF', rotor: '#1F1F1F', post: '#1F1F1F', text: '#1F1F1F', label: 'rgba(255,255,255,.95)', labelText: '#1F1F1F', ball: 'flat', finish: ['#1F1F1F', '#FFFFFF'], sound: 'click' },
    wood: { name: '레트로 우드', bg: '#6E4326', bg2: '#5E381F', pattern: 'wood', zone: ['#EBD3AE', '#DDB98A', '#E5C79A'], wall: '#3B2414', wallHi: '#C9A06A', flow: 'rgba(59,36,20,.12)', shadow: 'rgba(0,0,0,.28)', obs: '#3B2414', obsHi: '#C9A06A', bumper: '#B0302A', bumperCore: '#F2C46D', rotor: '#7A5A2E', post: '#9AA6AD', text: '#FFF3DC', label: 'rgba(59,36,20,.88)', labelText: '#FFF3DC', ball: 'metal', finish: ['#3B2414', '#F2E2C4'], sound: 'triangle' },
    space: { name: '우주', bg: '#0B1033', bg2: '#141A4A', pattern: 'stars', zone: ['rgba(120,110,255,.20)', 'rgba(255,120,200,.18)', 'rgba(120,220,255,.16)'], wall: '#B9A6FF', wallHi: '#FFFFFF', glow: true, flow: 'rgba(185,166,255,.14)', shadow: 'rgba(0,0,0,.3)', obs: '#FFD36B', obsHi: '#FFF1C7', bumper: '#FFD36B', bumperCore: '#FFFFFF', rotor: '#8EE3FF', post: '#B9A6FF', text: '#E8E6FF', label: 'rgba(11,16,51,.88)', labelText: '#E8E6FF', ball: 'planet', finish: ['#E8E6FF', '#0B1033'], sound: 'slide' },
  };
  const STYLE_NAME = { exciting: '익사이팅', dramatic: '드라마틱' };
  const DIFF_NAME = { easy: '쉬움', normal: '보통', hard: '어려움' };
  const SLOW_NAME = ['끔', '적게', '보통', '많이'];
  const EXAMPLE_NAMES = ['민수', '지영', '철수', '수진', '현우', '예린', '도윤', '하은', '서준', '지호', '유나', '태윤'];

  /* ================= 설정 상태 ================= */
  const S = {
    count: 8, namesText: '', duration: 60, style: 'exciting', difficulty: 'normal', theme: 'pastel',
    winType: 'first', winN: 3, tiers: [1, 2, 3, 4, 5], slow: 1, slowTouched: false, seed: '', sound: true, labels: 'auto', shuffle: 0,
  };
  const colorOverride = new Map();   // 이름 → 색
  const imageMap = new Map();        // 이름 → { canvas, url }
  let participants = [];

  const LS_KEY = 'lbr.settings.v1', LS_IMG = 'lbr.images.v1';
  function saveSettings() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ S, colors: [...colorOverride] }));
      const imgs = {};
      for (const [k, v] of imageMap) imgs[k] = v.url;
      localStorage.setItem(LS_IMG, JSON.stringify(imgs));
    } catch (e) { /* 저장 공간이 없으면 넘어갑니다 */ }
  }
  function loadSettings() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        Object.assign(S, d.S || {});
        (d.colors || []).forEach(([k, v]) => colorOverride.set(k, v));
      }
      const ri = localStorage.getItem(LS_IMG);
      if (ri) {
        const imgs = JSON.parse(ri);
        Object.entries(imgs).forEach(([k, url]) => {
          const im = new Image();
          im.onload = () => { const c = squareCanvas(im); imageMap.set(k, { canvas: c, url }); renderBallList(); };
          im.src = url;
        });
      }
    } catch (e) { /* 손상된 저장값은 무시 */ }
  }

  /* ================= 참가자 ================= */
  function parseNames(text) {
    return text.split(/[,\n，、;\t]+/).map(s => s.trim()).filter(Boolean).map(raw => {
      const m = raw.match(/^(.*?)\s*[*×]\s*(\d{1,3})$/);
      if (m && m[1].trim()) return { name: m[1].trim(), weight: clamp(parseInt(m[2], 10) || 1, 1, 50) };
      return { name: raw, weight: 1 };
    });
  }
  function buildParticipants() {
    const entries = parseNames(S.namesText);
    const list = [];
    for (let i = 0; i < S.count; i++) {
      const e = entries[i] || { name: `${i + 1}번`, weight: 1, auto: true };
      list.push(Object.assign({}, e));
    }
    const seen = new Map();
    list.forEach(p => {
      const c = (seen.get(p.name) || 0) + 1;
      seen.set(p.name, c);
      p.display = c > 1 ? `${p.name}(${c})` : p.name;
      p.key = p.display;
    });
    list.forEach((p, i) => {
      p.id = i;
      p.color = colorOverride.get(p.key) || paletteColor((i + S.shuffle) % 4096);
      const im = imageMap.get(p.key);
      p.img = im ? im.canvas : null;
      p.imgUrl = im ? im.url : null;
    });
    participants = list;
    return { entries, list };
  }
  const totalBalls = () => participants.reduce((a, p) => a + p.weight, 0);

  function squareCanvas(img, size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const m = Math.min(w, h);
    g.drawImage(img, (w - m) / 2, (h - m) / 2, m, m, 0, 0, size, size);
    return c;
  }
  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = squareCanvas(img);
        URL.revokeObjectURL(url);
        let data;
        try { data = c.toDataURL('image/jpeg', 0.85); } catch (e) { data = ''; }
        resolve({ canvas: c, url: data });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(file.name)); };
      img.src = url;
    });
  }

  /* ================= 설정 화면 ================= */
  function setPressed(groupId, value) {
    $(groupId).querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(value))));
  }
  function syncControls() {
    $('inCount').value = S.count;
    $('inCountRange').value = Math.min(500, S.count);
    if ($('inNames').value !== S.namesText) $('inNames').value = S.namesText;
    setPressed('segDuration', S.duration);
    setPressed('segStyle', S.style);
    setPressed('segDifficulty', S.difficulty);
    setPressed('segTheme', S.theme);
    setPressed('segSlow', S.slow);
    $('selWin').value = S.winType;
    $('inWinN').value = S.winN;
    $('inSeed').value = S.seed;
    $('chkSound').checked = S.sound;
    $('selLabels').value = S.labels;
    document.body.dataset.gtheme = S.theme;
  }

  let listTimer = 0;
  function refresh(listNow) {
    const { entries } = buildParticipants();
    // 인원 안내
    const balls = totalBalls();
    let hint = `공 ${balls}개`;
    const named = entries.length;
    if (named > S.count) hint += ` · 입력한 이름 ${named}개 중 앞의 ${S.count}개만 사용합니다`;
    else if (named < S.count && named > 0) hint += ` · 이름이 없는 ${S.count - named}명은 번호로 채웁니다`;
    $('countHint').textContent = hint;
    updateWinUI();
    updateSummary();
    clearTimeout(listTimer);
    if (listNow) renderBallList(); else listTimer = setTimeout(renderBallList, 160);
  }

  function renderBallList() {
    buildParticipants();
    const html = participants.map((p, i) => `
      <div class="ball-row" data-key="${esc(p.key)}">
        <span class="idx">${String(i + 1).padStart(2, '0')}</span>
        <label class="swatch" style="background:${p.color}" title="공 색 바꾸기"><input type="color" value="${p.color}" aria-label="${esc(p.display)} 공 색"></label>
        <button type="button" class="img-btn${p.imgUrl ? ' has' : ''}" title="사진 넣기">${p.imgUrl ? `<img alt="" src="${p.imgUrl}">` : '+ 사진'}</button>
        <span class="name${p.auto ? ' auto' : ''}">${esc(p.display)}${p.weight > 1 ? ` <span class="wt">×${p.weight}</span>` : ''}</span>
        <button type="button" class="x${p.imgUrl ? ' on' : ''}" title="사진 빼기" aria-label="사진 빼기">✕</button>
      </div>`).join('');
    $('ballList').innerHTML = html;
  }

  function winText() {
    const N = S.winN;
    switch (S.winType) {
      case 'first': return '1등 당첨';
      case 'nth': return `${N}등 당첨`;
      case 'top': return `상위 ${N}명 당첨`;
      case 'bottom': return `하위 ${N}명 당첨`;
      case 'last': return '꼴찌 당첨';
      case 'full': return '전체 순위';
      case 'blind': return '블라인드';
      case 'tiers': return `단계별 추첨 ${S.tiers.length}단계 (${S.tiers.reduce((a, b) => a + b, 0)}명)`;
    }
    return '';
  }
  function updateWinUI() {
    const t = S.winType, N = S.winN;
    const needN = t === 'nth' || t === 'top' || t === 'bottom';
    $('winNWrap').hidden = !needN; $('winNUnit').hidden = !needN;
    $('winNUnit').textContent = t === 'nth' ? '등' : '명';
    const desc = {
      first: '가장 먼저 결승선을 통과한 1명이 당첨됩니다.',
      nth: `${N}번째로 도착한 사람이 당첨됩니다.`,
      top: `먼저 도착한 ${N}명이 당첨됩니다.`,
      bottom: `가장 늦게 도착한 ${N}명이 당첨됩니다.`,
      last: '가장 마지막에 도착한 1명이 당첨됩니다.',
      full: '모든 공의 도착 순서를 정합니다. 발표 순서나 자리 정하기에 쓰세요.',
      blind: '몇 등이 당첨인지는 비밀입니다. 레이스가 끝나면 룰렛으로 당첨 등수를 공개합니다.',
      tiers: `코스를 ${S.tiers.length}등분해서 낮은 등수부터 차례로 뽑습니다. 각 당첨 지점에 먼저 도착한 공이 정해진 인원만큼 옆 칸으로 빠지고, 나머지는 계속 달립니다. 1등은 결승선에서 뽑습니다.`,
    }[t];
    $('tierEditor').hidden = t !== 'tiers';
    if (t === 'tiers') renderTierRows();
    const weighted = participants.some(p => p.weight > 1);
    $('winDesc').textContent = desc + (weighted ? ' 공이 여러 개인 사람도 한 번만 당첨됩니다.' : '');
  }
  function renderTierRows() {
    const T = S.tiers.length, persons = participants.length, sum = S.tiers.reduce((a, b) => a + b, 0);
    const rows = [];
    for (let tier = T; tier >= 1; tier--) {
      const where = tier === 1 ? '결승선에서 뽑기' : `코스 ${T - tier + 1}/${T} 지점에서 뽑기`;
      rows.push(`<div class="tier-row" data-tier="${tier}"><b>${tier}등</b><span class="where">${where}</span>
        <span class="stepper"><button type="button" data-d="-1" aria-label="${tier}등 줄이기">−</button><input type="number" min="1" max="50" value="${S.tiers[tier - 1]}" aria-label="${tier}등 인원"><button type="button" data-d="1" aria-label="${tier}등 늘리기">+</button></span><span class="hint">명</span></div>`);
    }
    rows.push(`<p class="hint">당첨 합계 ${sum}명 / 참가자 ${persons}명${sum === persons ? ' · 모든 사람이 무언가에 당첨됩니다' : ''}</p>`);
    $('tierRows').innerHTML = rows.join('');
    $('tierRemove').disabled = T <= 2; $('tierAdd').disabled = T >= 8;
  }
  function bindTiers() {
    const setTier = (tier, v) => { S.tiers[tier - 1] = clamp(parseInt(v, 10) || 1, 1, 50); renderTierRows(); updateSummary(); };
    $('tierRows').addEventListener('click', e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      const tier = +b.closest('.tier-row').dataset.tier;
      setTier(tier, S.tiers[tier - 1] + (+b.dataset.d));
    });
    $('tierRows').addEventListener('change', e => {
      if (e.target.type !== 'number') return;
      setTier(+e.target.closest('.tier-row').dataset.tier, e.target.value);
    });
    $('tierAdd').addEventListener('click', () => { if (S.tiers.length < 8) { S.tiers.push(S.tiers.length + 1); renderTierRows(); updateWinUI(); updateSummary(); } });
    $('tierRemove').addEventListener('click', () => { if (S.tiers.length > 2) { S.tiers.pop(); renderTierRows(); updateWinUI(); updateSummary(); } });
    $('tierDefault').addEventListener('click', () => { S.tiers = [1, 2, 3, 4, 5]; renderTierRows(); updateWinUI(); updateSummary(); });
  }

  function validate() {
    const persons = participants.length, balls = totalBalls();
    if (persons < 2) return '참가자가 2명 이상이어야 합니다.';
    if (balls > 500) return `공이 모두 ${balls}개입니다. 가중치(*숫자)를 줄여 500개 이하로 맞춰 주세요.`;
    if (S.winType === 'nth' && (S.winN < 1 || S.winN > persons)) return `N등은 1부터 ${persons}까지 고를 수 있습니다.`;
    if ((S.winType === 'top' || S.winType === 'bottom') && (S.winN < 1 || S.winN >= persons)) return `당첨 인원은 1명부터 ${persons - 1}명까지 고를 수 있습니다.`;
    if (S.winType === 'tiers') {
      const sum = S.tiers.reduce((a, b) => a + b, 0);
      if (sum > persons) return `당첨 인원 합계(${sum}명)가 참가자(${persons}명)보다 많습니다. 참가자를 늘리거나 등수별 인원을 줄여 주세요.`;
    }
    return '';
  }
  function updateSummary() {
    const persons = participants.length, balls = totalBalls();
    $('summary').textContent = `${persons}명${balls !== persons ? ` (공 ${balls}개)` : ''} · ${S.duration}초 · ${STYLE_NAME[S.style]} · ${DIFF_NAME[S.difficulty]} · ${THEMES[S.theme].name} · ${winText()} · 슬로모션 ${SLOW_NAME[S.slow]}`;
    const err = validate();
    $('setupError').textContent = err; $('setupError').hidden = !err;
    $('btnStart').disabled = !!err;
  }

  function bindSetup() {
    const setCount = v => { S.count = clamp(parseInt(v, 10) || 2, 2, 500); syncControls(); refresh(); };
    $('inCount').addEventListener('change', e => setCount(e.target.value));
    $('inCount').addEventListener('input', e => { const v = parseInt(e.target.value, 10); if (v >= 2 && v <= 500) { S.count = v; $('inCountRange').value = v; refresh(); } });
    $('inCountRange').addEventListener('input', e => setCount(e.target.value));
    $('inNames').addEventListener('input', e => {
      S.namesText = e.target.value;
      const n = parseNames(S.namesText).length;
      if (n >= 2) { S.count = Math.min(500, n); $('inCount').value = S.count; $('inCountRange').value = S.count; }
      refresh();
    });
    const segHandler = (id, key, conv, after) => $(id).addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      S[key] = conv(b.dataset.v); setPressed(id, S[key]); if (after) after(); updateSummary();
    });
    segHandler('segDuration', 'duration', Number);
    segHandler('segStyle', 'style', String, () => { if (!S.slowTouched) { S.slow = S.style === 'dramatic' ? 3 : 1; setPressed('segSlow', S.slow); } });
    segHandler('segDifficulty', 'difficulty', String);
    segHandler('segTheme', 'theme', String, () => { document.body.dataset.gtheme = S.theme; });
    segHandler('segSlow', 'slow', Number, () => { S.slowTouched = true; });
    $('selWin').addEventListener('change', e => {
      S.winType = e.target.value;
      if ((S.winType === 'top' || S.winType === 'bottom') && S.winN >= participants.length) S.winN = Math.max(1, participants.length - 1);
      $('inWinN').value = S.winN; updateWinUI(); updateSummary();
    });
    const setN = v => { S.winN = clamp(parseInt(v, 10) || 1, 1, 500); $('inWinN').value = S.winN; updateWinUI(); updateSummary(); };
    $('inWinN').addEventListener('input', e => setN(e.target.value));
    $('winMinus').addEventListener('click', () => setN(S.winN - 1));
    $('winPlus').addEventListener('click', () => setN(S.winN + 1));
    $('inSeed').addEventListener('input', e => { S.seed = e.target.value.replace(/[^0-9]/g, '').slice(0, 9); });
    $('chkSound').addEventListener('change', e => { S.sound = e.target.checked; });
    $('selLabels').addEventListener('change', e => { S.labels = e.target.value; });

    // 공 목록: 색 · 사진
    let imgTarget = null;
    $('ballList').addEventListener('input', e => {
      if (e.target.type !== 'color') return;
      const row = e.target.closest('.ball-row');
      colorOverride.set(row.dataset.key, e.target.value);
      e.target.parentElement.style.background = e.target.value;
      buildParticipants();
    });
    $('ballList').addEventListener('click', e => {
      const row = e.target.closest('.ball-row'); if (!row) return;
      if (e.target.closest('.img-btn')) { imgTarget = row.dataset.key; $('inOneImg').value = ''; $('inOneImg').click(); }
      else if (e.target.closest('.x')) { imageMap.delete(row.dataset.key); renderBallList(); }
    });
    $('inOneImg').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f || !imgTarget) return;
      try { imageMap.set(imgTarget, await loadImageFile(f)); setImgHint(''); } catch (err) { setImgHint(`이미지를 읽지 못했습니다: ${err.message}`); }
      renderBallList();
    });
    $('inBulkImg').addEventListener('change', async e => {
      const files = [...e.target.files]; e.target.value = '';
      if (!files.length) return;
      buildParticipants();
      const norm = s => s.normalize('NFC').trim().toLowerCase();
      let byName = 0, byOrder = 0, failed = 0;
      const rest = [];
      for (const f of files) {
        const base = norm(f.name.replace(/\.[^.]+$/, ''));
        const p = participants.find(q => norm(q.display) === base) || participants.find(q => norm(q.name) === base && !imageMap.has(q.key));
        try {
          const data = await loadImageFile(f);
          if (p) { imageMap.set(p.key, data); byName++; } else rest.push(data);
        } catch (err) { failed++; }
      }
      for (const data of rest) {
        const p = participants.find(q => !imageMap.has(q.key));
        if (!p) break;
        imageMap.set(p.key, data); byOrder++;
      }
      setImgHint(`${byName + byOrder}장 연결했습니다 (이름 일치 ${byName}장, 빈 공에 순서대로 ${byOrder}장)` + (failed ? ` · 읽지 못한 파일 ${failed}개` : ''));
      renderBallList();
    });
    $('inAllImg').addEventListener('change', async e => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const data = await loadImageFile(f);
        buildParticipants();
        participants.forEach(p => imageMap.set(p.key, data));
        setImgHint('모든 공에 같은 이미지를 넣었습니다. 공 테두리 색으로 구분됩니다.');
      } catch (err) { setImgHint('이미지를 읽지 못했습니다.'); }
      renderBallList();
    });
    $('btnClearImg').addEventListener('click', () => { imageMap.clear(); setImgHint('이미지를 모두 뺐습니다.'); renderBallList(); });
    $('btnShuffleColor').addEventListener('click', () => { colorOverride.clear(); S.shuffle = Math.floor(Math.random() * 24) + 1; renderBallList(); });
    $('btnExample').addEventListener('click', () => { S.namesText = EXAMPLE_NAMES.join(', '); S.count = EXAMPLE_NAMES.length; syncControls(); refresh(true); });
    $('btnReset').addEventListener('click', () => {
      S.namesText = ''; S.count = 8; S.shuffle = 0; colorOverride.clear(); imageMap.clear();
      syncControls(); refresh(true); setImgHint('');
    });
    $('btnStart').addEventListener('click', () => startRace());
  }
  function setImgHint(t) { $('imgHint').textContent = t || '이미지 파일 이름이 참가자 이름과 같으면 그 공에 자동으로 연결됩니다 (예: 민수.png).'; }

  /* ================= 공 그림(스프라이트) ================= */
  const SPR = 64, SPR_R = 29;
  function makeSprite(color, img, style) {
    const c = document.createElement('canvas');
    c.width = c.height = SPR;
    const g = c.getContext('2d');
    const C = SPR / 2, R = SPR_R;
    if (img) {
      g.save(); g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.clip();
      g.drawImage(img, C - R, C - R, R * 2, R * 2);
      const gl = g.createRadialGradient(C - 10, C - 12, 2, C, C, R);
      gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.18)');
      g.fillStyle = gl; g.fillRect(0, 0, SPR, SPR);
      g.restore();
      g.lineWidth = 5; g.strokeStyle = color; g.beginPath(); g.arc(C, C, R - 2.5, 0, Math.PI * 2); g.stroke();
      return c;
    }
    switch (style) {
      case 'flat':
        g.fillStyle = color; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
        g.lineWidth = 2.5; g.strokeStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.arc(C, C, R - 1.2, 0, Math.PI * 2); g.stroke();
        break;
      case 'neon': {
        const glow = g.createRadialGradient(C, C, R * 0.6, C, C, R + 3);
        glow.addColorStop(0, color); glow.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = glow; g.beginPath(); g.arc(C, C, R + 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = mix(color, 'black', 0.55); g.beginPath(); g.arc(C, C, R - 6, 0, Math.PI * 2); g.fill();
        g.lineWidth = 5; g.strokeStyle = color; g.beginPath(); g.arc(C, C, R - 6, 0, Math.PI * 2); g.stroke();
        g.fillStyle = mix(color, 'white', 0.6); g.beginPath(); g.arc(C - 6, C - 7, 4, 0, Math.PI * 2); g.fill();
        break;
      }
      case 'metal': {
        const lg = g.createLinearGradient(C - R, C - R, C + R, C + R);
        lg.addColorStop(0, mix(color, 'white', 0.65)); lg.addColorStop(0.45, color); lg.addColorStop(0.8, mix(color, 'black', 0.4)); lg.addColorStop(1, color);
        g.fillStyle = lg; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(C - 9, C - 11, 8, 5, -0.6, 0, Math.PI * 2); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(C, C, R - 0.8, 0, Math.PI * 2); g.stroke();
        break;
      }
      case 'planet': {
        const rg = g.createRadialGradient(C - 9, C - 10, 3, C, C, R);
        rg.addColorStop(0, mix(color, 'white', 0.5)); rg.addColorStop(0.6, color); rg.addColorStop(1, mix(color, 'black', 0.45));
        g.fillStyle = rg; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
        g.save(); g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.clip();
        g.strokeStyle = mix(color, 'white', 0.35); g.lineWidth = 4;
        g.beginPath(); g.ellipse(C, C + 4, R * 1.1, 6, -0.35, 0, Math.PI * 2); g.stroke();
        g.restore();
        break;
      }
      default: { // gloss
        const rg = g.createRadialGradient(C - 9, C - 10, 2, C, C, R);
        rg.addColorStop(0, mix(color, 'white', 0.55)); rg.addColorStop(0.35, color); rg.addColorStop(1, mix(color, 'black', 0.28));
        g.fillStyle = rg; g.beginPath(); g.arc(C, C, R, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(C - 8, C - 11, 9, 5, -0.5, 0, Math.PI * 2); g.fill();
      }
    }
    return c;
  }

  /* ================= 테마 미리보기 ================= */
  function renderThemeCards() {
    const wrap = $('segTheme');
    wrap.innerHTML = Object.entries(THEMES).map(([k, t]) => `<button type="button" class="theme-card" data-v="${k}"><canvas width="200" height="70"></canvas><span>${t.name}</span></button>`).join('');
    wrap.querySelectorAll('.theme-card').forEach(btn => {
      const t = THEMES[btn.dataset.v], cv = btn.querySelector('canvas'), g = cv.getContext('2d');
      g.fillStyle = t.bg; g.fillRect(0, 0, 200, 70);
      drawPatternPreview(g, t, 200, 70);
      g.lineCap = 'round';
      const path = () => { g.beginPath(); g.moveTo(-10, 18); g.bezierCurveTo(60, 10, 90, 60, 210, 48); };
      path(); g.strokeStyle = t.wall; g.lineWidth = 34; g.stroke();
      path(); g.strokeStyle = t.zone[2].startsWith('rgba') ? t.bg2 : t.zone[2]; g.lineWidth = 27; g.stroke();
      if (t.zone[2].startsWith('rgba')) { path(); g.strokeStyle = t.zone[0]; g.stroke(); }
      [[40, 15, 0], [96, 34, 1], [150, 46, 2]].forEach(([x, y, i]) => g.drawImage(makeSprite(PALETTE[i * 2], null, t.ball), x - 9, y - 9, 18, 18));
    });
  }
  function drawPatternPreview(g, t, w, h) {
    if (t.pattern === 'stars') { g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { g.globalAlpha = 0.3 + (i % 5) * 0.12; g.fillRect((i * 53) % w, (i * 29) % h, 1.4, 1.4); } g.globalAlpha = 1; }
    if (t.pattern === 'wood') { g.strokeStyle = t.bg2; g.lineWidth = 3; for (let y = 6; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + 3); g.stroke(); } }
    if (t.pattern === 'grid') { g.strokeStyle = 'rgba(60,242,224,.12)'; g.lineWidth = 1; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } }
    if (t.pattern === 'dots') { g.fillStyle = t.bg2; for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 14) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); } }
  }
  function makeBgPattern(ctx, t) {
    const c = document.createElement('canvas');
    let w = 64, h = 64;
    if (t.pattern === 'stars') { w = h = 320; }
    if (t.pattern === 'wood') { w = 240; h = 60; }
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = t.bg; g.fillRect(0, 0, w, h);
    if (t.pattern === 'dots') { g.fillStyle = t.bg2; g.beginPath(); g.arc(16, 16, 2.6, 0, 7); g.arc(48, 48, 2.6, 0, 7); g.fill(); }
    if (t.pattern === 'grid') { g.strokeStyle = 'rgba(60,242,224,.08)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w, h); }
    if (t.pattern === 'wood') {
      for (let y = 0; y < h; y += 4) { g.fillStyle = (y / 4) % 3 === 0 ? t.bg2 : (y / 4) % 3 === 1 ? t.bg : '#73482A'; g.fillRect(0, y, w, 4); }
      g.strokeStyle = 'rgba(40,20,8,.25)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, 30); g.bezierCurveTo(80, 22, 160, 40, 240, 30); g.stroke();
    }
    if (t.pattern === 'stars') {
      const rnd = E.mulberry32(7);
      for (let i = 0; i < 90; i++) { g.globalAlpha = 0.25 + rnd() * 0.75; g.fillStyle = rnd() < 0.15 ? '#FFD36B' : '#FFFFFF'; const s = rnd() < 0.1 ? 2.2 : 1.2; g.fillRect(rnd() * w, rnd() * h, s, s); }
      g.globalAlpha = 1;
    }
    return ctx.createPattern(c, 'repeat');
  }

  /* ================= 효과음 ================= */
  const sound = {
    ctx: null, on: true, lastTick: 0,
    ensure() {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { try { this.ctx = new AC(); } catch (e) { this.ctx = null; } } }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'sine', vol = 0.12, slideTo = 0, delay = 0) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t0 = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    },
    tick(theme, strength) {
      const now = performance.now();
      if (now - this.lastTick < 55) return;
      this.lastTick = now;
      const v = 0.025 + 0.05 * strength, f = 600 + Math.random() * 500;
      switch (THEMES[theme].sound) {
        case 'square': this.tone(f * 1.2, 0.04, 'square', v * 0.5); break;
        case 'click': this.tone(1800 + Math.random() * 400, 0.018, 'triangle', v); break;
        case 'triangle': this.tone(f * 0.55, 0.06, 'triangle', v * 1.3); break;
        case 'slide': this.tone(f, 0.08, 'sine', v, f * 1.6); break;
        default: this.tone(f * 1.4, 0.05, 'sine', v);
      }
    },
    beep(high) { this.tone(high ? 1046 : 660, high ? 0.45 : 0.18, 'square', 0.07); },
    ding() { this.tone(1318, 0.25, 'sine', 0.08); this.tone(1760, 0.3, 'sine', 0.05, 0, 0.06); },
    whoosh() { this.tone(300, 0.5, 'sine', 0.05, 90); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.09, 0, i * 0.12)); this.tone(1046, 0.7, 'sine', 0.06, 0, 0.5); },
  };

  /* ================= 레이스 ================= */
  let R = null;            // 현재 레이스
  let lastCfg = null;
  const stage = $('stage'), sctx = stage.getContext('2d');
  const mini = $('minimap'), mctx = mini.getContext('2d');

  function showScreen(name) {
    $('setup').hidden = name !== 'setup';
    $('race').hidden = name !== 'race';
    document.documentElement.style.overflow = name === 'race' ? 'hidden' : '';
  }

  function startRace(opts = {}) {
    let cfg;
    if (opts.cfg) {
      cfg = Object.assign({}, opts.cfg, { seed: opts.seed != null ? opts.seed : 1 + Math.floor(Math.random() * 999999) });
    } else {
      buildParticipants();
      const err = validate(); if (err) { updateSummary(); return; }
      const people = participants.map(p => ({ id: p.id, name: p.display, color: p.color, img: p.img, imgUrl: p.imgUrl, weight: p.weight }));
      const balls = [];
      people.forEach(p => { for (let k = 0; k < p.weight; k++) balls.push({ personId: p.id, name: p.name + (p.weight > 1 ? ` #${k + 1}` : ''), color: p.color, img: p.img }); });
      const seed = S.seed ? parseInt(S.seed, 10) : 1 + Math.floor(Math.random() * 999999);
      cfg = {
        balls, people, persons: people.length, duration: S.duration, style: S.style, difficulty: S.difficulty, seed,
        win: { type: S.winType, n: S.winType === 'first' || S.winType === 'last' ? 1 : S.winN, tiers: S.winType === 'tiers' ? S.tiers.slice() : undefined }, slow: S.slow, theme: S.theme, labels: S.labels, sound: S.sound,
      };
      saveSettings();
    }
    lastCfg = cfg;
    stopRace();
    $('result').hidden = true;
    showScreen('race');
    document.body.dataset.gtheme = cfg.theme;
    sound.on = cfg.sound; sound.ensure();
    $('btnSound').textContent = sound.on ? '🔊' : '🔇';
    $('loading').hidden = false;
    $('countdown').hidden = true; $('toast').hidden = true; $('slowBadge').hidden = true; $('btnSkipSlow').hidden = true; $('btnShowResult').hidden = true;
    setPressed('segSpeed', 1); $('selCam').value = 'auto'; $('inFind').value = '';
    $('dlNames').innerHTML = cfg.people.map(p => `<option value="${esc(p.name)}">`).join('');
    setTimeout(() => buildRace(cfg), 30);
  }

  function buildRace(cfg) {
    const eng = E.createRace(cfg);
    const ghost = E.estimateLeaderTime(eng);
    const theme = THEMES[cfg.theme];
    const n = eng.world.n;
    const sprites = cfg.balls.map(b => makeSprite(b.color, b.img, theme.ball));
    const rotates = cfg.balls.map(b => !!b.img || theme.ball === 'planet');
    R = {
      cfg, eng, theme, n, sprites, rotates,
      course: eng.course, world: eng.world, director: eng.director,
      baseRate: clamp(ghost / cfg.duration, 0.7, 1.45),
      dispT: -3.6, paused: false, userSpeed: 1,
      skipUntil: -99, activeWin: null, lastWinRef: null,
      cam: { x: 0, y: 0, z: 1, init: false }, camMode: 'auto', freeZ: null, findId: -1, hoverId: -1,
      pos: new Float32Array(n * 3), prog: new Float32Array(n), fin: new Uint8Array(n),
      resultShown: false, lastRankAt: 0, toastIdx: 0, toastUntil: 0, lastToastT: -9,
      bhIdx: 0, flash: new Map(), lastSoundFrame: 0, lastCount: null, finCount: 0,
      particles: [], pattern: null, rafId: 0, lastNow: 0, miniBase: null,
      capT: Math.max(cfg.duration, ghost) * 3 + 30,
      thumbs: cfg.balls.map((b, i) => b.img ? (cfg.people[b.personId].imgUrl || '') : ''),
      dpr: 1,
    };
    R.pattern = makeBgPattern(sctx, theme);
    R.stations = buildStations(eng.course, eng.world);

    $('hudTarget').textContent = '/ ' + fmtTime(cfg.duration);
    $('winRule').textContent = ruleText(cfg);
    $('loading').hidden = true;
    resize();
    buildMinimap();
    R.lastNow = performance.now();
    R.rafId = requestAnimationFrame(loop);
  }

  // 당첨 지점: 트랙을 가로지르는 선 + 트랙 옆 당첨 칸(공이 빠져 들어가는 곳)
  function buildStations(c, w) {
    return w.stations.map(st => {
      const i = E.indexAtS(c, st.s);
      const r = c.r, cols = Math.min(st.count, 5), rows = Math.ceil(st.count / cols), gap = r * 2.7;
      const bw = cols * gap + r * 2, bh = rows * gap + r * 4.2;
      const px = -c.ty[i], py = c.tx[i];
      let best = null;
      for (const sg of [1, -1]) {
        const ex = c.x[i] + px * sg * c.w[i] / 2, ey = c.y[i] + py * sg * c.w[i] / 2;
        const dist = Math.max(bw, bh) / 2 + 26 * Math.sqrt(c.k);
        const bx = ex + px * sg * dist, by = ey + py * sg * dist;
        let clear = Infinity;
        for (let q = 0; q < c.n; q += 3) {
          if (Math.abs(q - i) < 25) continue;
          const d = Math.hypot(c.x[q] - bx, c.y[q] - by) - c.w[q] / 2;
          if (d < clear) clear = d;
        }
        if (!best || clear > best.clear) best = { bx, by, ex, ey, sg, clear };
      }
      const slots = [];
      for (let q = 0; q < st.count; q++) {
        const col = q % cols, row = Math.floor(q / cols);
        slots.push([best.bx - bw / 2 + r + gap / 2 + col * gap - r * 0.35, best.by - bh / 2 + r * 3.4 + row * gap + gap / 2 - r * 0.6]);
      }
      return { st, i, bx: best.bx, by: best.by, bw, bh, ex: best.ex, ey: best.ey, slots,
        line: { ax: c.lx[i], ay: c.ly[i], bx: c.rx[i], by: c.ry[i] } };
    });
  }

  function stopRace() {
    if (R && R.rafId) cancelAnimationFrame(R.rafId);
    R = null;
  }

  function ruleText(cfg) {
    const w = cfg.win;
    switch (w.type) {
      case 'first': return '1등 당첨 · 맨 위 칸이 당첨권';
      case 'nth': return `${w.n}등 당첨 · 노란 칸이 당첨권`;
      case 'top': return `상위 ${w.n}명 당첨 · 노란 칸이 당첨권`;
      case 'bottom': return `하위 ${w.n}명 당첨 · 늦게 도착하는 공이 당첨`;
      case 'last': return '꼴찌 당첨 · 마지막에 도착하는 공이 당첨';
      case 'full': return '전체 순위 정하기';
      case 'blind': return '블라인드 · 당첨 등수는 레이스가 끝나면 공개';
      case 'tiers': return `단계별 추첨 · ${w.tiers.map((c, i) => `${i + 1}등 ${c}명`).reverse().join(' → ')}`;
    }
    return '';
  }
  const fmtTime = s => { s = Math.max(0, s); const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };

  function resize() {
    if (!R) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = stage.clientWidth, h = stage.clientHeight;
    if (stage.width !== Math.round(w * dpr) || stage.height !== Math.round(h * dpr)) { stage.width = Math.round(w * dpr); stage.height = Math.round(h * dpr); }
    R.dpr = dpr; R.vw = w; R.vh = h;
    const mw = mini.clientWidth, mh = mini.clientHeight;
    if (mini.width !== Math.round(mw * dpr) || mini.height !== Math.round(mh * dpr)) { mini.width = Math.round(mw * dpr); mini.height = Math.round(mh * dpr); R.miniBase = null; }
  }

  /* ---------- 메인 루프 ---------- */
  function loop(now) {
    if (!R) return;
    const dtReal = Math.min(0.1, (now - R.lastNow) / 1000);
    R.lastNow = now;
    resize();
    const W = R.world, D = R.director;

    // 화면 시간 진행
    if (!R.paused) {
      if (R.dispT < 0) {
        R.dispT += dtReal;
        if (R.dispT > 0) R.dispT = Math.min(R.dispT, 0.0001 + dtReal * R.baseRate);
      } else {
        const f = slowFactorAt(R.dispT);
        R.dispT += dtReal * R.baseRate * R.userSpeed * f;
      }
    }
    // 물리는 화면보다 2.6초 앞서 계산
    const LOOK = 2.6;
    const maxSteps = 6 + 10 * R.userSpeed;
    let steps = 0;
    while (!W.done && W.time < R.dispT + LOOK && steps < maxSteps) {
      W.stepFrame(); D.update(); steps++;
      if (W.time > R.capT && !W.done) { W.forceFinish(); D.update(); }
    }
    if (R.dispT > W.time) R.dispT = W.time;

    sampleFrame();
    updateEvents(now);
    updateCamera(dtReal);
    render(dtReal);
    updateHud(now);
    if (now - R.lastRankAt > 220) { R.lastRankAt = now; renderRanking(); drawMinimap(); }

    // 결과 발표 시점
    if (!R.resultShown && D.detT !== null) {
      const delay = R.eng.spec.dir === 'full' || R.eng.spec.blind ? 1.2 : 1.8;
      if (R.dispT >= D.detT + delay || (W.done && R.dispT >= W.time - 0.001)) showResult();
    }
    R.rafId = requestAnimationFrame(loop);
  }

  function slowFactorAt(t) {
    if (!R || R.cfg.slow === 0) { if (R) R.activeWin = null; return 1; }
    let f = 1, act = null;
    const RAMP = 0.3;
    for (const w of R.director.windows) {
      if (w.t1 <= R.skipUntil) continue;
      if (t < w.t0 - RAMP || t > w.t1 + RAMP) continue;
      let v;
      if (t < w.t0) v = 1 + (w.factor - 1) * ((t - (w.t0 - RAMP)) / RAMP);
      else if (t > w.t1) v = w.factor + (1 - w.factor) * ((t - w.t1) / RAMP);
      else v = w.factor;
      if (v < f) { f = v; act = w; }
    }
    R.activeWin = f < 0.98 ? act : null;
    return f;
  }

  function sampleFrame() {
    const W = R.world;
    const fIdx = (R.dispT + E.SETTLE) * E.FPS;
    let f0 = Math.floor(Math.max(0, fIdx)), a = Math.max(0, fIdx) - f0;
    let A = W.getFrame(f0), B = W.getFrame(f0 + 1);
    if (!A) { A = W.getFrame(W.lastFrameIdx); B = null; a = 0; }
    if (!B) { B = A; a = 0; }
    const n = R.n, P = R.pos, pa = A.pos, pb = B.pos;
    for (let i = 0; i < n * 3; i++) {
      const x = pa[i], y = pb[i];
      P[i] = x !== x ? NaN : y !== y ? x : x + (y - x) * a;
    }
    for (let i = 0; i < n; i++) {
      R.prog[i] = A.prog[i] + (B.prog[i] - A.prog[i]) * a;
      R.fin[i] = W.finT[i] <= R.dispT ? 1 : 0;
    }
    R.frameA = A;
  }

  /* ---------- 이벤트(효과음 · 토스트 · 도착 효과) ---------- */
  function updateEvents(now) {
    const W = R.world, D = R.director, t = R.dispT;
    // 카운트다운
    const cd = $('countdown');
    if (t < 0) {
      const n = t < -2.4 ? 3 : t < -1.2 ? 2 : 1;
      if (R.lastCount !== n) { R.lastCount = n; cd.hidden = false; cd.innerHTML = `<b>${n}</b>`; sound.beep(false); }
    } else if (t < 0.7 / R.baseRate) {
      if (R.lastCount !== 0) { R.lastCount = 0; cd.hidden = false; cd.innerHTML = '<b>출발!</b>'; sound.beep(true); }
    } else if (!cd.hidden) cd.hidden = true;

    // 충돌음
    const fNow = Math.floor((t + E.SETTLE) * E.FPS);
    if (fNow > R.lastSoundFrame) {
      let imp = 0;
      for (let f = R.lastSoundFrame + 1; f <= fNow; f++) { const fr = W.getFrame(f); if (fr) imp += fr.impacts; }
      R.lastSoundFrame = fNow;
      if (imp > 0 && t > 0) sound.tick(R.cfg.theme, Math.min(1, imp / 8));
    }
    // 범퍼 번쩍임
    const bh = W.bumperHits;
    while (R.bhIdx < bh.length && bh[R.bhIdx + 1] <= t) { R.flash.set(bh[R.bhIdx], bh[R.bhIdx + 1]); R.bhIdx += 2; }
    // 도착
    let finCount = 0;
    for (let i = 0; i < R.n; i++) finCount += R.fin[i];
    if (finCount > R.finCount) {
      for (let q = R.finCount; q < finCount && q < W.order.length; q++) {
        const id = W.order[q];
        if (q < 3 || isZoneBall(q + 1)) spawnBurst(id, q === 0 ? 34 : 16);
        if (q < 3) sound.ding();
      }
      R.finCount = finCount;
    }
    // 당첨 지점에서 뽑힌 공
    if (R.stations.length) {
      for (const S2 of R.stations) {
        const st = S2.st;
        S2.shown = S2.shown || 0;
        while (S2.shown < st.balls.length && st.times[S2.shown] <= t) {
          const id = st.balls[S2.shown];
          S2.shown++;
          sound.ding();
          spawnBurst(id, 10);
          showToast(`${st.tier}등 당첨! ${R.cfg.balls[id].name}`, now, 1200);
          // 같은 사람의 다른 공은 사라짐
          for (let j = 0; j < R.n; j++) if (W.state[j] === 4 && W.capT[j] === st.times[S2.shown - 1]) spawnPuff(j);
        }
      }
    }
    // 토스트
    while (R.toastIdx < D.toasts.length && D.toasts[R.toastIdx].t <= t) {
      const ts = D.toasts[R.toastIdx++];
      if (ts.t - R.lastToastT < 2.5 && ts.text === '선두 역전!') continue;
      R.lastToastT = ts.t;
      showToast(ts.text, now, 1500);
    }
    if (R.toastUntil && now > R.toastUntil) { $('toast').hidden = true; R.toastUntil = 0; }
    // 슬로모션 시작음
    if (R.activeWin && R.activeWin !== R.lastWinRef) { R.lastWinRef = R.activeWin; sound.whoosh(); }
  }

  function showToast(text, now, ms) {
    const el = $('toast'); el.hidden = false; el.textContent = text;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    R.toastUntil = now + ms;
  }
  function spawnPuff(id) {
    const W = R.world, x = W.capX[id], y = W.capY[id], r = R.course.r;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120;
      R.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.6, age: 0, c: R.cfg.balls[id].color, s: r * 0.3 });
    }
  }

  function isZoneBall(rank) {
    const w = R.eng.win, n = R.n;
    switch (w.type) {
      case 'first': return rank === 1;
      case 'nth': return rank === w.n;
      case 'top': return rank <= w.n;
      case 'bottom': return rank > n - w.n;
      case 'last': return rank === n;
    }
    return false;
  }

  function spawnBurst(id, count) {
    const x = R.pos[id * 3], y = R.pos[id * 3 + 1];
    if (x !== x) return;
    const col = R.cfg.balls[id].color, r = R.course.r;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (120 + Math.random() * 260) * Math.sqrt(R.course.k);
      R.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0.9 + Math.random() * 0.5, age: 0, c: i % 3 ? col : '#FFD36B', s: r * (0.3 + Math.random() * 0.35) });
    }
  }

  /* ---------- 카메라 ---------- */
  function updateCamera(dt) {
    const c = R.course, cam = R.cam, k = c.k, r = c.r, n = R.n;
    let tx, ty, zMul = 1, z;
    const P = R.pos;
    const running = [];
    for (let i = 0; i < n; i++) if (!R.fin[i] && P[i * 3] === P[i * 3]) running.push(i);
    running.sort((a, b) => R.prog[b] - R.prog[a]);
    const meanOf = ids => { let x = 0, y = 0, m = 0; for (const i of ids) { const px = P[i * 3]; if (px === px) { x += px; y += P[i * 3 + 1]; m++; } } return m ? [x / m, y / m] : null; };
    const mode = R.camMode;
    if (mode === 'overview') {
      const b = c.bounds;
      z = Math.min(R.vw / (b.maxX - b.minX + 160), R.vh / (b.maxY - b.minY + 300));
      tx = (b.minX + b.maxX) / 2; ty = (b.minY + b.maxY) / 2 - (R.vh * 0.08) / z;
    } else if (mode === 'free') {
      tx = cam.x; ty = cam.y; z = R.freeZ || cam.z;
    } else {
      let target = null;
      if (R.findId >= 0) {
        const p = meanOf([R.findId]);
        if (p && !R.fin[R.findId]) { target = p; zMul = 1.3; }
      }
      if (!target && mode === 'auto' && R.activeWin && R.activeWin.focus) {
        const p = meanOf(R.activeWin.focus.filter(i => P[i * 3] === P[i * 3]));
        if (p) { target = p; zMul = 1.6; }
      }
      const bottomMode = R.eng.spec.dir === 'bottom';
      if (!target && running.length) {
        if (mode === 'tail' || (mode === 'auto' && bottomMode && R.finCount > 0)) {
          target = meanOf(running.slice(-3));
        } else {
          const lead = meanOf([running[0]]), pack = meanOf(running.slice(0, 3));
          target = [lead[0] * 0.6 + pack[0] * 0.4, lead[1] * 0.6 + pack[1] * 0.4];
        }
      }
      if (!target) target = [c.x[c.finishIdx], c.y[c.finishIdx]];
      [tx, ty] = target;
      // 당첨 지점 근처에서는 당첨 칸까지 함께 보이게
      let stationView = null;
      if (mode === 'auto' && R.stations.length && running.length && R.findId < 0) {
        const lp = R.prog[running[0]];
        for (const S2 of R.stations) {
          const st = S2.st, got = st.times.filter(x => x <= R.dispT);
          const recent = got.length && R.dispT - got[got.length - 1] < 1.6;
          if ((got.length < st.count && st.s - lp < 420 * k && st.s - lp > -250 * k) || recent) { stationView = S2; break; }
        }
      }
      if (R.dispT < 0.6 && R.findId < 0) {
        // 출발 직전: 출발 상자 전체가 보이게
        const gi = c.gateIdx, bi = E.indexAtS(c, c.boxH * 0.5);
        tx = c.x[bi]; ty = (c.y[0] + c.y[gi]) / 2 + (R.vh * 0.12) / Math.max(0.05, cam.z);
      }
      // 주변 트랙 폭에 맞춰 확대
      const idx = E.indexAtY(c, ty);
      let wmax = 0;
      for (let q = Math.max(0, idx - 50); q < Math.min(c.n, idx + 70); q++) wmax = Math.max(wmax, c.w[q]);
      z = R.vw * 0.9 / (wmax + 90 * k);
      const rMin = R.dispT < 0.8 ? 2.2 : R.vw < 600 ? 4 : 5;
      z = clamp(z, rMin / r, 22 / r);
      z = Math.min(z * zMul, 30 / r);
      if (stationView) {
        const sv = stationView, minX = Math.min(tx, sv.bx - sv.bw / 2, sv.line.ax, sv.line.bx), maxX = Math.max(tx, sv.bx + sv.bw / 2, sv.line.ax, sv.line.bx);
        tx = (minX + maxX) / 2; ty = (ty + sv.by) / 2;
        z = Math.min(z, R.vw * 0.92 / (maxX - minX + 60 * k), R.vh * 0.7 / (Math.abs(target[1] - sv.by) + sv.bh + 200 * k));
        z = Math.max(z, 2.4 / r);
      }
      if (R.dispT < 0.6 && R.findId < 0) z = Math.min(22 / r, R.vw * 0.9 / (c.w[0] + 60 * k));
    }
    if (!cam.init) { cam.x = tx; cam.y = ty; cam.z = z; cam.init = true; }
    const a = 1 - Math.exp(-dt * 4.2), az = 1 - Math.exp(-dt * 2.6);
    cam.x += (tx - cam.x) * a; cam.y += (ty - cam.y) * a; cam.z += (z - cam.z) * az;
  }

  /* ---------- 그리기 ---------- */
  function render(dt) {
    const g = sctx, c = R.course, t = R.theme, cam = R.cam, dpr = R.dpr, vw = R.vw, vh = R.vh;
    const z = cam.z, ox = vw / 2 - cam.x * z, oy = vh * 0.42 - cam.y * z;
    // 배경
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = t.bg; g.fillRect(0, 0, vw, vh);
    if (t.pattern !== 'none') {
      try { R.pattern.setTransform(new DOMMatrix().translate(-cam.x * 0.25 % 640, -cam.y * 0.25 % 640)); } catch (e) { /* 오래된 브라우저 */ }
      g.fillStyle = R.pattern; g.fillRect(0, 0, vw, vh);
    }
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
    const y0 = cam.y - (vh * 0.42) / z - 120, y1 = cam.y + (vh * 0.58) / z + 120;
    const i0 = Math.max(0, E.indexAtY(c, y0) - 3), i1 = Math.min(c.n - 1, E.indexAtY(c, y1) + 3);
    const lw = 1 / z;

    // 그림자
    g.save(); g.translate(7, 9);
    g.beginPath();
    for (let i = i0; i <= i1; i++) g.lineTo(c.lx[i], c.ly[i]);
    for (let i = i1; i >= i0; i--) g.lineTo(c.rx[i], c.ry[i]);
    g.closePath(); g.fillStyle = t.shadow; g.fill(); g.restore();
    // 구간 색
    let s = i0;
    while (s < i1) {
      const zz = c.zone[s];
      let e = s;
      while (e < i1 && c.zone[e + 1] === zz) e++;
      const e2 = Math.min(i1, e + 1);
      g.beginPath();
      for (let i = s; i <= e2; i++) g.lineTo(c.lx[i], c.ly[i]);
      for (let i = e2; i >= s; i--) g.lineTo(c.rx[i], c.ry[i]);
      g.closePath(); g.fillStyle = t.zone[zz]; g.fill();
      s = e + 1;
    }
    // 흐름선
    g.strokeStyle = t.flow; g.lineWidth = Math.max(2, 1.5 * lw);
    g.setLineDash([16, 20]);
    for (const f of [-0.3, 0, 0.3]) {
      g.beginPath();
      for (let i = i0; i <= i1; i += 2) { const h = c.w[i] * f; g.lineTo(c.x[i] - c.ty[i] * h, c.y[i] + c.tx[i] * h); }
      g.stroke();
    }
    g.setLineDash([]);
    // 결승선
    drawFinish(g, c, t);
    // 벽
    g.lineJoin = 'round'; g.lineCap = 'round';
    const wallW = Math.max(9, 3.5 * lw);
    for (const side of [0, 1]) {
      const X = side ? c.rx : c.lx, Y = side ? c.ry : c.ly;
      g.beginPath();
      for (let i = i0; i <= i1; i++) g.lineTo(X[i], Y[i]);
      if (t.glow) { g.strokeStyle = t.wall; g.globalAlpha = 0.25; g.lineWidth = wallW * 2.4; g.stroke(); g.globalAlpha = 1; }
      g.strokeStyle = t.wall; g.lineWidth = wallW; g.stroke();
      g.strokeStyle = t.wallHi; g.lineWidth = Math.max(2.5, 1.2 * lw); g.stroke();
    }
    if (i0 <= 1) { g.beginPath(); g.moveTo(c.lx[0], c.ly[0]); g.lineTo(c.rx[0], c.ry[0]); g.strokeStyle = t.wall; g.lineWidth = wallW; g.stroke(); }
    if (i1 >= c.n - 2) { const L = c.n - 1; g.beginPath(); g.moveTo(c.lx[L], c.ly[L]); g.lineTo(c.rx[L], c.ry[L]); g.strokeStyle = t.wall; g.lineWidth = wallW; g.stroke(); }
    // 출발 게이트
    if (R.dispT < 0.3) {
      const gt = c.gate;
      g.globalAlpha = R.dispT < 0 ? 1 : Math.max(0, 1 - R.dispT / 0.3);
      g.setLineDash([18, 10]); g.strokeStyle = t.wall; g.lineWidth = wallW * 0.8;
      g.beginPath(); g.moveTo(gt.ax, gt.ay); g.lineTo(gt.bx, gt.by); g.stroke(); g.setLineDash([]);
      g.globalAlpha = 1;
    }
    // 힘 장치(늪 · 가속 패드 · 소용돌이)와 당첨 지점
    drawFields(g, c, t, y0, y1, lw);
    if (R.stations.length) drawStations(g, c, t, y0, y1, lw);
    // 장애물
    drawObstacles(g, c, t, y0, y1, lw);
    if (R.stations.length) drawCaptured(g, c);
    // 공
    drawBalls(g, c, y0, y1, lw);
    // 입자
    updateParticles(g, dt);
    // 화면 좌표 글자
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPieceLabels(g, c, t, i0, i1, z, ox, oy);
    if (R.stations.length) drawStationLabels(g, z, ox, oy);
    drawNameLabels(g, z, ox, oy, y0, y1);
  }

  function drawFinish(g, c, t) {
    const f = c.finish, ex = f.bx - f.ax, ey = f.by - f.ay, L = Math.hypot(ex, ey);
    const q = 14 * Math.sqrt(c.k), m = Math.max(4, Math.round(L / q)), sx = ex / m, sy = ey / m;
    const tx = c.tx[c.finishIdx] * q, ty = c.ty[c.finishIdx] * q;
    for (let j = 0; j < m; j++) for (let rr = 0; rr < 2; rr++) {
      const x = f.ax + sx * j - tx * (rr ? 0 : 1), y = f.ay + sy * j - ty * (rr ? 0 : 1);
      g.fillStyle = (j + rr) % 2 ? t.finish[0] : t.finish[1];
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + sx, y + sy); g.lineTo(x + sx + tx, y + sy + ty); g.lineTo(x + tx, y + ty); g.closePath(); g.fill();
    }
  }

  function capsule(g, ax, ay, bx, by, r, color, hi) {
    g.lineCap = 'round';
    g.strokeStyle = color; g.lineWidth = r * 2;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (hi) { g.strokeStyle = hi; g.lineWidth = Math.max(1.5, r * 0.35); g.globalAlpha = 0.7; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.globalAlpha = 1; }
  }
  function drawFields(g, c, t, y0, y1, lw) {
    const T = Math.max(0, R.dispT);
    for (const o of c.obstacles) {
      if (!o.field) continue;
      const ext = o.R || Math.max(o.rx || 0, o.ry || 0) || Math.hypot(o.hl, o.hw);
      if (o.y + ext < y0 || o.y - ext > y1) continue;
      if (o.type === 'swamp') {
        g.save(); g.translate(o.x, o.y); g.rotate(o.th * Math.PI / 180);
        g.fillStyle = 'rgba(124,86,40,.42)'; g.beginPath(); g.ellipse(0, 0, o.ry, o.rx, 0, 0, 7); g.fill();
        g.fillStyle = 'rgba(80,52,20,.55)';
        for (let k = 0; k < 28; k++) { const a = k * 2.399, rr = Math.sqrt((k + 0.5) / 28); g.beginPath(); g.arc(Math.cos(a) * o.ry * rr * 0.9, Math.sin(a) * o.rx * rr * 0.9, Math.max(2, 3 * lw), 0, 7); g.fill(); }
        g.restore();
      } else if (o.type === 'boost') {
        g.save(); g.translate(o.x, o.y); g.rotate(o.th * Math.PI / 180);
        g.fillStyle = 'rgba(33,181,115,.85)'; roundRect(g, -o.hl, -o.hw, o.hl * 2, o.hw * 2, Math.min(o.hl, o.hw) * 0.3); g.fill();
        g.strokeStyle = '#FFFFFF'; g.lineWidth = Math.max(3, o.hl * 0.12); g.lineCap = 'round'; g.lineJoin = 'round';
        const off = (T * 2) % 1;
        for (let k = -1; k <= 1; k++) { const x = (k + off - 0.5) * o.hl * 0.6; g.globalAlpha = 0.5 + 0.5 * Math.sin((k + off) * 2); g.beginPath(); g.moveTo(x - o.hl * 0.18, -o.hw * 0.45); g.lineTo(x + o.hl * 0.18, 0); g.lineTo(x - o.hl * 0.18, o.hw * 0.45); g.stroke(); }
        g.globalAlpha = 1; g.restore();
      } else if (o.type === 'vortex') {
        g.save(); g.translate(o.x, o.y); g.rotate(T * 2.2 * o.dir);
        g.strokeStyle = t.flow.replace(/[\d.]+\)$/, '0.45)'); g.lineWidth = Math.max(3, 3 * lw);
        for (let arm = 0; arm < 3; arm++) {
          g.beginPath();
          for (let a = 0; a < 5; a += 0.12) { const rr = o.R * 0.12 + a / 5 * o.R * 0.85, ang = a * o.dir + arm * 2.094; g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
          g.stroke();
        }
        g.restore();
      }
    }
  }

  function drawStations(g, c, t, y0, y1, lw) {
    const T = R.dispT, W = R.world;
    for (const S2 of R.stations) {
      if (S2.by + S2.bh < y0 || S2.by - S2.bh > y1) continue;
      const st = S2.st, L = S2.line;
      const full = st.times.length >= st.count && st.times[st.count - 1] <= T;
      g.strokeStyle = full ? 'rgba(180,140,20,.45)' : '#E9A90F'; g.lineWidth = Math.max(6, 4 * lw); g.setLineDash([16, 10]);
      g.beginPath(); g.moveTo(L.ax, L.ay); g.lineTo(L.bx, L.by); g.stroke(); g.setLineDash([]);
      // 당첨 칸
      g.strokeStyle = '#E9A90F'; g.lineWidth = Math.max(3, 2.5 * lw);
      g.beginPath(); g.moveTo(S2.ex, S2.ey); g.lineTo(S2.bx, S2.by); g.stroke();
      g.fillStyle = t.label; roundRect(g, S2.bx - S2.bw / 2, S2.by - S2.bh / 2, S2.bw, S2.bh, c.r * 1.2); g.fill();
      g.strokeStyle = '#E9A90F'; g.lineWidth = Math.max(3, 2 * lw); g.stroke();
      g.strokeStyle = t.flow; g.lineWidth = Math.max(1.5, lw);
      for (const [sx, sy] of S2.slots) { g.beginPath(); g.arc(sx, sy, c.r * 1.05, 0, 7); g.stroke(); }
    }
  }
  // 당첨 칸으로 빠진 공(트랙 밖)
  function drawCaptured(g, c) {
    const T = R.dispT, W = R.world, r = c.r, sz = r * 2 * (SPR / 2) / SPR_R;
    for (const S2 of R.stations) {
      const st = S2.st;
      for (let q = 0; q < st.balls.length; q++) {
        const tc = st.times[q]; if (tc > T) continue;
        const id = st.balls[q], [sx, sy] = S2.slots[q];
        let e = clamp((T - tc) / 0.7, 0, 1); e = e * e * (3 - 2 * e);
        const x = W.capX[id] + (sx - W.capX[id]) * e, y = W.capY[id] + (sy - W.capY[id]) * e - Math.sin(e * Math.PI) * r * 4;
        g.drawImage(R.sprites[id], x - sz / 2, y - sz / 2, sz, sz);
      }
    }
  }

  function drawObstacles(g, c, t, y0, y1, lw) {
    const T = R.dispT;
    c.obstacles.forEach((o, id) => {
      if (o.field) return;
      const oy = o.y !== undefined ? o.y : (o.ay + o.by) / 2;
      const ext = o.len || (o.ax !== undefined ? Math.hypot(o.bx - o.ax, o.by - o.ay) : 0) + (o.r || 0);
      if (oy + ext < y0 || oy - ext > y1) return;
      switch (o.type) {
        case 'post':
          g.fillStyle = t.post; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 7); g.fill();
          g.strokeStyle = t.obs; g.lineWidth = Math.max(1.5, lw); g.stroke();
          break;
        case 'bumper': {
          const ht = R.flash.get(id);
          const fl = ht !== undefined && T - ht < 0.22 ? 1 - (T - ht) / 0.22 : 0;
          const rr = o.r * (1 + fl * 0.25);
          if (fl) { g.fillStyle = t.bumper; g.globalAlpha = 0.18 * fl; g.beginPath(); g.arc(o.x, o.y, rr * 1.45, 0, 7); g.fill(); g.globalAlpha = 1; }
          g.fillStyle = t.bumper; g.beginPath(); g.arc(o.x, o.y, rr, 0, 7); g.fill();
          g.fillStyle = t.bumperCore; g.beginPath(); g.arc(o.x, o.y, rr * 0.45, 0, 7); g.fill();
          break;
        }
        case 'island':
          capsule(g, o.ax, o.ay, o.bx, o.by, o.r, t.obs, t.obsHi);
          break;
        case 'divider': case 'ledge':
          capsule(g, o.ax, o.ay, o.bx, o.by, o.r, t.obs, t.obsHi);
          break;
        case 'rotor': {
          for (let bl = 0; bl < (o.blades || 1); bl++) {
            const a = o.phase + o.omega * Math.max(0, T) + bl * Math.PI / 2;
            const dx = Math.cos(a) * o.len, dy = Math.sin(a) * o.len;
            capsule(g, o.x - dx, o.y - dy, o.x + dx, o.y + dy, o.thick, t.rotor, t.obsHi);
          }
          g.fillStyle = t.obs; g.beginPath(); g.arc(o.x, o.y, o.thick * 1.8, 0, 7); g.fill();
          break;
        }
        case 'gate': {
          const tt = Math.max(-1, T), per = o.period, m = (((tt + o.phase) % per) + per) % per;
          const closed = tt < 0 || m >= o.open;
          if (closed) capsule(g, o.ax, o.ay, o.bx, o.by, o.r, '#E9A90F', '#FFF1C7');
          else { g.strokeStyle = 'rgba(233,169,15,.45)'; g.lineWidth = Math.max(2, 2 * lw); g.setLineDash([8, 8]); g.beginPath(); g.moveTo(o.ax, o.ay); g.lineTo(o.bx, o.by); g.stroke(); g.setLineDash([]); }
          // 남은 시간 표시 점
          const left = closed ? (per - m) / (per - o.open) : (o.open - m) / o.open;
          g.fillStyle = closed ? '#E5484D' : '#21B573';
          g.beginPath(); g.arc(o.ax, o.ay, o.r * (1 + left), 0, 7); g.fill();
          break;
        }
      }
    });
  }

  function drawBalls(g, c, y0, y1, lw) {
    const P = R.pos, r = c.r, n = R.n, sz = r * 2 * (SPR / 2) / SPR_R;
    const winners = R.winnerSet;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1];
      if (x !== x || y < y0 || y > y1) continue;
      if (R.rotates[i]) {
        g.save(); g.translate(x, y); g.rotate(P[i * 3 + 2]); g.drawImage(R.sprites[i], -sz / 2, -sz / 2, sz, sz); g.restore();
      } else g.drawImage(R.sprites[i], x - sz / 2, y - sz / 2, sz, sz);
    }
    const ring = (i, color, w) => { const x = P[i * 3], y = P[i * 3 + 1]; if (x !== x) return; g.strokeStyle = color; g.lineWidth = w; g.beginPath(); g.arc(x, y, r + 3 * lw + w / 2, 0, 7); g.stroke(); };
    if (winners) winners.forEach(i => ring(i, '#FFC83D', Math.max(2.5, 3 * lw)));
    if (R.findId >= 0) ring(R.findId, R.theme.text, Math.max(2.5, 3 * lw));
    if (R.hoverId >= 0) ring(R.hoverId, R.theme.text, Math.max(1.5, 2 * lw));
  }

  function updateParticles(g, dt) {
    const ps = R.particles, d = R.paused ? 0 : dt * Math.min(1.5, R.baseRate * R.userSpeed);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += d; if (p.age > p.life) { ps.splice(i, 1); continue; }
      p.vy += 600 * d; p.x += p.vx * d; p.y += p.vy * d;
      g.globalAlpha = 1 - p.age / p.life; g.fillStyle = p.c;
      g.fillRect(p.x - p.s, p.y - p.s, p.s * 2, p.s * 2);
    }
    g.globalAlpha = 1;
  }

  function drawStationLabels(g, z, ox, oy) {
    g.font = '800 14px ' + FONT(); g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const S2 of R.stations) {
      const st = S2.st, sx = S2.bx * z + ox, sy = (S2.by - S2.bh / 2) * z + oy - 14;
      if (sy < -40 || sy > R.vh + 40) continue;
      const got = st.times.filter(x => x <= R.dispT).length;
      const text = `${st.tier}등 당첨 칸 ${got}/${st.count}`;
      const w = g.measureText(text).width + 16;
      g.fillStyle = '#E9A90F'; roundRect(g, sx - w / 2, sy - 11, w, 22, 11); g.fill();
      g.fillStyle = '#1F1600'; g.fillText(text, sx, sy + 0.5);
    }
    g.textAlign = 'left';
  }

  function drawPieceLabels(g, c, t, i0, i1, z, ox, oy) {
    g.font = '600 13px ' + FONT();
    g.textBaseline = 'middle';
    for (const p of c.pieces) {
      if (p.type === 'runoff') continue;
      const i = Math.min(c.n - 1, p.i0 + 6);
      if (i < i0 || i > i1) continue;
      const lx = Math.min(c.lx[i], c.rx[i]), rx = Math.max(c.lx[i], c.rx[i]), y = (c.ly[i] + c.ry[i]) / 2;
      let sx = lx * z + ox - 14, sy = y * z + oy, align = 'right';
      if (sx < 120) { sx = rx * z + ox + 14; align = 'left'; }
      if (sx > R.vw - 20) continue;
      g.textAlign = align;
      g.globalAlpha = 0.8; g.fillStyle = t.text;
      g.fillText(p.name, sx, sy);
      g.globalAlpha = 1;
    }
    g.textAlign = 'left';
  }

  function drawNameLabels(g, z, ox, oy, y0, y1) {
    const n = R.n, P = R.pos, r = R.course.r, mode = R.cfg.labels;
    if (mode === 'off' && R.findId < 0 && R.hoverId < 0) return;
    let ids;
    if (mode === 'all' || n <= 24) { ids = []; for (let i = 0; i < n; i++) ids.push(i); }
    else {
      const set = new Set();
      const running = [];
      for (let i = 0; i < n; i++) if (!R.fin[i] && P[i * 3] === P[i * 3]) running.push(i);
      running.sort((a, b) => R.prog[b] - R.prog[a]);
      running.slice(0, 5).forEach(i => set.add(i));
      if (R.eng.spec.dir === 'bottom') running.slice(-Math.min(8, R.eng.win.n + 2)).forEach(i => set.add(i));
      if (R.activeWin && R.activeWin.focus) R.activeWin.focus.forEach(i => set.add(i));
      ids = [...set];
    }
    if (mode === 'off') ids = [];
    if (R.findId >= 0) ids.push(R.findId);
    if (R.hoverId >= 0) ids.push(R.hoverId);
    g.font = '700 12px ' + FONT();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const done = new Set();
    for (const i of ids) {
      if (done.has(i)) continue; done.add(i);
      const x = P[i * 3], y = P[i * 3 + 1];
      if (x !== x || y < y0 || y > y1) continue;
      const sx = x * z + ox, sy = y * z + oy - r * z - 13;
      const name = R.cfg.balls[i].name;
      const w = g.measureText(name).width + 12;
      g.fillStyle = R.theme.label;
      roundRect(g, sx - w / 2, sy - 9, w, 18, 9); g.fill();
      g.fillStyle = R.theme.labelText; g.fillText(name, sx, sy + 0.5);
    }
  }
  let fontCache = '';
  function FONT() { return fontCache || (fontCache = getComputedStyle(document.body).fontFamily); }
  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /* ---------- HUD · 순위 · 미니맵 ---------- */
  function updateHud() {
    const c = R.course, t = R.dispT;
    $('hudTime').textContent = fmtTime(Math.max(0, t) / R.baseRate);
    let best = 0, bi = -1;
    for (let i = 0; i < R.n; i++) if (R.prog[i] > best) { best = R.prog[i]; bi = i; }
    const frac = clamp((best - c.startLen) / (c.finishS - c.startLen), 0, 1);
    $('hudProg').style.width = (frac * 100).toFixed(1) + '%';
    const idx = E.indexAtY(c, R.cam.y);
    const piece = c.pieces[c.piece[idx]];
    const sec = t < 0 ? '출발 준비' : piece ? piece.name : '';
    if ($('hudSection').textContent !== sec) $('hudSection').textContent = sec;
    const w = R.activeWin;
    $('slowBadge').hidden = !w; $('btnSkipSlow').hidden = !w;
    if (w) { $('slowFactor').textContent = '×' + w.factor.toFixed(2).replace(/0$/, ''); $('slowLabel').textContent = w.label; }
    const pl = R.paused ? '계속' : '일시정지';
    if (R.pauseLabel !== pl) { R.pauseLabel = pl; $('btnPause').innerHTML = `<span class="ico">${R.paused ? '▶' : '⏸'}</span><span class="txt">${pl}</span>`; }
  }

  function displayOrder() {
    const n = R.n, W = R.world;
    const fin = [], run = [];
    for (let i = 0; i < n; i++) { if (W.capT[i] <= R.dispT) continue; (R.fin[i] ? fin : run).push(i); }
    fin.sort((a, b) => W.finT[a] - W.finT[b]);
    run.sort((a, b) => R.prog[b] - R.prog[a]);
    return fin.concat(run);
  }

  function dotStyle(i) {
    const b = R.cfg.balls[i];
    const u = R.thumbs[i];
    return u ? `background-image:url(${u});box-shadow:0 0 0 2px ${b.color}` : `background:${b.color}`;
  }
  function renderRanking() {
    const order = displayOrder(), n = R.n, w = R.eng.win, W = R.world;
    const rows = [];
    const row = (rank, i) => {
      const fin = R.fin[i];
      let st = '', cls = '', zone = false;
      if (fin) st = (W.finT[i] / R.baseRate).toFixed(1) + '초';
      if (w.type !== 'full' && w.type !== 'blind' && isZoneBall(rank)) { zone = true; cls = 'win'; st = fin ? (st + ' · 당첨권') : '당첨권'; }
      else if ((w.type === 'bottom' || w.type === 'last') && fin) { cls = 'safe'; st = 'SAFE'; }
      if (w.type === 'full' && rank <= 3 && fin) st = ['🥇', '🥈', '🥉'][rank - 1] + ' ' + st;
      return `<li class="${zone ? 'zone' : ''}${i === R.findId ? ' me' : ''}"><span class="rk">${rank}</span><span class="dot" style="${dotStyle(i)}"></span><span class="nm">${esc(R.cfg.balls[i].name)}</span><span class="st ${cls}">${st}</span></li>`;
    };
    const shown = new Set();
    if (w.type === 'tiers') {
      // 등수별 당첨 현황 + 남은 공
      const live = R.stations.slice().map(S2 => S2.st);
      live.forEach(st => {
        const got = st.balls.filter((b, q) => st.times[q] <= R.dispT);
        rows.push(`<li class="tier-row-live"><b>${st.tier}등</b><span class="tc">${got.length}/${st.count}</span><div class="tn">${got.map(b => esc(R.cfg.balls[b].name)).join(', ') || '—'}</div></li>`);
      });
      rows.push(`<li class="tier-row-live"><b>1등</b><span class="tc">결승선 · ${w.tiers[0]}명</span><div class="tn">${R.resultShown && R.resultData ? R.resultData.winners.map(b => esc(R.cfg.balls[b].name)).join(', ') : '—'}</div></li>`);
      rows.push('<li class="head">남은 공 순위</li>');
      order.slice(0, 8).forEach((i, q) => rows.push(row(q + 1, i)));
      $('rankList').innerHTML = rows.join('');
      $('rankMeta').textContent = `남은 공 ${order.length}개`;
      return;
    }
    if (n <= 16) order.forEach((i, q) => { rows.push(row(q + 1, i)); shown.add(i); });
    else {
      const topK = (w.type === 'top' || w.type === 'nth') ? Math.max(8, Math.min(w.n + 2, 14)) : 8;
      order.slice(0, topK).forEach((i, q) => { rows.push(row(q + 1, i)); shown.add(i); });
      if (w.type === 'bottom' || w.type === 'last') {
        const k = Math.min(n - topK, (w.n || 1) + 2);
        rows.push('<li class="sep">⋯</li>');
        for (let q = n - k; q < n; q++) { rows.push(row(q + 1, order[q])); shown.add(order[q]); }
      }
      if (R.findId >= 0 && !shown.has(R.findId)) { rows.push('<li class="sep">⋯</li>'); rows.push(row(order.indexOf(R.findId) + 1, R.findId)); }
    }
    $('rankList').innerHTML = rows.join('');
    $('rankMeta').textContent = `도착 ${R.finCount} / ${n}`;
  }

  // 미니맵: 코스를 곧게 편 띠. 위가 출발, 아래가 결승이고 띠 폭은 실제 트랙 폭입니다.
  function buildMinimap() {
    const c = R.course, dpr = R.dpr, mw = mini.width, mh = mini.height;
    if (!mw || !mh) return;
    const pad = 10 * dpr, total = c.s[c.n - 1];
    let wmax = 0; for (let i = 0; i < c.n; i++) wmax = Math.max(wmax, c.w[i]);
    const cx = mw / 2, half = (mw * 0.36) / wmax, sy = (mh - pad * 2) / total;
    R.mm = { cx, half, sy, pad, total };
    const off = document.createElement('canvas'); off.width = mw; off.height = mh;
    const g = off.getContext('2d');
    const zoneCol = R.theme.zone.map(z => z.startsWith('rgba') ? z.replace(/[\d.]+\)$/, '0.55)') : z);
    for (let i = 0; i < c.n - 1; i += 2) {
      const j = Math.min(c.n - 1, i + 2);
      g.fillStyle = zoneCol[c.zone[i]];
      g.beginPath();
      g.moveTo(cx - c.w[i] * half, pad + c.s[i] * sy); g.lineTo(cx + c.w[i] * half, pad + c.s[i] * sy);
      g.lineTo(cx + c.w[j] * half, pad + c.s[j] * sy + 0.6); g.lineTo(cx - c.w[j] * half, pad + c.s[j] * sy + 0.6);
      g.closePath(); g.fill();
    }
    g.strokeStyle = R.theme.wall; g.lineWidth = 1.2 * dpr;
    for (const sg of [-1, 1]) { g.beginPath(); for (let i = 0; i < c.n; i += 3) g.lineTo(cx + sg * c.w[i] * half, pad + c.s[i] * sy); g.stroke(); }
    // 장애물 표시
    g.fillStyle = R.theme.obs;
    for (const o of c.obstacles) {
      const ox = o.x !== undefined ? o.x : (o.ax + o.bx) / 2, oy = o.y !== undefined ? o.y : (o.ay + o.by) / 2;
      const i = E.indexAtY(c, oy), lat = (ox - c.x[i]) * -c.ty[i] + (oy - c.y[i]) * c.tx[i];
      g.fillRect(cx + lat * half * 2 - 1.5 * dpr, pad + c.s[i] * sy - 1, 3 * dpr, 2 * dpr);
    }
    g.strokeStyle = R.theme.text; g.lineWidth = 2 * dpr;
    const fy = pad + c.finishS * sy;
    g.beginPath(); g.moveTo(cx - wmax * half - 6 * dpr, fy); g.lineTo(cx + wmax * half + 6 * dpr, fy); g.stroke();
    g.fillStyle = R.theme.text; g.font = `${11 * dpr}px ${FONT()}`; g.textAlign = 'left';
    g.fillText('출발', 4 * dpr, pad + 8 * dpr); g.fillText('결승', 4 * dpr, fy + 4 * dpr);
    for (const st of R.world.stations) {
      const y = pad + st.s * sy;
      g.strokeStyle = '#E9A90F'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(cx - wmax * half - 4 * dpr, y); g.lineTo(cx + wmax * half + 4 * dpr, y); g.stroke();
      g.fillStyle = '#B7790A'; g.textAlign = 'right'; g.fillText(`${st.tier}등`, mw - 4 * dpr, y + 4 * dpr); g.textAlign = 'left';
    }
    R.miniBase = off;
  }
  function drawMinimap() {
    if (!R.miniBase) buildMinimap();
    if (!R.miniBase) return;
    const g = mctx, c = R.course, { cx, half, sy, pad } = R.mm, dpr = R.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, mini.width, mini.height);
    g.drawImage(R.miniBase, 0, 0);
    // 지금 화면에 보이는 범위
    const z = R.cam.z, ya = R.cam.y - (R.vh * 0.42) / z, yb = R.cam.y + (R.vh * 0.58) / z;
    const sa = c.s[E.indexAtY(c, ya)], sb = c.s[E.indexAtY(c, yb)];
    g.fillStyle = 'rgba(229,72,77,.16)'; g.strokeStyle = '#E5484D'; g.lineWidth = 1.5 * dpr;
    g.fillRect(6 * dpr, pad + sa * sy, mini.width - 12 * dpr, Math.max(3, (sb - sa) * sy));
    g.strokeRect(6 * dpr, pad + sa * sy, mini.width - 12 * dpr, Math.max(3, (sb - sa) * sy));
    const P = R.pos, rad = (R.n > 100 ? 1.7 : 3) * dpr;
    for (let i = 0; i < R.n; i++) {
      const x = P[i * 3]; if (x !== x) continue;
      const y = P[i * 3 + 1], s = R.prog[i];
      const k = E.indexAtS(c, s), lat = (x - c.x[k]) * -c.ty[k] + (y - c.y[k]) * c.tx[k];
      g.fillStyle = R.cfg.balls[i].color;
      g.beginPath(); g.arc(cx + lat * half * 2, pad + s * sy, i === R.findId ? rad * 2.2 : rad, 0, 7); g.fill();
    }
  }

  /* ---------- 레이스 조작 ---------- */
  function bindRace() {
    $('btnPause').addEventListener('click', () => { if (R) R.paused = !R.paused; });
    $('segSpeed').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b || !R) return; R.userSpeed = Number(b.dataset.v); setPressed('segSpeed', R.userSpeed); });
    $('selCam').addEventListener('change', e => { if (!R) return; R.camMode = e.target.value; R.findId = -1; $('inFind').value = ''; });
    $('inFind').addEventListener('change', e => {
      if (!R) return;
      const q = e.target.value.trim();
      if (!q) { R.findId = -1; return; }
      const i = R.cfg.balls.findIndex(b => b.name === q) >= 0 ? R.cfg.balls.findIndex(b => b.name === q) : R.cfg.balls.findIndex(b => b.name.includes(q));
      R.findId = i;
      if (i >= 0 && R.camMode === 'free') { R.camMode = 'auto'; $('selCam').value = 'auto'; }
    });
    $('btnSkipSlow').addEventListener('click', () => { if (R && R.activeWin) R.skipUntil = R.activeWin.t1; });
    $('btnSound').addEventListener('click', () => { sound.on = !sound.on; if (sound.on) sound.ensure(); $('btnSound').textContent = sound.on ? '🔊' : '🔇'; });
    $('btnExit').addEventListener('click', () => { stopRace(); $('result').hidden = true; showScreen('setup'); document.body.dataset.gtheme = S.theme; });
    $('btnShowResult').addEventListener('click', () => { if (R) showResult(true); });
    // 끌어서 이동, 휠로 확대
    let drag = null;
    stage.addEventListener('pointerdown', e => { if (!R) return; drag = { x: e.clientX, y: e.clientY, moved: false }; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', e => {
      if (!R) return;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; setFree(); }
        if (drag.moved) { R.cam.x -= dx / R.cam.z; R.cam.y -= dy / R.cam.z; drag.x = e.clientX; drag.y = e.clientY; }
        return;
      }
      const rect = stage.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const z = R.cam.z, ox = R.vw / 2 - R.cam.x * z, oy = R.vh * 0.42 - R.cam.y * z;
      let best = -1, bd = 22 * 22;
      for (let i = 0; i < R.n; i++) { const x = R.pos[i * 3]; if (x !== x) continue; const dx = x * z + ox - mx, dy = R.pos[i * 3 + 1] * z + oy - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      R.hoverId = best;
    });
    stage.addEventListener('pointerup', () => { drag = null; });
    stage.addEventListener('pointerleave', () => { if (R) R.hoverId = -1; });
    stage.addEventListener('wheel', e => { if (!R) return; e.preventDefault(); setFree(); R.freeZ = clamp((R.freeZ || R.cam.z) * Math.exp(-e.deltaY * 0.0015), 0.02, 4); }, { passive: false });
    mini.addEventListener('click', e => {
      if (!R || !R.mm) return;
      const rect = mini.getBoundingClientRect(), dpr = R.dpr, c = R.course;
      const s = ((e.clientY - rect.top) * dpr - R.mm.pad) / R.mm.sy;
      const i = E.indexAtS(c, clamp(s, 0, R.mm.total));
      setFree(); R.cam.x = c.x[i]; R.cam.y = c.y[i];
    });
    window.addEventListener('keydown', e => {
      if (!R || $('race').hidden || !$('result').hidden) return;
      if (e.target.matches('input, select, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); R.paused = !R.paused; }
    });
    window.addEventListener('resize', () => { if (R) { resize(); R.miniBase = null; } });
  }
  function setFree() {
    if (R.camMode !== 'free') { R.camMode = 'free'; R.freeZ = R.cam.z; R.findId = -1; $('inFind').value = ''; }
    $('selCam').value = 'free';
  }

  /* ================= 결과 ================= */
  function showResult(again) {
    if (!R) return;
    R.resultShown = true;
    R.paused = true;
    const W = R.world, cfg = R.cfg;
    const order = E.fullOrder(W);
    const winners = E.computeWinners(order, R.eng.personOf, R.eng.spec);
    R.winnerSet = new Set(winners);
    // 단계별 추첨: 1등(결승선) + 각 당첨 지점
    let groups = null;
    if (cfg.win.type === 'tiers') {
      groups = [{ tier: 1, balls: winners }].concat(W.stations.slice().sort((a, b) => a.tier - b.tier).map(st => ({ tier: st.tier, balls: st.balls.slice() })));
    }
    R.resultData = { order, winners, groups };
    $('resMeta').textContent = `${cfg.persons}명 · ${cfg.duration}초 ${STYLE_NAME[cfg.style]} · ${DIFF_NAME[cfg.difficulty]} · ${ruleText(cfg).split(' · ')[0]}`;
    $('resTitle').textContent = cfg.win.type === 'full' ? '최종 순위' : cfg.win.type === 'tiers' ? '등수별 당첨 결과' : '행운의 주인공';
    $('resSeed').textContent = '#' + cfg.seed; $('copyMsg').textContent = '';
    const moreToWatch = !W.done || R.dispT < W.time - 0.05;
    $('btnContinue').hidden = !moreToWatch;
    $('btnShowResult').hidden = true;
    renderResultRank(order, winners);
    const cards = $('winnerCards');
    cards.innerHTML = '';
    $('result').hidden = false;
    $('fullRankBox').open = cfg.win.type === 'full' || cfg.persons <= 12;
    const makeCard = (i, sub, q) => {
      const el = document.createElement('div');
      el.className = 'winner-card';
      el.style.animationDelay = (q * 0.06) + 's';
      const cv = document.createElement('canvas'); cv.width = cv.height = 168;
      cv.getContext('2d').drawImage(R.sprites[i], 0, 0, 168, 168);
      el.append(cv);
      el.insertAdjacentHTML('beforeend', `<b>${esc(cfg.people[cfg.balls[i].personId].name)}</b><span>${sub}</span>`);
      return el;
    };
    if (groups) {
      cards.classList.remove('many');
      let q = 0;
      groups.forEach(gp => {
        const box = document.createElement('div'); box.className = 'tier-group';
        box.innerHTML = `<h3>${gp.tier}등 · ${gp.balls.length}명</h3>`;
        const row = document.createElement('div'); row.className = 'winner-cards' + (gp.tier > 1 || gp.balls.length > 4 ? ' many' : '');
        gp.balls.forEach(i => row.append(makeCard(i, gp.tier === 1 ? '결승선 도착' : `${gp.tier}등 당첨 지점`, q++)));
        box.append(row); cards.append(box);
      });
      $('blindRoll').hidden = true;
      if (!again) { sound.fanfare(); confetti(); }
      $('fullRankBox').open = false;
      return;
    }
    const reveal = () => {
      const show = cfg.win.type === 'full' ? order.slice(0, 3) : winners;
      cards.classList.toggle('many', show.length > 4);
      show.forEach((i, q) => {
        const rank = order.indexOf(i) + 1;
        const el = document.createElement('div');
        el.className = 'winner-card';
        el.style.animationDelay = (q * 0.08) + 's';
        const cv = document.createElement('canvas'); cv.width = cv.height = 168;
        cv.getContext('2d').drawImage(R.sprites[i], 0, 0, 168, 168);
        const person = cfg.people[cfg.balls[i].personId];
        let sub = `${rank}등 도착`;
        if (cfg.win.type === 'bottom' || cfg.win.type === 'last') sub = rank === cfg.balls.length ? '꼴찌 도착' : `뒤에서 ${cfg.balls.length - rank + 1}번째`;
        if (cfg.win.type === 'full') sub = ['🥇 1등', '🥈 2등', '🥉 3등'][q];
        el.append(cv);
        el.insertAdjacentHTML('beforeend', `<b>${esc(person.name)}</b><span>${sub}</span>`);
        cards.append(el);
      });
      if (!again) { sound.fanfare(); confetti(); }
    };
    if (cfg.win.type === 'blind' && !again) blindRoll(R.eng.win.secret, cfg.persons, reveal);
    else { $('blindRoll').hidden = cfg.win.type !== 'blind'; if (cfg.win.type === 'blind') $('blindRoll').innerHTML = `<small>당첨 등수</small>${R.eng.win.secret}등`; reveal(); }
  }

  function renderResultRank(order, winners) {
    const W = R.world, ws = new Set(winners);
    $('resRank').innerHTML = order.map((i, q) => {
      const fin = W.finT[i] <= R.dispT + 1e-6;
      const st = fin ? (W.finT[i] / R.baseRate).toFixed(1) + '초' : '주행 중';
      return `<li class="${ws.has(i) ? 'win' : ''}"><span class="rk">${q + 1}</span><span class="dot" style="${dotStyle(i)}"></span><span>${esc(R.cfg.balls[i].name)}</span><span class="st">${st}</span></li>`;
    }).join('');
  }

  function blindRoll(secret, persons, done) {
    const el = $('blindRoll'); el.hidden = false;
    let t = 0, delay = 50, cur = 1;
    const step = () => {
      cur = 1 + Math.floor(Math.random() * persons);
      el.innerHTML = `<small>몇 등이 당첨일까요?</small>${cur}등`;
      sound.tone(500 + cur * 7, 0.04, 'square', 0.04);
      t += delay; delay *= 1.12;
      if (t < 2300) setTimeout(step, delay);
      else { el.innerHTML = `<small>당첨 등수</small>${secret}등`; sound.beep(true); setTimeout(done, 350); }
    };
    step();
  }

  function confetti() {
    const cv = $('confetti'), g = cv.getContext('2d');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cv.hidden = false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    const parts = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 900, vy: -300 - Math.random() * 600, r: Math.random() * 6, w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
      c: PALETTE[Math.floor(Math.random() * 12)], spin: (Math.random() - 0.5) * 10,
    }));
    let last = performance.now(), life = 0;
    const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; life += dt;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 900 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.spin * dt;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      }
      if (life < 3.2) requestAnimationFrame(tick); else { cv.hidden = true; }
    };
    requestAnimationFrame(tick);
  }

  function saveResultImage() {
    if (!R || !R.resultData) return;
    const { order, winners } = R.resultData, cfg = R.cfg, t = R.theme;
    const cs = getComputedStyle(document.body);
    const panel = cs.getPropertyValue('--panel').trim() || '#fff', ink = cs.getPropertyValue('--ink').trim() || '#222', muted = cs.getPropertyValue('--muted').trim() || '#777', gold = cs.getPropertyValue('--gold').trim() || '#D99A06';
    const font = cs.fontFamily;
    const W = 1080, listN = Math.min(order.length, 40), H = 760 + Math.ceil(listN / 2) * 40;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = t.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = panel; roundRect(g, 40, 40, W - 80, H - 80, 36); g.fill();
    g.textAlign = 'center'; g.fillStyle = muted; g.font = `500 26px ${font}`;
    g.fillText($('resMeta').textContent, W / 2, 110);
    g.fillStyle = ink; g.font = `400 72px "Black Han Sans", ${font}`;
    g.fillText($('resTitle').textContent, W / 2, 196);
    const groups = R.resultData.groups;
    const tierOf = new Map();
    if (groups) groups.forEach(gp => gp.balls.forEach(i => tierOf.set(i, gp.tier)));
    const show = cfg.win.type === 'full' ? order.slice(0, 3) : groups ? groups.flatMap(gp => gp.balls).slice(0, 24) : winners.slice(0, 8);
    const size = show.length > 8 ? 90 : show.length > 4 ? 120 : 170, gap = 30;
    const extra = Math.max(0, Math.ceil(show.length / 4) - 1) * (size + 90);
    c.height = H + extra; g.fillStyle = t.bg; g.fillRect(0, 0, W, H + extra);
    g.fillStyle = panel; roundRect(g, 40, 40, W - 80, H + extra - 80, 36); g.fill();
    g.textAlign = 'center'; g.fillStyle = muted; g.font = `500 26px ${font}`; g.fillText($('resMeta').textContent, W / 2, 110);
    g.fillStyle = ink; g.font = `400 72px "Black Han Sans", ${font}`; g.fillText($('resTitle').textContent, W / 2, 196);
    show.forEach((i, q) => {
      const row = Math.floor(q / 4), col = q % 4, inRow = Math.min(4, show.length - row * 4);
      const x = W / 2 - (inRow * (size + gap) - gap) / 2 + col * (size + gap), y = 240 + row * (size + 90);
      g.drawImage(R.sprites[i], x, y, size, size);
      g.fillStyle = ink; g.font = `700 ${size > 150 ? 34 : 26}px ${font}`;
      const nm = cfg.people[cfg.balls[i].personId].name;
      g.fillText(tierOf.has(i) ? `${tierOf.get(i)}등 ${nm}` : nm, x + size / 2, y + size + 44);
    });
    const listTop = 240 + Math.ceil(show.length / 4) * (size + 90) + 30;
    g.textAlign = 'left'; g.font = `500 26px ${font}`;
    const ws = new Set(winners);
    order.slice(0, listN).forEach((i, q) => {
      const col = q < Math.ceil(listN / 2) ? 0 : 1, row = col ? q - Math.ceil(listN / 2) : q;
      const x = 110 + col * 440, y = listTop + row * 40;
      g.fillStyle = ws.has(i) ? gold : muted; g.fillText(String(q + 1).padStart(2, ' '), x, y);
      g.fillStyle = cfg.balls[i].color; g.beginPath(); g.arc(x + 58, y - 9, 11, 0, 7); g.fill();
      g.fillStyle = ws.has(i) ? gold : ink; g.fillText(cfg.balls[i].name, x + 80, y);
    });
    g.textAlign = 'center'; g.fillStyle = muted; g.font = `500 22px ${font}`;
    g.fillText(`행운볼 레이스 · 시드 #${cfg.seed} · ${new Date().toLocaleString('ko-KR')}`, W / 2, H + extra - 70);
    c.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `행운볼_결과_${cfg.seed}.png`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  function bindResult() {
    $('btnAgain').addEventListener('click', () => { if (lastCfg) startRace({ cfg: lastCfg }); });
    $('btnReplay').addEventListener('click', () => { if (lastCfg) startRace({ cfg: lastCfg, seed: lastCfg.seed }); });
    $('btnContinue').addEventListener('click', () => {
      $('result').hidden = true;
      if (R) { R.paused = false; $('btnShowResult').hidden = false; }
    });
    $('btnToSetup').addEventListener('click', () => { stopRace(); $('result').hidden = true; showScreen('setup'); document.body.dataset.gtheme = S.theme; });
    $('btnSaveImg').addEventListener('click', saveResultImage);
    $('btnCopySeed').addEventListener('click', () => {
      const text = lastCfg ? String(lastCfg.seed) : '';
      const ok = () => { $('copyMsg').textContent = '복사했습니다. 고급 설정의 시드 번호에 넣으면 같은 레이스가 나옵니다.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => { $('copyMsg').textContent = `시드 번호: ${text}`; });
      else $('copyMsg').textContent = `시드 번호: ${text}`;
    });
  }

  /* ================= 시작 ================= */
  loadSettings();
  let hasSaved = false;
  try { hasSaved = !!localStorage.getItem(LS_KEY); } catch (e) { /* 저장소 사용 불가 */ }
  if (!S.namesText && !hasSaved) { S.namesText = EXAMPLE_NAMES.slice(0, 8).join(', '); S.count = 8; }
  renderThemeCards();
  syncControls();
  bindSetup(); bindTiers(); bindRace(); bindResult();
  refresh(true);
  // 디버그/테스트용
  window.__LBR = { get race() { return R; }, S, startRace };
})();
