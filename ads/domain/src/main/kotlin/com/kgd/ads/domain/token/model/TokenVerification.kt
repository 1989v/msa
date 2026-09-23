package com.kgd.ads.domain.token.model

sealed interface TokenVerification {
    data class Accepted(val claims: ServeClaims) : TokenVerification

    /**
     * 과금하지 않는다. 서명이 맞았으면 [claims] 를 함께 준다 — 만료된 클릭도 랜딩으로는 보내야 해서다.
     * 서명이 틀렸으면 내용을 믿을 수 없으니 null.
     */
    data class Rejected(val reason: EventRejectReason, val claims: ServeClaims?) : TokenVerification
}
