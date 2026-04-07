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

    @Bean
    fun routeLocator(builder: RouteLocatorBuilder): RouteLocator =
        builder.routes()
            // Auth Service (no authentication required)
            .route("auth-service") { r ->
                r.path("/api/auth/**")
                    .filters { f -> f.stripPrefix(0) }
                    .uri("lb://auth-service")
            }
            // Product Service
            .route("product-service") { r ->
                r.path("/api/products/**")
                    .filters { f ->
                        f.filter(authFilter.apply(AuthenticationGatewayFilter.Config()))
                            .stripPrefix(0)
                    }
                    .uri("lb://product-service")
            }
            // Order Service
            .route("order-service") { r ->
                r.path("/api/orders/**")
                    .filters { f ->
                        f.filter(authFilter.apply(AuthenticationGatewayFilter.Config()))
                            .stripPrefix(0)
                    }
                    .uri("lb://order-service")
            }
            // Gifticon Service
            .route("gifticon-service") { r ->
                r.path("/api/gifticons/**")
                    .filters { f ->
                        f.filter(authFilter.apply(AuthenticationGatewayFilter.Config()))
                            .stripPrefix(0)
                    }
                    .uri("lb://gifticon-service")
            }
            // Search Service (authentication required)
            .route("search-service") { r ->
                r.path("/api/search/**")
                    .filters { f ->
                        f.filter(authFilter.apply(AuthenticationGatewayFilter.Config()))
                            .stripPrefix(0)
                    }
                    .uri("lb://search-service")
            }
            // Inventory Service — Rate Limiter 적용 (Flash Sale 트래픽 보호)
            .route("inventory-service") { r ->
                r.path("/api/inventories/**")
                    .filters { f ->
                        f.filter(authFilter.apply(AuthenticationGatewayFilter.Config()))
                            .requestRateLimiter { config ->
                                config.setRateLimiter(redisRateLimiter)
                                config.setKeyResolver(userKeyResolver)
                                config.setDenyEmptyKey(false)
                            }
                            .stripPrefix(0)
                    }
                    .uri("lb://inventory-service")
            }
            // Fulfillment Service
            .route("fulfillment-service") { r ->
                r.path("/api/fulfillments/**")
                    .filters { f ->
                        f.filter(authFilter.apply(AuthenticationGatewayFilter.Config()))
                            .stripPrefix(0)
                    }
                    .uri("lb://fulfillment-service")
            }
            // Warehouse Service
            .route("warehouse-service") { r ->
                r.path("/api/warehouses/**")
                    .filters { f ->
                        f.filter(authFilter.apply(AuthenticationGatewayFilter.Config()))
                            .stripPrefix(0)
                    }
                    .uri("lb://warehouse-service")
            }
            .build()
}
