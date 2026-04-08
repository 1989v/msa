package com.kgd.experiment.domain.port

import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus

interface ExperimentRepositoryPort {
    fun save(experiment: Experiment): Experiment
    fun findById(id: Long): Experiment?
    fun findAll(): List<Experiment>
    fun findByStatus(status: ExperimentStatus): List<Experiment>
    fun delete(id: Long)
}
