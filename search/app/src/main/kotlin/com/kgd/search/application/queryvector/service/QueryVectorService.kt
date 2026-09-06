package com.kgd.search.application.queryvector.service

import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ManageQueryVectorsUseCase
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.domain.queryvector.model.QueryNormalizer
import com.kgd.search.domain.queryvector.model.QueryVector
import com.kgd.search.domain.queryvector.port.QueryMissPort
import com.kgd.search.domain.queryvector.port.QueryVectorPort
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Service
import java.time.LocalDateTime
import java.util.Optional
import java.util.concurrent.TimeUnit

/**
 * 질의 사전 (ADR-0090). 서버는 임베딩하지 않는다 — 있으면 쓰고, 없으면 BM25 로 답하며 미스를 센다.
 *
 * **적중률(hit/(hit+miss))이 v2 의 건강 지표다** (ADR-0090 D7). 낮으면 사전이 얇은 것이고,
 * 그 답은 미스 로그를 도구가 되먹이는 것이다.
 */
@Service
class QueryVectorService(
    private val queryVectorPort: QueryVectorPort,
    private val queryMissPort: QueryMissPort,
    private val properties: QueryVectorProperties,
    meterRegistry: MeterRegistry,
) : ResolveQueryVectorUseCase, ManageQueryVectorsUseCase {

    private val log = KotlinLogging.logger {}

    private val hitCounter = meterRegistry.counter("search.qvec.hit")
    private val missCounter = meterRegistry.counter("search.qvec.miss")
    private val disabledCounter = meterRegistry.counter("search.qvec.disabled")

    /**
     * 미적중도 담는다 — `Optional.empty()` 로. 담지 않으면 사전에 없는 질의가 매 요청 OpenSearch 를 친다.
     * 도구가 사전을 채운 뒤 TTL 만큼은 여전히 미적중으로 보이는데, 그 창은 10분이라 받아들인다.
     */
    private val cache = Caffeine.newBuilder()
        .maximumSize(properties.cacheMaxSize)
        .expireAfterWrite(properties.cacheTtlMinutes, TimeUnit.MINUTES)
        .build<String, Optional<List<Float>>>()

    override fun resolve(rawQuery: String, modelRef: String): List<Float>? {
        if (modelRef.isBlank()) {
            disabledCounter.increment()
            return null
        }
        val normalized = QueryNormalizer.normalize(rawQuery) ?: return null

        val cached = cache.get(QueryVector.idOf(modelRef, normalized)) { id ->
            Optional.ofNullable(queryVectorPort.find(id)?.vector)
        }

        // 미스 기록은 **캐시 적중 여부와 무관하게** 매 요청 — 카운트가 곧 우선순위다.
        // 캐시된 미적중만 세지 않으면 자주 묻는 질의일수록 카운트가 낮게 나온다.
        return if (cached.isPresent) {
            hitCounter.increment()
            cached.get()
        } else {
            missCounter.increment()
            recordMiss(modelRef, normalized)
            null
        }
    }

    /** 사전이 없다고 검색이 실패하면 안 된다 — Redis 가 죽어도 로그만 남기고 넘어간다. */
    private fun recordMiss(modelRef: String, normalized: String) {
        runCatching { queryMissPort.record(modelRef, normalized) }
            .onFailure { log.warn(it) { "미적중 기록 실패 (무시): $normalized" } }
    }

    override fun upsert(modelRef: String, items: List<ManageQueryVectorsUseCase.Item>): ManageQueryVectorsUseCase.Applied {
        val now = LocalDateTime.now()
        var skippedEmpty = 0
        val vectors = items.mapNotNull { item ->
            val normalized = QueryNormalizer.normalize(item.query)
            if (normalized == null) {
                skippedEmpty++
                null
            } else {
                QueryVector(
                    query = item.query,
                    normalized = normalized,
                    modelRef = modelRef,
                    vector = item.vector,
                    source = item.source,
                    updatedAt = now,
                )
            }
        }
        val upserted = queryVectorPort.upsertAll(vectors)
        // 방금 넣은 항목이 캐시의 옛 미적중에 가려지지 않게 그 키만 지운다(전체 무효화는 과하다).
        vectors.forEach { cache.invalidate(it.id) }
        return ManageQueryVectorsUseCase.Applied(upserted = upserted, skippedEmpty = skippedEmpty)
    }

    override fun misses(modelRef: String, limit: Int): List<ManageQueryVectorsUseCase.Miss> =
        queryMissPort.top(modelRef, limit).map { ManageQueryVectorsUseCase.Miss(it.normalized, it.count) }

    override fun clearMisses(modelRef: String, normalized: List<String>): Int =
        queryMissPort.remove(modelRef, normalized)

    override fun status(modelRef: String) = ManageQueryVectorsUseCase.Status(
        modelRef = modelRef,
        entries = queryVectorPort.count(modelRef),
        pendingMisses = queryMissPort.size(modelRef),
    )
}
