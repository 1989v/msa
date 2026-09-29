# 요구사항 — place 관광지 서버 렌더 + 인리치먼트·패싯

## 목표

1. 관광지 상세 **55,524개 전부**가 크롤러의 첫 응답에 본문을 가진다 (지금은 6,000개만).
2. TourAPI 원문에서 속성을 뽑아 **검색 필터(패싯)** 와 상세의 자체 정보로 쓴다.
3. 원문을 옮긴 것 이상의 가치 — 지역 안 위치(B), 비슷한 곳(C), 이용 기반 인기(D) — 를 페이지에 더한다.

AdSense 재신청(2026-08-31 「가치가 별로 없는 콘텐츠」 반려)의 전제 조건이다.

## 범위

### R1 서버 렌더 (축1)
- place 호스트의 `/attractions/{id}` · `/en/attractions/{id}` 를 **search:app** 이 HTML 로 응답한다.
  데이터 주인이 search(문서 하나, `AttractionSearchAdapter.findById`)이므로 서비스 간 호출이 없다.
- 계약은 블로그(ADR-0072 §6)와 프리렌더(`prerender-seo.mjs` `renderAttractionDetail`)와 같다:
  셸의 `<!--seo:start-->…<!--seo:end-->` 를 메타로 교체, `<div id="root"></div>` 에 크롤러용 본문,
  JSON-LD 는 `data-seo-multi`. 셸은 5분 캐시 · 실패 시 마지막 정상본 · 셸이 없으면 최소 HTML.
- 없는 id·비활성 문서는 404 HTML. 관광지당 ES 조회는 한 번.
- 본문에 A~D 결과를 싣는다(속성 · 지역 집계 · 같은 분류 가까운 곳 · 비슷한 곳).
- 관광지 상세 프리렌더는 서버 렌더로 대체되면 제거한다(이미지 약 54MB 감소). 지역(`/regions`) 프리렌더는 유지.

### R2 속성 추출·정규화 (A) — 사용자 선택: 네 묶음 전부
| 속성 | 원천 | 원문 보유(표본) | 값 |
|---|---|---|---|
| 운영·휴무 | restDate · useTime · introRaw | 82% | 연중무휴 여부, 휴무 요일 집합, (단순한 경우만) 운영 시각 |
| 주차 | parking · introRaw | 82% | 가능 / 불가 / 정보 없음 |
| 반려동물 | petAcmpyType · introRaw chkpet* | 22% | 가능 / 일부 / 불가 / 정보 없음 |
| 신용카드 | introRaw chkcreditcard* | 43% | 가능 / 불가 / 정보 없음 |
| 유모차 | introRaw chkbabycarriage* | 12% | 가능 / 불가 / 정보 없음 |
| 입장 무료 | useFee · introRaw usefee* | 4.7% | 무료 / 유료 / 정보 없음 |

- **정보 없음은 거짓이 아니다.** 원문이 없거나 해석이 안 되면 `UNKNOWN` 이고 필터에서 빠진다.
- 원천은 그대로 두고 파생값만 더한다(data-sources §0). 파생은 **색인 시점**에 search 쪽 순수 함수가 계산한다.
  모든 소비자(상세 · 검색 · 서버 렌더)가 search 문서를 읽기 때문에 place 스키마를 바꾸지 않는다.
- 상세: 배지 + 방문 정보 FAQ + schema.org(`openingHoursSpecification` 은 해석된 경우만, `isAccessibleForFree`).

### R3 패싯 검색
- 검색 API 에 속성 필터 파라미터와 **패싯 카운트**(속성 값별 건수)를 더한다. 다중 선택에서 자기 패싯의 건수가
  줄지 않게 한다(post_filter 방식).
- place 검색 화면에 필터 칩 + 건수. 기존 분류·지역 필터와 함께 동작.

### R4 지역 안 위치 (B)
- 색인 시점에 전량을 훑으며 계산해 문서에 저장: 시군구 전체 수 · 같은 분류(lclsSystm3) 수 ·
  같은 시군구·같은 분류의 가까운 곳 상위 5곳과 거리.
- 기존 「주변 관광지」(반경 5km 거리순) 섹션은 그대로 둔다.
- 상세 ↔ 지역 허브 상호 링크.

### R5 비슷한 곳 (C)
- 임베딩(100% 보유, `tools/embed` 가 오프라인 계산)으로 **다른 시도**의 유사 관광지 상위 5곳.
  계산은 임베딩을 만드는 오프라인 도구에서 하고 place 에 적재 → 재색인이 조회해 문서에 싣는다
  (임베딩과 같은 경로). 요청 경로 추가 호출 없음.

### R6 인기도 (D) — 사용자 선택: 순위에도 섞음
- analytics 의 `attraction_popularity_daily`(ADR-0095) 최근 14일 조회·클릭을 색인 시 문서에 싣는다.
  search 는 analytics 가 여는 내부 API 로 받는다(서비스 간 API 호출만).
- 순위: 관련도 점수에 방문 신호를 곱하되 **가중치 상한**과 **최소 표본** 미만일 때 중립(1.0).
  기존 `popularityScore`(정보 충실도)는 이름·의미 그대로 둔다.
- 섞기 전후를 기존 nDCG 평가로 재서 떨어지지 않음을 확인한다.
- 상세에 「많이 본 곳」 표시는 최소 표본 이상일 때만.

## 유지 (사용자: 「이미 있는 건 두고」)
주변 관광지 섹션 · 편의시설 섹션 · 링크 섹션 · 인기 집계 원장/배치 · 임베딩·하이브리드 검색 · popularityScore.

## 범위 밖
- Cloudflare HTML 캐시 규칙(대시보드 작업) · AdSense 재신청 자체 · 영업시간의 완전한 해석(복잡한 표기는 원문 표시)
- 관광지 외 문서 타입의 서버 렌더

## 제약
- OCI 무료 단일 노드(4 OCPU/24GB). OpenSearch 힙 한도 · 페이지 캐시(색인 272MB, 벡터 153MB) — 필드 추가는 `index:false` 우선, 집계 필드만 keyword.
- 새 문서 필드는 매핑 · 쓰기 클래스 · 읽기 클래스 셋 다(계약 게이트). 빠지면 조용히 빈 값.
- 새 인덱스 생성 경로는 샤드·레플리카 선언(`verifyIndexShardDeclaration`).
- 구조 변경(라우팅·서비스 간 API·렌더 위치) → ADR.

## 재사용
`blog/feature/.../render/{ShellHtmlProvider,BlogMetaRenderer}.kt` 패턴 · `prerender-seo.mjs` `renderAttractionDetail`·`visitorInfoHtml` · `copy.mjs` `attractionMeta`·`touristAttractionJsonLd` ·
`AttractionApiReindexTasklet` 의 조회 합류(sidoNames·links·embeddings) · 임베딩 적재 경로(`/internal/attractions/embeddings/bulk`) · `AttractionSearchAdapter.findById`·`buildRequest`.

## 실패 의미 · 관측
- 서버 렌더: 셸 실패 → 마지막 정상본(헬스 표시기로 상태 노출), ES 실패 → 5xx 대신 셸만 반환(SPA 가 그림). 로그에 id·소요시간.
- 재색인 합류(C·D): 조회 실패는 그 필드만 비우고 색인은 진행(기존 links 합류와 같은 규칙) + 경고 로그 건수.
- 파서: 해석 실패는 UNKNOWN + 파서 버전 필드 → 재색인만으로 재계산.
