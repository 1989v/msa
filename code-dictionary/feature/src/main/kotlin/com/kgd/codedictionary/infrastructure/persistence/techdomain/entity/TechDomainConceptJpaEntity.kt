package com.kgd.codedictionary.infrastructure.persistence.techdomain.entity

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
@Table(name = "tech_domain_concept")
class TechDomainConceptJpaEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "domain_id", nullable = false)
    val domain: TechDomainJpaEntity,

    // concept 행은 reindex 가 통째로 다시 심으므로 FK 가 아니라 값으로 들고 있는다 (V19 주석 참조)
    @Column(name = "concept_id", nullable = false, length = 100)
    val conceptId: String,

    @Column(name = "order_no", nullable = false)
    val orderNo: Int = 0,
)
