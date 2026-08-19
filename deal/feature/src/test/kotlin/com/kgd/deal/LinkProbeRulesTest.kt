package com.kgd.deal

import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.infrastructure.linkcheck.LinkProbeRules
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

class LinkProbeRulesTest : BehaviorSpec({

    given("응답 코드를 링크 상태로 옮길 때") {

        `when`("2xx·3xx 면") {
            then("살아 있다") {
                LinkProbeRules.classify(200).status shouldBe LinkStatus.OK
                LinkProbeRules.classify(204).status shouldBe LinkStatus.OK
                LinkProbeRules.classify(301).status shouldBe LinkStatus.OK
            }
        }

        `when`("404·410 이면") {
            then("죽었다고 본다 — 확실한 사망 신호는 이 둘뿐이다") {
                LinkProbeRules.classify(404).status shouldBe LinkStatus.BROKEN
                LinkProbeRules.classify(410).status shouldBe LinkStatus.BROKEN
            }
        }

        `when`("403·405·429 면") {
            then("판단 보류다 — 봇 차단 오탐이 압도적이라 BROKEN 으로 찍으면 경고가 노이즈가 된다") {
                LinkProbeRules.classify(403).status shouldBe LinkStatus.UNKNOWN
                LinkProbeRules.classify(405).status shouldBe LinkStatus.UNKNOWN
                LinkProbeRules.classify(429).status shouldBe LinkStatus.UNKNOWN
            }
        }

        `when`("5xx 면") {
            then("판단 보류다 — 상대 서버의 일시 장애일 수 있다") {
                LinkProbeRules.classify(500).status shouldBe LinkStatus.UNKNOWN
                LinkProbeRules.classify(503).status shouldBe LinkStatus.UNKNOWN
            }
        }

        `when`("아예 닿지 못하면") {
            then("판단 보류다 — 우리 쪽 네트워크 문제일 수도 있다") {
                LinkProbeRules.unreachable().status shouldBe LinkStatus.UNKNOWN
                LinkProbeRules.unreachable().statusCode shouldBe null
            }
        }

        `when`("HEAD 를 받지 않는 서버면") {
            then("GET 으로 한 번 더 물어본다") {
                LinkProbeRules.shouldRetryWithGet(405) shouldBe true
                LinkProbeRules.shouldRetryWithGet(501) shouldBe true
                LinkProbeRules.shouldRetryWithGet(403) shouldBe false
                LinkProbeRules.shouldRetryWithGet(404) shouldBe false
            }
        }
    }
})
