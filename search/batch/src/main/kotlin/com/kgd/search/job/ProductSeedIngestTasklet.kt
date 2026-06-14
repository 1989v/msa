package com.kgd.search.job

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.search.infrastructure.client.ProductApiClient
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.batch.core.scope.context.ChunkContext
import org.springframework.batch.core.step.StepContribution
import org.springframework.batch.core.step.tasklet.Tasklet
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.nio.file.Files
import java.nio.file.Path

/**
 * ADR-0056 Part 1 — 오픈데이터 상품 시드 적재.
 *
 * `tools/seed/products` 가 정규화한 JSONL(한 줄 = 한 상품)을 읽어 product Create API(/bulk)로
 * 청크 단위 적재한다. DB 직삽입이 아닌 API 경유라 product.item.created → search consumer →
 * OpenSearch 색인까지 정상 파이프라인을 태운다.
 *
 * `#` 로 시작하거나 빈 줄은 무시. 상품명 공백 / 가격 0 이하(= Money 불변식 위반)는 skip.
 * `reindex.source=seed` 일 때만 활성화.
 */
@Component
@ConditionalOnProperty(name = ["reindex.source"], havingValue = "seed")
class ProductSeedIngestTasklet(
    private val productApiClient: ProductApiClient,
    private val objectMapper: ObjectMapper,
    @Value("\${seed.path:/seed/products.jsonl}") private val seedPath: String,
    @Value("\${seed.chunk-size:500}") private val chunkSize: Int
) : Tasklet {

    private val log = KotlinLogging.logger {}

    override fun execute(contribution: StepContribution, chunkContext: ChunkContext): RepeatStatus {
        val path = Path.of(seedPath)
        require(Files.exists(path)) { "Seed file not found: $seedPath" }

        var created = 0
        var skipped = 0
        val buffer = ArrayList<ProductApiClient.SeedProduct>(chunkSize)

        log.info { "Starting product seed ingest from $seedPath (chunk=$chunkSize)" }

        Files.newBufferedReader(path).useLines { lines ->
            lines.forEach { raw ->
                val line = raw.trim()
                if (line.isEmpty() || line.startsWith("#")) return@forEach

                val product = runCatching {
                    objectMapper.readValue(line, ProductApiClient.SeedProduct::class.java)
                }.getOrElse {
                    log.warn { "Skipping malformed line: ${it.message}" }
                    skipped++
                    return@forEach
                }

                if (product.name.isBlank() || product.price <= BigDecimal.ZERO) {
                    skipped++
                    return@forEach
                }

                buffer.add(product)
                if (buffer.size >= chunkSize) {
                    created += productApiClient.createBulk(buffer.toList())
                    log.info { "Ingested $created products so far ($skipped skipped)" }
                    buffer.clear()
                }
            }
        }

        if (buffer.isNotEmpty()) {
            created += productApiClient.createBulk(buffer.toList())
        }

        log.info { "Product seed ingest complete: $created created, $skipped skipped (source=$seedPath)" }
        return RepeatStatus.FINISHED
    }
}
