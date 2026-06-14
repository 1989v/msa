package com.kgd.search.infrastructure.indexing

import com.kgd.search.domain.product.model.ProductDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import org.opensearch.client.opensearch.OpenSearchClient
import org.opensearch.client.opensearch.core.bulk.BulkOperation
import org.springframework.beans.factory.DisposableBean
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import java.util.concurrent.atomic.AtomicLong

/**
 * ADR-0055 — opensearch-java 에는 elasticsearch-java 의 `BulkIngester` 헬퍼가 없어
 * 동일 의미를 직접 구현:
 *  - primary 버퍼: maxOperations 1000 초과 시 즉시 flush + 5s 주기 flush
 *  - retry 버퍼: primary bulk 의 실패 항목 수용, maxOperations 500 + 3s 주기 flush
 *  - shutdown 시 잔여 버퍼 flush (기존 BulkIngester.close() 와 동일 의미)
 */
@Component
class OsBulkDocumentProcessor(
    private val osClient: OpenSearchClient
) : DisposableBean {

    private val log = KotlinLogging.logger {}

    val processedCount = AtomicLong(0)
    val errorCount = AtomicLong(0)

    private val primaryBuffer = mutableListOf<BulkOperation>()
    private val retryBuffer = mutableListOf<BulkOperation>()

    companion object {
        private const val PRIMARY_MAX_OPERATIONS = 1000
        private const val RETRY_MAX_OPERATIONS = 500
        private const val PRIMARY_FLUSH_INTERVAL_MS = 5_000L
        private const val RETRY_FLUSH_INTERVAL_MS = 3_000L
    }

    fun processDocument(indexName: String, document: ProductDocument) {
        val doc = ProductIndexDocument.fromDomain(document)
        val operation = BulkOperation.of { op ->
            op.index { idx -> idx.index(indexName).id(doc.id).document(doc) }
        }
        val toSend = synchronized(primaryBuffer) {
            primaryBuffer.add(operation)
            if (primaryBuffer.size >= PRIMARY_MAX_OPERATIONS) drain(primaryBuffer) else emptyList()
        }
        sendPrimary(toSend)
    }

    /** 잔여 작업 동기 전송 — 배치의 alias swap 직전 등 호출자가 완료를 보장해야 할 때 사용. */
    fun flush() {
        sendPrimary(synchronized(primaryBuffer) { drain(primaryBuffer) })
    }

    @Scheduled(fixedDelay = PRIMARY_FLUSH_INTERVAL_MS)
    fun flushPrimaryPeriodically() = flush()

    @Scheduled(fixedDelay = RETRY_FLUSH_INTERVAL_MS)
    fun flushRetryPeriodically() {
        sendRetry(synchronized(retryBuffer) { drain(retryBuffer) })
    }

    private fun drain(buffer: MutableList<BulkOperation>): List<BulkOperation> {
        val ops = buffer.toList()
        buffer.clear()
        return ops
    }

    private fun sendPrimary(ops: List<BulkOperation>) {
        if (ops.isEmpty()) return
        log.debug { "Sending bulk: ${ops.size} operations" }
        try {
            val response = osClient.bulk { b -> b.operations(ops) }
            val failedOps = response.items().mapIndexedNotNull { idx, item ->
                if (item.error() != null) Pair(idx, item) else null
            }
            if (failedOps.isNotEmpty()) {
                log.error { "${failedOps.size} items failed — sending to retry buffer" }
                val retries = failedOps.map { (idx, item) ->
                    log.error { "Failed: reason=${item.error()?.reason()}" }
                    ops[idx]
                }
                errorCount.addAndGet(failedOps.size.toLong())
                addToRetry(retries)
            }
            processedCount.addAndGet((response.items().size - failedOps.size).toLong())
        } catch (e: Exception) {
            log.error(e) { "Bulk request failed: ${e.message}" }
            errorCount.addAndGet(ops.size.toLong())
        }
    }

    private fun addToRetry(ops: List<BulkOperation>) {
        val toSend = synchronized(retryBuffer) {
            retryBuffer.addAll(ops)
            if (retryBuffer.size >= RETRY_MAX_OPERATIONS) drain(retryBuffer) else emptyList()
        }
        sendRetry(toSend)
    }

    private fun sendRetry(ops: List<BulkOperation>) {
        if (ops.isEmpty()) return
        try {
            val response = osClient.bulk { b -> b.operations(ops) }
            val failed = response.items().count { it.error() != null }
            if (failed > 0) log.error { "Retry still failed: $failed items" }
            else log.info { "Retry succeeded: ${response.items().size} items" }
        } catch (e: Exception) {
            log.error(e) { "Retry bulk request failed: ${e.message}" }
        }
    }

    /** 종료 시 버퍼 잔여 문서 유실 방지. */
    override fun destroy() {
        flush()
        flushRetryPeriodically()
    }
}
