/**
 * 골든 생성기 공용 — 색인 문서(`_source`) → 검색 API 응답 모양(`SearchAttractionService` 의 결과 이름).
 *
 * 골든 입력은 색인 문서 그대로이고 Kotlin 은 그것을 `AttractionSearchDocument` 로 역직렬화해 앱의 읽기 경로를 탄다.
 * 화면은 API 응답을 받으므로 이름·모양이 다른 필드만 여기서 바꾼다 — 하나를 빠뜨리면 화면 쪽 출력에서
 * 그 값이 사라져 Kotlin 비교가 빨개진다. 이름이 같은 필드는 그대로 지나간다.
 */
export type IndexDoc = Record<string, unknown> & { lang: string; location: { lat: number; lon: number } };

/** 방문 속성은 `closureState` 가 있을 때만 한 벌로 실린다(`AttractionSearchDocument.attributes()`). */
const ATTRIBUTE_FIELDS = ['closedWeekdays', 'attrParking', 'attrCreditCard', 'attrStrollerRental', 'petPolicy', 'attrAdmission'];

export function toApi({
  location,
  ldongRegnCd,
  ldongSignguCd,
  eventStartEffective,
  eventEndEffective,
  sigunguName,
  regionTypeCount,
  regionCategoryCount,
  lclsSystm3Name,
  sameCategoryNearby,
  ...rest
}: IndexDoc) {
  const api: Record<string, unknown> = {
    ...rest,
    latitude: location.lat,
    longitude: location.lon,
    sidoCode: ldongRegnCd ?? null,
    eventStart: eventStartEffective ?? null,
    eventEnd: eventEndEffective ?? null,
    // 지역 안 위치는 집계 건수가 있을 때만 온다 — 시군구 이름·코드도 이 안에 실린다
    region:
      regionTypeCount == null
        ? null
        : {
            ldongSignguCd: ldongSignguCd ?? null,
            sigunguName: sigunguName ?? null,
            typeCount: regionTypeCount,
            categoryCount: regionCategoryCount ?? null,
            categoryName: lclsSystm3Name ?? null,
            sameCategoryNearby: sameCategoryNearby ?? [],
          },
  };
  if (rest.closureState == null) for (const field of ATTRIBUTE_FIELDS) api[field] = null;
  return api as IndexDoc & Record<string, any>;
}
