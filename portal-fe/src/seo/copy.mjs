/**
 * SEO 카피 · 구조화 데이터 SSOT.
 *
 * 런타임 훅(useSeo)과 빌드타임 프리렌더(scripts/prerender-seo.mjs)가 동일한 문자열을
 * 만들어야 크롤러가 본 색인 결과와 SPA 전환 후 탭 타이틀이 어긋나지 않는다.
 * 그래서 순수 JS 로 두고 양쪽에서 import 한다 (빌드 스크립트는 TS 를 로드하지 못함).
 */

export const GAME_ORIGIN = 'https://game.1989v.com';
export const PORTAL_ORIGIN = 'https://1989v.com';
/** 이력서 호스트 (ADR-0064). 색인 대상이 아니다 — robots 로 전면 차단한다. */
export const RESUME_ORIGIN = 'https://resume.1989v.com';
export const BRAND = 'kgd Games';
export const PORTAL_BRAND = 'kgd.dev';

/** 장르 라벨 — gameApi.ts 가 재수출한다 (장르 추가 시 여기만 고친다) */
export const GENRE_LABELS_KO = {
  ARCADE: '아케이드',
  ACTION: '액션',
  PUZZLE: '퍼즐',
  RPG: 'RPG',
  EDUCATION: '학습',
  STRATEGY: '전략',
  DEFENSE: '디펜스',
  VERSUS: '대전',
  CASUAL: '캐주얼',
};

export const GENRE_LABELS_EN = {
  ARCADE: 'Arcade',
  ACTION: 'Action',
  PUZZLE: 'Puzzle',
  RPG: 'RPG',
  EDUCATION: 'Educational',
  STRATEGY: 'Strategy',
  DEFENSE: 'Tower Defense',
  VERSUS: 'Versus',
  CASUAL: 'Casual',
};

/** URL 세그먼트로 쓰는 장르 슬러그 ↔ enum */
export function genreSlug(genre) {
  return genre.toLowerCase();
}

export function genreFromSlug(slug) {
  const upper = String(slug || '').toUpperCase();
  return upper in GENRE_LABELS_KO ? upper : null;
}

export function genreLabelOf(genre, lang) {
  const table = lang === 'en' ? GENRE_LABELS_EN : GENRE_LABELS_KO;
  return table[genre] ?? genre;
}

/** meta description 상한 — 검색결과 스니펫이 잘리는 지점 */
const DESC_MAX = 155;

export function clampDescription(text, max = DESC_MAX) {
  const flat = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

// ─── URL ────────────────────────────────────────────────────────────────────

/** 게임 영역의 정규 URL. 한국어는 루트, 영문은 /en 프리픽스 (hreflang 쌍) */
export function gamePath(lang, sub = '') {
  return `${lang === 'en' ? '/en' : ''}${sub}` || '/';
}

export function gameUrl(lang, sub = '') {
  return `${GAME_ORIGIN}${gamePath(lang, sub)}`;
}

export function gameDetailUrl(lang, slug) {
  return gameUrl(lang, `/games/${slug}`);
}

/** ko/en 상호 참조 + x-default(영문 — 비한국어권 트래픽이 기본) */
export function hreflangAlternates(sub = '') {
  return [
    { hreflang: 'ko', href: gameUrl('ko', sub) },
    { hreflang: 'en', href: gameUrl('en', sub) },
    { hreflang: 'x-default', href: gameUrl('en', sub) },
  ];
}

// ─── 페이지별 카피 ───────────────────────────────────────────────────────────

export function hubMeta(lang, gameCount) {
  const n = gameCount || 0;
  return lang === 'en'
    ? {
        title: `Free Online Games — Play Instantly in Your Browser | ${BRAND}`,
        description: clampDescription(
          `Play ${n} free browser games instantly — no download, no sign-up. Puzzle, action, tower defense, RPG and strategy games in one arcade.`,
        ),
        heading: 'Free Online Games',
      }
    : {
        title: `무료 웹게임 아케이드 — 설치 없이 브라우저에서 바로 | ${BRAND}`,
        description: clampDescription(
          `설치도 가입도 없이 브라우저에서 바로 즐기는 무료 웹게임 ${n}종. 퍼즐·액션·디펜스·RPG·전략 게임을 한곳에서 플레이하세요.`,
        ),
        heading: '무료 웹게임 아케이드',
      };
}

export function genreMeta(lang, genre, games) {
  const label = genreLabelOf(genre, lang);
  const n = games.length;
  const picks = games
    .slice(0, 3)
    .map((g) => titleOf(g, lang))
    .join(', ');
  return lang === 'en'
    ? {
        title: `Free ${label} Games — Play Online, No Download | ${BRAND}`,
        description: clampDescription(
          `${n} free ${label.toLowerCase()} games you can play right in your browser${picks ? ` — including ${picks}` : ''}. No download, no sign-up.`,
        ),
        heading: `${label} Games`,
      }
    : {
        title: `무료 ${label} 게임 모음 — 브라우저에서 바로 플레이 | ${BRAND}`,
        description: clampDescription(
          `설치 없이 즐기는 ${label} 웹게임 ${n}종${picks ? `. ${picks} 등을 브라우저에서 바로 플레이하세요` : ''}.`,
        ),
        heading: `${label} 게임`,
      };
}

export function titleOf(game, lang) {
  return lang === 'en' && game.titleEn ? game.titleEn : game.title;
}

export function descriptionOf(game, lang) {
  if (lang === 'en') return game.descriptionEn || game.description || '';
  return game.description || '';
}

export function detailMeta(lang, game) {
  const name = titleOf(game, lang);
  const raw = descriptionOf(game, lang);
  const label = genreLabelOf(game.genre, lang);
  const fallback =
    lang === 'en'
      ? `Play ${name}, a free ${label.toLowerCase()} game, online in your browser — no download required.`
      : `${name} — 설치 없이 브라우저에서 바로 즐기는 무료 ${label} 게임.`;
  return {
    title:
      lang === 'en'
        ? `${name} — Play Free Online | ${BRAND}`
        : `${name} — 무료 온라인 플레이 | ${BRAND}`,
    description: clampDescription(raw.length >= 50 ? raw : `${raw} ${fallback}`.trim()),
    heading: name,
  };
}

// ─── 구조화 데이터 (schema.org) ──────────────────────────────────────────────

function absoluteAsset(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${GAME_ORIGIN}${url}`;
}

/**
 * 소셜 카드 이미지. SVG 는 대부분의 언퍼러(카카오톡/슬랙/X/페이스북)가 렌더하지 못하므로
 * 래스터 스크린샷이 있을 때만 og:image 를 노출한다.
 */
export function socialImage(game) {
  const url = game.thumbnailUrl || '';
  return /\.(png|jpe?g|webp)$/i.test(url) ? absoluteAsset(url) : null;
}

export function videoGameJsonLd(lang, game) {
  const image = socialImage(game);
  const json = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: titleOf(game, lang),
    description: clampDescription(descriptionOf(game, lang), 300),
    url: gameDetailUrl(lang, game.slug),
    inLanguage: lang,
    genre: genreLabelOf(game.genre, lang),
    gamePlatform: 'Web Browser',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    playMode: 'SinglePlayer',
    author: { '@type': 'Organization', name: game.developerName || 'kgd' },
    publisher: { '@type': 'Organization', name: BRAND, url: GAME_ORIGIN },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW', availability: 'https://schema.org/InStock' },
  };
  if (image) json.image = image;
  if (game.ratingCount > 0) {
    json.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(game.ratingAvg).toFixed(1),
      ratingCount: game.ratingCount,
      bestRating: 10,
      worstRating: 1,
    };
  }
  return json;
}

export function breadcrumbJsonLd(lang, trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function itemListJsonLd(lang, games) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: games.length,
    itemListElement: games.map((game, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: gameDetailUrl(lang, game.slug),
      name: titleOf(game, lang),
    })),
  };
}

// ─── 포털(apex) ─────────────────────────────────────────────────────────────

export function portalUrl(path = '/') {
  return `${PORTAL_ORIGIN}${path}`;
}

export function portalTitle(name) {
  return name ? `${name} — ${PORTAL_BRAND}` : `${PORTAL_BRAND} — IT 개념 사전 · 백엔드 포트폴리오`;
}

// ─── 이력서 호스트 ───────────────────────────────────────────────────────────

/**
 * 탭 제목만 담당한다. 이력서는 검색 노출 대상이 아니므로 description·구조화 데이터를 두지 않는다
 * (ADR-0064) — 게이트로 닫는 문서를 색인시키는 것은 모순이고, 실명·연락처가 검색결과에 남으면
 * 되돌리기 어렵다.
 */
export function resumeTitle(name) {
  return name ? `${name} — 권기덕` : '권기덕 — 백엔드 개발자';
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: PORTAL_BRAND,
    url: PORTAL_ORIGIN,
    inLanguage: 'ko',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${PORTAL_ORIGIN}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function collectionPageJsonLd(lang, meta, canonical) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: meta.title,
    description: meta.description,
    url: canonical,
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: BRAND, url: GAME_ORIGIN },
  };
}
