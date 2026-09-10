package com.kgd.experiment.infrastructure.persistence.entity

import com.kgd.experiment.domain.model.Variant
import jakarta.persistence.*

@Entity
@Table(name = "variants")
class VariantJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    name: String,
    weight: Int,
    configJson: String = "{}"
) {
    @Column(nullable = false)
    var name: String = name
        private set

    @Column(nullable = false)
    var weight: Int = weight
        private set

    @Column(columnDefinition = "TEXT")
    var configJson: String = configJson
        private set

    fun toDomain(): Variant = Variant(
        id = id,
        name = name,
        weight = weight,
        config = emptyMap()
    )

    companion object {
        fun fromDomain(variant: Variant): VariantJpaEntity = VariantJpaEntity(
            id = variant.id,
            name = variant.name,
            weight = variant.weight,
            configJson = "{}"
        )
    }
}
