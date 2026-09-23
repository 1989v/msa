# 테스트 전략 — 광고 네트워크

> 개정 3 (2026-09-23) — test-strategy 1·2차 리뷰, usecase N6, security R2-2·3·4·6, architecture N1·N2 반영.

Kotest BehaviorSpec + MockK (`docs/standards/test-rules.md`).
이 도메인은 **돈과 카운트가 조용히 틀린다** — 빌드가 초록이어도 원장이 어긋나거나 한 노출이 두 번 과금된다. ★ = critical path.

## 원칙

- **돈·일회성·차단 경로는 실제 Redis 와 MySQL.** Redis 는 `GenericContainer("redis:7")`(`testcontainers-junit` 이 core 를 가져온다), MySQL 은 `testcontainers-mysql`. MockK 로 대체하면 회귀 주입이 테스트가 만든 응답을 재게 된다
- **시간은 `Clock` 주입** — KST 자정·페이싱·토큰 2시간·클릭 10분·정산·인덱스 1분. Redis TTL 은 Clock 으로 움직이지 않으므로 **TTL 은 `PTTL` 값으로 판정**한다
- 스케줄 작업은 `ads.scheduling.enabled=false` 로 끄고 테스트가 직접 호출한다(몇 번 돌지 테스트가 통제)
- 픽스처 `AdsFixtures`(선례 `BacktestFixtures.kt`). 테스트 DB 는 컨테이너 init 으로 `ads_db` 를 따로 만든다(`experiment_db` 공유 시 두 Flyway 이력 충돌)
- 이름: 단위 `{구현체}Test`, 통합 `*IntegrationSpec`, 호스트 `EngagementContextLoadSpec` 확장 + `AdsSchemaIntegrationSpec`
- 테스트 properties 에 `ADS_TOKEN_SECRET`(32바이트)·`spring.datasource.ads.*`·ads Redis 컨테이너 주소

## Unit (`:ads:domain`)

| # | 시나리오 | 기대 | AC |
|---|---|---|---|
| ★U1 | 분개 합 ≠ 0 거래 생성 | 팩토리 거부, 생성자 비공개 | AC-11 |
| ★U2 | 청구액 = min(지출, 일예산 − 그날 청구 누계, 총예산 − 누계, 지갑) — 넷 각각이 이기는 경우 + 여러 시각 누계 | 경계마다 기대값 | AC-12 |
| ★U3 | 수익 배분 floor + 나머지 — 청구 1·3·7 마이크로, 68% | 퍼블리셔 + 수수료 = 청구액 | AC-20 |
| ★U4 | 1회 과금액 — CPM 999·1000·1001 마이크로 입찰, CPC | floor(/1000), 최저가 하한이 ≥ 1 보장 | AC-5 |
| ★U5 | 경매 — CPM vs CPC×pCTR, 동점 id 오름차순, 한 응답 같은 캠페인 두 지면 금지 | 결정적 승자 | AC-5 |
| U6 | 최저가 인상 뒤 · 비율 불일치 · 후보 0 | 그 지면 제외, 사유 | AC-5 |
| U7 | pCTR — 노출 0 | (0+1)/(0+100) | AC-5 |
| U8 | 페이싱 — 앞섬/뒤처짐(Clock·난수 고정) | 확률 감소/1 | AC-5 |
| U9 | 캠페인 전이 — DRAFT→ACTIVE⇄PAUSED→ENDED, ENDED 되돌리기 거부 · 기간 밖·예산 소진은 상태 불변·자격만 없음 | | AC-3 |
| U10 | 저장 불변식 — 입찰가 < 타기팅 지면 중 하나의 최저가 · 일예산 < 1회 과금액 | 저장 거부 | AC-3 |
| U11 | 소재 `revise()` — 교체와 PENDING 복귀가 함께 | 게재 자격 상실 | AC-14 |
| ★U12 | 이미지 — 확장자 위장 PNG · **300KB 안의 20000×20000 PNG(헤더만 읽고 디코딩 전 거절)** · 300KB+1 · 2001px · https 아님 · userinfo | 사유별 거부, 거대 이미지는 디코더 호출 0 | AC-4 |
| U13 | HOUSE 링크 — `/games` 허용 · `//evil.example` · `/\evil` · `https://u@x` 거부 | | AC-16 |
| U14 | 토큰 — 변조 · 만료 · 이전 키 검증 · 방문자 해시 불일치 · 과금 여부 false · 32바이트 미만 키 | 사유 구분, 상수 시간 비교, 짧은 키 거부 | AC-9, AC-9b |
| U15 | 충전 한도 — 한도 정확히 / +1 / KST 자정 초기화 | | AC-2 |
| U16 | 광고주 정지 — 쓰기 거부, 조회 허용 · SYSTEM 광고주는 지갑 없음 | | AC-14 |
| U17 | 지갑 여유 = 스냅샷 잔액 − 정산 완료 시각 이후 (광고주, 시각) 지출 합 · 미정산 6시간 초과 시 제외 | | AC-3 |

## Integration (`:ads:feature`, 실제 Redis·MySQL)

| # | 시나리오 | 기대 | AC |
|---|---|---|---|
| ★I1 | 같은 노출 토큰 두 번 | 과금 1회, `duplicate` 1 | AC-9 |
| ★I2 | 정산 두 번 실행 | 잔액·분개 수 동일 | AC-12 |
| ★I3 | 동시 정산 + 동시 셀프 충전 두 건(한도 경계) | 잔액 = 거래 합, 한도 초과분 0 | AC-2, AC-11 |
| ★I4 | Redis 정지 — 결정 · 이벤트 | 결정 `redis_unavailable` 200 · 이벤트 수락 0 · **1초 안** 반환(타임아웃 값과 겹치지 않게) | AC-7 |
| ★I5 | 집계 절대값 UPSERT 두 번·겹쳐 실행 | 값 불변 | AC-12, AC-13 |
| ★I6 | 정산 따라잡기 — 3시각이 닫힌 채 작업 1회 | 세 시각 모두 정산, 정산 완료 시각 갱신 | AC-12 |
| ★I7 | **토큰 몰아 제출** — 결정 때 상한 미달이던 토큰 N개를 한꺼번에 | 시간당 상한을 넘는 몫은 `over_budget`, 과금 0 | AC-9 |
| ★I8 | 후보 차단 경로 넷 — 방문자 빈도 도달 · 카테고리 불일치 · 실시간 지출로 일예산 소진 · 지갑 여유 ≤ 0 | 각각 후보 제외 | AC-3, AC-5 |
| I9 | 인덱스 갱신 직접 호출 — 승인·정지·반려 반영 | | AC-14 |
| I10 | 크롤러 UA 결정 | 광고 없음, ads Redis 명령 0 | AC-9 |
| I11 | 미등록 키 | `unregistered_placement` 누적 | AC-15 |
| I12 | 클릭 — 서명 불량 → `/` · 승인 아닌 소재 → `/` · 만료 → 랜딩·과금 0 · 정상 → DB 랜딩 · 응답 헤더 `no-store`·`noindex` | | AC-10 |
| I13 | Kafka 발행 실패 · 발행 페이로드(entity_type·action·view_id·visitorId·sessionId·section_id) | 정산 정상 / 필드 일치 | AC-17 |
| I14 | 비콘 묶음 부분 수락(유효 2·위조 1) | 수락 2, 거절 1 | AC-9 |
| I15 | 일회성 표식 `PTTL` ≥ 토큰 남은 수명 | | AC-9 |
| I16 | HOUSE 게재 | 원장 행 0, 빈도 무관 매번 목록 | AC-16 |
| I17 | 남의 캠페인·소재 id · 광고주 요청에 HOUSE·심사 상태 | 404 · 필드 없음 | AC-18 |
| I18 | 광고주 등록 | `ad_advertiser` 행 생성, auth 의 Role 조회 결과 불변 | AC-1 |
| I19 | 반려 → 광고주 소재 조회 | 반려 사유 코드가 보인다 | AC-14 |
| I20 | 리포트 = 집계·원장 합, 예산 초과일 지출 ≠ 청구 표시 | | AC-13 |
| I21 | 원장 합 검사기 — 불균형 분개 주입 | ERROR·메트릭 | AC-11 |
| I22 | 옛 `GET /placements/{key}` 호환 | 옛 응답 모양 | AC-16 |
| I23 | 에셋 응답 | Content-Type · `nosniff` · 불변 캐시 | AC-4 |

## Component

| # | 시나리오 | 기대 | AC |
|---|---|---|---|
| ★C1 | `EngagementContextLoadSpec` — ads 컨트롤러 빈 + **충전 진입점 호출 뒤 잔액을 다시 읽어 충전액과 같은지**(TM 한정자 누락 시 갱신이 사라지는 결함을 값으로 판정) | 잔액 일치 | 폴드 게이트 `build.gradle.kts:701-731` |
| C2 | `AdsSchemaIntegrationSpec` — Flyway 스키마 = 엔티티(`validate`) | | — |
| C3 | 시크릿 없음·32바이트 미만으로 컨텍스트 기동 | 기동 실패 | OQ-003 |
| ★C4 | 게이트웨이 **라우트 표 전수 검사**(`GatewayRouteConfig` 라우트 목록) — ads 공개 라우트에 게스트 필터·Host 조건(rt 제외), advertiser 로그인 필수, 어드민 ROLE_ADMIN, 좁은 경로 선언 순서, 옛 `game-ads` 없음 | | AC-9b, AC-18 |
| C5 | 게이트웨이 필터 단위 — 클라이언트 `X-User-Id` 제거, Bearer 있으면 주입, advertiser 무토큰 401 | | AC-9b, AC-18 |
| ★C6 | ads 서비스 — 게이트웨이가 넣는 형태의 `X-User-Id`(소유자)로 결정 → 이벤트 제출 | 과금 0 | AC-9b |

C4~C6 로 나눈 이유: 기존 게이트웨이 테스트는 프록시 경로를 다루지 않고(`GatewayRoutingSpec.kt:16-18`) 목적지가 고정 주소다. 두 JVM 을 잇는 확인은 E5 가 맡는다.

## FE (portal-fe 단위)

| # | 시나리오 | 기대 | AC |
|---|---|---|---|
| ★F1 | AdSlot 채움 — 유료 / 결정 실패·빈 200 / AdSense unfilled / **AdSense 상태 3초 무응답** / 둘 다 없음 · 대기 중 최소 높이 유지 | 유료 → AdSense → HOUSE → 숨김 | AC-6 |
| F2 | 결정 호출이 `apiClient` 를 쓴다(Bearer 부착) | | AC-9b |
| F3 | HouseBanner — HOUSE 목록 3개 6초 순환, 앱 안 경로 SPA 링크 | | AC-16 |
| F4 | 광고 카드 — 광고주 문자열 `<img onerror>` | 텍스트로 보인다 | AC-19 |
| F5 | 광고 카드가 `useImpression` 훅으로 노출을 보고한다 — IntersectionObserver 모의로 50%·1초 미만은 보고 없음, 이상은 1회 | 동작으로 판정(상수 비교 아님) | AC-9 |
| F6 | `privacyRetention.test.ts` — ads 설정 파일의 `VISITOR_FREQUENCY_TTL_HOURS = 25L` 을 읽어 방침 문구와 대조(헬퍼가 시간 단위도 읽게 확장, 테스트에 25 를 적지 않는다) | | SR-17 |
| F7 | 콘솔 페이지 `noindex` 메타 · 비로그인/비광고주/정지 첫 화면 | | SR-15 |

## E2E / 운영 검증 (배포 후 — 사람 UA + 저장된 행 수)

| # | 시나리오 | 기대 | AC |
|---|---|---|---|
| ★E1 | 광고주 등록 → 충전 → 캠페인·소재 → 승인 → blog 글 끝 게재 → 가시 노출 → 클릭 → 정산 | 리포트·원장이 손 계산과 일치 | AC-1~3, AC-12, AC-13 |
| E2 | 결정 실패 / 유료 없음 → AdSense → HOUSE | 화면 대체 순서(CDP 4조합) | AC-6 |
| E3 | 게임 목록 HOUSE 배너 | 전과 같은 3종 순환 | AC-16 |
| E4 | 결정 지연 P99 | ≤ 30ms | AC-8 |
| ★E5 | 실제 게이트웨이 경유 — 광고주 본인 로그인 브라우저로 자기 광고 노출·클릭 | 청구 0 | AC-9b |
| E6 | `rt.1989v.com/api/v1/ads/decisions` | 404 | SR-9 |

## AC ↔ 테스트 대응

| AC | 테스트 |
|---|---|
| AC-1 | I18 · E1 |
| AC-2 | U15 · I3 |
| AC-3 | U9 · U10 · U17 · I8 |
| AC-4 | U12 · I23 |
| AC-5 | U4~U8 · I8 |
| AC-6 | F1 · E2 |
| AC-7 | I4 |
| AC-8 | E4 |
| AC-9 | U14 · I1 · I7 · I10 · I14 · I15 · F5 |
| AC-9b | U14 · C4 · C5 · C6 · F2 · E5 |
| AC-10 | I12 |
| AC-11 | U1 · I3 · I21 |
| AC-12 | U2 · I2 · I5 · I6 |
| AC-13 | I5 · I20 · E1 |
| AC-14 | U11 · U16 · I9 · I19 |
| AC-15 | I11 |
| AC-16 | U13 · I16 · I22 · F3 · E3 |
| AC-16b | 제거 릴리스 컴파일 + `ContentContextLoadSpec` |
| AC-17 | I13 |
| AC-18 | I17 · C4 · C5 |
| AC-19 | F4 |
| AC-20 | U3 |

## CI

`ci.yml` 에 `ads/*) :ads:domain:test :ads:feature:test :engagement:app:test` 명시. 첫 PR 의 CI 로그에서 세 태스크 실행을 확인한다 — 매핑이 없거나 기본 분기로 가면 ads 테스트가 안 돌거나 없는 태스크로 전부 실패한다.

## 회귀 주입 (gate-must-be-proven)

임시 워크트리에서 주입하고 빨간불을 본 뒤에만 「켰다」고 말한다.

- U1 분개 하나 빼기 · U3 floor → round · U12 헤더 검사 제거(디코더 호출 발생)
- I1 일회성 SETNX 제거 · I2 멱등 키에서 시각 제거 · I5 UPSERT → 증분 더하기 · I7 수락 단계 상한 확인 제거
- C1 ads `@Transactional` 한 곳의 TM 한정자 제거 → 잔액 불일치
- C6 결정 시점 본인 판정 끄기 → 과금 발생
- F5 카드에서 `useImpression` 대신 즉시 보고 → 50% 미만도 보고
