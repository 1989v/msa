package com.kgd.experiment.infrastructure.persistence.entity

import com.kgd.experiment.domain.model.Variant
import jakarta.persistence.*

@Entity
@Table(name = "variants")
class VariantJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(nullable = false)
    var name: String,

    @Column(nullable = false)
    var weight: Int,

    @Column(columnDefinition = "TEXT")
    var configJson: String = "{}"
) {
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
