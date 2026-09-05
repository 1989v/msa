package com.kgd.game.application.access.service

import com.kgd.game.application.access.dto.PrivateGameAccessDto
import com.kgd.game.application.access.port.PrivateGameAccessRepositoryPort
import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase
import com.kgd.game.application.access.usecase.ManagePrivateGameAccessUseCase
import com.kgd.game.domain.access.model.PrivateGameAccess
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class PrivateGameAccessService(
    private val repository: PrivateGameAccessRepositoryPort,
) : CheckPrivateGameAccessUseCase, ManagePrivateGameAccessUseCase {

    override fun execute(gameSlug: String, memberId: Long): Boolean =
        repository.exists(gameSlug, memberId)

    override fun list(gameSlug: String): List<PrivateGameAccessDto> =
        repository.findAll(gameSlug).map(PrivateGameAccessDto::from)

    @Transactional
    override fun grant(gameSlug: String, memberId: Long, note: String?): PrivateGameAccessDto =
        PrivateGameAccessDto.from(
            repository.save(PrivateGameAccess(gameSlug = gameSlug, memberId = memberId, note = note)),
        )

    @Transactional
    override fun revoke(gameSlug: String, memberId: Long): Boolean =
        repository.delete(gameSlug, memberId)
}
