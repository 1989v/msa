package com.kgd.experiment.infrastructure.persistence

import com.kgd.experiment.domain.model.ExperimentStatus
import com.kgd.experiment.infrastructure.persistence.entity.ExperimentJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ExperimentJpaRepository : JpaRepository<ExperimentJpaEntity, Long> {
    fun findByStatus(status: ExperimentStatus): List<ExperimentJpaEntity>
}
