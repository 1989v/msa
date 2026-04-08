package com.kgd.experiment.infrastructure.persistence.entity

import com.kgd.experiment.domain.model.Experiment
import com.kgd.experiment.domain.model.ExperimentStatus
import jakarta.persistence.*
import java.time.LocalDateTime

@Entity
@Table(name = "experiments")
class ExperimentJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    var description: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: ExperimentStatus,

    @Column(nullable = false)
    var trafficPercentage: Int,

    @Column
    var startDate: LocalDateTime? = null,

    @Column
    var endDate: LocalDateTime? = null,

    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),

    @OneToMany(cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "experiment_id")
    var variants: MutableList<VariantJpaEntity> = mutableListOf()
) {
    fun toDomain(): Experiment = Experiment(
        id = id,
        name = name,
        description = description,
        status = status,
        trafficPercentage = trafficPercentage,
        variants = variants.map { it.toDomain() },
        startDate = startDate,
        endDate = endDate,
        createdAt = createdAt
    )

    companion object {
        fun fromDomain(experiment: Experiment): ExperimentJpaEntity = ExperimentJpaEntity(
            id = experiment.id,
            name = experiment.name,
            description = experiment.description,
            status = experiment.status,
            trafficPercentage = experiment.trafficPercentage,
            startDate = experiment.startDate,
            endDate = experiment.endDate,
            createdAt = experiment.createdAt,
            variants = experiment.variants.map { VariantJpaEntity.fromDomain(it) }.toMutableList()
        )
    }
}
