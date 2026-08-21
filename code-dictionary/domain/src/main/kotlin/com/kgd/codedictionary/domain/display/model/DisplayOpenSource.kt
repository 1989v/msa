package com.kgd.codedictionary.domain.display.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 1989v.com 메인에 전시하는 공개 오픈소스 저장소 (ADR-0066 의 전시 축 확장).
 *
 * [DisplayService] 와 같은 전시 대상이지만 목적지가 플랫폼 밖(GitHub)이라
 * 상태 기계가 없다 — 전시 여부는 [active] 하나로 가른다.
 */
data class DisplayOpenSource(
    val id: Long?,
    val slug: String,
    val name: String,
    val tagline: String,
    val description: String?,
    val repoUrl: String,
    val language: String,
    val orderNo: Int,
    val active: Boolean,
) {
    init {
        if (!SLUG_PATTERN.matches(slug)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "오픈소스 슬러그 형식이 올바르지 않습니다: $slug")
        }
        if (name.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "오픈소스 이름은 비어 있을 수 없습니다")
        }
        // 카드 전체가 저장소로 가는 링크다 — 갈 곳 없는 카드는 눌러도 아무 일이 없다
        if (!repoUrl.startsWith("https://")) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "저장소 주소는 https 여야 합니다: $repoUrl")
        }
    }

    companion object {
        private val SLUG_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,59}$")
    }
}
