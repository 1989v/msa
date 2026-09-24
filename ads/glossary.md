# Ads — 유비쿼터스 언어

> BC: ads · 관련 ADR: ADR-0098 · 매핑: `docs/context-map.md` · 원천: `docs/specs/2026-09-23-ad-network/planning/requirements.md` Ontology

| 용어 | 유형 | 정의 | 피해야 할 표현 | 코드 |
|---|---|---|---|---|
| 광고주 (Advertiser) | Aggregate | 광고를 싣는 쪽. 종류 `MEMBER`(회원 1명당 1행, 지갑 원장 계정 1개) · `SYSTEM`(「1989v 하우스」 하나, 회원·지갑 없음). 상태 `ACTIVE` ⇄ `SUSPENDED`(어드민만). 권한은 전역 Role 이 아니라 이 행이 갖는다 | 「광고주 계정」(원장 계정과 혼동), 「셀러」(auth 의 ROLE_SELLER 와 다른 축) | `domain/advertiser/model/Advertiser.kt` |
| 캠페인 (Campaign) | Aggregate | 입찰 방식·입찰가·일예산·총예산·기간·빈도 제한·타기팅 지면·문맥 카테고리를 묶는 단위. 상태 `DRAFT` → `ACTIVE` ⇄ `PAUSED` → `ENDED`(되돌리지 않음) | 「광고그룹」·「라인아이템」(단일 레벨이라 없다) | `domain/campaign/model/Campaign.kt` |
| 우선순위 (PAID / HOUSE) | VO (파생) | **저장하지 않는다.** 소유 광고주가 `SYSTEM` 이면 HOUSE, 아니면 PAID | 「우선순위 설정」(광고주가 고를 수 없다) | `CampaignPriority.kt` |
| 게재 자격 | 개념 (파생) | 「기간 밖」·「예산 소진」은 상태가 아니라 이 판정에서 나온다. 예산 소진 기준은 **청구 누계 + 미정산 지출** | 「종료됨」(상태 `ENDED` 와 혼동) | `Campaign` |
| 입찰 (Bid) | VO | 방식 `CPM`(노출 천 회당) · `CPC`(클릭당) + 금액. 1회 과금액 계산의 입력 | 「단가」(과금액과 혼동) | `domain/campaign/model/Bid.kt` |
| 소재 (Creative) | Entity | 실제 보이는 광고. PAID 는 제목·문구·랜딩 URL·이미지 1장, HOUSE 는 제목·문구·이모지·링크(이미지 선택). 심사 `PENDING` → `APPROVED` \| `REJECTED`(사유 코드 필수), 삭제는 `ARCHIVED`, `revise()` 는 내용 교체와 `PENDING` 복귀를 함께 한다 | 「크리에이티브」, 「배너」(형식 하나일 뿐) | `domain/creative/model/Creative.kt` |
| 지면 (AdPlacement) | Aggregate | 페이지 안의 광고 자리. 키(kebab)·호스트·형식·최저가·활성·`paid_allowed`. `paid_allowed=false` 면 HOUSE 전용 | 「슬롯」, 「구좌」, 「Placement」 단독(common `Placement` 와 다른 개념) | `domain/placement/model/AdPlacement.kt` |
| 최저가 (floor) | VO | 지면이 받는 최소 eCPM(노출 천 회 기준). 결정 때 eCPM ≥ 최저가로 거른다 — CPC 입찰은 저장 때 비교하지 않는다(단위가 다르다) | 「최소 입찰가」 | `AdPlacement` |
| 문맥 카테고리 (ContextCategory) | Supporting | ads 가 소유한 고정 분류 목록. 지면 문맥 키 → 카테고리 매핑으로 타기팅한다. 행태 타기팅은 없다 | 「관심사」(행태 타기팅으로 읽힌다) | `domain/category/model/ContextCategory.kt` |
| 결정 (decision) | 개념 | 한 페이지의 지면들에 광고를 고르는 요청 1회. 자격 필터 → eCPM 상위 → 1차 경매·페이싱 → 토큰 발급. 결정 id 로 결정→토큰→이벤트→정산을 잇는다 | 「입찰 요청」(RTB 가 아니다) | `domain/decision/policy/Auction.kt` |
| 노출 토큰 / 클릭 토큰 | VO | 결정이 발급하는 서명 토큰(HMAC-SHA256, 키 id). 종류별로 한 번만 수락된다. 캠페인 소유자 본인이 받은 토큰은 과금 안 함으로 서명된다 | 「광고 id」, 「트래킹 코드」 | `domain/token/model/ServeClaims.kt` · `policy/ServeTokenSigner.kt` |
| 채움 출처 (FillSource) | VO | 지면이 최종적으로 무엇으로 채워졌는지 — `PAID` · `ADSENSE` · `HOUSE` · `EMPTY`. FE 가 보고하는 참고치, 과금과 무관 | 「노출 결과」 | `domain/placement/model/FillSource.kt` |
| 지출 | 개념 | Redis 카운터가 센 게재 금액(수락한 이벤트 × 1회 과금액). 아직 원장에 없다 | 「청구액」과 섞어 쓰기 | 시간별 집계 |
| 청구액 | 개념 | 정산이 원장에 반영한 금액. 예산을 넘친 지출은 청구되지 않아 지출과 다를 수 있다 | 「지출」과 섞어 쓰기, 「매출」 | 원장 `SETTLEMENT` |
| 크레딧 | 단위 | 가상 금액. **정수 마이크로 크레딧**(1 크레딧 = 1,000,000)으로 저장. 실결제·환불·지급 없음 | `Money`(product·order 의 실통화 개념과 다르다), 「원」·「포인트」 | `*Micros` 필드 |
| 원장 계정 (LedgerAccount) | Entity | 복식부기 계정. 종류 `ADVERTISER_WALLET`(광고주별) · `NETWORK_REVENUE` · `PUBLISHER_PAYABLE` · `TOPUP_SOURCE`(나머지 셋은 전체에 하나). 지갑은 음수가 되지 않는다. 퍼블리셔는 원장 계정으로만 존재한다 | 단독 「계정」(회원 계정·광고주와 혼동) | `domain/ledger/model/LedgerAccountType.kt` |
| 원장 거래 (LedgerTransaction) | Aggregate | 분개 묶음. 종류 `TOPUP` · `SETTLEMENT` · `REVERSAL`(SETTLEMENT 전액만). 분개 합이 0 이 아니면 팩토리가 만들지 않는다. 멱등 키로 한 번만 | 「결제」, 「트랜잭션」 단독(DB 트랜잭션과 혼동) | `domain/ledger/model/LedgerTransaction.kt` |
| 분개 (LedgerEntry) | VO | 거래 안의 계정별 증감 한 줄 | 「로그」 | `domain/ledger/model/LedgerEntry.kt` |
| 셀프 충전 | 개념 | 광고주가 크레딧을 스스로 넣는 `TOPUP`. 1회 상한·KST 하루 한도를 지갑 행 잠금 안에서 확인 | 「결제」, 「구매」 | `application/ledger` |
| 정산 | 개념 | 닫힌 시각의 지출을 원장 `SETTLEMENT` 로 옮기는 5분 작업. 퍼블리셔 몫은 내림, 나머지는 네트워크 수수료 | 「집계」(집계는 그 앞 단계) | `domain/ledger/policy/SettlementCalculator.kt` · `RevenueSplit.kt` |
| 시간별 집계 | Supporting | Redis 카운터를 시각 단위로 MySQL 에 절대값 UPSERT 한 두 표 — 소재×지면(노출·클릭·지출) · 지면(요청·유료 채움·채움 출처). 정산·리포트의 원천 | 「통계 로그」 | `infrastructure/persistence/stats` |

## Cross-Context 주의

- **Placement** — common `Placement` 는 추천·검색의 노출 위치다. ads 의 광고 자리는 **지면(`AdPlacement`)** 으로만 부른다.
- **Money** — product·order 의 `Money` 는 실통화다. 크레딧은 가상 단위라 `Money` 로 감싸지 않는다.
- **Member** — `ad_advertiser.member_id` 는 member BC 회원을 가리키는 FK-as-ID. ads 는 auth·member 에 쓰지 않는다(쓰기 포트 없음).
- **analytics 원장** — ads 가 보내는 `analytics.event.collected`(`entity_type=AD`)는 사본이다. 과금의 진실은 ads 카운터와 원장이다.
- **game ads** — ADR-0059 §3 의 HOUSE 배너는 ads 로 흡수된다. game 의 `AdPlacement` 와 이름이 같지만 다음 릴리스에서 game 쪽이 지워진다.
