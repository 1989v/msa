package com.kgd.search.bandit

import com.kgd.search.domain.bandit.model.BanditKey
import com.kgd.search.domain.bandit.model.BanditState
import com.kgd.search.domain.bandit.port.BanditStatePort
import com.kgd.search.domain.product.model.ProductDocument
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import java.math.BigDecimal
import java.time.Instant

class ThompsonRerankerTest : BehaviorSpec({

    fun doc(id: String, cat: String = "elec") =
        ProductDocument(id = id, name = "n-$id", price = BigDecimal.ONE, status = "ACTIVE", categoryId = cat)

    fun blender(props: BanditProperties, port: BanditStatePort): MultiScopeBanditBlender =
        MultiScopeBanditBlender(props, port)

    given("ThompsonReranker") {

        `when`("enabled=false 면") {
            then("ES 결과를 그대로 반환한다") {
                val statePort = mockk<BanditStatePort>(relaxed = true)
                val props = BanditProperties(enabled = false)
                val reranker = ThompsonReranker(props, blender(props, statePort))
                val scored = listOf(doc("a") to 5.0, doc("b") to 3.0, doc("c") to 1.0)
                reranker.rerank(scored).map { it.first.id } shouldBe listOf("a", "b", "c")
            }
        }

        `when`("hybridWeight=1.0 (ES dominant)") {
            then("ES 순서가 보존된다 (rerank 무력화)") {
                val statePort = mockk<BanditStatePort>()
                every { statePort.fetchBatch(any()) } returns emptyMap()
                val props = BanditProperties(enabled = true, hybridWeight = 1.0, topN = 100)
                val reranker = ThompsonReranker(props, blender(props, statePort))
                val scored = listOf(doc("a") to 5.0, doc("b") to 3.0, doc("c") to 1.0)
                reranker.rerank(scored).map { it.first.id } shouldBe listOf("a", "b", "c")
            }
        }

        `when`("Redis 가 비어 있고 hybridWeight < 1.0") {
            then("그래도 결과 size 는 같고 모든 doc 가 포함된다 (graceful degradation)") {
                val statePort = mockk<BanditStatePort>()
                every { statePort.fetchBatch(any()) } returns emptyMap()
                val props = BanditProperties(enabled = true, hybridWeight = 0.5, topN = 100)
                val reranker = ThompsonReranker(props, blender(props, statePort))
                val scored = listOf(doc("a") to 5.0, doc("b") to 3.0, doc("c") to 1.0)
                val out = reranker.rerank(scored)
                out shouldHaveSize 3
                out.map { it.first.id }.toSet() shouldBe setOf("a", "b", "c")
            }
        }

        `when`("topN 보다 많은 후보가 들어오면") {
            then("앞 topN 만 rerank 되고 나머지는 원순서 유지") {
                val statePort = mockk<BanditStatePort>()
                every { statePort.fetchBatch(any()) } returns emptyMap()
                val props = BanditProperties(enabled = true, topN = 2, hybridWeight = 1.0)
                val reranker = ThompsonReranker(props, blender(props, statePort))
                val scored = (1..5).map { doc("p$it") to it.toDouble() }
                    .sortedByDescending { it.second }
                val out = reranker.rerank(scored)
                out shouldHaveSize 5
                // 마지막 3개 (topN=2 밖) 는 원순서가 그대로 유지
                out.takeLast(3).map { it.first.id } shouldBe scored.takeLast(3).map { it.first.id }
            }
        }

        `when`("강한 데이터 arm 이 prior-only arm 보다 보통 위에 올라야 한다") {
            then("100회 평균 위치가 strong arm 이 더 위") {
                val now = Instant.now()
                val statePort = mockk<BanditStatePort>()
                every { statePort.fetchBatch(any()) } answers {
                    val keys = firstArg<Collection<BanditKey>>()
                    keys.associateWith { key ->
                        if (key.productId == "strong") {
                            BanditState(key, clicks = 800, impressions = 1_000, lastUpdatedAt = now)
                        } else {
                            BanditState(key, clicks = 0, impressions = 5, lastUpdatedAt = now)
                        }
                    }
                }
                val props = BanditProperties(
                    enabled = true,
                    hybridWeight = 0.0,  // 순수 TS 효과만 검증
                    impressionThreshold = 0,
                    priorAlpha = 1.0,
                    priorBeta = 9.0,
                    decayLambdaPerDay = 0.0
                )
                val reranker = ThompsonReranker(props, blender(props, statePort))
                val scored = listOf(doc("strong") to 1.0, doc("weak") to 1.0)
                val trials = 200
                var strongOnTop = 0
                repeat(trials) {
                    val out = reranker.rerank(scored)
                    if (out.first().first.id == "strong") strongOnTop += 1
                }
                // 800/1000 → ~0.8 평균, weak arm 은 prior(1,9) → ~0.1 평균
                // 거의 항상 strong 이 위
                (strongOnTop > trials * 0.9).shouldBe(true)
            }
        }
    }
})
