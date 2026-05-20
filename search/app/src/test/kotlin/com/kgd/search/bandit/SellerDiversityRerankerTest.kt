package com.kgd.search.bandit

import com.kgd.search.domain.product.model.ProductDocument
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal

class SellerDiversityRerankerTest : BehaviorSpec({

    fun doc(id: String, seller: String) =
        ProductDocument(id = id, name = "n-$id", price = BigDecimal.ONE, status = "ACTIVE", categoryId = seller)

    given("SellerDiversityReranker") {

        `when`("enabled=false") {
            then("입력 그대로 반환") {
                val reranker = SellerDiversityReranker(DiversityProperties(enabled = false))
                val input = (1..5).map { doc("p$it", "elec") to it.toDouble() }
                reranker.rerank(input).map { it.first.id } shouldBe input.map { it.first.id }
            }
        }

        `when`("동일 seller 가 maxPerSeller=2 초과하면") {
            then("뒤로 밀리고 다른 seller 가 끌어올려진다") {
                val reranker = SellerDiversityReranker(
                    DiversityProperties(enabled = true, maxPerSeller = 2, topK = 5)
                )
                // s1, s1, s1, s1, s2 → s1 은 2 회까지만, s2 가 한 자리 차지
                val input = listOf(
                    doc("a", "s1") to 5.0,
                    doc("b", "s1") to 4.0,
                    doc("c", "s1") to 3.0,
                    doc("d", "s1") to 2.0,
                    doc("e", "s2") to 1.0
                )
                val out = reranker.rerank(input).map { it.first.id }
                // accepted: a (s1=1), b (s1=2), e (s2=1) — c/d 는 deferred 뒤로
                out shouldBe listOf("a", "b", "e", "c", "d")
            }
        }

        `when`("topK 밖은 그대로 유지") {
            then("topK=2 일 때 두번째 슬롯까지만 diversity 적용") {
                val reranker = SellerDiversityReranker(
                    DiversityProperties(enabled = true, maxPerSeller = 1, topK = 2)
                )
                val input = listOf(
                    doc("a", "s1") to 5.0,
                    doc("b", "s1") to 4.0,  // topK 안, deferred
                    doc("c", "s1") to 3.0,  // topK 밖 — 그대로 유지
                    doc("d", "s2") to 2.0
                )
                val out = reranker.rerank(input).map { it.first.id }
                // topK 영역 (a, b) → accepted=[a], deferred=[b]
                // topK 밖 (c, d) 는 그대로
                // 결과: a, b, c, d (b 가 deferred 로 같은 위치)
                out shouldBe listOf("a", "b", "c", "d")
            }
        }

        `when`("모든 seller 가 다르면") {
            then("입력 순서 그대로 유지") {
                val reranker = SellerDiversityReranker(
                    DiversityProperties(enabled = true, maxPerSeller = 1, topK = 5)
                )
                val input = (1..3).map { doc("p$it", "s$it") to it.toDouble() }
                reranker.rerank(input).map { it.first.id } shouldBe input.map { it.first.id }
            }
        }
    }
})
