# Requirements — commerce 엔터프라이즈화

## 배경

2026-09-24 분석(아티팩트 「주문·결제·정산 개념 지도」 부록)에서 commerce 는 아웃박스·멱등 컨슈머·DLT 는 있으나
결제 도메인·보상·정산이 없고 사가 순서가 결제 → 재고로 뒤집혀 있음이 확인됐다. 사용자 결정은
「부록 결함 전부 수정 + 엔터프라이즈 6단계 전부 적용」이다.

## 사용자 결정 (원문 그대로)

| 질문 | 답 |
|---|---|
| 결제 연결 | 둘 다 (모의 PG + 토스페이먼츠 테스트 키, 포트 뒤 교체) |
| 판매자 모델 | 완전한 마켓플레이스 (판매자 가입·어드민 화면·판매자별 정산 조회까지) |
| 배포 | 단계마다 푸시·배포 |
| 블로그 | 개념 지도 수준, 회사 부트캠프 내용 제외, 진짜 개념으로만 — 별도 트랙(이 스펙 범위 밖) |

## 확정 사실 (코드 근거)

- 폴드 호스트는 `commerce:app` (ADR-0058/0093). 새 도메인은 새 파드가 아니라 `:domain` + `:feature` 폴드, 도메인별 전용 datasource(`{Svc}DataSourceConfig`, `ScopedFlywayMigrator`)
- 견본 `inventory/feature` (ADR-0083). 아웃박스·멱등 원장은 common 서브인터페이스 바인딩
- `Role` 에 `ROLE_SELLER` 가 이미 있다 (`auth/domain/.../Role.kt:4`). 역할은 `member_roles` 행
- 운영 MySQL 은 이미 떠 있어 `configmap-init` 은 재실행되지 않는다 — 새 스키마·계정은 배포 전 수동 생성 + init 파일 동기화
- 상시 파드 egress 금지 (ADR-0031/0070), 외부 호출은 `ExternalApiProvider` 쿼터 게이트 (ADR-0082)
- OCI 무료 범위가 최상위 제약 — commerce 한도 1200Mi

## 기능 요구사항

### R0 결함 수정 (아티팩트 ⚑ 전부)
- R0.1 product·payment 호출 주소 — 폴드 후 product 는 같은 JVM 이므로 HTTP 자기 호출을 없애고 Kafka 로 동기화된 **상품 스냅샷 읽기 모델**(order 소유)로 검증한다. payment 는 R1 의 in-process 가 아니라 Kafka 명령/이벤트(ADR-0058 불변식 2)
- R0.2 서버가 가격을 정한다 — 클라이언트 `unitPrice` 무시, 주문서 스냅샷 금액만 신뢰 (R3 과 연결)
- R0.3 아웃박스 직렬화 — 이중 인코딩 여부를 테스트로 확정하고, 릴레이는 String 직렬화기로 원문 JSON 을 보낸다
- R0.4 결제 결과 미상을 실패로 치지 않는다 (R1)
- R0.5 결제된 주문의 재고 예약이 TTL 로 풀리지 않는다 — 결제 확정 시 예약을 CONFIRMED(판매 확정)로 전이, TTL 은 결제 대기 구간에만
- R0.6 부분 예약 원자성 — 한 주문의 예약은 전부 성공 또는 전부 실패(한 트랜잭션)
- R0.7 재고 부족·예약 만료가 DLT 로 새지 않고 사가 실패 이벤트로 돌아온다
- R0.8 외부 호출 타임아웃 (연결 3초·읽기 5초, ADR-0015)
- R0.9 상품 재고 동기화 — 만료·확정 경로도 이벤트를 내 product stock 이 어긋나지 않는다
- R0.10 예약 TTL 을 설정값으로 (`inventory.reservation.ttl-minutes`)

### R1 결제 도메인 (신규 `payment`)
- 상태: READY → AUTHORIZED → CAPTURED → PARTIALLY_REFUNDED / REFUNDED, VOIDED, FAILED, UNKNOWN
- `PgPort` 뒤에 두 어댑터: 모의 PG(기본, 장애 주입 가능) · 토스페이먼츠(테스트 키, 프로필로 선택)
- 가맹점 주문번호 = 결제 멱등 키. 재시도가 이중 승인이 되지 않는다
- UNKNOWN → 백오프 재조회 스케줄러가 결론. 재조회 한도 초과 시 운영 큐
- 웹훅 엔드포인트: 서명 검증 · 중복 무시 · 같은 전이 함수
- 승인/매입 분리, 매입 전 취소는 VOID, 매입 후는 전액·부분 환불
- 결제 명령은 Kafka(`payment.command.*`), 결과는 `payment.payment.*` 이벤트

### R2 판매자 도메인 (신규 `seller`) — 마켓플레이스
- 판매자 신청(회원) → 어드민 승인 → `ROLE_SELLER` 부여(auth 에 이벤트) → 판매자 상품 등록·수정
- 판매자 마스터: 상호·사업자번호·정산 계좌(마스킹 저장)·수수료율·정산 주기(주/월)·상태(PENDING/ACTIVE/SUSPENDED)
- `product.seller_id` — 기존 상품은 플랫폼 기본 판매자로 백필
- 판매자 포털(portal-fe): 내 상품·내 주문·내 정산 조회. 어드민(admin-fe): 신청 승인·정지·수수료율

### R3 주문서 · 가격 스냅샷 · 혜택 · 장바구니
- 장바구니(로그인 사용자, 판매자 혼합 가능)
- 주문서: 서버 가격 재계산 · 가용성 확인 · 혜택 계산 · 유효 시간(15분) · 스냅샷 id
- 주문 라인 스냅샷: 상품명·판매가·할인 안분(쿠폰/포인트, 부담 주체)·수수료율·판매자 id·합계 저장, 통화 KRW
- 혜택 도메인(신규 `promotion`): 쿠폰(정액·정률·최소금액·만료, 플랫폼/판매자 부담)·포인트 원장. TCC — reserve → confirm / cancel

### R4 사가 오케스트레이션 · 주문 상태 · 멱등
- order 안에 사가 코디네이터 + `order_saga` 상태 테이블(단계·시도·타임아웃·보상 진행)
- 순서: 주문 생성 → 재고 예약 → 혜택 예약 → 결제 승인(피벗) → 재고 확정 → 혜택 확정 → 결제 매입 → 주문 확정 → 이행 생성
- 보상: 결제 실패 → 혜택 원복 → 재고 해제 → 주문 FAILED. 피벗 뒤는 재시도만
- 주문 상태 확장: CREATED · PAYMENT_PENDING · PAID · CONFIRMED · FULFILLING · COMPLETED(구매 확정 — 재정의, 2차 결정) · CANCELLED · FAILED (부분 취소는 라인 상태 — spec SR-2)
- 상태 이력 테이블, orders `@Version`
- `Idempotency-Key` 헤더(사용자+키 유니크, 처리 중 409, 완료 시 저장 응답 반환, 24시간)
- 유니크 제약: reservation(order_id, product_id, warehouse_id), fulfillment(order_id, warehouse_id), inventory(product_id, warehouse_id)
- 사가 관련 이벤트는 전부 orderId 파티션 키
- 202 Accepted + 상태 조회 — 주문 접수는 사가 시작까지만 동기, 결과는 폴링

### R5 클레임 · 원장 · 정산 (신규 `settlement`)
- 클레임(order 소유): 전체 취소 · 부분 취소(라인 단위) · 환불 금액 계산(안분 기준) · 상태 REQUESTED → APPROVED → REFUNDED / REJECTED
- 구매 확정: 고객 확정 또는 배송 완료 후 N일(설정, 기본 7) 자동
- 원장: 복식부기, 추가만, 거래당 차·대 합 0 을 도메인 불변식으로. 계정: PG 미수금·판매자 미지급금·수수료 수익·PG 수수료 비용·현금·혜택 비용(플랫폼 부담)
- 정산 배치: 판매자 주기별 집계 → 정산서(대상 기간·매출·수수료·환불 상계·지급액) → 지급(모의 송금) → 원장 기록
- PG 대사: 모의 PG 정산 파일(일별) ↔ payment 행 건별 대조, 불일치는 운영 큐

### R6 운영 보강
- 아웃박스: 배치 상한 · `SKIP LOCKED` · 재시도 상한 + FAILED · 발행 행 정리 · 적체 지표
- DLT 재처리: 어드민 API (조회·재발행·종결)
- 운영 큐 화면(admin-fe): UNKNOWN 결제 · 대사 불일치 · DLT · 사가 체류 초과
- traceId 를 HTTP·Kafka 헤더로 전파 (ADR-0028)
- Testcontainers MySQL + Kafka 사가 E2E: 정상 · 결제 거절 · 결제 타임아웃→UNKNOWN→조회 성공 · 재고 부족 · 중복 요청 · 부분 환불 · 정산 1회

## 범위 밖
- 실제 송금(펌뱅킹), 세금계산서 발행, 해외 통화
- 토스페이먼츠 **운영 활성화** — 어댑터·테스트는 만들되 oci-arm 은 모의 PG. 활성화는 egress 예외 ADR 결정 뒤 (open-questions Q1)
- 이미지 업로드·CDN

## 재사용
- common `OutboxPollingPublisher`, `IdempotentEventHandler`, `ScopedFlywayMigrator`, `ApiResponse`, Resilience4j 설정
- inventory 예약 모델, fulfillment 상태 머신, product 이벤트, auth RBAC

## 관측
- 주문 id 하나로 사가 상태 테이블 + 상태 이력 + traceId 로그를 모은다
- 지표: 사가 체류 시간·보상 발생 수·UNKNOWN 수·아웃박스 적체·대사 불일치 수

## 리뷰 후 추가 결정 (2026-09-24, 원문 그대로)

| 질문 | 답 |
|---|---|
| 구매 확정 이름 | COMPLETED 재정의 |
| 주문서 데이터 읽기 | order 가 읽기 모델 보유 (Recommended) |
| 보안 추가 | 상품 쓰기 API 권한 (Recommended), 매출 통계 API 어드민 전용 (Recommended) |

E2E 시나리오 목록의 정본은 `planning/test-quality.md` 다(위 R6 목록은 초기 초안).
