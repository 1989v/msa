package com.kgd.experiment.domain.model

enum class ExperimentStatus {
    DRAFT,
    RUNNING,
    PAUSED,
    COMPLETED;

    fun canTransitionTo(target: ExperimentStatus): Boolean = when (this) {
        DRAFT -> target == RUNNING
        RUNNING -> target in listOf(PAUSED, COMPLETED)
        PAUSED -> target in listOf(RUNNING, COMPLETED)
        COMPLETED -> false
    }
}
