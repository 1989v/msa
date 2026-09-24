package com.kgd.seller.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** seller EMF 에 바인딩되는 processed_event 리포지토리. */
interface SellerProcessedEventRepository : ProcessedEventRepository
