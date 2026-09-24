package com.kgd.ads.application.advertiser.port

import com.kgd.ads.domain.advertiser.model.Advertiser
import java.time.LocalDateTime

interface AdvertiserPort {
    fun findByMemberId(memberId: Long): Advertiser?
    fun findById(id: Long): Advertiser?
    fun findAll(): List<Advertiser>

    /** HOUSE 캠페인의 소유자 「1989v 하우스」. 시드가 넣으므로 없으면 스키마가 깨진 것이다. */
    fun findSystem(): Advertiser

    fun save(advertiser: Advertiser, now: LocalDateTime): Advertiser

    /** 상태(정지·해제)와 정지 사유·행위자·시각을 반영한다. */
    fun updateStatus(advertiser: Advertiser, now: LocalDateTime)
}
