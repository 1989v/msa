# Spec — deal.1989v.com 혜택 링크 허브 (P1)

- 작성: 2026-08-19
- ADR: `docs/adr/ADR-0069-deal-affiliate-hub.md`
- Requirements: `planning/requirements.md`

## 1. 범위

| 포함 (P1) | 제외 (P2+) |
|---|---|
| 공개 허브 FE (카테고리 5종 · 오퍼 카드) | 오퍼별 상세 콘텐츠 페이지 / SEO 색인 |
| 어드민 CRUD (카테고리 · 오퍼) | 성과 대시보드 (네트워크 수익 입력 · 전환율) |
| `/go/{slug}` 302 리다이렉터 + 클릭 적재 | 다국어 (`/en`) |
| 만료 자동 숨김 + 어드민 경고 목록 | 개인화 · 회원 · 위시리스트 연동 |
| 링크 헬스체크 CronJob + 클릭 로그 정리 | 네트워크 API 자동 정산 연동 |

## 2. 모듈 배치

```
deal/domain/          :deal:domain    순수 Kotlin. com.kgd.deal.domain.*
deal/feature/         :deal:feature   Spring 라이브러리(비-bootable). com.kgd.deal.*
code-dictionary/app/                  :deal:feature 를 흡수 (bootJar 는 그대로 1개)
```

- `code-dictionary/app/build.gradle.kts` 에 `implementation(project(":deal:feature"))`
- `CodeDictionaryApplication` 에 `@EntityScan` / `@ComponentScan` / `@EnableJpaRepositories`
  로 `com.kgd.deal` 추가 (기본 스캔 루트가 `com.kgd.codedictionary` 라 자동으로 안 잡힌다)
- **전용 datasource 없음** — code-dictionary primary datasource 공유
- Flyway 마이그레이션은 `code-dictionary/app/src/main/resources/db/migration/V13__deal.sql`
  (히스토리 테이블이 하나이므로 버전 수열도 하나)

## 3. 스키마 (V13__deal.sql)

### deal_category

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | BIGINT PK AI | |
| `code` | VARCHAR(40) UK | `travel` / `commerce` / `subscription` / `education` / `living` |
| `label` | VARCHAR(80) | 화면 문구 |
| `tagline` | VARCHAR(200) NULL | |
| `status` | VARCHAR(16) | `OPEN` / `PREOPEN` / `HOLD` — ADR-0066 전시 상태 관례 |
| `order_no` | INT | |
| `created_at` / `updated_at` | DATETIME | |

시드 5행. 의료·금융 행은 만들지 않는다.

### deal_offer

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | BIGINT PK AI | |
| `slug` | VARCHAR(60) UK | `/go/{slug}` 의 키. 소문자·숫자·하이픈만 |
| `category_id` | BIGINT | **FK-as-ID** (연관관계 매핑 없음 — jpa-persistence 컨벤션) |
| `merchant` | VARCHAR(60) | 제공처 표시명 (쿠팡 / 트립닷컴 / 클룩) |
| `title` | VARCHAR(120) | |
| `benefit` | VARCHAR(80) | 혜택 요약 — "최대 10% 적립" |
| `summary` | VARCHAR(300) NULL | |
| `target_url` | VARCHAR(1000) | **원본 그대로 저장·전달. 절대 재조립 금지** |
| `revenue_type` | VARCHAR(16) | `AFFILIATE` / `PLAIN` (enum STRING) |
| `network` | VARCHAR(40) NULL | `AFFILIATE` 일 때만. `COUPANG_PARTNERS` / `TRIP_COM` / `KLOOK` / `LINKPRICE` … |
| `status` | VARCHAR(16) | `OPEN` / `PREOPEN` / `HOLD` |
| `valid_from` | DATETIME NULL | NULL = 즉시 |
| `valid_until` | DATETIME NULL | NULL = 상시 |
| `order_no` | INT | |
| `click_count` | BIGINT DEFAULT 0 | 비정규화 카운터 (어드민 정렬용) |
| `link_status` | VARCHAR(16) DEFAULT 'UNKNOWN' | `OK` / `BROKEN` / `UNKNOWN` |
| `link_status_code` | INT NULL | 마지막 응답 코드 |
| `link_checked_at` | DATETIME NULL | |
| `created_at` / `updated_at` | DATETIME | |

인덱스: `idx_offer_category_status_order (category_id, status, order_no)`,
`idx_offer_valid_until (valid_until)`, UK `uk_offer_slug (slug)`.

CHECK: `revenue_type IN ('AFFILIATE','PLAIN')`, `status IN ('OPEN','PREOPEN','HOLD')`,
`link_status IN ('OK','BROKEN','UNKNOWN')`.

### deal_offer_click

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | BIGINT PK AI | |
| `offer_id` | BIGINT | FK-as-ID |
| `clicked_at` | DATETIME(3) | |
| `referrer_host` | VARCHAR(120) NULL | **호스트만** 저장 (전체 URL·쿼리 저장 안 함) |
| `ua_family` | VARCHAR(40) NULL | `mobile` / `desktop` / `bot` 수준 |

인덱스: `idx_click_offer_time (offer_id, clicked_at)`, `idx_click_time (clicked_at)`.

IP·전체 referrer·쿠키는 저장하지 않는다. 클릭 수를 세는 데 필요 없고, 보관하는 순간
개인정보 처리방침 대상이 된다.

### display_service 시드 추가

```sql
INSERT IGNORE INTO display_service (code, label, tagline, href, status, order_no)
VALUES ('deal', '혜택 링크', '여행 · 커머스 · 구독 혜택 모음', '/deal', 'OPEN', 45);
```

`href` 는 상대 경로 (ADR-0066 규칙 — 절대 URL 을 박으면 apex 리다이렉트 로직을 우회한다).

## 4. 도메인 (`:deal:domain`)

```kotlin
enum class RevenueType { AFFILIATE, PLAIN }
enum class DisplayStatus { OPEN, PREOPEN, HOLD }
enum class LinkStatus { OK, BROKEN, UNKNOWN }

class Offer(...) {
    /** 전시 가능 여부 — 화면이 아니라 도메인이 판단한다 */
    fun isVisibleAt(now: Instant): Boolean =
        status == DisplayStatus.OPEN &&
            (validFrom == null || !now.isBefore(validFrom)) &&
            (validUntil == null || now.isBefore(validUntil))

    fun requiresDisclosure(): Boolean = revenueType == RevenueType.AFFILIATE
}
```

불변 규칙 (도메인 테스트 대상):
- `revenueType == AFFILIATE` 이면 `network` 는 필수
- `revenueType == PLAIN` 이면 `network` 는 null
- `validUntil` 이 있으면 `validFrom` 보다 뒤
- `slug` 는 `^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$`
- `targetUrl` 은 `https://` 로 시작 (http 링크는 등록 거부)

## 5. API

### 공개

```
GET /api/v1/deal/categories
    → ApiResponse<List<CategoryResponse>>            status=OPEN 만, order_no 순

GET /api/v1/deal/offers?category={code}
    → ApiResponse<List<OfferResponse>>               isVisibleAt(now) 통과분만
    OfferResponse: { slug, merchant, title, benefit, summary, revenueType, validUntil }
    ※ targetUrl 은 응답에 넣지 않는다 — 클릭은 반드시 /go 를 거친다
```

### 리다이렉터

```
GET /go/{slug}
    302 Location: <target_url 원본>          정상
    302 Location: /?category={code}          만료·HOLD (404 대신 카테고리로)
    404                                      slug 없음
```

- `Cache-Control: no-store` — 302 가 CDN/브라우저에 캐시되면 링크 교체가 반영되지 않는다
- slug→(target_url, status, valid*) 는 Caffeine 캐시(TTL 5분). 어드민 수정 시 evict
- 클릭 적재는 **try/catch**. 실패해도 302 는 나간다
- `User-Agent` 가 봇 패턴이면 `ua_family='bot'` 으로만 기록 (제외하지 않는다 — 나중에 필터링)

### 어드민 (`ROLE_ADMIN`)

```
GET    /api/v1/admin/deal/categories
POST   /api/v1/admin/deal/categories
PUT    /api/v1/admin/deal/categories/{id}
DELETE /api/v1/admin/deal/categories/{id}      오퍼가 있으면 409

GET    /api/v1/admin/deal/offers?category=&status=&linkStatus=
POST   /api/v1/admin/deal/offers
PUT    /api/v1/admin/deal/offers/{id}
DELETE /api/v1/admin/deal/offers/{id}

GET    /api/v1/admin/deal/offers/attention
    → { expiringSoon: [...], stale: [...], broken: [...] }
      expiringSoon = valid_until 14일 이내
      stale        = updated_at 90일 초과 & status=OPEN
      broken       = link_status='BROKEN'

GET    /api/v1/admin/deal/offers/{id}/clicks?from=&to=
    → 일별 클릭 수
```

응답은 전부 `ApiResponse<T>` (docs/architecture/api-response.md).

### 라우팅 추가

`gateway/src/main/resources/application.yml` — code-dictionary 라우트에 `/api/v1/deal/**` 추가,
`/go/**` 는 별도 라우트로:

```yaml
- id: deal-redirect
  uri: http://code-dictionary:8089
  predicates:
    - Path=/go/**
```

`k8s/overlays/oci-arm/ingresses/commerce-platform.yaml` — `deal.1989v.com` host 블록 추가
(`/api`, `/go` → gateway, `/` → portal-fe) + `tls.hosts` 에 추가.

## 6. FE (portal-fe)

- `App.tsx`: `isDealHost = hostname.split('.')[0] === 'deal'`, 루트에서 `DealPage` 렌더.
  `/deal` 라우트는 `dealRoute()` 로 apex 프로덕션에서 서브도메인 302 (place/game 패턴 그대로).
- `DealPage` 는 lazy chunk — 메인 런처만 보는 방문자가 받을 이유가 없다.
- **DESIGN.md 토큰만 사용. hex 직접 입력 금지.** 브랜드 면이므로 `docs/design/k-heritage.html`
  의 재료·표면·활자·여백을 먼저 열어 맞춘다.
- 구조: 상단 고지 배너(고정) → 카테고리 탭/칩 → 오퍼 카드 그리드.
- 오퍼 카드: `merchant` · `title` · `benefit` 강조 · `validUntil` 잔여일 · `AFFILIATE` 배지.
- 아웃바운드 앵커:
  ```html
  <a href="/go/{slug}" target="_blank"
     rel="{revenueType === 'AFFILIATE' ? 'sponsored nofollow noopener' : 'nofollow noopener'}">
  ```
- 고지 문구는 API 로 받는다 (네트워크마다 요구 문구가 다르고 약관이 바뀐다). P1 은 상수로
  두되 위치를 한 곳으로 모아 P2 에 어드민 설정으로 승격.
- `<meta name="robots" content="noindex, follow">` — deal 호스트에서만.
- OG 태그: `og:title` / `og:description` / `og:image` 고정 1장. P1 유입이 공유이므로 색인보다 중요.
- 빌드타임 프리렌더(ADR-0062) 대상에 deal 루트 추가.

## 7. 어드민 FE (admin/frontend)

`DisplayServicesPage.tsx` 패턴을 그대로 복제:
- `DealCategoriesPage` — 5행 CRUD, 순서/상태 토글
- `DealOffersPage` — 목록(카테고리·상태·링크상태 필터) + 등록/수정 모달
  - `revenueType` 선택 시 `network` 필수/비활성 토글
  - `targetUrl` 붙여넣기 필드에 "원본 그대로. 파라미터를 손대지 마세요" 헬프텍스트
- `DealAttentionPanel` — 대시보드에 만료임박/미수정/깨짐 3줄 요약

## 8. 링크 헬스체크 CronJob

`k8s/base/deal-linkcheck/cronjob.yaml`

```yaml
schedule: "0 4 * * 0"        # 주 1회 일요일 04:00
concurrencyPolicy: Forbid
labels:
  app.kubernetes.io/name: deal-linkcheck
  app.kubernetes.io/part-of: commerce-platform   # 누락 시 default-deny 로 DB 접근 불가
image: commerce/code-dictionary:latest           # 새 이미지 만들지 않음
args:
  - "--spring.main.web-application-type=none"
  - "--spring.profiles.active=kubernetes,linkcheck"
```

`@Profile("linkcheck") class DealLinkCheckRunner : ApplicationRunner` 가 수행:

1. `status=OPEN` 이고 만료 안 된 오퍼 전량 조회
2. 각 `target_url` 에 HEAD (timeout 5s, `User-Agent: 1989v-linkcheck/1.0 (+https://deal.1989v.com)`)
   - 2xx/3xx → `OK`
   - 404 / 410 → `BROKEN`
   - **403 / 405 / 429 / timeout → `UNKNOWN`** (봇 차단 오탐. BROKEN 으로 찍으면 경고가
     노이즈가 되고, 노이즈가 되는 순간 이 장치는 없는 것과 같다)
   - HEAD 가 405 면 `GET Range: bytes=0-0` 로 1회 재시도
3. 요청 간 300ms 간격 (같은 호스트에 몰아치지 않는다)
4. `deal_offer_click` 에서 `clicked_at < now-90d` 삭제 (배치를 또 만들지 않는다)

NetworkPolicy — `k8s/base/network-policy/11-allow-egress-https-public.yaml` 의
`matchExpressions.values` 에 `deal-linkcheck` 추가. **code-dictionary 는 추가하지 않는다**
(상시 파드의 외부 egress 노출면을 늘리지 않는다).

## 9. 테스트

| 레이어 | 대상 |
|---|---|
| `:deal:domain` (Kotest BehaviorSpec) | `isVisibleAt` 경계(validFrom/Until null·동시각), `AFFILIATE↔network` 불변, slug 정규식, https 강제 |
| `:deal:feature` 서비스 | 만료 오퍼가 공개 목록에서 빠지는지, 리다이렉터가 **클릭 INSERT 실패에도 302** 를 내는지(MockK 로 repository throw), 만료 slug → 카테고리 302 |
| 통합 | code-dictionary:app 컨텍스트 로드 (빈 충돌·이중 Flyway 검증 — ADR-0059 가 남긴 회귀 테스트 패턴) |
| FE | `rel` 속성이 `revenueType` 에 따라 갈리는지, 고지 배너 렌더 |

## 10. 배포 선행 조건 (코드 밖)

1. Cloudflare DNS `deal` A 레코드 — **proxied(orange)**. DNS-only 면 AOP 우회로가 생긴다(ADR-0061)
2. `cf-origin-ca-tls` 인증서 SAN 에 `deal.1989v.com` 포함 (수동 발급 cert — 재발급 필요)
3. 쿠팡 파트너스 사이트 등록 심사 + 지정 고지 문구 확인
4. 여행 네트워크(트립닷컴·클룩·아고다·마이리얼트립) 파트너 가입

1·2 가 안 되면 배포해도 526/400 이 난다. 3·4 는 오퍼 데이터 입력의 선행 조건이지 배포 차단은 아니다.
