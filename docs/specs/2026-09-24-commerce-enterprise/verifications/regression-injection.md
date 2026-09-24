# 회귀 주입 기록 — commerce 엔터프라이즈화

검사가 대상의 산출물을 보는지 확인하려고 구현을 일부러 깨 빨간불을 본 기록이다. 원본은 `implementation/status.md` 의 단계별 증거이고,
여기서는 한 표로 모은다. 필수 일곱 건은 2026-09-24 문서 마감 단계에서 **임시 사본**(작업 트리 밖)에 다시 주입해 테스트 이름까지 확인했다.

## 1. 필수 일곱 건

| 검사 | 무엇을 깨뜨렸나 | 빨간불 (테스트) | 원복 확인 (작업 트리, 주입 없음) |
|---|---|---|---|
| 원장 불변식 | `Journal` 생성 시 차변 합 ≠ 대변 합 검사를 끔 | `JournalTest` 2건 — 「차변 합 ≠ 대변 합 → UnbalancedJournalException」 · 「저장소 복원도 같은 검사를 거친다」 (28 중 2 실패) | `JournalTest` 5/0 |
| 멱등 키 (주문 `Idempotency-Key`) | 완료된 키의 재요청을 저장 응답 재생이 아니라 새 요청으로 처리 | `OrderControllerIdempotencyTest` 「완료 뒤 같은 키 → 처음 응답 그대로, 주문은 여전히 1건」 (11 중 1 실패) | `OrderControllerIdempotencyTest` 11/0 |
| 아웃박스 직렬화 | 릴레이 값 직렬화기를 `StringSerializer` → `JacksonJsonSerializer` 로 되돌림 | `OutboxRelayIntegrationSpec` — `expected:<'{'> but was:<'"'>` (status.md TG1 기록) | `OutboxRelayIntegrationSpec` 5/0 (TG15 전체 실행) |
| 보류 만료 VOID (b) — 결제 쪽 | `Payment.pendingVoidDue` 를 항상 false (UNKNOWN 중 받아 둔 VOID 가 AUTHORIZED 결론 뒤에도 실행 안 됨) | `PaymentTest` 「기억된 VOID 는 AUTHORIZED 로 결론 나면 실행 대상이 된다」 (72 중 1) · `PaymentResolutionServiceTest` 「재조회가 AUTHORIZED 면 그때 취소해 VOIDED 로 끝난다」 (5 중 1) | `PaymentTest` 69/0 · `PaymentResolutionServiceTest` 5/0 |
| 보류 만료 VOID (b) — 사가 쪽 | 코디네이터가 (b) 분기에서 VOID 를 건너뜀 | `OrderSagaE2ETest` 2 실패 `expected:<"COMPENSATING"> but was:<"RUNNING">` (status.md TG12 기록) | `OrderSagaE2ETest` 14/0 |
| 부분 예약 원자성 | 재고가 모자란 라인만 건너뛰고 나머지를 예약 | `OrderReservationTest` 3건 — 「예약 행은 하나도 생기지 않는다」 · 「재고 수량도 그대로다」 · 「reservation.failed 한 건만」 (6 중 3) | `OrderReservationTest` 6/0 |
| 판매자 정지 즉시 차단 | 판매자 포털 조회에서 `ensureActive()` 제거 | `SellerControllerTest` 「정지된 판매자는 ROLE_SELLER 토큰이 유효해도 403」 (15 중 1) | `SellerControllerTest` 15/0 |
| 게이트웨이 인증 수준 | `seller-admin` 라우트 필터를 `adminConfig` → `userConfig` | `GatewayRouteAuthSpec` 2건 — 「/api/v1/admin/sellers/** ROLE_USER·ROLE_SELLER 403」 · 「운영 이슈 ops-issues ROLE_USER·ROLE_SELLER 403」 (47 중 2) | `GatewayRouteAuthSpec` 47/0 |

재현 명령 (임시 사본, 여섯 건을 서로 다른 모듈에 한 번에 주입):

```bash
./gradlew :settlement:domain:test :order:feature:test --tests '*OrderControllerIdempotency*' \
  :payment:domain:test :payment:feature:test --tests '*PaymentResolution*' \
  :inventory:feature:test --tests '*OrderReservation*' :seller:feature:test --tests '*SellerController*' \
  :gateway:test --tests '*GatewayRouteAuth*' --continue
# → BUILD FAILED, 위 표의 실패만. 작업 트리에서 같은 명령 → 전부 0 실패
```

- **아웃박스 직렬화**는 단위 spec(`OutboxPollingPublisherSpec`)으로는 안 잡힌다 — `KafkaTemplate` 을 목으로 두어 직렬화기를
  거치지 않는다. 주입한 사본에서 5/0 초록불이었다. 이 검사를 지키는 것은 실제 Kafka 로 보내는 `OutboxRelayIntegrationSpec` 하나다.
  문서 마감 단계의 재주입은 Docker 가 내려가 있어 이 spec 을 돌리지 못했고(`DockerOrCi` 조건으로 건너뜀), 빨간불은 TG1 기록을 근거로 한다.
- **보류 만료 (b) 사가 쪽**은 E2E(실 MySQL·Kafka)만 잡는다 — 재주입하지 않았고 TG12 기록이 근거다.
- 원복 확인의 commerce:app 수치(74 테스트, 건너뜀 0)는 TG15 마지막 전체 실행 결과다. 이후 코드 변경이 없어 Gradle 이 `UP-TO-DATE` 로 판정했다.

## 2. 단계별 전체 기록 (status.md)

| 단계 | 무엇을 깨뜨렸나 | 빨간불 |
|---|---|---|
| TG1 아웃박스 | JSON 직렬화기로 되돌림 · SKIP LOCKED 제거 | `expected:<'{'> but was:<'"'>` · 중복 발행 검출 (`OutboxRelayIntegrationSpec`) |
| TG2 보안·결함 | 상품 쓰기 권한 무조건 통과 · 게이트웨이 쓰기 라우트 `userConfig` · 부족 라인 건너뛰기 | 3 실패 · 1 실패 · 4 실패 |
| TG3 seller | 계좌 키 기본값 추가 · seller-admin 라우트 `userConfig` · TM 한정자 제거 | 기동 실패 테스트 FAILED · 403 테스트 FAILED · `verifyTransactionQualifiers` BUILD FAILED |
| TG4 역할 연동·상품 소유 | 정지 → 역할 부여 · 소유 검사 제거 · 판매자 id 1 고정 · ACTIVE 무시 · 옛 이벤트 거르기 제거 | 5종 전부 빨간불 |
| TG6 payment | orderNo 재승인 · 보류 VOID (b-1) · (b-2) · 웹훅 조건 제거 | 2곳 · 빨간불 · 도메인 테스트만(서비스 테스트는 `requireNotNull` 이 먼저 멈춤) · 404 테스트 |
| TG7 promotion | 발급 상한 조건 제거 · reserve 멱등 제거 · EXPIRED 경로 예외/무시 | 전부 빨간불 (상한은 실 MySQL 100명 동시 발급 spec) |
| TG8 order 읽기 모델·주문서 | 잔차 첫 라인 · 동률 뒤 라인 · 판매자 상태 무시 · 옛 이벤트 거르기 제거 · 컬럼명 변경 · 백필 소수 검사 제거 | 6종 전부 빨간불 |
| TG9 장바구니·주문서 화면 | 결제 금액을 라인 합으로 · 재생성 요청에 unitPrice · 만료 무시 | 전부 빨간불 (vitest) |
| TG10 명령 핸들러 | 12종 (예약·확정·해제·재입고·이행 명령, 옛 구독 부활 포함) · `@EnableKafka` 제거 | 12종 전부 빨간불 · 통합 spec 컨텍스트 실패 |
| TG11 사가 코디네이터 | 5종 | 첫 시도는 가드 이중이라 초록불 → 가드까지 제거해 빨간불. 리스 가드는 실 MySQL 통합만 잡음 |
| TG12 사가 E2E | 코디네이터 (b) VOID 건너뛰기 · 결제 쪽 UNKNOWN 즉시 VOID | 2 실패(`COMPENSATING` 기대, `RUNNING`) · 1 실패 |
| TG13 클레임 | 8종 | 재입고 페이로드 키 변경은 단위 초록·E2E 만 빨강(배선은 E2E 만 지킨다) |
| TG14 settlement | 차=대 검사 제거 · 환불 필터 제거 · 지급 금액 변경 · 보존 3년 | 전부 빨간불 |
| TG15 운영 | DLT 리스너 제거 · 추적 헤더 제거 · 체류 중복 검사 제거 · 게이트웨이 라우트 제거 | 전부 빨간불 |

TG5(판매자 화면)는 회귀 주입 기록이 없다 — CDP 대비 측정이 증거다.
