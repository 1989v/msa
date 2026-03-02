package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.OrderEventPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.port.PaymentPort
import com.kgd.order.application.order.port.PaymentResult
import com.kgd.order.application.order.usecase.GetOrderUseCase
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
import java.math.BigDecimal
import java.time.LocalDateTime

class OrderServiceTest : BehaviorSpec({
    val repositoryPort = mockk<OrderRepositoryPort>()
    val eventPort = mockk<OrderEventPort>(relaxed = true)
    val paymentPort = mockk<PaymentPort>()
    val service = OrderService(repositoryPort, eventPort, paymentPort)

    beforeEach { clearMocks(repositoryPort, eventPort, paymentPort) }

    given("주문 생성 시") {
        `when`("유효한 주문 커맨드와 결제 성공") {
            then("주문이 저장되고 결제가 처리되어야 한다") {
                runTest {
                    val savedOrder = Order.restore(
                        1L, "user-1",
                        listOf(OrderItem.of(1L, 2, Money(5000.toBigDecimal()))),
                        OrderStatus.PENDING, LocalDateTime.now()
                    )
                    every { repositoryPort.save(any()) } returns savedOrder
                    coEvery { paymentPort.requestPayment(any(), any()) } returns PaymentResult("pay-1", "SUCCESS", 10000.toBigDecimal())

                    val result = service.execute(PlaceOrderUseCase.Command(
                        userId = "user-1",
                        items = listOf(PlaceOrderUseCase.OrderItemCommand(1L, 2, 5000.toBigDecimal()))
                    ))

                    result.orderId shouldBe 1L
                    result.userId shouldBe "user-1"
                    result.status shouldBe "COMPLETED"
                    verify(exactly = 1) { eventPort.publishOrderCompleted(any()) }
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
                every { repositoryPort.findById(1L) } returns order

                val result = service.execute(1L)
                result.orderId shouldBe 1L
                result.status shouldBe "COMPLETED"
            }
        }
        `when`("존재하지 않는 주문 ID이면") {
            then("OrderNotFoundException이 발생해야 한다") {
                every { repositoryPort.findById(999L) } returns null
                shouldThrow<OrderNotFoundException> { service.execute(999L) }
            }
        }
    }
})
