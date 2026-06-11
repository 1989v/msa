package com.kgd.order.application.order.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.order.application.order.port.PaymentPort
import com.kgd.order.application.order.port.ProductPort
import com.kgd.order.application.order.usecase.GetMyOrdersUseCase
import com.kgd.order.application.order.usecase.GetOrderUseCase
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.domain.order.exception.OrderNotFoundException
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service

@Service
class OrderService(
    private val orderTransactionalService: OrderTransactionalService,
    private val paymentPort: PaymentPort,
    private val productPort: ProductPort,
) : PlaceOrderUseCase, GetOrderUseCase, GetMyOrdersUseCase {

    private val log = KotlinLogging.logger {}

    /**
     * Places an order with the following transaction flow:
     * 1. Validate products via Product service
     * 2. TX1: Save PENDING order (short transaction, commits)
     * 3. No TX: Call external payment service
     * 4. TX2: Mark order COMPLETED or CANCELLED based on payment result. ADR-0032 PR-2 부터
     *    outbox INSERT 가 같은 TX 안에서 함께 commit 되어 별도 publish 호출은 필요 없다.
     *
     * This ensures no DB connection is held during the external payment HTTP call.
     */
    override suspend fun execute(command: PlaceOrderUseCase.Command): PlaceOrderUseCase.Result {
        // Phase 0: Product 유효성 검증
        for (item in command.items) {
            val productInfo = productPort.validateProduct(item.productId)
            if (productInfo.status != "ACTIVE") {
                throw BusinessException(
                    ErrorCode.INVALID_PRODUCT_STATUS,
                    "비활성 상품은 주문할 수 없습니다: productId=${item.productId}"
                )
            }
            log.debug {
                "상품 검증 완료: productId=${item.productId}, name=${productInfo.name}, " +
                    "price=${productInfo.price}, clientPrice=${item.unitPrice}"
            }
        }

        // Phase 1: Save PENDING order (short transaction, immediately committed)
        val pendingOrder = orderTransactionalService.savePendingOrder(command)
        val orderId = requireNotNull(pendingOrder.id) { "저장된 주문에 ID가 없습니다" }

        // Phase 2: Call external payment service (no transaction held)
        val paymentResult = try {
            paymentPort.requestPayment(orderId, pendingOrder.totalAmount.amount)
        } catch (e: Exception) {
            log.error(e) { "Payment failed for orderId=$orderId, cancelling order" }
            orderTransactionalService.cancelOrder(orderId)
            throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "결제 서비스 호출 실패: ${e.message}")
        }

        // Phase 3: Update order status based on payment result (short transaction)
        return if (paymentResult.status == "SUCCESS") {
            val completed = orderTransactionalService.completeOrder(orderId)
            PlaceOrderUseCase.Result(
                orderId = requireNotNull(completed.id),
                userId = completed.userId,
                totalAmount = completed.totalAmount.amount,
                status = completed.status.name
            )
        } else {
            log.warn { "Payment returned non-SUCCESS status=${paymentResult.status} for orderId=$orderId" }
            orderTransactionalService.cancelOrder(orderId)
            throw BusinessException(ErrorCode.EXTERNAL_API_ERROR, "결제 실패: ${paymentResult.status}")
        }
    }

    override fun execute(id: Long): GetOrderUseCase.Result {
        val order = orderTransactionalService.findById(id) ?: throw OrderNotFoundException(id)
        return GetOrderUseCase.Result(
            orderId = requireNotNull(order.id),
            userId = order.userId,
            totalAmount = order.totalAmount.amount,
            status = order.status.name
        )
    }

    override fun execute(userId: String): List<GetMyOrdersUseCase.Result> =
        orderTransactionalService.findAllByUserId(userId).map { order ->
            GetMyOrdersUseCase.Result(
                orderId = requireNotNull(order.id),
                totalAmount = order.totalAmount.amount,
                status = order.status.name,
                createdAt = order.createdAt,
                items = order.items.map { item ->
                    GetMyOrdersUseCase.Item(
                        productId = item.productId,
                        quantity = item.quantity,
                        unitPrice = item.unitPrice.amount,
                    )
                },
            )
        }
}
