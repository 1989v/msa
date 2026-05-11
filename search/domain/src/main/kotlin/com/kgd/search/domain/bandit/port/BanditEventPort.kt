package com.kgd.search.domain.bandit.port

import com.kgd.search.domain.bandit.model.ClickEvent
import com.kgd.search.domain.bandit.model.ImpressionEvent

interface BanditEventPort {
    fun recordImpression(event: ImpressionEvent)
    fun recordClick(event: ClickEvent)
}
