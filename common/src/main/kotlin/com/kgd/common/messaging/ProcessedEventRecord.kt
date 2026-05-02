package com.kgd.common.messaging

import java.time.Instant
import java.util.UUID

/**
 * ADR-0029 — `processed_event` 테이블 한 행을 표현하는 DTO.
 *
 * common 모듈은 JPA 의존성을 갖지 않는다. 각 서비스의 Adapter 가 이 record 를 자신의 JPA Entity 로
 * 변환해 저장한다.
 */
data class ProcessedEventRecord(
    val eventId: UUID,
    val consumerGroup: String,
    val processedAt: Instant = Instant.now(),
)
