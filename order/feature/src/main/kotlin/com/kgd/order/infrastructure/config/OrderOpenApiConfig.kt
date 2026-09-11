package com.kgd.order.infrastructure.config

import io.swagger.v3.oas.models.info.Info
import org.springdoc.core.models.GroupedOpenApi
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * 이 도메인의 OpenAPI 그룹 — `/v3/api-docs/order`.
 *
 * 폴드 호스트는 여러 도메인을 한 JVM 에 담으므로 기본 `/v3/api-docs` 는 전부 합쳐진 하나다.
 * 게이트웨이의 `/api/docs/specs/{service}` 드롭다운이 그 하나를 서비스마다 똑같이 내주면
 * 이름만 다르고 내용이 같은 스펙이 된다 — 실제로 `product` 항목이 Order Service 스펙을 냈다.
 * 그룹을 도메인이 직접 선언해 패키지로 경계를 긋는다. 재분리되어도 경로가 그대로 유효하다.
 */
@Configuration
class OrderOpenApiConfig {

    @Bean
    fun orderOpenApiGroup(): GroupedOpenApi = GroupedOpenApi.builder()
        .group("order")
        .packagesToScan("com.kgd.order")
        .addOpenApiCustomizer { openApi ->
            openApi.info(Info().title("Order Service API").description("주문 관리 API").version("1.0.0"))
        }
        .build()
}
