package com.kgd.common.webclient

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.webclient.WebClientCustomizer
import org.springframework.context.annotation.Bean
import org.springframework.web.reactive.function.client.WebClient

@AutoConfiguration(afterName = ["org.springframework.boot.autoconfigure.web.reactive.function.client.WebClientAutoConfiguration"])
@ConditionalOnClass(WebClient::class)
@ConditionalOnProperty(prefix = "kgd.common.web-client", name = ["enabled"], havingValue = "true", matchIfMissing = false)
class CommonWebClientAutoConfiguration {

    @Bean
    fun commonWebClientCustomizer(): WebClientCustomizer =
        WebClientCustomizer { builder ->
            builder.codecs { configurer ->
                configurer.defaultCodecs().maxInMemorySize(2 * 1024 * 1024)
            }
        }

    @Bean
    @ConditionalOnMissingBean
    fun defaultWebClient(builder: WebClient.Builder): WebClient =
        builder.build()

    @Bean
    @ConditionalOnMissingBean
    fun webClientBuilderFactory(builder: WebClient.Builder): WebClientBuilderFactory =
        WebClientBuilderFactory(builder)
}
