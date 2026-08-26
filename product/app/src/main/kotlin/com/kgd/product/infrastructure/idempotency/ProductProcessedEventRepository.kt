package com.kgd.product.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** product DB 의 processed_event 리포지토리 — 엔티티는 common, 바인딩은 이 패키지. */
interface ProductProcessedEventRepository : ProcessedEventRepository
