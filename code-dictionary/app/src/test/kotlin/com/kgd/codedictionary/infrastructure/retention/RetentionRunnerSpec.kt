package com.kgd.codedictionary.infrastructure.retention

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
 *
 * ADR-0093: `party_friend_group`(game)·`blog_post_view`(blog)는 content 파드로 갔다 →
 * `GameRetentionRunnerSpec`·`BlogRetentionRunnerSpec`.
 */
class RetentionRunnerSpec : BehaviorSpec({

    Given("이력서 열람 원장이 정상일 때") {
        val resumeAccessLog = mockk<ResumeAccessLogRepositoryPort>()
        every { resumeAccessLog.purgeOlderThan(any()) } returns 3

        When("배치를 실행하면") {
            RetentionRunner(resumeAccessLog).run(DefaultApplicationArguments())

            Then("원장이 자기 보존기간으로 정리된다") {
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


    Given("이력서 원장 정리가 실패할 때") {
        val resumeAccessLog = mockk<ResumeAccessLogRepositoryPort>()
        every { resumeAccessLog.purgeOlderThan(any()) } throws IllegalStateException("락 대기 초과")

        When("배치를 실행하면") {
            Then("예외를 삼켜 CronJob 이 비정상 종료하지 않는다") {
                RetentionRunner(resumeAccessLog).run(DefaultApplicationArguments())
                verify(exactly = 1) { resumeAccessLog.purgeOlderThan(any()) }
            }
        }
    }
})
