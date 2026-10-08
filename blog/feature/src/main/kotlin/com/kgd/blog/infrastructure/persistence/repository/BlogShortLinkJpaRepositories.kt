package com.kgd.blog.infrastructure.persistence.repository

import com.kgd.blog.infrastructure.persistence.entity.BlogShortLinkClickJpaEntity
import com.kgd.blog.infrastructure.persistence.entity.BlogShortLinkStatJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.LocalDateTime

interface BlogShortLinkClickJpaRepository : JpaRepository<BlogShortLinkClickJpaEntity, Long> {

    @Modifying
    @Query("DELETE FROM BlogShortLinkClickJpaEntity c WHERE c.clickedAt < :cutoff")
    fun deleteOlderThan(@Param("cutoff") cutoff: LocalDateTime): Int
}

interface BlogShortLinkStatJpaRepository : JpaRepository<BlogShortLinkStatJpaEntity, Long> {

    /** 읽고-더하고-쓰기를 하면 동시 클릭이 서로를 덮는다. 한 문장으로 올린다. */
    @Modifying
    @Query(
        value = """
        INSERT INTO blog_short_link_stat (post_id, click_count) VALUES (:postId, 1)
        ON DUPLICATE KEY UPDATE click_count = click_count + 1
        """,
        nativeQuery = true,
    )
    fun increment(@Param("postId") postId: Long): Int
}
