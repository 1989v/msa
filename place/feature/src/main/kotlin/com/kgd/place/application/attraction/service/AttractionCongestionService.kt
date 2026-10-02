package com.kgd.place.application.attraction.service

import com.kgd.place.application.attraction.port.AttractionCongestionRepositoryPort
import com.kgd.place.application.attraction.usecase.SyncAttractionCongestionUseCase
import com.kgd.place.domain.attraction.model.AttractionCongestion
import com.kgd.place.domain.attraction.model.CongestionMatch
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

private val log = KotlinLogging.logger {}

/** 관광지 집중률 저장. 관광지 행(attractions)에는 쓰지 않는다 — bulk upsert(전체 동기화) 경로와 갈라 두어야 지워지지 않는다. */
@Service
class AttractionCongestionService(
    private val repository: AttractionCongestionRepositoryPort,
) : SyncAttractionCongestionUseCase {

    @Transactional
    override fun replaceSigungu(signguCd: String, items: List<SyncAttractionCongestionUseCase.Item>): SyncAttractionCongestionUseCase.Applied {
        // 빈 목록으로 그 시군구를 지우는 길은 열지 않는다 — 원천이 잠깐 0건을 준 날 이전 예측이 통째로 사라진다
        require(items.isNotEmpty()) { "items 는 비어있을 수 없습니다" }
        val names = items.map { it.tAtsNm.trim() }
        require(names.toSet().size == names.size) { "한 시군구에 같은 관광지 이름이 두 번 왔습니다: $signguCd" }
        val rows = items.map {
            val method = runCatching { CongestionMatch.valueOf(it.matchMethod) }
                .getOrElse { _ -> throw IllegalArgumentException("모르는 매칭 방법입니다: ${it.matchMethod}") }
            AttractionCongestion(
                signguCd = signguCd, tAtsNm = it.tAtsNm.trim(), areaCd = it.areaCd.trim(), areaNm = it.areaNm, signguNm = it.signguNm,
                ratesRaw = it.ratesRaw, firstYmd = it.firstYmd, lastYmd = it.lastYmd,
                attractionId = it.attractionId, matchMethod = method,
            )
        }
        val removed = repository.replaceSigungu(signguCd, rows, LocalDateTime.now())
        val linked = rows.count { it.attractionId != null }
        log.info { "집중률($signguCd): 받음 ${rows.size} · 관광지에 이음 $linked · 이전 행 $removed" }
        return SyncAttractionCongestionUseCase.Applied(rows.size, linked, removed)
    }
}
