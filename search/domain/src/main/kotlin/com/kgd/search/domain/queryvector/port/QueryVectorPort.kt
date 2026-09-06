package com.kgd.search.domain.queryvector.port

import com.kgd.search.domain.queryvector.model.QueryVector

/** 질의 사전 저장소 (OpenSearch `query_vectors`). 검색하지 않고 **id 로만** 읽는다. */
interface QueryVectorPort {
    fun find(id: String): QueryVector?
    fun upsertAll(vectors: List<QueryVector>): Int
    fun count(modelRef: String): Long
}
