package com.kgd.place.infrastructure.opensearch

import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.cfg.DateTimeFeature
import tools.jackson.module.kotlin.jacksonMapperBuilder
import org.apache.hc.core5.http.HttpHost
import org.opensearch.client.json.jackson3.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.transport.OpenSearchTransport
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

/**
 * ADR-0056 Part 2 — POI geo_distance 검색용 raw opensearch-java 클라이언트
 * (search 서비스 OpenSearchConfig 와 동일 패턴).
 */
@Configuration
class OpenSearchConfig {

    @Value("\${opensearch.uris:http://localhost:9200}")
    private lateinit var opensearchUri: String

    @Bean(destroyMethod = "close")
    fun openSearchTransport(): OpenSearchTransport {
        val mapper = jacksonMapperBuilder()
            .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
            .build()
        return ApacheHttpClient5TransportBuilder
            .builder(HttpHost.create(opensearchUri))
            .setMapper(JacksonJsonpMapper(mapper))
            .build()
    }

    @Bean
    fun openSearchClient(transport: OpenSearchTransport): OpenSearchClient =
        OpenSearchClient(transport)
}
