package com.kgd.search.infrastructure.opensearch

import com.fasterxml.jackson.annotation.JsonFormat
import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.kgd.search.domain.product.model.ProductDocument
import java.math.BigDecimal
import java.time.LocalDateTime

/**
 * `products` 인덱스 문서 (ADR-0055 — Spring Data `@Document` 제거, jackson 직렬화).
 *
 * 필드 타입/분석기 정의는 batch 의 인덱스 생성 JSON (`products-index.json`) 이 SSOT.
 * [createdAt] 의 패턴은 해당 매핑의 date format 과 일치해야 한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
data class ProductSearchDocument(
    val id: String,
    val name: String,
    val price: BigDecimal,
    val status: String,
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
    val createdAt: LocalDateTime = LocalDateTime.now(),
    val popularityScore: Double = 0.0,
    val ctr: Double = 0.0,
    val cvr: Double = 0.0,
    val ctrRaw: Double = 0.0,
    val cvrRaw: Double = 0.0,
    val gmv7d: Double = 0.0,
    val gmv30d: Double = 0.0,
    val scoreUpdatedAt: Long = 0,
    val categoryId: String? = null,
    val brand: String? = null,
    val description: String? = null,
    val category: String? = null
) {
    companion object {
        fun fromDomain(doc: ProductDocument) = ProductSearchDocument(
            id = doc.id,
            name = doc.name,
            price = doc.price,
            status = doc.status,
            createdAt = doc.createdAt,
            popularityScore = doc.popularityScore,
            ctr = doc.ctr,
            cvr = doc.cvr,
            ctrRaw = doc.ctrRaw,
            cvrRaw = doc.cvrRaw,
            gmv7d = doc.gmv7d,
            gmv30d = doc.gmv30d,
            scoreUpdatedAt = doc.scoreUpdatedAt,
            categoryId = doc.categoryId,
            brand = doc.brand,
            description = doc.description,
            category = doc.category
        )
    }

    fun toDomain() = ProductDocument(
        id = id,
        name = name,
        price = price,
        status = status,
        createdAt = createdAt,
        popularityScore = popularityScore,
        ctr = ctr,
        cvr = cvr,
        ctrRaw = ctrRaw,
        cvrRaw = cvrRaw,
        gmv7d = gmv7d,
        gmv30d = gmv30d,
        scoreUpdatedAt = scoreUpdatedAt,
        categoryId = categoryId,
        brand = brand,
        description = description,
        category = category
    )
}
