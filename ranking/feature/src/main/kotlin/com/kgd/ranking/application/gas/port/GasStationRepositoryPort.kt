package com.kgd.ranking.application.gas.port

import com.kgd.ranking.domain.model.GasStation

interface GasStationRepositoryPort {
    /** 가격 포함 */
    fun findAll(): List<GasStation>
    fun findByOpinetIdIn(opinetIds: Collection<String>): List<GasStation>
    /** opinetId 기준 upsert. 전체 동기화 — 넘어오지 않은 값과 유종 가격 행은 지워진다 */
    fun saveAll(stations: List<GasStation>): List<GasStation>
}
