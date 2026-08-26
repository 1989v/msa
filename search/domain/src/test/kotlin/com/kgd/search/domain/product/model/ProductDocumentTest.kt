package com.kgd.search.domain.product.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import java.math.BigDecimal

class ProductDocumentTest : BehaviorSpec({
    given("ProductDocument 생성 시") {
        `when`("유효한 데이터가 주어지면") {
            then("ProductDocument가 정상 생성되어야 한다") {
                val doc = ProductDocument(
                    id = "1",
                    name = "테스트 상품",
                    price = BigDecimal("10000"),
                    status = "ACTIVE"
                )
                doc.id shouldBe "1"
                doc.name shouldBe "테스트 상품"
                doc.price shouldBe BigDecimal("10000")
                doc.status shouldBe "ACTIVE"
                doc.createdAt shouldNotBe null
            }
        }
    }
})
