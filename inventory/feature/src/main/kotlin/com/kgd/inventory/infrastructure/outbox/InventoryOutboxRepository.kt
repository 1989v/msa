package com.kgd.inventory.infrastructure.outbox

import com.kgd.common.messaging.outbox.OutboxRepository

/** inventory EMF 에 바인딩되는 outbox 리포지토리 — 패키지가 `com.kgd.inventory` 라 inventory_db 에 붙는다. */
interface InventoryOutboxRepository : OutboxRepository
