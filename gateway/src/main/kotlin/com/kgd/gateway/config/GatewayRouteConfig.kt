package com.kgd.gateway.config

import com.kgd.gateway.filter.AuthenticationGatewayFilter
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod

@Configuration
class GatewayRouteConfig(
    private val authFilter: AuthenticationGatewayFilter,
    private val userKeyResolver: KeyResolver,
    private val redisRateLimiter: RedisRateLimiter,
    @Qualifier("adsClientIpKeyResolver") private val adsClientIpKeyResolver: KeyResolver,
    private val adsHostAllowlist: AdsHostAllowlist,
) {
    private companion object {
        // ADR-0059: game:feature 가 code-dictionary:app 에 폴드되어 같은 포트를 공유
        const val ATLAS_URI = "http://atlas:8089"

        /**
         * ADR-0093 — 폴드돼 있던 넷(game·deal·ranking·blog)이 전부 떠나고
         * 자기 도메인(개념 사전·서비스 카탈로그·포트폴리오·전시·이력서)만 남아 `atlas` 가 됐다.
         */
        const val CONTENT_URI = "http://content:8097"

        /** ADR-0093 ② — deal(혜택 링크 허브)은 커머스 성격이라 commerce 로 옮겼다. */
        const val COMMERCE_URI = "http://commerce:8085"

        /** ADR-0098 — 광고 네트워크(ads)는 engagement 에 폴드돼 있다. */
        const val ENGAGEMENT_URI = "http://engagement:8091"
    }

    private fun userConfig() = AuthenticationGatewayFilter.Config(
        requiredRoles = listOf("ROLE_USER", "ROLE_SELLER", "ROLE_ADMIN")
    )

    private fun sellerConfig() = AuthenticationGatewayFilter.Config(
        requiredRoles = listOf("ROLE_SELLER", "ROLE_ADMIN")
    )

    private fun adminConfig() = AuthenticationGatewayFilter.Config(
        requiredRoles = listOf("ROLE_ADMIN")
    )

    /** 게스트 허용 — 토큰이 있으면 식별하고, 없으면 익명으로 통과 (ADR-0059 게임 세션) */
    private fun optionalUserConfig() = AuthenticationGatewayFilter.Config(required = false)

    /**
     * Swagger UI 집계 대상 — 서비스명 → (내부 URI, 업스트림 spec 경로).
     * `/api/docs/specs/{service}` 가 그 경로로 프록시되고, gateway 의 springdoc UI (`/api/docs`)
     * 가 이 spec 들을 드롭다운으로 노출한다.
     *
     * **폴드 호스트는 그룹 경로를 쓴다.** 한 JVM 에 여러 도메인이 있으면 기본 `/v3/api-docs` 는
     * 전부 합쳐진 하나라, 서비스마다 그것을 내주면 이름만 다르고 내용이 같다 — `product` 항목이
     * Order Service 스펙을 내던 것이 그 때문이다. 도메인이 자기 `GroupedOpenApi` 를 선언하고
     * 여기서 `/v3/api-docs/{group}` 을 가리킨다. 단독 파드는 그룹이 없으므로 기본 경로 그대로다.
     */
    private val openApiServices = mapOf(
        // 폴드 도메인 — 그룹 경로 (각 도메인의 infrastructure/config/OpenApiConfig.kt 가 선언)
        "product" to ("http://commerce:8085" to "/v3/api-docs/product"),
        "order" to ("http://commerce:8085" to "/v3/api-docs/order"),
        "inventory" to ("http://commerce:8085" to "/v3/api-docs/inventory"),
        "fulfillment" to ("http://commerce:8085" to "/v3/api-docs/fulfillment"),
        "warehouse" to ("http://commerce:8085" to "/v3/api-docs/warehouse"),
        "seller" to ("http://commerce:8085" to "/v3/api-docs/seller"),
        "payment" to ("http://commerce:8085" to "/v3/api-docs/payment"),
        "promotion" to ("http://commerce:8085" to "/v3/api-docs/promotion"),
        "gifticon" to ("http://sideapp:8095" to "/v3/api-docs/gifticon"),
        "recommendation" to ("http://engagement:8091" to "/v3/api-docs/recommendation"),
        "member" to ("http://account:8093" to "/v3/api-docs/member"),
        "wishlist" to ("http://account:8093" to "/v3/api-docs/wishlist"),
        // 단독 파드 — 그룹이 없으므로 기본 경로
        "search" to ("http://search:8083" to "/v3/api-docs"),
        "auth" to ("http://auth:8087" to "/v3/api-docs"),
    )

    @Bean
    fun routeLocator(builder: RouteLocatorBuilder): RouteLocator =
        builder.routes()
            // OpenAPI spec 프록시 (public — API 문서)
            .apply {
                openApiServices.forEach { (service, target) ->
                    val (uri, specPath) = target
                    route("openapi-$service") { r ->
                        r.path("/api/docs/specs/$service")
                            .filters { f -> f.setPath(specPath) }
                            .uri(uri)
                    }
                }
            }
            // Auth Role Management (ADMIN only) — auth 서비스에 자체 권한 검증이 없어 여기가 유일한
            // 경계다. 공개 라우트인 /api/auth/** 보다 먼저 선언해야 가려지지 않는다.
            .route("auth-roles") { r ->
                r.path("/api/auth/roles/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://auth:8087")
            }
            // Auth Service — 로그인/갱신/로그아웃 (no authentication required)
            .route("auth-service") { r ->
                r.path("/api/auth/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://auth:8087")
            }
            // Member Service — /api/members/sso 는 내부 전용(auth 가 서비스 간 호출)이라 라우트 없음.
            // 목록 API(/api/members)는 member 에 구현체가 없으므로 라우트를 두지 않는다 — 없는 경로는 404.
            // 회원 카운트는 admin 대시보드 전용 (ROLE_ADMIN)
            .route("member-stats") { r ->
                r.path("/api/members/stats/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://account:8093") // ADR-0093: account 폴드
            }
            // Member Service — /api/members/me (ROLE_USER+)
            .route("member-service") { r ->
                r.path("/api/members/me/**", "/api/members/me")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://account:8093") // ADR-0093: account 폴드
            }
            // Product Service — 상품 브라우징(GET)은 비로그인 공개 (커머스 표준: 탐색은 public, 주문은 인증).
            // 필터는 신원 헤더 위조를 벗기려고 건다(게스트 허용). `/internal/products/**` 는 라우트가 없다 —
            // 일괄 적재는 search-batch 가 클러스터 안에서 직접 부른다.
            .route("product-service-read") { r ->
                r.method(HttpMethod.GET)
                    .and().path("/api/v1/products/**")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI) // ADR-0093: commerce 폴드
            }
            // Product Service 쓰기 — 판매자·어드민만. "자기 상품인가"는 서비스가 X-User-Roles 로 다시 판정한다.
            .route("product-service-write") { r ->
                r.path("/api/v1/products/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI) // ADR-0093: commerce 폴드
            }
            // 상품 어드민(이벤트 재발행) — 어드민 전용 (서비스도 역할을 다시 본다)
            .route("product-admin") { r ->
                r.path("/api/v1/admin/products/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // 주문 매출 통계 — 어드민 대시보드 전용 (서비스도 역할을 다시 본다)
            .route("order-admin") { r ->
                r.path("/api/v1/admin/orders/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // === ADR-0099 판매자 (commerce 폴드) ===
            // 게이트웨이는 역할까지만 본다. "ACTIVE 판매자 행인가"는 서비스가 매 요청 X-User-Id 로 다시 본다 —
            // 정지는 토큰 만료를 기다리지 않고 바로 막혀야 한다.
            .route("seller-admin") { r ->
                r.path("/api/v1/admin/sellers", "/api/v1/admin/sellers/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // 입점 신청과 내 신청 상태 — 로그인 회원 누구나(1인 1판매자는 서비스가 본다).
            // 상태 조회가 ROLE_SELLER 뒤에 있으면 심사 중·반려·정지 회원이 자기 상태를 못 본다
            .route("seller-apply") { r ->
                r.path("/api/v1/sellers/apply", "/api/v1/sellers/me")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // 판매자 포털 API — ROLE_SELLER. 필터는 ROLE_ADMIN 을 모든 역할의 상위로 통과시키지만
            // 판매자 행이 없는 어드민은 서비스가 403 으로 막는다.
            .route("seller-portal") { r ->
                r.path("/api/v1/seller/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // === ADR-0099 결제 (commerce 폴드) ===
            // 운영 이슈(결과 미상 소진·대사 불일치) — 어드민 전용
            .route("payment-admin") { r ->
                r.path("/api/v1/admin/payments", "/api/v1/admin/payments/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // 토스 웹훅 — 토스 서버가 부르므로 공개다. 검증은 서비스가 한다(공유 비밀 + PG 재조회).
            // 신원 헤더를 벗겨 위조 X-User-Id 가 백엔드에 닿지 않게 하고, 공개 쓰기라 레이트 리밋을 건다.
            // 컨트롤러는 payment.pg=toss 일 때만 생긴다 — 운영(모의 PG)에서는 여기를 지나 404 다.
            .route("payment-webhook-toss") { r ->
                r.method(HttpMethod.POST)
                    .and().path("/api/v1/payments/webhooks/toss")
                    .filters { f ->
                        f.removeRequestHeader("X-User-Id")
                            .removeRequestHeader("X-User-Roles")
                            .removeRequestHeader("Authorization")
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // === ADR-0099 혜택 (commerce 폴드) ===
            // 쿠폰 정의·포인트 지급 — 어드민 전용
            .route("promotion-admin") { r ->
                r.path("/api/v1/admin/promotions", "/api/v1/admin/promotions/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // 내 쿠폰·포인트, 쿠폰 받기 — 로그인 회원. 본인 것만은 서비스가 X-User-Id 로 본다.
            // 경로를 셋으로 좁혀 둔다 — /api/v1/coupons/** 로 열면 나중에 생기는 경로가 검토 없이 노출된다
            .route("promotion-user") { r ->
                r.path("/api/v1/coupons/me", "/api/v1/points/me", "/api/v1/coupons/{definitionId}/claim")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // === ADR-0099 주문서 · 장바구니 (commerce 폴드) — ROLE_USER. 본인 것만은 서비스가 X-User-Id 로 본다 ===
            // 주문서 생성은 읽기 모델 조회 여러 번 + 쓰기라 레이트 리밋을 건다 (SR-4)
            .route("order-sheet") { r ->
                r.path("/api/v1/order-sheets", "/api/v1/order-sheets/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            .route("cart") { r ->
                r.path("/api/v1/cart", "/api/v1/cart/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // 클레임(취소·부분 취소·환불 미리보기) — ROLE_USER. 본인 주문만은 서비스가 X-User-Id 로 본다.
            // 판매자 결정(/api/v1/seller/claims/**)은 seller-portal 라우트가 ROLE_SELLER 로 받는다
            .route("claim") { r ->
                r.path("/api/v1/claims", "/api/v1/claims/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // Order Service (ROLE_USER+)
            .route("order-service") { r ->
                r.path("/api/v1/orders/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            // Gifticon Service (ROLE_USER+)
            .route("gifticon-service") { r ->
                r.path("/api/gifticons/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://sideapp:8095") // ADR-0093: sideapp 폴드
            }
            // 찜 **수**만 공개다 — 게임 상세가 "좋아요" 자리에 쓴다.
            // 라우트를 앞에 두는 것은 아래 wishlist-service 가 /api/v1/wishlist/** 를 통째로
            // 잡기 때문이고, 뒤에 두면 영영 안 걸린다. 개인 목록은 그대로 로그인 전용이다.
            .route("wishlist-count-public") { r ->
                r.path("/api/v1/wishlist/count")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://account:8093") // ADR-0093: account 폴드
            }
            // Wishlist Service (ROLE_USER+) — 찜은 로그인 전용, 게이트웨이가 인증 경계 (ADR-0074)
            .route("wishlist-service") { r ->
                r.path("/api/v1/wishlist/**", "/api/v1/wishlist")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://account:8093") // ADR-0093: account 폴드
            }
            // Search Service — 상품 검색/이벤트 수집은 비로그인 공개 (userId 는 optional 필드).
            // debug API 는 /api/v1/search/debug 로 gateway 비노출 경로라 영향 없음.
            .route("search-service") { r ->
                r.path("/api/search/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://search:8083")
            }
            // Inventory Service — Rate Limiter 적용 (ROLE_SELLER+)
            .route("inventory-service") { r ->
                r.path("/api/inventories/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri("http://commerce:8085")
            }
            // Fulfillment Service (ROLE_SELLER+)
            .route("fulfillment-service") { r ->
                r.path("/api/fulfillments/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://commerce:8085")
            }
            // Warehouse (ADR-0058: commerce 폴드 — inventory:app 이 warehouse 엔드포인트 서빙)
            .route("warehouse-service") { r ->
                r.path("/api/warehouses/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://commerce:8085")
            }
            // Recommendation Service — ADR-0044 Phase 1 (인증 불필요, 메인 페이지 비로그인 사용자도 호출)
            // ADR-0093: recommendation + experiment 가 engagement 파드로 폴드됐다.
            .route("recommendation-service") { r ->
                r.path("/api/v1/recommendations/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://engagement:8091")
            }
            // === ADR-0059 Game 플랫폼 (code-dictionary:app 에 폴드) ===
            // 인증 수준이 다른 3종을 분리하며, 좁은 경로를 먼저 선언해야 games/** 에 가려지지 않는다.
            // 비밀 게임 관문 — **필터를 걸지 않는다.** 이 엔드포인트는 정적 파일 요청을 대신
            // 판정하는 자리라 Authorization 헤더가 없고, 도메인 쿠키를 스스로 읽어 검증한다
            // (브라우저가 .wasm 을 받을 때 붙일 수 있는 신원은 쿠키뿐이다).
            // 카탈로그의 넓은 경로보다 **먼저** 선언해야 가려지지 않는다.
            .route("game-private-gate") { r ->
                r.path("/api/v1/games/private/*/allow")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CONTENT_URI)
            }
            .route("game-admin") { r ->
                r.path("/api/v1/admin/games/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 평점 — 회원은 1인 1표, 비로그인은 기기 1표(X-Device-Id). 게임 호스트에 로그인
            // 진입점이 없어 인증 필수 규칙이 기능을 죽이고 있었다. 익명 쓰기라 Rate Limiter 를 건다.
            .route("game-rating") { r ->
                r.path("/api/v1/games/*/rating")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 클라우드 세이브 — 게스트 허용(이어하기 코드로 식별). 익명 쓰기라 Rate Limiter 를 건다
            .route("game-save") { r ->
                r.path("/api/v1/games/*/save")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 플레이 세션·로그라이크 런은 게스트 허용 — 로그인 사용자만 X-User-Id 로 식별
            .route("game-session") { r ->
                r.path(
                    "/api/v1/games/*/sessions", "/api/v1/games/*/sessions/**",
                    "/api/v1/games/*/runs", "/api/v1/games/*/runs/**",
                )
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 내 기록 — **로그인 전용**. 아래 카탈로그가 /api/v1/games/** 를 필터 없이 받으므로
            // 여기서 먼저 잡지 않으면 두 가지가 동시에 터진다: 필터가 없어 X-User-Id 가
            // 주입되지 않아 로그인 사용자도 401 이고, 동시에 손으로 붙인 X-User-Id 가
            // 걸러지지 않아 **아무 회원의 기록을 열람**할 수 있다.
            .route("game-my-record") { r ->
                r.path("/api/v1/games/*/me")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 점수 제출 — 게스트 허용. 로그인 사용자만 X-User-Id 로 식별해 기록을 잇는다.
            // 필터가 없으면 신원 헤더 위조로 남의 이름에 점수를 귀속시킬 수 있다.
            .route("game-score-submit") { r ->
                r.path("/api/v1/games/*/scores")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 개선 제안 읽기 — 본문·상태·답글이 전부 공개라 게스트도 읽는다. 필터를 거는 것은
            // 「내 글인가」를 서버가 판정하기 위해서다: 필터가 없으면 클라이언트가 붙인
            // X-User-Id 가 그대로 통과해 남의 글에 수정 버튼이 그려진다.
            .route("game-suggestion-read") { r ->
                r.method(HttpMethod.GET)
                    .and().path("/api/v1/games/*/suggestions", "/api/v1/games/*/suggestions/**")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 제안 등록·수정·답글 — **로그인 필수**. 위 읽기 라우트가 GET 을 먼저 가져가므로
            // 여기에는 쓰기만 남는다. 소유권과 운영자 자격은 서비스가 판정한다.
            .route("game-suggestion-write") { r ->
                r.path("/api/v1/games/*/suggestions", "/api/v1/games/*/suggestions/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 친구 그룹 — **로그인 전용**. 담긴 것이 별칭 목록이라 남의 것이 열리면 그 사람
            // 지인의 이름을 보게 된다. 아래 카탈로그가 /api/v1/games/** 를 필터 없이 받으므로
            // 여기서 먼저 잡지 않으면 손으로 붙인 X-User-Id 하나로 아무 회원의 그룹을
            // 읽고 고치고 지울 수 있다.
            .route("game-party-roster") { r ->
                r.path("/api/v1/games/party/rosters", "/api/v1/games/party/rosters/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 파티 판 진행 (투표·채점·결과 해시) — 게스트 허용. 초대 링크로 들어온 사람이
            // 참가자라 로그인을 요구하지 않고, 신원은 릴레이가 좌석을 줄 때 발급한 토큰이 갖는다.
            // 필터를 거는 것은 클라이언트가 위조한 신원 헤더를 벗기기 위해서다.
            .route("game-party-room") { r ->
                r.path("/api/v1/games/party/rooms/**")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 카탈로그 조회 (리스트/상세/유사/컬렉션/태그) — 공개
            .route("game-catalog") { r ->
                r.path("/api/v1/games/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CONTENT_URI)
            }
            // 온라인 대전 릴레이 (raw WebSocket) — 게스트 허용. 브라우저 WebSocket 은 Authorization
            // 헤더를 붙일 수 없어 항상 익명 경로를 타고, 필터는 클라이언트가 위조한 신원 헤더를 벗긴다.
            // Spring Cloud Gateway 는 http:// URI 로도 Upgrade 를 프록시한다 (WebsocketRoutingFilter).
            .route("game-relay-ws") { r ->
                r.path("/ws/games/**")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // === ADR-0098 광고 네트워크 (engagement 폴드) ===
            // /api/v1/ads/** 캐치올을 두지 않는다 — 경로마다 인증 수준이 달라, 넓은 라우트가 있으면
            // 목록에 없는 경로가 게스트 필터로 새어 나간다. 좁은 인증 순서(어드민 → 광고주 → 공개)로 선언한다.
            .route("ads-admin") { r ->
                r.path("/api/v1/admin/ads", "/api/v1/admin/ads/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(ENGAGEMENT_URI)
            }
            // 광고주 콘솔 — 로그인까지만 엣지가 본다. 「내 캠페인인가」는 서비스가 판정한다.
            .route("ads-advertiser") { r ->
                r.path("/api/v1/ads/advertiser", "/api/v1/ads/advertiser/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(ENGAGEMENT_URI)
            }
            // 결정·이벤트·클릭·에셋·옛 지면 조회 — 게스트 허용. 필터는 위조 신원 헤더를 벗기고,
            // 로그인 사용자면 X-User-Id 를 실어 결정 단계의 광고주 본인 판정이 쓰게 한다.
            // Host 허용 목록 밖(rt 등)은 404 — 리미터 키 CF-Connecting-IP 를 믿을 수 있는 호스트만 받는다.
            .route("ads-public") { r ->
                r.path(
                    "/api/v1/ads/decisions",
                    "/api/v1/ads/events",
                    "/api/v1/ads/click/**",
                    "/api/v1/ads/assets/**",
                    "/api/v1/ads/placements/**",
                )
                    .and().predicate { adsHostAllowlist.allows(it) }
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(adsClientIpKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(ENGAGEMENT_URI)
            }
            // 포트폴리오 (code-dictionary 소유) — 공개 조회 + 로그인 시 스니펫 게이트 해제.
            // YAML 무인증 라우트에서 이동: 필터 없이는 X-User-Id 가 주입되지 않아 로그인 해제가
            // 죽고, 위조 신원 헤더도 그대로 통과했다 (필터가 익명 요청의 신원 헤더를 벗긴다).
            .route("portfolio-service") { r ->
                r.path("/api/v1/portfolio/**")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(ATLAS_URI)
            }
            // === ADR-0064 이력서 사이트 (code-dictionary 소유) ===
            // 공개 조회는 인증 없이 통과시키고, 열람 가부는 서비스의 토큰 게이트가 판정한다.
            // 어드민 경로를 먼저 선언해야 공개 라우트에 가려지지 않는다.
            .route("resume-admin") { r ->
                r.path("/api/v1/admin/resume/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(ATLAS_URI)
            }
            .route("resume-public") { r ->
                r.path("/api/v1/resume/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(ATLAS_URI)
            }
            // === ADR-0066 메인 전시 (code-dictionary 소유) ===
            // 어드민 경로를 먼저 선언해야 공개 라우트에 가려지지 않는다.
            .route("display-admin") { r ->
                r.path("/api/v1/admin/display/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(ATLAS_URI)
            }
            .route("display-public") { r ->
                r.path("/api/v1/display/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(ATLAS_URI)
            }
            // === /tech 업무 도메인 맵 (code-dictionary 소유) ===
            // 개념↔업무 도메인 매핑. 공개 포트폴리오 면이라 인증 없음.
            .route("tech-domains") { r ->
                r.path("/api/v1/tech/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(ATLAS_URI)
            }
            // === ADR-0081 랭킹 리더보드 (code-dictionary 소유) ===
            // 공개 조회만 연다. 수집기가 쓰는 `/internal` 하위는 여기 없다 — 클러스터 안에서
            // 직접 부르므로 게이트웨이를 통과할 이유가 없고, 열면 외부에서 적재가 가능해진다.
            .route("ranking-public") { r ->
                r.path("/api/v1/ranking/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CONTENT_URI)
            }
            // === ADR-0069 혜택 링크 허브 (code-dictionary 소유) ===
            // 어드민 경로를 먼저 선언해야 공개 라우트에 가려지지 않는다.
            .route("deal-admin") { r ->
                r.path("/api/v1/admin/deal/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(COMMERCE_URI)
            }
            .route("deal-public") { r ->
                r.path("/api/v1/deal/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(COMMERCE_URI)
            }
            // 아웃바운드 리다이렉터. `/api/v1/deal/go/...` 가 아니라 `/go/...` 인 이유는 이 주소가
            // 공유되기 때문이다. ingress 는 deal 호스트에만 이 prefix 를 연다.
            .route("deal-redirect") { r ->
                r.path("/go/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(COMMERCE_URI)
            }
            // === ADR-0072 블로그 플랫폼 (code-dictionary 소유) ===
            // 좁은 경로부터 선언한다 — 선언 순서가 곧 우선순위라, 공개 라우트를 먼저 두면
            // 스튜디오·어드민 경로가 인증 없이 통과한다.
            .route("blog-admin") { r ->
                r.path("/api/v1/admin/blog/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 작성자 스튜디오 — 로그인까지만 엣지가 본다. "저자인가"·"내 글인가"는
            // 서비스가 판정한다 (소유권은 게이트웨이가 알 수 없는 정보다).
            .route("blog-studio") { r ->
                r.path("/api/v1/blog/me/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 댓글은 로그인 필수 + Rate Limiter. 스팸이 익명에서만 오지는 않는다.
            .route("blog-comments") { r ->
                r.path("/api/v1/blog/comments", "/api/v1/blog/comments/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 좋아요·평점은 익명 허용(방문자 1표). 익명 쓰기라 Rate Limiter 를 건다 —
            // 게임 평점과 같은 판단이다.
            .route("blog-reaction") { r ->
                r.path("/api/v1/blog/posts/*/like", "/api/v1/blog/posts/*/rating")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI)
            }
            // 목록·상세·카테고리·작성자 공간 조회 — 공개.
            // 인증 필터를 걸지 않아도 게이트웨이가 채운 신원 헤더는 그대로 전달되므로,
            // 로그인 사용자의 "내가 누른 좋아요" 표시는 동작한다.
            .route("blog-public") { r ->
                r.path("/api/v1/blog/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CONTENT_URI)
            }
            // 글 상세·작성자 공간의 HTML (meta 주입, ADR-0072 §6).
            // `/api` 밑이 아닌 이유는 이 주소가 공유되기 때문이다 — deal 의 `/go` 와 같은 판단.
            // ingress 는 blog 호스트에만 이 prefix 를 연다.
            .route("blog-page") { r ->
                r.path("/posts/**", "/authors/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CONTENT_URI)
            }
            // Place Service — 지역/POI 근처검색 조회는 비로그인 공개 (탐색). 쓰기(적재)는 ADMIN. (ADR-0056)
            .route("place-service-read") { r ->
                r.method(HttpMethod.GET)
                    .and().path("/api/places/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CONTENT_URI) // ADR-0093: content 폴드
            }
            .route("place-service-write") { r ->
                r.path("/api/places/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CONTENT_URI) // ADR-0093: content 폴드
            }
            .build()
}
