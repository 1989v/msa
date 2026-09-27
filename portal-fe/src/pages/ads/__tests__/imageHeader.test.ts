import { describe, expect, it } from 'vitest';
import { fitsRatio, inspectUpload, readImageHeader } from '../imageHeader';
import { imageFile, jpegBytes, pngBytes } from './imageFixtures';

const RULES = { fileTypes: ['image/png', 'image/jpeg'], maxBytes: 300 * 1024, maxDimension: 2000, aspectTolerance: 0.01 };

describe('readImageHeader — 풀지 않고 헤더에서', () => {
  it('PNG 는 IHDR, JPEG 는 SOF 에서 가로·세로를 읽는다', () => {
    expect(readImageHeader(pngBytes(1280, 200))).toEqual({ kind: 'PNG', width: 1280, height: 200 });
    expect(readImageHeader(jpegBytes(1200, 628))).toEqual({ kind: 'JPEG', width: 1200, height: 628 });
  });

  it('서명이 없으면 형식을 모른다', () => {
    expect(readImageHeader(new TextEncoder().encode('GIF89a......................'))).toBeNull();
  });

  it('비율 허용 오차는 서버와 같은 상대 오차다 — 1200×628 은 1.91:1, 6.4:1 은 아니다', () => {
    expect(fitsRatio(1200, 628, '1.91:1', 0.01)).toBe(true);
    expect(fitsRatio(1200, 628, '6.4:1', 0.01)).toBe(false);
    expect(fitsRatio(1280, 200, '6.4:1', 0.01)).toBe(true);
  });
});

describe('inspectUpload — 항목별 판정', () => {
  it('헤더 폭탄(20000×3125, 몇십 바이트)은 비율이 맞아도 가로·세로에서 거절된다', async () => {
    const result = await inspectUpload(imageFile(pngBytes(20000, 3125), 'bomb.png'), RULES, [['6.4:1']]);
    const byKey = Object.fromEntries(result.checks.map((c) => [c.key, c]));
    expect(result.ok).toBe(false);
    expect(byKey.dimension).toMatchObject({ ok: false, actual: '20000×3125' });
    expect(byKey.ratio.ok).toBe(true);
    expect(byKey.bytes.ok).toBe(true);
  });

  it('모든 타기팅 지면의 규격에 맞아야 한다', async () => {
    const file = imageFile(pngBytes(1280, 200), 'strip.png');
    expect((await inspectUpload(file, RULES, [['6.4:1'], ['6.4:1']])).ok).toBe(true);
    expect((await inspectUpload(file, RULES, [['6.4:1'], ['1.91:1']])).ok).toBe(false);
  });
});
