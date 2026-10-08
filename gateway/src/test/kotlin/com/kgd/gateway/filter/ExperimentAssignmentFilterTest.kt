package com.kgd.gateway.filter

import com.kgd.common.analytics.BucketAssigner
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.every
import io.mockk.mockk
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.data.redis.core.ReactiveStringRedisTemplate
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule

/**
 * 실험 배정은 게이트웨이가 발급한 방문자 id 로만 한다.
 * 이 전역 필터는 라우트의 인증 필터보다 먼저 돌아서, 여기서 보이는 `X-User-Id` 는 늘 클라이언트가 보낸 값이다.
 * 판정 근거: 필터가 백엔드로 넘긴 요청의 `X-Experiment-{id}` 값과, 같은 함수(BucketAssigner)로 낸 기대값.
 */
class ExperimentAssignmentFilterTest : BehaviorSpec({
    val experimentId = 7L
    val variants = listOf("A" to 50, "B" to 50)
    val redis = mockk<ReactiveStringRedisTemplate>()
    every { redis.opsForValue().get(ExperimentAssignmentFilter.ACTIVE_EXPERIMENTS_KEY) } returns
        Mono.just("""[{"id":$experimentId,"variants":[{"first":"A","second":50},{"first":"B","second":50}]}]""")
    val filter = ExperimentAssignmentFilter(redis, JsonMapper.builder().addModule(kotlinModule()).build())

    fun forward(configure: MockServerHttpRequest.BaseBuilder<*>.() -> Unit): ServerWebExchange? {
        var forwarded: ServerWebExchange? = null
        val chain = GatewayFilterChain { ex -> forwarded = ex; Mono.empty() }
        val request = MockServerHttpRequest.get("/api/v1/products").apply(configure).build()
        filter.filter(MockServerWebExchange.from(request), chain).block()
        return forwarded
    }

    val visitorId = "visitor-1"
    val visitorVariant = BucketAssigner.assign(visitorId, experimentId, variants)
    // 방문자와 다른 칸에 떨어지는 회원 id — 같은 칸이면 어느 쪽을 읽었는지 가를 수 없다
    val forgedUserId = (1..1000).map { it.toString() }
        .first { BucketAssigner.assign(it, experimentId, variants) != visitorVariant }

    given("방문자 id 와 클라이언트가 붙인 X-User-Id 가 함께 온 요청") {
        `when`("필터를 지나면") {
            then("방문자 id 의 칸으로 배정한다 — 클라이언트가 회원 id 로 칸을 고를 수 없다") {
                val forwarded = forward {
                    header(VisitorIdFilter.VISITOR_HEADER, visitorId)
                    header("X-User-Id", forgedUserId)
                }
                forwarded shouldNotBe null
                forwarded!!.request.headers.getFirst("X-Experiment-$experimentId") shouldBe visitorVariant
            }
        }
    }

    given("방문자 id 없이 X-User-Id 만 온 요청") {
        `when`("필터를 지나면") {
            then("배정하지 않는다") {
                val forwarded = forward { header("X-User-Id", forgedUserId) }
                forwarded shouldNotBe null
                forwarded!!.request.headers.getFirst("X-Experiment-$experimentId") shouldBe null
            }
        }
    }

    given("클라이언트가 X-Experiment-* 를 직접 붙인 요청") {
        `when`("활성 실험이 없으면") {
            then("백엔드로 넘기기 전에 벗긴다") {
                val noExperiments = mockk<ReactiveStringRedisTemplate>()
                every { noExperiments.opsForValue().get(ExperimentAssignmentFilter.ACTIVE_EXPERIMENTS_KEY) } returns Mono.empty()
                val f = ExperimentAssignmentFilter(noExperiments, JsonMapper.builder().addModule(kotlinModule()).build())
                var forwarded: ServerWebExchange? = null
                val request = MockServerHttpRequest.get("/api/v1/products")
                    .header(VisitorIdFilter.VISITOR_HEADER, visitorId)
                    .header("X-Experiment-$experimentId", "Z")
                    .build()
                f.filter(MockServerWebExchange.from(request)) { ex -> forwarded = ex; Mono.empty() }.block()
                forwarded!!.request.headers.getFirst("X-Experiment-$experimentId") shouldBe null
            }
        }
        `when`("활성 실험이 있으면") {
            then("클라이언트 값이 아니라 게이트웨이 배정값 하나만 남는다") {
                val forwarded = forward {
                    header(VisitorIdFilter.VISITOR_HEADER, visitorId)
                    header("X-Experiment-$experimentId", "Z")
                }
                forwarded!!.request.headers["X-Experiment-$experimentId"] shouldBe listOf(visitorVariant)
            }
        }
    }
})

