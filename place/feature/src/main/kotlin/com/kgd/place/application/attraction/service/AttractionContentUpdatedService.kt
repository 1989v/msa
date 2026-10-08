package com.kgd.place.application.attraction.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.attraction.port.AttractionRepositoryPort
import com.kgd.place.application.attraction.usecase.FindContentUpdatedAttractionsUseCase
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AttractionContentUpdatedService(
    private val attractions: AttractionRepositoryPort,
) : FindContentUpdatedAttractionsUseCase {

    @Transactional(readOnly = true)
    override fun find(query: FindContentUpdatedAttractionsUseCase.Query): FindContentUpdatedAttractionsUseCase.Result {
        if (query.size < 1) throw BusinessException(ErrorCode.INVALID_INPUT, "size 는 1 이상이어야 한다: ${query.size}")
        if (!query.since.isBefore(query.until)) return FindContentUpdatedAttractionsUseCase.Result(emptyList(), null)

        val size = query.size.coerceAtMost(MAX_SIZE)
        val rows = attractions.findContentUpdated(query.since, query.until, query.afterId, size)
        return FindContentUpdatedAttractionsUseCase.Result(
            items = rows.map { FindContentUpdatedAttractionsUseCase.Item(it.id, it.lang) },
            // 꽉 찬 쪽만 다음 쪽이 있을 수 있다 — 덜 찬 쪽이 마지막이다
            nextAfterId = if (rows.size == size) rows.last().id else null,
        )
    }

    companion object {
        /** 한 쪽 상한 — 하루 변경분을 몇 번에 나눠 읽게 해 응답 하나가 커지지 않게 한다 */
        const val MAX_SIZE = 1000
    }
}
