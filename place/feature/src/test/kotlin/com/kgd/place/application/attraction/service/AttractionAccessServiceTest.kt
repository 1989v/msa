package com.kgd.place.application.attraction.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.attraction.port.AttractionAccessRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionAccessUseCase
import com.kgd.place.domain.attraction.model.AttractionAccess
import com.kgd.place.domain.attraction.model.TransitKind
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.time.LocalDateTime

class AttractionAccessServiceTest : BehaviorSpec({
    val repository = mockk<AttractionAccessRepositoryPort>()
    val service = AttractionAccessService(repository)
    val at = LocalDateTime.of(2026, 10, 12, 0, 0)

    fun stop(id: Long, kind: TransitKind, rank: Int) = AttractionAccess(id, kind, rank, "k$rank", "이름$rank", null, null, 100, null)

    beforeTest { clearMocks(repository) }

    Given("가는 법 묶음을 바꿀 때") {
        Then("보낸 관광지 전부(빈 목록 포함)의 행을 지우고 줄만 넣는다") {
            every { repository.replace(any(), any(), any()) } returns 3
            val applied = service.replace(
                at,
                listOf(
                    SyncAttractionAccessUseCase.Item(1L, listOf(stop(1L, TransitKind.RAIL, 1), stop(1L, TransitKind.BUS, 1))),
                    SyncAttractionAccessUseCase.Item(2L, emptyList()),
                ),
            )
            applied shouldBe SyncAttractionAccessUseCase.Applied(2, 2, 3)
            verify { repository.replace(listOf(1L, 2L), match { it.size == 2 }, at) }
        }
        Then("같은 종류·순위가 두 번이거나 같은 관광지가 두 번이면 400 이고 저장하지 않는다") {
            shouldThrow<BusinessException> {
                service.replace(at, listOf(SyncAttractionAccessUseCase.Item(1L, listOf(stop(1L, TransitKind.BUS, 1), stop(1L, TransitKind.BUS, 1)))))
            }.errorCode shouldBe ErrorCode.INVALID_INPUT
            shouldThrow<BusinessException> {
                service.replace(at, listOf(SyncAttractionAccessUseCase.Item(1L, emptyList()), SyncAttractionAccessUseCase.Item(1L, emptyList())))
            }.errorCode shouldBe ErrorCode.INVALID_INPUT
            shouldThrow<BusinessException> {
                service.replace(at, listOf(SyncAttractionAccessUseCase.Item(1L, listOf(stop(9L, TransitKind.BUS, 1)))))
            }.errorCode shouldBe ErrorCode.INVALID_INPUT
            verify(exactly = 0) { repository.replace(any(), any(), any()) }
        }
    }
})
