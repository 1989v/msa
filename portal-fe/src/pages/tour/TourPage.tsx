/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAttraction,
  searchAttractions,
  type Attraction,
  type AttractionQuery,
  type TourLang,
} from '../../api/tourApi';
import { loadGoogleMaps, mapsApiKey, radiusFromBounds } from './googleMaps';
import './TourPage.css';

// ADR-0065 K-관광 검색 — 관광지 지도 탐색. 데이터 출처: 한국관광공사 TourAPI.
// /tour(ko) · /en/tour(en) — ADR-0062 언어 URL 규칙.

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
    categories: {
      nature: '자연', history: '역사', culture: '문화', leisure: '레포츠',
      shopping: '쇼핑', food: '음식', stay: '숙박', etc: '기타',
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
    categories: {
      nature: 'Nature', history: 'History', culture: 'Culture', leisure: 'Leisure',
      shopping: 'Shopping', food: 'Food', stay: 'Stay', etc: 'Etc',
    } as Record<string, string>,
  },
};

const CATEGORIES = ['nature', 'history', 'culture', 'leisure', 'shopping', 'food'];

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

export default function TourPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lang: TourLang = pathname.startsWith('/en') ? 'en' : 'ko';
  const L = UI[lang];

  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [areaCode, setAreaCode] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoState | null>(null);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapMoved, setMapMoved] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const hasMapKey = mapsApiKey() !== '';

  const query: AttractionQuery = useMemo(
    () => ({
      keyword: keyword || undefined,
      lang,
      areaCode: areaCode ?? undefined,
      category: category ?? undefined,
      lat: geo?.lat,
      lng: geo?.lng,
      radiusKm: geo?.radiusKm,
      sort: geo ? 'distance' : 'relevance',
      page,
      size: 30,
    }),
    [keyword, lang, areaCode, category, geo, page],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['tour-attractions', query],
    queryFn: () => searchAttractions(query),
    staleTime: 60_000,
  });

  const { data: selected } = useQuery({
    queryKey: ['tour-attraction', selectedId],
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
    markersRef.current = [];
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
      markersRef.current.push(marker);
      bounds.extend({ lat: a.latitude, lng: a.longitude });
    });
    map.fitBounds(bounds, 48);
    // fitBounds 가 유발하는 zoom_changed 를 사용자 이동으로 오인하지 않게 리셋
    window.google.maps.event.addListenerOnce(map, 'idle', () => setMapMoved(false));
  }, [data, mapReady]);

  const runKeywordSearch = useCallback(() => {
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

  const switchLang = (next: TourLang) => {
    if (next !== lang) navigate(next === 'en' ? '/en/tour' : '/tour');
  };

  const attractions = data?.attractions ?? [];

  return (
    <div className="tour-page">
      <header className="tour-header">
        <h1 className="tour-title">
          {L.title}
          <span className="tour-lang-toggle" role="group" aria-label="Language">
            {(['ko', 'en'] as TourLang[]).map((key) => (
              <button
                key={key}
                className={`tour-lang-btn ${lang === key ? 'active' : ''}`}
                onClick={() => switchLang(key)}
              >
                {key === 'ko' ? '한' : 'EN'}
              </button>
            ))}
          </span>
        </h1>
        <p className="tour-subtitle">{L.subtitle}</p>
      </header>

      <div className="tour-toolbar">
        <form
          className="tour-search"
          onSubmit={(e) => {
            e.preventDefault();
            runKeywordSearch();
          }}
        >
          <input
            className="tour-search-input"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder={L.searchPlaceholder}
            aria-label={L.searchPlaceholder}
          />
          <button type="submit" className="tour-btn primary">
            {lang === 'ko' ? '검색' : 'Search'}
          </button>
          <button type="button" className="tour-btn" onClick={nearMe}>
            {L.nearMe}
          </button>
        </form>

        <div className="tour-filters">
          <button
            className={`tour-chip ${category == null ? 'active' : ''}`}
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
              className={`tour-chip ${category === c ? 'active' : ''}`}
              onClick={() => {
                setCategory(category === c ? null : c);
                setPage(0);
              }}
            >
              {L.categories[c]}
            </button>
          ))}
          <select
            className="tour-area-select"
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
        </div>
      </div>

      <div className="tour-body">
        <section className="tour-list" aria-busy={isLoading}>
          {attractions.length === 0 && !isLoading && <p className="tour-empty">{L.empty}</p>}
          {attractions.map((a) => (
            <TourCard key={a.id} attraction={a} lang={lang} onSelect={() => setSelectedId(a.id)} />
          ))}
          {data && data.totalPages > 1 && (
            <div className="tour-paging">
              <button className="tour-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
                {L.prev}
              </button>
              <span className="tour-paging-info">
                {data.currentPage + 1} / {data.totalPages}
              </span>
              <button
                className="tour-btn"
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {L.next}
              </button>
            </div>
          )}
        </section>

        <section className="tour-map-wrap">
          {hasMapKey ? (
            <>
              <div ref={mapDivRef} className="tour-map" role="application" aria-label={L.title} />
              {mapMoved && (
                <button className="tour-btn primary tour-search-area" onClick={searchThisArea}>
                  {L.searchArea}
                </button>
              )}
            </>
          ) : (
            <div className="tour-map tour-map-placeholder">{L.mapKeyMissing}</div>
          )}

          {selected && (
            <aside className="tour-detail" aria-label={selected.title}>
              <button className="tour-detail-close" onClick={() => setSelectedId(null)}>
                {L.close}
              </button>
              {selected.imageUrl && (
                <img className="tour-detail-img" src={selected.imageUrl} alt={selected.title} loading="lazy" />
              )}
              <h2 className="tour-detail-title">{selected.title}</h2>
              {selected.category && (
                <span className="tour-chip active">{L.categories[selected.category] ?? selected.category}</span>
              )}
              {selected.address && <p className="tour-detail-addr">{selected.address}</p>}
              {selected.tel && <p className="tour-detail-tel">{selected.tel}</p>}
              {selected.overview && <p className="tour-detail-overview">{selected.overview}</p>}
              <a
                className="tour-btn primary"
                href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                {L.openInGoogleMaps}
              </a>
            </aside>
          )}
        </section>
      </div>

      <footer className="tour-footer">{L.source}</footer>
    </div>
  );
}

function TourCard({
  attraction,
  lang,
  onSelect,
}: {
  attraction: Attraction;
  lang: TourLang;
  onSelect: () => void;
}) {
  const L = UI[lang];
  return (
    <article className="tour-card" onClick={onSelect} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}>
      {attraction.imageUrl ? (
        <img className="tour-card-img" src={attraction.imageUrl} alt="" loading="lazy" />
      ) : (
        <div className="tour-card-img tour-card-img-empty" aria-hidden />
      )}
      <div className="tour-card-body">
        <h3 className="tour-card-title">{attraction.title}</h3>
        <p className="tour-card-meta">
          {attraction.category && <span>{L.categories[attraction.category] ?? attraction.category}</span>}
          {attraction.distanceKm != null && <span>{attraction.distanceKm.toFixed(1)}km</span>}
        </p>
        {attraction.address && <p className="tour-card-addr">{attraction.address}</p>}
        {attraction.overview && <p className="tour-card-overview">{attraction.overview}</p>}
      </div>
    </article>
  );
}
