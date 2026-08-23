package com.kgd.codedictionary.domain.techdomain.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * /tech 도메인 맵의 루트 — **만들어본 업무 도메인**이다.
 *
 * 개념의 `category`(기술 분류)와는 축이 다르다. `saga-pattern` 은 DESIGN_PATTERN 이지만
 * 주문·결제에서 쓴 것이고, `rate-limiting` 은 SECURITY 지만 파트너 연동과 데이터 수집에
 * 동시에 걸린다. category 로 유도할 수 없는 지식이라 매핑을 데이터로 들고 있는다.
 *
 * 그래서 [conceptIds] 는 도메인 간 배타적이지 않다 — 같은 개념이 여러 도메인에 실릴 수 있고,
 * 어느 도메인에도 실리지 않는 개념도 있다(검색·트리맵으로 닿는다).
 */
data class TechDomain(
    val id: Long?,
    val code: String,
    val label: String,
    val tagline: String?,
    val orderNo: Int,
    val active: Boolean,
    val conceptIds: List<String>,
) {
    init {
        if (!CODE_PATTERN.matches(code)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "기술 도메인 코드 형식이 올바르지 않습니다: $code")
        }
        if (label.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "기술 도메인 이름은 비어 있을 수 없습니다")
        }
        // 개념이 하나도 없으면 맵에서 눌러도 아무것도 펼쳐지지 않는 빈 루트가 된다
        if (active && conceptIds.isEmpty()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "활성 기술 도메인에는 개념이 최소 하나 필요합니다: $code")
        }
        if (conceptIds.distinct().size != conceptIds.size) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "기술 도메인 안에 중복된 개념이 있습니다: $code")
        }
    }

    companion object {
        private val CODE_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,39}$")
    }
}
