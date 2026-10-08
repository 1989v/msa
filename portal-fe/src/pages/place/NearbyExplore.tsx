/* eslint-disable @typescript-eslint/no-explicit-any -- 구글 지도 SDK 타입을 들이지 않는다(googleMaps.ts 와 같은 방식) */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlaceLang } from '../../api/placeApi';
import { attractionPath, placeCategoryLabel } from '../../seo/copy.mjs';
import { secureImageUrl } from './placeView';
import TrackedLink from '../../analytics/TrackedLink';
import type { TrackedItem } from '../../analytics/events';
import EventLine from './EventLine';
import { loadGoogleMaps } from './googleMaps';
import { distanceLabel } from './placeAttributes';
import { useMediaQuery } from './useMediaQuery';
import type { ExploreItem, ExploreKind } from './exploreItems';

/**
 * 「전체」는 가까운 곳 몇 곳에만 범위를 맞춘다. 5km 안을 다 넣으면 시 단위로 물러나 가까운 마커가
 * 한 점에 겹친다(해운대 실측). 칩으로 한 종류를 고르면 그 종류 전부에 맞춘다.
 */
const ALL_FIT_NEAREST = 12;
/** 좁은 화면 목록은 처음 이만큼 — 33줄을 다 펴면 목록이 화면 여러 장이 된다. 넓은 화면은 목록 칸이 스크롤된다 */
const NARROW_ROWS = 8;
/** 상세 지도 줌 상한 — 허브와 같은 이유로 건물 단위까지 당기지 않는다 */
const MAX_ZOOM = 16;

const KINDS: ExploreKind[] = ['sight', 'stay', 'event', 'amenity'];

const TEXT = {
  ko: {
    title: '주변 탐색',
    all: '전체',
    kind: { sight: '명소', stay: '숙소', event: '행사', amenity: '편의시설' } as Record<ExploreKind, string>,
    same: '같은 분류',
    self: '이 장소',
    mapAria: '주변 지도',
    noMap: '지도를 표시할 수 없어 목록만 보여 줍니다',
    more: (n: number) => `목록 더 보기 (${n})`,
  },
  en: {
    title: 'Explore nearby',
    all: 'All',
    kind: { sight: 'Sights', stay: 'Stays', event: 'Events', amenity: 'Amenities' } as Record<ExploreKind, string>,
    same: 'Same type',
    self: 'This place',
    mapAria: 'Nearby map',
    noMap: 'The map is unavailable, so only the list is shown',
    more: (n: number) => `Show ${n} more`,
  },
} as const;

/** 지도 API 에 넘길 색은 CSS 변수가 아니라 계산된 값이어야 한다 (DESIGN.md — hex 직접 입력 금지). */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 종류별 색 토큰 — 목록 번호 원(CSS)과 지도 마커가 같은 표를 쓴다 */
const KIND_TOKEN: Record<ExploreKind, string> = {
  sight: '--kh-pine',
  stay: '--kh-celadon',
  event: '--kh-ocher',
  amenity: '--kh-giwa',
};

function markerIcon(maps: any, kind: ExploreKind, active: boolean) {
  return {
    path: maps.SymbolPath.CIRCLE,
    scale: active ? 15 : 11,
    fillColor: token(KIND_TOKEN[kind]),
    fillOpacity: 1,
    strokeColor: token('--kh-hanji'),
    strokeWeight: active ? 3 : 1.5,
  };
}

/**
 * 「주변 탐색」 — 지도에 이 장소와 주변을 번호 마커로 찍고, 같은 번호의 목록을 곁에 둔다.
 *
 * 데이터는 상세가 처음 받은 주변 목록뿐이다 — 지도를 옮겨도 다시 조회하지 않는다(요청이
 * 사용자 조작 수를 따라가지 않게). 칩은 지도와 목록을 함께 거른다. 마커를 누르면 그 줄이,
 * 줄에 마우스·포커스를 두면 그 마커가 강조된다. 줄을 누르면 그 상세로 간다.
 */
export default function NearbyExplore({
  items,
  center,
  centerTitle,
  showMap,
  lang,
  viewId,
  screenRef,
}: {
  items: ExploreItem[];
  center: { lat: number; lng: number } | null;
  centerTitle: string;
  /** 키가 있고 좌표가 정상일 때만 — 아니면 목록만 그린다 */
  showMap: boolean;
  lang: PlaceLang;
  viewId: string;
  screenRef: string;
}) {
  const T = TEXT[lang];
  const [filter, setFilter] = useState<ExploreKind | 'all'>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // CSS 의 넓은 화면 기준(64rem)과 같은 조건 — 넓으면 목록 칸이 스크롤되므로 자르지 않는다
  const wide = useMediaQuery('(min-width: 64rem)');
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  // 목록을 그 줄로 넘기는 것은 마커를 눌렀을 때만이다. 줄에 마우스를 올려 강조할 때도 넘기면 목록이 움직여
  // 커서 아래에 다른 줄이 오고, 그 줄이 또 강조돼 목록이 계속 흘러간다.
  const scrollToActive = useRef(false);

  const counts = useMemo(() => {
    const c: Record<ExploreKind, number> = { sight: 0, stay: 0, event: 0, amenity: 0 };
    items.forEach((i) => { c[i.kind] += 1; });
    return c;
  }, [items]);
  const visible = filter === 'all' ? items : items.filter((i) => i.kind === filter);
  const rows = wide || expanded ? visible : visible.slice(0, NARROW_ROWS);

  // 지도와 마커 — 항목이 바뀔 때만 다시 만든다. 강조·거르기는 아래 effect 가 기존 마커를 고친다.
  useEffect(() => {
    if (!showMap || !center) return;
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new maps.Map(mapDivRef.current, {
          center,
          zoom: MAX_ZOOM,
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
        new maps.Marker({ map, position: center, title: centerTitle, zIndex: 1000 });
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = new Map();
        items.forEach((item) => {
          if (item.latitude == null || item.longitude == null) return;
          const marker = new maps.Marker({
            map,
            position: { lat: item.latitude, lng: item.longitude },
            title: item.title,
            label: { text: String(item.number), color: token('--kh-hanji'), fontSize: '11px', fontWeight: '700' },
            icon: markerIcon(maps, item.kind, false),
            zIndex: 10,
          });
          marker.addListener('click', () => {
            scrollToActive.current = true;
            setActiveId(item.id);
          });
          markersRef.current.set(item.id, marker);
        });
        setMapFailed(false);
        fit(maps, map, center, items, 'all');
      })
      .catch(() => {
        if (!cancelled) setMapFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // 제목은 툴팁일 뿐이라 바뀌어도 지도를 다시 그리지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, center?.lat, center?.lng, items]);

  // 칩 — 마커를 숨기고 보이는 것에 범위를 맞춘다(다시 조회하지 않는다)
  useEffect(() => {
    const maps = (window as any).google?.maps;
    const map = mapRef.current;
    if (!maps || !map || !center) return;
    items.forEach((item) => {
      markersRef.current.get(item.id)?.setVisible(filter === 'all' || item.kind === filter);
    });
    fit(maps, map, center, items, filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // 강조 — 마커를 키우고, 마커를 눌렀으면 목록이 따로 스크롤되는 넓은 화면에서 그 줄을 보이게 한다
  useEffect(() => {
    const maps = (window as any).google?.maps;
    if (maps) {
      items.forEach((item) => {
        const marker = markersRef.current.get(item.id);
        if (!marker) return;
        const on = item.id === activeId;
        marker.setIcon(markerIcon(maps, item.kind, on));
        marker.setZIndex(on ? 999 : 10);
      });
    }
    if (!scrollToActive.current) return;
    scrollToActive.current = false;
    const list = listRef.current;
    if (!activeId || !list || list.scrollHeight <= list.clientHeight) return;
    const row = list.querySelector<HTMLElement>(`[data-explore-id="${CSS.escape(activeId)}"]`);
    if (row) list.scrollTo({ top: row.offsetTop - list.offsetTop - 8, behavior: 'smooth' });
  }, [activeId, items]);

  if (items.length === 0) return null;

  return (
    <section className="place-explore" aria-label={T.title} data-place-section="explore">
      <h2 className="place-detail-info-title">{T.title}</h2>
      <div className="place-explore-body">
        {showMap && center && !mapFailed ? (
          <div ref={mapDivRef} className="place-map place-explore-map" role="application" aria-label={`${centerTitle} ${T.mapAria}`} />
        ) : (
          <div className="place-map place-explore-map place-map-placeholder">{T.noMap}</div>
        )}
        <div className="place-explore-side">
          <div className="place-explore-filters" role="group" aria-label={T.title}>
            <button type="button" className="place-explore-filter" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
              {T.all} {items.length}
            </button>
            {KINDS.filter((k) => counts[k] > 0).map((k) => (
              <button
                type="button"
                key={k}
                className="place-explore-filter"
                data-kind={k}
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
              >
                <i aria-hidden className="place-explore-dot" data-kind={k} />
                {T.kind[k]} {counts[k]}
              </button>
            ))}
          </div>
          <ul ref={listRef} className="place-explore-list">
            {rows.map((item) => (
              <li
                key={item.id}
                data-explore-id={item.id}
                className="place-explore-row"
                data-active={item.id === activeId || undefined}
                onMouseEnter={() => setActiveId(item.id)}
                onFocus={() => setActiveId(item.id)}
              >
                <TrackedLink
                  className="place-explore-link"
                  to={attractionPath(lang, item.id)}
                  viewId={viewId}
                  item={trackedItem(item, screenRef)}
                >
                  <span className="place-explore-num" data-kind={item.kind} data-unmapped={item.latitude == null || undefined}>
                    {item.number}
                  </span>
                  {item.imageUrl ? (
                    <img className="place-explore-thumb" src={secureImageUrl(item.imageUrl)} alt="" loading="lazy" />
                  ) : (
                    <span className="place-explore-thumb place-card-img-empty" aria-hidden />
                  )}
                  <span className="place-explore-text">
                    <span className="place-explore-name">
                      {item.title}
                      {item.sameCategory && <span className="place-explore-tag">{T.same}</span>}
                    </span>
                    <span className="place-explore-sub">
                      {T.kind[item.kind]}
                      {item.category && item.kind !== 'sight' ? ` · ${placeCategoryLabel(item.category, lang)}` : ''}
                    </span>
                    {item.kind === 'event' && item.source && <EventLine attraction={item.source} lang={lang} />}
                  </span>
                  {item.distanceMeters != null && (
                    <span className="place-explore-dist">{distanceLabel(item.distanceMeters)}</span>
                  )}
                </TrackedLink>
              </li>
            ))}
          </ul>
          {rows.length < visible.length && (
            <button type="button" className="place-detail-more" onClick={() => setExpanded(true)}>
              {T.more(visible.length - rows.length)}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function trackedItem(item: ExploreItem, screenRef: string): TrackedItem {
  return {
    entityType: 'ATTRACTION',
    entityId: item.id,
    screenType: 'ATTRACTION_DETAIL',
    screenRef,
    sectionId: item.sectionId,
    sectionIndex: item.sectionIndex,
    itemIndex: item.itemIndex,
  };
}

/** 이 장소와 맞출 마커가 다 들어오게 한다. 「전체」는 가까운 몇 곳만 — 먼 행사·편의시설이 지도를 끌어내지 않게. */
function fit(maps: any, map: any, center: { lat: number; lng: number }, items: ExploreItem[], filter: ExploreKind | 'all') {
  const bounds = new maps.LatLngBounds();
  bounds.extend(center);
  const plotted = items.filter((item) => item.latitude != null && item.longitude != null);
  // items 는 거리순이다 — 「전체」는 앞의 몇 곳, 종류를 고르면 그 종류 전부
  const targets = filter === 'all' ? plotted.slice(0, ALL_FIT_NEAREST) : plotted.filter((item) => item.kind === filter);
  targets.forEach((item) => bounds.extend({ lat: item.latitude!, lng: item.longitude! }));
  const n = targets.length;
  if (n === 0) {
    map.setCenter(center);
    map.setZoom(MAX_ZOOM);
    return;
  }
  map.fitBounds(bounds, 48);
  maps.event.addListenerOnce(map, 'idle', () => {
    if (map.getZoom() > MAX_ZOOM) map.setZoom(MAX_ZOOM);
  });
}
