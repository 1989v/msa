package com.kgd.quant.infrastructure.notification

import com.kgd.quant.application.port.notification.NotificationPriorityQueue
import com.kgd.quant.application.port.notification.NotificationSender
import com.kgd.quant.domain.common.TenantId
import com.kgd.quant.infrastructure.metrics.QuantMetrics
import io.github.oshai.kotlinlogging.KotlinLogging
import jakarta.annotation.PostConstruct
import jakarta.annotation.PreDestroy
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

private val log = KotlinLogging.logger {}

/**
 * TG-P2-10 — 알림 dispatcher worker.
 *
 * 단일 coroutine 으로 [NotificationPriorityQueue.dequeue] 를 무한 polling 하며
 * 꺼낸 [com.kgd.quant.application.port.notification.PrioritizedNotification] 을
 * [NotificationSender] 에 위임한다.
 *
 * ## Lifecycle
 * - [PostConstruct] → 백그라운드 worker launch + queue depth gauge 등록.
 * - [PreDestroy] → cancel() 로 graceful shutdown. send 진행 중인 항목은 cancel 시그널을 받는다.
 *
 * ## Phase 2 가정
 * - replicas=1 → 단일 worker 면 충분.
 * - dispatcher 자체는 stateless. 큐가 in-memory 이므로 pod 재시작 시 적재된 알림은 손실됨.
 *   (durability 필요 시 Phase 3 에서 Redis Streams 또는 Outbox 기반으로 교체)
 *
 * ## 비활성화
 * - `quant.notification.dispatcher.enabled=false` 로 끄면 worker 가 등록되지 않는다.
 *   주로 통합 테스트 / 일회성 jobs 에서 dispatcher 백그라운드 동작을 막을 때 사용.
 */
@Component
@ConditionalOnProperty(
    name = ["quant.notification.dispatcher.enabled"],
    havingValue = "true",
    matchIfMissing = true,
)
class NotificationDispatcher(
    private val queue: NotificationPriorityQueue,
    private val sender: NotificationSender,
    private val metrics: QuantMetrics,
) {

    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var job: Job? = null

    @PostConstruct
    fun start() {
        // queue depth gauge 등록 (idempotent)
        runCatching { metrics.registerNotificationQueueDepth(queue) }
            .onFailure { log.warn(it) { "notification queue depth gauge registration failed" } }

        job = scope.launch {
            log.info { "notification dispatcher started" }
            while (isActive) {
                try {
                    val item = queue.dequeue()
                    val result = sender.send(TenantId(item.tenantId), item.event)
                    log.debug {
                        "notification dispatched notificationId=${item.notificationId} " +
                            "priority=${item.priority.name} result=${result::class.simpleName}"
                    }
                } catch (ce: CancellationException) {
                    throw ce
                } catch (ex: Exception) {
                    // dispatcher loop 가 죽지 않도록 모든 예외를 흡수.
                    log.error(ex) { "notification dispatcher loop error: ${ex.message}" }
                }
            }
        }
    }

    @PreDestroy
    fun stop() {
        log.info { "notification dispatcher stopping" }
        runCatching { job?.cancel() }
        runCatching { scope.cancel() }
    }
}
