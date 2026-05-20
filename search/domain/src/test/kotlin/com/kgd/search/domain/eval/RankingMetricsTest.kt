package com.kgd.search.domain.eval

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe
import kotlin.math.abs

class RankingMetricsTest : BehaviorSpec({

    given("NDCG@k") {
        `when`("perfect ranking (가장 관련 깊은 결과가 1위)") {
            val judgments = mapOf("a" to 3, "b" to 2, "c" to 1, "d" to 0)
            then("NDCG@4 = 1.0") {
                RankingMetrics.ndcgAtK(listOf("a", "b", "c", "d"), judgments, 4) shouldBe 1.0
            }
        }

        `when`("worst ranking (perfect 의 역순)") {
            val judgments = mapOf("a" to 3, "b" to 2, "c" to 1, "d" to 0)
            then("NDCG@4 가 1.0 보다 작다 (monotonicity)") {
                val ndcg = RankingMetrics.ndcgAtK(listOf("d", "c", "b", "a"), judgments, 4)
                (ndcg shouldBeLessThan 1.0)
            }
        }

        `when`("judgment 가 모두 0") {
            then("NDCG = 0.0") {
                RankingMetrics.ndcgAtK(listOf("a", "b"), mapOf("a" to 0, "b" to 0), 2) shouldBe 0.0
            }
        }

        `when`("judgment 가 empty") {
            then("NDCG = 0.0") {
                RankingMetrics.ndcgAtK(listOf("a", "b"), emptyMap(), 2) shouldBe 0.0
            }
        }

        `when`("relevance 가 상위로 이동하면 NDCG 증가 (monotonicity)") {
            val judgments = mapOf("a" to 0, "b" to 0, "c" to 0, "rel" to 3)
            val rel3rd = RankingMetrics.ndcgAtK(listOf("a", "b", "rel", "c"), judgments, 4)
            val rel1st = RankingMetrics.ndcgAtK(listOf("rel", "a", "b", "c"), judgments, 4)
            then("relevant 가 1 위 일 때 NDCG 가 더 크다") {
                (rel1st > rel3rd).shouldBe(true)
            }
        }
    }

    given("MRR") {
        `when`("첫 결과가 relevant") {
            then("MRR = 1.0") {
                RankingMetrics.mrr(listOf("a", "b", "c"), mapOf("a" to 1)) shouldBe 1.0
            }
        }

        `when`("3 위 가 첫 relevant") {
            then("MRR = 1/3") {
                val mrr = RankingMetrics.mrr(listOf("x", "y", "a"), mapOf("a" to 1))
                (abs(mrr - 1.0 / 3.0) shouldBeLessThan 1e-9)
            }
        }

        `when`("relevant 가 전혀 없음") {
            then("MRR = 0.0") {
                RankingMetrics.mrr(listOf("a", "b"), emptyMap()) shouldBe 0.0
            }
        }

        `when`("threshold=2 일 때 relevance=1 는 무시") {
            then("MRR = 0.0") {
                RankingMetrics.mrr(listOf("a"), mapOf("a" to 1), threshold = 2) shouldBe 0.0
            }
        }
    }

    given("Precision/Recall @k") {
        val results = listOf("a", "b", "c", "d", "e")
        val judgments = mapOf("a" to 1, "b" to 0, "c" to 1, "d" to 0, "e" to 1)

        `when`("Precision@3") {
            then("= 2/3") {
                val p = RankingMetrics.precisionAtK(results, judgments, 3)
                (abs(p - 2.0 / 3.0) shouldBeLessThan 1e-9)
            }
        }

        `when`("Recall@3 (3 relevant 중 2 발견)") {
            then("= 2/3") {
                val r = RankingMetrics.recallAtK(results, judgments, 3)
                (abs(r - 2.0 / 3.0) shouldBeLessThan 1e-9)
            }
        }

        `when`("Recall@5 (모두 발견)") {
            then("= 1.0") {
                RankingMetrics.recallAtK(results, judgments, 5) shouldBe 1.0
            }
        }
    }

    given("AP@k / MAP@k") {
        val judgments = mapOf("a" to 1, "b" to 0, "c" to 1, "d" to 1)

        `when`("AP@4 — ranking [a, b, c, d]") {
            val ap = RankingMetrics.apAtK(listOf("a", "b", "c", "d"), judgments, 4)
            then("= (1/1 + 2/3 + 3/4) / 3") {
                val expected = (1.0 + 2.0 / 3.0 + 3.0 / 4.0) / 3.0
                abs(ap - expected) shouldBeLessThan 1e-9
            }
        }

        `when`("MAP@4 = 두 query 의 AP 평균") {
            then("간단 회귀") {
                val q1 = listOf("a", "b", "c", "d") to judgments
                val q2 = listOf("a", "c", "d", "b") to judgments
                val map = RankingMetrics.mapAtK(listOf(q1, q2), 4)
                val expected = (RankingMetrics.apAtK(q1.first, q1.second, 4) +
                    RankingMetrics.apAtK(q2.first, q2.second, 4)) / 2.0
                abs(map - expected) shouldBeLessThan 1e-9
            }
        }
    }
})
