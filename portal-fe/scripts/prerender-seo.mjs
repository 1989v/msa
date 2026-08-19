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
  PLACE_BRAND_EN,
  PLACE_BRAND_KO,
  PLACE_ORIGIN,
  PORTAL_BRAND,
  PORTAL_PAGES,
  placeBrand,
  placeHreflangAlternates,
  placeHubMeta,
  placePath,
  placeUrl,
  portalUrl,
  DEAL_ORIGIN,
  DEAL_BRAND,
  DEAL_DISCLOSURE,
  dealHubMeta,
} from '../src/seo/copy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const API_ORIGIN = process.env.SEO_API_ORIGIN || 'https://api.1989v.com';
const LANGS = ['ko', 'en'];
const GENRES = ['DEFENSE', 'ACTION', 'STRATEGY', 'RPG', 'ARCADE', 'PUZZLE', 'VERSUS', 'CASUAL', 'EDUCATION'];

const GAME_HOST = new URL(GAME_ORIGIN).host;
const PORTAL_HOST = new URL(PORTAL_ORIGIN).host;
const PLACE_HOST = new URL(PLACE_ORIGIN).host;

/** TourAPI 지역코드 — 무필터 조회는 상위 10,000건에서 잘리므로 지역으로 잘라 훑는다 */
const AREA_CODES = ['1','2','3','4','5','6','7','8','31','32','33','34','35','36','37','38','39'];
const RESUME_HOST = new URL(RESUME_ORIGIN).host;
const DEAL_HOST = new URL(DEAL_ORIGIN).host;

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
  // 관광지는 sitemap 전용 — 6만 URL 을 정적 HTML 로 찍으면 이미지가 수백 MB 로 불어난다.
  // 라우트(/attractions/:id)와 useSeo 가 있으니 구글은 렌더링 후 색인한다 (ADR-0062).
  let places = { ko: [], en: [] };
  try {
    places = await fetchAttractionIndex();
  } catch (err) {
    console.warn(`[seo] 관광지 색인 조회 실패: ${err.message}`);
  }

  await writeRobotsAndSitemaps(games, places);
  await renderPortalPages(shell);
  await renderPlaceHubs(shell, places);
  await renderDealHub(shell);

  if (games.length === 0) {
    console.warn('[seo] 게임 카탈로그가 비어 게임 프리렌더를 건너뜁니다');
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
      await emit(`prerender/_hosts/${GAME_HOST}.en.html`, hub);
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

function metaTags({ title, description, canonical, lang, image, alternates, jsonLd, noindex, siteName = BRAND }) {
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ko_KR'}" />`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  // 색인은 막되 크롤은 열어 둔다 — robots.txt 로 막으면 크롤러가 이 태그를 읽지 못해
  // URL 만 색인되고, 카카오톡/슬랙/X 언퍼러도 OG 를 못 가져간다.
  if (noindex) lines.push(`<meta name="robots" content="noindex, follow" />`);
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

async function writeRobotsAndSitemaps(games, places = { ko: [], en: [] }) {
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

  const portalEntries = ['/', '/tech', '/portfolio', '/shop'].map((path) => ({
    loc: `${PORTAL_ORIGIN}${path}`,
    priority: path === '/' ? '1.0' : '0.6',
  }));

  // place — 허브만 hreflang 쌍이다. 관광지 상세는 TourAPI 가 국문/영문을 별도 콘텐츠로
  // 관리해 같은 장소라도 id 가 다르므로 짝을 지을 수 없다 (ADR-0062).
  const placeHubEntries = LANGS.map((lang) => ({
    loc: placeUrl(lang),
    priority: '1.0',
    alternates: placeHreflangAlternates(''),
  }));
  const placeDetailEntries = LANGS.flatMap((lang) =>
    (places[lang] ?? []).map((a) => ({
      loc: placeUrl(lang, `/attractions/${a.id}`),
      // 개요가 있는 문서가 순위 경쟁력이 있다 — 크롤 예산을 그쪽으로 기울인다
      priority: a.hasOverview ? '0.7' : '0.4',
    })),
  );

  await emit(`seo/${GAME_HOST}/sitemap.xml`, sitemapXml(gameEntries));
  await emit(`seo/${PORTAL_HOST}/sitemap.xml`, sitemapXml(portalEntries));
  await writePlaceSitemaps(placeHubEntries, placeDetailEntries);

  await emit(`seo/${GAME_HOST}/robots.txt`, robotsTxt(GAME_ORIGIN));
  await emit(`seo/${PORTAL_HOST}/robots.txt`, robotsTxt(PORTAL_ORIGIN));
  await emit(`seo/${PLACE_HOST}/robots.txt`, robotsTxt(PLACE_ORIGIN));
  // 이력서는 색인 대상이 아니다 (ADR-0064). sitemap·llms.txt 도 두지 않는다.
  await emit(`seo/${RESUME_HOST}/robots.txt`, 'User-agent: *\nDisallow: /\n');
  // 혜택 허브는 색인하지 않지만(ADR-0069) **크롤은 연다** — Disallow 로 막으면
  // noindex 태그를 읽지 못해 URL 만 색인되고, 메신저 언퍼러도 OG 카드를 못 만든다.
  // P1 유입이 공유라 OG 가 색인보다 중요하다. sitemap·llms.txt 는 두지 않는다.
  await emit(`seo/${DEAL_HOST}/robots.txt`, dealRobotsTxt());

  await emit(`seo/${GAME_HOST}/llms.txt`, gameLlmsTxt(games));
  await emit(`seo/${PORTAL_HOST}/llms.txt`, portalLlmsTxt());
  await emit(`seo/${PLACE_HOST}/llms.txt`, placeLlmsTxt(places));
}

/** sitemap 은 파일당 50,000 URL 상한이 있다. 넘치면 쪼개고 인덱스로 묶는다. */
const SITEMAP_CHUNK = 20_000;

async function writePlaceSitemaps(hubEntries, detailEntries) {
  const chunks = [];
  for (let i = 0; i < detailEntries.length; i += SITEMAP_CHUNK) {
    chunks.push(detailEntries.slice(i, i + SITEMAP_CHUNK));
  }
  if (chunks.length === 0) {
    await emit(`seo/${PLACE_HOST}/sitemap.xml`, sitemapXml(hubEntries));
    return;
  }

  const files = ['sitemap-places-hub.xml'];
  await emit(`seo/${PLACE_HOST}/sitemap-places-hub.xml`, sitemapXml(hubEntries));
  for (let i = 0; i < chunks.length; i += 1) {
    const name = `sitemap-places-${i + 1}.xml`;
    files.push(name);
    await emit(`seo/${PLACE_HOST}/${name}`, sitemapXml(chunks[i]));
  }
  await emit(`seo/${PLACE_HOST}/sitemap.xml`, sitemapIndexXml(files.map((f) => `${PLACE_ORIGIN}/${f}`)));
  console.log(`[seo] place sitemap ${detailEntries.length} URL · ${files.length} 파일`);
}

function sitemapIndexXml(locs) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locs.map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`),
    '</sitemapindex>',
    '',
  ].join('\n');
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

# 답변형 검색(AEO) — 인용되는 쪽이 이득이라 명시적으로 연다.
# llms.txt 가 각 호스트 루트에 있고, 전체 목록은 sitemap 이 갖는다.
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

async function emit(relativePath, content) {
  const target = resolve(DIST, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

// ─── 관광지 색인 (sitemap 전용) ──────────────────────────────────────────────

/**
 * 관광지 id 를 전부 훑는다.
 *
 * 무필터 조회는 상위 10,000건에서 잘리고(OpenSearch 기본 집계 상한), 지역코드로 자르면
 * 각 조각이 그 아래로 떨어진다. 페이지 크기는 서버가 100 으로 고정한다.
 * 실패한 조각은 건너뛴다 — 일부가 빠진 sitemap 이 sitemap 이 없는 것보다 낫다.
 */
async function fetchAttractionIndex() {
  const result = {};
  for (const lang of LANGS) {
    const byId = new Map();
    const CONCURRENCY = 4;
    for (let i = 0; i < AREA_CODES.length; i += CONCURRENCY) {
      const slices = await Promise.all(
        AREA_CODES.slice(i, i + CONCURRENCY).map((areaCode) => fetchAreaSlice(lang, areaCode)),
      );
      slices.flat().forEach((a) => byId.set(a.id, a));
    }
    result[lang] = [...byId.values()];
    console.log(`[seo] 관광지 ${lang}: ${result[lang].length}건`);
  }
  return result;
}

async function fetchAreaSlice(lang, areaCode) {
  const found = [];
  // from+size 창(10,000) 안에서만 페이징된다 — 100건 × 100페이지
  for (let page = 0; page < 100; page += 1) {
    let data;
    try {
      data = await getJson(`/api/search/attractions?lang=${lang}&areaCode=${areaCode}&size=100&page=${page}`);
    } catch (err) {
      console.warn(`[seo] 관광지 ${lang}/area=${areaCode}/p${page} 실패: ${err.message}`);
      break;
    }
    const items = data.attractions ?? [];
    for (const a of items) {
      found.push({ id: a.id, hasOverview: Boolean((a.overview || '').trim()) });
    }
    if (items.length < 100) break;
  }
  return found;
}

// ─── place · 포털 허브 프리렌더 ──────────────────────────────────────────────

async function renderPlaceHubs(shell, places = { ko: [], en: [] }) {
  for (const lang of LANGS) {
    const meta = placeHubMeta(lang);
    const canonical = placeUrl(lang);
    // 허브에서 관광지 일부로 링크를 뻗어 크롤러가 상세 URL 을 발견할 진입점을 만든다.
    // (sitemap 만 있고 내부 링크가 없는 URL 은 잘 크롤되지 않는다)
    const seeds = (places[lang] ?? []).filter((a) => a.hasOverview).slice(0, 60);
    const links = seeds
      .map((a) => `<li><a href="${placePath(lang, `/attractions/${a.id}`)}">#${a.id}</a></li>`)
      .join('');
    const html = compose(shell, {
      lang,
      ...meta,
      canonical,
      siteName: placeBrand(lang),
      alternates: placeHreflangAlternates(''),
      jsonLd: [collectionPageJsonLd(lang, meta, canonical, { name: placeBrand(lang), url: PLACE_ORIGIN })],
      body: shellBody(
        `<h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p>` +
          (links ? `<ul>${links}</ul>` : ''),
      ),
    });
    await emit(`prerender/_hosts/${PLACE_HOST}${lang === 'en' ? '.en' : ''}.html`, html);
  }
}

/**
 * 혜택 허브 프리렌더 (ADR-0069).
 *
 * 색인 대상이 아닌데도 찍는 이유는 **언퍼러** 때문이다. P1 유입은 SNS·메신저 공유이고,
 * 카카오톡/슬랙/X 는 JS 를 실행하지 않으므로 초기 HTML 에 OG 가 없으면 링크가 맨 URL 로 나간다.
 * 공정위 고지도 함께 심는다 — JS 미실행 방문자에게도 보여야 고지의 의미가 있다.
 */
async function renderDealHub(shell) {
  const meta = dealHubMeta();
  const html = compose(shell, {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    siteName: DEAL_BRAND,
    noindex: true,
    body: shellBody(
      `<h1>${escapeHtml(DEAL_BRAND)}</h1><p>${escapeHtml(meta.description)}</p>` +
        `<p>${escapeHtml(DEAL_DISCLOSURE)}</p>`,
    ),
  });
  await emit(`prerender/_hosts/${DEAL_HOST}.html`, html);
}

/**
 * 혜택 허브 robots — sitemap 도 llms.txt 도 걸지 않는다.
 * 색인 차단은 meta/X-Robots-Tag 가 하고, 여기서는 크롤을 열어 그 태그가 읽히게 한다.
 */
function dealRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /go/

`;
}

async function renderPortalPages(shell) {
  const nav = Object.keys(PORTAL_PAGES)
    .map((path) => `<a href="${path}">${escapeHtml(PORTAL_PAGES[path].title.split(' — ')[0])}</a>`)
    .join(' · ');
  for (const [path, meta] of Object.entries(PORTAL_PAGES)) {
    const canonical = portalUrl(path);
    const html = compose(shell, {
      lang: 'ko',
      title: meta.title,
      description: meta.description,
      canonical,
      siteName: PORTAL_BRAND,
      jsonLd: path === '/' ? [websiteJsonLd()] : [],
      body: shellBody(
        `<h1>${escapeHtml(meta.title.split(' — ')[0])}</h1><p>${escapeHtml(meta.description)}</p>` +
          `<nav>${nav}</nav>` +
          `<p><a href="${GAME_ORIGIN}">무료 웹게임</a> · <a href="${PLACE_ORIGIN}">한국 관광지 검색</a></p>`,
      ),
    });
    // 루트만 호스트 키로 — 같은 번들이 game/place 호스트도 서빙하므로 / 는 호스트로 갈린다
    await emit(path === '/' ? `prerender/_hosts/${PORTAL_HOST}.html` : `prerender${path}.html`, html);
  }
}

// ─── llms.txt (AEO) ─────────────────────────────────────────────────────────

/**
 * 답변형 검색·LLM 이 사이트를 요약할 때 읽는 진입 문서.
 * sitemap 이 "전부"를 담당하고, 여기는 "무엇을 어디서 보면 되는지"만 짧게 적는다.
 */
function gameLlmsTxt(games) {
  const lines = [
    `# ${BRAND}`,
    '',
    `> 설치도 가입도 없이 브라우저에서 바로 실행되는 무료 웹게임 ${games.length}종. 개인이 직접 만들어 운영한다.`,
    '',
    '## 시작점',
    `- [게임 허브 (한국어)](${GAME_ORIGIN}/)`,
    `- [Game hub (English)](${GAME_ORIGIN}/en)`,
    `- [전체 URL 목록](${GAME_ORIGIN}/sitemap.xml)`,
    '',
    '## 장르',
    ...GENRES.filter((genre) => games.some((g) => g.genre === genre)).map(
      (genre) =>
        `- [${genreLabelOf(genre, 'ko')} / ${genreLabelOf(genre, 'en')}](${gameUrl('ko', `/games/genre/${genreSlug(genre)}`)})`,
    ),
    '',
    '## 게임',
  ];
  for (const game of games) {
    const desc = (game.description || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    lines.push(`- [${titleOf(game, 'ko')}](${gameUrl('ko', `/games/${game.slug}`)}): ${desc}`);
  }
  lines.push('');
  return lines.join('\n');
}

function placeLlmsTxt(places) {
  return [
    `# ${PLACE_BRAND_EN} (${PLACE_BRAND_KO})`,
    '',
    '> 한국관광공사 TourAPI 데이터로 만든 한국 관광지 검색. 지역·테마·현재 위치로 찾고 지도·사진·주소를 함께 본다.',
    '',
    '## 시작점',
    `- [한국어 허브](${PLACE_ORIGIN}/)`,
    `- [English hub](${PLACE_ORIGIN}/en)`,
    `- [전체 URL 목록 (sitemap index)](${PLACE_ORIGIN}/sitemap.xml)`,
    '',
    '## 데이터',
    `- 관광지 상세: 국문 ${(places.ko ?? []).length}건 · 영문 ${(places.en ?? []).length}건`,
    `- 상세 주소 형식: ${PLACE_ORIGIN}/attractions/{id} (영문 ${PLACE_ORIGIN}/en/attractions/{id})`,
    '- 국문과 영문은 TourAPI 가 별도 콘텐츠로 관리해 같은 장소라도 id 가 다르다',
    '- 출처: 한국관광공사 TourAPI (공공데이터)',
    '',
    '## 공개 API',
    `- 검색: ${API_ORIGIN}/api/search/attractions?lang=ko&keyword={검색어}`,
    `- 상세: ${API_ORIGIN}/api/search/attractions/{id}`,
    '',
  ].join('\n');
}

function portalLlmsTxt() {
  return [
    `# ${PORTAL_BRAND}`,
    '',
    '> 백엔드 엔지니어 권기덕이 직접 설계·구현하고 운영 중인 서비스 모음. 커머스 MSA 플랫폼을 기반으로 관광 검색, 웹 게임, 코드 개념 사전을 함께 서비스한다.',
    '',
    '## 서비스',
    `- [한국 관광지 검색](${PLACE_ORIGIN}/): TourAPI 기반 관광지 검색 · 지도 탐색`,
    `- [무료 웹게임](${GAME_ORIGIN}/): 설치 없이 브라우저에서 실행되는 웹게임 아케이드`,
    `- [IT 개념 사전](${PORTAL_ORIGIN}/tech): 코드베이스에서 추출한 개념을 트리맵·그래프로 탐색`,
    `- [포트폴리오](${PORTAL_ORIGIN}/portfolio): 검색·전시·커머스·인프라·AI 도메인에서 만든 것들`,
    `- [스토어 데모](${PORTAL_ORIGIN}/shop): MSA 커머스 플랫폼 데모 (검색·추천·주문)`,
    '',
    '## 참고',
    `- 각 서비스 호스트마다 별도 sitemap 과 llms.txt 가 있다`,
    `- [전체 URL 목록](${PORTAL_ORIGIN}/sitemap.xml)`,
    '',
  ].join('\n');
}
