package com.kgd.place.domain.attraction.model

import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

class SimilarAttractionsTest : BehaviorSpec({

    val ref = EmbeddingModelRef("microsoft/harrier-oss-v1-270m", "31de22b", 640)
    fun item(id: Long, score: Double = 0.8) = SimilarAttractions.Item(id, score)

    Given("유사 목록 생성") {
        When("다섯 곳 이하이고 자기·중복이 없으면") {
            Then("보낸 순서가 곧 순위다") {
                val list = SimilarAttractions.create(1L, ref, listOf(item(3, 0.9), item(2, 0.7)))
                list.items.map { it.similarId } shouldBe listOf(3L, 2L)
            }
        }
        When("빈 목록이면") {
            Then("만들어진다 — 그 문서의 옛 목록을 지운다는 뜻이다") {
                SimilarAttractions.create(1L, ref, emptyList()).items shouldBe emptyList()
            }
        }
        When("자기 자신이 들어 있으면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { SimilarAttractions.create(1L, ref, listOf(item(1))) }
                    .message shouldContain "자기 자신"
            }
        }
        When("같은 곳이 두 번 있거나 여섯 곳 이상이면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { SimilarAttractions.create(1L, ref, listOf(item(2), item(2))) }
                shouldThrow<IllegalArgumentException> {
                    SimilarAttractions.create(1L, ref, (2L..7L).map { item(it) })
                }
            }
        }
        When("점수가 코사인 범위를 벗어나거나 NaN 이면") {
            Then("거부한다") {
                shouldThrow<IllegalArgumentException> { SimilarAttractions.create(1L, ref, listOf(item(2, 1.5))) }
                shouldThrow<IllegalArgumentException> { SimilarAttractions.create(1L, ref, listOf(item(2, Double.NaN))) }
            }
        }
    }
})
