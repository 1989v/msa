package com.kgd.member.domain.model

import java.time.LocalDateTime

class Member private constructor(
    val id: Long? = null,
    val email: String,
    private var _name: String,
    val ssoProvider: SsoProvider,
    val ssoProviderId: String,
    private var _status: MemberStatus = MemberStatus.ACTIVE,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    val name: String get() = _name
    val status: MemberStatus get() = _status

    companion object {
        fun create(
            email: String,
            name: String,
            ssoProvider: SsoProvider,
            ssoProviderId: String
        ): Member {
            require(email.isNotBlank()) { "이메일은 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "이름은 비어있을 수 없습니다" }
            return Member(
                email = email,
                _name = name,
                ssoProvider = ssoProvider,
                ssoProviderId = ssoProviderId
            )
        }

        fun restore(
            id: Long?,
            email: String,
            name: String,
            ssoProvider: SsoProvider,
            ssoProviderId: String,
            status: MemberStatus,
            createdAt: LocalDateTime
        ): Member = Member(
            id = id,
            email = email,
            _name = name,
            ssoProvider = ssoProvider,
            ssoProviderId = ssoProviderId,
            _status = status,
            createdAt = createdAt
        )
    }

    fun updateName(name: String) {
        require(name.isNotBlank()) { "이름은 비어있을 수 없습니다" }
        this._name = name
    }

    fun withdraw() {
        check(_status == MemberStatus.ACTIVE) { "활성 상태의 회원만 탈퇴할 수 있습니다" }
        _status = MemberStatus.WITHDRAWN
    }

    fun suspend() {
        check(_status == MemberStatus.ACTIVE) { "활성 상태의 회원만 정지할 수 있습니다" }
        _status = MemberStatus.SUSPENDED
    }

    fun activate() {
        check(_status == MemberStatus.SUSPENDED) { "정지 상태의 회원만 활성화할 수 있습니다" }
        _status = MemberStatus.ACTIVE
    }
}
