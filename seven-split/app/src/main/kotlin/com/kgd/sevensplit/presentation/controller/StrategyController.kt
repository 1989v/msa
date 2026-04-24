package com.kgd.sevensplit.presentation.controller

import com.kgd.common.response.ApiResponse
import com.kgd.sevensplit.application.exception.NotImplementedInPhase1Exception
import com.kgd.sevensplit.application.usecase.CreateStrategyUseCase
import com.kgd.sevensplit.application.usecase.GetStrategyDetailQuery
import com.kgd.sevensplit.application.usecase.ListStrategiesQuery
import com.kgd.sevensplit.application.view.StrategyDetailView
import com.kgd.sevensplit.application.view.StrategySummaryView
import com.kgd.sevensplit.domain.common.StrategyId
import com.kgd.sevensplit.domain.common.TenantId
import com.kgd.sevensplit.presentation.dto.CreateStrategyRequest
import com.kgd.sevensplit.presentation.dto.CreateStrategyResponse
import com.kgd.sevensplit.presentation.resolver.TenantHeader
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * StrategyController — 7분할 전략 CRUD Phase 1 엔드포인트.
 *
 * - `POST   /api/v1/strategies`        : 신규 전략 생성.
 * - `GET    /api/v1/strategies`        : 테넌트 범위 전략 목록.
 * - `GET    /api/v1/strategies/{id}`   : 전략 상세.
 * - `PATCH  /api/v1/strategies/{id}`   : Phase 2/3 에서 pause/resume/liquidate — 현재는 501.
 *
 * ## Clean Architecture
 * UseCase 포트에만 의존하고 infrastructure 구현 타입은 참조하지 않는다 (ADR-0014).
 *
 * ## Coroutine
 * Spring MVC 6+ 는 `suspend fun` 컨트롤러 메서드를 지원한다. UseCase 가 `suspend` 이므로
 * 여기서도 suspend 로 유지해 Reactor 브릿지를 피한다.
 *
 * ## Tenant
 * 모든 엔드포인트에 `X-User-Id` 헤더가 필수. 누락 시 resolver 가 400 을 반환.
 */
@RestController
@RequestMapping("/api/v1/strategies")
class StrategyController(
    private val createStrategy: CreateStrategyUseCase,
    private val listStrategies: ListStrategiesQuery,
    private val getStrategyDetail: GetStrategyDetailQuery
) {

    @PostMapping
    suspend fun create(
        @TenantHeader tenantId: TenantId,
        @Valid @RequestBody request: CreateStrategyRequest
    ): ApiResponse<CreateStrategyResponse> {
        val command = request.toCommand(tenantId)
        val id = createStrategy.execute(command)
        return ApiResponse.success(CreateStrategyResponse.from(id))
    }

    @GetMapping
    suspend fun list(
        @TenantHeader tenantId: TenantId
    ): ApiResponse<List<StrategySummaryView>> {
        val views = listStrategies.execute(tenantId)
        return ApiResponse.success(views)
    }

    @GetMapping("/{id}")
    suspend fun detail(
        @TenantHeader tenantId: TenantId,
        @PathVariable id: String
    ): ApiResponse<StrategyDetailView> {
        val strategyId = StrategyId.of(id)
        val view = getStrategyDetail.execute(tenantId, strategyId)
        return ApiResponse.success(view)
    }

    /**
     * lifecycle 변경 (pause/resume/liquidate/파라미터 변경) — Phase 2/3.
     *
     * 요청 형식이 확정되지 않았고 `UpdateStrategyUseCase` 도 미구현이므로 501 로 명확히 거절한다.
     * 클라이언트가 Phase 1 에 이 엔드포인트를 호출하지 않도록 FE 와 계약을 맞춰 둘 필요가 있다.
     */
    @PatchMapping("/{id}")
    suspend fun updateLifecycle(
        @TenantHeader tenantId: TenantId,
        @PathVariable id: String
    ): ApiResponse<Unit> {
        throw NotImplementedInPhase1Exception(
            "PATCH /api/v1/strategies/{id} (lifecycle change) — Phase 2/3"
        )
    }
}
