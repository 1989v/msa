package com.kgd.order.presentation.opsissue.controller

import com.kgd.common.ops.OpsIssueAdminEndpoints
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 주문 운영 이슈 (ROLE_ADMIN) — DLT · 사가 체류 · 클레임 체류. 재시도는 재발행 또는 재개. 동작과 응답 모양은 [OpsIssueAdminEndpoints] */
@RestController
@RequestMapping("/api/v1/admin/orders/ops-issues")
class OrderOpsIssueAdminController(
    @Qualifier("orderOpsIssueAdmin") useCase: OpsIssueAdminUseCase,
) : OpsIssueAdminEndpoints(useCase)
