package com.kgd.seller.presentation.opsissue.controller

import com.kgd.common.ops.OpsIssueAdminEndpoints
import com.kgd.common.ops.usecase.OpsIssueAdminUseCase
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** 판매자 운영 이슈 (ROLE_ADMIN) — 조회 · 재시도 · 종결. 동작과 응답 모양은 [OpsIssueAdminEndpoints] */
@RestController
@RequestMapping("/api/v1/admin/sellers/ops-issues")
class SellerOpsIssueAdminController(
    @Qualifier("sellerOpsIssueAdmin") useCase: OpsIssueAdminUseCase,
) : OpsIssueAdminEndpoints(useCase)
