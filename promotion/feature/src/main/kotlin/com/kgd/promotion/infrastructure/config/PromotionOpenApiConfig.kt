package com.kgd.promotion.infrastructure.config

import io.swagger.v3.oas.models.info.Info
import org.springdoc.core.models.GroupedOpenApi
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** 이 도메인의 OpenAPI 그룹 — `/v3/api-docs/promotion` */
@Configuration
class PromotionOpenApiConfig {

    @Bean
    fun promotionOpenApiGroup(): GroupedOpenApi = GroupedOpenApi.builder()
        .group("promotion")
        .packagesToScan("com.kgd.promotion")
        .addOpenApiCustomizer { openApi ->
            openApi.info(Info().title("Promotion Service API").description("내 쿠폰·포인트 · 쿠폰 받기 · 어드민 쿠폰 정의·포인트 지급").version("1.0.0"))
        }
        .build()
}
