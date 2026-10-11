package com.kgd.place.application.attraction.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.attraction.port.AttractionAccessRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionAccessUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/** 관광지 가는 법 저장. 관광지 행(attractions)에는 쓰지 않는다 — bulk upsert(전체 동기화) 경로와 갈라 두어야 지워지지 않는다. */
@Service
class AttractionAccessService(
    private val repository: AttractionAccessRepositoryPort,
) : SyncAttractionAccessUseCase {

    @Transactional
    override fun replace(computedAt: LocalDateTime, items: List<SyncAttractionAccessUseCase.Item>): SyncAttractionAccessUseCase.Applied {
        if (items.isEmpty()) invalid("items 는 비어있을 수 없습니다")
        val ids = items.map { it.attractionId }
        if (ids.toSet().size != ids.size) invalid("한 요청에 같은 관광지가 두 번 왔다")
        items.forEach { item ->
            if (item.stops.any { it.attractionId != item.attractionId }) invalid("다른 관광지의 줄이 섞였다: ${item.attractionId}")
            val slots = item.stops.map { it.kind to it.rank }
            if (slots.toSet().size != slots.size) invalid("같은 종류·순위가 두 번 왔다: ${item.attractionId}")
        }
        val rows = items.flatMap { it.stops }
        val removed = repository.replace(ids, rows, computedAt)
        log.info { "가는 법 $computedAt: 관광지 ${items.size} · 줄 ${rows.size} · 이전 줄 $removed" }
        return SyncAttractionAccessUseCase.Applied(items.size, rows.size, removed)
    }

    @Transactional
    override fun prune(computedAt: LocalDateTime): Int {
        val removed = repository.deleteComputedBefore(computedAt)
        log.info { "가는 법 $computedAt 회차 끝: 이번 회차에 없는 관광지 줄 $removed 삭제" }
        return removed
    }

    private fun invalid(message: String): Nothing = throw BusinessException(ErrorCode.INVALID_INPUT, message)
}
