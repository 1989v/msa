package com.kgd.search.application.queryvector.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 질의 사전 설정 (ADR-0090). application 이 읽으므로 `application/{entity}/config` 에 둔다.
 *
 * [modelRef] 는 **search:batch 의 `search.embedding.model-ref` 와 한 글자도 달라선 안 된다.**
 * 다르면 사전은 적중해도 문서 벡터의 스탬프가 달라 벡터 레그가 꺼진다(전환 창 안전장치).
 * 비어 있으면 사전을 아예 쓰지 않는다 — 첫 채움 전 정상 상태다.
 */
@ConfigurationProperties(prefix = "search.query-vector")
data class QueryVectorProperties(
    val modelRef: String = "",
    /** 적중·미적중을 **둘 다** 캐시한다. 미적중을 안 담으면 사전에 없는 질의가 매번 OpenSearch 를 친다. */
    val cacheMaxSize: Long = 10_000,
    val cacheTtlMinutes: Long = 10,
) {
    val enabled: Boolean get() = modelRef.isNotBlank()
}
