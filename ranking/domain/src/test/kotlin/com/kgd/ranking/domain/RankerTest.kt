package com.kgd.ranking.domain

import com.kgd.ranking.domain.model.Movement
import com.kgd.ranking.domain.model.Ranker
import com.kgd.ranking.domain.model.ScoredSubject
import com.kgd.ranking.domain.model.SortDirection
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.shouldBe
import java.math.BigDecimal

class RankerTest : BehaviorSpec({

    fun subject(key: String, score: String, name: String = key) =
        ScoredSubject(subjectKey = key, subjectName = name, score = BigDecimal(score))

    Given("최저가 보드(ASC)에 서로 다른 가격의 주유소가 있을 때") {
        val subjects = listOf(subject("gas:c", "1710"), subject("gas:a", "1650"), subject("gas:b", "1688"))

        When("순위를 매기면") {
            val entries = Ranker.rank(subjects, SortDirection.ASC)

            Then("싼 순서로 1등부터 붙는다") {
                entries.map { it.subjectKey } shouldContainExactly listOf("gas:a", "gas:b", "gas:c")
                entries.map { it.rank } shouldContainExactly listOf(1, 2, 3)
            }
        }
    }

    Given("점수가 같은 대상이 섞여 있을 때") {
        val subjects = listOf(
            subject("gas:a", "1650"),
            subject("gas:b", "1650"),
            subject("gas:c", "1700"),
        )

        When("순위를 매기면") {
            val entries = Ranker.rank(subjects, SortDirection.ASC)

            Then("동점은 같은 순위를 받고 다음 순위는 건너뛴다 (1,1,3)") {
                entries.map { it.rank } shouldContainExactly listOf(1, 1, 3)
            }
        }
    }

    Given("동점의 scale 이 다르게 들어왔을 때 (1650 vs 1650.00)") {
        val subjects = listOf(subject("gas:a", "1650"), subject("gas:b", "1650.00"))

        When("순위를 매기면") {
            val entries = Ranker.rank(subjects, SortDirection.ASC)

            Then("같은 값으로 보고 동점 처리한다 — BigDecimal 의 == 이 아니라 compareTo 다") {
                entries.map { it.rank } shouldContainExactly listOf(1, 1)
            }
        }
    }

    Given("동점자가 있는 목록을 순서만 바꿔 두 번 넣을 때") {
        val first = Ranker.rank(
            listOf(subject("gas:b", "1650"), subject("gas:a", "1650"), subject("gas:c", "1650")),
            SortDirection.ASC,
        )
        val second = Ranker.rank(
            listOf(subject("gas:c", "1650"), subject("gas:b", "1650"), subject("gas:a", "1650")),
            SortDirection.ASC,
        )

        When("두 결과를 비교하면") {
            Then("줄 순서가 같다 — 정렬이 불안정하면 목록이 매일 뒤바뀐다") {
                first.map { it.subjectKey } shouldContainExactly second.map { it.subjectKey }
            }
        }
    }

    Given("직전 스냅샷이 있을 때") {
        val previous = mapOf("gas:a" to 3, "gas:b" to 1, "gas:d" to 2)
        val subjects = listOf(subject("gas:a", "1650"), subject("gas:b", "1688"), subject("gas:c", "1700"))

        When("순위를 매기면") {
            val entries = Ranker.rank(subjects, SortDirection.ASC, previous).associateBy { it.subjectKey }

            Then("올라간 대상은 Up, 내려간 대상은 Down 이다") {
                entries.getValue("gas:a").movement shouldBe Movement.Up(2)
                entries.getValue("gas:b").movement shouldBe Movement.Down(1)
            }

            Then("직전에 없던 대상은 New 다 — 0칸 이동(Same)이 아니다") {
                entries.getValue("gas:c").prevRank shouldBe null
                entries.getValue("gas:c").movement shouldBe Movement.New
            }

            Then("이번에 없는 대상은 결과에 남지 않는다 — 유령 순위 금지") {
                entries.containsKey("gas:d") shouldBe false
            }
        }
    }

    Given("직전 스냅샷이 없는 첫 실행일 때") {
        val subjects = listOf(subject("gas:a", "1650"), subject("gas:b", "1700"))

        When("순위를 매기면") {
            val entries = Ranker.rank(subjects, SortDirection.ASC)

            Then("전부 New 이고 순위는 정상으로 매겨진다") {
                entries.all { it.movement == Movement.New } shouldBe true
                entries.map { it.rank } shouldContainExactly listOf(1, 2)
            }
        }
    }

    Given("높은 값이 1등인 보드(DESC)일 때") {
        val subjects = listOf(subject("p:a", "10"), subject("p:b", "30"), subject("p:c", "20"))

        When("순위를 매기면") {
            val entries = Ranker.rank(subjects, SortDirection.DESC)

            Then("큰 값부터 1등이다") {
                entries.map { it.subjectKey } shouldContainExactly listOf("p:b", "p:c", "p:a")
            }
        }
    }

    Given("대상이 하나도 없을 때") {
        When("순위를 매기면") {
            val entries = Ranker.rank(emptyList(), SortDirection.ASC)

            Then("빈 목록이 정상 결과다 — 예외가 아니다") {
                entries.isEmpty() shouldBe true
            }
        }
    }
})
