package com.kgd.member.application.member.port

import com.kgd.member.domain.model.Member
import com.kgd.member.domain.model.SsoProvider
import java.time.LocalDateTime

interface MemberRepositoryPort {
    fun save(member: Member): Member
    fun findById(id: Long): Member?
    fun findBySsoProviderAndSsoProviderId(ssoProvider: SsoProvider, ssoProviderId: String): Member?

    /** 어드민 대시보드 집계 — 회원 전체 수. */
    fun countAll(): Long

    /** 어드민 대시보드 집계 — [from] 이후 가입한 회원 수. */
    fun countJoinedAfter(from: LocalDateTime): Long
}
