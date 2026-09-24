package com.kgd.common.messaging.outbox

/**
 * 아웃박스 행을 쓸 때 **지금 실행 문맥**에서 가져와 함께 남길 Kafka 헤더(`traceparent` 등).
 *
 * 릴레이는 스케줄러 스레드에서 돌아 요청의 추적 문맥이 없다 — 행을 쓰는 순간에 받아 두지 않으면
 * 발행된 이벤트가 새 추적으로 시작해 요청과 컨슈머 로그가 이어지지 않는다.
 */
fun interface OutboxHeaderSource {
    fun headers(): Map<String, String>

    companion object {
        val NONE = OutboxHeaderSource { emptyMap() }
    }
}
