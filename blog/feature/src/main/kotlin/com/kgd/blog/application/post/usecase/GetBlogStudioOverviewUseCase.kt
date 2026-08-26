package com.kgd.blog.application.post.usecase

import com.kgd.blog.application.post.dto.BlogStudioOverview
import com.kgd.blog.application.profile.dto.BlogIdentity

interface GetBlogStudioOverviewUseCase {
    fun execute(identity: BlogIdentity): BlogStudioOverview
}
