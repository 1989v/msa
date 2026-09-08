package com.kgd.search.infrastructure.client

import com.kgd.search.application.attraction.port.CategoryLexiconPort
import com.kgd.search.domain.attraction.model.QueryIntent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.Duration
import java.util.concurrent.atomic.AtomicReference

/**
 * place 의 분류 코드표를 받아 사전으로 들고 있는다.
 *
 * 코드표는 수백 행이고 월 1회 갱신되므로 **질의마다 부르지 않는다** — 기동 시 한 번, 이후 주기 갱신.
 * 실패는 삼킨다: 들고 있던 사전을 그대로 쓰고, 처음부터 못 받았으면 빈 사전이다.
 */
@Component
class CategoryLexiconAdapter(
    @Value("\${search.category-lexicon.base-url:http://place:8096}") private val baseUrl: String,
    @Value("\${search.category-lexicon.enabled:true}") private val enabled: Boolean,
) : CategoryLexiconPort {

    private val log = KotlinLogging.logger {}

    private val client: RestClient = RestClient.builder()
        .baseUrl(baseUrl)
        .requestFactory(
            org.springframework.http.client.SimpleClientHttpRequestFactory().apply {
                setConnectTimeout(Duration.ofSeconds(2))
                setReadTimeout(Duration.ofSeconds(5))
            },
        )
        .build()

    private val cache = AtomicReference<Map<String, QueryIntent.Lexicon>>(emptyMap())

    override fun lexicon(lang: String?): QueryIntent.Lexicon =
        cache.get()[lang ?: DEFAULT_LANG] ?: QueryIntent.Lexicon.EMPTY

    /** 기동 직후 한 번, 이후 6시간마다. 코드표가 바뀌는 주기(월 1회)보다 훨씬 촘촘하다. */
    @Scheduled(initialDelay = 5_000, fixedDelay = 6 * 60 * 60 * 1000)
    fun refresh() {
        if (!enabled) return
        val loaded = runCatching { fetch() }.getOrElse {
            log.warn { "분류 코드표를 못 받았다 (들고 있던 사전을 계속 쓴다): ${it.message}" }
            return
        }
        if (loaded.isEmpty()) {
            log.warn { "분류 코드표가 비어 있다 — 사전을 바꾸지 않는다" }
            return
        }
        cache.set(loaded)
        log.info { "분류 사전 갱신: ${loaded.entries.joinToString { "${it.key} ${it.value.phrasesLongestFirst.size}건" }}" }
    }

    /**
     * **언어를 가로질러 만든다.** 원천이 같은 코드에 한글·영문 이름을 짝으로 주므로
     * (`NA02 자연경관(하천‧해양) ↔ Natural Scenery (Rivers/Marine)`),
     * 두 이름을 한 사전에 넣으면 **한영 동의어를 손으로 쓰지 않고 얻는다.**
     *
     * 문서는 `lang` 으로 갈려 있어 영문 질의는 영문 문서만 봤는데, 이제 영문 이름이
     * 코드로 옮겨져 **국문 문서에도 같은 필터가 걸린다.**
     * 같은 이름이 두 언어에 겹치면 **요청 언어가 이긴다** — 그쪽이 사용자의 뜻에 가깝다.
     */
    private fun fetch(): Map<String, QueryIntent.Lexicon> {
        val response = client.get().uri("/api/places/attractions/category-codes")
            .retrieve().body(CodesResponse::class.java) ?: return emptyMap()
        val rows = response.data.filter { it.name.isNotBlank() && it.code.isNotBlank() }
        if (rows.isEmpty()) return emptyMap()

        val langs = rows.map { it.lang }.filter { it.isNotBlank() }.toSet().ifEmpty { setOf(DEFAULT_LANG) }
        return langs.associateWith { lang ->
            // 뒤에 오는 것이 이기도록 다른 언어를 먼저 깔고 요청 언어를 덮는다.
            val ordered = rows.filterNot { it.lang == lang } + rows.filter { it.lang == lang }
            QueryIntent.Lexicon.of(ordered.map { Triple(it.code, it.depth, it.name) })
        }
    }

    data class CodesResponse(val data: List<Row> = emptyList())

    data class Row(val lang: String = "", val code: String = "", val depth: Int = 0, val name: String = "")

    companion object {
        private const val DEFAULT_LANG = "ko"
    }
}
