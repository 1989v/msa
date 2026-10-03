import type { NearbyPlace } from '../../api/placeApi';
import { isPlottable, titleParts } from './placeView';

export type ExploreKind = 'sight' | 'stay' | 'event' | 'amenity';

type SectionId = 'NEARBY_ATTRACTIONS' | 'SAME_CATEGORY_NEARBY' | 'NEARBY_STAYS' | 'NEARBY_EVENTS' | 'AMENITY_CAROUSEL';

export interface ExploreItem {
  id: string;
  title: string;
  kind: ExploreKind;
  /** 같은 분류 가까운 곳에 든 항목 — 줄에 표시만 붙인다 */
  sameCategory: boolean;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
  imageUrl: string | null;
  /** 줄의 둘째 줄 — 분류 이름 */
  category: string | null;
  /** 행사 줄의 기간·상태를 그리는 원본 문서. 같은 분류에서만 온 항목은 없다 */
  source: NearbyPlace | null;
  /** 노출 기록 — 출처 목록의 섹션 그대로 남긴다(이미 쌓인 원장과 이어지게) */
  sectionId: SectionId;
  sectionIndex: number;
  itemIndex: number;
  /** 목록·지도에 같이 붙는 번호(1부터). 거리순 */
  number: number;
}

export interface ExploreSources {
  selfId: string;
  sights: NearbyPlace[];
  sameCategory: Array<{ id: string; title: string; distanceMeters: number }>;
  /** 같은 분류만 있고 아래 목록에 없는 항목의 종류 — 행사 상세의 같은 분류는 행사, 숙박 상세는 숙소다 */
  sameCategoryKind: ExploreKind;
  stays: NearbyPlace[];
  events: NearbyPlace[];
  amenities: NearbyPlace[];
  /** 섹션 번호 — 화면 배치가 아니라 섹션 식별 번호라 바뀌지 않는다 */
  index: Record<SectionId, number>;
}

/** 명소는 8곳 — 지도 한 장에서 번호를 읽을 수 있는 수 */
const EXPLORE_SIGHTS_SHOWN = 8;

/**
 * 주변 목록 다섯(명소 · 같은 분류 · 숙소 · 행사 · 편의시설)을 한 줄로 합친다.
 * 같은 id 는 한 번만 — 앞의 목록이 이긴다. 같은 분류에 든 곳은 표시를 붙이고, 아래 목록에
 * 없으면 좌표 없이(지도에 못 찍는다) 붙인다. 번호는 거리순이고 거리 모르는 곳이 뒤다.
 */
export function exploreItems(src: ExploreSources): ExploreItem[] {
  const same = new Set(src.sameCategory.map((n) => n.id));
  const seen = new Set<string>([src.selfId]);
  const out: Omit<ExploreItem, 'number'>[] = [];
  const add = (a: NearbyPlace, kind: ExploreKind, sectionId: SectionId, itemIndex: number) => {
    if (seen.has(a.id)) return;
    seen.add(a.id);
    const isSame = same.has(a.id);
    const plottable = isPlottable(a.latitude, a.longitude);
    out.push({
      id: a.id,
      title: titleParts(a).primary,
      kind,
      sameCategory: isSame,
      latitude: plottable ? a.latitude : null,
      longitude: plottable ? a.longitude : null,
      distanceMeters: a.distanceKm != null ? Math.round(a.distanceKm * 1000) : null,
      imageUrl: a.imageUrl ?? null,
      category: a.category ?? null,
      source: a,
      sectionId: isSame ? 'SAME_CATEGORY_NEARBY' : sectionId,
      sectionIndex: isSame ? src.index.SAME_CATEGORY_NEARBY : src.index[sectionId],
      itemIndex,
    });
  };
  src.sights.filter((a) => !seen.has(a.id)).slice(0, EXPLORE_SIGHTS_SHOWN)
    .forEach((a, i) => add(a, 'sight', 'NEARBY_ATTRACTIONS', i));
  src.stays.forEach((a, i) => add(a, 'stay', 'NEARBY_STAYS', i));
  src.events.forEach((a, i) => add(a, 'event', 'NEARBY_EVENTS', i));
  src.amenities.forEach((a, i) => add(a, 'amenity', 'AMENITY_CAROUSEL', i));
  src.sameCategory.forEach((n, i) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    out.push({
      id: n.id,
      title: n.title,
      kind: src.sameCategoryKind,
      sameCategory: true,
      latitude: null,
      longitude: null,
      distanceMeters: n.distanceMeters,
      imageUrl: null,
      category: null,
      source: null,
      sectionId: 'SAME_CATEGORY_NEARBY',
      sectionIndex: src.index.SAME_CATEGORY_NEARBY,
      itemIndex: i,
    });
  });
  return out
    .map((item, order) => ({ item, order }))
    .sort((x, y) => {
      const dx = x.item.distanceMeters ?? Number.POSITIVE_INFINITY;
      const dy = y.item.distanceMeters ?? Number.POSITIVE_INFINITY;
      return dx - dy || x.order - y.order;
    })
    .map(({ item }, i) => ({ ...item, number: i + 1 }));
}
