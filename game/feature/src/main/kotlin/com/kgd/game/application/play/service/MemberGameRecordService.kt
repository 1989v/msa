package com.kgd.game.application.play.service

import com.kgd.game.application.catalog.port.GameRepositoryPort
import com.kgd.game.application.play.dto.MyGameRecordDto
import com.kgd.game.application.play.port.MemberGameRecordPort
import com.kgd.game.application.play.usecase.GetMyGameRecordUseCase
import com.kgd.game.domain.catalog.exception.GameNotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 개인 기록 조회. 읽기 전용이고 세 저장소를 한 번씩만 훑는다.
 */
@Service
class MemberGameRecordService(
    private val gameRepository: GameRepositoryPort,
    private val records: MemberGameRecordPort,
) : GetMyGameRecordUseCase {
    @Transactional(transactionManager = "gameTransactionManager", readOnly = true)
    override fun execute(query: GetMyGameRecordUseCase.Query): MyGameRecordDto {
        val game = gameRepository.findBySlug(query.slug) ?: throw GameNotFoundException(query.slug)
        val gameId = game.id ?: throw GameNotFoundException(query.slug)
        return records.summarize(gameId, query.memberId)
    }
}
