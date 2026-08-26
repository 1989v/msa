package com.kgd.blog.application.profile.usecase

import com.kgd.blog.application.profile.dto.BlogAuthorApplicationRequest
import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse

/** 저자 신청. 핸들은 승인 전에 선점한다 */
interface ApplyAsBlogAuthorUseCase {
    fun execute(command: Command): BlogProfileAdminResponse

    data class Command(val identity: BlogIdentity, val request: BlogAuthorApplicationRequest)
}
