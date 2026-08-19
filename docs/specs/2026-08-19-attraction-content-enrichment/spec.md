# 관광지 콘텐츠 보강 — 스펙

- 결정: `docs/adr/ADR-0070-attraction-content-enrichment.md`
- 선행 상태: `docs/plans/2026-08-19-k-tour-search-handoff.md`
- 작성: 2026-08-19

## 1. 무엇을 만드는가

관광지 상세에 **유튜브 영상 · 네이버 블로그 글 · 인스타 태그 · 투어 상품** 링크를 붙이고,
지금 매일 손으로 돌리는 TourAPI 개요 수집을 **CronJob 으로 주기화**한다.

지도 마커는 **이미 구현돼 있다** (`portal-fe/src/pages/place/PlacePage.tsx:177-197`).
`VITE_GOOGLE_MAPS_KEY` 만 주입되면 동작하므로 신규 구현이 아니라 **품질 개선** 범위다.

## 2. 데이터 모델

### `attraction_link` (place 서비스, 신규)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | BIGINT PK | |
| `attraction_id` | BIGINT | FK-as-ID (jpa-persistence §1) |
| `source` | VARCHAR(20) | `YOUTUBE` \| `NAVER_BLOG` — enum STRING |
| `external_id` | VARCHAR(100) | videoId / 블로그 postId |
| `title` | VARCHAR(300) | |
| `url` | VARCHAR(500) | |
| `thumbnail_url` | VARCHAR(500) | nullable |
| `author` | VARCHAR(100) | 채널명 / 블로그명, nullable |
| `published_at` | DATETIME | nullable |
| `rank` | INT | 소스 내 표시 순서 (0부터) |
| `collected_at` | DATETIME | |
| `expires_at` | DATETIME | 재수집 기준선 |

- `UNIQUE (attraction_id, source, external_id)` — 재수집 멱등성
- `INDEX (attraction_id, source, rank)` — 조회 경로
- 도메인: `place/domain/.../attraction/model/AttractionLink.kt` (프레임워크 의존 없음)
- **`Attraction` 은 변경하지 않는다.** `syncFrom` 에 손대지 않는 것이 이 분리의 목적이다.

### `attraction_link_request` (수집 큐, 신규)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | BIGINT PK | |
| `attraction_id` | BIGINT | `UNIQUE (attraction_id, source)` |
| `source` | VARCHAR(20) | |
| `view_count` | INT | 우선순위 — 조회될 때마다 +1 |
| `requested_at` | DATETIME | |
| `last_attempt_at` | DATETIME | nullable |
| `attempt_count` | INT | 3회 실패 시 큐에서 제외 |

조회 횟수를 별도 테이블로 두지 않고 큐 행에 얹는다 — 우선순위를 정하는 것 말고 이 값의
용도가 지금 없다. (YAGNI: 조회 통계가 요구되면 그때 analytics 로 보낸다.)

## 3. API

### 공개 (gateway `GET /api/places/**` — 비로그인)

```
GET /api/places/attractions/{id}/links
200 { "deepLinks": [ { "provider":"INSTAGRAM",  "kind":"SOCIAL",       "url":..., "revenueType":"PLAIN" },
                     { "provider":"MYREALTRIP", "kind":"TOUR_PRODUCT", "url":..., "revenueType":"PLAIN" },
                     { "provider":"KLOOK",      "kind":"TOUR_PRODUCT", "url":..., "revenueType":"PLAIN" } ] }
```

T3 에서 `collected`(수집형 카드)와 `pending`(수집 중) 이 이 응답에 더해진다. **지금 넣지 않는다** —
소비자가 없는 필드를 미리 만들면 항상 빈 배열과 항상 false 를 유지해야 한다.

`label` 이 아니라 `provider` 를 돌려주는 이유: 문구는 화면의 몫이다. 백엔드가 한국어 라벨을 들면
영문 화면이 그걸 다시 뒤집어야 한다.

**T3 이후**

- `collected` 가 비었거나 만료면 큐에 적재하고 `pending: true` 로 답한다 (**동기 수집 없음**).
- `deepLinks` 는 항상 즉시 조립된다 — 응답이 빈 적이 없다.
- 큐 적재는 조회 응답을 막지 않는다 — 실패는 warn 만 남긴다 (ADR-0069 §3 과 같은 정신).

### 내부 (gateway 미라우팅 — 클러스터 내부 전용)

```
GET  /internal/attractions/links/pending?source=YOUTUBE&limit=100
     → [ { "attractionId":..., "title":"경복궁", "lang":"ko", "latitude":..., "longitude":... } ]
     view_count DESC, requested_at ASC

POST /internal/attractions/links/bulk
     { "links": [ { "attractionId":..., "source":..., "externalId":..., ... } ], "emptyFor": [ {attractionId, source} ] }
```

- `emptyFor` = 원천이 결과를 0건으로 준 (관광지, 소스) — 큐에서 제거하고 만료 시각만 기록한다.
  이게 없으면 결과 없는 관광지가 매 실행마다 큐 앞자리를 차지한다. TourAPI 개요의
  negative cache 와 같은 문제다 — 개요 쪽은 `attraction_overview_probes` 로 이미 옮겼다(T1).
- **429·네트워크 실패는 `emptyFor` 가 아니다.** `attempt_count` 만 올린다 — 넣으면 그 레코드가
  영영 재시도되지 않는다 (핸드오프 §3.3 과 동일한 함정).

## 4. 수집 커넥터 (`place/ingest`)

| 소스 | 엔드포인트 | 파라미터 | 상한 | TTL |
|---|---|---|---|---|
| YouTube | `youtube/v3/search` | `q={title} {지역명}`, `type=video`, `maxResults=5`, `regionCode=KR`, `relevanceLanguage={lang}`, `safeSearch=strict` | **일 100 관광지** (10,000 units ÷ 100) | 90일 |
| 네이버 | `/v1/search/blog.json` | `query={title}`, `display=5`, `sort=sim` | 일 25,000콜 | 30일 |

- **매칭 필터**: 영상/글 제목에 관광지명(공백 제거·정규화)이 포함되지 않으면 버린다.
  "경복궁" 질의에 무관한 콘텐츠가 섞이는 것에 대한 1차 방어이고, 오탐률은 운영에서 잰다.
- `lang=en` 레코드는 영문 타이틀로 질의하고 `relevanceLanguage=en`.
- 일일 예산은 **소진이 정상**이다. 남은 큐는 다음 실행으로 넘어간다.
- 예산 카운터는 프로세스 안에 두지 않는다(파드가 매번 새로 뜬다) — 당일 `collected_at`
  기준 카운트로 place 에서 계산해 `pending` 응답의 `limit` 을 정한다.

## 5. 딥링크 템플릿

한 곳에서만 조립한다 (`place/domain/.../attraction/model/AttractionDeepLink.kt`).

| source | 템플릿 | 검증 |
|---|---|---|
| `INSTAGRAM` | `https://www.instagram.com/explore/tags/{정규화명}/` | 정규화 = 공백·특수문자 제거 |
| `TOUR_PRODUCT` (MRT) | `https://www.myrealtrip.com/search?q={관광지명}` | 200 확인 (2026-08-19) |
| `TOUR_PRODUCT` (Klook) | `https://www.klook.com/search/?query={관광지명}` | 제휴 승인 시 트래킹 파라미터 부착 |

- 전부 `revenueType: PLAIN` 으로 시작 — 제휴 승인 전에는 수수료가 없으므로 `sponsored` 를 붙이지 않는다.
- 승인되면 해당 소스만 `AFFILIATE` 로 승격 (ADR-0069 §1 규칙 그대로).
- **URL 을 재조립하지 않는다** — 파라미터 주입·클로킹은 네트워크 약관 위반 (ADR-0069 §3).

## 6. FE

### 상세 — `PlacePage` 사이드 패널 + `AttractionPage`

`selected.overview` 아래에 "관련 콘텐츠" 섹션. 두 화면이 같은 컴포넌트를 쓴다.

- 유튜브: 썸네일 카드 (제목·채널·게시일). 인라인 재생 없음 — iframe 은 CSP·성능 양쪽에 비용.
- 블로그: 텍스트 링크 (제목·블로그명)
- 딥링크: 버튼 행 (인스타 / 투어 상품)
- `pending: true` 면 수집형 자리에 "곧 채워집니다" 스켈레톤 — 오류가 아니다
- 모든 외부 링크 `target="_blank" rel="nofollow noopener"`, `AFFILIATE` 는 `sponsored` 추가 + 배지
- 색상·간격은 `DESIGN.md` 토큰. 브랜드 면이므로 `docs/design/k-heritage.html` 을 먼저 연다.

### 지도 (기존 개선)

- `VITE_GOOGLE_MAPS_KEY` 주입 (사용자 작업) — 이것만으로 마커가 보인다
- `Marker` → `AdvancedMarkerElement` (전자는 deprecated)
- 선택된 마커 강조 + 카드 hover ↔ 마커 연동
- **클러스터링은 하지 않는다** — 결과가 페이지당 30건이라 겹치지 않는다 (YAGNI)

## 7. 인프라

```
place/ingest/                      # quant/ingest 구조 복제
  Dockerfile, pyproject.toml, src/{tour,youtube,naver}.py
k8s/base/place-ingest/
  cronjob-overview.yaml            # 매일 KST 04:00
  cronjob-links.yaml               # 10분
k8s/base/network-policy/11-allow-egress-https-public.yaml
  values 에 place-ingest 추가       # 한 줄
k8s/base/search-batch/cronjob-attraction-reindex.yaml
  suspend: false, schedule 매일 KST 04:30
.github/workflows/images.yml
  ALL_DOCKER + 경로매핑 + DOCKER_CTX 에 place-ingest 추가
```

Secret `place-ingest-secrets`: `tour-api-key`, `youtube-api-key`, `naver-client-id`, `naver-client-secret`.
운영은 SealedSecret (`k8s/infra/prod/sealed-secrets/README.md`).

## 8. 하지 않는 것

- 인스타그램·X **수집** — 공식 경로 없음. 딥링크만.
- 마이리얼트립 **상품 데이터 수집** — 스크래핑이 되므로 링크만 (ADR-0070 §6).
- 링크의 OpenSearch 색인 — 상세 표시물이지 검색 조건이 아니다 (ADR-0070 §7).
- `/go/{slug}` 리다이렉터 — 딜 허브의 큐레이션 모델과 규모가 다르다.
- 클릭·전환 계측 — P1 범위 밖.
- 검색 랭킹 개선(분류 가중치·유사어) — 핸드오프 §5 의 별도 트랙. 이 스펙과 독립이다.

## 9. 미결 (OQ)

| ID | 질문 | 막는 것 | 해소 방법 |
|---|---|---|---|
| OQ-1 | YouTube 제목 필터의 오탐/미탐률 | 매칭 규칙 확정 | 관광지 50건 표본 수동 채점 |
| OQ-2 | 마이리얼트립 제휴 프로그램 존재 여부 | `PLAIN` → `AFFILIATE` 승격 | 사용자 확인 (코드 밖) |
| OQ-3 | 10분 CronJob 이 free-tier 에서 실제로 무는 비용 | 주기 확정 | 1주 운영 후 노드 CPU 측정 |
| OQ-4 | `view_count` 증분의 쓰기 부하 | 배치화 여부 | 상세 조회 QPS 측정 후 판단 |

## 10. 검증

- 도메인: `AttractionLink` 생성/만료 판정, 딥링크 정규화 — Kotest BehaviorSpec (Spring context 없음)
- 애플리케이션: 캐시 유효/만료/부재 3분기, 큐 적재 실패가 조회를 막지 않음 — MockK
- **회귀 케이스**: `Attraction.syncFrom` 이 링크에 손대지 않는다 (테이블이 다르므로 구조적으로
  보장되지만, 다음 사람이 되돌리지 않도록 테스트로 못 박는다)
- 수집: `emptyFor` 와 429 가 서로 다르게 처리되는지 — 이걸 틀리면 며칠치가 날아간다
- FE: `pending` 상태 렌더, 링크 `rel` 속성, 다크/라이트 대비 — CDP 실측 (`docs/standards/fe-visual-verification.md`)
