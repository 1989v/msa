package com.kgd.wishlist.presentation.share.controller

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.common.shortlink.ShortLinkProperties
import com.kgd.wishlist.application.share.port.CollectionSharePort
import com.kgd.wishlist.application.share.service.CollectionShareService
import com.kgd.wishlist.application.wishlist.port.WishlistRepositoryPort
import com.kgd.wishlist.application.wishlist.service.WishlistService
import com.kgd.wishlist.presentation.wishlist.controller.WishlistController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.confirmVerified
import io.mockk.mockk
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Clock

/**
 * 공유 열람 경로가 찜 컨트롤러와 **한 디스패처**에 있어도 공유 컨트롤러가 받는지.
 *
 * 공유 컨트롤러가 빠지면 `GET /api/v1/wishlist/shared/x` 는 찜의 `PUT/DELETE /{targetType}/{targetKey}`
 * 와 경로가 겹쳐 405 가 된다.
 */
class ShareDispatchTest : BehaviorSpec({

    Given("찜 컨트롤러와 공유 컨트롤러를 함께 올린 디스패처") {
        // 형식이 틀린 토큰은 저장소를 보지 않아야 한다 — 엄격한 목이라 호출되면 500 으로 드러난다
        val sharePort = mockk<CollectionSharePort>()
        val share = CollectionShareService(sharePort, ShortLinkProperties(origin = "https://short.test"), Clock.systemUTC())
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

        Then("GET shared/x 는 405 가 아니라 없는 토큰의 404 다") {
            mvc.perform(get("/api/v1/wishlist/shared/x")).andReturn().response.status shouldBe 404
            confirmVerified(sharePort)
        }
        Then("GET /c/x 는 수신 화면의 「찾을 수 없는 링크」로 302 한다") {
            val res = mvc.perform(get("/c/x")).andReturn().response
            res.status shouldBe 302
            res.getHeader("Location") shouldBe "https://short.test/shared/invalid"
        }
    }
})
