/* 사태(沙汰) — SD 무장 캐릭터 도형 라이브러리
   캐릭터 상자 200×300 (발이 y=300), 무기는 상자를 넘어감.
   viewBox -80 -170 320 480 — 상자 밖 무기를 담기 위한 여백. */
window.Sata = (function () {
  const C = {
    hanji: '#F9F8F2', ink: '#1D1D1F',
    ochre: '#B38B6D', ochreD: '#8A6A50', ochreL: '#CBAA8C',
    red: '#A2231D', blue: '#2B4B63', pine: '#1A472A',
    skin: '#F2CBA6', ash: '#4A4A4C', steel: '#3A3A3D'
  };
  const S = 7; // 먹선 굵기
  const ink = (w) => `stroke="${C.ink}" stroke-width="${w || S}" stroke-linejoin="round" stroke-linecap="round"`;
  const team = (t) => (t === 'blue' ? C.blue : C.red);

  /* ── 등깃발(배기) : 팀색. 등 쪽에 꽂힌다 ── */
  function flag(t, f) {
    const x0 = 100 - f * 30, y0 = 198, x1 = 100 - f * 74, y1 = 58;
    const px = x1 - f * 4;
    return `<g><line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" ${ink(9)}/>
      <path d="M${px} ${y1} L${px - f * 48} ${y1 + 16} L${px - f * 34} ${y1 + 42} L${px} ${y1 + 34} Z" fill="${team(t)}" ${ink(6)}/></g>`;
  }

  /* ── 두정갑 몸통 + 허리띠(팀색) ── */
  function torso(t) {
    return `<g>
      <path d="M58 182 Q58 166 76 164 L124 164 Q142 166 142 182 L146 238 Q100 250 54 238 Z" fill="${C.ochre}" ${ink()}/>
      <path d="M60 196 Q100 204 140 196" fill="none" ${ink(4)}/>
      <path d="M58 212 Q100 220 142 212" fill="none" ${ink(4)}/>
      <path d="M57 228 Q100 236 143 228" fill="none" ${ink(4)}/>
      <circle cx="82" cy="188" r="3.5" fill="${C.ink}"/><circle cx="118" cy="188" r="3.5" fill="${C.ink}"/>
      <circle cx="100" cy="205" r="3.5" fill="${C.ink}"/>
      <path d="M54 238 Q100 250 146 238 L148 262 Q100 274 52 262 Z" fill="${team(t)}" ${ink()}/>
    </g>`;
  }

  /* ── 다리 : stance 0 기본 / 1 내딛음(창병) / 2 버팀(포수·방패) ── */
  function legs(stance, f) {
    if (stance === 1) return `<g>
      <path d="M92 258 L54 288 L44 300 L74 300 L102 274 Z" fill="${C.ochreD}" ${ink()}/>
      <path d="M114 258 L146 286 L158 300 L128 300 L106 278 Z" fill="${C.ochreD}" ${ink()}/>
      <ellipse cx="56" cy="296" rx="24" ry="11" fill="${C.ink}"/>
      <ellipse cx="146" cy="296" rx="24" ry="11" fill="${C.ink}"/></g>`;
    const w = stance === 2 ? 16 : 8;
    return `<g>
      <rect x="${70 - w}" y="256" width="28" height="42" rx="11" fill="${C.ochreD}" ${ink()}/>
      <rect x="${102 + w}" y="256" width="28" height="42" rx="11" fill="${C.ochreD}" ${ink()}/>
      <ellipse cx="${84 - w}" cy="296" rx="25" ry="11" fill="${C.ink}"/>
      <ellipse cx="${116 + w}" cy="296" rx="25" ry="11" fill="${C.ink}"/></g>`;
  }

  function arm(x1, y1, x2, y2) {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink}" stroke-width="28" stroke-linecap="round"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ochre}" stroke-width="18" stroke-linecap="round"/>`;
  }
  const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="${C.skin}" ${ink(6)}/>`;

  /* ── 얼굴 : 전립(넓은 챙) + 붉은 상모, 점 눈 ── */
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
    if (e === 'buried') return `<g ${ink(6)} fill="none">
      <path d="M${l - 11} ${y - 6} L${l + 11} ${y + 6}"/><path d="M${r + 11} ${y - 6} L${r - 11} ${y + 6}"/>
      <rect x="${100 + f * 16 - 14}" y="140" width="28" height="12" rx="4" fill="${C.ink}" stroke="none"/></g>`;
    return `<g><circle cx="${l}" cy="${y}" r="7.5" fill="${C.ink}"/><circle cx="${r}" cy="${y}" r="7.5" fill="${C.ink}"/>
      <path d="M${100 + f * 16 - 11} 142 Q${100 + f * 16} 152 ${100 + f * 16 + 11} 142" fill="none" ${ink(5)}/></g>`;
  }

  function head(f, e) {
    return `<g>
      <rect x="86" y="152" width="28" height="20" fill="${C.skin}" ${ink(6)}/>
      <ellipse cx="100" cy="104" rx="62" ry="66" fill="${C.skin}" ${ink()}/>
      <path d="M40 58 Q100 6 160 58 Z" fill="${C.ochreD}" ${ink()}/>
      <ellipse cx="100" cy="58" rx="88" ry="15" fill="${C.ochreD}" ${ink()}/>
      <path d="M22 58 Q100 74 178 58" fill="none" ${ink(4)}/>
      <circle cx="100" cy="18" r="10" fill="${C.red}" ${ink(6)}/>
      ${eyes(f, e)}
      <ellipse cx="162" cy="120" rx="7" ry="10" fill="${C.skin}" ${ink(5)}/>
      <ellipse cx="38" cy="120" rx="7" ry="10" fill="${C.skin}" ${ink(5)}/>
    </g>`;
  }

  /* ── 병과별 ── */
  const units = {
    /* 궁수 : 키만 한 각궁의 곡선 */
    archer(t, e) {
      const bow = `<g>
        <path d="M158 26 Q252 158 158 290" fill="none" stroke="${C.ink}" stroke-width="20" stroke-linecap="round"/>
        <path d="M158 26 Q244 158 158 290" fill="none" stroke="${C.ochreL}" stroke-width="9" stroke-linecap="round"/>
        <path d="M158 26 L112 158 L158 290" fill="none" ${ink(4)}/></g>`;
      const arrow = `<g><line x1="104" y1="158" x2="248" y2="158" ${ink(6)}/>
        <path d="M248 158 L232 148 L232 168 Z" fill="${C.ink}"/>
        <path d="M104 158 L92 150 M104 158 L92 166" ${ink(4)}/></g>`;
      const quiver = `<g transform="rotate(-16 62 200)">
        <rect x="40" y="150" width="30" height="70" rx="9" fill="${C.ochreD}" ${ink(6)}/>
        <line x1="48" y1="150" x2="44" y2="118" ${ink(4)}/><line x1="56" y1="150" x2="56" y2="114" ${ink(4)}/>
        <line x1="64" y1="150" x2="70" y2="118" ${ink(4)}/></g>`;
      return flag(t, 1) + quiver + legs(0, 1) + torso(t) + bow +
        arm(70, 190, 116, 158) + arm(132, 190, 160, 158) + hand(116, 158) + hand(162, 158) + arrow + head(1, e);
    },
    /* 포수 : 몸통보다 굵은 포신의 사선 */
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
      return flag(t, 1) + legs(2, 1) + torso(t) + barrel + carriage +
        arm(130, 192, 152, 214) + hand(152, 214) + arm(72, 192, 56, 222) + hand(56, 222) + match + head(1) + `
        <path d="M236 120 L268 96 M244 140 L280 132" fill="none" ${ink(5)}/>`;
    },
    /* 검사 : 머리 위로 올린 환도의 사선 */
    sword(t) {
      const blade = `<g>
        <path d="M184 10 L44 -124 L20 -98 L162 36 Z" fill="${C.steel}" ${ink()}/>
        <path d="M42 -112 L176 18" fill="none" stroke="${C.hanji}" stroke-width="4" opacity=".5"/>
        <line x1="170" y1="22" x2="196" y2="48" ${ink(9)} stroke="${C.pine}"/>
        <line x1="188" y1="40" x2="216" y2="70" stroke="${C.ochreD}" stroke-width="20" stroke-linecap="round"/>
        <line x1="188" y1="40" x2="216" y2="70" fill="none" ${ink(3)}/></g>`;
      return flag(t, 0.001) + legs(0, 1) + torso(t) + blade +
        arm(72, 186, 190, 52) + arm(132, 186, 208, 66) + hand(194, 54) + hand(210, 68) + head(0);
    },
    /* 창병 : 키의 1.5배 수직선 */
    spear(t) {
      const shaft = `<g>
        <line x1="176" y1="-128" x2="122" y2="308" stroke="${C.ink}" stroke-width="20" stroke-linecap="round"/>
        <line x1="176" y1="-128" x2="122" y2="308" stroke="${C.ochreD}" stroke-width="11" stroke-linecap="round"/>
        <path d="M180 -148 L206 -52 L152 -44 Z" fill="${C.steel}" ${ink(6)}/>
        <line x1="160" y1="-34" x2="198" y2="-40" ${ink(10)} stroke="${C.red}"/></g>`;
      return flag(t, 1) + shaft + legs(1, 1) + torso(t) +
        arm(72, 196, 148, 96) + arm(130, 200, 158, 154) + hand(150, 96) + hand(158, 152) + head(1);
    },
    /* 방패병 : 몸 절반을 가리는 원 */
    shield(t) {
      const sword = `<g transform="rotate(18 60 250)">
        <rect x="26" y="244" width="76" height="16" rx="7" fill="${C.ochreD}" ${ink(6)}/></g>`;
      const sh = `<g transform="rotate(-18 132 212)">
        <circle cx="132" cy="212" r="86" fill="${C.ochre}" ${ink()}/>
        <circle cx="132" cy="212" r="62" fill="none" ${ink(6)}/>
        <circle cx="132" cy="212" r="38" fill="${C.ochreL}" ${ink(6)}/>
        <circle cx="132" cy="212" r="15" fill="${C.pine}" ${ink(5)}/></g>`;
      return flag(t, -1) + sword + legs(2, -1) + torso(t) + arm(126, 192, 150, 216) + sh + arm(70, 192, 48, 224) + hand(46, 226) + head(-0.4);
    }
  };

  const names = { archer: '궁수', gunner: '포수', sword: '검사', spear: '창병', shield: '방패병' };

  function render(unit, o) {
    o = o || {};
    const h = o.h || 300, t = o.team || 'red', e = o.expr || 'idle';
    let inner = units[unit](t, e);
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
      el.innerHTML = render(el.dataset.unit, {
        h: +el.dataset.h || 300, team: el.dataset.team, expr: el.dataset.expr
      });
    });
  }
  document.addEventListener('DOMContentLoaded', () => mount());
  return { C, render, mount, names };
})();
