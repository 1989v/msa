package com.kgd.settlement.infrastructure.config

import io.swagger.v3.oas.models.info.Info
import org.springdoc.core.models.GroupedOpenApi
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** 이 도메인의 OpenAPI 그룹 — `/v3/api-docs/settlement` */
@Configuration
class SettlementOpenApiConfig {

    @Bean
    fun settlementOpenApiGroup(): GroupedOpenApi = GroupedOpenApi.builder()
        .group("settlement")
        .packagesToScan("com.kgd.settlement")
        .addOpenApiCustomizer { openApi ->
            openApi.info(Info().title("Settlement Service API").description("판매자 정산서 · 어드민 정산·시산표").version("1.0.0"))
        }
        .build()
}
