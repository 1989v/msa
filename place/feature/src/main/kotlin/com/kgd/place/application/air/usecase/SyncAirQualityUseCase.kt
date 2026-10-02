package com.kgd.place.application.air.usecase

/** 대기 적재 — 수집기(place-ingest `air`)가 측정소 목록·최근접 매핑과 실시간 측정 원문을 그대로 보낸다. */
interface SyncAirQualityUseCase {
    fun applyStations(stations: List<StationItem>, mappings: List<MappingItem>): StationsApplied

    fun applyMeasurements(items: List<MeasurementItem>): Applied

    /** [latitude]·[longitude] 는 수집기가 원천 dmX·dmY 를 바꿔 읽고 한반도 범위로 검사한 값. [itemRaw] 는 원문 JSON. */
    data class StationItem(val stationName: String, val latitude: Double, val longitude: Double, val itemRaw: String)

    /** 시군구 측정소 후보 하나. [distanceM] 은 대표점 → 측정소(대표점이 없으면 null), [attractions] 는 이 측정소가 최근접인 관광지 좌표 수. */
    data class MappingItem(val sigunguCode: String, val stationName: String, val distanceM: Int?, val attractions: Int)

    /** [dataTime] 은 원천 표기(`yyyy-MM-dd HH:mm`, 자정은 `24:00`), 측정 없음이면 null. [itemRaw] 는 원문 JSON. */
    data class MeasurementItem(val sidoName: String, val stationName: String, val dataTime: String?, val itemRaw: String)

    /** [mappings] 는 넣은 후보 행 수, [sigungu] 는 캐시를 다시 채운 시군구 수. */
    data class StationsApplied(val stations: Int, val mappings: Int, val sigungu: Int)

    data class Applied(val applied: Int, val sigungu: Int)
}
