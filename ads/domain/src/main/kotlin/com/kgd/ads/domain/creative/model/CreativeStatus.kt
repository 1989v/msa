package com.kgd.ads.domain.creative.model

/** 심사 상태. 삭제는 행을 지우지 않고 `ARCHIVED` 로 둔다(리포트가 소재 id 를 계속 참조한다). */
enum class CreativeStatus { PENDING, APPROVED, REJECTED, ARCHIVED }
