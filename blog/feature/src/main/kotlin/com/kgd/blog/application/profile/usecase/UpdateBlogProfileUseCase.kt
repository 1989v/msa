package com.kgd.blog.application.profile.usecase

import com.kgd.blog.application.profile.dto.BlogIdentity
import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.application.profile.dto.BlogProfileRequest

interface UpdateBlogProfileUseCase {
    fun execute(command: Command): BlogProfileAdminResponse

    data class Command(val identity: BlogIdentity, val request: BlogProfileRequest)
}
