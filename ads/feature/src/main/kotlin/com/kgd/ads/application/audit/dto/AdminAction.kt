package com.kgd.ads.application.audit.dto

import java.time.LocalDateTime

/**
 * 운영자 변경 한 건. [targetType] 은 표 이름이 아니라 도메인 대상(`CREATIVE`·`ADVERTISER`·`PLACEMENT` …),
 * [detail] 은 사람이 읽는 요약(반려 사유 코드·바뀐 값 등).
 */
data class AdminAction(
    val actorMemberId: Long,
    val action: String,
    val targetType: String,
    val targetId: String,
    val detail: String?,
    val at: LocalDateTime,
)
