package com.kgd.member.infrastructure.persistence.repository

import com.kgd.member.domain.model.SsoProvider
import com.kgd.member.infrastructure.persistence.entity.MemberJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface MemberJpaRepository : JpaRepository<MemberJpaEntity, Long> {
    fun findBySsoProviderAndSsoProviderId(ssoProvider: SsoProvider, ssoProviderId: String): MemberJpaEntity?
}
