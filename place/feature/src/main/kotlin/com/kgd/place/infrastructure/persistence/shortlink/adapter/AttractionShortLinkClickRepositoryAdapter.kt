package com.kgd.place.infrastructure.persistence.shortlink.adapter

import com.kgd.place.application.shortlink.port.AttractionShortLinkClick
import com.kgd.place.application.shortlink.port.AttractionShortLinkClickRepositoryPort
import com.kgd.place.infrastructure.persistence.shortlink.entity.AttractionShortLinkClickJpaEntity
import com.kgd.place.infrastructure.persistence.shortlink.repository.AttractionShortLinkClickJpaRepository
import com.kgd.place.infrastructure.persistence.shortlink.repository.AttractionShortLinkStatJpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
class AttractionShortLinkClickRepositoryAdapter(
    private val clickRepository: AttractionShortLinkClickJpaRepository,
    private val statRepository: AttractionShortLinkStatJpaRepository,
) : AttractionShortLinkClickRepositoryPort {

    override fun record(click: AttractionShortLinkClick) {
        clickRepository.save(
            AttractionShortLinkClickJpaEntity(
                attractionId = click.attractionId,
                clickedAt = click.clickedAt,
                referrerHost = click.referrerHost,
                uaFamily = click.uaFamily,
            ),
        )
        statRepository.increment(click.attractionId)
    }

    override fun purgeOlderThan(cutoff: LocalDateTime): Int = clickRepository.deleteOlderThan(cutoff)
}
