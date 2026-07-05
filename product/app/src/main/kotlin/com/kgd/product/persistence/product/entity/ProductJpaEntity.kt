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
    description: String? = null,
    category: String? = null,
    energyKcal: Double? = null,
    carbohydrateG: Double? = null,
    proteinG: Double? = null,
    fatG: Double? = null,
    sugarG: Double? = null,
    sodiumMg: Double? = null,
    ingredients: String? = null,
    originCountry: String? = null,
    itemReportNo: String? = null,
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

    @Column(length = 2000)
    var description: String? = description
        private set

    @Column(length = 100)
    var category: String? = category
        private set

    /** 영양성분 100g 기준 (ADR-0059) — 오픈데이터 미매칭 시 null */
    @Column
    var energyKcal: Double? = energyKcal
        private set

    @Column
    var carbohydrateG: Double? = carbohydrateG
        private set

    @Column
    var proteinG: Double? = proteinG
        private set

    @Column
    var fatG: Double? = fatG
        private set

    @Column
    var sugarG: Double? = sugarG
        private set

    @Column
    var sodiumMg: Double? = sodiumMg
        private set

    @Column(length = 2000)
    var ingredients: String? = ingredients
        private set

    @Column(length = 64)
    var originCountry: String? = originCountry
        private set

    /** 품목제조보고번호 — 영양성분 표준데이터(#15100066) exact join 키 */
    @Column(length = 30)
    var itemReportNo: String? = itemReportNo
        private set

    /** 전체 동기화 — 도메인 모델 기준으로 영속 상태를 덮어쓴다 (entity-mutation.md) */
    fun update(product: Product) {
        name = product.name
        price = product.price.amount
        stock = product.stock
        status = product.status
        brand = product.brand
        description = product.description
        category = product.category
        energyKcal = product.energyKcal
        carbohydrateG = product.carbohydrateG
        proteinG = product.proteinG
        fatG = product.fatG
        sugarG = product.sugarG
        sodiumMg = product.sodiumMg
        ingredients = product.ingredients
        originCountry = product.originCountry
        itemReportNo = product.itemReportNo
    }

    fun toDomain(): Product = Product.restore(
        id = id,
        name = name,
        price = Money(price),
        stock = stock,
        status = status,
        createdAt = createdAt,
        brand = brand,
        description = description,
        category = category,
        energyKcal = energyKcal,
        carbohydrateG = carbohydrateG,
        proteinG = proteinG,
        fatG = fatG,
        sugarG = sugarG,
        sodiumMg = sodiumMg,
        ingredients = ingredients,
        originCountry = originCountry,
        itemReportNo = itemReportNo
    )

    companion object {
        fun fromDomain(product: Product) = ProductJpaEntity(
            id = product.id,
            name = product.name,
            price = product.price.amount,
            stock = product.stock,
            status = product.status,
            brand = product.brand,
            description = product.description,
            category = product.category,
            energyKcal = product.energyKcal,
            carbohydrateG = product.carbohydrateG,
            proteinG = product.proteinG,
            fatG = product.fatG,
            sugarG = product.sugarG,
            sodiumMg = product.sodiumMg,
            ingredients = product.ingredients,
            originCountry = product.originCountry,
            itemReportNo = product.itemReportNo,
            createdAt = product.createdAt
        )
    }
}
