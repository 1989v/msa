package com.kgd.search.infrastructure.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class WebClientConfig {

    @Value("\${product.service.url:http://localhost:8081}")
    private lateinit var productServiceUrl: String

    @Bean("productWebClient")
    fun productWebClient(builder: WebClient.Builder): WebClient =
        builder.baseUrl(productServiceUrl).build()
}
