package com.kgd.promotion.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** promotion EMF 에 바인딩되는 processed_event 리포지토리. */
interface PromotionProcessedEventRepository : ProcessedEventRepository
