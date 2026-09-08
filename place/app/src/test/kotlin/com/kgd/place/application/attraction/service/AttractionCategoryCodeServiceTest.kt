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
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA", 1, "자연관광"),
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA02", 2, "자연경관(하천‧해양)", "NA"),
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA020100", 3, "해수욕장", "NA02"),
                ),
            )

            Then("받은 깊이를 그대로 쓴다") {
                captured.captured.map { it.depth } shouldBe listOf(1, 2, 3)
            }

            Then("상위 코드는 depth 1 에서만 비어 있다") {
                captured.captured.map { it.parentCode } shouldBe listOf(null, "NA", "NA02")
            }
        }

        When("코드 길이가 규칙을 벗어나도 (C01 추천코스 계열)") {
            val captured = slot<List<AttractionCategoryCode>>()
            every { repository.upsertAll(capture(captured)) } answers { captured.captured.size }

            service.upsert(
                listOf(
                    SyncAttractionCategoryCodesUseCase.Item("ko", "C01", 1, "추천코스"),
                    SyncAttractionCategoryCodesUseCase.Item("ko", "C01120001", 3, "가족코스", "C0112"),
                ),
            )

            Then("길이로 판정하지 않으므로 그대로 들어간다") {
                captured.captured.map { it.code to it.depth } shouldBe listOf("C01" to 1, "C01120001" to 3)
            }
        }

        When("같은 (lang, code) 가 두 번 오면") {
            val captured = slot<List<AttractionCategoryCode>>()
            every { repository.upsertAll(capture(captured)) } answers { captured.captured.size }

            service.upsert(
                listOf(
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA", 1, "옛이름"),
                    SyncAttractionCategoryCodesUseCase.Item("ko", "NA", 1, "자연관광"),
                ),
            )

            Then("하나로 접히고 마지막이 이긴다 — 유일 제약에 걸려 배치가 죽지 않게") {
                captured.captured.size shouldBe 1
                captured.captured.single().name shouldBe "자연관광"
            }
        }

        When("depth 가 1~3 밖이면") {
            Then("만들지 않는다") {
                shouldThrow<IllegalArgumentException> {
                    service.upsert(listOf(SyncAttractionCategoryCodesUseCase.Item("ko", "NA", 4, "이상")))
                }
            }
        }

        When("depth 2 인데 상위 코드가 없으면") {
            Then("만들지 않는다 — 트리를 이을 수 없다") {
                shouldThrow<IllegalArgumentException> {
                    service.upsert(listOf(SyncAttractionCategoryCodesUseCase.Item("ko", "NA02", 2, "자연경관")))
                }
            }
        }
    }
})
