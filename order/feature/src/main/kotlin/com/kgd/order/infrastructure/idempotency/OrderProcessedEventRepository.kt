package com.kgd.order.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** order EMF 에 바인딩되는 processed_event 리포지토리. */
interface OrderProcessedEventRepository : ProcessedEventRepository
