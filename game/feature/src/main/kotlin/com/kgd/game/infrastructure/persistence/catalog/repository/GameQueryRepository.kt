package com.kgd.game.infrastructure.persistence.catalog.repository

import com.kgd.game.application.catalog.service.GameSort
import com.kgd.game.domain.catalog.model.GameStatus
import com.kgd.game.infrastructure.persistence.catalog.entity.GameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.QGameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.QGameStatsJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.QGameTagMapJpaEntity
import com.querydsl.core.BooleanBuilder
import com.querydsl.core.types.dsl.Expressions
import com.querydsl.jpa.JPAExpressions
import com.querydsl.jpa.impl.JPAQueryFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.data.domain.Page
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.Pageable
import org.springframework.stereotype.Repository

/** 공개 리스트/유사 게임 조회 — 무거운 조회는 Querydsl QueryRepository (jpa-persistence.md §5) */
@Repository
class GameQueryRepository(
    @Qualifier("gameJpaQueryFactory") private val queryFactory: JPAQueryFactory,
) {
    private val game = QGameJpaEntity.gameJpaEntity
    private val stats = QGameStatsJpaEntity.gameStatsJpaEntity

    fun search(tag: String?, sort: GameSort, pageable: Pageable): Page<GameJpaEntity> {
        val condition = BooleanBuilder(game.status.eq(GameStatus.PUBLISHED))
        if (!tag.isNullOrBlank()) {
            val tagMap = QGameTagMapJpaEntity.gameTagMapJpaEntity
            condition.and(
                JPAExpressions.selectOne()
                    .from(tagMap)
                    .where(tagMap.gameId.eq(game.id), tagMap.tagSlug.eq(tag))
                    .exists()
            )
        }

        val query = queryFactory.selectFrom(game)
            .leftJoin(stats).on(stats.gameId.eq(game.id))
            .where(condition)

        val ordered = when (sort) {
            GameSort.TRENDING -> query.orderBy(stats.weeklyPlayCount.coalesce(0L).desc(), game.id.desc())
            GameSort.NEW -> query.orderBy(game.releasedAt.desc().nullsLast(), game.id.desc())
            GameSort.TOP -> query.orderBy(
                Expressions.numberTemplate(
                    Double::class.java,
                    "coalesce({0} / nullif({1}, 0), 0)",
                    stats.ratingSum,
                    stats.ratingCount,
                ).desc(),
                stats.ratingCount.coalesce(0L).desc(),
                game.id.desc(),
            )
        }

        val content = ordered
            .offset(pageable.offset)
            .limit(pageable.pageSize.toLong())
            .fetch()
        val total = queryFactory.select(game.count()).from(game).where(condition).fetchOne() ?: 0L
        return PageImpl(content, pageable, total)
    }

    /** 태그 교집합 수 내림차순 — "More Games Like This" (설계 §4.1) */
    fun findSimilar(gameId: Long, limit: Int): List<GameJpaEntity> {
        val m1 = QGameTagMapJpaEntity("m1")
        val m2 = QGameTagMapJpaEntity("m2")

        val similarIds = queryFactory.select(m2.gameId)
            .from(m1)
            .join(m2).on(m2.tagSlug.eq(m1.tagSlug), m2.gameId.ne(gameId))
            .where(m1.gameId.eq(gameId))
            .groupBy(m2.gameId)
            .orderBy(m2.gameId.count().desc())
            .limit(limit.toLong())
            .fetch()
        if (similarIds.isEmpty()) return emptyList()

        val games = queryFactory.selectFrom(game)
            .where(game.id.`in`(similarIds), game.status.eq(GameStatus.PUBLISHED))
            .fetch()
            .associateBy { it.id }
        return similarIds.mapNotNull { games[it] }
    }
}
