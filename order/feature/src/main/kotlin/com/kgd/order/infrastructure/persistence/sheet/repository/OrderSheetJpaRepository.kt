package com.kgd.order.infrastructure.persistence.sheet.repository

import com.kgd.order.infrastructure.persistence.sheet.entity.OrderSheetJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface OrderSheetJpaRepository : JpaRepository<OrderSheetJpaEntity, Long>
