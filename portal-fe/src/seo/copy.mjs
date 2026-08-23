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

/** 소셜 카드 규격 — 전용 OG 이미지는 이 크기로 만든다 */
export const OG_IMAGE_W = 1200;
export const OG_IMAGE_H = 630;

/**
 * 소셜 카드 이미지. SVG 는 대부분의 언퍼러(카카오톡/슬랙/X/페이스북)가 렌더하지 못하므로
 * 래스터만 노출한다.
 *
 * 전용 OG 카드(`/games/thumbs/og/<slug>.png`, 1200×630)가 있으면 그것을 쓴다.
 * 목록용 썸네일은 320×180 이라 큰 카드 최소치(600×315)에 한참 못 미쳐,
 * 그대로 `summary_large_image` 로 내보내면 뭉개진 카드가 나온다.
 */
export function socialImage(game) {
  if (game.ogImageUrl) return absoluteAsset(game.ogImageUrl);
  const url = game.thumbnailUrl || '';
  return /\.(png|jpe?g|webp)$/i.test(url) ? absoluteAsset(url) : null;
}

/** 전용 OG 카드가 아니라 작은 썸네일로 대체된 상태인가 (큰 카드로 내보내면 안 된다) */
export function socialImageIsSmall(game) {
  return !game.ogImageUrl;
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
export const PLACE_BRAND_EN = 'K-Tour';

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

/**
 * 지역 페이지 주소 (ADR-0071 §9). 세그먼트는 **법정동 코드**다 — 시도 2자리(41), 시군구 5자리(41110).
 * 이름 슬러그를 쓰지 않는 이유: 행정구역명은 바뀐다(강원도 → 강원특별자치도, 2026년 실측).
 * 코드는 안정적이고, 검색엔진이 관련성을 읽는 곳은 URL 이 아니라 title/h1 이다.
 */
export function regionPath(lang, code) {
  return placePath(lang, `/regions/${code}`);
}

export function regionUrl(lang, code) {
  return `${PLACE_ORIGIN}${regionPath(lang, code)}`;
}

/** 화면·색인에 쓰는 지역 표시명 — 영문명이 비면 한글명을 그대로 쓴다(없는 번역을 지어내지 않는다) */
export function regionDisplayName(lang, region) {
  return (lang === 'en' && region.nameEn) || region.name;
}

/**
 * 지역 페이지 메타 — "제주 가볼 만한 곳"(ko) / "Things to Do in Jeju"(en) 류
 * 지역×의도 키워드가 title 앞머리에 오도록 짠다 (ADR-0071 §9).
 * @param {number | null} [attractionCount] 관광 분류 건수 — 모르면 null (0 과 다르다)
 */
export function regionMeta(lang, region, attractionCount = null) {
  const name = regionDisplayName(lang, region);
  const isSido = region.level === 'SIDO';
  const count = attractionCount != null && attractionCount > 0 ? attractionCount : null;
  if (lang === 'en') {
    return {
      title: `Things to Do in ${name}${count ? ` — ${count.toLocaleString('en')} Attractions & Map` : ' — Attractions & Map'} | ${PLACE_BRAND_EN}`,
      description: clampDescription(
        `Visit ${name}, South Korea: ${count ? `${count.toLocaleString('en')} ` : ''}tourist attractions${
          isSido ? ' by district' : ''
        } — nature, history, culture and leisure spots with maps, photos and directions from official tourism data.`,
      ),
      heading: `Things to do in ${name}`,
    };
  }
  return {
    title: `${name} 가볼 만한 곳${count ? ` ${count.toLocaleString('ko')}곳` : ''} — 관광지 지도·여행 명소 | ${PLACE_BRAND_KO}`,
    description: clampDescription(
      `${name} 여행에서 가볼 만한 자연·역사·문화·레포츠 관광지${count ? ` ${count.toLocaleString('ko')}곳` : ''}을 ${
        isSido ? '시·군·구별로 ' : ''
      }모았습니다. 한국관광공사 공식 데이터로 지도·사진과 가는 길을 확인하세요.`,
    ),
    heading: `${name} 가볼 만한 곳`,
  };
}

/** TouristDestination + 대표 관광지 ItemList — 지역 페이지의 구조화 데이터 (ADR-0071 §9) */
export function touristDestinationJsonLd(lang, region, attractions = []) {
  const name = regionDisplayName(lang, region);
  const json = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name,
    url: regionUrl(lang, region.code),
    inLanguage: lang,
    address: { '@type': 'PostalAddress', addressRegion: name, addressCountry: 'KR' },
    isPartOf: { '@type': 'WebSite', name: placeBrand(lang), url: PLACE_ORIGIN },
  };
  if (region.latitude != null && region.longitude != null) {
    json.geo = { '@type': 'GeoCoordinates', latitude: region.latitude, longitude: region.longitude };
  }
  if (attractions.length > 0) {
    json.includesAttraction = attractions.slice(0, 10).map((a) => ({
      '@type': 'TouristAttraction',
      name: a.title,
      url: attractionUrl(lang, a.id),
    }));
  }
  return json;
}

/**
 * place 허브·목록의 ItemList — 게임의 itemListJsonLd 는 slug/장르 등 게임 필드에 묶여 있어
 * 쓰지 못한다. 이름이 있는 문서만 싣는다 (id 뿐인 항목은 리치 결과에 도움이 안 된다).
 */
export function placeItemListJsonLd(lang, attractions) {
  const named = attractions.filter((a) => a.title);
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: named.length,
    itemListElement: named.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: attractionUrl(lang, a.id),
      name: a.title,
    })),
  };
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
        title: `Things to Do in Korea — Attractions by Region & Map | ${PLACE_BRAND_EN}`,
        description: clampDescription(
          'Find things to do across South Korea — search tourist attractions by region, theme, or your current location. Official Korea Tourism Organization data with maps, photos and addresses.',
        ),
        heading: 'Explore Korea',
      }
    : {
        title: `한국 관광지 검색 — 지역별 가볼 만한 곳·여행지 지도 | ${PLACE_BRAND_KO}`,
        description: clampDescription(
          '전국 가볼 만한 곳을 지역·테마·내 주변으로 검색합니다. 한국관광공사 공식 데이터로 주소·지도·사진과 가는 길을 함께 확인하세요.',
        ),
        heading: '한국 관광지 탐색',
      };
}

/**
 * 관광지 상세 메타 — 고유명사 검색("경복궁", "Gyeongbokgung")의 착지점이므로
 * 이름 뒤에 의도 키워드(관광 정보·가는 길·주변 / Visit·Things to Do Nearby)를 붙인다.
 * titleLocal(원어 병기명)은 제목에 다시 합치지 않는다 — 구조화 데이터의 alternateName 이 담당.
 */
export function attractionMeta(lang, attraction) {
  const name = attraction.title;
  const label = placeCategoryLabel(attraction.category, lang);
  const where = attraction.address || '';
  const overview = (attraction.overview || '').trim();
  const fallback =
    lang === 'en'
      ? `${name} is a ${label.toLowerCase()} attraction${where ? ` at ${where}` : ' in South Korea'}. See the map, photos, directions and things to do nearby.`
      : `${name}${where ? ` — ${where}` : ''}에 있는 ${label} 관광지입니다. 주소·지도·사진과 가는 길, 주변 가볼 만한 곳을 함께 확인하세요.`;
  return {
    title:
      lang === 'en'
        ? `Visit ${name} — Map, Photos & Things to Do Nearby | ${PLACE_BRAND_EN}`
        : `${name} 관광 정보 — 가는 길 · 주변 가볼 만한 곳 | ${PLACE_BRAND_KO}`,
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
  // 원어 병기명(예: en "Dosan Park" 의 "도산공원") — 화면에는 별도 요소로 그리고,
  // 검색엔진에는 alternateName 으로 알린다. name 에 괄호로 다시 합치지 않는다.
  const local = (attraction.titleLocal || '').trim();
  if (local && local !== attraction.title) json.alternateName = local;
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
  // 광고 심사는 이 문서를 **크롤러로** 확인한다 — SPA 렌더만 되고 초기 HTML 이 비어 있으면
  // '방침 없음'으로 읽힐 수 있어 다른 포털 페이지와 같이 프리렌더 대상에 둔다 (ADR-0076).
  '/privacy': {
    title: portalTitle('개인정보처리방침'),
    description:
      '1989v.com 과 하위 서비스가 수집하는 정보, 사용하는 쿠키와 제3자 도구, 보관 기간과 이용자의 선택권을 정리한 문서입니다.',
  },
};

// ─── deal (혜택 링크 허브) ────────────────────────────────────────────────────

export const DEAL_ORIGIN = 'https://deal.1989v.com';
export const DEAL_BRAND = '혜택 링크';

/**
 * 공정위 「추천·보증 등에 관한 표시·광고 심사지침」에 따른 경제적 이해관계 고지.
 *
 * 페이지 머리말이 아니라 **해당 카드 안에** 붙는다. 총괄 문구는 "일부 링크는"이라고밖에
 * 말하지 못해 어느 링크가 그 일부인지 알려주지 못하고, 수수료를 받지 않는 링크까지
 * 광고로 읽히게 한다. 지침이 요구하는 것도 추천이 이루어지는 지점에 근접한 표시다.
 *
 * "제휴"만 적지 않는 이유는 그 단어가 경제적 이해관계를 전달하지 못하기 때문이다.
 * 문구를 여기 두는 것은 네트워크마다 요구 문구가 다르고 약관이 바뀌어서다 — 고칠 곳은 한 군데.
 */
export const DEAL_AFFILIATE_NOTE = '제휴 링크 · 구매 시 수수료를 받습니다';

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

// ─── rank (랭킹 리더보드) ─────────────────────────────────────────────────────

export const RANK_ORIGIN = 'https://rank.1989v.com';
export const RANK_BRAND = '랭킹';

/** 출처 표시 의무가 붙은 원천이라 화면 어딘가에 반드시 나와야 한다 (ADR-0081). */
export const RANK_GAS_SOURCE = '출처: 한국석유공사 오피넷';

/** 이탈 시간은 근사값이다. 문구가 그 불확실성을 감추면 안 된다. */
export const RANK_DETOUR_NOTE = '이탈 시간은 경로에서 떨어진 거리로 추정한 근사값입니다.';

/**
 * 우리가 아는 주유소의 범위.
 *
 * 원천이 지역 단위로 주는 것은 **최저가 상위 20곳**이라, 전국 모든 주유소를 아는 게 아니다.
 * 이걸 안 밝히면 목록에 없는 싼 주유소를 "없다"고 말한 셈이 된다.
 */
export const RANK_COVERAGE_NOTE =
  '시군구별 최저가 상위 20곳을 매일 받아 보여줍니다 — 전국 모든 주유소를 포함하지는 않습니다.';

export function rankUrl(sub = '') {
  return `${RANK_ORIGIN}${sub || '/'}`;
}

/**
 * deal 과 달리 **색인 대상이다.**
 *
 * 링크 모음이 아니라 집계와 등락이 우리가 만든 것이고, "OO구 최저가 주유소"는 검색 의도가
 * 뚜렷하다. thin affiliate 판정을 걱정해야 했던 쪽과 성격이 반대다 (ADR-0081 §8).
 */
export function rankHubMeta() {
  return {
    title: `${RANK_BRAND} — ${PORTAL_BRAND}`,
    description:
      '지역별 최저가 주유소 리더보드. 어제 대비 순위 등락과 함께 시군구·유종별로 확인하고, 가는 길 위의 싼 주유소도 찾아보세요.',
    canonical: rankUrl('/'),
  };
}

export function rankBoardMeta(board) {
  const top = board.topName ?? board.entries?.[0]?.subjectName;
  return {
    title: `${board.title} — ${RANK_BRAND}`,
    description: top
      ? `${board.title} 1위는 ${top}입니다. 순위는 매일 갱신되며 어제 대비 등락을 함께 보여줍니다.`
      : `${board.title} 순위. 매일 갱신되며 어제 대비 등락을 함께 보여줍니다.`,
    canonical: rankUrl(`/boards/${board.slug}`),
  };
}

export function rankRouteMeta() {
  return {
    title: `경로 위 주유소 찾기 — ${RANK_BRAND}`,
    description:
      '출발지와 도착지를 지정하면 그 경로에서 조건에 맞는 주유소를 값싼 순으로 찾아줍니다. 이탈 시간과 절약액을 함께 보여줍니다.',
    canonical: rankUrl('/route'),
  };
}

// ─── blog (블로그 플랫폼) ─────────────────────────────────────────────────────

export const BLOG_ORIGIN = 'https://blog.1989v.com';
export const BLOG_BRAND = '1989v 블로그';

/**
 * 이 절의 문구는 **서버 렌더(`blog/feature` 의 `BlogSeoCopy`)와 쌍이다.**
 *
 * 글 상세·작성자 공간은 백엔드가 meta 를 주입한 HTML 을 내보내고(ADR-0072 §6), SPA 가
 * 마운트된 뒤에는 여기 함수들이 같은 값을 다시 쓴다. 한쪽만 고치면 크롤러가 본 제목과
 * 탭 제목이 갈라진다 — 고칠 때는 두 곳을 함께 고친다.
 */
export function blogUrl(sub = '') {
  return `${BLOG_ORIGIN}${sub || '/'}`;
}

export function blogPostUrl(slug) {
  return blogUrl(`/posts/${slug}`);
}

export function blogAuthorUrl(handle) {
  return blogUrl(`/authors/${handle}`);
}

export function blogCategoryUrl(path) {
  return blogUrl(`/c${path}`);
}

export function blogHubMeta(postCount) {
  const n = postCount || 0;
  return {
    title: `${BLOG_BRAND} — 기술과 일상의 기록`,
    description: clampDescription(
      n > 0
        ? `서버·검색·데이터부터 취미와 일상까지, 직접 만들고 겪은 것을 기록합니다. 글 ${n}편을 분류별로 모아 봅니다.`
        : '서버·검색·데이터부터 취미와 일상까지, 직접 만들고 겪은 것을 기록합니다.',
    ),
    canonical: blogUrl('/'),
  };
}

export function blogPostMeta(post) {
  return {
    title: `${post.title} | ${BLOG_BRAND}`,
    description: clampDescription(post.summary ?? ''),
    canonical: blogPostUrl(post.slug),
    image: post.coverImageUrl ?? null,
    type: 'article',
  };
}

export function blogCategoryMeta(category) {
  return {
    title: `${category.name} | ${BLOG_BRAND}`,
    description: clampDescription(
      category.description ?? `${category.name} 분류의 글 ${category.postCount ?? 0}편.`,
    ),
    canonical: blogCategoryUrl(category.path),
  };
}

export function blogAuthorMeta(author, postCount) {
  return {
    title: `${author.displayName}의 글 | ${BLOG_BRAND}`,
    description: clampDescription(author.bio || `${author.displayName}이(가) 쓴 글 ${postCount ?? 0}편`),
    canonical: blogAuthorUrl(author.handle ?? ''),
    image: author.avatarUrl ?? null,
  };
}

/** 스튜디오·로그인처럼 색인하면 안 되는 화면 */
export function blogPrivateMeta(title) {
  return {
    title: `${title} | ${BLOG_BRAND}`,
    canonical: blogUrl('/'),
    noindex: true,
  };
}

export function blogPostingJsonLd(post) {
  // 조건부 프로퍼티는 스프레드로 넣는다 — 리터럴에 뒤늦게 대입하면 추론 타입이 닫혀
  // .ts 소비자(테스트 포함)가 해당 프로퍼티를 못 본다.
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.summary ?? '',
    mainEntityOfPage: { '@type': 'WebPage', '@id': blogPostUrl(post.slug) },
    url: blogPostUrl(post.slug),
    author: { '@type': 'Person', name: post.author?.displayName ?? '' },
    publisher: { '@type': 'Organization', name: BLOG_BRAND, url: BLOG_ORIGIN },
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.categoryName ? { articleSection: post.categoryName } : {}),
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
    ...(post.ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: post.ratingAverage.toFixed(1),
            ratingCount: post.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export function blogBreadcrumbJsonLd(crumbs) {
  if (!crumbs || crumbs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: blogCategoryUrl(crumb.path),
    })),
  };
}

// ─── AdSense (수익화) ────────────────────────────────────────────────────────

/**
 * AdSense 게시자 ID (`ca-pub-…`).
 *
 * 빈 문자열이면 광고를 아예 켜지 않는다 — index.html 의 로더가 조기 반환하고
 * ads.txt 도 찍히지 않는다. 승인 전에 스크립트만 먼저 나가면 게시자 ID 가 없는
 * 요청이 반복돼 계정 심사에 불리하고, 내용 없는 ads.txt 는 그 자체가 크롤러에게
 * "권한 있는 판매자 없음" 선언이 되어 광고 게재를 막는다.
 *
 * GA 측정 ID 와 마찬가지로 브라우저에 노출되는 공개값이라 레포에 그대로 둔다.
 * 여기와 index.html 두 곳에 같은 값이 필요하다 — index.html 은 정적 HTML 이라
 * 이 모듈을 import 할 수 없어서다(테마 판정 스크립트가 useHeritageSurface 의
 * 사본을 두는 것과 같은 이유). 고칠 때 두 곳을 함께 고친다.
 */
export const ADSENSE_CLIENT = 'ca-pub-4627924728297793';

/**
 * 광고를 게재하는 호스트.
 *
 * resume 는 제외한다 — 실명·연락처가 들어간 토큰 게이트 문서라(ADR-0064) 광고
 * 네트워크에 열람 맥락을 넘기지 않는다. GA 를 같은 이유로 빼둔 것과 같은 기준이다.
 * index.html 의 로더가 이 목록의 사본으로 판정하므로 호스트를 늘리면 함께 고친다.
 */
export const ADSENSE_HOSTS = [PORTAL_ORIGIN, GAME_ORIGIN, PLACE_ORIGIN, DEAL_ORIGIN, BLOG_ORIGIN].map(
  (origin) => new URL(origin).host,
);

/**
 * ads.txt — 이 도메인의 광고 재고를 팔 권한이 있는 판매자 선언 (IAB Tech Lab).
 *
 * 파일이 없으면 대부분의 수요처가 입찰을 건너뛰어 실질 수익이 0 에 수렴한다.
 * 서브도메인은 루트 도메인의 ads.txt 를 따르지만, 여기서는 호스트별로 같은 내용을
 * 찍는다 — nginx 가 `/ads.txt` 를 $host 로 갈라 서빙하는데(robots 와 동일 구조)
 * 서브도메인 키가 없으면 SPA 폴백이 index.html 을 내보내 크롤러가 HTML 을 받는다.
 */
/**
 * 광고 단위 ID (`data-ad-slot`) — 지면마다 하나씩.
 *
 * 값은 AdSense 콘솔에서 광고 단위를 만들어야 나온다. 승인 전에는 전부 빈 문자열이고,
 * 그때 AdSlot 은 아무것도 그리지 않는다. **자리는 코드에 이미 박혀 있고 ID 만 비어 있는**
 * 상태이므로, 승인 후 여기 네 줄을 채우면 그 순간 전부 켜진다.
 *
 * 이름은 '어디냐'로 짓는다 — 크기나 모양(가로배너/사각)으로 지으면 나중에 형태를 바꿀 때
 * 이름이 거짓이 된다.
 */
export const ADSENSE_SLOTS = {
  /** 블로그 글 본문이 끝난 지점 — 다 읽은 뒤라 읽기를 방해하지 않는다 */
  blogPostEnd: '',
  /** 게임 목록 끝. **게임 프레임 안에는 절대 두지 않는다** — 조작 방해이자 정책 위반이다 */
  gameHubEnd: '',
  /** 관광지 상세 끝 — 지도와 주변 목록을 다 본 뒤 */
  attractionEnd: '',
  /** 혜택 허브 끝 — 제휴 고지가 붙은 카드와 섞이지 않게 목록 바깥에 둔다 */
  dealHubEnd: '',
};

export function adsTxt(client = ADSENSE_CLIENT) {
  if (!client) return null;
  // DIRECT = 게시자가 직접 계약한 판매자, 끝의 값은 Google 의 인증 기관 ID (고정)
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}
