# 작업 분해 — 관광지 콘텐츠 보강

스펙: `spec.md` · 결정: `docs/adr/ADR-0070-attraction-content-enrichment.md`

순서 원칙: **값이 먼저 나오는 것부터.** T0 은 코드가 0줄이고, T1 은 링크와 무관하게
매일 수동 절차를 없앤다. 링크 기능(T2~T4)은 그 뒤다.

---

## T0 — 지도 키 주입 (코드 0줄, 사용자 작업)

마커는 이미 구현돼 있다 (`PlacePage.tsx:177-197`). 키 하나가 없어서 안 보일 뿐이다.

- [ ] Google Cloud 콘솔에서 Maps JavaScript API 키 발급
- [ ] HTTP referrer 제한 `*.1989v.com` + 일일 쿼터 캡
- [ ] GitHub Secrets `VITE_GOOGLE_MAPS_KEY` 등록 → portal-fe 재빌드

**검증**: `place.1989v.com` 에서 검색 후 마커가 찍히고 클릭 시 상세가 열린다.

---

## T1 — 수집 파이프라인 주기화 (링크와 독립) — **완료 (2026-08-20, 64015a6d)**

2026-08-17 "자동 스케줄 금지" 를 뒤집는 작업. 근거는 ADR-0070 맥락 4번.

- [ ] `tools/seed/tour/{sync_tour,backfill_overview}.py` → `place/ingest/src/` 이동,
      `quant/ingest` 구조 복제 (Dockerfile + pyproject.toml + `--job=` 분기)
- [ ] 적재 경로를 SSH·port-forward 에서 **클러스터 내부 `http://place:8096` 직접 호출**로 교체
- [ ] negative cache 를 로컬 파일에서 DB(`attraction_link_request` 와 같은 정신)로 옮길지 판단 —
      개요는 `overview IS NULL` 로 큐를 만들므로 파일이 남아야 한다면 PVC 대신 place 에 자리를 만든다
- [ ] `k8s/base/place-ingest/cronjob-overview.yaml` (매일 KST 04:00, `concurrencyPolicy: Forbid`)
- [ ] `11-allow-egress-https-public.yaml` values 에 `place-ingest` 추가 + 주석에 사유
- [ ] Secret `place-ingest-secrets` (로컬: plain / 운영: SealedSecret)
- [ ] `cronjob-attraction-reindex.yaml` `suspend: false` + KST 04:30, 주석의 "P2 sync CronJob 도입 시" 갱신
- [ ] `images.yml` 에 `place-ingest` 3곳 추가 (ALL_DOCKER / 경로매핑 / DOCKER_CTX)

**검증**: CronJob 수동 트리거 → 개요 잔량이 실제로 줄어드는지 `--stats` 로 전후 비교.
재색인 로그에 `reindex complete`.

**함정**: 부분 전송 금지 (핸드오프 §3.1). backfill 이 전체 레코드를 돌려주는 현재 방식을 유지한다.

---

## T2 — 링크 도메인 + API (place) — **딥링크분 완료**, 수집형은 T3 과 함께

- [ ] `AttractionLink` 도메인 모델 + `AttractionLinkRequest` (프레임워크 의존 없음) — T3
- [x] `AttractionDeepLinks` 템플릿 + `AttractionOverviewProbe` (T1 에서 함께)
- [ ] Flyway 마이그레이션 2개 테이블 (enum STRING, UNIQUE/INDEX 는 spec.md §2) — T3
- [x] `GET /api/places/attractions/{id}/links` — 딥링크 조립 (캐시·큐는 T3)
- [ ] `GET|POST /internal/attractions/links/**` — 큐 조회 / 적재 — T3
- [x] 딥링크 템플릿 상수 1곳 (`AttractionDeepLinks`)

**검증**:
- 캐시 유효/만료/부재 3분기 — Kotest BehaviorSpec
- 큐 적재가 실패해도 조회가 200 을 반환한다
- `emptyFor` 는 큐에서 제거, `attempt_count` 증가는 유지 — **이 둘을 섞으면 데이터가 날아간다**
- `Attraction.syncFrom` 이 링크를 건드리지 않는다 (구조적 보장을 테스트로 못 박는다)

---

## T3 — 수집 커넥터 (place-ingest 확장)

- [ ] YouTube `search.list` 커넥터 — 일 100건 예산, 제목 매칭 필터
- [ ] 네이버 블로그 검색 커넥터 — 일 25,000콜
- [ ] 예산 카운터: 당일 `collected_at` 기준 count 로 `pending` limit 산출
- [ ] `k8s/base/place-ingest/cronjob-links.yaml` (10분)

**검증**: 표본 50건 수동 채점으로 OQ-1(오탐률) 해소. 429 를 받았을 때 `emptyFor` 로
보내지 않는지 단위 테스트.

---

## T4 — FE 관련 콘텐츠 섹션 — **딥링크분 완료**

- [x] `AttractionLinks` 컴포넌트 — `PlacePage` 사이드 패널 + `AttractionPage` 공용
- [x] 딥링크 버튼 행 (인스타 / 마이리얼트립 / Klook)
- [ ] 유튜브 썸네일 카드 / 블로그 링크 — T3
- [ ] `pending` 스켈레톤 (오류 아님) — T3
- [x] `rel` 속성 + `AFFILIATE` 배지·고지 (ADR-0069 §1 규칙 그대로)
- [x] `placeApi.ts` 에 `fetchAttractionLinks`

**검증 (2026-08-20 실측)**: 기기 × 사이트 4조합 모두 동일값, `color-scheme: light only`/`dark only`.
제목·버튼 15.27/13.34 · hover 14.48/12.76 · 라벨/배지/고지 8.53/10.11 — 전부 4.5:1 상회.
고지 문구가 `--ko-text-muted` 로 **4.09:1** 이던 것을 실측으로 잡아 `--ko-text-secondary` 로 올렸다
(읽히지 않는 고지는 고지가 아니다). 방법 → `docs/standards/fe-visual-verification.md`.

---

## T5 — 지도 품질 (T0 이후)

- [ ] `Marker` → `AdvancedMarkerElement`
- [ ] 선택 마커 강조 + 카드 hover ↔ 마커 연동
- [ ] 클러스터링은 하지 않는다 (페이지당 30건)

---

## T6 — 문서 동기화

- [ ] 핸드오프 문서의 틀린 전제 2건 정정 (마커 이미 구현 / 클러스터 egress 가능)
- [ ] `place/CLAUDE.md` 에 링크 보강 + ingest CronJob
- [ ] 루트 `CLAUDE.md` place 행 갱신
- [ ] `tools/seed/tour/README.md` → `place/ingest/README.md` 이동 안내

---

## 의존 관계

```
T0 ─────────────────────────────► (독립, 즉시)
T1 ──► T3 (같은 이미지)
T2 ──► T3 ──► T4
T0 ──► T5
모두 ──► T6
```

T1 은 T2~T4 를 기다리지 않는다 — 매일 수동 절차를 없애는 값이 링크 기능과 무관하다.
