package com.kgd.codedictionary.infrastructure.persistence.portfolio.repository

import com.kgd.codedictionary.domain.portfolio.model.Visibility
import com.kgd.codedictionary.infrastructure.persistence.portfolio.entity.PortfolioCardJpaEntity
import com.kgd.codedictionary.infrastructure.persistence.portfolio.entity.QPortfolioCardJpaEntity
import com.querydsl.core.types.OrderSpecifier
import com.querydsl.core.types.dsl.BooleanExpression
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Repository

@Repository
class PortfolioCardQueryRepository(
    private val queryFactory: JPAQueryFactory,
) {
    private val card = QPortfolioCardJpaEntity.portfolioCardJpaEntity

    fun search(visibility: Visibility, q: String?, pageable: Pageable): Page<PortfolioCardJpaEntity> {
        val condition = card.visibility.eq(visibility).and(keywordContains(q))

        val content = queryFactory
            .selectFrom(card)
            .where(condition)
            .orderBy(*orderSpecifiers(pageable.sort))
            .offset(pageable.offset)
            .limit(pageable.pageSize.toLong())
            .fetch()

        val total = queryFactory
            .select(card.count())
            .from(card)
            .where(condition)
            .fetchOne() ?: 0L

        return PageImpl(content, pageable, total)
    }

    private fun keywordContains(q: String?): BooleanExpression? =
        q?.takeIf { it.isNotBlank() }?.let {
            card.title.containsIgnoreCase(it)
                .or(card.summary.containsIgnoreCase(it))
                .or(card.body.containsIgnoreCase(it))
        }

    private fun orderSpecifiers(sort: Sort): Array<OrderSpecifier<*>> {
        if (sort.isUnsorted) return arrayOf(card.createdAt.desc())
        return sort.mapNotNull { order ->
            when (order.property) {
                "impact" -> if (order.isAscending) card.impact.asc() else card.impact.desc()
                "createdAt" -> if (order.isAscending) card.createdAt.asc() else card.createdAt.desc()
                else -> null
            }
        }.toTypedArray()
    }
}
