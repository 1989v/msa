/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAdminRegions,
  fetchAttraction,
  searchAttractions,
  suggestPlaces,
  type AdminRegion,
  type Attraction,
  type AttractionQuery,
  type PlaceLang,
  type Suggestion,
} from '../../api/placeApi';
import { loadGoogleMaps, mapsApiKey, nearestRegion, neighboursInFrame, radiusFromBounds } from './googleMaps';
import AttractionLinks from './AttractionLinks';
import RegionDrilldown from './RegionDrilldown';
import ThemeToggle from '../../components/ThemeToggle';
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

// ADR-0065 K-관광/지리 탐색 — 관광지 지도 검색. 데이터 출처: 한국관광공사 TourAPI.
// place.<domain> 서브도메인이 정규 주소 (game 과 동일한 host 인식 루트 라우팅):
//   place 호스트: /(ko) · /en(en) — apex/개발: /place · /en/place (ADR-0062 언어 URL 규칙)

const UI = {
  ko: {
    title: 'K-관광 지도',
    subtitle: '한국의 관광지를 검색하고 지도에서 찾아보세요',
    searchPlaceholder: '관광지 검색 — 예: 궁궐, 해수욕장',
    nearMe: '내 주변',
    searchArea: '이 지역 재검색',
    all: '전체',
    empty: '검색 결과가 없습니다',
    mapKeyMissing: '지도 키가 설정되지 않아 목록만 표시합니다',
    openInGoogleMaps: '구글맵에서 보기',
    source: '출처: 한국관광공사 TourAPI',
    prev: '이전',
    next: '다음',
    close: '닫기',
    hideList: '목록 접기',
    showList: '목록 펼치기',
    onMap: '지도에 표시',
    categories: {
      nature: '자연', history: '역사', culture: '문화', leisure: '레포츠',
      shopping: '쇼핑', food: '음식', stay: '숙박', etc: '기타',
    } as Record<string, string>,
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
    mapKeyMissing: 'Map key not configured — showing list only',
    openInGoogleMaps: 'Open in Google Maps',
    source: 'Source: Korea Tourism Organization TourAPI',
    prev: 'Prev',
    next: 'Next',
    close: 'Close',
    hideList: 'Hide list',
    showList: 'Show list',
    onMap: 'Show on map',
    categories: {
      nature: 'Nature', history: 'History', culture: 'Culture', leisure: 'Leisure',
      shopping: 'Shopping', food: 'Food', stay: 'Stay', etc: 'Etc',
    } as Record<string, string>,
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
const CATEGORIES = ['nature', 'history', 'culture', 'leisure'];
const OVERLAY_CATEGORIES = ['food', 'shopping'];
/** 지도 오버레이는 화면에 보이는 범위만 가져온다 — 시군구 전체 식당을 찍으면 마커로 덮인다 */
const OVERLAY_SIZE = 60;

/** 지도 API 에 넘길 색은 CSS 변수가 아니라 계산된 값이어야 한다 (DESIGN.md — hex 직접 입력 금지). */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// 선택 시 프레임에 함께 넣을 주변 명소 수 / 확대 상한 (건물 단위까지 당기지 않는다)
const NEIGHBOURS_IN_FRAME = 6;
const MAX_SELECT_ZOOM = 16;

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
  // 좁은 화면은 세 열이 안 들어간다 — 접힌 채로 시작해 지도를 먼저 보인다
  const [listOpen, setListOpen] = useState(() => window.innerWidth > 900);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const overlayMarkersRef = useRef<any[]>([]);
  const hasMapKey = mapsApiKey() !== '';

  const query: AttractionQuery = useMemo(
    () => ({
      keyword: keyword || undefined,
      lang,
      // 두 축을 같이 보내지 않는다 — 어느 쪽이 이기는지 서버도 호출자도 모른다 (ADR-0071 §9)
      areaCode: sidoCode ? undefined : (areaCode ?? undefined),
      sidoCode: sidoCode ?? undefined,
      sigunguCode: sigunguCode ?? undefined,
      // 분류를 안 고르면 관광 분류 전체 — 음식·쇼핑은 목록에 올리지 않는다
      category: category ?? CATEGORIES.join(','),
      lat: geo?.lat,
      lng: geo?.lng,
      radiusKm: geo?.radiusKm,
      sort: geo ? 'distance' : 'relevance',
      page,
      size: 30,
    }),
    [keyword, lang, areaCode, sidoCode, sigunguCode, category, geo, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['place-attractions', query],
    queryFn: () => searchAttractions(query),
    staleTime: 60_000,
  });

  const { data: sidoRegions } = useQuery({
    queryKey: ['admin-regions', 'SIDO', lang],
    queryFn: () => fetchAdminRegions({ level: 'SIDO', lang }),
    staleTime: 30 * 60_000,
  });
  // 자료가 들어오면 드릴다운으로, 아직이면 이전 광역 선택으로. 두 축을 동시에 노출하지 않는다.
  const hasRegionAxis = (sidoRegions?.length ?? 0) > 0;
  /*
   * 시도를 아직 안 고른 첫 화면 (ADR-0071 §3 — 탐색의 축이 지역이다).
   *
   * 이 상태에서 전국 관광지 30건을 흩뿌리면 마커가 아무 의미도 없다 — 6만 곳 중 30개를
   * 무작위로 본 셈이라 고를 근거가 안 된다. 대신 **시도 자체를 마커로** 보여 "어디부터
   * 볼지"를 지도에서 고르게 한다. 검색어나 내 주변을 쓰면 그건 명시적 의도라 비켜준다.
   */
  const pickingRegion = hasRegionAxis && !sidoCode && !keyword && !geo;

  /** 지역 선택 — 드릴다운 칩과 지도의 시도 마커가 같은 경로를 쓴다. */
  const selectRegion = useCallback(
    (next: { sidoCode: string | null; sigunguCode: string | null; region?: AdminRegion } | AdminRegion) => {
      const region = 'level' in next ? next : next.region;
      const nextSido = 'level' in next ? next.code : next.sidoCode;
      const nextSigungu = 'level' in next ? null : next.sigunguCode;
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

    const pick = (region?: AdminRegion | null) => {
      const target = region ?? regions.find((r) => r.code === DEFAULT_SIDO_CODE) ?? regions[0];
      if (target) selectRegion(target);
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

  useEffect(() => {
    document.title = `${L.title} — 1989v`;
  }, [L.title]);

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

  // 결과 → 마커 동기화
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !window.google?.maps) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = new Map();

    // 지역 선택 화면 — 관광지 대신 시도를 찍는다. 클릭하면 그 시도로 들어간다.
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
            color: token('--ko-surface-0'),
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
        marker.addListener('click', () => selectRegion(r));
        markersRef.current.set(r.code, marker);
        bounds.extend({ lat: r.latitude, lng: r.longitude });
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 56);
        window.google.maps.event.addListenerOnce(map, 'idle', () => setMapMoved(false));
      }
      return;
    }

    const attractions = data?.attractions ?? [];
    if (attractions.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    attractions.forEach((a) => {
      const marker = new window.google.maps.Marker({
        map,
        position: { lat: a.latitude, lng: a.longitude },
        title: a.title,
      });
      marker.addListener('click', () => setSelectedId(a.id));
      markersRef.current.set(a.id, marker);
      bounds.extend({ lat: a.latitude, lng: a.longitude });
    });
    map.fitBounds(bounds, 48);
    window.google.maps.event.addListenerOnce(map, 'idle', () => {
      // 시도를 고른 상태면 그 레벨보다 더 당기지 않는다
      if (areaCode && map.getZoom() > MAX_ZOOM_BY_LEVEL.SIDO) map.setZoom(MAX_ZOOM_BY_LEVEL.SIDO);
      // fitBounds 가 유발하는 zoom_changed 를 사용자 이동으로 오인하지 않게 리셋
      setMapMoved(false);
    });
  }, [data, mapReady, areaCode, pickingRegion, sidoRegions, lang, selectRegion]);

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
      marker.addListener('click', () => setSelectedId(a.id));
      overlayMarkersRef.current.push(marker);
    });
  }, [overlay, overlayData, mapReady]);

  // 선택 → 지도가 따라간다. 그 명소만 꽉 채우지 않고 **가까운 몇 곳을 프레임에 함께 넣는다** —
  // 한 점만 확대하면 "여기가 어디 옆인지"가 사라져서 지도가 목록의 장식이 된다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedId || !window.google?.maps) return;
    const list = data?.attractions ?? [];
    const target = list.find((a) => a.id === selectedId);
    if (!target) return;

    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: target.latitude, lng: target.longitude });
    neighboursInFrame(target, list, NEIGHBOURS_IN_FRAME)
      .forEach((a) => bounds.extend({ lat: a.latitude, lng: a.longitude }));
    map.fitBounds(bounds, 72);

    window.google.maps.event.addListenerOnce(map, 'idle', () => {
      // 주변이 몇 십 미터 안에 몰려 있으면 fitBounds 가 건물 단위까지 당긴다 — 상한을 둔다.
      if (map.getZoom() > MAX_SELECT_ZOOM) map.setZoom(MAX_SELECT_ZOOM);
      setMapMoved(false);
    });
  }, [selectedId, data, mapReady]);

  // 어느 마커가 선택됐는지 지도 위에서도 보여야 한다. 튀는 동작은 두 번만 —
  // 계속 뛰면 시선을 붙잡아 나머지 마커를 읽기 어렵게 만든다.
  useEffect(() => {
    if (!window.google?.maps) return;
    const selected = selectedId ? markersRef.current.get(selectedId) : null;
    markersRef.current.forEach((marker, id) => {
      marker.setZIndex(id === selectedId ? 999 : 1);
      if (id !== selectedId) marker.setAnimation(null);
    });
    if (!selected) return;
    selected.setAnimation(window.google.maps.Animation.BOUNCE);
    const stop = setTimeout(() => selected.setAnimation(null), 1500);
    return () => {
      clearTimeout(stop);
      selected.setAnimation(null);
    };
  }, [selectedId, data]);

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
    setGeo({ lat: center.lat(), lng: center.lng(), radiusKm: radiusFromBounds(bounds) });
    setPage(0);
    setMapMoved(false);
  }, []);

  const nearMe = useCallback(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, radiusKm: 5 });
      setPage(0);
    });
  }, []);

  const isPlaceHost = window.location.hostname.split('.')[0] === 'place';
  const switchLang = (next: PlaceLang) => {
    if (next === lang) return;
    const base = isPlaceHost ? '' : '/place';
    navigate(next === 'en' ? `/en${base}` : base || '/');
  };

  const attractions = data?.attractions ?? [];

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
        </form>

        <div className="place-filters">
          <button
            className={`place-chip ${category == null ? 'active' : ''}`}
            onClick={() => {
              setCategory(null);
              setPage(0);
            }}
          >
            {L.all}
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`place-chip ${category === c ? 'active' : ''}`}
              onClick={() => {
                setCategory(category === c ? null : c);
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

        {hasRegionAxis && (
          <RegionDrilldown
            lang={lang}
            sidoCode={sidoCode}
            sigunguCode={sigunguCode}
            origin={geo ? { lat: geo.lat, lng: geo.lng } : null}
            onChange={selectRegion}
          />
        )}
      </div>

      <div
        className={[
          'place-body',
          listOpen ? '' : 'list-collapsed',
          selected ? 'has-detail' : '',
        ].filter(Boolean).join(' ')}
      >
        <div className="place-list-col">
          <button
            type="button"
            className="place-list-toggle"
            aria-expanded={listOpen}
            aria-label={listOpen ? L.hideList : L.showList}
            onClick={() => setListOpen((open) => !open)}
          >
            {listOpen ? `‹ ${L.hideList}` : '›'}
          </button>
          {listOpen && pickingRegion && (
            <section className="place-list" aria-label={L.pickRegion}>
              <h2 className="place-subtitle">{L.pickRegion}</h2>
              <p className="place-region-hint">{L.pickRegionHint}</p>
              {(sidoRegions ?? []).map((r) => (
                <button key={r.code} className="place-card" onClick={() => selectRegion(r)}>
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
          {listOpen && !pickingRegion && (
            <section className="place-list" aria-busy={isLoading}>
              {attractions.length === 0 && !isLoading && <p className="place-empty">{L.empty}</p>}
              {attractions.map((a) => (
                <PlaceCard key={a.id} attraction={a} lang={lang} onSelect={() => setSelectedId(a.id)} />
              ))}
              {data && data.totalPages > 1 && (
                <div className="place-paging">
                  <button className="place-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    {L.prev}
                  </button>
                  <span className="place-paging-info">
                    {data.currentPage + 1} / {data.totalPages}
                  </span>
                  <button
                    className="place-btn"
                    disabled={page + 1 >= data.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    {L.next}
                  </button>
                </div>
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

          {/* 캐로셀은 정보 패널의 부속이 아니라 장소에 딸린 것이다 — 지도 하단에 둔다 */}
          {selectedId && <AttractionLinks id={selectedId} lang={lang} />}
        </section>

        {selected && (
          <aside className="place-detail" aria-label={selected.title}>
            <button className="place-detail-close" onClick={() => setSelectedId(null)}>
              {L.close}
            </button>
            {selected.imageUrl && (
              <img className="place-detail-img" src={selected.imageUrl} alt={selected.title} loading="lazy" />
            )}
            <h2 className="place-detail-title">{selected.title}</h2>
            {selected.category && (
              <span className="place-chip active">{L.categories[selected.category] ?? selected.category}</span>
            )}
            {selected.address && <p className="place-detail-addr">{selected.address}</p>}
            {selected.tel && <p className="place-detail-tel">{selected.tel}</p>}
            {selected.overview && <p className="place-detail-overview">{selected.overview}</p>}
            <a className="place-btn" href={attractionPath(lang, selected.id)}>
              {lang === 'en' ? 'Open detail page' : '상세 페이지 열기'}
            </a>
            <a
            className="place-btn primary"
            href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
            target="_blank"
            rel="noreferrer"
            >
            {L.openInGoogleMaps}
            </a>
          </aside>
        )}
      </div>

      <footer className="place-footer">{L.source}</footer>
    </div>
  );
}

function PlaceCard({
  attraction,
  lang,
  onSelect,
}: {
  attraction: Attraction;
  lang: PlaceLang;
  onSelect: () => void;
}) {
  const L = UI[lang];
  return (
    // 실주소를 가진 링크로 둔다 — 크롤러는 onClick 을 따라가지 못하고, 사용자는 새 탭/공유가 된다.
    // 평범한 좌클릭만 가로채 기존 사이드 패널 UX 를 유지한다.
    <a
      className="place-card"
      href={attractionPath(lang, attraction.id)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onSelect();
      }}
    >
      {attraction.imageUrl ? (
        <img className="place-card-img" src={attraction.imageUrl} alt="" loading="lazy" />
      ) : (
        <div className="place-card-img place-card-img-empty" aria-hidden />
      )}
      <div className="place-card-body">
        <h3 className="place-card-title">{attraction.title}</h3>
        <p className="place-card-meta">
          {attraction.category && <span>{L.categories[attraction.category] ?? attraction.category}</span>}
          {attraction.distanceKm != null && <span>{attraction.distanceKm.toFixed(1)}km</span>}
        </p>
        {attraction.address && <p className="place-card-addr">{attraction.address}</p>}
        {attraction.overview && <p className="place-card-overview">{attraction.overview}</p>}
      </div>
    </a>
  );
}
