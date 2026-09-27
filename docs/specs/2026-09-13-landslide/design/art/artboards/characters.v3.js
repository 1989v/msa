/* 사태(沙汰) — SD 무장 캐릭터 도형 라이브러리 (v3 · 4차 한국색 보정, README §10)
   · 옷: 청흑 두정갑(황동 징 점) 위에 V자 교임 깃, 아래로 주름 잡힌 황토 철릭 자락. 스탠드 칼라·사선 단추 줄·금 비늘 없음
   · 머리: 궁수 갓(얇은 원판 챙+높은 대우+구슬 갓끈) / 검사 발립형 투구(앞챙+간주 삼지창+드림) / 포수·창병·방패병 전립(아래로 휜 챙+상모 한 줌+공작깃 하나)
   · 무기: 각궁(끝이 되휜 활) · 청동 총통 · 좁고 살짝 휜 환도 · 가는 날 장창 · 장방패
   · 허리 전대와 등깃발만 팀색. 캐릭터 상자 200×300, 발이 y=300. */
window.Sata = (function () {
  const C = {
    hanji: '#F9F8F2', ink: '#1D1D1F',
    ochre: '#B38B6D', ochreD: '#8A6A50', ochreL: '#CBAA8C',
    red: '#A2231D', blue: '#2B4B63', pine: '#1A472A',
    skin: '#F2CBA6', ash: '#4A4A4C', steel: '#3A3A3D'
  };
  const S = 7;
  const ink = (w) => `stroke="${C.ink}" stroke-width="${w || S}" stroke-linejoin="round" stroke-linecap="round"`;
  const team = (t) => (t === 'blue' ? C.blue : C.red);

  /* 등깃발(배기) */
  function flag(t, f) {
    const x0 = 100 - f * 30, y0 = 206, x1 = 100 - f * 76, y1 = 56, px = x1 - f * 4;
    return `<g><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" ${ink(9)}/>
      <path d="M${px} ${y1} L${px - f * 50} ${y1 + 16} L${px - f * 36} ${y1 + 44} L${px} ${y1 + 36} Z" fill="${team(t)}" ${ink(6)}/></g>`;
  }

  /* 두정 — 청흑 천 위 황동 징 점 */
  function studs() {
    let s = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) s += `<circle cx="${72 + c * 19}" cy="${184 + r * 18}" r="3.6" fill="${C.ochreL}"/>`;
    for (let c = 0; c < 5; c++) s += `<circle cx="${64 + c * 18}" cy="${256}" r="3.6" fill="${C.ochreL}"/>`;
    return s;
  }

  /* 화(靴) — 목긴 가죽신. 자락 아래로만 보인다 */
  function boots(stance) {
    if (stance === 'lunge') return `<g>
      <path d="M118 262 L156 288 L164 300 L132 300 L104 280 Z" fill="${C.ochreD}" ${ink()}/>
      <path d="M84 264 L56 288 L44 300 L74 300 L96 280 Z" fill="${C.ochreD}" ${ink()}/>
      <ellipse cx="150" cy="296" rx="24" ry="10" fill="${C.ink}"/><ellipse cx="56" cy="296" rx="24" ry="10" fill="${C.ink}"/></g>`;
    const w = stance === 'wide' ? 12 : 0;
    return `<g>
      <rect x="${68 - w}" y="256" width="28" height="40" rx="10" fill="${C.ochreD}" ${ink()}/>
      <rect x="${104 + w}" y="256" width="28" height="40" rx="10" fill="${C.ochreD}" ${ink()}/>
      <ellipse cx="${82 - w}" cy="294" rx="25" ry="11" fill="${C.ink}"/>
      <ellipse cx="${118 + w}" cy="294" rx="25" ry="11" fill="${C.ink}"/></g>`;
  }

  /* ── 시대 스킨 : 투구·갑옷 윤곽만 갈아 끼운다 (무기·포즈·깃발·표정 불변) ── */
  let CUR = 'joseon';

  /* 고구려 개마무사 — 찰갑(가로 비늘 줄) + 목가리개 */
  function coatGoguryeo(t) {
    let rows = '';
    for (let i = 0; i < 4; i++) {
      const y = 186 + i * 20, sp = 44 + i * 3;
      rows += `<path d="M${100 - sp} ${y} Q100 ${y + 10} ${100 + sp} ${y}" fill="none" ${ink(5)}/>`;
    }
    return `<g>
      <path d="M60 176 L74 158 L126 158 L140 176 L152 266 Q100 282 48 266 Z" fill="${C.ochre}" ${ink()}/>
      ${rows}
      <path d="M64 158 Q100 142 136 158 L136 172 Q100 158 64 172 Z" fill="${C.ochreL}" ${ink(5)}/>
      <path d="M50 220 Q100 234 150 220 L152 248 Q100 262 48 248 Z" fill="${team(t)}" ${ink()}/>
      <path d="M150 234 L172 244 L166 260 L146 248" fill="${team(t)}" ${ink(5)}/></g>`;
  }

  /* 신라 화랑 — 가벼운 포 + 가슴 띠, 자락이 길고 부드럽다 */
  function coatSilla(t) {
    return `<g>
      <path d="M62 176 Q62 160 80 158 L120 158 Q138 160 138 176 L154 270 Q100 286 46 270 Z" fill="${C.hanji}" ${ink()}/>
      <path d="M82 158 L104 196 L126 158" fill="${C.ochreL}" ${ink(5)}/>
      <path d="M104 196 L112 268" fill="none" ${ink(4)}/>
      <path d="M66 190 L140 226" fill="none" ${ink(9)} stroke="${C.ochreD}"/>
      <path d="M50 224 Q100 238 150 224 L152 250 Q100 264 48 250 Z" fill="${team(t)}" ${ink()}/>
      <path d="M150 238 L174 248 L168 264 L146 252" fill="${team(t)}" ${ink(5)}/></g>`;
  }

  /* 고려 무반 — 두정갑, 자락이 짧고 아래가 벌어진다 */
  function coatGoryeo(t) {
    let s = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s += `<circle cx="${72 + c * 19}" cy="${180 + r * 22}" r="3.4" fill="${C.ink}"/>`;
    return `<g>
      <path d="M62 174 Q62 158 80 158 L120 158 Q138 158 138 174 L138 244 L160 272 Q100 288 40 272 L62 244 Z" fill="${C.ochreD}" ${ink()}/>
      ${s}
      <path d="M62 244 Q100 256 138 244" fill="none" ${ink(5)}/>
      <path d="M50 200 Q42 178 60 172 L74 170 L70 198 Z" fill="${C.ochreL}" ${ink(5)}/>
      <path d="M150 200 Q158 178 140 172 L126 170 L130 198 Z" fill="${C.ochreL}" ${ink(5)}/>
      <path d="M56 216 Q100 230 144 216 L146 242 Q100 256 54 242 Z" fill="${team(t)}" ${ink()}/>
      <path d="M144 230 L168 240 L162 256 L140 244" fill="${team(t)}" ${ink(5)}/></g>`;
  }

  /* 고구려 투구 — 세로 철판을 이어 붙인 높은 투구 + 꼭대기 깃 */
  const mongolBachi = `<g>
    <g fill="${C.ochreD}" ${ink()}>
      <path d="M40 78 Q38 146 52 162 L74 154 Q64 110 68 74 Z"/>
      <path d="M160 78 Q162 146 148 162 L126 154 Q136 110 132 74 Z"/></g>
    <path d="M58 62 Q58 -6 100 -24 Q142 -6 142 62 Z" fill="${C.steel}" ${ink()}/>
    <g fill="none" ${ink(4)}>
      <path d="M100 -24 L100 62"/><path d="M79 -14 L74 62"/><path d="M121 -14 L126 62"/></g>
    <ellipse cx="100" cy="62" rx="60" ry="12" fill="${C.ochreD}" ${ink()}/>
    <line x1="100" y1="-24" x2="100" y2="-58" ${ink(8)}/>
    <path d="M100 -58 Q118 -76 108 -96 Q96 -80 100 -58 Z" fill="${C.pine}" ${ink(5)}/></g>`;

  /* 신라 조우관 — 새 깃 두 개를 꽂은 관 */
  const joogwan = `<g>
    <path d="M64 56 Q64 16 100 16 Q136 16 136 56 Z" fill="${C.ochreD}" ${ink()}/>
    <ellipse cx="100" cy="56" rx="48" ry="11" fill="${C.ochreD}" ${ink()}/>
    <path d="M80 26 Q34 -2 8 -44 Q56 -30 88 14 Z" fill="${C.hanji}" ${ink(6)}/>
    <path d="M120 26 Q166 -2 192 -44 Q144 -30 112 14 Z" fill="${C.hanji}" ${ink(6)}/>
    <path d="M26 -28 L76 10 M174 -28 L124 10" fill="none" ${ink(4)}/>
    <path d="M68 42 Q100 52 132 42" fill="none" ${ink(4)} stroke="${C.pine}"/></g>`;

  /* 고려 무반 투구 — 챙이 넓은 삿갓형 + 붉은 상모 */
  const goryeoHelm = `<g>
    <path d="M62 52 Q62 6 100 6 Q138 6 138 52 Z" fill="${C.steel}" ${ink()}/>
    <path d="M8 60 Q100 24 192 60 Q100 78 8 60 Z" fill="${C.ochreD}" ${ink()}/>
    <path d="M30 60 Q100 40 170 60" fill="none" ${ink(4)}/>
    <line x1="100" y1="6" x2="100" y2="-12" ${ink(8)}/>
    <circle cx="100" cy="-20" r="12" fill="${C.red}" ${ink(6)}/></g>`;

  const skins = {
    joseon: { coat: null, hat: null },
    goguryeo: { coat: coatGoguryeo, hat: mongolBachi },
    silla: { coat: coatSilla, hat: joogwan },
    goryeo: { coat: coatGoryeo, hat: goryeoHelm }
  };

  /* 철릭 자락(주름) + 청흑 두정갑 + V자 교임 깃 + 광다회(팀색) */
  function coat(t) {
    const sk = skins[CUR];
    if (sk && sk.coat) return sk.coat(t);
    let pleats = '';
    for (let i = 0; i < 7; i++) { const x = 52 + i * 16; pleats += `<path d="M${x + 2} 262 L${x - 2 + (i - 3) * 2} 282" fill="none" ${ink(3.5)}/>`; }
    return `<g>
      <path d="M48 246 L152 246 L162 280 Q100 294 38 280 Z" fill="${C.ochre}" ${ink()}/>
      ${pleats}
      <path d="M60 176 Q60 160 80 158 L120 158 Q140 160 140 176 L148 262 Q100 274 52 262 Z" fill="${C.steel}" ${ink()}/>
      ${studs()}
      <path d="M78 158 L92 158 L106 178 L98 186 Z" fill="${C.hanji}" ${ink(4)}/>
      <path d="M108 158 L124 158 L80 218 L68 210 Z" fill="${C.hanji}" ${ink(5)}/>
      <path d="M50 222 Q100 236 150 222 L152 250 Q100 264 48 250 Z" fill="${team(t)}" ${ink()}/>
      <path d="M60 238 L40 252 L48 268 L66 250" fill="${team(t)}" ${ink(5)}/>
    </g>`;
  }

  function arm(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink}" stroke-width="28" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ochre}" stroke-width="18" stroke-linecap="round"/>`;
  }
  const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="${C.skin}" ${ink(6)}/>`;

  function eyes(f, e) {
    const l = 100 + f * 16 - 22, r = 100 + f * 16 + 22, y = 116;
    if (e === 'hit') return `<g ${ink(6)}>
      <line x1="${l - 9}" y1="${y - 9}" x2="${l + 9}" y2="${y + 9}"/><line x1="${l + 9}" y1="${y - 9}" x2="${l - 9}" y2="${y + 9}"/>
      <line x1="${r - 9}" y1="${y - 9}" x2="${r + 9}" y2="${y + 9}"/><line x1="${r + 9}" y1="${y - 9}" x2="${r - 9}" y2="${y + 9}"/>
      <path d="M${100 + f * 16 - 12} 148 Q${100 + f * 16} 138 ${100 + f * 16 + 12} 148" fill="none"/></g>`;
    if (e === 'win') return `<g ${ink(6)} fill="none">
      <path d="M${l - 11} ${y + 4} Q${l} ${y - 12} ${l + 11} ${y + 4}"/>
      <path d="M${r - 11} ${y + 4} Q${r} ${y - 12} ${r + 11} ${y + 4}"/>
      <ellipse cx="${100 + f * 16}" cy="146" rx="13" ry="10" fill="${C.ink}" stroke="none"/></g>`;
    if (e === 'buried') return `<g>
      <circle cx="${l}" cy="${y + 2}" r="7.5" fill="${C.ink}"/><circle cx="${r}" cy="${y + 2}" r="7.5" fill="${C.ink}"/>
      <g fill="none" ${ink(5)}><path d="M${l - 13} ${y - 12} Q${l} ${y - 20} ${l + 12} ${y - 10}"/>
      <path d="M${r + 13} ${y - 12} Q${r} ${y - 20} ${r - 12} ${y - 10}"/>
      <path d="M${100 + f * 16 - 13} 152 Q${100 + f * 16} 140 ${100 + f * 16 + 13} 152"/></g>
      <path d="M${l - 4} ${y + 12} Q${l - 10} ${y + 26} ${l - 3} ${y + 30} Q${l + 3} ${y + 24} ${l - 4} ${y + 12} Z" fill="${C.blue}" ${ink(4)}/></g>`;
    return `<g><circle cx="${l}" cy="${y}" r="7.5" fill="${C.ink}"/><circle cx="${r}" cy="${y}" r="7.5" fill="${C.ink}"/>
      <path d="M${100 + f * 16 - 11} 142 Q${100 + f * 16} 152 ${100 + f * 16 + 11} 142" fill="none" ${ink(5)}/></g>`;
  }

  /* 갓(흑립) — 얇고 평평한 검은 원판 챙 + 높은 원통 대우 + 구슬 갓끈 한 줄 */
  const beads = (() => {
    let s = '';
    for (let i = 1; i <= 7; i++) {
      const u = i / 7, x = (1 - u) * (1 - u) * 44 + 2 * u * (1 - u) * 22 + u * u * 70, y = (1 - u) * (1 - u) * 60 + 2 * u * (1 - u) * 130 + u * u * 178;
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="${C.ochreL}" ${ink(3.5)}/>`;
    }
    return `<path d="M44 60 Q22 130 70 178" fill="none" ${ink(3)}/>` + s;
  })();
  const gat = `<g>
    <path d="M72 52 L74 -6 Q74 -14 100 -14 Q126 -14 126 -6 L128 52 Z" fill="${C.ink}" ${ink(6)}/>
    <path d="M74 40 Q100 36 126 40" fill="none" stroke="${C.steel}" stroke-width="7"/>
    <path d="M6 56 Q100 44 194 56 Q100 66 6 56 Z" fill="${C.ink}" ${ink(5)}/>
    ${beads}</g>`;

  /* 전립(벙거지) — 둥근 몸통 + 끝이 아래로 휜 챙 + 상모 한 줌 + 공작깃 하나 */
  const jeonrip = `<g>
    <path d="M58 56 Q58 12 100 12 Q142 12 142 56 Z" fill="${C.steel}" ${ink()}/>
    <path d="M16 70 Q30 46 100 46 Q170 46 184 70 Q170 62 100 60 Q30 62 16 70 Z" fill="${C.steel}" ${ink()}/>
    <path d="M130 24 Q152 0 156 -30" fill="none" stroke="${C.ink}" stroke-width="11" stroke-linecap="round"/>
    <path d="M130 24 Q152 0 156 -30" fill="none" stroke="${C.pine}" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="157" cy="-38" rx="9" ry="12" fill="${C.pine}" ${ink(5)}/>
    <circle cx="157" cy="-38" r="4" fill="${C.ochreL}"/>
    <g fill="${C.red}" ${ink(5)}><circle cx="92" cy="8" r="8"/><circle cx="108" cy="8" r="8"/><circle cx="100" cy="-2" r="8"/></g></g>`;

  /* 투구 — 둥근 발립형 + 앞에만 짧은 챙 + 긴 간주(삼지창) + 드림(귀·목 덮는 천) */
  const helmet = `<g>
    <g fill="${C.steel}" ${ink()}>
      <path d="M36 70 Q30 150 46 168 L76 160 Q64 110 68 66 Z"/>
      <path d="M164 70 Q170 150 154 168 L124 160 Q136 110 132 66 Z"/></g>
    <g fill="${C.ochreL}"><circle cx="48" cy="98" r="3.6"/><circle cx="50" cy="124" r="3.6"/><circle cx="54" cy="150" r="3.6"/>
      <circle cx="152" cy="98" r="3.6"/><circle cx="150" cy="124" r="3.6"/><circle cx="146" cy="150" r="3.6"/></g>
    <path d="M56 66 Q56 14 100 14 Q144 14 144 66 Z" fill="${C.steel}" ${ink()}/>
    <path d="M60 40 Q100 30 140 40" fill="none" stroke="${C.ochre}" stroke-width="6"/>
    <path d="M52 64 Q100 56 148 64 Q100 94 52 64 Z" fill="${C.ochreD}" ${ink()}/>
    <line x1="100" y1="14" x2="100" y2="-54" ${ink(8)}/>
    <path d="M84 -70 Q84 -50 100 -46 Q116 -50 116 -70 M100 -46 L100 -78" fill="none" ${ink(7)}/>
    <circle cx="100" cy="-8" r="10" fill="${C.red}" ${ink(5)}/></g>`;

  const hats = { gat, jeonrip, helmet };

  function head(f, e, hat) {
    const sk = skins[CUR];
    const cap = sk && sk.hat ? sk.hat : (hats[hat] || jeonrip);
    const covered = (sk && sk.hat) ? CUR === 'goguryeo' : hat === 'helmet';
    return `<g>
      <rect x="86" y="150" width="28" height="20" fill="${C.skin}" ${ink(6)}/>
      <ellipse cx="100" cy="104" rx="62" ry="66" fill="${C.skin}" ${ink()}/>
      ${cap}
      ${eyes(f, e)}
      ${covered ? '' : `<ellipse cx="162" cy="120" rx="7" ry="10" fill="${C.skin}" ${ink(5)}/>
      <ellipse cx="38" cy="120" rx="7" ry="10" fill="${C.skin}" ${ink(5)}/>`}
    </g>`;
  }

  const units = {
    /* 궁수 — 갓 + 각궁. 키만 한 활의 곡선 */
    archer(t, e) {
      const bowD = 'M180 10 Q156 18 162 42 Q238 158 162 274 Q156 298 180 306';
      const bow = `<g>
        <path d="${bowD}" fill="none" stroke="${C.ink}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${bowD}" fill="none" stroke="${C.ochreL}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M166 26 L112 158 L166 290" fill="none" ${ink(4)}/></g>`;
      const arrow = `<g><line x1="104" y1="158" x2="248" y2="158" ${ink(6)}/>
        <path d="M248 158 L232 148 L232 168 Z" fill="${C.ink}"/>
        <path d="M104 158 L92 150 M104 158 L92 166" ${ink(4)}/></g>`;
      const quiver = `<g transform="rotate(-16 62 206)">
        <rect x="38" y="156" width="30" height="72" rx="9" fill="${C.ochreD}" ${ink(6)}/>
        <line x1="46" y1="156" x2="42" y2="122" ${ink(4)}/><line x1="54" y1="156" x2="54" y2="118" ${ink(4)}/>
        <line x1="62" y1="156" x2="68" y2="122" ${ink(4)}/></g>`;
      return flag(t, 1) + quiver + boots('') + coat(t) + bow +
        arm(70, 192, 116, 158) + arm(132, 192, 160, 158) + hand(116, 158) + hand(162, 158) + arrow + head(1, e, 'gat');
    },
    /* 포수 — 전립 + 총통. 몸통보다 굵은 사선 */
    gunner(t) {
      const barrel = `<g>
        <line x1="34" y1="264" x2="216" y2="136" stroke="${C.ink}" stroke-width="50" stroke-linecap="round"/>
        <line x1="38" y1="261" x2="212" y2="139" stroke="${C.ochreD}" stroke-width="36" stroke-linecap="round"/>
        <line x1="44" y1="250" x2="200" y2="140" stroke="${C.ochre}" stroke-width="6" stroke-linecap="round"/>
        <line x1="76" y1="234" x2="92" y2="223" stroke="${C.ink}" stroke-width="46"/>
        <line x1="146" y1="185" x2="160" y2="175" stroke="${C.ink}" stroke-width="46"/>
        <circle cx="214" cy="138" r="23" fill="${C.ochreD}" ${ink(6)}/>
        <circle cx="214" cy="138" r="10" fill="${C.ink}"/></g>`;
      const carriage = `<g>
        <path d="M112 208 L74 300" ${ink(14)} stroke="${C.ochreD}"/>
        <path d="M112 208 L166 300" ${ink(14)} stroke="${C.ochreD}"/>
        <path d="M112 208 L74 300 M112 208 L166 300" fill="none" ${ink(3)}/></g>`;
      const match = `<g><line x1="56" y1="224" x2="104" y2="186" ${ink(8)}/>
        <circle cx="106" cy="184" r="9" fill="${C.red}" ${ink(4)}/></g>`;
      return flag(t, 1) + boots('wide') + coat(t) + barrel + carriage +
        arm(130, 192, 152, 214) + hand(152, 214) + arm(72, 192, 56, 222) + hand(56, 222) + match + head(1, null, 'jeonrip') + `
        <path d="M230 124 L262 100 M238 144 L274 136" fill="none" ${ink(5)}/>`;
    },
    /* 검사 — 무관 투구 + 환도. 머리 위 검의 사선 */
    sword(t) {
      const blade = `<g>
        <path d="M184 30 Q112 -44 50 -162 Q88 -70 170 42 Z" fill="${C.steel}" ${ink()}/>
        <path d="M176 30 Q112 -40 62 -136" fill="none" stroke="${C.hanji}" stroke-width="4" opacity=".55"/>
        <line x1="174" y1="32" x2="200" y2="58" ${ink(9)} stroke="${C.pine}"/>
        <line x1="192" y1="50" x2="218" y2="78" stroke="${C.ochreD}" stroke-width="20" stroke-linecap="round"/>
        <line x1="192" y1="50" x2="218" y2="78" fill="none" ${ink(3)}/></g>`;
      return flag(t, 0.001) + boots('') + coat(t) + blade +
        arm(72, 190, 194, 62) + arm(132, 190, 212, 76) + hand(198, 64) + hand(214, 78) + head(0, null, 'helmet');
    },
    /* 창병 — 전립 + 장창. 키 1.5배 수직선 */
    spear(t) {
      const shaft = `<g>
        <line x1="176" y1="-128" x2="122" y2="308" stroke="${C.ink}" stroke-width="20" stroke-linecap="round"/>
        <line x1="176" y1="-128" x2="122" y2="308" stroke="${C.ochreD}" stroke-width="11" stroke-linecap="round"/>
        <path d="M182 -170 Q198 -130 179 -100 Q162 -130 182 -170 Z" fill="${C.steel}" ${ink(6)}/>
        <line x1="166" y1="-94" x2="190" y2="-91" stroke="${C.ink}" stroke-width="14" stroke-linecap="round"/>
        <line x1="166" y1="-94" x2="190" y2="-91" stroke="${C.ochre}" stroke-width="6" stroke-linecap="round"/></g>`;
      return flag(t, 1) + shaft + boots('lunge') + coat(t) +
        arm(72, 198, 148, 96) + arm(130, 202, 158, 154) + hand(150, 96) + hand(158, 152) + head(1, null, 'jeonrip');
    },
    /* 방패병 — 전립 + 장방패(長防牌). 몸 절반을 가리는 네모 */
    shield(t) {
      const sword = `<g transform="rotate(18 60 254)"><rect x="24" y="248" width="76" height="16" rx="7" fill="${C.ochreD}" ${ink(6)}/></g>`;
      const sh = `<g transform="rotate(-16 136 208)">
        <path d="M78 158 Q136 142 194 158 L194 272 Q136 288 78 272 Z" fill="${C.ochre}" ${ink()}/>
        <path d="M92 176 Q136 164 180 176 L180 254 Q136 266 92 254 Z" fill="none" ${ink(5)}/>
        <rect x="120" y="196" width="32" height="32" rx="5" fill="${C.ochreL}" ${ink(5)}/>
        <circle cx="136" cy="212" r="9" fill="${C.pine}" ${ink(4)}/></g>`;
      return flag(t, -1) + sword + boots('wide') + coat(t) + arm(126, 196, 148, 212) + sh +
        arm(70, 196, 48, 226) + hand(46, 228) + head(-0.4, null, 'jeonrip');
    }
  };

  const names = { archer: '궁수', gunner: '포수', sword: '검사', spear: '창병', shield: '방패병' };

  function render(unit, o) {
    o = o || {};
    const h = o.h || 300, t = o.team || 'red', e = o.expr || 'idle';
    CUR = skins[o.skin] ? o.skin : 'joseon';
    let inner = units[unit](t, e);
    CUR = 'joseon';
    if (e === 'hit') inner = `<g transform="rotate(-13 100 296)">${inner}</g>`;
    if (e === 'win') inner = `<g transform="translate(0,-14)">${inner}</g>`;
    if (e === 'buried') inner = inner + `
      <path d="M-80 236 Q10 212 70 226 Q120 238 180 216 Q230 202 240 226 L240 310 L-80 310 Z" fill="${C.ash}" stroke="${C.hanji}" stroke-width="10"/>
      <path d="M-80 236 Q10 212 70 226 Q120 238 180 216 Q230 202 240 226" fill="none" stroke="${C.ink}" stroke-width="6"/>
      <path d="M-60 262 Q40 250 120 260 Q200 270 240 258" fill="none" stroke="${C.hanji}" stroke-width="4" opacity=".4"/>`;
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
  return { C, render, mount, names, skinNames, skins };
})();
