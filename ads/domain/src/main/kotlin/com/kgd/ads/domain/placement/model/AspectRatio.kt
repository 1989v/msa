package com.kgd.ads.domain.placement.model

import com.kgd.ads.domain.placement.exception.InvalidPlacementException
import kotlin.math.abs

/**
 * 가로:세로 비율 표기(`1.91:1`). 지면이 허용 비율을 이 표기로 갖고, 소재는 이미지의 가로·세로 픽셀로
 * [fits] 를 판정한다 — 1200×628 은 1.9108 이라 표기와 정확히 같을 수 없어 상대 오차 1% 를 허용한다.
 * 업로드 검사와 결정의 형식 일치 판정이 이 함수 하나를 쓴다.
 */
@JvmInline
value class AspectRatio private constructor(val value: String) {
    val ratio: Double
        get() = value.substringBefore(':').toDouble() / value.substringAfter(':').toDouble()

    fun fits(width: Int, height: Int): Boolean =
        width > 0 && height > 0 && abs(width.toDouble() / height / ratio - 1.0) <= TOLERANCE

    companion object {
        const val TOLERANCE = 0.01

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
