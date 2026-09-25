package com.kgd.product.infrastructure.persistence.product.repository

import com.kgd.product.domain.product.model.ProductStatus
import com.kgd.product.infrastructure.persistence.product.entity.ProductJpaEntity
import com.kgd.product.infrastructure.persistence.product.entity.QProductJpaEntity
import com.querydsl.core.types.Order
import com.querydsl.core.types.OrderSpecifier
import com.querydsl.core.types.dsl.PathBuilder
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Repository

@Repository
class ProductQueryRepository(
    // 한정자 필수 — 총칭 주입이면 호스트의 기본 EMF(inventory)로 붙어 조용히 다른 DB 를 본다
    @Qualifier("productJpaQueryFactory") private val queryFactory: JPAQueryFactory,
) {

    private val product = QProductJpaEntity.productJpaEntity
    private val productPath = PathBuilder(ProductJpaEntity::class.java, product.metadata)

    /**
     * [status] · [sellerId] 가 null 이면 그 조건으로 거르지 않는다(Querydsl 은 null 조건을 건너뛴다).
     * 정렬은 [pageable] 의 것을 그대로 쓴다 — 없으면 DB 가 정한 순서라 페이지 경계에서 행이 겹치거나 빠진다.
     */
    fun findAll(status: ProductStatus?, sellerId: Long?, pageable: Pageable): Page<ProductJpaEntity> {
        val byStatus = status?.let { product.status.eq(it) }
        val bySeller = sellerId?.let { product.sellerId.eq(it) }
        val content = queryFactory
            .selectFrom(product)
            .where(byStatus, bySeller)
            .orderBy(*orderOf(pageable.sort))
            .offset(pageable.offset)
            .limit(pageable.pageSize.toLong())
            .fetch()

        val total = queryFactory
            .select(product.count())
            .from(product)
            .where(byStatus, bySeller)
            .fetchOne() ?: 0L

        return PageImpl(content, pageable, total)
    }

    private fun orderOf(sort: Sort): Array<OrderSpecifier<*>> =
        sort.map { order ->
            OrderSpecifier(
                if (order.isAscending) Order.ASC else Order.DESC,
                productPath.getComparable(order.property, Comparable::class.java),
            )
        }.toList().toTypedArray()
}
