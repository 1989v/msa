package com.kgd.ranking.infrastructure.persistence.repository

import com.kgd.ranking.application.cafe.dto.*
import com.kgd.ranking.domain.cafe.model.CaffeineStatus
import com.kgd.ranking.domain.cafe.model.CafeDrinkKey
import com.querydsl.core.types.dsl.Expressions
import com.kgd.ranking.infrastructure.persistence.entity.CafeEffectiveDrinkJpaEntity
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
    private val drink = PathBuilder(CafeEffectiveDrinkJpaEntity::class.java, "drink")

    fun search(query: CafeDrinkQuery, pageable: Pageable): CafeDrinkPage {
        val where = BooleanBuilder()
        query.q?.takeIf { it.isNotBlank() }?.let { where.and(drink.getString("menuName").containsIgnoreCase(it).or(drink.getString("displayName").containsIgnoreCase(it)).or(drink.getString("drinkName").containsIgnoreCase(com.kgd.ranking.domain.cafe.model.DrinkNames.normalize(it)))) }
        if (query.brands.isNotEmpty()) where.and(drink.getString("brandSlug").`in`(query.brands))
        if (query.selectedGroups.isNotEmpty()) where.and(drink.getString("drinkGroup").`in`(query.selectedGroups))
        query.temperature?.let { where.and(drink.getString("temperature").eq(it)) }
        query.maxSugar?.let { where.and(drink.getNumber("sugarG", BigDecimal::class.java).loe(it)) }
        query.maxCaffeine?.let {
            where.and(drink.getNumber("caffeineMg", BigDecimal::class.java).loe(it))
                .and(drink.getEnum("caffeineStatus", CaffeineStatus::class.java).ne(CaffeineStatus.UNDISCLOSED))
        }
        val statuses = when (query.caffeine) {
            "none" -> listOf(CaffeineStatus.ZERO, CaffeineStatus.DECAF)
            "zero" -> listOf(CaffeineStatus.ZERO)
            "decaf" -> listOf(CaffeineStatus.DECAF)
            else -> query.caffeineStatus
        }
        if (statuses.isNotEmpty()) where.and(drink.getEnum("caffeineStatus", CaffeineStatus::class.java).`in`(statuses))
        query.maxKcal?.let { where.and(drink.getNumber("kcal", BigDecimal::class.java).loe(it)) }
        // Facets cover all matching rows, independently of pagination and selected size.
        val sizeLabels = queryFactory.select(drink.getString("sizeLabel")).distinct().from(drink).where(where)
            .orderBy(drink.getString("sizeLabel").asc()).fetch().filterNotNull().filter { it.isNotBlank() }
        query.sizeLabel?.let { where.and(drink.getString("sizeLabel").eq(it)) }
        val field = when (query.sort) {
            "caffeine" -> "caffeineMg"
            "kcal" -> "kcal"
            else -> "sugarG"
        }
        val sourceMetric = drink.getNumber(field, BigDecimal::class.java)
        // A status explicitly marked undisclosed is unavailable even if a source numeric value exists.
        val raw = if (query.sort == "caffeine") Expressions.numberTemplate(BigDecimal::class.java,
            "case when {0} = {1} then null else {2} end",
            drink.getEnum("caffeineStatus", CaffeineStatus::class.java), CaffeineStatus.UNDISCLOSED, sourceMetric)
        else sourceMetric
        // Compute before sorting: persisted concentrations are rounded to four decimals.
        val metric = if (query.basis == "100ml" || query.sort == "sugarPer100ml")
            Expressions.numberTemplate(BigDecimal::class.java,
                "case when {1} > 0 then {0} * 100.0 / {1} else null end",
                raw, drink.getNumber("cupVolumeMl", BigDecimal::class.java))
        else raw
        val content = queryFactory.selectFrom(drink).where(where)
            .orderBy((if (query.direction == "desc") metric.desc() else metric.asc()).nullsLast(), drink.getString("brandSlug").asc(),
                drink.getString("menuName").asc(), drink.getString("temperature").asc(),
                drink.getString("sizeLabel").asc(), drink.getEnum("caffeineStatus", CaffeineStatus::class.java).asc())
            .offset(pageable.offset).limit(pageable.pageSize.toLong()).fetch()
        val count = queryFactory.select(drink.count()).from(drink).where(where).fetchOne() ?: 0L
        return CafeDrinkPage(content.map { CafeDrinkResponse.of(it.toDomain()) }, count, query.page, query.size, sizeLabels)
    }

    fun find(key: String): CafeDrinkResponse? {
        val fields = CafeDrinkKey.fields(key) ?: return null
        val row = queryFactory.selectFrom(drink).where(
            drink.getString("brandSlug").eq(fields[0]), drink.getString("menuName").eq(fields[1]),
            drink.getString("temperature").eq(fields[2]), drink.getString("sizeLabel").eq(fields[3]),
            drink.getEnum("caffeineStatus", CaffeineStatus::class.java).eq(CaffeineStatus.valueOf(fields[4])),
        ).fetchOne()
        return row?.toDomain()?.takeIf { CafeDrinkKey.of(it) == key }?.let(CafeDrinkResponse::of)
    }

    fun names(q: String): List<CafeDrinkNameCount> {
        val name = drink.getString("drinkName")
        val brands = drink.getString("brandSlug").countDistinct()
        return queryFactory.select(name, brands, drink.count()).from(drink)
            .where(name.containsIgnoreCase(com.kgd.ranking.domain.cafe.model.DrinkNames.normalize(q))).groupBy(name)
            .orderBy(brands.desc(), drink.count().desc(), name.asc()).limit(20).fetch()
            .map { CafeDrinkNameCount(it.get(name)!!, it.get(brands)!!.toInt(), it.get(drink.count())!!) }
    }

    fun variants(name: String): List<CafeDrinkResponse> = queryFactory.selectFrom(drink)
        .where(drink.getString("drinkName").eq(com.kgd.ranking.domain.cafe.model.DrinkNames.normalize(name))).fetch().map { CafeDrinkResponse.of(it.toDomain()) }

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
