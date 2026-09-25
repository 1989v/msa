package com.kgd.payment.infrastructure.pg.toss

import com.kgd.payment.application.payment.port.PgCallException
import com.kgd.payment.application.payment.port.PgInquiry
import com.kgd.payment.application.payment.port.PgResult
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.concurrent.TimeUnit

/**
 * 토스 v1 REST 계약 — 실제 HTTP 로 MockWebServer 에 보내고, 서버가 받은 경로·본문·인증 헤더를 본다.
 * 어댑터는 운영 설정과 같은 조립 함수([TossPgConfig.tossRestClient])로 만든다.
 */
class TossPgAdapterTest : BehaviorSpec({

    val json = jacksonMapperBuilder().build()
    val basic = "Basic " + Base64.getEncoder().encodeToString("test_sk_123:".toByteArray())

    fun withServer(block: (MockWebServer, TossPgAdapter) -> Unit) {
        val server = MockWebServer().also { it.start() }
        try {
            val client = TossPgConfig.tossRestClient(
                baseUrl = server.url("/").toString().trimEnd('/'),
                secretKey = "test_sk_123",
                connectTimeout = Duration.ofSeconds(3),
                readTimeout = Duration.ofMillis(300),
            )
            block(server, TossPgAdapter(client, TossPgConfig.circuitBreaker(), json))
        } finally {
            server.shutdown()
        }
    }

    fun ok(body: String) = MockResponse().setResponseCode(200).setHeader("Content-Type", "application/json").setBody(body)

    given("승인 확인 POST /v1/payments/confirm") {
        then("paymentKey·orderId(=orderNo)·amount 를 Basic 인증(시크릿 키 + ':')으로 보내고 DONE 이면 매입까지 끝난 승인") {
            withServer { server, toss ->
                server.enqueue(ok("""{"paymentKey":"tpk_1","orderId":"ORD-1-1","status":"DONE","totalAmount":10000}"""))

                toss.confirm("tpk_1", "ORD-1-1", 10_000L) shouldBe PgResult.Approved("tpk_1", captured = true)

                val req = server.takeRequest(1, TimeUnit.SECONDS)!!
                req.method shouldBe "POST"
                req.path shouldBe "/v1/payments/confirm"
                req.getHeader("Authorization") shouldBe basic
                val body = json.readTree(req.body.readUtf8())
                body["paymentKey"].asString() shouldBe "tpk_1"
                body["orderId"].asString() shouldBe "ORD-1-1"
                body["amount"].asLong() shouldBe 10_000L
            }
        }
        then("4xx 는 거절(토스 오류 코드), 5xx·응답 없음은 결과 미상") {
            withServer { server, toss ->
                server.enqueue(
                    MockResponse().setResponseCode(400).setHeader("Content-Type", "application/json")
                        .setBody("""{"code":"REJECT_CARD_PAYMENT","message":"한도초과"}"""),
                )
                server.enqueue(MockResponse().setResponseCode(502))
                server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))

                toss.confirm("tpk_1", "ORD-1-1", 10_000L) shouldBe PgResult.Declined("REJECT_CARD_PAYMENT")
                toss.confirm("tpk_1", "ORD-1-1", 10_000L).shouldBeInstanceOf<PgResult.Unknown>()
                toss.confirm("tpk_1", "ORD-1-1", 10_000L).shouldBeInstanceOf<PgResult.Unknown>()
            }
        }
    }

    given("조회 GET /v1/payments/orders/{orderId}") {
        then("DONE 은 매입까지 끝난 승인(PG 금액), 없으면 NotFound, 진행 중이면 미결") {
            withServer { server, toss ->
                server.enqueue(ok("""{"paymentKey":"tpk_1","orderId":"ORD-1-1","status":"DONE","totalAmount":10000}"""))
                server.enqueue(MockResponse().setResponseCode(404).setBody("""{"code":"NOT_FOUND_PAYMENT","message":"없음"}"""))
                server.enqueue(ok("""{"paymentKey":"tpk_1","orderId":"ORD-1-1","status":"IN_PROGRESS","totalAmount":10000}"""))

                toss.inquire("ORD-1-1") shouldBe PgInquiry.Approved("tpk_1", 10_000L, captured = true)
                toss.inquire("ORD-1-1") shouldBe PgInquiry.NotFound
                toss.inquire("ORD-1-1").shouldBeInstanceOf<PgInquiry.Unavailable>()

                val req = server.takeRequest(1, TimeUnit.SECONDS)!!
                req.method shouldBe "GET"
                req.path shouldBe "/v1/payments/orders/ORD-1-1"
                req.getHeader("Authorization") shouldBe basic
            }
        }
    }

    given("취소 POST /v1/payments/{paymentKey}/cancel") {
        then("환불은 cancelAmount 와 멱등 키(refundKey)를 싣고, VOID 는 금액 없이 전액 취소") {
            withServer { server, toss ->
                server.enqueue(ok("""{"paymentKey":"tpk_1","status":"PARTIAL_CANCELED"}"""))
                server.enqueue(ok("""{"paymentKey":"tpk_2","status":"CANCELED"}"""))

                toss.refund("tpk_1", 3_000L, "rf-1", "부분 취소")
                toss.void("tpk_2", 10_000L)

                val refund = server.takeRequest(1, TimeUnit.SECONDS)!!
                refund.path shouldBe "/v1/payments/tpk_1/cancel"
                refund.getHeader("Authorization") shouldBe basic
                refund.getHeader("Idempotency-Key") shouldBe "rf-1"
                json.readTree(refund.body.readUtf8()).let {
                    it["cancelAmount"].asLong() shouldBe 3_000L
                    it["cancelReason"].asString() shouldBe "부분 취소"
                }
                val void = server.takeRequest(1, TimeUnit.SECONDS)!!
                void.path shouldBe "/v1/payments/tpk_2/cancel"
                json.readTree(void.body.readUtf8()).has("cancelAmount") shouldBe false
            }
        }
        then("5xx 는 재시도 가능한 호출 실패") {
            withServer { server, toss ->
                server.enqueue(MockResponse().setResponseCode(503))
                shouldThrow<PgCallException> { toss.refund("tpk_1", 3_000L, "rf-1", null) }.retryable shouldBe true
            }
        }
    }

    given("매입") {
        then("토스는 승인 확인이 곧 매입이라 HTTP 를 부르지 않고, 결제 쪽 매입 시각을 그대로 돌려준다") {
            withServer { server, toss ->
                val at = Instant.parse("2026-09-24T14:59:59.999Z")
                toss.capture("tpk_1", 10_000L, at) shouldBe at
                server.requestCount shouldBe 0
            }
        }
    }
})
