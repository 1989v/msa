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
    /** 표시명 — place 의 titleDisplay. 원천 제목의 꼬리 괄호 표기는 [titleLocal] 로 분리됐다. */
    val title: String,
    /** 꼬리 괄호의 다른 표기 — 영문 문서는 국문명. 국문 질의가 영문 문서를 찾는 리콜 축이다. */
    val titleLocal: String? = null,
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
    /** 구글맵 딥링크용 Google Places place_id — 검색 조건이 아니라 상세 표시물이다. */
    val googlePlaceId: String? = null,
    /**
     * 완결성 기반 정렬 신호 — 위 필드들에서 파생한다 ([AttractionPopularity]).
     * 색인 경로는 기본값(계산)을 쓰고, 읽기 경로는 인덱스에 저장된 값을 그대로 넘긴다.
     * 방문자 지표가 생기면 이 자리를 그 값으로 바꾼다.
     */
    val popularityScore: Double = AttractionPopularity.score(imageUrl = imageUrl, overview = overview, tel = tel),
    val modifiedAt: LocalDateTime? = null,
)
