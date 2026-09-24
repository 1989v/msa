package com.kgd.settlement.presentation.opsissue.controller

import com.kgd.common.ops.OpsIssueAdminEndpoints
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 정산 운영 이슈 (ROLE_ADMIN) — 조회 · 재시도 · 종결. 동작과 응답 모양은 [OpsIssueAdminEndpoints] */
@RestController
@RequestMapping("/api/v1/admin/settlements/ops-issues")
class SettlementOpsIssueAdminController(
    @Qualifier("settlementOpsIssueAdmin") useCase: OpsIssueAdminUseCase,
) : OpsIssueAdminEndpoints(useCase)
