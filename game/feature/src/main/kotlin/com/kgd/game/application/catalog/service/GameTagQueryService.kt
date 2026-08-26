package com.kgd.game.application.catalog.service

import com.kgd.game.application.catalog.dto.GameTagDto
import com.kgd.game.application.catalog.port.GameTagRepositoryPort
import com.kgd.game.application.catalog.usecase.ListGameTagsUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(transactionManager = "gameTransactionManager", readOnly = true)
class GameTagQueryService(
    private val tagRepository: GameTagRepositoryPort,
) : ListGameTagsUseCase {
    override fun execute(): List<GameTagDto> = tagRepository.findAll().map { GameTagDto.of(it) }
}
