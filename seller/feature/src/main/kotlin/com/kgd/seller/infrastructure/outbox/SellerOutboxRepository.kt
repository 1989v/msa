package com.kgd.seller.infrastructure.outbox

import com.kgd.common.messaging.outbox.OutboxRepository

/** seller EMF 에 바인딩되는 outbox 리포지토리 — 패키지가 `com.kgd.seller` 라 seller_db 에 붙는다. */
interface SellerOutboxRepository : OutboxRepository
