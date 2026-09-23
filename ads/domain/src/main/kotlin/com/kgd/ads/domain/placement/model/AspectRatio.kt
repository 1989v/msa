package com.kgd.ads.domain.placement.model

import com.kgd.ads.domain.placement.exception.InvalidPlacementException

/** 가로:세로 비율 표기(`1.91:1`). 소재와 지면이 같은 표기를 쓰면 맞는 것이다. */
@JvmInline
value class AspectRatio private constructor(val value: String) {
    companion object {
        private val PATTERN = Regex("""^[1-9]\d*(\.\d+)?:[1-9]\d*(\.\d+)?$""")

        fun of(value: String): AspectRatio {
            if (!PATTERN.matches(value)) throw InvalidPlacementException("비율 표기가 올바르지 않습니다: $value")
            return AspectRatio(value)
        }

        /** 저장 형식 `1.91:1,1:1` 을 푼다. */
        fun parseList(values: String): Set<AspectRatio> =
            values.split(',').map { of(it.trim()) }.toSet()
    }
}
