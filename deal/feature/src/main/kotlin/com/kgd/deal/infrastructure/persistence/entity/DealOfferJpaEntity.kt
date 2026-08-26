package com.kgd.deal.infrastructure.persistence.entity

import com.kgd.deal.domain.model.DisplayStatus
import com.kgd.deal.domain.model.LinkStatus
import com.kgd.deal.domain.model.Offer
import com.kgd.deal.domain.model.RevenueType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

/**
 * 혜택 링크 (ADR-0069).
 *
 * 필드가 두 겹이다. [update] 가 다루는 **편집 대상**(어드민이 입력하는 값)과,
 * 운영 중 시스템이 갱신하는 **관측값**([clickCount] / [linkStatus] …)이 분리돼 있다.
 * 관측값을 전체 동기화에 섞으면 어드민 저장 한 번이 클릭 수를 되돌린다
 * (docs/conventions/entity-mutation.md).
 */
@Entity
@Table(name = "deal_offer")
class DealOfferJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 60, unique = true)
    val slug: String = "",

    categoryId: Long = 0,
    merchant: String = "",
    title: String = "",
    benefit: String = "",
    summary: String? = null,
    targetUrl: String = "",
    revenueType: RevenueType = RevenueType.PLAIN,
    network: String? = null,
    status: DisplayStatus = DisplayStatus.PREOPEN,
    validFrom: LocalDateTime? = null,
    validUntil: LocalDateTime? = null,
    orderNo: Int = 0,
) {
    @Column(name = "category_id", nullable = false)
    var categoryId: Long = categoryId
        private set

    @Column(nullable = false, length = 60)
    var merchant: String = merchant
        private set

    @Column(nullable = false, length = 120)
    var title: String = title
        private set

    @Column(nullable = false, length = 80)
    var benefit: String = benefit
        private set

    @Column(length = 300)
    var summary: String? = summary
        private set

    @Column(name = "target_url", nullable = false, length = 1000)
    var targetUrl: String = targetUrl
        private set

    @Enumerated(EnumType.STRING)
    @Column(name = "revenue_type", nullable = false, length = 16)
    var revenueType: RevenueType = revenueType
        private set

    @Column(length = 40)
    var network: String? = network
        private set

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    var status: DisplayStatus = status
        private set

    @Column(name = "valid_from")
    var validFrom: LocalDateTime? = validFrom
        private set

    @Column(name = "valid_until")
    var validUntil: LocalDateTime? = validUntil
        private set

    @Column(name = "order_no", nullable = false)
    var orderNo: Int = orderNo
        private set

    // ─── 관측값 — 어드민 편집 대상이 아니다 ───

    @Column(name = "click_count", nullable = false)
    var clickCount: Long = 0
        private set

    @Enumerated(EnumType.STRING)
    @Column(name = "link_status", nullable = false, length = 16)
    var linkStatus: LinkStatus = LinkStatus.UNKNOWN
        private set

    @Column(name = "link_status_code")
    var linkStatusCode: Int? = null
        private set

    @Column(name = "link_checked_at")
    var linkCheckedAt: LocalDateTime? = null
        private set

    @Column(name = "updated_at", insertable = false, updatable = false)
    var updatedAt: LocalDateTime? = null
        private set

    /** 어드민 편집 값의 전체 동기화. 관측값은 건드리지 않는다. */
    fun update(offer: Offer) {
        categoryId = offer.categoryId
        merchant = offer.merchant
        title = offer.title
        benefit = offer.benefit
        summary = offer.summary
        targetUrl = offer.targetUrl
        revenueType = offer.revenueType
        network = offer.network
        status = offer.status
        validFrom = offer.validFrom
        validUntil = offer.validUntil
        orderNo = offer.orderNo
    }

    /** 헬스체크 결과 반영 (부분 수정) */
    fun recordLinkCheck(status: LinkStatus, statusCode: Int?, checkedAt: LocalDateTime) {
        linkStatus = status
        linkStatusCode = statusCode
        linkCheckedAt = checkedAt
    }

    fun toDomain() = Offer(
        id = id,
        slug = slug,
        categoryId = categoryId,
        merchant = merchant,
        title = title,
        benefit = benefit,
        summary = summary,
        targetUrl = targetUrl,
        revenueType = revenueType,
        network = network,
        status = status,
        validFrom = validFrom,
        validUntil = validUntil,
        orderNo = orderNo,
        clickCount = clickCount,
        linkStatus = linkStatus,
        linkStatusCode = linkStatusCode,
        linkCheckedAt = linkCheckedAt,
        updatedAt = updatedAt,
    )

    companion object {
        fun fromDomain(offer: Offer) = DealOfferJpaEntity(
            id = offer.id,
            slug = offer.slug,
            categoryId = offer.categoryId,
            merchant = offer.merchant,
            title = offer.title,
            benefit = offer.benefit,
            summary = offer.summary,
            targetUrl = offer.targetUrl,
            revenueType = offer.revenueType,
            network = offer.network,
            status = offer.status,
            validFrom = offer.validFrom,
            validUntil = offer.validUntil,
            orderNo = offer.orderNo,
        )
    }
}
