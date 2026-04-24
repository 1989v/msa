package com.kgd.sevensplit.infrastructure.bithumb

import com.kgd.sevensplit.infrastructure.clickhouse.ClickHouseConfig
import com.kgd.sevensplit.infrastructure.ingest.FileIngestCheckpointStore
import com.kgd.sevensplit.infrastructure.ingest.IngestCheckpointStore
import com.kgd.sevensplit.infrastructure.ingest.IngestDlqRecorder
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.web.reactive.function.client.WebClient
import java.nio.file.Path

private val log = KotlinLogging.logger {}

/**
 * TG-07.4: `ingest-bithumb` 프로파일이 활성일 때만 기동되는 배치 엔트리포인트.
 *
 * 실행 예:
 * ```
 * ./gradlew :seven-split:app:bootRun --args='--spring.profiles.active=ingest-bithumb --interval=1m'
 * ./gradlew :seven-split:app:bootRun --args='--spring.profiles.active=ingest-bithumb --force-reingest=BTC,ETH'
 * ```
 *
 * 지원 옵션:
 * - `--interval=<value>`: 빗썸 interval (기본 `1m`)
 * - `--symbols=BTC,ETH`: 대상 orderCurrency (기본 BTC,ETH)
 * - `--force-reingest=BTC,ETH` 또는 `--force-reingest=all`: 해당 심볼의 checkpoint 무시하고 전량 재수집
 *
 * Phase 1 은 2 symbol × 1 interval 조합이라 순차 실행으로 충분 (코루틴 사용은 IO 대기 오버헤드 절감용).
 */
@Configuration
@Profile("ingest-bithumb")
class BithumbIngestConfig {

    /** 빗썸 public API baseUrl. 본문 바이트 제한은 기본값(256KB) 로는 캔들 배열 크기 고려 부족 → 8MB 로 상향. */
    @Bean
    fun bithumbWebClient(): WebClient = WebClient.builder()
        .baseUrl("https://api.bithumb.com")
        .codecs { it.defaultCodecs().maxInMemorySize(8 * 1024 * 1024) }
        .build()

    @Bean
    fun bithumbRestClient(bithumbWebClient: WebClient): BithumbRestClient =
        BithumbRestClient(bithumbWebClient)

    @Bean
    fun ingestCheckpointStore(): IngestCheckpointStore =
        FileIngestCheckpointStore(Path.of(".ingest/checkpoints"))

    @Bean
    fun ingestDlqRecorder(): IngestDlqRecorder =
        IngestDlqRecorder(Path.of(".ingest/dlq"))

    @Bean
    fun candleWriter(clickHouseConfig: ClickHouseConfig): CandleWriter =
        ClickHouseCandleWriter(clickHouseConfig)

    @Bean
    fun bithumbHistoryIngestService(
        client: BithumbRestClient,
        candleWriter: CandleWriter,
        checkpointStore: IngestCheckpointStore,
        dlqRecorder: IngestDlqRecorder,
    ): BithumbHistoryIngestService =
        BithumbHistoryIngestService(client, candleWriter, checkpointStore, dlqRecorder)

    @Bean
    fun bithumbIngestCommand(service: BithumbHistoryIngestService): ApplicationRunner =
        ApplicationRunner { args -> BithumbIngestCommandRunner(service).run(args) }
}

/**
 * 실행 로직을 별도 클래스로 분리 — Configuration 람다에 로직을 두면 테스트가 어려움.
 * Phase 1 단위 테스트는 [BithumbHistoryIngestService] 만 직접 커버하고,
 * 옵션 파싱은 통합 실행 시점에 검증된다.
 */
class BithumbIngestCommandRunner(
    private val service: BithumbHistoryIngestService,
) {
    suspend fun runSuspending(args: ApplicationArguments) {
        val interval = args.getOptionValues("interval")?.firstOrNull() ?: "1m"
        val symbols = args.getOptionValues("symbols")?.firstOrNull()
            ?.split(',')?.map { it.trim() }?.filter { it.isNotEmpty() }
            ?: listOf("BTC", "ETH")
        val forceReingestRaw = args.getOptionValues("force-reingest")?.firstOrNull()
        val forceReingestAll = forceReingestRaw == "all"
        val forceSet = forceReingestRaw
            ?.takeIf { it != "all" }
            ?.split(',')?.map { it.trim().uppercase() }?.filter { it.isNotEmpty() }?.toSet()
            ?: emptySet()

        log.info {
            "bithumb ingest command start symbols=$symbols interval=$interval " +
                "forceReingestAll=$forceReingestAll forceReingestSet=$forceSet"
        }

        val results = symbols.map { sym ->
            val force = forceReingestAll || forceSet.contains(sym.uppercase())
            service.ingest(sym, interval, forceFull = force)
        }
        val okCount = results.count { !it.failed }
        val failCount = results.count { it.failed }
        val insertedSum = results.sumOf { it.inserted }
        log.info {
            "bithumb ingest command done ok=$okCount fail=$failCount insertedTotal=$insertedSum"
        }
    }

    fun run(args: ApplicationArguments) = runBlocking { runSuspending(args) }
}
