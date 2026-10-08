package com.kgd.place.infrastructure.persistence.shortlink.repository

import com.kgd.place.infrastructure.persistence.shortlink.entity.AttractionShortLinkClickJpaEntity
import com.kgd.place.infrastructure.persistence.shortlink.entity.AttractionShortLinkStatJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface AttractionShortLinkClickJpaRepository : JpaRepository<AttractionShortLinkClickJpaEntity, Long> {

    @Modifying
    @Query("DELETE FROM AttractionShortLinkClickJpaEntity c WHERE c.clickedAt < :cutoff")
    fun deleteOlderThan(@Param("cutoff") cutoff: LocalDateTime): Int
}

interface AttractionShortLinkStatJpaRepository : JpaRepository<AttractionShortLinkStatJpaEntity, Long> {

    /** 읽고-더하고-쓰기를 하면 동시 클릭이 서로를 덮는다. 한 문장으로 올린다. */
    @Modifying
    @Query(
        value = """
        INSERT INTO attraction_short_link_stat (attraction_id, click_count) VALUES (:attractionId, 1)
        ON DUPLICATE KEY UPDATE click_count = click_count + 1
        """,
        nativeQuery = true,
    )
    fun increment(@Param("attractionId") attractionId: Long): Int
}
