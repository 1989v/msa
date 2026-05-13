package com.kgd.codedictionary.infrastructure.persistence.service.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table

@Entity
@Table(name = "service_concept")
class ServiceConceptJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "service_id", nullable = false)
    val service: ServiceJpaEntity,
    @Column(name = "concept_id", nullable = false, length = 100)
    val conceptId: String,
    @Column(name = "display_order", nullable = false)
    val displayOrder: Int = 0
)
