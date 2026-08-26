package com.kgd.blog.application.interaction.usecase

import com.kgd.blog.application.interaction.dto.BlogReaction
import com.kgd.blog.application.profile.dto.BlogIdentity

interface ClearBlogRatingUseCase {
    fun execute(command: Command): BlogReaction

    data class Command(val slug: String, val identity: BlogIdentity)
}
