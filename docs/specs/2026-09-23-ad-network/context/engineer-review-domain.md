# Engineer Review — Domain (광고 네트워크)

- 대상: `docs/specs/2026-09-23-ad-network/spec.md` (+ `planning/requirements.md` · `planning/test-quality.md` · `context/concepts.md` · `context/open-questions.yml` · `docs/adr/ADR-0098-ad-network.md`)
- 차원: domain (체크리스트 `hns/0.16.1/skills/spec-review/reviewers/domain/checklist.md`, `references/language-reference.md`)
- 리뷰일: 2026-09-23
- KB: `kb-search.sh` 는 이 세션에 셸 도구가 없어 돌리지 못했다. 대신 `HNS_KB_PATH`(1989v 볼트)를 Grep 으로 직접 찾았다. 결정 키워드(복식부기·eCPM·페이싱·1차가)에 해당하는 concept 페이지는 없고, 식별자 쪽으로 [[anonymous-identity-headers]](vault, updated 2026-09-20) 가 걸렸다.

## Seed Discovery

1. 스펙과 같은 폴더의 planning·context 파일 전부
2. 프로젝트 표준: `docs/context-map.md` · 각 BC `glossary.md`(Avoid 줄 전수) · `docs/conventions/entity-mutation.md` · `docs/conventions/jpa-persistence.md`
3. 코드 근거: `game/domain/.../ads/model/*` · `common/.../analytics/{AnalyticsEvent,Placement,EntityType,EventAction}.kt` · `gateway/.../VisitorIdFilter.kt` · `portal-fe/src/analytics/identity.ts` · `portal-fe/src/seo/copy.mjs` · `gamedb/migration/V6__ads_house.sql`

## 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | BC 경계가 분명하고 새지 않는가 | △ | 경계 자체는 좋다. 과금은 ads 가 소유하고 analytics 를 읽지 않으며(ADR-0098:47-53), 폴드 이웃의 빈을 주입하지 않는다(spec SR-1:24). 다만 「문맥 카테고리」 어휘의 소유자가 없다 → D13 |
| 2 | 사전이 있는가 | ✗ | `docs/context-map.md:18-33` 에 ads 행이 없고 `ads/glossary.md` 도 없다. 신규 BC 이므로 계획(SR-16:120)은 있다 → D1 |
| 3 | 스펙 어휘가 사전과 맞는가 | ✗ | 신조어 다수(Advertiser·Campaign·Creative·Placement·DeliveryHourly·Ledger*)가 사전에 없다 → D1 |
| 4 | `Avoid:` 동의어를 쓰는가 | ✓ | 전 BC 의 Avoid 줄을 대조했다. member 의 `Account`(member/glossary.md:27)와 order 의 `Transaction`(order/glossary.md:26)은 BC 범위의 Avoid 라 위반이 아니다. 혼동 위험은 D1 에 적었다 |
| 5 | 기존 코드베이스와 어휘가 일관적인가 | ✗ | Placement/지면 충돌(D2), 지면 키 형식 혼재(D3), 방문자 ID 이중 의미(D4), 클릭 토큰 미정의(D11), 지출 대 청구액(D9) |
| 6 | 애그리거트 불변식이 명시되고 강제 가능한가 | △ | 원장은 잘 돼 있다. 「합이 0 이 아니면 만들 수 없다」(SR-9:82, ADR-0098:81-82)가 그렇다. 반면 경계를 넘는 불변식(D5), HOUSE 예외(D6), 상태 전이(D7), 지갑 잔액(D8)은 비어 있다 |
| 7 | 도메인 이벤트 범위 | ✓(주의) | 도메인 이벤트는 없고, 승인·정지는 인덱스 갱신(≤1분, SR-12:100)으로 전파된다. 정지가 캠페인을 직접 바꾸지 않고 자격에서 파생되는 점(SR-5:49)이 좋다. 다만 통합 이벤트가 공유 커널 enum 을 바꿔야 한다는 점이 빠져 있다 → D12 |
| 8 | 애그리거트 간 직접 참조가 없는가 | ✓ | Advertiser→member 는 ID 로만 참조하고(SR-2:28), Campaign→Placement 는 키 집합이다. `jpa-persistence.md:16-18` 규칙에 맞는다 |
| 9 | VO 와 Entity 분류 | △ | 금액·토큰·지면 키는 VO 가 맞다. Wallet 과 LedgerAccount 의 관계가 모호하다(D8). DeliveryHourly 가 애그리거트가 아니라 투영이라는 표시가 없다(D1) |

## Findings (전부 REVISE, 비차단)

### D1 — 사전 부재와 신조어 (체크 #2·#3·#9)
- 근거: `docs/context-map.md:18-33` 에 ads 가 없다. spec `SR-16:120` 은 `ads/glossary.md` 를 산출물로만 적어 두었다. `requirements.md:122-135` Ontology 는 후보뿐이다
- 같은 개념을 스펙 안에서 두 이름으로 부른다. `SR-13:105` 는 「HOUSE **크리에이티브**」, `SR-3:36` 은 「**소재**」다. `concepts.md:50` 은 지면·광고 단위·구좌를 같은 뜻으로 나열한다
- 수정안: 스펙이 확정되면 `/hns:glossary` 로 `ads/glossary.md` 를 만들고 `context-map.md` 에 한 줄 더한다. Avoid 는 다음처럼 정한다
  - 지면 — Avoid: 슬롯(`AdSlot`·game `AdPlacement` 주석 「광고 슬롯」), 구좌, 광고 단위
  - 소재 — Avoid: 크리에이티브. SR-13:105 도 「소재」로 고친다
  - 원장 계정(LedgerAccount) — 「계정」만 단독으로 쓰지 않는다. member 의 `Account` Avoid, 폴드 호스트 `account` 와 섞이기 때문이다
  - 크레딧 금액 — VO 로 두고 Avoid: Money. product/order 의 `Money` 는 이미 정의 충돌이 플래그돼 있다(product/glossary.md:45, :139). 원화 금액과 다른 단위라 섞으면 안 된다
  - DeliveryHourly — Type: 투영(Read model). 애그리거트가 아니다

### D2 — 「Placement / 지면」 이 코드베이스에서 이미 다른 뜻이다 (체크 #5)
- 스펙: `SR-4:42` 에서 Placement 는 등록부 행(키·호스트·형식·최저가)이다
- 코드: `common/.../analytics/Placement.kt:3-9` 의 `Placement` 는 **노출 위치**다(screenType·screenRef·sectionId·index). ADR-0095 도 「지면별 CTR」(ADR-0095:70, :145)을 화면·섹션 뜻으로 쓴다. game `AdPlacement.kt:4-14` 는 provider 축을 가진 슬롯이다
- 문제: `SR-14:111` 은 ads 지면을 analytics `Placement(screen_type·section_id)` 로 옮긴다고만 하고 대응 규칙이 없다. 같은 이름이 두 모양을 가지면 구현자가 키를 어느 필드에 넣을지 제각각 정한다
- 수정안: (a) ads 애그리거트 이름을 `AdPlacement` 로 두고 glossary §11 Cross-Context 에 「analytics `Placement` = 노출 위치, ads `AdPlacement` = 판매 단위」를 적는다. 한국어는 「지면」 하나를 쓰되 코드명으로 구분한다. (b) SR-14 에 대응 규칙을 한 줄 넣는다. 예: `screenType`=호스트별 화면 상수, `sectionId`=지면 키

### D3 — 지면 키 형식이 두 가지다 (체크 #5)
- 근거: `copy.mjs:1093-1110` 는 camelCase(`blogPostEnd`)이고 `V6__ads_house.sql:45` 는 kebab(`game-list-banner`)이다. game `AdPlacement.kt:17` 은 kebab 을 **강제**한다
- 문제: `SR-4:42` 는 등록부를 단일 원본으로 두고, K7(`SR-4:45`)은 키가 정확히 일치하는지로 「미등록 지면」을 판정한다. 규칙이 둘이면 표기만 다른 같은 지면이 미등록으로 잡힌다
- 수정안: SR-4 에 키 형식 하나를 정하고 초기 5개를 그 형식으로 적는다. 게임 흡수 시드(SR-13:105)와 FE `AdSlot` 키도 같은 형식으로 맞춘다

### D4 — 「방문자 ID」 가 두 값이다 (체크 #5, KB)
- 코드: `gateway/.../VisitorIdFilter.kt:24-28` 는 host-only `vid` 쿠키 값으로 `X-Visitor-Id` 헤더를 **덮어쓴다**. `portal-fe/src/analytics/identity.ts:8` 는 localStorage `kgd.visitorId` 를 따로 만들고, ADR-0095 이벤트 본문의 `visitorId`(`AnalyticsEvent.kt:25`)로 보낸다
- KB: [[anonymous-identity-headers]](vault, updated 2026-09-20)
  - `vid` 는 **host-only** 라 blog 와 game 이 서로 다른 방문자가 된다
  - 지금 game 의 광고 빈도 제한은 `X-Device-Id` 를 재사용한다(위조 가능)
  - 「어뷰징 방어가 아닌 것을 방어처럼 부르지 마라」
- 스펙: `SR-5:48`(X-Visitor-Id), `SR-3:35`(방문자당 하루 빈도), `SR-8:76`(같은 방문자 클릭 10분), `SR-14:111`(analytics 사본)
- 수정안: glossary 에 「방문자 = 게이트웨이 `vid`(호스트 단위)」로 정의하고, 이 정의에서 따라 나오는 것을 스펙에 적는다
  - 빈도 제한은 호스트 단위다
  - 무효 트래픽 규칙은 쿠키를 지우면 초기화된다
  - analytics 사본의 `visitorId` 에 어느 값을 넣을지 정한다. 두 값을 섞으면 ADR-0095 원장에서 광고 노출과 다른 노출을 이을 수 없다

### D5 — 경계를 넘는 불변식이 어디서 지켜지는지 없다 (체크 #6)
- `SR-3:38`: 「입찰가는 지면 최저가 이상일 때만 저장」. 캠페인은 지면 **집합**을 타기팅하고(SR-3:35), 최저가는 어드민이 나중에 바꾼다(SR-12:99). 저장 시점 검사만으로는 지켜지지 않는다
- `SR-3:37`: 「지면 형식이 허용하는 비율만」. 소재는 캠페인에 속하고, 캠페인은 형식이 다른 지면을 동시에 겨냥할 수 있다. 그런데 결정 자격(`SR-5:49`)에 형식 일치가 없다
- 수정안: 저장 시점 규칙을 「타기팅한 **모든** 지면의 최저가 이상」으로 적는다. 최저가가 나중에 바뀌면 결정 시점 검사(SR-5:50 「최저가 미만이면 광고 없음」)가 최종 판정한다고 명시한다. 소재 비율은 업로드 때 허용 형식 목록만 보고, `SR-5:49` 에 「소재 비율이 지면 형식과 맞음」을 더한다

### D6 — HOUSE 캠페인의 소유자와 적용 불변식이 없다 (체크 #6)
- 근거: 캠페인은 N:1 Advertiser 다(`requirements.md:126`). HOUSE 는 어드민만 만들고 과금·예산 검사가 없다(`SR-3:35`, `SR-12:101`). HOUSE 는 경매가 아니라 대체 소재로 나간다(`SR-5:54`). game 에서 HOUSE 는 우선순위가 아니라 **집행 주체**(`AdTypes.kt:7` `AdProvider.HOUSE`)였다
- 문제: HOUSE 캠페인의 광고주는 누구인가, 지갑이 있나. 입찰가·일예산 불변식(SR-3:38)은 면제인가. 심사 상태는 무엇으로 시드하나
- 수정안: 둘 중 하나로 정하고, 우선순위별로 적용되는 불변식을 표로 둔다
  - 네트워크 소유 「시스템 광고주」 1행(지갑 없음, 정산 제외)
  - HOUSE 를 광고주와 무관한 별도 모델로 분리
  - SR-13 시드는 `APPROVED` 로 넣는다고 적는다

### D7 — 캠페인·소재 상태 전이가 없다 (체크 #6)
- 근거: `SR-3:35` 는 상태 4개만 나열하고 전이 규칙과 계기가 없다. 기간이 끝나거나 총예산이 소진되면 `ENDED` 인가, 파생 자격인가. `ENDED` 에서 되살릴 수 있나. `SR-3:36` 「내용을 고치면 다시 PENDING」도 같다
- 수정안: 전이 표(허용 전이 · 계기 · 주체)를 SR-3 에 넣는다. 소재 수정은 `revise(content)` 한 메서드가 내용 변경과 PENDING 복귀를 **함께** 하게 적는다(entity-mutation.md:14-16 의 의도 드러내는 부분 수정). 그러면 복귀를 건너뛰고 내용만 바꾸는 코드를 쓸 수 없다. ADR-0098:81-82 가 원장에 적용한 「쓸 수 없게」를 소재 심사에도 쓰는 것이다

### D8 — Wallet 과 LedgerAccount 의 관계, 잔액 불변식 (체크 #6·#9)
- 근거: `requirements.md:125` 는 「Advertiser 1:1 Wallet」, `SR-9:81` 은 「계정: 광고주 지갑」, `requirements.md:132` 는 LedgerAccount(잔액 필드 없음)다. `SR-9:83` 은 잔액 갱신에서 갱신 유실이 없다고 하지만 잔액이 어디에 저장되는지 없다
- 「지갑 잔액은 음수가 되지 않는다」가 `SR-10:88` 의 min() 에서 암묵으로만 따라 나온다
- REVERSAL(`SR-8:78`)의 상대 계정이 없다. `concepts.md:130` H3 에 있는 「무효 트래픽 회수」 계정이 SR-9:81 목록에서 빠졌다
- 수정안: 「지갑 = 광고주 유형 LedgerAccount, 잔액은 그 행이 갖는다」 식으로 하나로 정한다. 음수 잔액 금지를 명시 불변식으로 적는다. REVERSAL 의 분개 짝(지갑↔퍼블리셔 미지급·수수료)을 SR-9 에 적는다

### D9 — 「지출」 과 「청구액」 이 섞인다 (체크 #5)
- 근거: `SR-7:70` 은 Redis 지출 카운터, `SR-10:88` 은 청구액 = min(집계 지출, …)이고 넘친 몫은 네트워크가 떠안는다. `SR-11:94` 광고주 리포트 「지출(정산 확정분 + 미정산 추정분)」과 `SR-11:96` 「같은 수치가 두 경로로 갈리지 않는다」, AC-13 이 이어진다
- 문제: 예산을 넘은 시간에는 DeliveryHourly 지출 > 원장 청구액이다. 리포트의 「지출」이 둘 중 어느 것인지 정하지 않으면 AC-13 을 판정할 수 없다
- 수정안: 두 용어를 정의한다 — 「집계 지출(gross)」과 「청구액(billed)」. 확정분은 청구액, 추정분은 집계 지출이라고 SR-11 에 적는다. 퍼블리셔 수익은 청구액을 나눈 값(SR-10:89)이라고도 적는다

### D10 — 퍼블리셔 리포트의 원천이 모델에 없다 (체크 #6)
- 근거: `SR-11:95` 는 지면별 **요청**·채움률을 보여 준다. `SR-4:45` 는 미등록 키별 요청 수를 쌓는다. 그런데 `SR-11:96` 은 원천을 DeliveryHourly 와 원장으로 한정하고, DeliveryHourly 는 (캠페인, 소재, 지면, 시각) 행이다(`requirements.md:131`). 광고가 안 나간 요청은 캠페인이 없어 이 표에 들어갈 수 없다
- 수정안: 지면×시각 요청·채움·사유 집계(예: PlacementHourly)를 모델에 더하고 SR-11:96 의 원천 목록에 넣는다. 미등록 지면 카운터도 여기서 나오게 한다

### D11 — 클릭 토큰이 정의되지 않았다 (체크 #5)
- 근거: `SR-5:54` 응답과 `SR-7:66` 은 **노출 토큰**만 정의한다. `SR-7:69` 는 `clickToken` 을 받고, Ontology 는 `ServeToken` 하나다(`requirements.md:130`)
- 수정안: 클릭 토큰을 어떻게 발급하는지 적는다. 결정 응답에 함께 주는지, 노출 토큰에서 파생하는지 정한다. 수명도 적는다. 클릭이 과금되려면 노출이 먼저 받아들여져야 하는지도 정한다. 용어를 「노출 토큰 / 클릭 토큰」 둘로 쓸지, `ServeToken` 하나로 쓸지도 고른다

### D12 — 공유 커널 enum 변경이 빠졌다 (체크 #7)
- 근거: `SR-14:111` 은 `entity_type=AD` 로 발행한다. 그런데 `common/.../analytics/EntityType.kt:10-19` 에 `AD` 가 없다. common 은 전 서비스가 의존하는 L3 변경이다(common/CLAUDE.md Key Rules)
- 좋은 점: `EventAction.kt:6` 이 IMPRESSION 을 「실제로 보인 것」으로 정의해, 과금 노출 = 가시 노출(SR-7:67)과 뜻이 같다
- 수정안: SR-14 와 SR-16 에 「`EntityType.AD` 추가(common)」를 적는다. SR-8:74 의 `CrawlerUserAgents` common 이동과 같은 변경 묶음으로 둔다

### D13 — 「문맥 카테고리」 어휘의 소유자 (체크 #1)
- 근거: `SR-3:35` 는 타기팅 문맥 카테고리 집합을, `SR-5:48` 은 페이지가 보내는 카테고리 키를 쓴다. 이 목록을 누가 정하는지 없다. `concepts.md:91` E5 는 「자체 분류로 시작」이라고만 한다
- 문제: blog 카테고리(3단 계층, blog BC)·game 장르·place 분류의 ID 를 ads 가 그대로 저장하면, 다른 BC 식별자에 의존하게 되어 경계가 샌다
- 수정안: ads 가 소유하는 고정 카테고리 목록(키·표시명)을 두고, 페이지 문맥을 이 키로 바꾸는 일은 FE(또는 각 페이지)가 맡는다고 SR-5 에 적는다

## 잘 된 점 (유지)
- 원장 불균형을 「검사로 잡는 대신 쓸 수 없게」 한다(SR-9:82, ADR-0098:81-82)
- 광고주 정지를 캠페인 상태 변경이 아니라 자격 파생으로 처리해, 애그리거트 사이에 쓰기가 없다(SR-5:49, AC-14)
- 과금 원천을 ads 가 소유하고 analytics 는 사본만 받는다(ADR-0098:47-56). 서비스 간 DB 공유 금지와 맞는다
- 광고주 권한을 프로필 행으로 둔다(SR-2:28). blog `BlogProfile` 선례(blog/glossary.md:7)와 같은 어휘 구조다

## 요약
BLOCK 사유는 없다. Avoid 동의어를 쓰지 않았고, 기존 사전 정의와 뜻이 충돌하는 용어도 없다. analytics `Placement` 는 사전 등재어가 아니라 코드 어휘라 D2 는 REVISE 로 판정했다. 수정은 사전 신설(D1)과 경계 불변식·용어 정의(D2~D13)이고, 대부분 스펙 문장 몇 줄로 해결된다.

VERDICT: REVISE

---

# Round 2 — 개정 2 재검토 (2026-09-23)

- 대상: `spec.md`(개정 2) · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `docs/adr/ADR-0098-ad-network.md`
- 아래 줄 번호는 전부 개정 2 기준이다. round 1 의 SR 번호는 개정 전 번호라서 현재 번호와 다르다
- 코드 재확인
  - `common/.../analytics/AnalyticsEvent.kt:24-26`: `userId`·`visitorId`·`sessionId` 가 필수 필드다
  - `common/.../analytics/Placement.kt:9-26`: 필드는 `screenType`·`sectionId`·`itemIndex` 다
  - `EntityType.kt:10`: 아직 `AD` 가 없다. 스펙이 추가 계획을 갖고 있으므로 문제는 아니다
  - `copy.mjs:1091-1110`: `ADSENSE_SLOTS` 는 camelCase 4키(`dealHubEnd` 포함)다
  - `V6__ads_house.sql:44-52`: `game-list-banner`·`game-detail-banner` 로 kebab 이다
  - `game/domain/.../AdPlacement.kt:17`: kebab 정규식이 있다

## round-1 finding 해소 확인

| # | 판정 | 개정 2 근거 |
|---|---|---|
| D1 사전·신조어 | **해소** | 스펙 본문은 해소됐다. 용어 앵커가 `spec.md:9`(지면·소재·지출·청구액)에 있고, glossary 산출물과 Avoid 목록이 `SR-16 spec.md:152`(슬롯·구좌→지면, 크리에이티브→소재, 단독 「계정」, 크레딧≠`Money`)에 있다. `SR-13 spec.md:121` 도 「HOUSE 소재」로 고쳤다. 단 동반 문서에 옛 어휘가 남았다 → N3 |
| D2 Placement 충돌 | **해소** | ads 쪽 코드명을 `AdPlacement` 로 구분했다(`spec.md:9`, `:53`). analytics 대응 규칙은 `SR-15 spec.md:144` 에 있다(`screen_type`=호스트별 화면 종류, `section_id`=`AD:{지면 키}`, `item_index`=0). `Placement.kt` 필드와도 맞다 |
| D3 지면 키 형식 | **해소** | `spec.md:53` 이 kebab 정규식을 적었다. game `AdPlacement.kt:17` 과 같은 식이다. `:54` 에 초기 키를 kebab 으로 나열했고, `:55` 에서 FE `ADSENSE_SLOTS` 도 같은 키로 맞춘다 |
| D4 방문자 ID | **부분** | 방문자는 `vid`→`X-Visitor-Id` 로 정했다(`spec.md:62`). 남은 것 둘 → N4 <br>① 이 정의에서 따라 나오는 결과(빈도 제한이 호스트 단위라는 점)가 적혀 있지 않다 <br>② analytics 사본의 `visitorId`·`sessionId` 에 무엇을 넣는지 여전히 없다 |
| D5 경계 불변식 | **해소** | 저장 불변식은 「타기팅한 모든 지면」 기준이고, 저장 뒤 최저가가 바뀐 경우는 결정 때 판정한다(`spec.md:49`). 결정 자격에 「소재 비율이 지면 형식에 맞음 · 입찰가 ≥ 그 지면 최저가」가 들어갔다(`spec.md:64`) |
| D6 HOUSE 소유자 | **해소(새 모순 발생)** | 소유자는 시스템 광고주 「1989v 하우스」다. 면제 목록과 시드 `APPROVED` 가 있다(`spec.md:120-121`). 그런데 이것이 Advertiser 불변식과 부딪힌다 → N1 |
| D7 상태 전이 | **해소** | Campaign 전이(`spec.md:45`)와 Creative 전이가 들어갔다. `revise()` 한 메서드가 내용 교체와 `PENDING` 복귀를 함께 한다(`spec.md:46`). 자동 전이의 판정 기준은 N2 로 남긴다 |
| D8 지갑·잔액 | **해소** | 잔액은 계정 행이 갖는다. 갱신은 `FOR UPDATE` 이고, 「지갑은 음수가 될 수 없다」가 명시됐다(`spec.md:107`). REVERSAL 은 원 거래 분개의 부호를 뒤집은 것이다(`spec.md:105`). 경계 사례는 N6 |
| D9 지출/청구액 | **해소** | 정의는 `spec.md:9` 에 있다. 리포트는 두 값을 따로 보이고, 미정산이면 청구액을 비우며, 두 값이 다른 날을 표시한다(`spec.md:115`). test-quality `I16`(`test-quality.md:53`)과도 맞다 |
| D10 퍼블리셔 리포트 원천 | **해소** | `AdPlacementHourly` 를 원천으로 추가했다(`spec.md:100`). 원천 목록은 「시간별 집계 두 표와 원장」이다(`spec.md:117`) |
| D11 클릭 토큰 | **해소** | 노출 토큰과 클릭 토큰을 따로 발급한다. 서명 필드, 수명 2시간, 종류별 일회성이 정해졌다(`spec.md:74-76`). 「클릭 과금에 노출 수락이 먼저 있어야 하나」만 미정이다. 비차단이라 N 항목으로 올리지 않는다 |
| D12 공유 커널 enum | **해소** | `EntityType.AD` 추가와 `CrawlerUserAgents` 이동을 common 선행 슬라이스로 묶었다(`spec.md:142`). recommendation 소비자는 AD 를 무시한다(`:143`) |
| D13 문맥 카테고리 | **해소** | 카테고리는 ads 가 고정 목록으로 소유한다. 문맥 키는 매핑 표로 바꾸고, 다른 BC 의 id 를 외래키로 저장하지 않는다(`spec.md:58`) |

## 새로 생긴 이슈 (전부 REVISE, 비차단)

### N1 — 시스템 광고주가 Advertiser 불변식 두 개와 모순된다 (체크 #6)
- 스펙끼리 부딪힌다
  - `spec.md:36`: 「Advertiser 는 **회원 1명당 1행**」
  - `spec.md:120`: 「시스템 광고주 「1989v 하우스」(**회원 없음**, 시드)」
  - `spec.md:104`: 원장 계정 「광고주 지갑(**광고주마다**)」
  - `spec.md:120` 면제 목록: 「지갑」
- 우선순위가 두 곳에 있다
  - `spec.md:44`: Campaign 이 `priority PAID·HOUSE` 필드를 갖는다
  - `spec.md:120`: HOUSE 는 시스템 광고주 소유다
  - 「HOUSE ⇔ 소유자가 시스템 광고주」를 누가 지키는지 없다. 같은 사실이 두 곳에 있어서 어긋난 행(회원 광고주의 HOUSE 캠페인, 시스템 광고주의 PAID 캠페인)을 만들 수 있다
- 모델 수준: HOUSE 소재는 형식이 다르다(`spec.md:121` 이모지·앱 안 경로 대 `:46-47` https 랜딩). 그런데 Ontology(`requirements.md:132`)에는 `Creative` 하나뿐이다
- 수정안
  - Advertiser 에 종류(`MEMBER`·`SYSTEM`)를 두고 불변식을 고친다: 「`memberId` 는 `MEMBER` 일 때 필수이고 유일하다, 지갑 원장 계정은 `MEMBER` 에게만 있다」
  - Campaign 우선순위는 저장하지 않고 소유 광고주 종류에서 파생한다. 저장해야 한다면 생성 팩토리가 둘을 함께 정하게 해, 어긋난 조합을 **만들 수 없게** 한다
  - 소재를 `PaidCreative`·`HouseCreative` 두 형식으로 적어 둔다. 공통 상위 타입으로 둘지 별도 타입으로 둘지는 구현 재량이다

### N2 — 「예산 소진」 을 지출로 재는지 청구액으로 재는지 없다 (체크 #5·#6)
- 근거
  - `spec.md:9` 는 지출과 청구액을 따로 정의했다. 그런데 예산 판정 문장은 둘 중 어느 것인지 말하지 않는다
  - 결정 자격 「일예산·총예산·지갑 여유」(`spec.md:64`)는 지갑만 산식이 있다(`:65`)
  - Campaign 자동 전이 「총예산 소진 → `ENDED`」(`spec.md:45`)도 같다
- 문제
  - Redis 지출 키는 TTL 48시간이다(`spec.md:101`). 그래서 총예산을 Redis 지출만으로는 잴 수 없고, 누적 청구(원장)와 미정산 지출을 합쳐야 한다
  - 반대로 넘친 지출은 청구되지 않는다(`spec.md:108`). 그래서 「누적 청구 = 총예산」은 늦게 오거나 끝내 오지 않을 수 있다. 어느 기준이냐에 따라 `ENDED` 가 되는 시점이 달라진다
  - `ENDED` 는 되돌릴 수 없다(`spec.md:45`). 기준 선택이 광고주에게 보이는 결과를 바꾼다
- 부수: `ENDED` 전이의 주체가 「인덱스 갱신 배치」다(`spec.md:45`). 읽기 모델을 만드는 작업이 애그리거트 상태를 바꾸는 모양이다. 기간 만료는 이미 자격에서 파생된다(`spec.md:64` 「기간 안」). 총예산도 자격 파생으로 두면 전이 주체는 광고주 종료 하나로 줄어든다
- 수정안
  - SR-6 에 기준을 적는다. 예: 「일예산 = 그 KST 날 Redis 지출」, 「총예산 = 누적 청구(인덱스 스냅샷) + 미정산 지출」
  - 자동 `ENDED` 는 빼고 자격 파생으로 둔다. 전이로 남긴다면 판정 수량을 같은 기준으로 적는다

### N3 — 동반 문서가 개정 2 어휘를 따라오지 않았다 (체크 #3)
- `requirements.md:139` 는 이 Ontology 를 `hns:glossary` 입력으로 쓴다고 적었다. 그대로 두면 옛 어휘가 사전으로 들어간다
  - `requirements.md:133`: `Placement` 에 「광고 단위 = 지면 = 구좌」로 남아 있다. 스펙이 정한 Avoid(`spec.md:152` 구좌→지면)와 이름 변경(`AdPlacement`)에 어긋난다. 수렴표 `requirements.md:145` 는 「Placement→AdPlacement 변경」이라고 적었는데 표 본문은 바뀌지 않았다
  - `requirements.md:130`: 「1:1 Wallet」이 남았다. 스펙은 지갑을 원장 계정 행으로 정했다(`spec.md:107`)
  - `requirements.md:135`: `ServeToken` 하나뿐이다. 스펙은 노출 토큰과 클릭 토큰 둘이다(`spec.md:74`)
  - `requirements.md:136`: `DeliveryHourly` 가 남았고, `AdPlacementHourly`(`spec.md:100`)·ContextCategory 매핑(`spec.md:58`)·시스템 광고주가 빠졌다
- `ADR-0098:77`: 「HOUSE **크리에이티브**는 최하위 우선순위 캠페인」이라고 쓴다. round-1 D1 이 고치라고 한 표현이고, `spec.md:152` 의 Avoid 에도 걸린다. 같은 ADR 의 §9(`:89`)는 이미 「소재」를 쓴다
- 수정안: Ontology 표를 개정 2 어휘로 갱신한다. `AdPlacement`, 노출 토큰/클릭 토큰, 시간별 집계 2종, `ContextCategory`, `Advertiser.kind` 가 들어가야 하고, Wallet 은 원장 계정으로 흡수한다. 투영(read model) 표시도 붙인다. `ADR-0098:77` 은 「소재」로 고친다

### N4 — analytics 사본의 신원 필드가 비어 있다 (체크 #5, round-1 D4 잔여)
- 근거: `AnalyticsEvent.kt:24-26` 에서 `visitorId`·`sessionId` 는 null 이 될 수 없는 필드다. `SR-15 spec.md:144` 는 entity·action·view·placement 만 정하고 이 둘을 정하지 않는다
- 문제
  - 서버는 `vid` 만 안다. FE 원장은 `kgd.visitorId`(`identity.ts:8`)와 FE 세션을 쓴다
  - 어느 값을 넣느냐에 따라 광고 노출이 ADR-0095 원장의 다른 노출과 이어지는지가 갈린다
  - `sessionId` 는 서버가 알 수 없는 값이다
- 수정안: SR-15 에 한 줄 적는다. 예: 「`visitorId`=`vid` 해시, `sessionId`=결정 id, `userId`=null — FE 원장과는 조인하지 않는다」. 다른 방법은 결정 요청에 FE 의 `visitorId`·`sessionId` 를 실어 토큰에 서명해 넣는 것이다. 어느 쪽이든 SR-6 에 「빈도 제한은 호스트 단위」를 함께 적는다(`vid` 는 host-only, 볼트 [[anonymous-identity-headers]])

### N5 — 스펙이 자기가 정한 Avoid 를 쓴다 (체크 #4, 경미)
- 근거: `spec.md:152` 는 단독 「계정」을 Avoid 로 정했다. 그런데 `spec.md:104` 는 「- 계정: 광고주 지갑…」, `spec.md:107` 은 「잔액은 계정 행이 갖고… 계정 행을 id 순으로」라고 쓴다
- 판정: 사전(`ads/glossary.md`)이 아직 없으므로 체크리스트의 BLOCK 규칙(「Avoid 동의어 사용」)은 적용하지 않는다. 사전이 생기면 바로 위반이 되므로 지금 고친다
- 수정안: 세 곳을 「원장 계정」으로 바꾼다

### N6 — REVERSAL 과 「지갑 음수 불가」의 경계 (체크 #6, 경미)
- 근거: REVERSAL 은 원 거래 분개의 부호만 뒤집는다(`spec.md:105`). 지갑은 음수가 될 수 없다(`spec.md:107`)
- 문제
  - `TOPUP` 을 역분개할 때 이미 쓴 잔액이 있으면 불변식이 거래를 막는다
  - 「부호만 뒤집어 그대로」는 전액 역분개만 표현한다. 무효 트래픽 회수(`spec.md:95`)는 보통 일부만 되돌린다
  - 운영 도구는 2단계라 지금 막히는 것은 없다. 다만 원장 팩토리의 계약이 지금 정해진다
- 수정안: 두 가지 중 하나를 적는다. 「REVERSAL 은 `SETTLEMENT` 에만 쓴다(`TOPUP` 은 대상 아님)」, 또는 「음수가 되는 역분개는 거절한다」. 부분 회수는 2단계에서 별도 유형으로 둔다고 한 줄 남긴다

### N7 — 등록하지 않은 지면과 FE 키 (체크 #5, 경미)
- 근거
  - `spec.md:54` 는 `deal-hub-end` 를 등록하지 않는다
  - `spec.md:55` 는 FE `ADSENSE_SLOTS` 키를 등록부 키에 맞춘다. 지금 `copy.mjs:1110` 에 `dealHubEnd` 가 있다
  - `spec.md:57` 은 등록부에 없는 키로 온 요청을 「미등록 지면」으로 센다
- 문제: FE `AdSlot` 이 deal 허브에서 결정 API 를 부르면 의도적으로 뺀 지면이 운영자 화면(`spec.md:16`)에 계속 「미등록」으로 잡힌다. 「누락된 지면」과 「일부러 막은 지면」이 한 카운터에 섞인다
- 수정안: 두 가지 중 하나를 고른다. `deal-hub-end` 를 등록부에 `활성=false`(`spec.md:53` 의 활성 필드)로 두고 「비활성 → 광고 없음, 미등록 카운트 제외」로 한다. 또는 등록부에 없는 AdSense 전용 자리는 FE 가 결정 호출에 넣지 않는다고 SR-14 에 적는다

## 체크리스트 재판정 (round 2)

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | BC 경계 | ✓ | 카테고리를 ads 가 소유한다(`spec.md:58`). 폴드 이웃 빈을 주입하지 않는다(`:25`). 과금 원천은 ads 에 있다(ADR-0098:47-53) |
| 2 | 사전 | △ | 신규 BC 라 아직 없다. 산출물과 Avoid 가 `spec.md:152` 에 계획돼 있다. `/hns:glossary` 입력(Ontology)이 낡았다 → N3 |
| 3 | 스펙 어휘 = 사전 | △ | 스펙 본문은 정리됐다. 동반 문서가 따라오지 않았다 → N3 |
| 4 | Avoid 미사용 | △ | 단독 「계정」(N5). 사전이 없어 BLOCK 은 아니다 |
| 5 | 코드와 어휘 일관 | △ | D2·D3·D11 은 해소됐다. analytics 사본의 신원 필드(N4)와 비활성 지면(N7)이 남았다 |
| 6 | 불변식 명시·강제 가능 | △ | 원장·소재 수정·경계 불변식은 좋다. 남은 것은 시스템 광고주(N1), 예산 기준(N2), REVERSAL 경계(N6)다 |
| 7 | 이벤트 범위 | ✓ | 공유 커널 변경이 선행 슬라이스로 묶였다(`spec.md:142`) |
| 8 | 직접 참조 없음 | ✓ | 다른 BC 는 id·키로만 참조한다. 카테고리도 다른 BC 의 id 를 외래키로 두지 않는다(`spec.md:58`) |
| 9 | VO·Entity 분류 | △ | 지갑은 원장 계정으로 정리됐다(`spec.md:107`). 소재 두 형식(N1)과 시간별 집계가 투영이라는 표시(N3)가 남았다 |

## 요약 (round 2)
round-1 13건 중 12건이 해소됐고, D4 만 일부 남았다(N4). BLOCK 사유는 없다. 사전이 없어 Avoid BLOCK 규칙이 적용되지 않고, 기존 사전 정의와 뜻이 부딪히는 용어도 없다. 개정 과정에서 새 모순 두 건이 생겼다. 시스템 광고주가 「회원 1명당 1행」·「광고주마다 지갑」과 부딪히고(N1), 예산 소진의 판정 수량이 없다(N2). 둘 다 스펙 문장 두세 줄로 풀린다. N3 은 `/hns:glossary` 입력이라 사전을 만들기 전에 고쳐야 한다. N5~N7 은 경미하다.

VERDICT: REVISE

---

# Round 3 — 개정 3 최종 재검토 (2026-09-23)

- 대상: `spec.md`(개정 3) · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `docs/adr/ADR-0098-ad-network.md`
- 줄 번호는 전부 개정 3 기준이다
- 마지막 라운드다. 기준은 「태스크를 만들며 고칠 수 있는가」다. 고칠 수 있는 것은 이월 항목으로 적는다

## round-2 finding 해소 확인

| # | 판정 | 개정 3 근거 |
|---|---|---|
| N1 시스템 광고주 | **해소** | Advertiser 종류가 `MEMBER`·`SYSTEM` 둘이다. `SYSTEM` 은 회원도 지갑도 없다(`spec.md:37`). 우선순위는 저장하지 않고 광고주 종류에서 파생한다(`:45`). 지갑 원장 계정은 `MEMBER` 에게만 있다(`:112`). HOUSE 소재 형식은 따로 정했다(`:129`, `requirements.md:132`). 어긋난 조합을 만들 수 없는 구조가 됐다 |
| N2 예산 판정 기준 | **해소** | 판정 기준은 「청구 누계 + 미정산 지출」이다(`spec.md:47`, `:67`). 「기간 밖」과 「예산 소진」은 상태가 아니라 게재 자격에서 파생한다. 전이 주체는 광고주 종료 하나다(`:46`). 인덱스 배치가 애그리거트 상태를 바꾸는 모양이 사라졌다 |
| N3 동반 문서 어휘 | **해소** | Ontology 에 `kind`·`AdPlacement`·`ContextCategory`·노출/클릭 토큰·시간별 집계 2종이 들어갔다. 지갑은 원장 계정으로 흡수됐다(`requirements.md:130-137`). ADR 은 「HOUSE 소재는 시스템 광고주의 캠페인」으로 고쳤다(`ADR-0098:77`). 옛 어휘(구좌·크리에이티브·ServeToken·DeliveryHourly)는 Grep 결과 0건이다 |
| N4 analytics 신원 | **해소** | 사본의 `visitorId`·`sessionId` 는 이벤트 요청에 실린 analytics 신원을 쓴다(`spec.md:151`). 이 신원은 `identity.ts` 에서 오고, 과금 근거가 아니라고 적혀 있다(`:96`). 빈도 제한이 호스트 단위라는 것도 명시하고 받아들였다(`:65`) |
| N5 단독 「계정」 | **해소** | 원장 쪽 용어는 모두 「원장 계정」으로 바뀌었다(`spec.md:39`, `:40`, `:112`, `:115`). 「계정」이 단독으로 남은 곳은 `:32`·`:194` 두 곳이다. 둘 다 MySQL 사용자 계정(`ads_user`)을 가리키므로 Avoid 대상이 아니다 |
| N6 REVERSAL 경계 | **해소** | REVERSAL 은 `SETTLEMENT` 전액 역분개에만 쓴다. 이 경우 지갑은 늘기만 하므로 음수 불가 규칙과 부딪히지 않는다. 부분 역분개와 충전 역분개는 2단계로 미뤘다(`spec.md:113`, Out of Scope `:190`) |
| N7 비활성 지면 | **해소** | `deal-hub-end` 는 비활성 행으로 둔다. 결정은 사유 `placement_inactive` 로 답하고, 이 요청은 미등록 목록에 섞이지 않는다(`spec.md:57`, `:73`) |

## 새 이슈 — 차단 없음, 전부 태스크 작성 때 반영할 이월 항목

### C1 — 「HOUSE 전용」 지면 속성이 모델에 없다 (체크 #6)
- 근거
  - `spec.md:57` 은 `game-list-banner` 를 「HOUSE 전용」으로 둔다
  - 그런데 AdPlacement 필드(`spec.md:56`, `requirements.md:133`)는 키·호스트·형식·최저가·활성·설명뿐이다
  - PAID 캠페인이 최저가만 넘으면 이 지면을 타기팅할 수 있다. 저장 불변식(`:51`)과 후보 자격(`:67`)에 이를 막는 조항이 없다
- 이월 안: AdPlacement 에 「유료 허용」 여부를 두는 속성을 더한다. 저장 불변식과 후보 자격에 「PAID 캠페인은 유료 허용 지면만」을 넣고, 광고주 카탈로그(`:62`)에서도 뺀다

### C2 — 수락 스크립트가 총예산을 무엇으로 재는지 없다 (체크 #6)
- 근거
  - 수락 스크립트는 Redis 한 번 호출로 총예산을 확인한다(`spec.md:97`)
  - 판정 기준은 「청구 누계 + 미정산 지출」이다(`:47`). 그런데 청구 누계는 MySQL 원장에 있고, Redis 지출 키는 TTL 이 48시간이다(`:109`)
  - Redis 에 있는 값만으로는 이 합을 만들 수 없다
- 이월 안: 이벤트 처리기가 파드 메모리 인덱스 스냅샷에서 캠페인의 청구 누계와 정산 완료 시각을 읽어 스크립트 인자로 넘긴다고 적는다. 결정 경로의 지갑 여유 산식(`:68`)과 같은 모양이다

### C3 — HOUSE 캠페인의 입찰 필드 값이 없다 (체크 #6)
- 근거
  - Campaign 필드에는 입찰 방식·입찰가·일예산이 있고 저장 불변식이 걸려 있다(`spec.md:45`, `:51`)
  - HOUSE 는 예산·최저가 규칙에서 면제된다(`:128`)
  - HOUSE 캠페인에서 이 필드들이 null 인지, 고정값인지, 불변식을 건너뛰는지는 적혀 있지 않다
- 이월 안: `SYSTEM` 광고주용 생성 팩토리를 따로 두고, 입찰·예산 필드는 비운 채(nullable) 불변식 검사 없이 만든다고 태스크에 적는다. PAID 팩토리는 이 필드들을 필수로 둔다. 필드를 잘못 조합한 캠페인은 만들 수 없게 된다

## 체크리스트 재판정 (round 3)

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | BC 경계 | ✓ | 문맥 카테고리를 ads 가 소유한다(`spec.md:61`). 다른 BC 의 id 를 외래키로 두지 않는다 |
| 2 | 사전 | ✓(계획) | 신규 BC 라 아직 없다. 산출물은 `spec.md:160` 에, 입력 Ontology 는 `requirements.md:130-137` 에 있고 둘 다 최신이다 |
| 3 | 스펙 어휘 = 사전 | ✓ | 스펙·Ontology·ADR 의 어휘가 일치한다 |
| 4 | Avoid 미사용 | ✓ | 단독 「계정」은 DB 사용자 계정만 가리킨다(N5 참고) |
| 5 | 코드와 어휘 일관 | ✓ | 지면 키는 kebab 이고, analytics 쪽은 `Placement` 로 대응시킨다(`:151`). 신원 필드도 정했다 |
| 6 | 불변식 명시·강제 가능 | △ | 이월 C1~C3 |
| 7 | 이벤트 범위 | ✓ | common 슬라이스를 먼저 배포한다(`:149`) |
| 8 | 직접 참조 없음 | ✓ | 다른 애그리거트와 BC 는 id·키로만 참조한다 |
| 9 | VO·Entity 분류 | ✓ | 시간별 집계는 「정산·리포트 원천」인 supporting 이다(`requirements.md:136`). 투영이라는 표시는 glossary 를 만들 때 붙인다 |

## 요약 (round 3)
round-2 의 7건(N1~N7)이 모두 해소됐다. 새로 나온 3건(C1~C3)은 모두 불변식을 어디서 지키는지의 문제다. 각각 필드 하나, 인자 하나, 팩토리 하나로 풀리고 스펙의 결정을 뒤집지 않는다. 그래서 태스크를 만들 때 반영하는 이월 항목으로 둔다.

VERDICT: SHIP
