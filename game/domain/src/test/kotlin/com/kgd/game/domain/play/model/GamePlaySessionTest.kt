package com.kgd.game.domain.play.model

import com.kgd.game.domain.play.exception.SessionAlreadyEndedException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.time.Instant

class GamePlaySessionTest : BehaviorSpec({

    val startedAt = Instant.parse("2026-07-06T10:00:00Z")

    fun newSession(memberId: Long? = null) = GamePlaySession.start(
        sessionKey = "sess-1",
        gameId = 1L,
        memberId = memberId,
        deviceType = DeviceType.DESKTOP,
        startedAt = startedAt
    )

    given("플레이 세션 시작 시") {
        `when`("게스트(memberId=null)로 시작하면") {
            then("정상 생성되어야 한다") {
                val session = newSession()
                session.memberId shouldBe null
                session.isEnded() shouldBe false
            }
        }
    }

    given("플레이 세션 종료 시") {
        `when`("90초 후 종료하면") {
            then("durationSec이 90으로 기록되어야 한다") {
                val session = newSession(memberId = 7L)
                session.end(startedAt.plusSeconds(90))

                session.isEnded() shouldBe true
                session.durationSec shouldBe 90
            }
        }

        `when`("이미 종료된 세션을 다시 종료하면") {
            then("SessionAlreadyEndedException이 발생해야 한다") {
                val session = newSession()
                session.end(startedAt.plusSeconds(10))
                shouldThrow<SessionAlreadyEndedException> {
                    session.end(startedAt.plusSeconds(20))
                }
            }
        }

        `when`("시작보다 이른 시각으로 종료하면 (클라이언트 시계 왜곡)") {
            then("duration은 0으로 방어되어야 한다") {
                val session = newSession()
                session.end(startedAt.minusSeconds(30))
                session.durationSec shouldBe 0
            }
        }
    }
})
