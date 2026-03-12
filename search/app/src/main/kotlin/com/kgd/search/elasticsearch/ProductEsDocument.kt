package com.kgd.search.infrastructure.elasticsearch

import com.kgd.search.domain.product.model.ProductDocument
import org.springframework.data.annotation.Id
import org.springframework.data.elasticsearch.annotations.Document
import org.springframework.data.elasticsearch.annotations.Field
import org.springframework.data.elasticsearch.annotations.FieldType
import java.math.BigDecimal
import java.time.LocalDateTime

@Document(indexName = "products")
data class ProductEsDocument(
    @Id val id: String,
    @Field(type = FieldType.Text, analyzer = "nori") val name: String,
    @Field(type = FieldType.Double) val price: BigDecimal,
    @Field(type = FieldType.Keyword) val status: String,
    @Field(type = FieldType.Date, format = [], pattern = ["yyyy-MM-dd'T'HH:mm:ss"])
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    companion object {
        fun fromDomain(doc: ProductDocument) = ProductEsDocument(
            id = doc.id,
            name = doc.name,
            price = doc.price,
            status = doc.status,
            createdAt = doc.createdAt
        )
    }

    fun toDomain() = ProductDocument(
        id = id,
        name = name,
        price = price,
        status = status,
        createdAt = createdAt
    )
}
