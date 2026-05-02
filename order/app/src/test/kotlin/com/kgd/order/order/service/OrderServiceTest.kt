package com.kgd.order.application.order.service

import com.kgd.common.exception.BusinessException
import com.kgd.order.application.order.port.PaymentPort
import com.kgd.order.application.order.port.PaymentResult
import com.kgd.order.application.order.port.ProductInfo
import com.kgd.order.application.order.port.ProductPort
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
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.test.runTest
import java.time.LocalDateTime

class OrderServiceTest : BehaviorSpec({
    val transactionalService = mockk<OrderTransactionalService>()
    val paymentPort = mockk<PaymentPort>()
    val productPort = mockk<ProductPort>()
    val service = OrderService(transactionalService, paymentPort, productPort)

    beforeEach { clearMocks(transactionalService, paymentPort, productPort) }

    given("주문 생성 시") {
        `when`("유효한 주문 커맨드와 결제 성공") {
            then("주문이 저장되고 결제 후 completeOrder 가 호출되어야 한다") {
                runTest {
                    val pendingOrder = Order.restore(
                        1L, "user-1",
                        listOf(OrderItem.of(1L, 2, Money(5000.toBigDecimal()))),
                        OrderStatus.PENDING, LocalDateTime.now()
                    )
                    val completedOrder = Order.restore(
                        1L, "user-1",
                        listOf(OrderItem.of(1L, 2, Money(5000.toBigDecimal()))),
                        OrderStatus.COMPLETED, LocalDateTime.now()
                    )
                    coEvery { productPort.validateProduct(1L) } returns ProductInfo(
                        productId = 1L, name = "Test Product",
                        price = 5000.toBigDecimal(), status = "ACTIVE", stock = 100
                    )
                    every { transactionalService.savePendingOrder(any()) } returns pendingOrder
                    coEvery { paymentPort.requestPayment(any(), any()) } returns PaymentResult("pay-1", "SUCCESS", 10000.toBigDecimal())
                    every { transactionalService.completeOrder(1L) } returns completedOrder

                    val result = service.execute(PlaceOrderUseCase.Command(
                        userId = "user-1",
                        items = listOf(PlaceOrderUseCase.OrderItemCommand(1L, 2, 5000.toBigDecimal()))
                    ))

                    result.orderId shouldBe 1L
                    result.userId shouldBe "user-1"
                    result.status shouldBe "COMPLETED"
                    // ADR-0032 PR-2: outbox INSERT 는 completeOrder TX 내부에서 처리되므로
                    // OrderService 가 직접 publish 호출하지 않는다.
                    verify(exactly = 1) { transactionalService.completeOrder(1L) }
                    verify(exactly = 0) { transactionalService.cancelOrder(any()) }
                }
            }
        }
        `when`("결제 실패 시") {
            then("주문이 취소(cancelOrder)되어야 한다") {
                runTest {
                    val pendingOrder = Order.restore(1L, "user-1",
                        listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))),
                        OrderStatus.PENDING, LocalDateTime.now()
                    )
                    val cancelledOrder = Order.restore(1L, "user-1",
                        listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))),
                        OrderStatus.CANCELLED, LocalDateTime.now()
                    )
                    coEvery { productPort.validateProduct(1L) } returns ProductInfo(
                        productId = 1L, name = "Test Product",
                        price = 1000.toBigDecimal(), status = "ACTIVE", stock = 100
                    )
                    every { transactionalService.savePendingOrder(any()) } returns pendingOrder
                    coEvery { paymentPort.requestPayment(any(), any()) } throws RuntimeException("Payment service down")
                    every { transactionalService.cancelOrder(1L) } returns cancelledOrder

                    shouldThrow<BusinessException> {
                        service.execute(PlaceOrderUseCase.Command(
                            "user-1", listOf(PlaceOrderUseCase.OrderItemCommand(1L, 1, 1000.toBigDecimal()))
                        ))
                    }
                    // ADR-0032 PR-2: outbox INSERT 는 cancelOrder TX 내부에서 처리되므로
                    // OrderService 가 직접 publish 호출하지 않는다.
                    verify(exactly = 1) { transactionalService.cancelOrder(1L) }
                    verify(exactly = 0) { transactionalService.completeOrder(any()) }
                }
            }
        }
    }

    given("주문 조회 시") {
        `when`("존재하는 주문 ID이면") {
            then("주문 정보가 반환되어야 한다") {
                val order = Order.restore(1L, "user-1",
                    listOf(OrderItem.of(1L, 1, Money(1000.toBigDecimal()))),
                    OrderStatus.COMPLETED, LocalDateTime.now()
                )
                every { transactionalService.findById(1L) } returns order

                val result = service.execute(1L)
                result.orderId shouldBe 1L
                result.status shouldBe "COMPLETED"
            }
        }
        `when`("존재하지 않는 주문 ID이면") {
            then("OrderNotFoundException이 발생해야 한다") {
                every { transactionalService.findById(999L) } returns null
                shouldThrow<OrderNotFoundException> { service.execute(999L) }
            }
        }
    }
})
