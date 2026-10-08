/**
 * SEO 카피 · 구조화 데이터 SSOT.
 *
 * 런타임 훅(useSeo)과 빌드타임 프리렌더(scripts/prerender-seo.mjs)가 동일한 문자열을
 * 만들어야 크롤러가 본 색인 결과와 SPA 전환 후 탭 타이틀이 어긋나지 않는다.
 * 그래서 순수 JS 로 두고 양쪽에서 import 한다 (빌드 스크립트는 TS 를 로드하지 못함).
 */

/**
 * 라우트마다 개수가 달라지는 head 태그(hreflang·JSON-LD)에 붙는 표시.
 *
 * useSeo 는 이 표시가 붙은 것만 지우고 다시 심는다. 그래서 **미리 심어 둔 쪽도 같은 표시를
 * 달아야 한다** — 안 달면 하이드레이션이 기존 것을 못 찾아 같은 블록을 한 벌 더 붙인다.
 * 프리렌더(prerender-seo.mjs)와 블로그 서버 렌더(BlogMetaRenderer.kt)가 이 값을 쓴다.
 */
export const SEO_MULTI_ATTR = 'data-seo-multi';

export const GAME_ORIGIN = 'https://game.1989v.com';
export const PORTAL_ORIGIN = 'https://1989v.com';
/** 이력서 호스트 (ADR-0064). 색인 대상이 아니다 — robots 로 전면 차단한다. */
export const RESUME_ORIGIN = 'https://resume.1989v.com';
export const BRAND = '1989v 게임';
/** 브랜드는 도메인과 일치시킨다 — place/game/resume 서브도메인이 모두 이 아래다 (ADR-0066) */
export const PORTAL_BRAND = '1989v';

/** 장르 라벨 — gameApi.ts 가 재수출한다 (장르 추가 시 여기만 고친다) */
export const GENRE_LABELS_KO = {
  ARCADE: '아케이드',
  ACTION: '액션',
  PUZZLE: '퍼즐',
  RPG: 'RPG',
  STRATEGY: '전략',
  DEFENSE: '디펜스',
  VERSUS: '대전',
  CASUAL: '캐주얼',
  DECIDER: '순서 정하기',
};

export const GENRE_LABELS_EN = {
  ARCADE: 'Arcade',
  ACTION: 'Action',
  PUZZLE: 'Puzzle',
  RPG: 'RPG',
  STRATEGY: 'Strategy',
  DEFENSE: 'Tower Defense',
  VERSUS: 'Versus',
  CASUAL: 'Casual',
  DECIDER: 'Decider',
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

/**
 * 허브(`/`, `/en`)의 소셜 카드. 게임별 카드와 달리 슬러그가 없어 고정 경로다.
 * 사이트를 통째로 공유하는 순간이 링크가 생기는 자리라, 여기가 비면 텍스트 카드만 나간다.
 */
export const HUB_OG_IMAGE = `${GAME_ORIGIN}/games/thumbs/og/hub.png`;

/**
 * 호스트별 기본 소셜 카드 (`scripts/make-og-cards.mjs` 가 굽는다).
 *
 * 사진이 있는 문서(관광지·표지 있는 글·게임)는 그 사진이 이기고, **없을 때 이 카드가 받는다.**
 * 없으면 텍스트 카드로 나가는데, 링크를 만드는 순간은 대개 메신저 공유라 카드 품질이 곧 유입이다.
 *
 * key 는 `public/og/<key>.png` 와 같아야 한다 — 없는 파일을 og:image 로 선언하면 언퍼러는
 * 그걸 '카드 없음' 이 아니라 **깨진 카드**로 그린다. 목록의 단일 원본은 make-og-cards.mjs 다.
 * 주소는 그 면의 호스트로 만든다 — 한 벌의 번들이 모든 호스트를 서빙하므로 어디서나 열린다.
 */
export function ogCardUrl(origin, key) {
  return `${origin}/og/${key}.png`;
}

/** 이미지 MIME — 확장자에서 읽는다. 고정으로 png 를 적으면 jpg 사진에 거짓말을 하게 된다 */
export function imageMimeType(url) {
  const ext = (String(url || '').split('?')[0].match(/\.([a-z0-9]+)$/i) || [])[1];
  if (!ext) return null;
  const lower = ext.toLowerCase();
  if (lower === 'jpg' || lower === 'jpeg') return 'image/jpeg';
  if (lower === 'png' || lower === 'webp' || lower === 'gif') return `image/${lower}`;
  return null;
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
    // 개발자 이름이 시드에 따로 있으면 그것을, 없으면 운영자 본인이다
    author: game.developerName && game.developerName !== 'kgd'
      ? { '@type': 'Organization', name: game.developerName }
      : personRef,
    publisher: { '@type': 'Organization', name: BRAND, url: GAME_ORIGIN, founder: personRef },
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

/**
 * 사이트 신원. 구글은 검색결과에 표기할 사이트명을 홈페이지의 WebSite 에서 먼저 읽으므로
 * **호스트 루트마다 자기 이름·자기 url** 로 넣어야 한다. 인자를 비우면 apex 다.
 */
/**
 * 사이트를 만들고 운영하는 사람. **호스트를 가리지 않는 하나의 `@id`** 다.
 *
 * 게임은 `Organization "kgd"`, 블로그는 이름만 있는 `Person`, 관광지는 저자 표시가 아예
 * 없어서 — 검색엔진이 보기에 세 사이트를 **서로 다른 주체**가 만든 것이었다. 같은 `@id` 로
 * 묶어야 한쪽에서 쌓인 신뢰가 나머지에 닿는다 (E-E-A-T).
 *
 * `sameAs` 는 **실재하는 프로필만** 적는다 — 없는 주소를 적으면 대조에 실패해 신호가
 * 도움이 아니라 잡음이 된다. 화면(AboutSection)에 걸려 있는 것과 같은 주소다.
 */
export const PERSON_ID = `${PORTAL_ORIGIN}/#person`;

export function personJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PERSON_ID,
    name: '권기덕',
    alternateName: 'kgd',
    url: `${PORTAL_ORIGIN}/portfolio`,
    jobTitle: '백엔드 엔지니어',
    sameAs: [
      'https://github.com/1989v',
      'https://www.linkedin.com/in/gideok-kwon-57531b2a9/',
    ],
  };
}

/**
 * 다른 문서에서 이 사람을 가리키는 참조.
 *
 * `sameAs` 같은 본문은 apex 홈의 전체 노드가 갖고, 여기는 `@id` 와 이름만 둔다 —
 * 소비자는 `@id` 로 두 노드를 합친다. 페이지마다 전체 노드를 복제하면 프로필이 바뀔 때
 * 고칠 자리가 늘어난다.
 */
export const personRef = { '@type': 'Person', '@id': PERSON_ID, name: '권기덕' };

/** 운영자 본인의 블로그 핸들. 등록제 다중 저자라 남의 글을 본인 것으로 묶으면 안 된다 */
export const OWNER_BLOG_HANDLE = 'kgd';

export function websiteJsonLd(site) {
  const { name, url, searchUrlTemplate } = site ?? {
    name: PORTAL_BRAND,
    url: PORTAL_ORIGIN,
    searchUrlTemplate: `${PORTAL_ORIGIN}/search?q={search_term_string}`,
  };
  const json = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
    url,
    inLanguage: 'ko',
  };
  if (searchUrlTemplate) {
    json.potentialAction = {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: searchUrlTemplate },
      'query-input': 'required name=search_term_string',
    };
  }
  return json;
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
  festival: '행사', course: '여행코스',
};

export const PLACE_CATEGORY_EN = {
  nature: 'Nature', history: 'History', culture: 'Culture', leisure: 'Leisure',
  shopping: 'Shopping', food: 'Food', stay: 'Stay', etc: 'Etc',
  festival: 'Events', course: 'Courses',
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
      image: ogCardUrl(PLACE_ORIGIN, 'place'),
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
    image: ogCardUrl(PLACE_ORIGIN, 'place'),
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
        image: ogCardUrl(PLACE_ORIGIN, 'place'),
      }
    : {
        title: `한국 관광지 검색 — 지역별 가볼 만한 곳·여행지 지도 | ${PLACE_BRAND_KO}`,
        description: clampDescription(
          '전국 가볼 만한 곳을 지역·테마·내 주변으로 검색합니다. 한국관광공사 공식 데이터로 주소·지도·사진과 가는 길을 함께 확인하세요.',
        ),
        heading: '한국 관광지 탐색',
        image: ogCardUrl(PLACE_ORIGIN, 'place'),
      };
}

/**
 * 관광지 상세 메타 — 고유명사 검색("경복궁", "Gyeongbokgung")의 착지점이므로
 * 이름 뒤에 의도 키워드(관광 정보·가는 길·주변 / Visit·Things to Do Nearby)를 붙인다.
 * titleLocal(원어 병기명)은 제목에 다시 합치지 않는다 — 구조화 데이터의 alternateName 이 담당.
 */
export function attractionMeta(lang, attraction) {
  const name = attraction.title;
  const where = attraction.address || '';
  // 원천 개요는 평문이 아니다 — `<br />`·`&rsquo;` 가 섞여 온다. 스니펫에 그대로 실리면
  // 검색결과에 태그가 글자로 보인다.
  const overview = sourceText(attraction.overview);
  const { title, fallback } = attractionMetaCopy(lang, attraction, name, where);
  return {
    title,
    description: clampDescription(overview.length >= 60 ? overview : fallback),
    heading: name,
  };
}

/**
 * 유형별 제목과 개요가 짧을 때의 설명. 행사·숙박·여행코스는 검색 의도가 관광지와 달라(일정·장소 / 입실·위치 /
 * 코스 순서) 제목의 의도 키워드를 유형에 맞춘다. 유형은 원천 유형 코드로 고른다(구조화 데이터와 같은 축).
 * 서버 렌더(search `AttractionPageRenderer.attractionMeta`)가 같은 문자열을 만든다 — 골든 픽스처로 대조한다.
 */
function attractionMetaCopy(lang, attraction, name, where) {
  const type = attraction.contentTypeId;
  const en = lang === 'en';
  if (PLACE_EVENT_TYPES.includes(type)) {
    return en
      ? {
          title: `${name} — Dates, Venue & Things to Do Nearby | ${PLACE_BRAND_EN}`,
          fallback: `${name} is a festival or event${where ? ` at ${where}` : ' in South Korea'}. See the dates, venue, map and things to do nearby.`,
        }
      : {
          title: `${name} 행사 정보 — 일정 · 장소 · 주변 가볼 만한 곳 | ${PLACE_BRAND_KO}`,
          fallback: `${name}${where ? ` — ${where}` : ''}에서 열리는 축제·행사입니다. 일정·장소와 지도, 주변 가볼 만한 곳을 함께 확인하세요.`,
        };
  }
  if (PLACE_STAY_TYPES.includes(type)) {
    return en
      ? {
          title: `${name} — Stay Info, Check-in & Things to Do Nearby | ${PLACE_BRAND_EN}`,
          fallback: `${name} is a place to stay${where ? ` at ${where}` : ' in South Korea'}. See check-in times, the map and things to do nearby.`,
        }
      : {
          title: `${name} 숙박 정보 — 입실·퇴실 · 주변 가볼 만한 곳 | ${PLACE_BRAND_KO}`,
          fallback: `${name}${where ? ` — ${where}` : ''}에 있는 숙소입니다. 입실·퇴실 시간과 지도, 주변 가볼 만한 곳을 함께 확인하세요.`,
        };
  }
  if (PLACE_COURSE_TYPES.includes(type)) {
    // 원천 코스 이름은 「… 코스」로 끝나는 것이 많다 — 그때 「여행코스」를 또 붙이면 「… 코스 여행코스」가 된다
    const course = name.trimEnd().endsWith('코스') ? name : `${name} 여행코스`;
    return en
      ? {
          title: `${name} — Travel Course, Stops & Time Needed | ${PLACE_BRAND_EN}`,
          fallback: `${name} is a travel course in South Korea. See the stops in order, total distance and time needed.`,
        }
      : {
          title: `${course} — 코스 구성 · 거리 · 소요 시간 | ${PLACE_BRAND_KO}`,
          fallback: `${course}입니다. 코스를 이루는 관광지를 순서대로 보고 총 거리와 소요 시간을 확인하세요.`,
        };
  }
  const label = placeCategoryLabel(attraction.category, lang);
  return en
    ? {
        title: `Visit ${name} — Map, Photos & Things to Do Nearby | ${PLACE_BRAND_EN}`,
        fallback: `${name} is a ${label.toLowerCase()} attraction${where ? ` at ${where}` : ' in South Korea'}. See the map, photos, directions and things to do nearby.`,
      }
    : {
        title: `${name} 관광 정보 — 가는 길 · 주변 가볼 만한 곳 | ${PLACE_BRAND_KO}`,
        fallback: `${name}${where ? ` — ${where}` : ''}에 있는 ${label} 관광지입니다. 주소·지도·사진과 가는 길, 주변 가볼 만한 곳을 함께 확인하세요.`,
      };
}

/** 원천(TourAPI) 사진 호스트의 http 주소 앞부분 */
const TONG_HTTP = 'http://tong.visitkorea.or.kr/';

/**
 * 원천 사진 주소 → 표시용. 문자열이 `http://tong.visitkorea.or.kr/` 로 **시작할 때만** `https:` 로 바꾼다 —
 * 원천이 http 로 준 사진을 https 페이지에 그리면 브라우저가 혼합 콘텐츠로 경고한다.
 * 원천 값은 덮지 않고 표시 시점에만 바꾼다. 다른 호스트·null·빈 값은 그대로다.
 * HTML 문자열에 넣을 때는 이 뒤에 escape 를 거친다. search `AttractionSeoText.secureImageUrl` 이 같은 규칙이고
 * `SecureImageParityTest` 가 이 함수의 출력과 비교한다.
 *
 * @template {string | null | undefined} T
 * @param {T} url
 * @returns {T}
 */
export function secureImageUrl(url) {
  if (typeof url === 'string' && url.startsWith(TONG_HTTP)) {
    return /** @type {T} */ (`https:${url.slice('http:'.length)}`);
  }
  return url;
}

/** 원천 관광 유형 — 상세가 유형별 본문·구조화 데이터를 고르는 축. 국문·영문 코드 체계가 다르다. */
export const PLACE_EVENT_TYPES = ['15', '85'];
export const PLACE_STAY_TYPES = ['32', '80'];
export const PLACE_COURSE_TYPES = ['25'];

/**
 * 관광지 상세의 주 구조화 데이터 — 유형에 따라 행사 `Event` · 숙박 `LodgingBusiness` ·
 * 여행코스 `TouristTrip`, 나머지는 `TouristAttraction`. 서버 렌더(search `AttractionPageRenderer`)가
 * 같은 규칙으로 같은 필드를 만들고 `AttractionJsonLdParityTest` 가 이 함수의 출력과 비교한다.
 */
export function attractionJsonLd(lang, attraction) {
  const type = attraction.contentTypeId;
  if (PLACE_EVENT_TYPES.includes(type)) return eventJsonLd(lang, attraction);
  if (PLACE_STAY_TYPES.includes(type)) return lodgingJsonLd(lang, attraction);
  if (PLACE_COURSE_TYPES.includes(type)) return touristTripJsonLd(lang, attraction);
  return touristAttractionJsonLd(lang, attraction);
}

/** 유형과 무관하게 같은 앞부분 — 이름 · 설명 · 주소(URL) · 언어 · 사이트 · 원어 병기명 · 대표 사진 */
function placeJsonLdBase(lang, attraction, type) {
  const json = {
    '@context': 'https://schema.org',
    '@type': type,
    name: attraction.title,
    description: clampDescription(sourceText(attraction.overview) || attractionMeta(lang, attraction).description, 300),
    url: attractionUrl(lang, attraction.id),
    inLanguage: lang,
    isPartOf: { '@type': 'WebSite', name: placeBrand(lang), url: PLACE_ORIGIN },
  };
  // 원어 병기명(예: en "Dosan Park" 의 "도산공원") — 화면에는 별도 요소로 그리고,
  // 검색엔진에는 alternateName 으로 알린다. name 에 괄호로 다시 합치지 않는다.
  const local = (attraction.titleLocal || '').trim();
  if (local && local !== attraction.title) json.alternateName = local;
  if (attraction.imageUrl) json.image = secureImageUrl(attraction.imageUrl);
  return json;
}

function placePostalAddress(attraction) {
  return { '@type': 'PostalAddress', streetAddress: attraction.address, addressCountry: 'KR' };
}

function placeGeo(attraction) {
  return { '@type': 'GeoCoordinates', latitude: attraction.latitude, longitude: attraction.longitude };
}

/** 전화 · 주소 · 좌표 — 관광지와 숙박이 같은 필드를 싣는다 */
function addContactAndPlace(json, attraction) {
  if (attraction.tel) json.telephone = attraction.tel;
  if (attraction.address) json.address = placePostalAddress(attraction);
  if (attraction.latitude && attraction.longitude) json.geo = placeGeo(attraction);
}

/** TourAPI 소개 원문(introRaw, JSON 객체 문자열)의 한 키 → 평문. 없거나 깨졌으면 빈 문자열. */
export function placeIntroText(introRaw, key) {
  if (!introRaw) return '';
  let parsed;
  try {
    parsed = JSON.parse(introRaw);
  } catch {
    return '';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
  const value = parsed[key];
  return value == null || typeof value === 'object' ? '' : sourceText(String(value));
}

/**
 * 행사 — 유효 기간(양 끝 포함, `YYYY-MM-DD`)과 장소. 날짜를 모르는 행사(UNKNOWN)는 기간을 싣지 않는다.
 * 장소 이름은 원문 「행사 장소」(`eventplace`), 없으면 행사 이름. 오늘에 따라 바뀌는 값은 싣지 않는다.
 */
export function eventJsonLd(lang, attraction) {
  const json = placeJsonLdBase(lang, attraction, 'Event');
  if (attraction.eventStart && attraction.eventEnd) {
    json.startDate = attraction.eventStart;
    json.endDate = attraction.eventEnd;
  }
  const location = { '@type': 'Place', name: placeIntroText(attraction.introRaw, 'eventplace') || attraction.title };
  if (attraction.address) location.address = placePostalAddress(attraction);
  if (attraction.latitude && attraction.longitude) location.geo = placeGeo(attraction);
  json.location = location;
  return json;
}

/** 숙박 — 예약 URL·예약 안내는 싣지 않는다(제휴 승인 전 예약 경로를 내지 않는다). */
export function lodgingJsonLd(lang, attraction) {
  const json = placeJsonLdBase(lang, attraction, 'LodgingBusiness');
  addContactAndPlace(json, attraction);
  return json;
}

/** 여행코스 — 구성 지점을 원천 순서 그대로 itinerary 로. 같은 언어 관광지로 이어진 지점만 주소를 갖는다. */
export function touristTripJsonLd(lang, attraction) {
  const json = placeJsonLdBase(lang, attraction, 'TouristTrip');
  const stops = attraction.courseStops ?? [];
  if (stops.length > 0) {
    json.itinerary = {
      '@type': 'ItemList',
      numberOfItems: stops.length,
      itemListElement: stops.map((stop, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'TouristAttraction',
          name: stop.name,
          ...(stop.attractionId != null ? { url: attractionUrl(lang, String(stop.attractionId)) } : {}),
        },
      })),
    };
  }
  return json;
}

export function touristAttractionJsonLd(lang, attraction) {
  const json = placeJsonLdBase(lang, attraction, 'TouristAttraction');
  if (attraction.imageUrl) json.image = attractionImageObject(attraction);
  addContactAndPlace(json, attraction);
  const area = attractionContainedInPlace(attraction);
  if (area) json.containedInPlace = area;
  // 원문에서 해석된 방문 속성만 싣는다 — 모르는 값을 「무료 아님」「매일 연다」로 바꾸지 않는다.
  // 서버 렌더(search AttractionPageRenderer)가 같은 규칙으로 같은 필드를 만든다.
  const openDays = attractionOpenDays(attraction);
  if (openDays) {
    // 시각은 해석하지 않는다(복잡한 영업시간은 범위 밖) — 여는 요일만 알린다
    json.openingHoursSpecification = {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: openDays.map((day) => `https://schema.org/${day}`),
    };
  }
  if (attraction.attrAdmission === 'FREE') json.isAccessibleForFree = true;
  else if (attraction.attrAdmission === 'PAID') json.isAccessibleForFree = false;
  return json;
}

/**
 * 공공누리 유형(원천 `copyrightDivCd`) → 이용 조건 페이지. 사진을 쓰는 조건이 출처표시(제1유형)·
 * 출처표시+변경금지(제3유형)인 것만 싣는다 — 상업 이용 금지(제2·4유형)나 모르는 값에 주소를 달면
 * 쓸 수 없는 조건을 쓸 수 있다고 알리게 된다.
 */
const KOGL_LICENSE = {
  Type1: 'https://www.kogl.or.kr/info/licenseType1.do',
  Type3: 'https://www.kogl.or.kr/info/licenseType3.do',
};

/** 대표 사진 → ImageObject. 원천 값은 허용 목록의 키로만 쓰고 URL 로 흘려보내지 않는다. */
function attractionImageObject(attraction) {
  const image = { '@type': 'ImageObject', contentUrl: secureImageUrl(attraction.imageUrl) };
  const license = Object.hasOwn(KOGL_LICENSE, attraction.copyrightDivCd ?? '') ? KOGL_LICENSE[attraction.copyrightDivCd] : null;
  if (license) image.license = license;
  image.creditText = '한국관광공사';
  return image;
}

/** 시군구 이름(지역 안 위치에 실려 온다) — 원문이라 정규화한다. 모르면 빈 문자열. */
function attractionSigunguName(attraction) {
  return sourceText(attraction.region?.sigunguName);
}

/** 소속 지역 — 시군구 › 시도, 이름만. 아는 단계만 싣고 하나도 모르면 null. */
function attractionContainedInPlace(attraction) {
  const sido = attraction.sidoName ? { '@type': 'AdministrativeArea', name: attraction.sidoName } : null;
  const sigungu = attractionSigunguName(attraction);
  if (!sigungu) return sido;
  return { '@type': 'AdministrativeArea', name: sigungu, ...(sido ? { containedInPlace: sido } : {}) };
}

/** 색인 요일 코드(MON…SUN) → schema.org 요일 이름. 순서가 곧 출력 순서다. */
const SCHEMA_WEEKDAYS = [
  ['MON', 'Monday'], ['TUE', 'Tuesday'], ['WED', 'Wednesday'], ['THU', 'Thursday'],
  ['FRI', 'Friday'], ['SAT', 'Saturday'], ['SUN', 'Sunday'],
];

/**
 * 정기휴무 상태(`closureState`·`closedWeekdays`, 색인 표기) → 여는 요일. 모르면 null.
 * `NO_WEEKLY` 는 명절·공휴일만 쉬는 곳이라 요일로는 매일 연다. 휴무 요일이 없는 `WEEKLY` 는
 * 색인 규칙상 모르는 값이다.
 */
function attractionOpenDays(attraction) {
  const state = attraction.closureState;
  if (state === 'ALWAYS_OPEN' || state === 'NO_WEEKLY') return SCHEMA_WEEKDAYS.map(([, name]) => name);
  if (state !== 'WEEKLY') return null;
  const closed = new Set(
    (attraction.closedWeekdays ?? []).filter((code) => SCHEMA_WEEKDAYS.some(([c]) => c === code)),
  );
  if (closed.size === 0) return null;
  const open = SCHEMA_WEEKDAYS.filter(([code]) => !closed.has(code)).map(([, name]) => name);
  return open.length ? open : null;
}

/**
 * 관광지 상세 breadcrumb — 허브 › 시도 › 시군구 › 관광지. 화면(AttractionPage)과 서버 렌더가 같은
 * 칸을 심어야 한다: 하이드레이션이 서버가 심은 것을 갈아끼우므로, 어긋나면 렌더 전후로
 * 지역 단계가 생겼다 사라진다. 시도는 색인이 들고 있는 이름(`sidoName`)을 쓴다 (ADR-0095).
 * 시군구는 시도 단계가 있고 시도·시군구 코드와 이름을 모두 알 때만 — 지역 페이지 주소가 두 코드를 잇는다.
 */
export function attractionBreadcrumbJsonLd(lang, attraction) {
  const sido = attraction.sidoName ? { code: attraction.sidoCode ?? '', name: attraction.sidoName } : null;
  const sigunguCode = attraction.region?.ldongSignguCd?.trim();
  const sigunguName = attractionSigunguName(attraction);
  const sigungu =
    sido && sido.code.trim() && sigunguCode && sigunguName ? { name: sigunguName, code: sido.code.trim() + sigunguCode } : null;
  return breadcrumbJsonLd(lang, [
    { name: lang === 'en' ? 'Explore Korea' : '한국 관광지 탐색', url: placeUrl(lang) },
    ...(sido ? [{ name: regionDisplayName(lang, sido), url: regionUrl(lang, sido.code) }] : []),
    ...(sigungu ? [{ name: sigungu.name, url: regionUrl(lang, sigungu.code) }] : []),
    { name: attraction.title, url: attractionUrl(lang, attraction.id) },
  ]);
}

/**
 * 원천 출처(`source`) → 표시명. 표에 없는 값과 null 은 null — TourAPI 로 짐작하지 않는다.
 * 방문 요약의 확인 상태와 바닥 출처 줄이 쓴다.
 */
const ATTRACTION_SOURCE_NAMES = {
  TOURAPI: { ko: '한국관광공사 TourAPI', en: 'Korea Tourism Organization TourAPI' },
  GOCAMPING: { ko: '한국관광공사 고캠핑', en: 'Korea Tourism Organization GoCamping' },
};

/**
 * @param {string | null | undefined} source
 * @param {'ko' | 'en'} lang
 * @returns {string | null}
 */
export function attractionSourceName(source, lang) {
  const names = Object.hasOwn(ATTRACTION_SOURCE_NAMES, source ?? '') ? ATTRACTION_SOURCE_NAMES[source] : null;
  return names ? names[lang === 'en' ? 'en' : 'ko'] : null;
}

/** 일반 전화번호 — 국가번호(+82)가 붙으면 앞자리 0 이 빠질 수 있다. */
const PHONE_NUMBER = /(?:\+82[- ]?0?|0)\d{1,3}[- ]?\d{3,4}[- ]?\d{4}/;
/** 대표번호(1330 · 1588-1234) — 일반 번호가 없을 때만 본다. `\b` 는 ASCII 기준이라 한글 바로 뒤도 경계다. */
const PHONE_REPRESENTATIVE = /\b1\d{3}(?:-\d{4})?\b/;

/**
 * 관광지 문의 원문 → 행동 줄의 전화 항목. 원문(`sourceText` 를 거친 평문)은 그대로 보이는 글로 두고,
 * 처음 나오는 번호 **하나만** `tel:` 링크로 만든다(숫자와 `+` 만 남긴다). 번호가 없으면 `href` 가 null 이고,
 * 원문이 비면 항목 자체가 없다(null). search `AttractionSeoText.attractionPhone` 이 같은 규칙이고
 * `PhoneParityTest` 가 이 함수의 출력과 비교한다.
 *
 * @param {string | null | undefined} raw
 * @returns {{ text: string, href: string | null } | null}
 */
export function attractionPhone(raw) {
  const text = sourceText(raw);
  if (!text) return null;
  const number = (text.match(PHONE_NUMBER) ?? text.match(PHONE_REPRESENTATIVE))?.[0];
  return { text, href: number ? `tel:${number.replace(/[^\d+]/g, '')}` : null };
}

/* ─── 개요 본문 정리 ────────────────────────────────────────────────────────
 * 원천(TourAPI)의 `overview` 는 **평문이 아니다.** 표본 720건에서 실제로 관측된 것:
 *   `<br />` 24 · `<br>` 3 · `<em>`/`<b>`/`<strong>`/`<div class=…>` 소수
 *   `&rsquo;` 32 · `&ldquo;`/`&rdquo;` 각 10 · `&nbsp;` 8 · `&ndash;` 5 · `&lt;`/`&gt;`/`&amp;` …
 * 국문은 대신 `\n` 이 들어온다(180건 중 30건).
 *
 * 지금까지 이걸 그대로 <p> 에 넣어서, 영문 화면에 `<br />` 와 `&rsquo;` 가 **글자로 보이고**
 * 국문은 개행이 공백으로 접혀 문단 구분이 사라졌다 (2026-09-05 라이브 실측).
 */

/** 관측된 엔티티만 명시적으로 푼다. innerHTML 을 쓰지 않는다 — 원천 문자열을 HTML 로 해석하면
 *  거기 담긴 것이 무엇이든 실행 경로가 열린다. 모르는 엔티티는 건드리지 않고 그대로 둔다. */
const ENTITIES = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&lsquo;': '‘', '&rsquo;': '’', '&ldquo;': '“', '&rdquo;': '”',
  '&ndash;': '–', '&mdash;': '—', '&hellip;': '…', '&middot;': '·',
  '&deg;': '°', '&eacute;': 'é', '&times;': '×',
};

/**
 * 원천 개요 → 화면에 낼 평문. 줄바꿈은 `\n` 으로 남기고 화면이 `white-space: pre-line` 으로 살린다.
 *
 * 태그를 지우는 것이지 서식을 살리는 것이 아니다 — `<em>` 을 기울임으로 되살리려면 원천 HTML 을
 * 신뢰해야 하는데, 우리가 통제하지 않는 문자열이라 그러지 않는다. 줄바꿈만 뜻이 분명해 살린다.
 */
/**
 * 원천 텍스트 → 화면에 낼 평문. 개요만이 아니라 **이용정보에도 같은 것이 섞여 온다**
 * (표본 182개 중 21개: infoCenter `<br>` 11 · useTime `<br>` 8 · 개행 10).
 * 한 함수로 둔다 — 두 벌로 나뉘면 한쪽만 고쳐지고 다른 쪽에 태그가 남는다.
 */
/**
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function sourceText(raw) {
  if (!raw) return '';
  let text = raw.replace(/\r\n?/g, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li)>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m.toLowerCase()] ?? m);
  text = text.replace(/&#(\d{1,6});/g, (_, code) => {
    const n = Number(code);
    // 제어문자는 되돌리지 않는다 — 화면에 보이지 않으면서 줄만 어그러뜨린다
    return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
  // 원천이 <br /><br /><br /> 처럼 겹쳐 보내는 곳이 있다 — 빈 줄은 하나까지만
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return text.trim();
}


// ─── /tech 분류별 용어집 ─────────────────────────────────────────────────────
//
// 개념마다 URL 을 만들지 않는다. 162개 중 description 중앙값이 29자이고 60자 이상은 2개뿐이라
// (2026-09-10 실측), 개념당 한 장이면 제목 + 한 문장짜리 얇은 페이지가 162장 생긴다.
// 이 레포는 같은 일을 이미 겪었다 — 개요 없는 관광지 36,092개가 사이트 전체를 '가치가 별로
// 없는 콘텐츠'로 반려당하게 했다 (ADR-0062 §8).
//
// 분류로 묶으면 한 장이 8~20개 용어와 풀이를 들고 있어 그 자체로 읽힌다.
// schema.org 도 이 모양에 이름이 있다 — `DefinedTermSet`.

/** 분류 한글 이름 — /tech 는 한국어 면이다. 영문 라벨은 화면 칩이 쓴다(types/index.ts) */
export const TECH_CATEGORY_KO = {
  BASICS: '프로그래밍 기초',
  DATA_STRUCTURE: '자료구조',
  ALGORITHM: '알고리즘',
  DESIGN_PATTERN: '디자인 패턴',
  CONCURRENCY: '동시성',
  DISTRIBUTED_SYSTEM: '분산 시스템',
  ARCHITECTURE: '아키텍처',
  INFRASTRUCTURE: '인프라',
  DATA: '데이터',
  SECURITY: '보안',
  NETWORK: '네트워크',
  TESTING: '테스트',
  LANGUAGE_FEATURE: '언어 기능',
};

/** URL 세그먼트 ↔ 분류 enum. 코드가 아니라 뜻이 읽히는 주소를 쓴다 */
export function techCategorySlug(category) {
  return String(category).toLowerCase().replace(/_/g, '-');
}

export function techCategoryFromSlug(slug) {
  const upper = String(slug || '').toUpperCase().replace(/-/g, '_');
  return upper in TECH_CATEGORY_KO ? upper : null;
}

export function techGlossaryPath(category) {
  return `/tech/${techCategorySlug(category)}`;
}

export function techGlossaryUrl(category) {
  return `${PORTAL_ORIGIN}${techGlossaryPath(category)}`;
}

/**
 * 용어집 메타. 정의형 질의("클로저란", "멱등성 뜻")의 착지점이라 제목에 분류명과
 * '용어' 를 함께 싣는다.
 * @param {string} category
 * @param {Array<Record<string, any>>} concepts 이 분류의 개념들
 */
export function techGlossaryMeta(category, concepts = []) {
  const name = TECH_CATEGORY_KO[category] ?? category;
  const n = concepts.length;
  const picks = concepts.slice(0, 4).map((c) => c.name).filter(Boolean).join(' · ');
  return {
    title: `${name} 용어집 — ${n}개 개념 정리 | ${PORTAL_BRAND}`,
    description: clampDescription(
      `${name} 분야의 개념 ${n}개를 한 장에 모았습니다${picks ? `. ${picks} 등` : ''} — 코드베이스에서 뽑아 뜻과 관계를 정리했습니다.`,
    ),
    canonical: techGlossaryUrl(category),
    image: ogCardUrl(PORTAL_ORIGIN, 'portal'),
    heading: `${name} 용어집`,
  };
}

/**
 * `DefinedTermSet` — 용어집의 schema.org 모양. 답변형 검색이 정의를 인용할 때 읽는다.
 * 풀이가 비어 있는 용어는 넣지 않는다 — 이름만 있는 항목은 정의가 아니다.
 */
export function definedTermSetJsonLd(category, concepts = []) {
  const name = TECH_CATEGORY_KO[category] ?? category;
  const url = techGlossaryUrl(category);
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': url,
    name: `${name} 용어집`,
    url,
    inLanguage: 'ko',
    publisher: { '@type': 'Organization', name: PORTAL_BRAND, url: PORTAL_ORIGIN, founder: personRef },
    hasDefinedTerm: concepts
      .filter((c) => (c.description || '').trim())
      .map((c) => ({
        '@type': 'DefinedTerm',
        name: c.name,
        description: c.description,
        inDefinedTermSet: url,
        ...(c.synonyms?.length ? { alternateName: c.synonyms } : {}),
      })),
  };
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
      '도메인 열한 개의 IT 개념을 그래프로 좁혀 가며 배우는 개념 아틀라스. 개념마다 이 레포의 코드와 그것을 다룬 글이 붙어 있습니다.',
  },
  '/tech/search': {
    title: portalTitle('검색 아키텍처'),
    description:
      '관광지 검색과 통합 검색의 구조·흐름·지금 쓰는 기법을 한 장에 — nori 사용자 사전, BM25+HNSW 하이브리드, RRF, 쿼리 언더스탠딩, 쿼리 벡터 캐시, 일일 평가',
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
  // 운영 주체·연락처도 심사가 크롤러로 찾는 문서라 같은 이유로 프리렌더한다.
  '/about': {
    title: portalTitle('사이트 소개'),
    description:
      '1989v.com 은 개인이 운영하는 사이트입니다. 관광정보·블로그·게임·혜택 모음 등 하위 서비스와 데이터 출처, 광고 고지를 정리했습니다.',
  },
  '/contact': {
    title: portalTitle('연락처'),
    description: '1989v.com 운영자에게 정보 정정·저작권·개인정보·제휴를 문의하는 방법입니다.',
  },
  // 원천·라이선스 목록 — 출처표시 의무가 있는 데이터를 쓰므로 크롤러가 읽는 초기 HTML 에도 둔다.
  '/data-sources': {
    title: portalTitle('데이터 출처'),
    description:
      '1989v.com 이 쓰는 공공데이터와 외부 API 의 원천·라이선스 목록입니다. 관광정보·날씨·대기질·지명 자료의 출처를 밝힙니다.',
  },
};

/**
 * 바닥글의 신뢰 링크 — 런타임 Footer 와 모든 프리렌더·상세 SSR 바닥글이 같은 순서로 그린다.
 * `path` 는 apex 경로다. 화면은 상대 경로로(서브도메인에서는 그 호스트가 같은 라우트를 그린다),
 * 초기 HTML 은 `PORTAL_ORIGIN` 을 붙인 절대 주소로 쓴다. 대상 페이지는 국문뿐이라 `labelEn` 은 라벨만 바꾼다.
 */
export const TRUST_LINKS = [
  { path: '/privacy', label: '개인정보처리방침', labelEn: 'Privacy policy' },
  { path: '/about', label: '사이트 소개', labelEn: 'About' },
  { path: '/contact', label: '연락처', labelEn: 'Contact' },
  { path: '/data-sources', label: '데이터 출처', labelEn: 'Data sources' },
];

/**
 * `/tech/search` 의 TechArticle. 페이지(useSeo)와 프리렌더가 이 함수 하나를 쓴다 — 둘이 다르면
 * 하이드레이션이 정적 HTML 의 구조화 데이터를 다른 값으로 갈아끼운다.
 * og:type 은 프리렌더가 website 로 고정하므로 글 성격은 여기서만 말한다.
 *
 * @param {string} updated 원본 문서의 갱신일(YYYY-MM-DD)
 */
export function techArticleJsonLd(updated) {
  const page = PORTAL_PAGES['/tech/search'];
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: '검색 아키텍처',
    description: page.description,
    url: portalUrl('/tech/search'),
    inLanguage: 'ko',
    dateModified: updated,
    author: personRef,
    publisher: { '@type': 'Organization', name: PORTAL_BRAND, url: PORTAL_ORIGIN, founder: personRef },
  };
}

// ─── deal (혜택 링크 허브) ────────────────────────────────────────────────────

export const DEAL_ORIGIN = 'https://deal.1989v.com';
export const DEAL_BRAND = '모든 혜택';
/**
 * 검색엔진에 알리는 사이트 신원. 화면 라벨(DEAL_BRAND)과 나눠 둔다 — 일반명사는 브랜드
 * 질의를 잡지 못하므로 고유 토큰(1989v)을 붙인 이름을 og:site_name·WebSite.name 에 쓴다.
 */
export const DEAL_SITE_NAME = `${PORTAL_BRAND} 혜택`;

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
 * 색인을 연다 (2026-08-24, ADR-0069 개정 — P1 의 noindex 해제).
 *
 * thin affiliate 판정을 막는 것은 색인 차단이 아니라 ① 아웃바운드의
 * `rel="sponsored nofollow"` ② `/go/` 크롤 차단 ③ 허브가 링크 목록만이 아니라
 * **검색 가능한 카탈로그**라는 사실이고, 셋 다 그대로 있다.
 *
 * 검색은 주소를 만들지 않는다 — 허브가 유일한 URL 이고 canonical 도 그것 하나다.
 * 질의마다 주소가 생기면 같은 카탈로그가 무한한 URL 로 갈라져 크롤 예산만 태운다.
 */
export function dealHubMeta() {
  return {
    title: `${DEAL_BRAND} — ${PORTAL_BRAND}`,
    description:
      '여행 · 커머스 · 디지털구독 · 교육 · 생활 카테고리의 혜택 링크를 한곳에 모았습니다. 쿠폰·적립·신규가입 프로모션을 이름·제공처로 검색하세요.',
    canonical: dealUrl('/'),
    image: ogCardUrl(DEAL_ORIGIN, 'deal'),
  };
}

// ─── rank (랭킹 리더보드) ─────────────────────────────────────────────────────

export const RANK_ORIGIN = 'https://rank.1989v.com';
export const RANK_BRAND = '모든 랭킹';
/** 화면 라벨(RANK_BRAND)과 나눈 검색 신원 — DEAL_SITE_NAME 과 같은 이유 */
export const RANK_SITE_NAME = `${PORTAL_BRAND} 랭킹`;

/**
 * 원천 표기. 오피넷은 **이용허락범위 제한 없음**이라 의무는 아니지만, 값의 출처를 밝히는 편이
 * 숫자를 믿을 근거가 된다. 보드 행의 `source_label` 이 원본이고 이건 그 폴백이다 (ADR-0081).
 */
export const RANK_GAS_SOURCE = '출처: 한국석유공사 오피넷';


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
      '지역별 최저가 주유소 리더보드. 시군구·유종별 순위를 어제 대비 등락과 함께 확인하고, 각 주유소로 바로 길찾기하세요.',
    canonical: rankUrl('/'),
    image: ogCardUrl(RANK_ORIGIN, 'rank'),
  };
}

export function rankBoardMeta(board) {
  const top = board.topName ?? board.entries?.[0]?.subjectName;
  return {
    title: `${board.title} — ${RANK_SITE_NAME}`,
    description: top
      ? `${board.title} 1위는 ${top}입니다. 순위는 매일 갱신되며 어제 대비 등락을 함께 보여줍니다.`
      : `${board.title} 순위. 매일 갱신되며 어제 대비 등락을 함께 보여줍니다.`,
    canonical: rankUrl(`/boards/${board.slug}`),
  };
}


// ─── ads (광고주 콘솔) ─────────────────────────────────────────────────────────

/** 광고주 콘솔 (ADR-0098). 로그인한 회원의 작업 화면이라 색인하지 않고 광고도 싣지 않는다(`ADSENSE_HOSTS` 밖). */
export const ADS_ORIGIN = 'https://ads.1989v.com';
export const ADS_BRAND = '1989v 광고';

/** 콘솔의 모든 화면 — 색인 대상이 아니다 */
export function adsConsoleMeta(title) {
  return {
    title: title ? `${title} | ${ADS_BRAND}` : ADS_BRAND,
    description: '1989v 서비스 지면에 가상 크레딧으로 광고를 집행하는 광고주 콘솔입니다.',
    canonical: `${ADS_ORIGIN}/`,
    noindex: true,
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
    image: ogCardUrl(BLOG_ORIGIN, 'blog'),
  };
}

export function blogPostMeta(post) {
  return {
    title: `${post.title} | ${BLOG_BRAND}`,
    description: clampDescription(post.summary ?? ''),
    canonical: blogPostUrl(post.slug),
    // 표지가 없으면 서비스 카드가 받는다 — 글 대부분은 표지가 없고, 링크가 생기는 순간은
    // 대개 메신저 공유라 카드가 비면 그 자리가 통째로 빈다.
    image: post.coverImageUrl ?? ogCardUrl(BLOG_ORIGIN, 'blog'),
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
    // 운영자 본인의 글만 사이트 전체를 잇는 Person `@id` 로 묶는다. 다른 저자는 자기
    // 작성자 공간이 정체성이다 — 남의 글을 본인 것으로 묶으면 저자 신호가 거짓이 된다.
    author:
      post.author?.handle === OWNER_BLOG_HANDLE
        ? personRef
        : {
            '@type': 'Person',
            name: post.author?.displayName ?? '',
            ...(post.author?.handle ? { url: blogAuthorUrl(post.author.handle) } : {}),
          },
    publisher: { '@type': 'Organization', name: BLOG_BRAND, url: BLOG_ORIGIN, founder: personRef },
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    // 없으면 발행일이 곧 최신성이 된다 — 고친 글이 계속 옛 글로 읽힌다.
    // 서버 렌더(BlogMetaRenderer)와 같은 값을 심어야 한다: 하이드레이션이 그쪽을 교체한다.
    ...(post.updatedAt || post.publishedAt
      ? { dateModified: post.updatedAt ?? post.publishedAt }
      : {}),
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
 * 로더가 index.html 에서 `components/ads/adsenseLoader.ts` 로 옮겨 오면서(2026-09-04)
 * 이 값과 아래 호스트 목록의 사본은 없어졌다 — 여기가 유일한 원본이다.
 * (ads.txt 와 index.html 의 소유권 메타는 여전히 같은 값을 쓰므로 고칠 때 함께 본다.)
 */
export const ADSENSE_CLIENT = 'ca-pub-4627924728297793';

/**
 * 광고를 게재하는 호스트.
 *
 * resume 는 제외한다 — 실명·연락처가 들어간 토큰 게이트 문서라(ADR-0064) 광고
 * 네트워크에 열람 맥락을 넘기지 않는다. GA 를 같은 이유로 빼둔 것과 같은 기준이다.
 * 로더(`components/ads/adsenseLoader.ts`)와 ads.txt 가 이 목록 하나를 본다.
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
 * 그때 AdSlot 은 AdSense 단계를 건너뛴다(자체 광고·HOUSE 는 그대로). **자리는 코드에 이미 박혀 있고 ID 만 비어 있는**
 * 상태이므로, 승인 후 여기 네 줄을 채우면 그 순간 전부 켜진다.
 *
 * 이름은 '어디냐'로 짓는다 — 크기나 모양(가로배너/사각)으로 지으면 나중에 형태를 바꿀 때
 * 이름이 거짓이 된다. 키는 자체 광고 지면 등록부(ads `AdPlacement`)의 지면 키와 같은 kebab 이다 —
 * `AdSlot` 이 이 키 하나로 결정 요청과 AdSense 단위를 함께 찾는다.
 */
export const ADSENSE_SLOTS = {
  /** 블로그 글 본문이 끝난 지점 — 다 읽은 뒤라 읽기를 방해하지 않는다 */
  'blog-post-end': '8241492603',
  /** 게임 목록 끝. **게임 프레임 안에는 절대 두지 않는다** — 조작 방해이자 정책 위반이다 */
  'game-hub-end': '8768106211',
  /**
   * 관광지 상세 끝 — 지도와 주변 목록을 다 본 뒤.
   *
   * **비워 둔다.** 본문이 TourAPI 개요 그대로라 "추가 설명·큐레이션 없이 타인의 콘텐츠를
   * 복사한 화면"에 해당하고, 게시자 정책이 그런 화면의 광고를 금지한다. 이 페이지에
   * 고유한 서술이 얹히기 전까지는 켜지 않는다. 콘솔 ID: 7395314794
   */
  'attraction-end': '',
  /**
   * 혜택 허브 끝 — 제휴 고지가 붙은 카드와 섞이지 않게 목록 바깥에 둔다.
   *
   * **비워 둔다.** 오퍼 목록이 곧 페이지 전부라 "게시자 콘텐츠보다 유료 홍보물이 많은
   * 화면"에 해당한다. 자체 서술이 늘기 전까지는 켜지 않는다. 콘솔 ID: 3236577931
   */
  'deal-hub-end': '',
};

export function adsTxt(client = ADSENSE_CLIENT) {
  if (!client) return null;
  // DIRECT = 게시자가 직접 계약한 판매자, 끝의 값은 Google 의 인증 기관 ID (고정)
  return `google.com, ${client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`;
}

/**
 * `/about` 의 절 — 페이지(AboutPage)와 프리렌더가 같은 상수로 그린다. 둘이 따로 글을 가지면
 * 한쪽만 고쳐져 크롤러가 읽는 초기 HTML 과 화면이 어긋난다.
 * 문단은 조각 배열이다: 문자열은 글, `{ href, label }` 은 그 자리의 링크. HTML 문자열은 담지 않는다.
 *
 * @typedef {string | { href: string, label: string }} AboutInline
 * @typedef {{ heading: string, paragraphs: AboutInline[][], items?: { href: string, label: string, desc: string }[] }} AboutSection
 * @type {AboutSection[]}
 */
export const ABOUT_SECTIONS = [
  {
    heading: '운영',
    paragraphs: [
      [
        '1989v.com 과 하위 도메인은 백엔드 개발자 권기덕이 개인으로 운영합니다. 회사나 단체의 사이트가 아니며, 설계부터 운영까지 한 사람이 맡습니다.',
      ],
      ['문의는 ', { href: '/contact', label: '연락처' }, ' 페이지에 있습니다.'],
    ],
  },
  {
    heading: '서비스',
    paragraphs: [],
    items: [
      { href: `${PLACE_ORIGIN}/`, label: '관광정보', desc: '전국 관광지·축제·숙박·여행코스와 날씨·대기질·혼잡 예측' },
      { href: `${BLOG_ORIGIN}/`, label: '블로그', desc: '개발과 운영 기록' },
      { href: '/games', label: '게임', desc: '브라우저에서 바로 하는 웹게임' },
      { href: `${DEAL_ORIGIN}/`, label: '혜택 모음', desc: '분류별 혜택 링크' },
      { href: `${RANK_ORIGIN}/`, label: '랭킹', desc: '공개 데이터로 줄 세운 순위' },
      { href: '/tech', label: '기술 사전', desc: '개발 개념과 서비스 구조' },
    ],
  },
  {
    heading: '데이터 출처',
    paragraphs: [
      ['관광정보는 한국관광공사 등의 공공데이터를 매일 받아 값을 고치지 않고 보여 줍니다.'],
      ['원천의 값이 바뀌면 다음 수집 때 함께 바뀝니다. 요금·운영 시간은 방문 전에 해당 기관에 확인해 주세요.'],
      ['원천과 라이선스 전체 목록은 ', { href: '/data-sources', label: '데이터 출처' }, '에 있습니다.'],
    ],
  },
  {
    heading: '광고와 제휴',
    paragraphs: [
      [
        '일부 페이지에 Google AdSense 광고가 실립니다. 혜택 모음의 일부 링크는 제휴 링크이며, 해당 링크에는 그 사실을 따로 표시합니다. 광고와 제휴는 관광정보의 내용과 순서에 영향을 주지 않습니다.',
      ],
      ['수집하는 정보와 쿠키는 ', { href: '/privacy', label: '개인정보처리방침' }, '에 있습니다.'],
    ],
  },
];
