package com.kgd.quant.presentation.paper

import com.kgd.common.response.ApiResponse
import com.kgd.quant.application.paper.query.GetPaperStatusQuery
import com.kgd.quant.application.paper.query.PaperStatusView
import com.kgd.quant.application.paper.usecase.PausePaperTradingCommand
import com.kgd.quant.application.paper.usecase.PausePaperTradingUseCase
import com.kgd.quant.application.paper.usecase.ResumePaperTradingCommand
import com.kgd.quant.application.paper.usecase.ResumePaperTradingUseCase
import com.kgd.quant.application.paper.usecase.StartPaperTradingCommand
import com.kgd.quant.application.paper.usecase.StartPaperTradingUseCase
import com.kgd.quant.application.paper.usecase.StopPaperTradingCommand
import com.kgd.quant.application.paper.usecase.StopPaperTradingUseCase
import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.strategy.EndReason
import com.kgd.quant.presentation.resolver.TenantHeader
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.math.BigDecimal

/**
 * PaperTradingController — TG-P2-13 PAPER 모드 REST 엔드포인트.
 *
 * ## 엔드포인트
 * - `POST /api/v1/strategies/{strategyId}/start-paper`
 * - `GET  /api/v1/strategies/{strategyId}/paper/status`
 * - `POST /api/v1/strategies/{strategyId}/paper/pause`
 * - `POST /api/v1/strategies/{strategyId}/paper/resume`
 * - `POST /api/v1/strategies/{strategyId}/paper/stop`
 *
 * SSE 엔드포인트는 [PaperStreamSseController] 참조 (별도 컨트롤러 — produces 타입과 응답 contract 가
 * 다르므로 ApiResponse 래핑 정책을 분리한다).
 *
 * ## 인증
 * Gateway 가 JWT 검증 후 `X-User-Id` 헤더를 신뢰값으로 주입한다. 본 컨트롤러는 [TenantHeader]
 * 로 헤더만 신뢰하며 JWT 파싱을 중복 수행하지 않는다 (TenantIdHeaderArgumentResolver KDoc 참조).
 *
 * ## ApiResponse 래퍼
 * 모든 REST 응답은 `ApiResponse<T>` 로 래핑한다 (`docs/architecture/api-response.md`).
 *
 * ## 트랜잭션 (ADR-0020)
 * 컨트롤러에 `@Transactional` 금지. 트랜잭션은 UseCase / Repository 어댑터 경계에서 관리.
 */
@RestController
@RequestMapping("/api/v1/strategies")
class PaperTradingController(
    private val startUseCase: StartPaperTradingUseCase,
    private val stopUseCase: StopPaperTradingUseCase,
    private val pauseUseCase: PausePaperTradingUseCase,
    private val resumeUseCase: ResumePaperTradingUseCase,
    private val statusQuery: GetPaperStatusQuery,
) {

    @PostMapping("/{strategyId}/start-paper")
    suspend fun startPaper(
        @TenantHeader tenantId: TenantId,
        @PathVariable strategyId: String,
        @RequestBody(required = false) request: StartPaperRequest?,
    ): ApiResponse<StartPaperResponse> {
        val sid = StrategyId.of(strategyId)
        val runId = startUseCase.execute(
            StartPaperTradingCommand(
                tenantId = tenantId,
                strategyId = sid,
                initialBalance = request?.initialBalance,
            )
        )
        return ApiResponse.success(StartPaperResponse(runId = runId.value.toString()))
    }

    @GetMapping("/{strategyId}/paper/status")
    suspend fun status(
        @TenantHeader tenantId: TenantId,
        @PathVariable strategyId: String,
    ): ApiResponse<PaperStatusView> {
        val sid = StrategyId.of(strategyId)
        return ApiResponse.success(statusQuery.execute(tenantId, sid))
    }

    @PostMapping("/{strategyId}/paper/pause")
    suspend fun pause(
        @TenantHeader tenantId: TenantId,
        @PathVariable strategyId: String,
    ): ApiResponse<Unit> {
        pauseUseCase.execute(
            PausePaperTradingCommand(tenantId = tenantId, strategyId = StrategyId.of(strategyId))
        )
        return ApiResponse.success(Unit)
    }

    @PostMapping("/{strategyId}/paper/resume")
    suspend fun resume(
        @TenantHeader tenantId: TenantId,
        @PathVariable strategyId: String,
    ): ApiResponse<Unit> {
        resumeUseCase.execute(
            ResumePaperTradingCommand(tenantId = tenantId, strategyId = StrategyId.of(strategyId))
        )
        return ApiResponse.success(Unit)
    }

    /**
     * Stop = USER_LIQUIDATED. 최신 run 을 status query 로 조회한 뒤 stop UseCase 에 위임한다.
     * Phase 2 단순화: run 이 없으면 idempotent no-op 응답 (404 가 아닌 success+null runId).
     */
    @PostMapping("/{strategyId}/paper/stop")
    suspend fun stop(
        @TenantHeader tenantId: TenantId,
        @PathVariable strategyId: String,
    ): ApiResponse<StopPaperResponse> {
        val sid = StrategyId.of(strategyId)
        val status = statusQuery.execute(tenantId, sid)
        val runId = status.runId
            ?: return ApiResponse.success(StopPaperResponse(runId = null, alreadyStopped = true))

        stopUseCase.execute(
            StopPaperTradingCommand(
                tenantId = tenantId,
                strategyId = sid,
                runId = runId,
                reason = EndReason.USER_LIQUIDATED,
            )
        )
        return ApiResponse.success(
            StopPaperResponse(runId = runId.value.toString(), alreadyStopped = false)
        )
    }
}

/** PAPER 시작 요청 body. `initialBalance` 미지정 시 UseCase 의 default 잔고 사용. */
data class StartPaperRequest(
    val initialBalance: BigDecimal? = null,
)

/** PAPER 시작 응답 — 새로 생성된 run 의 식별자. */
data class StartPaperResponse(
    val runId: String,
)

/**
 * PAPER 정지 응답. `runId` 가 null 이면 활성 run 이 없어 idempotent no-op.
 * `alreadyStopped` 는 호출 측이 추가 액션(예: 토스트)을 분기할 수 있게 명시한다.
 */
data class StopPaperResponse(
    val runId: String?,
    val alreadyStopped: Boolean,
)
