package com.kgd.game.application.catalog.usecase

import com.kgd.game.application.catalog.dto.GameDetailDto
import com.kgd.game.domain.catalog.model.Genre
import com.kgd.game.domain.catalog.model.Orientation

/** null = 미변경. `titleEn`/`descriptionEn` 은 공백을 보내면 비워진다 (SEO 메타 입력) */
interface UpdateGameMetadataUseCase {
    fun execute(command: Command): GameDetailDto

    data class Command(
        val slug: String,
        val title: String?,
        val description: String?,
        val titleEn: String?,
        val descriptionEn: String?,
        val thumbnailUrl: String?,
        val coverUrl: String?,
        val orientation: Orientation?,
        val supportsMobile: Boolean?,
        val developerName: String?,
        val genre: Genre?,
    )
}
