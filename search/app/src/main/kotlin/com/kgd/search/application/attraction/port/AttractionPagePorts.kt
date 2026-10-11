package com.kgd.search.application.attraction.port

import com.kgd.search.domain.attraction.model.AttractionDocument
import java.time.LocalDate

/**
 * 관광지 상세 서버 렌더의 두 조각 (ADR-0103, 블로그 서버 렌더와 같은 셸 계약 — ADR-0072 §6).
 *
 * 셸은 portal-fe 의 실제 index.html 을 받아 오는 외부 IO 라 포트 뒤에 둔다. 한 번도 받지 못했으면
 * null 이고, 렌더러는 그때 최소 HTML 로 떨어진다.
 */
interface AttractionShellPort {
    fun shell(): String?
}

interface AttractionPageRenderPort {
    /**
     * @param today 렌더 시점의 KST 날짜 — 행사 상태 문구 · 색인 만료 · 끝난 항목 거름의 기준.
     *   렌더러는 시계를 갖지 않는다(호출자가 계산해 넘긴다).
     */
    fun attractionPage(shell: String?, doc: AttractionDocument, today: LocalDate): String
    fun notFoundPage(shell: String?, lang: String): String

    /** 렌더 없이 셸 그대로. 셸도 없으면 메타 없는 최소 HTML */
    fun fallbackPage(shell: String?): String

    /** 상세의 정규 경로(호스트 없음) — canonical 을 만드는 것과 같은 함수다 */
    fun canonicalPath(lang: String, id: String): String
}
