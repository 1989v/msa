package com.kgd.analytics.application.judgment.service

import com.kgd.analytics.application.judgment.port.JudgmentRecord
import com.kgd.analytics.application.judgment.port.JudgmentRepositoryPort
import com.kgd.analytics.application.judgment.usecase.ManageSearchJudgmentsUseCase
import org.springframework.stereotype.Service

/** 조회 한도는 여기서 접는다 — 컨트롤러가 그대로 넘긴 값으로 ClickHouse 를 훑지 않도록. */
@Service
class SearchJudgmentService(
    private val judgmentRepository: JudgmentRepositoryPort,
) : ManageSearchJudgmentsUseCase {

    override fun upsert(command: ManageSearchJudgmentsUseCase.Command) {
        judgmentRepository.upsertManual(
            query = command.query,
            productId = command.productId,
            relevance = command.relevance,
            weight = command.weight ?: DEFAULT_WEIGHT,
        )
    }

    override fun list(queryFilter: String?, limit: Int, offset: Int): List<JudgmentRecord> =
        judgmentRepository.list(queryFilter, limit.coerceIn(1, MAX_ROWS), offset.coerceAtLeast(0))

    override fun distinctQueries(prefix: String?, limit: Int): List<String> =
        judgmentRepository.distinctQueries(prefix, limit.coerceIn(1, MAX_ROWS))

    private companion object {
        const val DEFAULT_WEIGHT = 1.0
        const val MAX_ROWS = 500
    }
}
