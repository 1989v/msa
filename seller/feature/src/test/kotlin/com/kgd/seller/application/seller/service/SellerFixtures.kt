package com.kgd.seller.application.seller.service

import com.kgd.seller.domain.seller.model.EncryptedAccount
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.domain.seller.model.SettlementCycle
import java.time.Instant

internal val T0: Instant = Instant.parse("2026-09-24T00:00:00Z")

internal fun sellerRow(
    status: SellerStatus,
    id: Long = 10L,
    memberId: String = "7",
    rejectedAt: Instant? = if (status == SellerStatus.REJECTED) T0 else null,
): Seller = Seller.restore(
    id = id,
    memberId = memberId,
    businessName = "상호",
    businessRegistrationNo = "1234567890",
    representativeName = "대표",
    bankName = "은행",
    encryptedAccount = EncryptedAccount("cipher", 1),
    accountMasked = "********6789",
    shippingFee = 3000L,
    settlementCycle = SettlementCycle.WEEKLY,
    commissionRateBp = if (status == SellerStatus.ACTIVE || status == SellerStatus.SUSPENDED) 1000 else null,
    status = status,
    rejectReason = if (status == SellerStatus.REJECTED) "서류 미비" else null,
    rejectedAt = rejectedAt,
    piiPurgedAt = null,
    appliedAt = T0,
    updatedAt = T0,
)
