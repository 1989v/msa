package com.kgd.fulfillment.infrastructure.persistence.idempotency

import org.springframework.data.jpa.repository.JpaRepository

interface ProcessedEventJpaRepository : JpaRepository<ProcessedEventJpaEntity, String>
