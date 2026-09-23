package com.kgd.ads.domain.token.model

import java.time.Instant

/** 검증을 통과한 토큰의 내용. */
data class ServeClaims(val kind: TokenKind, val ad: ServedAd, val issuedAt: Instant, val keyId: String)
