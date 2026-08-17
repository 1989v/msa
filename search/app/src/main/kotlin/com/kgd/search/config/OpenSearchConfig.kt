package com.kgd.search.infrastructure.config

import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import org.apache.hc.core5.http.HttpHost
import org.opensearch.client.json.jackson3.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * ADR-0055 — Spring Data Elasticsearch 제거 후 raw opensearch-java 클라이언트.
 *
 * LocalDateTime 등 java.time 직렬화는 ISO 문자열
 * (WRITE_DATES_AS_TIMESTAMPS 비활성) 로 고정 — 인덱스 매핑의
 * `yyyy-MM-dd'T'HH:mm:ss` date format 과 일치시킨다.
 */
@Configuration
class OpenSearchConfig {

    @Value("\${opensearch.uris:http://localhost:9200}")
    private lateinit var opensearchUri: String

    @Bean(destroyMethod = "close")
    fun openSearchTransport(): org.opensearch.client.transport.OpenSearchTransport {
        val mapper = jacksonMapperBuilder()
            .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
            /*
             * Jackson 3 은 `FAIL_ON_TRAILING_TOKENS` 가 기본 활성이다 (2 에서는 비활성).
             * opensearch-java 는 검색 응답 **안쪽의 부분 객체**를 파서 위치에서 읽어가는데,
             * 그러면 바깥 구조에 남은 토큰이 트레일링으로 잡혀 역직렬화가 실패한다.
             * 데이터가 잘못된 게 아니라 스트리밍 역직렬화 계약이 어긋난 것이므로 끈다.
             */
            .disable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .build()
        return ApacheHttpClient5TransportBuilder
            .builder(HttpHost.create(opensearchUri))
            .setMapper(JacksonJsonpMapper(mapper))
            .build()
    }

    @Bean
    fun openSearchClient(transport: org.opensearch.client.transport.OpenSearchTransport): OpenSearchClient =
        OpenSearchClient(transport)
}
