package com.kgd.blog.infrastructure

import com.kgd.blog.infrastructure.render.BlogShellHealthIndicator
import com.kgd.blog.infrastructure.render.ShellHtmlProvider
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import org.springframework.boot.health.contributor.Status

/**
 * 셸 페치가 깨지면 헬스가 DOWN 이 되는지. **실제로 HTTP 를 쏴서** 상태를 만든다 —
 * 상태 플래그를 손으로 세워 놓고 매핑만 확인하면 내가 만든 근거를 내가 재는 꼴이 된다.
 */
class BlogShellHealthIndicatorTest : BehaviorSpec({

    Given("portal-fe 를 못 부르는 상태") {
        Then("셸은 null 이고 헬스는 DOWN·MISSING 이다") {
            // 아무도 듣지 않는 포트 — 운영에서 NetworkPolicy 에 막혔을 때와 같은 결과가 된다
            val provider = ShellHtmlProvider("http://127.0.0.1:1/index.html")
            provider.shell() shouldBe null
            provider.state() shouldBe ShellHtmlProvider.ShellState.MISSING

            val health = BlogShellHealthIndicator(provider).health()
            health.status shouldBe Status.DOWN
            health.details["state"] shouldBe "MISSING"
            (health.details["meaning"] as String) shouldContain "SPA 없이"
        }
    }

    Given("셸을 정상적으로 받는 상태") {
        Then("헬스는 UP 이다") {
            val server = HttpServer.create(InetSocketAddress(0), 0)
            val body = "<html><head><!--seo:start--><!--seo:end--></head><body></body></html>"
            server.createContext("/index.html") { ex ->
                val bytes = body.toByteArray()
                ex.sendResponseHeaders(200, bytes.size.toLong())
                ex.responseBody.use { it.write(bytes) }
            }
            server.start()
            try {
                val provider = ShellHtmlProvider("http://127.0.0.1:${server.address.port}/index.html")
                provider.shell() shouldBe body
                provider.state() shouldBe ShellHtmlProvider.ShellState.OK
                BlogShellHealthIndicator(provider).health().status shouldBe Status.UP
            } finally {
                server.stop(0)
            }
        }
    }
})
