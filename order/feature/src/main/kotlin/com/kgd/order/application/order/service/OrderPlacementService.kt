package com.kgd.order.application.order.service

import com.kgd.order.application.order.port.IdempotencyKeyRepositoryPort
import com.kgd.order.application.order.port.OrderRepositoryPort
import com.kgd.order.application.order.port.PendingOrderGuardPort
import com.kgd.order.application.order.usecase.CleanupIdempotencyKeysUseCase
import com.kgd.order.application.order.usecase.OrderAccepted
import com.kgd.order.application.order.usecase.PlaceOrderUseCase
import com.kgd.order.application.saga.service.OrderSagaCoordinator
import com.kgd.order.application.sheet.port.OrderSheetRepositoryPort
import com.kgd.order.domain.idempotency.model.IdempotencyKey
import com.kgd.order.domain.order.exception.IdempotencyKeyInProgressException
import com.kgd.order.domain.order.exception.IdempotencyKeyReusedException
import com.kgd.order.domain.order.exception.TooManyPendingOrdersException
import com.kgd.order.domain.order.model.Order
import com.kgd.order.domain.sheet.exception.OrderSheetNotFoundException
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.beans.factory.annotation.Value
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.ObjectMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

/**
 * 주문 접수 (스펙 SR-4). 멱등 키 선점 → (한 트랜잭션) 회원 잠금 행 FOR UPDATE · 결제 대기 상한 · 주문서 검증 · 주문 · 주문서 사용 표시 · 사가 시작 ·
 * 첫 명령 · 멱등 키 완료(응답 스냅샷) → 커밋. 실패하면 선점한 키를 풀어 같은 키로 다시 시도할 수 있게 한다.
 *
 * 선점은 따로 커밋해야 동시에 온 같은 키가 그것을 보고 409 를 받는다. 리스(60초)가 지난 PROCESSING 은 앞선 요청이
 * 죽었다고 보고 이어받는다 — 앞선 요청이 늦게라도 커밋하면 주문서 `@Version`·사용 표시가 두 번째 주문을 막는다.
 * 같은 키에 다른 본문이면 상태와 무관하게 422 다 — 앞선 응답을 재생하면 클라이언트가 다른 주문이 접수된 줄 안다.
 *
 * 결제 대기 상한은 회원 잠금 행([PendingOrderGuardPort])으로 줄 세운 뒤 센다. 잠금 없이 세면 같은 회원의 동시 요청이
 * 모두 상한 아래로 읽고 전부 들어간다(다른 멱등 키 · 다른 주문서).
 */
@Service
class OrderPlacementService(
    private val orders: OrderRepositoryPort,
    private val sheets: OrderSheetRepositoryPort,
    private val keys: IdempotencyKeyRepositoryPort,
    private val guards: PendingOrderGuardPort,
    private val saga: OrderSagaCoordinator,
    private val objectMapper: ObjectMapper,
    @Qualifier("orderClock") private val clock: Clock,
    @Qualifier("orderTransactionManager") transactionManager: PlatformTransactionManager,
    @Value("\${order.pending-order-limit:3}") private val pendingOrderLimit: Int,
) : PlaceOrderUseCase, CleanupIdempotencyKeysUseCase {

    private val log = KotlinLogging.logger {}
    private val tx = TransactionTemplate(transactionManager)

    override fun place(command: PlaceOrderUseCase.Command): OrderAccepted {
        val now = clock.instant()
        acquire(command, now)?.let { replay -> return objectMapper.readValue(replay, OrderAccepted::class.java) }
        return try {
            tx.executeWithoutResult { guards.ensure(command.userId) }
            requireNotNull(tx.execute { accept(command, now) })
        } catch (e: RuntimeException) {
            runCatching { tx.executeWithoutResult { keys.release(command.userId, command.idempotencyKey) } }
                .onFailure { log.warn(it) { "멱등 키 해제 실패 — 리스 만료 뒤 재시도 가능: key=${command.idempotencyKey}" } }
            throw e
        }
    }

    override fun cleanup(): Int = requireNotNull(tx.execute { keys.deleteCreatedBefore(clock.instant().minus(IdempotencyKey.RETENTION)) })

    /** 키 선점. 이미 완료된 키면 저장한 응답을 돌려주고, 처리 중이면 409, 본문이 다르면 422. 선점했으면 null */
    private fun acquire(command: PlaceOrderUseCase.Command, now: Instant): String? {
        val fresh = IdempotencyKey.begin(command.userId, command.idempotencyKey, now, command.requestHash)
        val inserted = try {
            tx.executeWithoutResult { keys.insert(fresh) }
            true
        } catch (e: DataIntegrityViolationException) {
            false
        }
        if (inserted) return null

        val existing = tx.execute { keys.find(command.userId, command.idempotencyKey) }
            ?: throw IdempotencyKeyInProgressException() // 방금 풀렸다 — 클라이언트가 다시 보내면 된다
        return when (val decision = existing.decide(now, command.requestHash)) {
            IdempotencyKey.Decision.Mismatch -> throw IdempotencyKeyReusedException()
            is IdempotencyKey.Decision.Replay -> decision.response
            IdempotencyKey.Decision.InProgress -> throw IdempotencyKeyInProgressException()
            IdempotencyKey.Decision.LeaseExpired -> {
                val takenOver = tx.execute {
                    keys.takeOver(command.userId, command.idempotencyKey, now, now.plus(IdempotencyKey.LEASE))
                } == true
                if (!takenOver) throw IdempotencyKeyInProgressException()
                log.info { "리스가 지난 멱등 키를 이어받는다: userId=${command.userId}, key=${command.idempotencyKey}" }
                null
            }
        }
    }

    private fun accept(command: PlaceOrderUseCase.Command, now: Instant): OrderAccepted {
        guards.lock(command.userId)
        if (orders.countAwaitingPayment(command.userId) >= pendingOrderLimit) throw TooManyPendingOrdersException(pendingOrderLimit)
        val sheet = sheets.findById(command.orderSheetId) ?: throw OrderSheetNotFoundException(command.orderSheetId)
        sheet.checkUsableBy(command.userId, now)

        val order = orders.save(Order.place(command.userId, sheet, now, ZONE))
        val orderId = requireNotNull(order.id)
        sheet.markUsed(orderId, command.userId, now)
        sheets.save(sheet)
        val started = saga.start(order)

        val accepted = OrderAccepted(orderId, order.status.name, started.step.name)
        val key = requireNotNull(keys.find(command.userId, command.idempotencyKey)) { "선점한 멱등 키가 없다: ${command.idempotencyKey}" }
        key.complete(objectMapper.writeValueAsString(accepted))
        keys.complete(key)
        log.info { "주문 접수: orderId=$orderId, userId=${command.userId}, payable=${order.payableAmount}" }
        return accepted
    }

    private companion object {
        /** 주문 생성 시각(LocalDateTime) — JVM 기본 시간대. 대시보드 집계가 이 기준이다 */
        val ZONE: ZoneId = ZoneId.systemDefault()
    }
}
