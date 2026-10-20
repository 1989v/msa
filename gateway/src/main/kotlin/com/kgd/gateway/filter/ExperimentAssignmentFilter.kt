package com.kgd.gateway.filter

import tools.jackson.core.type.TypeReference
import tools.jackson.databind.ObjectMapper
import com.kgd.common.analytics.BucketAssigner
import io.github.oshai.kotlinlogging.KotlinLogging
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

    private val log = KotlinLogging.logger {}

    companion object {
        const val ACTIVE_EXPERIMENTS_KEY = "experiment:active-list"
        const val EXPERIMENT_HEADER_PREFIX = "X-Experiment-"
    }

    override fun getOrder(): Int = -5 // After visitor filter, before routing

    override fun filter(original: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        // 배정 결과 헤더는 게이트웨이만 쓴다 — 클라이언트가 붙인 X-Experiment-* 는 먼저 벗긴다.
        // 안 벗기면 활성 실험이 없거나 Redis 가 실패할 때 클라이언트 값이 그대로 백엔드에 닿는다.
        val exchange = original.mutate()
            .request(original.request.mutate().headers { h -> h.headerNames().filter { it.startsWith(EXPERIMENT_HEADER_PREFIX, ignoreCase = true) }.toList().forEach(h::remove) }.build())
            .build()
        // 방문자 id 로만 배정한다. 이 전역 필터는 라우트의 인증 필터보다 먼저 돌아서
        // 여기서 보이는 X-User-Id 는 늘 클라이언트가 보낸 값이다 — 읽으면 칸을 고를 수 있다.
        val visitorId = exchange.request.headers[VisitorIdFilter.VISITOR_HEADER]?.firstOrNull()
            ?: return chain.filter(exchange)

        // 실패를 삼키는 범위는 Redis 조회까지다. 체인 전체를 감싸면 업스트림 실패에서 체인을 한 번 더
        // 돌리고, 라우팅 필터는 이미 라우팅된 요청이라 건너뛰어 본문 없는 200 이 나간다.
        return getActiveExperiments()
            .onErrorResume { e ->
                log.warn(e) { "Experiment assignment failed, proceeding without assignments" }
                Mono.just(emptyList())
            }
            .flatMap { experiments ->
                if (experiments.isEmpty()) {
                    return@flatMap chain.filter(exchange)
                }

                val mutatedRequest = exchange.request.mutate()
                experiments.forEach { exp ->
                    val variant = BucketAssigner.assign(visitorId, exp.id, exp.variants)
                    mutatedRequest.header("$EXPERIMENT_HEADER_PREFIX${exp.id}", variant)
                }

                chain.filter(exchange.mutate().request(mutatedRequest.build()).build())
            }
    }

    private fun getActiveExperiments(): Mono<List<ActiveExperiment>> {
        return redis.opsForValue().get(ACTIVE_EXPERIMENTS_KEY)
            .map { json ->
                try {
                    objectMapper.readValue(json, object : TypeReference<List<ActiveExperiment>>() {})
                } catch (e: Exception) {
                    log.warn(e) { "Failed to parse active experiments from Redis" }
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
