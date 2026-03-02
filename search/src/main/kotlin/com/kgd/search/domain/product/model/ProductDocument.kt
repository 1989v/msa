package com.kgd.search.domain.product.model

import org.springframework.data.annotation.Id
import org.springframework.data.elasticsearch.annotations.Document
import org.springframework.data.elasticsearch.annotations.Field
import org.springframework.data.elasticsearch.annotations.FieldType
import java.math.BigDecimal
import java.time.LocalDateTime

@Document(indexName = "products")
data class ProductDocument(
    @Id
    val id: String,
    @Field(type = FieldType.Text, analyzer = "nori")
    val name: String,
    @Field(type = FieldType.Double)
    val price: BigDecimal,
    @Field(type = FieldType.Keyword)
    val status: String,
    @Field(type = FieldType.Date, format = [], pattern = ["yyyy-MM-dd'T'HH:mm:ss"])
    val createdAt: LocalDateTime = LocalDateTime.now()
)
