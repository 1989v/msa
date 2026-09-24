# Seller Service

마켓플레이스 판매자 — 입점 신청·승인·정지·수수료율과 정산 계좌. `commerce:app` 에 폴드된 라이브러리 (ADR-0099).
판매자 권한의 원천은 JWT 역할이 아니라 **이 도메인의 판매자 행**이다.

## Modules

| Gradle path | 역할 |
|---|---|
| `:seller:domain` | Pure Kotlin 도메인 — `Seller`(상태 머신·1인 1판매자·반려 30일 파기), `AccountNumber`(마스킹), `SellerAdminAction` |
| `:seller:feature` | 비-bootable 라이브러리 — 전용 datasource `seller_db` (`sellerEntityManagerFactory` / `sellerTransactionManager`, Hikari 최대 3), Flyway `sellerdb/migration` + `ScopedFlywayMigrator` |

## Commands

```bash
./gradlew :seller:domain:test                                  # 상태 전이표·1인 1판매자·파기 기한
./gradlew :seller:feature:test                                 # 서비스(Port MockK)·AES-GCM·컨트롤러 권한
./gradlew :commerce:app:test --tests '*CommerceContextLoad*'   # seller_db 행 쓰기·읽기 + 아웃박스 행
./gradlew :commerce:app:test --tests '*SellerAccountKey*'      # 키 없으면 기동 실패
```

## 구조 상태 (ADR-0083)

`inventory/feature` 견본을 따른다. 비-@Primary 도메인이라 **모든 `@Transactional` 이 `sellerTransactionManager` 를 한정자로 갖는다**
(`verifyTransactionQualifiers`). seller EMF 는 호스트 `ddl-auto` 와 무관하게 `validate` 고정 — 스키마는 Flyway 만 만든다.

- `application/seller/usecase` — Apply · GetMy · QuerySellers(어드민) · ManageSeller(어드민 조치) · PurgeRejectedApplications · RevealPayoutAccount
- `application/seller/port` — `SellerRepositoryPort` · `SellerAdminActionRepositoryPort` · `SellerEventPort` · `AccountCipherPort`
- `infrastructure` — persistence(seller·adminaction) · crypto(`AesGcmAccountCipher`) · messaging(아웃박스 어댑터) · scheduler(파기)

## Key Rules

- **상태**: PENDING → ACTIVE | REJECTED · ACTIVE ↔ SUSPENDED. REJECTED 는 종착이고 재신청은 새 행(이력 보존).
- **1인 1판매자**: 한 회원은 PENDING·ACTIVE·SUSPENDED 행을 하나만 — 정지 회피 재신청 불가. 도메인 검사 뒤에
  DB 생성 컬럼 `open_member_id` 유니크 제약이 동시 신청을 막는다.
- **판매자 API 권한**: `/api/v1/seller/**` 는 매 요청 `X-User-Id` → 판매자 행 → ACTIVE 확인. 정지는 토큰 만료를
  기다리지 않고 바로 403. 게이트웨이는 ROLE_SELLER(ROLE_ADMIN 은 필터가 상위로 통과)까지만 본다.
- **어드민 조치**(`/api/v1/admin/sellers/**`): 승인(수수료율 bp)·반려·정지·재활성·수수료율 변경. 행위자·사유·전후 상태가
  `seller_admin_action` 에 남는다. 반려·정지·수수료율 변경은 사유 필수.
- **이벤트**(아웃박스, 키 = sellerId): `seller.seller.{applied,approved,suspended,reactivated,updated}` —
  sellerId · memberId · status · commissionRateBp · shippingFee · settlementCycle. **계좌·사업자번호·대표자는 싣지 않는다.**
  반려는 이벤트가 없다. 수신: order(읽기 모델) · auth(ROLE_SELLER) · product.
- **개인정보 파기**: 반려 후 30일이 지나면 사업자번호·대표자·은행·계좌를 NULL 로 지운다(매일 04:20 KST).
  행·상태·상호·반려 사유는 이력으로 남는다.
- **플랫폼 기본 판매자**: `seller.id = 1`(member `platform`, ACTIVE, 수수료 0) — V1 시드. 기존 상품의 백필 대상.

## 정산 계좌 암호화 키 `SELLER_ACCOUNT_ENC_KEY`

- AES-256-GCM, hex 64자. 설정 파일에 기본값이 없다(`${SELLER_ACCOUNT_ENC_KEY}` 만) — 없거나 형식이 틀리면 commerce 가 기동하지 않는다.
- 운영: Secret `seller-account-enc`(키 `key`)를 commerce Deployment 가 읽는다. 만드는 법은 `k8s/overlays/oci-arm/README.md` §앱 Secret.
- **키를 잃으면 저장된 계좌를 풀 수 없다** — `AUTH_SUBJECT_HASH_KEY` 와 같은 백업 대상.
- 복호화는 `RevealPayoutAccountUseCase`(지급 경로) 하나뿐이다. 화면·어드민 조회는 마스킹 값만 쓴다.
- 행마다 `account_key_version` 이 남는다. 교체 절차: 새 키로 `seller.account.key-version` 을 올리기 전에 옛 버전 행을
  새 키로 재암호화하는 작업이 필요하다 — 지금 어댑터는 현재 버전 행만 푼다(다른 버전은 예외, 조용히 다른 키로 시도하지 않는다).
  재암호화 작업은 아직 없다.

## 운영 DB

`seller_db` 는 order 와 같은 MySQL 인스턴스(`mysql-order-master`)에 스키마만 분리해 둔다. 운영 MySQL 은 init 이 재실행되지
않으므로 배포 전 `oci-mysql` 로 스키마·계정을 만든다(ADR-0099 SR-13).
