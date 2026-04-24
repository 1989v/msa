package com.kgd.sevensplit.domain.common

/**
 * TenantId — 불투명 문자열 식별자.
 *
 * - 멀티테넌시 환경에서 각 논리 계정을 구분하는 ID.
 * - 형식은 opaque. 공백 여부만 도메인 차원에서 검증한다.
 */
@JvmInline
value class TenantId(val value: String) {
    init {
        require(value.isNotBlank()) { "TenantId must not be blank" }
    }

    override fun toString(): String = value
}
