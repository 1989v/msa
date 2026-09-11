package com.kgd.codedictionary.application.display.dto

import com.kgd.codedictionary.domain.display.model.DisplayOpenSource

data class DisplayOpenSourceDto(
    val id: Long?,
    val slug: String,
    val name: String,
    val tagline: String,
    val description: String?,
    val repoUrl: String,
    val language: String,
    val orderNo: Int,
) {
    companion object {
        fun from(item: DisplayOpenSource) = DisplayOpenSourceDto(
            id = item.id,
            slug = item.slug,
            name = item.name,
            tagline = item.tagline,
            description = item.description,
            repoUrl = item.repoUrl,
            language = item.language,
            orderNo = item.orderNo,
        )
    }
}
