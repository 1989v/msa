package com.kgd.settlement.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** settlement EMF 에 바인딩되는 processed_event 리포지토리. */
interface SettlementProcessedEventRepository : ProcessedEventRepository
