package com.kgd.quant.infrastructure.notification

import com.kgd.quant.application.port.notification.NotificationPriority
import com.kgd.quant.application.port.notification.NotificationPriorityQueue
import com.kgd.quant.application.port.notification.PrioritizedNotification
import kotlinx.coroutines.channels.Channel
import org.springframework.stereotype.Component
import java.util.concurrent.LinkedBlockingQueue

/**
 * TG-P2-10 — Priority queue 의 in-memory 구현.
 *
 * ## 동작
 * - 우선순위별로 [LinkedBlockingQueue] 를 1개씩 둔다 (총 3개: CRITICAL/RISK/INFO).
 * - [enqueue] → 해당 priority 큐에 put + [notify] 채널에 1건 시그널 (Channel.UNLIMITED 라 drop 없음).
 * - [dequeue] → CRITICAL → RISK → INFO 순서로 poll, 모두 비어있으면 [notify] 수신 대기.
 *
 * ## Phase 2 단순화
 * - 단일 JVM (replicas=1, ADR-0025) 가정.
 * - 큐 용량 제한 없음 (in-memory ConcurrentLinkedQueue 와 동등 효과).
 *   → CRITICAL/RISK 알림이 폭주해도 dispatcher 가 read 하지 못하면 메모리만 증가.
 *   Phase 3 분산 큐 도입 시 backpressure / cap 정책을 명시한다.
 *
 * ## Race-condition 고려
 * - "enqueue → 즉시 dequeue 가 race 로 빈 큐를 보고 wait" 시나리오는 [notify] 시그널이 채널에 적재되어
 *   즉시 wakeup 되므로 deadlock 없음. UNLIMITED capacity 라 trySend 실패 가능성도 없다.
 * - 동일 priority 동시 enqueue 는 [LinkedBlockingQueue] 가 thread-safe 하므로 안전.
 */
@Component
class InMemoryPriorityQueue : NotificationPriorityQueue {

    private val queues: Map<NotificationPriority, LinkedBlockingQueue<PrioritizedNotification>> =
        NotificationPriority.values().associateWith { LinkedBlockingQueue() }

    /**
     * dequeue 가 빈 큐를 만났을 때 대기/깨움 용도. capacity = UNLIMITED 라 enqueue 가 절대 block 되지 않는다.
     * 시그널 누적을 허용하는 이유: dequeue 1번 호출 = 1건 소비라 1:1 매핑이 가장 단순.
     */
    private val notify: Channel<Unit> = Channel(capacity = Channel.UNLIMITED)

    override fun enqueue(item: PrioritizedNotification) {
        // queues[priority] 는 enum 전수 등록이라 절대 null 이 아니다.
        queues.getValue(item.priority).put(item)
        notify.trySend(Unit)
    }

    override suspend fun dequeue(): PrioritizedNotification {
        while (true) {
            // 우선순위 정의 순서(CRITICAL → RISK → INFO) 대로 poll
            for (priority in NotificationPriority.values()) {
                val item = queues.getValue(priority).poll()
                if (item != null) return item
            }
            // 모두 비어있으면 다음 enqueue 까지 대기
            notify.receive()
        }
    }

    override fun size(priority: NotificationPriority): Int = queues.getValue(priority).size
}
