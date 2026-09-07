package com.kgd.search.domain.queryvector.port

import com.kgd.search.domain.queryvector.model.QueryVector

/**
 * 질의 벡터의 **원천 저장소**(RDB). 검색하지 않고 정규화 질의 + 스탬프로만 읽는다.
 *
 * 캐시가 아니라 원천인 이유: 인코딩은 CPU 를 쓰는 일이라 파드가 재기동할 때마다 다시 만들면
 * 같은 질의를 영원히 다시 계산한다. 원천이 있으면 재기동 후 첫 요청부터 조회로 끝난다.
 */
interface QueryVectorPort {
    fun find(id: String): QueryVector?
    fun upsertAll(vectors: List<QueryVector>): Int
    fun count(modelRef: String): Long
}
