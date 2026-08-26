package com.kgd.inventory.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** inventory EMF 에 바인딩되는 processed_event 리포지토리. */
interface InventoryProcessedEventRepository : ProcessedEventRepository
