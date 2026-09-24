package com.kgd.seller.domain.seller.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.seller.domain.seller.model.SellerStatus

class InvalidSellerStateException(current: SellerStatus, action: String) :
    BusinessException(ErrorCode.INVALID_SELLER_STATUS, "판매자 상태 전이 불가: $current → $action")

/** 한 회원은 ACTIVE·PENDING·SUSPENDED 판매자 행을 하나만 가진다 */
class SellerAlreadyExistsException(memberId: String) :
    BusinessException(ErrorCode.DUPLICATE_RESOURCE, "이미 판매자 신청 또는 등록이 있습니다 (member=$memberId)")

/** 판매자 API 는 매 요청 ACTIVE 판매자 행을 요구한다 — 정지·대기·반려는 토큰이 유효해도 거부 */
class SellerNotActiveException(status: SellerStatus?) :
    BusinessException(ErrorCode.FORBIDDEN, "활성 판매자가 아닙니다 (status=${status ?: "NONE"})")
