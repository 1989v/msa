package com.kgd.payment.infrastructure.config

import io.swagger.v3.oas.models.info.Info
import org.springdoc.core.models.GroupedOpenApi
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/** 이 도메인의 OpenAPI 그룹 — `/v3/api-docs/payment` */
@Configuration
class PaymentOpenApiConfig {

    @Bean
    fun paymentOpenApiGroup(): GroupedOpenApi = GroupedOpenApi.builder()
        .group("payment")
        .packagesToScan("com.kgd.payment")
        .addOpenApiCustomizer { openApi ->
            openApi.info(Info().title("Payment Service API").description("결제 운영 이슈(어드민) · 토스 웹훅(payment.pg=toss 일 때만)").version("1.0.0"))
        }
        .build()
}
