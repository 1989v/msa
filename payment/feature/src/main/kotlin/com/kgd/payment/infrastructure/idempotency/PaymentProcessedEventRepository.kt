package com.kgd.payment.infrastructure.idempotency

import com.kgd.common.messaging.idempotency.ProcessedEventRepository

/** payment EMF 에 바인딩되는 processed_event 리포지토리. */
interface PaymentProcessedEventRepository : ProcessedEventRepository
