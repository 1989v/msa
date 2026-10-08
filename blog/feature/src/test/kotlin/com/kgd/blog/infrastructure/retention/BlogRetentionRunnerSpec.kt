package com.kgd.blog.infrastructure.retention

import com.kgd.blog.application.interaction.usecase.PurgeBlogViewsUseCase
import com.kgd.blog.application.shortlink.usecase.PurgeBlogShortLinkClicksUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.boot.DefaultApplicationArguments

/**
 * blog 원장 스윕이 **실제로 불리는지**와 **실패 격리**를 고정한다 (ADR-0077).
 *
 * 원장 하나가 터졌을 때 나머지가 함께 멈추면 다음 주까지 같이 쌓여 보존기간이 조용히 두 배가 된다.
 * 목을 Given 마다 새로 만든다 — spec 레벨에 두면 호출 수가 블록을 넘어 누적된다.
 */
class BlogRetentionRunnerSpec : BehaviorSpec({

    Given("원장이 모두 정상일 때") {
        val purgeViews = mockk<PurgeBlogViewsUseCase>()
        val purgeShortLinkClicks = mockk<PurgeBlogShortLinkClicksUseCase>()
        every { purgeViews.execute() } returns 4
        every { purgeShortLinkClicks.olderThan(any()) } returns 1

        When("배치를 실행하면") {
            BlogRetentionRunner(purgeViews, purgeShortLinkClicks).run(DefaultApplicationArguments())

            Then("조회 원장이 정리된다") {
                verify(exactly = 1) { purgeViews.execute() }
            }

            Then("단축 주소 클릭 원장은 90일로 정리된다") {
                verify(exactly = 1) { purgeShortLinkClicks.olderThan(90L) }
            }
        }
    }

    Given("조회 원장 정리가 실패할 때") {
        val purgeViews = mockk<PurgeBlogViewsUseCase>()
        val purgeShortLinkClicks = mockk<PurgeBlogShortLinkClicksUseCase>()
        every { purgeViews.execute() } throws IllegalStateException("락 대기 초과")
        every { purgeShortLinkClicks.olderThan(any()) } returns 0

        When("배치를 실행하면") {
            Then("예외를 삼켜 CronJob 이 비정상 종료하지 않고 다음 원장도 정리한다") {
                BlogRetentionRunner(purgeViews, purgeShortLinkClicks).run(DefaultApplicationArguments())
                verify(exactly = 1) { purgeViews.execute() }
                verify(exactly = 1) { purgeShortLinkClicks.olderThan(any()) }
            }
        }
    }
})
