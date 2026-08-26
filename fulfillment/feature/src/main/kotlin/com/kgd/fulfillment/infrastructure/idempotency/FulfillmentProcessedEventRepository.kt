package com.kgd.fulfillment.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** fulfillment EMF 에 바인딩되는 processed_event 리포지토리. */
interface FulfillmentProcessedEventRepository : ProcessedEventRepository
