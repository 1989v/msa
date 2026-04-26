package com.kgd.sevensplit.infrastructure.bithumb

import com.kgd.sevensplit.infrastructure.ingest.IngestCheckpointStore
import com.kgd.sevensplit.infrastructure.ingest.IngestDlqRecorder
import com.kgd.sevensplit.infrastructure.metrics.SevenSplitMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import java.time.Clock
import java.time.Instant

private val log = KotlinLogging.logger {}

/**
 * TG-07.2: 빗썸 REST 기반 히스토리 증분 수집 서비스.
 *
 * Phase 1 범위:
 * - 대상: BTC_KRW, ETH_KRW × 분봉(1m) 기본. 다른 interval 도 파라미터로 가능.
 * - 빗썸 Candle Stick API 특성상 1회 호출로 가능한 전체 과거 캔들을 반환(페이지네이션 없음).
 * - 월 단위 슬라이싱을 forloop 로 분할하는 것이 API 스펙상 의미가 없어,
 *   본 구현은 **호출 1회 → checkpoint 이후 필터링 → bulk insert** 로 단순화한다.
 * - 실제 2023-01 이전으로 거슬러 올라가는 깊이는 빗썸이 반환하는 배열 길이에 의존.
 *   깊은 과거 백필이 필요하면 별도 데이터 벤더(Q-D 확장 시 TG-15 참조).
 *
 * 멱등성 / 재실행 안전성:
 * - [IngestCheckpointStore] 에 저장된 lastTs 보다 큰 row 만 insert.
 * - 설령 중복 insert 가 발생해도 `market_tick_bithumb` 는 ReplacingMergeTree 이므로 최종 일관성 보장.
 * - [forceFull]=true 로 checkpoint 무시하고 전체 재수집 가능(`--force-reingest` 경로).
 *
 * TG-14.2: [metrics] 가 주입되면 `seven_split_ingest_bithumb_rows_total{symbol}` 카운터에
 * inserted row 수를 누적한다. 테스트에서는 null 로 호출 가능.
 */
class BithumbHistoryIngestService(
    private val client: BithumbRestClient,
    private val candleWriter: CandleWriter,
    private val checkpointStore: IngestCheckpointStore,
    private val dlqRecorder: IngestDlqRecorder,
    private val clock: Clock = Clock.systemUTC(),
    private val metrics: SevenSplitMetrics? = null,
) {

    /**
     * 한 (symbol, interval) 조합에 대해 1회 수집 사이클을 실행한다.
     *
     * @param orderCurrency 예: BTC, ETH
     * @param interval 빗썸 포맷(1m/3m/5m/10m/30m/1h/6h/12h/24h)
     * @param forceFull true 면 checkpoint 무시하고 전체 응답을 insert
     */
    suspend fun ingest(
        orderCurrency: String,
        interval: String,
        forceFull: Boolean = false,
    ): IngestResult {
        val symbol = "${orderCurrency}_KRW"
        val checkpoint = if (forceFull) null else checkpointStore.loadLastTs(symbol, interval)
        log.info { "bithumb ingest start symbol=$symbol interval=$interval checkpointTs=$checkpoint forceFull=$forceFull" }

        val response = try {
            client.fetchCandles(orderCurrency, "KRW", interval)
        } catch (e: Exception) {
            log.warn { "bithumb fetch failed symbol=$symbol interval=$interval error=${e.message}" }
            dlqRecorder.record(symbol, interval, checkpoint, Instant.now(clock), e.message ?: "unknown")
            return IngestResult(symbol, interval, totalFetched = 0, inserted = 0, failed = true)
        }

        if (response.status != "0000") {
            log.warn { "bithumb status not ok symbol=$symbol interval=$interval status=${response.status}" }
            dlqRecorder.record(symbol, interval, checkpoint, Instant.now(clock), "status=${response.status}")
            return IngestResult(symbol, interval, totalFetched = 0, inserted = 0, failed = true)
        }

        val allRows = response.rows()
        val newRows = if (checkpoint == null) {
            allRows
        } else {
            val cutoff = checkpoint.toEpochMilli()
            allRows.filter { it.timestampMs > cutoff }
        }

        if (newRows.isEmpty()) {
            log.info { "bithumb ingest progress symbol=$symbol interval=$interval rows=0 totalSeen=${allRows.size} (nothing new)" }
            return IngestResult(symbol, interval, totalFetched = allRows.size, inserted = 0, failed = false)
        }

        try {
            candleWriter.write(symbol, interval, newRows)
        } catch (e: Exception) {
            log.warn { "bithumb insert failed symbol=$symbol interval=$interval error=${e.message}" }
            dlqRecorder.record(symbol, interval, checkpoint, Instant.now(clock), "insert: ${e.message}")
            return IngestResult(symbol, interval, totalFetched = allRows.size, inserted = 0, failed = true)
        }

        val maxTsMs = newRows.maxOf { it.timestampMs }
        val newCheckpoint = Instant.ofEpochMilli(maxTsMs)
        checkpointStore.saveLastTs(symbol, interval, newCheckpoint)
        // TG-14.2: inserted row 수 누적 (실패/빈 응답은 위에서 early return 으로 제외됨)
        metrics?.ingestRowsIncrement(symbol, newRows.size.toLong())
        log.info {
            "bithumb ingest progress symbol=$symbol interval=$interval rows=${newRows.size} " +
                "totalSeen=${allRows.size} newCheckpoint=$newCheckpoint"
        }
        return IngestResult(symbol, interval, totalFetched = allRows.size, inserted = newRows.size, failed = false)
    }
}

/**
 * 한 번의 [BithumbHistoryIngestService.ingest] 실행 결과.
 *
 * @param totalFetched API 응답에 포함된 row 수 (필터 전)
 * @param inserted 실제로 writer 에 전달된 row 수 (checkpoint 이후 신규)
 * @param failed API 호출 / status / insert 중 하나라도 실패했는지
 */
data class IngestResult(
    val symbol: String,
    val interval: String,
    val totalFetched: Int,
    val inserted: Int,
    val failed: Boolean,
)
