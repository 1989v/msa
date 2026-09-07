package com.kgd.search.infrastructure.persistence.queryvector

import com.kgd.search.domain.queryvector.model.QueryVector
import com.kgd.search.domain.queryvector.port.QueryVectorPort
import com.kgd.search.infrastructure.persistence.queryvector.entity.QueryVectorJpaEntity
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional

/** 질의 벡터 원천 (RDB). 조회는 (스탬프, 정규화 질의) 유니크 키 하나로 끝난다. */
@Repository
class QueryVectorPersistenceAdapter(
    private val repository: QueryVectorJpaRepository,
) : QueryVectorPort {

    @Transactional(readOnly = true)
    override fun find(id: String): QueryVector? {
        // id 는 "modelRef|normalized" 인데 modelRef 자체에 '|' 가 없으므로 마지막 구분자로 나눈다.
        val sep = id.indexOf('|')
        if (sep <= 0 || sep == id.length - 1) return null
        return repository.findByModelRefAndNormalized(id.substring(0, sep), id.substring(sep + 1))?.toDomain()
    }

    @Transactional
    override fun upsertAll(vectors: List<QueryVector>): Int {
        if (vectors.isEmpty()) return 0
        vectors.forEach { v ->
            val existing = repository.findByModelRefAndNormalized(v.modelRef, v.normalized)
            if (existing == null) repository.save(QueryVectorJpaEntity.from(v)) else existing.update(v)
        }
        return vectors.size
    }

    @Transactional(readOnly = true)
    override fun count(modelRef: String): Long = repository.countByModelRef(modelRef)
}
