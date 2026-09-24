package com.kgd.codedictionary.application.sync.port

/** 인덱스 생성·alias 원자 교체·옛 인덱스 정리. 검색엔진 종류는 어댑터가 안다 */
interface IndexAliasPort {
    fun createTimestampedIndexName(alias: String): String
    fun createIndex(indexName: String)
    /** alias 를 [newIndexName] 으로 원자 교체하고, 옛 인덱스 중 [maxRetention] 초과분을 삭제 */
    fun swapAlias(alias: String, newIndexName: String, maxRetention: Int = 2)
    /** 만들었지만 쓰지 않기로 한 인덱스를 지운다 — 교체 직전 재확인에서 내용이 바뀌었을 때 */
    fun deleteIndex(indexName: String)
}
