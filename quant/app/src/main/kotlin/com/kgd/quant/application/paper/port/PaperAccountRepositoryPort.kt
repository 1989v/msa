package com.kgd.quant.application.paper.port

import com.kgd.quant.domain.common.StrategyId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.infrastructure.persistence.entity.PaperAccountEntity
import java.math.BigDecimal

/**
 * PaperAccountRepositoryPort — 페이퍼 트레이딩 가상 잔고 영속화 port (TG-P2-08).
 *
 * ## 배치 위치
 * Application 레이어 / paper 모듈. PAPER 모드 UseCase 와 PaperExchangeAdapter 가 의존.
 *
 * ## 계약
 * - 모든 시그니처에 tenantId 필수 (INV-05).
 * - `load` 는 (tenantId, strategyId, baseAsset) 로 단건 조회. 없으면 null.
 * - `save` 는 신규/업데이트 모두 처리.
 * - `adjustBalance` 는 (잔고 += delta) 를 atomic 하게 수행 — 동시에 여러 paper 주문이 들어와도
 *   잔고 일관성을 유지해야 한다 (구현체는 row lock 또는 트랜잭션 격리로 보장).
 *
 * ## Phase 2 단순화
 * - balance 만 추적. 보유 코인 수량 (asset position) 은 TrancheSlot.filledQty 로 추적되므로 별도 컬럼 불필요.
 * - PaperAccountEntity 를 직접 노출하는 점은 의도적 (Phase 2 단계에서는 도메인 매퍼 부담을 줄임).
 *   Phase 3 에서 LIVE 모드와 추상화 통합 시 도메인 모델로 승격 검토.
 */
interface PaperAccountRepositoryPort {

    suspend fun load(
        tenantId: TenantId,
        strategyId: StrategyId,
        baseAsset: String = DEFAULT_BASE_ASSET
    ): PaperAccountEntity?

    suspend fun save(entity: PaperAccountEntity): PaperAccountEntity

    /**
     * (tenantId, strategyId, baseAsset=KRW) PaperAccount 의 balance 에 delta 를 더한다.
     *
     * @return 갱신 후 잔고
     * @throws IllegalStateException PaperAccount 가 존재하지 않을 때
     */
    suspend fun adjustBalance(
        tenantId: TenantId,
        strategyId: StrategyId,
        delta: BigDecimal,
        baseAsset: String = DEFAULT_BASE_ASSET
    ): BigDecimal

    companion object {
        const val DEFAULT_BASE_ASSET: String = "KRW"
    }
}
