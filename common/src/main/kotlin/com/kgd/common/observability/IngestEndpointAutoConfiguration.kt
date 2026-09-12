package com.kgd.common.observability

import org.springframework.boot.autoconfigure.AutoConfiguration
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.context.annotation.Bean

/**
 * 수집 배치를 가진 서비스에만 엔드포인트를 붙인다.
 */
@AutoConfiguration
@ConditionalOnBean(IngestFreshness::class)
class IngestEndpointAutoConfiguration {

    @Bean
    fun ingestEndpoint(checks: List<IngestFreshness>) = IngestEndpoint(checks)
}
