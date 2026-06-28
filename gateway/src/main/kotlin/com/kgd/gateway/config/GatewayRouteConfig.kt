package com.kgd.gateway.config

import com.kgd.gateway.filter.AuthenticationGatewayFilter
import com.kgd.gateway.filter.IdentityResolutionGatewayFilter
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
    private val identityFilter: IdentityResolutionGatewayFilter,
    private val userKeyResolver: KeyResolver,
    private val redisRateLimiter: RedisRateLimiter,
) {

    private fun userConfig() = AuthenticationGatewayFilter.Config(
        requiredRoles = listOf("ROLE_USER", "ROLE_SELLER", "ROLE_ADMIN")
    )

    private fun sellerConfig() = AuthenticationGatewayFilter.Config(
        requiredRoles = listOf("ROLE_SELLER", "ROLE_ADMIN")
    )

    private fun adminConfig() = AuthenticationGatewayFilter.Config(
        requiredRoles = listOf("ROLE_ADMIN")
    )

    /**
     * Swagger UI 집계 대상 — 서비스명 → 내부 URI (springdoc webmvc-ui 보유 서비스).
     * `/api/docs/specs/{service}` 가 각 서비스의 `/v3/api-docs` 로 프록시되고,
     * gateway 의 springdoc UI (`/api/docs`) 가 이 spec 들을 드롭다운으로 노출한다.
     */
    private val openApiServices = mapOf(
        "product" to "http://product:8081",
        "order" to "http://order:8082",
        "search" to "http://search:8083",
        "inventory" to "http://inventory:8085",
        "gifticon" to "http://gifticon:8086",
        "auth" to "http://auth:8087",
        "fulfillment" to "http://fulfillment:8088",
        "warehouse" to "http://warehouse:8090",
        "recommendation" to "http://recommendation:8092",
        "member" to "http://member:8093",
        "wishlist" to "http://wishlist:8095",
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
            // Auth Service (no authentication required)
            .route("auth-service") { r ->
                r.path("/api/auth/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://auth:8087")
            }
            // Auth Role Management (ADMIN only)
            .route("auth-roles") { r ->
                r.path("/api/auth/roles/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://auth:8087")
            }
            // Member Service — /api/members/sso (내부 전용, gateway 비노출)
            // Member Service — /api/members/me (ROLE_USER+)
            .route("member-service") { r ->
                r.path("/api/members/me/**", "/api/members/me")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://member:8093")
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
                    .uri("http://order:8082")
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
            // Wishlist Service (ROLE_USER+)
            .route("wishlist-service") { r ->
                r.path("/api/wishlist/**", "/api/wishlist")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://wishlist:8095")
            }
            // Search Service — 상품 검색/이벤트 수집은 비로그인 공개. identityFilter 가 optional 인증으로
            // X-User-Id(JWT 있을 때) + X-Anonymous-Id(헤더/쿠키 해소·발급) 를 주입한다 (ADR-0057).
            // debug API 는 /api/v1/search/debug 로 gateway 비노출 경로라 영향 없음.
            .route("search-service") { r ->
                r.path("/api/search/**")
                    .filters { f ->
                        f.filter(identityFilter.apply(IdentityResolutionGatewayFilter.Config()))
                            .stripPrefix(0)
                    }
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
                    .uri("http://inventory:8085")
            }
            // Fulfillment Service (ROLE_SELLER+)
            .route("fulfillment-service") { r ->
                r.path("/api/fulfillments/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://fulfillment:8088")
            }
            // Warehouse Service (ROLE_SELLER+)
            .route("warehouse-service") { r ->
                r.path("/api/warehouses/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri("http://warehouse:8090")
            }
            // Recommendation Service — ADR-0044 Phase 1 (인증 불필요, 메인 페이지 비로그인 사용자도 호출)
            .route("recommendation-service") { r ->
                r.path("/api/v1/recommendations/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("http://recommendation:8092")
            }
            .build()
}
