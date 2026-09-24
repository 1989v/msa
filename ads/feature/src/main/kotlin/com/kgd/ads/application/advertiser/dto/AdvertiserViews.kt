package com.kgd.ads.application.advertiser.dto

import com.kgd.ads.domain.advertiser.model.Advertiser
import com.kgd.ads.domain.advertiser.model.AdvertiserKind
import com.kgd.ads.domain.advertiser.model.AdvertiserStatus
import java.time.LocalDateTime

/** 운영자가 보는 광고주 한 줄. */
data class AdvertiserAdminView(
    val id: Long,
    val kind: AdvertiserKind,
    val memberId: Long?,
    val displayName: String,
    val status: AdvertiserStatus,
    val suspendReason: String?,
    val suspendedBy: Long?,
    val suspendedAt: LocalDateTime?,
) {
    companion object {
        fun from(advertiser: Advertiser) = AdvertiserAdminView(
            id = requireNotNull(advertiser.id),
            kind = advertiser.kind,
            memberId = advertiser.memberId,
            displayName = advertiser.displayName,
            status = advertiser.status,
            suspendReason = advertiser.suspension?.reason,
            suspendedBy = advertiser.suspension?.actorMemberId,
            suspendedAt = advertiser.suspension?.at,
        )
    }
}
