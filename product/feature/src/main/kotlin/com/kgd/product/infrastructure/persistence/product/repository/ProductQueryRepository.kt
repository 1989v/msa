package com.kgd.product.infrastructure.persistence.product.repository

import com.kgd.product.domain.product.model.ProductStatus
import com.kgd.product.infrastructure.persistence.product.entity.ProductJpaEntity
import com.kgd.product.infrastructure.persistence.product.entity.QProductJpaEntity
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Repository

@Repository
class ProductQueryRepository(
    // 한정자 필수 — 총칭 주입이면 호스트의 기본 EMF(inventory)로 붙어 조용히 다른 DB 를 본다
    @Qualifier("productJpaQueryFactory") private val queryFactory: JPAQueryFactory,
) {

    private val product = QProductJpaEntity.productJpaEntity

    /** [sellerId] 가 null 이면 판매자로 거르지 않는다(Querydsl 은 null 조건을 건너뛴다) */
    fun findAllByStatus(status: ProductStatus, sellerId: Long?, pageable: Pageable): Page<ProductJpaEntity> {
        val bySeller = sellerId?.let { product.sellerId.eq(it) }
        val content = queryFactory
            .selectFrom(product)
            .where(product.status.eq(status), bySeller)
            .offset(pageable.offset)
            .limit(pageable.pageSize.toLong())
            .fetch()

        val total = queryFactory
            .select(product.count())
            .from(product)
            .where(product.status.eq(status), bySeller)
            .fetchOne() ?: 0L

        return PageImpl(content, pageable, total)
    }
}
