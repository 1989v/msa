package com.kgd.promotion.infrastructure.outbox

import com.kgd.common.messaging.outbox.OutboxRepository

/** promotion EMF 에 바인딩되는 outbox 리포지토리 — 패키지가 `com.kgd.promotion` 라 promotion_db 에 붙는다. */
interface PromotionOutboxRepository : OutboxRepository
