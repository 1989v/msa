package com.kgd.seller.infrastructure.config

import io.swagger.v3.oas.models.info.Info
import org.springdoc.core.models.GroupedOpenApi
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** 이 도메인의 OpenAPI 그룹 — `/v3/api-docs/seller`. 폴드 호스트의 기본 스펙은 도메인이 합쳐진 하나라 그룹으로 가른다. */
@Configuration
class SellerOpenApiConfig {

    @Bean
    fun sellerOpenApiGroup(): GroupedOpenApi = GroupedOpenApi.builder()
        .group("seller")
        .packagesToScan("com.kgd.seller")
        .addOpenApiCustomizer { openApi ->
            openApi.info(Info().title("Seller Service API").description("입점 신청·판매자 포털·판매자 관리 API").version("1.0.0"))
        }
        .build()
}
