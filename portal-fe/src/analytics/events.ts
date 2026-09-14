/** 이벤트 모델 — 서버의 `EntityType`/`EventAction` 과 문자열이 같아야 한다 (ADR-0095). */

export type EntityType = 'ATTRACTION' | 'PRODUCT' | 'POST' | 'GAME' | 'PAGE' | 'SEARCH';
export type EventAction = 'IMPRESSION' | 'CLICK' | 'SEARCH';

/** 화면 종류 — 화면마다 고유한 상수. 새 화면을 붙이면 여기에 추가한다. */
export type ScreenType =
  | 'PLACE_HUB'
  | 'PLACE_REGION'
  | 'ATTRACTION_DETAIL';

/** 섹션 고유 id — 같은 화면 안에서 유일해야 한다. */
export type SectionId =
  | 'ATTRACTION_LIST'
  | 'NEARBY_ATTRACTIONS'
  | 'AMENITY_CAROUSEL';

export interface TrackedItem {
  entityType: EntityType;
  entityId: string;
  screenType: ScreenType;
  /** 그 화면의 주체. 상세면 그 관광지 id. */
  screenRef?: string;
  sectionId: SectionId;
  /** 화면 안 섹션 순서 — 배치가 바뀌어도 그때 값이 남아야 비교가 된다. */
  sectionIndex?: number;
  /** 섹션 안 순서. 캐로셀 내 위치를 포함한다. */
  itemIndex?: number;
}

export interface TrackedEvent extends TrackedItem {
  action: EventAction;
  viewId: string;
  occurredAt: number;
}
