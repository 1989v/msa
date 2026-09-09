import { describe, expect, it } from 'vitest';
import { encodeQr, qrSvgPath } from '../qr';

/**
 * ADR-0092 SR-4.2 — QR 은 클라이언트가 그린다.
 *
 * **판정은 규격이 정한 구조로 한다.** 내가 만든 격자를 스냅샷으로 박아 두면 검사가
 * 자기 근거를 보게 된다 — 인코더를 통째로 망가뜨려도 스냅샷만 갱신하면 초록불이 난다.
 * 파인더·타이밍 패턴의 위치와 버전별 크기는 규격이 정한 값이라 그것을 본다.
 */
const LINK = 'https://game.1989v.com/party/ABC123';

describe('QR 인코더 — 규격이 정한 구조', () => {
  it('버전 1 은 21×21 이고, 링크 길이면 그보다 커진다', () => {
    expect(encodeQr('hi')).toHaveLength(21);
    const grid = encodeQr(LINK);
    // 크기는 언제나 17 + 4v 형태여야 한다
    expect((grid.length - 17) % 4).toBe(0);
    expect(grid.length).toBeGreaterThan(21);
    expect(grid.every((row) => row.length === grid.length)).toBe(true);
  });

  it('파인더 패턴이 세 모서리에 있다 — 네 번째 모서리에는 없다', () => {
    const g = encodeQr(LINK);
    const n = g.length;
    const finderAt = (r0: number, c0: number) => {
      for (let i = 0; i < 7; i++) {
        if (!g[r0][c0 + i] || !g[r0 + 6][c0 + i]) return false;
        if (!g[r0 + i][c0] || !g[r0 + i][c0 + 6]) return false;
      }
      for (let i = 2; i <= 4; i++) {
        for (let j = 2; j <= 4; j++) if (!g[r0 + i][c0 + j]) return false;
      }
      return !g[r0 + 1][c0 + 1] && !g[r0 + 5][c0 + 5];
    };
    expect(finderAt(0, 0)).toBe(true);
    expect(finderAt(0, n - 7)).toBe(true);
    expect(finderAt(n - 7, 0)).toBe(true);
    expect(finderAt(n - 7, n - 7)).toBe(false);
  });

  it('타이밍 패턴이 6행·6열에서 번갈아 나온다', () => {
    const g = encodeQr(LINK);
    for (let i = 8; i < g.length - 8; i++) {
      expect(g[6][i], `6행 ${i}열`).toBe(i % 2 === 0);
      expect(g[i][6], `${i}행 6열`).toBe(i % 2 === 0);
    }
  });

  it('규격이 정한 「항상 어두운 모듈」이 있다', () => {
    const g = encodeQr(LINK);
    expect(g[g.length - 8][8]).toBe(true);
  });

  it('내용이 다르면 격자가 다르다 — 인코더가 입력을 실제로 읽는다', () => {
    const a = encodeQr('https://game.1989v.com/party/AAAAAA');
    const b = encodeQr('https://game.1989v.com/party/BBBBBB');
    expect(a.length).toBe(b.length);
    let diff = 0;
    a.forEach((row, r) => row.forEach((v, c) => { if (v !== b[r][c]) diff += 1; }));
    expect(diff).toBeGreaterThan(0);
  });

  it('같은 내용이면 같은 격자다 — 재현된다', () => {
    expect(encodeQr(LINK)).toEqual(encodeQr(LINK));
  });

  it('한글도 담는다 — UTF-8 바이트로 센다', () => {
    expect(() => encodeQr('방 코드 초대 링크')).not.toThrow();
  });

  it('담을 수 없는 길이는 조용히 자르지 않고 알린다', () => {
    expect(() => encodeQr('x'.repeat(500))).toThrow();
  });

  it('SVG path 가 어두운 칸만큼 사각형을 낸다', () => {
    const g = encodeQr('hi');
    const dark = g.flat().filter(Boolean).length;
    expect(qrSvgPath(g).match(/M/g)).toHaveLength(dark);
  });
});
