package com.kgd.place.domain.attraction.model

/**
 * 관광지가 공개 면(상세·단축 주소)에 나가는지. search 색인 배치가 ACTIVE 행만 싣는 것과 같은 판정이다 —
 * 공개 상세는 그 색인을 읽으므로, 여기서 다른 상태를 열면 상세가 없는 주소로 보내게 된다.
 */
fun Attraction.isActive(): Boolean = status == ACTIVE_STATUS

private const val ACTIVE_STATUS = "ACTIVE"
