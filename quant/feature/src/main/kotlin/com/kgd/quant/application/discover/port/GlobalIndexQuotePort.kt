package com.kgd.quant.application.discover.port

import com.kgd.quant.application.discover.GlobalIndexQuote

/**
 * 지수 시세 원천. 실패는 null 로 접는다 — 마퀴 한 칸이 비는 것이 화면 전체가 죽는 것보다 낫다.
 *
 * 캐시는 이 포트 뒤가 아니라 application 이 갖는다 — TTL 은 화면 정책이지 원천의 성질이 아니다.
 */
interface GlobalIndexQuotePort {
    suspend fun fetch(ticker: String, displayName: String): GlobalIndexQuote?
}
