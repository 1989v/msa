package com.kgd.analytics.infrastructure.messaging

import com.kgd.analytics.application.event.port.EventRepositoryPort
import com.kgd.analytics.application.event.port.ExperimentMetricRow
import com.kgd.common.analytics.AnalyticsEvent
import com.kgd.common.analytics.EntityType
import com.kgd.common.analytics.EventAction
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import java.time.Instant

class EventIngestionConsumerTest : BehaviorSpec({

    fun event(i: Int) = AnalyticsEvent(
        eventId = "e$i",
        entityType = EntityType.ATTRACTION,
        entityId = "$i",
        action = EventAction.IMPRESSION,
        userId = null,
        visitorId = "v",
        sessionId = "s",
        timestamp = Instant.now(),
        experimentAssignments = null,
        payload = emptyMap(),
    )

    class Recorder(val fail: Boolean = false) : EventRepositoryPort {
        val saved = mutableListOf<AnalyticsEvent>()
        var calls = 0
        override fun saveEvents(events: List<AnalyticsEvent>) {
            calls++
            if (fail) throw IllegalStateException("clickhouse down")
            saved += events
        }
        override fun queryExperimentMetrics(
            experimentId: Long, startTime: Instant, endTime: Instant,
        ): List<ExperimentMetricRow> = emptyList()
    }

    Given("적게 들어올 때") {
        `when`("묶음 크기를 못 채우면") {
            val repo = Recorder()
            val consumer = EventIngestionConsumer(repo)
            consumer.consume(event(1))
            consumer.consume(event(2))

            Then("아직 쓰지 않는다") {
                repo.calls shouldBe 0
            }
            Then("시간이 되면 쓴다 — 트래픽이 적은 서비스는 100건이 며칠 걸린다") {
                consumer.flushPeriodically()
                repo.saved shouldHaveSize 2
            }
        }
    }

    Given("내려갈 때") {
        `when`("버퍼에 남은 것이 있으면") {
            val repo = Recorder()
            val consumer = EventIngestionConsumer(repo)
            consumer.consume(event(1))
            consumer.flushOnShutdown()

            Then("마지막 묶음을 잃지 않는다") {
                repo.saved shouldHaveSize 1
            }
        }
    }

    Given("적재가 실패할 때") {
        `when`("ClickHouse 가 없으면") {
            val repo = Recorder(fail = true)
            val consumer = EventIngestionConsumer(repo)
            consumer.consume(event(1))
            consumer.flushPeriodically()

            Then("버퍼를 비우지 않는다 — 비우면 그 묶음이 사라진다") {
                val ok = Recorder()
                val retry = EventIngestionConsumer(ok)
                // 같은 인스턴스가 다시 시도할 수 있어야 한다
                consumer.flushPeriodically()
                repo.calls shouldBe 2
                retry.flushPeriodically()
                ok.calls shouldBe 0
            }
        }
    }

    Given("많이 들어올 때") {
        `when`("묶음 크기를 채우면") {
            val repo = Recorder()
            val consumer = EventIngestionConsumer(repo)
            repeat(EventIngestionConsumer.BATCH_SIZE) { consumer.consume(event(it)) }

            Then("시간을 기다리지 않고 바로 쓴다") {
                repo.calls shouldBe 1
                repo.saved shouldHaveSize EventIngestionConsumer.BATCH_SIZE
            }
        }
    }
})
