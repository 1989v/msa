package com.kgd.sevensplit.infrastructure.bithumb

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.shouldBe
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.springframework.web.reactive.function.client.WebClient

/**
 * TG-07.5: MockWebServer 로 빗썸 응답을 stub 하여 [BithumbRestClient] 단위 검증.
 *
 * 커버 케이스:
 * - 정상 응답(2 rows) → 파싱 OK
 * - 빈 data 배열 → rows() 가 empty
 * - 5xx → [BithumbApiException] 으로 감싸 던짐
 *
 * 실제 빗썸 엔드포인트 호출 없음. Docker 불필요.
 */
class BithumbRestClientSpec : BehaviorSpec({
    lateinit var server: MockWebServer
    lateinit var client: BithumbRestClient

    beforeSpec {
        server = MockWebServer()
        server.start()
        val webClient = WebClient.builder()
            .baseUrl(server.url("/").toString())
            .codecs { it.defaultCodecs().maxInMemorySize(8 * 1024 * 1024) }
            .build()
        client = BithumbRestClient(webClient)
    }

    afterSpec {
        server.shutdown()
    }

    Given("MockWebServer 가 빗썸 응답을 흉내냄") {

        When("status=0000, data=2rows 정상 응답") {
            val payload = """
                {"status":"0000","data":[
                    [1700000000000,"30000000","30100000","30200000","29900000","1.5"],
                    [1700000060000,"30100000","30050000","30150000","30040000","0.8"]
                ]}
            """.trimIndent()
            server.enqueue(
                MockResponse()
                    .setBody(payload)
                    .setHeader("Content-Type", "application/json"),
            )

            Then("파싱된 Candle 2개 반환") {
                val resp = client.fetchCandles("BTC", "KRW", "1m")
                resp.status shouldBe "0000"
                val rows = resp.rows()
                rows.size shouldBe 2
                rows[0].timestampMs shouldBe 1700000000000L
                rows[0].open.toPlainString() shouldBe "30000000"
                // 배열 순서: ts, open, close, high, low, volume
                rows[0].close.toPlainString() shouldBe "30100000"
                rows[0].high.toPlainString() shouldBe "30200000"
                rows[0].low.toPlainString() shouldBe "29900000"
                rows[0].volume.toPlainString() shouldBe "1.5"
            }
        }

        When("status=0000, data=[] 빈 응답") {
            server.enqueue(
                MockResponse()
                    .setBody("""{"status":"0000","data":[]}""")
                    .setHeader("Content-Type", "application/json"),
            )

            Then("rows() 는 빈 리스트") {
                val resp = client.fetchCandles("ETH", "KRW", "1m")
                resp.status shouldBe "0000"
                resp.rows().shouldBeEmpty()
            }
        }

        When("HTTP 500 에러") {
            server.enqueue(MockResponse().setResponseCode(500))

            Then("BithumbApiException 으로 감싸 던진다") {
                shouldThrow<BithumbApiException> {
                    client.fetchCandles("BTC", "KRW", "1m")
                }
            }
        }
    }
})
