package com.kgd.fulfillment.application.fulfillment.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.kgd.fulfillment.application.fulfillment.port.FulfillmentRepositoryPort
import com.kgd.fulfillment.application.fulfillment.port.OutboxPort
import com.kgd.fulfillment.application.fulfillment.usecase.CreateFulfillmentUseCase
import com.kgd.fulfillment.application.fulfillment.usecase.TransitionFulfillmentUseCase
import com.kgd.fulfillment.domain.fulfillment.exception.FulfillmentNotFoundException
import com.kgd.fulfillment.domain.fulfillment.exception.InvalidFulfillmentStateException
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentOrder
import com.kgd.fulfillment.domain.fulfillment.model.FulfillmentStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

class FulfillmentServiceTest : BehaviorSpec({
    val fulfillmentRepository = mockk<FulfillmentRepositoryPort>()
    val outboxPort = mockk<OutboxPort>(relaxed = true)
    val objectMapper = ObjectMapper()
    val service = FulfillmentService(fulfillmentRepository, outboxPort, objectMapper)

    beforeEach { clearMocks(fulfillmentRepository, outboxPort) }

    given("풀필먼트 생성 시") {
        `when`("유효한 커맨드이면") {
            then("풀필먼트가 저장되고 아웃박스 이벤트가 발행되어야 한다") {
                val saved = FulfillmentOrder.restore(
                    id = 1L,
                    orderId = 100L,
                    warehouseId = 10L,
                    status = FulfillmentStatus.PENDING,
                    createdAt = LocalDateTime.now()
                )
                every { fulfillmentRepository.save(any()) } returns saved

                val result = service.execute(CreateFulfillmentUseCase.Command(orderId = 100L, warehouseId = 10L))

                result.fulfillmentId shouldBe 1L
                result.orderId shouldBe 100L
                result.status shouldBe "PENDING"

                verify(exactly = 1) { fulfillmentRepository.save(any()) }
                verify(exactly = 1) {
                    outboxPort.save(
                        aggregateType = "FulfillmentOrder",
                        aggregateId = 1L,
                        eventType = "fulfillment.order.created",
                        payload = any()
                    )
                }
            }
        }
    }

    given("풀필먼트 상태 전이 시") {
        `when`("PENDING에서 PICKING으로 전이하면") {
            then("상태가 변경되고 아웃박스 이벤트가 발행되어야 한다") {
                val fulfillment = FulfillmentOrder.restore(
                    id = 1L,
                    orderId = 100L,
                    warehouseId = 10L,
                    status = FulfillmentStatus.PENDING,
                    createdAt = LocalDateTime.now()
                )
                every { fulfillmentRepository.findById(1L) } returns fulfillment
                every { fulfillmentRepository.save(any()) } returns fulfillment

                val result = service.execute(
                    TransitionFulfillmentUseCase.Command(fulfillmentId = 1L, targetStatus = "PICKING")
                )

                result.fulfillmentId shouldBe 1L
                result.fromStatus shouldBe "PENDING"
                result.toStatus shouldBe "PICKING"

                verify(exactly = 1) {
                    outboxPort.save(
                        aggregateType = "FulfillmentOrder",
                        aggregateId = 1L,
                        eventType = "fulfillment.order.status-changed",
                        payload = any()
                    )
                }
            }
        }

        `when`("PACKING에서 SHIPPED로 전이하면") {
            then("shipped 이벤트 타입으로 아웃박스가 발행되어야 한다") {
                val fulfillment = FulfillmentOrder.restore(
                    id = 2L,
                    orderId = 200L,
                    warehouseId = 20L,
                    status = FulfillmentStatus.PACKING,
                    createdAt = LocalDateTime.now()
                )
                every { fulfillmentRepository.findById(2L) } returns fulfillment
                every { fulfillmentRepository.save(any()) } returns fulfillment

                val result = service.execute(
                    TransitionFulfillmentUseCase.Command(fulfillmentId = 2L, targetStatus = "SHIPPED")
                )

                result.fromStatus shouldBe "PACKING"
                result.toStatus shouldBe "SHIPPED"

                verify(exactly = 1) {
                    outboxPort.save(
                        aggregateType = "FulfillmentOrder",
                        aggregateId = 2L,
                        eventType = "fulfillment.order.shipped",
                        payload = any()
                    )
                }
            }
        }

        `when`("유효하지 않은 상태 전이이면") {
            then("InvalidFulfillmentStateException이 발생해야 한다") {
                val fulfillment = FulfillmentOrder.restore(
                    id = 3L,
                    orderId = 300L,
                    warehouseId = 30L,
                    status = FulfillmentStatus.DELIVERED,
                    createdAt = LocalDateTime.now()
                )
                every { fulfillmentRepository.findById(3L) } returns fulfillment

                shouldThrow<InvalidFulfillmentStateException> {
                    service.execute(
                        TransitionFulfillmentUseCase.Command(fulfillmentId = 3L, targetStatus = "CANCELLED")
                    )
                }
            }
        }

        `when`("존재하지 않는 풀필먼트이면") {
            then("FulfillmentNotFoundException이 발생해야 한다") {
                every { fulfillmentRepository.findById(999L) } returns null

                shouldThrow<FulfillmentNotFoundException> {
                    service.execute(
                        TransitionFulfillmentUseCase.Command(fulfillmentId = 999L, targetStatus = "PICKING")
                    )
                }
            }
        }
    }

    given("풀필먼트 취소 시") {
        `when`("PENDING 상태에서 CANCELLED로 전이하면") {
            then("취소되고 cancelled 아웃박스 이벤트가 발행되어야 한다") {
                val fulfillment = FulfillmentOrder.restore(
                    id = 4L,
                    orderId = 400L,
                    warehouseId = 40L,
                    status = FulfillmentStatus.PENDING,
                    createdAt = LocalDateTime.now()
                )
                every { fulfillmentRepository.findById(4L) } returns fulfillment
                every { fulfillmentRepository.save(any()) } returns fulfillment

                val result = service.execute(
                    TransitionFulfillmentUseCase.Command(fulfillmentId = 4L, targetStatus = "CANCELLED")
                )

                result.fromStatus shouldBe "PENDING"
                result.toStatus shouldBe "CANCELLED"

                verify(exactly = 1) {
                    outboxPort.save(
                        aggregateType = "FulfillmentOrder",
                        aggregateId = 4L,
                        eventType = "fulfillment.order.cancelled",
                        payload = any()
                    )
                }
            }
        }
    }

    given("풀필먼트 조회 시") {
        `when`("존재하는 ID이면") {
            then("풀필먼트 정보가 반환되어야 한다") {
                val now = LocalDateTime.now()
                val fulfillment = FulfillmentOrder.restore(
                    id = 5L,
                    orderId = 500L,
                    warehouseId = 50L,
                    status = FulfillmentStatus.PICKING,
                    createdAt = now
                )
                every { fulfillmentRepository.findById(5L) } returns fulfillment

                val result = service.findById(5L)

                result.fulfillmentId shouldBe 5L
                result.orderId shouldBe 500L
                result.warehouseId shouldBe 50L
                result.status shouldBe "PICKING"
                result.createdAt shouldBe now
            }
        }

        `when`("존재하지 않는 ID이면") {
            then("FulfillmentNotFoundException이 발생해야 한다") {
                every { fulfillmentRepository.findById(999L) } returns null

                shouldThrow<FulfillmentNotFoundException> {
                    service.findById(999L)
                }
            }
        }

        `when`("orderId로 조회 시 존재하면") {
            then("풀필먼트 정보가 반환되어야 한다") {
                val fulfillment = FulfillmentOrder.restore(
                    id = 6L,
                    orderId = 600L,
                    warehouseId = 60L,
                    status = FulfillmentStatus.SHIPPED,
                    createdAt = LocalDateTime.now()
                )
                every { fulfillmentRepository.findByOrderId(600L) } returns fulfillment

                val result = service.findByOrderId(600L)
                result.fulfillmentId shouldBe 6L
                result.orderId shouldBe 600L
            }
        }
    }
})
