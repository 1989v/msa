package com.kgd.place.application.transit.service

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.place.application.transit.port.TransitSourceRepositoryPort
import com.kgd.place.application.transit.usecase.SyncTransitSourceUseCase
import com.kgd.place.domain.transit.model.BusCoverage
import com.kgd.place.domain.transit.model.TransitBusStop
import com.kgd.place.domain.transit.model.TransitRailStation
import com.kgd.place.domain.transit.model.TransitSource
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

@Service
class TransitSourceService(
    private val repository: TransitSourceRepositoryPort,
) : SyncTransitSourceUseCase {

    override fun state(source: TransitSource): SyncTransitSourceUseCase.State {
        val run = repository.findActiveRun(source)
        return SyncTransitSourceUseCase.State(source, run?.runId, run?.rows, run?.activatedAt)
    }

    @Transactional
    override fun putRail(runId: String, rows: List<TransitRailStation>): Int {
        checkWritable(TransitSource.RAIL, runId, rows.map { it.sourceKey })
        return repository.putRail(runId, rows, LocalDateTime.now())
    }

    @Transactional
    override fun putBus(runId: String, rows: List<TransitBusStop>): Int {
        checkWritable(TransitSource.BUS, runId, rows.map { it.sourceKey })
        return repository.putBus(runId, rows, LocalDateTime.now())
    }

    @Transactional
    override fun activate(
        source: TransitSource,
        runId: String,
        expectedRows: Int,
        coverage: List<BusCoverage>?,
    ): SyncTransitSourceUseCase.Activated {
        checkRunId(runId)
        if (source == TransitSource.BUS && coverage.isNullOrEmpty()) invalid("버스 활성화에는 시군구 연계 판정이 함께 와야 한다")
        if (source == TransitSource.RAIL && coverage != null) invalid("철도 활성화에는 연계 판정을 받지 않는다")
        val rows = repository.countRows(source, runId)
        // 0행 회차로 바꾸는 길은 열지 않는다 — 원천이 빈 파일을 준 주에 가는 법이 통째로 사라진다
        if (rows == 0) invalid("$source 회차 $runId 가 0행이다")
        if (rows != expectedRows) invalid("$source 회차 $runId 행 수 $rows ≠ 보낸 수 $expectedRows — 빠진 묶음이 있다")
        val now = LocalDateTime.now()
        val removed = repository.activate(source, runId, rows, now)
        coverage?.let { repository.replaceCoverage(it, now) }
        log.info { "역·정류장 원천 $source: 회차 $runId 활성 ($rows 행) · 옛 회차 행 $removed 삭제 · 연계 판정 ${coverage?.size ?: 0}" }
        return SyncTransitSourceUseCase.Activated(source, runId, rows, removed, coverage?.size ?: 0)
    }

    private fun checkWritable(source: TransitSource, runId: String, keys: List<String>) {
        checkRunId(runId)
        if (keys.isEmpty()) invalid("items 는 비어있을 수 없습니다")
        if (keys.toSet().size != keys.size) invalid("$source 한 묶음에 같은 자연 키가 두 번 왔다")
        if (repository.findActiveRun(source)?.runId == runId) invalid("$source 활성 회차 $runId 에는 쓰지 않는다 — 새 회차로 보낸다")
    }

    private fun checkRunId(runId: String) {
        if (!RUN_ID.matches(runId)) invalid("회차 id 는 영숫자·- 1~32자다: $runId")
    }

    private fun invalid(message: String): Nothing = throw BusinessException(ErrorCode.INVALID_INPUT, message)

    private companion object {
        val RUN_ID = Regex("[0-9A-Za-z-]{1,32}")
    }
}
