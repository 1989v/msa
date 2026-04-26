package com.kgd.sevensplit.application.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId

/**
 * 지정한 `tenantId + strategyId` 조합으로 전략을 찾지 못했을 때.
 *
 * - INV-05 테넌트 격리: 다른 테넌트의 전략은 "없음" 으로 취급한다.
 * - `BusinessException` 을 상속해 `GlobalExceptionHandler` 가 404 매핑하도록 한다.
 */
class StrategyNotFoundException(
    val strategyId: StrategyId,
    val tenantId: TenantId
) : BusinessException(
    errorCode = ErrorCode.NOT_FOUND,
    message = "SplitStrategy 를 찾을 수 없습니다 (tenantId=$tenantId, strategyId=$strategyId)"
)
