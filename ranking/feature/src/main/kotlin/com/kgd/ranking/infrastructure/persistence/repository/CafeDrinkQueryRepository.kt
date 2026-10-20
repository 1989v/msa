package com.kgd.ranking.infrastructure.persistence.repository

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import com.kgd.ranking.infrastructure.persistence.entity.CafeDrinkJpaEntity
import com.querydsl.core.BooleanBuilder
import com.querydsl.core.types.dsl.PathBuilder
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Repository
import java.math.BigDecimal
import java.time.LocalDate

/** Filters and pagination run in the DB; count omits sorting and pagination. */
@Repository
class CafeDrinkQueryRepository(@Qualifier("rankingQueryFactory") private val queryFactory: JPAQueryFactory) {
    private val drink = PathBuilder(CafeDrinkJpaEntity::class.java, "drink")

    fun search(query: CafeDrinkQuery, pageable: Pageable): CafeDrinkPage {
        val where = BooleanBuilder()
        query.q?.takeIf { it.isNotBlank() }?.let { where.and(drink.getString("menuName").containsIgnoreCase(it)) }
        if (query.brands.isNotEmpty()) where.and(drink.getString("brandSlug").`in`(query.brands))
        query.group?.let { where.and(drink.getString("drinkGroup").eq(it)) }
        query.temperature?.let { where.and(drink.getString("temperature").eq(it)) }
        query.maxSugar?.let { where.and(drink.getNumber("sugarG", BigDecimal::class.java).loe(it)) }
        query.maxCaffeine?.let { where.and(drink.getNumber("caffeineMg", BigDecimal::class.java).loe(it)) }
        if (query.caffeine == "none") where.and(drink.getEnum("caffeineStatus", CaffeineStatus::class.java)
            .`in`(CaffeineStatus.ZERO, CaffeineStatus.DECAF))
        val sort = when (query.sort) {
            "caffeine" -> "caffeineMg"
            "kcal" -> "kcal"
            "sugarPer100ml" -> "sugarPer100ml"
            else -> "sugarG"
        }
        val metric = drink.getNumber(sort, BigDecimal::class.java)
        val content = queryFactory.selectFrom(drink).where(where)
            .orderBy(metric.asc().nullsLast(), drink.getString("brandSlug").asc(), drink.getNumber("id", Long::class.javaObjectType).asc())
            .offset(pageable.offset).limit(pageable.pageSize.toLong()).fetch()
        val count = queryFactory.select(drink.count()).from(drink).where(where).fetchOne() ?: 0L
        return CafeDrinkPage(content.map { CafeDrinkResponse.of(it.toDomain()) }, count, query.page, query.size)
    }

    fun groups(): List<CafeGroupCount> {
        val group = drink.getString("drinkGroup")
        return queryFactory.select(group, drink.count()).from(drink).groupBy(group).orderBy(group.asc())
            .fetch().map { CafeGroupCount(it.get(group)!!, it.get(drink.count())!!) }
    }

    fun brands(): List<CafeBrandCount> {
        // Source links vary by menu; return every distinct official URL and the latest check date.
        val slug = drink.getString("brandSlug")
        val name = drink.getString("brandName")
        val url = drink.getString("sourceUrl")
        val checked = drink.getDate("checkedAt", LocalDate::class.java)
        return queryFactory.select(slug, name, url, checked, drink.count()).from(drink)
            .groupBy(slug, name, url, checked).fetch().groupBy { it.get(slug)!! }.map { (brand, rows) ->
                CafeBrandCount(brand, rows.first().get(name)!!, rows.sumOf { it.get(drink.count())!! },
                    rows.mapNotNull { it.get(url) }.distinct().sorted(), rows.mapNotNull { it.get(checked) }.max())
            }.sortedBy { it.brandSlug }
    }
}
