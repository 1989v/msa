package com.kgd.search.infrastructure.client

import com.kgd.search.infrastructure.indexing.MarkdownPlainText
import com.kgd.search.infrastructure.indexing.UnifiedIndexDocument
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.reactor.awaitSingle
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.core.ParameterizedTypeReference
import org.springframework.stereotype.Component
import org.springframework.web.reactive.function.client.WebClient
import kotlin.math.ln

/**
 * `unified` 인덱스의 원천 — 각 호스트의 **공개 API** 를 풀스캔한다 (서비스 간 DB 공유 없음).
 *
 * | 타입 | 호스트 | 경로 |
 * |---|---|---|
 * | blog_post | content | `/api/v1/blog/posts` + `/posts/{slug}`(본문) |
 * | game | content | `/api/v1/games` + `/games/{slug}`(설명) |
 * | concept | atlas | `/api/v1/concepts` |
 * | service | atlas | `/api/v1/display/services` |
 * | deal_offer | commerce | `/api/v1/deal/sections` |
 * | product | commerce | `/api/v1/products` |
 *
 * 응답은 Map 으로 받아 손으로 꺼낸다 — 데이터 클래스에 필드만 더하고 매핑을 빼먹으면 기본값이
 * 조용히 이긴다(PlaceApiClient 와 같은 이유). 비공개·비공개 상태(DRAFT · HOLD · 비밀 게임)는
 * 공개 API 가 애초에 내주지 않으므로 여기서 거를 것이 없다.
 */
@Component
class UnifiedSourceApiClient(
    @Qualifier("placeWebClient") private val contentWebClient: WebClient,
    @Qualifier("atlasWebClient") private val atlasWebClient: WebClient,
    @Qualifier("productWebClient") private val commerceWebClient: WebClient,
) {
    private val log = KotlinLogging.logger {}

    /** 타입 하나의 문서 전부. 한 타입이 실패해도 다른 타입은 색인되도록 호출자가 타입별로 감싼다. */
    suspend fun fetch(type: String): List<UnifiedIndexDocument> = when (type) {
        BLOG_POST -> blogPosts()
        GAME -> games()
        CONCEPT -> concepts()
        SERVICE -> services()
        DEAL_OFFER -> dealOffers()
        PRODUCT -> products()
        else -> error("unknown unified type: $type")
    }

    private suspend fun blogPosts(): List<UnifiedIndexDocument> {
        val docs = mutableListOf<UnifiedIndexDocument>()
        var page = 0
        do {
            val data = contentWebClient.getData("/api/v1/blog/posts?page=$page&size=$PAGE")
            val items = data.list("items")
            for (post in items) {
                val slug = post.str("slug") ?: continue
                // 목록엔 요약뿐이다. 본문은 상세에서 — 글 수십 편이라 호출 수가 비용이 아니다.
                val body = runCatching {
                    contentWebClient.getData("/api/v1/blog/posts/$slug").str("body")
                }.getOrElse { log.warn { "글 본문을 못 받았다 — 요약만 색인: $slug (${it.message})" }; null }
                docs += UnifiedIndexDocument(
                    id = "$BLOG_POST:${post.str("id")}",
                    type = BLOG_POST,
                    sourceId = post.str("id") ?: slug,
                    slug = slug,
                    lang = KO,
                    title = post.str("title") ?: continue,
                    summary = post.str("summary"),
                    body = MarkdownPlainText.of(body),
                    category = post.str("categoryPath"),
                    tags = listOfNotNull(post.str("categoryName"), post.map("author")?.str("handle")),
                    facets = mapOfNotNull("category" to post.str("categoryPath")),
                    popularity = log1p(post.num("viewCount")),
                    publishedAt = post.str("publishedAt"),
                    thumbnailUrl = post.str("coverImageUrl"),
                )
            }
            val totalPages = data.num("totalPages").toInt()
            page++
        } while (page < totalPages)
        return docs
    }

    private suspend fun games(): List<UnifiedIndexDocument> {
        val docs = mutableListOf<UnifiedIndexDocument>()
        var page = 0
        do {
            val data = contentWebClient.getData("/api/v1/games?page=$page&size=$PAGE")
            for (game in data.list("content")) {
                val slug = game.str("slug") ?: continue
                val detail = runCatching { contentWebClient.getData("/api/v1/games/$slug") }
                    .getOrElse { log.warn { "게임 상세를 못 받았다 — 목록 필드만 색인: $slug (${it.message})" }; emptyMap() }
                val tags = game.strList("tags")
                docs += UnifiedIndexDocument(
                    id = "$GAME:${game.str("id")}",
                    type = GAME,
                    sourceId = game.str("id") ?: slug,
                    slug = slug,
                    lang = KO,
                    title = game.str("title") ?: continue,
                    titleEn = game.str("titleEn"),
                    summary = detail.str("description"),
                    body = detail.str("descriptionEn"),
                    category = game.str("genre"),
                    tags = tags,
                    facets = mapOfNotNull("genre" to game.str("genre"), "status" to game.str("status")),
                    popularity = log1p(game.num("playCount")),
                    publishedAt = detail.str("releasedAt"),
                    thumbnailUrl = game.str("thumbnailUrl"),
                )
            }
            val totalPages = data.num("totalPages").toInt()
            page++
        } while (page < totalPages)
        return docs
    }

    private suspend fun concepts(): List<UnifiedIndexDocument> {
        val docs = mutableListOf<UnifiedIndexDocument>()
        var page = 0
        do {
            val data = atlasWebClient.getData("/api/v1/concepts?page=$page&size=$PAGE")
            for (concept in data.list("content")) {
                val conceptId = concept.str("conceptId") ?: continue
                docs += UnifiedIndexDocument(
                    id = "$CONCEPT:$conceptId",
                    type = CONCEPT,
                    sourceId = conceptId,
                    slug = conceptId,
                    lang = KO,
                    title = concept.str("name") ?: continue,
                    // conceptId 는 영문 케밥(`saga-pattern`) — 영어 검색어가 여기 걸린다
                    titleEn = conceptId.replace('-', ' '),
                    summary = concept.str("description"),
                    category = concept.str("category"),
                    tags = concept.strList("synonyms"),
                    facets = mapOfNotNull("category" to concept.str("category"), "level" to concept.str("level")),
                )
            }
            val totalPages = data.num("totalPages").toInt()
            page++
        } while (page < totalPages)
        return docs
    }

    private suspend fun services(): List<UnifiedIndexDocument> =
        atlasWebClient.getList("/api/v1/display/services").mapNotNull { service ->
            val code = service.str("code") ?: return@mapNotNull null
            UnifiedIndexDocument(
                id = "$SERVICE:$code",
                type = SERVICE,
                sourceId = code,
                slug = code,
                lang = KO,
                title = service.str("label") ?: return@mapNotNull null,
                summary = service.str("tagline"),
                category = service.str("status"),
                facets = mapOfNotNull("status" to service.str("status")),
            )
        }

    private suspend fun dealOffers(): List<UnifiedIndexDocument> =
        commerceWebClient.getList("/api/v1/deal/sections").flatMap { section ->
            val category = section.map("category")
            section.list("offers").mapNotNull { offer ->
                val slug = offer.str("slug") ?: return@mapNotNull null
                UnifiedIndexDocument(
                    id = "$DEAL_OFFER:$slug",
                    type = DEAL_OFFER,
                    sourceId = slug,
                    slug = slug,
                    lang = KO,
                    title = offer.str("title") ?: return@mapNotNull null,
                    summary = listOfNotNull(offer.str("benefit"), offer.str("summary")).joinToString(" — ").ifBlank { null },
                    category = category?.str("code"),
                    tags = listOfNotNull(offer.str("merchant"), category?.str("label")),
                    facets = mapOfNotNull("category" to category?.str("code"), "revenueType" to offer.str("revenueType")),
                )
            }
        }

    private suspend fun products(): List<UnifiedIndexDocument> {
        val docs = mutableListOf<UnifiedIndexDocument>()
        var page = 0
        do {
            val data = commerceWebClient.getData("/api/v1/products?page=$page&size=$PAGE")
            for (product in data.list("products")) {
                val id = product.str("id") ?: continue
                docs += UnifiedIndexDocument(
                    id = "$PRODUCT:$id",
                    type = PRODUCT,
                    sourceId = id,
                    slug = id,
                    lang = KO,
                    title = product.str("name") ?: continue,
                    summary = product.str("description"),
                    category = product.str("category"),
                    tags = listOfNotNull(product.str("brand")),
                    facets = mapOfNotNull("category" to product.str("category"), "brand" to product.str("brand")),
                )
            }
            val totalPages = data.num("totalPages").toInt()
            page++
        } while (page < totalPages)
        return docs
    }

    // ---- JSON 손풀기 ----------------------------------------------------------------------------

    private suspend fun WebClient.getData(uri: String): Map<String, Any?> {
        val body = get().uri(uri).retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any?>>() {})
            .awaitSingle()
        @Suppress("UNCHECKED_CAST")
        return body["data"] as? Map<String, Any?> ?: error("No data field: $uri")
    }

    private suspend fun WebClient.getList(uri: String): List<Map<String, Any?>> {
        val body = get().uri(uri).retrieve()
            .bodyToMono(object : ParameterizedTypeReference<Map<String, Any?>>() {})
            .awaitSingle()
        @Suppress("UNCHECKED_CAST")
        return body["data"] as? List<Map<String, Any?>> ?: error("No data list: $uri")
    }

    private fun Map<String, Any?>.str(key: String): String? = this[key]?.toString()?.takeIf { it.isNotBlank() }
    private fun Map<String, Any?>.num(key: String): Double = (this[key] as? Number)?.toDouble() ?: 0.0

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any?>.map(key: String): Map<String, Any?>? = this[key] as? Map<String, Any?>

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any?>.list(key: String): List<Map<String, Any?>> = this[key] as? List<Map<String, Any?>> ?: emptyList()

    @Suppress("UNCHECKED_CAST")
    private fun Map<String, Any?>.strList(key: String): List<String> =
        (this[key] as? List<Any?>)?.mapNotNull { it?.toString()?.takeIf(String::isNotBlank) } ?: emptyList()

    private fun mapOfNotNull(vararg pairs: Pair<String, String?>): Map<String, String> =
        pairs.mapNotNull { (k, v) -> v?.let { k to it } }.toMap()

    private fun log1p(n: Double): Float = ln(1.0 + n.coerceAtLeast(0.0)).toFloat()

    companion object {
        const val BLOG_POST = "blog_post"
        const val GAME = "game"
        const val CONCEPT = "concept"
        const val SERVICE = "service"
        const val DEAL_OFFER = "deal_offer"
        const val PRODUCT = "product"
        val TYPES = listOf(BLOG_POST, GAME, CONCEPT, SERVICE, DEAL_OFFER, PRODUCT)

        private const val KO = "ko"
        private const val PAGE = 100
    }
}
