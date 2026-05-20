package com.kgd.search.bandit

import com.kgd.search.domain.bandit.model.BanditKey
import com.kgd.search.domain.bandit.model.BanditState
import com.kgd.search.domain.bandit.port.BanditStatePort
import com.kgd.search.domain.product.model.ProductDocument
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import java.math.BigDecimal
import java.time.Instant

class MultiScopeBanditBlenderTest : BehaviorSpec({

    fun doc(id: String, cat: String? = "elec") =
        ProductDocument(id = id, name = "n-$id", price = BigDecimal.ONE, status = "ACTIVE", categoryId = cat)

    given("MultiScopeBanditBlender") {
        `when`("scope 가 비어있으면 default category scope 만 사용") {
            then("blender 가 단일 scope 와 동일하게 0..1 점수 반환") {
                val port = mockk<BanditStatePort>()
                every { port.fetchBatch(any()) } returns emptyMap()
                val props = BanditProperties(enabled = true, impressionThreshold = 0)
                val blender = MultiScopeBanditBlender(props, port)
                val result = blender.blend(listOf(doc("a"), doc("b")))
                result.keys shouldBe setOf("a", "b")
                result.values.forEach { v ->
                    v shouldBeGreaterThan -0.001
                    v shouldBeLessThan 1.001
                }
            }
        }

        `when`("강한 데이터 arm 은 평균 score 가 prior-only arm 보다 크다") {
            then("100회 평균 비교") {
                val now = Instant.now()
                val port = mockk<BanditStatePort>()
                every { port.fetchBatch(any()) } answers {
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
                    impressionThreshold = 0,
                    decayLambdaPerDay = 0.0,
                    priorAlpha = 1.0,
                    priorBeta = 9.0
                )
                val blender = MultiScopeBanditBlender(props, port)
                val docs = listOf(doc("strong"), doc("weak"))
                val trials = 100
                var strongSum = 0.0
                var weakSum = 0.0
                repeat(trials) {
                    val result = blender.blend(docs)
                    strongSum += result["strong"] ?: 0.0
                    weakSum += result["weak"] ?: 0.0
                }
                (strongSum / trials) shouldBeGreaterThan (weakSum / trials)
            }
        }

        `when`("scopes 가 명시되면 weighted average 적용") {
            then("category scope 1개일 때 결과는 단일 scope 와 동일 범위") {
                val port = mockk<BanditStatePort>()
                every { port.fetchBatch(any()) } returns emptyMap()
                val props = BanditProperties(
                    enabled = true,
                    impressionThreshold = 0,
                    scopes = listOf(
                        ScopeConfig(name = BanditKey.SCOPE_CATEGORY, weight = 1.0)
                    )
                )
                val blender = MultiScopeBanditBlender(props, port)
                val result = blender.blend(listOf(doc("a")))
                val score = result["a"] ?: 0.0
                score shouldBeGreaterThan -0.001
                score shouldBeLessThan 1.001
            }
        }
    }

    given("BanditKey scope 일반화") {
        `when`("BanditKey.category(\"elec\", \"p1\")") {
            then("scope = \"category:elec\"") {
                BanditKey.category("elec", "p1").scope shouldBe "category:elec"
            }
        }
        `when`("BanditKey.brand(null, \"p1\")") {
            then("scope = \"_default_\"") {
                BanditKey.brand(null, "p1").scope shouldBe BanditKey.DEFAULT_SCOPE
            }
        }
        `when`("BanditKey.brand(\"\", \"p1\")") {
            then("빈 문자열도 default 로 fallback") {
                BanditKey.brand("", "p1").scope shouldBe BanditKey.DEFAULT_SCOPE
            }
        }
    }
})
