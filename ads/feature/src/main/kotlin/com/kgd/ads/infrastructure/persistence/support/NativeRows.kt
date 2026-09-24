package com.kgd.ads.infrastructure.persistence.support

import java.sql.Timestamp
import java.time.LocalDateTime

/** 네이티브 쿼리 결과 칸 변환 — 드라이버·집계 함수에 따라 숫자·시각의 자바 타입이 달라진다. */
internal object NativeRows {
    fun long(value: Any?): Long = when (value) {
        null -> 0
        is Number -> value.toLong()
        else -> error("숫자 컬럼 형식이 다르다: ${value.javaClass}")
    }

    fun dateTime(value: Any?): LocalDateTime = when (value) {
        is LocalDateTime -> value
        is Timestamp -> value.toLocalDateTime()
        else -> error("시각 컬럼 형식이 다르다: ${value?.javaClass}")
    }
}
