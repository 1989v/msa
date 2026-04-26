package com.kgd.quant.application.port.notification

import java.util.UUID

/**
 * TG-P2-10 — 알림 dispatcher 큐에 enqueue 되는 한 건의 알림.
 *
 * @param event           실제 발송할 [NotificationEvent]
 * @param priority        dequeue 순서 결정용 [NotificationPriority]
 * @param tenantId        멀티테넌시 키 — 발송 시 [NotificationSender] 에 그대로 전달
 * @param chatId          채널별 수신자 식별자 (Telegram chat id 등) — 단순화: 현재 단일 chat 가정
 * @param notificationId  dispatcher 멱등키 / 로그 상관관계 ID. 기본값은 v4 UUID.
 */
data class PrioritizedNotification(
    val event: NotificationEvent,
    val priority: NotificationPriority,
    val tenantId: String,
    val chatId: String,
    val notificationId: UUID = UUID.randomUUID(),
)

/**
 * TG-P2-10 — Dispatcher 가 소비할 우선순위 큐 port.
 *
 * ## 계약
 * - [enqueue] 는 non-blocking, 큐 가득 참 정책은 구현체가 책임 (Phase 2 단순화: 무제한)
 * - [dequeue] 는 suspending — 큐가 비면 다음 [enqueue] 까지 대기
 * - [size] 는 메트릭 / 헬스체크용. 정확성은 best-effort (lock-free 추정값 허용)
 *
 * ## Phase 2 가정
 * - replicas=1 + in-memory 구현 → 단일 JVM 가정 (ADR-0025)
 * - Phase 3 multi-replica 시 Redis Sorted Set 또는 Kafka partition 기반으로 교체 예정
 */
interface NotificationPriorityQueue {
    /** 큐에 1건 추가. 우선순위에 따라 dequeue 순서가 결정된다. */
    fun enqueue(item: PrioritizedNotification)

    /** 다음 알림을 가져온다. 큐가 비어있으면 enqueue 발생까지 suspending. */
    suspend fun dequeue(): PrioritizedNotification

    /** 특정 priority 큐의 현재 크기 (gauge / 디버깅용). */
    fun size(priority: NotificationPriority): Int
}
