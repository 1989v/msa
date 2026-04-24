package com.kgd.sevensplit.infrastructure.ingest

import java.time.Instant

/**
 * TG-07.2/07.3: 심볼×interval 조합별 마지막 수집 타임스탬프.
 *
 * 증분 수집은 다음 호출에서 `ts > lastTs` 인 row 만 insert 하여 ReplacingMergeTree 의 멱등성과
 * 결합해 중복 삽입 비용을 최소화한다.
 */
data class IngestCheckpoint(
    val symbol: String,
    val interval: String,
    val lastTs: Instant,
)

/**
 * Checkpoint 저장소 추상화.
 *
 * Phase 1 구현체: [FileIngestCheckpointStore] (파일 기반).
 * 향후 TG-08 ingest_checkpoint 테이블이 들어오면 JDBC 구현체로 교체 가능.
 */
interface IngestCheckpointStore {
    fun loadLastTs(symbol: String, interval: String): Instant?
    fun saveLastTs(symbol: String, interval: String, ts: Instant)
}
