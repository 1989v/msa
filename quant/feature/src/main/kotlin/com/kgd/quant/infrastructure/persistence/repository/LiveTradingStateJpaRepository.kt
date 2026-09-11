package com.kgd.quant.infrastructure.persistence.repository

import com.kgd.quant.infrastructure.persistence.entity.LiveTradingStateEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface LiveTradingStateJpaRepository : JpaRepository<LiveTradingStateEntity, UUID>
