package com.kgd.order.infrastructure.persistence.idempotency.adapter

import com.kgd.order.application.order.port.IdempotencyKeyRepositoryPort
import com.kgd.order.domain.idempotency.model.IdempotencyKey
import com.kgd.order.infrastructure.persistence.idempotency.entity.IdempotencyKeyJpaEntity
import com.kgd.order.infrastructure.persistence.idempotency.repository.IdempotencyKeyJpaRepository
import org.springframework.stereotype.Component
import java.time.Instant

@Component
class IdempotencyKeyRepositoryAdapter(
    private val jpa: IdempotencyKeyJpaRepository,
) : IdempotencyKeyRepositoryPort {

    override fun insert(key: IdempotencyKey) {
        jpa.saveAndFlush(
            IdempotencyKeyJpaEntity(
                userId = key.userId, idemKey = key.key, status = key.status, leaseUntil = key.leaseUntil,
                response = key.response, createdAt = key.createdAt,
            ),
        )
    }

    override fun find(userId: String, key: String): IdempotencyKey? =
        jpa.findByUserIdAndIdemKey(userId, key)?.let {
            IdempotencyKey.restore(it.userId, it.idemKey, it.status, it.leaseUntil, it.response, it.createdAt)
        }

    override fun takeOver(userId: String, key: String, now: Instant, leaseUntil: Instant): Boolean =
        jpa.takeOver(userId, key, now, leaseUntil) == 1

    override fun complete(key: IdempotencyKey) {
        val entity = requireNotNull(jpa.findByUserIdAndIdemKey(key.userId, key.key)) { "멱등 키가 없다: ${key.key}" }
        entity.status = key.status
        entity.response = key.response
        jpa.saveAndFlush(entity)
    }

    override fun release(userId: String, key: String) {
        jpa.deleteProcessing(userId, key)
    }

    override fun deleteCreatedBefore(cutoff: Instant): Int = jpa.deleteCreatedBefore(cutoff)
}
