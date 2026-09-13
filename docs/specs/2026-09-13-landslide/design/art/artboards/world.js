/* 사태(沙汰) — 세계 도형 라이브러리 (characters.js 와 같은 결: 굵은 먹선 · 평면 2~3톤 · 둥근 덩어리)
   Sata.World.scene(biome, opts) -> 1280×720 viewBox SVG 문자열
   Sata.World.groundY(biome, x)  -> 그 x 의 지표면 y (유닛 발 위치 계산용) */
(function () {
  const C = {
    hanji: '#F9F8F2', ink: '#1D1D1F', rock: '#1D1D1F', soil: '#8A6A50',
    ash: '#4A4A4C', ashDot: '#5C5C5E', sand: '#D9C39B', sandDot: '#C9AE7E',
    snow: '#F9F8F2', snowDot: '#E4E2DA', lava: '#E0562A', lavaD: '#A2231D',
    water: '#2B4B63', wave: '#9FBFD3', ice: '#9FBFD3', sky: '#CFE0EA',
    pine: '#1A472A', ochre: '#B38B6D', red: '#A2231D'
  };
  const ink = (w) => `stroke="${C.ink}" stroke-width="${w || 7}" stroke-linejoin="round" stroke-linecap="round"`;

  const LAND = {
    volcano: [[0, 470], [150, 452], [300, 502], [420, 476], [540, 548], [660, 590], [780, 560], [900, 500], [1020, 522], [1140, 474], [1280, 492]],
    dune: [[0, 540], [160, 508], [320, 552], [480, 500], [640, 556], [800, 512], [960, 566], [1120, 520], [1280, 548]],
    snow: [[0, 498], [180, 530], [360, 486], [540, 536], [720, 498], [900, 544], [1080, 492], [1280, 524]]
  };
  const CAP = { volcano: { fill: C.ash, dot: C.ashDot }, dune: { fill: C.sand, dot: C.sandDot }, snow: { fill: C.snow, dot: C.snowDot } };

  function topPath(pts) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i], [nx, ny] = pts[i + 1];
      d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
    }
    const l = pts[pts.length - 1];
    return d + ` L${l[0]} ${l[1]}`;
  }
  function groundY(biome, x) {
    const pts = LAND[biome] || LAND.volcano;
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) {
        const t = (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        const s = t * t * (3 - 2 * t);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * s;
      }
    }
    return pts[pts.length - 1][1];
  }
  const defs = `<defs>
    <pattern id="pAsh" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.6" fill="${C.ashDot}"/><circle cx="13" cy="12" r="2.2" fill="${C.ashDot}"/></pattern>
    <pattern id="pSand" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="5" cy="6" r="2.6" fill="${C.sandDot}"/><circle cx="14" cy="13" r="2.2" fill="${C.sandDot}"/></pattern>
    <pattern id="pSnow" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="6" cy="5" r="2.8" fill="${C.snowDot}"/><circle cx="14" cy="13" r="2.4" fill="${C.snowDot}"/></pattern>
  </defs>`;
  const PAT = { volcano: 'pAsh', dune: 'pSand', snow: 'pSnow' };

  const cloud = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-58 0 Q-58 -30 -26 -30 Q-16 -54 14 -48 Q44 -52 48 -26 Q76 -24 76 0 Z" fill="${C.hanji}" ${ink(6)}/></g>`;
  const pine = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-7" y="-26" width="14" height="30" rx="5" fill="${C.soil}" ${ink(5)}/>
    <circle cx="0" cy="-70" r="26" fill="${C.pine}" ${ink(6)}/>
    <circle cx="-24" cy="-40" r="24" fill="${C.pine}" ${ink(6)}/>
    <circle cx="24" cy="-40" r="24" fill="${C.pine}" ${ink(6)}/></g>`;
  const rockChunk = (x, y, s, fill) => `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M-44 26 Q-56 -6 -28 -22 Q0 -38 26 -22 Q52 -8 44 26 Z" fill="${fill || C.rock}" ${ink(6)}/></g>`;

  /* 액체 — 지형의 운덗이를 채운다(바닥·옆면 없음) + 물결 선 */
  function liquid(x, y, w, h, fill, waveColor) {
    let waves = '';
    for (let i = 0; i < 3; i++) {
      const yy = y + 18 + i * 16, a = 14;
      let d = `M${x + 16} ${yy}`;
      for (let k = 0; k < Math.floor((w - 32) / (a * 2)); k++) d += ` q${a} -9 ${a * 2} 0`;
      waves += `<path d="${d}" fill="none" stroke="${waveColor}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`;
    }
    const top = `M${x} ${y} Q${x + w / 2} ${y - 12} ${x + w} ${y}`;
    return `<g><path d="${top} L${x + w} 780 L${x} 780 Z" fill="${fill}"/>${waves}
      <path d="${top}" fill="none" ${ink(7)}/></g>`;
  }

  /* 기류 — 항상 보이는 유선 */
  function airflow(list) {
    return list.map((s) => {
      const [x, y, len, dir] = s;
      const f = dir === 'up' ? 0 : 1, col = dir === 'heat' ? C.red : C.wave;
      const d = f
        ? `M${x} ${y} q${len * 0.25} -18 ${len * 0.5} 0 q${len * 0.25} 18 ${len * 0.5} 0`
        : `M${x} ${y} q-18 ${-len * 0.25} 0 ${-len * 0.5} q18 ${-len * 0.25} 0 ${-len * 0.5}`;
      return `<path d="${d}" fill="none" stroke="${col}" stroke-width="6" stroke-linecap="round" opacity=".9"/>`;
    }).join('');
  }

  function scene(biome, o) {
    o = o || {};
    const pts = LAND[biome] || LAND.volcano, cap = CAP[biome] || CAP.volcano, top = topPath(pts);
    const body = `${top} L1280 760 L0 760 Z`;
    const skyBands = biome === 'snow'
      ? `<rect width="1280" height="720" fill="${C.hanji}"/><rect y="180" width="1280" height="540" fill="#EAF1F5"/>`
      : biome === 'dune'
        ? `<rect width="1280" height="720" fill="#FDF6E6"/><rect y="200" width="1280" height="520" fill="${C.hanji}"/>`
        : `<rect width="1280" height="720" fill="${C.hanji}"/><rect y="170" width="1280" height="550" fill="${C.sky}"/>`;

    let back = '', deco = '', liquids = '';
    if (biome === 'volcano') {
      back = `<path d="M900 404 L1052 214 L1204 404 Z" fill="${C.ash}" ${ink(7)}/>
        <path d="M1022 246 Q1052 268 1082 246 L1094 280 Q1052 298 1010 280 Z" fill="${C.lavaD}" ${ink(6)}/>
        ${cloud(250, 170, 1.1)}${cloud(640, 128, .85)}`;
      deco = `${pine(120, groundY('volcano', 120) - 4, .8)}${pine(1180, groundY('volcano', 1180) - 4, .7)}
        ${rockChunk(360, 640, 1.1)}${rockChunk(1060, 660, .9)}${rockChunk(210, 690, 1.3)}`;
      liquids = liquid(616, groundY('volcano', 700) - 10, 176, 84, C.lava, C.lavaD);
    } else if (biome === 'dune') {
      back = `<path d="M0 470 Q220 402 440 470 Q660 538 880 462 Q1080 396 1280 462 L1280 560 L0 560 Z" fill="#E8D6B2" ${ink(6)}/>
        ${cloud(320, 150, .9)}${cloud(900, 120, 1.05)}`;
      deco = `${rockChunk(1080, 620, 1, C.soil)}${rockChunk(240, 660, .8, C.soil)}`;
      liquids = liquid(520, groundY('dune', 620) - 8, 208, 70, C.water, C.wave);
    } else {
      back = `<path d="M120 480 L360 190 L600 480 Z" fill="${C.ice}" ${ink(7)}/>
        <path d="M360 190 L440 288 L280 288 Z" fill="${C.hanji}" ${ink(6)}/>
        ${cloud(820, 150, 1)}${cloud(1120, 200, .75)}`;
      deco = `${pine(200, groundY('snow', 200) - 2, .85)}${pine(980, groundY('snow', 980) - 2, .75)}
        <g>${rockChunk(640, 640, 1, C.ice)}</g>`;
      liquids = '';
    }

    const ground = `<g>
      <path d="${body}" fill="${C.soil}" ${ink(7)}/>
      <path d="${top}" fill="none" stroke="${cap.fill}" stroke-width="34" stroke-linecap="round"/>
      <path d="${top}" fill="none" stroke="url(#${PAT[biome] || 'pAsh'})" stroke-width="34" stroke-linecap="round"/>
      <path d="${top}" fill="none" ${ink(7)}/>
      ${rockChunk(520, 700, .9)}${rockChunk(880, 706, 1.1)}</g>`;

    const air = o.air === false ? '' : airflow([[110, 250, 230, 'side'], [560, 200, 240, 'side'], [940, 286, 240, 'side']]);
    return `${defs}${skyBands}${back}${air}${ground}${deco}${liquids}${o.extra || ''}`;
  }

  window.Sata = window.Sata || {};
  window.Sata.World = { C, scene, groundY, airflow, liquid, pine, cloud, rockChunk, ink, LAND };
})();
