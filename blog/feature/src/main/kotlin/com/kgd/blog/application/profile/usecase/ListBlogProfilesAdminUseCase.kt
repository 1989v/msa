package com.kgd.blog.application.profile.usecase

import com.kgd.blog.application.profile.dto.BlogProfileAdminResponse
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus

interface ListBlogProfilesAdminUseCase {
    fun execute(query: Query): List<BlogProfileAdminResponse>

    data class Query(val role: ProfileRole?, val status: ProfileStatus?)
}
