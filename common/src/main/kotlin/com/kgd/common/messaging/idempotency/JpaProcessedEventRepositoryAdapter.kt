package com.kgd.common.messaging.idempotency

import com.kgd.common.messaging.ProcessedEventRecord
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import java.time.Instant
import java.util.UUID

/**
 * [ProcessedEventRepositoryPort] 의 JPA 구현. 컴포넌트 스캔 대상이 아니다 —
 * 도메인 설정이 자기 [ProcessedEventRepository] 를 넣어 빈으로 등록한다
 * (모놀리스에서 도메인마다 한 벌씩 있어야 `@Qualifier` 로 TM 과 짝을 맞출 수 있다).
 */
class JpaProcessedEventRepositoryAdapter(
    private val repository: ProcessedEventRepository,
) : ProcessedEventRepositoryPort {

    override fun existsBy(eventId: UUID, consumerGroup: String): Boolean =
        repository.existsById(ProcessedEventId(eventId = eventId, consumerGroup = consumerGroup))

    override fun mark(record: ProcessedEventRecord) {
        repository.save(
            ProcessedEventEntity(
                eventId = record.eventId,
                consumerGroup = record.consumerGroup,
                processedAt = record.processedAt,
            ),
        )
    }

    override fun deleteOlderThan(cutoff: Instant): Int =
        repository.deleteByProcessedAtBefore(cutoff)
}
