package com.kgd.product.infrastructure.persistence.product.entity

import com.kgd.product.domain.product.model.Money
import com.kgd.product.domain.product.model.Product
import com.kgd.product.domain.product.model.ProductStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import java.math.BigDecimal
import java.time.LocalDateTime

@Entity
@Table(name = "products")
class ProductJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    name: String,
    price: BigDecimal,
    stock: Int,
    status: ProductStatus,
    brand: String? = null,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    @Column(nullable = false, length = 200)
    var name: String = name
        private set

    @Column(nullable = false, precision = 19, scale = 2)
    var price: BigDecimal = price
        private set

    @Column(nullable = false)
    var stock: Int = stock
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: ProductStatus = status
        private set

    @Column(length = 100)
    var brand: String? = brand
        private set

    /** 전체 동기화 — 도메인 모델 기준으로 영속 상태를 덮어쓴다 (entity-mutation.md) */
    fun update(product: Product) {
        name = product.name
        price = product.price.amount
        stock = product.stock
        status = product.status
        brand = product.brand
    }

    fun toDomain(): Product =
        Product.restore(id, name, Money(price), stock, status, createdAt, brand)

    companion object {
        fun fromDomain(product: Product) = ProductJpaEntity(
            id = product.id,
            name = product.name,
            price = product.price.amount,
            stock = product.stock,
            status = product.status,
            brand = product.brand,
            createdAt = product.createdAt
        )
    }
}
