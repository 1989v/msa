package com.kgd.ads.infrastructure.persistence.audit.adapter

import com.kgd.ads.application.audit.dto.AdminAction
import com.kgd.ads.application.audit.port.AdminAuditPort
import com.kgd.ads.infrastructure.persistence.audit.entity.AdminActionJpaEntity
import com.kgd.ads.infrastructure.persistence.audit.repository.AdminActionJpaRepository
import org.springframework.stereotype.Component

@Component
class AdminAuditAdapter(
    private val repository: AdminActionJpaRepository,
) : AdminAuditPort {

    override fun record(action: AdminAction) {
        repository.save(
            AdminActionJpaEntity(
                actorMemberId = action.actorMemberId,
                action = action.action,
                targetType = action.targetType,
                targetId = action.targetId,
                detail = action.detail?.take(MAX_DETAIL),
                createdAt = action.at,
            ),
        )
    }

    private companion object {
        const val MAX_DETAIL = 512
    }
}
