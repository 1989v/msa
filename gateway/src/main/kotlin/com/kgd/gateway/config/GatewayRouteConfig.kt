package com.kgd.gateway.config

import com.kgd.gateway.filter.AuthenticationGatewayFilter
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class GatewayRouteConfig(
    private val authFilter: AuthenticationGatewayFilter
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
            .build()
}
