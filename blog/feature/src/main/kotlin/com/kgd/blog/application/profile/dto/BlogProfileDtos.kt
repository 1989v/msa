package com.kgd.blog.application.profile.dto

import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.LocalDateTime

data class BlogAuthorSummary(
    val handle: String?,
    val displayName: String,
    val avatarUrl: String?,
    val bio: String?,
)

data class BlogProfileRequest(
    @field:NotBlank @field:Size(max = 40) val displayName: String,
    @field:Size(max = 300) val bio: String?,
    @field:Size(max = 1000) val avatarUrl: String?,
)

data class BlogAuthorApplicationRequest(
    @field:NotBlank @field:Size(max = 30) val handle: String,
    @field:NotBlank @field:Size(max = 40) val displayName: String,
    @field:Size(max = 300) val bio: String?,
)

data class BlogProfileAdminResponse(
    val id: Long,
    val memberId: Long,
    val handle: String?,
    val displayName: String,
    val bio: String?,
    val role: ProfileRole,
    val status: ProfileStatus,
    val postCount: Long,
    val approvedAt: LocalDateTime?,
    val createdAt: LocalDateTime?,
)

data class BlogProfileStatusRequest(val status: ProfileStatus)
