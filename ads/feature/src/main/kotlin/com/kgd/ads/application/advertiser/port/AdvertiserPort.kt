package com.kgd.ads.application.advertiser.port

import com.kgd.ads.domain.advertiser.model.Advertiser
import java.time.LocalDateTime

interface AdvertiserPort {
    fun findByMemberId(memberId: Long): Advertiser?
    fun save(advertiser: Advertiser, now: LocalDateTime): Advertiser
}
