package com.kgd.order.infrastructure.scheduler

import com.kgd.order.application.claim.usecase.ProcessClaimDeadlineUseCase
import com.kgd.order.application.order.usecase.AutoConfirmPurchaseUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/** 클레임 기한 점검 — 답을 기다리는 단계가 기한을 넘으면 같은 명령을 다시 내고, 한도를 넘으면 운영 이슈 */
@Component
class ClaimDeadlineScheduler(
    private val deadlines: ProcessClaimDeadlineUseCase,
    @Value("\${order.claim.deadline-batch-size:50}") private val batchSize: Int,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(
        fixedDelayString = "\${order.claim.deadline-check-interval-ms:5000}",
        initialDelayString = "\${order.claim.deadline-initial-delay-ms:10000}",
    )
    fun run() {
        deadlines.dueOrderIds(batchSize).forEach { orderId ->
            runCatching { deadlines.onDeadline(orderId) }
                .onFailure { log.error(it) { "클레임 기한 처리 실패: orderId=$orderId" } }
        }
    }
}

/** 자동 구매 확정 — 배송 완료 후 `order.purchase-confirm-days`(기본 7)일 지난 ACTIVE 라인. 주문마다 한 트랜잭션 */
@Component
class PurchaseConfirmScheduler(
    private val autoConfirm: AutoConfirmPurchaseUseCase,
    @Value("\${order.purchase-confirm.batch-size:100}") private val batchSize: Int,
) {
    private val log = KotlinLogging.logger {}

    @Scheduled(
        fixedDelayString = "\${order.purchase-confirm.check-interval-ms:600000}",
        initialDelayString = "\${order.purchase-confirm.initial-delay-ms:60000}",
    )
    fun run() {
        autoConfirm.candidateOrderIds(batchSize).forEach { orderId ->
            runCatching { autoConfirm.autoConfirm(orderId) }
                .onFailure { log.error(it) { "자동 구매 확정 실패: orderId=$orderId" } }
        }
    }
}
