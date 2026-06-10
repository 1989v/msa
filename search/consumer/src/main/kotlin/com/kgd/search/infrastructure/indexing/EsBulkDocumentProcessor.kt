package com.kgd.search.infrastructure.indexing

import co.elastic.clients.elasticsearch.ElasticsearchClient
import co.elastic.clients.elasticsearch.core.BulkRequest
import co.elastic.clients.elasticsearch.core.BulkResponse
import co.elastic.clients.elasticsearch._helpers.bulk.BulkIngester
import co.elastic.clients.elasticsearch._helpers.bulk.BulkListener
import co.elastic.clients.elasticsearch.core.bulk.BulkOperation
import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.search.domain.product.model.ProductDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import org.springframework.beans.factory.DisposableBean
import org.springframework.stereotype.Component
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong

@Component
class EsBulkDocumentProcessor(
    private val esClient: ElasticsearchClient,
    private val objectMapper: ObjectMapper
) : DisposableBean {

    private val log = KotlinLogging.logger {}

    val processedCount = AtomicLong(0)
    val errorCount = AtomicLong(0)

    private lateinit var primaryIngester: BulkIngester<Void>
    private lateinit var retryIngester: BulkIngester<Void>

    @PostConstruct
    fun init() {
        retryIngester = BulkIngester.of { b ->
            b.client(esClient)
             .maxOperations(500)
             .flushInterval(3, TimeUnit.SECONDS)
             .listener(retryListener())
        }
        primaryIngester = BulkIngester.of { b ->
            b.client(esClient)
             .maxOperations(1000)
             .flushInterval(5, TimeUnit.SECONDS)
             .listener(primaryListener())
        }
    }

    fun processDocument(indexName: String, document: ProductDocument) {
        @Suppress("UNCHECKED_CAST")
        val docMap = objectMapper.convertValue(document, Map::class.java) as Map<String, Any?>
        primaryIngester.add(
            BulkOperation.of { op ->
                op.index { idx ->
                    idx.index(indexName).id(document.id).document(docMap)
                }
            }
        )
    }

    fun flush() {
        primaryIngester.flush()
    }

    private fun primaryListener() = object : BulkListener<Void> {
        override fun beforeBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>) {
            log.debug { "Sending bulk: ${request.operations().size} operations" }
        }

        override fun afterBulk(
            executionId: Long,
            request: BulkRequest,
            contexts: MutableList<Void?>,
            response: BulkResponse
        ) {
            val failedOps = response.items().mapIndexedNotNull { idx, item ->
                if (item.error() != null) Pair(idx, item) else null
            }
            if (failedOps.isNotEmpty()) {
                log.error { "${failedOps.size} items failed — sending to retry ingester" }
                failedOps.forEach { (idx, item) ->
                    log.error { "Failed: reason=${item.error()?.reason()}" }
                    retryIngester.add(request.operations()[idx])
                }
                errorCount.addAndGet(failedOps.size.toLong())
            }
            processedCount.addAndGet((response.items().size - failedOps.size).toLong())
        }

        override fun afterBulk(
            executionId: Long,
            request: BulkRequest,
            contexts: MutableList<Void?>,
            failure: Throwable
        ) {
            log.error(failure) { "Bulk request failed: ${failure.message}" }
            errorCount.addAndGet(request.operations().size.toLong())
        }
    }

    private fun retryListener() = object : BulkListener<Void> {
        override fun beforeBulk(executionId: Long, request: BulkRequest, contexts: MutableList<Void?>) {}

        override fun afterBulk(
            executionId: Long,
            request: BulkRequest,
            contexts: MutableList<Void?>,
            response: BulkResponse
        ) {
            val failed = response.items().count { it.error() != null }
            if (failed > 0) log.error { "Retry still failed: $failed items" }
            else log.info { "Retry succeeded: ${response.items().size} items" }
        }

        override fun afterBulk(
            executionId: Long,
            request: BulkRequest,
            contexts: MutableList<Void?>,
            failure: Throwable
        ) {
            log.error(failure) { "Retry bulk request failed: ${failure.message}" }
        }
    }

    override fun destroy() {
        primaryIngester.close()
        retryIngester.close()
    }
}
