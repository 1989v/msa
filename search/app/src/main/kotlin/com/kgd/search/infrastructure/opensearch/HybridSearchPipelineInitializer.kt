package com.kgd.search.infrastructure.opensearch

import com.kgd.search.application.attraction.config.AttractionHybridProperties
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.generic.Requests
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component

/**
 * 하이브리드 검색 파이프라인을 기동 시 만든다 (ADR-0090 D4). **멱등** — PUT 이라 여러 번 불러도 같다.
 *
 * 파이프라인이 두 레그의 점수를 융합한다. 이름이 없으면 OpenSearch 가 **요청을 거부한다** —
 * 조용히 BM25 로 떨어지지 않으므로 부재가 즉시 드러난다. 그래서 여기서 만들어 두되,
 * **못 만들어도 앱은 뜬다**(하이브리드가 꺼져 있으면 애초에 필요 없고, 켜져 있으면 검색이 실패해 알려준다).
 *
 * `fusion` 이 `rrf` 가 아니면 그 이름의 파이프라인을 **사람이 만들어 둔 것으로 본다** —
 * A/B 로 융합 방식을 고르는 중이라(D5-1 미확정) 코드가 종류를 늘리지 않는다.
 */
@Component
class HybridSearchPipelineInitializer(
    private val client: OpenSearchClient,
    private val properties: AttractionHybridProperties,
) {
    private val log = KotlinLogging.logger {}

    @EventListener(ApplicationReadyEvent::class)
    fun createIfNeeded() {
        if (!properties.enabled) {
            log.info { "하이브리드가 꺼져 있어 검색 파이프라인을 만들지 않는다" }
            return
        }
        if (properties.fusion != RRF) {
            log.info { "융합 방식이 '${properties.fusion}' 이라 파이프라인 '${properties.pipeline}' 은 운영이 만든 것을 쓴다" }
            return
        }
        runCatching {
            client.generic().execute(
                Requests.builder()
                    .endpoint("/_search/pipeline/${properties.pipeline}")
                    .method("PUT")
                    .json(RRF_PIPELINE)
                    .build(),
            ).use { response ->
                check(response.getStatus() < 300) { "status=${response.getStatus()} ${response.getReason()}" }
            }
            log.info { "검색 파이프라인 '${properties.pipeline}' 준비됨 (RRF)" }
        }.onFailure {
            log.error(it) { "검색 파이프라인 '${properties.pipeline}' 을 만들지 못했다 — 하이브리드 질의가 거부된다" }
        }
    }

    companion object {
        const val RRF = "rrf"

        /**
         * Reciprocal Rank Fusion — 두 레그의 **순위**만 쓴다. 점수 정규화가 필요 없어
         * BM25 와 코사인처럼 스케일이 다른 값을 섞을 때 안전하다. `rank_constant` 60 은 원 논문 값이다.
         */
        private const val RRF_PIPELINE = """
        {
          "description": "관광지 하이브리드 — BM25 레그와 벡터 레그를 순위로 융합 (ADR-0090)",
          "phase_results_processors": [
            {
              "score-ranker-processor": {
                "combination": { "technique": "rrf", "rank_constant": 60 }
              }
            }
          ]
        }
        """
    }
}
