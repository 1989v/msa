package com.kgd.ads.application.creative.port

import com.kgd.ads.domain.creative.model.Creative
import com.kgd.ads.domain.creative.model.CreativeStatus
import java.time.LocalDateTime

interface CreativePort {
    fun findById(id: Long): Creative?

    /** 요청 광고주의 소재만 — 다른 광고주의 id 면 null. */
    fun findByIdAndAdvertiser(id: Long, advertiserId: Long): Creative?

    fun findAllByCampaign(campaignId: Long): List<Creative>
    fun findAllByStatus(status: CreativeStatus): List<Creative>

    /** 새 소재면 만들고, 있으면 덮어쓴다. */
    fun save(creative: Creative, now: LocalDateTime): Creative
}
