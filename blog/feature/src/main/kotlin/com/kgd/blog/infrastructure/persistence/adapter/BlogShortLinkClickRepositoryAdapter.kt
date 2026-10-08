package com.kgd.blog.infrastructure.persistence.adapter

import com.kgd.blog.application.shortlink.port.BlogShortLinkClick
import com.kgd.blog.application.shortlink.port.BlogShortLinkClickRepositoryPort
import com.kgd.blog.infrastructure.persistence.entity.BlogShortLinkClickJpaEntity
import com.kgd.blog.infrastructure.persistence.repository.BlogShortLinkClickJpaRepository
import com.kgd.blog.infrastructure.persistence.repository.BlogShortLinkStatJpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
class BlogShortLinkClickRepositoryAdapter(
    private val clickRepository: BlogShortLinkClickJpaRepository,
    private val statRepository: BlogShortLinkStatJpaRepository,
) : BlogShortLinkClickRepositoryPort {

    override fun record(click: BlogShortLinkClick) {
        clickRepository.save(
            BlogShortLinkClickJpaEntity(
                postId = click.postId,
                clickedAt = click.clickedAt,
                referrerHost = click.referrerHost,
                uaFamily = click.uaFamily,
            ),
        )
        statRepository.increment(click.postId)
    }

    override fun purgeOlderThan(cutoff: LocalDateTime): Int = clickRepository.deleteOlderThan(cutoff)
}
