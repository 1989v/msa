package com.kgd.quant.application.live

import com.kgd.quant.domain.common.OrderId
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.domain.credential.Exchange
import com.kgd.quant.domain.live.LiveOrderRecord

/** 사용자 수동 주문 취소 (ADR-0037 / TG-P3-27). 이미 종결(FILLED/CANCELLED)이면 no-op */
interface CancelLiveOrderUseCase {
    suspend fun execute(tenantId: TenantId, orderId: OrderId, exchange: Exchange): LiveOrderRecord
}
