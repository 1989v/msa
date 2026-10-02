package com.kgd.ads.application.placement.usecase

import com.kgd.ads.application.placement.dto.FormatSpecView

/** 광고주 카탈로그 — 유료를 받는 활성 지면과 문맥 카테고리. 캠페인 편집 화면이 여기서 고른다. */
interface GetAdCatalogUseCase {
    fun execute(): Catalog

    /**
     * @param hourlyCapPercent 한 시간에 쓸 수 있는 일예산 비율 — 화면이 규칙을 사본으로 두지 않게 서버 값을 싣는다
     * @param uploadRules 소재 이미지 사전 검사 값 — 같은 이유로 서버 상수를 싣는다(최종 판정은 서버)
     */
    data class Catalog(
        val placements: List<CatalogPlacement>,
        val categories: List<CatalogCategory>,
        val hourlyCapPercent: Long,
        val uploadRules: UploadRules,
    )

    /**
     * @param formats 이 지면이 받는 광고 형태별 규격(비율·최저가)
     * @param averageDailyRequests 최근 7일(오늘 제외) 일평균 요청 수
     */
    data class CatalogPlacement(
        val key: String,
        val host: String,
        val formats: List<FormatSpecView>,
        val description: String,
        val averageDailyRequests: Long,
    )

    data class CatalogCategory(val code: String, val label: String)

    /**
     * @param fileTypes 받는 이미지 형식(MIME) — 판정은 파일 앞 바이트로 한다
     * @param maxBytes 최대 크기
     * @param maxDimension 가로·세로 최대 픽셀(헤더 기준)
     * @param aspectTolerance 비율 상대 허용 오차
     */
    data class UploadRules(
        val fileTypes: List<String>,
        val maxBytes: Int,
        val maxDimension: Int,
        val aspectTolerance: Double,
    )
}
