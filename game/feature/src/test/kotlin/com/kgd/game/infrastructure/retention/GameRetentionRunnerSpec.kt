package com.kgd.game.infrastructure.retention

import com.kgd.game.application.roster.usecase.PurgeRostersUseCase
import io.kotest.core.spec.style.BehaviorSpec
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.springframework.boot.DefaultApplicationArguments

/**
 * 친구 그룹 원장 스윕이 **실제로 불리는지**를 고정한다 (ADR-0077 / ADR-0092).
 *
 * 상수만 두고 호출자가 없어 무기한 누적한 선례가 있다(`blog_post_view`). 그래서
 * 「상수가 365다」가 아니라 「그 값으로 스윕이 불렸다」를 잰다.
 *
 * code-dictionary 의 `RetentionRunnerSpec` 에서 갈라져 나왔다 — ADR-0093 으로 game 이
 * content 파드로 옮겨가면서 이 원장도 도메인 모듈이 정리한다.
 */
class GameRetentionRunnerSpec : BehaviorSpec({

    Given("친구 그룹 원장이 정상일 때") {
        val purgeRosters = mockk<PurgeRostersUseCase>()
        every { purgeRosters.unusedFor(any()) } returns 2

        When("배치를 실행하면") {
            GameRetentionRunner(purgeRosters).run(DefaultApplicationArguments())

            Then("보존기간 상수 그대로 스윕이 불린다") {
                verify(exactly = 1) {
                    purgeRosters.unusedFor(GameRetentionRunner.FRIEND_GROUP_RETENTION_DAYS)
                }
            }
        }
    }

    Given("스윕이 실패할 때") {
        val purgeRosters = mockk<PurgeRostersUseCase>()
        every { purgeRosters.unusedFor(any()) } throws IllegalStateException("락 대기 초과")

        When("배치를 실행하면") {
            Then("예외를 삼켜 CronJob 이 비정상 종료하지 않는다") {
                GameRetentionRunner(purgeRosters).run(DefaultApplicationArguments())
                verify(exactly = 1) { purgeRosters.unusedFor(any()) }
            }
        }
    }
})
