package com.kgd.sevensplit.infrastructure.bithumb

import com.kgd.sevensplit.infrastructure.ingest.FileIngestCheckpointStore
import com.kgd.sevensplit.infrastructure.ingest.IngestDlqRecorder
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.springframework.web.reactive.function.client.WebClient
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.CopyOnWriteArrayList

/**
 * TG-07.5: [BithumbHistoryIngestService] 의 checkpoint / DLQ / in-memory writer 동작 검증.
 *
 * - MockWebServer 로 빗썸 응답 stub
 * - [CandleWriter] 는 in-memory fake 로 주입 (실제 ClickHouse 기동 없음)
 * - checkpoint / DLQ 는 temp dir 사용
 *
 * 커버 케이스:
 * - 최초 수집: 모든 row insert + checkpoint 저장
 * - 재실행(증분): checkpoint 이후 row 만 insert, 동일 응답이면 insert=0
 * - forceFull=true: checkpoint 무시하고 전체 insert
 * - status != "0000": DLQ 기록 + failed=true
 * - HTTP 5xx: DLQ 기록 + failed=true
 */
class BithumbHistoryIngestServiceSpec : BehaviorSpec({

    lateinit var server: MockWebServer
    lateinit var client: BithumbRestClient
    lateinit var tempRoot: Path
    lateinit var checkpointStore: FileIngestCheckpointStore
    lateinit var dlqRecorder: IngestDlqRecorder
    lateinit var writer: InMemoryCandleWriter
    lateinit var service: BithumbHistoryIngestService

    beforeSpec {
        server = MockWebServer()
        server.start()
        val webClient = WebClient.builder()
            .baseUrl(server.url("/").toString())
            .codecs { it.defaultCodecs().maxInMemorySize(8 * 1024 * 1024) }
            .build()
        client = BithumbRestClient(webClient)
    }

    afterSpec { server.shutdown() }

    beforeEach {
        tempRoot = Files.createTempDirectory("ingest-test-")
        checkpointStore = FileIngestCheckpointStore(tempRoot.resolve("checkpoints"))
        dlqRecorder = IngestDlqRecorder(tempRoot.resolve("dlq"))
        writer = InMemoryCandleWriter()
        service = BithumbHistoryIngestService(client, writer, checkpointStore, dlqRecorder)
    }

    Given("빗썸이 2 row 를 반환") {
        val payload = """
            {"status":"0000","data":[
                [1700000000000,"30000000","30100000","30200000","29900000","1.5"],
                [1700000060000,"30100000","30050000","30150000","30040000","0.8"]
            ]}
        """.trimIndent()

        When("최초 수집(checkpoint 없음)") {
            server.enqueue(MockResponse().setBody(payload).setHeader("Content-Type", "application/json"))

            Then("2 row 모두 writer 에 전달되고 checkpoint 갱신") {
                val result = service.ingest("BTC", "1m")
                result.failed.shouldBeFalse()
                result.totalFetched shouldBe 2
                result.inserted shouldBe 2
                writer.rowsFor("BTC_KRW", "1m") shouldHaveSize 2
                checkpointStore.loadLastTs("BTC_KRW", "1m")?.toEpochMilli() shouldBe 1700000060000L
            }
        }

        When("checkpoint=1700000000000ms 로 재실행 (동일 응답)") {
            server.enqueue(MockResponse().setBody(payload).setHeader("Content-Type", "application/json"))
            server.enqueue(MockResponse().setBody(payload).setHeader("Content-Type", "application/json"))

            Then("두번째 실행은 cutoff 이후 1 row 만 insert") {
                service.ingest("BTC", "1m") // 첫 실행으로 checkpoint 설정됨 (1700000060000ms)
                writer.reset()

                // 두 번째 실행 전에 checkpoint 를 일부러 1700000000000 로 조정
                checkpointStore.saveLastTs("BTC_KRW", "1m", java.time.Instant.ofEpochMilli(1700000000000L))

                val result = service.ingest("BTC", "1m")
                result.failed.shouldBeFalse()
                result.totalFetched shouldBe 2
                result.inserted shouldBe 1
                writer.rowsFor("BTC_KRW", "1m") shouldHaveSize 1
                writer.rowsFor("BTC_KRW", "1m").first().timestampMs shouldBe 1700000060000L
            }
        }

        When("forceFull=true") {
            // 첫 실행으로 checkpoint 가 끝까지 진행된 상태에서도 강제 재수집
            server.enqueue(MockResponse().setBody(payload).setHeader("Content-Type", "application/json"))
            server.enqueue(MockResponse().setBody(payload).setHeader("Content-Type", "application/json"))

            Then("checkpoint 무시하고 전체 2 row insert") {
                service.ingest("BTC", "1m") // 첫 실행으로 checkpoint 가 끝까지 진행됨
                writer.reset()

                val result = service.ingest("BTC", "1m", forceFull = true)
                result.failed.shouldBeFalse()
                result.inserted shouldBe 2
            }
        }
    }

    Given("빗썸이 status=5500 오류 응답") {
        When("ingest 호출") {
            server.enqueue(
                MockResponse()
                    .setBody("""{"status":"5500","data":[]}""")
                    .setHeader("Content-Type", "application/json"),
            )

            Then("failed=true, DLQ 파일에 status=5500 기록, writer 에 아무것도 insert 되지 않음") {
                val result = service.ingest("BTC", "1m")
                result.failed.shouldBeTrue()
                result.inserted shouldBe 0
                writer.rowsFor("BTC_KRW", "1m").shouldBeEmpty()
                val dlqFile = tempRoot.resolve("dlq").resolve("BTC_KRW-1m.dlq.log")
                Files.exists(dlqFile).shouldBeTrue()
                val content = Files.readString(dlqFile)
                (content.contains("status=5500")).shouldBeTrue()
            }
        }
    }

    Given("빗썸이 HTTP 500 으로 실패") {
        When("ingest 호출") {
            server.enqueue(MockResponse().setResponseCode(500))

            Then("failed=true, DLQ 에 이유 기록") {
                val result = service.ingest("ETH", "1m")
                result.failed.shouldBeTrue()
                result.inserted shouldBe 0
                val dlqFile = tempRoot.resolve("dlq").resolve("ETH_KRW-1m.dlq.log")
                Files.exists(dlqFile).shouldBeTrue()
            }
        }
    }
})

/** 테스트 전용 in-memory [CandleWriter]. 호출된 (symbol, interval, rows) 기록. */
private class InMemoryCandleWriter : CandleWriter {
    private val entries = CopyOnWriteArrayList<Entry>()

    override fun write(symbol: String, interval: String, rows: List<Candle>) {
        entries.add(Entry(symbol, interval, rows.toList()))
    }

    fun rowsFor(symbol: String, interval: String): List<Candle> =
        entries.filter { it.symbol == symbol && it.interval == interval }.flatMap { it.rows }

    fun reset() { entries.clear() }

    private data class Entry(val symbol: String, val interval: String, val rows: List<Candle>)
}
