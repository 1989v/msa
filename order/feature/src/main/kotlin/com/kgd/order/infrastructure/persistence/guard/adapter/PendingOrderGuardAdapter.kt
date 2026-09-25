package com.kgd.order.infrastructure.persistence.guard.adapter

import com.kgd.order.application.order.port.PendingOrderGuardPort
import com.kgd.order.infrastructure.persistence.guard.repository.MemberOrderGuardJpaRepository
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component
import java.time.Clock

@Component
class PendingOrderGuardAdapter(
    private val jpa: MemberOrderGuardJpaRepository,
    @Qualifier("orderClock") private val clock: Clock,
) : PendingOrderGuardPort {

    override fun ensure(userId: String) {
        jpa.insertIfAbsent(userId, clock.instant())
    }

    override fun lock(userId: String) {
        checkNotNull(jpa.findForUpdate(userId)) { "접수 잠금 행이 없다 — ensure 를 먼저 커밋해야 한다: userId=$userId" }
    }
}
