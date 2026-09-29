package com.kgd.search.infrastructure.render

import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.render.AttractionShellProvider.ShellState
import com.sun.net.httpserver.HttpServer
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.longs.shouldBeLessThan
import io.kotest.matchers.shouldBe
import org.springframework.boot.health.contributor.Status
import java.net.InetSocketAddress
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.util.concurrent.atomic.AtomicInteger

/**
 * 셸 제공자의 상태를 **실제 HTTP 로** 만든다 — 로컬 서버의 응답을 바꿔 가며 캐시·마지막 정상본·
 * 백오프·시간 초과를 본다. 시각은 주입한 시계로 옮긴다(5분·30초를 기다리지 않는다).
 */
class AttractionShellProviderTest : BehaviorSpec({

    class MutableClock(var now: Instant = Instant.parse("2026-09-29T00:00:00Z")) : Clock() {
        override fun getZone(): ZoneId = ZoneId.of("UTC")
        override fun withZone(zone: ZoneId?): Clock = this
        override fun instant(): Instant = now
        fun advance(d: Duration) { now = now.plus(d) }
    }

    /** 응답을 바꿀 수 있는 로컬 portal-fe. hits 는 실제로 받은 요청 수다. */
    class FakePortal {
        val hits = AtomicInteger()
        @Volatile var status = 200
        @Volatile var body = "<html><head><!--seo:start--><!--seo:end--></head><body><div id=\"root\"></div></body></html>"
        @Volatile var delayMs = 0L
        val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).apply {
            createContext("/index.html") { ex ->
                hits.incrementAndGet()
                if (delayMs > 0) Thread.sleep(delayMs)
                val bytes = body.toByteArray()
                ex.sendResponseHeaders(status, bytes.size.toLong())
                ex.responseBody.use { it.write(bytes) }
            }
            executor = java.util.concurrent.Executors.newCachedThreadPool()
            start()
        }
        val url get() = "http://127.0.0.1:${server.address.port}/index.html"
        fun stop() = server.stop(0)
    }

    fun providerFor(url: String, clock: Clock) =
        AttractionShellProvider(AttractionRenderProperties(shellUrl = url), clock)

    given("portal-fe 가 정상일 때") {
        then("받아 온 셸을 5분 캐시하고, 5분이 지나면 다시 받는다") {
            val portal = FakePortal()
            val clock = MutableClock()
            try {
                val provider = providerFor(portal.url, clock)
                provider.state() shouldBe ShellState.UNKNOWN
                provider.shell() shouldBe portal.body
                provider.state() shouldBe ShellState.OK

                clock.advance(Duration.ofMinutes(4))
                provider.shell()
                portal.hits.get() shouldBe 1

                clock.advance(Duration.ofMinutes(1).plusSeconds(1))
                provider.shell()
                portal.hits.get() shouldBe 2
                AttractionShellHealthIndicator(provider).health().status shouldBe Status.UP
            } finally {
                portal.stop()
            }
        }
    }

    given("받아 둔 셸이 있고 portal-fe 가 실패하기 시작할 때") {
        then("마지막 정상본(STALE)을 쓰고, 30초 동안은 다시 부르지 않는다") {
            val portal = FakePortal()
            val clock = MutableClock()
            try {
                val provider = providerFor(portal.url, clock)
                val good = provider.shell()

                portal.status = 503
                clock.advance(Duration.ofMinutes(6))
                provider.shell() shouldBe good
                provider.state() shouldBe ShellState.STALE
                portal.hits.get() shouldBe 2

                clock.advance(Duration.ofSeconds(29))
                provider.shell() shouldBe good
                portal.hits.get() shouldBe 2

                clock.advance(Duration.ofSeconds(2))
                portal.status = 200
                provider.shell() shouldBe good
                portal.hits.get() shouldBe 3
                provider.state() shouldBe ShellState.OK

                val health = AttractionShellHealthIndicator(provider)
                portal.status = 500
                clock.advance(Duration.ofMinutes(6))
                provider.shell()
                health.health().status shouldBe Status.DOWN
                health.health().details["state"] shouldBe "STALE"
            } finally {
                portal.stop()
            }
        }
    }

    given("seo 마커가 없는 응답") {
        then("셸로 받지 않는다 — 한 번도 못 받았으면 null 과 MISSING") {
            val portal = FakePortal().apply { body = "<html><body>maintenance</body></html>" }
            try {
                val provider = providerFor(portal.url, MutableClock())
                provider.shell() shouldBe null
                provider.state() shouldBe ShellState.MISSING
                AttractionShellHealthIndicator(provider).health().details["state"] shouldBe "MISSING"
            } finally {
                portal.stop()
            }
        }
    }

    given("portal-fe 가 응답하지 않을 때") {
        then("1초 시간 초과로 끊는다 — 요청 스레드를 붙잡지 않는다") {
            val portal = FakePortal().apply { delayMs = 3_000 }
            try {
                val provider = providerFor(portal.url, MutableClock())
                val started = System.nanoTime()
                provider.shell() shouldBe null
                val elapsedMs = Duration.ofNanos(System.nanoTime() - started).toMillis()
                elapsedMs shouldBeLessThan 2_000L
                provider.state() shouldBe ShellState.MISSING
            } finally {
                portal.stop()
            }
        }
    }
})
