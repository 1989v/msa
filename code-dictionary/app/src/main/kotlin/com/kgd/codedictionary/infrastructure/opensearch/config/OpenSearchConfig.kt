package com.kgd.codedictionary.infrastructure.opensearch.config

import org.apache.hc.core5.http.HttpHost
import org.opensearch.client.json.jackson.JacksonJsonpMapper
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.transport.httpclient5.ApacheHttpClient5TransportBuilder
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenSearchConfig(
    @Value("\${opensearch.host}") private val host: String,
    @Value("\${opensearch.port}") private val port: Int,
    @Value("\${opensearch.scheme}") private val scheme: String
) {
    @Bean
    fun openSearchClient(): OpenSearchClient {
        val httpHost = HttpHost(scheme, host, port)
        val transport = ApacheHttpClient5TransportBuilder
            .builder(httpHost)
            .setMapper(JacksonJsonpMapper())
            .build()
        return OpenSearchClient(transport)
    }
}
