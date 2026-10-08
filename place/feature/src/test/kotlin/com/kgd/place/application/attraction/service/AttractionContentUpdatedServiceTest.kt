package com.kgd.place.application.attraction.service

import com.kgd.common.exception.BusinessException
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.FindContentUpdatedAttractionsUseCase
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDateTime

class AttractionContentUpdatedServiceTest : BehaviorSpec({
    val port = mockk<AttractionRepositoryPort>()
    val service = AttractionContentUpdatedService(port)

    val since = LocalDateTime.of(2026, 10, 8, 7, 30)
    val until = LocalDateTime.of(2026, 10, 9, 7, 30)
    fun row(id: Long, lang: String = "ko") = AttractionRepositoryPort.ContentUpdated(id, lang)
    fun query(afterId: Long = 0L, size: Int = 3, from: LocalDateTime = since, to: LocalDateTime = until) =
        FindContentUpdatedAttractionsUseCase.Query(from, to, afterId, size)

    beforeEach { clearMocks(port) }

    Given("창 안에서 바뀐 관광지 목록 조회") {
        // beforeEach 가 Then 직전에 목을 비우므로, 호출 여부를 보는 케이스는 Then 안에서 부른다
        When("결과가 요청한 size 만큼 차면") {
            every { port.findContentUpdated(since, until, 10L, 3) } returns listOf(row(11L), row(12L, "en"), row(15L))
            val result = service.find(query(afterId = 10L, size = 3))

            Then("파라미터를 그대로 포트에 넘기고 다음 쪽 기준으로 마지막 id 를 준다") {
                result.items shouldBe listOf(
                    FindContentUpdatedAttractionsUseCase.Item(11L, "ko"),
                    FindContentUpdatedAttractionsUseCase.Item(12L, "en"),
                    FindContentUpdatedAttractionsUseCase.Item(15L, "ko"),
                )
                result.nextAfterId shouldBe 15L
            }
        }

        When("결과가 size 보다 적으면") {
            every { port.findContentUpdated(since, until, 0L, 3) } returns listOf(row(11L))
            val result = service.find(query(size = 3))

            Then("마지막 쪽이라 nextAfterId 는 null 이다") {
                result.items.map { it.id } shouldBe listOf(11L)
                result.nextAfterId shouldBe null
            }
        }

        When("size 가 상한을 넘으면") {
            Then("상한으로 줄여 포트에 넘긴다") {
                every { port.findContentUpdated(since, until, 0L, AttractionContentUpdatedService.MAX_SIZE) } returns emptyList()
                service.find(query(size = 50_000))
                verify(exactly = 1) { port.findContentUpdated(since, until, 0L, AttractionContentUpdatedService.MAX_SIZE) }
            }
        }

        When("since 가 until 보다 늦거나 같으면") {
            Then("포트를 부르지 않고 빈 결과를 준다") {
                every { port.findContentUpdated(any(), any(), any(), any()) } returns listOf(row(1L))
                val result = service.find(query(from = until, to = until))
                result.items shouldBe emptyList()
                result.nextAfterId shouldBe null
                verify(exactly = 0) { port.findContentUpdated(any(), any(), any(), any()) }
            }
        }

        When("size 가 1 보다 작으면") {
            Then("잘못된 입력으로 거절한다") {
                shouldThrow<BusinessException> { service.find(query(size = 0)) }
            }
        }
    }
})
