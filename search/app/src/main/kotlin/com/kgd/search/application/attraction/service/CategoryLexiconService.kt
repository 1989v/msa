package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.port.CategoryCode
import com.kgd.search.application.attraction.port.CategoryCodePort
import com.kgd.search.application.attraction.usecase.CategoryLexiconUseCase
import com.kgd.search.domain.attraction.port.AttractionSearchPort
import com.kgd.search.domain.query.model.QueryIntent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.util.concurrent.atomic.AtomicReference

/**
 * 분류 사전 = place 코드표 ∩ 그 언어 색인에 문서가 있는 코드.
 *
 * 코드표는 수백 행이고 월 1회 갱신되므로 **질의마다 부르지 않는다** — 기동 시 한 번, 이후 주기 갱신.
 */
@Service
class CategoryLexiconService(
    private val codePort: CategoryCodePort,
    private val searchPort: AttractionSearchPort,
) : CategoryLexiconUseCase {

    private val log = KotlinLogging.logger {}

    private val cache = AtomicReference<Map<String, QueryIntent.Lexicon>>(emptyMap())

    override fun lexicon(lang: String?): QueryIntent.Lexicon =
        cache.get()[lang ?: DEFAULT_LANG] ?: QueryIntent.Lexicon.EMPTY

    /**
     * 기동 직후 한 번, 이후 10분마다.
     *
     * **주기를 코드표가 바뀌는 속도(월 1회)에 맞추면 안 된다** — 정하는 것은 *실패에서 회복하는 속도*다.
     * 6시간으로 뒀더니 search 와 place 가 같이 롤아웃되는 배포마다 첫 시도가 `Connection refused` 로
     * 죽고 그 뒤 6시간 동안 사전이 빈 채로 돌았다(실측 2026-09-08). 클러스터 안 호출 한 번에
     * 수백 행이라 10분 주기는 비용이 아니다.
     */
    @Scheduled(initialDelay = 5_000, fixedDelay = 10 * 60 * 1000)
    fun refresh() {
        val received = runCatching { codePort.codes() }.getOrElse {
            log.warn { "분류 코드표를 못 받았다 (들고 있던 사전을 계속 쓴다): ${it.message}" }
            return
        }
        val rows = received.filter { it.name.isNotBlank() && it.code.isNotBlank() }
        // 빈 코드표는 못 받은 것으로 본다 — 색인 집계도 부르지 않는다
        if (rows.isEmpty()) {
            log.warn { "분류 코드표가 비어 있다 — 사전을 바꾸지 않는다" }
            return
        }
        // 버킷 크기는 받은 행 수 — 한 언어의 코드 수는 행 수를 넘을 수 없다
        val indexed = runCatching { searchPort.indexedCategoryCodes(received.size) }.getOrElse {
            log.warn { "색인 분류 집합을 못 받았다 (그 언어는 들고 있던 사전을 쓴다): ${it.message}" }
            null
        }

        val held = cache.get()
        val langs = rows.map { it.lang }.filter { it.isNotBlank() }.toSet().ifEmpty { setOf(DEFAULT_LANG) }
        val next = langs.associateWith { lang ->
            val present = indexed?.get(lang).orEmpty()
            when {
                present.isNotEmpty() -> build(rows.filter { it.code in present }, lang)
                else -> held[lang] ?: build(rows, lang)
            }
        }
        cache.set(next)
        log.info { "분류 사전 갱신: ${next.entries.joinToString { "${it.key} ${it.value.phrasesLongestFirst.size}건" }}" }
    }

    /**
     * **언어를 가로질러 만든다.** 원천이 같은 코드에 한글·영문 이름을 짝으로 주므로
     * (`NA02 자연경관(하천‧해양) ↔ Natural Scenery (Rivers/Marine)`),
     * 두 이름을 한 사전에 넣으면 **한영 동의어를 손으로 쓰지 않고 얻는다.**
     * 같은 이름이 두 언어에 겹치면 **요청 언어가 이긴다** — 그쪽이 사용자의 뜻에 가깝다.
     *
     * [rows] 는 색인 집합으로 **미리 거른 행**이어야 한다. 다 만든 사전을 나중에 거르면, 이름이 겹칠 때
     * 깊은 코드가 이긴 자리가 통째로 지워져 얕은 코드로 돌아가야 할 이름까지 사라진다.
     */
    private fun build(rows: List<CategoryCode>, lang: String): QueryIntent.Lexicon {
        // 뒤에 오는 것이 이기도록 다른 언어를 먼저 깔고 요청 언어를 덮는다.
        val ordered = rows.filterNot { it.lang == lang } + rows.filter { it.lang == lang }
        return QueryIntent.Lexicon.of(ordered.map { Triple(it.code, it.depth, it.name) })
    }

    companion object {
        private const val DEFAULT_LANG = "ko"
    }
}
