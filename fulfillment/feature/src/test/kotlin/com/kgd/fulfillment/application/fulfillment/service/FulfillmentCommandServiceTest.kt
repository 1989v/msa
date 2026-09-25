package com.kgd.fulfillment.application.fulfillment.service

import com.kgd.common.messaging.IdempotentEventHandler
import com.kgd.common.messaging.IdempotentMetrics
import com.kgd.common.messaging.ProcessedEventRecord
import com.kgd.common.messaging.ProcessedEventRepositoryPort
import com.kgd.common.messaging.outbox.OutboxPort
import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.application.fulfillment.usecase.TransitionFulfillmentUseCase
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentLine
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentLineStatus
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus
import com.kgd.fulfillment.infrastructure.messaging.FulfillmentCommandConsumer
import io.kotest.assertions.throwables.shouldNotThrowAny
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.mockk
import org.apache.kafka.clients.consumer.ConsumerRecord
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.support.AbstractPlatformTransactionManager
import org.springframework.transaction.support.DefaultTransactionStatus
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonMapperBuilder
import java.time.Instant
import java.util.UUID

/**
 * 이행 명령(`fulfillment.command.*`) — 컨슈머부터 실제 서비스·도메인까지, 저장소·아웃박스는 메모리.
 * 판정 근거는 남은 행(이행·라인 상태)과 아웃박스에 쌓인 답의 토픽·키·페이로드다.
 */
class FulfillmentCommandServiceTest : BehaviorSpec({

    class Row(val eventType: String, val payload: String, val partitionKey: String?)

    class FakeFulfillments : FulfillmentRepositoryPort {
        val rows = mutableMapOf<Long, FulfillmentOrder>()
        private var lineSeq = 0L
        override fun save(fulfillmentOrder: FulfillmentOrder): FulfillmentOrder {
            val id = fulfillmentOrder.id ?: ((rows.keys.maxOrNull() ?: 0L) + 1)
            // 유니크 (order_id, warehouse_id) 를 흉내 낸다
            check(rows.values.none { it.id != id && it.orderId == fulfillmentOrder.orderId && it.warehouseId == fulfillmentOrder.warehouseId })
            val lines = fulfillmentOrder.getLines().map {
                FulfillmentLine.restore(it.id ?: ++lineSeq, it.orderItemId, it.productId, it.quantity, it.getStatus())
            }
            rows[id] = FulfillmentOrder.restore(id, fulfillmentOrder.orderId, fulfillmentOrder.warehouseId,
                fulfillmentOrder.getStatus(), fulfillmentOrder.createdAt, lines)
            return copy(rows.getValue(id))
        }
        override fun findById(id: Long) = rows[id]?.let(::copy)
        override fun findAllByOrderId(orderId: Long) = rows.values.filter { it.orderId == orderId }.sortedBy { it.id }.map(::copy)
        override fun findByOrderIdAndWarehouseId(orderId: Long, warehouseId: Long) =
            rows.values.firstOrNull { it.orderId == orderId && it.warehouseId == warehouseId }?.let(::copy)
        private fun copy(fo: FulfillmentOrder) = FulfillmentOrder.restore(fo.id, fo.orderId, fo.warehouseId, fo.getStatus(), fo.createdAt,
            fo.getLines().map { FulfillmentLine.restore(it.id, it.orderItemId, it.productId, it.quantity, it.getStatus()) })
    }

    class Harness {
        val outboxRows = mutableListOf<Row>()
        val repo = FakeFulfillments()
        val objectMapper = jacksonMapperBuilder().build()
        val events = FulfillmentEventPublisher(
            object : OutboxPort {
                override fun save(
                    aggregateType: String, aggregateId: Long, eventType: String, payload: String,
                    partitionKey: String?, headers: Map<String, String>,
                ) {
                    outboxRows += Row(eventType, payload, partitionKey)
                }
            },
            objectMapper,
        )
        val service = FulfillmentCommandService(repo, events)
        val rest = FulfillmentService(repo, events)
        private val processed = mutableSetOf<Pair<UUID, String>>()
        val consumer = FulfillmentCommandConsumer(
            service, objectMapper,
            IdempotentEventHandler(
                object : ProcessedEventRepositoryPort {
                    override fun existsBy(eventId: UUID, consumerGroup: String) = (eventId to consumerGroup) in processed
                    override fun mark(record: ProcessedEventRecord) {
                        processed += record.eventId to record.consumerGroup
                    }
                    override fun deleteOlderThan(cutoff: Instant) = 0
                },
                TransactionTemplate(object : AbstractPlatformTransactionManager() {
                    override fun doGetTransaction(): Any = Any()
                    override fun doBegin(transaction: Any, definition: TransactionDefinition) = Unit
                    override fun doCommit(status: DefaultTransactionStatus) = Unit
                    override fun doRollback(status: DefaultTransactionStatus) = Unit
                }),
            ),
            mockk<IdempotentMetrics>(relaxed = true),
        )

        fun record(topic: String, json: String) = ConsumerRecord(topic, 0, 0L, "key", json)
        fun events(type: String) = outboxRows.filter { it.eventType == type }
        fun json(row: Row): JsonNode = objectMapper.readTree(row.payload)

        /** 주문 1: 창고 1 에 주문 라인 100(상품 10)·200(상품 20), 창고 2 에 라인 300(상품 30) */
        fun create(eventId: UUID = UUID.randomUUID()) = consumer.onCreate(
            record(
                FulfillmentCommandConsumer.CREATE,
                """{"eventId":"$eventId","orderId":1,"lines":[
                    {"orderItemId":100,"productId":10,"quantity":2,"warehouseId":1},
                    {"orderItemId":200,"productId":20,"quantity":1,"warehouseId":1},
                    {"orderItemId":300,"productId":30,"quantity":5,"warehouseId":2}]}""",
            ),
        )

        /** 취소는 주문 라인 id 로 — 상품 id 는 싣지만 보지 않는다 */
        fun cancel(vararg orderItemIds: Long) = consumer.onCancel(
            record(
                FulfillmentCommandConsumer.CANCEL,
                """{"eventId":"${UUID.randomUUID()}","orderId":1,"lines":[${orderItemIds.joinToString(",") { """{"orderItemId":$it,"productId":${it / 10}}""" }}]}""",
            ),
        )

        fun fulfillmentOf(warehouseId: Long) = repo.rows.values.single { it.warehouseId == warehouseId }

        fun ship(warehouseId: Long) {
            val id = fulfillmentOf(warehouseId).id!!
            listOf("PICKING", "PACKING", "SHIPPED").forEach { rest.execute(TransitionFulfillmentUseCase.Command(id, it)) }
        }
    }

    given("create 명령") {
        then("창고마다 이행 하나를 만들고 created 하나로 답한다 — 같은 eventId 재배달은 무시, 새 명령에는 같은 답") {
            val h = Harness()
            val eventId = UUID.randomUUID()
            h.create(eventId)
            h.create(eventId)
            h.events("fulfillment.order.created") shouldHaveSize 1

            h.create()

            h.repo.rows.size shouldBe 2
            h.fulfillmentOf(1L).getLines().map { it.productId to it.quantity }.toSet() shouldBe setOf(10L to 2, 20L to 1)
            val created = h.events("fulfillment.order.created")
            created shouldHaveSize 2
            created[1].payload shouldBe created[0].payload
            created.map { it.partitionKey }.toSet() shouldBe setOf("1")
            h.json(created[0]).let { p ->
                p["orderId"].asLong() shouldBe 1L
                p["fulfillments"].size() shouldBe 2
                (0 until 2).map { p["fulfillments"][it]["warehouseId"].asLong() }.toSet() shouldBe setOf(1L, 2L)
            }
        }
    }

    given("cancel 명령") {
        then("출고 전이면 지정한 라인만 취소하고, 이행의 마지막 라인이면 그 이행도 취소한다") {
            val h = Harness()
            h.create()

            h.cancel(100L, 300L)

            h.fulfillmentOf(1L).getStatus() shouldBe FulfillmentStatus.PENDING
            h.fulfillmentOf(1L).getLines().associate { it.productId to it.getStatus() } shouldBe
                mapOf(10L to FulfillmentLineStatus.CANCELLED, 20L to FulfillmentLineStatus.ACTIVE)
            h.fulfillmentOf(2L).getStatus() shouldBe FulfillmentStatus.CANCELLED
            h.json(h.events("fulfillment.order.cancelled").single()).let { p ->
                (0 until p["lines"].size()).map { p["lines"][it]["productId"].asLong() }.toSet() shouldBe setOf(10L, 30L)
                p["cancelledFulfillmentIds"].size() shouldBe 1
                p["cancelledFulfillmentIds"][0].asLong() shouldBe h.fulfillmentOf(2L).id
            }
            h.events("fulfillment.order.cancelled").single().partitionKey shouldBe "1"

            // 같은 라인 취소가 다시 와도 같은 라인으로 cancelled — 효과는 없다
            h.cancel(100L, 300L)
            h.events("fulfillment.order.cancelled") shouldHaveSize 2
            h.fulfillmentOf(1L).getLines().single { it.productId == 20L }.getStatus() shouldBe FulfillmentLineStatus.ACTIVE
        }

        then("같은 상품이 두 주문 라인이면 이행 라인도 둘이고, 한 라인만 취소된다") {
            val h = Harness()
            h.consumer.onCreate(
                h.record(
                    FulfillmentCommandConsumer.CREATE,
                    """{"eventId":"${UUID.randomUUID()}","orderId":1,"lines":[
                        {"orderItemId":401,"productId":40,"quantity":1,"warehouseId":1},
                        {"orderItemId":402,"productId":40,"quantity":2,"warehouseId":1}]}""",
                ),
            )
            h.fulfillmentOf(1L).getLines().map { it.orderItemId to it.quantity } shouldBe listOf(401L to 1, 402L to 2)

            h.cancel(402L)

            h.fulfillmentOf(1L).getLines().associate { it.orderItemId to it.getStatus() } shouldBe
                mapOf(401L to FulfillmentLineStatus.ACTIVE, 402L to FulfillmentLineStatus.CANCELLED)
            h.fulfillmentOf(1L).getStatus() shouldBe FulfillmentStatus.PENDING
        }

        then("요청 라인 중 하나라도 이미 출고됐으면 아무것도 취소하지 않고 cancel-rejected — 예외(DLT)가 아니다") {
            val h = Harness()
            h.create()
            h.ship(2L)

            shouldNotThrowAny { h.cancel(100L, 300L) }

            h.events("fulfillment.order.cancelled").shouldBeEmpty()
            h.json(h.events("fulfillment.order.cancel-rejected").single()).let { p ->
                p["reason"].asText() shouldBe "ALREADY_SHIPPED"
                p["lines"].size() shouldBe 1
                p["lines"][0]["productId"].asLong() shouldBe 30L
                p["lines"][0]["fulfillmentStatus"].asText() shouldBe "SHIPPED"
            }
            h.fulfillmentOf(1L).getLines().map { it.getStatus() }.toSet() shouldBe setOf(FulfillmentLineStatus.ACTIVE)
        }

        then("이행이 없는 주문의 취소는 계약 위반 예외 — 이것만 DLT 로 간다") {
            val h = Harness()
            shouldThrow<IllegalArgumentException> { h.cancel(100L) }
        }
    }

    given("REST 수동 전이") {
        then("shipped·delivered 는 orderId 와 라인을 싣고 키가 orderId 다") {
            val h = Harness()
            h.create()
            h.ship(1L)
            h.rest.execute(TransitionFulfillmentUseCase.Command(h.fulfillmentOf(1L).id!!, "DELIVERED"))

            listOf("fulfillment.order.shipped", "fulfillment.order.delivered").forEach { type ->
                val row = h.events(type).single()
                row.partitionKey shouldBe "1"
                h.json(row).let { p ->
                    p["orderId"].asLong() shouldBe 1L
                    p["warehouseId"].asLong() shouldBe 1L
                    p["lines"].size() shouldBe 2
                }
            }
        }
    }
})
