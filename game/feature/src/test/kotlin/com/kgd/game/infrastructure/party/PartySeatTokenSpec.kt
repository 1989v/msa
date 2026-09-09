package com.kgd.game.infrastructure.party

import com.kgd.game.application.party.port.SeatClaim
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

/**
 * ADR-0092 — 좌석 토큰. **실제 서명 컴포넌트를 배선한 채로 돈다.**
 *
 * 이 레포의 유일한 토큰 테스트 선례는 서명 의미를 테스트가 다시 구현한다(`FakeTokens`).
 * 그대로 따르면 `verify` 를 `return true` 로 바꿔도 초록불이 나서, 검사가 대상이 아니라
 * 자기 자신을 재게 된다.
 */
private const val KEY = "party-seat-token-key-for-tests-32b"

private fun claim(
    room: String = "ABC123",
    created: Long = 1_000L,
    round: Int = 1,
    seat: Int = 0,
    epoch: Int = 0,
) = SeatClaim(room, created, round, seat, epoch)

class PartySeatTokenSpec : BehaviorSpec({

    val signer = HmacPartySeatTokenService(KEY)

    Given("정상 발급된 좌석 토큰") {
        val token = signer.issue(claim())

        Then("같은 좌석 주장으로 검증된다") {
            signer.verify(token, claim()) shouldBe true
        }
    }

    Given("위조 시도") {
        val token = signer.issue(claim())

        Then("키가 다른 서명은 거부된다") {
            val other = HmacPartySeatTokenService("a-different-key-also-32-bytes-ok")
            signer.verify(other.issue(claim()), claim()) shouldBe false
        }
        Then("좌석 번호만 바꾼 주장은 거부된다") {
            signer.verify(token, claim(seat = 3)) shouldBe false
        }
        Then("토큰이 없으면 거부된다") {
            signer.verify("", claim()) shouldBe false
            signer.verify("not-a-token", claim()) shouldBe false
        }
        Then("다른 방의 주장은 거부된다") {
            signer.verify(token, claim(room = "ZZZ999")) shouldBe false
        }
    }

    Given("판이 넘어간 뒤") {
        val token = signer.issue(claim(round = 1))

        Then("다음 판에 재사용할 수 없다") {
            signer.verify(token, claim(round = 2)) shouldBe false
        }
    }

    Given("좌석을 물려받은 사람") {
        val previous = signer.issue(claim(seat = 2, epoch = 0))

        Then("전임자의 토큰이 새 점유자 자리에서 안 먹는다") {
            signer.verify(previous, claim(seat = 2, epoch = 1)) shouldBe false
        }
    }

    Given("같은 코드로 다시 열린 방") {
        val old = signer.issue(claim(created = 1_000L))

        Then("옛 토큰이 거부된다") {
            signer.verify(old, claim(created = 9_000L)) shouldBe false
        }
    }

    Given("서명 키") {
        Then("없으면 기동이 실패한다") {
            val e = shouldThrow<IllegalStateException> { HmacPartySeatTokenService("") }
            e.message shouldContain "GAME_HMAC_SECRET"
        }
        Then("32바이트 미만이면 기동이 실패한다") {
            shouldThrow<IllegalStateException> { HmacPartySeatTokenService("short") }
        }
    }
})
