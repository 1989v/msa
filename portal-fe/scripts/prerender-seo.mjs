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
  attractionPath,
  PLACE_EVENT_TYPES,
  PLACE_STAY_TYPES,
  placeItemListJsonLd,
  regionMeta,
  touristDestinationJsonLd,
  BRAND,
  GAME_ORIGIN,
  PORTAL_ORIGIN,
  TRUST_LINKS,
  RESUME_ORIGIN,
  ADS_ORIGIN,
  ADS_BRAND,
  adsConsoleMeta,
  breadcrumbJsonLd,
  collectionPageJsonLd,
  descriptionOf,
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
  RANK_COVERAGE_NOTE,
  RANK_GAS_SOURCE,
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
  SEO_MULTI_ATTR,
  personJsonLd,
  ogCardUrl,
  imageMimeType,
  TECH_CATEGORY_KO,
  definedTermSetJsonLd,
  techCategorySlug,
  techGlossaryMeta,
  techGlossaryPath,
  techGlossaryUrl,
  techArticleJsonLd,
  ABOUT_SECTIONS,
} from '../src/seo/copy.mjs';
import { DATA_SOURCES, DATA_SOURCE_NOTICES } from '../src/seo/dataSources.mjs';

const MULTI = SEO_MULTI_ATTR;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
// render-content.mjs 가 빌드 체인 앞단에서 만든다 (커밋하지 않는 산출물)
const TECH_SEARCH_JSON = resolve(ROOT, 'src/pages/tech/generated/search-architecture.json');
const API_ORIGIN = process.env.SEO_API_ORIGIN || 'https://api.1989v.com';
const LANGS = ['ko', 'en'];
const GENRES = ['DEFENSE', 'ACTION', 'STRATEGY', 'RPG', 'ARCADE', 'PUZZLE', 'VERSUS', 'CASUAL'];

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
 * 광주 29·전남 46 은 전남광주통합특별시 12 로 합쳐졌다 — 원천이 12 로만 주므로 옛 코드로 훑으면
 * 그 지역 관광지가 sitemap 에서 통째로 빠진다. 옛 지역 주소는 nginx 가 /regions/12 로 301 한다.
 */
export const SIDO_CODES = [
  '11', '12', '26', '27', '28', '30', '31', '36', // 서울·전남광주통합·부산·대구·인천·대전·울산·세종
  '41', '43', '44', '47', '48', '50', '51', '52', // 경기·충북·충남·경북·경남·제주·강원·전북
];
const RESUME_HOST = new URL(RESUME_ORIGIN).host;
const DEAL_HOST = new URL(DEAL_ORIGIN).host;
const BLOG_HOST = new URL(BLOG_ORIGIN).host;
const RANK_HOST = new URL(RANK_ORIGIN).host;
const ADS_HOST = new URL(ADS_ORIGIN).host;

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
  // 관광지 전량은 sitemap·허브 링크·지역 대표 관광지의 재료다. 상세 HTML 은 찍지 않는다 —
  // search 가 요청 때 서버 렌더한다(ADR-0103, ADR-0062 §8 대체).
  let places = { ko: [], en: [] };
  let regions = { ko: [], en: [] };
  try {
    places = await fetchAttractionIndex();
    regions = await fetchRegionIndex();
    fetched.push('places');
  } catch (err) {
    // 조각이 조회 창을 넘은 것은 일시 장애가 아니라 sitemap 이 조용히 잘리는 상태다 — 그대로 빌드를 세운다
    if (err instanceof PartialSeoFailure) throw err;
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

  // 개념 사전 — 분류별 용어집의 재료다. 색인 대상이라 가드 안에 둔다.
  let concepts = [];
  try {
    concepts = await fetchConcepts();
    fetched.push('concepts');
  } catch (err) {
    failed.push('concepts');
    console.warn(`[seo] 개념 사전 조회 실패: ${err.message}`);
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

  // 검색 아키텍처 본문은 API 가 아니라 레포 md 에서 나온다 — 없으면 렌더 단계가 빠진 빌드라 세운다
  let searchArchitecture;
  try {
    searchArchitecture = JSON.parse(await readFile(TECH_SEARCH_JSON, 'utf8'));
    assertTechSearchGenerated(searchArchitecture);
  } catch (err) {
    throw new PartialSeoFailure(`검색 아키텍처 생성 JSON 을 쓸 수 없습니다 (${TECH_SEARCH_JSON}): ${err.message}`);
  }

  await writeRobotsAndSitemaps(games, places, regions, blog, rankBoards, dealSections, concepts);
  await renderPortalPages(shell, concepts, { searchArchitecture });
  await renderTechGlossaries(shell, concepts);
  await renderPlaceHubs(shell, places, regions);
  await renderPlaceDetails(shell, places, regions);
  await renderDealHub(shell, dealSections);
  await renderRankHub(shell, rankBoards);
  await renderAdsConsoleShell(shell);
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

/**
 * 개념 사전 전량. 162개라 한 번에 받는다 — 페이지를 나누면 분류별 묶음이 잘린다.
 * 상세는 부르지 않는다: 용어집이 쓰는 것은 이름·분류·풀이·동의어뿐이고, 그건 목록에 다 있다.
 */
async function fetchConcepts() {
  const page = await getJson('/api/v1/concepts?size=500');
  return page.content ?? [];
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
  // 전용 OG 카드(1200×630)가 있으면 그것을, 없으면 타이포 폴백 카드(make-og-cards.mjs 가
  // 굽는 public/og/games/<slug>.png)를, 그것도 없으면 목록 썸네일로 떨어진다.
  // 전용 아트는 게임 서브모듈(public/games)에, 폴백은 사이트(public/og)에 산다 —
  // 아트가 들어오면 폴백은 저절로 진다.
  for (const game of details) {
    const art = `games/thumbs/og/${game.slug}.png`;
    const fallback = `og/games/${game.slug}.png`;
    if (existsSync(resolve(ROOT, 'public', art))) game.ogImageUrl = `/${art}`;
    else if (existsSync(resolve(ROOT, 'public', fallback))) game.ogImageUrl = `/${fallback}`;
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
    // 확장자에서 읽는다 — 고정 png 는 관광지 사진(TourAPI jpg)에 거짓 타입을 붙인다
    const mime = imageMimeType(image);
    if (mime) lines.push(`<meta property="og:image:type" content="${mime}" />`);
    if (!imageSmall) {
      // 크기를 명시하면 언퍼러가 이미지를 먼저 받아 재보지 않아도 카드를 그린다
      lines.push(`<meta property="og:image:width" content="${OG_IMAGE_W}" />`);
      lines.push(`<meta property="og:image:height" content="${OG_IMAGE_H}" />`);
    }
    if (imageAlt) lines.push(`<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`);
    lines.push(`<meta name="twitter:image" content="${image}" />`);
    if (imageAlt) lines.push(`<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`);
  }
  // hreflang·JSON-LD 는 `data-seo-multi` 를 달고 나간다. 이 표시는 useSeo 가 "내가 관리하는
  // 태그" 를 고르는 기준이고, 없으면 하이드레이션이 기존 것을 못 찾아 **같은 블록을 한 벌 더
  // 붙인다** — 2026-09-10 실측: 게임 상세·관광지 상세·블로그 글 모두 렌더 후 JSON-LD 4개
  // (VideoGame ×2, BreadcrumbList ×2). 관광지는 두 breadcrumb 의 내용까지 달라
  // (`…›서울특별시›경복궁` vs `…›경복궁`) 검색엔진이 어느 쪽을 쓸지 임의로 고르는 상태였다.
  for (const alt of alternates ?? []) {
    lines.push(`<link rel="alternate" hreflang="${alt.hreflang}" href="${alt.href}" ${MULTI} />`);
  }
  for (const data of jsonLd ?? []) {
    // </script> 가 JSON 문자열에 섞이면 파서가 조기 종료된다
    lines.push(
      `<script type="application/ld+json" ${MULTI}>${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`,
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
/**
 * 색인 대상 호스트 전부. resume 는 색인 대상이 아니라 넣지 않는다 (ADR-0064).
 * apex 홈의 본문과 모든 프리렌더 페이지의 바닥글이 같은 목록을 쓴다.
 */
const SITE_LINKS = [
  [PORTAL_ORIGIN, '1989v'],
  [GAME_ORIGIN, '무료 웹게임'],
  [PLACE_ORIGIN, '한국 관광지 검색'],
  [BLOG_ORIGIN, '블로그'],
  [RANK_ORIGIN, '랭킹 리더보드'],
  [DEAL_ORIGIN, '혜택 링크 허브'],
];

/**
 * 모든 프리렌더 페이지의 바닥글 — 호스트 사이를 잇는 링크.
 *
 * 2026-09-13 실측: apex 홈만 다섯 허브로 링크하고, 허브 다섯은 **어느 쪽으로도 되돌아가는
 * 링크가 없었다.** sitemap 은 호스트 경계를 넘지 못하므로(ADR-0062 §5) 크롤러가 본
 * 사이트 그래프는 apex 에서 한 방향으로만 뻗은 나무였다 — 한 허브에 들어온 크롤러는
 * 거기서 끝난다. 화면의 GNB 는 JS 가 그리므로 크롤러 사본에는 없다.
 */
export function siteFooter() {
  const links = [
    ...SITE_LINKS,
    // 신뢰 링크(방침·소개·연락처·데이터 출처)는 apex 문서라 어느 호스트에서든 apex 절대 주소로 건다
    ...TRUST_LINKS.map(({ path, label }) => [`${PORTAL_ORIGIN}${path}`, label]),
  ]
    .map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`)
    .join(' · ');
  return `<footer><nav>${links}</nav></footer>`;
}

function shellBody(inner) {
  return `<div style="max-width:1080px;margin:0 auto;padding:32px 20px;color:#dce4f5;font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif">${inner}${siteFooter()}</div>`;
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
    // 장르별 전용 카드는 만들지 않는다 — 8종을 따로 굽는 값어치보다 허브 카드가
    // 어디서나 같은 얼굴로 나가는 쪽이 낫다.
    image: HUB_OG_IMAGE,
    imageAlt: meta.heading,
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
        // meta.description 은 검색결과용으로 154자에 잘린 값이다. 본문까지 그걸 쓰면
        // 길게 쓴 설명이 60% 넘게 버려진 채 나간다 — 본문에는 원문을 그대로 싣는다.
        `<p>${escapeHtml(descriptionOf(game, lang) || meta.description)}</p>` +
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
  concepts = [],
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

  const portalEntries = [
    ...['/', '/tech', '/tech/search', '/portfolio', '/shop', '/privacy', '/about', '/contact', '/data-sources'].map((path) => ({
      loc: `${PORTAL_ORIGIN}${path}`,
      priority: path === '/' ? '1.0' : '0.6',
    })),
    // 분류별 용어집 — 개념이 0개인 분류는 페이지 자체가 없으므로 여기도 없다
    ...[...groupConcepts(concepts).keys()].map((category) => ({
      loc: techGlossaryUrl(category),
      priority: '0.7',
    })),
  ];

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
  const placeDetailEntries = placeDetailSitemapEntries(places);

  await emit(`seo/${GAME_HOST}/sitemap.xml`, sitemapXml(gameEntries));
  await emit(`seo/${PORTAL_HOST}/sitemap.xml`, sitemapXml(portalEntries));
  await writePlaceSitemaps([...placeHubEntries, ...regionEntries], placeDetailEntries);

  await emit(`seo/${GAME_HOST}/robots.txt`, robotsTxt(GAME_ORIGIN));
  await emit(`seo/${PORTAL_HOST}/robots.txt`, robotsTxt(PORTAL_ORIGIN));
  await emit(`seo/${PLACE_HOST}/robots.txt`, robotsTxt(PLACE_ORIGIN));
  // 이력서는 색인 대상이 아니다 (ADR-0064). sitemap·llms.txt 도 두지 않는다.
  await emit(`seo/${RESUME_HOST}/robots.txt`, 'User-agent: *\nDisallow: /\n');
  // 광고주 콘솔도 색인 대상이 아니다 (ADR-0098) — 이력서와 같은 방식으로 막는다.
  await emit(`seo/${ADS_HOST}/robots.txt`, 'User-agent: *\nDisallow: /\n');
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
  await emit(`seo/${RANK_HOST}/llms.txt`, rankLlmsTxt(rankBoards));

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

/**
 * 관광지 상세의 정적 sitemap 항목.
 *
 * 개요가 없는 관광지는 싣지 않는다. 제목·주소·좌표만 있는 페이지라 본문이 없고,
 * 그런 URL 이 도메인의 대다수가 되면 사이트 전체가 '가치가 별로 없는 콘텐츠' 로 읽힌다
 * (2026-08-31 AdSense 반려 사유). 개요 수집 배치가 채우면 조건이 저절로 참이 되어
 * 다시 실린다 — 지운 것이 아니라 문을 조건부로 만든 것이다.
 *
 * 숙박(유형 32·80)은 개요와 대표 사진이 둘 다 있을 때만 싣는다 — 본문이 개요와 입·퇴실 원문뿐인 얇은 페이지다.
 * 기준은 유형 코드다: 분류 stay 인 레포츠 캠핑장(유형 28) 등 기존 행의 조건은 그대로 개요뿐이다.
 * 행사는 여기 오지 않는다 — indexDoc 이 뺀다(빌드 사이에 낡는다. 행사 URL 은 동적 sitemap 몫).
 * @param {{ ko?: Array<Record<string, any>>, en?: Array<Record<string, any>> }} places indexDoc 결과
 */
export function placeDetailSitemapEntries(places) {
  return LANGS.flatMap((lang) =>
    (places[lang] ?? [])
      .filter((a) => a.hasOverview && (!PLACE_STAY_TYPES.includes(a.contentTypeId) || a.imageUrl))
      .map((a) => ({
        loc: placeUrl(lang, `/attractions/${a.id}`),
        lastmod: isoDate(a.modifiedAt),
        priority: '0.7',
      })),
  );
}

/** sitemap 은 파일당 50,000 URL 상한이 있다. 넘치면 쪼개고 인덱스로 묶는다. */
const SITEMAP_CHUNK = 20_000;

/**
 * 행사 sitemap — 정적 파일이 아니다. nginx 가 이 경로를 search 로 넘기고 search 가 요청 시점의 오늘(KST)로 만든다
 * (행사는 빌드 사이에 끝나서 정적 sitemap 에 싣지 않는다). 인덱스는 이 이름을 가리키기만 한다.
 */
export const PLACE_EVENT_SITEMAP = 'sitemap-places-events.xml';

/**
 * place sitemap 파일들 — `seo/{place 호스트}/` 아래 이름 → 내용.
 *
 * 상세가 0건이면 인덱스 대신 urlset 하나(허브·지역)만 내고 행사 sitemap 도 가리키지 않는다 —
 * 상세 URL 이 전부 빠진 실패 빌드라 행사만 살릴 이유가 없다.
 * @returns {Array<[string, string]>}
 */
export function placeSitemapFiles(hubEntries, detailEntries) {
  const chunks = [];
  for (let i = 0; i < detailEntries.length; i += SITEMAP_CHUNK) {
    chunks.push(detailEntries.slice(i, i + SITEMAP_CHUNK));
  }
  if (chunks.length === 0) {
    return [['sitemap.xml', sitemapXml(hubEntries)]];
  }

  const files = [['sitemap-places-hub.xml', sitemapXml(hubEntries)]];
  for (let i = 0; i < chunks.length; i += 1) {
    files.push([`sitemap-places-${i + 1}.xml`, sitemapXml(chunks[i])]);
  }
  const indexed = [...files.map(([name]) => name), PLACE_EVENT_SITEMAP];
  files.push(['sitemap.xml', sitemapIndexXml(indexed.map((f) => `${PLACE_ORIGIN}/${f}`))]);
  return files;
}

async function writePlaceSitemaps(hubEntries, detailEntries) {
  const files = placeSitemapFiles(hubEntries, detailEntries);
  for (const [name, content] of files) {
    await emit(`seo/${PLACE_HOST}/${name}`, content);
  }
  if (detailEntries.length > 0) console.log(`[seo] place sitemap ${detailEntries.length} URL · 정적 ${files.length - 1} 파일 + 행사 동적 1`);
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

export function robotsTxt(origin, extraDisallow = []) {
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

# 메타의 AI 학습 크롤러 — 위 AEO 목록에 없던 것인데 부하의 대부분이었다.
# 2026-09-16~17 ingress 로그: 관광지 상세 요청 1,465건 중 1,395건(95%)이 이 봇이었고
# Googlebot 은 68건, 사람은 2건. 프리렌더 밖 페이지에서 JS 를 렌더해 API 를 3번씩 불러
# 무료 단일 노드에서 사람 트래픽의 수백 배를 썼다. 답변형 검색이 아니라 학습용이라
# 인용으로 돌아오는 것도 없다. facebookexternalhit(링크 미리보기)는 별개라 그대로 둔다.
# robots 의 User-agent 매칭은 대소문자를 가리지 않는다(RFC 9309) — 한 벌이면 된다.
User-agent: meta-externalagent
Disallow: /

User-agent: meta-externalfetcher
Disallow: /

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
    const sidos = (await getJson(`/api/places/administrative-regions?level=SIDO&lang=${lang}`)).regions ?? [];
    for (const sido of sidos) {
      if ((sido.attractionCount ?? 0) > 0) regions.push(sido);
      const children = (await getJson(`/api/places/administrative-regions?level=SIGUNGU&parent=${sido.code}&lang=${lang}`)).regions ?? [];
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
 * 색인 항목 하나 — 개요 있는 문서는 허브 링크·지역 대표 관광지에 쓸 이름·사진과
 * 어느 시도 샤드에서 왔는지를 들고 가고, 나머지는 sitemap 에 id 만 필요하다.
 * 본문(개요·이용 안내)은 싣지 않는다 — 상세는 search 가 서버 렌더한다(ADR-0103).
 *
 * 행사(유형 15·85)는 null 이다 — 정적 산출물(sitemap·허브 링크·지역 대표)은 빌드 사이에 낡는데
 * 행사는 날짜가 지나면 끝난다. 행사 URL 은 search 가 요청 때 만드는 동적 sitemap 이 갖는다.
 * @param {Record<string, any>} a 검색 응답의 관광지 문서
 * @param {string} sidoCode 이 문서를 가져온 샤드의 법정동 시도코드
 * @returns {Record<string, any> | null}
 */
export function indexDoc(a, sidoCode) {
  if (PLACE_EVENT_TYPES.includes(a.contentTypeId)) return null;
  const overview = (a.overview || '').trim();
  if (!overview) return { id: a.id, hasOverview: false };
  return {
    id: a.id,
    hasOverview: true,
    sidoCode,
    title: a.title,
    imageUrl: a.imageUrl ?? null,
    // 숙박의 sitemap 조건(개요 + 대표 사진)이 유형으로 갈린다
    contentTypeId: a.contentTypeId ?? null,
    // sitemap 의 lastmod. 원천 수정일이 없는 문서는 그냥 비운다 — 빌드일을 대신 적으면
    // 6만 URL 이 배포마다 전부 "갱신됨"이 되어 신호가 신호이길 그만둔다.
    modifiedAt: a.modifiedAt ?? null,
  };
}

/** 검색 조회 창 — OpenSearch from+size 상한. 한 조각은 100건 × 100쪽까지만 받을 수 있다. */
export const SLICE_WINDOW = 10_000;
const SLICE_PAGE = 100;
/**
 * 조각이 창을 넘을 때 다시 쪼개는 축 — place 파생 분류 전체(`categorize` 가 내는 값).
 * 여기 없는 분류가 생기면 분류별 합이 조각 건수와 어긋나 빌드가 선다(아래 합 검사).
 */
export const SLICE_CATEGORIES = [
  'nature', 'history', 'culture', 'leisure', 'shopping', 'food', 'stay', 'etc', 'festival', 'course',
];

/**
 * 시도 조각 하나. 조각이 조회 창(10,000)을 넘으면 넘는 부분이 sitemap 에서 **조용히** 빠진다 —
 * 경고로 두면 아무도 안 본다. 그래서 넘으면 분류별로 한 번 더 쪼개고, 그래도 넘거나 분류별 합이
 * 조각 건수와 다르면(빠진 분류가 있다) 빌드를 세운다. 일시 조회 실패는 지금처럼 그 조각만 줄인다.
 * @param {(path: string) => Promise<any>} [get] 조회 함수 — 테스트가 주입한다
 */
export async function fetchSidoSlice(lang, sidoCode, get = getJson) {
  const whole = await fetchSlicePages(lang, sidoCode, null, get);
  if (whole.items) return whole.items;

  const items = [];
  let sum = 0;
  for (const category of SLICE_CATEGORIES) {
    const part = await fetchSlicePages(lang, sidoCode, category, get);
    if (!part.items) {
      throw new PartialSeoFailure(
        `관광지 조각 ${lang}/sido=${sidoCode}/category=${category} 가 ${part.total.toLocaleString('en')}건으로 ` +
          `조회 창 ${SLICE_WINDOW.toLocaleString('en')}건을 넘습니다 — 넘는 부분이 sitemap 에서 빠집니다. 조각을 더 쪼개야 합니다.`,
      );
    }
    sum += part.total ?? 0;
    items.push(...part.items);
  }
  if (sum !== whole.total) {
    throw new PartialSeoFailure(
      `관광지 조각 ${lang}/sido=${sidoCode} 를 분류별로 다시 쪼갰더니 합이 ${sum}건으로 조각 ${whole.total}건과 다릅니다 — ` +
        'SLICE_CATEGORIES 에 없는 분류가 있습니다.',
    );
  }
  console.log(`[seo] 관광지 ${lang}/sido=${sidoCode}: ${whole.total}건 — 조회 창을 넘어 분류별로 나눠 받음`);
  return items;
}

/**
 * 한 조각을 쪽 단위로 받는다. 첫 쪽의 전체 건수가 창을 넘으면 더 받지 않고 `items: null` 을 돌려준다.
 * 첫 쪽부터 실패하면 건수를 모르므로 빈 목록이다(일시 장애 — 지금까지와 같이 그 조각만 빠진다).
 * @returns {Promise<{ total: number | null, items: Array<Record<string, any>> | null }>}
 */
async function fetchSlicePages(lang, sidoCode, category, get) {
  const found = [];
  let total = null;
  const filter = category ? `&category=${category}` : '';
  for (let page = 0; page < SLICE_WINDOW / SLICE_PAGE; page += 1) {
    let data;
    try {
      data = await get(`/api/search/attractions?lang=${lang}&sidoCode=${sidoCode}${filter}&size=${SLICE_PAGE}&page=${page}`);
    } catch (err) {
      console.warn(`[seo] 관광지 ${lang}/sido=${sidoCode}${filter}/p${page} 실패: ${err.message}`);
      break;
    }
    if (page === 0) {
      total = data.totalElements ?? 0;
      if (total > SLICE_WINDOW) return { total, items: null };
    }
    const items = data.attractions ?? [];
    for (const a of items) {
      const doc = indexDoc(a, sidoCode);
      if (doc) found.push(doc);
    }
    if (items.length < SLICE_PAGE) break;
  }
  return { total, items: found };
}

// ─── place · 포털 허브 프리렌더 ──────────────────────────────────────────────

/**
 * 허브 목록 카드 사진의 원천 — 연결 준비(DNS·TLS)를 JS 렌더 전에 시작해 둔다.
 * crossorigin 을 달지 않는다: img 는 no-cors 요청이라 crossorigin 연결은 재사용되지 않는다.
 * data-seo-multi 도 달지 않는다 — 화면 전환 때 useSeo 가 지우지 않고 남아 있어야 한다.
 * 허브 두 파일에만 넣는다(지역·상세 프리렌더와 SPA 셸은 그대로).
 */
const PLACE_PHOTO_PRECONNECT = '<link rel="preconnect" href="https://tong.visitkorea.or.kr" />';

/**
 * place 허브(국·영) 파일 목록 — 쓰기와 분리해 산출물을 단위 검증한다.
 * @returns {Array<{ path: string, html: string }>}
 */
export function placeHubPages(shell, places, regions) {
  const pages = [];
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
      imageAlt: meta.heading,
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
    }).replace('</head>', `${PLACE_PHOTO_PRECONNECT}\n  </head>`);
    pages.push({ path: `prerender/_hosts/${PLACE_HOST}${lang === 'en' ? '.en' : ''}.html`, html });
  }
  return pages;
}

async function renderPlaceHubs(shell, places = { ko: [], en: [] }, regions = { ko: [], en: [] }) {
  for (const { path, html } of placeHubPages(shell, places, regions)) await emit(path, html);
}

// ─── place 지역 상세 프리렌더 (ADR-0062 §8) ─────────────────────────────────
//
// 관광지 상세는 여기서 찍지 않는다 — search 가 요청 때 서버 렌더한다(ADR-0103).
// 지역 페이지는 계속 정적 HTML 이고, 시도 페이지의 대표 관광지는 개요 있는 문서 중
// 사진 있는 쪽을 먼저 싣는다(소셜 카드·리치 결과 경쟁력이 있는 쪽).

/**
 * 시도별 대표 관광지 후보 — 개요·제목이 있는 문서, 사진 있는 쪽 먼저.
 * @param {Array<Record<string, any>>} docs
 */
function regionTopCandidates(docs) {
  const rank = (a) => (a.imageUrl ? 0 : 1);
  return docs.filter((a) => a.hasOverview && a.title).sort((a, b) => rank(a) - rank(b));
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
    // 지역 대표 사진은 갖고 있지 않다 — 서비스 카드가 받는다. 사진이 있다면 그쪽이 이긴다.
    imageAlt: meta.heading,
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

/**
 * place 상세 단계가 쓸 파일 목록 — 쓰기와 분리해 산출물을 단위 검증한다.
 * @returns {Array<{ path: string, html: string }>}
 */
export function placeDetailPages(shell, places, regions) {
  const pages = [];
  const bothLangCodes = new Set(
    (regions.ko ?? []).map((r) => r.code).filter((code) => (regions.en ?? []).some((r) => r.code === code)),
  );
  for (const lang of LANGS) {
    const prefix = lang === 'en' ? 'prerender/en' : 'prerender';
    const regionsLang = regions[lang] ?? [];
    const sidoByCode = new Map(regionsLang.filter((r) => r.level === 'SIDO').map((r) => [r.code, r]));

    // 대표 관광지 짝짓기 — 훑을 때 쓴 시도 샤드가 그대로 말해 준다 (indexDoc.sidoCode)
    const bySido = new Map();
    for (const doc of regionTopCandidates(places[lang] ?? [])) {
      if (!bySido.has(doc.sidoCode)) bySido.set(doc.sidoCode, []);
      bySido.get(doc.sidoCode).push(doc);
    }

    // 건수 0 은 색인 대상이 아니라 fetchRegionIndex 가 이미 걸렀다 (thin content)
    for (const region of regionsLang) {
      const isSido = region.level === 'SIDO';
      const parent = isSido ? null : (sidoByCode.get(region.code.slice(0, 2)) ?? null);
      const children = isSido ? regionsLang.filter((r) => r.level === 'SIGUNGU' && r.code.startsWith(region.code)) : [];
      // 대표 관광지는 시도만 — 검색 응답에 시군구 축이 없어 시군구는 짝지을 수 없다
      const top = isSido ? (bySido.get(region.code) ?? []).slice(0, 10) : [];
      pages.push({
        path: `${prefix}/regions/${region.code}.html`,
        html: renderRegionDetail(shell, lang, region, {
          parent,
          children,
          top,
          bothLangs: bothLangCodes.has(region.code),
        }),
      });
    }
  }
  return pages;
}

async function renderPlaceDetails(shell, places, regions) {
  const pages = placeDetailPages(shell, places, regions);
  for (const { path, html } of pages) await emit(path, html);
  if (pages.length > 0) console.log(`[seo] place 지역 상세 프리렌더 ${pages.length}장`);
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

/** 허브 HTML — 파일 쓰기와 분리해 렌더 규칙만 단위 검증한다 (renderRegionDetail 과 같은 형태) */
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
    image: meta.image,
    imageAlt: DEAL_BRAND,
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
async function renderRankHub(shell, boards = []) {
  const meta = rankHubMeta();
  // 보드 링크는 제목·범위만 싣는다 — 값(가격·순위)은 매일 바뀌어 프리렌더에 굳히면 크롤러가
  // 어제 값을 오늘 문서로 읽는다. 주소를 아는 것과 값을 아는 것은 다른 일이다.
  // 2026-09-13 실측: 허브 본문에 링크가 하나도 없어 보드 URL 은 sitemap 에만 있었다.
  const boardLinks = boards
    .map((b) => `<li><a href="/boards/${escapeHtml(b.slug)}">${escapeHtml(b.title)}</a>${b.scopeName ? ` · ${escapeHtml(b.scopeName)}` : ''}</li>`)
    .join('');
  const html = compose(shell, {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    siteName: RANK_SITE_NAME,
    image: meta.image,
    imageAlt: RANK_BRAND,
    jsonLd: [websiteJsonLd({ name: RANK_SITE_NAME, url: RANK_ORIGIN })],
    body: shellBody(
      `<h1>${escapeHtml(RANK_BRAND)}</h1><p>${escapeHtml(meta.description)}</p>` +
        `<p>${escapeHtml(RANK_COVERAGE_NOTE)} ${escapeHtml(RANK_GAS_SOURCE)}</p>` +
        (boardLinks ? `<h2>보드</h2><ul>${boardLinks}</ul>` : ''),
    ),
  });
  await emit(`prerender/_hosts/${RANK_HOST}.html`, html);
}

/**
 * 광고주 콘솔 루트 셸 (ADR-0098). 본문은 로그인 뒤에 그려지므로 내용은 없고, `noindex` 를
 * 첫 바이트부터 싣는 것이 목적이다 — 없으면 이 호스트의 `/` 가 SPA 셸의 기본 메타로 나간다.
 */
async function renderAdsConsoleShell(shell) {
  const meta = adsConsoleMeta();
  const html = compose(shell, {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical: meta.canonical,
    siteName: ADS_BRAND,
    noindex: true,
    body: '',
  });
  await emit(`prerender/_hosts/${ADS_HOST}.html`, html);
}

/**
 * rank 의 AEO 진입 문서. 6개 색인 호스트 중 유일하게 없었다 (2026-09-13 실측 404).
 * 보드 목록은 sitemap 이 갖고, 여기는 무엇을 어디서 보면 되는지만 적는다.
 */
function rankLlmsTxt(boards = []) {
  const list = boards.slice(0, 40).map((b) => `- [${b.title}](${rankUrl(`/boards/${b.slug}`)})`).join('\n');
  return [
    `# ${RANK_SITE_NAME}`,
    '',
    '> 무엇이든 줄 세워 보여주는 리더보드. 첫 보드는 지역별 최저가 주유소 — 시군구·유종별 순위를 어제 대비 등락과 함께 매일 갱신한다.',
    '',
    '## 시작점',
    `- [허브](${RANK_ORIGIN}/)`,
    `- [전체 URL 목록](${RANK_ORIGIN}/sitemap.xml)`,
    '',
    '## 데이터',
    `- ${RANK_COVERAGE_NOTE}`,
    `- ${RANK_GAS_SOURCE}`,
    '- 순위는 현재값이 아니라 스냅샷 원장이다 — 등락은 이전 스냅샷과의 차이다',
    '',
    ...(list ? ['## 보드', list, ''] : []),
  ].join('\n');
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
    image: meta.image,
    imageAlt: BLOG_BRAND,
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

/**
 * 분류별 용어집 — `/tech/<slug>` 13장.
 *
 * 개념 하나에 URL 하나를 주지 않는 이유는 copy.mjs 의 이 절 주석에 있다: 풀이가 중앙값 29자라
 * 개념당 한 장이면 얇은 페이지가 162장 생긴다. 분류로 묶으면 한 장이 8~20개 용어를 들고 있어
 * 그 자체로 읽히고, `DefinedTermSet` 이 정확히 이 모양이다.
 * @param {string} shell
 * @param {Array<Record<string, any>>} concepts
 */
async function renderTechGlossaries(shell, concepts) {
  const byCategory = groupConcepts(concepts);
  const nav = techGlossaryNav(byCategory);
  for (const [category, items] of byCategory) {
    const meta = techGlossaryMeta(category, items);
    const terms = items
      .map(
        (c) =>
          `<dt>${escapeHtml(c.name)}${c.synonyms?.length ? ` <span>(${escapeHtml(c.synonyms.join(', '))})</span>` : ''}</dt>` +
          `<dd>${escapeHtml(c.description || '')}</dd>`,
      )
      .join('');
    const html = compose(shell, {
      lang: 'ko',
      ...meta,
      siteName: PORTAL_BRAND,
      imageAlt: meta.heading,
      jsonLd: [
        definedTermSetJsonLd(category, items),
        breadcrumbJsonLd('ko', [
          { name: 'IT 개념 사전', url: portalUrl('/tech') },
          { name: meta.heading, url: meta.canonical },
        ]),
      ],
      body: shellBody(
        `<nav><a href="/tech">IT 개념 사전</a></nav>` +
          `<h1>${escapeHtml(meta.heading)}</h1><p>${escapeHtml(meta.description)}</p>` +
          `<dl>${terms}</dl>` +
          `<h2>다른 분류</h2>${nav}`,
      ),
    });
    await emit(`prerender/tech/${techCategorySlug(category)}.html`, html);
  }
  if (byCategory.size > 0) console.log(`[seo] 용어집 ${byCategory.size}장 · 개념 ${concepts.length}개`);
}

/**
 * 분류별로 묶는다. 개념이 0개인 분류는 만들지 않는다 — 빈 용어집은 얇은 페이지 그 자체다.
 * 순서는 TECH_CATEGORY_KO 의 선언 순서를 따른다(개수순이면 개념이 늘 때마다 목차가 흔들린다).
 * @param {Array<Record<string, any>>} concepts
 * @returns {Map<string, Array<Record<string, any>>>}
 */
function groupConcepts(concepts) {
  const map = new Map();
  for (const category of Object.keys(TECH_CATEGORY_KO)) {
    const items = (concepts ?? [])
      .filter((c) => c.category === category)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
    if (items.length > 0) map.set(category, items);
  }
  return map;
}

/** @param {Map<string, Array<Record<string, any>>>} byCategory */
function techGlossaryNav(byCategory) {
  const items = [...byCategory.entries()]
    .map(
      ([category, items]) =>
        `<li><a href="${techGlossaryPath(category)}">${escapeHtml(TECH_CATEGORY_KO[category])}</a> · ${items.length}개</li>`,
    )
    .join('');
  return `<ul>${items}</ul>`;
}

async function renderPortalPages(shell, concepts = [], { searchArchitecture } = {}) {
  // /tech 는 용어집 13장으로 들어가는 문이다 — 그 링크가 없으면 sitemap 에만 있는 주소가 되고,
  // 내부 링크 없는 URL 은 잘 크롤되지 않는다.
  const glossaryNav = techGlossaryNav(groupConcepts(concepts));
  const nav = Object.keys(PORTAL_PAGES)
    .map((path) => `<a href="${path}">${escapeHtml(PORTAL_PAGES[path].title.split(' — ')[0])}</a>`)
    .join(' · ');
  for (const [path, meta] of Object.entries(PORTAL_PAGES)) {
    if (path === '/tech/search') {
      await emit(`prerender${path}.html`, renderTechSearchHtml(shell, searchArchitecture));
      continue;
    }
    if (path === '/about') {
      await emit(`prerender${path}.html`, renderAboutHtml(shell));
      continue;
    }
    if (path === '/data-sources') {
      await emit(`prerender${path}.html`, renderDataSourcesHtml(shell));
      continue;
    }
    const canonical = portalUrl(path);
    const html = compose(shell, {
      lang: 'ko',
      title: meta.title,
      description: meta.description,
      canonical,
      siteName: PORTAL_BRAND,
      image: ogCardUrl(PORTAL_ORIGIN, 'portal'),
      imageAlt: PORTAL_BRAND,
      // Person 전체 노드는 apex 홈 한 곳에만 둔다 — 나머지 페이지는 personRef 의 `@id` 로
      // 이 노드를 가리킨다. 프로필이 바뀌면 고칠 자리가 하나다.
      jsonLd: path === '/' ? [websiteJsonLd(), personJsonLd()] : [],
      body: shellBody(
        `<h1>${escapeHtml(meta.title.split(' — ')[0])}</h1><p>${escapeHtml(meta.description)}</p>` +
          `<nav>${nav}</nav>` +
          (path === '/tech' ? `<h2>분류별 용어집</h2>${glossaryNav}` : ''),
        // 서브도메인으로 가는 링크는 shellBody 의 바닥글이 모든 페이지에 붙인다
      ),
    });
    // 루트만 호스트 키로 — 같은 번들이 game/place 호스트도 서빙하므로 / 는 호스트로 갈린다
    await emit(path === '/' ? `prerender/_hosts/${PORTAL_HOST}.html` : `prerender${path}.html`, html);
  }
}

/**
 * 신뢰 문서(소개·데이터 출처)의 compose 메타. 광고 심사·크롤러가 초기 HTML 로 읽는 문서라
 * 다른 포털 페이지처럼 요약 한 줄이 아니라 본문 전체를 싣는다.
 */
function trustPageMeta(path) {
  const meta = PORTAL_PAGES[path];
  return {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical: portalUrl(path),
    siteName: PORTAL_BRAND,
    image: ogCardUrl(PORTAL_ORIGIN, 'portal'),
    imageAlt: PORTAL_BRAND,
    jsonLd: [],
  };
}

/** About 문단 조각 — 문자열은 글, `{ href, label }` 은 링크. */
function aboutInlineHtml(part) {
  return typeof part === 'string'
    ? escapeHtml(part)
    : `<a href="${escapeHtml(part.href)}">${escapeHtml(part.label)}</a>`;
}

/** `/about` — 절은 페이지와 같은 상수 `ABOUT_SECTIONS` 에서 온다. */
export function renderAboutHtml(shell) {
  const sections = ABOUT_SECTIONS.map((section) => {
    const paragraphs = section.paragraphs.map((parts) => `<p>${parts.map(aboutInlineHtml).join('')}</p>`).join('');
    const items = section.items?.length
      ? `<ul>${section.items
          .map((it) => `<li><a href="${escapeHtml(it.href)}">${escapeHtml(it.label)}</a> — ${escapeHtml(it.desc)}</li>`)
          .join('')}</ul>`
      : '';
    return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${items}</section>`;
  }).join('');
  return compose(shell, {
    ...trustPageMeta('/about'),
    body: shellBody(`<h1>사이트 소개</h1>${sections}`),
  });
}

/**
 * `/data-sources` — 원천 표 전체와 라이선스 고지. `rows` 는 이스케이프를 시험하려고 인자로 받는다.
 *
 * @param {string} shell
 * @param {{ data: string, source: string, license: string, note: string }[]} [rows]
 */
export function renderDataSourcesHtml(shell, rows = DATA_SOURCES) {
  const meta = PORTAL_PAGES['/data-sources'];
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.data)}</td><td>${escapeHtml(r.source)}</td>` +
        `<td>${escapeHtml(r.license)}</td><td>${escapeHtml(r.note)}</td></tr>`,
    )
    .join('');
  const notices = DATA_SOURCE_NOTICES.map(
    (n) =>
      `<li>${escapeHtml(n.text)}` +
      (n.href ? ` <a href="${escapeHtml(n.href)}" rel="noopener noreferrer">${escapeHtml(n.label)}</a>` : '') +
      '</li>',
  ).join('');
  return compose(shell, {
    ...trustPageMeta('/data-sources'),
    body: shellBody(
      `<h1>데이터 출처</h1><p>${escapeHtml(meta.description)}</p>` +
        '<table><thead><tr><th>데이터</th><th>원천</th><th>라이선스</th><th>비고</th></tr></thead>' +
        `<tbody>${body}</tbody></table>` +
        `<h2>라이선스 고지</h2><ul>${notices}</ul>`,
    ),
  });
}

function assertTechSearchGenerated(generated) {
  const ok =
    generated &&
    typeof generated.html === 'string' &&
    generated.html.length > 0 &&
    Array.isArray(generated.headings) &&
    typeof generated.updated === 'string' &&
    typeof generated.sourceHash === 'string';
  if (!ok) throw new Error('검색 아키텍처 생성물이 { html, headings, updated, sourceHash } 형식이 아니다');
}

/**
 * `/tech/search` — 본문은 레포 md 를 render-content 가 구운 html 이다. h1 은 그 안에 있으므로
 * 따로 넣지 않는다. 목차·JSON-LD 는 페이지(SearchArchitecturePage)와 같은 재료로 만든다.
 */
export function renderTechSearchHtml(shell, generated) {
  assertTechSearchGenerated(generated);
  const { html, headings, updated, sourceHash } = generated;
  const meta = PORTAL_PAGES['/tech/search'];
  const canonical = portalUrl('/tech/search');
  const toc = headings
    .filter((h) => h.level === 2 || h.level === 3)
    .map((h) => `<li><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`)
    .join('');
  return compose(shell, {
    lang: 'ko',
    title: meta.title,
    description: meta.description,
    canonical,
    siteName: PORTAL_BRAND,
    image: ogCardUrl(PORTAL_ORIGIN, 'portal'),
    imageAlt: PORTAL_BRAND,
    jsonLd: [
      techArticleJsonLd(updated),
      breadcrumbJsonLd('ko', [
        { name: '홈', url: portalUrl('/') },
        { name: 'IT', url: portalUrl('/tech') },
        { name: '검색 아키텍처', url: canonical },
      ]),
    ],
    body: shellBody(
      `<div data-source-hash="${escapeHtml(sourceHash)}">` +
        `<nav aria-label="목차"><p>목차</p><ol>${toc}</ol></nav>` +
        `<article>${html}</article></div>`,
    ),
  });
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
    // 색인 대상 호스트는 **빠짐없이** 적는다. 답변형 검색이 사이트를 훑는 진입 문서가
    // 이것 하나라, 여기 없는 호스트는 apex 에서 가는 길이 사이트맵에도 없어(호스트 경계를
    // 넘지 못한다) 발견 경로가 통째로 없다 — blog·deal·rank 가 그 상태였다.
    // resume 는 넣지 않는다 (ADR-0064 — 색인 대상이 아니다).
    '## 서비스',
    `- [한국 관광지 검색](${PLACE_ORIGIN}/): TourAPI 기반 관광지 검색 · 지도 탐색`,
    `- [무료 웹게임](${GAME_ORIGIN}/): 설치 없이 브라우저에서 실행되는 웹게임 아케이드`,
    `- [블로그](${BLOG_ORIGIN}/): 서버·검색·데이터를 직접 만들고 겪은 기록`,
    `- [랭킹 리더보드](${RANK_ORIGIN}/): 지역별 최저가 주유소 등 집계와 등락`,
    `- [혜택 링크 허브](${DEAL_ORIGIN}/): 카테고리별 혜택·제휴 링크 큐레이션`,
    `- [IT 개념 사전](${PORTAL_ORIGIN}/tech): 도메인별 개념을 그래프로 좁혀 가며 배우는 개념 아틀라스`,
    `- [검색 아키텍처](${PORTAL_ORIGIN}/tech/search): 관광지 검색과 통합 검색의 구조·흐름·지금 쓰는 기법`,
    `- [포트폴리오](${PORTAL_ORIGIN}/portfolio): 검색·전시·커머스·인프라·AI 도메인에서 만든 것들`,
    `- [스토어 데모](${PORTAL_ORIGIN}/shop): MSA 커머스 플랫폼 데모 (검색·추천·주문)`,
    '',
    '## 참고',
    `- 각 서비스 호스트마다 별도 sitemap 과 llms.txt 가 있다`,
    `- [데이터 출처](${PORTAL_ORIGIN}/data-sources): 원천·라이선스 목록`,
    `- [전체 URL 목록](${PORTAL_ORIGIN}/sitemap.xml)`,
    '',
  ].join('\n');
}
