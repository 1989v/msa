package com.kgd.codedictionary.domain.resume.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import java.time.LocalDate

/** 프로젝트를 묶는 축. 코드는 URL·필터 키로 쓰이므로 소문자-하이픈만 허용한다. */
data class ResumeCategory(
    val id: Long?,
    val code: String,
    val label: String,
    val description: String?,
    val orderNo: Int,
) {
    init {
        if (!CODE_PATTERN.matches(code)) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 코드 형식이 올바르지 않습니다: $code")
        }
        if (label.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "카테고리 이름은 비어 있을 수 없습니다")
        }
    }

    companion object {
        private val CODE_PATTERN = Regex("^[a-z0-9][a-z0-9-]{0,39}$")
    }
}

data class ResumeCompany(
    val id: Long?,
    val name: String,
    val period: CareerPeriod,
    val position: String?,
    val team: String?,
    val note: String?,
) {
    init {
        if (name.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "회사명은 비어 있을 수 없습니다")
        }
    }

    fun tenure(asOf: LocalDate): Tenure = Tenure(period.months(asOf))
}

data class ResumeProject(
    val id: Long?,
    val title: String,
    val companyId: Long?,
    val categoryId: Long?,
    val period: CareerPeriod?,
    val summary: String?,
    val bodyMarkdown: String?,
    val metrics: List<String>,
    /** 카탈로그의 기술 참조. 자유 문자열을 두지 않는 이유는 V11 마이그레이션 주석 참조 */
    val skillIds: List<Long>,
    /** 이어질 상세 문서의 slug. 문서가 지워져도 프로젝트는 남으므로 참조 무결성을 강제하지 않는다. */
    val detailSlug: String?,
    val orderNo: Int,
    val published: Boolean,
) {
    init {
        if (title.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "프로젝트 제목은 비어 있을 수 없습니다")
        }
    }
}

data class ResumeSkillGroup(
    val id: Long?,
    val label: String,
    val note: String?,
    val orderNo: Int,
) {
    init {
        if (label.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "기술 스택 그룹명은 비어 있을 수 없습니다")
        }
    }
}

/**
 * 개별 기술. 프로젝트가 이름이 아니라 이 식별자를 참조한다 —
 * 오타가 새 기술이 되는 일을 막고, 기술 하나로 프로젝트를 모아볼 수 있게 한다.
 */
data class ResumeSkill(
    val id: Long?,
    val name: String,
    /** null 이면 미분류 */
    val groupId: Long?,
    val orderNo: Int,
) {
    init {
        if (name.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "기술명은 비어 있을 수 없습니다")
        }
    }
}
