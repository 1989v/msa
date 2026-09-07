package com.kgd.search.infrastructure.persistence.queryvector

import com.kgd.search.infrastructure.persistence.queryvector.entity.QueryVectorJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface QueryVectorJpaRepository : JpaRepository<QueryVectorJpaEntity, Long> {
    fun findByModelRefAndNormalized(modelRef: String, normalized: String): QueryVectorJpaEntity?
    fun countByModelRef(modelRef: String): Long
}
