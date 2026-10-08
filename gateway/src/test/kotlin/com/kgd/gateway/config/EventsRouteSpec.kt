package com.kgd.gateway.config

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.route.Route
import org.springframework.cloud.gateway.route.RouteLocator
import org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_ROUTE_ATTR
import org.springframework.core.annotation.AnnotationAwareOrderComparator
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import reactor.core.publisher.Mono
import java.time.Duration

/**
 * 화면 계측 수집 경로(`/api/v1/events`)는 익명으로 열려 있어 레이트리밋을 건다.
 *
 * 판정 근거는 게이트웨이의 실제 라우트 표다 — 요청이 처음 맞는 라우트와, 그 라우트의 필터를 돌린 뒤
 * 응답에 남는 리미터 헤더. Redis 는 닫힌 포트라 리미터는 fail-open 으로 통과시키되 헤더는 남긴다.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "spring.data.redis.host=localhost",
        "spring.data.redis.port=16379",
        "logging.level.org.springframework.cloud.gateway=INFO",
    ],
)
class EventsRouteSpec(
    @Autowired private val routeLocator: RouteLocator,
) : BehaviorSpec({

    val routes: List<Route> = routeLocator.routes.collectList().block().orEmpty()

    fun exchange(path: String) = MockServerWebExchange.from(MockServerHttpRequest.post("http://1989v.com$path").build())

    fun firstMatch(path: String): String? {
        val ex = exchange(path)
        return routes.firstOrNull { Mono.from(it.predicate.apply(ex)).block() == true }?.id
    }

    /** 라우트의 필터를 순서대로 돌리고 응답 헤더에 남은 리미터 보충량을 읽는다 */
    fun replenishRateAfterFilters(routeId: String, path: String): String? {
        val route = routes.first { it.id == routeId }
        val ex = exchange(path)
        ex.attributes[GATEWAY_ROUTE_ATTR] = route
        val filters = route.filters.sortedWith(AnnotationAwareOrderComparator.INSTANCE)
        fun chainAt(i: Int): GatewayFilterChain = GatewayFilterChain { e ->
            if (i == filters.size) Mono.empty() else filters[i].filter(e, chainAt(i + 1))
        }
        chainAt(0).filter(ex).block(Duration.ofSeconds(20))
        return ex.response.headers.getFirst("X-RateLimit-Replenish-Rate")
    }

    Given("화면 계측 수집 경로") {
        Then("레이트리밋이 걸린 전용 라우트가 받는다") {
            firstMatch("/api/v1/events") shouldBe "analytics-events"
        }
        Then("그 라우트를 지나면 리미터가 요청을 센다") {
            replenishRateAfterFilters("analytics-events", "/api/v1/events") shouldNotBe null
        }
        Then("analytics 의 나머지 경로는 그대로 analytics-service 가 받는다") {
            firstMatch("/api/v1/scores/products") shouldBe "analytics-service"
        }
    }
}) {
    override fun extensions() = listOf(SpringExtension)
}
