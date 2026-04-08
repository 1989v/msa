package com.kgd.experiment.infrastructure.persistence

import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import com.kgd.experiment.domain.port.ExperimentRepositoryPort
import com.kgd.experiment.infrastructure.persistence.entity.ExperimentJpaEntity
import org.springframework.stereotype.Repository

@Repository
class ExperimentRepositoryAdapter(
    private val jpaRepository: ExperimentJpaRepository
) : ExperimentRepositoryPort {

    override fun save(experiment: Experiment): Experiment {
        val entity = ExperimentJpaEntity.fromDomain(experiment)
        return jpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Experiment? =
        jpaRepository.findById(id).orElse(null)?.toDomain()

    override fun findAll(): List<Experiment> =
        jpaRepository.findAll().map { it.toDomain() }

    override fun findByStatus(status: ExperimentStatus): List<Experiment> =
        jpaRepository.findByStatus(status).map { it.toDomain() }

    override fun delete(id: Long) =
        jpaRepository.deleteById(id)
}
