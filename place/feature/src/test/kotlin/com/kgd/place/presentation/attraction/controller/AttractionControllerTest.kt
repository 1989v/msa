package com.kgd.place.presentation.attraction.controller

import com.kgd.place.application.attraction.usecase.GetAttractionUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable

class AttractionControllerTest : BehaviorSpec({
    val getAttractionUseCase = mockk<GetAttractionUseCase>()
    val controller = AttractionController(mockk(), getAttractionUseCase, mockk())

    beforeEach { clearMocks(getAttractionUseCase) }

    given("관광지 목록 조회 시") {
        `when`("afterId 가 있으면") {
            then("키셋으로 읽고 다음 커서를 주며, 세지 않은 건수는 -1 이어야 한다") {
                every { getAttractionUseCase.findAfter("ko", 100L, 50) } returns
                    GetAttractionUseCase.AttractionSlice(items = emptyList(), nextAfterId = 150L)

                val body = controller.findPage(lang = "ko", page = 0, size = 50, afterId = 100L).data!!

                body.nextAfterId shouldBe 150L
                body.totalElements shouldBe -1L
                body.totalPages shouldBe -1
                verify(exactly = 0) { getAttractionUseCase.findPage(any(), any()) }
            }
        }

        `when`("afterId 가 없으면") {
            then("예전 OFFSET 페이지 그대로이고 다음 커서는 비어 있어야 한다") {
                every { getAttractionUseCase.findPage(null, any<Pageable>()) } returns
                    PageImpl(emptyList(), Pageable.ofSize(20).withPage(2), 45) as Page<GetAttractionUseCase.AttractionView>

                val body = controller.findPage(lang = null, page = 2, size = 20, afterId = null).data!!

                body.nextAfterId shouldBe null
                body.totalElements shouldBe 45L
                body.totalPages shouldBe 3
                body.currentPage shouldBe 2
                verify(exactly = 0) { getAttractionUseCase.findAfter(any(), any(), any()) }
            }
        }
    }
})
