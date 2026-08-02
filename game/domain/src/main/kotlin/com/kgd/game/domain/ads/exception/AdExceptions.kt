package com.kgd.game.domain.ads.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

class PlacementNotFoundException(placementKey: String) :
    BusinessException(ErrorCode.NOT_FOUND, "광고 슬롯(placementKey=$placementKey)을 찾을 수 없습니다")

class RewardNotFoundException(idempotencyKey: String) :
    BusinessException(ErrorCode.NOT_FOUND, "보상(idempotencyKey=$idempotencyKey)을 찾을 수 없습니다")

class RewardAlreadySettledException(idempotencyKey: String, status: String) :
    BusinessException(ErrorCode.INVALID_INPUT, "이미 $status 처리된 보상입니다: $idempotencyKey")

class AdNotAllowedException(reason: String) :
    BusinessException(ErrorCode.FORBIDDEN, "광고를 노출할 수 없습니다: $reason")
