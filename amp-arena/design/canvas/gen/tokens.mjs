// 시안 공통 토큰 — 캔버스 아트보드 전부가 이 값을 쓴다.
export const T = {
  bg: '#121830',
  bg2: '#0c1124',
  panel: '#1c2342',
  panel2: '#26305a',
  panel3: '#303b6e',
  line: '#3a4680',
  line2: '#4c5a9c',
  ink: '#f5f2ea',
  muted: '#a9b0cc',
  dim: '#6f78a3',
  amp: '#ffb020',
  amp2: '#ff6a2a',
  cyan: '#33d1ff',
  green: '#4ade80',
  red: '#ee4444',
  blue: '#4488ff',
  purple: '#a78bfa',
  pink: '#f472b6',
  outline: '#1a1f3a',
  skin: '#f6cfa6',
  skinDark: '#e2b48c',
  hair: '#2b2f4a',
  pants: '#2f3a6e',
  shoe: '#f5f2ea',
  steel: '#d9dde8',
  steelDark: '#9aa3b8',
  wood: '#b07a3c',
  woodDark: '#7a4f22',
  // 슬롯 색 8종 — 상의 색이자 명찰 테두리
  slot: ['#ff6a2a', '#4488ff', '#4ade80', '#ffb020', '#a78bfa', '#33d1ff', '#f472b6', '#f5f2ea'],
};

export const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&amp;family=Gothic+A1:wght@400;600;700;800&amp;display=swap">';

export const BASE_CSS = `
    body { margin: 0; background: ${T.bg}; color: ${T.ink}; font-family: 'Gothic A1', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-size: 14px; line-height: 1.4; }
    a { color: ${T.amp}; } a:hover { color: ${T.amp2}; }
    .display { font-family: 'Black Han Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; font-weight: 400; letter-spacing: 0.01em; }
    .num { font-variant-numeric: tabular-nums; }
    * { box-sizing: border-box; }
`;

/** .dc.html 문서 한 장을 만든다. body 는 루트 요소 하나(고정 크기)여야 한다. */
export function doc({ css = '', body }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONT_LINK}
  <style>${BASE_CSS}${css}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
}

export const r2 = (n) => Math.round(n * 100) / 100;
