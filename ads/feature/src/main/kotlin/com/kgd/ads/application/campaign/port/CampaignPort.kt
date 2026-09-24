package com.kgd.ads.application.campaign.port

import com.kgd.ads.domain.campaign.model.Campaign
import java.time.LocalDateTime

interface CampaignPort {
    fun findById(id: Long): Campaign?

    /** 요청 광고주의 캠페인만 — 다른 광고주의 id 면 null. */
    fun findByIdAndAdvertiser(id: Long, advertiserId: Long): Campaign?

    fun findAllByAdvertiser(advertiserId: Long): List<Campaign>

    /** 새 캠페인이면 만들고, 있으면 덮어쓴다. 타기팅 지면·카테고리는 통째로 바꾼다. */
    fun save(campaign: Campaign, now: LocalDateTime): Campaign
}
