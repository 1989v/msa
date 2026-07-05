# ADR-0059 식품 영양성분/원재료/원산지 enrichment — 칼로리 계산기 데이터 기반

## Status

Accepted (2026-07-05)

**Date**: 2026-07-05
**Authors**: kgd
**Related**:
- **ADR-0056** (오픈데이터 상품 적재 + place) — 본 ADR 은 그 상품 파이프라인의 영양 확장.
- **ADR-0055** (OpenSearch 전환) — products 인덱스 매핑 SSOT / opensearch-java 클라이언트. 본 작업에서
  잠재 버그 2건(§부수 픽스) 발견·수정.
- **ADR-0013** (Inventory SSOT) — 불변. 영양은 카탈로그 속성으로 product SSOT 에 귀속.

> 번호 주의: main 에 ADR-0057(검색 A/B identity)·ADR-0058(commerce 모듈러 모놀리스)이 존재하여 0059 부여.

---

## Context

상품 카탈로그를 칼로리 계산기·저칼로리 탐색·원재료/원산지 표시에 활용하고자 한다. 리서치 결과:

- 현재 적재 소스인 **품목제조보고(#15064909/I1250)는 영양 수치 0** (18필드 전부 메타데이터).
  단 `PRDLST_REPORT_NO`(품목제조보고번호)를 보유 — 한국 가공식품의 사실상 PK.
- **전국통합식품영양성분정보(가공식품) 표준데이터(#15100066)** 가 에너지(kcal)·탄단지·당류·나트륨을
  **100g 기준**으로 제공하며 **품목제조보고번호 컬럼을 보유** → exact join 성립. 라이선스 제한없음.
- 원재료: **C002**(품목제조보고 원재료)가 `RAWMTRL_NM` 텍스트 제공(확정 스펙). **함량%는 무료 공개데이터에
  부재** — GS1 코리안넷(유료 게이트)/OFF percent_estimate(ODbL·추정치)는 회피.
- 원산지: 국내 가공식품 마스터에 원산지 컬럼이 없음. 영양DB의 원산지국명/수입여부가 best-effort 유일.

## Decision

| # | 결정 | 근거 |
|---|------|------|
| D1 | 영양 소스 = **#15100066**, 조인 = **품목제조보고번호 exact join** | 100g 기준 일관 → 계산기 로직 = `(값/100)×섭취g`. fuzzy 불필요(결정적 매핑). 기준량 비100g 행은 제외. |
| D2 | product 에 **nullable 9필드** 추가: `energyKcal/carbohydrateG/proteinG/fatG/sugarG/sodiumMg`(DOUBLE, 100g) + `ingredients`(VARCHAR 2000) + `originCountry`(VARCHAR 64) + `itemReportNo`(VARCHAR 30, 조인키 영속화+인덱스) | 미매칭은 **null 유지 — 추정 채움 금지**. 이벤트/색인/검색 응답까지 전파(기존 flat 스타일). 마이그레이션 `V20260703_001`. |
| D3 | 원재료 = **C002 텍스트까지만** (`--ingredients` opt-in, 건당 1콜 cap) | 함량% 구조화는 무료 데이터로 불가 — 범위에서 제외하고 텍스트 표시로 한정. |
| D4 | 원산지 = 영양DB `원산지국명` best-effort. **"원료 국내산" 단정 표기 금지** | 국내 마스터에 원산지 부재. 허위표시(표시광고법) 리스크 — UI 는 값 그대로("원산지국명: X") 수준까지만. |
| D5 | 검색: 인덱스 매핑에 영양 9필드(`ingredients` text/nori, `originCountry`/`itemReportNo` keyword) + **`minKcal`/`maxKcal` hard filter**(filter context, 랭킹 무영향) | 저칼로리 탐색. 영양 null 문서는 range 에서 자연 제외(의도). 칼로리 **계산**은 클라이언트 몫(전용 API 불필요). |
| D6 | ETL 키 이원화: `DATA_GO_KR_KEY`(참가격·영양표준) / `MFDS_KEY`(I1250·C002, 미설정 시 전자 재사용) | 두 포털의 키 체계가 다름. |
| D7 | 영양 수집 이중화: **CSV 모드(권장, 한글 헤더 확정 스펙)** + API 모드(영문 키 미문서화 → 후보키 + `--dump-keys` 진단) | 표준데이터 OpenAPI 의 영문 필드명이 공식 문서에 없어, 실패 시 1-run 자가진단 가능하게 설계. |

## 부수 픽스 (본 작업 로컬 E2E 에서 발견한 실버그)

| 커밋 | 내용 |
|---|---|
| `bbe23e8` | Boot 4: `@EnableKafka` 누락 + 기본 listener factory 부재 + `__TypeId__` 헤더 ClassNotFound — consumer 가 **구독 자체를 못 하던** 버그 3종 |
| `faf6b07` | Boot BOM 의 httpcore5 5.3.6 다운그레이드 ↔ opensearch-java 3.8(5.6/5.4.2) 충돌 → `NoSuchMethodError` — 검색 500·consumer flush 무증상 실패. dependencyManagement 오버라이드로 정렬 |
| `df83d9c` | Hibernate 암묵 네이밍이 끝자리 단일 대문자(`carbohydrateG`→`carbohydrateg`)를 '_' 없이 생성 — 마이그레이션과 불일치 → `@Column(name)` 명시 |
| `01f88ff` | products 인덱스 `id` 매핑 누락 → dynamic text → id 정렬 all-shards-failed (잠재 버그) → `id: keyword` |
| `2ff60f3` 내 | seed tasklet 의 컨텍스트 ObjectMapper 가 Kotlin Creator 미인식("no Creators") → `jacksonObjectMapper()` 자체 생성 |

## Consequences

**긍정**: 칼로리 계산기/저칼로리 필터가 실데이터로 동작(로컬 E2E: seed 24건 → Kafka → OpenSearch 색인
→ `keyword=김치&maxKcal=100` 1건 등 검증). 조인키(itemReportNo) 영속화로 영양 재보강(update 경로) 가능.
이벤트 파이프라인이 처음으로 **끝까지 라이브 검증**됨(위 픽스 5건의 부산물).

**부정/리스크**:
- R1 영양 API 영문 필드명 미확정 — 실키 최초 실행 시 `--dump-keys` 로 검증 필요(CSV 모드는 무관).
- R2 영양값 신선도: 표준데이터 연 1회 갱신 — **참고용 면책 필수**, 알레르기 정보는 텍스트 파생 금지(포장 확인 안내).
- R3 참가격/영양 커버리지 갭: 참가격 단독(chamgagyeok) 상품은 품목보고번호가 없어 영양 미조인.
- R4 C002 는 건당 1콜 — 대량 수집 시 일 쿼터(1만)·시간 소요, cap 으로 통제.
- R5 main 병합 시 ADR-0058 모듈 재편과 충돌 예상 — 병합 별도 작업.

## 검증

로컬(worktree msa-geo-run, 2026-07-05): 시드 24건(스킵 0) → product_db(영양 14/원재료 15/원산지 7)
→ `product.item.created` → consumer flush → OpenSearch 24건. 검색 검증: 우유(66kcal 전영양 응답),
라면+maxKcal=100→0, 김치+maxKcal=100→1(29kcal), 커피+minKcal=400→커피믹스(455)만(영양 null 원두 제외),
원재료 nori 검색 `밀가루`→6건. 산출물: `tools/local-infra/export/` 3종(영양 포함).
