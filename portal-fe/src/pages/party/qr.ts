/**
 * QR 인코더 — 초대 링크용 (ADR-0092 SR-4.2).
 *
 * **클라이언트에서 그린다.** 링크가 서버로 갈 이유가 없고, 외부 QR 서비스에 방 주소를
 * 넘기면 그 서비스가 「누가 어느 방에 모이는지」를 알게 된다. 의존성도 늘리지 않는다 —
 * 필요한 것은 바이트 모드 하나뿐이라 규격의 그 부분만 구현한다.
 *
 * 지원 범위: 바이트 모드 · 오류 정정 레벨 L · 버전 1~6(최대 134바이트).
 * 초대 링크는 `https://game.1989v.com/party/ABC123` 형태라 40바이트를 안 넘는다.
 */

/** 버전별 (총 코드워드, 오류정정 코드워드/블록, 블록 수) — 레벨 L. 규격 표 그대로다 */
const VERSION_SPEC: Record<number, { total: number; ecPerBlock: number; blocks: number }> = {
  1: { total: 26, ecPerBlock: 7, blocks: 1 },
  2: { total: 44, ecPerBlock: 10, blocks: 1 },
  3: { total: 70, ecPerBlock: 15, blocks: 1 },
  4: { total: 100, ecPerBlock: 20, blocks: 1 },
  5: { total: 134, ecPerBlock: 26, blocks: 1 },
  6: { total: 172, ecPerBlock: 18, blocks: 2 },
};

/** 버전별 정렬 패턴 중심 좌표 — 규격 부록 E */
const ALIGN_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
};

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

/** 생성 다항식 */
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], 1);
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function reedSolomon(data: number[], ecLen: number): number[] {
  const gen = generator(ecLen);
  const rest = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rest[0];
    rest.shift();
    rest.push(0);
    for (let i = 0; i < ecLen; i++) rest[i] ^= gfMul(gen[i + 1], factor);
  }
  return rest;
}

/** 바이트 모드로 담을 수 있는 최소 버전 */
function pickVersion(byteLen: number): number {
  for (let v = 1; v <= 6; v++) {
    const spec = VERSION_SPEC[v];
    const capacity = spec.total - spec.ecPerBlock * spec.blocks;
    // 모드 지시자 4비트 + 길이 필드(버전 1~9 는 8비트) = 2바이트
    if (byteLen + 2 <= capacity) return v;
  }
  throw new Error('QR 로 담기에 너무 긴 문자열이다');
}

function toBitStream(text: string, version: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const spec = VERSION_SPEC[version];
  const capacity = spec.total - spec.ecPerBlock * spec.blocks;

  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // 바이트 모드
  push(bytes.length, 8); // 버전 1~9 의 길이 필드
  bytes.forEach((b) => push(b, 8));

  // 종단자 + 바이트 경계 맞춤
  const maxBits = capacity * 8;
  for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const words: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    words.push(bits.slice(i, i + 8).reduce((acc, b) => (acc << 1) | b, 0));
  }
  // 채움 바이트 — 규격이 정한 두 값을 번갈아
  const PAD = [0xec, 0x11];
  for (let i = 0; words.length < capacity; i++) words.push(PAD[i % 2]);
  return words;
}

function interleave(words: number[], version: number): number[] {
  const { ecPerBlock, blocks } = VERSION_SPEC[version];
  const per = words.length / blocks;
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  for (let i = 0; i < blocks; i++) {
    const block = words.slice(i * per, (i + 1) * per);
    dataBlocks.push(block);
    ecBlocks.push(reedSolomon(block, ecPerBlock));
  }
  const out: number[] = [];
  for (let i = 0; i < per; i++) dataBlocks.forEach((b) => out.push(b[i]));
  for (let i = 0; i < ecPerBlock; i++) ecBlocks.forEach((b) => out.push(b[i]));
  return out;
}

type Grid = (0 | 1 | null)[][];

function placePatterns(grid: Grid, size: number, version: number) {
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inRing && ((r === 0 || r === 6 || c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        grid[rr][cc] = dark ? 1 : 0;
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  // 타이밍 패턴
  for (let i = 8; i < size - 8; i++) {
    const bit: 0 | 1 = i % 2 === 0 ? 1 : 0;
    grid[6][i] = bit;
    grid[i][6] = bit;
  }
  // 항상 어두운 모듈
  grid[size - 8][8] = 1;

  // 정렬 패턴 — 파인더와 겹치는 자리는 건너뛴다
  const centers = ALIGN_CENTERS[version];
  for (const r of centers) {
    for (const c of centers) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          grid[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : 0;
        }
      }
    }
  }
}

function reservedFormatCells(size: number): Set<string> {
  const cells = new Set<string>();
  for (let i = 0; i < 9; i++) {
    cells.add(`8,${i}`);
    cells.add(`${i},8`);
  }
  for (let i = 0; i < 8; i++) {
    cells.add(`8,${size - 1 - i}`);
    cells.add(`${size - 1 - i},8`);
  }
  return cells;
}

/** 마스크 0 — 하나만 쓴다. 규격이 여덟을 정의하지만 선택은 미관 최적화이지 정확성이 아니다 */
const maskZero = (r: number, c: number) => (r + c) % 2 === 0;

function writeFormat(grid: Grid, size: number) {
  // 레벨 L(01) + 마스크 0(000) → BCH 로 15비트
  const data = 0b01000;
  let bch = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((bch >> (i + 10)) & 1) bch ^= 0b10100110111 << i;
  }
  const format = ((data << 10) | bch) ^ 0b101010000010010;
  const bit = (i: number): 0 | 1 => ((format >> i) & 1 ? 1 : 0);

  for (let i = 0; i <= 5; i++) grid[8][i] = bit(i);
  grid[8][7] = bit(6);
  grid[8][8] = bit(7);
  grid[7][8] = bit(8);
  for (let i = 9; i <= 14; i++) grid[14 - i][8] = bit(i);

  for (let i = 0; i <= 7; i++) grid[size - 1 - i][8] = bit(i);
  for (let i = 8; i <= 14; i++) grid[8][size - 15 + i] = bit(i);
}

/** 문자열 → 모듈 격자(true 가 어두운 칸) */
export function encodeQr(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text).length;
  const version = pickVersion(bytes);
  const size = 17 + version * 4;

  const grid: Grid = Array.from({ length: size }, () => new Array(size).fill(null));
  placePatterns(grid, size, version);
  const reserved = reservedFormatCells(size);
  reserved.forEach((k) => {
    const [r, c] = k.split(',').map(Number);
    if (grid[r][c] === null) grid[r][c] = 0;
  });

  const payload = interleave(toBitStream(text, version), version);
  const bits: number[] = [];
  payload.forEach((w) => {
    for (let i = 7; i >= 0; i--) bits.push((w >> i) & 1);
  });

  // 지그재그로 채운다 — 오른쪽 아래에서 위로, 두 열씩
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1; // 세로 타이밍 열은 건너뛴다
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (grid[row][col] !== null) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex++] : 0;
        grid[row][col] = (maskZero(row, col) ? bit ^ 1 : bit) as 0 | 1;
      }
    }
    upward = !upward;
  }

  writeFormat(grid, size);
  return grid.map((row) => row.map((cell) => cell === 1));
}

/** 격자 → SVG path. 화면이 그대로 그린다 — 이미지 파일을 만들지 않는다 */
export function qrSvgPath(grid: boolean[][]): string {
  let d = '';
  grid.forEach((row, r) => {
    row.forEach((dark, c) => {
      if (dark) d += `M${c} ${r}h1v1h-1z`;
    });
  });
  return d;
}
