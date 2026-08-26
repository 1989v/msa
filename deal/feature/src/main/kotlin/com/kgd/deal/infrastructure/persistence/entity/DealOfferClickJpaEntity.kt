package com.kgd.deal.infrastructure.persistence.entity

import com.kgd.deal.domain.model.OfferClick
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/**
 * 아웃바운드 클릭 1건 (ADR-0069).
 *
 * IP · 전체 referrer · 쿠키는 저장하지 않는다 — 클릭 수를 세는 데 필요 없고, 보관하는 순간
 * 개인정보 처리방침 대상이 된다. referrer 는 **호스트만** 남겨 어느 채널의 공유가 먹혔는지만 본다.
 */
@Entity
@Table(name = "deal_offer_click")
class DealOfferClickJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(name = "offer_id", nullable = false)
    val offerId: Long = 0,

    @Column(name = "clicked_at", nullable = false)
    val clickedAt: LocalDateTime = LocalDateTime.now(),

    @Column(name = "referrer_host", length = 120)
    val referrerHost: String? = null,

    @Column(name = "ua_family", length = 40)
    val uaFamily: String? = null,
) {
    companion object {
        fun fromDomain(click: OfferClick) = DealOfferClickJpaEntity(
            offerId = click.offerId,
            clickedAt = click.clickedAt,
            referrerHost = click.referrerHost,
            uaFamily = click.uaFamily,
        )
    }
}
