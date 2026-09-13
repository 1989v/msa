package com.kgd.search.application.unified.service

import com.kgd.search.application.attraction.port.CategoryLexiconPort
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import com.kgd.search.application.unified.port.UnifiedSearchPort
import com.kgd.search.application.unified.usecase.SearchUnifiedUseCase
import com.kgd.search.domain.query.model.QueryIntent
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service

@Service
class SearchUnifiedService(
    private val searchAttraction: SearchAttractionUseCase,
    private val unifiedSearchPort: UnifiedSearchPort,
    private val categoryLexicon: CategoryLexiconPort,
) : SearchUnifiedUseCase {

    private val log = KotlinLogging.logger {}

    override fun execute(query: SearchUnifiedUseCase.Query): SearchUnifiedUseCase.Result {
        val q = query.q.trim()
        if (q.isBlank()) {
            return SearchUnifiedUseCase.Result(q, SearchUnifiedUseCase.Understood(null, null), emptyList())
        }
        val size = query.size.coerceIn(1, MAX_SIZE)

        // 타입 의도는 여기서만 읽는다(searchTypes) — 관광지 검색은 자기 쿼리 언더스탠딩을 따로 돈다.
        val understood = QueryIntent.analyze(q, categoryLexicon.lexicon(query.lang), searchTypes = true)
        val requestedType = query.type?.takeIf { it.isNotBlank() }
        val intentType = understood.type
        val targetTypes = when {
            requestedType != null -> listOf(requestedType)
            intentType != null -> listOf(intentType)
            else -> ALL_TYPES
        }.filter { it in ALL_TYPES }

        val groups = targetTypes.mapNotNull { type ->
            runCatching {
                if (type == QueryIntent.Types.ATTRACTION) attractions(q, query.lang, size) else others(type, understood, size)
            }.getOrElse {
                // 한 타입의 장애가 통합 검색 전체를 죽이지 않는다 — 그 묶음만 빠진다
                log.warn { "통합 검색 $type 실패 — 그 묶음을 뺀다: ${it.message}" }
                null
            }
        }.filter { it.total > 0 }
            .sortedWith(groupOrder(intentType = understood.type, query = q))

        return SearchUnifiedUseCase.Result(
            query = q,
            understood = SearchUnifiedUseCase.Understood(type = understood.type, residual = understood.residual),
            groups = groups,
        )
    }

    /** 관광지는 원문을 그대로 넘긴다 — 그쪽 서비스가 자기 사전으로 필터·잔여를 다시 만든다 */
    private fun attractions(q: String, lang: String?, size: Int): SearchUnifiedUseCase.Group {
        val result = searchAttraction.execute(SearchAttractionUseCase.Query(keyword = q, lang = lang, size = size))
        return SearchUnifiedUseCase.Group(
            type = QueryIntent.Types.ATTRACTION,
            total = result.totalElements,
            hits = result.attractions.map {
                SearchUnifiedUseCase.Hit(
                    type = QueryIntent.Types.ATTRACTION,
                    id = it.id,
                    slug = it.id,
                    title = it.title,
                    summary = it.overview ?: it.address,
                    category = it.category,
                    thumbnailUrl = it.thumbnailUrl ?: it.imageUrl,
                )
            },
        )
    }

    private fun others(type: String, understood: QueryIntent.Understood, size: Int): SearchUnifiedUseCase.Group {
        val page = unifiedSearchPort.search(
            UnifiedSearchPort.Query(keyword = understood.residual, type = type, size = size),
        )
        return SearchUnifiedUseCase.Group(
            type = type,
            total = page.total,
            hits = page.hits.map {
                SearchUnifiedUseCase.Hit(
                    type = it.type, id = it.sourceId, slug = it.slug, title = it.title, summary = it.summary,
                    category = it.category, thumbnailUrl = it.thumbnailUrl, facets = it.facets, score = it.score,
                )
            },
        )
    }

    /**
     * 묶음 순서 — 타입 간 점수는 비교하지 않으므로 신호 셋으로 정한다.
     * ① 타입 의도의 타입 ② **첫 결과 제목이 검색어를 통째로 담은** 묶음(「AMP ARENA」→ 게임, 「신라면」→ 상품)
     * ③ 고정 타입 순서. 건수로 정하면 관광지(6만 건, 벡터 레그가 늘 무언가를 낸다)가 항상 맨 위라
     * 정확히 맞은 글·게임·상품이 아래로 밀린다(2026-09-13 실측).
     */
    private fun groupOrder(intentType: String?, query: String): Comparator<SearchUnifiedUseCase.Group> {
        val needle = QueryIntent.normalize(query)
        fun titleMatches(group: SearchUnifiedUseCase.Group) =
            needle.isNotBlank() && group.hits.firstOrNull()?.let { QueryIntent.normalize(it.title).contains(needle) } == true
        return compareBy<SearchUnifiedUseCase.Group> {
            when {
                it.type == intentType -> 0
                titleMatches(it) -> 1
                else -> 2
            }
        }.thenBy { ALL_TYPES.indexOf(it.type) }
    }

    companion object {
        private const val MAX_SIZE = 20
        val ALL_TYPES = listOf(
            QueryIntent.Types.ATTRACTION, QueryIntent.Types.BLOG_POST, QueryIntent.Types.GAME, QueryIntent.Types.CONCEPT,
            QueryIntent.Types.DEAL_OFFER, QueryIntent.Types.SERVICE, QueryIntent.Types.PRODUCT,
        )
    }
}
