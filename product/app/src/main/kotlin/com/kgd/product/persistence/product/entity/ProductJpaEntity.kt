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
    @Column(nullable = false, length = 200)
    var name: String,
    @Column(nullable = false, precision = 19, scale = 2)
    var price: BigDecimal,
    @Column(nullable = false)
    var stock: Int,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: ProductStatus,
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    fun toDomain(): Product = Product.restore(id, name, Money(price), stock, status, createdAt)

    companion object {
        fun fromDomain(product: Product) = ProductJpaEntity(
            id = product.id,
            name = product.name,
            price = product.price.amount,
            stock = product.stock,
            status = product.status,
            createdAt = product.createdAt
        )
    }
}
