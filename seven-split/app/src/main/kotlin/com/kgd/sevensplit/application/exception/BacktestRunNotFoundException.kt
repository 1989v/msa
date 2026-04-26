package com.kgd.sevensplit.application.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.sevensplit.domain.common.RunId
import com.kgd.sevensplit.domain.common.TenantId

/**
 * 지정한 `tenantId + runId` 조합으로 백테스트 실행을 찾지 못했을 때.
 *
 * - INV-05 테넌트 격리: 다른 테넌트의 run 은 "없음" 으로 취급한다.
 * - BacktestRunRepositoryPort (ClickHouse) 가 비어있거나 MySQL strategy_run 에만 존재해도 발생.
 */
class BacktestRunNotFoundException(
    val runId: RunId,
    val tenantId: TenantId
) : BusinessException(
    errorCode = ErrorCode.NOT_FOUND,
    message = "BacktestRun 을 찾을 수 없습니다 (tenantId=$tenantId, runId=$runId)"
)
