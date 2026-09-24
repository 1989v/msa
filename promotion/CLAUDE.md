# Promotion Service

혜택 — 쿠폰 정의·발급, 포인트 원장, 주문별 혜택 보류(TCC). `commerce:app` 에 폴드된 라이브러리 (ADR-0099).
주문 사가·클레임이 `promotion.command.*` 로 명령하고 `promotion.hold.*` 로 답을 받는다. order 읽기 모델은
`promotion.coupon.*`·`promotion.point.changed` 로 주문서 견적에 쓸 쿠폰 조건·상태·잔액을 따라간다.

## Modules

| Gradle path | 역할 |
|---|---|
| `:promotion:domain` | Pure Kotlin 도메인 — `CouponDefinition`(할인 계산) · `UserCoupon` · `PointBalance`(원장 줄과 함께만 변경) · `PromotionHold`(TCC 상태 머신) |
| `:promotion:feature` | 비-bootable 라이브러리 — 전용 datasource `promotion_db` (`promotionEntityManagerFactory` / `promotionTransactionManager`, Hikari 최대 3), Flyway `promotiondb/migration` + `ScopedFlywayMigrator`, EMF `validate` |

## Commands

```bash
./gradlew :promotion:domain:test                                   # 정률 내림·최대 할인·최소 주문·기간 경계 · 쿠폰 1회 · 잔액 음수 불가 · 보류 만료 경계
./gradlew :promotion:feature:test                                  # TCC 서비스(저장소 메모리) · 컨슈머(만료 확정 = 예외 없음) · 컨트롤러 권한
./gradlew :commerce:app:test --tests '*PromotionIntegration*'      # 실제 MySQL: 발행 상한 동시 100 · 같은 회원 동시 10 · CHECK · 보류 멱등 · 만료
./gradlew :commerce:app:test --tests '*CommerceContextLoad*'       # promotion_db 쓰기·읽기 + 아웃박스 키
```

## 구조 상태 (ADR-0083)

`inventory/feature` 견본을 따른다. 비-@Primary 도메인이라 **모든 `@Transactional` 이 `promotionTransactionManager` 를 한정자로 갖는다**.
외부 IO 가 없어 명령 하나 = promotion_db 트랜잭션 하나(쿠폰·포인트·보류·아웃박스 행이 함께 커밋).

- `application/coupon` — 정의 만들기·목록(`ManageCouponDefinition`) · 받기(`ClaimCoupon`) · 내 쿠폰(`GetMyCoupons`)
- `application/point` — 지급(`GrantPoints`) · 내 포인트(`GetMyPoints`) · `PointLedgerRecorder`(잔액 저장 + 원장 + `point.changed` 를 한 곳에서)
- `application/hold` — 명령 처리(`ProcessPromotionCommand`) · 만료(`ExpirePromotionHolds`)
- `infrastructure/messaging` — 명령 컨슈머(`promotion-service` 그룹) · 아웃박스 어댑터 · `infrastructure/scheduler` — 보류 만료(30초 주기)

## Key Rules

- **금액**: 원 단위 `Long`. 정률 할인 = 내림(대상 금액 × rateBp / 10000), 최대 할인 이하. 정액은 대상 금액을 넘지 않는다.
  대상 금액 = PLATFORM 이면 모든 라인, SELLER 면 그 판매자 라인(판매가 × 수량, 배송비 제외)의 합. 최소 주문 금액도 그 합으로 본다.
- **사용 기간** `[validFrom, validUntil)` — 시작 정각 포함, 종료 정각 제외. 정의 조건은 만든 뒤 바뀌지 않는다.
- **발행 상한**: `UPDATE … SET issued_count = issued_count + 1 WHERE id = ? AND issued_count < issue_limit` 가 0행이면 소진(409).
  DB CHECK `issued_count <= issue_limit` 이 둘째 겹. 한 회원 한 정의 한 장 — `(member_id, coupon_definition_id)` 유니크,
  위반이면 같은 트랜잭션의 증가분도 되돌아간다.
- **포인트**: 잔액 행 `@Version` + CHECK `balance >= 0`, 원장은 추가만(원장 합 = 잔액). 잔액을 바꾸는 도메인 메서드는 원장 줄을
  돌려주고 `PointLedgerRecorder` 만 저장한다. 원장 `idempotency_key` 유니크 — `hold-use:{orderId}` · `hold-cancel:` · `hold-expire:` · `restore:{restoreKey}` · `grant:{uuid}`.
- **보류(TCC)** — 주문당 한 행(`order_id` 유니크). RESERVED → CONFIRMED | CANCELLED | EXPIRED · CONFIRMED·RESTORED → RESTORED.
  판정 실패도 FAILED 행으로 남아 같은 orderId 가 다시 보류되지 않는다. 포인트는 보류 시점에 잔액에서 빠진다.
  - reserve: 쿠폰 소유·사용 가능·기간·대상·최소 금액 · **명령의 `couponDiscount`(주문서 견적)가 보류 시점 계산과 같을 것** · 잔액.
  - **보류 기한 `commerce.hold-minutes`(30분)**, 기한 정각부터 만료. 만료된 보류에 confirm → 예외가 아니라 `promotion.hold.failed(reason=EXPIRED)`.
    스케줄러보다 confirm 이 먼저 오면 그 자리에서 만료시키고 `expired` + `failed(EXPIRED)` 를 둘 다 낸다.
  - cancel: 보류가 없거나 이미 풀렸어도 `cancelled` 로 답한다(보상 단계가 멈추지 않게). 확정 뒤에는 `failed(ALREADY_CONFIRMED)` — 원복으로 되돌린다.
  - restore(클레임): 포인트는 부분 금액도 되고 합은 사용분까지. 쿠폰은 `fullCancel=true` 일 때만 한 번 — 기간 안이면 RETURNED(다시 쓸 수 있음), 지났으면 EXPIRED. `restoreKey` 멱등.
  - **명령 하나에 답 하나**: 효과는 orderId 로 한 번만, 다시 온 명령에도 지금 상태로 답한다(사가의 기한 재발행이 답을 받게).
    업무상 실패는 전부 `failed{reason}` 이벤트이고 예외는 계약 위반(필드 누락)뿐 — 그것만 DLT.
- **이벤트**(아웃박스):
  - `promotion.hold.{reserved,failed,confirmed,cancelled,expired,restored}` 키 orderId — orderId · command · memberId · holdStatus ·
    userCouponId · couponDefinitionId · **userCouponStatus** · couponDiscount · pointAmount · restoredPointAmount · restoredPoints · couponReturned · reason · expiresAt
  - `promotion.coupon.defined` 키 정의 id — 조건 전부 · `promotion.coupon.issued` 키 회원 id · `promotion.point.changed` 키 회원 id — balance · delta · type · orderId
  - 보류·확정·반환에 따른 사용자 쿠폰 상태 변화는 별도 토픽이 없다 — hold 이벤트의 `userCouponStatus` 로 따라간다.

## API

| 경로 | 인증 | 비고 |
|---|---|---|
| `GET /api/v1/coupons/me` · `GET /api/v1/points/me` | ROLE_USER | `X-User-Id` 없으면 401. 쿠폰은 정의 조건 + `usable`, 포인트는 잔액 + 최근 원장 20줄 |
| `POST /api/v1/coupons/{definitionId}/claim` | ROLE_USER | 201 · 소진·이미 받음·기간 밖 409 |
| `POST·GET /api/v1/admin/promotions/coupons` | ROLE_ADMIN | 정의 만들기(만든 사람 기록)·목록. 조건 위반 400 |
| `POST /api/v1/admin/promotions/points/grants` | ROLE_ADMIN | 데모용 지급 — 지급자·사유가 원장에 남는다 |
| `/api/v1/admin/promotions/ops-issues` | ROLE_ADMIN | 운영 이슈 조회·재시도·종결. DLT(`promotion-dlt-ops` 그룹이 `<원 토픽>.DLT` 에서 적재) 재시도 = 원 토픽 재발행 |

## 운영 DB

`promotion_db` 는 order 와 같은 MySQL 인스턴스(`mysql-order-master`)에 스키마만 분리해 둔다. 운영 MySQL 은 init 이 재실행되지
않으므로 배포 전 `oci-mysql` 로 스키마·계정을 만든다(ADR-0099).
