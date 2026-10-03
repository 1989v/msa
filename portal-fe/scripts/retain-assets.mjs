/**
 * 직전 이미지의 `/assets` 를 새 빌드에 합친다 — 최근 릴리스 몇 개 몫만.
 *
 * 파일명에 해시가 붙어 배포마다 이름이 바뀌는데, 이미지에는 이번 빌드 것만 들어 있었다. 그래서 배포 순간
 * 옛 이름을 들고 있는 곳이 전부 404 를 받았다 — 서버 렌더가 5분 캐시하는 셸(관광지·블로그 상세),
 * 롤링 업데이트 중 옛 파드와 새 파드가 섞인 구간, 배포 전에 열어 둔 탭이 나중에 받는 청크.
 *
 * 릴리스마다 「이 빌드가 만든 파일 목록」을 남기고(`<epoch>-<release>.txt`), 다음 빌드는 최근 목록
 * KEEP-1 개에 든 파일만 직전 이미지에서 가져온다. 목록이 없는 직전 이미지(이 장치 이전)는 그 `/assets`
 * 전체를 목록 하나로 친다. 목록으로 자르므로 옛 파일이 이미지마다 끝없이 쌓이지 않는다.
 *
 * 사용: node scripts/retain-assets.mjs <prevDir> <distAssetsDir> <releasesOutDir> <release>
 *   prevDir 아래 `assets/`·`asset-releases/` 를 읽는다. 없으면(로컬 빌드·첫 빌드) 이번 목록만 남긴다.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 이번 릴리스를 포함해 남길 릴리스 수 */
export const KEEP = 10;

const files = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()) : []);
const epochOf = (name) => Number.parseInt(name, 10) || 0;

export function retainAssets({ prevDir, distAssets, releasesOut, release, now = Date.now(), keep = KEEP }) {
  const prevAssets = join(prevDir, 'assets');
  const prevLists = join(prevDir, 'asset-releases');
  let lists = files(prevLists)
    .filter((f) => f.endsWith('.txt'))
    .map((name) => ({ name, files: readFileSync(join(prevLists, name), 'utf8').split('\n').filter(Boolean) }));
  if (lists.length === 0 && existsSync(prevAssets)) lists = [{ name: '0-bootstrap.txt', files: files(prevAssets) }];
  lists.sort((a, b) => epochOf(a.name) - epochOf(b.name) || a.name.localeCompare(b.name));
  const kept = lists.slice(Math.max(0, lists.length - (keep - 1)));

  const current = files(distAssets);
  const have = new Set(current);
  let copied = 0;
  let missing = 0;
  for (const name of new Set(kept.flatMap((l) => l.files))) {
    if (have.has(name)) continue;
    const src = join(prevAssets, name);
    if (!existsSync(src)) {
      missing++;
      continue;
    }
    copyFileSync(src, join(distAssets, name));
    have.add(name);
    copied++;
  }

  mkdirSync(releasesOut, { recursive: true });
  for (const l of kept) writeFileSync(join(releasesOut, l.name), `${l.files.join('\n')}\n`);
  writeFileSync(join(releasesOut, `${Math.floor(now / 1000)}-${release}.txt`), `${current.join('\n')}\n`);
  return { releases: kept.length + 1, copied, missing };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [prevDir, distAssets, releasesOut, release] = process.argv.slice(2);
  const r = retainAssets({ prevDir, distAssets, releasesOut, release: release || 'dev' });
  console.log(`[retain-assets] 릴리스 ${r.releases}개 몫 유지 — 옛 파일 ${r.copied}개 복사, 목록에 있으나 없는 파일 ${r.missing}개`);
}
