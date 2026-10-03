// @vitest-environment node
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { retainAssets } from '../scripts/retain-assets.mjs';

/** 디렉터리에 빈 파일들을 만든다 */
function put(dir: string, names: string[]) {
  mkdirSync(dir, { recursive: true });
  for (const n of names) writeFileSync(join(dir, n), n);
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'retain-'));
  return { prev: join(root, 'prev'), dist: join(root, 'dist', 'assets'), out: join(root, 'releases') };
}

describe('retainAssets — 직전 이미지의 해시 자산을 최근 릴리스만큼 새 빌드에 합친다', () => {
  it('목록이 없는 직전 이미지는 그 assets 전체를 한 릴리스로 보고 가져온다', () => {
    const d = setup();
    put(join(d.prev, 'assets'), ['index-OLD.js', 'shared-SAME.js']);
    put(d.dist, ['index-NEW.js', 'shared-SAME.js']);

    const r = retainAssets({ prevDir: d.prev, distAssets: d.dist, releasesOut: d.out, release: 'abc1234', now: 2_000_000_000_000 });

    expect(readdirSync(d.dist).sort()).toEqual(['index-NEW.js', 'index-OLD.js', 'shared-SAME.js']);
    expect(r).toEqual({ releases: 2, copied: 1, missing: 0 });
    expect(readdirSync(d.out).sort()).toEqual(['0-bootstrap.txt', '2000000000-abc1234.txt']);
    expect(readFileSync(join(d.out, '2000000000-abc1234.txt'), 'utf8').split('\n').filter(Boolean).sort()).toEqual([
      'index-NEW.js',
      'shared-SAME.js',
    ]);
  });

  it('최근 keep-1 개 목록만 남기고, 밀려난 릴리스에만 있던 파일은 가져오지 않는다', () => {
    const d = setup();
    put(join(d.prev, 'assets'), ['r1.js', 'r2.js', 'r3.js']);
    mkdirSync(join(d.prev, 'asset-releases'), { recursive: true });
    // 이름순이 아니라 앞의 시각순 — 9 가 10 보다 먼저다
    writeFileSync(join(d.prev, 'asset-releases', '9-r1.txt'), 'r1.js\n');
    writeFileSync(join(d.prev, 'asset-releases', '10-r2.txt'), 'r2.js\n');
    writeFileSync(join(d.prev, 'asset-releases', '11-r3.txt'), 'r3.js\nr-gone.js\n');
    put(d.dist, ['r4.js']);

    const r = retainAssets({ prevDir: d.prev, distAssets: d.dist, releasesOut: d.out, release: 'r4', now: 12_000, keep: 3 });

    expect(readdirSync(d.dist).sort()).toEqual(['r2.js', 'r3.js', 'r4.js']);
    expect(readdirSync(d.out).sort()).toEqual(['10-r2.txt', '11-r3.txt', '12-r4.txt']);
    expect(r).toEqual({ releases: 3, copied: 2, missing: 1 });
  });

  it('직전 이미지가 없으면(로컬·첫 빌드) 이번 목록만 남긴다', () => {
    const d = setup();
    put(d.dist, ['index-NEW.js']);

    const r = retainAssets({ prevDir: d.prev, distAssets: d.dist, releasesOut: d.out, release: 'dev', now: 5_000 });

    expect(readdirSync(d.dist)).toEqual(['index-NEW.js']);
    expect(readdirSync(d.out)).toEqual(['5-dev.txt']);
    expect(r).toEqual({ releases: 1, copied: 0, missing: 0 });
  });
});
