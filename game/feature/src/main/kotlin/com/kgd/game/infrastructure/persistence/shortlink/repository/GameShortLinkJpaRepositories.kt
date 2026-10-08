package com.kgd.game.infrastructure.persistence.shortlink.repository

import com.kgd.game.infrastructure.persistence.shortlink.entity.GameShortLinkClickJpaEntity
import com.kgd.game.infrastructure.persistence.shortlink.entity.GameShortLinkStatJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface GameShortLinkClickJpaRepository : JpaRepository<GameShortLinkClickJpaEntity, Long> {

    @Modifying
    @Query("DELETE FROM GameShortLinkClickJpaEntity c WHERE c.clickedAt < :cutoff")
    fun deleteOlderThan(@Param("cutoff") cutoff: LocalDateTime): Int
}

interface GameShortLinkStatJpaRepository : JpaRepository<GameShortLinkStatJpaEntity, Long> {

    /** 읽고-더하고-쓰기를 하면 동시 클릭이 서로를 덮는다. 한 문장으로 올린다. */
    @Modifying
    @Query(
        value = """
        INSERT INTO game_short_link_stat (game_id, click_count) VALUES (:gameId, 1)
        ON DUPLICATE KEY UPDATE click_count = click_count + 1
        """,
        nativeQuery = true,
    )
    fun increment(@Param("gameId") gameId: Long): Int
}
