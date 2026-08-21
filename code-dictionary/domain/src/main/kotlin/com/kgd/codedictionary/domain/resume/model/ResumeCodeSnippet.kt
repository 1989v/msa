package com.kgd.codedictionary.domain.resume.model

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode

/**
 * 프로젝트에 붙는 실제 코드 스니펫.
 *
 * 저장은 항상 전문이다 — 공개면(`/portfolio`)의 "상단 일부만" 은 여기의 [preview] 가
 * 잘라 만들고, 게이트 뒤 이력서는 [code] 를 그대로 싣는다. 자르는 규칙이 도메인에 있는
 * 이유는 하나다: 조립부마다 다르게 자르면 두 화면이 다른 미리보기를 말하게 된다.
 */
data class ResumeCodeSnippet(
    val id: Long?,
    val projectId: Long,
    val title: String?,
    val language: String,
    val filePath: String?,
    val lineStart: Int?,
    val lineEnd: Int?,
    /** 원본 저장소의 딥링크. 저장소가 사라져도 스니펫은 남으므로 참조 무결성을 강제하지 않는다. */
    val gitUrl: String?,
    val code: String,
    val orderNo: Int,
) {
    init {
        if (language.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "스니펫 언어는 비어 있을 수 없습니다")
        }
        if (code.isBlank()) {
            throw BusinessException(ErrorCode.INVALID_INPUT, "스니펫 코드는 비어 있을 수 없습니다")
        }
    }

    val totalLines: Int
        get() = code.lineSequence().count()

    /** 공개면 미리보기 — 상단 [PREVIEW_LINES]줄. 전문이 그보다 짧으면 전문 그대로다. */
    fun preview(): String =
        code.lineSequence().take(PREVIEW_LINES).joinToString("\n")

    companion object {
        const val PREVIEW_LINES = 8
    }
}
