package com.kgd.product.domain.product.model

import java.time.LocalDateTime

class Product private constructor(
    val id: Long? = null,
    var name: String,
    var price: Money,
    var stock: Int,
    var status: ProductStatus,
    var brand: String? = null,
    var description: String? = null,
    var category: String? = null,
    // 영양성분 (100g 기준, ADR-0059) — 오픈데이터 미매칭 시 null (추정 채움 금지)
    var energyKcal: Double? = null,
    var carbohydrateG: Double? = null,
    var proteinG: Double? = null,
    var fatG: Double? = null,
    var sugarG: Double? = null,
    var sodiumMg: Double? = null,
    var ingredients: String? = null,
    var originCountry: String? = null,
    var itemReportNo: String? = null,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun create(
            name: String,
            price: Money,
            stock: Int,
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
            itemReportNo: String? = null
        ): Product {
            require(name.isNotBlank()) { "상품명은 비어있을 수 없습니다" }
            require(stock >= 0) { "재고는 0 이상이어야 합니다" }
            requireNonNegative(energyKcal, "에너지(kcal)")
            requireNonNegative(carbohydrateG, "탄수화물(g)")
            requireNonNegative(proteinG, "단백질(g)")
            requireNonNegative(fatG, "지방(g)")
            requireNonNegative(sugarG, "당류(g)")
            requireNonNegative(sodiumMg, "나트륨(mg)")
            return Product(
                name = name,
                price = price,
                stock = stock,
                status = ProductStatus.ACTIVE,
                brand = brand?.takeIf { it.isNotBlank() },
                description = description?.takeIf { it.isNotBlank() },
                category = category?.takeIf { it.isNotBlank() },
                energyKcal = energyKcal,
                carbohydrateG = carbohydrateG,
                proteinG = proteinG,
                fatG = fatG,
                sugarG = sugarG,
                sodiumMg = sodiumMg,
                ingredients = ingredients?.takeIf { it.isNotBlank() },
                originCountry = originCountry?.takeIf { it.isNotBlank() },
                itemReportNo = itemReportNo?.takeIf { it.isNotBlank() }
            )
        }

        fun restore(
            id: Long?,
            name: String,
            price: Money,
            stock: Int,
            status: ProductStatus,
            createdAt: LocalDateTime,
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
            itemReportNo: String? = null
        ): Product =
            Product(
                id = id,
                name = name,
                price = price,
                stock = stock,
                status = status,
                brand = brand?.takeIf { it.isNotBlank() },
                description = description?.takeIf { it.isNotBlank() },
                category = category?.takeIf { it.isNotBlank() },
                energyKcal = energyKcal,
                carbohydrateG = carbohydrateG,
                proteinG = proteinG,
                fatG = fatG,
                sugarG = sugarG,
                sodiumMg = sodiumMg,
                ingredients = ingredients?.takeIf { it.isNotBlank() },
                originCountry = originCountry?.takeIf { it.isNotBlank() },
                itemReportNo = itemReportNo?.takeIf { it.isNotBlank() },
                createdAt = createdAt
            )

        private fun requireNonNegative(value: Double?, label: String) {
            require(value == null || value >= 0.0) { "${label}은(는) 0 이상이어야 합니다" }
        }
    }

    fun deactivate() {
        check(status == ProductStatus.ACTIVE) { "활성 상품만 비활성화할 수 있습니다" }
        status = ProductStatus.INACTIVE
    }

    fun syncStock(availableQty: Int) {
        require(availableQty >= 0) { "재고는 0 이상이어야 합니다" }
        this.stock = availableQty
    }

    fun update(
        name: String? = null,
        price: Money? = null,
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
        itemReportNo: String? = null
    ) {
        name?.let {
            require(it.isNotBlank()) { "상품명은 비어있을 수 없습니다" }
            this.name = it
        }
        price?.let { this.price = it }
        brand?.let { this.brand = it.takeIf { v -> v.isNotBlank() } }
        description?.let { this.description = it.takeIf { v -> v.isNotBlank() } }
        category?.let { this.category = it.takeIf { v -> v.isNotBlank() } }
        energyKcal?.let { requireNonNegative(it, "에너지(kcal)"); this.energyKcal = it }
        carbohydrateG?.let { requireNonNegative(it, "탄수화물(g)"); this.carbohydrateG = it }
        proteinG?.let { requireNonNegative(it, "단백질(g)"); this.proteinG = it }
        fatG?.let { requireNonNegative(it, "지방(g)"); this.fatG = it }
        sugarG?.let { requireNonNegative(it, "당류(g)"); this.sugarG = it }
        sodiumMg?.let { requireNonNegative(it, "나트륨(mg)"); this.sodiumMg = it }
        ingredients?.let { this.ingredients = it.takeIf { v -> v.isNotBlank() } }
        originCountry?.let { this.originCountry = it.takeIf { v -> v.isNotBlank() } }
        itemReportNo?.let { this.itemReportNo = it.takeIf { v -> v.isNotBlank() } }
    }
}
