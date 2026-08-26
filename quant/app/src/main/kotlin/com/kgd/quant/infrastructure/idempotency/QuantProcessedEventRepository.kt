package com.kgd.quant.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** quant DB 의 processed_event 리포지토리 — 엔티티는 common, 바인딩은 이 패키지. */
interface QuantProcessedEventRepository : ProcessedEventRepository
