package com.kgd.codedictionary.application.portfolio.usecase

import com.kgd.codedictionary.application.portfolio.dto.SnippetUnlockDto

/** 코드 스니펫 열람 토큰 발급·검증. */
interface UnlockSnippetUseCase {
    fun issue(): SnippetUnlockDto
    fun isValid(token: String?): Boolean
}
