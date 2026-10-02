# Engineer Review — TEST-STRATEGY

대상: `spec.md` · `planning/test-quality.md` (2026-09-27)
근거 탐색: 스펙 폴더 전체 · `docs/standards/test-rules.md` · `ads/CLAUDE.md` §테스트 · 상위 스펙 `docs/specs/2026-09-23-ad-network/verifications/regression-injection.md` · 기존 테스트(ads domain/feature, engagement `AdsSchemaIntegrationSpec`, portal-fe·admin FE).

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 SR 에 테스트가 있는가 | 부분 — 아래 F1·F2·F3 |
| 2 | 층 배정 | 대체로 적절. 후보 인덱스 사전 필터가 unit(U5)에만 있음(F4), 레이아웃 밀림이 jsdom 층에 있음(F8) |
| 3 | 목 경계 | 문제 없음 — 도메인은 목 없음, 통합은 컨테이너 MySQL·Redis(`AdsIntegrationSpec.kt:16-35`), 규칙(`test-rules.md:11-12`)과 맞다 |
| 4 | 테스트 데이터 전략 | 미기재 — F6 |
| 5 | 음성·경계 케이스 | 부분 — U2 경계 문구 모호(F5), 누락 음성 케이스(F1) |
| 6 | 명명 규칙 | 계획이 파일·스펙 이름을 안 정했다. 기존 관례(`*Test` 도메인, `*IntegrationSpec` 통합, BehaviorSpec)를 따른다고 한 줄 적으면 된다(비차단) |

## Findings

### F1. SR → 테스트 누락 항목 (체크 1·5)
| SR 문장 | 빠진 테스트 | 수정안 |
|---|---|---|
| `spec.md:25` 소재가 있으면 형태 변경 불가 · 기본 CARD | 어느 행에도 없음 (U2 는 저장 검사만, `test-quality.md:6`) | U2 에 「소재 1건 있는 캠페인의 형태 변경 → 거절」「형태 미지정 생성 → CARD」 추가 |
| `spec.md:26` 시작 검사(`verifyTargeting`) + 거절 문구에 지면 키·형태 | U2 가 저장만 말함. 문구는 기존에 `AdvertiserApiIntegrationSpec.kt:288` 처럼 고정 문자열로 핀하는 관례가 있다 | 「저장 뒤 형태 최저가 인상 → 시작 거절」 + 문구에 지면 키와 형태가 들어가는지 단언 |
| `spec.md:33` 요청에 형태 필드 없음 | 없음 | I2 에 「BANNER 캠페인에 `format:CARD` 를 실은 업로드도 BANNER 규칙으로 판정」 |
| `spec.md:34` HOUSE 는 CARD 내용 규칙 | U3 가 CARD·BANNER 만 말함(`test-quality.md:7`) | U3 에 HOUSE 케이스 |
| `spec.md:21` 규격 **제거**·감사 요약에 형태별 최저가 | I4 는 추가·변경·감사만(`test-quality.md:13`) | I4 에 API 제거 + 마지막 규격 제거 400 + 감사 요약 문자열 단언 |
| `spec.md:40` 청구·토큰·가시 판정은 형태 무관 | 없음 | I2 끝에 BANNER 노출 토큰 수락 → 과금 1회 단언 (기존 `EventAcceptanceIntegrationSpec` 헬퍼 재사용) |
| `spec.md:43` 띠배너도 같은 가시 노출 계측 | C1 은 alt·「광고」만(`test-quality.md:14`) | C1 에 「50% 미만/1초 미만은 보고 안 함」 — `AdCard` 에서 F5 로 회귀 주입이 물었던 케이스(`regression-injection.md:101`)를 띠배너에 그대로 |
| `spec.md:45` 채움 보고 `PAID` | C2 는 선택만 | C2 에 보고 값 단언 |
| `spec.md:50` 형식(PNG·JPEG)·픽셀 2000px | C4 는 300KB·비율만(`test-quality.md:17`) | C4 에 형식·2000px 케이스 |
| `spec.md:52` 허용 값은 카탈로그가 싣는다(사본 금지) | I3 은 서버가 싣는지만 봄 | C4 에서 카탈로그 목 값을 바꾸면 클라이언트 판정이 따라 바뀌는지 — 사본을 두면 빨간불이 나는 유일한 형태 |

### F2. 롤링 배포·릴리스 순서 커버리지 없음 (체크 1, 요청 항목)
- **FE ↔ 백엔드 순서.** 스펙은 「모르는 형태면 광고를 버린다」(`spec.md:44`)고만 한다. `format` 이 **없는** 응답(옛 백엔드)도 모르는 형태로 읽으면, FE 가 먼저 나가는 순간 모든 유료 광고가 사라진다. 반대로 백엔드가 먼저 나가면 옛 `parseAd` 는 `body` 가 문자열이기만 하면 받으므로(`adsApi.ts:137`) BANNER 를 `AdCard` 로 그리고 가시 노출로 과금한다.
  수정안: ① 스펙에 「`format` 없음 = CARD」를 적고 `parseAd` 단위 테스트 셋(없음→CARD, `"BANNER"`+빈 body→통과, `"VIDEO"`→null) ② 릴리스 순서를 ads/CLAUDE.md §릴리스 순서처럼 한 줄 적는다(백엔드→FE, 그 사이 BANNER 소재는 심사 승인 전이라 노출 0 이라는 전제라면 그 전제를 명시).
- **백엔드 옛 파드 ↔ V4.** `ad_creative.body` 를 NULL 허용으로 바꾸는데(`spec.md:60`) 옛 엔티티는 `body: String`, `nullable=false`(`CreativeJpaEntity.kt:41-42`)이고 `PaidCreativeContent(title, body, …)`(`:76`)로 넘긴다. 롤링 중 새 파드가 BANNER 소재를 NULL 로 쓰면 옛 파드의 30초 인덱스 갱신이 NPE 로 통째로 실패한다. validate 는 nullability 를 안 보므로 `AdsSchemaIntegrationSpec` 으로는 안 잡힌다.
  수정안: BANNER 도 `''` 로 저장하고 컬럼은 NOT NULL 유지(SR-4 의 응답 `body=""` 와도 맞다) — 또는 NULL 을 택하면 「옛 코드 인덱스 로드가 V4 데이터에서 성공」을 보는 테스트를 I1 에 추가.
- **옛 컬럼 보존(`spec.md:61`)이 핀되지 않는다.** I1(`test-quality.md:10`)에 「V4 뒤에도 `ad_placement.format·aspect_ratios·floor_micros` 가 있고 값이 그대로」 단언을 넣는다 — 누가 V4 에서 DROP 을 끼워 넣으면 빨간불.

### F3. 마이그레이션 백필 테스트가 빈 DB 에서만 돈다 (체크 1·4)
I1 은 새 컨테이너에 V1~V4 를 한 번에 적용하므로 백필 대상이 시드 네 행뿐이다(`V1__ads.sql:271-281`). 운영에는 어드민이 만든 지면(예: 테스트가 만드는 `a-adm-house` BANNER, `AdminApiIntegrationSpec.kt:192`)과 비율이 여럿인 `aspect_ratios` 가 있을 수 있다.
수정안: Flyway `target=3` 으로 올린 뒤 비시드 지면(BANNER·`"1.91:1,1:1"` 두 비율) 행을 넣고 V4 로 올려 `ad_placement_format` 백필 값을 단언. 시드 변경(game-list-banner 6.4:1·0.05·paid_allowed=TRUE)이 백필 **뒤에** 적용되는지도 같은 스펙에서.

### F4. 후보 인덱스 사전 필터가 unit 에만 있다 (체크 2)
`spec.md:37` 의 (지면, 형태) 사전 필터는 지금 `CandidateIndexService.build`(`CandidateIndexService.kt:73-86`)에 있고 `Auction.run` 이 아니다. U5(`test-quality.md:9`)는 경매만 본다.
수정안: `CandidateIndexIntegrationSpec` 에 「두 형태 규격을 가진 지면에 CARD·BANNER 후보가 각자 자기 최저가로 걸러진다」 케이스. 그리고 **HOUSE 는 형태 필터를 타지 않는다** — HOUSE 캠페인은 기본 CARD 인데 V4 뒤 `game-list-banner` 는 BANNER 규격만 갖는다. 기존 `DecisionIntegrationSpec.kt:88`(game-list-banner HOUSE 3건)이 이것을 무는 핀이므로 계획에 「수정하지 않고 유지해야 하는 기존 테스트」로 적는다.

### F5. 돈 경로 회귀 주입 계획이 없다 (요청 항목 · `ads/CLAUDE.md` §테스트 「돈·일회성·차단 경로 검사는 회귀를 주입해 빨간불을 본 것만 켰다고 친다」)
상위 스펙은 `test-quality.md §회귀 주입` 을 두고 결과를 `regression-injection.md` 에 남겼다(`regression-injection.md:3`). 이번 계획엔 그 절이 없다. 형태별 최저가는 과금 하한이라 대상이다. 또 U2 문구 「띠배너 0.05 는 통과, 카드 0.10 은 거절」(`test-quality.md:6`)은 CARD 최저가 0.10 에서 입찰 0.10 이 ≥ 로 통과해야 하므로 뜻이 모호하다.
수정안 — 경계와 주입을 짝으로:
| 주입 | 물어야 할 케이스 |
|---|---|
| 형태 최저가 대신 지면의 CARD 최저가(또는 옛 `floor_micros`) 사용 | BANNER 캠페인 CPM 0.05 저장 통과 · 0.049 거절 (U2), BANNER 후보 eCPM 0.07 이 blog-post-end 에서 남음 (U5·F4) |
| 형태 최저가 대신 지면 규격 중 최솟값 사용 | CARD 캠페인 CPM 0.05 거절 · 0.10 통과 (U2), CARD 후보 eCPM 0.07 탈락 (U5) |
| 비율 판정이 캠페인 형태가 아니라 지면 규격 **합집합** | CARD 캠페인에 6.4:1 이미지 → 거절, 반드시 **두 형태를 모두 받는 지면**(blog-post-end) 픽스처로 (U4). 한 형태 지면이면 합집합 버그가 초록으로 남는다 — U12 폭탄 FINDING(`regression-injection.md:34-38`)과 같은 모양 |
| `parseAd` 가 모르는 형태를 CARD 로 그림 | F2 의 `"VIDEO"` 케이스 |
| 업로드가 검사 실패에도 전송 | C4 「전송 호출 0회」 |
헤더 픽셀 검사 폭탄도 BANNER 캠페인이면 6.4:1 폭탄(예: 20000×3125)이 있어야 가로·세로 검사를 단독으로 문다.

### F6. 테스트 데이터·기존 테스트 변경 목록 미기재 (체크 4)
- `AdsDomainFixtures.placement` 는 단일 `format` 을 받는다(`AdsDomainFixtures.kt:23-31`) → 형태 규격 목록 빌더로 바뀌어야 하고, 통합 `AdsFixtures.placement` 도 같다. 6.4:1 이미지 생성기(`TestImages`)도 필요.
- **V4 뒤 반드시 빨간불이 나는 기존 단언**: `AdsSchemaIntegrationSpec.kt:65-70` 「game-list-banner 만 유료 불가」 — V4 가 `paid_allowed` 를 켜면(`spec.md:22`) 실패한다. 이 핀을 새 시드 값으로 **의도적으로 갱신**한다고 I1 에 적는다(조용히 지우면 시드 핀이 사라진다).
- 새 통합 케이스는 `ads/CLAUDE.md` §테스트 규칙대로 새 회원 id 대역을 잡고 `AdsFixtures.kt` 의 `memberAdvertiser` 주석에 한 줄 — 계획에 명시.

### F7. SR-7·SR-2 카탈로그 FE 소비 (비차단)
C3(`test-quality.md:16`)가 「형태 선택이 지면·최저가·계산을 바꾼다」만 적었다. 규격 없는 지면이 **선택 불가**가 되는지(`spec.md:49`)와 잠김 이유 문구를 단언에 포함.

### F8. 레이아웃 밀림(`spec.md:46`)은 jsdom 이 못 잰다 (체크 2)
C1 은 jsdom 컴포넌트 테스트라 높이 예약을 측정할 수 없다. 프로젝트 표준 `docs/standards/fe-visual-verification.md`(CDP 실측)대로 V 항목 하나 — 띠배너 로드 전후 CLS 또는 슬롯 높이 동일 — 를 추가.

## 요약
- SR 1~8 모두 최소 한 테스트가 있으나, 형태 불변(SR-2), 형태 필드 무시·HOUSE 규칙(SR-3), 규격 제거(SR-1), 형태 무관 과금(SR-4), 카탈로그 사본 금지(SR-6)가 빠졌다.
- 롤링 배포: FE `format` 부재 처리, `body` NULL 과 옛 엔티티, 옛 컬럼 보존 핀이 없다.
- 돈 경로(형태별 최저가·비율) 회귀 주입 계획이 없고, U4 는 두 형태 지면 픽스처가 아니면 합집합 버그를 못 문다.

VERDICT: REVISE

---

## Round 2

대상: `spec.md` 개정 2 · `planning/test-quality.md` 개정 2. 1차 판정 합본 `context/review-verdict.md`(T-F1~F8 keep). 줄 번호는 개정 2 기준.

### 1차 finding 해소 여부

| id | 상태 | 근거 |
|---|---|---|
| F1 형태 불변·기본 CARD | 해소 | 스펙이 「만들 때 정하고 바꿀 수 없다」로 바뀌었고(`spec.md:29`) I3 「수정 요청의 형태 필드 무시」(`test-quality.md:16`), I1 `creative_format` 기본 CARD(`:14`) |
| F1 시작 검사·문구 | 해소 | U3(`test-quality.md:9`), U2 문구에 키·형태(`:8`) |
| F1 HOUSE 내용 규칙 | **미해소 → R2-1** | U5(`test-quality.md:11`)에 HOUSE 케이스 없음 |
| F1 규격 제거·감사 | 해소 | U1 마지막 제거(`:7`), I7(`:20`) |
| F1 형태 무관 과금 | 해소 | I8(`:21`) |
| F1 띠배너 가시 노출 음성 | 부분 → R2-3 | C2 「띠배너 가시 노출 계측」(`:23`)에 50%·1초 미만 음성 케이스 없음 |
| F1 채움 `PAID` · 형식·2000px · 카탈로그 사본 | 해소 | C3(`:24`), C5(`:26`) |
| F2 FE `format` 부재·릴리스 순서 | 해소 | `spec.md:48,70`, C1(`test-quality.md:22`) |
| F2 `body` NULL | 해소 | NOT NULL 유지, BANNER 는 `''`(`spec.md:35,68`) |
| F2 옛 컬럼 보존 | 해소 | I1 「옛 컬럼 보존」(`test-quality.md:14`), I7 대표 규격 쓰기(`:20`) |
| F3 백필 비시드 행 | 해소 | I1 target=3 + 비시드 두 비율(`:14`) |
| F4 인덱스 사전 필터 · HOUSE 핀 | 해소(세부는 R2-2) | I4(`:17`), I5 `DecisionIntegrationSpec:88` 유지(`:18`) |
| F5 회귀 주입 · U2 경계 | 해소(세부는 R2-2) | §회귀 주입(`:31-40`), U2 경계 명확(`:8`) |
| F6 픽스처 · 핀 갱신 · id 대역 | 해소 | §데이터(`:44-46`), I2(`:15`) |
| F7 콘솔 규격 없는 지면 | 해소 | C4(`:25`) |
| F8 밀림 CDP | 해소 | V1(`:28`) |

### 새/잔여 findings

#### R2-1. HOUSE 소재의 「캠페인 형태 ↔ 내용 종류」 검사가 테스트에 없다 (체크 1·5)
- 스펙: 소재 등록·수정은 **모두** 캠페인 형태와 내용 종류가 맞는지 검사한다(`spec.md:36`). HOUSE 캠페인은 기본 CARD(`spec.md:29`)인데 HOUSE 소재는 `HouseCreativeContent`(`CreativeContent.kt:37`, `HouseCreativeService.kt:44`)다. HOUSE 면제(`spec.md:31`)는 「규격 검사 — 존재·최저가·비율」만 말하고 내용 종류 검사는 언급하지 않는다.
- 결과: 구현이 「CARD ↔ `PaidCreativeContent`」로 짝을 지으면 HOUSE 소재 등록이 전부 거절된다. U4(`test-quality.md:10`)는 캠페인 저장·재개만, U5(`:11`)는 유료 내용만 본다. 회귀 주입 「HOUSE 에도 형태 검사」(`:38`)는 U4·I5 만 무는데, I5 는 이미 시드된 HOUSE 소재의 결정만 보므로 등록 경로를 안 문다.
- 이 경로를 지금 무는 기존 테스트는 `AdminApiIntegrationSpec.kt:190-220`(BANNER 지면 `a-adm-house` 에 HOUSE 캠페인·소재 등록 → 결정에 노출)이다. 이 스펙은 `createPlacement(..., format = PlacementFormat.BANNER)`(`:192`)를 부르므로 픽스처 개편 때 **반드시 손대게 된다**.
- 수정안: ① U5 에 「CARD 기본 HOUSE 캠페인에 `HouseCreativeContent` 등록·수정 통과」 ② I5 옆에 「`AdminApiIntegrationSpec:190-220` 은 픽스처 인자만 바꾸고 단언은 유지」 ③ 회귀 주입 「HOUSE 에도 형태 검사」 행의 무는 테스트에 이 스펙을 추가.

#### R2-2. 회귀 주입이 물려면 필요한 픽스처 값이 시나리오에 없다 (체크 5)
- 「CARD 대표 최저가 사용」 주입(`test-quality.md:35`)이 I4 를 물려면 두 형태 지면에서 **eCPM 0.05~0.10 사이 BANNER 후보가 남는** 단언이 있어야 한다. I4(`:17`)는 「제외」만 적었다 — 제외 케이스만으로는 이 주입이 초록으로 남는다.
- 「두 형태 최저가 중 최솟값」 주입(`:36`)이 U7 을 물려면 **eCPM 0.05~0.10 사이 CARD 후보가 걸러지는** 케이스가 U7(`:13`)에 있어야 한다. 지금은 「형태별 최저가 필터」로만 적혀 있다.
- I4 에 스펙의 셋째 조건 「이미지가 그 규격 비율에 맞음」(`spec.md:42`)이 없다. 지금 인덱스는 지면 비율 목록 아무거나로 맞춘다(`CandidateIndexService.kt:76`) — 규격별로 바꾸지 않아도 I4 가 초록이다.
- 수정안: I4 = 「blog-post-end 에서 BANNER eCPM 0.07 남음 · CARD eCPM 0.07 제외 · 규격 없는 (지면, 형태) 제외 · 규격 비율과 다른 이미지 제외」, U7 에 같은 0.07 쌍.

#### R2-3. 작은 누락 (비차단, 한 줄씩)
- C2(`test-quality.md:23`): 띠배너 가시 노출 음성(50% 미만·1초 미만 보고 안 함) — 1차 F1 잔여.
- 새 코드가 옛 지면 컬럼을 **읽지 않는다**(`spec.md:69`)는 핀이 없다. I7(`:20`)은 쓰기만 본다. I1 또는 I7 에 「옛 컬럼 `floor_micros` 를 다른 값으로 바꿔도 검사·결정이 규격 값을 따른다」.
- SR-6 의 「고치기 모드에서 놓은 파일 취소」(`spec.md:60`)·「소재 목록 대체 텍스트 라벨」(`spec.md:58`)이 C4·C5(`:25-26`)에 없다.
- 회귀 주입표(`:31-40`)에 「검사 실패에도 전송」 행이 없다 — C5 「전송 안 함」이 무는지 확인할 행 하나.
- 명명 규칙 한 줄(1차 체크 6, `test-rules.md:17` 「구현체 이름 + `Test`」, 통합은 `*IntegrationSpec`) — 여전히 미기재.

### 체크리스트 (개정 2)

| # | 항목 | 판정 |
|---|---|---|
| 1 | SR → 테스트 | 거의 충족 — R2-1(HOUSE 소재 등록) 한 곳 |
| 2 | 층 배정 | 충족 — 인덱스 통합(I4), CDP(V1) 추가됨 |
| 3 | 목 경계 | 충족 |
| 4 | 테스트 데이터 | 충족 — R2-2 픽스처 값만 |
| 5 | 음성·경계 | 부분 — R2-2, R2-3 |
| 6 | 명명 | 미기재(비차단) |

모두 `test-quality.md` 행 추가로 끝나며 스펙 결정을 바꿀 것은 없다. R2-1 은 스펙 쪽에 「HOUSE 캠페인은 `HouseCreativeContent` 가 짝」 한 줄이 있으면 더 분명하지만, 그 판단은 도메인 차원의 몫이다.

VERDICT: REVISE

---

## Round 3

대상: `spec.md` 개정 3 · `planning/test-quality.md` 개정 3. 2차 판정 합본 `context/review-verdict.md` 「개정 2 (2차)」(test R2-1·R2-2·R2-3 keep). 줄 번호는 개정 3 기준.

### 2차 finding 해소 여부

| id | 상태 | 근거 |
|---|---|---|
| R2-1 HOUSE 소재 등록 | 해소 | 스펙이 짝을 명시(`spec.md:31`), U5 「CARD 기본 HOUSE 캠페인에 `HouseCreativeContent` 등록·수정 통과」(`test-quality.md:11`), 주입표에 `AdminApiIntegrationSpec:190-220` 추가(`:39`), 단언 유지 명시(`:48`) |
| R2-2 0.07 쌍 · 규격 비율 | 해소 | U7 0.07 쌍(`:13`), I4 0.07 쌍 + 규격 없는 조합 + 규격 비율 불일치(`:17`). 주입 「CARD 대표 최저가」는 U2 BANNER 0.05 통과·I4 BANNER 0.07 남음이, 「최솟값」은 U2 CARD 0.05 거절·U7 CARD 0.07 제외가 문다 |
| R2-3 C2 음성 | 해소 | C2(`:24`) |
| R2-3 옛 컬럼 읽지 않음 | 해소 | I7 「옛 컬럼을 다른 값으로 바꿔도 검사·결정은 규격 값」(`:20`) |
| R2-3 고치기 취소 · 대체 텍스트 라벨 | 해소 | C5(`:27`), C4(`:26`) |
| R2-3 전송 주입 행 | 해소 | `:40`, 헤더 판정 주입도 추가(`:43`) |
| R2-3 명명 | 해소 | `:47` |

개정 3 에서 새로 생긴 SR(`PaidContent`·`submit` 한 곳·행 변환 판별자·호환 창·되돌리기)은 U5·I4·I9·I7·주입표 「행 변환」(`:41`)으로 대부분 덮였다. 남은 것은 아래 셋.

### 새 findings

#### R3-1. I2 가 개정 3 과 어긋난다 — 유지해야 할 핀을 「갱신」하라고 적혀 있다 (체크 4)
- 개정 3 은 `game-list-banner` 의 `paid_allowed` 를 **V4 에서 끈 채로 둔다**(`spec.md:26`, 릴리스 ②' 에서 어드민이 켬 `spec.md:73`). 그러면 `AdsSchemaIntegrationSpec.kt:65-70` 「game-list-banner 만 유료 불가」는 V4 뒤에도 그대로 참이다.
- 그런데 I2(`test-quality.md:15`)는 1차 F6 시절(V4 가 켠다는 전제)의 문구 「새 시드로 **의도적으로 갱신**」을 남겼다. 구현자가 이 행을 따르면 V4 가 유료를 켜지 않는다는 것을 무는 유일한 핀을 바꾸거나 지우게 된다 — ② 확인 전에 띠배너 유료가 열리는 회귀를 막는 것이 이 핀이다.
- 수정안: I2 를 「`AdsSchemaIntegrationSpec:65-70` 은 **고치지 않고 유지** — V4 가 `paid_allowed` 를 건드리지 않음을 문다」로 바꾸고(I5 와 같은 형식), 회귀 주입표에 「V4 가 game-list-banner `paid_allowed` 를 켬 → I1·I2」 한 행.

#### R3-2. ①~② 호환 창의 **카탈로그** 옛 필드가 테스트에 없다 (체크 1)
- 스펙은 카탈로그·어드민 지면 응답 **둘 다** 옛 필드 `format`·`aspectRatios`·`floorMicros` 를 싣는다고 한다(`spec.md:74`). I7(`test-quality.md:20`)은 어드민 응답만, I6(`:19`)은 새 규격 목록·업로드 규칙만 본다.
- 옛 콘솔 번들은 카탈로그의 `floorMicros` 로 최저가 경고와 표시를 만든다(`portal-fe/src/api/adsConsoleApi.ts:103-104`, `CampaignEditor.tsx:223-227`, `:595`). 이 필드가 빠지면 ① 뒤 ② 전 창에서 옛 콘솔의 최저가가 `undefined` → 경고가 꺼지고 「최저 CPM」 칸이 깨진다. 지금 계획으로는 초록이다.
- 수정안: I6 에 「카탈로그에 옛 필드가 대표 규격 값으로 함께 있다(두 형태 지면 = CARD 값, game-list-banner = BANNER 값)」.

#### R3-3. 되돌리기 SQL 이 검증 항목에 없다 (체크 1, 비차단)
- ① 되돌리기는 BANNER 소재를 ARCHIVED 로 돌리며 같은 SQL 에서 `body = title` 로 채운다(`spec.md:75`). 이 SQL 이 틀리면(예: HOUSE 까지 건드리거나 `body` 를 안 채움) 옛 코드의 소재 목록이 빈 설명으로 거절한다고 스펙 스스로 적었다 — 롤백 순간에야 드러난다.
- 수정안: I1 컨테이너에 V4 + BANNER 소재 한 건을 넣고 되돌리기 SQL 을 실행해 「BANNER 소재 ARCHIVED · `body <> ''` · CARD·HOUSE 행 불변」을 단언하는 한 행(또는 `ads/CLAUDE.md` 되돌리기 절에 붙는 드라이런 V 항목). SQL 을 문서에만 두면 검사가 SQL 의 사본을 갖게 되므로 테스트가 문서의 SQL 파일을 그대로 읽는 형태가 낫다.

(참고, 판정 무관) 시나리오 id 가 I7 → I9 → I8 순이다(`test-quality.md:20-22`).

### 체크리스트 (개정 3)

| # | 항목 | 판정 |
|---|---|---|
| 1 | SR → 테스트 | 거의 충족 — R3-2(카탈로그 호환 필드), R3-3(되돌리기 SQL) |
| 2 | 층 배정 | 충족 |
| 3 | 목 경계 | 충족 |
| 4 | 테스트 데이터 | 부분 — R3-1(I2 가 유지할 핀을 갱신하라고 함) |
| 5 | 음성·경계 | 충족 — 0.07 쌍·두 형태 지면·폭탄·음성 가시 노출 |
| 6 | 명명 | 충족 |

세 건 모두 `test-quality.md` 한 줄 수정으로 끝나고 스펙 결정은 건드리지 않는다. 차단할 것은 없다.

VERDICT: REVISE
