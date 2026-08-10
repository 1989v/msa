package com.kgd.codedictionary.domain.resume.policy

import com.kgd.codedictionary.domain.resume.model.ResumeShareLink
import com.kgd.codedictionary.domain.resume.model.ResumeVisibility

/**
 * 이력서 열람 가능 여부 (ADR-0064).
 *
 * 거절은 호출부에서 404 로 변환한다 — 403 은 "여기 뭔가 있다"를 알려주므로,
 * 포트폴리오 카드의 PRIVATE 처리와 같은 은닉 기준을 따른다.
 */
object ResumeAccessPolicy {

    fun canRead(visibility: ResumeVisibility, link: ResumeShareLink?): Boolean = when (visibility) {
        ResumeVisibility.PUBLIC -> true
        ResumeVisibility.TOKEN_ONLY -> link != null && link.isUsable()
    }
}
