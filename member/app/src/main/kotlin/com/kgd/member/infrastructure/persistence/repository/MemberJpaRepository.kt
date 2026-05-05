package com.kgd.member.infrastructure.persistence.repository

import com.kgd.member.domain.model.SsoProvider
import com.kgd.member.infrastructure.persistence.entity.MemberJpaEntity
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDateTime

interface MemberJpaRepository : JpaRepository<MemberJpaEntity, Long> {
    fun findBySsoProviderAndSsoProviderId(ssoProvider: SsoProvider, ssoProviderId: String): MemberJpaEntity?

    // === Admin dashboard 집계 ===
    fun countByCreatedAtAfter(from: LocalDateTime): Long
}
