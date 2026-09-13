/* 사태(沙汰) — SD 무장 캐릭터 도형 라이브러리 (v2 · 조선 고증 반영)
   · 갑옷은 조선 특유의 포(袍)형 두정갑 — 무릎 아래까지 내려오는 긴 자락 + 두정못 격자 + 견철
   · 머리: 궁수 갓(흑립) / 검사 투구(간주+삼지창+드림) / 포수·창병·방패병 전립(벙거지+상모)
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

  /* 두정못 격자 (징은 점으로) */
  function studs() {
    let s = '';
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) s += `<circle cx="${74 + c * 17}" cy="${184 + r * 17}" r="3.2" fill="${C.ink}"/>`;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) s += `<circle cx="${64 + c * 18}" cy="${252 + r * 16}" r="3.2" fill="${C.ink}"/>`;
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

  /* 포(袍)형 두정갑 : 긴 자락 + 견철 + 전대(팀색) */
  function coat(t) {
    const sk = skins[CUR];
    if (sk && sk.coat) return sk.coat(t);
    return `<g>
      <path d="M58 178 Q58 162 78 160 L122 160 Q142 162 142 178 L156 268 Q100 284 44 268 Z" fill="${C.ochre}" ${ink()}/>
      <path d="M100 162 Q116 186 110 268" fill="none" ${ink(4)}/>
      ${studs()}
      <path d="M44 268 Q100 284 156 268" fill="none" ${ink(4)}/>
      <g fill="${C.ochreL}" ${ink(5)}>
        <path d="M50 186 Q42 170 58 164 L74 162 L70 184 Z"/>
        <path d="M150 186 Q158 170 142 164 L126 162 L130 184 Z"/></g>
      <path d="M50 222 Q100 236 150 222 L152 250 Q100 264 48 250 Z" fill="${team(t)}" ${ink()}/>
      <path d="M150 236 L172 246 L166 262 L146 250" fill="${team(t)}" ${ink(5)}/>
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

  /* 갓(흑립) — 원통 대우 + 넓고 평평한 양태, 갓끈 */
  const gat = `<g>
    <path d="M68 52 L70 20 Q70 6 100 6 Q130 6 130 20 L132 52 Z" fill="${C.ink}" ${ink(6)}/>
    <ellipse cx="100" cy="54" rx="90" ry="14" fill="${C.ink}"/>
    <ellipse cx="100" cy="50" rx="90" ry="14" fill="${C.steel}" ${ink(5)}/>
    <path d="M30 56 Q40 96 58 104" fill="none" ${ink(4)}/>
    <circle cx="58" cy="106" r="6" fill="${C.pine}" ${ink(4)}/></g>`;

  /* 전립(벙거지) — 둥근 모자 + 붉은 상모 + 공작 깃 */
  const jeonrip = `<g>
    <path d="M56 56 Q56 14 100 14 Q144 14 144 56 Z" fill="${C.steel}" ${ink()}/>
    <ellipse cx="100" cy="56" rx="80" ry="14" fill="${C.steel}" ${ink()}/>
    <path d="M24 56 Q100 72 176 56" fill="none" ${ink(4)}/>
    <path d="M132 26 Q158 4 168 -18" fill="none" ${ink(6)} stroke="${C.pine}"/>
    <circle cx="100" cy="12" r="11" fill="${C.red}" ${ink(6)}/></g>`;

  /* 투구 — 반구 개철 + 간주·삼지창 + 붉은 상모 + 긴 드림(목가리개) */
  const helmet = `<g>
    <g fill="${C.ochreD}" ${ink()}>
      <path d="M34 72 Q30 150 44 166 L74 158 Q62 108 66 68 Z"/>
      <path d="M166 72 Q170 150 156 166 L126 158 Q138 108 134 68 Z"/></g>
    <g fill="${C.ink}"><circle cx="46" cy="96" r="3.2"/><circle cx="46" cy="120" r="3.2"/><circle cx="46" cy="144" r="3.2"/>
      <circle cx="154" cy="96" r="3.2"/><circle cx="154" cy="120" r="3.2"/><circle cx="154" cy="144" r="3.2"/></g>
    <path d="M56 64 Q56 16 100 16 Q144 16 144 64 Z" fill="${C.steel}" ${ink()}/>
    <ellipse cx="100" cy="64" rx="62" ry="12" fill="${C.ochreD}" ${ink()}/>
    <path d="M62 40 Q100 54 138 40" fill="none" ${ink(4)}/>
    <line x1="100" y1="16" x2="100" y2="-8" ${ink(8)}/>
    <circle cx="100" cy="-16" r="12" fill="${C.red}" ${ink(6)}/></g>`;

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
      const bow = `<g>
        <path d="M158 26 Q252 158 158 290" fill="none" stroke="${C.ink}" stroke-width="20" stroke-linecap="round"/>
        <path d="M158 26 Q244 158 158 290" fill="none" stroke="${C.ochreL}" stroke-width="9" stroke-linecap="round"/>
        <path d="M158 26 L112 158 L158 290" fill="none" ${ink(4)}/></g>`;
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
        <line x1="22" y1="272" x2="226" y2="128" stroke="${C.ink}" stroke-width="48" stroke-linecap="round"/>
        <line x1="26" y1="269" x2="222" y2="131" stroke="${C.steel}" stroke-width="34" stroke-linecap="round"/>
        <line x1="70" y1="238" x2="92" y2="222" stroke="${C.ink}" stroke-width="44"/>
        <line x1="150" y1="182" x2="170" y2="168" stroke="${C.ink}" stroke-width="44"/>
        <circle cx="222" cy="131" r="22" fill="${C.steel}" ${ink(6)}/></g>`;
      const carriage = `<g>
        <path d="M112 208 L74 300" ${ink(14)} stroke="${C.ochreD}"/>
        <path d="M112 208 L166 300" ${ink(14)} stroke="${C.ochreD}"/>
        <path d="M112 208 L74 300 M112 208 L166 300" fill="none" ${ink(3)}/></g>`;
      const match = `<g><line x1="56" y1="224" x2="104" y2="186" ${ink(8)}/>
        <circle cx="106" cy="184" r="9" fill="${C.red}" ${ink(4)}/></g>`;
      return flag(t, 1) + boots('wide') + coat(t) + barrel + carriage +
        arm(130, 192, 152, 214) + hand(152, 214) + arm(72, 192, 56, 222) + hand(56, 222) + match + head(1, null, 'jeonrip') + `
        <path d="M236 120 L268 96 M244 140 L280 132" fill="none" ${ink(5)}/>`;
    },
    /* 검사 — 무관 투구 + 환도. 머리 위 검의 사선 */
    sword(t) {
      const blade = `<g>
        <path d="M190 22 L86 -120 Q68 -146 52 -156 Q54 -134 44 -114 L166 46 Z" fill="${C.steel}" ${ink()}/>
        <path d="M62 -136 L182 30" fill="none" stroke="${C.hanji}" stroke-width="4" opacity=".5"/>
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
        <path d="M180 -148 L206 -52 L152 -44 Z" fill="${C.steel}" ${ink(6)}/>
        <line x1="160" y1="-34" x2="198" y2="-40" ${ink(10)} stroke="${C.red}"/></g>`;
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
      <path d="M-80 236 Q10 212 70 226 Q120 238 180 216 Q230 202 240 226 L240 310 L-80 310 Z" fill="${C.ash}" stroke="${C.ink}" stroke-width="6"/>
      <path d="M-60 258 Q40 246 120 256 Q200 266 240 254" fill="none" stroke="${C.hanji}" stroke-width="4" opacity=".35"/>`;
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
