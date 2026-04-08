package com.kgd.common.analytics

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class BucketAssignerTest : BehaviorSpec({
    val variants = listOf("control" to 50, "treatment" to 50)

    Given("BucketAssigner") {
        When("같은 userId와 experimentId로 여러 번 호출하면") {
            val results = (1..100).map {
                BucketAssigner.assign("user-123", 1L, variants)
            }.toSet()

            Then("항상 같은 결과를 반환한다 (결정적)") {
                results.size shouldBe 1
            }
        }

        When("다른 userId로 호출하면") {
            val result1 = BucketAssigner.assign("user-1", 1L, variants)
            val result2 = BucketAssigner.assign("user-2", 1L, variants)

            Then("다른 결과가 나올 수 있다") {
                result1 shouldNotBe null
                result2 shouldNotBe null
            }
        }

        When("다른 experimentId로 호출하면") {
            val result1 = BucketAssigner.assign("user-123", 1L, variants)
            val result2 = BucketAssigner.assign("user-123", 2L, variants)

            Then("다른 결과가 나올 수 있다") {
                result1 shouldNotBe null
                result2 shouldNotBe null
            }
        }

        When("단일 variant만 있으면") {
            val singleVariant = listOf("only" to 100)
            val result = BucketAssigner.assign("any-user", 1L, singleVariant)

            Then("해당 variant가 항상 반환된다") {
                result shouldBe "only"
            }
        }

        When("1000명의 사용자로 분포를 확인하면") {
            val distribution = (1..1000).map {
                BucketAssigner.assign("user-$it", 1L, variants)
            }.groupingBy { it }.eachCount()

            Then("대략 50:50에 가까운 분포를 보인다") {
                val controlCount = distribution["control"] ?: 0
                // 허용 오차 15% (통계적 불확실성 감안)
                (controlCount in 350..650) shouldBe true
            }
        }
    }
})
