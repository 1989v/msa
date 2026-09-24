package com.kgd.seller.infrastructure.persistence.seller.entity

import com.kgd.seller.domain.seller.model.EncryptedAccount
import com.kgd.seller.domain.seller.model.Seller
import com.kgd.seller.domain.seller.model.SellerStatus
import com.kgd.seller.domain.seller.model.SettlementCycle
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant

/**
 * `seller` 행. 같은 회원의 열린 행(ACTIVE·PENDING·SUSPENDED)이 둘이 되지 않게 DB 가 생성 컬럼
 * `open_member_id` 에 유니크 제약을 건다 — 엔티티는 그 컬럼을 매핑하지 않는다(DB 가 계산).
 */
@Entity
@Table(name = "seller")
class SellerJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false, length = 64)
    val memberId: String,

    @Column(nullable = false, length = 100)
    val businessName: String,

    @Column(nullable = false)
    val shippingFee: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val settlementCycle: SettlementCycle,

    @Column(nullable = false)
    val appliedAt: Instant,
) {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: SellerStatus = SellerStatus.PENDING
        private set

    @Column(length = 20)
    var businessRegistrationNo: String? = null
        private set

    @Column(length = 50)
    var representativeName: String? = null
        private set

    @Column(length = 50)
    var bankName: String? = null
        private set

    @Column(name = "account_number_enc", length = 255)
    var accountNumberEnc: String? = null
        private set

    @Column(name = "account_number_masked", length = 40)
    var accountNumberMasked: String? = null
        private set

    @Column(name = "account_key_version")
    var accountKeyVersion: Int? = null
        private set

    @Column(name = "commission_rate_bp")
    var commissionRateBp: Int? = null
        private set

    @Column(length = 500)
    var rejectReason: String? = null
        private set

    var rejectedAt: Instant? = null
        private set

    @Column(name = "pii_purged_at")
    var piiPurgedAt: Instant? = null
        private set

    @Column(nullable = false)
    var updatedAt: Instant = appliedAt
        private set

    @Version
    @Column(nullable = false)
    var version: Long = 0
        private set

    /** 도메인 상태 → 가변 컬럼 전체 동기화 (불변 컬럼은 생성 때 한 번만 쓴다) */
    fun syncFrom(seller: Seller) {
        status = seller.status
        businessRegistrationNo = seller.businessRegistrationNo
        representativeName = seller.representativeName
        bankName = seller.bankName
        accountNumberEnc = seller.encryptedAccount?.cipherText
        accountKeyVersion = seller.encryptedAccount?.keyVersion
        accountNumberMasked = seller.accountMasked
        commissionRateBp = seller.commissionRateBp
        rejectReason = seller.rejectReason
        rejectedAt = seller.rejectedAt
        piiPurgedAt = seller.piiPurgedAt
        updatedAt = seller.updatedAt
    }

    fun toDomain(): Seller = Seller.restore(
        id = requireNotNull(id),
        memberId = memberId,
        businessName = businessName,
        businessRegistrationNo = businessRegistrationNo,
        representativeName = representativeName,
        bankName = bankName,
        encryptedAccount = accountNumberEnc?.let { EncryptedAccount(it, requireNotNull(accountKeyVersion)) },
        accountMasked = accountNumberMasked,
        shippingFee = shippingFee,
        settlementCycle = settlementCycle,
        commissionRateBp = commissionRateBp,
        status = status,
        rejectReason = rejectReason,
        rejectedAt = rejectedAt,
        piiPurgedAt = piiPurgedAt,
        appliedAt = appliedAt,
        updatedAt = updatedAt,
    )

    companion object {
        fun newFrom(seller: Seller): SellerJpaEntity = SellerJpaEntity(
            memberId = seller.memberId,
            businessName = seller.businessName,
            shippingFee = seller.shippingFee,
            settlementCycle = seller.settlementCycle,
            appliedAt = seller.appliedAt,
        ).also { it.syncFrom(seller) }
    }
}
