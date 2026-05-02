package com.kgd.common.messaging

import java.time.Instant
import java.util.UUID

/**
 * ADR-0029 — `processed_event` 영속화 추상화. 각 서비스의 infrastructure 레이어가 JPA 어댑터로 구현한다.
 *
 * common 모듈에는 JPA 의존성을 두지 않으므로 본 인터페이스는 기술 중립이다.
 *
 * ## Contract
 * - [existsBy] : `(eventId, consumerGroup)` 복합 키 존재 여부 조회. 부수효과 없음.
 * - [mark]     : 새 row 삽입. 동시 INSERT 시 PK 충돌이 발생할 수 있고, 호출자가
 *                [org.springframework.dao.DataIntegrityViolationException] 흡수를 책임진다.
 * - [deleteOlderThan] : retention 스케줄러 (기본 7일) 가 호출. 삭제된 row 수 반환.
 */
interface ProcessedEventRepositoryPort {

    fun existsBy(eventId: UUID, consumerGroup: String): Boolean

    fun mark(record: ProcessedEventRecord)

    fun deleteOlderThan(cutoff: Instant): Int
}
