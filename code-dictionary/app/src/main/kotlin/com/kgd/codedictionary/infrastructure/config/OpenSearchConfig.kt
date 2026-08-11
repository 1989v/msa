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
 *
 * **여기만 Jackson 2 를 쓴다 (ADR-0067).** `JacksonJsonpMapper` 가 opensearch-java 의
 * 클래스이고 그 라이브러리가 Jackson 2 로 빌드돼 있어 Jackson 3 매퍼를 넘길 수 없다.
 * 서비스 자체 JSON 은 Jackson 3 이며, 이 경계는 opensearch-java 가 Jackson 3 를 지원할 때
 * 함께 옮긴다. 그때까지 이 매퍼는 OpenSearch 전송에만 쓰이고 밖으로 새지 않는다.
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
