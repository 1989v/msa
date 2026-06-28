package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.domain.order.exception.OrderNotFoundException
import com.kgd.order.domain.order.model.Money
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.order.model.OrderItem
import com.kgd.order.domain.order.model.OrderStatus
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

/**
 * ADR-0032 PR-2 — `completeOrder` / `cancelOrder` 가 entity save 와 같은 TX 안에서
 * outbox INSERT (OrderEventPort 경유) 를 트리거함을 검증한다. 실제 outbox row 작성은
 * common 의 OutboxPort/OutboxJpaAdapter 가 담당하므로 본 단위 테스트는 port 호출만 검증.
 */
class OrderTransactionalServiceTest : BehaviorSpec({
    val repositoryPort = mockk<OrderRepositoryPort>()
    val eventPort = mockk<OrderEventPort>(relaxed = true)
    val service = OrderTransactionalService(repositoryPort, eventPort)

    beforeEach { clearMocks(repositoryPort, eventPort) }

    given("savePendingOrder") {
        `when`("커맨드가 유효하면") {
            then("repositoryPort.save 만 호출되고 outbox 발행은 일어나지 않는다") {
                val pending = Order.restore(
                    1L, "user-1",
                    listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))),
                    OrderStatus.PENDING, LocalDateTime.now(),
                )
                every { repositoryPort.save(any()) } returns pending

                val result = service.savePendingOrder(
                    PlaceOrderUseCase.Command(
                        "user-1",
                        listOf(PlaceOrderUseCase.OrderItemCommand(1L, 1, 1000.toBigDecimal())),
                    ),
                )

                result.id shouldBe 1L
                verify(exactly = 1) { repositoryPort.save(any()) }
                verify(exactly = 0) { eventPort.publishOrderCompleted(any()) }
                verify(exactly = 0) { eventPort.publishOrderCancelled(any()) }
            }
        }
    }

    given("completeOrder") {
        `when`("주문이 존재하면") {
            then("complete 후 publishOrderCompleted 가 같은 TX 안에서 호출된다") {
                val pending = Order.restore(
                    1L, "user-1",
                    listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))),
                    OrderStatus.PENDING, LocalDateTime.now(),
                )
                val savedSlot = slot<Order>()
                every { repositoryPort.findById(1L) } returns pending
                every { repositoryPort.save(capture(savedSlot)) } answers { savedSlot.captured }

                val result = service.completeOrder(1L)

                result.status shouldBe OrderStatus.COMPLETED
                verify(exactly = 1) { repositoryPort.save(any()) }
                verify(exactly = 1) { eventPort.publishOrderCompleted(any()) }
                verify(exactly = 0) { eventPort.publishOrderCancelled(any()) }
            }
        }
        `when`("주문이 존재하지 않으면") {
            then("OrderNotFoundException 이 발생하고 outbox 발행도 일어나지 않는다") {
                every { repositoryPort.findById(999L) } returns null
                shouldThrow<OrderNotFoundException> { service.completeOrder(999L) }
                verify(exactly = 0) { eventPort.publishOrderCompleted(any()) }
            }
        }
    }

    given("cancelOrder") {
        `when`("주문이 존재하면") {
            then("cancel 후 publishOrderCancelled 가 같은 TX 안에서 호출된다") {
                val pending = Order.restore(
                    2L, "user-1",
                    listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))),
                    OrderStatus.PENDING, LocalDateTime.now(),
                )
                val savedSlot = slot<Order>()
                every { repositoryPort.findById(2L) } returns pending
                every { repositoryPort.save(capture(savedSlot)) } answers { savedSlot.captured }

                val result = service.cancelOrder(2L)

                result.status shouldBe OrderStatus.CANCELLED
                verify(exactly = 1) { repositoryPort.save(any()) }
                verify(exactly = 1) { eventPort.publishOrderCancelled(any()) }
                verify(exactly = 0) { eventPort.publishOrderCompleted(any()) }
            }
        }
        `when`("주문이 존재하지 않으면") {
            then("OrderNotFoundException 이 발생하고 outbox 발행도 일어나지 않는다") {
                every { repositoryPort.findById(999L) } returns null
                shouldThrow<OrderNotFoundException> { service.cancelOrder(999L) }
                verify(exactly = 0) { eventPort.publishOrderCancelled(any()) }
            }
        }
    }
})
