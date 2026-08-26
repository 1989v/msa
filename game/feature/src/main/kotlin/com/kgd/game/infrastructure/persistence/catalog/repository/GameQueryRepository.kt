package com.kgd.game.infrastructure.persistence.catalog.repository

import com.kgd.game.application.catalog.port.GameSearchCriteria
import com.kgd.game.application.catalog.dto.GameSort
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

/**
 * 카탈로그 목록/유사 게임 조회 — 무거운 조회는 Querydsl QueryRepository (jpa-persistence.md §5).
 * 공개 리스트와 어드민 리스트가 같은 쿼리를 쓰고 [GameSearchCriteria.statuses] 로만 갈린다.
 */
@Repository
class GameQueryRepository(
    @Qualifier("gameJpaQueryFactory") private val queryFactory: JPAQueryFactory,
) {
    private val game = QGameJpaEntity.gameJpaEntity
    private val stats = QGameStatsJpaEntity.gameStatsJpaEntity

    fun search(criteria: GameSearchCriteria, pageable: Pageable): Page<GameJpaEntity> {
        val condition = BooleanBuilder()
        if (criteria.statuses.isNotEmpty()) condition.and(game.status.`in`(criteria.statuses))
        criteria.genre?.let { condition.and(game.genre.eq(it)) }
        criteria.q?.takeIf { it.isNotBlank() }?.let { keyword ->
            condition.and(
                game.slug.containsIgnoreCase(keyword)
                    .or(game.title.containsIgnoreCase(keyword))
                    .or(game.titleEn.containsIgnoreCase(keyword))
            )
        }
        if (!criteria.tag.isNullOrBlank()) {
            val tagMap = QGameTagMapJpaEntity.gameTagMapJpaEntity
            condition.and(
                JPAExpressions.selectOne()
                    .from(tagMap)
                    .where(tagMap.gameId.eq(game.id), tagMap.tagSlug.eq(criteria.tag))
                    .exists()
            )
        }

        val query = queryFactory.selectFrom(game)
            .leftJoin(stats).on(stats.gameId.eq(game.id))
            .where(condition)

        val ordered = when (criteria.sort) {
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
            GameSort.CREATED -> query.orderBy(game.createdAt.desc(), game.id.desc())
            GameSort.UPDATED -> query.orderBy(game.updatedAt.desc(), game.id.desc())
            GameSort.TITLE -> query.orderBy(game.title.asc(), game.id.asc())
            GameSort.PLAY_COUNT -> query.orderBy(stats.playCount.coalesce(0L).desc(), game.id.desc())
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
