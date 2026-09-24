package com.kgd.product.infrastructure.outbox

import com.kgd.common.messaging.outbox.OutboxRepository

/**
 * product 전용 outbox repository. [com.kgd.product.infrastructure.config.ProductDataSourceConfig] 의
 * @EnableJpaRepositories 가 product EMF/TM(product_db)에 바인딩한다 → 상품 저장과 outbox INSERT 가 한 트랜잭션.
 */
interface ProductOutboxRepository : OutboxRepository
