// 아트보드 16장 + canvas.json 을 design/canvas/ 에 쓴다.  실행: node design/canvas/gen/build.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { titleBoard, lobbyBoard, roomBoard, ingameBoard, resultBoard } from './boards/screens.mjs';
import { characterBoard, accessoriesBoard, movesBoard, stylesBoard } from './boards/sheets.mjs';
import { mapColosseumBoard, mapSkyDockBoard, mapRooftopBoard, mapIceLakeBoard, controlsBoard, netcodeBoard, roadmapBoard } from './boards/systems.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..');
mkdirSync(outDir, { recursive: true });

// [파일, 생성기, w, h, 제목]
const BOARDS = [
  ['Title.dc.html', titleBoard, 1280, 720, '1 타이틀'],
  ['Lobby.dc.html', lobbyBoard, 1280, 720, '2 로비'],
  ['Room.dc.html', roomBoard, 1280, 720, '3 대기실'],
  ['Main.dc.html', ingameBoard, 1280, 720, '4 인게임'],
  ['Result.dc.html', resultBoard, 1280, 720, '5 결과'],
  ['Character.dc.html', characterBoard, 1200, 900, '캐릭터 시트'],
  ['Styles.dc.html', stylesBoard, 1200, 900, '스타일 5종'],
  ['Accessories.dc.html', accessoriesBoard, 1200, 800, '악세서리 6종'],
  ['Moves.dc.html', movesBoard, 1200, 900, '기본 동작 18'],
  ['MapColosseum.dc.html', mapColosseumBoard, 1200, 820, '맵 1 콜로세움'],
  ['MapSkyDock.dc.html', mapSkyDockBoard, 1200, 760, '맵 2 스카이독'],
  ['MapRooftop.dc.html', mapRooftopBoard, 1200, 760, '맵 3 옥상'],
  ['MapIceLake.dc.html', mapIceLakeBoard, 1200, 760, '맵 4 얼음 호수'],
  ['Controls.dc.html', controlsBoard, 1200, 860, '조작 · 상태 머신'],
  ['Netcode.dc.html', netcodeBoard, 1200, 1020, '네트워크 구조'],
  ['Roadmap.dc.html', roadmapBoard, 1200, 600, '로드맵 · 게이트'],
];

for (const [file, gen] of BOARDS) {
  writeFileSync(resolve(outDir, file), gen());
}

// 레이아웃: 1행 화면 흐름, 2행 캐릭터·장비·동작, 3행 맵·규칙·구조
const GAP_X = 80, GAP_Y = 160;
const rows = [
  ['Title.dc.html', 'Lobby.dc.html', 'Room.dc.html', 'Main.dc.html', 'Result.dc.html'],
  ['Character.dc.html', 'Styles.dc.html', 'Accessories.dc.html', 'Moves.dc.html'],
  ['MapColosseum.dc.html', 'MapSkyDock.dc.html', 'MapRooftop.dc.html', 'MapIceLake.dc.html', 'Controls.dc.html', 'Netcode.dc.html', 'Roadmap.dc.html'],
];
const byFile = Object.fromEntries(BOARDS.map((b) => [b[0], b]));
const artboards = [];
let y = 0;
const rowY = [];
for (const r of rows) {
  let x = 0, maxH = 0;
  rowY.push(y);
  for (const f of r) {
    const [, , w, h, title] = byFile[f];
    artboards.push({ file: f, x, y, w, h, title });
    x += w + GAP_X;
    maxH = Math.max(maxH, h);
  }
  y += maxH + GAP_Y;
}
const canvas = {
  artboards,
  annotations: [
    { id: 'premise', x: 0, y: -260, w: 620, text: 'AMP ARENA 시안 v0.2 (2026-09-10 · 2026-09-12 개정)\n8인 실시간 3D 아레나 대전 액션을 웹으로.\n방·악세서리·잡기·다운·링아웃이라는 고전 아레나 격투 문법, 캐릭터·UI·이름·아트는 오리지널.\nv0.2: 스타일 5종, 맵 4(옥상·얼음 호수), 방(문루·컨테이너·기계실)·드럼통·점프대.\n기획서: amp-arena/docs/GDD.md · 이 캔버스는 design/canvas/gen 이 생성한다.' },
    { id: 'row-screens', x: 700, y: -110, w: 420, text: '1행 · 화면 흐름 (1280×720)\n타이틀 → 로비 → 대기실 → 인게임 → 결과' },
    { id: 'row-sheets', x: 0, y: rowY[1] - 110, w: 420, text: '2행 · 캐릭터 · 스타일 5종 · 악세서리 · 동작\n3D 리그와 애니메이션 키의 원본' },
    { id: 'row-systems', x: 0, y: rowY[2] - 110, w: 420, text: '3행 · 맵 4 · 조작/상태 머신 · 네트워크 · 로드맵\n구현이 그대로 따르는 규칙' },
  ],
  launch: { view: 'canvas' },
};
writeFileSync(resolve(outDir, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n');
console.log(`wrote ${BOARDS.length} artboards + canvas.json → ${outDir}`);
