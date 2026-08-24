package com.kgd.game.domain.play.model

import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * 보드 키 — 랭킹 보드의 세 번째 축 (V59).
 *
 * 지키려는 것은 하나다: **모드가 다르면 보드도 달라야 하고, 그 경계가 조용히 무너지지 않아야 한다.**
 */
class ScoreBoardKeyTest : BehaviorSpec({

    given("보드 키를 받을 때") {
        `when`("아무것도 안 보내면") {
            then("기본 보드다 — 모드를 나누지 않는 게임 60여 종의 기록이 있던 자리에 그대로 쌓인다") {
                ScoreBoardKey.from(null) shouldBe ScoreBoardKey.DEFAULT
                ScoreBoardKey.from("") shouldBe ScoreBoardKey.DEFAULT
                ScoreBoardKey.from("   ") shouldBe ScoreBoardKey.DEFAULT
                ScoreBoardKey.DEFAULT.isDefault shouldBe true
                ScoreBoardKey.DEFAULT.value shouldBe ""
            }
        }

        `when`("소문자/숫자/하이픈으로 된 키를 보내면") {
            then("그대로 받는다 — 앞뒤 공백만 턴다") {
                ScoreBoardKey.from("leak").value shouldBe "leak"
                ScoreBoardKey.from("tower-climb").value shouldBe "tower-climb"
                ScoreBoardKey.from(" rockfall ").value shouldBe "rockfall"
                ScoreBoardKey.from("mode2").isDefault shouldBe false
            }
        }

        `when`("형식에 맞지 않는 키를 보내면") {
            then("기본 보드로 흘려보내지 않고 거절한다 — 조용히 합치면 남의 보드에 섞인다") {
                listOf(
                    "Leak",              // 대문자
                    "물막기",             // 표시용 낱말 — 키가 아니라 이름이 할 일이다
                    "-leak",             // 하이픈으로 시작
                    "leak mode",         // 공백
                    "leak_mode",         // 밑줄
                    "a".repeat(25),      // 24자 초과 (컬럼 상한)
                ).forEach { raw ->
                    shouldThrow<BusinessException> { ScoreBoardKey.from(raw) }
                }
            }
        }

        `when`("서로 다른 모드 키를 견주면") {
            then("다른 보드다 — 같은 게임이라도 재는 자가 다르면 한 표에 합치지 않는다") {
                (ScoreBoardKey.from("leak") == ScoreBoardKey.from("rockfall")) shouldBe false
                (ScoreBoardKey.from("leak") == ScoreBoardKey.from("leak")) shouldBe true
                (ScoreBoardKey.from("leak") == ScoreBoardKey.DEFAULT) shouldBe false
            }
        }
    }
})
