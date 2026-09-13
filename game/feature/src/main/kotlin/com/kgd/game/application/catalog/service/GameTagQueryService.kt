package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.GameTagDto
import com.kgd.game.application.catalog.port.GameTagRepositoryPort
import com.kgd.game.application.catalog.usecase.ListGameTagsUseCase
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
@Qualifier("gameTransactionManager")
class GameTagQueryService(
    private val tagRepository: GameTagRepositoryPort,
) : ListGameTagsUseCase {
    override fun execute(): List<GameTagDto> = tagRepository.findAll().map { GameTagDto.of(it) }
}
