package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionSimilarRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionSimilarUseCase
import com.kgd.place.domain.attraction.model.EmbeddingModelRef
import com.kgd.place.domain.attraction.model.SimilarAttractions
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify

class AttractionSimilarServiceTest : BehaviorSpec({

    val repository = mockk<AttractionSimilarRepositoryPort>()
    val service = AttractionSimilarService(repository)
    val ref = EmbeddingModelRef("microsoft/harrier-oss-v1-270m", "31de22b", 640)

    fun doc(id: Long, vararg similar: Long) =
        SyncAttractionSimilarUseCase.Document(id, similar.mapIndexed { i, s -> SyncAttractionSimilarUseCase.Similar(s, 0.9 - i * 0.1) })

    beforeTest {
        clearMocks(repository)
        every { repository.existingAttractionIds(any()) } answers { firstArg<Collection<Long>>().toSet() }
        every { repository.replace(any(), any()) } answers { firstArg<List<SimilarAttractions>>().sumOf { it.items.size } }
    }

    Given("유사 목록 교체") {
        When("문서마다 목록을 보내면") {
            Then("그 스탬프의 목록을 순서대로 통째로 바꾸고, 빈 목록도 교체 대상에 넣는다") {
                val saved = slot<List<SimilarAttractions>>()
                every { repository.replace(capture(saved), any()) } returns 2

                service.replace(ref.value, listOf(doc(1, 3, 2), doc(4))) shouldBe
                    SyncAttractionSimilarUseCase.Applied(documents = 2, rows = 2)

                saved.captured.map { it.attractionId } shouldBe listOf(1L, 4L)
                saved.captured.first().items.map { it.similarId } shouldBe listOf(3L, 2L)
                saved.captured.all { it.modelRef == ref } shouldBe true
            }
        }
        When("목록에 없는 관광지 id 가 있으면") {
            Then("요청 전체를 거부하고 아무것도 바꾸지 않는다") {
                every { repository.existingAttractionIds(any()) } returns setOf(1L, 3L)

                shouldThrow<IllegalArgumentException> { service.replace(ref.value, listOf(doc(1, 3, 99))) }
                    .message shouldContain "99"
                verify(exactly = 0) { repository.replace(any(), any()) }
            }
        }
        When("같은 문서가 요청 안에 두 번 있거나 스탬프 형식이 틀리면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { service.replace(ref.value, listOf(doc(1, 2), doc(1, 3))) }
                shouldThrow<IllegalArgumentException> { service.replace("harrier", listOf(doc(1, 2))) }
                verify(exactly = 0) { repository.replace(any(), any()) }
            }
        }
    }

    Given("유사 목록 조회") {
        When("id 묶음을 주면") {
            Then("저장된 순위 그대로 스탬프와 함께 돌려준다") {
                every { repository.findByModelAndIds(ref.value, listOf(1L, 2L)) } returns listOf(
                    SimilarAttractions.create(1L, ref, listOf(SimilarAttractions.Item(3L, 0.9), SimilarAttractions.Item(5L, 0.8))),
                )

                val found = service.lookup(ref.value, listOf(1L, 2L)).single()
                found.attractionId shouldBe 1L
                found.modelRef shouldBe ref.value
                found.similar.map { it.id } shouldBe listOf(3L, 5L)
            }
        }
    }
})
