package com.kgd.blog.application.profile.usecase

import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.domain.model.ProfileStatus

/** 승인·정지·복구. 저자 승인은 누가 언제 했는지 남긴다 */
interface ChangeBlogProfileStatusUseCase {
    fun execute(command: Command): BlogProfileAdminResponse

    data class Command(val id: Long, val status: ProfileStatus, val identity: BlogIdentity)
}
