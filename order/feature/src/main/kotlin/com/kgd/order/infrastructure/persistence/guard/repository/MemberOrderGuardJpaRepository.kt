package com.kgd.order.infrastructure.persistence.guard.repository

import com.kgd.order.infrastructure.persistence.guard.entity.MemberOrderGuardJpaEntity
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant

interface MemberOrderGuardJpaRepository : JpaRepository<MemberOrderGuardJpaEntity, String> {
    /** 있으면 아무것도 하지 않는다 — 동시에 둘이 만들어도 하나만 남고 둘 다 성공한다 */
    @Modifying
    @Query(value = "INSERT IGNORE INTO member_order_guard (user_id, created_at) VALUES (:userId, :createdAt)", nativeQuery = true)
    fun insertIfAbsent(userId: String, createdAt: Instant): Int

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT g FROM MemberOrderGuardJpaEntity g WHERE g.userId = :userId")
    fun findForUpdate(userId: String): MemberOrderGuardJpaEntity?
}
