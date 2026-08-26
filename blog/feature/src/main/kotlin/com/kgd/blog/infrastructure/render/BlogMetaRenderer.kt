package com.kgd.blog.infrastructure.render

import com.kgd.blog.application.post.dto.BlogAuthorSpace
import com.kgd.blog.application.post.dto.BlogCrumb
import com.kgd.blog.application.post.dto.BlogPostDetail
import com.kgd.blog.application.post.dto.BlogPostSummary
import org.commonmark.parser.Parser
import org.commonmark.renderer.html.HtmlRenderer
import org.springframework.beans.factory.annotation.Value
import com.kgd.blog.application.post.port.BlogPageRenderPort
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.format.DateTimeFormatter

/**
 * 글 상세·작성자 공간의 HTML 을 조립한다 (ADR-0072 §6).
 *
 * 빌드타임 프리렌더(`scripts/prerender-seo.mjs`)와 **같은 계약**을 쓴다 —
 * `<!--seo:start-->…<!--seo:end-->` 를 페이지 메타로 갈고 `#root` 에 크롤러용 본문을 넣는다.
 * 계약을 공유하므로 나중에 이 경로를 프리렌더로 되돌리거나 그 반대로 가는 것이 가능하다.
 */
@Component
class BlogMetaRenderer(
    @Value("\${blog.origin:https://blog.1989v.com}") private val origin: String,
    private val objectMapper: ObjectMapper,
) : BlogPageRenderPort {
    private val parser = Parser.builder().build()

    /**
     * 저자가 쓴 raw HTML 은 이스케이프한다. 이 사본은 SPA 가 마운트되면 교체되는 크롤러용이라
     * 표현이 조금 달라도 무방하고, 그 대가로 XSS 경로가 통째로 사라진다.
     */
    private val renderer = HtmlRenderer.builder().escapeHtml(true).build()

    override fun postPage(shell: String?, detail: BlogPostDetail): String {
        val post = detail.post
        val canonical = BlogSeoCopy.postUrl(origin, post.slug)
        val meta = metaTags(
            title = BlogSeoCopy.postTitle(post),
            description = BlogSeoCopy.postDescription(post),
            canonical = canonical,
            image = post.coverImageUrl,
            ogType = "article",
            jsonLd = listOf(articleJsonLd(post, canonical), breadcrumbJsonLd(detail.breadcrumb)),
        )
        return compose(shell, meta, postBody(detail, canonical))
    }

    override fun authorPage(shell: String?, space: BlogAuthorSpace): String {
        val handle = space.author.handle.orEmpty()
        val canonical = BlogSeoCopy.authorUrl(origin, handle)
        val meta = metaTags(
            title = BlogSeoCopy.authorTitle(space.author),
            description = BlogSeoCopy.authorDescription(space.author, space.postCount),
            canonical = canonical,
            image = space.author.avatarUrl,
            ogType = "profile",
            jsonLd = listOf(personJsonLd(space, canonical)),
        )
        return compose(shell, meta, authorBody(space))
    }

    /** 없는 글·작성자. 색인은 막되 크롤은 열어 둔다(follow) — 링크 그래프까지 끊을 이유는 없다 */
    override fun notFoundPage(shell: String?): String {
        val meta = metaTags(
            title = "찾을 수 없는 글 | ${BlogSeoCopy.BRAND}",
            description = "요청한 글을 찾을 수 없습니다.",
            canonical = origin,
            image = null,
            ogType = "website",
            jsonLd = emptyList(),
            noindex = true,
        )
        return compose(shell, meta, shellBody("<h1>찾을 수 없는 글</h1><p><a href=\"/\">블로그 홈으로</a></p>"))
    }

    // ─── 조립 ──────────────────────────────────────────────────────────────

    private fun compose(shell: String?, meta: String, body: String): String {
        if (shell == null) return minimalHtml(meta, body)
        val withMeta = SEO_BLOCK.replace(shell) { "<!--seo:server-->\n    $meta" }
        return withMeta.replace(ShellHtmlProvider.ROOT_DIV, "<div id=\"root\">$body</div>")
    }

    /**
     * 셸을 한 번도 받지 못한 상태(콜드 스타트 + portal-fe 미기동)의 폴백.
     * SPA 는 없지만 **글은 읽힌다** — 공유된 링크가 빈 화면을 내는 것보다 낫다.
     */
    private fun minimalHtml(meta: String, body: String) = """
        <!doctype html>
        <html lang="ko">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            $meta
          </head>
          <body>$body</body>
        </html>
    """.trimIndent()

    private fun metaTags(
        title: String,
        description: String,
        canonical: String,
        image: String?,
        ogType: String,
        jsonLd: List<Map<String, Any?>>,
        noindex: Boolean = false,
    ): String {
        val lines = mutableListOf(
            "<title>${escape(title)}</title>",
            """<meta name="description" content="${escape(description)}" />""",
            """<link rel="canonical" href="${escape(canonical)}" />""",
            """<meta property="og:type" content="$ogType" />""",
            """<meta property="og:site_name" content="${escape(BlogSeoCopy.BRAND)}" />""",
            """<meta property="og:title" content="${escape(title)}" />""",
            """<meta property="og:description" content="${escape(description)}" />""",
            """<meta property="og:url" content="${escape(canonical)}" />""",
            """<meta property="og:locale" content="ko_KR" />""",
            """<meta name="twitter:card" content="${if (image != null) "summary_large_image" else "summary"}" />""",
            """<meta name="twitter:title" content="${escape(title)}" />""",
            """<meta name="twitter:description" content="${escape(description)}" />""",
        )
        if (noindex) lines += """<meta name="robots" content="noindex, follow" />"""
        if (image != null) {
            lines += """<meta property="og:image" content="${escape(image)}" />"""
            lines += """<meta name="twitter:image" content="${escape(image)}" />"""
        }
        jsonLd.filter { it.isNotEmpty() }.forEach {
            // </script> 가 JSON 문자열에 섞이면 파서가 조기 종료된다
            val json = objectMapper.writeValueAsString(it).replace("<", "\\u003c")
            lines += """<script type="application/ld+json">$json</script>"""
        }
        return lines.joinToString("\n    ")
    }

    // ─── 크롤러용 본문 ──────────────────────────────────────────────────────

    private fun postBody(detail: BlogPostDetail, canonical: String): String {
        val post = detail.post
        val crumbs = detail.breadcrumb.joinToString(" › ") {
            """<a href="/c${escape(it.path)}">${escape(it.name)}</a>"""
        }
        val author = post.author.handle
            ?.let { """<a href="/authors/${escape(it)}">${escape(post.author.displayName)}</a>""" }
            ?: escape(post.author.displayName)
        val published = post.publishedAt?.format(DateTimeFormatter.ISO_LOCAL_DATE).orEmpty()
        return shellBody(
            buildString {
                append("<nav>$crumbs</nav>")
                append("<h1>${escape(post.title)}</h1>")
                append("<p>$author · $published · ${post.readingMinutes}분</p>")
                append("<article>${renderer.render(parser.parse(detail.body))}</article>")
                append("""<p><a href="${escape(canonical)}">${escape(canonical)}</a></p>""")
            },
        )
    }

    private fun authorBody(space: BlogAuthorSpace): String {
        val items = space.posts.joinToString("") { post ->
            """<li><a href="/posts/${escape(post.slug)}">${escape(post.title)}</a></li>"""
        }
        return shellBody(
            buildString {
                append("<h1>${escape(space.author.displayName)}</h1>")
                space.author.bio?.let { append("<p>${escape(it)}</p>") }
                append("<ul>$items</ul>")
            },
        )
    }

    /** SPA 가 마운트되면 통째로 교체된다. 크롤러·JS 미실행 방문자에게 텍스트와 내부 링크를 남기는 것이 목적 */
    private fun shellBody(inner: String) =
        """<div style="max-width:760px;margin:0 auto;padding:32px 20px">$inner</div>"""

    // ─── 구조화 데이터 ─────────────────────────────────────────────────────

    private fun articleJsonLd(post: BlogPostSummary, canonical: String): Map<String, Any?> = buildMap {
        put("@context", "https://schema.org")
        put("@type", "BlogPosting")
        put("headline", post.title)
        put("description", BlogSeoCopy.postDescription(post))
        put("mainEntityOfPage", mapOf("@type" to "WebPage", "@id" to canonical))
        put("url", canonical)
        post.publishedAt?.let { put("datePublished", it.toString()) }
        put("author", mapOf("@type" to "Person", "name" to post.author.displayName))
        put("publisher", mapOf("@type" to "Organization", "name" to BlogSeoCopy.BRAND, "url" to origin))
        put("articleSection", post.categoryName.takeIf { it.isNotBlank() })
        post.coverImageUrl?.let { put("image", it) }
        if (post.ratingCount > 0) {
            put(
                "aggregateRating",
                mapOf(
                    "@type" to "AggregateRating",
                    "ratingValue" to String.format(java.util.Locale.ROOT, "%.1f", post.ratingAverage),
                    "ratingCount" to post.ratingCount,
                    "bestRating" to 5,
                    "worstRating" to 1,
                ),
            )
        }
    }

    private fun breadcrumbJsonLd(crumbs: List<BlogCrumb>): Map<String, Any?> {
        if (crumbs.isEmpty()) return emptyMap()
        return mapOf(
            "@context" to "https://schema.org",
            "@type" to "BreadcrumbList",
            "itemListElement" to crumbs.mapIndexed { index, crumb ->
                mapOf(
                    "@type" to "ListItem",
                    "position" to index + 1,
                    "name" to crumb.name,
                    "item" to BlogSeoCopy.categoryUrl(origin, crumb.path),
                )
            },
        )
    }

    private fun personJsonLd(space: BlogAuthorSpace, canonical: String): Map<String, Any?> = buildMap {
        put("@context", "https://schema.org")
        put("@type", "ProfilePage")
        put("url", canonical)
        put(
            "mainEntity",
            buildMap {
                put("@type", "Person")
                put("name", space.author.displayName)
                space.author.bio?.let { put("description", it) }
                space.author.avatarUrl?.let { put("image", it) }
            },
        )
    }

    private fun escape(value: String?): String = (value ?: "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")

    private companion object {
        val SEO_BLOCK = Regex("<!--seo:start-->[\\s\\S]*?<!--seo:end-->")
    }
}
