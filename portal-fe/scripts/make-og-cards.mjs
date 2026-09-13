/**
 * 소셜 카드(og:image) 굽기 — `scripts/og-card.html` 을 1200×630 PNG 로 찍는다.
 *
 * **빌드 경로에 넣지 않는다.** 굽는 데 크롬이 필요한데 CI 러너(arm64 무료 티어)에 브라우저를
 * 얹으면 이미지 빌드가 그만큼 무거워지고, 카드는 문구가 바뀔 때만 다시 구우면 되는 물건이다.
 * 그래서 손으로 돌리고 결과 PNG 를 커밋한다.
 *
 *   node scripts/make-og-cards.mjs [--chrome <경로>] [--no-games]
 *
 * 결과: portal-fe/public/og/<key>.png · public/og/games/<slug>.png (전용 아트 없는 게임)
 *
 * 게임 폴백 카드는 **전용 아트가 없는 게임에만** 굽는다. 아트(`public/games/thumbs/og/`)는
 * 게임 서브모듈에 살고 폴백은 여기 사이트에 산다 — 아트가 들어오면 프리렌더가 그쪽을 먼저
 * 집으므로 폴백은 저절로 진다. 카탈로그는 운영 API 에서 받는다(손으로 돌리는 스크립트라
 * 네트워크가 있다).
 *
 * 카드 목록은 여기 한 곳이다 — copy.mjs 의 `ogCardUrl()` 이 같은 key 로 주소를 만든다.
 * 한쪽만 늘리면 있지도 않은 이미지를 og:image 로 선언하게 되고, 언퍼러는 그걸 **카드 없음**이
 * 아니라 **깨진 카드**로 그린다.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { GAME_ORIGIN, genreLabelOf, titleOf } from '../src/seo/copy.mjs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = resolve(ROOT, 'scripts/og-card.html');
const OUT_DIR = resolve(ROOT, 'public/og');

/** @type {Array<{key: string, label: string, title: string, sub: string, host: string, seal?: string, tone?: 'hanji'|'giwa'}>} */
export const CARDS = [
  {
    key: 'portal',
    label: '1989v',
    title: '직접 만들고 *운영하는* 서비스들',
    sub: '한국 관광 검색 · 웹 게임 · 블로그 · 랭킹 · 코드 개념 사전',
    host: '1989v.com',
  },
  {
    key: 'blog',
    label: 'Blog',
    title: '만들고 겪은 것을 *기록합니다*',
    sub: '서버·검색·데이터부터 취미와 일상까지',
    host: 'blog.1989v.com',
    tone: 'giwa',
  },
  {
    key: 'rank',
    label: 'Ranking',
    title: '무엇이든 *줄 세워* 봅니다',
    sub: '지역별 최저가 주유소 — 집계와 지난주 대비 등락',
    host: 'rank.1989v.com',
  },
  {
    key: 'deal',
    label: 'Deals',
    title: '흩어진 혜택을 *한자리에*',
    sub: '카테고리별 혜택 링크 큐레이션',
    host: 'deal.1989v.com',
  },
  {
    key: 'place',
    label: 'K-Tourism',
    title: '전국 *가볼 만한 곳*',
    sub: '한국관광공사 공식 데이터로 지역·테마·내 주변 검색',
    host: 'place.1989v.com',
    tone: 'giwa',
  },
];

const CHROME =
  arg('--chrome') ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
}

function cardUrl(card) {
  const q = new URLSearchParams({
    label: card.label,
    title: card.title,
    sub: card.sub,
    host: card.host,
    ...(card.seal ? { seal: card.seal } : {}),
    ...(card.tone ? { tone: card.tone } : {}),
  });
  return `${pathToFileURL(TEMPLATE).href}?${q}`;
}

/**
 * 헤드리스 크롬으로 한 장 찍는다.
 *
 * `--screenshot` 은 뷰포트만 찍으므로 `--window-size` 가 곧 카드 크기다.
 * `--hide-scrollbars` 가 없으면 오른쪽에 스크롤바 자리가 흰 띠로 남는다.
 */
function shoot(url, out) {
  return new Promise((res, rej) => {
    const p = spawn(CHROME, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      `--screenshot=${out}`,
      url,
    ]);
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`chrome exit ${code}: ${err.slice(-400)}`))));
  });
}

const API_ORIGIN = process.env.SEO_API_ORIGIN || 'https://api.1989v.com';
const GAME_HOST = new URL(GAME_ORIGIN).host;

/** 전용 아트가 없는 게임의 타이포 폴백 카드 명세 */
function gameCard(game) {
  return {
    key: `games/${game.slug}`,
    label: genreLabelOf(game.genre, 'ko'),
    title: titleOf(game, 'ko'),
    sub: '설치도 가입도 없이 브라우저에서 바로 — 무료 웹게임',
    host: GAME_HOST,
    tone: 'ink',
  };
}

async function gamesWithoutArt() {
  const res = await fetch(`${API_ORIGIN}/api/v1/games?sort=new&page=0&size=300`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`games → ${res.status}`);
  const games = (await res.json()).data?.content ?? [];
  return games.filter((g) => !existsSync(resolve(ROOT, 'public/games/thumbs/og', `${g.slug}.png`)));
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  for (const card of CARDS) {
    const out = resolve(OUT_DIR, `${card.key}.png`);
    await shoot(cardUrl(card), out);
    console.log(`[og] ${card.key}.png`);
  }
  const bakedGames = [];
  if (!process.argv.includes('--no-games')) {
    await mkdir(resolve(OUT_DIR, 'games'), { recursive: true });
    for (const game of await gamesWithoutArt()) {
      const card = gameCard(game);
      await shoot(cardUrl(card), resolve(OUT_DIR, `${card.key}.png`));
      bakedGames.push(game.slug);
      console.log(`[og] ${card.key}.png (폴백)`);
    }
  }
  // 목록을 파일로도 남긴다 — 무엇이 있어야 하는지 사람이 눈으로 대조할 자리
  await writeFile(
    resolve(OUT_DIR, 'README.md'),
    `# 소셜 카드\n\n\`scripts/make-og-cards.mjs\` 가 구운 것이다. 손으로 고치지 않는다.\n\n` +
      CARDS.map((c) => `- \`${c.key}.png\` — ${c.host}`).join('\n') +
      '\n\n## 게임 폴백\n\n전용 아트(`public/games/thumbs/og/`)가 없는 게임에만 굽는다. 아트가 들어오면 그쪽이 이긴다.\n\n' +
      bakedGames.map((slug) => `- \`games/${slug}.png\``).join('\n') +
      '\n',
  );
  console.log(`[og] 호스트 ${CARDS.length}장 · 게임 폴백 ${bakedGames.length}장 · ${OUT_DIR}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
