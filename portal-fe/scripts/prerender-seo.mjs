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
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  attractionMeta,
  attractionPath,
  attractionUrl,
  placeCategoryLabel,
  placeItemListJsonLd,
  regionMeta,
  touristAttractionJsonLd,
  touristDestinationJsonLd,
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
  HUB_OG_IMAGE,
  itemListJsonLd,
  OG_IMAGE_H,
  OG_IMAGE_W,
  socialImage,
  socialImageIsSmall,
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
  regionDisplayName,
  regionPath,
  regionUrl,
  portalUrl,
  DEAL_ORIGIN,
  DEAL_BRAND,
  DEAL_SITE_NAME,
  dealHubMeta,
  dealUrl,
  RANK_BRAND,
  RANK_SITE_NAME,
  RANK_ORIGIN,
  rankHubMeta,
  rankUrl,
  BLOG_ORIGIN,
  BLOG_BRAND,
  blogAuthorUrl,
  blogCategoryUrl,
  blogHubMeta,
  blogPostUrl,
  ADSENSE_HOSTS,
  adsTxt,
} from '../src/seo/copy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const API_ORIGIN = process.env.SEO_API_ORIGIN || 'https://api.1989v.com';
const LANGS = ['ko', 'en'];
const GENRES = ['DEFENSE', 'ACTION', 'STRATEGY', 'RPG', 'ARCADE', 'PUZZLE', 'VERSUS', 'CASUAL', 'EDUCATION'];

const GAME_HOST = new URL(GAME_ORIGIN).host;
const PORTAL_HOST = new URL(PORTAL_ORIGIN).host;
const PLACE_HOST = new URL(PLACE_ORIGIN).host;

/**
 * 열거 샤드 = 법정동 시도코드 17개 (ADR-0071 의 지역 축과 동일).
 *
 * 무필터 조회는 상위 10,000건(OpenSearch from+size 창)에서 잘리므로 지역으로 잘라 훑는데,
 * 축이 중요하다 — 구 TourAPI areaCode 는 폐기 중이라 문서의 ~43% 에서 비어 있어
 * (tour-api-field-drift, 2026-08-17 실측) 그 축으로 훑으면 그만큼 sitemap 에서 빠진다.
 * 법정동 코드는 신체계가 원천에서 채워 주는 현행 축이다.
 *
 * admin-regions API 로 열거하지 않고 정적 목록을 쓰는 이유: 색인 열거가 그 API 장애에
 * 연쇄되지 않아야 하고(fail-soft 독립), 시도 17개는 법으로 고정된 집합이라 바뀌는 시점
 * (행정구역 개편)에는 어차피 admin_regions 재적재와 함께 이 한 줄을 고치면 된다.
 * 강원 51·전북 52 는 특별자치도 승격 후 코드다 (admin_regions 실측과 일치해야 한다).
 */
export const SIDO_CODES = [
  '11', '26', '27', '28', '29', '30', '31', '36', // 서울·부산·대구·인천·광주·대전·울산·세종
  '41', '43', '44', '46', '47', '48', '50', '51', '52', // 경기·충북·충남·전남·경북·경남·제주·강원·전북
];
const RESUME_HOST = new URL(RESUME_ORIGIN).host;
const DEAL_HOST = new URL(DEAL_ORIGIN).host;
const BLOG_HOST = new URL(BLOG_ORIGIN).host;
const RANK_HOST = new URL(RANK_ORIGIN).host;

/**
 * 일부 섹션만 조회에 실패했을 때 던진다 — **빌드를 세운다.**
 *
 * 2026-08-22 사고: 게임 카탈로그 조회만 실패하고 나머지(관광지·지역·포털)는 성공했다.
 * 스크립트는 경고만 남기고 성공으로 끝냈고, `prerender/games/` 가 통째로 빠진 이미지가
 * 배포되어 **전 게임의 공유 카드가 기본 메타로 떨어졌다.** 빌드는 초록불이었다.
 *
 * 왜 빌드를 세우는 쪽이 안전한가: 실패하면 Argo 가 직전 이미지를 유지하는데, 그 이미지에는
 * 정상 프리렌더가 들어 있다. 즉 **세우는 것이 곧 좋은 상태를 지키는 것**이다. 반대로 통과시키면
 * 나쁜 상태로 덮어쓰고, 아무도 모른 채 며칠이 간다.
 */
class PartialSeoFailure extends Error {}

// 직접 실행일 때만 돈다 — 렌더 함수 단위 테스트(vitest)가 import 만으로
// 운영 API 를 두드리는 일이 없어야 한다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    if (err instanceof PartialSeoFailure) {
      console.error(`[seo] ${err.message}`);
      process.exit(1);
    }
    console.warn(`[seo] 프리렌더 실패 — SPA 만 배포됩니다: ${err.message}`);
    process.exit(0);
  });
}

async function main() {
  const shell = await readFile(resolve(DIST, 'index.html'), 'utf8');
  if (!shell.includes('<!--seo:start-->')) {
    throw new Error('index.html 에 <!--seo:start--> 마커가 없습니다');
  }

  // 섹션별 성패를 남긴다 — 끝에서 '일부만 실패' 를 가려내 빌드를 세운다 (PartialSeoFailure)
  const fetched = [];
  const failed = [];

  // 카탈로그를 못 받아도 robots/sitemap 은 남긴다 — 포털 색인까지 같이 죽으면 안 된다
  let games = [];
  try {
    games = await fetchCatalog();
    fetched.push('games');
  } catch (err) {
    failed.push('games');
    console.warn(`[seo] 게임 카탈로그 조회 실패 (${API_ORIGIN}): ${err.message}`);
  }
  // 관광지 전량은 sitemap 전용이다 — 6만 URL 을 정적 HTML 로 찍으면 이미지가 수백 MB 로
  // 불어난다 (ADR-0062 §8). 다만 **개요가 있는 문서만** 상한을 두고 프리렌더한다:
  // 개요 없는 85% 는 제목·주소뿐인 얇은 페이지라 찍어봤자 해가 되고, 개요 있는 문서는
  // JS 를 실행하지 않는 AEO 크롤러(GPTBot·ClaudeBot·PerplexityBot)에게 본문이 보여야
  // 인용 대상이 된다. 나머지는 여전히 라우트 + useSeo + sitemap 으로 연다.
  let places = { ko: [], en: [] };
  let regions = { ko: [], en: [] };
  try {
    places = await fetchAttractionIndex();
    regions = await fetchRegionIndex();
    fetched.push('places');
  } catch (err) {
    failed.push('places');
    console.warn(`[seo] 관광지 색인 조회 실패: ${err.message}`);
  }

  // 블로그는 색인 대상이다 (deal/resume 과 반대) — 목록·카테고리·작성자 URL 이 sitemap 에 들어간다
  let blog = { posts: [], categories: [] };
  try {
    blog = await fetchBlogIndex();
    fetched.push('blog');
  } catch (err) {
    failed.push('blog');
    console.warn(`[seo] 블로그 색인 조회 실패: ${err.message}`);
  }

  // 혜택 허브는 2026-08-24 부터 색인 대상이다 (ADR-0069 개정) — 오퍼가 본문이자 llms.txt 이므로
  // 조회 실패는 곧 "빈 카탈로그가 색인되는" 상태다. 가드 안에 둔다.
  let dealSections = [];
  try {
    dealSections = await fetchDealSections();
    fetched.push('deal');
  } catch (err) {
    failed.push('deal');
    console.warn(`[seo] 혜택 카탈로그 조회 실패: ${err.message}`);
  }

  // 랭킹은 **부분 실패 가드 밖**이다. 두 가지가 겹쳐서다:
  //   ① 보드는 첫 수집이 끝나야 생긴다 — 빈 결과가 정상 상태라 "손실"과 구분되지 않는다
  //   ② FE 빌드 시점에 백엔드가 아직 이 엔드포인트를 갖고 있지 않을 수 있다(첫 배포)
  // 여기서 빌드를 세우면 첫 배포 자체가 막힌다. 대신 경고를 남기고 sitemap 을 비운다.
  let rankBoards = [];
  try {
    rankBoards = await fetchRankingBoardIndex();
  } catch (err) {
    console.warn(`[seo] 랭킹 보드 조회 실패(첫 배포/첫 수집 전이면 정상): ${err.message}`);
  }

  // **일부만 실패**했으면 여기서 세운다. 전부 실패한 경우(API 자체가 죽은 상황)는
  // 통과시킨다 — 그때는 백엔드 장애가 이미 드러나 있고, FE 만 올려야 할 이유가 있을 수 있다.
  // 위험한 것은 조용한 부분 손실이지 명백한 전면 장애가 아니다.
  if (failed.length > 0 && fetched.length > 0) {
    throw new PartialSeoFailure(
      `일부 색인 조회만 실패했습니다 (성공: ${fetched.join(', ')} / 실패: ${failed.join(', ')}). ` +
        '이대로 배포하면 실패한 섹션의 프리렌더가 통째로 사라진 이미지가 나갑니다 — ' +
        '빌드를 세웁니다. 재시도하면 대개 해소됩니다.',
    );
  }

  await writeRobotsAndSitemaps(games, places, regions, blog, rankBoards, dealSections);
  await renderPortalPages(shell);
  await renderPlaceHubs(shell, places, regions);
  await renderPlaceDetails(shell, places, regions);
  await renderDealHub(shell, dealSections);
  await renderRankHub(shell);
  await renderBlogHub(shell, blog);

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
  // 전용 OG 카드(1200×630)가 있으면 붙여준다 — 없으면 목록 썸네일로 떨어진다
  for (const game of details) {
    const rel = `games/thumbs/og/${game.slug}.png`;
    if (existsSync(resolve(ROOT, 'public', rel))) game.ogImageUrl = `/${rel}`;
  }
  // 목록 카드에 실을 썸네일. DB 의 thumbnailUrl 이 실물과 어긋난 게 있어(SPA 폴백이
  // index.html 을 200 으로 돌려준다) 존재 확인을 통과한 것만 <img> 로 내보낸다.
  for (const game of details) {
    const url = game.thumbnailUrl;
    if (url?.startsWith('/') && existsSync(resolve(ROOT, 'public', url.slice(1)))) {
      game.thumbAsset = url;
    }
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

function metaTags({ title, description, canonical, lang, image, imageSmall, imageAlt,
                    alternates, jsonLd, noindex, siteName = BRAND }) {
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
    // 작은 썸네일로 큰 카드를 선언하면 뭉개진다 — 전용 OG 카드가 있을 때만 large
    `<meta name="twitter:card" content="${image && !imageSmall ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  // 색인은 막되 크롤은 열어 둔다 — robots.txt 로 막으면 크롤러가 이 태그를 읽지 못해
  // URL 만 색인되고, 카카오톡/슬랙/X 언퍼러도 OG 를 못 가져간다.
  if (noindex) lines.push(`<meta name="robots" content="noindex, follow" />`);
  if (image) {
    lines.push(`<meta property="og:image" content="${image}" />`);
    lines.push(`<meta property="og:image:secure_url" content="${image}" />`);
    lines.push(`<meta property="og:image:type" content="image/png" />`);
    if (!imageSmall) {
      // 크기를 명시하면 언퍼러가 이미지를 먼저 받아 재보지 않아도 카드를 그린다
      lines.push(`<meta property="og:image:width" content="${OG_IMAGE_W}" />`);
      lines.push(`<meta property="og:image:height" content="${OG_IMAGE_H}" />`);
    }
    if (imageAlt) lines.push(`<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`);
    lines.push(`<meta name="twitter:image" content="${image}" />`);
    if (imageAlt) lines.push(`<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`);
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
    .map((g) => {
      const title = titleOf(g, lang);
      const genre = genreLabelOf(g.genre, lang);
      const href = gamePath(lang, `/games/${g.slug}`);
      return `<li><a href="${href}">${gameThumb(lang, g, title, genre)}${escapeHtml(title)}</a> · ${escapeHtml(genre)}</li>`;
    })
    .join('');
  return `<ul>${items}</ul>`;
}

/**
 * 목록 카드의 썸네일. 이게 없으면 프리렌더 HTML 에 <img> 가 한 장도 없어서
 * 구글 이미지 쪽 유입 경로가 통째로 비고, alt 에 실을 키워드도 같이 사라진다.
 * 실물 320×180 을 절반 크기로 표시한다 — 셸은 SPA 가 마운트되면 교체되는 임시 본문이다.
 */
/**
 * 상세 페이지 본인의 화면. 그 페이지에서 가장 값어치 있는 이미지인데 프리렌더에는 빠져 있었다.
 * 1200×630 카드가 있으면 그것을 쓴다 — 목록 썸네일(320×180)보다 이미지 검색에서 낫다.
 */
function detailHero(lang, game) {
  const src = game.ogImageUrl ?? game.thumbAsset;
  if (!src) return '';
  const title = titleOf(game, lang);
  const alt = lang === 'en' ? `${title} gameplay screenshot` : `${title} 게임 플레이 화면`;
  const [w, h] = game.ogImageUrl ? [600, 315] : [320, 180];
  return `<p><img src="${src}" width="${w}" height="${h}" alt="${escapeHtml(alt)}" /></p>`;
}

function gameThumb(lang, game, title, genre) {
  if (!game.thumbAsset) return '';
  const alt =
    lang === 'en' ? `${title} — ${genre} browser game screenshot` : `${title} — ${genre} 웹게임 화면`;
  return (
    `<img src="${game.thumbAsset}" width="160" height="90" loading="lazy" ` +
    `alt="${escapeHtml(alt)}" /> `
  );
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
    image: HUB_OG_IMAGE,
    imageAlt: meta.heading,
    alternates: hreflangAlternates(''),
    jsonLd: [
      collectionPageJsonLd(lang, meta, canonical),
      itemListJsonLd(lang, games.slice(0, 30)),
      websiteJsonLd({ name: BRAND, url: GAME_ORIGIN }),
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
  const hero = detailHero(lang, game);
  return compose(shell, {
    lang,
    ...meta,
    canonical,
    image: socialImage(game),
    imageSmall: socialImageIsSmall(game),
    imageAlt: titleOf(game, lang),
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
        hero +
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

async function writeRobotsAndSitemaps(
  games,
  places = { ko: [], en: [] },
  regions = { ko: [], en: [] },
  blog = { posts: [], categories: [] },
  rankBoards = [],
  dealSections = [],
) {
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

  const portalEntries = ['/', '/tech', '/portfolio', '/shop', '/privacy'].map((path) => ({
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
  // 지역 페이지 — 관광지 상세와 달리 **진짜 번역쌍**이다(같은 코드가 두 언어에 있다).
  // hreflang 은 양쪽에 그 언어 콘텐츠가 실제로 있을 때만 건다.
  const regionCodesBoth = new Set(
    (regions.ko ?? []).map((r) => r.code).filter((code) => (regions.en ?? []).some((r) => r.code === code)),
  );
  const regionEntries = LANGS.flatMap((lang) =>
    (regions[lang] ?? []).map((r) => ({
      loc: regionUrl(lang, r.code),
      priority: r.level === 'SIDO' ? '0.8' : '0.6',
      ...(regionCodesBoth.has(r.code)
        ? { alternates: placeHreflangAlternates(`/regions/${r.code}`) }
        : {}),
    })),
  );
  const placeDetailEntries = LANGS.flatMap((lang) =>
    (places[lang] ?? []).map((a) => ({
      loc: placeUrl(lang, `/attractions/${a.id}`),
      // 개요가 있는 문서가 순위 경쟁력이 있다 — 크롤 예산을 그쪽으로 기울인다
      priority: a.hasOverview ? '0.7' : '0.4',
    })),
  );

  await emit(`seo/${GAME_HOST}/sitemap.xml`, sitemapXml(gameEntries));
  await emit(`seo/${PORTAL_HOST}/sitemap.xml`, sitemapXml(portalEntries));
  await writePlaceSitemaps([...placeHubEntries, ...regionEntries], placeDetailEntries);

  await emit(`seo/${GAME_HOST}/robots.txt`, robotsTxt(GAME_ORIGIN));
  await emit(`seo/${PORTAL_HOST}/robots.txt`, robotsTxt(PORTAL_ORIGIN));
  await emit(`seo/${PLACE_HOST}/robots.txt`, robotsTxt(PLACE_ORIGIN));
  // 이력서는 색인 대상이 아니다 (ADR-0064). sitemap·llms.txt 도 두지 않는다.
  await emit(`seo/${RESUME_HOST}/robots.txt`, 'User-agent: *\nDisallow: /\n');
  // 혜택 허브는 색인 대상이다 (2026-08-24, ADR-0069 개정). robots 는 `/go/` 만 막는다.
  await emit(`seo/${DEAL_HOST}/robots.txt`, dealRobotsTxt());
  await emit(`seo/${DEAL_HOST}/sitemap.xml`, sitemapXml(dealSitemapEntries()));
  // 블로그는 자체 콘텐츠라 thin 판정 대상이 아니다 — 색인을 연다 (ADR-0072 §8)
  // 스튜디오·로그인은 크롤 자체를 막는다. useSeo 의 noindex 는 JS 를 실행하는 크롤러에만
  // 닿는데, 이 경로들은 프리렌더가 없어 셸의 기본 메타가 그대로 나간다 — 색인되면
  // 제목이 같은 문서가 여러 개 생긴다.
  await emit(`seo/${BLOG_HOST}/robots.txt`, robotsTxt(BLOG_ORIGIN, ['/studio', '/login']));
  await emit(`seo/${BLOG_HOST}/sitemap.xml`, sitemapXml(blogSitemapEntries(blog)));
  // 랭킹은 색인 대상이다 (deal 과 반대) — 링크 모음이 아니라 집계와 등락이 자체 콘텐츠이고
  // "OO구 최저가 주유소"는 검색 의도가 뚜렷하다 (ADR-0081 §8).
  await emit(`seo/${RANK_HOST}/robots.txt`, robotsTxt(RANK_ORIGIN));
  await emit(`seo/${RANK_HOST}/sitemap.xml`, sitemapXml(rankSitemapEntries(rankBoards)));

  await emit(`seo/${GAME_HOST}/llms.txt`, gameLlmsTxt(games));
  await emit(`seo/${PORTAL_HOST}/llms.txt`, portalLlmsTxt());
  await emit(`seo/${PLACE_HOST}/llms.txt`, placeLlmsTxt(places));
  await emit(`seo/${BLOG_HOST}/llms.txt`, blogLlmsTxt(blog));
  await emit(`seo/${DEAL_HOST}/llms.txt`, dealLlmsTxt(dealSections));

  await writeAdsTxt();
}

/**
 * ads.txt — 광고 게재 호스트마다 같은 내용을 찍는다.
 *
 * 게시자 ID 가 비어 있으면 파일을 만들지 않는다. 빈 ads.txt 는 "없음"과 다르다 —
 * 파일이 존재하는데 판매자 줄이 없으면 크롤러는 그것을 '승인된 판매자 없음'
 * 선언으로 읽어 그 도메인의 입찰을 통째로 버린다.
 */
async function writeAdsTxt() {
  const body = adsTxt();
  if (!body) return;
  for (const host of ADSENSE_HOSTS) {
    await emit(`seo/${host}/ads.txt`, body);
  }
}

/**
 * 블로그 sitemap.
 *
 * 글 상세는 백엔드가 meta 를 주입해 서빙하므로(ADR-0072 §6) 정적 HTML 을 찍지 않는다.
 * 여기서 하는 일은 **주소를 알리는 것**뿐이다 — 크롤러가 찾아오면 서버가 완성된 문서를 준다.
 */
function blogSitemapEntries(blog) {
  return [
    { loc: `${BLOG_ORIGIN}/`, priority: '1.0' },
    ...(blog.categories ?? []).map((c) => ({ loc: blogCategoryUrl(c.path), priority: '0.6' })),
    ...(blog.posts ?? []).map((p) => ({
      loc: blogPostUrl(p.slug),
      lastmod: p.publishedAt ? String(p.publishedAt).slice(0, 10) : undefined,
      priority: '0.8',
    })),
    ...blogAuthorHandles(blog).map((handle) => ({ loc: blogAuthorUrl(handle), priority: '0.5' })),
  ];
}

function blogAuthorHandles(blog) {
  return [...new Set((blog.posts ?? []).map((p) => p.author?.handle).filter(Boolean))];
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

function robotsTxt(origin, extraDisallow = []) {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /oauth/
Disallow: /admin/
Disallow: /shop/login
Disallow: /shop/orders${extraDisallow.map((path) => `\nDisallow: ${path}`).join('')}

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
 * 지역 페이지 색인 대상 (ADR-0071 §9). 언어별 관광 분류 건수가 0 인 지역은 뺀다 —
 * 빈 지역 페이지를 sitemap 에 올리면 thin content 로 사이트 전체 평가를 깎는다.
 * (관광지 열거와 달리 admin-regions 자체를 훑으므로 구 areaCode 공동화의 영향이 없다)
 */
async function fetchRegionIndex() {
  const result = {};
  for (const lang of LANGS) {
    const regions = [];
    const sidos = (await getJson(`/api/places/admin-regions?level=SIDO&lang=${lang}`)).regions ?? [];
    for (const sido of sidos) {
      if ((sido.attractionCount ?? 0) > 0) regions.push(sido);
      const children = (await getJson(`/api/places/admin-regions?level=SIGUNGU&parent=${sido.code}&lang=${lang}`)).regions ?? [];
      regions.push(...children.filter((c) => (c.attractionCount ?? 0) > 0));
    }
    result[lang] = regions;
    console.log(`[seo] 지역 ${lang}: ${regions.length}건`);
  }
  return result;
}

/**
 * 관광지 id 를 전부 훑는다 — 샤드는 법정동 시도코드다 (SIDO_CODES 주석 참조).
 * 무필터 조회는 상위 10,000건에서 잘리고, 시도로 자르면 각 조각이 그 아래로 떨어진다.
 * 페이지 크기는 서버가 100 으로 고정한다. 실패한 조각은 건너뛴다 —
 * 일부가 빠진 sitemap 이 sitemap 이 없는 것보다 낫다.
 */
async function fetchAttractionIndex() {
  const result = {};
  for (const lang of LANGS) {
    const byId = new Map();
    const CONCURRENCY = 4;
    for (let i = 0; i < SIDO_CODES.length; i += CONCURRENCY) {
      const slices = await Promise.all(
        SIDO_CODES.slice(i, i + CONCURRENCY).map((sidoCode) => fetchSidoSlice(lang, sidoCode)),
      );
      slices.flat().forEach((a) => byId.set(a.id, a));
    }
    result[lang] = [...byId.values()];
    console.log(`[seo] 관광지 ${lang}: ${result[lang].length}건`);
  }
  return result;
}

/**
 * 색인 항목 하나 — 개요 있는 문서는 상세 프리렌더 후보라 원본 필드(+어느 시도 샤드에서
 * 왔는지)를 들고 가고, 나머지는 sitemap 에 id 만 필요하다 — 6만 건 전부의 본문을
 * 메모리에 얹지 않는다. sidoCode 는 상세 페이지의 지역 링크·대표 관광지 짝짓기 축이다.
 * @param {Record<string, any>} a 검색 응답의 관광지 문서
 * @param {string} sidoCode 이 문서를 가져온 샤드의 법정동 시도코드
 */
export function indexDoc(a, sidoCode) {
  const overview = (a.overview || '').trim();
  if (!overview) return { id: a.id, hasOverview: false };
  return {
    id: a.id,
    hasOverview: true,
    sidoCode,
    title: a.title,
    titleLocal: a.titleLocal ?? null,
    category: a.category ?? null,
    address: a.address ?? null,
    imageUrl: a.imageUrl ?? null,
    tel: a.tel ?? null,
    overview,
    latitude: a.latitude,
    longitude: a.longitude,
  };
}

async function fetchSidoSlice(lang, sidoCode) {
  const found = [];
  // from+size 창(10,000) 안에서만 페이징된다 — 100건 × 100페이지
  for (let page = 0; page < 100; page += 1) {
    let data;
    try {
      data = await getJson(`/api/search/attractions?lang=${lang}&sidoCode=${sidoCode}&size=100&page=${page}`);
    } catch (err) {
      console.warn(`[seo] 관광지 ${lang}/sido=${sidoCode}/p${page} 실패: ${err.message}`);
      break;
    }
    const items = data.attractions ?? [];
    for (const a of items) found.push(indexDoc(a, sidoCode));
    if (items.length < 100) break;
  }
  return found;
}

// ─── place · 포털 허브 프리렌더 ──────────────────────────────────────────────

async function renderPlaceHubs(shell, places = { ko: [], en: [] }, regions = { ko: [], en: [] }) {
  for (const lang of LANGS) {
    const meta = placeHubMeta(lang);
    const canonical = placeUrl(lang);
    // 시도 지역 링크 — sitemap 만 있고 내부 링크가 없는 URL 은 잘 크롤되지 않는다
    const regionLinks = (regions[lang] ?? [])
      .filter((r) => r.level === 'SIDO')
      .map((r) => `<li><a href="${regionPath(lang, r.code)}">${escapeHtml(regionDisplayName(lang, r))}</a></li>`)
      .join('');
    // 허브에서 관광지 일부로 링크를 뻗어 크롤러가 상세 URL 을 발견할 진입점을 만든다.
    // (sitemap 만 있고 내부 링크가 없는 URL 은 잘 크롤되지 않는다)
    // 개요 있는 문서는 이제 이름까지 들고 있다 — 앵커 텍스트가 "#id" 면 관련성 신호가 없다.
    const seeds = (places[lang] ?? []).filter((a) => a.hasOverview).slice(0, 60);
    const links = seeds
      .map(
        (a) =>
          `<li><a href="${placePath(lang, `/attractions/${a.id}`)}">${escapeHtml(a.title || `#${a.id}`)}</a></li>`,
      )
      .join('');
    const html = compose(shell, {
      lang,
      ...meta,
      canonical,
      siteName: placeBrand(lang),
      alternates: placeHreflangAlternates(''),
      jsonLd: [
        collectionPageJsonLd(lang, meta, canonical, { name: placeBrand(lang), url: PLACE_ORIGIN }),
        placeItemListJsonLd(lang, seeds.slice(0, 30)),
      ],
      body: shellBody(
        `<h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p>` +
          (regionLinks ? `<ul>${regionLinks}</ul>` : '') +
          (links ? `<ul>${links}</ul>` : ''),
      ),
    });
    await emit(`prerender/_hosts/${PLACE_HOST}${lang === 'en' ? '.en' : ''}.html`, html);
  }
}

// ─── place 상세 프리렌더 (ADR-0062 §8 개정) ─────────────────────────────────
//
// 개요 있는 문서만, 언어당 상한을 두고 찍는다. 전량(6만)은 이미지를 수백 MB 로 불리고
// 개요 없는 문서는 얇은 페이지라 원래 결정대로 sitemap 에만 둔다. 상한 기준 최악치는
// 페이지당 ~9KB × 2×3,000 = ~54MB — 개요 백필(일 2,000건)이 쌓이면 이 상한이 예산이다.
const PLACE_DETAIL_CAP = Number(process.env.SEO_PLACE_DETAIL_CAP || 3000);

/**
 * 상세 프리렌더 대상 선별 — 개요가 있는 문서만, 사진 있는 문서 먼저(소셜 카드·리치 결과
 * 경쟁력이 있는 쪽에 상한을 먼저 쓴다), 언어당 cap 개.
 * @param {Array<Record<string, any>>} docs
 * @param {number} [cap]
 */
export function pickPrerenderDetails(docs, cap = PLACE_DETAIL_CAP) {
  const withOverview = docs.filter((a) => a.hasOverview && a.title);
  const rank = (a) => (a.imageUrl ? 0 : 1);
  return withOverview.sort((a, b) => rank(a) - rank(b)).slice(0, cap);
}

/**
 * 관광지 상세 정적 HTML. 어느 호스트에서나 같은 place 콘텐츠라 경로 키다 (nginx.conf 참조).
 * @param {string} shell
 * @param {'ko'|'en'} lang
 * @param {Record<string, any>} doc
 * @param {{ region?: Record<string, any> | null, nearby?: Array<Record<string, any>> }} [context]
 */
export function renderAttractionDetail(shell, lang, doc, { region = null, nearby = [] } = {}) {
  const meta = attractionMeta(lang, doc);
  const canonical = attractionUrl(lang, doc.id);
  const local = (doc.titleLocal || '').trim();
  const hubName = lang === 'en' ? 'Explore Korea' : '한국 관광지 탐색';
  const crumbs = [
    { name: hubName, url: placeUrl(lang) },
    ...(region ? [{ name: regionDisplayName(lang, region), url: regionUrl(lang, region.code) }] : []),
    { name: meta.heading, url: canonical },
  ];
  const nearbyList = nearby
    .map((a) => `<li><a href="${attractionPath(lang, a.id)}">${escapeHtml(a.title)}</a></li>`)
    .join('');
  return compose(shell, {
    lang,
    ...meta,
    canonical,
    siteName: placeBrand(lang),
    image: /\.(png|jpe?g|webp)$/i.test(doc.imageUrl || '') ? doc.imageUrl : null,
    // hreflang 없음 — TourAPI 는 국문/영문이 별도 콘텐츠라 짝을 모른다 (ADR-0062 §8)
    jsonLd: [touristAttractionJsonLd(lang, doc), breadcrumbJsonLd(lang, crumbs)],
    body: shellBody(
      `<nav><a href="${placePath(lang, '')}">${escapeHtml(hubName)}</a>` +
        (region
          ? ` › <a href="${regionPath(lang, region.code)}">${escapeHtml(regionDisplayName(lang, region))}</a>`
          : '') +
        `</nav>` +
        `<h1>${escapeHtml(meta.heading)}</h1>` +
        // 원어 병기명은 별도 요소 — 제목에 괄호로 합치지 않는다 (t2 백엔드 계약)
        (local && local !== doc.title ? `<p>${escapeHtml(local)}</p>` : '') +
        `<p>${escapeHtml(
          [placeCategoryLabel(doc.category, lang), doc.address].filter(Boolean).join(' · '),
        )}</p>` +
        (doc.tel ? `<p>${escapeHtml(doc.tel)}</p>` : '') +
        `<p>${escapeHtml(doc.overview)}</p>` +
        (nearbyList
          ? `<h2>${lang === 'en' ? 'Things to do nearby' : '주변 가볼 만한 곳'}</h2><ul>${nearbyList}</ul>`
          : ''),
    ),
  });
}

/**
 * 지역 상세 정적 HTML — "제주 가볼 만한 곳" 류 질의의 무 JS 착지점 (ADR-0071 §9).
 * @param {string} shell
 * @param {'ko'|'en'} lang
 * @param {Record<string, any>} region
 * @param {{ parent?: Record<string, any> | null, children?: Array<Record<string, any>>,
 *           top?: Array<Record<string, any>>, bothLangs?: boolean }} [context]
 */
export function renderRegionDetail(
  shell,
  lang,
  region,
  { parent = null, children = [], top = [], bothLangs = false } = {},
) {
  const meta = regionMeta(lang, region, region.attractionCount);
  const canonical = regionUrl(lang, region.code);
  const hubName = lang === 'en' ? 'Explore Korea' : '한국 관광지 탐색';
  const crumbs = [
    { name: hubName, url: placeUrl(lang) },
    ...(parent ? [{ name: regionDisplayName(lang, parent), url: regionUrl(lang, parent.code) }] : []),
    { name: meta.heading, url: canonical },
  ];
  const childLinks = children
    .map((c) => `<li><a href="${regionPath(lang, c.code)}">${escapeHtml(regionDisplayName(lang, c))}</a></li>`)
    .join('');
  const topLinks = top
    .map((a) => `<li><a href="${attractionPath(lang, a.id)}">${escapeHtml(a.title)}</a></li>`)
    .join('');
  return compose(shell, {
    lang,
    ...meta,
    canonical,
    siteName: placeBrand(lang),
    // 지역 페이지는 관광지 상세와 달리 진짜 번역쌍 — 양쪽에 실제로 있을 때만 hreflang
    ...(bothLangs ? { alternates: placeHreflangAlternates(`/regions/${region.code}`) } : {}),
    jsonLd: [touristDestinationJsonLd(lang, region, top), breadcrumbJsonLd(lang, crumbs)],
    body: shellBody(
      `<nav><a href="${placePath(lang, '')}">${escapeHtml(hubName)}</a>` +
        (parent
          ? ` › <a href="${regionPath(lang, parent.code)}">${escapeHtml(regionDisplayName(lang, parent))}</a>`
          : '') +
        `</nav>` +
        `<h1>${escapeHtml(meta.heading)}</h1>` +
        `<p>${escapeHtml(meta.description)}</p>` +
        (childLinks
          ? `<h2>${lang === 'en' ? 'Browse by district' : '시·군·구별로 보기'}</h2><ul>${childLinks}</ul>`
          : '') +
        (topLinks
          ? `<h2>${lang === 'en' ? 'Top attractions' : '대표 관광지'}</h2><ul>${topLinks}</ul>`
          : ''),
    ),
  });
}

async function renderPlaceDetails(shell, places, regions) {
  let count = 0;
  const bothLangCodes = new Set(
    (regions.ko ?? []).map((r) => r.code).filter((code) => (regions.en ?? []).some((r) => r.code === code)),
  );
  for (const lang of LANGS) {
    const prefix = lang === 'en' ? 'prerender/en' : 'prerender';
    const regionsLang = regions[lang] ?? [];
    const sidoByCode = new Map(regionsLang.filter((r) => r.level === 'SIDO').map((r) => [r.code, r]));

    // 관광지 — 지역 페이지 링크는 훑을 때 쓴 시도 샤드가 그대로 말해 준다 (indexDoc.sidoCode)
    const docs = pickPrerenderDetails(places[lang] ?? []);
    const bySido = new Map();
    for (const doc of docs) {
      if (!bySido.has(doc.sidoCode)) bySido.set(doc.sidoCode, []);
      bySido.get(doc.sidoCode).push(doc);
    }
    for (const doc of docs) {
      const region = sidoByCode.get(doc.sidoCode) ?? null;
      const nearby = (bySido.get(doc.sidoCode) ?? []).filter((a) => a.id !== doc.id).slice(0, 6);
      await emit(`${prefix}/attractions/${doc.id}.html`, renderAttractionDetail(shell, lang, doc, { region, nearby }));
      count += 1;
    }

    // 지역 — 건수 0 은 색인 대상이 아니라 fetchRegionIndex 가 이미 걸렀다 (thin content)
    for (const region of regionsLang) {
      const isSido = region.level === 'SIDO';
      const parent = isSido ? null : (sidoByCode.get(region.code.slice(0, 2)) ?? null);
      const children = isSido ? regionsLang.filter((r) => r.level === 'SIGUNGU' && r.code.startsWith(region.code)) : [];
      // 대표 관광지는 시도만 — 검색 응답에 시군구 축이 없어 시군구는 짝지을 수 없다
      const top = isSido ? (bySido.get(region.code) ?? []).slice(0, 10) : [];
      await emit(
        `${prefix}/regions/${region.code}.html`,
        renderRegionDetail(shell, lang, region, {
          parent,
          children,
          top,
          bothLangs: bothLangCodes.has(region.code),
        }),
      );
      count += 1;
    }
  }
  if (count > 0) console.log(`[seo] place 상세 프리렌더 ${count}장 (관광지 cap ${PLACE_DETAIL_CAP}/언어)`);
}

/**
 * 혜택 허브 프리렌더 (ADR-0069, 2026-08-24 색인 개방).
 *
 * 본문에 **오퍼를 텍스트로 적는다.** 링크로 적지 않는 이유가 둘이다: 정적 본문의 `/go/`
 * 링크는 robots 로 막아 둔 경로라 크롤러에게 막다른 길이고, 무엇보다 `rel="sponsored"`
 * 는 React 가 `revenueType` 을 보고 붙이는 것이라 정적 복사본에는 그 표시가 없다 —
 * 고지 없는 제휴 링크를 초기 HTML 로 내보내는 셈이 된다. 텍스트로 두면 무 JS 크롤러는
 * 카탈로그 내용을 읽고, 실제 링크는 하이드레이션 후의 정상 마크업만 존재한다.
 *
 * 언퍼러(카카오톡·슬랙·X)는 JS 를 실행하지 않으므로 OG 는 여기서 확정돼야 한다.
 */
async function renderDealHub(shell, sections = []) {
  await emit(`prerender/_hosts/${DEAL_HOST}.html`, renderDealHubHtml(shell, sections));
}

/** 허브 HTML — 파일 쓰기와 분리해 렌더 규칙만 단위 검증한다 (renderAttractionDetail 과 같은 형태) */
export function renderDealHubHtml(shell, sections = []) {
  const meta = dealHubMeta();
  const filled = sections.filter((s) => (s.offers ?? []).length > 0);
  const body = filled
    .map((section) => {
      const items = section.offers
        .map((o) => {
          const line = [o.merchant, o.benefit, o.title].filter(Boolean).join(' · ');
          const summary = o.summary ? ` ${o.summary}` : '';
          return `<li>${escapeHtml(line)}${escapeHtml(summary)}</li>`;
        })
        .join('');
      return `<h2>${escapeHtml(section.category.label)}</h2><ul>${items}</ul>`;
    })
    .join('');
  return compose(shell, {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    siteName: DEAL_SITE_NAME,
    jsonLd: [
      collectionPageJsonLd('ko', meta, meta.canonical, { name: DEAL_SITE_NAME, url: DEAL_ORIGIN }),
      websiteJsonLd({ name: DEAL_SITE_NAME, url: DEAL_ORIGIN }),
    ],
    body: shellBody(
      `<h1>${escapeHtml(DEAL_BRAND)}</h1><p>${escapeHtml(meta.description)}</p>${body}`,
    ),
  });
}

/**
 * 혜택 카탈로그 — 허브 프리렌더 본문과 llms.txt 가 함께 쓴다.
 * 오퍼는 수십 건 규모라 허브 응답 한 번이면 전량이다.
 */
async function fetchDealSections() {
  const sections = await getJson('/api/v1/deal/sections');
  return Array.isArray(sections) ? sections : [];
}

export function dealSitemapEntries() {
  // 허브 한 장이 전부다. 카테고리·오퍼별 URL 을 만들지 않는 이유는 오퍼가 수십 건인
  // 지금 그것을 쪼개면 링크 두세 개짜리 doorway page 가 되어, 열려는 색인을 오히려 깎아서다.
  // 검색은 `?q=` 로 같은 URL 위에서 돈다 (canonical 은 항상 `/`).
  return [{ loc: dealUrl('/'), priority: '1.0' }];
}

export function dealLlmsTxt(sections) {
  const body = sections
    .filter((s) => (s.offers ?? []).length > 0)
    .map((section) => {
      const items = section.offers
        .map((o) => `- ${o.merchant} · ${o.benefit} — ${o.title}${o.summary ? ` (${o.summary})` : ''}`)
        .join('\n');
      return `## ${section.category.label}\n${items}`;
    })
    .join('\n\n');
  return `# ${DEAL_BRAND}

> 여행 · 커머스 · 디지털구독 · 교육 · 생활 카테고리의 혜택 링크를 모아 분류하고,
> 이름 · 제공처 · 혜택으로 검색할 수 있게 정리한 곳입니다.
> 제휴 링크에는 "제휴 링크 · 구매 시 수수료를 받습니다" 고지가 붙습니다.

${body}

## 참고
- [혜택 허브](${DEAL_ORIGIN}/)
`;
}

/**
 * 랭킹 보드 색인 — sitemap 용 slug 목록.
 *
 * 경로 화면(`/route`)은 넣지 않는다. 입력에 따라 결과가 달라지는 도구라 색인해도
 * 크롤러가 볼 것은 빈 폼뿐이다.
 */
async function fetchRankingBoardIndex() {
  const boards = await getJson('/api/v1/ranking/boards');
  return Array.isArray(boards) ? boards : [];
}

function rankSitemapEntries(boards) {
  return [
    { loc: rankUrl('/'), priority: '0.9' },
    ...boards.map((b) => ({ loc: rankUrl(`/boards/${b.slug}`), priority: '0.6' })),
  ];
}

/**
 * 랭킹 허브 프리렌더 (ADR-0081).
 *
 * 보드 상세는 찍지 않는다 — 값이 매일 바뀌는데 프리렌더는 빌드 시점에 굳는다. 굳은 가격을
 * 내보내면 크롤러가 어제 값을 오늘 문서로 읽는다. 주소는 sitemap 이 알리고, 내용은
 * 라우트 + useSeo 가 채운다.
 */
async function renderRankHub(shell) {
  const meta = rankHubMeta();
  const html = compose(shell, {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    siteName: RANK_SITE_NAME,
    jsonLd: [websiteJsonLd({ name: RANK_SITE_NAME, url: RANK_ORIGIN })],
    body: shellBody(`<h1>${escapeHtml(RANK_BRAND)}</h1><p>${escapeHtml(meta.description)}</p>`),
  });
  await emit(`prerender/_hosts/${RANK_HOST}.html`, html);
}

/**
 * 혜택 허브 robots (2026-08-24 색인 개방).
 *
 * `/go/` 는 계속 막는다 — 아웃바운드 리다이렉터라 크롤러에게는 사이트 밖으로 나가는
 * 문일 뿐이고, 제휴 트래킹 URL 이 색인되면 안 된다. 이 차단은 색인 개방과 무관하게
 * thin affiliate 방어의 한 축이므로 절대 풀지 않는다.
 */
export function dealRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /go/

Sitemap: ${DEAL_ORIGIN}/sitemap.xml
`;
}

/**
 * 블로그 색인.
 *
 * 공개 목록 API 를 페이지 단위로 훑는다. 전용 "전체" 엔드포인트를 새로 뚫지 않는 이유는
 * 그 경로가 공개면에 하나 더 생기고, 글이 수천 편이 되기 전에는 페이징 몇 번이 더 싸기 때문이다.
 */
async function fetchBlogIndex() {
  const categories = flattenBlogCategories(await getJson('/api/v1/blog/categories'));
  const posts = [];
  for (let page = 0; page < BLOG_MAX_PAGES; page += 1) {
    const result = await getJson(`/api/v1/blog/posts?page=${page}&size=${BLOG_PAGE_SIZE}`);
    posts.push(...(result.items ?? []));
    if (page + 1 >= (result.totalPages ?? 1)) break;
  }
  return { posts, categories };
}

const BLOG_PAGE_SIZE = 50;
/** 안전장치 — 글이 이 수를 넘으면 sitemap 을 쪼개야 한다는 신호다 */
const BLOG_MAX_PAGES = 40;

function flattenBlogCategories(nodes) {
  return (nodes ?? []).flatMap((node) => [node, ...flattenBlogCategories(node.children)]);
}

/**
 * 블로그 홈 프리렌더.
 *
 * 글 상세는 백엔드가 직접 서빙하므로(ADR-0072 §6) 여기서 찍지 않는다. 홈만 찍는 이유는
 * 목록의 메타가 고정이고, **최근 글 링크가 크롤러의 진입로**가 되기 때문이다 —
 * sitemap 에만 있고 내부 링크가 없는 URL 은 잘 크롤되지 않는다.
 */
async function renderBlogHub(shell, blog) {
  const meta = blogHubMeta(blog.posts?.length ?? 0);
  const links = (blog.posts ?? [])
    .slice(0, 30)
    .map((p) => `<li><a href="/posts/${p.slug}">${escapeHtml(p.title)}</a></li>`)
    .join('');
  const nav = (blog.categories ?? [])
    .map((c) => `<a href="/c${c.path}">${escapeHtml(c.name)}</a>`)
    .join(' · ');
  const html = compose(shell, {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    siteName: BLOG_BRAND,
    body: shellBody(
      `<h1>${escapeHtml(BLOG_BRAND)}</h1><p>${escapeHtml(meta.description)}</p>` +
        `<nav>${nav}</nav><ul>${links}</ul>`,
    ),
  });
  await emit(`prerender/_hosts/${BLOG_HOST}.html`, html);
}

function blogLlmsTxt(blog) {
  const recent = (blog.posts ?? [])
    .slice(0, 20)
    .map((p) => `- [${p.title}](${blogPostUrl(p.slug)})`)
    .join('\n');
  return `# ${BLOG_BRAND}

> 서버·검색·데이터부터 취미와 일상까지, 직접 만들고 겪은 것을 기록합니다.

## 분류
${(blog.categories ?? []).map((c) => `- [${c.name}](${blogCategoryUrl(c.path)})`).join('\n')}

## 최근 글
${recent}

## 참고
- [전체 URL 목록](${BLOG_ORIGIN}/sitemap.xml)
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
