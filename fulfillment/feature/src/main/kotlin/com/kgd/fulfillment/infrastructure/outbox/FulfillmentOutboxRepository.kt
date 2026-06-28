package com.kgd.fulfillment.infrastructure.outbox

import com.kgd.common.messaging.outbox.OutboxRepository

/**
 * ADR-0058 — fulfillment 전용 outbox repository.
 *
 * common [OutboxRepository] 를 그대로 상속한 **도메인 전용 서브인터페이스**. com.kgd.fulfillment 패키지에
 * 있어 [com.kgd.fulfillment.infrastructure.config.FulfillmentDataSourceConfig] 의 @EnableJpaRepositories 가
 * **fulfillment EMF/TM 에 바인딩**한다. 이로써 outbox INSERT 가 fulfillment 상태변경과 같은 fulfillment_db
 * 트랜잭션에 묶인다(원자성). common 의 단일 OutboxRepository 자동 바인딩에 의존하지 않으므로 order 등
 * 타 도메인과 충돌 없음.
 */
interface FulfillmentOutboxRepository : OutboxRepository
