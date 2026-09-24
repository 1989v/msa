package com.kgd.order.application.order.port

import com.kgd.order.domain.idempotency.model.IdempotencyKey
import java.time.Instant

/** `idempotency_key` — (사용자, 키) 유니크. 각 메서드는 호출자의 order 트랜잭션 안에서 부른다 */
interface IdempotencyKeyRepositoryPort {
    /** 새 PROCESSING 행. 같은 (사용자, 키) 가 있으면 DB 유니크가 `DataIntegrityViolationException` 으로 막는다 */
    fun insert(key: IdempotencyKey)
    fun find(userId: String, key: String): IdempotencyKey?

    /** 리스가 [now] 이전에 끝난 PROCESSING 행만 새 리스로 이어받는다(조건부 UPDATE). 이어받았으면 true */
    fun takeOver(userId: String, key: String, now: Instant, leaseUntil: Instant): Boolean

    fun complete(key: IdempotencyKey)

    /** 처리 실패 — PROCESSING 행을 지워 같은 키로 다시 시도할 수 있게 한다 */
    fun release(userId: String, key: String)

    /** 보관 기한이 지난 행 삭제. 지운 행 수 */
    fun deleteCreatedBefore(cutoff: Instant): Int
}
