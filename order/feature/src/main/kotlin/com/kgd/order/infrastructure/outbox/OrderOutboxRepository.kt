package com.kgd.order.infrastructure.outbox

import com.kgd.common.messaging.outbox.OutboxRepository

/**
 * ADR-0058 — order 전용 outbox repository. common [OutboxRepository] 를 상속한 도메인 전용
 * 서브인터페이스로, [com.kgd.order.infrastructure.config.OrderDataSourceConfig] 의 @EnableJpaRepositories
 * 가 order EMF/TM(order_db)에 바인딩한다 → outbox INSERT 가 order 상태변경과 같은 트랜잭션(원자성).
 */
interface OrderOutboxRepository : OutboxRepository
