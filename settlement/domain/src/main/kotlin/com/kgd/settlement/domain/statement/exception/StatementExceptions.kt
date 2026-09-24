package com.kgd.settlement.domain.statement.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.settlement.domain.statement.model.StatementStatus

class InvalidStatementStateException(current: StatementStatus, action: String) :
    BusinessException(ErrorCode.INVALID_SETTLEMENT_STATUS, "정산서 상태 전이 불가: $current → $action")

class InvalidSettlementItemException(message: String) : BusinessException(ErrorCode.INVALID_INPUT, message)
