package com.kgd.game.application.access.service

import com.kgd.game.application.access.dto.PrivateGameAccessDto
import com.kgd.game.application.access.port.PrivateGameAccessRepositoryPort
import com.kgd.game.application.access.port.TokenIdentityPort
import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase
import com.kgd.game.application.access.usecase.CheckPrivateGameAccessUseCase.Verdict
import com.kgd.game.application.access.usecase.ManagePrivateGameAccessUseCase
import com.kgd.game.domain.access.model.PrivateGameAccess
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

@Service
@Transactional(transactionManager = "gameTransactionManager", readOnly = true)
class PrivateGameAccessService(
    private val repository: PrivateGameAccessRepositoryPort,
    private val identity: TokenIdentityPort,
) : CheckPrivateGameAccessUseCase, ManagePrivateGameAccessUseCase {

    override fun execute(gameSlug: String, token: String?): Verdict {
        if (token.isNullOrBlank()) return Verdict.NO_TOKEN

        val memberId = identity.memberIdOf(token) ?: return Verdict.BAD_TOKEN

        if (repository.exists(gameSlug, memberId)) return Verdict.ALLOWED

        // 누가 두드렸는지는 남긴다 — 「나는 되는 줄 알았다」를 확인할 방법이 있어야 한다
        log.info { "비밀 게임 접근 거절 — slug=$gameSlug member=$memberId" }
        return Verdict.DENIED
    }

    override fun list(gameSlug: String): List<PrivateGameAccessDto> =
        repository.findAll(gameSlug).map(PrivateGameAccessDto::from)

    @Transactional(transactionManager = "gameTransactionManager")
    override fun grant(gameSlug: String, memberId: Long, note: String?): PrivateGameAccessDto =
        PrivateGameAccessDto.from(
            repository.save(PrivateGameAccess(gameSlug = gameSlug, memberId = memberId, note = note)),
        )

    @Transactional(transactionManager = "gameTransactionManager")
    override fun revoke(gameSlug: String, memberId: Long): Boolean =
        repository.delete(gameSlug, memberId)
}
