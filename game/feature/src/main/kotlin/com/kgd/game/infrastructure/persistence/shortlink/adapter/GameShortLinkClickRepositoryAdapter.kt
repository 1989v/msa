package com.kgd.game.infrastructure.persistence.shortlink.adapter

import com.kgd.game.application.shortlink.port.GameShortLinkClick
import com.kgd.game.application.shortlink.port.GameShortLinkClickRepositoryPort
import com.kgd.game.infrastructure.persistence.shortlink.entity.GameShortLinkClickJpaEntity
import com.kgd.game.infrastructure.persistence.shortlink.repository.GameShortLinkClickJpaRepository
import com.kgd.game.infrastructure.persistence.shortlink.repository.GameShortLinkStatJpaRepository
import org.springframework.stereotype.Repository
import java.time.LocalDateTime

@Repository
class GameShortLinkClickRepositoryAdapter(
    private val clickRepository: GameShortLinkClickJpaRepository,
    private val statRepository: GameShortLinkStatJpaRepository,
) : GameShortLinkClickRepositoryPort {

    override fun record(click: GameShortLinkClick) {
        clickRepository.save(
            GameShortLinkClickJpaEntity(
                gameId = click.gameId,
                clickedAt = click.clickedAt,
                referrerHost = click.referrerHost,
                uaFamily = click.uaFamily,
            ),
        )
        statRepository.increment(click.gameId)
    }

    override fun purgeOlderThan(cutoff: LocalDateTime): Int = clickRepository.deleteOlderThan(cutoff)
}
