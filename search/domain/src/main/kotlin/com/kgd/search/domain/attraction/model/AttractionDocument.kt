package com.kgd.search.domain.attraction.model

import java.time.LocalDateTime

/**
 * 관광지 검색 읽기 모델 (ADR-0065). SSOT 는 place 서비스 MySQL — search-batch 가 일괄 재색인.
 * 국문/영문은 언어별 별도 문서(lang)로 색인한다.
 */
data class AttractionDocument(
    val id: String,
    val contentId: String,
    val lang: String,
    val title: String,
    val latitude: Double,
    val longitude: Double,
    val address: String? = null,
    val areaCode: String? = null,
    val sigunguCode: String? = null,
    /** 법정동 시도/시군구 코드 — 지역 드릴다운의 축 (ADR-0071).
     *  `areaCode`/`sigunguCode` 는 두 코드 체계가 섞여 있어 필터 축으로 쓰지 않는다. */
    val ldongRegnCd: String? = null,
    val ldongSignguCd: String? = null,
    val category: String? = null,
    val imageUrl: String? = null,
    val tel: String? = null,
    val overview: String? = null,
    /** 방문자 지표 기반 인기 신호 — P1 은 0, P2 에서 관광빅데이터로 채운다 */
    val popularity: Long = 0,
    val modifiedAt: LocalDateTime? = null,
)
