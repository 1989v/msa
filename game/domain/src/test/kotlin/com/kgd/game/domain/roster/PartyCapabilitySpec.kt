package com.kgd.game.domain.roster

import com.kgd.game.domain.roster.model.PartyCapability
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/** ADR-0092 SR-8 — 분류 신호 셋. 하나로 뭉치면 목록을 만들 수 없다. */
class PartyCapabilitySpec : BehaviorSpec({

    val decider = listOf("roster-ready")
    val cardFlip = listOf("roster-ready", "relay-ready", "input-decides")
    val interactive = listOf("roster-ready", "relay-ready", PartyCapability.INTERACTIVE_TAG)
    val plainGame = listOf("action", "arcade")

    Given("[게임 픽] 목록") {
        Then("명부를 읽는 게임만 나온다") {
            PartyCapability.pickable(decider) shouldBe true
            PartyCapability.pickable(cardFlip) shouldBe true
            PartyCapability.pickable(interactive) shouldBe true
            PartyCapability.pickable(plainGame) shouldBe false
        }
    }

    Given("[랜덤] 의 대상") {
        Then("비참여형만이다 — 지켜보려던 사람이 갑자기 조작을 요구받으면 안 된다") {
            PartyCapability.randomPool(decider) shouldBe true
            PartyCapability.randomPool(cardFlip) shouldBe true
            PartyCapability.randomPool(interactive) shouldBe false
        }
    }

    Given("참여형 목록") {
        Then("참여형만이다") {
            PartyCapability.interactive(interactive) shouldBe true
            PartyCapability.interactive(decider) shouldBe false
            PartyCapability.interactive(cardFlip) shouldBe false
        }
        Then("[랜덤] 과 겹치지 않는다 — 두 갈래가 같은 게임을 내면 고르는 뜻이 없다") {
            listOf(decider, cardFlip, interactive, plainGame).forEach { tags ->
                (PartyCapability.randomPool(tags) && PartyCapability.interactive(tags)) shouldBe false
            }
        }
    }

    Given("입력 중계 대상") {
        Then("「릴레이에 붙는가」로는 못 가른다 — 신호가 셋이어야 하는 이유다") {
            PartyCapability.needsInputRelay(cardFlip) shouldBe true
            // 참여형도 릴레이에 붙지만 입력 중계 대상은 아니다(각자 하고 서버가 채점한다)
            PartyCapability.needsInputRelay(interactive) shouldBe false
            PartyCapability.needsInputRelay(decider) shouldBe false
        }
    }

    Given("태그 이름") {
        Then("`party` 를 쓰지 않는다 — 이미 다른 뜻의 카테고리 태그다") {
            PartyCapability.entries.map { it.tag }.none { it == "party" } shouldBe true
        }
    }
})
