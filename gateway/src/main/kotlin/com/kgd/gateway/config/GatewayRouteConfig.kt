package com.kgd.gateway.config

import com.kgd.gateway.filter.AuthenticationGatewayFilter
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
) {
    private companion object {
        // ADR-0059: game:feature 가 code-dictionary:app 에 폴드되어 같은 포트를 공유
        const val CODE_DICTIONARY_URI = "http://code-dictionary:8089"
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
     * Swagger UI 집계 대상 — 서비스명 → 내부 URI (springdoc webmvc-ui 보유 서비스).
     * `/api/docs/specs/{service}` 가 각 서비스의 `/v3/api-docs` 로 프록시되고,
     * gateway 의 springdoc UI (`/api/docs`) 가 이 spec 들을 드롭다운으로 노출한다.
     */
    private val openApiServices = mapOf(
        "product" to "http://product:8081",
        "order" to "http://commerce:8085", // ADR-0058: commerce 폴드 (inventory:app 서빙)
        "search" to "http://search:8083",
        "inventory" to "http://commerce:8085",
        "gifticon" to "http://gifticon:8086",
        "auth" to "http://auth:8087",
        "fulfillment" to "http://commerce:8085", // ADR-0058: commerce 폴드 (inventory:app 서빙)
        "warehouse" to "http://commerce:8085", // ADR-0058: commerce 폴드 (inventory:app 서빙)
        "recommendation" to "http://recommendation:8092",
        "member" to "http://commerce:8085",
        "wishlist" to "http://commerce:8085",
    )

    @Bean
    fun routeLocator(builder: RouteLocatorBuilder): RouteLocator =
        builder.routes()
            // OpenAPI spec 프록시 (public — API 문서)
            .apply {
                openApiServices.forEach { (service, uri) ->
                    route("openapi-$service") { r ->
                        r.path("/api/docs/specs/$service")
                            .filters { f -> f.setPath("/v3/api-docs") }
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
                    .uri("http://commerce:8085")
            }
            // Member Service — /api/members/me (ROLE_USER+)
            .route("member-service") { r ->
                r.path("/api/members/me/**", "/api/members/me")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://commerce:8085")
            }
            // Product Service — 상품 브라우징(GET)은 비로그인 공개 (커머스 표준: 탐색은 public, 주문은 인증)
            .route("product-service-read") { r ->
                r.method(HttpMethod.GET)
                    .and().path("/api/products/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://product:8081")
            }
            // Product Service 쓰기 (ROLE_SELLER+ 검증은 service level 의 X-User-Roles 로 처리)
            .route("product-service-write") { r ->
                r.path("/api/products/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://product:8081")
            }
            // Order Service (ROLE_USER+)
            .route("order-service") { r ->
                r.path("/api/orders/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://commerce:8085")
            }
            // Gifticon Service (ROLE_USER+)
            .route("gifticon-service") { r ->
                r.path("/api/gifticons/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://gifticon:8086")
            }
            // 찜 **수**만 공개다 — 게임 상세가 "좋아요" 자리에 쓴다.
            // 라우트를 앞에 두는 것은 아래 wishlist-service 가 /api/v1/wishlist/** 를 통째로
            // 잡기 때문이고, 뒤에 두면 영영 안 걸린다. 개인 목록은 그대로 로그인 전용이다.
            .route("wishlist-count-public") { r ->
                r.path("/api/v1/wishlist/count")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://commerce:8085")
            }
            // Wishlist Service (ROLE_USER+) — 찜은 로그인 전용, 게이트웨이가 인증 경계 (ADR-0074)
            .route("wishlist-service") { r ->
                r.path("/api/v1/wishlist/**", "/api/v1/wishlist")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://commerce:8085")
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
            .route("recommendation-service") { r ->
                r.path("/api/v1/recommendations/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://recommendation:8092")
            }
            // === ADR-0059 Game 플랫폼 (code-dictionary:app 에 폴드) ===
            // 인증 수준이 다른 3종을 분리하며, 좁은 경로를 먼저 선언해야 games/** 에 가려지지 않는다.
            .route("game-admin") { r ->
                r.path("/api/v1/admin/games/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
            }
            // 점수 제출 — 게스트 허용. 로그인 사용자만 X-User-Id 로 식별해 기록을 잇는다.
            // 필터가 없으면 신원 헤더 위조로 남의 이름에 점수를 귀속시킬 수 있다.
            .route("game-score-submit") { r ->
                r.path("/api/v1/games/*/scores")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CODE_DICTIONARY_URI)
            }
            // 카탈로그 조회 (리스트/상세/유사/컬렉션/태그) — 공개
            .route("game-catalog") { r ->
                r.path("/api/v1/games/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
            }
            // 광고 슬롯/보상 (HOUSE, ADR-0059 §3) — 게스트 허용, 로그인 시 X-User-Id 식별
            .route("game-ads") { r ->
                r.path("/api/v1/ads/**")
                    .filters { f ->
                        f.filter(authFilter.apply(optionalUserConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
            }
            .route("resume-public") { r ->
                r.path("/api/v1/resume/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
            }
            // === ADR-0066 메인 전시 (code-dictionary 소유) ===
            // 어드민 경로를 먼저 선언해야 공개 라우트에 가려지지 않는다.
            .route("display-admin") { r ->
                r.path("/api/v1/admin/display/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CODE_DICTIONARY_URI)
            }
            .route("display-public") { r ->
                r.path("/api/v1/display/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
            }
            // === /tech 업무 도메인 맵 (code-dictionary 소유) ===
            // 개념↔업무 도메인 매핑. 공개 포트폴리오 면이라 인증 없음.
            .route("tech-domains") { r ->
                r.path("/api/v1/tech/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
            }
            // === ADR-0081 랭킹 리더보드 (code-dictionary 소유) ===
            // 공개 조회만 연다. 수집기가 쓰는 `/internal` 하위는 여기 없다 — 클러스터 안에서
            // 직접 부르므로 게이트웨이를 통과할 이유가 없고, 열면 외부에서 적재가 가능해진다.
            .route("ranking-public") { r ->
                r.path("/api/v1/ranking/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
            }
            // === ADR-0069 혜택 링크 허브 (code-dictionary 소유) ===
            // 어드민 경로를 먼저 선언해야 공개 라우트에 가려지지 않는다.
            .route("deal-admin") { r ->
                r.path("/api/v1/admin/deal/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CODE_DICTIONARY_URI)
            }
            .route("deal-public") { r ->
                r.path("/api/v1/deal/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
            }
            // 아웃바운드 리다이렉터. `/api/v1/deal/go/...` 가 아니라 `/go/...` 인 이유는 이 주소가
            // 공유되기 때문이다. ingress 는 deal 호스트에만 이 prefix 를 연다.
            .route("deal-redirect") { r ->
                r.path("/go/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
            }
            // 작성자 스튜디오 — 로그인까지만 엣지가 본다. "저자인가"·"내 글인가"는
            // 서비스가 판정한다 (소유권은 게이트웨이가 알 수 없는 정보다).
            .route("blog-studio") { r ->
                r.path("/api/v1/blog/me/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
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
                    .uri(CODE_DICTIONARY_URI)
            }
            // 목록·상세·카테고리·작성자 공간 조회 — 공개.
            // 인증 필터를 걸지 않아도 게이트웨이가 채운 신원 헤더는 그대로 전달되므로,
            // 로그인 사용자의 "내가 누른 좋아요" 표시는 동작한다.
            .route("blog-public") { r ->
                r.path("/api/v1/blog/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
            }
            // 글 상세·작성자 공간의 HTML (meta 주입, ADR-0072 §6).
            // `/api` 밑이 아닌 이유는 이 주소가 공유되기 때문이다 — deal 의 `/go` 와 같은 판단.
            // ingress 는 blog 호스트에만 이 prefix 를 연다.
            .route("blog-page") { r ->
                r.path("/posts/**", "/authors/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri(CODE_DICTIONARY_URI)
            }
            // Place Service — 지역/POI 근처검색 조회는 비로그인 공개 (탐색). 쓰기(적재)는 ADMIN. (ADR-0056)
            .route("place-service-read") { r ->
                r.method(HttpMethod.GET)
                    .and().path("/api/places/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://place:8096")
            }
            .route("place-service-write") { r ->
                r.path("/api/places/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://place:8096")
            }
            .build()
}
