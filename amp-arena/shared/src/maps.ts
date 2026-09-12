// 맵 정의 — 기획서 §9. 단위 m, 아레나 중심 (0,0), y 는 높이.
export interface Box { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; room?: number; part?: 'wall' | 'roof' }
/** 들어갈 수 있는 방: 벽 4면(문 하나) + 지붕. 시뮬은 벽·지붕을 보통 상자로 보고, 화면은 안에 있을 때 벽·지붕을 비친다. */
export interface Room { minX: number; maxX: number; minZ: number; maxZ: number; floor: number; height: number; door: { side: 'n' | 's' | 'e' | 'w'; center: number; width: number } }
export interface Cylinder { x: number; z: number; r: number; h: number }
export interface Spawn { x: number; z: number; y: number; team: number } // team 0 = 레드/무팀, 1 = 블루
export interface CrateSpot { x: number; z: number; y: number } // 상자·드럼통 자리
/** 점프대: 밟으면 위로 튕긴다 (power = 상승 m/s). 2026-09-11 2차 소감 「번지 가능한 맵」 */
export interface Pad { x: number; z: number; y: number; r: number; power: number }

export type MapId = 'colosseum' | 'skydock' | 'rooftop' | 'icelake';
export type MapTheme = 'colosseum' | 'sky' | 'rooftop' | 'ice';

export interface MapDef {
  id: MapId;
  name: string;
  theme: MapTheme;
  desc: string;
  groundRadius: number;   // 0 이면 바닥 평면 없음 (발판만)
  wallRadius: number;     // 0 이면 원형 벽 없음
  wallHeight: number;
  ice: boolean;           // 미끄러운 바닥 — 가속·감속이 느리다
  boxes: Box[];           // 발판·단상 (위에 설 수 있고 옆은 막힌다)
  cylinders: Cylinder[];  // 기둥·바위
  spawns: Spawn[];
  crates: CrateSpot[];
  barrels: CrateSpot[];   // 드럼통 자리 — 맞거나 던져지면 터지는 오브젝트
  pads: Pad[];            // 점프대
  rooms: Room[];          // 들어갈 수 있는 방 (벽·지붕 상자는 boxes 에 이미 펼쳐져 있다)
  fallY: number;
}

const box = (cx: number, cz: number, w: number, d: number, bottom: number, top: number): Box => ({
  minX: cx - w / 2, maxX: cx + w / 2, minY: bottom, maxY: top, minZ: cz - d / 2, maxZ: cz + d / 2,
});

/** 방 → 벽·지붕 상자. 문이 있는 벽은 둘로 쪼갠다. 벽 두께 0.3, 지붕 두께 0.3(위에 올라설 수 있다). */
export function roomBoxes(r: Room, index: number): Box[] {
  const T = 0.3, top = r.floor + r.height;
  const out: Box[] = [];
  const wall = (minX: number, maxX: number, minZ: number, maxZ: number): Box => ({ minX, maxX, minY: r.floor, maxY: top, minZ, maxZ, room: index, part: 'wall' });
  const split = (side: 'n' | 's' | 'e' | 'w', lo: number, hi: number): [number, number][] => {
    if (r.door.side !== side) return [[lo, hi]];
    const a = r.door.center - r.door.width / 2, b = r.door.center + r.door.width / 2;
    return [[lo, a], [b, hi]].filter(([x, y]) => y - x > 0.05) as [number, number][];
  };
  for (const [a, b] of split('n', r.minX, r.maxX)) out.push(wall(a, b, r.maxZ - T, r.maxZ));
  for (const [a, b] of split('s', r.minX, r.maxX)) out.push(wall(a, b, r.minZ, r.minZ + T));
  for (const [a, b] of split('e', r.minZ, r.maxZ)) out.push(wall(r.maxX - T, r.maxX, a, b));
  for (const [a, b] of split('w', r.minZ, r.maxZ)) out.push(wall(r.minX, r.minX + T, a, b));
  out.push({ minX: r.minX, maxX: r.maxX, minY: top, maxY: top + T, minZ: r.minZ, maxZ: r.maxZ, room: index, part: 'roof' });
  return out;
}

const ringSpawns = (r: number, count: number, y = 0): Spawn[] => {
  const out: Spawn[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i * (360 / count) * Math.PI) / 180;
    const x = r * Math.cos(a), z = r * Math.sin(a);
    // 동쪽 절반 레드(0), 서쪽 절반 블루(1); 정남북은 번갈아
    const team = Math.cos(a) > 0.01 ? 0 : Math.cos(a) < -0.01 ? 1 : i % 4 === 2 ? 0 : 1;
    out.push({ x, z, y, team });
  }
  return out;
};

/** 콜로세움 동·서 문루: 5×5 방, 높이 2.4, 아레나 중심 쪽 벽에 문. 안에 드럼통이 하나씩 있다 (2026-09-12 「건물 내부」를 모든 맵에). */
const COLOSSEUM_ROOMS: Room[] = [
  { minX: 12.5, maxX: 17.5, minZ: 3.5, maxZ: 8.5, floor: 0, height: 2.4, door: { side: 'w', center: 6, width: 1.8 } },
  { minX: -17.5, maxX: -12.5, minZ: -8.5, maxZ: -3.5, floor: 0, height: 2.4, door: { side: 'e', center: -6, width: 1.8 } },
];

export const COLOSSEUM: MapDef = {
  id: 'colosseum', name: '콜로세움', theme: 'colosseum', desc: '벽 있음 · 낙사 없음 · 40m · 동서 문루',
  groundRadius: 20, wallRadius: 20, wallHeight: 3, ice: false,
  boxes: [box(0, 12, 4, 4, 0, 1.5), box(0, -12, 4, 4, 0, 1.5), ...COLOSSEUM_ROOMS.flatMap((r, i) => roomBoxes(r, i))],
  cylinders: [
    { x: -8.5, z: 8.5, r: 0.8, h: 6 }, { x: 8.5, z: 8.5, r: 0.8, h: 6 },
    { x: -8.5, z: -8.5, r: 0.8, h: 6 }, { x: 8.5, z: -8.5, r: 0.8, h: 6 },
  ],
  spawns: ringSpawns(15, 8),
  crates: [0, 1, 2, 3, 4, 5].map((i) => {
    const a = ((i * 60 + 30) * Math.PI) / 180;
    return { x: 9 * Math.cos(a), z: 9 * Math.sin(a), y: 0 };
  }),
  barrels: [{ x: 15, z: 6, y: 0 }, { x: -15, z: -6, y: 0 }],
  pads: [{ x: 5, z: 12, y: 0, r: 0.9, power: 11 }, { x: -5, z: -12, y: 0, r: 0.9, power: 11 }],
  rooms: COLOSSEUM_ROOMS,
  fallY: -8,
};

/** 스카이독 컨테이너: 중앙 발판 남쪽에 8×4 방, 높이 2.3, 북쪽(중앙 쪽) 문. 안에 드럼통. */
const SKYDOCK_ROOM: Room = { minX: -4, maxX: 4, minZ: -7.5, maxZ: -3.5, floor: 0, height: 2.3, door: { side: 'n', center: 0, width: 1.8 } };

export const SKYDOCK: MapDef = {
  id: 'skydock', name: '스카이독', theme: 'sky', desc: '발판 5 · 점프대 3 · 컨테이너 · 낙사 · 던지기로 링아웃',
  groundRadius: 0, wallRadius: 0, wallHeight: 0, ice: false,
  boxes: [
    box(0, 0, 24, 16, -3, 0),      // 중앙
    box(-19, 0, 8, 8, -3, 2),      // 서
    box(19, 0, 8, 8, -3, 2),       // 동
    box(0, 16, 6, 10, -3, 0),      // 북
    box(0, -16, 6, 10, -3, 0),     // 남
    ...roomBoxes(SKYDOCK_ROOM, 0),
  ],
  cylinders: [],
  spawns: [
    { x: -10, z: 6, y: 0, team: 0 }, { x: -10, z: -6, y: 0, team: 0 }, { x: 10, z: 6, y: 0, team: 1 }, { x: 10, z: -6, y: 0, team: 1 },
    { x: -17, z: 0, y: 2, team: 0 }, { x: 17, z: 0, y: 2, team: 1 }, { x: 0, z: 19, y: 0, team: 0 }, { x: 0, z: -19, y: 0, team: 1 },
  ],
  crates: [{ x: -21.5, z: 2.5, y: 2 }, { x: 21.5, z: 2.5, y: 2 }, { x: -21.5, z: -2.5, y: 2 }, { x: 21.5, z: -2.5, y: 2 }],
  barrels: [{ x: 0, z: -5.5, y: 0 }, { x: -19, z: 3, y: 2 }, { x: 19, z: -3, y: 2 }],
  pads: [{ x: -10.5, z: 0, y: 0, r: 0.9, power: 12 }, { x: 10.5, z: 0, y: 0, r: 0.9, power: 12 }, { x: 0, z: 0, y: 0, r: 1.0, power: 13 }],
  rooms: [SKYDOCK_ROOM],
  fallY: -8,
};

/** 기계실: 8×6 방, 높이 2.3, 동쪽 벽 가운데 1.8m 문. 안에 상자가 하나 있다. */
const ROOFTOP_ROOM: Room = { minX: -14, maxX: -6, minZ: 2, maxZ: 8, floor: 0, height: 2.3, door: { side: 'e', center: 5, width: 1.8 } };

/** 옥상: 30×20 지붕, 기계실(들어갈 수 있는 방, 지붕 2.3m)과 계단 턱(+1m), 실외기 3개. 난간 없음 — 가장자리가 곧 낙사. */
export const ROOFTOP: MapDef = {
  id: 'rooftop', name: '옥상', theme: 'rooftop', desc: '30×20 · 난간 없음 · 들어갈 수 있는 기계실',
  groundRadius: 0, wallRadius: 0, wallHeight: 0, ice: false,
  boxes: [
    box(0, 0, 30, 20, -3, 0),       // 지붕
    box(-10, 0.5, 8, 3, 0, 1.0),    // 턱 (기계실 지붕 2.3m 는 점프대나 턱→점프로 오른다)
    box(8, 6, 2, 2, 0, 1.2),        // 실외기
    box(8, -6, 2, 2, 0, 1.2),
    box(0, -8, 3, 1.5, 0, 1.0),
    ...roomBoxes(ROOFTOP_ROOM, 0),  // 기계실: 동쪽 문으로 들어간다 (2026-09-12 소감 「건물 내부 진입」)
  ],
  rooms: [ROOFTOP_ROOM],
  cylinders: [],
  spawns: [
    { x: -13, z: -8, y: 0, team: 0 }, { x: -13, z: 8, y: 0, team: 0 }, { x: -5, z: -8.5, y: 0, team: 0 }, { x: -10, z: 5, y: 2, team: 0 },
    { x: 13, z: -8, y: 0, team: 1 }, { x: 13, z: 8, y: 0, team: 1 }, { x: 5, z: 8.5, y: 0, team: 1 }, { x: 12, z: 0, y: 0, team: 1 },
  ],
  crates: [{ x: -13.5, z: -6, y: 0 }, { x: 13.5, z: -8.5, y: 0 }, { x: 3, z: 8.5, y: 0 }, { x: -3, z: -8.5, y: 0 }, { x: -12, z: 6.5, y: 0 }],
  barrels: [{ x: -8, z: 6.5, y: 0 }, { x: 5, z: -3, y: 0 }], // 기계실 안 하나, 밖 하나
  pads: [{ x: -4.5, z: 3.2, y: 0, r: 0.9, power: 11 }, { x: 11, z: 0, y: 0, r: 0.9, power: 11 }],
  fallY: -8,
};

/** 얼음 호수: 반지름 18 얼음판, 가장자리 밖은 물(낙사). 미끄러워 멈추기 어렵고, 바위가 엄폐. */
export const ICELAKE: MapDef = {
  id: 'icelake', name: '얼음 호수', theme: 'ice', desc: '미끄러움 · 가장자리 낙사 · 바위 엄폐',
  groundRadius: 18, wallRadius: 0, wallHeight: 0, ice: true,
  boxes: [],
  cylinders: [
    { x: 0, z: 0, r: 1.6, h: 2.2 },
    { x: 9, z: 9, r: 0.9, h: 1.4 }, { x: -9, z: 9, r: 0.9, h: 1.4 }, { x: 9, z: -9, r: 0.9, h: 1.4 }, { x: -9, z: -9, r: 0.9, h: 1.4 },
  ],
  spawns: ringSpawns(12, 8),
  crates: [0, 1, 2, 3].map((i) => { const a = ((i * 90 + 45) * Math.PI) / 180; return { x: 6 * Math.cos(a), z: 6 * Math.sin(a), y: 0 }; }),
  barrels: [{ x: 0, z: 4.5, y: 0 }, { x: 0, z: -4.5, y: 0 }],
  pads: [],
  rooms: [],
  fallY: -8,
};

export const MAPS: Record<MapId, MapDef> = { colosseum: COLOSSEUM, skydock: SKYDOCK, rooftop: ROOFTOP, icelake: ICELAKE };
export const MAP_IDS: MapId[] = ['colosseum', 'skydock', 'rooftop', 'icelake'];
