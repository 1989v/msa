package com.kgd.product.infrastructure.persistence.idempotency

import com.kgd.common.messaging.ProcessedEventRecord
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.Instant
import java.util.UUID

/**
 * ADR-0029 PR-7 — [JpaProcessedEventRepositoryAdapter] 단위 테스트.
 *
 * Port contract (`existsBy` / `mark` / `deleteOlderThan`) 가 underlying [ProcessedEventJpaRepository]
 * 호출과 1:1 매핑되는지 검증한다. 실제 MySQL 동작은 staging 에서 검증한다.
 */
class JpaProcessedEventRepositoryAdapterTest : BehaviorSpec({

    Given("JpaProcessedEventRepositoryAdapter") {
        val jpa = mockk<ProcessedEventJpaRepository>()
        val adapter = JpaProcessedEventRepositoryAdapter(jpa)
        val eventId = UUID.randomUUID()
        val group = "product-stock-sync"

        When("existsBy 가 (eventId, consumerGroup) 로 호출되면") {
            every {
                jpa.existsById(ProcessedEventId(eventId = eventId, consumerGroup = group))
            } returns true

            Then("JPA existsById 에 복합 PK 로 위임") {
                adapter.existsBy(eventId, group) shouldBe true
                verify(exactly = 1) {
                    jpa.existsById(ProcessedEventId(eventId = eventId, consumerGroup = group))
                }
            }
        }

        When("mark 가 ProcessedEventRecord 로 호출되면") {
            val captured = slot<ProcessedEventJpaEntity>()
            every { jpa.save(capture(captured)) } answers { captured.captured }
            val processedAt = Instant.parse("2026-05-03T03:00:00Z")
            val record = ProcessedEventRecord(
                eventId = eventId,
                consumerGroup = group,
                processedAt = processedAt,
            )

            adapter.mark(record)

            Then("Entity 로 변환 후 save 호출") {
                verify(exactly = 1) { jpa.save(any<ProcessedEventJpaEntity>()) }
                captured.captured.eventId shouldBe eventId
                captured.captured.consumerGroup shouldBe group
                captured.captured.processedAt shouldBe processedAt
            }
        }

        When("deleteOlderThan 이 cutoff 로 호출되면") {
            val cutoff = Instant.parse("2026-04-25T03:30:00Z")
            every { jpa.deleteByProcessedAtBefore(cutoff) } returns 5

            Then("derived delete 메서드에 위임 + 삭제 row 수 반환") {
                adapter.deleteOlderThan(cutoff) shouldBe 5
                verify(exactly = 1) { jpa.deleteByProcessedAtBefore(cutoff) }
            }
        }
    }
})
