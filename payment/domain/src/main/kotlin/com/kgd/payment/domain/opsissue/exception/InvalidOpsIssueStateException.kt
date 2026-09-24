package com.kgd.payment.domain.opsissue.exception

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.payment.domain.opsissue.model.OpsIssueStatus

class InvalidOpsIssueStateException(current: OpsIssueStatus, action: String) :
    BusinessException(ErrorCode.INVALID_OPS_ISSUE_STATUS, "운영 이슈 상태 전이 불가: $current → $action")
