package com.kgd.codedictionary.infrastructure.persistence.service.entity

import com.kgd.codedictionary.domain.service.model.Service
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.OrderBy
import jakarta.persistence.Table
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.time.LocalDateTime

@Entity
@Table(name = "service")
class ServiceJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    code: String,
    name: String,
    description: String,
    port: Int?,
    isPrivate: Boolean,
    displayOrder: Int,
    @OneToMany(mappedBy = "service", cascade = [CascadeType.ALL], orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("displayOrder ASC")
    val concepts: MutableList<ServiceConceptJpaEntity> = mutableListOf(),
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    val createdAt: LocalDateTime = LocalDateTime.now(),
    @UpdateTimestamp
    @Column(nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now()
) {
    @Column(nullable = false, unique = true, length = 50)
    var code: String = code
        private set

    @Column(nullable = false, length = 100)
    var name: String = name
        private set

    @Column(nullable = false, length = 500)
    var description: String = description
        private set

    @Column
    var port: Int? = port
        private set

    @Column(name = "is_private", nullable = false)
    var isPrivate: Boolean = isPrivate
        private set

    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = displayOrder
        private set

    fun toDomain(): Service = Service.restore(
        id = id,
        code = code,
        name = name,
        description = description,
        port = port,
        isPrivate = isPrivate,
        displayOrder = displayOrder,
        conceptIds = concepts.map { it.conceptId }
    )
}
