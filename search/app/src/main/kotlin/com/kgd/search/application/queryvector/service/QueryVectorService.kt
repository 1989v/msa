package com.kgd.search.application.queryvector.service

import com.github.benmanes.caffeine.cache.Caffeine
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.queryvector.usecase.ManageQueryVectorsUseCase
import com.kgd.search.application.queryvector.usecase.ResolveQueryVectorUseCase
import com.kgd.search.domain.queryvector.model.QueryNormalizer
import com.kgd.search.domain.queryvector.model.QueryVector
import com.kgd.search.domain.queryvector.port.QueryEncoderPort
import com.kgd.search.domain.queryvector.port.QueryMissPort
import com.kgd.search.domain.queryvector.port.QueryVectorPort
import io.github.oshai.kotlinlogging.KotlinLogging
import io.micrometer.core.instrument.MeterRegistry
import org.springframework.stereotype.Service
import java.time.LocalDateTime
import java.util.Optional
import java.util.concurrent.TimeUnit

/**
 * 질의 → 벡터 (ADR-0090 개정 2026-09-08). 세 층을 순서대로 본다.
 *
 *   1. Caffeine 캐시   — 프로세스 안, 수 µs
 *   2. RDB 원천        — 재기동해도 남는다. 같은 질의를 두 번 인코딩하지 않는다
 *   3. 사이드카 인코딩 — 여기서 만든 값은 즉시 RDB 에 남긴다
 *
 * **미적중은 실패가 아니다** — 3번까지 실패하면 벡터 레그를 끄고 BM25 로 답한다.
 * 적중률은 이제 가용성 지표가 아니라 **비용 지표**다(인코딩을 몇 번 했나).
 */
@Service
class QueryVectorService(
    private val queryVectorPort: QueryVectorPort,
    private val queryEncoderPort: QueryEncoderPort,
    private val queryMissPort: QueryMissPort,
    private val properties: QueryVectorProperties,
    meterRegistry: MeterRegistry,
) : ResolveQueryVectorUseCase, ManageQueryVectorsUseCase {

    private val log = KotlinLogging.logger {}

    private val hitCounter = meterRegistry.counter("search.qvec.hit")
    private val missCounter = meterRegistry.counter("search.qvec.miss")
    private val disabledCounter = meterRegistry.counter("search.qvec.disabled")
    private val encodedCounter = meterRegistry.counter("search.qvec.encoded")
    private val encodeFailedCounter = meterRegistry.counter("search.qvec.encode.failed")
    private val encodeTimer = meterRegistry.timer("search.qvec.encode")

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
        val id = QueryVector.idOf(modelRef, normalized)

        // 1·2층 — 캐시와 원천. 캐시는 **미적중도 담는다**: 안 담으면 인코딩이 실패하는 질의가
        // 매 요청 DB 와 사이드카를 친다.
        val cached = cache.get(id) { key -> Optional.ofNullable(queryVectorPort.find(key)?.vector) }
        if (cached.isPresent) {
            hitCounter.increment()
            return cached.get()
        }

        // 3층 — 인코딩. 성공하면 원천에 남기고 캐시를 갱신한다.
        missCounter.increment()
        val encoded = encodeTimer.recordCallable { queryEncoderPort.encode(normalized) }
        if (encoded == null || encoded.isEmpty()) {
            encodeFailedCounter.increment()
            recordMiss(modelRef, normalized)
            return null
        }
        encodedCounter.increment()
        persist(rawQuery, normalized, modelRef, encoded)
        cache.put(id, Optional.of(encoded))
        return encoded
    }

    /**
     * 원천 저장 실패가 검색을 막지 않는다 — 벡터는 이미 손에 있고, 저장은 다음 요청의 비용을
     * 줄이려는 것뿐이다. DB 가 죽어도 검색은 인코딩만으로 계속 답한다.
     */
    private fun persist(raw: String, normalized: String, modelRef: String, vector: List<Float>) {
        runCatching {
            queryVectorPort.upsertAll(
                listOf(
                    QueryVector(
                        query = raw,
                        normalized = normalized,
                        modelRef = modelRef,
                        vector = vector,
                        source = QueryVector.Source.LOG,
                        updatedAt = LocalDateTime.now(),
                    ),
                ),
            )
        }.onFailure { log.warn(it) { "질의 벡터 저장 실패 (무시): $normalized" } }
    }

    /** 인코딩까지 실패한 질의만 센다 — 무엇을 못 만들고 있는지가 이 카운터의 뜻이다. */
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
