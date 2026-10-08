package com.kgd.place.infrastructure.retention

import com.kgd.place.application.shortlink.usecase.PurgeAttractionShortLinkClicksUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.boot.DefaultApplicationArguments

/**
 * place 원장 스윕이 **실제로 불리는지**를 고정한다 (ADR-0077).
 *
 * 상수만 두고 호출자가 없어 무기한 누적한 선례가 있다(`blog_post_view`). 그래서
 * 「상수가 90이다」가 아니라 「그 값으로 스윕이 불렸다」를 잰다. 누적 수가 남는지는
 * 실제 MySQL 에서 `ContentContextLoadSpec` 이 본다.
 */
class PlaceRetentionRunnerSpec : BehaviorSpec({

    Given("원장이 정상일 때") {
        val purge = mockk<PurgeAttractionShortLinkClicksUseCase>()
        every { purge.olderThan(any()) } returns 3

        When("배치를 실행하면") {
            PlaceRetentionRunner(purge).run(DefaultApplicationArguments())

            Then("단축 주소 클릭 원장은 90일로 스윕이 불린다") {
                verify(exactly = 1) { purge.olderThan(90L) }
            }
        }
    }

    Given("스윕이 실패할 때") {
        val purge = mockk<PurgeAttractionShortLinkClicksUseCase>()
        every { purge.olderThan(any()) } throws IllegalStateException("락 대기 초과")

        When("배치를 실행하면") {
            Then("예외를 삼켜 같은 배치의 다른 도메인 러너를 막지 않는다") {
                PlaceRetentionRunner(purge).run(DefaultApplicationArguments())
                verify(exactly = 1) { purge.olderThan(any()) }
            }
        }
    }
})
