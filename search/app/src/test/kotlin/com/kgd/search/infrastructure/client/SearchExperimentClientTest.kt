package com.kgd.search.infrastructure.client

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull

/** 실험 참여 판정은 어댑터가 접는다 — HTTP 를 부르기 전에 끝나는 경우만 여기서 고정한다 */
class SearchExperimentClientTest : BehaviorSpec({

    given("실험이 꺼져 있으면") {
        val client = SearchExperimentClient(SearchExperimentProperties(enabled = false, id = 1L))

        then("로그인 사용자여도 variant 는 null 이다 — experiment 서비스를 부르지 않는다") {
            client.resolveVariant("user-1").shouldBeNull()
        }
    }

    given("실험이 켜져 있어도 비로그인이면") {
        val client = SearchExperimentClient(SearchExperimentProperties(enabled = true, id = 1L))

        then("variant 는 null 이다") {
            client.resolveVariant(null).shouldBeNull()
            client.resolveVariant("  ").shouldBeNull()
        }
    }
})
