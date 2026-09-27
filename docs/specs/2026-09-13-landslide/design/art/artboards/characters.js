/* 사태(沙汰) — SD 무장 캐릭터 도형 라이브러리 (v4 · korean-warrior.md 기준)
   · 3.2등신: 머리(정수리 y12 ~ 턱 y100) 88, 발 y300. 얼굴은 세로 달걀형, 망건 띠 한 줄, 곧은 눈썹, 가로 눈매선, 작은 가로 입
   · 갑옷: 짙은 남색 두정갑(작은 황동 두정 점) · 무릎 근처 긴 자락 + 앞 트임 · 암적 가선 · 작은 분절 견갑 · 철 비갑
   · 투구: 둥근 철제 + 귀·목 덮는 드림 + 짧은 간주에 작은 술 하나(붉은 공 없음) / 궁수 갓 / 포수 전립(공작깃 하나)
   · 모든 병과가 왼허리에 환도를 찬다. 팀색은 허리띠와 등깃발에만. 캐릭터 상자 200×300, viewBox 불변. */
window.Sata = (function () {
  const C = {
    hanji: '#F9F8F2', ink: '#1D1D1F',
    ochre: '#B38B6D', ochreD: '#8A6A50', ochreL: '#CBAA8C',
    red: '#A2231D', blue: '#2B4B63', pine: '#1A472A',
    skin: '#F0CBA5', ash: '#4A4A4C', steel: '#3A3A3D',
    navy: '#232A3A', iron: '#4E525B', ironD: '#35383F', dred: '#6E2620',
    rbrown: '#7A4A34', rbrownD: '#573325', brass: '#A88A4E', cloth: '#DAD5C8',
    bronze: '#7D6B45', felt: '#2A2A2E', meok: '#2E2B2B'
  };
  const ink = (w) => `stroke="${C.ink}" stroke-width="${w || 7}" stroke-linejoin="round" stroke-linecap="round"`;
  const team = (t) => (t === 'blue' ? C.blue : C.red);
  let CUR = 'joseon';

  /* 등깃발 */
  function flag(t, f) {
    const x0 = 100 - f * 16, y0 = 186, x1 = 100 - f * 54, y1 = -48;
    return `<g><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" ${ink(7)}/>
      <path d="M${x1} ${y1 + 2} L${x1 - f * 44} ${y1 + 14} L${x1 - f * 32} ${y1 + 36} L${x1} ${y1 + 32} Z" fill="${team(t)}" ${ink(5)}/>
      <circle cx="${x1}" cy="${y1 - 4}" r="4.5" fill="${C.ink}"/></g>`;
  }

  /* 넉넉한 바지 + 목화(검은 목긴 신) */
  function legs(st) {
    if (st === 'lunge') return `<g fill="${C.cloth}" ${ink()}>
      <path d="M72 230 Q56 248 48 266 L76 272 Q88 252 100 236 Z"/>
      <path d="M100 232 Q122 244 138 264 L160 256 Q146 236 130 228 Z"/></g>
      <g fill="${C.ink}" ${ink()}>
      <path d="M48 262 L76 268 L72 296 L36 298 Q28 292 40 286 Z"/>
      <path d="M138 260 L160 252 L176 290 Q180 298 168 298 L146 298 Z"/></g>`;
    const w = st === 'wide' ? 10 : 0;
    return `<g fill="${C.cloth}" ${ink()}>
      <path d="M${66 - w} 232 Q${56 - w} 250 ${68 - w} 270 L${96 - w / 2} 270 Q100 250 98 232 Z"/>
      <path d="M${134 + w} 232 Q${144 + w} 250 ${132 + w} 270 L${104 + w / 2} 270 Q100 250 102 232 Z"/></g>
      <g fill="${C.ink}" ${ink()}>
      <path d="M${68 - w} 264 L${96 - w / 2} 264 L${98 - w / 2} 290 Q${98 - w / 2} 298 ${88 - w / 2} 298 L${62 - w} 298 Q${54 - w} 298 ${60 - w} 290 Z"/>
      <path d="M${104 + w / 2} 264 L${132 + w} 264 L${140 + w} 290 Q${146 + w} 298 ${138 + w} 298 L${112 + w / 2} 298 Q${102 + w / 2} 298 ${102 + w / 2} 290 Z"/></g>`;
  }

  /* 환도 — 왼허리. 흑칠 칼집 + 작은 황동 띠돈 */
  function hwando(hilt) {
    return `<g><line x1="72" y1="176" x2="30" y2="226" stroke="${C.ink}" stroke-width="13" stroke-linecap="round"/>
      <line x1="72" y1="176" x2="30" y2="226" stroke="${C.ironD}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="58" cy="193" r="3" fill="${C.brass}"/><circle cx="40" cy="214" r="3" fill="${C.brass}"/>
      ${hilt ? `<line x1="74" y1="174" x2="90" y2="156" stroke="${C.ink}" stroke-width="11" stroke-linecap="round"/>
      <line x1="74" y1="174" x2="90" y2="156" stroke="${C.rbrown}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="74" cy="175" rx="7" ry="4" fill="${C.ink}" transform="rotate(-48 74 175)"/>` : ''}</g>`;
  }

  const OUTLINE = 'M84 110 L116 110 Q132 112 136 124 L146 236 L106 238 L100 222 L94 238 L54 236 L64 124 Q68 112 84 110 Z';
  const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r || 2.8}" fill="${c || C.brass}"/>`;
  const belt = (t) => `<path d="M62 164 Q100 172 138 164 L139 180 Q100 188 61 180 Z" fill="${team(t)}" ${ink()}/>
      <path d="M63 172 Q100 180 138 172" fill="none" stroke="${C.hanji}" stroke-width="3" opacity=".75"/>
      <path d="M84 181 L78 204 L86 206 L92 183" fill="${team(t)}" ${ink(4)}/>`;
  const guards = (c) => `<g fill="${c || C.iron}" ${ink(5)}>
      <path d="M64 116 Q54 128 58 144 L70 142 Q68 128 76 114 Z"/>
      <path d="M136 116 Q146 128 142 144 L130 142 Q132 128 124 114 Z"/></g>`;

  /* 조선 — 짙은 남색 두정갑 */
  function coatJoseon(t) {
    const rows = [[142, [76, 90, 110, 124]], [154, [74, 88, 112, 126]], [196, [64, 78, 92, 108, 122, 136]], [212, [62, 76, 90, 110, 124, 138]]];
    let st = '';
    rows.forEach(([y, xs]) => xs.forEach((x) => { st += dot(x, y); }));
    return `<g><path d="${OUTLINE}" fill="${C.navy}" ${ink()}/>
      <path d="M57 229 L95 231 M105 231 L143 229" stroke="${C.dred}" stroke-width="5" stroke-linecap="round"/>
      <path d="M100 132 L100 222" fill="none" ${ink(3.5)}/>
      ${st}
      <path d="M86 110 L100 132 L114 110 Z" fill="${C.cloth}" ${ink(4)}/>
      ${guards()}${belt(t)}</g>`;
  }
  /* 고구려 — 철 찰갑 흉갑 + 암적 치마 자락 */
  function coatGoguryeo(t) {
    let rows = '';
    [124, 136, 148, 160].forEach((y) => { rows += `<path d="M64 ${y} L136 ${y}" stroke="${C.ironD}" stroke-width="3"/>`; });
    for (let x = 70; x <= 130; x += 10) rows += `<path d="M${x} 118 L${x} 164" stroke="${C.ironD}" stroke-width="1.6" opacity=".7"/>`;
    return `<g><path d="${OUTLINE}" fill="${C.dred}" ${ink()}/>
      <path d="M100 196 L100 222" fill="none" ${ink(3.5)}/>
      <path d="M84 110 L116 110 Q132 112 136 124 L139 166 L61 166 L64 124 Q68 112 84 110 Z" fill="${C.iron}" ${ink(6)}/>
      ${rows}
      <path d="M88 110 L100 124 L112 110 Z" fill="${C.cloth}" ${ink(4)}/>
      ${guards(C.ironD)}${belt(t)}</g>`;
  }
  /* 신라 — 먹색 포 + 흰 교임 깃 */
  function coatSilla(t) {
    return `<g><path d="${OUTLINE}" fill="${C.meok}" ${ink()}/>
      <path d="M57 229 L95 231 M105 231 L143 229" stroke="${C.dred}" stroke-width="5" stroke-linecap="round"/>
      <path d="M100 196 L100 222" fill="none" ${ink(3.5)}/>
      <path d="M84 110 L94 110 L128 160 L118 164 Z" fill="${C.cloth}" ${ink(4)}/>
      ${belt(t)}</g>`;
  }
  /* 고려 — 적갈 두정갑, 자락이 짧고 벌어짐 + 분절 허벅지 가리개 */
  function coatGoryeo(t) {
    let st = '';
    [[142, [76, 90, 110, 124]], [154, [74, 88, 112, 126]], [198, [70, 84, 116, 130]]].forEach(([y, xs]) => xs.forEach((x) => { st += dot(x, y); }));
    return `<g><path d="M84 110 L116 110 Q132 112 136 124 L140 180 L152 228 L106 230 L100 214 L94 230 L48 228 L60 180 L64 124 Q68 112 84 110 Z" fill="${C.rbrown}" ${ink()}/>
      <path d="M100 132 L100 214" fill="none" ${ink(3.5)}/>
      ${st}
      <g fill="${C.iron}" ${ink(5)}><path d="M58 184 L82 188 L80 210 L54 204 Z"/><path d="M142 184 L118 188 L120 210 L146 204 Z"/></g>
      <path d="M86 110 L100 132 L114 110 Z" fill="${C.cloth}" ${ink(4)}/>
      ${guards()}${belt(t)}</g>`;
  }

  /* 머리 — 투구/갓/전립. back 은 얼굴 뒤, front 는 얼굴 위 */
  const helmetBack = (c) => `<path d="M56 42 Q48 84 54 112 L146 112 Q152 84 144 42 Z" fill="${c}" ${ink(6)}/>
    ${dot(59, 64)}${dot(60, 84)}${dot(62, 102)}${dot(141, 64)}${dot(140, 84)}${dot(138, 102)}`;
  const tassel = `<line x1="100" y1="-6" x2="100" y2="-20" ${ink(6)}/>
    <circle cx="100" cy="-21" r="3.5" fill="${C.brass}" ${ink(2.5)}/>
    <path d="M102 -20 Q114 -20 118 -8 M102 -20 Q110 -14 111 -3" fill="none" stroke="${C.dred}" stroke-width="4" stroke-linecap="round"/>`;
  const gatBeads = (() => {
    let s = `<path d="M46 50 Q48 96 90 104" fill="none" ${ink(2.5)}/>`;
    for (let i = 1; i <= 6; i++) {
      const u = i / 7, x = (1 - u) * (1 - u) * 46 + 2 * u * (1 - u) * 48 + u * u * 90, y = (1 - u) * (1 - u) * 50 + 2 * u * (1 - u) * 96 + u * u * 104;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="${C.rbrown}" ${ink(2.5)}/>`;
    }
    return s;
  })();
  const HATS = {
    helmet: { back: helmetBack(C.navy), front: `<g>
      <path d="M60 44 Q58 -4 100 -6 Q142 -4 140 44 Z" fill="${C.iron}" ${ink()}/>
      <path d="M100 -6 L100 38 M80 -1 Q72 18 74 40 M120 -1 Q128 18 126 40" fill="none" stroke="${C.ironD}" stroke-width="4"/>
      <path d="M56 40 Q100 32 144 40 L144 48 Q100 40 56 48 Z" fill="${C.ironD}" ${ink(5)}/>
      ${dot(68, 42, 2.6)}${dot(84, 39, 2.6)}${dot(100, 38, 2.6)}${dot(116, 39, 2.6)}${dot(132, 42, 2.6)}
      ${tassel}</g>` },
    gat: { ears: true, front: `<g>
      <path d="M78 44 L80 -4 Q80 -10 100 -10 Q120 -10 120 -4 L122 44 Z" fill="${C.felt}" ${ink(6)}/>
      <path d="M80 32 Q100 28 120 32" fill="none" stroke="${C.iron}" stroke-width="5"/>
      <path d="M12 46 Q100 34 188 46 Q100 56 12 46 Z" fill="${C.felt}" ${ink(5)}/>
      ${gatBeads}</g>` },
    jeonrip: { ears: true, front: `<g>
      <path d="M126 16 Q146 -2 150 -26" fill="none" stroke="${C.ink}" stroke-width="9" stroke-linecap="round"/>
      <path d="M126 16 Q146 -2 150 -26" fill="none" stroke="${C.pine}" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="151" cy="-32" rx="7" ry="9" fill="${C.pine}" ${ink(4)}/>${dot(151, -32, 3)}
      <path d="M64 44 Q62 4 100 4 Q138 4 136 44 Z" fill="${C.felt}" ${ink()}/>
      <path d="M28 50 Q44 36 100 38 Q156 36 172 50 Q156 46 100 46 Q44 46 28 50 Z" fill="${C.felt}" ${ink(5)}/>
      <circle cx="100" cy="2" r="4" fill="${C.brass}" ${ink(2.5)}/></g>` }
  };
  const SKIN_HATS = {
    goguryeo: { back: `<path d="M54 42 Q46 84 52 112 L148 112 Q154 84 146 42 Z" fill="${C.ironD}" ${ink(6)}/>
      <path d="M50 70 L62 70 M50 90 L62 90 M138 70 L150 70 M138 90 L150 90" stroke="${C.ink}" stroke-width="3"/>`, front: `<g>
      <path d="M100 -22 L100 -34" ${ink(6)}/>
      <path d="M100 -34 Q88 -56 96 -76 Q110 -56 100 -34 Z" fill="${C.dred}" ${ink(4)}/>
      <path d="M60 44 Q56 -12 100 -22 Q144 -12 140 44 Z" fill="${C.iron}" ${ink()}/>
      <path d="M100 -22 L100 40 M84 -18 L80 40 M116 -18 L120 40 M70 -6 L66 40 M130 -6 L134 40" fill="none" stroke="${C.ironD}" stroke-width="3.5"/>
      <path d="M56 40 Q100 32 144 40 L144 48 Q100 40 56 48 Z" fill="${C.ironD}" ${ink(5)}/>
      <g fill="${C.iron}" ${ink(5)}><path d="M62 44 Q56 70 64 96 L76 92 Q70 66 74 46 Z"/><path d="M138 44 Q144 70 136 96 L124 92 Q130 66 126 46 Z"/></g>
      ${dot(68, 64, 2.4)}${dot(69, 80, 2.4)}${dot(132, 64, 2.4)}${dot(131, 80, 2.4)}</g>` },
    silla: { ears: true, front: `<g>
      <path d="M122 20 Q144 -16 140 -62 Q128 -22 112 16 Z" fill="${C.hanji}" ${ink(5)}/>
      <path d="M118 16 Q132 -16 138 -52" fill="none" ${ink(2.5)}/>
      <path d="M68 46 Q70 0 100 -16 Q130 0 132 46 Z" fill="${C.rbrown}" ${ink()}/>
      <path d="M66 44 Q100 36 134 44" fill="none" stroke="${C.rbrownD}" stroke-width="6"/>
      <path d="M70 46 Q70 90 92 104 M130 46 Q130 90 108 104" fill="none" stroke="${C.dred}" stroke-width="4" stroke-linecap="round"/></g>` },
    goryeo: { back: helmetBack(C.rbrown), front: `<g>
      <path d="M62 42 Q60 0 100 -2 Q140 0 138 42 Z" fill="${C.iron}" ${ink()}/>
      <path d="M100 -2 L100 36 M82 3 Q76 20 78 38 M118 3 Q124 20 122 38" fill="none" stroke="${C.ironD}" stroke-width="4"/>
      <path d="M34 46 Q100 30 166 46 Q100 58 34 46 Z" fill="${C.ironD}" ${ink(5)}/>
      <line x1="100" y1="-2" x2="100" y2="-14" ${ink(6)}/><circle cx="100" cy="-15" r="3.5" fill="${C.brass}" ${ink(2.5)}/>
      <path d="M102 -14 Q112 -12 114 -2" fill="none" stroke="${C.dred}" stroke-width="4" stroke-linecap="round"/></g>` }
  };

  const FACE = 'M100 16 C130 16 136 44 135 62 C133 86 117 100 100 100 C83 100 67 86 65 62 C64 44 70 16 100 16 Z';

  /* 표정 — 눈썹·눈매선·입 */
  function eyes(f, e) {
    const c = 100 + f * 5, L = (d) => c - d, R = (d) => c + d;
    const nose = `<path d="M${c + 1} 74 L${c - 1.5} 80 L${c + 2.5} 80" fill="none" ${ink(3)}/>`;
    const line = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${ink(w)}/>`;
    if (e === 'hit') return `<g>${line(L(24), 62, L(8), 57, 6)}${line(R(8), 57, R(24), 62, 6)}
      <path d="M${L(21)} 66 L${L(12)} 69.5 L${L(21)} 73 M${R(21)} 66 L${R(12)} 69.5 L${R(21)} 73" fill="none" ${ink(4.5)}/>
      ${nose}<path d="M${L(7)} 89 Q${L(3.5)} 86 ${c} 89 Q${R(3.5)} 92 ${R(7)} 89" fill="none" ${ink(4)}/></g>`;
    if (e === 'win') return `<g>${line(L(24), 58, L(8), 57, 6)}${line(R(8), 57, R(24), 58, 6)}
      <path d="M${L(21)} 70 Q${L(15.5)} 65 ${L(10)} 70 M${R(10)} 70 Q${R(15.5)} 65 ${R(21)} 70" fill="none" ${ink(4.5)}/>
      ${nose}<path d="M${L(7)} 86 Q${c} 91 ${R(7)} 86" fill="none" ${ink(4)}/></g>`;
    if (e === 'buried') return `<g>${line(L(24), 61, L(8), 56, 6)}${line(R(8), 56, R(24), 61, 6)}
      <path d="M${L(21)} 68 Q${L(15)} 71 ${L(10)} 70 M${R(10)} 70 Q${R(15)} 71 ${R(21)} 68" fill="none" ${ink(4.5)}/>
      <path d="M${L(15)} 75 Q${L(19)} 83 ${L(15)} 86 Q${L(11)} 83 ${L(15)} 75 Z" fill="${C.blue}" ${ink(2.5)}/>
      ${nose}<path d="M${L(7)} 90 Q${c} 85 ${R(7)} 90" fill="none" ${ink(4)}/></g>`;
    return `<g>${line(L(24), 60, L(8), 59, 6.5)}${line(R(8), 59, R(24), 60, 6.5)}
      ${line(L(21), 69, L(10), 69, 5)}${line(R(10), 69, R(21), 69, 5)}
      ${nose}${line(L(6), 88, R(6), 88, 4.5)}</g>`;
  }

  function head(f, e, hat) {
    const H = SKIN_HATS[CUR] || HATS[hat] || HATS.helmet;
    return `<g>${H.back || ''}
      <rect x="91" y="94" width="18" height="20" fill="${C.skin}" ${ink(6)}/>
      ${H.ears ? `<ellipse cx="65" cy="68" rx="6" ry="9" fill="${C.skin}" ${ink(5)}/><ellipse cx="135" cy="68" rx="6" ry="9" fill="${C.skin}" ${ink(5)}/>` : ''}
      <path d="${FACE}" fill="${C.skin}" ${ink()}/>
      <path d="M66 48 Q100 42 134 48 L134 54 Q100 48 66 54 Z" fill="${C.ink}"/>
      ${eyes(f, e)}${H.front}</g>`;
  }

  const COATS = { joseon: coatJoseon, goguryeo: coatGoguryeo, silla: coatSilla, goryeo: coatGoryeo };
  const SLEEVE = { joseon: C.navy, goguryeo: C.dred, silla: C.meok, goryeo: C.rbrown };
  const coat = (t) => (COATS[CUR] || coatJoseon)(t);

  function arm(x1, y1, x2, y2) {
    const p = (u) => [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u], [a, b] = p(0.62), [c, d] = p(0.88);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink}" stroke-width="24" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${SLEEVE[CUR] || C.navy}" stroke-width="14" stroke-linecap="round"/>
      <line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${C.iron}" stroke-width="14"/>`;
  }
  const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="11" fill="${C.skin}" ${ink(6)}/>`;

  const units = {
    /* 궁수 — 갓 + 각궁(끝이 되휜 활) + 동개 */
    archer(t, e) {
      const bowD = 'M178 6 Q158 10 162 28 Q214 100 162 172 Q158 190 178 194';
      const bow = `<g><path d="M176 8 L124 101 L176 192" fill="none" ${ink(3)}/>
        <path d="${bowD}" fill="none" stroke="${C.ink}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${bowD}" fill="none" stroke="${C.rbrown}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="187" y1="90" x2="188" y2="110" stroke="${C.cloth}" stroke-width="6"/></g>`;
      const arrow = `<g><line x1="118" y1="101" x2="236" y2="96" ${ink(5)}/>
        <path d="M246 95.5 L230 88 L231 104 Z" fill="${C.ink}"/>
        <path d="M118 101 L108 94 M118 101 L108 108" fill="none" ${ink(4)}/></g>`;
      const quiver = `<g transform="rotate(-16 44 196)">
        <path d="M36 150 L34 120 M44 150 L44 116 M52 150 L55 120" fill="none" ${ink(4)}/>
        <path d="M30 124 L38 118 L38 128 Z M40 118 L48 112 L48 122 Z M50 122 L58 116 L58 126 Z" fill="${C.hanji}" ${ink(2.5)}/>
        <path d="M30 150 L58 150 L60 226 Q44 236 28 226 Z" fill="${C.rbrown}" ${ink(6)}/>
        <path d="M30 164 L58 164" stroke="${C.rbrownD}" stroke-width="4"/>${dot(44, 196, 3.5)}</g>`;
      return quiver + flag(t, 1) + legs('') + coat(t) + hwando(true) + bow +
        arm(130, 122, 184, 100) + arm(70, 122, 124, 102) + head(1, e, 'gat') + arrow + hand(186, 100) + hand(126, 102);
    },
    /* 포수 — 전립 + 짧은 청동 총통. 화승을 대는 순간 */
    gunner(t, e) {
      const ax = 112, ay = 164, bx = 208, by = 102, dx = bx - ax, dy = by - ay;
      const P = (u) => [ax + dx * u, ay + dy * u];
      const ring = (u) => { const [x1, y1] = P(u), [x2, y2] = P(u + 0.05); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink}" stroke-width="34"/>`; };
      const [hx, hy] = P(0.15);
      const gun = `<g>
        <line x1="58" y1="198" x2="116" y2="161" stroke="${C.ink}" stroke-width="16" stroke-linecap="round"/>
        <line x1="58" y1="198" x2="116" y2="161" stroke="${C.rbrown}" stroke-width="8" stroke-linecap="round"/>
        <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${C.ink}" stroke-width="30" stroke-linecap="round"/>
        <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${C.bronze}" stroke-width="18" stroke-linecap="round"/>
        ${ring(0.06)}${ring(0.45)}${ring(0.8)}
        <circle cx="${bx}" cy="${by}" r="15" fill="${C.bronze}" ${ink(6)}/><circle cx="${bx}" cy="${by}" r="6" fill="${C.ink}"/></g>`;
      const match = `<g><path d="M110 150 Q118 146 ${hx - 2} ${hy - 6}" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"/>
        <circle cx="${hx}" cy="${hy - 8}" r="5" fill="${C.red}" ${ink(3)}/>
        <path d="M${hx - 4} ${hy - 20} L${hx - 8} ${hy - 30} M${hx + 6} ${hy - 18} L${hx + 12} ${hy - 26}" fill="none" ${ink(3.5)}/>
        <circle cx="${hx + 18}" cy="${hy - 34}" r="8" fill="${C.hanji}" ${ink(4)}/><circle cx="${hx + 30}" cy="${hy - 44}" r="6" fill="${C.hanji}" ${ink(4)}/></g>`;
      return flag(t, 1) + legs('wide') + coat(t) + hwando(true) + gun +
        arm(70, 122, 110, 148) + arm(130, 122, 156, 142) + head(1, e, 'jeonrip') + match + hand(110, 148) + hand(158, 142);
    },
    /* 검사 — 투구 + 환도. 머리 위 짧은 칼의 사선 */
    sword(t, e) {
      const blade = `<g>
        <path d="M149 10 Q98 -32 40 -94 Q90 -20 136 26 Z" fill="${C.iron}" ${ink(7)}/>
        <path d="M138 12 Q98 -24 56 -74" fill="none" stroke="${C.hanji}" stroke-width="3" opacity=".55"/>
        <ellipse cx="142" cy="18" rx="9" ry="4.5" fill="${C.ink}" transform="rotate(47 142 18)"/>
        <line x1="144" y1="20" x2="166" y2="46" stroke="${C.ink}" stroke-width="12" stroke-linecap="round"/>
        <line x1="144" y1="20" x2="166" y2="46" stroke="${C.rbrown}" stroke-width="6" stroke-linecap="round"/></g>`;
      return flag(t, -1) + legs('') + coat(t) + hwando(false) + arm(70, 122, 150, 30) + head(0, e, 'helmet') + blade +
        arm(130, 122, 162, 44) + hand(150, 28) + hand(162, 42);
    },
    /* 창병 — 투구 + 장창. 키 1.5배 수직선 */
    spear(t, e) {
      const shaft = `<g>
        <line x1="112" y1="308" x2="170" y2="-150" stroke="${C.ink}" stroke-width="19" stroke-linecap="round"/>
        <line x1="112" y1="308" x2="170" y2="-150" stroke="${C.rbrown}" stroke-width="9" stroke-linecap="round"/>
        <path d="M173 -178 Q190 -142 170 -112 Q154 -144 173 -178 Z" fill="${C.iron}" ${ink(5)}/>
        <line x1="169" y1="-118" x2="168" y2="-106" ${ink(10)}/>
        <path d="M167 -106 Q156 -96 158 -80 M167 -106 Q164 -94 168 -80" fill="none" stroke="${C.dred}" stroke-width="5" stroke-linecap="round"/></g>`;
      return flag(t, 1) + shaft + legs('lunge') + coat(t) + hwando(true) +
        arm(70, 122, 132, 150) + arm(130, 122, 139, 98) + head(1, e, 'helmet') + hand(132, 150) + hand(139, 98);
    },
    /* 방패병 — 투구 + 긴 세로 장방패 */
    shield(t, e) {
      const sh = `<g transform="rotate(-6 140 196)">
        <path d="M104 112 Q140 100 176 112 L176 280 Q140 292 104 280 Z" fill="${C.rbrown}" ${ink()}/>
        <path d="M114 124 Q140 114 166 124 L166 268 Q140 278 114 268 Z" fill="none" stroke="${C.rbrownD}" stroke-width="5"/>
        <path d="M106 156 Q140 148 174 156 M106 238 Q140 230 174 238" fill="none" stroke="${C.ironD}" stroke-width="7"/>
        <circle cx="140" cy="196" r="10" fill="${C.iron}" ${ink(5)}/>${dot(140, 196, 3.5)}</g>`;
      const low = `<g><path d="M48 196 Q32 222 12 248 Q36 226 42 194 Z" fill="${C.iron}" ${ink(5)}/>
        <ellipse cx="48" cy="192" rx="7" ry="4" fill="${C.ink}" transform="rotate(-50 48 192)"/></g>`;
      return flag(t, 1) + legs('wide') + coat(t) + hwando(false) + arm(130, 122, 150, 168) + head(0.4, e, 'helmet') + sh +
        low + arm(70, 122, 50, 188) + hand(50, 190);
    }
  };

  const names = { archer: '궁수', gunner: '포수', sword: '검사', spear: '창병', shield: '방패병' };

  function render(unit, o) {
    o = o || {};
    const h = o.h || 300, t = o.team || 'red', e = o.expr || 'idle';
    CUR = COATS[o.skin] ? o.skin : 'joseon';
    let inner = units[unit](t, e);
    CUR = 'joseon';
    if (e === 'hit') inner = `<g transform="rotate(-13 100 296)">${inner}</g>`;
    if (e === 'win') inner = `<g transform="translate(0,-14)">${inner}</g>`;
    if (e === 'buried') inner = inner + `
      <path d="M-80 204 Q10 182 70 194 Q120 206 180 186 Q230 174 240 196 L240 310 L-80 310 Z" fill="${C.ash}" stroke="${C.hanji}" stroke-width="10"/>
      <path d="M-80 204 Q10 182 70 194 Q120 206 180 186 Q230 174 240 196" fill="none" stroke="${C.ink}" stroke-width="6"/>
      <path d="M-60 232 Q40 220 120 230 Q200 240 240 228" fill="none" stroke="${C.hanji}" stroke-width="4" opacity=".4"/>`;
    return `<svg viewBox="-80 -170 320 480" width="${(h * 320) / 300}" height="${(h * 480) / 300}"
      overflow="visible" aria-label="${names[unit] || unit}">${inner}</svg>`;
  }

  function mount(root) {
    (root || document).querySelectorAll('[data-unit]').forEach((el) => {
      el.innerHTML = render(el.dataset.unit, { h: +el.dataset.h || 300, team: el.dataset.team, expr: el.dataset.expr, skin: el.dataset.skin });
    });
  }
  document.addEventListener('DOMContentLoaded', () => mount());
  const skinNames = { goguryeo: '고구려 개마무사', silla: '신라 화랑', goryeo: '고려 무반', joseon: '조선 갑사' };
  const skins = { joseon: {}, goguryeo: {}, silla: {}, goryeo: {} };
  return { C, render, mount, names, skinNames, skins };
})();
