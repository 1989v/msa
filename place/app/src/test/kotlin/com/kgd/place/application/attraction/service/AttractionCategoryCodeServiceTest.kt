package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionCategoryCodeRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionCategoryCodesUseCase
import com.kgd.place.domain.attraction.model.AttractionCategoryCode
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot

class AttractionCategoryCodeServiceTest : BehaviorSpec({

    val repository = mockk<AttractionCategoryCodeRepositoryPort>()
    val service = AttractionCategoryCodeService(repository)

    Given("분류 코드가 들어올 때") {
        When("대·중·소가 섞여 있으면") {
            val captured = slot<List<AttractionCategoryCode>>()
            every { repository.upsertAll(capture(captured)) } answers { captured.captured.size }

            service.upsert(
                listOf(
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA", "자연관광"),
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA02", "자연경관(하천‧해양)"),
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA020100", "해수욕장"),
                ),
            )

            Then("코드 길이에서 깊이가 나온다") {
                captured.captured.map { it.depth } shouldBe listOf(1, 2, 3)
            }

            Then("상위 코드는 앞자리에서 유도된다") {
                captured.captured.map { it.parentCode } shouldBe listOf(null, "NA", "NA02")
            }
        }

        When("원천이 상위 코드를 함께 주면") {
            val captured = slot<List<AttractionCategoryCode>>()
            every { repository.upsertAll(capture(captured)) } answers { captured.captured.size }

            service.upsert(
                listOf(SyncAttractionCategoryCodesUseCase.Item("ko", "NA02", "자연경관", parentCode = "NA")),
            )

            Then("유도하지 않고 받은 값을 쓴다") {
                captured.captured.single().parentCode shouldBe "NA"
            }
        }

        When("코드 길이가 2·4·8 이 아니면") {
            Then("만들지 않는다 — 깊이를 정할 수 없다") {
                shouldThrow<IllegalArgumentException> {
                    service.upsert(listOf(SyncAttractionCategoryCodesUseCase.Item("ko", "NA0", "이상한코드")))
                }
            }
        }
    }
})
