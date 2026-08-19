# K-관광 검색 — 이어받기 문서 (2026-08-19)

> 다른 세션이 이 문서만 읽고 이어받을 수 있게 쓴다. 수치는 모두 **2026-08-19 실측**이다.
> 스펙 원본은 `docs/specs/2026-08-11-k-tour-search/spec.md`, 결정은 `ADR-0065`.
> **후속**: 콘텐츠 보강 + 수집 주기화는 `ADR-0070` / `docs/specs/2026-08-19-attraction-content-enrichment/`.

**한 줄**: P1 은 운영 중이고 데이터도 전량 적재됐다. 지금 남은 일은 **개요 수집(매일 수동)** 과
**검색 품질 강화(P2)** 두 갈래다. 아래 "지켜야 할 것"을 어기면 며칠치 수집이 날아간다.

---

## 1. 지금 어떤 상태인가

`place.1989v.com` 에서 국문·영문 관광지 검색 + 근처검색이 동작한다.

| 언어 | 레코드 | 개요 보유 | 이미지 보유 |
|---|---|---|---|
| ko | 44,912 | 1,702 | 39,304 |
| en | 14,658 | 1,971 | 13,335 |
| **합계** | **59,570** | 3,673 | 52,639 |

분류 분포 — **음식·쇼핑이 62%** 다. 이게 뒤에 나오는 품질 문제의 뿌리다.

| shopping | food | culture | nature | leisure | history | stay |
|---|---|---|---|---|---|---|
| 23,310 | 13,807 | 7,014 | 6,282 | 4,286 | 4,256 | 615 |

필드 결측은 사실상 없다 (지역코드 1건, 주소 30건 / 59,570).

### 구성

```
TourAPI 4.0 ──(로컬 ETL)──> place MySQL(SSOT) ──(batch 재색인)──> OpenSearch attractions ──> portal-fe
   KorService2 / EngService2      attractions 테이블        alias swap            place.1989v.com
```

- **place = SSOT**, OpenSearch 는 읽기 모델. 색인은 `attraction-reindex` CronJob 이 **일괄 재색인**한다(Kafka 미경유).
- 적재는 게이트웨이가 쓰기를 막으므로(401) OCI 호스트에서 파드로 port-forward 해 넣는다.

---

## 2. 매일 해야 하는 것 — 개요 수집

목록은 100건/콜이라 하루면 끝났지만, **개요(overview)는 `detailCommon2` 로 건당 1콜**이라 며칠이 걸린다.

**2026-08-20 부터 CronJob 이 대신 돈다** — `place-ingest-overview` 가 매일 KST 04:00 에
ko 1,000 + en 1,000 을 채우고, `attraction-reindex` 가 04:30 에 재색인한다. 손댈 일은 없다.

```bash
# 수동 트리거 / 잔량 확인
kubectl -n commerce create job --from=cronjob/place-ingest-overview place-ingest-overview-manual
kubectl -n commerce logs -f job/place-ingest-overview-manual
```

**일일 한도는 (서비스 × 오퍼레이션)별로 따로다** — KorService2 가 429 여도 EngService2 는 살아 있고,
`areaBasedList2` 도 별도 한도라 목록 재수집은 영향받지 않는다 (실측 확인).

잔량(2026-08-19): ko 43,210 · en 12,687. 관광 분류만 치면 ko 16,861 · en 1,304.
ko/en 을 병행해도 **국문이 병목**이다 — 관광 분류만 약 **17일**, 전량 약 **43일**.

> [!] **2026-08-17 "자동 스케줄을 걸지 않는다" 는 2026-08-19 뒤집혔다 (ADR-0070).**
> 그 결정의 근거는 "클러스터가 엣지 하드닝으로 외부 API 를 못 부르고, 예외를 뚫는 비용이 크다"
> 였는데 **사실이 아니었다.** `k8s/base/network-policy/11-allow-egress-https-public.yaml` 이 이미
> auth·quant·quant-ingest·gifticon 를 화이트리스트하고 있고, 추가는 `matchExpressions.values`
> **한 줄**이다. 실제 비용은 egress 예외가 아니라 파이썬 스크립트의 이미지 승격이었다.
> → `place-ingest` CronJob 으로 주기화한다 (`docs/specs/2026-08-19-attraction-content-enrichment/tasks.md` T1).
> 그때까지는 아래 수동 실행이 유효하고, 돌릴 때 **사용자에게 실행 시점을 먼저 확인**한다.

---

## 3. 지켜야 할 것 (어기면 데이터가 날아간다)

### 3.1 bulk upsert 는 전체 동기화다 — 부분 전송 금지

`POST /api/places/attractions/bulk` 은 `Attraction.syncFrom` 으로 **보내지 않은 필드를 null 로 덮는다.**
예외는 개요 하나뿐(`overview = source.overview ?: overview`).

한 필드만 고치고 싶으면 place API 로 현재 레코드를 읽어 그 위에 덮어써서 **전체 레코드**를 보낸다
(`backfill_overview.py` 의 `UPSERT_FIELDS` 방식). 검증용으로 부분 레코드를 보냈다가 실제로
경복궁 행의 주소·이미지·분류를 날린 적이 있다.

### 3.2 개요는 목록 재동기화로 지워지지 않는다 — 다만 그 보호가 유일하다

목록 재수집이 개요를 덮어쓰던 버그로 **300건을 잃은 뒤** 보호를 넣었다. 이 규칙을 되돌리면
며칠치 수집이 한 번에 사라진다. 관련 테스트: `place/domain/.../AttractionTest.kt`.

### 3.3 원천이 빈 개요를 주는 레코드는 negative cache 로 제외한다

`attraction_overview_probes` 테이블 (2026-08-20 전까지는 로컬 파일). 이게 없으면 SSOT 에는 영원히 "개요 없음"이라
**매일 다시 호출**되며 큐 앞자리를 차지한다. 429·네트워크 실패는 **기록하지 않는다** — 넣으면
그 레코드가 영영 재시도되지 않는다.

### 3.4 TourAPI 구 코드는 폐기 중이다

`areaBasedList2` 를 areaCode 없이 부르면 응답의 `areacode`·`cat1~3` 이 100% 빈 문자열로 온다.
발급 화면에서도 `areaCode2`/`categoryCode2` 는 "미사용(삭제예정)". **신체계(`lclsSystm1~3`,
`lDongRegnCd`)가 원본**이고 구 코드는 파생이다.

지역을 지정해 순회하면 areaCode 자체가 없는 레코드 **43%** 를 통째로 놓친다. 무지정 페이징으로
전량을 받고 `sync_tour.py` 의 `LDONG_TO_AREA`·`LCLS1_MAP` 으로 역산한다 (값은 추측이 아니라
지역별 조회 최빈값 실측).

### 3.5 무료 티어가 최상위 제약이다

용량이 모자라면 증설이 아니라 **동시성 축소**로 푼다. 벡터 검색·상시 워커 추가 같은 건
free-tier 마진을 다시 계산한 뒤에만 올린다.

---

## 4. 측정된 검색 품질 문제 (P2 의 근거)

2026-08-19 운영 실측. **음식·쇼핑이 62%** 라 관광지가 밀려난다.

| 쿼리 | 결과 | 문제 |
|---|---|---|
| `경복` (자동완성) | 한복남 경복궁점 · **경복궁** · 다이소 경복궁역점 · 앤더슨벨 · 올리브영 | 상호에 지명이 들어간 상점이 본체를 밀어냄 |
| `한옥` | 한옥 생고기 · 스미스가 좋아하는 한옥 · 한옥달 · 이태리한옥 · 전주 한옥마을 역사관 | 식당이 상위 4개 점유 |
| `궁궐` | 13건 — 창경궁 · 덕수궁 · 진도 용장성 · 광화문 | **경복궁이 안 나온다** (문자열 불일치) |
| `해수욕장` | 2,236건 전부 nature | 정상 |

읽히는 것 두 가지.

1. **분류 가중치가 없다.** 관광 의도의 질의인데 상점·식당이 동점 이상으로 뜬다.
2. **유사어가 없다.** `궁궐`↔`고궁`↔개별 궁 이름이 연결돼 있지 않아 대표 관광지가 누락된다.

### 그 밖의 알려진 제약

- **`totalElements` 가 10,000 에서 잘린다** (`max_result_window`). ko 실제 44,912 인데 화면엔 10,000.
  총계를 보여줄 거면 `track_total_hits` 나 별도 count 경로가 필요하다.
- **키워드 없는 기본 목록은 `matchAll` + `id` 오름차순**, 즉 **적재 순서**다. 지금은 관광지가 먼저
  적재돼서 결과적으로 그럴듯하지만, 음식·쇼핑을 먼저 재적재하면 첫 화면이 뒤집힌다.

---

## 5. 강화 방향 — 권장 순서

근거가 있는 것부터. 각 단계는 **바꾸기 전/후를 같은 쿼리로 재서** 남긴다.

### 1순위 — 분류 가중치 (가장 싸고 효과가 큼)

`function_score` 로 관광 분류(nature/history/culture/leisure)를 상향, 상점·식당을 하향.
위 4개 쿼리가 회귀 케이스가 된다. `RankingProperties`/variant A/B 패턴이 이미 있으니 재사용.

### 2순위 — 유사어 사전

`궁궐`↔`고궁`, 개별 궁 이름 묶기 등. 입력은 TourAPI 국영문 타이틀 쌍(좌표 근접 + 이름 유사도)
→ `synonym_graph` 필터. 국영문 쌍 매핑 휴리스틱의 정확도 검증이 선행 과제(OQ-3).

### 3순위 — popularity 신호

관광빅데이터 방문자 지표로 `popularity` 를 채운다(P1 은 0). 데이터셋 선정이 미결(OQ-4) —
중심관광지 커버리지부터 확인한다.

### 그 다음

- 자동완성 품질 (1·2순위가 들어가면 같이 좋아진다. 현재 엔드포인트는 **이미 동작 중**이라
  스펙의 "P2 자동완성"은 사실상 완료 상태로 봐야 한다)
- 평가 자동화(judgment set → NDCG@10/MRR) — 랭킹을 손대기 시작하면 이게 있어야 회귀를 잡는다
- ~~주기 동기화 CronJob 화 — egress 정책 예외가 필요해 비용 판단이 선행~~ → ADR-0070 으로 확정 (§2 각주)

---

## 6. 미결 · 사용자 작업

- **`VITE_GOOGLE_MAPS_KEY` 미등록** (GitHub Secrets). 없으면 지도 없이 목록만 나오는 폴백으로
  동작한다 — 깨지지는 않는다. Maps JavaScript API 키 + HTTP referrer `*.1989v.com` 제한 필요.
  **마커는 이미 구현돼 있다** (`portal-fe/src/pages/place/PlacePage.tsx:177-197` — 결과마다
  `Marker` 생성, 클릭 시 상세 선택, `fitBounds`). 키 하나가 없어서 안 보일 뿐이므로 "지도 마커"는
  신규 구현이 아니라 사용자 작업 + 품질 개선(`AdvancedMarkerElement` 전환) 범위다.
- `TOUR_API_KEY` 는 `~/.config/1989v/tour.env` (chmod 600, 레포에 없음). **값을 출력하지 않는다.**
- 노출 기준: 기본 목록이 관광지 위주로 보이는 건 적재 순서 덕이라 **의도된 설계가 아니다.**
  1순위 작업(분류 가중치)이 들어가면 자연히 해소된다.

---

## 7. 파일 지도

| 무엇 | 어디 |
|---|---|
| ETL·매핑 | `place/ingest/src/sync_tour.py` |
| 개요 수집 | `place/ingest/src/backfill_overview.py` |
| 하루치 파이프라인 | `place/ingest/src/main.py --job=overview` (CronJob `place-ingest-overview`) |
| 사용법 | `place/ingest/README.md` |
| 도메인(보호 규칙) | `place/domain/.../attraction/model/Attraction.kt` |
| 검색 쿼리 | `search/app/.../opensearch/AttractionSearchAdapter.kt` |
| 화면 | `portal-fe/src/pages/place/PlacePage.tsx` |
| 스펙 / 결정 | `docs/specs/2026-08-11-k-tour-search/`, `docs/adr/ADR-0065-k-tour-search.md` |
| 운영 DB 조회 | `~/.local/bin/oci-mysql place_db "..."` (로컬 전용 CLI) |

---

## 8. 이어받는 세션이 처음에 할 일

```bash
kubectl -n commerce create job --from=cronjob/place-ingest-overview place-ingest-overview-manual
kubectl -n commerce logs -f job/place-ingest-overview-manual    # 잔량이 로그 앞뒤에 찍힌다
```

그리고 위 4장의 네 쿼리를 그대로 던져 **현재 품질을 먼저 기록**한다. 바꾸기 전 값이 없으면
좋아졌는지 말할 수 없다.
