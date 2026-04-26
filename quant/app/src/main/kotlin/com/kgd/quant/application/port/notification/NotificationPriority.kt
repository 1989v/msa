package com.kgd.quant.application.port.notification

/**
 * TG-P2-10 — 알림 우선순위.
 *
 * Dispatcher 큐에서 dequeue 순서를 결정한다. 같은 priority 내에서는 FIFO.
 *
 * - [CRITICAL] : audit tamper, kill-switch, 긴급 청산 등 즉시 노출 필요
 * - [RISK]     : 손실 한도 / 리스크 한계 위반 — 사용자 개입이 곧 필요
 * - [INFO]     : 체결, 전략 lifecycle 등 일반 알림
 *
 * Phase 2 단순화: 정수 ordinal 비교 (CRITICAL=0 < RISK=1 < INFO=2) 로 우선순위 정렬.
 */
enum class NotificationPriority { CRITICAL, RISK, INFO }
