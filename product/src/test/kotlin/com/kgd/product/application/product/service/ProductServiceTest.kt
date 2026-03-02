package com.kgd.product.application.product.service

import com.kgd.product.application.product.port.ProductEventPort
import com.kgd.product.application.product.port.ProductRepositoryPort
import com.kgd.product.application.product.usecase.CreateProductUseCase
import com.kgd.product.application.product.usecase.GetProductUseCase
import com.kgd.product.domain.product.exception.ProductNotFoundException
import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import com.kgd.product.domain.product.model.ProductStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import java.math.BigDecimal

class ProductServiceTest : BehaviorSpec({
    val repositoryPort = mockk<ProductRepositoryPort>()
    val eventPort = mockk<ProductEventPort>(relaxed = true)
    val service = ProductService(repositoryPort, eventPort)

    given("상품 생성 명령이 들어오면") {
        `when`("유효한 커맨드이면") {
            then("상품이 저장되고 이벤트가 발행되어야 한다") {
                val savedProduct = Product.restore(1L, "테스트", Money(1000.toBigDecimal()), 10, ProductStatus.ACTIVE, java.time.LocalDateTime.now())
                every { repositoryPort.save(any()) } returns savedProduct

                val result = service.execute(CreateProductUseCase.Command("테스트", 1000.toBigDecimal(), 10))

                result.id shouldBe 1L
                result.name shouldBe "테스트"
                result.status shouldBe "ACTIVE"
                verify(exactly = 1) { eventPort.publishProductCreated(any()) }
            }
        }
    }

    given("상품 조회 시") {
        `when`("존재하는 상품 ID이면") {
            then("상품 정보가 반환되어야 한다") {
                val product = Product.restore(1L, "상품", Money(1000.toBigDecimal()), 10, ProductStatus.ACTIVE, java.time.LocalDateTime.now())
                every { repositoryPort.findById(1L) } returns product

                val result = service.execute(1L)

                result.id shouldBe 1L
                result.name shouldBe "상품"
            }
        }
        `when`("존재하지 않는 상품 ID이면") {
            then("ProductNotFoundException이 발생해야 한다") {
                every { repositoryPort.findById(999L) } returns null

                shouldThrow<ProductNotFoundException> {
                    service.execute(999L)
                }
            }
        }
    }
})
