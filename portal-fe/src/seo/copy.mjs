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
/** 브랜드는 도메인과 일치시킨다 — place/game/resume 서브도메인이 모두 이 아래다 (ADR-0066) */
export const PORTAL_BRAND = '1989v';

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
  return name ? `${name} — ${PORTAL_BRAND}` : `${PORTAL_BRAND} — 만든 서비스들`;
}

// ─── 이력서 호스트 ───────────────────────────────────────────────────────────

/**
 * 탭 제목만 담당한다. 이력서는 검색 노출 대상이 아니므로 description·구조화 데이터를 두지 않는다
 * (ADR-0064) — 게이트로 닫는 문서를 색인시키는 것은 모순이고, 실명·연락처가 검색결과에 남으면
 * 되돌리기 어렵다.
 */
export function resumeTitle(name) {
  return name ? `${name} — Resume 권기덕` : 'Resume — 권기덕';
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
      target: { '@type': 'EntryPoint', urlTemplate: `${PORTAL_ORIGIN}/tech?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** site 를 넘기지 않으면 게임 허브 소속으로 본다 — place 등 다른 호스트는 반드시 넘긴다 */
export function collectionPageJsonLd(lang, meta, canonical, site = { name: BRAND, url: GAME_ORIGIN }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: meta.title,
    description: meta.description,
    url: canonical,
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
  };
}

// ─── place (K-관광) ──────────────────────────────────────────────────────────

export const PLACE_ORIGIN = 'https://place.1989v.com';
export const PLACE_BRAND_KO = 'K-관광';
export const PLACE_BRAND_EN = 'Korea Travel Finder';

/** 카테고리 라벨 — PlacePage 의 필터 칩과 같은 문자열을 써야 색인 문구가 화면과 어긋나지 않는다 */
export const PLACE_CATEGORY_KO = {
  nature: '자연', history: '역사', culture: '문화', leisure: '레포츠',
  shopping: '쇼핑', food: '음식', stay: '숙박', etc: '기타',
};

export const PLACE_CATEGORY_EN = {
  nature: 'Nature', history: 'History', culture: 'Culture', leisure: 'Leisure',
  shopping: 'Shopping', food: 'Food', stay: 'Stay', etc: 'Etc',
};

export function placeBrand(lang) {
  return lang === 'en' ? PLACE_BRAND_EN : PLACE_BRAND_KO;
}

export function placeCategoryLabel(category, lang) {
  const table = lang === 'en' ? PLACE_CATEGORY_EN : PLACE_CATEGORY_KO;
  return table[category] ?? (lang === 'en' ? 'Attraction' : '관광지');
}

/** place 호스트에서는 루트가 허브다 (게임과 같은 규칙, ADR-0065) */
export function placePath(lang, sub = '') {
  return `${lang === 'en' ? '/en' : ''}${sub}` || '/';
}

export function placeUrl(lang, sub = '') {
  return `${PLACE_ORIGIN}${placePath(lang, sub)}`;
}

/**
 * 관광지 상세 주소. 경로에 attractions 를 넣어 영문 검색 키워드를 URL 에 남긴다.
 * id 는 검색 API 가 해석하는 문서 id — contentId 로는 조회되지 않는다.
 */
export function attractionPath(lang, id) {
  return placePath(lang, `/attractions/${id}`);
}

export function attractionUrl(lang, id) {
  return `${PLACE_ORIGIN}${attractionPath(lang, id)}`;
}

export function placeHreflangAlternates(sub = '') {
  return [
    { hreflang: 'ko', href: placeUrl('ko', sub) },
    { hreflang: 'en', href: placeUrl('en', sub) },
    { hreflang: 'x-default', href: placeUrl('en', sub) },
  ];
}

export function placeHubMeta(lang) {
  return lang === 'en'
    ? {
        title: `Korea Travel Guide — Find Attractions by Region & Theme | ${PLACE_BRAND_EN}`,
        description: clampDescription(
          'Search tourist attractions across South Korea by region, theme, or your current location. Official Korea Tourism Organization data with maps, photos and addresses.',
        ),
        heading: 'Explore Korea',
      }
    : {
        title: `한국 관광지 검색 — 지역·테마별 여행지 찾기 | ${PLACE_BRAND_KO}`,
        description: clampDescription(
          '전국 관광지를 지역·테마·현재 위치로 검색합니다. 한국관광공사 공식 데이터로 주소·지도·사진을 함께 확인하세요.',
        ),
        heading: '한국 관광지 탐색',
      };
}

export function attractionMeta(lang, attraction) {
  const name = attraction.title;
  const label = placeCategoryLabel(attraction.category, lang);
  const where = attraction.address || '';
  const overview = (attraction.overview || '').trim();
  const fallback =
    lang === 'en'
      ? `${name} is a ${label.toLowerCase()} attraction${where ? ` in ${where}` : ' in South Korea'}. See the map, photos and nearby places to visit.`
      : `${name}${where ? ` — ${where}` : ''}에 있는 ${label} 관광지입니다. 지도와 사진, 주변 명소를 함께 확인하세요.`;
  return {
    title:
      lang === 'en'
        ? `${name} — Visitor Guide, Map & Photos | ${PLACE_BRAND_EN}`
        : `${name} 관광 정보 — 주소·지도·사진 | ${PLACE_BRAND_KO}`,
    description: clampDescription(overview.length >= 60 ? overview : fallback),
    heading: name,
  };
}

export function touristAttractionJsonLd(lang, attraction) {
  const json = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: attraction.title,
    description: clampDescription(attraction.overview || attractionMeta(lang, attraction).description, 300),
    url: attractionUrl(lang, attraction.id),
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: placeBrand(lang), url: PLACE_ORIGIN },
  };
  if (attraction.imageUrl) json.image = attraction.imageUrl;
  if (attraction.tel) json.telephone = attraction.tel;
  if (attraction.address) {
    json.address = {
      '@type': 'PostalAddress',
      streetAddress: attraction.address,
      addressCountry: 'KR',
    };
  }
  if (attraction.latitude && attraction.longitude) {
    json.geo = {
      '@type': 'GeoCoordinates',
      latitude: attraction.latitude,
      longitude: attraction.longitude,
    };
  }
  return json;
}

// ─── 포털 페이지 카피 (프리렌더 · 런타임 공용) ───────────────────────────────

/**
 * apex 정적 페이지의 메타. 프리렌더가 초기 HTML 에 심고 useSeo 가 SPA 전환에서 같은 값을 쓴다.
 * 여기 없는 경로는 프리렌더 대상이 아니다.
 */
export const PORTAL_PAGES = {
  '/': {
    title: portalTitle(''),
    description:
      '직접 설계하고 운영 중인 서비스들 — 한국 관광 검색, 웹 게임 플랫폼, 코드 개념 사전, 커머스 데모. 백엔드 엔지니어 권기덕이 만들고 운영합니다.',
  },
  '/tech': {
    title: portalTitle('IT'),
    description:
      '코드베이스에서 추출한 IT 개념을 트리맵·그래프로 탐색하는 개념 사전. 백엔드 아키텍처 포트폴리오와 MSA 서비스 카탈로그를 함께 제공합니다.',
  },
  '/portfolio': {
    title: portalTitle('포트폴리오'),
    description: '검색·전시·커머스·인프라·AI 엔지니어링 도메인에서 만든 것들과 그때의 판단.',
  },
  '/shop': {
    title: portalTitle('스토어'),
    description: 'MSA 커머스 플랫폼 데모 스토어 — 상품 검색·추천·주문 플로우를 실제 서비스로 확인할 수 있습니다.',
  },
};

// ─── deal (혜택 링크 허브) ────────────────────────────────────────────────────

export const DEAL_ORIGIN = 'https://deal.1989v.com';
export const DEAL_BRAND = '혜택 링크';

/**
 * 공정위 「추천·보증 등에 관한 표시·광고 심사지침」에 따른 경제적 이해관계 고지.
 *
 * 화면 상단에 고정으로 띄우고, 제휴 링크 카드에는 배지를 따로 붙인다. 문구를 여기 두는 이유는
 * 네트워크마다 요구 문구가 다르고 약관이 바뀌기 때문 — 고칠 곳이 한 군데여야 한다.
 */
export const DEAL_DISCLOSURE =
  '이 페이지의 일부 링크는 제휴 링크입니다. 링크를 통해 구매가 발생하면 운영자가 광고 수수료를 받을 수 있으며, 구매자가 더 내는 금액은 없습니다.';

export const DEAL_AFFILIATE_BADGE = '제휴';

export function dealUrl(sub = '') {
  return `${DEAL_ORIGIN}${sub || '/'}`;
}

/**
 * P1 은 색인하지 않는다 (noindex).
 *
 * 자체 부가가치 없는 링크 모음은 구글이 thin affiliate 로 평가하고, 그 평가는 사이트 전체에
 * 번진다. 유입은 SNS·메신저 공유이므로 색인보다 OG 카드 품질이 중요하다.
 * P2 에서 오퍼별 상세 콘텐츠가 붙을 때 해제한다 (ADR-0069 §6).
 */
export function dealHubMeta() {
  return {
    title: `${DEAL_BRAND} — ${PORTAL_BRAND}`,
    description:
      '여행 · 커머스 · 디지털구독 · 교육 · 생활 카테고리의 혜택 링크를 한곳에 모았습니다. 쿠폰·적립·신규가입 프로모션을 분류별로 확인하세요.',
    canonical: dealUrl('/'),
    noindex: true,
  };
}
