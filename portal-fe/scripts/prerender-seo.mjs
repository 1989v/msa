/**
 * 빌드 후 SEO 정적 자산 생성기.
 *
 * portal-fe 는 CSR SPA 라 초기 HTML 에 게임 정보가 전혀 없다. 구글은 JS 를 실행해 주지만
 * 네이버(Yeti)·다음(Daumoa)·카카오톡/슬랙/X 언퍼러는 실행하지 않는다. 그래서 `vite build`
 * 산출물의 index.html 을 틀로 삼아 게임 페이지별 메타·본문을 심은 정적 HTML 을 미리 찍어둔다.
 * 자산(script/link) 태그는 index.html 것을 그대로 물려받으므로 SPA 는 정상 부팅한다.
 *
 * API 가 닿지 않으면 프리렌더는 건너뛰고 robots/sitemap 만 남긴 뒤 성공으로 끝낸다 —
 * SEO 자산 때문에 이미지 빌드가 깨지면 안 된다.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND,
  GAME_ORIGIN,
  PORTAL_ORIGIN,
  RESUME_ORIGIN,
  breadcrumbJsonLd,
  collectionPageJsonLd,
  detailMeta,
  gamePath,
  gameUrl,
  genreLabelOf,
  genreMeta,
  genreSlug,
  hreflangAlternates,
  hubMeta,
  itemListJsonLd,
  socialImage,
  titleOf,
  videoGameJsonLd,
  websiteJsonLd,
} from '../src/seo/copy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const API_ORIGIN = process.env.SEO_API_ORIGIN || 'https://api.1989v.com';
const LANGS = ['ko', 'en'];
const GENRES = ['DEFENSE', 'ACTION', 'STRATEGY', 'RPG', 'ARCADE', 'PUZZLE', 'VERSUS', 'CASUAL', 'EDUCATION'];

const GAME_HOST = new URL(GAME_ORIGIN).host;
const PORTAL_HOST = new URL(PORTAL_ORIGIN).host;
const RESUME_HOST = new URL(RESUME_ORIGIN).host;

main().catch((err) => {
  console.warn(`[seo] 프리렌더 실패 — SPA 만 배포됩니다: ${err.message}`);
  process.exit(0);
});

async function main() {
  const shell = await readFile(resolve(DIST, 'index.html'), 'utf8');
  if (!shell.includes('<!--seo:start-->')) {
    throw new Error('index.html 에 <!--seo:start--> 마커가 없습니다');
  }

  // 카탈로그를 못 받아도 robots/sitemap 은 남긴다 — 포털 색인까지 같이 죽으면 안 된다
  let games = [];
  try {
    games = await fetchCatalog();
  } catch (err) {
    console.warn(`[seo] 게임 카탈로그 조회 실패 (${API_ORIGIN}): ${err.message}`);
  }
  await writeRobotsAndSitemaps(games);

  if (games.length === 0) {
    console.warn('[seo] 게임 카탈로그가 비어 프리렌더를 건너뜁니다');
    return;
  }

  let count = 0;
  for (const lang of LANGS) {
    const hub = renderHub(shell, lang, games);
    // /(게임 호스트 루트) · /games · /en · /en/games — 모두 같은 허브, canonical 은 하나
    if (lang === 'ko') {
      await emit(`prerender/_hosts/${GAME_HOST}.html`, hub);
      await emit('prerender/games/index.html', hub);
    } else {
      await emit('prerender/en/index.html', hub);
      await emit('prerender/en/games/index.html', hub);
    }
    count += 2;

    const prefix = lang === 'en' ? 'prerender/en' : 'prerender';
    for (const genre of GENRES) {
      const inGenre = games.filter((g) => g.genre === genre);
      if (inGenre.length === 0) continue;
      await emit(`${prefix}/games/genre/${genreSlug(genre)}.html`, renderGenre(shell, lang, genre, inGenre, games));
      count += 1;
    }
    for (const game of games) {
      await emit(`${prefix}/games/${game.slug}.html`, renderDetail(shell, lang, game, games));
      count += 1;
    }
  }
  console.log(`[seo] 프리렌더 ${count}개 페이지 · 게임 ${games.length}종 (${API_ORIGIN})`);
}

// ─── 카탈로그 ────────────────────────────────────────────────────────────────

async function getJson(path) {
  const res = await fetch(`${API_ORIGIN}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(`GET ${path} → ${body.error?.code}`);
  return body.data;
}

/** 목록(요약) + 상세(설명·갱신시각)를 합쳐 프리렌더에 필요한 필드를 모두 채운다 */
async function fetchCatalog() {
  const page = await getJson('/api/v1/games?sort=new&page=0&size=300');
  const summaries = page.content ?? [];
  const details = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < summaries.length; i += CONCURRENCY) {
    const chunk = await Promise.all(
      summaries.slice(i, i + CONCURRENCY).map((s) =>
        getJson(`/api/v1/games/${s.slug}`).catch((err) => {
          console.warn(`[seo] ${s.slug} 상세 조회 실패 — 요약으로 대체: ${err.message}`);
          return { ...s, description: '', descriptionEn: null };
        }),
      ),
    );
    details.push(...chunk);
  }
  return details;
}

/** 태그 교집합 → 같은 장르 순으로 관련 게임 (상세 페이지 내부 링크용) */
function relatedGames(game, games, limit = 6) {
  const tags = new Set(game.tags ?? []);
  return games
    .filter((g) => g.slug !== game.slug)
    .map((g) => ({
      game: g,
      score: (g.tags ?? []).filter((t) => tags.has(t)).length + (g.genre === game.genre ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.game.playCount - a.game.playCount)
    .slice(0, limit)
    .map((x) => x.game);
}

// ─── HTML 조립 ───────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function metaTags({ title, description, canonical, lang, image, alternates, jsonLd }) {
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ko_KR'}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (image) {
    lines.push(`<meta property="og:image" content="${image}" />`);
    lines.push(`<meta name="twitter:image" content="${image}" />`);
  }
  for (const alt of alternates ?? []) {
    lines.push(`<link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />`);
  }
  for (const data of jsonLd ?? []) {
    // </script> 가 JSON 문자열에 섞이면 파서가 조기 종료된다
    lines.push(
      `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
    );
  }
  return lines.join('\n    ');
}

function compose(shell, { lang, body, ...meta }) {
  return shell
    .replace('<html lang="ko">', `<html lang="${lang}">`)
    .replace(
      /<!--seo:start-->[\s\S]*?<!--seo:end-->/,
      `<!--seo:prerendered-->\n    ${metaTags({ lang, ...meta })}`,
    )
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

/**
 * SPA 가 마운트되면 통째로 교체되는 임시 본문. 크롤러·JS 미실행 방문자에게
 * 실제 텍스트와 내부 링크를 보여주는 것이 목적이라 스타일은 최소로만 준다.
 */
function shellBody(inner) {
  return `<div style="max-width:1080px;margin:0 auto;padding:32px 20px;color:#dce4f5;font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif">${inner}</div>`;
}

function gameLinkList(lang, games) {
  const items = games
    .map(
      (g) =>
        `<li><a href="${gamePath(lang, `/games/${g.slug}`)}">${escapeHtml(titleOf(g, lang))}</a> · ${escapeHtml(genreLabelOf(g.genre, lang))}</li>`,
    )
    .join('');
  return `<ul>${items}</ul>`;
}

function genreNav(lang, games) {
  const links = GENRES.filter((genre) => games.some((g) => g.genre === genre))
    .map(
      (genre) =>
        `<a href="${gamePath(lang, `/games/genre/${genreSlug(genre)}`)}">${escapeHtml(genreLabelOf(genre, lang))}</a>`,
    )
    .join(' · ');
  return `<nav aria-label="${lang === 'en' ? 'Genres' : '장르'}">${links}</nav>`;
}

function renderHub(shell, lang, games) {
  const meta = hubMeta(lang, games.length);
  const canonical = gameUrl(lang);
  return compose(shell, {
    lang,
    ...meta,
    canonical,
    alternates: hreflangAlternates(''),
    jsonLd: [
      collectionPageJsonLd(lang, meta, canonical),
      itemListJsonLd(lang, games.slice(0, 30)),
      websiteJsonLd(),
    ],
    body: shellBody(
      `<h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p>` +
        genreNav(lang, games) +
        gameLinkList(lang, games),
    ),
  });
}

function renderGenre(shell, lang, genre, inGenre, allGames) {
  const meta = genreMeta(lang, genre, inGenre);
  const canonical = gameUrl(lang, `/games/genre/${genreSlug(genre)}`);
  return compose(shell, {
    lang,
    ...meta,
    canonical,
    alternates: hreflangAlternates(`/games/genre/${genreSlug(genre)}`),
    jsonLd: [
      collectionPageJsonLd(lang, meta, canonical),
      itemListJsonLd(lang, inGenre),
      breadcrumbJsonLd(lang, [
        { name: lang === 'en' ? 'Games' : '게임', url: gameUrl(lang) },
        { name: meta.heading, url: canonical },
      ]),
    ],
    body: shellBody(
      `<h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p>` +
        genreNav(lang, allGames) +
        gameLinkList(lang, inGenre),
    ),
  });
}

function renderDetail(shell, lang, game, games) {
  const meta = detailMeta(lang, game);
  const canonical = gameUrl(lang, `/games/${game.slug}`);
  const related = relatedGames(game, games);
  const genreHref = gamePath(lang, `/games/genre/${genreSlug(game.genre)}`);
  const rating =
    game.ratingCount > 0
      ? `<p>★ ${Number(game.ratingAvg).toFixed(1)} / 10 (${game.ratingCount}${lang === 'en' ? ' ratings' : '표'})</p>`
      : '';
  const play = game.entryUrl?.startsWith('/')
    ? `<p><a href="${game.entryUrl}">${lang === 'en' ? `Play ${escapeHtml(titleOf(game, lang))}` : `${escapeHtml(titleOf(game, lang))} 플레이하기`}</a></p>`
    : '';
  return compose(shell, {
    lang,
    ...meta,
    canonical,
    image: socialImage(game),
    alternates: hreflangAlternates(`/games/${game.slug}`),
    jsonLd: [
      videoGameJsonLd(lang, game),
      breadcrumbJsonLd(lang, [
        { name: lang === 'en' ? 'Games' : '게임', url: gameUrl(lang) },
        { name: genreLabelOf(game.genre, lang), url: gameUrl(lang, `/games/genre/${genreSlug(game.genre)}`) },
        { name: meta.heading, url: canonical },
      ]),
    ],
    body: shellBody(
      `<nav><a href="${gamePath(lang, '')}">${lang === 'en' ? 'Games' : '게임'}</a> › ` +
        `<a href="${genreHref}">${escapeHtml(genreLabelOf(game.genre, lang))}</a></nav>` +
        `<h1>${escapeHtml(meta.heading)}</h1>` +
        `<p>${escapeHtml(meta.description)}</p>` +
        rating +
        play +
        (related.length
          ? `<h2>${lang === 'en' ? 'More Games Like This' : '비슷한 게임 더 보기'}</h2>${gameLinkList(lang, related)}`
          : ''),
    ),
  });
}

// ─── robots · sitemap ───────────────────────────────────────────────────────

function isoDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

function urlEntry({ loc, lastmod, priority, alternates }) {
  const parts = [`    <loc>${loc}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  for (const alt of alternates ?? []) {
    parts.push(`    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" />`);
  }
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

function sitemapXml(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(urlEntry),
    '</urlset>',
    '',
  ].join('\n');
}

async function writeRobotsAndSitemaps(games) {
  const gameEntries = [];
  for (const lang of LANGS) {
    gameEntries.push({
      loc: gameUrl(lang),
      priority: '1.0',
      alternates: hreflangAlternates(''),
    });
    for (const genre of GENRES) {
      if (!games.some((g) => g.genre === genre)) continue;
      const sub = `/games/genre/${genreSlug(genre)}`;
      gameEntries.push({ loc: gameUrl(lang, sub), priority: '0.8', alternates: hreflangAlternates(sub) });
    }
    for (const game of games) {
      const sub = `/games/${game.slug}`;
      gameEntries.push({
        loc: gameUrl(lang, sub),
        lastmod: isoDate(game.contentUpdatedAt || game.releasedAt),
        priority: '0.7',
        alternates: hreflangAlternates(sub),
      });
    }
  }

  const portalEntries = ['/', '/portfolio', '/shop'].map((path) => ({
    loc: `${PORTAL_ORIGIN}${path}`,
    priority: path === '/' ? '1.0' : '0.6',
  }));

  await emit(`seo/${GAME_HOST}/sitemap.xml`, sitemapXml(gameEntries));
  await emit(`seo/${PORTAL_HOST}/sitemap.xml`, sitemapXml(portalEntries));
  await emit(`seo/${GAME_HOST}/robots.txt`, robotsTxt(GAME_ORIGIN));
  await emit(`seo/${PORTAL_HOST}/robots.txt`, robotsTxt(PORTAL_ORIGIN));
  // 이력서는 색인 대상이 아니다 (ADR-0064). sitemap 도 두지 않는다.
  await emit(`seo/${RESUME_HOST}/robots.txt`, 'User-agent: *\nDisallow: /\n');
}

function robotsTxt(origin) {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /oauth/
Disallow: /admin/
Disallow: /shop/login
Disallow: /shop/orders

# /games/<slug>/index.html 은 상세 페이지가 iframe 으로 물고 있는 원시 게임 프레임이다.
# nginx 가 X-Robots-Tag: noindex 를 붙이므로 크롤은 열어둬야 그 헤더를 읽을 수 있다.

User-agent: Yeti
Allow: /

User-agent: Daumoa
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

async function emit(relativePath, content) {
  const target = resolve(DIST, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}
