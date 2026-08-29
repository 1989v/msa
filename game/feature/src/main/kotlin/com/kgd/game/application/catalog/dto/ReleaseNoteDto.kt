package com.kgd.game.application.catalog.dto

import com.kgd.game.domain.catalog.model.ReleaseNote
import java.time.LocalDate

data class ReleaseNoteDto(
    val version: String,
    val releasedAt: LocalDate,
    val body: String,
    val bodyEn: String?,
) {
    companion object {
        fun from(note: ReleaseNote) =
            ReleaseNoteDto(note.version, note.releasedAt, note.body, note.bodyEn)
    }
}
