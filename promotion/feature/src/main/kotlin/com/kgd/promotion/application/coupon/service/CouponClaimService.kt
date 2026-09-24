package com.kgd.promotion.application.coupon.service

import com.kgd.common.exception.NotFoundException
import com.kgd.promotion.application.coupon.port.CouponDefinitionRepositoryPort
import com.kgd.promotion.application.coupon.port.CouponEventPort
import com.kgd.promotion.application.coupon.port.UserCouponRepositoryPort
import com.kgd.promotion.application.coupon.usecase.ClaimCouponUseCase
import com.kgd.promotion.application.coupon.usecase.GetMyCouponsUseCase
import com.kgd.promotion.application.coupon.usecase.MyCouponView
import com.kgd.promotion.domain.coupon.exception.CouponAlreadyIssuedException
import com.kgd.promotion.domain.coupon.exception.CouponNotClaimableException
import com.kgd.promotion.domain.coupon.exception.CouponSoldOutException
import com.kgd.promotion.domain.coupon.model.UserCoupon
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock

/**
 * 쿠폰 발급과 내 쿠폰 조회.
 *
 * 발급은 한 트랜잭션: 발행 수 조건부 UPDATE → 사용자 쿠폰 INSERT. INSERT 가 유니크(회원·정의)에 걸리면
 * 예외로 끝나 UPDATE 도 함께 되돌아간다 — 같은 회원의 동시 요청이 발행 수를 두 번 먹지 않는다.
 */
@Service
class CouponClaimService(
    private val definitions: CouponDefinitionRepositoryPort,
    private val userCoupons: UserCouponRepositoryPort,
    private val events: CouponEventPort,
    @Qualifier("promotionClock") private val clock: Clock,
) : ClaimCouponUseCase, GetMyCouponsUseCase {

    @Transactional("promotionTransactionManager")
    override fun claim(memberId: String, couponDefinitionId: Long): MyCouponView {
        val now = clock.instant()
        val definition = definitions.findById(couponDefinitionId) ?: throw NotFoundException("CouponDefinition", couponDefinitionId)
        if (!definition.isValidAt(now)) throw CouponNotClaimableException(couponDefinitionId)
        if (userCoupons.existsByMemberIdAndDefinitionId(memberId, couponDefinitionId)) {
            throw CouponAlreadyIssuedException(couponDefinitionId)
        }
        if (!definitions.tryIncrementIssued(couponDefinitionId)) throw CouponSoldOutException(couponDefinitionId)
        val issued = userCoupons.create(UserCoupon.issue(memberId, couponDefinitionId, now))
        events.issued(issued)
        return MyCouponView.of(issued, definition, now)
    }

    @Transactional("promotionTransactionManager", readOnly = true)
    override fun list(memberId: String): List<MyCouponView> {
        val now = clock.instant()
        val coupons = userCoupons.findAllByMemberId(memberId)
        val defs = definitions.findAllByIdIn(coupons.map { it.couponDefinitionId }.toSet()).associateBy { requireNotNull(it.id) }
        return coupons.mapNotNull { c -> defs[c.couponDefinitionId]?.let { MyCouponView.of(c, it, now) } }
    }
}
