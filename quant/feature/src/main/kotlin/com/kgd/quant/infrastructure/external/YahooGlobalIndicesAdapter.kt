package com.kgd.quant.infrastructure.external

import com.kgd.quant.application.discover.GlobalIndexQuote
import com.kgd.quant.application.discover.port.GlobalIndexQuotePort
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import org.springframework.web.reactive.function.client.bodyToMono
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode

/**
 * Yahoo v8 chart API — `meta.regularMarketPrice` + `chartPreviousClose`.
 *
 * 같은 호스트를 보는 어댑터가 이 패키지에 여럿 있다(`YahooLatestPriceAdapter`·`YahooNewsAdapter`·
 * `YahooFundamentalsAdapter`). 지수 마퀴는 티커 목록만 다르고 응답 파싱은 동형이다.
 */
@Component
class YahooGlobalIndicesAdapter(
    private val objectMapper: ObjectMapper,
) : GlobalIndexQuotePort {

    private val webClient: WebClient = WebClient.builder()
        .baseUrl("https://query2.finance.yahoo.com")
        .defaultHeader("User-Agent", "Mozilla/5.0 (compatible; quant-discover/1.0)")
        .build()

    override suspend fun fetch(ticker: String, displayName: String): GlobalIndexQuote? {
        val res = webClient.get()
            .uri { ub ->
                ub.path("/v8/finance/chart/$ticker")
                    .queryParam("interval", "1d")
                    .queryParam("range", "5d")
                    .build()
            }
            .retrieve()
            .bodyToMono<String>()
            .awaitSingle()
        val result = objectMapper.readTree(res).path("chart").path("result")
        if (!result.isArray || result.size() == 0) return null
        val meta = result[0].path("meta")
        val price = meta.path("regularMarketPrice").let {
            if (it.isMissingNode || !it.isNumber) null else BigDecimal(it.asText())
        } ?: return null
        val prev = meta.path("chartPreviousClose").let {
            if (it.isMissingNode || !it.isNumber) null else BigDecimal(it.asText())
        }
        val changePct = if (prev != null && prev.signum() > 0) {
            (price - prev).divide(prev, MathContext.DECIMAL64).setScale(6, RoundingMode.HALF_UP)
        } else {
            null
        }
        return GlobalIndexQuote(
            ticker = ticker,
            displayName = displayName,
            price = price,
            prevClose = prev,
            changePct = changePct,
        )
    }
}
