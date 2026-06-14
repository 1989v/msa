package com.kgd.codedictionary.infrastructure.config

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import org.apache.hc.core5.http.HttpHost
import org.opensearch.client.json.jackson.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.transport.OpenSearchTransport
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * ADR-0055 — Elasticsearch → OpenSearch 전환에 따른 raw opensearch-java 클라이언트.
 *
 * Spring Boot 의 elasticsearch auto-configuration 을 더 이상 쓰지 않으므로
 * 명시적으로 transport/client 빈을 구성한다 (search:app 과 동일 패턴).
 *
 * LocalDateTime 등 java.time 직렬화는 JavaTimeModule + ISO 문자열
 * (WRITE_DATES_AS_TIMESTAMPS 비활성) 로 고정 — 인덱스 매핑의 date format 과 일치.
 */
@Configuration
class OpenSearchConfig {

    @Value("\${opensearch.uris:http://localhost:9200}")
    private lateinit var opensearchUri: String

    @Bean(destroyMethod = "close")
    fun openSearchTransport(): OpenSearchTransport {
        val mapper = ObjectMapper()
            .registerKotlinModule()
            .registerModule(JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
        return ApacheHttpClient5TransportBuilder
            .builder(HttpHost.create(opensearchUri))
            .setMapper(JacksonJsonpMapper(mapper))
            .build()
    }

    @Bean
    fun openSearchClient(transport: OpenSearchTransport): OpenSearchClient =
        OpenSearchClient(transport)
}
