package com.kgd.game.infrastructure.persistence.catalog.repository

import com.kgd.game.infrastructure.persistence.catalog.entity.GameCollectionJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameStatsJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameTagJpaEntity
import com.kgd.game.infrastructure.persistence.catalog.entity.GameTagMapJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface GameJpaRepository : JpaRepository<GameJpaEntity, Long> {
    fun findBySlug(slug: String): GameJpaEntity?
    fun existsBySlug(slug: String): Boolean
}

interface GameTagJpaRepository : JpaRepository<GameTagJpaEntity, Long> {
    fun findAllByOrderByDisplayOrderAsc(): List<GameTagJpaEntity>
}

interface GameTagMapJpaRepository : JpaRepository<GameTagMapJpaEntity, Long> {
    /**
     * 태그 교체용 벌크 삭제. 파생 delete(`deleteByGameId`)는 Hibernate 가 DELETE 를 커밋 시점까지
     * 미뤄 같은 트랜잭션의 INSERT 가 먼저 나가고 `uk_game_tag` 를 위반한다 — 즉시 실행되는
     * JPQL 벌크 삭제로 순서를 강제한다.
     */
    @Modifying(flushAutomatically = true)
    @Query("delete from GameTagMapJpaEntity m where m.gameId = :gameId")
    fun deleteAllByGameId(gameId: Long)
}

interface GameStatsJpaRepository : JpaRepository<GameStatsJpaEntity, Long> {
    /** 주간 트렌딩 리셋 — 스케줄러 전용 벌크 업데이트 */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update GameStatsJpaEntity s set s.weeklyPlayCount = 0 where s.weeklyPlayCount > 0")
    fun resetAllWeekly(): Int
}

interface GameCollectionJpaRepository : JpaRepository<GameCollectionJpaEntity, Long> {
    fun findBySlug(slug: String): GameCollectionJpaEntity?
    fun findByActiveTrueOrderByDisplayOrderAsc(): List<GameCollectionJpaEntity>
}
