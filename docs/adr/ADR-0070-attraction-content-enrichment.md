# ADR-0070 — 관광지 콘텐츠 보강: 외부 링크 수집 + 수집 파이프라인 주기화

- 상태: 제안 (2026-08-19)
- 관련: ADR-0065(K-관광 검색 — attractions SSOT/색인), ADR-0069(딜 허브 — 어필리에이트 고지·리다이렉터),
  ADR-0061(엣지 노출면), ADR-0031 §5.10(외부 HTTPS egress 화이트리스트), ADR-0025(latency budget),
  ADR-0019(배포 모드)

## 맥락

`place.1989v.com` 은 TourAPI 원천 필드(이름·주소·좌표·이미지·개요)만 보여준다. 관광지 한 곳을
실제로 고르려는 사람에게 **이 데이터만으로는 부족하다** — 어떻게 생겼는지 움직이는 화면으로 보고,
다녀온 사람의 글을 읽고, 예약할 수 있는 상품이 있는지 알고 싶어 한다.

동시에 수집 파이프라인이 **매일 사람 손을 탄다.** `overview_daily.sh` 를 로컬 맥에서 실행해야
개요가 채워지고, 남은 잔량은 ko 43,210 · en 12,687 — 관광 분류만 해도 약 17일치다.
사람이 매일 기억해서 돌려야 하는 절차는 결국 안 돌아간다.

### 제약을 먼저 확정한다 — 이게 설계를 정한다

**1. 쿼터가 전량 사전수집을 불가능하게 만든다.**

| 소스 | 공식 경로 | 일 한도 | ko 44,912건 전량 소요 |
|---|---|---|---|
| YouTube | Data API v3 `search.list` (100 units/콜, 일 10,000) | **100건** | 약 450일 |
| 네이버 | 검색 API (블로그) | 25,000콜 | 약 2일 |
| 인스타그램 · X | **없음** (Basic Display 폐기, X API 유료) | — | — |
| 투어 상품 | 어필리에이트 네트워크 (승인 필요) | — | — |

YouTube 만으로 450일이다. "전부 미리 채운다"는 선택지는 존재하지 않는다.

**2. 스크래핑은 선택지가 아니다.** 인스타/X 를 긁으면 ToS 위반에 차단·IP 밴 리스크를 지고,
그 유지비를 free-tier 단일 노드가 계속 낸다. 공개 API 가 없는 소스는 **수집하지 않는다.**

**3. 상시 파드 예산은 0 이다** (ADR-0069 와 동일 전제). OCI free tier 단일 노드.

**4. 클러스터 외부 egress 는 이미 열 수 있다.** `11-allow-egress-https-public.yaml` 이
auth·quant·quant-ingest·gifticon 를 화이트리스트하고 있고, 추가는 `matchExpressions.values` 한 줄이다.
"엣지 하드닝 때문에 클러스터에서 외부 API 를 못 부른다"는 2026-08-17 판단은 사실과 다르다 —
실제 비용은 egress 예외가 아니라 **파이썬 스크립트의 이미지 승격**이었다.

## 결정

### 1) 링크는 `Attraction` 이 아니라 별도 애그리게이트다

`attraction_link` 테이블을 새로 만든다. `Attraction` 에 컬럼으로 붙이지 않는 이유가 셋이다.

- **`syncFrom` 이 전체 동기화다.** TourAPI 목록 재동기화가 보내지 않은 필드를 null 로 덮는다.
  개요가 이미 이 함정에 빠져 300건을 잃고 예외 조항(`overview = source.overview ?: overview`)으로
  막았다. 보존 대상을 소스마다 늘리면 `syncFrom` 은 규칙이 아니라 **예외 목록**이 된다.
- **1:N 이다.** 관광지 하나에 영상 N개·글 N개. 컬럼으로 표현할 형태가 아니다.
- **수명주기가 다르다.** 원천 필드는 TourAPI 가 갱신하면 덮어쓰지만, 링크는 TTL 로 만료되고
  재수집된다. 갱신 주체가 다른 데이터를 한 행에 두면 둘 다 잘못 갱신된다.

```
attraction_link
  id, attraction_id(FK-as-ID), source, external_id, title, url,
  thumbnail_url, author, published_at, rank, collected_at, expires_at
  UNIQUE (attraction_id, source, external_id)
```

### 2) 딥링크는 행을 만들지 않는다 — 조립되는 값이다

인스타 태그·투어 상품 검색 링크는 **관광지명과 좌표로 그 자리에서 만들어지는 함수**다.
저장하면 59,570 × 소스 수만큼 같은 규칙의 복제본이 쌓이고, 템플릿을 바꿀 때마다 전량 재적재해야 한다.

수집형(YouTube·네이버)만 행이 생긴다. 딥링크는 템플릿 상수 하나에서 조립한다.

| source | 형태 | 행 생성 |
|---|---|---|
| `YOUTUBE` | Data API 수집 (영상 제목·썸네일·채널) | O |
| `NAVER_BLOG` | 검색 API 수집 (글 제목·블로그명) | O |
| `INSTAGRAM` | `explore/tags/{정규화명}` 딥링크 | X |
| `TOUR_PRODUCT` | 제휴사 검색 딥링크 | X |

### 3) 수집은 온디맨드 큐 + CronJob — 상세 조회가 외부 API 를 직접 부르지 않는다

```
GET /api/places/attractions/{id}/links
  → 캐시 유효           : 200 links[]
  → 없음/만료           : 200 links[] (딥링크만) + 큐에 요청 적재
place-ingest CronJob    → GET /internal/attractions/links/pending → 외부 API → POST 적재
```

**동기 수집을 하지 않는 이유**는 latency 와 노출면 둘 다다. 상세 경로에서 외부 API 를 동기로
부르면 P99 가 외부 지연에 묶이고(ADR-0025), `@Transactional` 안의 외부 IO 금지 규칙과도 충돌한다.

**place 파드에 외부 egress 를 열지 않는다.** ADR-0069 가 `code-dictionary:app` 대신 linkcheck
CronJob 파드에만 egress 를 연 것과 같은 이유 — 상시 파드에 열면 노출면이 상시로 늘어난다.
외부를 부르는 것은 `place-ingest` CronJob 하나뿐이다.

큐 조회·적재는 `/internal/attractions/links/**` 에 둔다. 게이트웨이는 ADR-0061 이후 `/api`·`/sse`·
`/ws`·`/actuator` 만 받으므로 이 경로는 **클러스터 밖에서 닿지 않는다.** recommendation 의
`/internal/sync`·`/internal/bandit` 과 같은 패턴이고, ADMIN 토큰을 발급해 도는 것보다 단순하다.

**첫 조회가 빈 화면이 되지 않는다** — 딥링크(인스타·투어 상품)는 항상 즉시 조립되므로,
수집형 카드만 뒤늦게 채워진다.

### 4) 쿼터는 우선순위 큐로 배분한다

YouTube 는 하루 100건이 예산의 전부다. 큐를 **조회 횟수 내림차순**으로 소진한다 — 실제로
사람이 보는 관광지부터 채워진다. 네이버는 25,000콜이라 사실상 큐가 밀리지 않는다.

일일 예산 소진은 실패가 아니라 정상이다. 소진 시 남은 큐는 다음 실행으로 넘긴다.

### 5) 어필리에이트 고지는 ADR-0069 규칙을 그대로 쓴다 — place 판을 만들지 않는다

공정위 추천·보증 심사지침상 경제적 이해관계 공개 규칙은 **플랫폼에 하나만 있어야 한다.**
place 가 자기 버전을 만들면 두 화면의 고지가 갈라지고, 그 순간 어느 쪽이 기준인지 사라진다.

- 제휴 승인 전 = `PLAIN` — `rel="nofollow noopener"`, 배지 없음
- 제휴 승인 후 = `AFFILIATE` — `rel="sponsored nofollow noopener"` + 배지 + 고지

**`/go/{slug}` 리다이렉터는 쓰지 않는다.** 딜 허브의 슬러그 모델은 사람이 큐레이션한 오퍼
수십 개를 전제하고, 관광지 딥링크 수만 건에 슬러그를 발급하면 그 모델이 무너진다.
클릭 계측은 P1 범위 밖이다(ADR-0069 도 전환은 못 센다고 이미 인정했다).

### 6) 마이리얼트립은 딥링크만 — 수집하지 않는다

`https://www.myrealtrip.com/search?q={관광지명}` 이 200 으로 동작한다(2026-08-19 실측).
링크는 붙이되 **상품 데이터는 긁지 않는다.**

공개 어필리에이트 프로그램·오픈 API 가 확인되지 않아 수집하려면 스크래핑이고, 그건 결정 2번의
"공개 API 가 없으면 수집하지 않는다"에 걸린다. 더해 이 레포는 공개 포트폴리오이므로 상품
데이터 복제는 약관·이해충돌 양쪽에서 값을 치른다. **제휴 프로그램 확인은 코드 밖 선행 조건**이고,
확인되면 그때 `PLAIN` → `AFFILIATE` 로 승격한다.

### 7) 링크는 `attractions` 인덱스에 색인하지 않는다

링크는 검색 조건이 아니라 상세 표시물이다. 색인하면 링크 하나 갱신마다 재색인이 필요해지는데,
`attractions` 는 alias swap 풀재색인 모델이라 부분 갱신 경로가 없다.

상세 조회는 이미 `id` 로 갈린다 — `AttractionApiReindexTasklet` 이 `id = attraction.id.toString()`
으로 색인하므로 search 의 문서 id 와 place 의 PK 가 같은 값이다. FE 가 같은 id 로 place 를
한 번 더 부르면 된다. **링크 수집이 재색인을 유발하지 않는 것이 이 분리의 핵심 이득이다.**

### 8) `place-ingest` 이미지로 승격 — TourAPI 개요 수집을 주기화한다

2026-08-17 "자동 스케줄을 걸지 않는다" 결정을 **뒤집는다.** 그 결정의 근거였던 "클러스터가 외부
API 를 못 부른다"가 사실이 아니었기 때문이다(맥락 4번).

`tools/seed/tour/*.py` → `place/ingest/` (`quant/ingest` 구조 복제: Dockerfile + pyproject + src).
이미지 하나에 `--job=` 인자로 분기한다 — 잡마다 이미지를 만들지 않는다.

| CronJob | 주기 | 하는 일 |
|---|---|---|
| `place-ingest-overview` | 매일 KST 04:00 | TourAPI 개요 ko/en 각 1,000건 → place bulk |
| `place-ingest-links` | 10분 | 링크 큐 소진 (YouTube 일일 예산 카운터 포함) |
| `attraction-reindex` | 매일 KST 04:30 (`suspend: false`) | 풀 재색인 — 개요 잡 직후 |

인프라 변경은 **egress NP 한 줄 + Secret 하나 + CronJob 3개**가 전부다. 신규 상시 파드 0.

## 결과

- (+) 매일 사람이 기억해서 돌리던 절차가 사라진다. 개요는 자동으로 채워진다.
- (+) 쿼터를 수요에 맞춰 쓴다 — 450일치 사전수집 대신, 실제로 조회되는 관광지부터 채워진다.
- (+) 링크와 원천 데이터의 갱신 경로가 분리돼 `syncFrom` 함정이 재발하지 않는다.
- (+) 외부를 부르는 파드가 CronJob 하나로 고정된다. 상시 노출면은 그대로다.
- (−) 첫 방문자는 수집형 카드를 즉시 못 본다(최대 10분). 딥링크로 화면이 비지는 않지만
  "누가 처음 보느냐"에 따라 화면이 달라진다.
- (−) 인스타/X 는 링크만 있고 데이터가 없다. 공식 경로가 생기기 전까지 이 상태다.
- (−) 조회 횟수 카운터가 place 에 새로 생긴다 — 쓰기 트래픽이 상세 조회마다 발생한다.
  P1 은 비동기 증분(실패 무시)으로 두고, 부하가 측정되면 그때 배치화한다.
- (−) YouTube 매칭이 정확하지 않을 수 있다("경복궁" 검색에 무관한 영상). 제목·설명 필터로
  1차 방어하되, 오탐률은 운영에서 재야 안다.
- 선행 조건(코드 밖): YouTube Data API 키, 네이버 검색 API Client ID/Secret,
  `VITE_GOOGLE_MAPS_KEY`(마커가 이미 구현돼 있으나 키가 없어 안 보인다),
  마이리얼트립 제휴 프로그램 유무 확인.

## 참조

- spec: `docs/specs/2026-08-19-attraction-content-enrichment/`
- 이어받기 문서: `docs/plans/2026-08-19-k-tour-search-handoff.md`
- YouTube Data API v3 쿼터: `search.list` = 100 units / 일 10,000 units
- 네이버 개발자센터 검색 API: 일 25,000회
- 공정거래위원회 「추천·보증 등에 관한 표시·광고 심사지침」
