package com.kgd.search.infrastructure.elasticsearch

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe

/**
 * ADR-0050 Phase 1/2 — 신규 weight 류는 default 0 이어야 회귀 보호 + 점진 활성화 보장.
 */
class RankingPropertiesTest : BehaviorSpec({

    given("RankingProperties default") {
        val props = RankingProperties()

        `when`("새 weight 류 기본값 확인") {
            then("cvrWeight / gmv7dWeight / gmv30dWeight 는 모두 0 이어야 한다") {
                props.cvrWeight shouldBe 0.0
                props.gmv7dWeight shouldBe 0.0
                props.gmv30dWeight shouldBe 0.0
            }
            then("freshness.weight 는 0 (gauss decay 비활성) 이어야 한다") {
                props.freshness.weight shouldBe 0.0
            }
            then("기존 popularityWeight / ctrWeight 은 변경되지 않아야 한다") {
                props.popularityWeight shouldBe 10.0
                props.ctrWeight shouldBe 5.0
            }
        }
    }

    given("FreshnessConfig default") {
        val freshness = FreshnessConfig()

        `when`("gauss decay 파라미터 기본값") {
            then("origin=now, scale=14d, offset=0d, decay=0.5") {
                freshness.origin shouldBe "now"
                freshness.scale shouldBe "14d"
                freshness.offset shouldBe "0d"
                freshness.decay shouldBe 0.5
            }
        }
    }
})
