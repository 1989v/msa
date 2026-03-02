package com.kgd.common.webclient

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.web.reactive.function.client.WebClient

@Configuration
class WebClientConfig {

    @Bean
    fun webClientBuilder(): WebClient.Builder =
        WebClient.builder()
            .codecs { configurer ->
                configurer.defaultCodecs().maxInMemorySize(2 * 1024 * 1024) // 2MB
            }

    @Bean
    fun defaultWebClient(builder: WebClient.Builder): WebClient =
        builder
            .defaultHeader("Content-Type", "application/json")
            .build()
}
