package com.kgd.codedictionary.application.portfolio.dto

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import org.springframework.data.domain.Sort

enum class PortfolioSort {
    TIME,
    IMPACT;

    fun toSpringSort(): Sort = when (this) {
        TIME -> Sort.by(Sort.Direction.DESC, "createdAt")
        IMPACT -> Sort.by(Sort.Direction.DESC, "impact").and(Sort.by(Sort.Direction.DESC, "createdAt"))
    }

    companion object {
        fun parse(raw: String?): PortfolioSort = when (raw?.lowercase()) {
            null, "", "time" -> TIME
            "impact" -> IMPACT
            else -> throw BusinessException(ErrorCode.INVALID_INPUT, "Unknown sort: $raw")
        }
    }
}
