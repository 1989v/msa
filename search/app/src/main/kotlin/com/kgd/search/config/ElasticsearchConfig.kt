package com.kgd.search.infrastructure.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.data.elasticsearch.client.ClientConfiguration
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration

@Configuration
class ElasticsearchConfig : ElasticsearchConfiguration() {

    @Value("\${spring.elasticsearch.uris:http://localhost:9200}")
    private lateinit var elasticsearchUri: String

    override fun clientConfiguration(): ClientConfiguration =
        ClientConfiguration.builder()
            .connectedTo(elasticsearchUri.removePrefix("http://").removePrefix("https://"))
            .build()
}
