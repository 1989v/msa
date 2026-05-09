package com.kgd.quant.application.port.persistence

/**
 * DartCorpCodePort — ADR-0041 stock_code → DART corp_code 매핑 read-only port.
 */
interface DartCorpCodePort {
    /** stock_code (예: '005930') → corp_code (예: '00126380'). 없으면 null. */
    suspend fun findCorpCode(stockCode: String): String?
}
