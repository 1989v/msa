package com.kgd.search.infrastructure.client

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 질의 인코더 사이드카 설정. 같은 파드 안이라 기본값은 localhost 다.
 *
 * [readTimeoutMs] 기본 400ms 는 실측 p50 150ms · p95 약 200ms 의 두 배다 — 그 이상 기다리면
 * 검색 P99 예산(300ms)을 이미 넘긴 것이라 기다릴 이유가 없다.
 */
@ConfigurationProperties(prefix = "search.query-encoder")
data class QueryEncoderProperties(
    val baseUrl: String = "http://localhost:8099",
    val connectTimeoutMs: Long = 200,
    val readTimeoutMs: Long = 400,
)
