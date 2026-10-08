package com.kgd.common.shortlink

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import org.springframework.boot.autoconfigure.AutoConfigurations
import org.springframework.boot.test.context.runner.ApplicationContextRunner

class ShortLinksTest : BehaviorSpec({

    val links = ShortLinks(ShortLinkProperties())

    given("기본 설정") {
        `when`("단축 주소를 만들면") {
            then("apex origin 에 접두사와 코드를 붙인다") {
                links.shortUrl(ShortLinkPrefix.GAME, "abc123") shouldBe "https://1989v.com/g/abc123"
                links.shortUrl(ShortLinkPrefix.RESUME, "Ab3dE6gH9k") shouldBe "https://1989v.com/r/Ab3dE6gH9k"
            }
        }
        `when`("노출이 꺼져 있으면") {
            then("응답에 실을 단축 주소는 null 이다") {
                links.exposedShortUrl(ShortLinkPrefix.BLOG, "abc123") shouldBe null
            }
        }
        `when`("목적지를 만들면") {
            then("서비스 origin 에 경로 세그먼트를 인코딩해 붙인다") {
                links.destination(ShortLinkPrefix.PLACE, "attractions", "42") shouldBe
                    "https://place.1989v.com/attractions/42"
                links.destination(ShortLinkPrefix.PLACE, "en", "attractions", "42") shouldBe
                    "https://place.1989v.com/en/attractions/42"
                links.destination(ShortLinkPrefix.BLOG, "posts", "a/b c?d#e") shouldBe
                    "https://blog.1989v.com/posts/a%2Fb%20c%3Fd%23e"
                links.destination(ShortLinkPrefix.GAME, "games", "한글-게임") shouldBe
                    "https://game.1989v.com/games/%ED%95%9C%EA%B8%80-%EA%B2%8C%EC%9E%84"
            }
            then("쿼리는 서비스 루트 뒤에 인코딩해 붙인다") {
                links.destination(ShortLinkPrefix.RESUME, query = mapOf("k" to "tok+en/=")) shouldBe
                    "https://resume.1989v.com/?k=tok%2Ben%2F%3D"
            }
            then("목록 목적지는 서비스 루트다") {
                links.home(ShortLinkPrefix.RESUME) shouldBe "https://resume.1989v.com/"
                links.home(ShortLinkPrefix.PLACE) shouldBe "https://place.1989v.com/"
                links.home(ShortLinkPrefix.GAME) shouldBe "https://game.1989v.com/"
                links.home(ShortLinkPrefix.BLOG) shouldBe "https://blog.1989v.com/"
            }
        }
    }

    given("설정을 바꾼 origin") {
        val custom = ShortLinks(
            ShortLinkProperties(origin = "http://localhost:8080/", gameOrigin = "http://game.local", expose = true),
        )
        `when`("단축 주소와 목적지를 만들면") {
            then("끝의 / 를 정리한 설정값만 쓴다") {
                custom.exposedShortUrl(ShortLinkPrefix.GAME, "abc123") shouldBe "http://localhost:8080/g/abc123"
                custom.home(ShortLinkPrefix.GAME) shouldBe "http://game.local/"
            }
        }
    }

    given("요청 헤더로 주소를 바꿀 수 있는지") {
        `when`("공개 함수의 매개변수 타입을 보면") {
            then("요청 객체를 받는 함수가 없다 — Host·X-Forwarded-Host 가 들어올 통로가 없다") {
                val requestTypes = ShortLinks::class.java.declaredMethods
                    .flatMap { method -> method.parameterTypes.map { it.name } }
                    .filter { "Request" in it || "Exchange" in it || "HttpHeaders" in it }
                requestTypes shouldBe emptyList()
            }
        }
    }

    given("자동 구성") {
        val runner = ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ShortLinkAutoConfiguration::class.java))
        `when`("kgd.common.short-link.* 를 주면") {
            then("그 값으로 ShortLinks 가 뜬다") {
                runner.withPropertyValues(
                    "kgd.common.short-link.origin=https://short.example",
                    "kgd.common.short-link.blog-origin=https://blog.example",
                    "kgd.common.short-link.expose=true",
                ).run { ctx ->
                    val bean = ctx.getBean(ShortLinks::class.java)
                    bean.exposedShortUrl(ShortLinkPrefix.BLOG, "abc123") shouldBe "https://short.example/b/abc123"
                    bean.home(ShortLinkPrefix.BLOG) shouldBe "https://blog.example/"
                }
            }
        }
        `when`("아무 설정도 없으면") {
            then("기본값으로 뜨고 노출은 꺼져 있다") {
                runner.run { ctx ->
                    val bean = ctx.getBean(ShortLinks::class.java)
                    bean.shortUrl(ShortLinkPrefix.PLACE, "abc123") shouldBe "https://1989v.com/p/abc123"
                    bean.exposedShortUrl(ShortLinkPrefix.PLACE, "abc123") shouldBe null
                }
            }
        }
    }
})
