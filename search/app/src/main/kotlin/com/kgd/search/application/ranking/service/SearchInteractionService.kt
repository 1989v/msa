package com.kgd.search.application.ranking.service

import com.kgd.search.application.ranking.usecase.RecordSearchInteractionUseCase
import com.kgd.search.domain.bandit.model.ClickEvent
import com.kgd.search.domain.bandit.model.ImpressionEvent
import com.kgd.search.domain.bandit.port.BanditEventPort
import org.springframework.stereotype.Service

@Service
class SearchInteractionService(
    private val banditEventPort: BanditEventPort,
) : RecordSearchInteractionUseCase {

    override fun recordImpressions(events: List<ImpressionEvent>) =
        events.forEach(banditEventPort::recordImpression)

    override fun recordClick(event: ClickEvent) = banditEventPort.recordClick(event)
}
