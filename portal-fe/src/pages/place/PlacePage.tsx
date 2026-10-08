/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  COURSE_CATEGORY,
  EVENT_CATEGORY,
  fetchAdministrativeRegions,
  fetchAttraction,
  OVERLAY_CATEGORIES,
  searchAttractions,
  SIGHT_CATEGORIES,
  suggestPlaces,
  type AdministrativeRegion,
  type Attraction,
  type AttractionQuery,
  type AttractionSearchResult,
  type AttributeFacets,
  type PlaceLang,
  type Suggestion,
} from '../../api/placeApi';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import {
  googleMapsSearchUrl,
  loadGoogleMaps,
  mapsApiKey,
  nearestRegion,
  radiusFromBounds,
} from './googleMaps';
import AttractionLinks from './AttractionLinks';
import RegionDrilldown from './RegionDrilldown';
import RegionSheet from './RegionSheet';
import KhSheet from '../../components/shell/KhSheet';
import PickSheet from '../../components/dispenser/PickSheet';
import { escapeHtml } from 'card-dispenser';
import Footer from '../../components/Footer';
import ThemeToggle from '../../components/ThemeToggle';
import FavoriteButton from '../../components/favorite/FavoriteButton';
import { isPlottable, mergePages, nextPage, titleParts } from './placeView';
import {
  ATTRIBUTE_CAPTION,
  attributeChips,
  attributeQuery,
  chipCount,
  type AttributeChipId,
} from './placeAttributes';
import { useMediaQuery } from './useMediaQuery';
import './PlacePage.css';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import {
  PLACE_ORIGIN,
  attractionPath,
  collectionPageJsonLd,
  placeBrand,
  placeHreflangAlternates,
  placeHubMeta,
  placeUrl,
} from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import EventLine from './EventLine';
import { newViewId } from '../../analytics/identity';
import { installFlushOnLeave, track } from '../../analytics/tracker';
import { useImpression } from '../../analytics/useImpression';

// ADR-0065 K-관광/지리 탐색 — 관광지 지도 검색. 데이터 출처: 한국관광공사 TourAPI.
// place.<domain> 서브도메인이 정규 주소 (game 과 동일한 host 인식 루트 라우팅):
//   place 호스트: /(ko) · /en(en) — apex/개발: /place · /en/place (ADR-0062 언어 URL 규칙)

/** 행사 목록의 상태 칩 — 아무것도 안 고르면 끝나지 않은 행사 전부(NOT_ENDED)다. */
type ListEventStatus = 'ONGOING' | 'WEEKEND' | 'UPCOMING';
const LIST_EVENT_STATUSES: ListEventStatus[] = ['ONGOING', 'WEEKEND', 'UPCOMING'];

const UI = {
  ko: {
    title: 'K-관광 지도',
    subtitle: '한국의 관광지를 검색하고 지도에서 찾아보세요',
    searchPlaceholder: '관광지 검색 — 예: 궁궐, 해수욕장',
    nearMe: '내 주변',
    searchArea: '이 지역 재검색',
    all: '전체',
    empty: '검색 결과가 없습니다',
    corrected: (k: string) => `‘${k}’(으)로 검색한 결과입니다`,
    failed: '목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    mapKeyMissing: '지도 키가 설정되지 않아 목록만 표시합니다',
    openInGoogleMaps: '구글맵에서 보기',
    source: '출처: 한국관광공사 TourAPI',
    prev: '이전',
    next: '다음',
    close: '닫기',
    hideList: '목록 접기',
    showList: '목록 펼치기',
    onMap: '지도에 표시',
    loadMore: '더 보기',
    pickRegion: '어느 지역부터 볼까요?',
    pickRegionHint: '지도의 숫자는 그 시·도의 관광지 수입니다',
    countSuffix: '곳',
    regionTrigger: '지역 선택',
    categories: {
      nature: '자연', history: '역사', culture: '문화', leisure: '레포츠',
      shopping: '쇼핑', food: '음식', stay: '숙박', etc: '기타',
      festival: '행사', course: '여행코스',
    } as Record<string, string>,
    eventStatusGroup: '행사 상태',
    eventStatuses: { ONGOING: '진행 중', WEEKEND: '이번 주말', UPCOMING: '예정' } as Record<ListEventStatus, string>,
    regionLabel: '지역',
    attractionLabel: '관광지',
    regionLevels: {
      CONTINENT: '대륙', COUNTRY: '국가', REGION: '광역', CITY: '도시',
    } as Record<string, string>,
  },
  en: {
    title: 'K-Tour Map',
    subtitle: 'Search and explore Korean attractions on the map',
    searchPlaceholder: 'Search attractions — e.g. palace, beach',
    nearMe: 'Near me',
    searchArea: 'Search this area',
    all: 'All',
    empty: 'No results found',
    corrected: (k: string) => `Showing results for “${k}”`,
    failed: 'Could not load the list. Please try again in a moment.',
    mapKeyMissing: 'Map key not configured — showing list only',
    openInGoogleMaps: 'Open in Google Maps',
    source: 'Source: Korea Tourism Organization TourAPI',
    prev: 'Prev',
    next: 'Next',
    close: 'Close',
    hideList: 'Hide list',
    showList: 'Show list',
    onMap: 'Show on map',
    loadMore: 'Load more',
    pickRegion: 'Where do you want to start?',
    pickRegionHint: 'Numbers on the map are attraction counts per province',
    countSuffix: 'places',
    regionTrigger: 'Choose a region',
    categories: {
      nature: 'Nature', history: 'History', culture: 'Culture', leisure: 'Leisure',
      shopping: 'Shopping', food: 'Food', stay: 'Stay', etc: 'Etc',
      festival: 'Events', course: 'Courses',
    } as Record<string, string>,
    eventStatusGroup: 'Event status',
    eventStatuses: { ONGOING: 'Ongoing', WEEKEND: 'This weekend', UPCOMING: 'Upcoming' } as Record<ListEventStatus, string>,
    regionLabel: 'Region',
    attractionLabel: 'Attraction',
    regionLevels: {
      CONTINENT: 'Continent', COUNTRY: 'Country', REGION: 'Province', CITY: 'City',
    } as Record<string, string>,
  },
};

/*
 * 목록에는 관광 분류만 올린다 (ADR-0071 §5). 적재의 62% 가 음식·쇼핑이라 한 목록에 섞으면
 * 관광지가 보이지 않는다. 분류 가중치로 순위를 눌렀지만, 목록과 지도의 **역할을 나누는 것**이
 * 더 정직한 해법이다 — 음식·쇼핑을 지우는 게 아니라 지도로 옮긴다.
 */
/** 지도 오버레이는 화면에 보이는 범위만 가져온다 — 시군구 전체 식당을 찍으면 마커로 덮인다 */
const OVERLAY_SIZE = 60;

/** 지도 API 에 넘길 색은 CSS 변수가 아니라 계산된 값이어야 한다 (DESIGN.md — hex 직접 입력 금지). */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// 선택 시 확대 상한 (건물 단위까지 당기지 않는다)
const MAX_SELECT_ZOOM = 16;

/** JS 렌더 분기(시트·무한스크롤·목록 상시 노출)용 모바일 판정 — CSS 900px 티어와 같은 경계 */
const MOBILE_QUERY = '(max-width: 899.98px)';

/*
 * 지도 핀 — 기본과 선택이 같은 실루엣을 쓰고 색·크기·발밑 고리로 갈린다.
 *
 * 기본 핀도 토큰으로 그린다. 구글 기본 붉은 핀을 그대로 두면 팔레트 밖의 강한 색이 지도를
 * 가득 채우고, 그 위에서 무엇을 강조해도 "핀이 하나 더 있는" 화면이 된다.
 *
 * 테두리는 정경이 아니라 한지로 고정한다 — 지도에 스타일을 입히지 않으므로 타일은 라이트·
 * 다크 어느 정경에서도 밝다. 여기에 surface-0 을 쓰면 다크에서 검정 테두리가 되어 핀이
 * 타일에서 떨어져 보이지 않는다.
 */
const PIN_PATH = 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z';
const PIN_SCALE = 1;
const SELECTED_PIN_SCALE = 1.4;
/** 선택 고리 반지름(px). 클러스터 원(최대 19)보다 커야 무리 뒤에서도 테두리가 보인다. */
const SELECTED_HALO_SCALE = 21;

function pinIcon(fill: string, stroke: string, scale: number, strokeWeight: number) {
  return { path: PIN_PATH, scale, fillColor: fill, fillOpacity: 1, strokeColor: stroke, strokeWeight };
}
const defaultPinIcon = () => pinIcon(token('--ko-accent-primary'), token('--kh-hanji'), PIN_SCALE, 1.5);
const selectedPinIcon = (scale = SELECTED_PIN_SCALE) =>
  pinIcon(token('--kh-yeonji'), token('--kh-hanji'), scale, 2);

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/*
 * 행정 레벨별 확대 상한 (ADR-0071 §4). 시도를 골랐는데 결과가 한 동네에 몰리면 fitBounds 가
 * 그 동네까지 당겨 "제주를 봤는데 성산 골목이 보이는" 상태가 된다. 고른 레벨이 화면의 축이다.
 */
const MAX_ZOOM_BY_LEVEL = { SIDO: 11, SIGUNGU: 13 } as const;

/**
 * 첫 진입에 좌표를 못 얻었을 때의 기본 시도 (법정동 코드 11 = 서울특별시).
 *
 * 전국 지도로 시작하지 않는 이유: 6만 곳 중 30개를 무작위로 흩뿌린 화면은 고를 근거가 안 된다.
 * 어디든 한 곳을 정해야 하고, 정할 거면 관광 수요가 가장 두꺼운 곳이 덜 틀린다.
 */
const DEFAULT_SIDO_CODE = '11';
/** 좌표를 기다리는 상한 — 넘으면 기본 시도로 간다. 길게 잡으면 빈 화면이 그만큼 길어진다. */
const GEO_TIMEOUT_MS = 4000;

const AREAS: Array<{ code: string; ko: string; en: string }> = [
  { code: '1', ko: '서울', en: 'Seoul' },
  { code: '6', ko: '부산', en: 'Busan' },
  { code: '31', ko: '경기', en: 'Gyeonggi' },
  { code: '32', ko: '강원', en: 'Gangwon' },
  { code: '35', ko: '경북', en: 'Gyeongbuk' },
  { code: '37', ko: '전북', en: 'Jeonbuk' },
  { code: '39', ko: '제주', en: 'Jeju' },
];

interface GeoState {
  lat: number;
  lng: number;
  radiusKm: number;
}

/**
 * SEARCH `payload.trigger` (ADR-0095 허브 계측) — 무엇이 질의를 바꿨는지. 조작 시점에 ref 로 남겼다가
 * 결과 도착 시 소비한다. `landing` 은 직전 조건이 없는 첫 질의, `other` 는 ref 가 빈 채 결과가 온
 * 안전망(= ref 를 안 심은 핸들러)이라 기준선에서 0 이어야 한다.
 */
type SearchTrigger =
  | 'submit'
  | 'suggestion'
  | 'nearMe'
  | 'area'
  | 'region'
  | 'category'
  | 'attribute'
  | 'eventStatus'
  | 'page'
  | 'initial'
  | 'landing'
  | 'lang'
  | 'other';

/*
 * 허브 세션 시작은 세션당 한 번 — 화면 쪽 sessionId(sessionStorage, 탭 수명)와 같은 범위다.
 * 저장소를 못 쓰면(사파리 프라이빗·용량 초과) 모듈 변수가 대신한다 — 그때는 새로고침마다 1회.
 */
const SESSION_STARTED_KEY = 'kgd.place.sessionStarted';
let sessionStartedFallback = false;
function claimSessionStart(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_STARTED_KEY)) return false;
    sessionStorage.setItem(SESSION_STARTED_KEY, '1');
    return true;
  } catch {
    if (sessionStartedFallback) return false;
    sessionStartedFallback = true;
    return true;
  }
}

/** 테스트 전용 — 세션 시작 플래그(저장소·모듈 변수)를 비운다. */
// eslint-disable-next-line react-refresh/only-export-components -- 테스트 초기화는 이 화면의 모듈 변수를 만져야 한다
export function resetPlaceSessionForTest(): void {
  sessionStartedFallback = false;
  try {
    sessionStorage.removeItem(SESSION_STARTED_KEY);
  } catch {
    /* 저장소가 없으면 모듈 변수만 비운다 */
  }
}

export default function PlacePage() {
  useHeritageSurface();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lang: PlaceLang = pathname.startsWith('/en') ? 'en' : 'ko';
  const L = UI[lang];

  const seoMeta = placeHubMeta(lang);
  const seoCanonical = placeUrl(lang);
  useSeo({
    title: seoMeta.title,
    description: seoMeta.description,
    canonical: seoCanonical,
    lang,
    alternates: placeHreflangAlternates(''),
    jsonLd: [collectionPageJsonLd(lang, seoMeta, seoCanonical, { name: placeBrand(lang), url: PLACE_ORIGIN })],
  });

  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  // 행사 칩을 골랐을 때만 쓰는 상태 칩. null 이면 NOT_ENDED.
  const [listEventStatus, setListEventStatus] = useState<ListEventStatus | null>(null);
  // 속성 칩 — 화면 상태일 뿐 주소를 만들지 않는다(새 색인 URL 금지). 속성끼리 AND.
  const [attributes, setAttributes] = useState<ReadonlySet<AttributeChipId>>(() => new Set());
  const [areaCode, setAreaCode] = useState<string | null>(null);
  const [sidoCode, setSidoCode] = useState<string | null>(null);
  const [sigunguCode, setSigunguCode] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [mapView, setMapView] = useState<{ lat: number; lng: number; radiusKm: number } | null>(null);
  const [geo, setGeo] = useState<GeoState | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapMoved, setMapMoved] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  // 데스크톱 전용 — 목록 열을 접어 지도를 넓힌다. 모바일은 목록이 항상 지도 아래에 있다.
  const [listOpen, setListOpen] = useState(() => window.innerWidth > 900);
  const [regionSheetOpen, setRegionSheetOpen] = useState(false);
  const isMobile = useMediaQuery(MOBILE_QUERY);
  // 뽑기 — 지금 조건의 결과 중 무작위 페이지 하나(60곳)를 판에 꽂는다. 첫 페이지만 꽂으면
  // 늘 같은 60곳에서만 뽑히므로 페이지를 먼저 뽑는다.
  const [pickOpen, setPickOpen] = useState(false);
  const [pickItems, setPickItems] = useState<Attraction[] | null>(null);
  const [pickError, setPickError] = useState(false);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const overlayMarkersRef = useRef<any[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMapKey = mapsApiKey() !== '';

  const query: AttractionQuery = useMemo(
    () => ({
      keyword: keyword || undefined,
      lang,
      // 두 축을 같이 보내지 않는다 — 어느 쪽이 이기는지 서버도 호출자도 모른다 (ADR-0071 §9)
      areaCode: sidoCode ? undefined : (areaCode ?? undefined),
      sidoCode: sidoCode ?? undefined,
      sigunguCode: sigunguCode ?? undefined,
      // 분류를 안 고르면 관광 분류 전체 — 음식·쇼핑은 목록에 올리지 않는다.
      // 검색어가 있으면 끝나지 않은 행사도 더한다 — 「보령 머드축제」를 친 사람이 0건을 받지 않게 (ADR-0071 §5)
      category: category ?? (keyword ? [...SIGHT_CATEGORIES, EVENT_CATEGORY] : SIGHT_CATEGORIES).join(','),
      lat: geo?.lat,
      lng: geo?.lng,
      radiusKm: geo?.radiusKm,
      sort: category === EVENT_CATEGORY ? 'eventStart' : geo ? 'distance' : 'relevance',
      eventStatus:
        category === EVENT_CATEGORY
          ? (listEventStatus ?? 'NOT_ENDED')
          : category == null && keyword
            ? 'NOT_ENDED'
            : undefined,
      // 속성(휴무·주차·반려동물 등)은 관광지 축이라 행사에는 뜻이 없다 — 행사 목록에서는 칩도 조건도 뺀다.
      // 고른 칩은 남겨 두어 행사 칩을 풀면 다시 걸린다
      ...(category === EVENT_CATEGORY ? {} : attributeQuery(attributes)),
      page,
      size: 30,
    }),
    [keyword, lang, areaCode, sidoCode, sigunguCode, category, listEventStatus, geo, attributes, page],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ['place-attractions', query],
    // 건수는 첫 쪽만 센다 — 다음 쪽은 조건이 같아 건수도 같고, 세면 쪽마다 집계 요청이 는다.
    // query 에 넣지 않는 이유: 뽑기가 query 를 그대로 펼쳐 쓰는데 거기서는 건수가 필요 없다.
    queryFn: () =>
      searchAttractions(query.page === 0 && query.category !== EVENT_CATEGORY ? { ...query, facets: true } : query),
    staleTime: 60_000,
    // 이 목록이 이 페이지의 본문이다. 한 번 실패했다고 '결과 없음' 을 띄우면 200 응답에
    // '찾을 수 없음' 문구가 실려 크롤러에게 Soft 404 로 읽힌다 (2026-08-22 구글 실측:
    // 렌더된 본문이 'No results found' 한 줄이었다). 기본 retry 1 로는 배포 중 재기동
    // 한 번을 못 넘긴다.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  /*
   * 계측 한 벌 (ADR-0095) — 검색 조건이 바뀔 때마다 새 view. 마커 리스너는 ref 로 읽는다:
   * viewId 를 마커 동기화 effect 의 의존성에 넣으면 쪽을 넘길 때마다 마커를 전부 다시 만든다.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- query 가 바뀔 때만 새 한 벌이다
  const viewId = useMemo(() => newViewId(), [query]);
  const viewIdRef = useRef(viewId);
  // 행정구역 전체 코드 — 지역 페이지(PLACE_REGION)와 같은 체계. 시군구가 있으면 시도+시군구, 시도가 없으면 빈 값
  const screenRef = sidoCode ? sidoCode + (sigunguCode ?? '') : '';
  const screenRefRef = useRef(screenRef);
  useEffect(() => {
    viewIdRef.current = viewId;
    screenRefRef.current = screenRef;
  }, [viewId, screenRef]);
  // 화면을 떠날 때 아직 안 보낸 것을 흘린다 — 그 순간의 fetch 는 취소된다.
  useEffect(installFlushOnLeave, []);
  // 허브 세션 시작 — 세션당 한 번. 마운트 시점에는 시도가 없어(자동 선택은 지역 자료 도착 뒤) screenRef 가 빈 값이다.
  useEffect(() => {
    if (!claimSessionStart()) return;
    track('SESSION_START', { entityType: 'PAGE', entityId: 'place-hub', screenType: 'PLACE_HUB', screenRef: '' }, viewIdRef.current);
  }, []);

  /*
   * SEARCH 는 결과가 도착한 view 마다 한 번(0건 포함). 무엇이 질의를 바꿨는지는 조작 시점에 ref 로
   * 남겼다가 여기서 소비한다 — 필드 diff 로 역추론하지 않는다. ref 가 비어 있으면 첫 질의는 `landing`,
   * 그 뒤는 안전망 `other`. 실패(isError)는 보내지 않는다 — 실패한 제출은 분모가 아니다.
   * 이 effect 는 자동 시도 선택 effect 보다 앞에 둔다 — 같은 커밋에서 그쪽이 먼저 `initial` 을 심으면
   * 시도 없는 첫 질의(landing)가 그 값을 가져간다.
   */
  const triggerRef = useRef<SearchTrigger | null>(null);
  const changedRef = useRef<string[]>([]);
  const sentViewRef = useRef<string | null>(null);
  const hasSearchedRef = useRef(false);
  useEffect(() => {
    if (!data || isError || sentViewRef.current === viewId) return;
    sentViewRef.current = viewId;
    const trigger: SearchTrigger = triggerRef.current ?? (hasSearchedRef.current ? 'other' : 'landing');
    const changed = changedRef.current;
    triggerRef.current = null;
    changedRef.current = [];
    hasSearchedRef.current = true;
    track(
      'SEARCH',
      {
        entityType: 'SEARCH',
        entityId: keyword || '*',
        screenType: 'PLACE_HUB',
        screenRef,
        sectionId: 'ATTRACTION_LIST',
        // 기기 좌표(lat·lng)는 싣지 않는다. 검색어 키는 `keyword` 가 아니라 `term` — Streams 키워드 지표가
        // `payload.keyword` 로 상품 키워드 점수를 만들므로 허브 검색어가 거기 섞이지 않게 한다.
        payload: {
          trigger,
          changed,
          term: keyword,
          category,
          attributes: [...attributes],
          sido: sidoCode,
          sigungu: sigunguCode,
          radiusKm: geo?.radiusKm,
          page,
          total: data.totalElements,
          correctedKeyword: data.correctedKeyword,
        },
      },
      viewId,
    );
  }, [data, isError, viewId, keyword, category, attributes, sidoCode, sigunguCode, geo, page, screenRef]);

  // ─── 모바일 무한 스크롤 누적 — page 를 뺀 검색 조건이 바뀌면 처음부터 다시 쌓는다.
  // effect 가 아니라 렌더 중 조정(React 'adjusting state during render')이다 —
  // effect 를 거치면 프레임 하나 늦게 그려지고 set-state-in-effect 계단식 렌더가 된다.
  const baseKey = useMemo(() => JSON.stringify({ ...query, page: 0 }), [query]);
  const [store, setStore] = useState<{
    key: string;
    data: AttractionSearchResult | null;
    items: Attraction[];
  }>({ key: baseKey, data: null, items: [] });
  if (data && (store.key !== baseKey || store.data !== data)) {
    const prev = store.key === baseKey ? store.items : [];
    setStore({ key: baseKey, data, items: mergePages(prev, data.attractions, data.currentPage) });
  }

  /*
   * 속성 칩 건수 — 첫 쪽 응답에만 온다. 다음 쪽(건수 없이 요청)을 받아도 앞 값을 둔다.
   * 조건을 바꾼 뒤 새 첫 쪽이 오기 전까지도 앞 값을 둔다 — 칩 숫자가 비었다 찼다 하면
   * 칩 폭이 흔들린다. 새 첫 쪽이 건수 없이 오면(집계 실패·시간 초과) 숫자 없이 그린다.
   */
  const [facetStore, setFacetStore] = useState<{ data: AttractionSearchResult | null; facets: AttributeFacets | null }>(
    { data: null, facets: null },
  );
  if (data && data.currentPage === 0 && facetStore.data !== data) {
    setFacetStore({ data, facets: data.attributeFacets ?? null });
  }
  const facets = facetStore.facets;
  const toggleAttribute = (id: AttributeChipId) => {
    triggerRef.current = 'attribute';
    changedRef.current = ['attributes', 'page'];
    setAttributes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPage(0);
  };
  // 목록·마커의 단일 원본 — 모바일은 누적분, 데스크톱은 현재 페이지.
  // useMemo — 매 렌더 새 배열이면 마커 동기화 effect 가 키 입력마다 돈다.
  const attractions = useMemo(
    () => (isMobile ? (store.key === baseKey ? store.items : []) : (data?.attractions ?? [])),
    [isMobile, store, baseKey, data],
  );

  // 센티널이 보이면 다음 페이지. 로딩 중에는 붙이지 않아 중복 요청이 없고,
  // 데이터가 오면 effect 가 다시 붙어 다음 구간을 기다린다.
  const hasIO = typeof IntersectionObserver !== 'undefined';
  const totalPages = data?.totalPages ?? 0;
  useEffect(() => {
    if (!isMobile || !hasIO || isLoading) return;
    const el = sentinelRef.current;
    if (!el || nextPage(page, totalPages) == null) return;
    const io = new IntersectionObserver(
      (entries, obs) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        obs.disconnect(); // 한 번만 — 연타로 여러 페이지를 건너뛰지 않는다
        triggerRef.current = 'page';
        changedRef.current = ['page'];
        setPage((p) => nextPage(p, totalPages) ?? p);
      },
      { rootMargin: '480px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isMobile, hasIO, isLoading, page, totalPages, baseKey]);

  const { data: sidoRegions } = useQuery({
    queryKey: ['administrative-regions', 'SIDO', lang],
    queryFn: () => fetchAdministrativeRegions({ level: 'SIDO', lang }),
    staleTime: 30 * 60_000,
  });
  // 자료가 들어오면 드릴다운으로, 아직이면 이전 광역 선택으로. 두 축을 동시에 노출하지 않는다.
  const hasRegionAxis = (sidoRegions?.length ?? 0) > 0;

  // 모바일 지역 트리거 라벨("서울 · 강남구")용 시군구 이름 — RegionSheet 와 같은 캐시를 쓴다
  const { data: sigunguRegions } = useQuery({
    queryKey: ['administrative-regions', 'SIGUNGU', sidoCode, lang],
    queryFn: () => fetchAdministrativeRegions({ level: 'SIGUNGU', parent: sidoCode!, lang }),
    enabled: isMobile && sidoCode != null,
    staleTime: 30 * 60_000,
  });
  const regionName = (r?: AdministrativeRegion | null) => (r ? (lang === 'en' && r.nameEn) || r.name : null);
  const selectedSidoName = regionName((sidoRegions ?? []).find((r) => r.code === sidoCode));
  const selectedSigunguName = sigunguCode
    ? regionName((sigunguRegions ?? []).find((r) => r.code.slice(2) === sigunguCode))
    : null;
  const regionTriggerLabel = selectedSidoName
    ? selectedSigunguName
      ? `${selectedSidoName} · ${selectedSigunguName}`
      : selectedSidoName
    : UI[lang].regionTrigger;
  /*
   * 시도를 아직 안 고른 첫 화면 (ADR-0071 §3 — 탐색의 축이 지역이다).
   *
   * 이 상태에서 전국 관광지 30건을 흩뿌리면 마커가 아무 의미도 없다 — 6만 곳 중 30개를
   * 무작위로 본 셈이라 고를 근거가 안 된다. 대신 **시도 자체를 마커로** 보여 "어디부터
   * 볼지"를 지도에서 고르게 한다. 검색어나 내 주변을 쓰면 그건 명시적 의도라 비켜준다.
   */
  const pickingRegion = hasRegionAxis && !sidoCode && !keyword && !geo;

  /**
   * 지역 선택 — 드릴다운 칩과 지도의 시도 마커가 같은 경로를 쓴다.
   * `trigger` 는 첫 진입 자동 선택(`initial`)과 사람의 선택(`region`)을 가른다 — 기준선은 전자를 필터 적용에 넣지 않는다.
   */
  const selectRegion = useCallback(
    (
      next: { sidoCode: string | null; sigunguCode: string | null; region?: AdministrativeRegion } | AdministrativeRegion,
      trigger: 'initial' | 'region',
    ) => {
      const region = 'level' in next ? next : next.region;
      const nextSido = 'level' in next ? next.code : next.sidoCode;
      const nextSigungu = 'level' in next ? null : next.sigunguCode;
      triggerRef.current = trigger;
      changedRef.current = ['sidoCode', 'sigunguCode'];
      setSidoCode(nextSido);
      setSigunguCode(nextSigungu);
      setAreaCode(null);
      setGeo(null);
      setPage(0);
      setSelectedId(null);
      // 고른 레벨이 화면의 축이다 — 그 레벨의 줌으로 옮긴다 (ADR-0071 §4)
      const map = mapRef.current;
      if (map && region?.latitude != null && region.longitude != null) {
        map.setCenter({ lat: region.latitude, lng: region.longitude });
        map.setZoom(region.level === 'SIDO' ? MAX_ZOOM_BY_LEVEL.SIDO : MAX_ZOOM_BY_LEVEL.SIGUNGU);
        setMapMoved(false);
      }
    },
    [],
  );

  /*
   * 첫 진입은 **시도 하나를 고른 상태**로 시작한다 (ADR-0071 §3).
   * 좌표를 얻으면 그 위치의 시도로, 못 얻으면 서울로.
   *
   * 한 번만 돈다 — 사용자가 "전체"로 되돌린 뒤 다시 낚아채면 조작을 빼앗는 셈이다.
   * 검색어를 들고 들어온 경우(공유 링크 등)도 비켜준다. 그건 이미 명시된 의도다.
   */
  const autoPickedRef = useRef(false);
  useEffect(() => {
    if (autoPickedRef.current || !hasRegionAxis || sidoCode || keyword || geo) return;
    const regions = sidoRegions ?? [];
    if (regions.length === 0) return;
    autoPickedRef.current = true;

    const pick = (region?: AdministrativeRegion | null) => {
      const target = region ?? regions.find((r) => r.code === DEFAULT_SIDO_CODE) ?? regions[0];
      if (target) selectRegion(target, 'initial');
    };
    if (!navigator.geolocation) {
      pick(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => pick(nearestRegion(regions, pos.coords.latitude, pos.coords.longitude)),
      () => pick(null),                       // 거부·실패는 정상 경로다 — 기본 시도로 간다
      { timeout: GEO_TIMEOUT_MS, maximumAge: 10 * 60_000 },
    );
  }, [hasRegionAxis, sidoCode, keyword, geo, sidoRegions, selectRegion]);

  const { data: selected } = useQuery({
    queryKey: ['place-attraction', selectedId],
    queryFn: () => fetchAttraction(selectedId!),
    enabled: selectedId != null,
  });

  /*
   * 선택한 지점의 좌표. 목록에 있으면 목록에서, 없으면 상세 응답에서 가져온다 —
   * 오버레이(음식·쇼핑) 마커를 누르면 그 장소는 목록에 없어서, 목록만 보면 지도가
   * 따라가지도 강조되지도 않았다. 팬과 강조가 같은 좌표를 봐야 둘이 어긋나지 않는다.
   */
  const selectedTarget = useMemo(() => {
    if (!selectedId) return null;
    const inList = attractions.find((a) => a.id === selectedId);
    if (inList) return { lat: inList.latitude, lng: inList.longitude };
    if (selected?.id === selectedId) return { lat: selected.latitude, lng: selected.longitude };
    return null;
  }, [selectedId, attractions, selected]);

  // 지도 초기화 (키 있을 때만 — 미설정이면 리스트-only)
  useEffect(() => {
    if (!hasMapKey || mapRef.current || !mapDivRef.current) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new maps.Map(mapDivRef.current, {
          center: { lat: 36.5, lng: 127.8 },
          zoom: 7,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        map.addListener('dragend', () => setMapMoved(true));
        map.addListener('zoom_changed', () => setMapMoved(true));
        mapRef.current = map;
        setMapReady(true);
      })
      .catch(() => setMapReady(false));
    return () => {
      cancelled = true;
    };
  }, [hasMapKey]);

  // 클러스터 최대 줌에서 카드 목록으로 안내 — 지도가 더는 쪼개 주지 못하는 것을 목록이 보여준다
  const scrollCardIntoView = useCallback((id: string) => {
    setListOpen(true); // 접힌 목록(데스크톱)으로는 안내할 수 없다
    requestAnimationFrame(() => {
      document.getElementById(`place-card-${id}`)?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
      });
    });
  }, []);

  /*
   * 마커 동기화가 읽을 현재 선택. selectedId 를 그 effect 의 의존성에 넣으면 관광지를 고를
   * 때마다 마커를 전부 다시 만들고 클러스터가 새로 계산된다. 그래서 ref 로 넘긴다 —
   * 이 effect 를 **먼저** 선언해 같은 커밋에서 마커 동기화보다 앞서 돌게 한다.
   */
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // 결과 → 마커 동기화. 관광지 마커는 줌에 따라 클러스터로 묶는다 —
  // 모바일 무한 스크롤이 마커를 수백 개까지 쌓아 개별 핀만으로는 지도가 덮인다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.google?.maps) return;
    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = new Map();

    // 지역 선택 화면 — 관광지 대신 시도를 찍는다. 클릭하면 그 시도로 들어간다.
    // 시도 카운트 원은 이미 수동 클러스터라 MarkerClusterer 를 태우지 않는다.
    if (pickingRegion) {
      const bounds = new window.google.maps.LatLngBounds();
      (sidoRegions ?? []).forEach((r) => {
        if (r.latitude == null || r.longitude == null) return;
        const marker = new window.google.maps.Marker({
          map,
          position: { lat: r.latitude, lng: r.longitude },
          title: `${(lang === 'en' && r.nameEn) || r.name} (${r.attractionCount ?? 0})`,
          label: {
            text: String(r.attractionCount ?? 0),
            // 판 위 글씨는 한지 — surface-0 은 다크에서 #131313 이라 청자 채움 위 1.9:1 로 떨어진다
            color: token('--kh-hanji'),
            fontSize: '11px',
            fontWeight: '700',
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 15,
            fillColor: token('--ko-accent-primary'),
            fillOpacity: 0.92,
            strokeColor: token('--ko-surface-0'),
            strokeWeight: 2,
          },
        });
        marker.addListener('click', () => selectRegion(r, 'region'));
        markersRef.current.set(r.code, marker);
        bounds.extend({ lat: r.latitude, lng: r.longitude });
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 56);
        window.google.maps.event.addListenerOnce(map, 'idle', () => setMapMoved(false));
      }
      return;
    }

    if (attractions.length === 0) return;

    const markers: any[] = [];
    const bounds = new window.google.maps.LatLngBounds();
    const defaultIcon = defaultPinIcon();
    attractions.forEach((a) => {
      // 원천이 한반도 밖 좌표를 주는 레코드가 있다 (39/59,735). 그냥 찍으면 핀이 바다에
      // 서는 것으로 끝나지 않는다 — bounds.extend 가 그 점까지 품어 **지도 전체가
      // 태평양까지 넓어진다.** 목록에는 남기고 지도에만 안 올린다.
      if (!isPlottable(a.latitude, a.longitude)) return;
      // 선택된 곳은 **강조된 채로 태어난다** — 마커를 다시 만든 뒤 강조를 덧입히면
      // 그 사이 한 프레임 동안 선택이 사라지고, 강조 effect 가 다시 돌 이유도 없다.
      const isSelected = a.id === selectedIdRef.current;
      // map 은 클러스터러가 관리한다 — 여기서 붙이면 클러스터와 개별 핀이 겹쳐 보인다
      const marker = new window.google.maps.Marker({
        position: { lat: a.latitude, lng: a.longitude },
        title: a.title,
        icon: isSelected ? selectedPinIcon() : defaultIcon,
        zIndex: isSelected ? 999 : 1,
      });
      // 목록 핀 선택 — 노출 없는 클릭. viewId 는 ref 로 읽는다(이 effect 는 view 마다 돌지 않는다)
      marker.addListener('click', () => {
        track(
          'CLICK',
          {
            entityType: 'ATTRACTION',
            entityId: a.id,
            screenType: 'PLACE_HUB',
            screenRef: screenRefRef.current,
            sectionId: 'ATTRACTION_LIST',
            payload: { source: 'map' },
          },
          viewIdRef.current,
        );
        setSelectedId(a.id);
      });
      markersRef.current.set(a.id, marker);
      markers.push(marker);
      bounds.extend({ lat: a.latitude, lng: a.longitude });
    });

    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        renderer: {
          // 시도 카운트 원과 같은 문법의 아이콘. 지도 API 는 CSS 변수를 못 읽으므로
          // 토큰을 계산값으로 넘긴다 — hex 를 박으면 테마 전환 때 마커만 남는다 (DESIGN.md)
          render: ({ count, position }: { count: number; position: any }) =>
            new window.google.maps.Marker({
              position,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 13 + Math.min(6, Math.round(count / 8)),
                fillColor: token('--ko-accent-primary'),
                fillOpacity: 0.92,
                strokeColor: token('--ko-surface-0'),
                strokeWeight: 2,
              },
              label: {
                text: String(count),
                // 위와 같은 이유 — 클러스터 배지 숫자도 한지로 고정한다
                color: token('--kh-hanji'),
                fontSize: '11px',
                fontWeight: '700',
              },
              zIndex: 500 + count,
            }),
        },
        onClusterClick: (_event: unknown, cluster: any, clusterMap: any) => {
          // 최대 줌에서는 더 쪼개지지 않는다 — 지도 대신 카드 목록으로 안내한다
          if ((clusterMap.getZoom() ?? 0) >= MAX_SELECT_ZOOM) {
            const first = cluster.markers?.[0];
            const found = first
              ? [...markersRef.current.entries()].find(([, m]) => m === first)
              : null;
            if (found) scrollCardIntoView(found[0]);
            return;
          }
          clusterMap.fitBounds(cluster.bounds, 48);
        },
      });
    }
    clustererRef.current.addMarkers(markers);

    // 새 검색(0페이지)만 화면을 다시 맞춘다 — 무한 스크롤로 페이지가 붙을 때마다
    // fitBounds 를 하면 읽고 있던 지도가 계속 튄다.
    if (!isMobile || page === 0) {
      map.fitBounds(bounds, 48);
      window.google.maps.event.addListenerOnce(map, 'idle', () => {
        // 시도를 고른 상태면 그 레벨보다 더 당기지 않는다
        if (areaCode && map.getZoom() > MAX_ZOOM_BY_LEVEL.SIDO) map.setZoom(MAX_ZOOM_BY_LEVEL.SIDO);
        // fitBounds 가 유발하는 zoom_changed 를 사용자 이동으로 오인하지 않게 리셋
        setMapMoved(false);
      });
    }
  }, [attractions, mapReady, areaCode, pickingRegion, sidoRegions, lang, selectRegion, scrollCardIntoView, isMobile, page]);

  /*
   * 오버레이가 켜져 있을 때만 지도 이동을 따라간다. 꺼져 있으면 상태를 건드리지 않는다 —
   * 지도를 움직일 때마다 setState 를 하면 오버레이를 안 쓰는 사람까지 리렌더 비용을 낸다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !overlay || !window.google?.maps) return;
    const sync = () => {
      const center = map.getCenter();
      const bounds = map.getBounds();
      if (center && bounds) {
        setMapView({ lat: center.lat(), lng: center.lng(), radiusKm: radiusFromBounds(bounds) });
      }
    };
    sync();
    const listener = map.addListener('idle', sync);
    return () => listener.remove();
  }, [overlay, mapReady]);

  const { data: overlayData } = useQuery({
    queryKey: ['place-overlay', overlay, mapView, lang],
    queryFn: () =>
      searchAttractions({
        lang,
        category: overlay!,
        lat: mapView!.lat,
        lng: mapView!.lng,
        radiusKm: mapView!.radiusKm,
        sort: 'distance',
        size: OVERLAY_SIZE,
      }),
    enabled: overlay != null && mapView != null,
    staleTime: 60_000,
  });

  /*
   * 오버레이 마커는 관광지 핀과 **모양으로** 구분한다. 색만 다르면 색각 이상에서 같아 보이고,
   * 이 지도는 두 종류가 항상 겹쳐 있는 화면이다.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.google?.maps) return;
    overlayMarkersRef.current.forEach((m) => m.setMap(null));
    overlayMarkersRef.current = [];
    if (!overlay) return;
    (overlayData?.attractions ?? []).forEach((a) => {
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: a.latitude, lng: a.longitude },
        title: a.title,
        zIndex: 0,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          // 지도 API 는 CSS 변수를 못 읽는다 — 토큰을 읽어서 넘긴다.
          // hex 를 박으면 테마가 바뀔 때 마커만 이전 팔레트로 남는다 (DESIGN.md).
          fillColor: token('--ko-accent-primary'),
          fillOpacity: 0.9,
          strokeColor: token('--ko-surface-0'),
          strokeWeight: 1.5,
        },
      });
      // 오버레이 핀 선택 — 목록 밖·노출 없는 클릭이지만 인기 집계에는 들어간다(MAP_OVERLAY)
      marker.addListener('click', () => {
        track(
          'CLICK',
          {
            entityType: 'ATTRACTION',
            entityId: a.id,
            screenType: 'PLACE_HUB',
            screenRef: screenRefRef.current,
            sectionId: 'MAP_OVERLAY',
            payload: { source: 'map' },
          },
          viewIdRef.current,
        );
        setSelectedId(a.id);
      });
      overlayMarkersRef.current.push(marker);
    });
  }, [overlay, overlayData, mapReady]);

  // 선택 → 지도가 **한 번의 팬**으로 따라간다. 이전의 fitBounds(주변 프레임) 뒤 1.5초 BOUNCE 는
  // 화면을 다시 맞춘 다음 마커가 또 움직이는 두 박자라 부자연스러웠다. 줌을 바꾸지 않고
  // panTo 만 하면 "여기가 어디 옆인지"의 맥락(현재 축척)도 그대로 남는다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedTarget || !window.google?.maps) return;
    const position = selectedTarget;

    if (prefersReducedMotion()) {
      map.setCenter(position); // 모션 최소화 — 애니메이션 없이 즉시 이동
    } else if (map.getBounds()?.contains(position)) {
      map.panTo(position);
    } else {
      // 화면 밖 목표는 panTo 가 점프로 떨어진다 — 목표를 포함하는 최소 이동으로 완만하게 옮긴다
      map.panToBounds(new window.google.maps.LatLngBounds(position, position), 96);
    }
    if ((map.getZoom() ?? 0) > MAX_SELECT_ZOOM) map.setZoom(MAX_SELECT_ZOOM);
    window.google.maps.event.addListenerOnce(map, 'idle', () => setMapMoved(false));
  }, [selectedTarget, mapReady]);

  /*
   * 선택 표시는 **다음 선택까지 남는다.** 잠깐 커졌다 돌아오는 강조는 시선을 옮기는 신호일
   * 뿐이라, 목록을 읽고 지도로 눈을 돌린 순간엔 이미 없다.
   *
   * 세 가지가 동시에 다르다 — 연지(인장) 색 / 1.4배 크기 / 발밑의 고리. 색만으로 말하지
   * 않는 이유는 색각 이상(2형)에서 정경 액션색(소나무·청자)과 연지가 붙어 보이기 때문이다.
   *
   * 고리는 클러스터러가 관리하지 않는 별도 마커다 — 선택한 핀이 무리에 삼켜져도 "그 자리"는
   * 지도에 남고, 줌인해 무리가 풀리면 핀이 강조된 채로 다시 나타난다. 목록이 바뀌어 마커가
   * 새로 만들어지는 경우는 동기화 쪽이 강조된 채로 만들고(selectedIdRef), 여기서는 매번
   * 선택 아닌 마커를 기본으로 되돌려 놓아 남은 강조가 없게 한다.
   */
  const stampedRef = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.google?.maps) return;
    // 시도 선택 화면의 마커는 카운트 원이다 — 여기서 아이콘을 건드리면 그 원이 지워진다
    if (pickingRegion) return;

    // 찍힘은 **선택이 바뀔 때만** 재생한다 — 무한 스크롤로 마커가 다시 그려질 때마다
    // 도장을 다시 찍으면 가만히 있는 지도에서 핀 하나가 계속 튄다.
    // 선택이 풀린 것도 기록해야 같은 곳을 다시 고를 때 도장이 찍힌다.
    const lastStamped = stampedRef.current;
    stampedRef.current = selectedId;

    const defaultIcon = defaultPinIcon();
    markersRef.current.forEach((marker, id) => {
      if (id === selectedId) return;
      marker.setZIndex(1);
      marker.setIcon(defaultIcon);
    });
    if (!selectedId || !selectedTarget) return;

    const seal = token('--kh-yeonji');
    const halo = new window.google.maps.Marker({
      map,
      position: selectedTarget,
      clickable: false, // 고리가 핀·클러스터의 클릭을 가로채면 안 된다
      zIndex: 400,      // 클러스터(500+) 아래 — 무리 뒤로 테두리만 비친다
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: SELECTED_HALO_SCALE,
        fillColor: seal,
        fillOpacity: 0.14,
        strokeColor: seal,
        strokeWeight: 3,
      },
    });

    const marker = markersRef.current.get(selectedId);
    const stamp = !prefersReducedMotion() && lastStamped !== selectedId;
    let settle: ReturnType<typeof setTimeout> | undefined;
    if (marker) {
      marker.setZIndex(999);
      marker.setIcon(selectedPinIcon(stamp ? SELECTED_PIN_SCALE * 1.15 : SELECTED_PIN_SCALE));
      if (stamp) settle = setTimeout(() => marker.setIcon(selectedPinIcon()), 240);
    }
    return () => {
      if (settle) clearTimeout(settle);
      halo.setMap(null);
      if (marker) {
        marker.setIcon(defaultIcon);
        marker.setZIndex(1);
      }
    };
  }, [selectedId, selectedTarget, pickingRegion, mapReady]);

  // 통합 자동완성 — 200ms 디바운스, 실패는 조용히 무시 (shop suggest 패턴)
  useEffect(() => {
    const q = keywordInput.trim();
    if (!q) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      suggestPlaces(q, lang, 8)
        .then((items) => setSuggestions(items))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [keywordInput, lang]);

  // 지역 레벨별 반경(km) — 선택 시 지도 이동 + 반경 검색 (서버 캡 50km)
  const REGION_RADIUS: Record<string, number> = { CITY: 15, REGION: 50, COUNTRY: 50, CONTINENT: 50 };

  const pickSuggestion = useCallback((s: Suggestion) => {
    setShowSuggest(false);
    setKeywordInput(s.title);
    if (s.latitude == null || s.longitude == null) return;
    triggerRef.current = 'suggestion';
    changedRef.current = ['geo'];
    setKeyword('');
    setCategory(null);
    setAreaCode(null);
    if (s.type === 'REGION') {
      setGeo({ lat: s.latitude, lng: s.longitude, radiusKm: REGION_RADIUS[s.regionLevel ?? 'CITY'] ?? 15 });
    } else {
      setGeo({ lat: s.latitude, lng: s.longitude, radiusKm: 5 });
      setSelectedId(s.id);
    }
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runKeywordSearch = useCallback(() => {
    setShowSuggest(false);
    triggerRef.current = 'submit';
    changedRef.current = ['keyword'];
    setKeyword(keywordInput.trim());
    setGeo(null);
    setPage(0);
  }, [keywordInput]);

  const searchThisArea = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const bounds = map.getBounds();
    if (!center || !bounds) return;
    triggerRef.current = 'area';
    changedRef.current = ['geo'];
    setGeo({ lat: center.lat(), lng: center.lng(), radiusKm: radiusFromBounds(bounds) });
    setPage(0);
    setMapMoved(false);
  }, []);

  const nearMe = useCallback(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      triggerRef.current = 'nearMe';
      changedRef.current = ['geo'];
      setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: 5 });
      setPage(0);
    });
  }, []);

  const isPlaceHost = window.location.hostname.split('.')[0] === 'place';
  const switchLang = (next: PlaceLang) => {
    if (next === lang) return;
    triggerRef.current = 'lang';
    changedRef.current = ['lang'];
    const base = isPlaceHost ? '' : '/place';
    navigate(next === 'en' ? `/en${base}` : base || '/');
  };

  return (
    <div className="place-page">
      <header className="place-header">
        <h1 className="place-title">
          {L.title}
          <span className="place-header-actions">
            <span className="place-lang-toggle" role="group" aria-label="Language">
              {(['ko', 'en'] as PlaceLang[]).map((key) => (
                <button
                  key={key}
                  className={`place-lang-btn ${lang === key ? 'active' : ''}`}
                  onClick={() => switchLang(key)}
                >
                  {key === 'ko' ? '한' : 'EN'}
                </button>
              ))}
            </span>
            <ThemeToggle />
          </span>
        </h1>
        <p className="place-subtitle">{L.subtitle}</p>
      </header>

      <div className="place-toolbar">
        <form
          className="place-search"
          onSubmit={(e) => {
            e.preventDefault();
            runKeywordSearch();
          }}
        >
          <div className="place-search-box">
            <input
              className="place-search-input"
              value={keywordInput}
              onChange={(e) => {
                setKeywordInput(e.target.value);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              placeholder={L.searchPlaceholder}
              aria-label={L.searchPlaceholder}
              autoComplete="off"
            />
            {showSuggest && suggestions.length > 0 && (
              <ul className="place-suggest" role="listbox">
                {suggestions.map((s) => (
                  <li
                    key={`${s.type}-${s.id}`}
                    className="place-suggest-item"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickSuggestion(s);
                    }}
                  >
                    <span className={`place-suggest-type ${s.type === 'REGION' ? 'region' : ''}`}>
                      {s.type === 'REGION'
                        ? (L.regionLevels[s.regionLevel ?? ''] ?? L.regionLabel)
                        : (s.category ? L.categories[s.category] ?? s.category : L.attractionLabel)}
                    </span>
                    <span className="place-suggest-title">{s.title}</span>
                    {titleParts(s).secondary && (
                      <span className="place-suggest-local">{titleParts(s).secondary}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit" className="place-btn primary">
            {lang === 'ko' ? '검색' : 'Search'}
          </button>
          <button type="button" className="place-btn" onClick={nearMe}>
            {L.nearMe}
          </button>
          <button
            type="button"
            className="place-btn"
            aria-haspopup="dialog"
            onClick={() => {
              setPickOpen(true);
              setPickItems(null);
              setPickError(false);
              const pages = Math.max(1, Math.ceil((data?.totalElements ?? 0) / 60));
              searchAttractions({ ...query, page: Math.floor(Math.random() * pages), size: 60 })
                .then((r) => setPickItems(r.attractions))
                .catch(() => setPickError(true));
            }}
          >
            {lang === 'ko' ? '뽑기' : 'Pick one'}
          </button>
        </form>
        {pickOpen && (
          <PickSheet<Attraction>
            label={lang === 'ko' ? '이 조건에서 아무 데나' : 'Pick one from these'}
            items={pickItems}
            error={pickError}
            render={(a, i) =>
              `${(a.thumbnailUrl ?? a.imageUrl) ? `<div class="cd-photo" data-src="${escapeHtml(a.thumbnailUrl ?? a.imageUrl ?? '')}"></div>` : '<div class="cd-photo"></div>'}` +
              `<div class="cd-body"><span class="cd-seal">${escapeHtml(a.category ? (L.categories[a.category] ?? a.category) : '')}</span>` +
              `<b class="cd-title">${escapeHtml(a.title)}</b><span class="cd-meta">${escapeHtml(a.address?.split(' ')[1] ?? '')} · ${String(i + 1).padStart(2, '0')}</span></div>`
            }
            describe={(a) => ({
              title: a.title,
              meta: [a.address?.split(' ')[1], a.category ? (L.categories[a.category] ?? a.category) : null].filter(Boolean).join(' · '),
            })}
            caption={[
              lang === 'ko' ? '지금 조건' : 'Current filters',
              `${(data?.totalElements ?? 0).toLocaleString()} → ${pickItems?.length ?? 0}`,
            ]}
            goLabel={lang === 'ko' ? '이곳 보기' : 'Open'}
            onGo={(a) => {
              setPickOpen(false);
              navigate(attractionPath(lang, a.id));
            }}
            onClose={() => setPickOpen(false)}
          />
        )}

        {/* 모바일 지역 선택 — 칩 벽 대신 현재 선택을 접은 트리거 + 바텀시트 드릴다운 */}
        {hasRegionAxis && isMobile && (
          <button
            type="button"
            className="place-region-trigger"
            aria-haspopup="dialog"
            onClick={() => setRegionSheetOpen(true)}
          >
            <span className="place-region-trigger-label">{regionTriggerLabel}</span>
            <span aria-hidden="true">▾</span>
          </button>
        )}
        {regionSheetOpen && isMobile && (
          <RegionSheet
            lang={lang}
            sidoCode={sidoCode}
            sigunguCode={sigunguCode}
            onChange={(next) => selectRegion(next, 'region')}
            onClose={() => setRegionSheetOpen(false)}
          />
        )}

        <div className="place-filters">
          <button
            className={`place-chip ${category == null ? 'active' : ''}`}
            onClick={() => {
              triggerRef.current = 'category';
              changedRef.current = ['category', 'listEventStatus', 'page'];
              setCategory(null);
              setPage(0);
            }}
          >
            {L.all}
          </button>
          {/* 행사는 모든 언어, 여행코스는 국문만 — 영문 서비스에는 코스 유형이 없어 0건 칩이 된다 */}
          {[...SIGHT_CATEGORIES, EVENT_CATEGORY, ...(lang === 'ko' ? [COURSE_CATEGORY] : [])].map((c) => (
            <button
              key={c}
              className={`place-chip ${category === c ? 'active' : ''}`}
              data-category={c}
              onClick={() => {
                triggerRef.current = 'category';
                changedRef.current = ['category', 'listEventStatus', 'page'];
                setCategory(category === c ? null : c);
                setListEventStatus(null);
                setPage(0);
              }}
            >
              {L.categories[c]}
            </button>
          ))}
          <span className="place-filter-sep" aria-hidden="true" />
          <span className="place-filter-label">{L.onMap}</span>
          {OVERLAY_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`place-chip overlay ${overlay === c ? 'active' : ''}`}
              aria-pressed={overlay === c}
              onClick={() => setOverlay(overlay === c ? null : c)}
            >
              {L.categories[c]}
            </button>
          ))}
          {!hasRegionAxis && (
            <select
              className="place-area-select"
              value={areaCode ?? ''}
              onChange={(e) => {
                triggerRef.current = 'region';
                changedRef.current = ['areaCode'];
                setAreaCode(e.target.value || null);
                setGeo(null);
                setPage(0);
              }}
              aria-label="Area"
            >
              <option value="">{L.all}</option>
              {AREAS.map((a) => (
                <option key={a.code} value={a.code}>
                  {lang === 'ko' ? a.ko : a.en}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 행사 상태 칩 — 행사 칩을 골랐을 때만. 안 고르면 끝나지 않은 행사 전부, 고른 칩을 다시 누르면 풀린다. */}
        {category === EVENT_CATEGORY && (
          <div className="place-event-filter" role="group" aria-label={L.eventStatusGroup}>
            {LIST_EVENT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`place-chip ${listEventStatus === s ? 'active' : ''}`}
                aria-pressed={listEventStatus === s}
                data-event-filter={s}
                onClick={() => {
                  triggerRef.current = 'eventStatus';
                  changedRef.current = ['listEventStatus', 'page'];
                  setListEventStatus(listEventStatus === s ? null : s);
                  setPage(0);
                }}
              >
                {L.eventStatuses[s]}
              </button>
            ))}
          </div>
        )}

        {/* 속성 칩 — 분류 칩과 다른 축이라 따로 한 묶음(모바일은 한 줄 가로 스크롤).
            칩은 숨기지 않는다: 안 고른 칩이 0 이면 흐리게 두고 자리를 지킨다 — 빠지면 옆 칩이
            밀려 누르려던 자리에 다른 칩이 온다. 고른 칩은 0 이어도 활성이다(풀 수 있어야 한다).
            행사 칩을 골랐을 때만 줄째 뺀다 — 관광지 속성이라 행사에는 전부 0 이다. */}
        {category !== EVENT_CATEGORY && (
          <div className="place-attr-group" role="group" aria-label={lang === 'en' ? 'Visitor info filters' : '방문 정보 필터'}>
            <div className="place-attr-chips">
              {attributeChips(lang).map((chip) => {
                const selected = attributes.has(chip.id);
                const count = chipCount(facets, chip.id);
                const empty = !selected && count === 0;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className={['place-chip', 'place-attr-chip', selected ? 'active' : '', empty ? 'is-empty' : '']
                      .filter(Boolean)
                      .join(' ')}
                    aria-pressed={selected}
                    data-attr={chip.id}
                    onClick={() => toggleAttribute(chip.id)}
                  >
                    {chip[lang]}
                    {count != null && (
                      <span className="place-attr-count">{count.toLocaleString(lang === 'en' ? 'en' : 'ko')}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="place-attr-caption">{ATTRIBUTE_CAPTION[lang]}</p>
          </div>
        )}

        {/* 데스크톱은 기존 칩 드릴다운 그대로 — 화면이 넓으면 펼쳐 보이는 쪽이 한 탭 덜 든다 */}
        {hasRegionAxis && !isMobile && (
          <RegionDrilldown
            lang={lang}
            sidoCode={sidoCode}
            sigunguCode={sigunguCode}
            origin={geo ? { lat: geo.lat, lng: geo.lng } : null}
            onChange={(next) => selectRegion(next, 'region')}
          />
        )}
      </div>

      <div
        className={[
          'place-body',
          isMobile || listOpen ? '' : 'list-collapsed',
          selected && !isMobile ? 'has-detail' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="place-list-col">
          {/* 접기 토글은 데스크톱 전용 — 모바일 목록은 지도 아래에 항상 있다 */}
          {!isMobile && (
            <button
              type="button"
              className="place-list-toggle"
              aria-expanded={listOpen}
              aria-label={listOpen ? L.hideList : L.showList}
              onClick={() => setListOpen((open) => !open)}
            >
              {listOpen ? `‹ ${L.hideList}` : '›'}
            </button>
          )}
          {(isMobile || listOpen) && pickingRegion && (
            <section className="place-list" aria-label={L.pickRegion}>
              <h2 className="place-subtitle">{L.pickRegion}</h2>
              <p className="place-region-hint">{L.pickRegionHint}</p>
              {(sidoRegions ?? []).map((r) => (
                <button key={r.code} className="place-card" onClick={() => selectRegion(r, 'region')}>
                  <div className="place-card-body">
                    <h3 className="place-card-title">{(lang === 'en' && r.nameEn) || r.name}</h3>
                    <p className="place-card-addr">
                      {(r.attractionCount ?? 0).toLocaleString(lang === 'en' ? 'en' : 'ko')} {L.countSuffix}
                    </p>
                  </div>
                </button>
              ))}
            </section>
          )}
          {(isMobile || listOpen) && !pickingRegion && (
            <section className="place-list" aria-busy={isLoading}>
              {attractions.length === 0 && !isLoading && (
                <p className="place-empty">{isError ? L.failed : L.empty}</p>
              )}
              {data?.correctedKeyword && attractions.length > 0 && (
                <p className="place-corrected" role="status">{L.corrected(data.correctedKeyword)}</p>
              )}
              {attractions.map((a, i) => (
                <PlaceCard
                  key={a.id}
                  attraction={a}
                  lang={lang}
                  index={i}
                  viewId={viewId}
                  screenRef={screenRef}
                  onSelect={() => setSelectedId(a.id)}
                />
              ))}
              {/* 다음 페이지를 기다리는 자리 — 정경 톤 opacity pulse (shimmer 금지) */}
              {isMobile && isLoading && (
                <div className="place-card place-card-loading kh-skeleton" aria-hidden="true" />
              )}
              {!isMobile && data && data.totalPages > 1 && (
                <div className="place-paging">
                  <button
                    className="place-btn"
                    disabled={page === 0}
                    onClick={() => {
                      triggerRef.current = 'page';
                      changedRef.current = ['page'];
                      setPage(page - 1);
                    }}
                  >
                    {L.prev}
                  </button>
                  <span className="place-paging-info">
                    {data.currentPage + 1} / {data.totalPages}
                  </span>
                  <button
                    className="place-btn"
                    disabled={page + 1 >= data.totalPages}
                    onClick={() => {
                      triggerRef.current = 'page';
                      changedRef.current = ['page'];
                      setPage(page + 1);
                    }}
                  >
                    {L.next}
                  </button>
                </div>
              )}
              {/* 모바일은 무한 스크롤 — IO 가 없는 브라우저만 버튼으로 대신한다 */}
              {isMobile && data && nextPage(page, data.totalPages) != null && (
                hasIO ? (
                  <div ref={sentinelRef} className="place-list-sentinel" aria-hidden="true" />
                ) : (
                  <button
                    className="place-btn place-load-more"
                    onClick={() => {
                      triggerRef.current = 'page';
                      changedRef.current = ['page'];
                      setPage((p) => nextPage(p, data.totalPages) ?? p);
                    }}
                  >
                    {L.loadMore}
                  </button>
                )
              )}
            </section>
          )}
        </div>

        <section className="place-map-wrap">
          {hasMapKey ? (
            <>
              <div ref={mapDivRef} className="place-map" role="application" aria-label={L.title} />
              {mapMoved && (
                <button className="place-btn primary place-search-area" onClick={searchThisArea}>
                  {L.searchArea}
                </button>
              )}
            </>
          ) : (
            <div className="place-map place-map-placeholder">{L.mapKeyMissing}</div>
          )}

          {/* 캐로셀은 정보 패널의 부속이 아니라 장소에 딸린 것이다 — 데스크톱은 지도 하단.
              모바일은 상세 시트 안이다: 시트가 화면을 덮는 동안 지도 아래 캐로셀은 보이지 않는다. */}
          {selected && !isMobile && <AttractionLinks links={selected.links} lang={lang} />}
        </section>

        {selected && !isMobile && (
          <aside className="place-detail" aria-label={selected.title}>
            <button className="place-detail-close" onClick={() => setSelectedId(null)}>
              {L.close}
            </button>
            <AttractionDetailBody attraction={selected} lang={lang} viewId={viewId} screenRef={screenRef} />
          </aside>
        )}
      </div>

      {/* 모바일 상세 — 세 번째 열 대신 바텀시트. 포커스·Escape·드래그 닫기는 KhSheet 가 담당하고,
          선택이 화면 아래로 흘러가 못 보는 일이 없다. */}
      {selected && isMobile && (
        <KhSheet label={L.attractionLabel} onClose={() => setSelectedId(null)}>
          <div className="place-detail place-detail-sheet" aria-label={selected.title}>
            <AttractionDetailBody attraction={selected} lang={lang} viewId={viewId} screenRef={screenRef} />
            <AttractionLinks links={selected.links} lang={lang} />
          </div>
        </KhSheet>
      )}

      {/* 출처 고지는 공통 푸터의 슬롯으로 — TourAPI(공공누리)·GeoNames(CC BY 4.0) 는
          출처표시 의무가 있다 (docs/architecture/data-sources.md §0). */}
      <Footer lang={lang}>
        <p>
          {L.source} · GeoNames (CC BY 4.0)
        </p>
      </Footer>
    </div>
  );
}

/** 상세 본문 — 데스크톱 세 번째 열과 모바일 바텀시트가 같은 내용을 그린다. 계측 한 벌(viewId·지역 코드)은 허브가 넘긴다. */
function AttractionDetailBody({
  attraction,
  lang,
  viewId,
  screenRef,
}: {
  attraction: Attraction;
  lang: PlaceLang;
  viewId: string;
  screenRef: string;
}) {
  const L = UI[lang];
  const { primary, secondary } = titleParts(attraction);
  return (
    <>
      {attraction.imageUrl && (
        <img className="place-detail-img" src={attraction.imageUrl} alt={primary} loading="lazy" />
      )}
      {/* 찜 (ADR-0074) — 제목 오른쪽 별. 데스크톱 열·모바일 시트가 이 본문을 공유하므로 여기 한 번만 둔다 */}
      <div className="favorite-title-row">
        <h2 className="place-detail-title">{primary}</h2>
        <FavoriteButton
          type="ATTRACTION"
          targetKey={attraction.id}
          lang={lang}
          tracking={{ screenType: 'PLACE_HUB', screenRef, viewId }}
        />
      </div>
      {secondary && <p className="place-detail-local">{secondary}</p>}
      {attraction.category && (
        <span className="place-chip active">{L.categories[attraction.category] ?? attraction.category}</span>
      )}
      <EventLine attraction={attraction} lang={lang} />
      {attraction.address && <p className="place-detail-addr">{attraction.address}</p>}
      {attraction.tel && <p className="place-detail-tel">{attraction.tel}</p>}
      {attraction.overview && <p className="place-detail-overview">{attraction.overview}</p>}
      <a className="place-btn" href={attractionPath(lang, attraction.id)}>
        {lang === 'en' ? 'Open detail page' : '상세 페이지 열기'}
      </a>
      {/* 지도 열기 — 선택 뒤 후속 행동이라 노출은 보내지 않는다(TrackedLink 를 쓰지 않는다).
          기본 동작(새 탭)은 그대로고, 계측이 이동을 막지 않는다 */}
      <a
        className="place-btn primary"
        href={googleMapsSearchUrl(attraction)}
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          track(
            'CLICK',
            {
              entityType: 'ATTRACTION',
              entityId: attraction.id,
              screenType: 'PLACE_HUB',
              screenRef,
              sectionId: 'MAP_LINK',
              payload: { kind: 'google_maps_search' },
            },
            viewId,
          )
        }
      >
        {L.openInGoogleMaps}
      </a>
    </>
  );
}

function PlaceCard({
  attraction,
  lang,
  index,
  viewId,
  screenRef,
  onSelect,
}: {
  attraction: Attraction;
  lang: PlaceLang;
  /** 목록 순서 — 노출·클릭의 itemIndex */
  index: number;
  viewId: string;
  screenRef: string;
  onSelect: () => void;
}) {
  const L = UI[lang];
  const { primary, secondary } = titleParts(attraction);
  // 노출은 그려진 것이 아니라 보인 것(면적 50%·1초)만 — 기준은 useImpression 하나다 (ADR-0095)
  const impressionRef = useImpression<HTMLAnchorElement>(
    {
      entityType: 'ATTRACTION',
      entityId: attraction.id,
      screenType: 'PLACE_HUB',
      screenRef,
      sectionId: 'ATTRACTION_LIST',
      itemIndex: index,
    },
    viewId,
  );
  return (
    // 실주소를 가진 링크로 둔다 — 크롤러는 onClick 을 따라가지 못하고, 사용자는 새 탭/공유가 된다.
    // 평범한 좌클릭만 가로채 기존 사이드 패널 UX 를 유지한다.
    // id 는 클러스터 최대 줌에서 "이 무리의 목록 보기" 스크롤 목적지다.
    <a
      ref={impressionRef}
      id={`place-card-${attraction.id}`}
      className="place-card"
      href={attractionPath(lang, attraction.id)}
      onClick={(e) => {
        // 수정키 클릭은 기본 동작(새 탭)을 두되 선택으로는 센다 — 가운데 클릭은 click 이 아니라 세지 않는다
        const newTab = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
        track(
          'CLICK',
          {
            entityType: 'ATTRACTION',
            entityId: attraction.id,
            screenType: 'PLACE_HUB',
            screenRef,
            sectionId: 'ATTRACTION_LIST',
            itemIndex: index,
            payload: newTab ? { source: 'card', newTab: true } : { source: 'card' },
          },
          viewId,
        );
        if (newTab) return;
        e.preventDefault();
        onSelect();
      }}
    >
      {/* 목록 카드는 88px 정사각 — 300×200 썸네일이면 충분하고 원본은 장당 130~550KB 다.
          상세(place-detail-img)는 폭을 다 쓰므로 그대로 원본을 쓴다 */}
      {(attraction.thumbnailUrl ?? attraction.imageUrl) ? (
        <img
          className="place-card-img"
          src={attraction.thumbnailUrl ?? attraction.imageUrl ?? ''}
          alt=""
          loading="lazy"
        />
      ) : (
        <div className="place-card-img place-card-img-empty" aria-hidden />
      )}
      {/* 찜 — 실주소 <a> 안에 앉지만 클릭은 버튼이 삼켜 카드 이동으로 번지지 않는다 (ADR-0074) */}
      <span className="place-card-favorite">
        <FavoriteButton
          type="ATTRACTION"
          targetKey={attraction.id}
          compact
          lang={lang}
          tracking={{ screenType: 'PLACE_HUB', screenRef, viewId }}
        />
      </span>
      <div className="place-card-body">
        <h3 className="place-card-title">{primary}</h3>
        {secondary && <p className="place-card-local">{secondary}</p>}
        <p className="place-card-meta">
          {attraction.category && <span>{L.categories[attraction.category] ?? attraction.category}</span>}
          {attraction.distanceKm != null && <span>{attraction.distanceKm.toFixed(1)}km</span>}
        </p>
        <EventLine attraction={attraction} lang={lang} />
        {attraction.address && <p className="place-card-addr">{attraction.address}</p>}
        {attraction.overview && <p className="place-card-overview">{attraction.overview}</p>}
      </div>
    </a>
  );
}
