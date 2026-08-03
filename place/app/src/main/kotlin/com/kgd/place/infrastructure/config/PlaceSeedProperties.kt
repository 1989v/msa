package com.kgd.place.infrastructure.config

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * 오픈데이터 시드 설정 (ADR-0056 Part 2).
 * enabled=true 이고 해당 테이블이 비어있을 때만 시드 JSONL 을 적재한다(멱등).
 */
@ConfigurationProperties(prefix = "place.seed")
data class PlaceSeedProperties(
    val enabled: Boolean = false,
    val regionsPath: String = "/seed/regions.jsonl",
    val poisPath: String = "/seed/pois.jsonl",
)
