package com.kgd.codedictionary.infrastructure.retention

import com.kgd.blog.application.interaction.usecase.PurgeBlogViewsUseCase
import com.kgd.codedictionary.application.resume.port.ResumeAccessLogRepositoryPort
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.boot.DefaultApplicationArguments
import java.time.LocalDateTime

/**
 * 정리 배치의 **실패 격리**를 고정한다 (ADR-0077).
 *
 * 원장 하나가 터졌을 때 나머지가 함께 멈추면, 다음 주까지 두 원장이 같이 쌓이고 보존기간이
 * 조용히 두 배가 된다. 방침에 적은 기간과 실제가 어긋나는 경로가 여기라 테스트로 막는다.
 *
 * 목을 Given 마다 새로 만든다 — spec 레벨에 두면 호출 수가 블록을 넘어 누적돼
 * `exactly = 1` 이 두 번째 블록부터 거짓 실패한다.
 */
class RetentionRunnerSpec : BehaviorSpec({

    Given("두 원장이 모두 정상일 때") {
        val purgeBlogViews = mockk<PurgeBlogViewsUseCase>()
        val resumeAccessLog = mockk<ResumeAccessLogRepositoryPort>()
        every { purgeBlogViews.execute() } returns 12
        every { resumeAccessLog.purgeOlderThan(any()) } returns 3

        When("배치를 실행하면") {
            RetentionRunner(purgeBlogViews, resumeAccessLog).run(DefaultApplicationArguments())

            Then("각 원장이 자기 보존기간으로 정리된다") {
                verify(exactly = 1) { purgeBlogViews.execute() }
                verify(exactly = 1) {
                    resumeAccessLog.purgeOlderThan(
                        match<LocalDateTime> {
                            // 365일 전후 — 테스트 실행 시각과 러너 호출 시각의 차이만 허용한다
                            it.isBefore(LocalDateTime.now().minusDays(364)) &&
                                it.isAfter(LocalDateTime.now().minusDays(366))
                        },
                    )
                }
            }
        }
    }

    Given("블로그 원장 정리가 실패할 때") {
        val purgeBlogViews = mockk<PurgeBlogViewsUseCase>()
        val resumeAccessLog = mockk<ResumeAccessLogRepositoryPort>()
        every { purgeBlogViews.execute() } throws IllegalStateException("DB 연결 끊김")
        every { resumeAccessLog.purgeOlderThan(any()) } returns 5

        When("배치를 실행하면") {
            Then("예외를 삼키고 나머지 원장은 그대로 정리한다") {
                RetentionRunner(purgeBlogViews, resumeAccessLog).run(DefaultApplicationArguments())
                verify(exactly = 1) { resumeAccessLog.purgeOlderThan(any()) }
            }
        }
    }

    Given("이력서 원장 정리가 실패할 때") {
        val purgeBlogViews = mockk<PurgeBlogViewsUseCase>()
        val resumeAccessLog = mockk<ResumeAccessLogRepositoryPort>()
        every { purgeBlogViews.execute() } returns 7
        every { resumeAccessLog.purgeOlderThan(any()) } throws IllegalStateException("락 대기 초과")

        When("배치를 실행하면") {
            Then("먼저 도는 원장의 결과는 유지된다") {
                RetentionRunner(purgeBlogViews, resumeAccessLog).run(DefaultApplicationArguments())
                verify(exactly = 1) { purgeBlogViews.execute() }
            }
        }
    }
})
