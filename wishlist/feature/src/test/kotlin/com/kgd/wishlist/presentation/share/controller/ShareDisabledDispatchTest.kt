package com.kgd.wishlist.presentation.share.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.wishlist.application.share.config.WishlistShareProperties
import com.kgd.wishlist.application.share.port.CollectionSharePort
import com.kgd.wishlist.application.share.service.CollectionShareService
import com.kgd.wishlist.application.share.usecase.GetSharedCollectionUseCase
import com.kgd.wishlist.application.share.usecase.ManageCollectionShareUseCase
import com.kgd.wishlist.application.share.usecase.ResolveCollectionShortLinkUseCase
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.application.wishlist.service.WishlistService
import com.kgd.wishlist.presentation.wishlist.controller.WishlistController
import io.kotest.assertions.withClue
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.confirmVerified
import io.mockk.mockk
import org.springframework.boot.test.context.runner.WebApplicationContextRunner
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Clock
import java.util.function.Supplier

/**
 * 설정이 꺼졌을 때 공유 경로 다섯이 전부 같은 404 인지 — 찜 컨트롤러와 **한 디스패처**에 올려서 본다.
 *
 * 공유 컨트롤러가 빠지면 `GET /api/v1/wishlist/shared/x` 는 찜의 `PUT/DELETE /{targetType}/{targetKey}`
 * 와 경로가 겹쳐 405 가 된다. 그래서 컨트롤러는 설정과 무관하게 등록되어야 하고, 판정은 서비스 첫 줄이 한다.
 */
class ShareDisabledDispatchTest : BehaviorSpec({

    Given("kgd.wishlist.share.enabled=false 인 디스패처") {
        // 꺼짐이면 저장소를 한 번도 보지 않아야 한다 — 엄격한 목이라 호출되면 500 으로 드러난다
        val sharePort = mockk<CollectionSharePort>()
        val share = CollectionShareService(
            sharePort, WishlistShareProperties(enabled = false),
            ShortLinkProperties(origin = "https://short.test"), Clock.systemUTC(),
        )
        val wishlist = WishlistService(mockk<WishlistRepositoryPort>())
        val mvc = MockMvcBuilders
            .standaloneSetup(
                WishlistController(wishlist, wishlist, wishlist, wishlist, wishlist, wishlist),
                CollectionShareController(share),
                SharedCollectionController(share, share),
            )
            .setControllerAdvice(GlobalExceptionHandler())
            .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
            .build()

        // 소유자 경로는 X-User-Id 를 붙인다 — 필수 헤더 누락 400 이 404 를 가리지 않게
        val requests = mapOf(
            "POST share" to post("/api/v1/wishlist/collections/1/share").header("X-User-Id", "1"),
            "POST share 0일" to post("/api/v1/wishlist/collections/1/share").header("X-User-Id", "1")
                .contentType(MediaType.APPLICATION_JSON).content("""{"expiresInDays":0}"""),
            "GET share" to get("/api/v1/wishlist/collections/1/share").header("X-User-Id", "1"),
            "DELETE share" to delete("/api/v1/wishlist/collections/1/share").header("X-User-Id", "1"),
            "GET shared" to get("/api/v1/wishlist/shared/x"),
            "GET /c/x" to get("/c/x"),
        )

        Then("다섯 경로(+ 범위 밖 일수)가 모두 404 이고 본문이 같다 — shared/x 가 405 가 아니다") {
            val responses = requests.mapValues { (_, req) -> mvc.perform(req).andReturn().response }
            val reference = responses.getValue("GET shared").contentAsString
            responses.forEach { (name, res) ->
                withClue(name) {
                    res.status shouldBe 404
                    res.contentAsString shouldBe reference
                }
            }
            confirmVerified(sharePort)
        }
    }

    Given("설정이 꺼진 웹 컨텍스트") {
        Then("공유 컨트롤러 둘은 그래도 빈으로 등록된다") {
            WebApplicationContextRunner()
                .withPropertyValues("kgd.wishlist.share.enabled=false")
                .withUserConfiguration(CollectionShareController::class.java, SharedCollectionController::class.java)
                .withBean(ManageCollectionShareUseCase::class.java, Supplier { mockk<ManageCollectionShareUseCase>() })
                .withBean(GetSharedCollectionUseCase::class.java, Supplier { mockk<GetSharedCollectionUseCase>() })
                .withBean(
                    ResolveCollectionShortLinkUseCase::class.java,
                    Supplier { mockk<ResolveCollectionShortLinkUseCase>() },
                )
                .run { ctx ->
                    ctx.startupFailure shouldBe null
                    ctx.getBeansOfType(CollectionShareController::class.java).values shouldHaveSize 1
                    ctx.getBeansOfType(SharedCollectionController::class.java).values shouldHaveSize 1
                }
        }
    }
})
