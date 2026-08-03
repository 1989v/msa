package com.kgd.member.application.member.port

import com.kgd.member.domain.model.Member
import com.kgd.member.domain.model.SsoProvider

interface MemberRepositoryPort {
    fun save(member: Member): Member
    fun findById(id: Long): Member?
    fun findBySsoProviderAndSsoProviderId(ssoProvider: SsoProvider, ssoProviderId: String): Member?
}
