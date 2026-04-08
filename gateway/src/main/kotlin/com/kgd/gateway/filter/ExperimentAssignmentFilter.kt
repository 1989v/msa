package com.kgd.gateway.filter

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.common.analytics.BucketAssigner
import org.slf4j.LoggerFactory
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.data.redis.core.ReactiveStringRedisTemplate
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

@Component
class ExperimentAssignmentFilter(
    private val redis: ReactiveStringRedisTemplate,
    private val objectMapper: ObjectMapper
) : GlobalFilter, Ordered {

    private val log = LoggerFactory.getLogger(javaClass)

    companion object {
        const val ACTIVE_EXPERIMENTS_KEY = "experiment:active-list"
    }

    override fun getOrder(): Int = -5 // After visitor filter, before routing

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val userId = exchange.request.headers["X-User-Id"]?.firstOrNull()
            ?: exchange.request.headers[VisitorIdFilter.VISITOR_HEADER]?.firstOrNull()
            ?: return chain.filter(exchange)

        return getActiveExperiments()
            .flatMap { experiments ->
                if (experiments.isEmpty()) {
                    return@flatMap chain.filter(exchange)
                }

                val mutatedRequest = exchange.request.mutate()
                experiments.forEach { exp ->
                    val variant = BucketAssigner.assign(userId, exp.id, exp.variants)
                    mutatedRequest.header("X-Experiment-${exp.id}", variant)
                }

                chain.filter(exchange.mutate().request(mutatedRequest.build()).build())
            }
            .onErrorResume { e ->
                log.warn("Experiment assignment failed, proceeding without assignments", e)
                chain.filter(exchange)
            }
    }

    private fun getActiveExperiments(): Mono<List<ActiveExperiment>> {
        return redis.opsForValue().get(ACTIVE_EXPERIMENTS_KEY)
            .map { json ->
                try {
                    objectMapper.readValue(json, object : TypeReference<List<ActiveExperiment>>() {})
                } catch (e: Exception) {
                    log.warn("Failed to parse active experiments from Redis", e)
                    emptyList()
                }
            }
            .defaultIfEmpty(emptyList())
    }

    data class ActiveExperiment(
        val id: Long = 0,
        val variants: List<Pair<String, Int>> = emptyList()
    )
}
