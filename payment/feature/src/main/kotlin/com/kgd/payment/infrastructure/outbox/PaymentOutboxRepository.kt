package com.kgd.payment.infrastructure.outbox

import com.kgd.common.messaging.outbox.OutboxRepository

/** payment EMF 에 바인딩되는 outbox 리포지토리 — 패키지가 `com.kgd.payment` 라 payment_db 에 붙는다. */
interface PaymentOutboxRepository : OutboxRepository
