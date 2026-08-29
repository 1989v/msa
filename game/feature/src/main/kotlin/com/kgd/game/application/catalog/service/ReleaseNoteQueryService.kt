package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.ReleaseNoteDto
import com.kgd.game.application.catalog.port.ReleaseNotePort
import com.kgd.game.application.catalog.usecase.GetGameReleaseNotesUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(transactionManager = "gameTransactionManager", readOnly = true)
class ReleaseNoteQueryService(
    private val releaseNotes: ReleaseNotePort,
) : GetGameReleaseNotesUseCase {
    override fun execute(query: GetGameReleaseNotesUseCase.Query): List<ReleaseNoteDto> =
        releaseNotes.findBySlug(query.slug).map(ReleaseNoteDto::from)
}
