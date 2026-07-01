package com.kgd.member.infrastructure.persistence.adapter

import com.kgd.member.application.member.port.MemberRepositoryPort
import com.kgd.member.domain.model.Member
import com.kgd.member.domain.model.SsoProvider
import com.kgd.member.infrastructure.persistence.entity.MemberJpaEntity
import com.kgd.member.infrastructure.persistence.repository.MemberJpaRepository
import org.springframework.stereotype.Component

@Component
class MemberRepositoryAdapter(
    private val memberJpaRepository: MemberJpaRepository
) : MemberRepositoryPort {

    override fun save(member: Member): Member {
        val entity = MemberJpaEntity.fromDomain(member)
        return memberJpaRepository.save(entity).toDomain()
    }

    override fun findById(id: Long): Member? {
        return memberJpaRepository.findById(id).orElse(null)?.toDomain()
    }

    override fun findBySsoProviderAndSsoProviderId(ssoProvider: SsoProvider, ssoProviderId: String): Member? {
        return memberJpaRepository.findBySsoProviderAndSsoProviderId(ssoProvider, ssoProviderId)?.toDomain()
    }
}
