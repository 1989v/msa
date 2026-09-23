package com.kgd.ads.domain.creative.model

import com.kgd.ads.domain.campaign.model.Campaign
import com.kgd.ads.domain.campaign.model.CampaignPriority
import com.kgd.ads.domain.creative.exception.InvalidCreativeException
import java.time.LocalDateTime

/**
 * 소재. 게재 자격은 `APPROVED` 하나뿐이다.
 *
 * [revise] 는 내용 교체와 `PENDING` 복귀를 한 번에 한다 — 둘이 따로 있으면 승인된 소재의 내용만
 * 바꿔 심사 없이 게재하는 순서가 생긴다.
 */
class Creative private constructor(
    val id: Long?,
    val campaignId: Long,
    val advertiserId: Long,
    content: CreativeContent,
    status: CreativeStatus,
    rejectReason: CreativeRejectReason?,
    reviewedBy: Long?,
    reviewedAt: LocalDateTime?,
) {
    var content: CreativeContent = content
        private set
    var status: CreativeStatus = status
        private set
    var rejectReason: CreativeRejectReason? = rejectReason
        private set
    var reviewedBy: Long? = reviewedBy
        private set
    var reviewedAt: LocalDateTime? = reviewedAt
        private set

    init {
        require((status == CreativeStatus.REJECTED) == (rejectReason != null)) { "반려 사유는 REJECTED 에만 있습니다" }
    }

    val isServable: Boolean get() = status == CreativeStatus.APPROVED

    fun approve(actorMemberId: Long, at: LocalDateTime) {
        requirePending("승인")
        review(CreativeStatus.APPROVED, null, actorMemberId, at)
    }

    fun reject(reason: CreativeRejectReason, actorMemberId: Long, at: LocalDateTime) {
        requirePending("반려")
        review(CreativeStatus.REJECTED, reason, actorMemberId, at)
    }

    fun revise(content: CreativeContent) {
        if (status == CreativeStatus.ARCHIVED) throw InvalidCreativeException("보관된 소재는 고칠 수 없습니다")
        if (content::class != this.content::class) throw InvalidCreativeException("소재 종류를 바꿀 수 없습니다")
        this.content = content
        status = CreativeStatus.PENDING
        rejectReason = null
        reviewedBy = null
        reviewedAt = null
    }

    fun archive() {
        if (status == CreativeStatus.ARCHIVED) throw InvalidCreativeException("이미 보관된 소재입니다")
        status = CreativeStatus.ARCHIVED
    }

    private fun requirePending(action: String) {
        if (status != CreativeStatus.PENDING) throw InvalidCreativeException("심사 대기 소재만 $action 할 수 있습니다: $status")
    }

    private fun review(to: CreativeStatus, reason: CreativeRejectReason?, actorMemberId: Long, at: LocalDateTime) {
        status = to
        rejectReason = reason
        reviewedBy = actorMemberId
        reviewedAt = at
    }

    companion object {
        /** 유료 캠페인에 소재를 올린다. 심사 전이라 `PENDING`. */
        fun submit(campaign: Campaign, content: PaidCreativeContent): Creative {
            if (campaign.priority != CampaignPriority.PAID) throw InvalidCreativeException("유료 소재는 유료 캠페인에만 올립니다")
            return Creative(
                id = null,
                campaignId = requireNotNull(campaign.id) { "저장되지 않은 캠페인" },
                advertiserId = campaign.advertiserId,
                content = content,
                status = CreativeStatus.PENDING,
                rejectReason = null,
                reviewedBy = null,
                reviewedAt = null,
            )
        }

        /** 운영자가 만드는 HOUSE 소재. 만든 운영자가 곧 심사자라 `APPROVED` 로 시작한다. */
        fun createHouse(campaign: Campaign, content: HouseCreativeContent, actorMemberId: Long, at: LocalDateTime): Creative {
            if (campaign.priority != CampaignPriority.HOUSE) throw InvalidCreativeException("HOUSE 소재는 HOUSE 캠페인에만 올립니다")
            return Creative(
                id = null,
                campaignId = requireNotNull(campaign.id) { "저장되지 않은 캠페인" },
                advertiserId = campaign.advertiserId,
                content = content,
                status = CreativeStatus.APPROVED,
                rejectReason = null,
                reviewedBy = actorMemberId,
                reviewedAt = at,
            )
        }

        fun restore(
            id: Long,
            campaignId: Long,
            advertiserId: Long,
            content: CreativeContent,
            status: CreativeStatus,
            rejectReason: CreativeRejectReason?,
            reviewedBy: Long?,
            reviewedAt: LocalDateTime?,
        ): Creative = Creative(id, campaignId, advertiserId, content, status, rejectReason, reviewedBy, reviewedAt)
    }
}
