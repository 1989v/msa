package com.kgd.codedictionary.application.resume.usecase

import com.kgd.codedictionary.application.resume.dto.ResumeProfileDto

/** 이력서 구조화 프로필 조회. */
interface GetResumeProfileUseCase {
    fun profile(includeUnpublished: Boolean = false): ResumeProfileDto
}
