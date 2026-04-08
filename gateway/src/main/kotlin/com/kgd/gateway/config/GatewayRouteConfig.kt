package com.kgd.gateway.config

import com.kgd.gateway.filter.AuthenticationGatewayFilter
import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class GatewayRouteConfig(
    private val authFilter: AuthenticationGatewayFilter,
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

    @Bean
    fun routeLocator(builder: RouteLocatorBuilder): RouteLocator =
        builder.routes()
            // Auth Service (no authentication required)
            .route("auth-service") { r ->
                r.path("/api/auth/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("lb://auth-service")
            }
            // Auth Role Management (ADMIN only)
            .route("auth-roles") { r ->
                r.path("/api/auth/roles/**")
                    .filters { f ->
                        f.filter(authFilter.apply(adminConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://auth-service")
            }
            // Member Service — /api/members/sso (내부 전용, gateway 비노출)
            // Member Service — /api/members/me (ROLE_USER+)
            .route("member-service") { r ->
                r.path("/api/members/me/**", "/api/members/me")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://member-service")
            }
            // Product Service (ROLE_USER+ for read, ROLE_SELLER+ for write handled at service level)
            .route("product-service") { r ->
                r.path("/api/products/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://product-service")
            }
            // Order Service (ROLE_USER+)
            .route("order-service") { r ->
                r.path("/api/orders/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://order-service")
            }
            // Gifticon Service (ROLE_USER+)
            .route("gifticon-service") { r ->
                r.path("/api/gifticons/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://gifticon-service")
            }
            // Wishlist Service (ROLE_USER+)
            .route("wishlist-service") { r ->
                r.path("/api/wishlist/**", "/api/wishlist")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://wishlist-service")
            }
            // Search Service (ROLE_USER+)
            .route("search-service") { r ->
                r.path("/api/search/**")
                    .filters { f ->
                        f.filter(authFilter.apply(userConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://search-service")
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
                    .uri("lb://inventory-service")
            }
            // Fulfillment Service (ROLE_SELLER+)
            .route("fulfillment-service") { r ->
                r.path("/api/fulfillments/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://fulfillment-service")
            }
            // Warehouse Service (ROLE_SELLER+)
            .route("warehouse-service") { r ->
                r.path("/api/warehouses/**")
                    .filters { f ->
                        f.filter(authFilter.apply(sellerConfig()))
                            .stripPrefix(0)
                    }
                    .uri("lb://warehouse-service")
            }
            .build()
}
