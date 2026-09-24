package com.kgd.order.infrastructure.persistence.opsissue.repository

import com.kgd.order.infrastructure.persistence.opsissue.entity.OrderOpsIssueJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface OrderOpsIssueJpaRepository : JpaRepository<OrderOpsIssueJpaEntity, Long>
