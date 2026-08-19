# Tasks — deal.1989v.com 혜택 링크 허브 P1

> Spec: `spec.md` · ADR: `docs/adr/ADR-0069-deal-affiliate-hub.md`
> **상태 (2026-08-20): 코드 완료, 미검증 3건** — 배포·E2E 는 선행 조건(DNS·인증서) 이후.
> `[ ]` 로 남은 항목은 **하지 못한 것**이지 빠뜨린 것이 아니다. 사유를 각 줄에 적었다.
> 각 태스크 그룹은 독립 커밋 단위. 그룹 내 테스트 포함 (Kotest BehaviorSpec + MockK).

## TG1. `:deal:domain` — 순수 도메인

- [x] `settings.gradle.kts` 에 `deal:domain` / `deal:feature` 추가
- [x] `deal/domain/build.gradle.kts` (프레임워크 의존 없음, `:common` 만)
- [x] `RevenueType` / `DisplayStatus` / `LinkStatus` enum
- [x] `Category`, `Offer` — `isVisibleAt(now)`, `requiresDisclosure()`
- [x] 도메인 테스트: `isVisibleAt` 경계(validFrom/Until null·경계시각 동일), `AFFILIATE↔network`
      불변, slug 정규식, `https://` 강제

## TG2. 스키마 + 영속성

- [x] `code-dictionary/app/.../db/migration/V13__deal.sql` — 3 테이블 + 카테고리 5행 시드
      + `display_service` 에 `deal` 행 (`INSERT IGNORE`, href 는 상대경로 `/deal`)
- [x] `deal/feature/build.gradle.kts` (Spring 라이브러리, bootJar 비활성)
- [x] JPA 엔티티 3종 — enum STRING, **FK-as-ID** (연관관계 매핑 없음)
- [x] Repository + 어댑터 (port 는 domain 소유)
- [x] `code-dictionary/app/build.gradle.kts` 에 `implementation(project(":deal:feature"))`
- [x] `CodeDictionaryApplication` 스캔 범위에 `com.kgd.deal` 추가
      (`@EntityScan` / `@ComponentScan` / `@EnableJpaRepositories`)
- [ ] 컨텍스트 로드 통합 테스트 (빈 충돌 · 이중 Flyway 회귀 — ADR-0059 패턴)
      → **미실행**: 기존 `CodeDictionaryContextLoadSpec` 이 Testcontainers MySQL 을 쓰는데
        로컬 Docker 가 기동되지 않는다. HEAD 에서도 동일하게 실패함을 확인해 이 변경과
        무관함은 가렸지만, **@EntityScan 확장이 폴드 컨텍스트를 깨지 않는지는 미검증**이다.
        Docker 기동 후 `./gradlew :code-dictionary:app:test` 로 반드시 확인할 것.

## TG3. 공개 API + 리다이렉터

- [x] `DealQueryService` — 카테고리/오퍼 조회, `isVisibleAt` 를 **쿼리에서** 필터
- [x] `GET /api/v1/deal/categories`, `GET /api/v1/deal/offers?category=` (`ApiResponse<T>`)
      — 응답에 `targetUrl` 을 넣지 않는다
- [x] `DealRedirectController` — `GET /go/{slug}`
  - [x] 302 + `Cache-Control: no-store`, URL 무변조
  - [x] 만료/HOLD → `/?category={code}` 302, 없는 slug → 404
  - [x] 클릭 적재 try/catch — **실패해도 302**
  - [x] Caffeine 캐시 (slug→오퍼 요약, TTL 5분) + 어드민 수정 시 evict
- [x] 테스트: 만료 제외, 클릭 INSERT throw 시에도 302, 만료 slug 302 목적지

## TG4. 어드민 API

- [x] 카테고리 CRUD (`/api/v1/admin/deal/categories`) — 오퍼 있는 카테고리 삭제 시 409
- [x] 오퍼 CRUD (`/api/v1/admin/deal/offers`) + 필터(category/status/linkStatus)
- [x] `GET .../offers/attention` — expiringSoon(14일) / stale(90일 미수정) / broken
- [x] `GET .../offers/{id}/clicks?from=&to=` 일별 집계
- [x] `ROLE_ADMIN` 가드 (gateway `deal-admin` 라우트에 `adminConfig()` 필터)
- [ ] 어드민 가드 테스트 → display/resume 어드민도 라우트 테스트가 없어 같은 상태로 둠

## TG5. 게이트웨이 · 인그레스

- [x] `gateway/.../application.yml` — code-dictionary 라우트에 `/api/v1/deal/**` 추가,
      `/go/**` 별도 라우트 (`deal-redirect`)
- [x] `k8s/overlays/oci-arm/ingresses/commerce-platform.yaml` — `deal.1989v.com` host 블록
      (`/api`, `/go` → gateway, `/` → portal-fe) + `tls.hosts` 추가 + 파일 상단 host 매핑 주석 갱신
- [x] `k8s/overlays/k3s-lite` — `kubectl kustomize` 빌드 통과 확인 (클러스터 기동 검증은 아님)

## TG6. portal-fe — 공개 허브

- [x] `docs/design/k-heritage.html` 열어 재료·표면·활자 맞춘 뒤 시작 (브랜드 면)
- [x] `App.tsx` — `isDealHost`, 루트 분기, `/deal` `dealRoute()` apex 302 (place/game 패턴)
- [x] `DealPage` (lazy chunk) — 고지 배너 → 카테고리 칩 → 오퍼 카드 그리드
- [x] `OfferCard` — merchant/title/benefit/잔여일, `AFFILIATE` 배지,
      `rel` 을 `revenueType` 으로 분기 (`sponsored nofollow noopener` / `nofollow noopener`)
- [x] `api/dealApi.ts`
- [x] deal 호스트에서만 `<meta name="robots" content="noindex, follow">`
- [x] OG 태그 (프리렌더 산출물에서 확인)
- [ ] OG 이미지 1장 → **없음**. 이미지가 없으면 `twitter:card` 가 `summary` 로 떨어져
        공유 카드가 작게 나간다. P1 유입이 공유라 실제로 손해가 크다 — 우선 보완 대상.
- [x] 프리렌더(ADR-0062) 대상에 deal 루트 추가
- [x] FE 테스트: `rel` 분기 · 고지 배너 · `/go/{slug}` 경유 · 배지 (vitest 4건)
- [ ] **CDP 실측 검증** (`docs/standards/fe-visual-verification.md`) — 기기×사이트 테마 4조합
      → 미실행. 색 대비·강제다크 분기는 tsc/build 가 못 잡는다. 배포 전 필수.

## TG7. admin-fe — 어드민 화면

- [x] `DealCategoriesPage` (`DisplayServicesPage` 패턴 복제)
- [x] `DealOffersPage` — 목록/필터 + 등록·수정 모달,
      `revenueType` 에 따라 `network` 필수/비활성 토글,
      `targetUrl` 에 "원본 그대로. 파라미터를 손대지 마세요" 헬프텍스트
- [x] 대시보드에 `DealAttentionPanel` 3줄 요약
- [x] `App.tsx` 라우트 등록

## TG8. 링크 헬스체크 CronJob

- [x] `@Profile("linkcheck") DealLinkCheckRunner : ApplicationRunner`
  - [x] HEAD(5s) → 405 면 `GET Range: bytes=0-0` 1회 재시도
  - [x] 2xx/3xx=OK, 404/410=BROKEN, **403/405/429/timeout=UNKNOWN**
  - [x] 요청 간 300ms 간격, `User-Agent: 1989v-linkcheck/1.0 (+https://deal.1989v.com)`
  - [x] `deal_offer_click` 90일 초과분 삭제
- [x] `k8s/base/deal-linkcheck/cronjob.yaml` — 주 1회,
      `app.kubernetes.io/part-of: commerce-platform` **라벨 필수**, code-dictionary 이미지 재사용,
      `--spring.main.web-application-type=none`
- [x] `k8s/base/network-policy/11-allow-egress-https-public.yaml` 에 `deal-linkcheck` 추가
      (**code-dictionary 는 추가하지 않는다**)
- [x] 상태 판정 테스트 (오탐 등급 분류가 핵심)

## TG9. 문서 동기화

- [x] ADR-0069 상태 `제안` → `채택`
- [x] 루트 `CLAUDE.md` — 서비스 표 + FE 진입 구조 표에 deal 추가
- [ ] `docs/doc-index.lock.json` 갱신 → 재생성 시 4,521줄이 바뀌는데 대부분 이 작업과
      무관한 기존 drift 라 이 PR 에 섞지 않았다. 별도로 한 번 정리할 것.
- [x] `README.md` — 추가하지 않음이 맞다고 판단. 그 표는 **포트를 가진 코어 배포 단위**만
      나열하며 place·game·resume 도 없다. 폴드된 deal 을 넣으면 표의 기준이 무너진다.

---

## 선행 조건 (코드 밖 — 사용자 작업)

| # | 항목 | 미이행 시 |
|---|---|---|
| 1 | Cloudflare DNS `deal` A 레코드 **proxied** | AOP 우회로 발생 (ADR-0061) |
| 2 | 쿠팡 파트너스 사이트 등록 심사 + 지정 고지 문구 | 고지 배너 문구 확정 불가 |
| 3 | 여행 파트너 가입 (트립닷컴·클룩·아고다·마이리얼트립) | 오퍼 데이터 없음 (배포는 가능) |

1 은 **배포 차단**, 2·3 은 데이터 입력의 선행이다.

> **Origin 인증서 재발급은 필요 없다.** `cf-origin-ca-tls` 가 `*.1989v.com` 와일드카드라
> 새 서브도메인을 이미 커버한다 (ADR-0061 §5). 2026-08-20 최초 작성 시 "SAN 추가 재발급"을
> 선행 조건으로 잘못 적었다가 정정 — DNS 를 붙였는데 526 이면 인증서가 아니라 **ingress 미동기화**를
>먼저 의심할 것 (server block 부재 → SNI 불일치 → 기본 인증서 → CF Full(strict) 거부).
