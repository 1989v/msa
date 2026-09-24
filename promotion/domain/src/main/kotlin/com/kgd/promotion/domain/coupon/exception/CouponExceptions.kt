package com.kgd.promotion.domain.coupon.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.promotion.domain.coupon.model.UserCouponStatus

/** 사용자 쿠폰 상태 전이 위반 — 이미 쓴 쿠폰을 다시 보류하는 것 등 */
class InvalidCouponStateException(current: UserCouponStatus, action: String) :
    BusinessException(ErrorCode.INVALID_PROMOTION_STATUS, "쿠폰 상태 전이 불가: $current → $action")

/** 발행 상한에 닿았다 — 조건부 UPDATE 가 0행을 바꿨다 */
class CouponSoldOutException(definitionId: Long) :
    BusinessException(ErrorCode.COUPON_SOLD_OUT, "쿠폰 발행 수량이 소진됐습니다 (definitionId=$definitionId)")

/** 한 회원은 한 쿠폰 정의를 한 번만 받는다 */
class CouponAlreadyIssuedException(definitionId: Long) :
    BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 받은 쿠폰입니다 (definitionId=$definitionId)")

/** 비활성이거나 기간 밖인 정의는 발급하지 않는다 */
class CouponNotClaimableException(definitionId: Long) :
    BusinessException(ErrorCode.INVALID_PROMOTION_STATUS, "지금 받을 수 없는 쿠폰입니다 (definitionId=$definitionId)")
