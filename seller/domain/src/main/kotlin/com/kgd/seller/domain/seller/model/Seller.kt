package com.kgd.seller.domain.seller.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.seller.domain.seller.exception.InvalidSellerStateException
import com.kgd.seller.domain.seller.exception.SellerAlreadyExistsException
import com.kgd.seller.domain.seller.exception.SellerNotActiveException
import java.time.Duration
import java.time.Instant

/**
 * 판매자 신청·등록 한 건. 반려된 신청은 종착이고 재신청은 새 행이다.
 *
 * 상태 전이는 이 클래스의 메서드로만 일어난다. 개인정보(상호·사업자번호·대표자·계좌)는 반려 후
 * [REJECTED_PII_RETENTION] 이 지나면 [purgePersonalData] 로 지운다 — id·상태·사유·시각만 이력으로 남긴다.
 */
class Seller private constructor(
    val id: Long?,
    val memberId: String,
    businessName: String,
    businessRegistrationNo: String?,
    representativeName: String?,
    bankName: String?,
    encryptedAccount: EncryptedAccount?,
    accountMasked: String?,
    val shippingFee: Long,
    val settlementCycle: SettlementCycle,
    commissionRateBp: Int?,
    status: SellerStatus,
    rejectReason: String?,
    rejectedAt: Instant?,
    piiPurgedAt: Instant?,
    val appliedAt: Instant,
    updatedAt: Instant,
) {
    var businessName: String = businessName; private set
    var businessRegistrationNo: String? = businessRegistrationNo; private set
    var representativeName: String? = representativeName; private set
    var bankName: String? = bankName; private set
    var encryptedAccount: EncryptedAccount? = encryptedAccount; private set
    var accountMasked: String? = accountMasked; private set
    var commissionRateBp: Int? = commissionRateBp; private set
    var status: SellerStatus = status; private set
    var rejectReason: String? = rejectReason; private set
    var rejectedAt: Instant? = rejectedAt; private set
    var piiPurgedAt: Instant? = piiPurgedAt; private set
    var updatedAt: Instant = updatedAt; private set

    fun approve(commissionRateBp: Int, now: Instant) {
        requireCommission(commissionRateBp)
        transition(SellerStatus.ACTIVE, "approve", from = SellerStatus.PENDING, now = now)
        this.commissionRateBp = commissionRateBp
    }

    fun reject(reason: String, now: Instant) {
        requireReason(reason)
        transition(SellerStatus.REJECTED, "reject", from = SellerStatus.PENDING, now = now)
        rejectReason = reason
        rejectedAt = now
    }

    fun suspend(reason: String, now: Instant) {
        requireReason(reason)
        transition(SellerStatus.SUSPENDED, "suspend", from = SellerStatus.ACTIVE, now = now)
    }

    fun reactivate(now: Instant) {
        transition(SellerStatus.ACTIVE, "reactivate", from = SellerStatus.SUSPENDED, now = now)
    }

    /** 수수료율은 등록된 판매자(ACTIVE·SUSPENDED)만 바꾼다 — 승인 전에는 승인이 정한다 */
    fun changeCommission(commissionRateBp: Int, now: Instant) {
        if (status != SellerStatus.ACTIVE && status != SellerStatus.SUSPENDED) {
            throw InvalidSellerStateException(status, "changeCommission")
        }
        requireCommission(commissionRateBp)
        this.commissionRateBp = commissionRateBp
        updatedAt = now
    }

    fun ensureActive() {
        if (status != SellerStatus.ACTIVE) throw SellerNotActiveException(status)
    }

    /** @return 이번 호출로 지웠으면 true. 반려가 아니거나 기한 전이거나 이미 지웠으면 false */
    fun purgePersonalData(now: Instant): Boolean {
        val rejected = rejectedAt ?: return false
        if (status != SellerStatus.REJECTED || piiPurgedAt != null) return false
        if (now.isBefore(rejected.plus(REJECTED_PII_RETENTION))) return false
        // 개인사업자 상호는 대표자 이름을 담는 일이 많다 — 개인정보로 보고 함께 지운다(컬럼은 NOT NULL 이라 표지로 덮는다)
        businessName = PURGED_BUSINESS_NAME
        businessRegistrationNo = null
        representativeName = null
        bankName = null
        encryptedAccount = null
        accountMasked = null
        piiPurgedAt = now
        updatedAt = now
        return true
    }

    private fun transition(target: SellerStatus, action: String, from: SellerStatus, now: Instant) {
        // 같은 목표 상태로 가는 길이 둘(approve·reactivate)이라 출발 상태까지 본다
        if (status != from || !status.canTransitionTo(target)) throw InvalidSellerStateException(status, action)
        status = target
        updatedAt = now
    }

    companion object {
        /** 반려 신청의 개인정보 보존 기한 */
        val REJECTED_PII_RETENTION: Duration = Duration.ofDays(30)

        /** 파기된 상호 자리에 남기는 표지 */
        const val PURGED_BUSINESS_NAME = "[파기]"

        private const val MAX_BP = 10_000
        private val BRN = Regex("^\\d{10}$")

        /** 1인 1판매자 — [existing] 은 그 회원의 모든 판매자 행 */
        fun ensureMemberCanApply(existing: List<Seller>) {
            existing.firstOrNull { it.status.occupiesMember }?.let { throw SellerAlreadyExistsException(it.memberId) }
        }

        fun apply(
            memberId: String,
            businessName: String,
            businessRegistrationNo: String,
            representativeName: String,
            bankName: String,
            accountNumber: AccountNumber,
            encryptedAccount: EncryptedAccount,
            shippingFee: Long,
            settlementCycle: SettlementCycle,
            now: Instant,
        ): Seller {
            val brn = businessRegistrationNo.replace("-", "").trim()
            if (!BRN.matches(brn)) throw BusinessException(ErrorCode.INVALID_INPUT, "사업자등록번호는 숫자 10자리입니다")
            if (shippingFee < 0) throw BusinessException(ErrorCode.INVALID_INPUT, "배송비는 0 이상입니다")
            listOf(memberId, businessName, representativeName, bankName).forEach {
                if (it.isBlank()) throw BusinessException(ErrorCode.INVALID_INPUT, "필수 항목이 비어 있습니다")
            }
            return Seller(
                id = null,
                memberId = memberId,
                businessName = businessName.trim(),
                businessRegistrationNo = brn,
                representativeName = representativeName.trim(),
                bankName = bankName.trim(),
                encryptedAccount = encryptedAccount,
                accountMasked = accountNumber.masked(),
                shippingFee = shippingFee,
                settlementCycle = settlementCycle,
                commissionRateBp = null,
                status = SellerStatus.PENDING,
                rejectReason = null,
                rejectedAt = null,
                piiPurgedAt = null,
                appliedAt = now,
                updatedAt = now,
            )
        }

        fun restore(
            id: Long,
            memberId: String,
            businessName: String,
            businessRegistrationNo: String?,
            representativeName: String?,
            bankName: String?,
            encryptedAccount: EncryptedAccount?,
            accountMasked: String?,
            shippingFee: Long,
            settlementCycle: SettlementCycle,
            commissionRateBp: Int?,
            status: SellerStatus,
            rejectReason: String?,
            rejectedAt: Instant?,
            piiPurgedAt: Instant?,
            appliedAt: Instant,
            updatedAt: Instant,
        ): Seller = Seller(
            id, memberId, businessName, businessRegistrationNo, representativeName, bankName, encryptedAccount,
            accountMasked, shippingFee, settlementCycle, commissionRateBp, status, rejectReason, rejectedAt,
            piiPurgedAt, appliedAt, updatedAt,
        )

        private fun requireCommission(bp: Int) {
            if (bp !in 0..MAX_BP) throw BusinessException(ErrorCode.INVALID_INPUT, "수수료율은 0~$MAX_BP bp 입니다")
        }

        private fun requireReason(reason: String) {
            if (reason.isBlank()) throw BusinessException(ErrorCode.INVALID_INPUT, "사유가 필요합니다")
        }
    }
}
