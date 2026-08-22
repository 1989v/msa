package com.kgd.member.domain.model

import java.time.LocalDateTime

class Member private constructor(
    val id: Long? = null,
    private var _name: String,
    val ssoProvider: SsoProvider,
    /**
     * 소셜 제공자 식별값의 **해시** (ADR-0078). auth 가 HMAC 을 씌워 넘긴다 —
     * 원본 `sub` 은 이 서비스에 들어오지 않는다.
     */
    val ssoProviderId: String,
    private var _status: MemberStatus = MemberStatus.ACTIVE,
    val createdAt: LocalDateTime = LocalDateTime.now()
) {
    val name: String get() = _name
    val status: MemberStatus get() = _status

    companion object {
        /**
         * 가입. 표시 이름은 받지 않고 만든다 — 소셜 계정의 실명·닉네임을 수집하지 않기
         * 때문이다. 사용자가 [updateName] 으로 언제든 바꿀 수 있다.
         */
        fun create(
            ssoProvider: SsoProvider,
            ssoProviderId: String,
            name: String = Nickname.generate()
        ): Member {
            require(ssoProviderId.isNotBlank()) { "소셜 식별값은 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "이름은 비어있을 수 없습니다" }
            return Member(
                _name = name,
                ssoProvider = ssoProvider,
                ssoProviderId = ssoProviderId
            )
        }

        fun restore(
            id: Long?,
            name: String,
            ssoProvider: SsoProvider,
            ssoProviderId: String,
            status: MemberStatus,
            createdAt: LocalDateTime
        ): Member = Member(
            id = id,
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
