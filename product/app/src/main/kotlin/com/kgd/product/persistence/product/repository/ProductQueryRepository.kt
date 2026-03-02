package com.kgd.product.infrastructure.persistence.product.repository

import com.kgd.product.domain.product.model.ProductStatus
import com.kgd.product.infrastructure.persistence.product.entity.ProductJpaEntity
import com.kgd.product.infrastructure.persistence.product.entity.QProductJpaEntity
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Repository

@Repository
class ProductQueryRepository(private val queryFactory: JPAQueryFactory) {

    private val product = QProductJpaEntity.productJpaEntity

    fun findAllByStatus(status: ProductStatus, pageable: Pageable): Page<ProductJpaEntity> {
        val content = queryFactory
            .selectFrom(product)
            .where(product.status.eq(status))
            .offset(pageable.offset)
            .limit(pageable.pageSize.toLong())
            .fetch()

        val total = queryFactory
            .select(product.count())
            .from(product)
            .where(product.status.eq(status))
            .fetchOne() ?: 0L

        return PageImpl(content, pageable, total)
    }
}
