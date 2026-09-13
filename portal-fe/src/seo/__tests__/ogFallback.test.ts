import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 게임 폴백 카드의 두 규칙을 **파일 시스템으로** 검사한다 — 선언과 실물이 어긋나면 언퍼러는
 * 깨진 카드를 그리고, 폴백이 전용 아트를 덮으면 그린 사람의 일이 사라진다.
 *
 * 경로는 프리렌더(scripts/prerender-seo.mjs 의 ogImageUrl 판정)와 같아야 한다.
 */
const PUBLIC = resolve(__dirname, '../../../public');
const ART_DIR = resolve(PUBLIC, 'games/thumbs/og');
const FALLBACK_DIR = resolve(PUBLIC, 'og/games');

describe('게임 소셜 카드 — 전용 아트와 폴백', () => {
  it('폴백 카드는 전용 아트가 없는 게임에만 있다 — 둘 다 있으면 어느 쪽이 이기는지 사람이 헷갈린다', () => {
    if (!existsSync(FALLBACK_DIR)) return;
    const fallbacks = readdirSync(FALLBACK_DIR).filter((f) => f.endsWith('.png'));
    const shadowed = fallbacks.filter((f) => existsSync(resolve(ART_DIR, f)));
    expect(shadowed, `전용 아트가 생겼으니 폴백을 지워야 한다: ${shadowed.join(', ')}`).toEqual([]);
  });

  it('폴백 카드는 1200×630 이다 — 작은 카드를 large_image 로 선언하면 뭉개진다', () => {
    if (!existsSync(FALLBACK_DIR)) return;
    for (const f of readdirSync(FALLBACK_DIR).filter((x) => x.endsWith('.png'))) {
      const buf = require('node:fs').readFileSync(resolve(FALLBACK_DIR, f));
      // PNG IHDR: 16..24 바이트가 폭·높이 (big-endian)
      const w = buf.readUInt32BE(16);
      const h = buf.readUInt32BE(20);
      expect([w, h], f).toEqual([1200, 630]);
    }
  });
});
